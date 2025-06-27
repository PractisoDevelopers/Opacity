import { Hono } from 'hono';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';
import { pageSize } from '../magic';
import { Prisma } from '@prisma/client';

type SortOrder = 'asc' | 'desc';

export function useArchives(app: Hono<OpacityEnv>) {
	app.get('/archives', async (c) => {
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const query = c.req.query();
		let sortBy = query['by'],
			sortOrder = query['order'] as SortOrder,
			predecessor = query['predecessor'],
			orderBy: Prisma.ArchiveOrderByWithRelationInput;

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
				sortBy = sortBy ?? 'update';
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
		const pagination = await prisma.archive.findMany({
			select,
			orderBy,
			cursor: predecessor ? { id: predecessor } : undefined,
			take: pageSize + 1,
		});
		return c.json({
			page: pagination.slice(0, pageSize).map(mapToMetadata),
			next: pagination.length > pageSize ? pagination[pagination.length - 1].id : undefined,
		});
	});
}

export function mapToMetadata(dbModel: {
	id: string
	name: string | null
	uploadTime: Date
	updateTime: Date
	owner: {
		name: string | null
	}
}) {
	return {
		id: dbModel.id,
		name: dbModel.name,
		uploadTime: dbModel.uploadTime.toISOString(),
		updateTime: dbModel.updateTime.toISOString(),
		ownerName: dbModel.owner.name,
	}
}
