import { HTTPException } from 'hono/http-exception';

export default function hasPrivilege(privileged: boolean) {
	if (!privileged) {
		throw new HTTPException(403, { message: 'Not privileged to do so.' });
	}
}
