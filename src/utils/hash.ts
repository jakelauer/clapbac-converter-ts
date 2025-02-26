import crypto from 'node:crypto';

/**
 * Creates an MD5 hash from a string input
 * @param input The string to hash
 * @returns The hexadecimal MD5 hash
 */
export function createMD5Hash(input: string): string {
	return crypto.createHash('md5')
		.update(input)
		.digest('hex');
}

/**
 * Extracts the filename without extension from a file path
 * @param filePath The full file path
 * @returns The filename without extension
 */
export function getFilenameWithoutExtension(filePath: string): string {
	const pathParts = filePath.split('/');
	const filenameWithExtension = pathParts.pop() || '';
	return filenameWithExtension.split('.').slice(0, -1).join('.');
}

/**
 * Creates an MD5 hash from a filename (without its extension)
 * @param filePath The full file path
 * @returns The hexadecimal MD5 hash of the filename without extension
 */
export function createFilenameHash(filePath: string): string {
	const filenameNoExtension = getFilenameWithoutExtension(filePath);
	if (!filenameNoExtension) {
		throw new Error('Input filename failed to parse');
	}
	return createMD5Hash(filenameNoExtension);
} 
