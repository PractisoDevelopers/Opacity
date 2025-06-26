import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const endpoint = 'https://exmaple.com';

describe('local Opacity worker', () => {
	it('should respond with archive list', async () => {
		const response = await SELF.fetch(`${endpoint}/archives`);
		expect(await response.json()).toMatchInlineSnapshot(expect.any(Array));
	});

	it('should upload ultimate question', async () => {
		const archiveBuffer = Buffer.from(
			'H4sIAAAAAAAAAKWTvU7DMBCAmfsUJy9dIE7SlkKVpDMLUxESm5VciEVip/alajvxGrweT4IdQC0UlT/Lg3V3+r7zXzJfNzWs0FipVTqMgmgI82yQCJNXcoXgssqmrCJqZ5zbvMJGBNuqK7u8wFWQ64a3RuQkrWaQGxTkOSwO48lZ6OZ0EU5mk2g2GgXj8OJ8PL1j2QDcSJad3IISDabspibZCEJYdmg9AH7Cii/fWT2vNI5ld4E+SLim7LYS9Pz4ZIEqhAaFkuoedAm1LPG0D3ZK+iNAEKoAdMsNVb4Ia4vzhPeUj2Dd+uY+6fqMJGygNVIbSZuUheywZtfate5FXyn6Iu5p30uio5KFBly3aCSq/HWLpMFga3TRucB/5fFR+RVBgS2qwv7N84BOQaZDtqccHVWO49+oEn5wlwnff0wJ90/V/Qn+9imykxclwyq5NgMAAA==',
			'base64',
		);
		const form = new FormData();
		form.append('client-name', 'test client');
		form.append('content', new File([archiveBuffer], 'ultimate question.psarchive'));
		const uploadGuest = (await (
			await SELF.fetch(`${endpoint}/archive`, {
				method: 'PUT',
				body: form,
			})
		).json()) as { jwt: string; archiveId: string };
		expect(uploadGuest, 'failed to upload anonymously').toEqual({
			archiveId: expect.any(String),
			jwt: expect.stringMatching(new RegExp(`(.*\.){3}`)),
		});

		const authHeaders = {
			authorization: `Bearer ${uploadGuest.jwt}`,
		};
		const uploadAuthenticated = (await (
			await SELF.fetch(`${endpoint}/archive`, {
				method: 'PUT',
				headers: authHeaders,
				body: form,
			})
		).json()) as { archiveId: string };
		expect(uploadAuthenticated, 'failed to upload with authentication').toEqual({
			archiveId: expect.any(String),
		});

		const deleteRequest = await Promise.all(
			[uploadGuest.archiveId, uploadAuthenticated.archiveId].map((id) =>
				SELF.fetch(`${endpoint}/archive/${id}`, {
					headers: authHeaders,
					method: 'DELETE',
				}),
			),
		);
		deleteRequest.forEach((response, index) => {
			expect(response.ok, `deletion#${index} failed with ${response.status}`).toBeTruthy();
		});
	});

	it('should ', () => {
		
	});
});
