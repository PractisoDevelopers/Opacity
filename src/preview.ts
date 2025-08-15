import type { FrameArchive, PractisoArchive, QuizArchive } from '@practiso/sdk/lib/model';
import { Archive } from '@practiso/sdk';

export namespace Preview {
	export function ofQuiz(quiz: QuizArchive): string {
		return quiz.frames.map(ofFrame).join(' ');
	}

	export function ofFrame(frame: FrameArchive): string {
		if (frame instanceof Archive.Image) {
			return '🖼️';
		}
		if (frame instanceof Archive.Text) {
			return frame.content;
		}
		if (frame instanceof Archive.Options) {
			return [...frame.content]
				.sort((a, b) => a.priority - b.priority)
				.map((option, index) => `${getAlphabetRepresentation(index)}. ${ofFrame(option.content)}`)
				.join(' ');
		}
		throw new Error('Unsupported frame type');
	}
}

function getAlphabetRepresentation(n: number): string {
	const firstLetter = 'A'.charCodeAt(0);
	const span = 'Z'.charCodeAt(0) - firstLetter;
	let remaining = n;
	let result = '';
	do {
		const code = remaining % span;
		remaining -= code;
		result += String.fromCharCode(code + firstLetter);
	} while (remaining > 0);
	return result;
}
