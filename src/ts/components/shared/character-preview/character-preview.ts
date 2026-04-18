import {
	Component, Input, ElementRef, AfterViewInit, OnDestroy, NgZone, ViewChild, OnChanges, HostListener
} from '@angular/core';
import { PonyInfo, PonyState, ExpressionExtra } from '../../../common/interfaces';
import { toPalette } from '../../../common/ponyInfo';
import { GRASS_COLOR, HEARTS_COLOR, MAGIC_ALPHA, TRANSPARENT, WHITE } from '../../../common/colors';
import { parseColorFast, withAlpha } from '../../../common/color';
import {
	createCanvas, disableImageSmoothing, getPixelRatio, resizeCanvas, resizeCanvasWithRatio
} from '../../../client/canvasUtils';
import { BLINK_FRAMES } from '../../../client/ponyUtils';
import { defaultPonyState, defaultDrawPonyOptions } from '../../../client/ponyHelpers';
import { ContextSpriteBatch } from '../../../graphics/contextSpriteBatch';
import { colorToCSS } from '../../../common/color';
import { loadAndInitSpriteSheets } from '../../../client/spriteUtils';
import { drawNamePlate, commonPalettes, DrawNameFlags } from '../../../graphics/graphicsUtils';
import { createHeadTransform, drawPony, getPonyHeadPosition } from '../../../client/ponyDraw';
import {
	createAnimationPlayer, drawAnimation, playAnimation, playOneOfAnimations, updateAnimation,
} from '../../../common/animationPlayer';
import { cryAnimation, heartsAnimation, magicAnimation, tearsAnimation, zzzAnimations } from '../../../client/spriteAnimations';
import * as sprites from '../../../generated/sprites';
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
	@Input() magic = false;
	@Input() passive = false;
	@Input() blinks = true;
	@Input() allowAnyTag = false;
	@Input() namePlateOffsetY = 10;
	@Input() tagOnlyNamePlateOffsetY = -1;
	@Input() namePlateTextY = 11;
	@Input() tagOnlyNamePlateTextY = -2;
	@ViewChild('canvas', { static: true }) canvas!: ElementRef;
	private batch?: ContextSpriteBatch;
	private nameBatch?: ContextSpriteBatch;
	private frame = 0;
	private lastFrame = 0;
	private initialized = false;
	private nextBlink = performance.now() + 2000;
	private blinkFrame = -1;
	private lastEffectsTime = 0;
	private zzzEffect = createAnimationPlayer(commonPalettes.defaultPalette);
	private cryEffect = createAnimationPlayer(commonPalettes.defaultPalette);
	private heartsEffect = createAnimationPlayer(commonPalettes.defaultPalette);
	private magicEffect = createAnimationPlayer(commonPalettes.defaultPalette);
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
			// Force transparent background for batch rendering when noBackground is true
			bg = TRANSPARENT;
		} else {
			bg = this.pony && (this.pony as any).previewBackground ? parseColorFast((this.pony as any).previewBackground) : defaultBg;
		}

		if (this.pony) {
			const sleepingEnabled = !!(this.pony as any).sleeping
				|| !!(this.state && this.state.expression && this.state.expression.extra === ExpressionExtra.Zzz);
			const now = performance.now();
			const delta = this.lastEffectsTime ? (now - this.lastEffectsTime) / 1000 : 0;
			this.lastEffectsTime = now;

			if (sleepingEnabled) {
				playOneOfAnimations(this.zzzEffect, zzzAnimations);
			} else {
				playAnimation(this.zzzEffect, undefined);
			}

			if ((this.pony as any).crying) {
				playAnimation(this.cryEffect, cryAnimation);
			} else if ((this.pony as any).tears) {
				playAnimation(this.cryEffect, tearsAnimation);
			} else {
				playAnimation(this.cryEffect, undefined);
			}

			if ((this.pony as any).hearts) {
				playAnimation(this.heartsEffect, heartsAnimation);
			} else {
				playAnimation(this.heartsEffect, undefined);
			}

			if (this.magic) {
				playAnimation(this.magicEffect, magicAnimation);
			} else {
				playAnimation(this.magicEffect, undefined);
			}

			updateAnimation(this.zzzEffect, delta);
			updateAnimation(this.cryEffect, delta);
			updateAnimation(this.heartsEffect, delta);
			updateAnimation(this.magicEffect, delta);

			// Clear batch canvas if no background is needed
			if (this.noBackground) {
				const batchContext = this.batch.canvas.getContext('2d');
				if (batchContext) {
					batchContext.clearRect(0, 0, this.batch.canvas.width, this.batch.canvas.height);
				}
			}

			const options = { ...DEFAULT_OPTIONS, shadow: !this.noShadow, extra: !!this.extra };

			this.batch.start(sprites.paletteSpriteSheet, bg);

			try {

				// apply preview options from pony info
				options.flipped = !!(this.pony && (this.pony as any).flip);
				// include held toy if set (some ponies may not have toy property)
				if (this.pony && (this.pony as any).toy) {
					options.toy = (this.pony as any).toy;
				}

				// merge preview state with passed state so head turn settings are respected
				const state = this.state || DEFAULT_STATE;
				const finalState = { ...state };
				if (sleepingEnabled) {
					// Keep current expression untouched, but force closed-eye frame for ZZZ only.
					finalState.blinkFrame = 6;
				}

				// draw pony into the offscreen batch (convert full PonyInfo to palette-friendly shape)
				drawPony(this.batch, toPalette(this.pony), finalState, x, y, options);

				const { x: headX, y: headY } = getPonyHeadPosition(finalState, x, y);
				const flip = options.flipped ? !finalState.headTurned : finalState.headTurned;
				const magicColor = withAlpha(parseColorFast((this.pony as any).magicColor || 'ffffff'), MAGIC_ALPHA);

				this.batch.save();
				this.batch.multiplyTransform(createHeadTransform(undefined, headX, headY, finalState));
				drawAnimation(this.batch, this.zzzEffect, 0, 0, WHITE, flip);
				drawAnimation(this.batch, this.cryEffect, 0, 0, WHITE, flip);
				drawAnimation(this.batch, this.heartsEffect, 0, 0, HEARTS_COLOR, flip);
				if (this.magicEffect.currentAnimation !== undefined) {
					drawAnimation(this.batch, this.magicEffect, 0, 0, magicColor, flip);
					const sprite = sprites.magic3.frames[this.magicEffect.frame];
					sprite && this.batch.drawSprite(sprite, WHITE, this.heartsEffect.palette, 0, 0);
				}
				this.batch.restore();
			} finally {
				this.batch.end();
			}

			const viewContext = canvas.getContext('2d');
			if (!viewContext) return;
			disableImageSmoothing(viewContext);

			if (this.noBackground) {
				viewContext.clearRect(0, 0, canvas.width, canvas.height);
			}

			viewContext.save();
			viewContext.scale(scale, scale);

			if (options.flipped) {
				viewContext.save();
				viewContext.scale(-1, 1);
				viewContext.translate(-this.batch.canvas.width, 0);
			}

			// draw outline
			if (this.pony && this.noShadow && this.noBackground && !this.noOutline) {
				for (let ox = -1; ox <= 1; ox++) {
					for (let oy = -1; oy <= 1; oy++) {
						viewContext.drawImage(this.batch.canvas, ox, oy);
					}
				}

				viewContext.globalCompositeOperation = 'source-in';
				viewContext.fillStyle = colorToCSS(bg);
				viewContext.fillRect(0, 0, viewContext.canvas.width, viewContext.canvas.height);
				viewContext.globalCompositeOperation = 'source-over';
			}

			viewContext.drawImage(this.batch.canvas, 0, 0);

			if (options.flipped) {
				viewContext.restore();
			}

			viewContext.restore();

		// draw name plate (supports tag-only rendering when name is hidden)
		if (!this.noShadow && (this.name || this.tag)) {
			const isTagOnly = !this.name && !!this.tag;
			const name = this.name ? replaceEmojis(this.name) : '';
			const plateTextY = isTagOnly ? this.tagOnlyNamePlateTextY : this.namePlateTextY;
			const plateOffsetY = isTagOnly ? this.tagOnlyNamePlateOffsetY : this.namePlateOffsetY;
			const scale = 2 * getPixelRatio();
			const nameBufferWidth = Math.round(canvas.width / scale);
			this.nameBatch = this.nameBatch || new ContextSpriteBatch(createCanvas(nameBufferWidth, 25));
			resizeCanvas(this.nameBatch.canvas, nameBufferWidth, 25);
			this.nameBatch.start(sprites.paletteSpriteSheet, TRANSPARENT);
			drawNamePlate(this.nameBatch, name, nameBufferWidth / 2, plateTextY, DrawNameFlags.None, commonPalettes, this.tag, this.allowAnyTag);
			this.nameBatch.end();
			viewContext.save();
			viewContext.scale(scale, scale);
			viewContext.drawImage(this.nameBatch.canvas, 0, plateOffsetY);
			viewContext.restore();
		}
		}
	}
}