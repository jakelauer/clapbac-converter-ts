import fs from 'fs-extra';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import ffmpeg from 'ffmpeg-static';
import ffprobe from '@ffprobe-installer/ffprobe';

const execPromise = util.promisify(exec);

// First, let's add an interface for the stream structure
interface SubtitleStream {
	index: number;
	codec_type: string;
	codec_name: string;
	tags?: {
		language?: string;
		title?: string;
	};
}

// Add interface for the probe data structure
interface ProbeData {
	streams: SubtitleStream[];
	format: {
		filename: string;
		format_name: string;
		duration: string;
	};
}

export const extractSubtitlesFromMKV = async (
	videoPath: string,
	trackIndex: number | string | undefined,
	outputDir: string
): Promise<string> => {
	try {
		// Ensure output directory exists
		await fs.ensureDir(outputDir);

		// Get video streams info
		const { stdout } = await execPromise(`"${ffprobe.path}" -v quiet -print_format json -show_format -show_streams "${videoPath}"`);
		const videoInfo: ProbeData = JSON.parse(stdout);

		const subtitleStreams = videoInfo.streams.filter((stream: any) =>
			stream.codec_type === 'subtitle'
		);

		if (subtitleStreams.length === 0) {
			throw new Error('No subtitle streams found in the video file');
		}

		console.log('\n=== Subtitle Tracks Found ===');
		subtitleStreams.forEach((stream: any) => {
			console.log(`Stream #${stream.index}`);
			console.log(`  Language: ${stream.tags?.language || 'unknown'}`);
			console.log(`  Codec: ${stream.codec_name}`);
			console.log(`  Title: ${stream.tags?.title || 'untitled'}`);
		});
		console.log('===========================\n');

		let selectedTrack: number;
		console.log('Track index provided:', trackIndex);

		if (typeof trackIndex === 'string' && trackIndex.trim() !== '') {
			const parsedTrack = parseInt(trackIndex);
			if (isNaN(parsedTrack)) {
				throw new Error(`Invalid track index: ${trackIndex}`);
			}
			selectedTrack = parsedTrack;

			if (!subtitleStreams.some(stream => stream.index === selectedTrack)) {
				throw new Error(`Track ${selectedTrack} not found in subtitle streams`);
			}
		} else {
			const englishTrack = subtitleStreams.find(stream =>
				(stream.tags?.language || '').toLowerCase() === 'eng' ||
				(stream.tags?.language || '').toLowerCase() === 'en'
			);

			selectedTrack = englishTrack ? englishTrack.index : subtitleStreams[0].index;
			console.log(`Auto-selecting track: ${selectedTrack} (${englishTrack ? 'English' : 'first available'} track)`);
		}

		console.log(`Selected subtitle track: ${selectedTrack}`);

		const baseName = path.basename(videoPath, path.extname(videoPath));
		const outputPath = path.join(outputDir, `${baseName}.srt`);

		console.log(`Extracting subtitles from track ${selectedTrack} to ${outputPath}...`);

		if (!ffmpeg) {
			throw new Error('FFmpeg not found');
		}

		// Use execPromise instead of exec for better error handling
		await execPromise(`"${ffmpeg}" -y -i "${videoPath}" -map 0:${selectedTrack} "${outputPath}"`);

		// Verify the file was created
		if (!await fs.pathExists(outputPath)) {
			throw new Error(`Subtitle extraction failed: output file not created`);
		}

		return outputPath;
	} catch (error) {
		console.error('Extraction error:', error);
		throw new Error(`Failed to extract subtitles: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
} 
