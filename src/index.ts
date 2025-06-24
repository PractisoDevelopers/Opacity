import { Hono } from 'hono';
import usePrismaClient from './usePrismaClient';
import { nanoid } from 'nanoid';
import { HTTPException } from 'hono/http-exception';
import { ArchiveParseError, Parser } from '@practiso/sdk';
import { clientIdSize } from './magic';
import { Prisma } from '@prisma/client';

interface Env {
	PSARCHIVE_BUCKET: R2Bucket;
	DATABASE_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

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
	const clientIdInsecure = body['client_id'] ?? null;

	if (!(content instanceof File) || (name && typeof name !== 'string') || (clientIdInsecure && typeof clientIdInsecure !== 'string')) {
		throw new HTTPException(400, { message: 'Invalid form structure.' });
	}

	const [checking, putting] = content.stream().tee();
	try {
		const parser = new Parser();
		await checking.pipeThrough(new DecompressionStream('gzip')).pipeTo(parser.sink);
		const archive = await parser.result();
	} catch (e) {
		if (e instanceof ArchiveParseError) {
			throw new HTTPException(400, { message: `Invalid content: ${e.message}.` });
		}
		throw e;
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
		const clientName = body['client_name'];
		if (clientName && typeof clientName !== 'string') {
			throw new HTTPException(400, { message: 'Bad client name.' });
		}
		archiveCreation = prisma.archive.create({
			data: {
				id: archiveId,
				name: content.name,
				owner: { create: { clients: { create: { id: clientId, name: clientName } } } },
			},
		});
		returnJson = { archiveId, clientId };
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
		console.error(e);
		throw new HTTPException(500);
	}
	return c.json(returnJson);
});

export default app satisfies ExportedHandler<Env>;
