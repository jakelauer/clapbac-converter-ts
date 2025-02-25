import { exec } from 'child_process';

export const execShellCommand = (cmd: string): Promise<void> => {
	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, stderr) => {
			if (error) {
				console.error(`Error executing: ${cmd}`);
				console.error(stderr);
				reject(error);
				return;
			}
			resolve();
		});
	});
}; 
