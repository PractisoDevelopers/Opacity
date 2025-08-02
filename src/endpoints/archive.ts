import { jwtMandated } from '../middleware/anoJwt';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { PractisoArchive, QuizArchive } from '@practiso/sdk/lib/model';
import { ArchiveParseError, Parser } from '@practiso/sdk';
import { clientIdSize, maxNameLength } from '../magic';
import * as jwt from 'hono/jwt';
import { Prisma, PrismaClient } from '@prisma/client';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mapToMetadata } from './archives';
import { defaultCache, etagCache, timedCache } from '../middleware/cache';

export function useArchive(app: Hono<OpacityEnv>) {
	app.put('/archive', async (c) => {
		const archiveId = nanoid();
		let body;
		try {
			body = await c.req.parseBody();
		} catch (e) {
			if (e instanceof TypeError) {
				throw new HTTPException(400, { message: e.message });
			}
			throw e;
		}
		const content = body['content'];
		const nameInsure = body['name'] ?? null;
		const clientIdInsecure: string | undefined = c.get('jwtPayload')?.cid;

		if (!(content instanceof File) || (nameInsure && typeof nameInsure !== 'string')) {
			throw new HTTPException(400, { message: 'Invalid form structure.' });
		}
		const name = validifyName(nameInsure ?? content.name);

		const [checking, putting] = content.stream().tee();
		let archive: PractisoArchive;
		try {
			const parser = new Parser();
			await checking.pipeThrough(new DecompressionStream('gzip')).pipeTo(parser.sink);
			archive = await parser.result();
		} catch (e) {
			if (e instanceof ArchiveParseError) {
				throw new HTTPException(400, { message: `Invalid content: ${e.message}.` });
			}
			throw e;
		}

		const prisma = usePrismaClient(c.env.DATABASE_URL);
		let ownerData, returnJson;
		if (clientIdInsecure) {
			const existingOwner = await prisma.owner.findFirst({ where: { clients: { some: { id: clientIdInsecure } } } });
			if (!existingOwner) {
				throw new HTTPException(403);
			}
			ownerData = { connect: { id: existingOwner.id } };
			returnJson = { archiveId };
		} else {
			const clientId = nanoid(clientIdSize);
			const clientName = body['client-name'];
			if (!clientName) {
				throw new HTTPException(400, { message: 'Missing client name.' });
			}
			if (typeof clientName !== 'string') {
				throw new HTTPException(400, { message: 'Bad client name.' });
			}
			ownerData = { create: { clients: { create: { id: clientId, name: clientName } } } };

			const clientIdSigned = await jwt.sign({ cid: clientId }, c.env.JWT_SECRET);
			returnJson = { archiveId, jwt: clientIdSigned };
		}

		try {
			const [, quizCountByDim] = await Promise.all([
				c.env.PSARCHIVE_BUCKET.put(archiveId, putting),
				createArchiveRecord(prisma, archiveId, archive, name, ownerData),
			]);
			await c.env.DIMOJI_GEN_WORKFLOW.create({
				params: {
					names: Object.keys(quizCountByDim),
				},
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				console.warn(e);
				if (e.code === 'P2000') {
					throw new HTTPException(400, { message: 'Fields too long.' });
				} else if (e.code === 'P2002') {
					throw new HTTPException(409, { message: 'Fields would cause confliction with other users.' });
				}
			}
			throw e;
		}
		return c.json(returnJson, 201);
	});

	app.get('/archive/:id', defaultCache, skipArchiveFileMiddleware, async (c) => {
		const id = c.req.param('id');
		if (c.env.S3_API_URL && c.env.S3_BUCKET_NAME && c.env.S3_PUBLIC_URL && c.env.S3_ACCESS_KEY_ID && c.env.S3_ACCESS_KEY) {
			const client = new S3Client({
				endpoint: c.env.S3_API_URL,
				region: 'auto',
				credentials: { accessKeyId: c.env.S3_ACCESS_KEY_ID, secretAccessKey: c.env.S3_ACCESS_KEY },
				endpointProvider() {
					return {
						url: new URL(c.env.S3_PUBLIC_URL!),
						headers: {
							'Content-Type': ['application/gzip'],
							'Content-Disposition': [`attachment; filename="${id}.psarchive"`],
						},
					};
				},
			});
			const url = await getSignedUrl(client, new GetObjectCommand({ Key: id, Bucket: c.env.S3_BUCKET_NAME }));
			if (!url) {
				throw new HTTPException(404);
			}

			const prisma = usePrismaClient(c.env.DATABASE_URL);
			prisma.archive.update({
				where: { id },
				data: { downloads: { increment: 1 } },
			});
			return c.redirect(url, 301);
		}

		const storage = await c.env.PSARCHIVE_BUCKET.get(id);
		if (!storage) {
			throw new HTTPException(404);
		}
		const ct = storage.httpMetadata?.contentType;
		return new Response(storage.body, {
			headers: {
				etag: storage.httpEtag,
				'Content-Type': ct ?? 'application/gzip',
				'Content-Disposition': `attachment; filename="${id}.psarchive"`,
			},
		});
	});

	app.get('/archive/:id/metadata', skipArchiveMetadataMiddleware, async (c) => {
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const id = c.req.param('id');
		const archive = await prisma.archive.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				updateTime: true,
				uploadTime: true,
				owner: { select: { name: true } },
				_count: { select: { likes: true } },
				dimensions: { select: { quizCount: true, dimension: { select: { name: true, emoji: true } } } },
			},
		});
		if (!archive) {
			throw new HTTPException(404);
		}
		return c.json(mapToMetadata(archive), {
			headers: { 'Last-Modified': archive.updateTime.getTime().toString() },
		});
	});

	app.delete('/archive/:id', jwtMandated, async (c) => {
		const id = c.req.param('id');
		const cid = c.get('clientId');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const archive = await prisma.archive.findUnique({
			where: { id },
			include: {
				owner: {
					include: { clients: { where: { id: cid } } },
				},
			},
		});
		if (!archive) {
			throw new HTTPException(404, { message: 'Archive not found.' });
		}
		if (!archive.owner.clients) {
			throw new HTTPException(403, { message: 'Not owning this archive.' });
		}
		await prisma.$transaction(async () => {
			await Promise.all([prisma.archive.delete({ where: { id } }), c.env.PSARCHIVE_BUCKET.delete(id)]);
		});
		return new Response(null, { status: 202 });
	});

	app.patch('/archive/:id', jwtMandated, async (c) => {
		const id = c.req.param('id');
		const clientId = c.get('clientId');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		if (
			!(await prisma.archive.findUnique({
				where: { id, owner: { clients: { some: { id: clientId } } } },
				select: { id: true },
			}))
		) {
			throw new HTTPException(403, { message: 'Not owning this archive.' });
		}
		const r2Obj = await c.env.PSARCHIVE_BUCKET.head(id);
		if (!r2Obj) {
			throw new HTTPException(404);
		}
		const updatedHeaders = {
			etag: r2Obj.etag,
			...r2Obj.httpMetadata,
			...(r2Obj.httpMetadata?.cacheExpiry ? { cacheExpiry: r2Obj.httpMetadata?.cacheExpiry?.getTime()?.toString() } : {}),
		} as any;
		const body = await c.req.parseBody();
		const data = {
			name: body.name ? validifyName(body.name) : undefined,
		};
		if (!Object.entries(data).some((v) => v)) {
			return new Response(null, { status: 304, headers: updatedHeaders });
		}
		await prisma.archive.update({
			where: { id },
			data: {
				...data,
				updateTime: new Date(),
			},
		});
		return new Response(null, { status: 204, headers: updatedHeaders });
	});
}

type QuizCountByDimension = { [dim: string]: number };

function getDimensionQuizCount(archiveContent: QuizArchive[]): QuizCountByDimension {
	const counter: { [key: string]: number } = {};
	for (const quiz of archiveContent) {
		for (const dim of quiz.dimensions) {
			counter[dim.name] = (counter[dim.name] ?? 0) + 1;
		}
	}
	return counter;
}

function getUpdateTime(archive: PractisoArchive) {
	const updateTimeQuiz = archive.content.reduce((acc, curr) =>
		(acc.modificationTime ?? acc.creationTime).getTime() > (curr.modificationTime ?? curr.creationTime).getTime() ? acc : curr,
	);
	return updateTimeQuiz.modificationTime ?? updateTimeQuiz.creationTime;
}

async function createArchiveRecord(
	prisma: PrismaClient,
	archiveId: string,
	archive: PractisoArchive,
	name: string,
	ownerData: any,
): Promise<QuizCountByDimension> {
	const quizCountByDim = getDimensionQuizCount(archive.content);
	await prisma.dimension.createMany({
		data: Object.keys(quizCountByDim).map((dName) => ({ name: dName })),
		skipDuplicates: true,
	});
	const dimensions = await prisma.dimension.findMany({
		where: { name: { in: Object.keys(quizCountByDim) } },
		select: { id: true },
	});
	const archiveDimensions = Object.values(quizCountByDim).map((qCount, index) => ({
		dimensionId: dimensions[index].id,
		quizCount: qCount,
	}));
	await prisma.archive.create({
		data: {
			id: archiveId,
			name,
			updateTime: getUpdateTime(archive),
			owner: ownerData,
			dimensions: { createMany: { data: archiveDimensions } },
		},
	});
	return quizCountByDim;
}

function validifyName(name: any) {
	if (!name || typeof name !== 'string') {
		throw new HTTPException(400, { message: 'Missing name property.' });
	}
	const processed = name.replaceAll(/\s{2,}/g, ' ');
	if (processed.length > maxNameLength) {
		throw new HTTPException(400, { message: 'Invalid name property.' });
	}
	return processed;
}

const skipArchiveFileMiddleware = etagCache<{ Bindings: Bindings }>(async (c) => {
	const id = c.req.param('id');
	const archive = await c.env.PSARCHIVE_BUCKET.head(id);
	if (!archive) {
		throw new HTTPException(404);
	}
	return archive.httpEtag;
});

const skipArchiveMetadataMiddleware = timedCache<{ Bindings: Bindings }>(async (c) => {
	const prisma = usePrismaClient(c.env.DATABASE_URL);
	const id = c.req.param('id');
	const archive = await prisma.archive.findUnique({ where: { id }, select: { updateTime: true } });
	if (!archive) {
		throw new HTTPException(404);
	}
	return archive.updateTime;
});
