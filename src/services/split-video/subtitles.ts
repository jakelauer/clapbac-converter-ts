import fs from 'fs-extra';
import path from 'path';
import ffmpegPath from "ffmpeg-static";
import { execShellCommand } from '../../utils/shell.js';
import { progressManager } from '../../utils/progress.js';
import { VideoSegment } from '../processVideos.js';
import { formatDuration } from './timestamps.js';

export const createSubtitleContent = (segment: VideoSegment): string => {
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

	return subtitleContent;
};

export const createSubtitleFiles = (segment: VideoSegment, outputFolder: string): { srtPath: string, assPath: string } => {
	const tempSrtPath = path.join(outputFolder, `temp_subtitle_${segment.index}.srt`);
	const tempAssPath = path.join(outputFolder, `temp_subtitle_${segment.index}.ass`);

	const subtitleContent = createSubtitleContent(segment);
	fs.writeFileSync(tempSrtPath, subtitleContent);

	return { srtPath: tempSrtPath, assPath: tempAssPath };
};

export const convertSrtToAss = async (srtPath: string, assPath: string): Promise<void> => {
	const convertCommand = `${ffmpegPath} -y -i "${srtPath}" "${assPath}"`;
	progressManager.log(`SRT to ASS conversion command: ${convertCommand}`);

	await execShellCommand(convertCommand);
	progressManager.log(`SRT to ASS conversion complete`);

	const assContent = fs.readFileSync(assPath, 'utf-8');
	fs.writeFileSync(assPath, assContent);
}; 
