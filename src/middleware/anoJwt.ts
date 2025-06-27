import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import * as jwt from 'hono/jwt';

export function jwtAuth(secret: string) {
	if (!secret) {
		throw new TypeError('undefined JWT secret');
	}
	return createMiddleware(async (c, next) => {
		const authentication = c.req.header()['authorization'];
		const bearer = 'Bearer';
		if (!authentication || !authentication.startsWith(bearer)) {
			await next();
			return;
		}

		if (authentication.length <= bearer.length) {
			throw new HTTPException(400, { message: 'Bad authentication header.' });
		}

		const token = authentication.slice(bearer.length + 1);
		try {
			const payload = await jwt.verify(token, secret);
			c.set('jwtPayload', payload);
		} catch (e) {
			if (e instanceof Error) {
				throw new HTTPException(403, { message: e.message });
			} else {
				throw e;
			}
		}
		await next();
	});
}

export const jwtMandated = createMiddleware(async (c, next) => {
	const jwtPayload = c.get('jwtPayload');
	if (!jwtPayload) {
		throw new HTTPException(401);
	}
	const { cid } = jwtPayload;
	if (!cid) {
		throw new HTTPException(403);
	}
	c.set('clientId', cid);
	await next();
});
