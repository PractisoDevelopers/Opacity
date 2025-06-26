import { Hono } from 'hono';
import { jwtMandated } from '../anoJwt';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';

export function useWhoami(app: Hono<OpacityEnv>) {
	app.get('/whoami', jwtMandated);
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
}
