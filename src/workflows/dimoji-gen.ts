import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import * as GenAi from '../genai';
import { GenerativeAi } from '../genai';
import usePrismaClient from '../usePrismaClient';

export interface Params {
	names: string[];
	genai?: {
		name: string;
		init: Rpc.Serializable<object>;
	};
}

export class DimojiGeneratingWorkflow extends WorkflowEntrypoint<Bindings, Params> {
	async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
		const backend: GenerativeAi | undefined =
			event.payload.genai != null
				? new (GenAi as {[p: string]: any})[event.payload.genai.name](event.payload.genai.init)
				: this.env.GEMINI_API_KEY
					? new GenAi.Gemini({ apiKey: this.env.GEMINI_API_KEY })
					: undefined;
		if (!backend) {
			throw new TypeError('missing genai in parameters and default model cannot get initialized');
		}
		const dimojis = await step.do(`call ${backend.name} to determine dimojis`, () => backend.getDimensionEmoji(event.payload.names));

		const prisma = usePrismaClient(this.env.DATABASE_URL);
		await step.do('ask prisma to update records', () =>
			prisma.$transaction(
				Object.entries(dimojis).map(([dim, emoji]) =>
					prisma.dimension.update({
						data: { emoji },
						where: { name: dim },
					}),
				),
			),
		);
	}
}
