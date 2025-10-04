import { Hono } from 'hono';
import * as compat from '../compat';
import { maxNameLength, pageSize } from '../magic';

const reportedMagicValues = `page_size:${pageSize} max_name_length:${maxNameLength}`;

export function useBonjour(app: Hono<OpacityEnv>) {
	app.get('/bonjour', async (c) => {
		return c.text(`opacity version:${compat.version} build_date:${compat.getBuildDate()} ${reportedMagicValues}`);
	});
}
