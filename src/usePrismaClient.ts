import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

const cache = new Map<string, PrismaClient>();
export default function (connectionString: string) {
	if (cache.has(connectionString)) {
		return cache.get(connectionString)!;
	}
	const adapterNeon = new PrismaNeon({ connectionString });
	const client = new PrismaClient({ adapter: adapterNeon });
	cache.set(connectionString, client);
	return client;
}
