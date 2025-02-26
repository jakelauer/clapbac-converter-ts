import { TimestampStruct, TimestampStructBase } from './types';

// timestamp is in the format of HH:MM:SS.mmm
export function parseTimestampToStruct(timestamp: string): TimestampStruct {
	// Parse the timestamp string (HH:MM:SS.mmm)
	const [time, milliseconds = '000'] = timestamp.split('.');
	const [hours, minutes, seconds] = time.split(':').map(Number);
	const totalMilliseconds = hours * 3600000 + minutes * 60000 + seconds * 1000 + parseInt(milliseconds);
	const totalSeconds = totalMilliseconds / 1000;
	const totalMinutes = totalSeconds / 60;
	const totalHours = totalMinutes / 60;

	return {
		discrete: {
			hours,
			minutes,
			seconds,
			milliseconds: parseInt(milliseconds)
		},
		totals: {
			hours: totalHours,
			minutes: totalMinutes,
			seconds: totalSeconds,
			milliseconds: totalMilliseconds
		}
	}
}

export function durationToTimestampStruct(duration: number): TimestampStructBase {
	const hours = Math.floor(duration / 3600);
	const minutes = Math.floor((duration % 3600) / 60);
	const seconds = duration % 60;
	const milliseconds = Math.floor((duration % 1) * 1000);
	return { hours, minutes, seconds, milliseconds };
}

export function formatTimestamp(timestamp: TimestampStruct): string {
	return `${timestamp.totals.hours}:${timestamp.totals.minutes}:${timestamp.totals.seconds}.${timestamp.totals.milliseconds}`;
}

export function formatDuration(duration: number): string {
	// Round to 3 decimal places to avoid floating point precision issues
	const roundedDuration = Math.round(duration * 1000) / 1000;
	const hours = Math.floor(roundedDuration / 3600);
	const minutes = Math.floor((roundedDuration % 3600) / 60);
	const seconds = Math.floor(roundedDuration % 60);

	// Correct millisecond calculation: subtract the integer part of the duration
	const milliseconds = Math.round(Math.round((roundedDuration - Math.floor(roundedDuration)) * 1000));

	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
} 
