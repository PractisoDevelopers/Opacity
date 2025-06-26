import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const endpoint = 'https://exmaple.com';
const archiveBuffer = Buffer.from(
	'H4sIAAAAAAAAAKWTvU7DMBCAmfsUJy9dIE7SlkKVpDMLUxESm5VciEVip/alajvxGrweT4IdQC0UlT/Lg3V3+r7zXzJfNzWs0FipVTqMgmgI82yQCJNXcoXgssqmrCJqZ5zbvMJGBNuqK7u8wFWQ64a3RuQkrWaQGxTkOSwO48lZ6OZ0EU5mk2g2GgXj8OJ8PL1j2QDcSJad3IISDabspibZCEJYdmg9AH7Cii/fWT2vNI5ld4E+SLim7LYS9Pz4ZIEqhAaFkuoedAm1LPG0D3ZK+iNAEKoAdMsNVb4Ia4vzhPeUj2Dd+uY+6fqMJGygNVIbSZuUheywZtfate5FXyn6Iu5p30uio5KFBly3aCSq/HWLpMFga3TRucB/5fFR+RVBgS2qwv7N84BOQaZDtqccHVWO49+oEn5wlwnff0wJ90/V/Qn+9imykxclwyq5NgMAAA==',
	'base64',
);
const archiveForm = new FormData();
archiveForm.append('client-name', 'test client');
archiveForm.append('content', new File([archiveBuffer], 'ultimate question.psarchive'));

describe('local Opacity worker', () => {
	it('should respond with archive list', async () => {
		const response = await SELF.fetch(`${endpoint}/archives`);
		expect(await response.json()).toMatchInlineSnapshot(expect.any(Array));
	});

	it('should upload ultimate question', async () => {
		const uploadGuest = (await (
			await SELF.fetch(`${endpoint}/archive`, {
				method: 'PUT',
				body: archiveForm,
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
				body: archiveForm,
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
			expect(response.status, `deletion#${index} failed`).toBe(202);
		});
	});

	it('should like and dislike', async () => {
		const { jwt, archiveId } = (await (
			await SELF.fetch(`${endpoint}/archive`, {
				method: 'PUT',
				body: archiveForm,
			})
		).json()) as { jwt: string; archiveId: string };
		const authHeaders = { authorization: `Bearer ${jwt}` };
		const likeResponse = await SELF.fetch(`${endpoint}/archive/${archiveId}/like`, {
			method: 'PUT',
			headers: authHeaders
		});
		expect(likeResponse.status, 'failed to like').toBe(201);

		async function getArchiveLikes() {
			const { count } = (await (await SELF.fetch(`${endpoint}/archive/${archiveId}/like`)).json()) as { count: number };
			return count;
		}

		expect(await getArchiveLikes(), 'like has no effect').toBe(1);

		const dislikeResponse = await SELF.fetch(`${endpoint}/archive/${archiveId}/like`, {
			method: 'DELETE',
			headers: authHeaders,
		});
		expect(dislikeResponse.status, 'failed to dislike').toBe(202);
		expect(await getArchiveLikes(), 'dislike has no effect').toBe(0);

		const deleteResponse = await SELF.fetch(`${endpoint}/archive/${archiveId}`, {
			headers: authHeaders,
			method: 'DELETE',
		})
		expect(deleteResponse.status, 'failed to delete archive').toBe(202)
	});
});
