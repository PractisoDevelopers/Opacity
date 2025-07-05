import { Hono } from 'hono';
import usePrismaClient from '../usePrismaClient';
import { getArchives, SortOrder } from './archives';

export function useDimensions(app: Hono<OpacityEnv>) {
	app.get('/dimensions', async (c) => {
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const dims = await prisma.dimension.findMany({
			select: {
				name: true,
				archives: {
					include: {
						archive: {
							select: {
								_count: true,
								dimensions: {
									select: { quizCount: true },
									where: { dimension: { id: { equals: prisma.dimension.fields.id } } },
								},
							},
						},
					},
				},
			},
		});
		return c.json(
			dims.map(({ name, archives }) => ({
				name,
				quizCount: archives.reduce((acc, curr) => acc + curr.quizCount, 0),
			})),
		);
	});

	app.get('/dimension/:id/archives', async (c) => {
		const id = c.req.param('id');
		const query = c.req.query();
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const sortBy = query['by'],
			sortOrder = query['order'] as SortOrder,
			predecessor = query['predecessor'];
		return c.json(await getArchives(prisma, sortBy, sortOrder, predecessor, { dimensions: { some: { dimension: { name: id } } } }));
	});
}
