import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { processVideos } from '../processVideos';
import { splitVideo } from '../split-video';
import { progressManager } from '../../utils/progress';
import { extractSubtitlesFromMKV } from '../../utils/mkvExtractor';
import { Dirent } from 'fs';

// Mock dependencies
vi.mock('fs-extra');
vi.mock('path');
vi.mock('../splitVideo');
vi.mock('../../utils/mkvExtractor');
vi.mock('../../utils/progress', () => ({
	progressManager: {
		stop: vi.fn()
	}
}));

describe('processVideos', () => {
	const mockOptions = {
		videoDir: '/mock/videos',
		subtitleDir: '/mock/subtitles',
		outputDir: '/mock/output',
		concurrency: 4
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(splitVideo).mockImplementation(async () => { });
		vi.mocked(extractSubtitlesFromMKV).mockImplementation(async () => '/mock/output/extracted.srt');
		vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
		vi.mocked(path.basename).mockImplementation((p) => p);
		vi.mocked(path.extname).mockReturnValue('.mp4');
		vi.mocked(fs.readdirSync).mockReturnValue([{ name: 'video1.mkv' } as Dirent]);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it('should process videos with external subtitles', async () => {
		vi.mocked(fs.readdirSync).mockReturnValue([
			{ name: 'video1.mp4' } as Dirent,
			{ name: 'video2.mp4' } as Dirent
		]);
		vi.mocked(fs.pathExistsSync).mockReturnValue(true);

		await processVideos(mockOptions);

		expect(splitVideo).toHaveBeenCalledTimes(2);
		expect(splitVideo).toHaveBeenCalledWith(
			'/mock/videos/video1.mp4',
			'/mock/subtitles/video1.mp4.srt',
			mockOptions.outputDir,
			mockOptions.concurrency
		);
	});

	it('should process MKV files with embedded subtitles', async () => {
		const mkvOptions = {
			...mockOptions,
			embedded: true,
			trackIndex: 0
		};

		await processVideos(mkvOptions);

		expect(extractSubtitlesFromMKV).toHaveBeenCalledWith(
			'/mock/videos/video1.mkv',
			0,
			mockOptions.outputDir
		);
		expect(splitVideo).toHaveBeenCalledWith(
			'/mock/videos/video1.mkv',
			'/mock/output/extracted.srt',
			mockOptions.outputDir,
			mockOptions.concurrency
		);
	});

	it('should skip non-MKV files when embedded option is used', async () => {
		const mkvOptions = {
			...mockOptions,
			embedded: true,
			trackIndex: 0
		};

		vi.mocked(fs.readdirSync).mockReturnValue([
			{ name: 'video1.mp4' } as Dirent
		]);

		await processVideos(mkvOptions);

		expect(extractSubtitlesFromMKV).not.toHaveBeenCalled();
		expect(splitVideo).not.toHaveBeenCalled();
	});

	it('should handle errors during subtitle extraction', async () => {
		const mkvOptions = {
			...mockOptions,
			embedded: true,
			trackIndex: 0
		};

		vi.mocked(fs.readdirSync).mockReturnValue([
			{ name: 'video1.mkv' } as Dirent
		]);
		vi.mocked(extractSubtitlesFromMKV).mockRejectedValue(new Error('Extraction failed'));

		await expect(processVideos(mkvOptions)).rejects.toThrow();
		expect(splitVideo).not.toHaveBeenCalled();
	});

	it('should stop progress manager even when errors occur', async () => {
		vi.mocked(fs.readdirSync).mockImplementation(() => {
			throw new Error('Directory read failed');
		});

		await expect(processVideos(mockOptions)).rejects.toThrow();
		expect(progressManager.stop).toHaveBeenCalled();
	});

	it('should respect gap threshold when processing segments', async () => {
		const mkvOptions = {
			...mockOptions,
			gapThreshold: 1000
		};

		await processVideos(mkvOptions);

		expect(splitVideo).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			mockOptions.outputDir,
			mockOptions.concurrency,
			expect.any(Array)
		);
	});

	it('should respect minimum segment duration', async () => {
		const mkvOptions = {
			...mockOptions,
			gapThreshold: 1000,
			minSegmentDuration: 2000
		};

		await processVideos(mkvOptions);

		expect(splitVideo).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			mockOptions.outputDir,
			mockOptions.concurrency,
			expect.any(Array)
		);
	});
});
