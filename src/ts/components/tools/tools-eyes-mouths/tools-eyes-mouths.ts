import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { PonyInfo, PonyState, Eye, Muzzle, Iris } from '../../../common/interfaces';
import { toPalette, createDefaultPony } from '../../../common/ponyInfo';
import { defaultPonyState, defaultDrawPonyOptions } from '../../../client/ponyHelpers';
import { createCanvas, disableImageSmoothing, saveCanvas } from '../../../client/canvasUtils';
import { ContextSpriteBatch } from '../../../graphics/contextSpriteBatch';
import { RED } from '../../../common/colors';
import { loadAndInitSpriteSheets } from '../../../client/spriteUtils';
import { createBodyAnimation } from '../../../client/ponyAnimations';
import { drawPony } from '../../../client/ponyDraw';
import { faHome } from '../../../client/icons';
import { paletteSpriteSheet } from '../../../generated/sprites';

const ALL_EYES: { name: string; value: Eye }[] = [
	{ name: 'None',         value: Eye.None },
	{ name: 'Neutral',      value: Eye.Neutral },
	{ name: 'Neutral2',     value: Eye.Neutral2 },
	{ name: 'Neutral3',     value: Eye.Neutral3 },
	{ name: 'Neutral4',     value: Eye.Neutral4 },
	{ name: 'Neutral5',     value: Eye.Neutral5 },
	{ name: 'Closed',       value: Eye.Closed },
	{ name: 'Frown',        value: Eye.Frown },
	{ name: 'Frown2',       value: Eye.Frown2 },
	{ name: 'Frown3',       value: Eye.Frown3 },
	{ name: 'Frown4',       value: Eye.Frown4 },
	{ name: 'Lines',        value: Eye.Lines },
	{ name: 'ClsdHpy3',     value: Eye.ClosedHappy3 },
	{ name: 'ClsdHpy2',     value: Eye.ClosedHappy2 },
	{ name: 'ClsdHpy',      value: Eye.ClosedHappy },
	{ name: 'Sad',          value: Eye.Sad },
	{ name: 'Sad2',         value: Eye.Sad2 },
	{ name: 'Sad3',         value: Eye.Sad3 },
	{ name: 'Sad4',         value: Eye.Sad4 },
	{ name: 'Angry',        value: Eye.Angry },
	{ name: 'Angry2',       value: Eye.Angry2 },
	{ name: 'Peaceful',     value: Eye.Peaceful },
	{ name: 'Peaceful2',    value: Eye.Peaceful2 },
	{ name: 'X',            value: Eye.X },
	{ name: 'X2',           value: Eye.X2 },
];

const ALL_MOUTHS: { name: string; value: Muzzle }[] = [
	{ name: 'Smile',        value: Muzzle.Smile },
	{ name: 'Frown',        value: Muzzle.Frown },
	{ name: 'Neutral',      value: Muzzle.Neutral },
	{ name: 'Scrunch',      value: Muzzle.Scrunch },
	{ name: 'Blep',         value: Muzzle.Blep },
	{ name: 'SmileOpen',    value: Muzzle.SmileOpen },
	{ name: 'Flat',         value: Muzzle.Flat },
	{ name: 'Concerned',    value: Muzzle.Concerned },
	{ name: 'ConcernOpen',  value: Muzzle.ConcernedOpen },
	{ name: 'SmileOpen2',   value: Muzzle.SmileOpen2 },
	{ name: 'FrownOpen',    value: Muzzle.FrownOpen },
	{ name: 'NeutralOpn2',  value: Muzzle.NeutralOpen2 },
	{ name: 'ConcernOpn2',  value: Muzzle.ConcernedOpen2 },
	{ name: 'Kiss',         value: Muzzle.Kiss },
	{ name: 'SmileOpen3',   value: Muzzle.SmileOpen3 },
	{ name: 'NeutralOpn3',  value: Muzzle.NeutralOpen3 },
	{ name: 'ConcernOpn3',  value: Muzzle.ConcernedOpen3 },
	{ name: 'Kiss2',        value: Muzzle.Kiss2 },
	{ name: 'SmileTeeth',   value: Muzzle.SmileTeeth },
	{ name: 'FrownTeeth',   value: Muzzle.FrownTeeth },
	{ name: 'NeutralTeeth', value: Muzzle.NeutralTeeth },
	{ name: 'ConcernTeeth', value: Muzzle.ConcernedTeeth },
	{ name: 'SmilePant',    value: Muzzle.SmilePant },
	{ name: 'NeutralPant',  value: Muzzle.NeutralPant },
	{ name: 'Oh',           value: Muzzle.Oh },
	{ name: 'FlatBlep',     value: Muzzle.FlatBlep },
];

@Component({
	selector: 'tools-eyes-mouths',
	templateUrl: 'tools-eyes-mouths.pug',
})
export class ToolsEyesMouths implements OnInit {
	readonly homeIcon = faHome;
	scale = 2;
	columns = 13;
	@ViewChild('canvasEyes', { static: true }) canvasEyes!: ElementRef;
	@ViewChild('canvasMouths', { static: true }) canvasMouths!: ElementRef;

	ngOnInit() {
		loadAndInitSpriteSheets()
			.then(() => this.redraw());
	}

	redraw() {
		this.draw();
	}

	png() {
		this.draw();
		saveCanvas(this.canvasEyes.nativeElement, 'eyes.png');
		saveCanvas(this.canvasMouths.nativeElement, 'mouths.png');
	}

	private draw() {
		const pony = createPony();
		const state = createState();
		const info = toPalette(pony);
		drawEyes(this.canvasEyes.nativeElement, this.scale, this.columns, info, state);
		drawMouths(this.canvasMouths.nativeElement, this.scale, this.columns, info, state);
	}
}

// ─── shared helpers ───────────────────────────────────────────────────────────

function createState(): PonyState {
	const state = defaultPonyState();
	state.blushColor = RED;
	state.animation = createBodyAnimation('', 24, false, [[0, 1]]);
	return state;
}

function createPony(): PonyInfo {
	const pony = createDefaultPony();
	pony.mane!.type = 0;
	pony.backMane!.type = 0;
	pony.tail!.type = 0;
	pony.wings!.type = 0;
	pony.horn!.type = 0;
	pony.frontHooves!.type = 0;
	pony.backHooves!.type = 0;
	return pony;
}

function makeSheet(
	canvas: HTMLCanvasElement,
	scale: number,
	columns: number,
	items: { name: string }[],
	drawCell: (state: PonyState, item: any) => void,
	state: PonyState,
	info: any,
	sectionLabel: string,
): void {
	const frameWidth = 55;
	const frameOffset = 50;
	const frameHeight = 30;
	const labelRowH = 10;

	const buffer = createCanvas(frameWidth, frameHeight);
	const batch = new ContextSpriteBatch(buffer);
	const options = defaultDrawPonyOptions();

	const rows = Math.ceil(items.length / columns);

	canvas.width  = ((frameOffset * (columns - 1)) + frameWidth) * scale;
	canvas.height = (labelRowH + frameHeight * rows) * scale;

	const ctx = canvas.getContext('2d')!;
	ctx.save();
	disableImageSmoothing(ctx);
	ctx.scale(scale, scale);

	ctx.fillStyle = 'lightgreen';
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.font = 'bold 7px monospace';
	ctx.textAlign = 'left';
	ctx.fillStyle = '#333';
	ctx.fillText(sectionLabel, 2, 8);

	ctx.font = 'normal 6px monospace';
	ctx.textAlign = 'right';
	ctx.fillStyle = 'black';

	items.forEach((item, i) => {
		drawCell(state, item);

		batch.start(paletteSpriteSheet, 0);
		drawPony(batch, info, state, 35, 50, options);
		batch.end();

		const x = (i % columns) * frameOffset;
		const y = labelRowH + Math.floor(i / columns) * frameHeight;

		ctx.drawImage(buffer, x, y);
		ctx.fillText(item.name, x + 20, y + 20);
	});

	ctx.restore();
}

// ─── eyes sheet ───────────────────────────────────────────────────────────────

function drawEyes(
	canvas: HTMLCanvasElement,
	scale: number,
	columns: number,
	info: any,
	state: PonyState,
): void {
	makeSheet(
		canvas, scale, columns,
		ALL_EYES,
		(s, item) => {
			s.expression = {
				left: item.value,
				right: item.value,
				muzzle: Muzzle.Neutral,
				leftIris: Iris.Forward,
				rightIris: Iris.Forward,
				extra: 0,
			};
		},
		state, info,
		'EYES',
	);
}

// ─── mouths sheet ─────────────────────────────────────────────────────────────

function drawMouths(
	canvas: HTMLCanvasElement,
	scale: number,
	columns: number,
	info: any,
	state: PonyState,
): void {
	makeSheet(
		canvas, scale, columns,
		ALL_MOUTHS,
		(s, item) => {
			s.expression = {
				left: Eye.Neutral,
				right: Eye.Neutral,
				muzzle: item.value,
				leftIris: Iris.Forward,
				rightIris: Iris.Forward,
				extra: 0,
			};
		},
		state, info,
		'MOUTHS',
	);
}
