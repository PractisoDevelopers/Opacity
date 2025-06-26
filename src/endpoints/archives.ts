import { Hono } from 'hono';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';

export function useArchives(app: Hono<OpacityEnv>) {
	app.get('/archives', async (c) => {
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const query = c.req.query();
		let sortBy = query['by'],
			sortOrder = query['order'],
			predecessor = query['predecessor'];

		if (sortBy) {
			const mapping: { [key: string]: string } = {
				name: 'name',
				upload: 'uploadTime',
				update: 'updateTime',
			};
			if (sortBy in mapping) {
				sortBy = mapping[sortBy];
			} else {
				throw new HTTPException(400, {
					message: `Bad sort keyword: ${sortBy}. One of ${Object.keys(mapping).join(', ')} was expected.`,
				});
			}
		} else {
			sortBy = 'name';
		}

		if (sortOrder) {
			const expected = ['asc', 'dsc'];
			if (!expected.includes(sortOrder)) {
				throw new HTTPException(400, { message: `Bad sort order: ${sortOrder}. One of ${expected.join(', ')} was expected.` });
			}
		} else {
			sortOrder = 'asc';
		}

		const select = {
			id: true,
			name: true,
			updateTime: true,
			uploadTime: true,
			owner: { select: { name: true } },
		};
		switch (sortBy) {
		}
		if (predecessor) {
			const find = await prisma.archive.findUnique({ where: { id: predecessor }, select: {} });
			if (!find) {
				throw new HTTPException(400, { message: 'Unknown predecessor.' });
			}
		}
		const pagination = (
			await prisma.archive.findMany({
				select,
				orderBy: {
					[sortBy]: sortOrder,
				},
				where: predecessor ? { id: { gt: predecessor } } : undefined,
				take: 20,
			})
		).map((archive) => ({
			id: archive.id,
			name: archive.name,
			uploadTime: archive.uploadTime.toISOString(),
			updateTime: archive.updateTime.toISOString(),
			ownerName: archive.owner.name,
		}));
		return c.json(pagination);
	});
}
