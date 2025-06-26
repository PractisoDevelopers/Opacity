import { Hono } from 'hono';
import { jwtAuth } from './anoJwt';
import { useArchiveLike } from './endpoints/archive-like';
import { useWhoami } from './endpoints/whoami';
import { useArchives } from './endpoints/archives';
import { useArchive } from './endpoints/archive';

const app = new Hono<OpacityEnv>();

app.use('*', async (c, next) => {
	const middleware = jwtAuth(c.env.JWT_SECRET);
	return middleware(c, next);
});

useArchives(app);
useArchive(app);
useArchiveLike(app);
useWhoami(app);

export default app satisfies ExportedHandler<Bindings>;
