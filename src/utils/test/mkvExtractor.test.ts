import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { extractSubtitlesFromMKV } from '../mkvExtractor';

vi.mock('fs-extra');
vi.mock('path');
vi.mock('matroska-subtitles', () => ({
	extractSubtitles: vi.fn()
		.mockResolvedValueOnce('mock subtitle content') // for success test
		.mockRejectedValueOnce(new Error('Failed to extract subtitles')) // for failure test
}));

describe('extractSubtitlesFromMKV', () => {
	const mockVideoPath = '/path/to/video.mkv';
	const mockOutputDir = '/path/to/output';
	const mockTrackIndex = '2';

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(path.basename).mockReturnValue('video');
		vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
	});

	it('should extract subtitles successfully', async () => {
		const result = await extractSubtitlesFromMKV(mockVideoPath, mockTrackIndex, mockOutputDir);
		expect(result).toBe('/path/to/output/video.srt');
	});

	it('should throw error if subtitle extraction fails', async () => {
		await expect(
			extractSubtitlesFromMKV(mockVideoPath, mockTrackIndex, mockOutputDir)
		).rejects.toThrow('Failed to extract subtitles');
	});
});
