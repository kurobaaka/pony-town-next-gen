import {
	Component, Input, ElementRef, AfterViewInit, OnDestroy, NgZone, ViewChild, OnChanges, HostListener
} from '@angular/core';
import { PonyInfo, PonyState, ExpressionExtra, Eye, Muzzle, Iris } from '../../../common/interfaces';
import { toPalette } from '../../../common/ponyInfo';
import { createExpression } from '../../../client/clientUtils';
import { GRASS_COLOR, TRANSPARENT } from '../../../common/colors';
import { parseColorFast } from '../../../common/color';
import {
	createCanvas, disableImageSmoothing, getPixelRatio, resizeCanvas, resizeCanvasWithRatio
} from '../../../client/canvasUtils';
import { BLINK_FRAMES } from '../../../client/ponyUtils';
import { defaultPonyState, defaultDrawPonyOptions } from '../../../client/ponyHelpers';
import { ContextSpriteBatch } from '../../../graphics/contextSpriteBatch';
import { colorToCSS } from '../../../common/color';
import { loadAndInitSpriteSheets } from '../../../client/spriteUtils';
import { drawNamePlate, commonPalettes, DrawNameFlags } from '../../../graphics/graphicsUtils';
import { drawPony } from '../../../client/ponyDraw';
import { paletteSpriteSheet } from '../../../generated/sprites';
import { replaceEmojis } from '../../../client/emoji';

const DEFAULT_STATE = defaultPonyState();
const DEFAULT_OPTIONS = defaultDrawPonyOptions();

@Component({
	selector: 'character-preview',
	template: '<canvas class="rounded" #canvas></canvas>',
	styles: [`:host { display: block; } canvas { width: 100%; height: 100%; }`],
})
export class CharacterPreview implements OnDestroy, OnChanges, AfterViewInit {
	@Input() scale = 3;
	@Input() name?: string;
	@Input() tag?: string;
	@Input() pony?: PonyInfo;
	@Input() state?: PonyState = defaultPonyState();
	@Input() noBackground = false;
	@Input() noOutline = false;
	@Input() noShadow = false;
	@Input() extra = false;
	@Input() passive = false;
	@Input() blinks = true;
	@ViewChild('canvas', { static: true }) canvas!: ElementRef;
	private batch?: ContextSpriteBatch;
	private nameBatch?: ContextSpriteBatch;
	private frame = 0;
	private lastFrame = 0;
	private initialized = false;
	private nextBlink = performance.now() + 2000;
	private blinkFrame = -1;
	constructor(private zone: NgZone) {
	}
	ngAfterViewInit() {
		return loadAndInitSpriteSheets()
			.then(() => this.initialized = true)
			.then(() => this.ngOnChanges());
	}
	ngOnDestroy() {
		cancelAnimationFrame(this.frame);
	}
	ngOnChanges() {
		if (!this.frame) {
			this.zone.runOutsideAngular(() => this.frame = requestAnimationFrame(this.onFrame));
		}
	}
	@HostListener('window:resize')
	redraw() {
		this.tryDraw();
	}
	blink() {
		this.nextBlink = performance.now();
	}
	private onFrame = () => {
		if (this.passive && this.initialized) {
			this.frame = 0;
			this.tryDraw();
			return;
		}

		this.frame = requestAnimationFrame(this.onFrame);

		const now = performance.now();

		if ((now - this.lastFrame) > (1000 / 24)) {
			if (this.blinks) {
				if (this.blinkFrame === -1) {
					if (this.nextBlink < now) {
						this.blinkFrame = 0;
					}
				} else {
					this.blinkFrame++;

					if (this.blinkFrame >= BLINK_FRAMES.length) {
						this.nextBlink = now + Math.random() * 2000 + 3000;
						this.blinkFrame = -1;
					}
				}

				if (this.state) {
					this.state.blinkFrame = this.blinkFrame === -1 ? 1 : BLINK_FRAMES[this.blinkFrame];
				}
			}

			this.lastFrame = now;
			this.tryDraw();
		}
	}
	private tryDraw() {
		try {
			this.draw();
		} catch { }
	}
	private draw() {
		if (!this.initialized)
			return;

		const canvas = this.canvas.nativeElement as HTMLCanvasElement;

		const { width, height } = canvas.getBoundingClientRect();
		resizeCanvasWithRatio(canvas, width, height, false);

		const scale = this.scale * getPixelRatio();
		const bufferWidth = Math.round(canvas.width / scale);
		const bufferHeight = Math.round(canvas.height / scale);

		if (!bufferWidth || !bufferHeight)
			return;

		this.batch = this.batch || new ContextSpriteBatch(createCanvas(bufferWidth, bufferHeight));
		resizeCanvas(this.batch.canvas, bufferWidth, bufferHeight);

		const x = Math.round(bufferWidth / 2);
		const y = Math.round(bufferHeight / 2 + 28);

		// compute preview background (per-pony if set, otherwise CSS var --grass-color or fallback GRASS_COLOR)
		let defaultBg = GRASS_COLOR;
		try {
			const css = getComputedStyle(document.documentElement).getPropertyValue('--grass-color').trim();
			if (css) {
				// parseColorFast accepts formats like '#90ee90' or '90ee90'
				defaultBg = parseColorFast(css);
			}
		} catch (e) { }

		// If canvas background is disabled, try to read the wrapper background so outline can be drawn
		let bg: number;
		if (this.noBackground) {
			try {
				const parent = (this.canvas && this.canvas.nativeElement && this.canvas.nativeElement.parentElement) as HTMLElement | null;
				if (parent) {
					// Safely access computed style and default to transparent if unavailable
					const style = getComputedStyle(parent!);
					const parentBg = (style && style.backgroundColor ? style.backgroundColor : '').trim();
					const parsed = parseColorFast(parentBg);
					bg = parsed || TRANSPARENT;
				} else {
					bg = TRANSPARENT;
				}
			} catch (e) {
				bg = TRANSPARENT;
			}
		} else {
			bg = this.pony && (this.pony as any).previewBackground ? parseColorFast((this.pony as any).previewBackground) : defaultBg;
		}

		if (this.pony) {
			this.batch.start(paletteSpriteSheet, bg);

			try {
				const options = { ...DEFAULT_OPTIONS, shadow: !this.noShadow, extra: !!this.extra };
				// apply preview options from pony info
				options.flipped = !!(this.pony && (this.pony as any).flip);

				// merge preview state with passed state so head turn settings are respected
				const state = { ...(this.state || DEFAULT_STATE),
					headTurn: (this.pony && (this.pony as any).headTurn) || 0,
					headTurned: !!(this.pony && (this.pony as any).headTurned),
				};

				// apply effect flags (blush, zzz, tears, cry, hearts) from pony info to a temporary expression
				const extra =
					((this.pony && (this.pony as any).blush) ? ExpressionExtra.Blush : 0) |
					((this.pony && (this.pony as any).sleeping) ? ExpressionExtra.Zzz : 0) |
					((this.pony && (this.pony as any).tears) ? ExpressionExtra.Tears : 0) |
					((this.pony && (this.pony as any).crying) ? ExpressionExtra.Cry : 0) |
					((this.pony && (this.pony as any).hearts) ? ExpressionExtra.Hearts : 0);

				const finalState = { ...state };
		if (extra) {
			finalState.expression = createExpression(Eye.Neutral, Eye.Neutral, Muzzle.Flat, Iris.Forward, Iris.Forward, extra);
		}

		drawPony(this.batch, toPalette(this.pony), finalState, x, y, options);
		} catch (e) {
			console.error(e);
		}

		this.batch.end();
		}

		const viewContext = canvas.getContext('2d');

		if (!viewContext)
			return;

		disableImageSmoothing(viewContext);

		if (this.noBackground) {
			viewContext.clearRect(0, 0, canvas.width, canvas.height);
		}

		viewContext.save();
		viewContext.scale(scale, scale);

		// draw outline
		if (this.pony && this.noShadow && this.noBackground && !this.noOutline) {
			for (let x = -1; x <= 1; x++) {
				for (let y = -1; y <= 1; y++) {
					viewContext.drawImage(this.batch.canvas, x, y);
				}
			}

			viewContext.globalCompositeOperation = 'source-in';
				viewContext.fillStyle = colorToCSS(bg);
			viewContext.fillRect(0, 0, viewContext.canvas.width, viewContext.canvas.height);
			viewContext.globalCompositeOperation = 'source-over';
		}

		viewContext.drawImage(this.batch.canvas, 0, 0);
		viewContext.restore();

		// draw name plate
		if (!this.noShadow && this.name) {
			const name = replaceEmojis(this.name);
			const scale = 2 * getPixelRatio();
			const nameBufferWidth = Math.round(canvas.width / scale);
			this.nameBatch = this.nameBatch || new ContextSpriteBatch(createCanvas(nameBufferWidth, 25));
			resizeCanvas(this.nameBatch.canvas, nameBufferWidth, 25);
			this.nameBatch.start(paletteSpriteSheet, TRANSPARENT);
			drawNamePlate(this.nameBatch, name, nameBufferWidth / 2, 11, DrawNameFlags.None, commonPalettes, this.tag);
			this.nameBatch.end();
			viewContext.save();
			viewContext.scale(scale, scale);
			viewContext.drawImage(this.nameBatch.canvas, 0, 10);
			viewContext.restore();
		}
	}
}
