import fs from 'fs-extra';
import { progressManager } from '../../utils/progress.js';
import { VideoSegment } from '../processVideos.js';
import { Mp4Task, GifTask } from "../ffmpeg/outputs/index.js";
import { FFmpegTaskParams } from "../ffmpeg/ffmpeg-task-params.js";
import { formatDuration } from './timestamps.js';
import { createSubtitleFiles, convertSrtToAss } from './subtitles.js';
import { WebmTask } from "../ffmpeg/outputs/output-webm.js";

const processAnySegment = async (params: FFmpegTaskParams): Promise<string[]> => {
	const mp4Task = new Mp4Task();
	const webmTask = new WebmTask();
	const gifTask = new GifTask();

	// Start all tasks concurrently and wait for all to complete
	const [mp4Outputs, webmOutputs, gifOutputs] = await Promise.all([
		mp4Task.multi(params, ['1080p', '720p', '480p']),
		webmTask.multi(params, ['1080p', '720p', '480p']),
		gifTask.multi(params, ['480p', '360p', '240p'])
	]);

	// Combine all outputs
	return [...mp4Outputs, ...webmOutputs, ...gifOutputs];
}

const processChildSegments = async (segment: VideoSegment, baseParams: FFmpegTaskParams): Promise<string[]> => {
	progressManager.log(`Processing ${segment.childSegments!.length} child segments`);

	for (let i = 0; i < segment.childSegments!.length; i++) {
		const child = segment.childSegments![i];
		progressManager.log(`Starting to process child segment ${i} for segment ${segment.index}`);

		const childParams = {
			...baseParams,
			childSegmentIndex: i,
			startTime: formatDuration(child.startTime),
			endTime: formatDuration(child.endTime)
		};

		try {
			const outputs = await processAnySegment(childParams);
			progressManager.log(`Successfully completed child segment ${i} for segment ${segment.index}`);
			return outputs;
		} catch (error) {
			progressManager.log(`Error processing child segment ${i}: ${(error as Error).message}`);
		}
	}

	return [];
};

const processWholeSegment = async (baseParams: FFmpegTaskParams): Promise<string[]> => {
	progressManager.log(`Processing whole segment`);

	const outputs = await processAnySegment(baseParams);
	progressManager.log(`Successfully completed whole segment`);

	return outputs;
};

export const processSegment = async (
	segment: VideoSegment,
	videoPath: string,
	outputFolder: string,
	videoName: string,
): Promise<void> => {
	const startTime = segment.startTimeStamp;
	const endTime = segment.endTimeStamp;

	// Create subtitle files
	const { srtPath, assPath } = createSubtitleFiles(segment, outputFolder);

	// Convert SRT to ASS
	await convertSrtToAss(srtPath, assPath);

	const baseParams: FFmpegTaskParams = {
		videoPath,
		startTime,
		endTime,
		subtitlePath: assPath,
		outputDir: outputFolder,
		segmentIndex: segment.index,
		childSegmentIndex: null // Null indicates this is the whole segment
	}

	progressManager.log(`Running tasks for segment ${segment.index}, with ${segment.childSegments?.length} child segments`);

	// Process child segments or create GIFs for the whole segment
	if (segment.childSegments && segment.childSegments.length > 0) {
		await processChildSegments(segment, baseParams);
	}
	else {
		progressManager.log(`No child segments found for segment ${segment.index}, skiping to whole segment`);
	}

	await processWholeSegment(baseParams);

	// Cleanup temporary files
	fs.removeSync(assPath);
	fs.removeSync(srtPath);

	progressManager.updateProgress(videoName, segment.index);
}; 
