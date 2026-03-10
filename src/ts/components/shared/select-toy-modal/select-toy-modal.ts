import { Component, Output, EventEmitter, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Model } from '../../services/model';
import { PalettePonyInfo, ColorExtra, Action } from '../../../common/interfaces';
import { toPalette } from '../../../common/ponyInfo';
import { getToySprite, initializeToys } from '../../../client/ponyDraw';
import { PonyTownGame } from '../../../client/game';

@Component({
	selector: 'select-toy-modal',
	templateUrl: 'select-toy-modal.pug',
	styleUrls: ['select-toy-modal.scss'],
})
export class SelectToyModal implements OnDestroy {
	@Output() close = new EventEmitter<void>();
	selectedToy = 0;
	// Adapter for set-selection / sprite-selection
	toySet: any = { type: 0, pattern: 0 };
	toySets: Array<ColorExtra[] | undefined> = [];
	private _previewPony?: PalettePonyInfo;
	private _toys: number[] = [];
	private _toyBitmask = 0;
	private _toysLoaded = false;

	constructor(
		private model: Model,
		private game: PonyTownGame,
		private changeDetector: ChangeDetectorRef,
	) {
		console.log('[SelectToyModal] Constructor called');
		// Initialize toy palette data (ensure palettes exist)
		initializeToys(this.game.paletteManager);
		this.initializeData();

		// Update when account/ponies change (account loaded asynchronously)
		this.model.accountChanged.subscribe(() => {
			this.initializeData();
			this.changeDetector.markForCheck();
		});
	}
    
	ngOnDestroy() {
		// modal is short-lived; nothing to explicitly unsubscribe here
	}

	private initializeData() {
		// Get current player pony for preview
		const pony = this.model && this.model.pony;
		if (pony && pony.ponyInfo) {
			this._previewPony = toPalette(pony.ponyInfo, this.game.paletteManager);
			if ((pony.ponyInfo as any).toy) {
				this.selectedToy = (pony.ponyInfo as any).toy;
			}
			console.log('[SelectToyModal] Loaded pony:', this._previewPony);
		} else {
			console.log('[SelectToyModal] Pony not available - pony:', pony);
		}

		// Load toy bitmask from account state
		if (this.model && this.model.account) {
			const acct: any = this.model.account;
			const toysValue = acct.state && acct.state.toys;
			if (toysValue !== undefined) {
				// Handle both string and number formats
				this._toyBitmask = typeof toysValue === 'number' ? toysValue : parseInt(toysValue, 10) || 0;
			}
			console.log('[SelectToyModal] Account toys value:', toysValue, 'Parsed bitmask:', this._toyBitmask);
		} else {
			console.log('[SelectToyModal] Account not available');
		}

		// Collect toy IDs (filter by getToySprite availability) and build ColorExtra sets
		if (!this._toysLoaded) {
			this._toys = [];
			this.toySets = [];

			for (let n = 1; n < 200; n++) {
				const toySet = getToySprite(n);
				if (!toySet) break;
				
				this._toys.push(n);

				// Create ColorExtra entry using toy palette colors for visualization
				const item: any = {};
				if (toySet.palette && toySet.palette.colors) {
					item.palettes = [toySet.palette.colors];
				}
				item.label = `Toy ${n}`;

				this.toySets.push([item]);
			const colorsLen = toySet && toySet.palette && toySet.palette.colors ? toySet.palette.colors.length : 0;
			console.log(`[SelectToyModal] Toy ${n}: palette available=${!!toySet.palette}, colors=${colorsLen}`);
			}

			this.toySet = { type: this._toys.indexOf(this.selectedToy) >= 0 ? this._toys.indexOf(this.selectedToy) : 0, pattern: 0 };
			this._toysLoaded = true;

			// Debug: log toy collection status
			const collectedToys = this._toys.filter(t => this.isCollected(t));
			console.log('[SelectToyModal] Total toys:', this._toys.length, 'Collected:', collectedToys.length, 'List:', collectedToys);
		}
	}

	onToySetChanged() {
		const idx = this.toySet && typeof this.toySet.type === 'number' ? this.toySet.type : 0;
		const toyId = (this._toys && this._toys[idx]) || 0;
		if (toyId && this.isCollected(toyId)) {
			this.selectToy(toyId);
		}
	}

	get previewPony(): PalettePonyInfo | undefined {
		// Always check current pony state in case it changed
		const pony = this.model && this.model.pony;
		if (pony && pony.ponyInfo) {
			// Only update cache if different
			// convert to palette form if underlying info changed
			this._previewPony = toPalette(pony.ponyInfo, this.game.paletteManager);
			console.log('[SelectToyModal] Updated previewPony from model');
		}
		return this._previewPony;
	}

	get toys(): number[] {
		return this._toys;
	}

	get toyBitmask(): number {
		// Refresh bitmask on access in case it changed
		if (this.model && this.model.account) {
			const acct: any = this.model.account;
			const toysValue = acct.state && acct.state.toys;
			if (toysValue !== undefined) {
				const newMask = typeof toysValue === 'number' ? toysValue : parseInt(toysValue, 10) || 0;
				if (newMask !== this._toyBitmask) {
					this._toyBitmask = newMask;
					console.log('[SelectToyModal] Updated toyBitmask:', this._toyBitmask, 'from raw:', toysValue);
				}
			}
		}
		return this._toyBitmask;
	}

	// Check if toy ID is collected based on bitmask
	isCollected(toyId: number): boolean {
		// toys array is indexed from 1, bitmask bits are 0-indexed
		const bitIndex = toyId - 1;
		return !!(this.toyBitmask & (1 << bitIndex));
	}

	selectToy(toyId: number) {
		if (!this.isCollected(toyId)) return;
		this.selectedToy = toyId;
		// Update preview pony with toy
		const current = this.previewPony;
		if (current) {
			this._previewPony = { ...current, toy: toyId } as PalettePonyInfo;
			// Force change detection for portrait-box to redraw
			this.changeDetector.markForCheck();
		}
	}

	confirmSelection() {
		// Apply locally and send server action to set toy
		if (this.selectedToy > 0) {
			// ensure preview updates locally
			const current = this.previewPony;
			if (current) {
				this._previewPony = { ...current, toy: this.selectedToy } as PalettePonyInfo;
				this.changeDetector.markForCheck();
			}
			// Call server action to hold toy (Action.DropToy with toy number as param)
			this.game.send(server => server.actionParam(Action.DropToy, this.selectedToy));
		}
		this.closeModal();
	}

	closeModal() {
		this.close.emit();
	}

	getCollectedCount(): number {
		const count = this.toys.filter(t => this.isCollected(t)).length;
		if (count > 0) {
			console.log('[SelectToyModal] Collected count:', count, 'of', this.toys.length);
		}
		return count;
	}
}