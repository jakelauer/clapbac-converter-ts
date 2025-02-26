import { FFmpegTask } from '../ffmpeg-task';
import { FFmpegTaskParams } from '../ffmpeg-task-params';
import { detectNvidiaGpu } from '../../../utils/hardware-detection';

export class GifTask extends FFmpegTask {
	private hasNvidiaGpu: boolean | null = null;

	constructor() {
		super('gif');
		this.hasNvidiaGpu = detectNvidiaGpu();
	}

	protected buildArgumentList<TParams extends FFmpegTaskParams>(params: TParams): string[] {
		// For GIFs, we primarily use GPU for the processing pipeline
		// rather than for encoding (since GIFs don't use video codecs like h264)
		const hwAccel = this.hasNvidiaGpu ? `-hwaccel cuda` : '';

		// Base arguments
		const baseArgs = [
			`-r 24`,  // Lower framerate for GIF (adjust as needed)
			`-loop 0`, // Loop the GIF infinitely
		];

		// Create filter complex with hardware acceleration if available
		const filterComplex = this.hasNvidiaGpu
			? `"hwupload_cuda,ass='${params.subtitlePath.replace(/[\\]/g, '/')}',hwdownload,format=nv12"`
			: `"ass='${params.subtitlePath.replace(/[\\]/g, '/')}'"`;

		return [
			...(hwAccel ? [hwAccel] : []),
			`-filter_complex ${filterComplex}`,
			...baseArgs
		];
	}
}
