import { Hono } from 'hono';
import usePrismaClient from '../usePrismaClient';
import { HTTPException } from 'hono/http-exception';
import { pageSize } from '../magic';
import { Prisma, PrismaClient } from '@prisma/client';

export function useArchives(app: Hono<OpacityEnv>) {
	app.get('/archives', async (c) => {
		const prisma = usePrismaClient(c.env.DATABASE_URL);
		const query = c.req.query();
		const sortBy = query['by'],
			sortOrder = query['order'] as SortOrder,
			predecessor = query['predecessor'];
		return c.json(
			await getArchives({
				prisma,
				sortBy,
				sortOrder,
				predecessor,
				dimojiWorkflow: c.env.DIMOJI_GEN_WORKFLOW,
			}),
		);
	});
}

export async function getArchives(opts: {
	prisma: PrismaClient;
	sortBy?: string;
	sortOrder?: SortOrder;
	predecessor?: string;
	where?: Prisma.ArchiveWhereInput;
	dimojiWorkflow?: Workflow;
}) {
	let orderBy: Prisma.ArchiveOrderByWithRelationInput;

	if (opts.sortOrder) {
		const expected = ['asc', 'desc'];
		if (!expected.includes(opts.sortOrder)) {
			throw new HTTPException(400, { message: `Bad sort order: ${opts.sortOrder}. One of ${expected.join(', ')} was expected.` });
		}
	} else {
		opts.sortOrder = 'asc';
	}

	switch (opts.sortBy) {
		case 'likes':
			orderBy = { likes: { _count: opts.sortOrder } };
			break;
		default:
			opts.sortBy = opts.sortBy ?? 'update';
			const mapping: { [key: string]: string } = {
				name: 'name',
				upload: 'uploadTime',
				update: 'updateTime',
			};
			if (opts.sortBy in mapping) {
				opts.sortBy = mapping[opts.sortBy];
			} else {
				throw new HTTPException(400, {
					message: `Bad sort keyword: ${opts.sortBy}. One of ${Object.keys(mapping).join(', ')} was expected.`,
				});
			}
			orderBy = { [opts.sortBy]: opts.sortOrder };
	}

	const pagination = await opts.prisma.archive.findMany({
		select: {
			id: true,
			name: true,
			updateTime: true,
			uploadTime: true,
			owner: { select: { name: true } },
			dimensions: { select: { quizCount: true, dimension: { select: { name: true, emoji: true } } } },
			_count: { select: { likes: true } },
		},
		where: opts.where,
		orderBy,
		cursor: opts.predecessor ? { id: opts.predecessor } : undefined,
		take: pageSize + 1,
	});

	if (opts.dimojiWorkflow) {
		const noDimojis = Array.from(new Set(pagination.flatMap(({ dimensions }) => dimensions)).values())
			.filter(({ dimension }) => !dimension.emoji)
			.map(({ dimension }) => dimension.name);
		if (noDimojis.length > 0) {
			await opts.dimojiWorkflow.create({ params: { name: noDimojis } });
		}
	}

	return {
		page: pagination.slice(0, pageSize).map(mapToMetadata),
		next: pagination.length > pageSize ? pagination[pagination.length - 1].id : undefined,
	};
}

export function mapToMetadata(dbModel: {
	id: string;
	name: string | null;
	uploadTime: Date;
	updateTime: Date;
	owner: {
		name: string | null;
	};
	_count: { likes: number };
	dimensions: {
		dimension: {
			name: string;
			emoji: string | null;
		};
		quizCount: number;
	}[];
}) {
	return {
		id: dbModel.id,
		name: dbModel.name,
		likes: dbModel._count.likes,
		uploadTime: dbModel.uploadTime.toISOString(),
		updateTime: dbModel.updateTime.toISOString(),
		ownerName: dbModel.owner.name,
		dimensions: dbModel.dimensions.map(({ dimension, quizCount }) => ({
			name: dimension.name,
			quizCount,
			emoji: dimension.emoji,
		})),
	};
}

export type SortOrder = 'asc' | 'desc';
