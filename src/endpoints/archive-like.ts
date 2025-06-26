import usePrismaClient from '../usePrismaClient';
import { jwtMandated } from '../anoJwt';
import { HTTPException } from 'hono/http-exception';
import { Prisma } from '@prisma/client';
import { Hono } from 'hono';
import * as magic from '../magic';

export function useArchiveLike(app: Hono<OpacityEnv>) {
	app.get('/archive/:id/like', async (c) => {
		const id = c.req.param('id');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const [likes, count] = await Promise.all([
			prisma.ownerLikesArchive.findMany({
				where: { archiveId: id, owner: { name: { not: null } } },
				include: { owner: { select: { name: true } } },
				take: magic.maxLikeSize,
			}),
			prisma.ownerLikesArchive.count({ where: { archiveId: id } }),
		]);

		return c.json({
			count,
			people: likes.map((like) => like.owner.name),
		});
	});

	app.put('/archive/:id/like', jwtMandated);
	app.put('/archive/:id/like', async (c) => {
		const id = c.req.param('id');
		const cid = c.get('clientId');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const owner = await prisma.owner.findFirst({
			select: { id: true },
			where: { clients: { some: { id: cid } } },
		});
		if (!owner) {
			throw new HTTPException(401);
		}
		try {
			await prisma.ownerLikesArchive.create({
				data: {
					archive: { connect: { id: id } },
					owner: { connect: { id: owner.id } },
				},
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2002') {
					throw new HTTPException(409, { message: 'Already liked.' });
				}
			}
			throw e;
		}
		return new Response(null, { status: 201 });
	});
	app.delete('/archive/:id/like', jwtMandated);
	app.delete('/archive/:id/like', async (c) => {
		const cid = c.get('clientId');
		const id = c.req.param('id');
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const owner = await prisma.owner.findFirst({
			select: { id: true },
			where: { clients: { some: { id: cid } } },
		});
		if (!owner) {
			throw new HTTPException(401);
		}
		try {
			await prisma.ownerLikesArchive.delete({
				where: { archiveId_ownerId: { archiveId: id, ownerId: owner.id } },
			});
		} catch (e) {
			if (e instanceof Prisma.PrismaClientKnownRequestError) {
				if (e.code === 'P2001') {
					throw new HTTPException(404, { message: 'Not liked.' });
				}
			}
			throw e;
		}
		return new Response(null, { status: 202 });
	});
}
