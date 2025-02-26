import { execSync } from 'child_process';

/**
 * Detects if an NVIDIA GPU with NVENC support is available
 * @returns Boolean indicating if NVENC is available
 */
export function detectNvidiaGpu(): boolean {
	try {
		// Check if NVENC is available in FFmpeg
		const result = execSync('ffmpeg -encoders | grep nvenc', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
		return result.includes('h264_nvenc');
	} catch (error) {
		// If the command fails or no nvidia encoders found
		return false;
	}
} 
