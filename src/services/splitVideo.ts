import fs from 'fs-extra';
import path from 'path';
import pLimit from 'p-limit';
import { execShellCommand } from '../utils/shell.js';
import { progressManager } from '../utils/progress.js';
import { VideoSegment } from './processVideos.js';
import ffmpegPath from "ffmpeg-static";
import { FileLogger } from "../utils/file-logger.js";
import { parse } from 'subtitle'; // Ensure you install this: npm install subtitle

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

// Helper function to parse ASS timecode to seconds
function assTimeToSeconds(time: string): number {
	const [hours, minutes, seconds] = time.split(':');
	return parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseFloat(seconds);
}

// Helper function to format seconds back to ASS timecode
function secondsToAssTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = seconds % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds.toFixed(2)).padStart(5, '0')}`;
}

const processSegment = async (
	segment: VideoSegment,
	videoPath: string,
	outputFolder: string,
	videoName: string,
): Promise<void> => {
	const outputPath = path.join(outputFolder, `segment_${segment.index}.mp4`);

	if (fs.pathExistsSync(outputPath)) {
		progressManager.log(`Segment ${segment.index} already exists. Skipping...`);
		FileLogger.log(`Segment ${segment.index} skipped - already exists`);
	} else {
		const startTime = segment.startTimeStamp;
		const endTime = segment.endTimeStamp;

		// Create a temporary ASS subtitle file for this segment (convert from SRT)
		const tempSrtPath = path.join(outputFolder, `temp_subtitle_${segment.index}.srt`);
		const tempAssPath = path.join(outputFolder, `temp_subtitle_${segment.index}.ass`);

		// Generate SRT subtitle content (using ABSOLUTE, original timings)
		let subtitleContent = "";
		let srtIndex = 1;

		// Add each internal segment with correct timing
		if (segment.internalSegments) {
			for (const internal of segment.internalSegments) {
				const startStr = formatDuration(internal.startTime);
				const endStr = formatDuration(internal.endTime);
				const processedText = internal.text.replace(/\n/g, '\\N');

				FileLogger.log(`Segment ${segment.index}, start: ${internal.startTime}, end: ${internal.endTime}`);

				subtitleContent += `${srtIndex}\n`;
				subtitleContent += `${startStr} --> ${endStr}\n`;
				subtitleContent += `${processedText}\n\n`;
				srtIndex++;
			}
		} else {
			// Fallback for segments without internal timing
			const processedText = segment.subtitle.replace(/\n/g, '\\N');
			const duration = segment.endTime - segment.startTime;
			const startStr = formatDuration(segment.startTime);
			const endStr = formatDuration(segment.endTime);

			subtitleContent += `${srtIndex}\n`;
			subtitleContent += `${startStr} --> ${endStr}\n`;
			subtitleContent += `${processedText}\n\n`;
			srtIndex++;
		}

		fs.writeFileSync(tempSrtPath, subtitleContent);

		// Convert SRT to ASS using FFmpeg
		const convertCommand = `${ffmpegPath} -i "${tempSrtPath}" "${tempAssPath}"`;
		FileLogger.log(`SRT to ASS conversion command: ${convertCommand}`); // Log conversion command
		await execShellCommand(convertCommand);

		const assContent = fs.readFileSync(tempAssPath, 'utf-8');
		fs.writeFileSync(tempAssPath, assContent);

		// Build the FFmpeg command
		let command = `${ffmpegPath}`; // Removed -hwaccel videotoolbox
		command += ` -i "${videoPath}"`; // Removed -accurate_seek
		command += ` -ss ${startTime}`;
		command += ` -to ${endTime}`;
		command += ` -q:v 60`;
		command += ` -c:v libx264`; // Changed to software encoder
		command += ` -c:a copy`;
		command += ` -map 0:v:0`;
		command += ` -map 0:a:0`;
		command += ` -copyts`;
		command += ` -start_at_zero`;
		command += ` -vf "ass='${tempAssPath.replace(/[\\]/g, '/')}'"`; // Use ass filter with setpts
		command += ` "${outputPath}"`;

		FileLogger.log(`Segment ${segment.index} command: ${command}`);
		FileLogger.log(`Executing FFmpeg command: ${command}`);
		progressManager.log(`Executing FFmpeg command: ${command}`);
		await execShellCommand(command);

		// Clean up temporary subtitle files
		//fs.removeSync(tempSrtPath);
		//fs.removeSync(tempAssPath);
	}
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
