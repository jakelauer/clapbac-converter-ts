import fs from 'fs-extra';
import path from 'path';

export const markVideoComplete = async (videoName: string, outputDir: string): Promise<void> => {
	const markerPath = path.join(outputDir, videoName, '.complete');
	await fs.writeFile(markerPath, new Date().toISOString());
};

export const isVideoComplete = async (videoName: string, outputDir: string): Promise<boolean> => {
	const markerPath = path.join(outputDir, videoName, '.complete');
	return await fs.pathExists(markerPath);
}; 
