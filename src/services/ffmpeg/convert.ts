// convert.ts
import { GifGenerator } from './to-gif';
import { Mp4Generator } from './to-mp4';

type GeneratorParams<TGenerator extends abstract new (...args: any) => any> = ConstructorParameters<TGenerator>[0];

export class Convert {
	static async toGif(options: GeneratorParams<typeof GifGenerator>): Promise<void> {
		const gifGenerator = new GifGenerator(options);
		await gifGenerator.generate();
	}

	static async toMp4(options: GeneratorParams<typeof Mp4Generator>): Promise<void> {
		const mp4Generator = new Mp4Generator(options);
		await mp4Generator.generate();
	}
}
