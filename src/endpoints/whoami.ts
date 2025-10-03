import { Hono } from 'hono';
import { jwtMandated } from '../middleware/anoJwt';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';
import { Prisma } from '@prisma/client';
import { maxNameLength } from '../magic';
import { Names } from '../validify/name';

export function useWhoami(app: Hono<OpacityEnv>) {
	app.all('/whoami', jwtMandated);
	app.get('/whoami', async (c) => {
		const cid = c.get('clientId');
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
			updateInput.owner = { update: { name: newName } };
		}
		prisma.client.update({ where: { id: cid }, data: updateInput });
	});
}

function validifyName(newName: any, domain: string) {
	return Names.validify(newName, domain);
}
