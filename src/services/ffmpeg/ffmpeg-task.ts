import ffmpegPath from "ffmpeg-static";
import { progressManager } from "../../utils/progress";
import { execShellCommand } from '../../utils/shell.js';
import { FFmpegTaskParams } from "./ffmpeg-task-params";
import { FfmpegSizePresets, FfmpegSizePreset } from "./ffmpeg-size-presets";
import crypto from 'node:crypto';
import fs from "fs-extra";



export abstract class FFmpegTask {
	constructor(private readonly extension: string) {
	}

	private setSizeForPreset(ffmpegCommandString: string, sizePreset: FfmpegSizePreset): string {
		const presetSize = FfmpegSizePresets[sizePreset];
		const vfScaleString = `scale=${presetSize.width}:-2`;
		const filterComplexRegex = /-filter_complex\s+(?:"([^"]+)"|'([^']+)'|(\S+))/;

		// Check if command has -vf or -filter_complex parameter
		if (ffmpegCommandString.includes('-vf') || ffmpegCommandString.includes('-filter_complex')) {
			let combinedFilter: string;

			if (ffmpegCommandString.includes('-vf')) {
				// Extract the existing vf parameter content
				const vfRegex = /-vf\s+(?:"([^"]+)"|'([^']+)'|(\S+))/;
				const match = ffmpegCommandString.match(vfRegex);

				if (match) {
					// Get the existing filter string (from any of the capturing groups)
					const existingFilter = match[1] || match[2] || match[3];
					// Create the combined filter string
					combinedFilter = `${vfScaleString},${existingFilter}`;
					// Replace the old -vf parameter with the new combined one
					return ffmpegCommandString.replace(vfRegex, `-vf "${combinedFilter}"`);
				}
			}

			if (ffmpegCommandString.includes('-filter_complex')) {
				// Extract the existing filter_complex parameter content
				const match = ffmpegCommandString.match(filterComplexRegex);

				if (match) {
					// Get the existing filter string (from any of the capturing groups)
					const existingFilter = match[1] || match[2] || match[3];
					// Create the combined filter string
					combinedFilter = `${vfScaleString},${existingFilter}`;
					// Replace the old -filter_complex parameter with the new combined one
					return ffmpegCommandString.replace(filterComplexRegex, `-filter_complex "${combinedFilter}"`);
				}
			}
		}

		// If no -vf or -filter_complex parameter or couldn't parse it, just add the scale filter
		return `${ffmpegCommandString} -vf "${vfScaleString}"`;
	}

	public async run<TParams extends FFmpegTaskParams>(params: TParams, sizePreset: FfmpegSizePreset): Promise<string> {
		const argumentList = this.buildArgumentList(params);

		//const outputPath = `${params.showMetadata.showName}-${params.showMetadata.seasonNumber}x${params.showMetadata.episodeNumber}.${sizePreset}.mp4`;

		const inputFilenameNoExtension = params.videoPath.split('/').pop()?.split('.').slice(0, -1).join('.');
		const inputDir = params.videoPath.split('/').slice(0, -1).join('/');
		const outputDir = params.outputDir ?? inputDir;
		const md5HashOfFilename = crypto.createHash('md5').update(`${inputFilenameNoExtension}`).digest('hex');
		const outputPath = `${outputDir}/${md5HashOfFilename}-${params.segmentIndex}-${sizePreset}.${this.extension}`;

		if (fs.pathExistsSync(outputPath)) {
			progressManager.log(`Segment ${params.segmentIndex} already exists. Skipping...`);
			return outputPath;
		}

		// Build the FFmpeg command
		let command = `${ffmpegPath}`; // Removed -hwaccel videotoolbox
		command += ` -i "${params.videoPath}"`; // Removed -accurate_seek
		command += ` -ss ${params.startTime}`;
		command += ` -to ${params.endTime}`;
		command += ` ${argumentList.join(' ')}`;
		command += ` "${outputPath}"`;

		progressManager.log(`Executing FFmpeg command: ${command}`);

		progressManager.log(`Base FFmpeg command: ${command}`);
		command = this.setSizeForPreset(command, sizePreset);
		progressManager.log(`Final FFmpeg command: ${command}`);

		await execShellCommand(command);

		return outputPath;
	}

	protected abstract buildArgumentList<TParams extends FFmpegTaskParams>(params: TParams): string[];
}
