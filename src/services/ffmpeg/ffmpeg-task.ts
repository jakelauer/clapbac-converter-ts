// ffmpeg-task.ts
import ffmpeg from './ffmpeg-config';
import { FileLogger } from "../../utils/file-logger";
import { progressManager } from "../../utils/progress";

export abstract class FFmpegTask {
	protected videoPath: string;
	protected outputPath: string;
	protected tempAssPath: string;
	protected startTime: string; // Add startTime property
	protected endTime: string;   // Add endTime property, if needed

	constructor(videoPath: string, outputPath: string, tempAssPath: string, startTime: string, endTime?: string) {
		this.videoPath = videoPath;
		this.outputPath = outputPath;
		this.tempAssPath = tempAssPath;
		this.startTime = startTime;
		this.endTime = endTime || startTime; // Default to startTime if endTime not provided
	}

	protected logCommand(commandLine: string): void {
		FileLogger.log(`Executing FFmpeg command: ${commandLine}`);
		progressManager.log(`Executing FFmpeg command: ${commandLine}`); // Changed progressManager to ProgressManager
	}

	protected async runCommand(ffmpegCommand: ffmpeg.FfmpegCommand): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			ffmpegCommand
				.on('start', (commandLine) => {
					this.logCommand(commandLine);
				})
				.on('end', () => {
					FileLogger.log(`${this.constructor.name} generation finished!`); // Log task name
					progressManager.log(`${this.constructor.name} generation finished!`); //Log task name
					resolve();
				})
				.on('error', (err) => {
					FileLogger.log(`Error generating ${this.constructor.name}: ${err}`); // Log task name
					progressManager.log(`Error generating ${this.constructor.name}: ${err}`); //Log task name
					reject(err);
				})
				.run();
		});
	}

	abstract generate(): Promise<void>; // Abstract method to be implemented by subclasses
}
