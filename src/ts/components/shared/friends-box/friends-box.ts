import { Component, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { faCog, faUserFriends, faUserCog, faCircle, faUserCheck, faThumbtack, faPlug, faCircleUser, faNote, faSlash, faUserMinus, faBan, faCheck, faChevronDown, faChevronRight, faComment, faStar } from '../../../client/icons';
import { Model, Friend } from '../../services/model';
import { PonyTownGame } from '../../../client/game';
import { PlayerAction, Action } from '../../../common/interfaces';
import { removeItem } from '../../../common/utils';
import { SettingsService } from '../../services/settingsService';
import { getFriendsLimit } from '../../../common/accountUtils';

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

@Component({
	selector: 'friends-box',
	templateUrl: 'friends-box.pug',
	styleUrls: ['friends-box.scss'],
})
export class FriendsBox implements OnInit, OnDestroy {
	readonly friendsIcon = faUserFriends;
	readonly cogIcon = faCog;
	readonly addToPartyIcon = faUserFriends;
	readonly userOptionsIcon = faUserCog;
	readonly statusIcon = faCircle;
	readonly faCheck = faCheck;
	readonly faChevronDown = faChevronDown;
	readonly faChevronRight = faChevronRight;
	readonly faUserCheck = faUserCheck;
	readonly faThumbtack = faThumbtack;
	readonly faPlug = faPlug;
	readonly faCircleUser = faCircleUser;
	readonly faNote = faNote;
	readonly faComment = faComment;
	readonly faStar = faStar;
	readonly faSlash = faSlash;
	readonly faUserMinus = faUserMinus;
	readonly faBan = faBan;
	@Output() sendMessage = new EventEmitter<Friend>();
	@Output() openProfile = new EventEmitter<Friend>();
	search?: string;
	sortMode: 'default' | 'name' | 'status' = 'default';
	filteredFriends: Friend[] = [];
	showProfile = false;
	selectedFriend?: Friend;
	removing?: Friend;
	showPinnedSection = true;
	showGeneralSection = true;
	isUpdating = false;
	editingNoteFor?: string;
	editingNoteMode: 'edit' | 'remove' | null = null;
	editingNoteText = '';
	private lastTotalCount = 0;
	private subscription!: Subscription;
	private _friends: Friend[] = [];
	constructor(private settings: SettingsService, private model: Model, private game: PonyTownGame, private cd: ChangeDetectorRef) {
	}

	ngOnInit() {
		this.subscription = this.model.friends$.subscribe(friends => {
			const currentTotal = friends.length;
			if (currentTotal !== this.lastTotalCount) {
				this.lastTotalCount = currentTotal;
				this.isUpdating = true;
				setTimeout(() => {
					this.isUpdating = false;
					this.cd.detectChanges();
				}, 50);
			}
			this._friends = friends;
			this.updateFriends();
		});
	}

	ngOnDestroy() {
		this.subscription.unsubscribe();
	}

	get friends() {
		return this._friends;
	}

	get hidden() {
		return !!this.settings.account.hidden;
	}

	get placeholder() {
		const total = this.model.friends ? this.model.friends.length : 0;
		return `Search (${total}/${this.friendLimit})`;
	}

	getSupporterLevel(): number {
		return (this.model && this.model.supporter) || 0;
	}

	getSupporterStarColor(): string | undefined {
		const level = this.getSupporterLevel();
		if (level === 1) return '#f96955';
		if (level === 2) return '#ffa32b';
		if (level === 3) return '#ffcf00';
		if (level === 4) return '#2ecc71';
		return undefined;
	}

	get friendLimit() {
		return getFriendsLimit(this.model.account);
	}

	get onlineCount() {
		return this.friends ? this.friends.filter(f => f.online).length : 0;
	}

	get pinnedFriends() {
		return this.filteredFriends.filter(f => this.isPinned(f));
	}

	get generalFriends() {
		return this.filteredFriends.filter(f => !this.isPinned(f));
	}

	togglePinnedSection() {
		this.showPinnedSection = !this.showPinnedSection;
	}

	toggleGeneralSection() {
		this.showGeneralSection = !this.showGeneralSection;
	}

	isPinned(friend: Friend) {
		return this.getPinnedFriends().includes(friend.accountId);
	}

	private getPinnedFriends(): string[] {
		const pinned = localStorage.getItem('pinnedFriends');
		return pinned ? JSON.parse(pinned) : [];
	}

	private savePinnedFriends(pinned: string[]) {
		localStorage.setItem('pinnedFriends', JSON.stringify(pinned));
	}

	togglePin(friend: Friend) {
		const pinned = this.getPinnedFriends();
		const index = pinned.indexOf(friend.accountId);
		if (index >= 0) {
			pinned.splice(index, 1);
		} else {
			pinned.push(friend.accountId);
		}
		this.savePinnedFriends(pinned);
		// Задержка для того чтобы меню осталось открытым при обновлении
		setTimeout(() => {
			this.updateFriends();
			this.cd.detectChanges();
		}, 50);
	}

	trackByFriendId(_index: number, friend: Friend) {
		return friend.accountId;
	}

	get totalCount() {
		return this.friends ? this.friends.length : 0;
	}

	setSortMode(mode: 'default' | 'name' | 'status') {
		this.sortMode = mode;
		this.updateFriends();
	}

	showProfileFor(friend: Friend) {
		this.selectedFriend = friend;
		this.showProfile = true;
		this.openProfile.emit(friend);
	}

	closeProfile() {
		this.showProfile = false;
		this.selectedFriend = undefined;
	}

	private updateFriends() {
		const query = this.search && this.search.toLowerCase().trim();
		let friends = this.friends ? this.friends.slice() : [];

		if (query) {
			const words = normalizeSearchWords(query);
			const supporterLevel = Math.max(0, Math.min(4, this.getSupporterLevel()));
			friends = friends.filter(friend => {
				const baseText = `${friend.actualName} ${friend.accountName}`.toLowerCase();
				const starredText = addSupporterStarsToWords(baseText, supporterLevel ? [supporterLevel] : []);
				const text = `${baseText} ${starredText}`;
				return words.every(word => text.includes(word));
			});
		}

		const pinnedIds = this.getPinnedFriends();
		friends.forEach(f => f.pinned = pinnedIds.includes(f.accountId));

		this.filteredFriends = this.sortFriends(friends);
		this.cd.detectChanges();
	}

	private sortFriends(friends: Friend[]) {
		if (this.sortMode === 'name') {
			return friends.slice().sort((a, b) => a.actualName.localeCompare(b.actualName));
		}

		if (this.sortMode === 'status') {
			return friends.slice().sort((a, b) => {
				if (a.online && !b.online) return -1;
				if (!a.online && b.online) return 1;
				return a.actualName.localeCompare(b.actualName);
			});
		}

		// Default: sort by pinned first, then status (online first), then by name
		return friends.slice().sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			if (a.online && !b.online) return -1;
			if (!a.online && b.online) return 1;
			return a.actualName.localeCompare(b.actualName);
		});
	}

	toggleHidden() {
		this.settings.account.hidden = !this.settings.account.hidden;
		this.settings.saveAccountSettings(this.settings.account);
	}

	toggle() {
		this.removing = undefined;
	}

	sendMessageTo(friend: Friend) {
		this.sendMessage.emit(friend);
	}

	inviteToParty(friend: Friend) {
		this.game.send(server => server.playerAction(friend.entityId, PlayerAction.InviteToParty, undefined));
	}

	hasNote(_friend: Friend): boolean {
		// TODO: check if friend has a note
		return false;
	}

	isInParty(_friend: Friend): boolean {
		// TODO: check if friend is in party
		return false;
	}

	remove(friend: Friend) {
		this.removing = friend;
	}

	cancelRemove() {
		this.removing = undefined;
	}

	confirmRemove() {
		if (this.removing && this.model.friends) {
			const { accountId } = this.removing;
			this.game.send(server => server.actionParam(Action.RemoveFriend, accountId));
			const current = this.model.friends$.value.slice();
			removeItem(current, this.removing);
			this.model.friends$.next(current);
			this.model.friends = current;
			this.removing = undefined;
			this.updateFriends();
			this.cd.detectChanges();
		}
	}

	setStatus(status: string) {
		this.settings.account.hidden = status === 'invisible';
		this.settings.saveAccountSettings(this.settings.account);
	}

	formatLastSeen(lastSeen?: Date): string | undefined {
		if (!lastSeen) return undefined;
		const diff = Date.now() - lastSeen.getTime();
		if (diff < 0) return 'now';
		const seconds = Math.floor(diff / 1000);
		if (seconds < 60) return seconds === 1 ? '1 sec ago' : `${seconds} sec ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} min ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
		const weeks = Math.floor(days / 7);
		if (weeks < 5) return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
		const months = Math.floor(days / 30);
		if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
		const years = Math.floor(days / 365);
		return years === 1 ? '1 year ago' : `${years} years ago`;
	}

	getNote(friend: Friend): string | undefined {
		const notes = this.getNotes();
		return notes[friend.accountId];
	}

	private getNotes(): Record<string, string> {
		const notes = localStorage.getItem('friendNotes');
		return notes ? JSON.parse(notes) : {};
	}

	private saveNotes(notes: Record<string, string>) {
		localStorage.setItem('friendNotes', JSON.stringify(notes));
	}

	startEditNote(friend: Friend) {
		this.editingNoteFor = friend.accountId;
		this.editingNoteMode = 'edit';
		this.editingNoteText = this.getNote(friend) || '';
	}

	startRemoveNote(friend: Friend) {
		this.editingNoteFor = friend.accountId;
		this.editingNoteMode = 'remove';
	}

	cancelEditNote() {
		this.editingNoteFor = undefined;
		this.editingNoteMode = null;
		this.editingNoteText = '';
	}

	cancelRemoveNote() {
		this.editingNoteFor = undefined;
		this.editingNoteMode = null;
	}

	saveNote(friend: Friend) {
		if (this.editingNoteFor === friend.accountId && this.editingNoteMode === 'edit') {
			const notes = this.getNotes();
			if (this.editingNoteText.trim()) {
				notes[friend.accountId] = this.editingNoteText.trim().substring(0, 100);
			} else {
				delete notes[friend.accountId];
			}
			this.saveNotes(notes);
			this.editingNoteFor = undefined;
			this.editingNoteMode = null;
			this.editingNoteText = '';
			this.cd.detectChanges();
		}
	}

	confirmRemoveNote() {
		if (this.editingNoteFor) {
			const notes = this.getNotes();
			delete notes[this.editingNoteFor];
			this.saveNotes(notes);
			this.editingNoteFor = undefined;
			this.editingNoteMode = null;
			this.cd.detectChanges();
		}
	}
}
