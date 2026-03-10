import { Component } from '@angular/core';


@Component({
	selector: 'visit-pt-button',
	templateUrl: 'visit-pt-button.pug',
	styleUrls: ['visit-pt-button.scss'],
})
export class VisitPTButton {
	readonly ptLink = 'http://pony.town';
	readonly enableVisitPTButton = true;
	showLeaveModal = false;
	constructor() {
	}

	openLeaveModal() {
		this.showLeaveModal = true;
	}

	closeLeaveModal() {
		this.showLeaveModal = false;
	}

	confirmLeave() {
		window.open(this.ptLink, '_blank', 'noopener');
		this.closeLeaveModal();
	}
}
