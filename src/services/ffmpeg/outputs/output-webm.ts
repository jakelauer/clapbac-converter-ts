import { FFmpegTask } from '../ffmpeg-task';
import { FFmpegTaskParams } from '../ffmpeg-task-params';
import { detectNvidiaGpu } from '../../../utils/hardware-detection';

export class WebmTask extends FFmpegTask {
	private hasNvidiaGpu: boolean | null = null;

	constructor() {
		super('webm');
		this.hasNvidiaGpu = detectNvidiaGpu();
	}

	protected buildArgumentList<TParams extends FFmpegTaskParams>(params: TParams): string[] {
		// Override GPU detection with params if explicitly provided
		const videoCodec = this.hasNvidiaGpu ? `-c:v vp9_nvenc` : `-c:v libvpx-vp9`;

		// Add NVENC-specific settings when using GPU
		const gpuSettings = this.hasNvidiaGpu ? [`-preset p4`, `-tune hq`] : [];

		// Fix for 5.1 surround sound - downmix to stereo for compatibility
		// This helps avoid "Invalid channel layout" errors with complex audio sources
		const audioCodec = `-c:a libopus -b:a 192k -ac 2`;

		return [
			`-q:v 60`,
			videoCodec,
			...gpuSettings,
			audioCodec,
			`-map 0:v:0`,
			`-map 0:a:0`,
			`-copyts`,
			`-start_at_zero`,
			`-vf "ass='${params.subtitlePath.replace(/[\\]/g, '/')}'"`, // Use ass filter with setpts
		];
	}
} 
