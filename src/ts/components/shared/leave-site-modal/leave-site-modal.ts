import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
	selector: 'leave-site-modal',
	templateUrl: 'leave-site-modal.pug',
	styleUrls: ['leave-site-modal.scss'],
})
export class LeaveSiteModal {
	@Input() title?: string;
	@Input() link?: string;
	@Input() buttonLabel?: string;
	@Output() close = new EventEmitter<void>();
	@Output() confirm = new EventEmitter<void>();

	closeModal() {
		this.close.emit();
	}

	confirmLeave() {
		this.confirm.emit();
	}
}