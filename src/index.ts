import { Hono } from 'hono';
import { jwtAuth } from './middleware/anoJwt';
import { useArchiveLike } from './endpoints/archive-like';
import { useWhoami } from './endpoints/whoami';
import { useArchives } from './endpoints/archives';
import { useArchive } from './endpoints/archive';
import { useDimensions } from './endpoints/dimensions';

const app = new Hono<OpacityEnv>();

app.use('*', async (c, next) => {
	const middleware = jwtAuth(c.env.JWT_SECRET);
	return middleware(c, next);
});

useArchives(app);
useArchive(app);
useArchiveLike(app);
useWhoami(app);
useDimensions(app);

export default app satisfies ExportedHandler<Bindings>;
export { DimojiGeneratingWorkflow } from './workflows/dimoji-gen';
