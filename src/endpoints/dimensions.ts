import { Hono } from 'hono';
import usePrismaClient from '../usePrismaClient';

export function useDimensions(app: Hono<OpacityEnv>) {
	app.get('/dimensions', async (c) => {
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const dims = await prisma.dimension.findMany({ select: { name: true } });
		return c.json(dims.map(({ name }) => name));
	});
}
