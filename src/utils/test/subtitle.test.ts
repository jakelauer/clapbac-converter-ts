import { describe, it, expect, vi } from 'vitest';
import fs from 'fs-extra';
import { parseSubtitleFile } from '../subtitle';

vi.mock('fs-extra');

describe('parseSubtitleFile', () => {
	it('should parse subtitle timestamps correctly', () => {
		const mockContent = `
1
00:00:01,000 --> 00:00:04,000
First subtitle

2
00:00:05,500 --> 00:00:08,500
Second subtitle
    `.trim();

		vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

		const result = parseSubtitleFile('test.srt');

		expect(result).toEqual([
			{ start: '00:00:01.000', end: '00:00:04.000' },
			{ start: '00:00:05.500', end: '00:00:08.500' }
		]);
	});

	it('should handle empty subtitle file', () => {
		vi.mocked(fs.readFileSync).mockReturnValue('');

		const result = parseSubtitleFile('test.srt');

		expect(result).toEqual([]);
	});

	it('should handle malformed subtitle content', () => {
		const mockContent = 'Invalid content';
		vi.mocked(fs.readFileSync).mockReturnValue(mockContent);

		const result = parseSubtitleFile('test.srt');

		expect(result).toEqual([]);
	});
});
