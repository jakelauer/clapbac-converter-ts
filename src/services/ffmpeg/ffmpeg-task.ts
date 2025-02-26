import ffmpegPath from "ffmpeg-static";
import { progressManager } from "../../utils/progress";
import { execShellCommand } from '../../utils/shell.js';
import { FFmpegTaskParams } from "./ffmpeg-task-params";
import { FfmpegSizePresets, FfmpegSizePreset } from "./ffmpeg-size-presets";
import crypto from 'node:crypto';
import fs from "fs-extra";
import path from "node:path";
import { createFilenameHash } from "../../utils/hash";

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

	protected generateOutputPath(params: FFmpegTaskParams, sizePreset: FfmpegSizePreset): string {
		const videoPathParts = params.videoPath.split('/');
		const inputFilenameNoExtension = videoPathParts.pop()?.split('.').slice(0, -1).join('.');
		if (!inputFilenameNoExtension) {
			throw new Error('Input filename failed to parse');
		}

		const inputDir = videoPathParts.join('/');
		const outputDir = params.outputDir || inputDir;

		const md5HashOfFilename = createFilenameHash(params.videoPath);

		const filenameChildSegmentPortion = params.childSegmentIndex !== null && params.childSegmentIndex !== undefined
			? `${params.childSegmentIndex}-`
			: '';
		const outputFilename = `${md5HashOfFilename}-${params.segmentIndex}-${filenameChildSegmentPortion}${sizePreset}`;
		const outputFilenameWithExtension = `${outputFilename}.${this.extension}`;

		progressManager.log(`Output filename: ${outputFilenameWithExtension}`);

		return path.join(outputDir, outputFilenameWithExtension);
	}

	protected generateCommand(params: FFmpegTaskParams, outputPath: string, sizePreset: FfmpegSizePreset): string {
		// Build the FFmpeg command
		let command = `${ffmpegPath}`; // Removed -hwaccel videotoolbox
		command += ` -i "${params.videoPath}"`; // Removed -accurate_seek
		command += ` -ss ${params.startTime}`;
		command += ` -to ${params.endTime}`;
		command += ` ${this.buildArgumentList(params).join(' ')}`;
		command += ` "${outputPath}"`;

		progressManager.log(`Base FFmpeg command: ${command}`);
		command = this.setSizeForPreset(command, sizePreset);
		progressManager.log(`Final FFmpeg command: ${command}`);

		return command;
	}

	public async one<TParams extends FFmpegTaskParams>(params: TParams, sizePreset: FfmpegSizePreset): Promise<string> {
		const outputPath = this.generateOutputPath(params, sizePreset);

		progressManager.log(`Params: ${JSON.stringify(params, null, 2)}`);

		if (fs.pathExistsSync(outputPath)) {
			progressManager.log(`Segment ${params.segmentIndex} already exists. Skipping...`);
			return outputPath;
		}

		const command = this.generateCommand(params, outputPath, sizePreset);
		progressManager.log(`Executing FFmpeg command for segment ${params.segmentIndex} and child segment ${params.childSegmentIndex}: ${command}`);

		await execShellCommand(command);

		return outputPath;
	}

	public async multi<TParams extends FFmpegTaskParams>(params: TParams, sizePresets: FfmpegSizePreset[]): Promise<string[]> {
		// Process all size presets in parallel
		const outputPromises = sizePresets.map(sizePreset =>
			this.one(params, sizePreset)
		);

		// Wait for all size preset conversions to complete
		return Promise.all(outputPromises);
	}

	protected abstract buildArgumentList<TParams extends FFmpegTaskParams>(params: TParams): string[];
}
