import { Component, ViewChild, TemplateRef } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { vkLink } from '../../../client/data';

@Component({
	selector: 'vk-button',
	templateUrl: 'vk-button.pug',
	styleUrls: ['vk-button.scss'],
})
export class VkButton {
	readonly vkLink = vkLink;
	readonly enableVisitVkButton = true;
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
		window.open(this.vkLink, '_blank', 'noopener');
		this.closeLeaveModal();
	}
}
