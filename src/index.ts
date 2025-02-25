import { setupCLI } from './cli.js';
import { processVideos } from "./services/processVideos.js";

if (process.env.NODE_ENV !== 'test') {
	(async () => {
		try {
			const program = await setupCLI();
			const options = program.opts();

			await processVideos({
				videoDir: options.videoDir,
				subtitleDir: options.subtitleDir,
				outputDir: options.outputDir,
				concurrency: parseInt(options.concurrency, 10),
				embedded: options.embedded,
				trackIndex: options.trackIndex ? parseInt(options.trackIndex, 10) : undefined,
				jsonOnly: options.jsonOnly,
				jsonPath: options.jsonPath,
				gapThreshold: parseInt(options.gapThreshold, 10),
				minSegmentDuration: parseInt(options.minSegmentDuration, 10),
				maxSegmentDuration: parseInt(options.maxSegmentDuration, 10)
			});
		} catch (error) {
			console.error('An error occurred:', error);
			process.exit(1);
		}
	})();
} 
