import { Command } from 'commander';
import prompts, { PromptObject } from 'prompts';
import fs from 'fs-extra';

const validateDirectory = async (dir: string): Promise<boolean> => {
	try {
		const exists = await fs.pathExists(dir);
		const stats = exists ? await fs.stat(dir) : null;
		return !!(exists && stats?.isDirectory());
	} catch {
		return false;
	}
};

const promptQuestions: PromptObject[] = [
	{
		type: 'text',
		name: 'videoDir',
		message: 'Enter the directory containing video files:',
		validate: validateDirectory
	},
	{
		type: 'text',
		name: 'outputDir',
		message: 'Enter the directory for output files:',
		validate: validateDirectory
	},
	{
		type: 'select',
		name: 'subtitleSource',
		message: 'Choose subtitle source:',
		choices: [
			{ title: 'External SRT files', value: 'external' },
			{ title: 'Embedded in MKV', value: 'embedded' }
		]
	},
	{
		type: 'text',
		name: 'subtitleDir',
		message: 'Enter the directory containing subtitle files:',
		validate: validateDirectory,
		onRender(kleur) {
			// @ts-ignore
			this.visible = this.state.subtitleSource === 'external';
		}
	},
	{
		type: 'select',
		name: 'trackIndex',
		message: 'Choose subtitle track selection method:',
		choices: [
			{ title: 'Auto-detect (first subtitle track)', value: 'auto' },
			{ title: 'Manually specify track number', value: 'manual' }
		],
		onRender(kleur) {
			// @ts-ignore
			this.visible = this.state.subtitleSource === 'embedded';
		}
	},
	{
		type: 'number',
		name: 'trackNumber',
		message: 'Enter subtitle track number:',
		onRender(kleur) {
			// @ts-ignore
			this.visible = this.state.subtitleSource === 'embedded' && this.state.trackIndex === 'manual';
		}
	},
	{
		type: 'number',
		name: 'concurrency',
		message: 'Enter number of concurrent processes:',
		initial: 4
	},
	{
		type: 'number',
		name: 'gapThreshold',
		message: 'Enter gap threshold in milliseconds (0 to disable):',
		initial: 1000
	},
	{
		type: 'number',
		name: 'minSegmentDuration',
		message: 'Enter minimum segment duration in milliseconds (0 to disable):',
		initial: 3000
	},
	{
		type: 'number',
		name: 'maxSegmentDuration',
		message: 'Enter maximum segment duration in milliseconds (0 to disable):',
		initial: 15000
	}
];

interface PromptValues {
	videoDir?: string;
	outputDir?: string;
	subtitleDir?: string;
	subtitleSource?: 'external' | 'embedded';
	concurrency?: number;
	trackIndex?: 'manual' | undefined;
	trackNumber?: number;
	jsonOnly?: boolean;
	jsonPath?: string;
}

export const setupCLI = async () => {
	const program = new Command();
	let commandOptions: any;

	program
		.name('clapbac')
		.description('Video processing tool for subtitle-based clipping');

	// Process videos command
	program
		.command('process', { isDefault: true }) // Make this the default command
		.description('Process videos using subtitles')
		.option('--videoDir <path>', 'Directory containing video files')
		.option('--outputDir <path>', 'Directory for output files')
		.option('--subtitleDir <path>', 'Directory containing subtitle files')
		.option('--concurrency <number>', 'Number of concurrent processes')
		.option('--embedded', 'Use embedded subtitles from MKV files')
		.option('--trackIndex <number>', 'Subtitle track index for MKV files')
		.option('--json-only', 'Only generate JSON analysis file')
		.option('--gap-threshold <number>', 'Gap threshold in milliseconds', '1000')
		.option('--min-segment-duration <number>', 'Minimum segment duration in milliseconds', '3000')
		.option('--max-segment-duration <number>', 'Maximum segment duration in milliseconds', '15000')
		.action(async (options) => {
			// Skip prompts if all required options are provided
			if (options.videoDir && options.outputDir &&
				(options.embedded || options.subtitleDir)) {
				commandOptions = {
					...options,
					concurrency: options.concurrency || 4
				};
				return;
			}

			// Only prompt for missing options
			const questions = promptQuestions.filter(q => {
				if (options.embedded && (q.name === 'subtitleDir' || q.name === 'subtitleSource')) {
					return false;
				}

				return !options[q.name as keyof typeof options];
			});

			const responses = questions.length > 0 ? await prompts(questions, {
				onCancel: () => {
					console.log('Setup cancelled');
					process.exit(1);
				}
			}) : {};

			commandOptions = {
				videoDir: options.videoDir || responses.videoDir,
				outputDir: options.outputDir || responses.outputDir,
				subtitleDir: options.subtitleDir || responses.subtitleDir,
				concurrency: options.concurrency || responses.concurrency || 4,
				embedded: options.embedded || responses.subtitleSource === 'embedded',
				trackIndex: options.trackIndex || (responses.trackIndex === 'manual' ? responses.trackNumber : undefined),
				jsonOnly: options.jsonOnly,
				jsonPath: options.jsonPath,
				gapThreshold: options.gapThreshold || responses.gapThreshold || 1000
			};
		});

	// Process from JSON command
	program
		.command('from-json')
		.description('Process video using existing JSON analysis')
		.requiredOption('--json <path>', 'Path to JSON analysis file')
		.option('--outputDir <path>', 'Directory for output files')
		.option('--concurrency <number>', 'Number of concurrent processes');

	await program.parseAsync(process.argv);
	return { opts: () => commandOptions };
}; 
