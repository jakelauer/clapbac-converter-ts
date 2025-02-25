import ffmpeg from './ffmpeg-config';
import { FFmpegTask } from './ffmpeg-task';
import { GifConversionOptions } from './conversion-options';

export class GifGenerator extends FFmpegTask {
	//private duration: string; //no longer need

	constructor(options: GifConversionOptions) {
		super(options.videoPath, options.outputPath, options.tempAssPath, options.startTime, options.endTime); // Pass startTime to base constructor
		//this.duration = options.duration; no longer need
	}

	async generate(): Promise<void> {
		const duration = String(Number(this.endTime.split(":").reduce((acc, time) => (60 * acc) + +time, 0)) - Number(this.startTime.split(":").reduce((acc, time) => (60 * acc) + +time, 0)));

		const ffmpegCommand = ffmpeg(this.videoPath)
			.setStartTime(this.startTime)
			.setDuration(duration)
			.complexFilter([
				`scale=640:360,ass='${this.tempAssPath.replace(/[\\]/g, '/')}',fps=24`
			])
			.output(this.outputPath);

		await this.runCommand(ffmpegCommand);
	}
}
