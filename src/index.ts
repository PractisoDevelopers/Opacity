import { Hono } from 'hono';
import usePrismaClient from './usePrismaClient';
import { nanoid } from 'nanoid';
import { HTTPException } from 'hono/http-exception';
import { ArchiveParseError, Parser } from '@practiso/sdk';
import { clientIdSize } from './magic';
import { Prisma } from '@prisma/client';
import { jwtAuth } from './anoJwt';
import * as jwt from 'hono/jwt';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface Env {
	PSARCHIVE_BUCKET: R2Bucket;
	DATABASE_URL: string;
	JWT_SECRET: string;
	S3_API_URL?: string;
	S3_BUCKET_NAME?: string;
	S3_ACCESS_KEY_ID?: string;
	S3_ACCESS_KEY?: string;
	S3_PUBLIC_URL?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
	const middleware = jwtAuth(c.env.JWT_SECRET);
	return middleware(c, next);
});

app.get('/archives', async (c) => {
	const prisma = usePrismaClient(c.env.DATABASE_URL);
	return c.json(await prisma.archive.findMany());
});

app.put('/upload', async (c) => {
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
	const name = body['name'] ?? null;
	const clientIdInsecure: string | null = c.get('jwtPayload')?.cid ?? null;

	if (!(content instanceof File) || (name && typeof name !== 'string')) {
		throw new HTTPException(400, { message: 'Invalid form structure.' });
	}

	const [checking, putting] = content.stream().tee();
	try {
		const parser = new Parser();
		await checking.pipeThrough(new DecompressionStream('gzip')).pipeTo(parser.sink);
		await parser.result();
	} catch (e) {
		if (e instanceof ArchiveParseError) {
			throw new HTTPException(400, { message: `Invalid content: ${e.message}.` });
		}
		throw e;
	} finally {
		await checking.cancel();
	}

	const prisma = usePrismaClient(c.env.DATABASE_URL);
	let archiveCreation: Promise<any>;
	let returnJson: any;
	if (clientIdInsecure) {
		const existingOwner = await prisma.owner.findFirst({ where: { clients: { some: { id: clientIdInsecure } } } });
		if (!existingOwner) {
			throw new HTTPException(403);
		}
		archiveCreation = prisma.archive.create({
			data: {
				id: archiveId,
				name: content.name,
				owner: {
					connect: {
						id: existingOwner.id,
					},
				},
			},
		});
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
		archiveCreation = prisma.archive.create({
			data: {
				id: archiveId,
				name: content.name,
				owner: { create: { clients: { create: { id: clientId, name: clientName } } } },
			},
		});

		const clientIdSigned = await jwt.sign({ cid: clientId }, c.env.JWT_SECRET);
		returnJson = { archiveId, jwt: clientIdSigned };
	}

	try {
		await Promise.all([c.env.PSARCHIVE_BUCKET.put(archiveId, putting), archiveCreation]);
	} catch (e) {
		if (e instanceof Prisma.PrismaClientKnownRequestError) {
			if (e.code === 'P2000') {
				throw new HTTPException(400, { message: 'Fields too long.' });
			} else if (e.code === 'P2002') {
				throw new HTTPException(409, { message: 'Fields would cause confliction with other users.' });
			}
		}
		throw e;
	}
	return c.json(returnJson);
});

app.get('/whoami', async (c) => {
	const payload = c.get('jwtPayload');
	if (typeof payload === 'undefined') {
		throw new HTTPException(401);
	}
	const { cid } = payload;
	if (!cid) {
		throw new HTTPException(400);
	}
	const prisma = usePrismaClient(c.env.DATABASE_URL);
	const client = await prisma.client.findUnique({
		where: { id: cid },
		include: { owner: { select: { name: true } } },
	});
	if (!client) {
		throw new HTTPException(403);
	}

	return c.json({ clientName: client.name, name: client.owner.name });
});

app.get('/download/:id', async (c) => {
	const id = c.req.param('id');
	if (c.env.S3_API_URL && c.env.S3_BUCKET_NAME && c.env.S3_PUBLIC_URL && c.env.S3_ACCESS_KEY_ID && c.env.S3_ACCESS_KEY) {
		const client = new S3Client({
			endpoint: c.env.S3_API_URL,
			region: 'auto',
			credentials: { accessKeyId: c.env.S3_ACCESS_KEY_ID, secretAccessKey: c.env.S3_ACCESS_KEY },
			endpointProvider(params) {
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
		return c.redirect(url);
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

export default app satisfies ExportedHandler<Env>;
