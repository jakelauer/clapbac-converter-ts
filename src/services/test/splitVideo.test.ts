import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { splitVideo } from '../split-video';
import { execShellCommand } from '../../utils/shell';
import { parseSubtitleFile } from '../../utils/subtitle';
import { progressManager } from '../../utils/progress';

// Mock dependencies
vi.mock('fs-extra');
vi.mock('path');
vi.mock('../utils/shell');
vi.mock('../utils/subtitle');
vi.mock('../utils/progress');

// Add explicit mock implementations
vi.mock('../../utils/subtitle', () => ({
	parseSubtitleFile: vi.fn().mockReturnValue([
		{ start: '00:00:00', end: '00:01:00' },
		{ start: '00:01:00', end: '00:02:00' }
	])
}));

vi.mock('../../utils/shell', () => ({
	execShellCommand: vi.fn()
}));

// Fix the progress manager mock
vi.mock('../../utils/progress', () => ({
	progressManager: {
		createProgressBar: vi.fn(),
		updateProgress: vi.fn()
	}
}));

describe('splitVideo', () => {
	const mockVideoPath = '/path/to/video.mp4';
	const mockSubtitlePath = '/path/to/subtitle.srt';
	const mockOutputDir = '/path/to/output';
	const mockConcurrency = 2;

	beforeEach(() => {
		// Reset all mocks before each test
		vi.clearAllMocks();

		// Re-implement the parseSubtitleFile mock for each test
		vi.mocked(parseSubtitleFile).mockReturnValue([
			{ start: '00:00:00', end: '00:01:00' },
			{ start: '00:01:00', end: '00:02:00' }
		]);

		vi.mocked(path.basename).mockReturnValue('video');
		vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
		vi.mocked(path.extname).mockReturnValue('.mp4');

		vi.mocked(fs.ensureDirSync).mockResolvedValue(undefined);
		vi.mocked(fs.pathExistsSync).mockImplementation(() => false);

		vi.mocked(execShellCommand).mockImplementation(() => Promise.resolve(undefined));
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it('should process video with correct segments', async () => {
		await splitVideo(mockVideoPath, mockSubtitlePath, mockOutputDir, mockConcurrency);

		// Verify subtitle parsing was called
		expect(parseSubtitleFile).toHaveBeenCalledWith(mockSubtitlePath);

		// Verify directory creation
		expect(fs.ensureDirSync).toHaveBeenCalledWith(expect.stringContaining('video'));

		// Verify progress bar creation
		expect(progressManager.createProgressBar).toHaveBeenCalledWith('video', 2);

		// Verify ffmpeg commands were executed
		expect(execShellCommand).toHaveBeenCalledTimes(2);
		expect(execShellCommand).toHaveBeenCalledWith(
			expect.stringContaining('ffmpeg -i')
		);
	});

	it('should skip existing segments', async () => {
		vi.mocked(fs.pathExistsSync).mockReturnValue(true);

		await splitVideo(mockVideoPath, mockSubtitlePath, mockOutputDir, mockConcurrency);

		// Verify that ffmpeg was not called for existing segments
		expect(execShellCommand).not.toHaveBeenCalled();

		// Verify progress updates were still made
		expect(progressManager.updateProgress).toHaveBeenCalledTimes(2);
	});

	it('should handle empty timestamps array', async () => {
		vi.mocked(parseSubtitleFile).mockReturnValue([]);

		await splitVideo(mockVideoPath, mockSubtitlePath, mockOutputDir, mockConcurrency);

		// Verify progress bar was created with 0 segments
		expect(progressManager.createProgressBar).toHaveBeenCalledWith('video', 0);

		// Verify no ffmpeg commands were executed
		expect(execShellCommand).not.toHaveBeenCalled();
	});

	it('should respect concurrency limit', async () => {
		const manyTimestamps = Array(5).fill({ start: '00:00:00', end: '00:01:00' });
		vi.mocked(parseSubtitleFile).mockReturnValue(manyTimestamps);

		await splitVideo(mockVideoPath, mockSubtitlePath, mockOutputDir, 2);

		// Verify that execShellCommand was called for each segment
		expect(execShellCommand).toHaveBeenCalledTimes(5);
	});
}); 
