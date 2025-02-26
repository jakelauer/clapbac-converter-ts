import fs from 'fs-extra';
import path from 'path';
import pLimit from 'p-limit';
import { execShellCommand } from '../utils/shell.js';
import { progressManager } from '../utils/progress.js';
import { VideoSegment } from './processVideos.js';
import ffmpegPath from "ffmpeg-static";
import { Mp4Task, GifTask } from "./ffmpeg/outputs/index.js";
import { FFmpegTaskParams } from "./ffmpeg/ffmpeg-task-params.js";

interface Segment {
	index: number;
	outputPath: string;
	start: string;
	end: string;
}

interface TimestampStruct {
	discrete: TimestampStructBase;
	totals: TimestampStructBase;
}

interface TimestampStructBase {
	hours: number;
	minutes: number;
	seconds: number;
	milliseconds: number;
}

const createOutputDirectory = (videoPath: string, outputDir: string): string => {
	const videoName = path.basename(videoPath, path.extname(videoPath));
	const outputFolder = path.join(outputDir, videoName);
	fs.ensureDirSync(outputFolder);
	return outputFolder;
};

const processSegment = async (
	segment: VideoSegment,
	videoPath: string,
	outputFolder: string,
	videoName: string,
): Promise<void> => {
	const startTime = segment.startTimeStamp;
	const endTime = segment.endTimeStamp;

	// Create a temporary ASS subtitle file for this segment (convert from SRT)
	const tempSrtPath = path.join(outputFolder, `temp_subtitle_${segment.index}.srt`);
	const tempAssPath = path.join(outputFolder, `temp_subtitle_${segment.index}.ass`);

	// Generate SRT subtitle content (using ABSOLUTE, original timings)
	let subtitleContent = "";
	let srtIndex = 1;

	// Add each child segment with correct timing
	if (segment.childSegments) {
		for (let i = 0; i < segment.childSegments.length; i++) {
			const child = segment.childSegments[i];
			const startStr = formatDuration(child.startTime);
			const endStr = formatDuration(child.endTime);
			const processedText = child.text.replace(/\n/g, '\\N');

			progressManager.log(`Segment ${segment.index}, child segment ${i}, start: ${child.startTime}, end: ${child.endTime}`);

			subtitleContent += `${srtIndex}\n`;
			subtitleContent += `${startStr} --> ${endStr}\n`;
			subtitleContent += `${processedText}\n\n`;
			srtIndex++;
		}
	} else {
		// Fallback for segments without child timing
		const processedText = segment.subtitle.replace(/\n/g, '\\N');
		const startStr = formatDuration(segment.startTime);
		const endStr = formatDuration(segment.endTime);

		subtitleContent += `${srtIndex}\n`;
		subtitleContent += `${startStr} --> ${endStr}\n`;
		subtitleContent += `${processedText}\n\n`;
		srtIndex++;
	}

	fs.writeFileSync(tempSrtPath, subtitleContent);

	// Convert SRT to ASS using FFmpeg with overwrite option
	const convertCommand = `${ffmpegPath} -y -i "${tempSrtPath}" "${tempAssPath}"`;
	progressManager.log(`SRT to ASS conversion command: ${convertCommand}`); // Log conversion command

	await execShellCommand(convertCommand);

	progressManager.log(`SRT to ASS conversion complete`);

	const assContent = fs.readFileSync(tempAssPath, 'utf-8');
	fs.writeFileSync(tempAssPath, assContent);

	const baseParams: FFmpegTaskParams = {
		videoPath,
		startTime,
		endTime,
		subtitlePath: tempAssPath,
		outputDir: outputFolder,
		segmentIndex: segment.index,
	}

	progressManager.log(`Running tasks for segment ${segment.index}`);
	const mp4Task = new Mp4Task();
	const gifTask = new GifTask();

	const mp4_1080p_OutputPath = await mp4Task.run(baseParams, '1080p');
	const mp4_720p_OutputPath = await mp4Task.run(baseParams, '720p');
	const mp4_480p_OutputPath = await mp4Task.run(baseParams, '480p');
	const gif_480p_OutputPath = await gifTask.run(baseParams, '480p');
	const gif_360p_OutputPath = await gifTask.run(baseParams, '360p');
	const gif_240p_OutputPath = await gifTask.run(baseParams, '240p');

	fs.removeSync(tempAssPath);
	fs.removeSync(tempSrtPath);

	progressManager.updateProgress(videoName, segment.index);
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

// timestamp is in the format of HH:MM:SS.mmm
export function parseTimestampToStruct(timestamp: string): TimestampStruct {
	// Parse the timestamp string (HH:MM:SS.mmm)
	const [time, milliseconds = '000'] = timestamp.split('.');
	const [hours, minutes, seconds] = time.split(':').map(Number);
	const totalMilliseconds = hours * 3600000 + minutes * 60000 + seconds * 1000 + parseInt(milliseconds);
	const totalSeconds = totalMilliseconds / 1000;
	const totalMinutes = totalSeconds / 60;
	const totalHours = totalMinutes / 60;

	return {
		discrete: {
			hours,
			minutes,
			seconds,
			milliseconds: parseInt(milliseconds)
		},
		totals: {
			hours: totalHours,
			minutes: totalMinutes,
			seconds: totalSeconds,
			milliseconds: totalMilliseconds
		}
	}
}

export function durationToTimestampStruct(duration: number): TimestampStructBase {
	const hours = Math.floor(duration / 3600);
	const minutes = Math.floor((duration % 3600) / 60);
	const seconds = duration % 60;
	const milliseconds = Math.floor((duration % 1) * 1000);
	return { hours, minutes, seconds, milliseconds };
}

export function formatTimestamp(timestamp: TimestampStruct): string {
	return `${timestamp.totals.hours}:${timestamp.totals.minutes}:${timestamp.totals.seconds}.${timestamp.totals.milliseconds}`;
}

export function formatDuration(duration: number): string {
	// Round to 3 decimal places to avoid floating point precision issues
	const roundedDuration = Math.round(duration * 1000) / 1000;
	const hours = Math.floor(roundedDuration / 3600);
	const minutes = Math.floor((roundedDuration % 3600) / 60);
	const seconds = Math.floor(roundedDuration % 60);

	// Correct millisecond calculation: subtract the integer part of the duration
	const milliseconds = Math.round(Math.round((roundedDuration - Math.floor(roundedDuration)) * 1000));

	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}
