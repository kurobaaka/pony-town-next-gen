import { Component, Input, Output, EventEmitter } from '@angular/core';
import { BsModalRef } from 'ngx-bootstrap/modal';
import { faTimes, faPlay } from '../../../client/icons';

@Component({
	selector: 'game-character-modal',
	templateUrl: 'game-character.pug',
	styleUrls: ['game-character.scss'],
})
export class GameCharacterModal {
	readonly closeIcon = faTimes;
	readonly playIcon = faPlay;

	@Input() modalRef?: BsModalRef;
	@Output() play = new EventEmitter<void>();

	close() {
		if (this.modalRef) {
			this.modalRef.hide();
		}
	}

	onPlay() {
		this.play.emit();
	}
}
