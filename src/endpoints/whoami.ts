import { Hono } from 'hono';
import { jwtMandated } from '../middleware/anoJwt';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';
import { Prisma } from '@prisma/client';
import { Names } from '../validify/name';
import { nanoid } from 'nanoid';
import { clientIdSize } from '../magic';
import * as jwt from 'hono/jwt';

export function useWhoami(app: Hono<OpacityEnv>) {
	app.all('/whoami', jwtMandated);
	app.get('/whoami', async (c) => {
		const cid = c.get('clientId');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const client = await prisma.client.findUnique({
			where: { id: cid },
			include: { owner: { select: { id: true, name: true, mode: true } } },
		});
		if (!client) {
			throw new HTTPException(403);
		}

		return c.json({ clientName: client.name, name: client.owner.name, ownerId: client.owner.id, mode: client.owner.mode });
	});
	app.patch('/whoami', async (c) => {
		const cid = c.get('clientId');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const form = await c.req.formData();
		const updateInput: Prisma.ClientUpdateInput = {};

		if (form.has('client-name')) {
			const newName = validifyName(form.get('client-name'), 'client name');
			updateInput.name = newName;
		}
		if (form.has('owner-name')) {
			const newName = validifyName(form.get('owner-name'), 'owner name');
			if (newName) {
				updateInput.owner = { update: { name: newName } };
			} else {
				updateInput.owner = { update: { name: null } };
			}
		}
		await prisma.client.update({ where: { id: cid }, data: updateInput });
		return new Response(null, { status: 201 });
	});
	app.delete('/whoami', async (c) => {
		const cid = c.get('clientId');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const owner = await prisma.owner.findFirst({
			where: { clients: { some: { id: cid } } },
			select: {
				id: true,
				archives: { select: { id: true } },
			},
		});

		if (!owner) {
			throw new HTTPException(403);
		}

		await prisma.$transaction(async (transaction) => {
			await transaction.client.deleteMany({ where: { ownerId: owner.id } });
			await transaction.owner.delete({ where: { id: owner.id } });
		});

		await deleteArchiveObjects(c.env.PSARCHIVE_BUCKET, owner.archives.map((archive) => archive.id));

		return new Response(null, { status: 202 });
	});
	app.post('/whoami/fork', jwtMandated, async (c) => {
		const cid = c.get('clientId');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const client = await prisma.client.findUnique({
			where: { id: cid },
			select: { name: true, ownerId: true },
		});

		if (!client) {
			throw new HTTPException(403);
		}

		let clientName = client.name;
		const contentType = c.req.header('content-type');
		if (contentType?.includes('multipart/form-data') || contentType?.includes('application/x-www-form-urlencoded')) {
			const form = await c.req.formData();
			if (form.has('client-name')) {
				clientName = validifyName(form.get('client-name'), 'client name');
			}
		}

		const clientId = nanoid(clientIdSize);
		await prisma.client.create({ data: { id: clientId, name: clientName, ownerId: client.ownerId } });

		return c.json({ jwt: await jwt.sign({ cid: clientId }, c.env.JWT_SECRET) }, 201);
	});
}

function validifyName(newName: any, domain: string) {
	return Names.validify(newName, domain);
}

async function deleteArchiveObjects(bucket: R2Bucket, archiveIds: string[]) {
	for (let index = 0; index < archiveIds.length; index += 100) {
		await bucket.delete(archiveIds.slice(index, index + 100));
	}
}
