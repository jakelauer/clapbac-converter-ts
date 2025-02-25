// ffmpeg-config.ts
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static'; // Default import

const ffmpegPath = ffmpegStatic; // Access directly

if (!ffmpegPath) {
	throw new Error('ffmpeg-static not found');
}

ffmpeg.setFfmpegPath(ffmpegPath);

console.log("FFmpeg path set to:", ffmpegPath);  // Debugging

export default ffmpeg;
