import { Hono } from 'hono';
import * as compat from '../compat';

export function useBonjour(app: Hono<OpacityEnv>) {
	app.get('/bonjour', async (c) => {
		return c.text(`opacity version:${compat.version} build_date:${compat.buildDate}`);
	});
}
