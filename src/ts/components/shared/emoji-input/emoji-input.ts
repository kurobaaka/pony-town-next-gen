import { Component, Input, Output, EventEmitter, ViewChild, ElementRef } from '@angular/core';

@Component({
	selector: 'emoji-input',
	templateUrl: 'emoji-input.pug',
	styleUrls: ['emoji-input.scss'],
})
export class EmojiInputComponent {
	@Input() placeholder = '';
	@Input() ariaLabel = '';
	@Input() maxlength: number | null = null;
	@Output() valueChange = new EventEmitter<string>();
	@Output() emojiSelected = new EventEmitter<string>();
	@ViewChild('inputElement', { static: false }) inputElement?: ElementRef;

	value = '';
	showEmojiPicker = false;

	onInputChange(newValue: string) {
		this.value = newValue;
		this.valueChange.emit(newValue);
	}

	toggleEmojiPicker() {
		this.showEmojiPicker = !this.showEmojiPicker;
	}

	onEmojiSelected(emoji: string) {
		// Insert emoji at cursor position or append
		if (!this.value) {
			this.value = emoji;
		} else if (!this.maxlength || this.value.length < this.maxlength) {
			this.value += emoji;
		}

		this.valueChange.emit(this.value);
		this.emojiSelected.emit(emoji);
		this.showEmojiPicker = false;
	}

	get input(): HTMLInputElement | undefined {
		return this.inputElement ? (this.inputElement.nativeElement as HTMLInputElement) : undefined;
	}
}
