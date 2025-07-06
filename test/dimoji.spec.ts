import { describe, expect, it } from 'vitest';
import { Gemini } from '../src/genai';
import { env } from 'cloudflare:workers';

describe('Dimension emoji generation test', () => {
	it('should identify cats', async () => {
		const gemini = new Gemini({ apiKey: env.GEMINI_API_KEY });
		const emojis = await gemini.getDimensionEmoji('Cats');
		expect(emojis).toEqual({
			Cats: '🐱',
		});
	});
});
