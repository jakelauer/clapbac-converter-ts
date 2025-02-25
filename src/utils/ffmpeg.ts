import { promisify } from 'node:util';
import { execFile as execFileCb } from 'node:child_process';

const execFile = promisify(execFileCb);

export async function getVideoFPS(videoPath: string): Promise<number> {
	const { stdout } = await execFile('ffprobe', [
		'-v', '0',
		'-select_streams', 'v:0',
		'-show_entries', 'stream=r_frame_rate',
		'-of', 'default=noprint_wrappers=1:nokey=1',
		videoPath
	]);

	// ffprobe returns frame rate as a ratio (e.g., "24000/1001" for 23.976 fps)
	const [numerator, denominator] = stdout.trim().split('/').map(Number);
	return numerator / denominator;
} 
