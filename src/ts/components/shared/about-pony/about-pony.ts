import { Component, OnInit, OnDestroy, Input, ViewChild } from '@angular/core';
import { defaultExpression } from '../../../client/ponyUtils';
import { defaultPonyState } from '../../../client/ponyHelpers';
import { OFFLINE_PONY } from '../../../common/constants';
import { Expression, Muzzle, HeadAnimation, BodyAnimation, Iris, Eye, ExpressionExtra } from '../../../common/interfaces';
import { yawn, boop, stand } from '../../../client/ponyAnimations';
import { FrameService, FrameLoop } from '../../services/frameService';
import { CharacterPreview } from '../character-preview/character-preview';
import { decompressPonyString } from '../../../common/compressPony';

const BLEP: Expression = {
	...defaultExpression,
	left: Eye.Closed,
	right: Eye.Closed,
	muzzle: Muzzle.Blep,
};

const YAWNED: Expression = {
	...defaultExpression,
	left: Eye.Closed,
	right: Eye.Closed,
	muzzle: Muzzle.SmileOpen,
};

const DERP: Expression = {
	...defaultExpression,
	left: Eye.Closed,
	right: Eye.Neutral3,
	muzzle: Muzzle.Smile,
	leftIris: Iris.Up,
};

const SLEEP: Expression = {
	...defaultExpression,
	left: Eye.Closed,
	right: Eye.Closed,
	leftIris: Iris.Forward,
	rightIris: Iris.Forward,
	muzzle: Muzzle.Neutral,
	extra: ExpressionExtra.Zzz,
};

const EXCITED: Expression = {
	...defaultExpression,
	left: Eye.Neutral2,
	right: Eye.Neutral2,
	muzzle: Muzzle.SmileOpen,
};

@Component({
	selector: 'about-pony',
	templateUrl: 'about-pony.pug',
})
export class AboutPony implements OnInit, OnDestroy {
	@ViewChild('characterPreview', { static: true }) characterPreview!: CharacterPreview;
	@Input() scale = 3;
	pony = decompressPonyString(OFFLINE_PONY);
	state = defaultPonyState();
	private expression?: Expression;
	private headAnimation?: HeadAnimation;
	private headTime = 0;
	private bodyAnimation?: BodyAnimation;
	private bodyTime = 0;
	private lastInteractionTime = 0;
	private isSleeping = false;
	private sleepThreshold = this.randomBetween(70000, 140000);
	private sleepDuration = this.randomBetween(10000, 50000);
	private sleepUntil = 0;
	private nudgesSinceInteraction = 0;
	private requiredNudgesBeforeSleep = this.randomBetween(2, 3);
	private lastYawnTime = 0;
	private loop: FrameLoop;

	constructor(frameService: FrameService) {
		this.loop = frameService.create(delta => this.tick(delta));
	}

	ngOnInit() {
		this.loop.init();
		this.registerInteraction(Date.now());
	}

	ngOnDestroy() {
		this.loop.destroy();
	}

	yawn() {
		this.headTime = 0;
		this.registerInteraction(Date.now());
		this.headAnimation = yawn;
		this.expression = Math.random() < 0.2 ? DERP : YAWNED;
	}

	nudge() {
		this.headTime = 0;
		this.bodyTime = 0;
		this.nudgesSinceInteraction++;
		if (this.isSleeping) {
			this.exitSleep();
		}
		this.expression = EXCITED;
		this.headAnimation = yawn;
		this.bodyAnimation = boop;
	}

	reset() {
		this.registerInteraction(Date.now());
		if (!this.isSleeping) {
			this.expression = undefined;
		}
	}

	private tick(delta: number) {
		this.headTime += delta;
		this.bodyTime += delta;
		const now = Date.now();

		if (this.isSleeping && now >= this.sleepUntil) {
			this.exitSleep();
			this.registerInteraction(now);
			this.headTime = 0;
			this.headAnimation = yawn;
			this.expression = YAWNED;
			this.bodyAnimation = stand;
		}

		const idle = now - this.lastInteractionTime;

		const hasEnoughNudges = this.nudgesSinceInteraction >= this.requiredNudgesBeforeSleep;
		const forceSleep = idle > (this.sleepThreshold + 60000);

		if (!this.isSleeping
			&& idle > this.sleepThreshold
			&& (hasEnoughNudges || forceSleep)) {
			this.enterSleep(now);
		}

		if (!this.isSleeping && !this.headAnimation && idle > 5000 && idle < 28000) {
			const timeSinceYawn = Date.now() - this.lastYawnTime;
			if (timeSinceYawn > 10000 && Math.random() < 0.003) {
				this.lastYawnTime = Date.now();
				this.headTime = 0;
				this.headAnimation = yawn;
				this.expression = YAWNED;
			}
		}

		if (this.headAnimation) {
			const frame = Math.floor(this.headTime * this.headAnimation.fps);

			if (frame >= this.headAnimation.frames.length && !this.headAnimation.loop) {
				this.headAnimation = undefined;
				this.state.headAnimation = undefined;
				this.state.headAnimationFrame = 0;
				this.characterPreview.blink();
			} else {
				this.state.headAnimation = this.headAnimation;
				this.state.headAnimationFrame = frame % this.headAnimation.frames.length;
			}
		} else {
			this.state.headAnimation = undefined;

			if (!this.isSleeping) {
				if (this.expression) {
					if (Math.random() < 0.01) {
						this.expression = undefined;
					}
				} else if (Math.random() < 0.005) {
					this.expression = BLEP;
				}
			}
		}

		if (this.bodyAnimation) {
			const frame = Math.floor(this.bodyTime * this.bodyAnimation.fps * 0.75);

			if (frame >= this.bodyAnimation.frames.length && !this.bodyAnimation.loop) {
				this.bodyAnimation = undefined;
				this.state.animation = stand;
				this.state.animationFrame = 0;
			} else {
				this.state.animation = this.bodyAnimation;
				this.state.animationFrame = frame % this.bodyAnimation.frames.length;
			}
		}

		this.state.expression = this.expression;
	}

	private enterSleep(now: number) {
		this.isSleeping = true;
		this.sleepUntil = now + this.sleepDuration;
		this.expression = SLEEP;
		this.headAnimation = undefined;
		this.bodyAnimation = undefined;
	}

	private exitSleep() {
		this.isSleeping = false;
		this.sleepUntil = 0;
	}

	private registerInteraction(now: number) {
		this.lastInteractionTime = now;
		this.nudgesSinceInteraction = 0;
		this.requiredNudgesBeforeSleep = this.randomBetween(2, 3);
		this.sleepThreshold = this.randomBetween(70000, 140000);
		this.sleepDuration = this.randomBetween(10000, 50000);
	}

	private randomBetween(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}

