import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { PlayerAction, Pony, EntityPlayerState, Entity } from '../../../common/interfaces';
import { getPaletteInfo } from '../../../common/pony';
import { Model } from '../../services/model';
import { PonyTownGame } from '../../../client/game';
import {
	partyLeaderIcon, faUserPlus, faUserTimes, faCheck, faMicrophoneSlash, faEyeSlash, faStar, faUserMinus,
	faUserCog, faComment, faUserCheck, faUserFriends, faPlug, faFolderOpen, faClock, faUndo
} from '../../../client/icons';
import { DAY } from '../../../common/constants';
import { isPonyInParty, isPartyLeader } from '../../../client/partyUtils';
import { getTag, getTagTooltip } from '../../../common/tags';
import { isIgnored, isHidden, isFriend } from '../../../common/entityUtils';
import { hasFlag, setFlag } from '../../../common/utils';
import { AgDragEvent } from '../directives/agDrag';

@Component({
	selector: 'pony-box',
	templateUrl: 'pony-box.pug',
	styleUrls: ['pony-box.scss'],
})
export class PonyBox implements AfterViewChecked {
	readonly leaderIcon = partyLeaderIcon;
	readonly inviteIcon = faUserPlus;
	readonly removeIcon = faUserTimes;
	readonly cogIcon = faUserCog;
	readonly checkIcon = faCheck;
	readonly ignoreIcon = faMicrophoneSlash;
	readonly hideIcon = faEyeSlash;
	readonly starIcon = faStar;
	readonly addFriendIcon = faUserPlus;
	readonly removeFriendIcon = faUserMinus;
	readonly messageIcon = faComment;
	readonly afkIcon = faClock;
	readonly offlineIcon = faPlug;
	readonly modalIcon = faFolderOpen;
	readonly resetWidthIcon = faUndo;
	readonly friendTagIcon = faUserCheck;
	readonly partyTagIcon = faUserFriends;
	isIgnored = isIgnored;
	isFriend = isFriend;
	removingFriend = false;
	friendRequestSent = false;
	rectWidthPx?: number;
	private autoRectWidthPx = 250;
	private resizeStartWidth = 0;
	private _pony?: Pony;
	@ViewChild('tagsBox', { static: false }) tagsBox?: ElementRef<HTMLElement>;
	@ViewChild('rectBox', { static: false }) rectBox?: ElementRef<HTMLElement>;
	@Input() set pony(val: Pony | undefined) {
		if (val !== this._pony) {
			this.friendRequestSent = false;
			this.removingFriend = false;
			this._pony = val;
		}
	}
	get pony() { return this._pony; }
	@Output() sendMessage = new EventEmitter<Entity>();
	@Output() portraitDrag = new EventEmitter<AgDragEvent>();
	@Input() dragEnabled = false;
	@Input() dragging = false;
	constructor(private model: Model, private game: PonyTownGame) {
	}
	ngAfterViewChecked() {
		this.updateAutoRectWidth();
	}
	get ignoredOrHidden() {
		return this.pony && (isIgnored(this.pony) || isHidden(this.pony));
	}
	get isMod() {
		return this.model.isMod;
	}
	get canUseWideRect() {
		return this.model.supporter >= 3;
	}
	get maxRectWidth() {
		return Math.max(220, Math.min(760, window.innerWidth - 70));
	}
	get minRectWidth() {
		return 110;
	}
	get currentRectWidth() {
		if (this.rectWidthPx === undefined) {
			return Math.max(this.minRectWidth, Math.min(this.maxRectWidth, this.autoRectWidthPx));
		}

		return Math.max(this.minRectWidth, Math.min(this.maxRectWidth, this.rectWidthPx));
	}
	get isRectResized() {
		return this.rectWidthPx !== undefined;
	}
	get isCompactRect() {
		return this.canUseWideRect && this.currentRectWidth <= 170;
	}
	get canInviteToParty() {
		return this.pony && (!this.game.party || (isPartyLeader(this.game) && !isPonyInParty(this.game.party, this.pony, true)));
	}
	get canRemoveFromParty() {
		return this.pony && isPartyLeader(this.game) && isPonyInParty(this.game.party, this.pony, true);
	}
	get canPromoteToLeader() {
		return this.pony && isPartyLeader(this.game) && isPonyInParty(this.game.party, this.pony, false);
	}
	get isPartyInvitePending() {
		return this.pony
			&& isPonyInParty(this.game.party, this.pony, true)
			&& !isPonyInParty(this.game.party, this.pony, false);
	}
	get isPartyMember() {
		return this.pony && isPonyInParty(this.game.party, this.pony, false);
	}
	get specialTag() {
		return getTag(this.pony && this.pony.tag);
	}
	get specialClass() {
		const tag = this.specialTag;
		return tag && tag.tagClass;
	}
	get specialTagTooltip() {
		return getTagTooltip(this.specialTag);
	}
	get paletteInfo() {
		return this.pony && getPaletteInfo(this.pony);
	}
	get isAfk() {
		return !this.isOffline && !!(this.pony && hasFlag(this.pony.playerState, EntityPlayerState.Afk));
	}
	get isOffline() {
		const pony = this.pony as any;
		return !!(pony && (pony.offline || (pony.options && pony.options.offline)));
	}
	get isInModal() {
		const pony = this.pony as any;

		if (!pony || this.isOffline) {
			return false;
		}

		if (pony.inModal || pony.modal || (pony.options && pony.options.modal)) {
			return true;
		}

		const player = this.game.player as any;
		if (player && pony.id === player.id) {
			return document.body.classList.contains('modal-open');
		}

		return false;
	}
	inviteToParty() {
		this.playerAction(PlayerAction.InviteToParty);
	}
	removeFromParty() {
		this.playerAction(PlayerAction.RemoveFromParty);
	}
	promoteToLeader() {
		this.playerAction(PlayerAction.PromotePartyLeader);
	}
	toggleIgnore() {
		if (this.pony) {
			const ignored = isIgnored(this.pony);
			this.playerAction(ignored ? PlayerAction.Unignore : PlayerAction.Ignore);
			this.pony.playerState = setFlag(this.pony.playerState, EntityPlayerState.Ignored, !ignored);
		}
	}
	hidePlayer(days: number) {
		this.playerAction(PlayerAction.HidePlayer, days * DAY);
	}
	addFriend() {
		this.friendRequestSent = true;
		this.playerAction(PlayerAction.AddFriend);
	}
	removeFriend() {
		this.playerAction(PlayerAction.RemoveFriend);
	}
	private playerAction(type: PlayerAction, param: any = undefined) {
		const ponyId = this.pony && this.pony.id;

		if (ponyId) {
			this.game.send(server => server.playerAction(ponyId, type, param));
		}
	}
	sendMessageTo() {
		if (this.pony) {
			this.sendMessage.emit(this.pony);
		}
	}
	onPortraitDrag(event: AgDragEvent) {
		if (this.dragEnabled) {
			this.portraitDrag.emit(event);
		}
	}
	resizeRect({ type, dx }: AgDragEvent) {
		if (!this.canUseWideRect) return;

		if (type === 'start') {
			const element = this.rectBox && this.rectBox.nativeElement;
			this.resizeStartWidth = element ? element.offsetWidth : (this.rectWidthPx || 320);
			if (this.rectWidthPx === undefined) {
				this.rectWidthPx = this.resizeStartWidth;
			}
			return;
		}

		const width = this.resizeStartWidth + dx;
		this.rectWidthPx = Math.max(this.minRectWidth, Math.min(this.maxRectWidth, width));
	}
	resetRectWidth() {
		if (!this.canUseWideRect) return;
		this.rectWidthPx = undefined;
	}
	private updateAutoRectWidth() {
		const tags = this.tagsBox && this.tagsBox.nativeElement;
		const autoWidth = this.measureAutoRectWidth();

		if (!tags) {
			if (this.autoRectWidthPx !== autoWidth) {
				this.autoRectWidthPx = autoWidth;
			}
			return;
		}

		if (this.rectWidthPx === undefined) {
			this.applyTagCollapseLevel(tags, 0);
			this.autoRectWidthPx = autoWidth;
			return;
		}

		const manualWidth = Math.max(this.minRectWidth, Math.min(this.maxRectWidth, this.rectWidthPx));
		const collapseLevel = this.findCollapseLevelForWidth(tags, manualWidth);
		this.applyTagCollapseLevel(tags, collapseLevel);
	}
	private getDesiredRectWidth(tags: HTMLElement, useDefaultMinimum = false) {
		const tagsWidth = Math.ceil(tags.scrollWidth);
		const minimum = useDefaultMinimum ? 250 : this.minRectWidth;
		return Math.max(minimum, tagsWidth + 14);
	}
	private measureAutoRectWidth() {
		const pony = this.pony as any;
		const ponyName = pony && pony.name ? String(pony.name) : '';
		const siteName = pony && pony.site && pony.site.name ? String(pony.site.name) : '';
		const nameWidth = ponyName.length * 8.6;
		const siteWidth = siteName.length ? (siteName.length * 8.1) + 28 : 0;
		const statusWidth = (this.isAfk ? 42 : 0) + (this.isOffline ? 18 : 0) + (this.isInModal ? 18 : 0);
		const contentWidth = Math.max(nameWidth + statusWidth, siteWidth);
		const desiredWidth = Math.max(250, Math.round(contentWidth + 96));
		const autoMaxWidth = Math.min(this.maxRectWidth, this.canUseWideRect ? 540 : 460);
		return Math.min(autoMaxWidth, desiredWidth);
	}
	private findCollapseLevelForWidth(tags: HTMLElement, targetWidth: number) {
		const labelsCount = tags.querySelectorAll('.pony-box-tag-label').length;
		const maxCollapse = Math.min(6, labelsCount);

		for (let level = 0; level <= maxCollapse; level++) {
			this.applyTagCollapseLevel(tags, level);
			if (this.getDesiredRectWidth(tags, false) <= targetWidth) {
				return level;
			}
		}

		return maxCollapse;
	}
	private applyTagCollapseLevel(tags: HTMLElement, level: number) {
		for (let i = 0; i <= 6; i++) {
			tags.classList.remove(`tag-label-collapse-${i}`);
		}

		tags.classList.add(`tag-label-collapse-${Math.max(0, Math.min(6, level))}`);
	}
	// supporter servers
	get canInviteToSupporterServers() {
		return false; // DEVELOPMENT; // TODO: check if ignored or hidden
	}
	get isInvitedToSupporterServers() {
		return false;
	}
	inviteToSupporterServers() {
		this.playerAction(PlayerAction.InviteToSupporterServers);
	}
}
