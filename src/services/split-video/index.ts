import fs from 'fs-extra';
import path from 'path';
import pLimit from 'p-limit';
import { progressManager } from '../../utils/progress.js';
import { VideoSegment } from '../processVideos.js';
import { processSegment } from './segment-processor.js';

// Re-export the timestamp utilities for backwards compatibility
export { parseTimestampToStruct, durationToTimestampStruct, formatTimestamp, formatDuration } from './timestamps.js';

const createOutputDirectory = (videoPath: string, outputDir: string): string => {
	const videoName = path.basename(videoPath, path.extname(videoPath));
	const outputFolder = path.join(outputDir, videoName);
	fs.ensureDirSync(outputFolder);
	return outputFolder;
};

export async function splitVideo(
	videoPath: string,
	subtitlePath: string | null,
	outputDir: string,
	concurrency: number,
	segments: VideoSegment[]
): Promise<void> {
	progressManager.log(`Starting to process video: ${videoPath}`);
	progressManager.log(`Using subtitle file: ${subtitlePath}`);
	progressManager.log(`Output directory: ${outputDir}`);
	progressManager.log(`Concurrency level: ${concurrency}`);

	const outputFolder = createOutputDirectory(videoPath, outputDir);
	progressManager.log(`Created output folder: ${outputFolder}`);

	const videoName = path.basename(videoPath, path.extname(videoPath));

	progressManager.createProgressBar(videoName, segments.length);

	const limit = pLimit(concurrency);
	const tasks = segments.map(segment =>
		limit(() => processSegment(segment, videoPath, outputFolder, videoName))
	);
	await Promise.all(tasks);
}
