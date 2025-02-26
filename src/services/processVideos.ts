import fs from 'fs-extra';
import path from 'path';
import { splitVideo } from './split-video/index.js';
import { progressManager } from '../utils/progress.js';
import { extractSubtitlesFromMKV } from '../utils/mkvExtractor.js';
import { isVideoComplete, markVideoComplete } from '../utils/completion.js';
import { parseSubtitleFile } from "../utils/subtitle.js";
import { getVideoFPS } from '../utils/ffmpeg.js';
import { parseTimestampToStruct } from "./split-video/index.js";
import { createFilenameHash } from '../utils/hash.js';

interface VideoMetadata {
	show?: string;
	season?: number;
	episode?: number;
	filePath: string;
}

export interface InputVideoSegment {
	index: number;
	startTime: string;
	endTime: string;
	duration: number;
	frameCount: number;
	subtitle: string;
}

export interface VideoSegment {
	index: number;
	startTimeStamp: string;
	startTime: number;
	endTime: number;
	endTimeStamp: string;
	duration: number;
	frameCount: number;
	subtitle: string;
	childSegments?: Array<{
		startTime: number;
		endTime: number;
		text: string;
	}>;
}

interface VideoProcessingData {
	metadata: VideoMetadata;
	segments: VideoSegment[];
	fileHash: string;
}

interface ProcessOptions {
	videoDir: string;
	subtitleDir?: string;
	outputDir: string;
	concurrency: number;
	embedded?: boolean;
	trackIndex?: number;
	jsonOnly?: boolean;
	jsonPath?: string;
	gapThreshold?: number;
	minSegmentDuration?: number;
	maxSegmentDuration?: number;
}

const processVideoFile = async (
	videoFile: string | fs.Dirent,
	options: ProcessOptions
): Promise<void> => {
	const { videoDir, subtitleDir, outputDir, concurrency, embedded, trackIndex, jsonOnly } = options;
	const fileName = typeof videoFile === 'string' ? videoFile : videoFile.name;
	const baseName = path.basename(fileName, path.extname(fileName));

	// Check if this video was already processed
	if (await isVideoComplete(baseName, outputDir) && !jsonOnly) {
		console.log(`Skipping ${fileName} - already processed`);
		return;
	}

	console.log(`\n=== Processing ${fileName} ===`);
	const videoPath = path.join(videoDir, fileName);

	// If we're processing from JSON, use that instead
	if (options.jsonPath) {
		const jsonData: VideoProcessingData = JSON.parse(
			await fs.readFile(options.jsonPath, 'utf-8')
		);
		await splitVideo(jsonData.metadata.filePath, null, outputDir, concurrency, jsonData.segments);
		await markVideoComplete(baseName, outputDir);
		return;
	}

	let subtitlePath: string;

	if (embedded && fileName.toLowerCase().endsWith('.mkv')) {
		// Extract subtitles from MKV file
		subtitlePath = await extractSubtitlesFromMKV(
			videoPath,
			trackIndex?.toString(),
			outputDir
		);
	} else if (subtitleDir) {
		// Use external subtitle file
		subtitlePath = path.join(subtitleDir, `${baseName}.srt`);
		if (!fs.pathExistsSync(subtitlePath)) {
			console.warn(`No subtitle file found for ${fileName}`);
			return;
		}
	} else {
		console.warn(`No subtitle source specified for ${fileName}`);
		return;
	}

	// Generate segments data
	const segmentsData = await analyzeVideoAndSubtitles(videoPath, subtitlePath, options.gapThreshold, options.minSegmentDuration, options.maxSegmentDuration);

	// Save JSON data
	const jsonData: VideoProcessingData = {
		metadata: await extractVideoMetadata(videoPath),
		segments: segmentsData,
		fileHash: createFilenameHash(videoPath)
	};

	const jsonOutputPath = path.join(outputDir, `${baseName}.json`);
	await fs.writeJSON(jsonOutputPath, jsonData, { spaces: 2 });
	console.log(`Saving JSON data for ${jsonOutputPath}`);

	if (!jsonOnly) {
		await splitVideo(videoPath, subtitlePath, outputDir, concurrency, segmentsData);
		await markVideoComplete(baseName, outputDir);
	}

	console.log(`Completed processing ${fileName}`);
};

export const processVideos = async (options: ProcessOptions): Promise<void> => {
	console.log('Starting batch video processing');
	console.log(`Video directory: ${options.videoDir}`);
	if (options.subtitleDir) console.log(`Subtitle directory: ${options.subtitleDir}`);
	if (options.embedded) console.log('Using embedded subtitles');
	console.log(`Output directory: ${options.outputDir}`);

	if (options.jsonPath) {
		console.log(`Processing from JSON file: ${options.jsonPath}`);
		await processVideoFile(path.basename(options.jsonPath), options);
		return;
	}

	try {
		const videoFiles = (fs.readdirSync(options.videoDir) || []).filter(file => file.endsWith('.mkv') || file.endsWith('.mp4'));
		console.log(`Found ${videoFiles.length} videos to process`);

		for (const videoFile of videoFiles) {
			await processVideoFile(videoFile, options);
		}

		console.log('\nBatch processing completed successfully');
	} catch (error) {
		console.error('Error during batch processing:', error);
		throw error;
	} finally {
		progressManager.stop();
	}
};

async function extractVideoMetadata(videoPath: string): Promise<VideoMetadata> {
	// Implement video metadata extraction here
	// You might want to use ffprobe or similar tools
	return {
		filePath: videoPath,
		// ... extract show, season, episode
	};
}

function endsWithSentence(text: string): boolean {
	const trimmed = text.trim();
	return /[.!?]$/.test(trimmed);
}

async function analyzeVideoAndSubtitles(
	videoPath: string,
	subtitlePath: string,
	gapThreshold: number = 1000,
	minSegmentDuration: number = 3000,
	maxSegmentDuration: number = 15000
): Promise<VideoSegment[]> {
	const timestamps = parseSubtitleFile(subtitlePath);
	const fps = await getVideoFPS(videoPath);

	let segments: VideoSegment[] = timestamps.map((timestamp, index) => ({
		index: index + 1,
		startTime: parseTimestampToStruct(timestamp.start).totals.seconds,
		endTime: parseTimestampToStruct(timestamp.end).totals.seconds,
		startTimeStamp: timestamp.start,
		endTimeStamp: timestamp.end,
		duration: parseTimestampToStruct(timestamp.end).totals.seconds - parseTimestampToStruct(timestamp.start).totals.seconds,
		frameCount: Math.ceil(fps * (parseTimestampToStruct(timestamp.end).totals.seconds - parseTimestampToStruct(timestamp.start).totals.seconds)),
		subtitle: timestamp.text
	}));

	const mergedSegments: VideoSegment[] = [];
	let currentGroup: VideoSegment[] = [];

	for (let i = 0; i < segments.length; i++) {
		const currentSegment = segments[i];

		if (currentGroup.length === 0) {
			currentGroup.push(currentSegment);
			continue;
		}

		const lastSegmentInGroup = currentGroup[currentGroup.length - 1];
		const gapInSeconds = currentSegment.startTime - lastSegmentInGroup.endTime;
		const gapInMs = gapInSeconds * 1000;
		const currentDuration = (lastSegmentInGroup.endTime - currentGroup[0].startTime) * 1000;
		const potentialMergedDuration = (currentSegment.endTime - currentGroup[0].startTime) * 1000;

		console.log(`\nAnalyzing gap between segments:`);
		console.log(`  Last segment ends at: ${lastSegmentInGroup.endTime.toFixed(3)} seconds`);
		console.log(`  Current segment starts at: ${currentSegment.startTime.toFixed(3)} seconds`);
		console.log(`  Gap size: ${gapInMs.toFixed(3)}ms`);
		console.log(`  Current group duration: ${currentDuration.toFixed(3)}ms`);

		// Check if current segment would be too short if we don't merge
		const shouldForcemerge = minSegmentDuration > 0 && currentDuration < minSegmentDuration;

		// Check if merging would exceed max duration
		const wouldExceedMaxDuration = maxSegmentDuration > 0 && potentialMergedDuration > maxSegmentDuration;

		// Check if we should merge based on gap threshold and sentence completion
		const shouldMerge = gapInMs <= gapThreshold &&
			(!endsWithSentence(lastSegmentInGroup.subtitle) || shouldForcemerge) &&
			!wouldExceedMaxDuration;

		if (shouldMerge) {
			if (shouldForcemerge && endsWithSentence(lastSegmentInGroup.subtitle)) {
				console.log(`Forcing merge despite sentence end - segment duration (${currentDuration.toFixed(2)}ms) below minimum (${minSegmentDuration}ms)`);
			} else {
				console.log(`Merging segments: Gap of ${gapInMs.toFixed(2)}ms detected (threshold: ${gapThreshold}ms)`);
			}
			console.log(`  Segment ${lastSegmentInGroup.index}: "${lastSegmentInGroup.subtitle}"`);
			console.log(`  Segment ${currentSegment.index}: "${currentSegment.subtitle}"`);
			currentGroup.push(currentSegment);
		} else {
			if (wouldExceedMaxDuration) {
				console.log(`Skipping merge - would exceed maximum duration of ${maxSegmentDuration}ms`);
			} else if (gapInMs <= gapThreshold && endsWithSentence(lastSegmentInGroup.subtitle)) {
				console.log(`Skipping merge despite small gap (${gapInMs.toFixed(2)}ms) - previous segment ends a sentence`);
				console.log(`  Previous: "${lastSegmentInGroup.subtitle}"`);
				console.log(`  Current: "${currentSegment.subtitle}"`);
			}

			// Either gap is too large or we're at a sentence boundary (and segment is long enough)
			if (currentGroup.length > 0) {
				const mergedSegment = mergeSegmentGroup(currentGroup, fps);
				mergedSegments.push(mergedSegment);
			}
			currentGroup = [currentSegment];
		}
	}

	// Don't forget to merge the last group
	if (currentGroup.length > 0) {
		const mergedSegment = mergeSegmentGroup(currentGroup, fps);
		mergedSegments.push(mergedSegment);
	}

	// Log final merge results
	if (segments.length !== mergedSegments.length) {
		console.log(`\nMerged ${segments.length} segments into ${mergedSegments.length} segments based on:`);
		console.log(`  - Gap threshold: ${gapThreshold}ms`);
		console.log(`  - Minimum segment duration: ${minSegmentDuration}ms`);
		console.log(`  - Maximum segment duration: ${maxSegmentDuration}ms`);
		console.log(`  - Sentence boundaries (unless minimum duration forces merge)`);
	}

	// Reindex the merged segments
	return mergedSegments.map((segment, index) => ({
		...segment,
		index: index + 1
	}));
}

function mergeSegmentGroup(group: VideoSegment[], fps: number): VideoSegment {
	if (group.length === 1) {
		return {
			...group[0],
			childSegments: undefined
		};
	}

	const firstSegment = group[0];
	const lastSegment = group[group.length - 1];

	return {
		index: firstSegment.index,
		startTime: firstSegment.startTime,
		endTime: lastSegment.endTime,
		startTimeStamp: firstSegment.startTimeStamp,
		endTimeStamp: lastSegment.endTimeStamp,
		duration: lastSegment.endTime - firstSegment.startTime,
		frameCount: Math.ceil(fps * (lastSegment.endTime - firstSegment.startTime)),
		subtitle: group.map(seg => seg.subtitle).join('\n'),
		childSegments: group.map(seg => ({
			startTime: seg.startTime,
			endTime: seg.endTime,
			text: seg.subtitle
		}))
	};
}

// Helper function to convert HH:MM:SS,mmm to seconds
function parseTimestamp(timestamp: string): number {
	// Remove any trailing dots and split on colons
	const parts = timestamp.trim().split(':');

	if (parts.length !== 3) {
		throw new Error(`Invalid timestamp format: ${timestamp}`);
	}

	// Handle the seconds part which may contain milliseconds
	const [secondsPart, millisecondsPart = '0'] = parts[2].split('.');

	const hours = parseInt(parts[0], 10);
	const minutes = parseInt(parts[1], 10);
	const seconds = parseInt(secondsPart, 10);
	const milliseconds = parseInt(millisecondsPart.padEnd(3, '0'), 10);

	return (
		hours * 3600 +
		minutes * 60 +
		seconds +
		milliseconds / 1000
	);
} 
