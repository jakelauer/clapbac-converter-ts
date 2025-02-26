import { FFmpegTask } from '../ffmpeg-task';
import { FFmpegTaskParams } from '../ffmpeg-task-params';
export class Mp4Task extends FFmpegTask {
	constructor() {
		super('mp4');
	}

	protected buildArgumentList<TParams extends FFmpegTaskParams>(params: TParams): string[] {
		return [
			`-q:v 60`,
			`-c:v libx264`,
			`-c:a copy`,
			`-map 0:v:0`,
			`-map 0:a:0`,
			`-copyts`,
			`-start_at_zero`,
			`-vf "ass='${params.subtitlePath.replace(/[\\]/g, '/')}'"`, // Use ass filter with setpts
		];
	}
}
