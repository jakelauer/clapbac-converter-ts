import fs from "fs-extra";
import path from "path";

type PossibleParameters = Parameters<typeof console.log> | Parameters<typeof console.error> | Parameters<typeof console.warn> | Parameters<typeof console.debug> | Parameters<typeof console.info> | Parameters<typeof console.trace>;

export class FileLogger {
	public static readonly logFile = path.join(process.cwd(), 'file-logger.log');

	private static writeToFile(type: string, ...params: PossibleParameters) {
		fs.appendFileSync(this.logFile, `${new Date().toISOString()} [${type}] ${params.join(' ')}\n`);
	}

	public static log(...params: PossibleParameters) {
		this.writeToFile('log', ...params);
	}

	public static error(...params: PossibleParameters) {
		this.writeToFile('error', ...params);
	}

	public static warn(...params: PossibleParameters) {
		this.writeToFile('warn', ...params);
	}

	public static debug(...params: PossibleParameters) {
		this.writeToFile('debug', ...params);
	}

	public static info(...params: PossibleParameters) {
		this.writeToFile('info', ...params);
	}

	public static trace(...params: PossibleParameters) {
		this.writeToFile('trace', ...params);
	}
}

fs.writeFileSync(FileLogger.logFile, '');
