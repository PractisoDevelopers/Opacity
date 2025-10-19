import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { Archive, Composer } from '@practiso/sdk';
import { DimensionArchive, PractisoArchive, QuizArchive } from '@practiso/sdk/lib/model';
import { pageSize } from '../src/magic';

const endpoint = 'https://exmaple.com';

describe('basic', () => {
	it('should respond with archive list', async () => {
		const response = await SELF.fetch(`${endpoint}/archives`);
		expect(await response.json()).toMatchObject({
			page: expect.any(Array),
			next: expect.toBeOneOf([expect.any(String), undefined]),
		});
	});

	it('should paginate', async () => {
		const guestUpload = await uploadArchive(getUltimateArchive(), undefined, 'Ultima 1');
		expect(guestUpload.jwt).toMatch(new RegExp('(\..*){3}'));

		type pr = { page: Array<any>; next?: string };

		const followingUploads: string[] = [];

		async function populateOnePage() {
			for (let i = 0; i < 5; i++) {
				const ids = await Promise.all(
					Array.from(Array(4).keys()).map((i) =>
						uploadArchive(getUltimateArchive(), guestUpload.jwt, `Ultima ${i + 2}`).then(({ archiveId }) => archiveId),
					),
				);
				followingUploads.push(...ids);
			}
		}

		let page1 = (await (await SELF.fetch(`${endpoint}/archives`)).json()) as pr;
		if (page1.page.length < pageSize) {
			await populateOnePage();
		}

		page1 = (await (await SELF.fetch(`${endpoint}/archives`)).json()) as pr;
		expect(page1.page.length, 'page size mismatch').toEqual(pageSize);
		expect(page1.next).toBeDefined();

		const page2 = (await (await SELF.fetch(`${endpoint}/archives?predecessor=${page1.next}`)).json()) as pr;
		expect(page1.page).not.toEqual(page2.page);
	});
});

describe('upload', () => {
	it('should upload ultimate question', async () => {
		const archive = getUltimateArchive();
		const uploadGuest = await uploadArchive(archive);
		expect(uploadGuest, 'failed to upload anonymously').toEqual({
			archiveId: expect.any(String),
			jwt: expect.stringMatching(new RegExp(`(.*\.){3}`)),
		});

		const uploadAuthenticated = await uploadArchive(archive, uploadGuest.jwt);
		expect(uploadAuthenticated, 'failed to upload with authentication').toEqual({
			archiveId: expect.any(String),
		});

		const deleteRequest = await Promise.all(
			[uploadGuest.archiveId, uploadAuthenticated.archiveId].map((id) =>
				SELF.fetch(`${endpoint}/archive/${id}`, {
					headers: {
						authorization: `Bearer ${uploadGuest.jwt}`,
					},
					method: 'DELETE',
				}),
			),
		);
		deleteRequest.forEach((response, index) => {
			expect(response.status, `deletion#${index} failed`).toBe(202);
		});
	});
});

describe('queries', () => {
	it('should query dimensions', async () => {
		const { jwt, archiveId } = await uploadArchive(
			new PractisoArchive([
				new QuizArchive('Good question 69', {
					dimensions: [new DimensionArchive('Good questions')],
				}),
			]),
		);
		const response = await (await SELF.fetch(`${endpoint}/dimensions`)).json<string[]>();
		try {
			expect(response).toContainEqual({
				name: 'Good questions',
				quizCount: expect.toSatisfy((count) => count > 1),
				emoji: expect.anything(),
			});
		} finally {
			await SELF.fetch(`${endpoint}/archive/${archiveId}`, {
				method: 'DELETE',
				headers: { authorization: `Bearer ${jwt}` },
			});
		}
	});

	it('should query archives by dimension', async () => {
		const { jwt, archiveId } = await uploadArchive(
			new PractisoArchive([
				new QuizArchive('Good question 69', {
					dimensions: [new DimensionArchive('Good questions')],
				}),
			]),
		);
		const { page, next } = (await (await SELF.fetch(`${endpoint}/dimension/${encodeURI('Good questions')}/archives`)).json()) as any;
		try {
			expect(page).toContainEqual(
				expect.objectContaining({
					dimensions: expect.arrayContaining([
						expect.objectContaining({
							name: 'Good questions',
						}),
					]),
				}),
			);
		} finally {
			await SELF.fetch(`${endpoint}/archive/${archiveId}`, {
				method: 'DELETE',
				headers: { authorization: `Bearer ${jwt}` },
			});
		}
	});
});

describe('social', () => {
	it('should like and dislike', async () => {
		const archive = getUltimateArchive();
		const { jwt, archiveId } = await uploadArchive(archive);
		const authHeaders = { authorization: `Bearer ${jwt}` };
		const likeResponse = await SELF.fetch(`${endpoint}/archive/${archiveId}/like`, {
			method: 'PUT',
			headers: authHeaders,
		});
		expect(likeResponse.status, 'failed to like').toBe(201);

		async function getArchiveLikes() {
			const { count } = (await (await SELF.fetch(`${endpoint}/archive/${archiveId}/like`)).json()) as {
				count: number;
			};
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
		});
		expect(deleteResponse.status, 'failed to delete archive').toBe(202);
	});

	it('should support patching', async () => {
		const { jwt, archiveId } = await uploadArchive(getUltimateArchive(), undefined, 'SIXTEEN!!!');
		const form = new FormData();
		const newName = "what'd dog doing";
		form.append('name', newName);
		const response = await SELF.fetch(`${endpoint}/archive/${archiveId}`, {
			method: 'PATCH',
			headers: { authorization: `Bearer ${jwt}` },
			body: form,
		});
		expect(response.status).toBe(204);

		const metadata = (await (await SELF.fetch(`${endpoint}/archive/${archiveId}/metadata`)).json()) as any;
		expect(metadata.name).toEqual(newName);
	});

	it('should count downloads', async () => {
		async function getDownloads(archiveId: string) {
			const res = await SELF.fetch(`${endpoint}/archive/${archiveId}/metadata`);
			const { downloads } = (await res.json()) as { downloads: number };
			return downloads;
		}
		const { jwt, archiveId } = await uploadArchive(getUltimateArchive());
		expect(await getDownloads(archiveId)).toEqual(0);
		const response = await SELF.fetch(`${endpoint}/archive/${archiveId}`);

		expect(response.ok).toBeTruthy();
		expect(await getDownloads(archiveId)).toEqual(1);

		await SELF.fetch(`${endpoint}/archive/${archiveId}`, { method: 'DELETE', headers: { authorization: `Bearer ${jwt}` } });
	});
});

async function uploadArchive(archive: PractisoArchive, jwt?: string, name?: string) {
	const form = new FormData();
	const composer = new Composer(archive);
	const pieces = [];
	for await (const chunk of composer.source.pipeThrough(new CompressionStream('gzip'))) {
		pieces.push(chunk);
	}
	form.append('client-name', 'test client');
	form.append('content', new File([Buffer.concat(pieces)], (name ?? 'test') + '.psarchive'));
	const response = await SELF.fetch(`${endpoint}/archive`, {
		method: 'PUT',
		body: form,
		headers: jwt ? { authorization: `Bearer ${jwt}` } : undefined,
	});
	if (response.ok) {
		return (await response.json()) as { jwt?: string; archiveId: string };
	} else {
		throw await response.text();
	}
}

function getUltimateArchive() {
	return new PractisoArchive([
		new QuizArchive('Ultimate Question', {
			frames: [
				new Archive.Text("What's the meaning of life, the universe and everything else?"),
				new Archive.Options(null, [new Archive.Option(new Archive.Text('42'), { isKey: true })]),
			],
		}),
	]);
	it('should query dimensions', async () => {
		const { jwt, archiveId } = await uploadArchive(
			new PractisoArchive([
				new QuizArchive('Good question 69', {
					dimensions: [new DimensionArchive('Good questions')],
				}),
			]),
		);
		const response = await (await SELF.fetch(`${endpoint}/dimensions`)).json<string[]>();
		try {
			expect(response).toContainEqual({
				name: 'Good questions',
				quizCount: expect.toSatisfy((count) => count > 1),
				emoji: expect.anything(),
			});
		} finally {
			await SELF.fetch(`${endpoint}/archive/${archiveId}`, {
				method: 'DELETE',
				headers: { authorization: `Bearer ${jwt}` },
			});
		}
	});

	it('should query archives by dimension', async () => {
		const { jwt, archiveId } = await uploadArchive(
			new PractisoArchive([
				new QuizArchive('Good question 69', {
					dimensions: [new DimensionArchive('Good questions')],
				}),
			]),
		);
		const { page, next } = (await (await SELF.fetch(`${endpoint}/dimension/${encodeURI('Good questions')}/archives`)).json()) as any;
		try {
			expect(page).toContainEqual(
				expect.objectContaining({
					dimensions: expect.arrayContaining([
						expect.objectContaining({
							name: 'Good questions',
						}),
					]),
				}),
			);
		} finally {
			await SELF.fetch(`${endpoint}/archive/${archiveId}`, {
				method: 'DELETE',
				headers: { authorization: `Bearer ${jwt}` },
			});
		}
	});
}
