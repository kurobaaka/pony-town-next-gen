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
		if (this.shouldShowPreviews || this.showAllPreviews) {
			return this.ponies;
		}
		return this.ponies.slice(0, 3);
	}

	get hasManyPonies(): boolean {
		return this.ponies.length > 3;
	}

	get previewToggleLabel(): string {
		return this.showAllPreviews ? `Hide additional preview` : `Show all preview (${this.ponies.length})`;
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
