import { Archive, QuizArchive } from '@practiso/sdk/lib/model';
import { Preview } from '../src/preview';
import { describe, expect, it } from 'vitest';

describe('Preview test', () => {
	it('should preview quiz', () => {
		const question = 'Which one of the following is what Turret would say?';
		const answer = new Archive.Text('Good night');
		const option = new Archive.Options(null, []);
		let preview = question;
		const marks = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
		for (let i = 0; i < 10; ++i) {
			option.content.push(new Archive.Option(answer, { isKey: true }));
			preview += ` ${marks[i]}. ${answer.content}`;
		}

		const quiz = new QuizArchive(answer.content, {
			frames: [new Archive.Text(question), option],
		});
		expect(Preview.ofQuiz(quiz)).toEqual(preview);
	});
});
