// conversion-options.ts

export interface ConversionOptions {
	videoPath: string;
	startTime: string;
	endTime: string; // added endtime
	outputPath: string;
	tempAssPath: string;
}

export interface GifConversionOptions extends ConversionOptions {
	//duration: string; // Removed duration
	// Add any other GIF-specific options here
}

export interface Mp4ConversionOptions extends ConversionOptions {
	//endTime: string; // endTime is now in ConversionOptions
	// Add any other MP4-specific options here
}

// A type alias to combine the specific options
export type AnyConversionOptions = GifConversionOptions | Mp4ConversionOptions;
