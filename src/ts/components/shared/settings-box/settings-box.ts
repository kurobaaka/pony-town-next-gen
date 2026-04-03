import { Component, OnInit, OnDestroy, NgZone, ViewChild, TemplateRef } from '@angular/core';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { distinctUntilChanged } from 'rxjs/operators';
import { Subscription, interval } from 'rxjs';
import { Action } from '../../../common/interfaces';
import { GameService } from '../../services/gameService';
import { Model } from '../../services/model';
import { PonyTownGame } from '../../../client/game';
import { isMobile } from '../../../client/data';
import { Dropdown } from '../directives/dropdown';
import {
	emptyIcon, faCog, faSearch, faSignOutAlt, faVolumeOff, faVolumeUp, faVolumeDown, faPlus, faMinus,
	faStepForward, faPause, faPlay, faChevronUp, faChevronDown
} from '../../../client/icons';
import { SettingsService } from '../../services/settingsService';
import { Audio } from '../../services/audio';

@Component({
	selector: 'settings-box',
	templateUrl: 'settings-box.pug',
	styleUrls: ['settings-box.scss'],
})
export class SettingsBox implements OnInit, OnDestroy {
	readonly cogIcon = faCog;
	readonly searchIcon = faSearch;
	readonly signOutIcon = faSignOutAlt;
	readonly volumeOffIcon = faVolumeOff;
	readonly volumeDownIcon = faVolumeDown;
	readonly volumeUpIcon = faVolumeUp;
	readonly emptyIcon = emptyIcon;
	readonly plusIcon = faPlus;
	readonly minusIcon = faMinus;
	readonly backwardIcon = faStepForward;
	readonly pauseIcon = faPause;
	readonly playIcon = faPlay;
	readonly forwardIcon = faStepForward;
	readonly chevronUpIcon = faChevronUp;
	readonly chevronDownIcon = faChevronDown;
	
	modalRef?: BsModalRef;
	time?: string;
	scaleOptions = { min: 1, max: 4 };
	musicExpanded = false;
	visualizerBars = [0, 0, 0, 0, 0];
	private updateSubscription?: Subscription;
	
	@ViewChild('dropdown', { static: true }) dropdown!: Dropdown;
	@ViewChild('actionsModal', { static: true }) actionsModal!: TemplateRef<any>;
	@ViewChild('settingsModal', { static: true }) settingsModal!: TemplateRef<any>;
	@ViewChild('invitesModal', { static: true }) invitesModal!: TemplateRef<any>;
	@ViewChild('toyModal', { static: true }) toyModal!: TemplateRef<any>;
	private subscription?: Subscription;
	constructor(
		private model: Model,
		private modalService: BsModalService,
		private settingsService: SettingsService,
		private gameService: GameService,
		private game: PonyTownGame,
		private audio: Audio,
		private zone: NgZone,
	) {
	}
	get scale() {
		return this.game.scale;
	}
	get volume() {
		return this.game.volume;
	}
	set volume(value: number) {
		this.settingsService.browser.volume = value;
		this.settingsService.saveBrowserSettings();
		this.audio.setVolume(value);
	}
	get server() {
		return this.gameService.server && this.gameService.server.name || '';
	}
	get settings() {
		return this.model.account && this.model.account.settings || {};
	}
	get isMobile() {
		return isMobile;
	}
	get seeThroughButtonText() {
		const label = this.settings.seeThroughObjects ? 'Hide obstacles' : 'Show obstacles';
		return !this.isMobile ? `${label} (F4)` : label;
	}
	get disableUIButtonText() {
		const label = this.settings.disableUI ? 'Enable UI' : 'Disable UI';
		return !this.isMobile ? `${label} (F6)` : label;
	}
	get track() {
		return this.game.audio.trackName;
	}
	get trackProgress() {
		return this.audio.progress;
	}
	get trackCurrentTime() {
		return this.formatTime(this.audio.currentTime);
	}
	get trackDuration() {
		return this.formatTime(this.audio.duration);
	}
	get isPlaying() {
		return this.audio.isPlaying;
	}
	get volumeIcon() {
		return this.volume === 0 ? this.volumeOffIcon : (this.volume < 50 ? this.volumeDownIcon : this.volumeUpIcon);
	}
	get isMod() {
		return this.model.isMod;
	}
	get hasInvites() {
		return this.isMod; // TEMP
	}
	ngOnInit() {
		this.game.onClock
			.pipe(
				distinctUntilChanged(),
			)
			.subscribe(text => {
				const worldState = this.game.worldState;
				let displayTime = text;

				if (worldState) {
					if (worldState.timeFrozen) {
						if (worldState.frozenHour !== undefined) {
							const dayStart = 4.75;
							const dayEnd = 20.25;
							const hour = worldState.frozenHour;
							if (hour > dayStart && hour <= dayEnd) {
								displayTime = 'Eternal day';
							} else {
								displayTime = 'Eternal night';
							}
						} else {
							displayTime = `${text} (freezed)`;
						}
					} else if (worldState.timeSpeed && worldState.timeSpeed !== 1.0) {
						displayTime = `${text} (speed x${worldState.timeSpeed.toFixed(1)})`;
					}
				}

				if (this.dropdown.isOpen) {
					this.zone.run(() => this.time = displayTime);
				} else {
					this.time = displayTime;
				}
			});

		this.updateSubscription = interval(100).subscribe(() => {
			this.updateVisualizerBars();
		});
	}
	ngOnDestroy() {
		this.subscription && this.subscription.unsubscribe();
		this.updateSubscription && this.updateSubscription.unsubscribe();
	}
	toggleVolume() {
		this.volume = this.volume === 0 ? 50 : 0;
	}
	volumeStarted() {
		this.game.audio.forcePlay();
	}
	nextTrack() {
		this.audio.playNextTrack();
	}
	previousTrack() {
		this.audio.playPreviousTrack();
	}
	togglePausePlay() {
		if (this.isPlaying) {
			this.audio.stop();
		} else {
			this.audio.play();
		}
	}
	toggleMusicExpanded() {
		this.musicExpanded = !this.musicExpanded;
	}
	updateVisualizerBars() {
		const progress = this.audio.progress;
		this.visualizerBars = this.visualizerBars.map(() => Math.random() * (progress / 100 + 0.5));
	}
	formatTime(seconds: number): string {
		if (isNaN(seconds) || !isFinite(seconds)) {
			return '0:00';
		}
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
	}
	leave() {
		this.gameService.leave('From settings dropdown');
		this.dropdown.close();
	}
	zoomOut() {
		this.game.zoomOut();
	}
	zoomIn() {
		this.game.zoomIn();
	}
	unhideAllHiddenPlayers() {
		this.game.send(server => server.action(Action.UnhideAllHiddenPlayers));
		this.dropdown.close();
	}
	toggleSeeThrough() {
		this.settings.seeThroughObjects = !this.settings.seeThroughObjects;
		this.settingsService.saveAccountSettings(this.settings);
		const message = this.settings.seeThroughObjects
			? 'Включён показ сквозь объекты'
			: 'Отключён показ сквозь объекты';
		this.game.announcements.next(message);
		this.dropdown.close();
	}
	toggleDisableUI() {
		this.settings.disableUI = !this.settings.disableUI;
		this.settingsService.saveAccountSettings(this.settings);
		const message = this.settings.disableUI
			? 'Отключён интерфейс'
			: 'Включён интерфейс';
		this.game.announcements.next(message);
		this.dropdown.close();
	}
	openModal(template: TemplateRef<any>) {
		this.modalRef = this.modalService.show(template, { ignoreBackdropClick: true });
	}
	openSettings() {
		this.openModal(this.settingsModal);
		this.dropdown.close();
	}
	openActions() {
		this.openModal(this.actionsModal);
		this.dropdown.close();
	}
	openInvites() {
		if (BETA) {
			this.openModal(this.invitesModal);
			this.dropdown.close();
		}
	}
	openToys() {
		this.openModal(this.toyModal);
		this.dropdown.close();
	}
}
