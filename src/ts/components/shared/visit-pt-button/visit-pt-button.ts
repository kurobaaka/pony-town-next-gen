import { Component, ViewChild, TemplateRef } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

@Component({
	selector: 'visit-pt-button',
	templateUrl: 'visit-pt-button.pug',
	styleUrls: ['visit-pt-button.scss'],
})
export class VisitPTButton {
	readonly ptLink = 'http://pony.town';
	readonly enableVisitPTButton = true;
	currentModalRef?: BsModalRef;
	@ViewChild('leaveSiteModal', { static: true }) leaveSiteModalTpl!: TemplateRef<any>;
	constructor(private modalService: BsModalService) {
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
