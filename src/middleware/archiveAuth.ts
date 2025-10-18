import { createMiddleware } from 'hono/factory';
import usePrismaClient from '../usePrismaClient';
import * as assertions from '../assertions';
import Privileges from '../privilege';

/**
 * Assert that client must have {@link access} to :id
 * Depends on {@link ownerMode} middleware
 */
export default function archiveAuth(access: 'read' | 'write') {
	return createMiddleware<OpacityEnv>(async (c, next) => {
		const id = c.req.param('id');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const jwt = c.get('jwtPayload');
		const isOwenr =
			typeof jwt !== 'undefined' &&
			(await prisma.archive.count({ take: 1, where: { id, AND: { owner: { clients: { some: { id: jwt.cid } } } } } })) > 0;
		const privileges = new Privileges(c.get('ownerMode'));
		assertions.hasPrivilege(isOwenr ? privileges.user[access] : privileges.others[access]);
		await next();
	});
}
