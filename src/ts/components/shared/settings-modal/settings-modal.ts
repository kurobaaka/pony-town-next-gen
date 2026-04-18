import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AccountSettings, BrowserSettings, GraphicsQuality } from '../../../common/interfaces';
import { SettingsService } from '../../services/settingsService';
import { Model } from '../../services/model';
import {
	DEFAULT_CHATLOG_OPACITY, MAX_CHATLOG_RANGE, MIN_CHATLOG_RANGE, isChatlogRangeUnlimited, MAX_FILTER_WORDS_LENGTH
} from '../../../common/constants';
import { StorageService } from '../../services/storageService';
import { cloneDeep, clamp } from '../../../common/utils';
import { PonyTownGame } from '../../../client/game';
import { updateRangeIndicator, readFileAsText } from '../../../client/clientUtils';
import { faSlidersH, faCommentSlash, faGamepad, faImage, faDownload, faUpload, faComment, faStar } from '../../../client/icons';

interface AfkOption {
	value: number;
	label: string;
	requiredTier?: 2 | 3 | 4;
}

const DEFAULT_AFK_STATUS_MINUTES = 2;
const DEFAULT_AFK_SLEEP_MINUTES = 5;
const DEFAULT_AFK_KICK_MINUTES = 15;

@Component({
	selector: 'settings-modal',
	templateUrl: 'settings-modal.pug',
	styleUrls: ['settings-modal.scss'],
})
export class SettingsModal implements OnInit, OnDestroy {
	readonly maxChatlogRange = MAX_CHATLOG_RANGE;
	readonly minChatlogRange = MIN_CHATLOG_RANGE;
	readonly maxGraphicsQuality: number;
	readonly maxGraphicsQualityValue: GraphicsQuality;
	readonly gameIcon = faSlidersH;
	readonly chatIcon = faComment;
	readonly filtersIcon = faCommentSlash;
	readonly controlsIcon = faGamepad;
	readonly graphicsIcon = faImage;
	readonly exportIcon = faDownload;
	readonly importIcon = faUpload;
	readonly starIcon = faStar;
	readonly afkKickOptions: AfkOption[] = [
		{ value: 5, label: '5' },
		{ value: 10, label: '10' },
		{ value: 15, label: '15' },
		{ value: 30, label: '30', requiredTier: 2 },
		{ value: 45, label: '45', requiredTier: 3 },
		{ value: 0, label: 'Unlimited', requiredTier: 4 },
	];
	readonly afkStatusOptions: AfkOption[] = [
		{ value: 1, label: '1' },
		{ value: 2, label: '2' },
		{ value: 3, label: '3' },
		{ value: 5, label: '5' },
		{ value: 10, label: '10' },
		{ value: 15, label: '15' },
		{ value: 30, label: '30', requiredTier: 2 },
		{ value: 45, label: '45', requiredTier: 3 },
	];
	readonly afkSleepOptions: AfkOption[] = [
		{ value: 2, label: '2' },
		{ value: 5, label: '5' },
		{ value: 10, label: '10' },
		{ value: 15, label: '15' },
		{ value: 30, label: '30', requiredTier: 2 },
		{ value: 45, label: '45', requiredTier: 3 },
	];
	@Output() close = new EventEmitter();
	account: AccountSettings = {};
	browser: BrowserSettings = {};
	accountBackup: AccountSettings = {};
	browserBackup: BrowserSettings = {};
	private done = false;
	private subscription?: Subscription;
	constructor(
		private settingsService: SettingsService,
		private storage: StorageService,
		private game: PonyTownGame,
		private model: Model,
	) {
		if (game.webgl) {
			if (game.webgl.failedFBO) {
				this.maxGraphicsQuality = 0;
				this.maxGraphicsQualityValue = GraphicsQuality.Low;
			}
			else if (game.webgl.failedDepthBuffer) {
				this.maxGraphicsQuality = 1;
				this.maxGraphicsQualityValue = GraphicsQuality.Medium;
			}
			else {
				this.maxGraphicsQuality = 2;
				this.maxGraphicsQualityValue = GraphicsQuality.High;
			}
		}
		else {
			this.maxGraphicsQuality = 2;
			this.maxGraphicsQualityValue = GraphicsQuality.High;
		}
	}
	get pane() {
		return this.storage.getItem('settings-modal-pane') || 'game';
	}
	set pane(value: string) {
		this.storage.setItem('settings-modal-pane', value);
	}
	get chatlogRangeText() {
		const range = this.account.chatlogRange;
		return isChatlogRangeUnlimited(range) ? 'entire screen' : `${range} tiles`;
	}
	get graphicsQualityText() {
		if (!this.game.webgl || (this.browser.graphicsQuality === undefined)) {
			return 'Undefined';
		}

		if (this.game.webgl.failedFBO || (this.browser.graphicsQuality === GraphicsQuality.Low)) {
			return 'Low';
		}
		else if (this.game.webgl.failedDepthBuffer || (this.browser.graphicsQuality === GraphicsQuality.Medium)) {
			return 'Medium';
		}
		else {
			return 'High';
		}
	}
	get supporterLevel() {
		return this.model.supporter;
	}
	get afkKickText() {
		return this.account.afkKickMinutes === 0 ? 'Unlimited' : `${this.account.afkKickMinutes || DEFAULT_AFK_KICK_MINUTES}`;
	}
	get afkStatusText() {
		return `${this.account.afkStatusMinutes || DEFAULT_AFK_STATUS_MINUTES}`;
	}
	get afkSleepText() {
		return `${this.account.afkSleepMinutes || DEFAULT_AFK_SLEEP_MINUTES}`;
	}
	get partyInvitesPolicy() {
		return this.account.ignorePartyInvites ? 'friends' : 'everyone';
	}
	get partyInvitesPolicyText() {
		return this.partyInvitesPolicy === 'friends' ? 'Friends only' : 'Everyone';
	}
	get friendRequestsPolicy() {
		return this.account.ignoreFriendInvites ? 'nobody' : 'everyone';
	}
	get friendRequestsPolicyText() {
		return this.friendRequestsPolicy === 'nobody' ? 'Nobody' : 'Everyone';
	}
	setPartyInvitesPolicy(value: string) {
		this.account.ignorePartyInvites = value !== 'everyone';
	}
	setFriendRequestsPolicy(value: string) {
		this.account.ignoreFriendInvites = value === 'nobody';
	}
	get maxKickMinutes() {
		if (this.supporterLevel >= 4) return 0;
		if (this.supporterLevel >= 3) return 45;
		if (this.supporterLevel >= 2) return 30;
		return 15;
	}
	isTierLocked(requiredTier?: 2 | 3 | 4) {
		return !!requiredTier && this.supporterLevel < requiredTier;
	}
	isAfkOptionDisabled(option: AfkOption, type: 'kick' | 'status' | 'sleep') {
		if (this.isTierLocked(option.requiredTier)) return true;
		const kick = this.account.afkKickMinutes || DEFAULT_AFK_KICK_MINUTES;

		if (type !== 'kick' && kick > 0 && option.value > kick) {
			return true;
		}

		if (type === 'sleep') {
			const status = this.account.afkStatusMinutes || DEFAULT_AFK_STATUS_MINUTES;
			if (option.value < status) return true;
		}

		return false;
	}
	optionTierClass(option: AfkOption) {
		return option.requiredTier ? `supporter-${option.requiredTier}` : '';
	}
	optionTierTitle(option: AfkOption) {
		return option.requiredTier ? `Available with tier ${option.requiredTier} support` : '';
	}
	private promptMinutes(title: string, current: number, allowUnlimited = false): number | undefined {
		const hint = allowUnlimited ? 'Enter minutes (0 for Unlimited)' : 'Enter minutes';
		const value = window.prompt(`${title}\n${hint}`, `${current}`);

		if (value === null) return undefined;

		const parsed = Number(value.trim());
		if (!isFinite(parsed)) return undefined;

		return Math.max(0, Math.floor(parsed));
	}
	setCustomAfkKickMinutes() {
		if (this.supporterLevel < 4 && this.maxKickMinutes <= 0) return;

		const current = this.account.afkKickMinutes === undefined ? DEFAULT_AFK_KICK_MINUTES : this.account.afkKickMinutes;
		const value = this.promptMinutes('AFK timeout', current, this.supporterLevel >= 4);

		if (value === undefined) return;

		if (value === 0 && this.supporterLevel < 4) return;

		this.account.afkKickMinutes = value;
		this.normalizeAfkSettings();
	}
	setCustomAfkStatusMinutes() {
		const current = this.account.afkStatusMinutes === undefined ? DEFAULT_AFK_STATUS_MINUTES : this.account.afkStatusMinutes;
		const value = this.promptMinutes('Show away status after', current);

		if (value === undefined) return;

		this.account.afkStatusMinutes = value;
		this.normalizeAfkSettings();
	}
	setCustomAfkSleepMinutes() {
		const current = this.account.afkSleepMinutes === undefined ? DEFAULT_AFK_SLEEP_MINUTES : this.account.afkSleepMinutes;
		const value = this.promptMinutes('Fall asleep after', current);

		if (value === undefined) return;

		this.account.afkSleepMinutes = value;
		this.normalizeAfkSettings();
	}
	setAfkKickMinutes(value: number) {
		this.account.afkKickMinutes = value;
		this.normalizeAfkSettings();
	}
	setAfkStatusMinutes(value: number) {
		this.account.afkStatusMinutes = value;
		this.normalizeAfkSettings();
	}
	setAfkSleepMinutes(value: number) {
		this.account.afkSleepMinutes = value;
		this.normalizeAfkSettings();
	}
	private normalizeAfkSettings() {
		const maxKick = this.maxKickMinutes;
		let kick = this.account.afkKickMinutes;
		let status = this.account.afkStatusMinutes;
		let sleep = this.account.afkSleepMinutes;

		kick = kick === undefined ? DEFAULT_AFK_KICK_MINUTES : (kick | 0);
		status = status === undefined ? DEFAULT_AFK_STATUS_MINUTES : (status | 0);
		sleep = sleep === undefined ? DEFAULT_AFK_SLEEP_MINUTES : (sleep | 0);

		if (maxKick === 0) {
			kick = Math.max(0, kick);
		} else {
			if (kick <= 0) kick = DEFAULT_AFK_KICK_MINUTES;
			kick = clamp(kick, 1, maxKick);
		}

		const kickLimit = kick === 0 ? 24 * 60 : kick;
		status = clamp(status, 1, kickLimit);
		sleep = clamp(sleep, status, kickLimit);

		this.account.afkKickMinutes = kick;
		this.account.afkStatusMinutes = status;
		this.account.afkSleepMinutes = sleep;
	}
	ngOnInit() {
		this.accountBackup = cloneDeep(this.settingsService.account);
		this.browserBackup = cloneDeep(this.settingsService.browser);
		this.account = this.settingsService.account;
		this.browser = this.settingsService.browser;
		this.setupDefaults();
		this.subscription = this.game.onLeft.subscribe(() => this.cancel());
	}
	ngOnDestroy() {
		this.finishChatlogRange();

		if (!this.done) {
			this.cancel();
		}

		this.subscription && this.subscription.unsubscribe();
	}
	reset() {
		this.account = this.settingsService.account = {};
		this.browser = this.settingsService.browser = {};
		this.setupDefaults();
		this.applyBackgroundModeClass();
	}
	cancel() {
		this.done = true;
		this.settingsService.account = this.accountBackup;
		this.settingsService.browser = this.browserBackup;
		this.applyBackgroundModeClass();
		this.close.emit();
	}
	ok() {
		this.normalizeAfkSettings();

		if (this.account.filterWords) {
			let filter = this.account.filterWords;

			while (filter.length > MAX_FILTER_WORDS_LENGTH && /\s/.test(filter)) {
				filter = filter.trim().replace(/\s+\S+$/, '');
			}

			if (filter.length > MAX_FILTER_WORDS_LENGTH) {
				this.account.filterWords = '';
			} else {
				this.account.filterWords = filter;
			}
		}

		this.done = true;
		this.settingsService.saveAccountSettings(this.account);
		this.settingsService.saveBrowserSettings(this.browser);
		this.applyBackgroundModeClass();
		this.close.emit();
	}
	onPowerSaveModeInBackgroundChanged() {
		this.applyBackgroundModeClass();
	}
	switchTimestamp(state?: string) {
		if (!state) this.browser.timestamp = undefined;
		else if (state === '12') this.browser.timestamp = '12';
		else if (state === '24') this.browser.timestamp = '24';
	}
	updateChatlogRange(range: number | undefined) {
		document.body.classList.add('translucent-modals');
		updateRangeIndicator(range, this.game);
	}
	finishChatlogRange() {
		document.body.classList.remove('translucent-modals');
		updateRangeIndicator(undefined, this.game);
	}
	private setupDefaults() {
		if (this.account.powerSaveModeInBackground === undefined) {
			this.account.powerSaveModeInBackground = true;
		}

		if (this.account.chatlogOpacity === undefined) {
			this.account.chatlogOpacity = DEFAULT_CHATLOG_OPACITY;
		}

		if (this.account.chatlogRange === undefined) {
			this.account.chatlogRange = MAX_CHATLOG_RANGE;
		}

		if (this.account.filterWords === undefined) {
			this.account.filterWords = '';
		}

		if (this.account.showTypingIndicator === undefined) {
			this.account.showTypingIndicator = true;
		}

		if (this.account.visibleTestingMessages === undefined) {
			this.account.visibleTestingMessages = false;
		}

		if (this.account.afkStatusMinutes === undefined) {
			this.account.afkStatusMinutes = DEFAULT_AFK_STATUS_MINUTES;
		}

		if (this.account.afkSleepMinutes === undefined) {
			this.account.afkSleepMinutes = DEFAULT_AFK_SLEEP_MINUTES;
		}

		if (this.account.afkKickMinutes === undefined) {
			this.account.afkKickMinutes = DEFAULT_AFK_KICK_MINUTES;
		}

		this.normalizeAfkSettings();

		if (this.browser.graphicsQuality === undefined) {
			this.browser.graphicsQuality = this.maxGraphicsQualityValue;
		}

		this.applyBackgroundModeClass();
	}

	private applyBackgroundModeClass() {
		const powerSaveMode = this.account.powerSaveModeInBackground !== false;
		document.body.classList.toggle('background-style-new', !powerSaveMode);
	}
	export() {
		const account = { ...this.account, actions: undefined };
		const browser = this.browser;
		const data = JSON.stringify({ account, browser });
		saveAs(new Blob([data], { type: 'text/plain;charset=utf-8' }), `pony-town-settings.json`);
	}
	async import(file: File | undefined) {
		if (file) {
			const text = await readFileAsText(file);
			const { account, browser } = JSON.parse(text);
			const actions = this.account.actions;
			Object.assign(this.account, { ...account, actions });
			Object.assign(this.browser, browser);
		}
	}
}
