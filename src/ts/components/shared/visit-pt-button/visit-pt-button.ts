import { Component, ViewChild, TemplateRef, OnInit, OnDestroy } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { faApple } from '../../../client/icons';
import { VisitPTPony } from '../visit-pt-pony/visit-pt-pony';

@Component({
	selector: 'visit-pt-button',
	templateUrl: 'visit-pt-button.pug',
	styleUrls: ['visit-pt-button.scss'],
})
export class VisitPTButton implements OnInit, OnDestroy {
	readonly ptLink = 'http://pony.town';
	readonly enableVisitPTButton = true;
	readonly appleIcon = faApple;
	isNudging = false;
	currentModalRef?: BsModalRef;
	@ViewChild('leaveSiteModal', { static: true }) leaveSiteModalTpl!: TemplateRef<any>;
	@ViewChild('pony', { static: false }) ponyComp!: VisitPTPony;

	private lastInteractionTime = 0;
	private nudgeTimer?: number;
	private nudgeResetTimer?: number;
	private nudgeThreshold = this.randomBetween(15000, 45000);

	constructor(private modalService: BsModalService) {}

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

	openLeaveModal() {
		this.currentModalRef = this.modalService.show(this.leaveSiteModalTpl, { class: 'modal-sm' });
	}

	closeLeaveModal() {
		this.currentModalRef && this.currentModalRef.hide();
		this.currentModalRef = undefined;
	}

	confirmLeave() {
		window.open(this.ptLink, '_blank', 'noopener');
		this.closeLeaveModal();
	}
}
