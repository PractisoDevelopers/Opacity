import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

export default function (connectionString: string) {
	const adapterNeon = new PrismaNeon({ connectionString });
	return new PrismaClient({ adapter: adapterNeon });
}
