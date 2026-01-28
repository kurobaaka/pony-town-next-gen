import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, HostListener } from '@angular/core';
import { emojis, Emoji } from '../../../client/emoji';

interface EmojiCategory {
	name: string;
	emotes: Emoji[];
}

@Component({
	selector: 'emoji-picker',
	templateUrl: 'emoji-picker.pug',
	styleUrls: ['emoji-picker.scss'],
})
export class EmojiPickerComponent implements AfterViewInit {
	@Input() display = false;
	@Output() emojiSelected = new EventEmitter<string>();
	@Output() closed = new EventEmitter<void>();
	@ViewChild('scrollContainer', { static: false }) scrollContainer?: ElementRef;
	constructor(private el: ElementRef) {}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent) {
		if (!this.display) return;
		const target = event.target as HTMLElement;
		if (!target) return;
		// Click inside picker — ignore
		if (this.el.nativeElement.contains(target)) return;
		// Click on emoji buttons that toggle the picker — ignore to avoid immediate close
		if (target.closest && target.closest('.character-emoji-button, .chat-emoji-button')) return;
		// Otherwise, close the picker
		this.closed.emit();
	}

	categories: EmojiCategory[] = [];
	filteredCategories: EmojiCategory[] = [];
	searchQuery = '';
	allEmotes = emojis;

	private categoryMap: { name: string; symbols: string[] }[] = [
		{
			name: 'Tiny faces',
			symbols: ['🙂', '😵', '😠', '😐', '😑', '😆', '😍', '😟', '🤔', '🙃', '😈', '👿', '👃'],
		},
		{
			name: 'Cat faces',
			symbols: ['🐱', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'],
		},
		{
			name: 'Hearts',
			symbols: ['❤', '💙', '💚', '💛', '💜', '🖤', '💔', '💖', '💗', '💕'],
		},
		{
			name: 'Food & objects',
			symbols: ['🥌','🍕','🍎','🍏','🍊','🍐','🥭','🥕','🍇','🍌','⛏','🥚','💮','🌸','🍬','🍡','🍭','⭐','🌟','🌠','⚡','❄','⛄','🏀','🎃','🌲','🎄','🕯','🎅','💐','🌿','🎲','✨','🎁','🔥','🎵','🎶','🌈','🐾','👑','💎','☘','🍀','🍪'],
		},
		{
			name: 'Animals',
			symbols: ['🦋','🦇','🕷','👻','🐈'],
		},
		{
			name: 'Symbols',
			symbols: ['™','♂','♀','⚧'],
		},
		{
			name: 'Zodiac',
			symbols: ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','⛎'],
		},
	];


	ngAfterViewInit() {
		this.initializeCategories();
	}

	private initializeCategories() {
		this.categories = this.categoryMap.map((cat: { name: string; symbols: string[] }) => ({
			name: cat.name,
			emotes: this.allEmotes.filter((e: Emoji) => cat.symbols.indexOf(e.symbol) !== -1),
		}));

		this.filteredCategories = this.categories;
	}

	// Note: Explicit types added to lambdas earlier to avoid implicit any errors in older TypeScript versions
	// and loops used instead of flatMap to support older lib targets.

	onSearchChange(query: string) {
		this.searchQuery = query.toLowerCase();

		if (!this.searchQuery) {
			this.filteredCategories = this.categories;
			return;
		}

		this.filteredCategories = this.categories
			.map((category: EmojiCategory) => ({
				...category,
				emotes: category.emotes.filter((emote: Emoji) =>
					emote.names.some((name: string) => name.includes(this.searchQuery)) ||
					(emote.symbol && emote.symbol.includes(this.searchQuery)),
				),
			}))
			.filter((category: EmojiCategory) => category.emotes.length > 0);
	}

	selectEmoji(emoji: Emoji) {
		this.emojiSelected.emit(emoji.symbol);
	}

	onMouseEnterEmojiButton(_event: MouseEvent) {
		// Sample random emoji for button display
		const randomEmoji = this.allEmotes[Math.floor(Math.random() * this.allEmotes.length)];
		if (randomEmoji) {
			// This would be emitted to parent component to update button emoji
		}
	}
}
