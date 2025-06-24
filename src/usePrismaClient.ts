import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

export type PrismaDriver = 'neon' | 'pg';

export default function (connectionString: string, driver?: PrismaDriver) {
	const adapterNeon = new PrismaNeon({ connectionString });
	return new PrismaClient({ adapter: adapterNeon });
}
