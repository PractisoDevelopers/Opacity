import { HTTPException } from "hono/http-exception";
import { maxNameLength } from "../magic";

export namespace Names {
	export function processed(newName: string) {
		return newName.replaceAll(/\s+/g, ' ');
	}

	export function validify(newName: any, domain: string) {
		if (typeof newName !== 'string') {
			throw new HTTPException(400, { message: `Missing ${domain}.` });
		}
		const processed = Names.processed(newName);
		if (processed.length > maxNameLength) {
			throw new HTTPException(400, { message: `Bad ${domain}.` });
		}
		return newName;
	}
}
