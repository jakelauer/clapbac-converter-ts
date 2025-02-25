import { configDefaults, defineConfig } from "vitest/config";

const maxWorkersArg = process.argv.find((arg) => arg.includes("--maxWorkers"))?.split("=")[1];
const maxWorkersInt = maxWorkersArg ? parseInt(maxWorkersArg) : undefined;

export default defineConfig({
	test: {
		poolOptions: maxWorkersInt ? {
			threads: {
				maxThreads: maxWorkersInt,
				minThreads: maxWorkersInt,
			},
		} : undefined,
		include: [...configDefaults.include, "**/tests/*.ts"],
		passWithNoTests: true,
		testTimeout: 10_000,
		disableConsoleIntercept: true,
		silent: false,
		printConsoleTrace: true,
	},
});
