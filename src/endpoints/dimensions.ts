import { Hono } from 'hono';
import usePrismaClient from '../usePrismaClient';
import { getArchives, SortOrder } from './archives';
import { HTTPException } from 'hono/http-exception';

const MAX_QUERY_SIZE = 100;
const DEFAULT_QUERY_SIZE = 20;

export function useDimensions(app: Hono<OpacityEnv>) {
	app.get('/dimensions', async (c) => {
		const takeQuery = c.req.query('first');
		const take = takeQuery ? parseInt(takeQuery) : DEFAULT_QUERY_SIZE;
		if (take > MAX_QUERY_SIZE) {
			throw new HTTPException(400, { message: 'Exceeding maximum query size.' });
		}
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const dims = await prisma.dimensionOnArchive
			.groupBy({
				by: ['dimensionId'],
				_sum: { quizCount: true },
				orderBy: { _sum: { quizCount: 'desc' } },
				take,
			})
			.then((meta) =>
				prisma.dimension
					.findMany({
						where: { id: { in: meta.map(({ dimensionId }) => dimensionId) } },
						select: { id: true, emoji: true, name: true },
					})
					.then((dims) => ({ meta, dims })),
			)
			.then(({ meta, dims }) =>
				meta.map(({ _sum, dimensionId }) => ({ quizCount: _sum, ...dims.find(({ id }) => id == dimensionId)! })),
			);

		const noDimoji = new Set(dims.filter(({ emoji }) => !emoji).map(({ name }) => name));
		if (noDimoji) {
			const names = Array.from(noDimoji.values());
			await c.env.DIMOJI_GEN_WORKFLOW.create({ params: { names } });
		}

		return c.json(
			dims.map(({ name, emoji, quizCount }) => ({
				name,
				emoji,
				quizCount: quizCount.quizCount ?? 0,
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

		const jwt = c.get('jwtPayload');
		const owner = jwt ? await prisma.owner.findFirst({ where: { clients: { some: { id: jwt.cid } } }, select: { id: true } }) : null;
		return c.json(
			await getArchives({
				prisma,
				sortBy,
				sortOrder,
				predecessor,
				where: { dimensions: { some: { dimension: { name: id } } } },
				ownerId: owner?.id,
				dimojiWorkflow: c.env.DIMOJI_GEN_WORKFLOW,
			}),
		);
	});
}
