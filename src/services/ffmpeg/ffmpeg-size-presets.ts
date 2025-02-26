export const FfmpegSizePresets = {
	"1080p": {
		width: 1920,
		height: 1080,
	} as Dimensions,
	"720p": {
		width: 1280,
		height: 720,
	} as Dimensions,
	"480p": {
		width: 640,
		height: 480,
	} as Dimensions,
	"360p": {
		width: 480,
		height: 360,
	} as Dimensions,
	"240p": {
		width: 320,
		height: 240,
	} as Dimensions,
	"144p": {
		width: 256,
		height: 144,
	} as Dimensions,
} as const;

export type FfmpegSizePreset = keyof typeof FfmpegSizePresets;
export type Dimensions = {
	width: number;
	height: number;
}
