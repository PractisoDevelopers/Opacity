import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { Archive, Composer } from '@practiso/sdk';
import { PractisoArchive, QuizArchive } from '@practiso/sdk/lib/model';
import { pageSize } from '../src/magic';

const endpoint = 'https://exmaple.com';

describe('local Opacity worker', () => {
	it('should respond with archive list', async () => {
		const response = await SELF.fetch(`${endpoint}/archives`);
		expect(await response.json()).toMatchObject({
			page: expect.any(Array),
			next: expect.toBeOneOf([expect.any(String), undefined])
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
	return (await (
		await SELF.fetch(`${endpoint}/archive`, {
			method: 'PUT',
			body: form,
			headers: jwt ? { authorization: `Bearer ${jwt}` } : undefined,
		})
	).json()) as { jwt?: string; archiveId: string };
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
}

function* chunked<T>(arr: Array<T>, n: number) {
	for (let i = 0; i < arr.length; i += n) {
		yield arr.slice(i, i + n);
	}
}
