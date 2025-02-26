import { FFmpegTask } from '../ffmpeg-task';
import { FFmpegTaskParams } from '../ffmpeg-task-params';
export class GifTask extends FFmpegTask {
	constructor() {
		super('gif');
	}

	protected buildArgumentList<TParams extends FFmpegTaskParams>(params: TParams): string[] {
		return [
			`-filter_complex "ass='${params.subtitlePath.replace(/[\\]/g, '/')}'"`,
			`-r 24`,  // Lower framerate for GIF (adjust as needed)
			`-loop 0`, // Loop the GIF infinitely
		];
	}
}
