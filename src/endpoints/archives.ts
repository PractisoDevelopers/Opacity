import { Hono } from 'hono';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';
import { pageSize } from '../magic';

type SortOrder = 'asc' | 'desc';

export function useArchives(app: Hono<OpacityEnv>) {
	app.get('/archives', async (c) => {
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const query = c.req.query();
		let sortBy = query['by'],
			sortOrder = query['order'] as SortOrder,
			page = parseInt(query['page'] ?? 0),
			orderBy;

		if (sortOrder) {
			const expected = ['asc', 'desc'];
			if (!expected.includes(sortOrder)) {
				throw new HTTPException(400, { message: `Bad sort order: ${sortOrder}. One of ${expected.join(', ')} was expected.` });
			}
		} else {
			sortOrder = 'asc';
		}

		switch (sortBy) {
			case 'likes':
				orderBy = { likes: { _count: sortOrder } };
				break;
			default:
				sortBy = sortBy ?? 'updateTime';
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
				orderBy = { [sortBy]: sortOrder };
		}

		const select = {
			id: true,
			name: true,
			updateTime: true,
			uploadTime: true,
			owner: { select: { name: true } },
		};
		const pagination = (
			await prisma.archive.findMany({
				select,
				orderBy,
				skip: page * pageSize,
				take: pageSize,
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
