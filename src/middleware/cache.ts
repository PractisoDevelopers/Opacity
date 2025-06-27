import { cache } from 'hono/cache';
import { createMiddleware } from 'hono/factory';
import { Context } from 'hono';
import type { Env, Input } from 'hono/types';

export const defaultCache = cache({
	cacheName: 'opacity',
	cacheControl: 'max-age=600',
	cacheableStatusCodes: [200, 301],
});

export function timedCache<E extends Env = any, P extends string = any, I extends Input = {}>(
	getModTime: (c: Context<E, P, I>) => Promise<Date>,
) {
	return createMiddleware<E, P, I>(async (c, next) => {
		const rememberedUpdate = c.req.header('If-Modified-Since');
		if (rememberedUpdate) {
			const currentUpdate = (await getModTime(c)).getTime();
			if (currentUpdate <= Date.parse(rememberedUpdate)) {
				return new Response(null, { status: 304 });
			}
		}
		await next();
	});
}

export function etagCache<E extends Env = any, P extends string = any, I extends Input = {}>(
	getETag: (c: Context<E, P, I>) => Promise<string>,
) {
	return createMiddleware(async (c, next) => {
		const rememberedETag = c.req.header('If-None-Match');
		if (rememberedETag) {
			const currentETag = await getETag(c);
			if (currentETag == rememberedETag) {
				return new Response(null, { status: 304 });
			}
		}
		await next();
	});
}
