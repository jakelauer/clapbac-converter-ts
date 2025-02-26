export interface Segment {
	index: number;
	outputPath: string;
	start: string;
	end: string;
}

export interface TimestampStruct {
	discrete: TimestampStructBase;
	totals: TimestampStructBase;
}

export interface TimestampStructBase {
	hours: number;
	minutes: number;
	seconds: number;
	milliseconds: number;
} 
