import { Content, GenerateContentConfig, GoogleGenAI, Type } from '@google/genai';

interface EmojiResponseSchema {
	emojis: string[];
}

export interface GenerativeAi {
	name: string;

	getDimensionEmoji(dimensionName: string | string[]): Promise<{ [key: string]: string }>;
}

export class Gemini implements GenerativeAi {
	readonly modelName: string;
	readonly maxRetrials: number;
	private readonly ai: GoogleGenAI;

	get name(): string {
		return this.modelName;
	}

	constructor(init: { apiKey: string; modelName?: string; maxRetrials?: number }) {
		this.modelName = init.modelName ?? 'gemini-2.5-flash';
		this.ai = new GoogleGenAI({ apiKey: init.apiKey });
		this.maxRetrials = init.maxRetrials ?? 3;
	}

	async getDimensionEmoji(dimensionNames: string | string[]) {
		if (!dimensionNames) {
			return {};
		}

		const config: GenerateContentConfig = {
			temperature: 0.7,
			topP: 0,
			thinkingConfig: {
				thinkingBudget: 4703,
			},
			responseMimeType: 'application/json',
			responseSchema: {
				type: Type.OBJECT,
				required: ['emojis'],
				properties: {
					emojis: {
						type: Type.ARRAY,
						items: {
							type: Type.STRING,
						},
					},
				},
			},
			systemInstruction: [
				{
					text: `Response with the single best describing emojis in JSON.`,
				},
				{
					text: `For example: ["Computer Networking", "College English", "Practical English", "Mathematics", "Higher Mathematics"]: {"emoji": ["🛜", "🇬🇧", "🇬🇧", "🧮", "📈"]}`,
				},
			],
		};
		if (!Array.isArray(dimensionNames)) {
			dimensionNames = [dimensionNames]; // this is important for the model to understand the task
		}

		let retrials = 0;
		const contents: Content[] = [
			{
				role: 'user',
				parts: [
					{
						text: `Which emojis best describe ${JSON.stringify(dimensionNames)}? `,
					},
				],
			},
		];

		while (true) {
			const response = await this.ai.models.generateContent({
				model: this.modelName,
				config,
				contents,
			});

			const { emojis } = JSON.parse(response.text!) as EmojiResponseSchema;
			if (emojis.length == dimensionNames.length || retrials > this.maxRetrials) {
				if (retrials > this.maxRetrials) {
					console.warn(
						'dumbass',
						this.modelName,
						'failed to count for more than',
						this.maxRetrials,
						'times, take their words as it is',
					);
				}
				return Object.fromEntries(Array.from(dimensionNames.entries()).map(([index, dim]) => [dim, emojis[index]]));
			}
			retrials++;
			contents.push(
				{
					role: 'model',
					parts: [{ text: response.text }],
				},
				{
					role: 'user',
					parts: [
						{
							text: `Your response is mismatching my request in length (${emojis.length} != ${dimensionNames.length}). Please try again.`,
						},
					],
				},
			);
		}
	}
}
