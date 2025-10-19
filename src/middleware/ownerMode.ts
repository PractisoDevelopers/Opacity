import { createMiddleware } from 'hono/factory';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';

const ownerMode = createMiddleware<OpacityEnv>(async (c, next) => {
	const payload = c.get('jwtPayload');
	if (typeof payload === 'undefined') {
		await next();
		return;
	}
	const { cid } = payload;
	const prisma = usePrismaClient(c.env.DATABASE_URL);
	const client = await prisma.client.findUnique({ where: { id: cid }, select: { owner: { select: { mode: true } } } });
	if (!client) {
		throw new HTTPException(401, { message: 'Authentication token is invalid.' });
	}
	c.set('ownerMode', client.owner.mode);
	await next();
});

export default ownerMode;
