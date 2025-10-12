import { describe, expect, it } from 'vitest';
import Privileges from '../src/privilege';

describe('privilege', () => {
	it('primitives should behave', () => {
		const privileges = new Privileges(0b1011);
		expect(privileges.user.read).toBeTruthy();
		expect(privileges.user.write).toBeTruthy();
		expect(privileges.others.read).toBeTruthy();
		expect(privileges.others.write).toBeFalsy();

		privileges.user.read = false;
		expect(privileges.user.read).toBeFalsy();
		expect(privileges.value).toEqual(0b1001);

		privileges.others.write = true;
		expect(privileges.others.write).toBeTruthy();
		expect(privileges.value).toEqual(0b1101);
	});
});
