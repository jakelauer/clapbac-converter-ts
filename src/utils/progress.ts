import cliProgress from 'cli-progress';

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

		// Clear the progress bar line if it exists
		if (this.bars.size > 0) {
			process.stdout.write('\x1B[1A\x1B[2K');
		}

		// Print the message
		console.log(message);

		// Redraw any active progress bars
		this.bars.forEach(bar => {
			bar.render();
		});
	}
}

export const progressManager = new ProgressManager(); 
