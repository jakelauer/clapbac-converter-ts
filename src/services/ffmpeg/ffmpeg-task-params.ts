export interface InputShowMetadata {
	showName: string;
	seasonNumber: string;
	episodeNumber: string;
	episodeTitle: string;
	episodeDescription: string;
}

export interface FFmpegTaskParams {
	videoPath: string;
	startTime: string;
	endTime: string;
	subtitlePath: string;
	outputDir?: string;
	segmentIndex: number;
	//showMetadata: InputShowMetadata;
}
