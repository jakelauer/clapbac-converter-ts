// mp4-script.ts
import { Mp4ConversionOptions } from "./conversion-options";
import ffmpeg from './ffmpeg-config';
import { FFmpegTask } from './ffmpeg-task';

export class Mp4Generator extends FFmpegTask {
	protected endTime: string;

	constructor(options: Mp4ConversionOptions) {
		super(options.videoPath, options.outputPath, options.tempAssPath, options.startTime, options.endTime);
		this.endTime = options.endTime;
	}

	async generate(): Promise<void> {
		const duration = String(Number(this.endTime.split(":").reduce((acc, time) => (60 * acc) + +time, 0)) - Number(this.startTime.split(":").reduce((acc, time) => (60 * acc) + +time, 0)));

		const ffmpegCommand = ffmpeg(this.videoPath)
			.setStartTime(this.startTime)
			.setDuration(duration)
			.videoCodec('libx264')
			.audioCodec('copy')
			.outputOptions([
				'-map 0:v:0',
				'-map 0:a:0',
				'-copyts',
				'-start_at_zero',
				'-q:v 60'
			])
			.videoFilter(`ass='${this.tempAssPath.replace(/[\\]/g, '/')}'`)
			.output(this.outputPath);

		await this.runCommand(ffmpegCommand);
	}
}
