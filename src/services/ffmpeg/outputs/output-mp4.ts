import { FFmpegTask } from '../ffmpeg-task';
import { FFmpegTaskParams } from '../ffmpeg-task-params';
import { detectNvidiaGpu } from '../../../utils/hardware-detection';

export class Mp4Task extends FFmpegTask {
	private hasNvidiaGpu: boolean | null = null;

	constructor() {
		super('mp4');
		this.hasNvidiaGpu = detectNvidiaGpu();
	}

	protected buildArgumentList<TParams extends FFmpegTaskParams>(params: TParams): string[] {
		// Override GPU detection with params if explicitly provided
		const videoCodec = this.hasNvidiaGpu ? `-c:v h264_nvenc` : `-c:v libx264`;

		// Add NVENC-specific settings when using GPU
		const gpuSettings = this.hasNvidiaGpu ? [`-preset p4`, `-tune hq`] : [];

		return [
			`-q:v 60`,
			videoCodec,
			...gpuSettings,
			`-c:a copy`,
			`-map 0:v:0`,
			`-map 0:a:0`,
			`-copyts`,
			`-start_at_zero`,
			`-vf "ass='${params.subtitlePath.replace(/[\\]/g, '/')}'"`, // Use ass filter with setpts
		];
	}
}
