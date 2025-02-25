import { describe, it, expect, vi } from 'vitest';
import { execShellCommand } from '../shell';
import { exec, ExecException } from 'child_process';

vi.mock('child_process');

describe('execShellCommand', () => {
	it('should execute command successfully', async () => {
		vi.mocked(exec).mockImplementation((cmd: string, options: any, callback: any) => {
			if (typeof options === 'function') {
				options(null, 'success', '');  // options is actually the callback
			} else if (callback) {
				callback(null, 'success', '');
			}
			return {} as any;
		});

		await expect(execShellCommand('test command')).resolves.not.toThrow();
	});

	it('should reject on command error', async () => {
		const mockError = new Error('Command failed') as ExecException;
		vi.mocked(exec).mockImplementation((cmd: string, options: any, callback: any) => {
			if (typeof options === 'function') {
				options(mockError, '', 'error output');  // options is actually the callback
			} else if (callback) {
				callback(mockError, '', 'error output');
			}
			return {} as any;
		});

		await expect(execShellCommand('test command')).rejects.toThrow('Command failed');
	});
});
