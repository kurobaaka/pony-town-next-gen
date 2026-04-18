import { Component, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { cloneDeep } from '../../../common/utils';
import { BrowserSettings } from '../../../common/interfaces';
import { tileWidth, tileHeight } from '../../../common/constants';
import { SettingsService } from '../../services/settingsService';
import { PonyTownGame } from '../../../client/game';

@Component({
	selector: 'test-modal',
	templateUrl: 'test-modal.pug',
	styleUrls: ['test-modal.scss'],
})
export class TestModal implements OnInit, OnDestroy {
	@Output() close = new EventEmitter<void>();
	browser: BrowserSettings = {};
	browserBackup: BrowserSettings = {};
	private done = false;
	private subscription?: Subscription;

	constructor(
		private settingsService: SettingsService,
		private game: PonyTownGame,
	) {
	}

	ngOnInit() {
		this.browserBackup = cloneDeep(this.settingsService.browser);
		this.browser = this.settingsService.browser;
		this.setupDefaults();
		this.subscription = this.game.onLeft.subscribe(() => this.cancel());
	}

	ngOnDestroy() {
		if (!this.done) {
			this.cancel();
		}

		this.subscription && this.subscription.unsubscribe();
	}

	get isDevelopmentMode() {
		return DEVELOPMENT;
	}

	get isBetaMode() {
		return BETA;
	}

	get lookClickZonesEnabled() {
		return this.game.debugAreLookClickZonesEnabled();
	}

	ok() {
		this.done = true;
		this.settingsService.saveBrowserSettings(this.browser);
		this.close.emit();
	}

	cancel() {
		this.done = true;
		this.settingsService.browser = this.browserBackup;
		this.close.emit();
	}

	testAnnouncement() {
		this.game.announcements.next('Тестовое модальное окно работает');
	}

	editorUndo() {
		this.game.debugEditorUndo();
	}

	editorRemoveSelected() {
		this.game.debugEditorRemoveSelected();
	}

	editorMoveLeft() {
		this.game.debugEditorMoveSelected(-1 / tileWidth, 0);
	}

	editorMoveRight() {
		this.game.debugEditorMoveSelected(1 / tileWidth, 0);
	}

	editorMoveUp() {
		this.game.debugEditorMoveSelected(0, -1 / tileHeight);
	}

	editorMoveDown() {
		this.game.debugEditorMoveSelected(0, 1 / tileHeight);
	}

	toggleMinimap() {
		this.game.debugToggleMinimap();
	}

	toggleLookClickZones() {
		this.game.debugToggleLookClickZones();
	}

	runHeadTurn() {
		this.game.debugRunHeadTurnTest(false);
	}

	runHeadTurnShift() {
		this.game.debugRunHeadTurnTest(true);
	}

	toggleShowInfo() {
		this.game.debugToggleShowInfo();
	}

	toggleWaterBounds() {
		this.game.debugToggleWaterBounds();
	}

	toggleCollisionMap() {
		this.game.debugToggleCollisionMap();
	}

	toggleHelpers() {
		this.game.debugToggleHelpers();
	}

	toggleTileIndices() {
		this.game.debugToggleTileIndices();
	}

	toggleTileGrid() {
		this.game.debugToggleTileGrid();
	}

	toggleGrayscale() {
		this.game.debugToggleGrayscale();
	}

	toggleRegions() {
		this.game.debugToggleRegions();
	}

	toggleChatlogRange() {
		this.game.debugToggleChatlogRange();
	}

	toggleCameraShift() {
		this.game.debugToggleCameraShift();
	}

	togglePalette() {
		this.game.debugTogglePalette();
	}

	toggleWebglContextLoss() {
		this.game.debugToggleWebglContextLoss();
	}

	toggleBrightNight() {
		this.game.debugToggleBrightNight();
	}

	runActionR() {
		this.game.debugRunActionR();
	}

	headTiltUp() {
		this.game.debugAdjustHeadTilt(0.5);
	}

	headTiltDown() {
		this.game.debugAdjustHeadTilt(-0.5);
	}

	setNomAnimation() {
		this.game.debugSetNomAnimation();
	}

	leaveServer() {
		this.game.debugLeaveServer();
	}

	toggleDisableLighting() {
		this.game.debugToggleDisableLighting();
	}

	logPosition() {
		this.game.debugLogPlayerPosition();
	}

	toggleCurlTail() {
		this.game.debugToggleCurlTail();
	}

	playRandomTrack() {
		this.game.debugPlayRandomTrack();
	}

	toggleWalls() {
		this.game.debugToggleWalls();
	}

	setDeltaSlow() {
		this.game.debugSetDeltaMultiplier(0.5);
	}

	setDeltaFast() {
		this.game.debugSetDeltaMultiplier(2);
	}

	private setupDefaults() {
		if (this.browser.enableTestModalHotkey === undefined) {
			this.browser.enableTestModalHotkey = true;
		}
	}
}
