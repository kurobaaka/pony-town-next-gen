import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PonyObject } from '../../../common/interfaces';
import { getPonyTag } from '../../services/model';

@Component({
	selector: 'imported-modal',
	templateUrl: 'imported-modal.pug',
	styleUrls: ['imported-modal.scss'],
})
export class ImportedModal {
	@Input() ponies: PonyObject[] = [];
	@Input() account?: any;
	@Output() close = new EventEmitter<void>();
	@Output() keep = new EventEmitter<void>();
	@Output() remove = new EventEmitter<void>();
	
	showAllPreviews = false;

	get shouldShowPreviews(): boolean {
		return this.ponies.length <= 3;
	}

	get displayPonies(): PonyObject[] {
		return this.showAllPreviews ? this.ponies : (this.shouldShowPreviews ? this.ponies : []);
	}

	getPonyTag(pony: PonyObject) {
		return getPonyTag(pony, this.account);
	}

	toggleShowPreviews() {
		this.showAllPreviews = !this.showAllPreviews;
	}

	closeModal() {
		this.close.emit();
	}

	acceptImport() {
		this.keep.emit();
	}

	rejectImport() {
		this.remove.emit();
	}
}
