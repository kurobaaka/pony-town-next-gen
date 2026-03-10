import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PalettePonyInfo } from '../../../common/interfaces';

@Component({
	selector: 'delete-modal',
	templateUrl: 'delete-modal.pug',
	styleUrls: ['delete-modal.scss'],
})
export class DeleteModal {
	@Input() name?: string;
	@Input() pony?: PalettePonyInfo;
	@Output() close = new EventEmitter<void>();
	@Output() confirm = new EventEmitter<void>();
	closeModal() {
		this.close.emit();
	}
	confirmDelete() {
		this.confirm.emit();
	}
}
