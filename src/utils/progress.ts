import cliProgress from 'cli-progress';
import { FileLogger } from "./file-logger";

class ProgressManager {
	private multibar: cliProgress.MultiBar;
	private bars: Map<string, cliProgress.SingleBar>;
	private logLines: string[] = [];

	constructor() {
		this.multibar = new cliProgress.MultiBar({
			clearOnComplete: false,
			hideCursor: true,
			format: '{filename} [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}'
		});
		this.bars = new Map();
	}

	createProgressBar(filename: string, total: number): void {
		const bar = this.multibar.create(total, 0, { filename });
		this.bars.set(filename, bar);
	}

	updateProgress(filename: string, current: number): void {
		const bar = this.bars.get(filename);
		if (bar) {
			bar.update(current);
		}
	}

	stop(): void {
		this.multibar.stop();
	}

	log(message: string): void {
		// Store the log message
		this.logLines.push(message);

		FileLogger.log(message);

		// Use process.stdout to write directly, with extra newlines
		process.stdout.write("\n" + message + "\n\n");

		// Just stop to clear the current render state
		// The multibar will automatically redraw on next update
		this.multibar.stop();
	}
}

export const progressManager = new ProgressManager(); 
