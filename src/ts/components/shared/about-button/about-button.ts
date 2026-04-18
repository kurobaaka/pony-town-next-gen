import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { AboutPony } from '../about-pony/about-pony';

@Component({
	selector: 'about-button',
	templateUrl: 'about-button.pug',
	styleUrls: ['about-button.scss'],
})
export class AboutButton implements OnInit, OnDestroy {
	readonly aboutLink = '/about';
	isNudging = false;
	@ViewChild('pony', { static: true }) ponyComp!: AboutPony;

	private lastInteractionTime = 0;
	private nudgeTimer?: number;
	private nudgeResetTimer?: number;
	private nudgeThreshold = this.randomBetween(15000, 45000);

	ngOnInit() {
		this.lastInteractionTime = Date.now();
		this.scheduleNextNudgeCheck();
	}

	ngOnDestroy() {
		window.clearTimeout(this.nudgeTimer);
		window.clearTimeout(this.nudgeResetTimer);
	}

	onInteract() {
		this.lastInteractionTime = Date.now();
		this.nudgeThreshold = this.randomBetween(15000, 45000);
		this.isNudging = false;
		window.clearTimeout(this.nudgeResetTimer);
	}

	private scheduleNextNudgeCheck() {
		this.nudgeTimer = window.setTimeout(() => {
			if (Date.now() - this.lastInteractionTime > this.nudgeThreshold && !this.isNudging) {
				this.triggerNudge();
				this.nudgeThreshold = this.randomBetween(15000, 45000);
			}
			this.scheduleNextNudgeCheck();
		}, this.randomBetween(3500, 9000));
	}

	private triggerNudge() {
		this.isNudging = true;
		if (this.ponyComp) {
			this.ponyComp.nudge();
		}
		this.nudgeResetTimer = window.setTimeout(() => {
			this.isNudging = false;
			this.lastInteractionTime = Date.now();
		}, this.randomBetween(850, 1300));
	}

	private randomBetween(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}
