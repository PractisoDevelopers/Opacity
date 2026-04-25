import { Hono } from 'hono';
import usePrismaClient from '../usePrismaClient';
import { getArchives, SortOrder } from './archives';
import { HTTPException } from 'hono/http-exception';
import { Prisma } from '@prisma/client';
import ownerMode from '../middleware/ownerMode';
import Privileges from '../privilege';

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

	app.get('/dimension/:id/archives', ownerMode, async (c) => {
		const privileges = new Privileges(c.get('ownerMode'));
		const id = c.req.param('id');
		const query = c.req.query();
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const sortBy = query['by'],
			sortOrder = query['order'] as SortOrder,
			predecessor = query['predecessor'];

		const jwt = c.get('jwtPayload');
		const owner = jwt ? await prisma.owner.findFirst({ where: { clients: { some: { id: jwt.cid } } }, select: { id: true } }) : null;
		let accessControl: Prisma.ArchiveWhereInput | undefined;
		if (jwt && !privileges.user.read && privileges.others.read) {
			accessControl = { owner: { NOT: { clients: { some: { id: jwt.cid } } } } };
		} else if (privileges.user.read && !privileges.others.read) {
			if (jwt) {
				accessControl = { owner: { clients: { some: { id: jwt.cid } } } };
			} else {
				return c.json([]);
			}
		}

		return c.json(
			await getArchives({
				prisma,
				sortBy,
				sortOrder,
				predecessor,
				where: { dimensions: { some: { dimension: { name: id } } }, ...accessControl },
				ownerId: owner?.id,
				dimojiWorkflow: c.env.DIMOJI_GEN_WORKFLOW,
			}),
		);
	});
}
