import fs from 'fs-extra';

export const parseSubtitleFile = (subtitleFile: string | null): Array<{ start: string; end: string; text: string }> => {
	if (!subtitleFile) return [];
	const subtitles = fs.readFileSync(subtitleFile, 'utf-8');
	const lines = subtitles.split('\n');
	const result = [];
	let currentEntry = { start: '', end: '', text: '' };
	let isReadingText = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) {
			if (currentEntry.start && currentEntry.end) {
				result.push({ ...currentEntry });
				currentEntry = { start: '', end: '', text: '' };
			}
			isReadingText = false;
			continue;
		}

		const timeMatch = line.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
		if (timeMatch) {
			currentEntry.start = timeMatch[1].replace(',', '.');
			currentEntry.end = timeMatch[2].replace(',', '.');
			isReadingText = true;
		} else if (isReadingText) {
			currentEntry.text += (currentEntry.text ? '\n' : '') + line;
		}
	}

	if (currentEntry.start && currentEntry.end) {
		result.push(currentEntry);
	}

	return result;
}; 
