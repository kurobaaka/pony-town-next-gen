import { Router } from 'express';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { randomString } from '../../common/stringUtils';
import { offline as createOffline, handleJSON, auth } from '../requestUtils';
import * as paths from '../paths';
import { findAllCharacters, IAccount } from '../db';
import { createGetAccountCharacters } from '../api/account';
import { Settings, ServerConfig } from '../../common/adminInterfaces';
import { World } from '../world';
import { ToolsMapInfo } from '../../components/tools/tools-map/tools-map';
import { flatten } from '../../common/utils';
import { serializeMap } from '../serverMap';

export default function (server: ServerConfig, settings: Settings, world: World | undefined) {
	const offline = createOffline(settings);
	const app = Router();

	app.use(auth);

	app.get('/ponies', offline, (req, res) => {
		handleJSON(server, req, res, createGetAccountCharacters(findAllCharacters)(req.user as IAccount));
	});

	app.get('/animation/:id', offline, (req, res) => {
		const filePath = path.join(paths.store, req.params.id);

		res.sendFile(filePath);
	});

	app.post('/animation', offline, (req, res) => {
		const name = randomString(10);
		const filePath = path.join(paths.store, name);

		fs.writeFileAsync(filePath, req.body.animation, 'utf8')
			.then(() => res.send({ name }));
	});

	app.post('/animation-gif', offline, (req, res) => {
		const image: string = req.body.image;
		const width: number = req.body.width || 80;
		const height: number = req.body.height || 80;
		const fps: number = req.body.fps || 24;
		const cols: number = req.body.cols || 1;
		const frames: number = req.body.frames || 1;

		const name = randomString(10);
		const filePath = path.join(paths.store, name + '.png');
		const commaIndex = image.indexOf(',');
		const buffer = Buffer.from(commaIndex >= 0 ? image.substr(commaIndex + 1) : image, 'base64');
		const gifPath = filePath.replace(/\.png$/, '.gif');

		fs.writeFileAsync(filePath, buffer)
			.then(() => exportGif(filePath, gifPath, width, height, fps, cols, frames))
			.then(() => res.send({ name }))
			.catch(error => {
				console.error('animation-gif failed', error);
				res.status(500).send({ error: String(error) });
			});
	});

	app.post('/animation-mp4', offline, (req, res) => {
		const image: string = req.body.image;
		const width: number = req.body.width || 80;
		const height: number = req.body.height || 80;
		const fps: number = req.body.fps || 24;
		const cols: number = req.body.cols || 1;
		const frames: number = req.body.frames || 1;

		const name = randomString(10);
		const filePath = path.join(paths.store, name + '.png');
		const commaIndex = image.indexOf(',');
		const buffer = Buffer.from(commaIndex >= 0 ? image.substr(commaIndex + 1) : image, 'base64');
		const mp4Path = filePath.replace(/\.png$/, '.mp4');

		fs.writeFileAsync(filePath, buffer)
			.then(() => exportMp4(filePath, mp4Path, width, height, fps, cols, frames))
			.then(() => res.send({ name }))
			.catch(error => {
				console.error('animation-mp4 failed', error);
				res.status(500).send({ error: String(error) });
			});
	});

	app.get('/maps', offline, (_, res) => {
		if (world) {
			res.json(world.maps.map(m => m.id));
		} else {
			res.sendStatus(400);
		}
	});

	app.get('/map', offline, (req, res) => {
		if (world) {
			const id = req.query.map || '';
			const map = world.maps.find(m => m.id === id);

			if (map) {
				const mapInfo: ToolsMapInfo = {
					...serializeMap(map),
					defaultTile: map.defaultTile,
					type: map.type,
					info: {
						season: world.season,
						entities: flatten(map.regions.map(r => r.entities))
							.map(({ type, x, y, order, id }) => ({ type, x, y, order, id })),
					},
				};

				res.json(mapInfo);
				return;
			}
		}

		res.sendStatus(400);
	});

	return app;
}
function exportGif(filePath: string, gifPath: string, width: number, height: number, fps: number, cols: number, frames: number) {
	const ffmpegArgs = [
		'-y',
		'-loop', '1',
		'-i', filePath,
		'-filter_complex', createGifFilter(width, height, fps, cols),
		'-frames:v', String(frames),
		gifPath,
	];
	const attempts = createExecutableCandidates(process.env.FFMPEG_PATH, 'ffmpeg', ffmpegArgs, 'ffmpeg');
	const magickArgs = createMagickGifArgs(filePath, gifPath, width, height, fps, frames, cols);
	attempts.push(...createExecutableCandidates(process.env.MAGICK_PATH, 'magick', magickArgs, 'magick'));
	return runCommandAttempts(attempts, 'GIF export requires ffmpeg or ImageMagick (magick) in PATH, or FFMPEG_PATH/MAGICK_PATH to be set.');
}

function exportMp4(filePath: string, mp4Path: string, width: number, height: number, fps: number, cols: number, frames: number) {
	const ffmpegArgs = [
		'-y',
		'-loop', '1',
		'-i', filePath,
		'-vf', createMp4Filter(width, height, fps, cols),
		'-frames:v', String(frames),
		'-movflags', '+faststart',
		'-pix_fmt', 'yuv420p',
		'-c:v', 'libx264',
		mp4Path,
	];
	const attempts = createExecutableCandidates(process.env.FFMPEG_PATH, 'ffmpeg', ffmpegArgs, 'ffmpeg');
	return runCommandAttempts(attempts, 'MP4 export requires ffmpeg in PATH or FFMPEG_PATH to be set.');
}

function createExecutableCandidates(configuredPath: string | undefined, fallbackCommand: string, args: string[], label: string) {
	const commands = uniqueDefined([configuredPath, fallbackCommand]);
	return commands.map(file => ({ file, args, label }));
}

function createMagickGifArgs(filePath: string, gifPath: string, width: number, height: number, fps: number, frames: number, cols: number) {
	const args = [
		filePath,
		'-dispose', 'Background',
		'-delay', String(100 / fps),
		'-loop', '0',
		'-crop', `${width}x${height}`,
		'+repage',
	];

	const totalFrames = cols * Math.ceil(frames / cols);

	if (frames < totalFrames) {
		args.push('-delete', `${frames}--1`);
	}

	args.push(gifPath);
	return args;
}

function runCommandAttempts(attempts: CommandAttempt[], missingMessage: string) {
	if (!attempts.length) {
		return Promise.reject(new Error(missingMessage));
	}

	const errors: string[] = [];

	const runAttempt = (index: number): Promise<{ stdout: string; stderr: string; }> => {
		if (index >= attempts.length) {
			return Promise.reject(new Error(errors.length ? errors.join('\n\n') : missingMessage));
		}

		const attempt = attempts[index];
		console.log('executing', attempt.file, attempt.args.join(' '));

		return execFileAsync(attempt.file, attempt.args)
			.catch(error => {
				errors.push(`${attempt.label}: ${getExecErrorMessage(error)}`);
				return runAttempt(index + 1);
			});
	};

	return runAttempt(0);
}

function createGifFilter(width: number, height: number, fps: number, cols: number) {
	const crop = createCropFilter(width, height, fps, cols);
	return `${crop},split[a][b];[a]palettegen=reserve_transparent=on[p];[b][p]paletteuse`;
}

function createMp4Filter(width: number, height: number, fps: number, cols: number) {
	const crop = createCropFilter(width, height, fps, cols);
	return `${crop},scale=trunc(iw/2)*2:trunc(ih/2)*2`;
}

function createCropFilter(width: number, height: number, fps: number, cols: number) {
	return `fps=${fps},crop=${width}:${height}:mod(n\\,${cols})*${width}:floor(n/${cols})*${height}`;
}

function uniqueDefined(values: Array<string | undefined>) {
	const filtered = values.filter((value): value is string => !!value);
	return filtered.filter((value, index) => filtered.indexOf(value) === index);
}

function getExecErrorMessage(error: any) {
	return error && error.message ? error.message : String(error);
}

function execFileAsync(file: string, args: string[]) {
	return new Promise<{ stdout: string; stderr: string; }>((resolve, reject) => {
		execFile(file, args, (error, stdout, stderr) => {
			if (error) {
				const details = stderr || stdout || error.message;
				const result = new Error(details);
				(result as any).code = (error as any).code;
				reject(result);
			} else {
				resolve({ stdout, stderr });
			}
		});
	});
}

interface CommandAttempt {
	file: string;
	args: string[];
	label: string;
}
