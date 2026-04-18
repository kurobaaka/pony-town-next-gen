import { Component, Output, EventEmitter, ViewChild, ElementRef, OnInit, Input, NgZone } from '@angular/core';
import { uniq } from 'lodash';
import { Key } from '../../../client/input/input';
import { PonyObject, SocialSiteInfo } from '../../../common/interfaces';
import { clamp, flatten, findById } from '../../../common/utils';
import { isMobile } from '../../../client/data';
import { Model } from '../../services/model';
import { faHashtag, faEllipsisV, faStar, faSlash } from '../../../client/icons';
import { toPalette, createDefaultPony } from '../../../common/ponyInfo';
import { getTag, getTagTooltip } from '../../../common/tags';
import { getProviderIcon } from '../sign-in-box/sign-in-box';
import { BASE_CHARACTER_LIMIT } from '../../../common/constants';

function getSortTag(pony: PonyObject) {
	const match = pony.desc && /(?:^| )@(top|end|\d+)(?:$| )/.exec(pony.desc);
	return match && match[1];
}

function sortTagToNumber(tag: string) {
	if (tag === 'top') {
		return -1;
	} else if (tag === 'end') {
		return 999999999;
	} else {
		return +tag;
	}
}

function fallbackComparePonies(a: PonyObject, b: PonyObject) {
	return a.name.localeCompare(b.name) || (a.desc || '').localeCompare(b.desc || '');
}

function normalizeSearchWords(query: string): string[] {
	return query
		.split(/\s+/g)
		.map(x => x.trim().toLowerCase().replace(/^[★⭐]+/g, ''))
		.filter(Boolean);
}

function addSupporterStarsToWords(text: string, levels: number[]): string {
	if (!text) {
		return '';
	}

	const words = text.split(/\s+/g).map(w => w.trim()).filter(Boolean);
	if (!words.length || !levels.length) {
		return '';
	}

	return levels
		.map(level => {
			const stars = '★'.repeat(Math.max(0, Math.min(4, level)));
			return stars ? words.map(word => `${stars}${word}`).join(' ') : '';
		})
		.filter(Boolean)
		.join(' ');
}

function extractRealHashtags(description?: string): string[] {
	if (!description) {
		return [];
	}

	const matches = description.match(/(?:^|\s)(#\w+)/g) || [];
	return matches.map(x => x.trim().toLowerCase());
}

function comparePonies(a: PonyObject, b: PonyObject) {
	const aTag = getSortTag(a);
	const bTag = getSortTag(b);

	if (aTag && bTag) {
		return (sortTagToNumber(aTag) - sortTagToNumber(bTag)) || fallbackComparePonies(a, b);
	} else if (aTag) {
		return aTag === 'end' ? 1 : -1;
	} else if (bTag) {
		return bTag === 'end' ? -1 : 1;
	} else {
		return fallbackComparePonies(a, b);
	}
}

@Component({
	selector: 'character-list',
	templateUrl: 'character-list.pug',
	styleUrls: ['character-list.scss'],
})
export class CharacterList implements OnInit {
	readonly hashIcon = faHashtag;
	readonly ellipsisIcon = faEllipsisV;
	readonly starIcon = faStar;
	readonly slashIcon = faSlash;
	readonly toPalette = toPalette;
	readonly createDefaultPony = createDefaultPony;
	@Input() inGame = false;
	@Input() canNew = false;
	@Output() close = new EventEmitter<void>();
	@Output() newCharacter = new EventEmitter<void>();
	@Output() selectCharacter = new EventEmitter<PonyObject>();
	@Output() previewCharacter = new EventEmitter<PonyObject | undefined>();
	@ViewChild('ariaAnnounce', { static: true }) ariaAnnounce!: ElementRef;
	@ViewChild('searchInput', { static: true }) searchInput!: ElementRef;
	search?: string;
	selectedIndex = -1;
	ponies: PonyObject[] = [];
	tags: string[] = [];
	sortMode: 'default' | 'name' | 'creation' | 'recent' = 'default';
	private previewPony: PonyObject | undefined = undefined;
	readonly getProviderIcon = getProviderIcon;
	constructor(private model: Model, private zone: NgZone) {
	}
	getSocialSite(pony: PonyObject): SocialSiteInfo | undefined {
		return pony.site ? findById(this.model.sites, pony.site) : undefined;
	}
	getCharacterTag(pony: PonyObject) {
		return getTag(pony.tag);
	}
	getCharacterTagTooltip(pony: PonyObject) {
		return getTagTooltip(this.getCharacterTag(pony));
	}
	getSupporterLevel(): number {
		return (this.model && this.model.supporter) || 0;
	}
	getSupporterBonus(): number {
		if (!this.model) {
			return 0;
		}
		return Math.max(this.model.characterLimit - BASE_CHARACTER_LIMIT, 0);
	}
	getSupporterStarColor(): string | undefined {
		const level = this.getSupporterLevel();
		if (level === 1) return '#f96955'; // красный (Patreon)
		if (level === 2) return '#ffa32b'; // бронзовый
		if (level === 3) return '#ffcf00'; // золотой
		if (level === 4) return '#2ecc71'; // изумрудный
		return undefined;
	}
	formatDescriptionWithTags(description?: string): string {
		if (!description) return '';
		// Оборачиваем #-теги и @-теги в спецсимволы для разделения в шаблоне
		return description.replace(/(#\w+|@\w+)/g, '|TAG_START|$1|TAG_END|');
	}
	isTag(word: string): boolean {
		return /^(#|@)\w+$/.test(word);
	}
	get selectedPony() {
		return this.model.pony;
	}
	trackByPony(_index: number, pony: PonyObject) {
		void _index;
		return pony.id;
	}
	get searchable() {
		return true; // always show search input, not only for large lists
	}
	get placeholder() {
		const total = `${this.model.ponies.length} / ${this.model.characterLimit}`;
		if (this.sortMode === 'name') {
			return `alpha sort (a-z)`;
		}
		if (this.sortMode === 'creation') {
			return `newest first`;
		}
		if (this.sortMode === 'recent') {
			return `last used first`;
		}
		return `search (${total} ponies)`;
	}

	getSupporterInfo(): string {
		const level = this.getSupporterLevel();
		if (level === 0) {
			return 'No supporter perks.\n1000 character base limit.';
		}
		const bonus = this.getSupporterBonus();
		let perks = `- +${bonus} character slots`;
		if (level === 1) perks += '\n- Community perks';
		if (level === 2) perks += '\n- Priority world pairing';
		if (level === 3) perks += '\n- Gold support badge\n- Priority world pairing';
		return `Level ${level} Supporter\n\nPerks:\n${perks}`;
	}

	ngOnInit() {
		this.updatePonies();

		this.tags = uniq(flatten(this.ponies.map(p => extractRealHashtags(p.desc))))
			.sort();

		if (!isMobile) {
			setTimeout(() => this.searchInput.nativeElement.focus());
		}
	}
	keydown(e: KeyboardEvent) {
		if (e.keyCode === Key.ESCAPE) {
			if (this.search) {
				e.preventDefault();
				e.stopPropagation();
				this.search = '';
				this.updatePonies();
			} else {
				this.closed();
			}
		} else if (e.keyCode === Key.ENTER) {
			const pony = this.ponies[this.selectedIndex];

			if (pony) {
				this.select(pony);
			} else {
				this.closed();
			}
		} else if (e.keyCode === Key.UP) {
			this.setSelectedIndex(this.selectedIndex <= 0 ? (this.ponies.length - 1) : (this.selectedIndex - 1));
		} else if (e.keyCode === Key.DOWN) {
			this.setSelectedIndex(this.selectedIndex === (this.ponies.length - 1) ? 0 : (this.selectedIndex + 1));
		}
	}
	setPreview(pony: PonyObject) {
		this.previewPony = pony;
		const parsed = this.model.parsePonyObject(pony);
		this.previewCharacter.emit(parsed);
	}
	unsetPreview(pony: PonyObject) {
		if (this.previewPony && pony && this.previewPony.id === pony.id) {
			this.previewPony = undefined;
			this.previewCharacter.emit(undefined);
		}
	}
	setSortMode(mode: 'default' | 'name' | 'creation' | 'recent') {
		this.sortMode = mode;
		this.updatePonies();
	}

	private getCreatedTime(pony: PonyObject): number {
		if (!pony.id || pony.id.length !== 24) {
			return 0;
		}

		try {
			const timestamp = parseInt(pony.id.substring(0, 8), 16) * 1000;
			return Number.isFinite(timestamp) ? timestamp : 0;
		} catch {
			return 0;
		}
	}

	private sortPonies(items: PonyObject[]) {
		if (this.sortMode === 'name') {
			return items.slice().sort((a, b) => a.name.localeCompare(b.name));
		}

		if (this.sortMode === 'recent') {
			return items
				.filter(p => !!p.lastUsed)
				.sort((a, b) => {
					const aTime = a.lastUsed ? Number(new Date(a.lastUsed)) : 0;
					const bTime = b.lastUsed ? Number(new Date(b.lastUsed)) : 0;
					return bTime - aTime || a.name.localeCompare(b.name);
				});
		}

		if (this.sortMode === 'creation') {
			return items.slice().sort((a, b) => {
				const aTime = this.getCreatedTime(a);
				const bTime = this.getCreatedTime(b);
				return bTime - aTime || a.name.localeCompare(b.name);
			});
		}

		return items.slice().sort(comparePonies);
	}

	formatLastUsed(lastUsed?: string): string | undefined {
		if (!lastUsed) {
			return undefined;
		}

		const time = Number(new Date(lastUsed));
		if (!time || Number.isNaN(time)) {
			return undefined;
		}

		const diff = Date.now() - time;
		if (diff < 0) {
			return 'now';
		}

		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) {
			return `last ${seconds}s`;
		}

		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return minutes === 1 ? '1 minute ago' : `${minutes} min ago`;
		}

		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
		}

		const days = Math.floor(hours / 24);
		return days === 1 ? '1 day ago' : `${days} days ago`;
	}

	formatCreated(pony: PonyObject): string | undefined {
		if (this.sortMode !== 'creation') {
			return undefined;
		}

		const created = this.getCreatedTime(pony);
		if (!created) {
			return undefined;
		}

		const diff = Date.now() - created;
		if (diff < 0) {
			return 'just now';
		}

		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) {
			return `created ${seconds}s ago`;
		}

		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `created ${minutes}m ago`;
		}

		const hours = Math.floor(minutes / 60);
		if (hours < 24) {
			return `created ${hours}h ago`;
		}

		const days = Math.floor(hours / 24);
		return `created ${days}d ago`;
	}

	updatePonies() {
		this.zone.run(() => {
			const query = this.search && this.search.toLowerCase().trim();

			function matchesWords(text: string, words: string[]) {
				for (const word of words) {
					if (text.indexOf(word) === -1) {
						return false;
					}
				}

				return true;
			}

			const parsedPonies = this.model.ponies.map(pony => this.model.parsePonyObject(pony));
			const supporterLevel = Math.max(0, Math.min(4, this.getSupporterLevel()));

			if (query) {
				const words = normalizeSearchWords(query);

				this.ponies = this.sortPonies(parsedPonies.filter(pony => {
					const baseText = `${pony.name} ${pony.desc || ''}`.toLowerCase();
					const starredText = addSupporterStarsToWords(baseText, supporterLevel ? [supporterLevel] : []);
					const text = `${baseText} ${starredText}`;
					return matchesWords(text, words);
				}));
			} else {
				this.ponies = this.sortPonies(parsedPonies.slice());
			}

			this.setSelectedIndex(this.selectedIndex);
			if (!this.ponies.length) {
				this.previewCharacter.emit(undefined);
			}
		});
	}
	select(pony: PonyObject) {
		this.selectCharacter.emit(pony);
	}
	createNew() {
		this.newCharacter.emit();
	}
	private closed() {
		this.zone.run(() => this.close.emit());
	}
	private setSelectedIndex(index: number) {
		this.zone.run(() => {
			this.selectedIndex = clamp(index, -1, this.ponies.length - 1);
			const pony = this.ponies[index];
			this.ariaAnnounce.nativeElement.textContent = pony ? pony.name : '';

			if (pony) {
				this.setPreview(pony);
			} else if (this.previewPony) {
				this.unsetPreview(this.previewPony);
			}
		});
	}
}
