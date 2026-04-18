import { Component, DoCheck, OnInit, OnDestroy, ViewChild, TemplateRef, HostListener, Input } from '@angular/core';

import { clamp } from 'lodash';
import { PLAYER_NAME_MAX_LENGTH, PLAYER_DESC_MAX_LENGTH } from '../../../common/constants';
import {
	PonyInfo, PonyObject, PonyState, SocialSiteInfo, ColorExtraSet, ColorExtra, CharacterTag, PonyEye, Eye, Muzzle,
	Iris, ExpressionExtra
} from '../../../common/interfaces';
import { findById, toInt, cloneDeep, delay } from '../../../common/utils';
import {
	SLEEVED_ACCESSORIES, frontHooves, mergedBackManes, mergedManes, mergedFacialHair, mergedEarAccessories,
	mergedChestAccessories, mergedFaceAccessories, mergedBackAccessories, mergedExtraAccessories, mergedHeadAccessories
} from '../../../client/ponyUtils';
import { defaultPonyState, defaultDrawPonyOptions } from '../../../client/ponyHelpers';
import { toPalette, getBaseFill, syncLockedPonyInfo } from '../../../common/ponyInfo';
import * as sprites from '../../../generated/sprites';
import { boop, trot, stand, sitDownUp, lieDownUp, fly, flyBug } from '../../../client/ponyAnimations';
import { drawCanvas } from '../../../graphics/contextSpriteBatch';
import { Model, getPonyTag } from '../../services/model';
import { loadAndInitSpriteSheets, addTitles, createEyeSprite, addLabels } from '../../../client/spriteUtils';
import { GameService } from '../../services/gameService';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { TRANSPARENT, BLACK, blushColor } from '../../../common/colors';
import { precompressPony, compressPonyString, decompressPony, decompressPonyString } from '../../../common/compressPony';
import { saveCanvas } from '../../../client/canvasUtils';
import { drawPony } from '../../../client/ponyDraw';
import { getProviderIcon } from '../../shared/sign-in-box/sign-in-box';
import { faPlay, faLock, faRedo, faSave, faCode, faInfoCircle, faPaintBrush, faHorseHead, faRetweet, faSearch, faUndo, faEraser, faSlash, faFont, faStar } from '../../../client/icons';
import { isFileSaverSupported, createExpression, readFileAsText } from '../../../client/clientUtils';
import { isMobile } from '../../../client/data';
import { emptyTag, getAvailableTags } from '../../../common/tags';
import { ButtMarkEditorState } from '../../shared/butt-mark-editor/butt-mark-editor';
import { parseColorWithAlpha } from '../../../common/color';

const frontHoofTitles = ['', 'Fetlocks', 'Paws', 'Claws', ''];
const backHoofTitles = ['', 'Fetlocks', 'Paws', '', ''];

const horns = addLabels(sprites.horns, [
	'None', 'Unicorn horn', 'Short unicorn horn', 'Curved unicorn horn', 'Tiny deer antlers',
	'Short deer antlers', 'Medium deer antlers', 'Large deer antlers', 'Raindeer antlers', 'Goat horns',
	'Ram horns', 'Buffalo horns', 'Moose horns', 'Bug antenna', 'Long unicorn horn',
]);

const wings = addLabels(sprites.wings[0]!, [
	'None', 'Pegasus wings', 'Bat wings', 'Gryphon wings', 'Bug wings'
]);

const ears = addLabels(sprites.ears, [
	'Regular ears', 'Fluffy ears', 'Long feathered ears', 'Bug ears', 'Short feathered ears', 'Deer ears',
]);

const noses = addTitles(sprites.noses[0], ['Pony muzzle', 'Gryphon beak', 'Deer nose']);

const flyAnimations = [{ ...stand, name: 'fly' }, fly, fly, fly, { ...flyBug, name: 'fly' }];

function eyeSprite(e: PonyEye | undefined) {
	return createEyeSprite(e, 0, sprites.defaultPalette);
}

interface CharacterUndoState {
	pony: PonyObject;
	previewScale: number;
	hidePreviewName: boolean;
	hidePreviewTag: boolean;
	showBackground: boolean;
}

@Component({
	selector: 'character',
	templateUrl: 'character.pug',
	styleUrls: ['character.scss'],
})
export class Character implements DoCheck, OnInit, OnDestroy {
	@ViewChild('characterPreview', { static: true }) characterPreview!: any;
	@Input() inGameMode = false;
	readonly debug = DEVELOPMENT || BETA;
	previewScale: number = 3;
	showBackground = false;
	hidePreviewName = false;
	hidePreviewTag = false;

	readonly playIcon = faPlay;
	readonly resetIcon = faRedo;
	readonly undoIcon = faUndo;
	readonly redoIcon = faRedo;
	readonly saveIcon = faSave;
	readonly codeIcon = faCode;
	readonly lockIcon = faLock;
	readonly infoIcon = faInfoCircle;
	readonly paintBrushIcon = faPaintBrush;
	readonly horseHeadIcon = faHorseHead;
	readonly flipIcon = faRetweet;
	readonly searchIcon = faSearch;
	readonly eraserIcon = faEraser;
	readonly nameIcon = faFont;
	readonly tagIcon = faCode;
	readonly slashIcon = faSlash;
	readonly starIcon = faStar;
	readonly maxNameLength = PLAYER_NAME_MAX_LENGTH;
	readonly maxDescLength = PLAYER_DESC_MAX_LENGTH;
	readonly horns = horns;
	readonly manes = mergedManes;
	readonly backManes = mergedBackManes;
	readonly tails = sprites.tails[0];
	readonly wings = wings;
	readonly ears = ears;
	readonly facialHair = mergedFacialHair;
	readonly headAccessories = mergedHeadAccessories;
	readonly earAccessories = mergedEarAccessories;
	readonly faceAccessories = mergedFaceAccessories;
	readonly neckAccessories = sprites.neckAccessories[1];
	readonly frontLegAccessories = sprites.frontLegAccessories[1];
	readonly backLegAccessories = sprites.backLegAccessories[1];
	readonly backAccessories = mergedBackAccessories;
	readonly chestAccessories = mergedChestAccessories;
	readonly sleeveAccessories = sprites.frontLegSleeves[1];
	readonly waistAccessories = sprites.waistAccessories[1];
	readonly extraAccessories = mergedExtraAccessories;
	readonly bodyPatterns = sprites.body[1];
	readonly frontLegPatterns = sprites.frontLegs[1];
	readonly backLegPatterns = sprites.backLegs[1];
	readonly frontHooves = addTitles(frontHooves[1], frontHoofTitles);
	readonly backHooves = addTitles(sprites.backLegHooves[1], backHoofTitles);
	readonly animations = [
		() => stand,
		() => trot,
		() => boop,
		() => sitDownUp,
		() => lieDownUp,
		() => flyAnimations[this.previewInfo!.wings!.type || 0],
	];
	readonly eyelashes: ColorExtraSet = sprites.eyeLeft[1]!.map(eyeSprite);
	readonly eyesLeft: ColorExtraSet = sprites.eyeLeft.map(e => e && e[0]).map(eyeSprite);
	readonly eyesRight: ColorExtraSet = sprites.eyeRight.map(e => e && e[0]).map(eyeSprite);
	readonly noses = noses;
	readonly heads = sprites.head1[1];
	readonly buttMarkState: ButtMarkEditorState = {
		brushType: 'brush',
		brush: 'orange',
	};
	muzzles: ColorExtraSet;
	fangs: ColorExtraSet;
	tags: CharacterTag[] = [
		emptyTag,
	];
	state = defaultPonyState();
	saved: PonyInfo[] = [];
	activeAnimation = 0;
	loaded = false;
	playAnimation = true;
	deleting = false;
	fixed = false;
	previewExtra = false;
	previewMagic = false;
	previewPony: PonyObject | undefined = undefined;
	sites: SocialSiteInfo[] = [];
	error?: string;
	canSaveFiles = isFileSaverSupported();
	importedPonies: PonyObject[] = [];
	pendingImportModal?: BsModalRef;
	private savingLocked = false;
	private interval?: any;
	private syncTimeout?: any;
	private animationTime = 0;
	private undoHistory: CharacterUndoState[] = [];
	private redoHistory: CharacterUndoState[] = [];
	private currentUndoState?: CharacterUndoState;
	private currentUndoStateKey = '';
	private applyingUndoRedo = false;
	private suppressUndoCapture = false;
	private colorDragActive = false;
	private colorDragStartState?: CharacterUndoState;
	private colorDragStartKey = '';
	private colorDragStartUndoLength = 0;
	constructor(private gameService: GameService, private model: Model, private modalService: BsModalService) {
		this.createMuzzles();
		this.updateMuzzles();
	}

	private getMuzzleType() {
		return clamp(toInt(this.info && this.info.nose && this.info.nose.type), 0, sprites.noses[0].length);
	}
	createMuzzles() {
		const type = this.getMuzzleType();
		const happy = sprites.noses[0][type][0];

		this.muzzles = sprites.noses
			.slice()
			.map(n => n[type][0])
			.map(({ color, colors, mouth }) => ({ color, colors, extra: mouth, palettes: [sprites.defaultPalette] } as ColorExtra));

		this.fangs = [undefined, { color: happy.color, colors: 3, extra: happy.fangs, palettes: [sprites.defaultPalette] }];
	}
	updateMuzzles() {
		const type = this.getMuzzleType();
		const happy = sprites.noses[0][type][0];

		this.muzzles!.forEach((m, i) => {
			if (m) {
				const { color, colors, mouth } = sprites.noses[i][type][0];
				m.color = color;
				m.colors = colors;
				m.extra = mouth;
				m.timestamp = Date.now();
			}
		});

		const fangs = this.fangs![1]!;
		fangs.color = happy.color;
		fangs.extra = happy.fangs;
		fangs.timestamp = Date.now();
	}
	get account() {
		return this.model.account;
	}
	get loading() {
		return this.model.loading || this.model.updating;
	}
	get updateWarning() {
		return this.gameService.updateWarning;
	}
	get playing() {
		return !this.inGameMode && this.gameService.playing;
	}
	get previewInfo() {
		return this.previewPony ? this.previewPony.ponyInfo : this.pony.ponyInfo;
	}
	get previewName() {
		return this.previewPony ? this.previewPony.name : this.pony.name;
	}
	get previewTag() {
		return getPonyTag(this.previewPony || this.pony, this.account);
	}
	get customOutlines() {
		return this.info.customOutlines;
	}
	get hasCustomPreviewBackground() {
		return !!this.info.previewBackground && this.info.previewBackground !== '90ee90';
	}
	get hasCustomPreviewSettings() {
		return this.previewScale !== 3 || !!this.info.headTurned || !!this.info.flip || this.hidePreviewName || this.hidePreviewTag;
	}
	get hasCustomBlushColor() {
		return !!this.info.blushColor && this.info.blushColor !== 'ff89ae';
	}
	get hasCustomEffects() {
		return !!this.info.blush || !!this.info.sleeping || !!this.info.tears || !!this.info.crying || !!this.info.hearts || this.previewMagic;
	}
	get canUseMagicEffect() {
		return !!(this.info.horn && this.info.horn.type);
	}
	get canUseEffects() {
		return this.model.supporter >= 2;
	}
	resetPreview() {
		this.previewScale = 3;
		this.info.headTurned = false;
		this.info.flip = false;
		this.hidePreviewName = false;
		this.hidePreviewTag = false;
		this.changed();
	}
	resetEffects() {
		this.info.blush = false;
		this.info.sleeping = false;
		this.info.tears = false;
		this.info.crying = false;
		this.info.hearts = false;
		this.previewMagic = false;
		this.changed();
	}
	get canTogglePreviewTag() {
		return this.tags.length > 1 || !!(this.account && this.account.supporter);
	}
	get ponies() {
		return this.model.ponies;
	}
	get pony() {
		return this.model.pony;
	}
	set pony(value: PonyObject) {
		this.model.selectPony(value);
	}
	get info() {
		return this.pony.ponyInfo!;
	}
	get maneFill() {
		return getBaseFill(this.info.mane);
	}
	get coatFill() {
		return this.info.coatFill;
	}
	get hoovesFill() {
		return getBaseFill(this.info.frontHooves);
	}
	get canExport() {
		return DEVELOPMENT;
	}
	get site() {
		return findById(this.sites, this.pony.site) || this.sites[0];
	}
	set site(value: SocialSiteInfo) {
		this.pony.site = value.id;
	}
	get tag() {
		return findById(this.tags, this.pony.tag) || this.tags[0];
	}
	set tag(value: CharacterTag) {
		this.pony.tag = value.id;
	}
	get lockEyeWhites() {
		return !this.info.unlockEyeWhites;
	}
	set lockEyeWhites(value) {
		this.info.unlockEyeWhites = !value;
	}
	get darken() {
		return !this.info.freeOutlines;
	}
	get lockFrontLegAccessory() {
		return !this.info.unlockFrontLegAccessory;
	}
	set lockFrontLegAccessory(value) {
		this.info.unlockFrontLegAccessory = !value;
	}
	get lockBackLegAccessory() {
		return !this.info.unlockBackLegAccessory;
	}
	set lockBackLegAccessory(value) {
		this.info.unlockBackLegAccessory = !value;
	}
	get lockFrontHooves() {
		return !this.info.unlockFrontHooves;
	}
	set lockFrontHooves(value) {
		this.info.unlockFrontHooves = !value;
	}
	get lockBackHooves() {
		return !this.info.unlockBackHooves;
	}
	set lockBackHooves(value) {
		this.info.unlockBackHooves = !value;
	}
	get lockBackLegs() {
		return this.info.lockBackLegs !== false;
	}
	set lockBackLegs(value: boolean) {
		this.info.lockBackLegs = value;
	}
	get lockBodyMarkings() {
		return !this.info.unlockBody;
	}
	set lockBodyMarkings(value: boolean) {
		this.info.unlockBody = !value;
	}
	get lockFrontLegsMarkings() {
		return !this.info.unlockFrontLegs;
	}
	set lockFrontLegsMarkings(value: boolean) {
		this.info.unlockFrontLegs = !value;
	}
	get lockBackLegsMarkings() {
		return !this.info.unlockBackLegs;
	}
	set lockBackLegsMarkings(value: boolean) {
		this.info.unlockBackLegs = !value;
	}
	get useExtraEarAccessory() {
		return !!(this.info.earAccessoryExtra && this.info.earAccessoryExtra.type);
	}
	set useExtraEarAccessory(value) {
		if (value) {
			if (!this.info.earAccessoryExtra) {
				this.info.earAccessoryExtra = cloneDeep(this.info.earAccessory);
			}
			if (!this.info.earAccessoryExtra!.type) {
				this.info.earAccessoryExtra!.type = (this.info.earAccessory && this.info.earAccessory.type) || 1;
			}
		} else if (this.info.earAccessoryExtra) {
			this.info.earAccessoryExtra.type = 0;
			this.info.earAccessoryExtra.pattern = 0;
		}
	}
	get useExtraFaceAccessory() {
		return !!(this.info.faceAccessoryExtra && this.info.faceAccessoryExtra.type);
	}
	set useExtraFaceAccessory(value) {
		if (value) {
			if (!this.info.faceAccessoryExtra) {
				this.info.faceAccessoryExtra = cloneDeep(this.info.faceAccessory);
			}
			if (!this.info.faceAccessoryExtra!.type) {
				this.info.faceAccessoryExtra!.type = (this.info.faceAccessory && this.info.faceAccessory.type) || 1;
			}
		} else if (this.info.faceAccessoryExtra) {
			this.info.faceAccessoryExtra.type = 0;
			this.info.faceAccessoryExtra.pattern = 0;
		}
	}
	get lockEars() {
		return !this.info.unlockEars;
	}
	set lockEars(value) {
		this.info.unlockEars = !value;
	}
	get lockWings() {
		return !this.info.unlockWings;
	}
	set lockWings(value) {
		this.info.unlockWings = !value;
	}
	get lockSleeveAccessory() {
		return !this.info.unlockSleeveAccessory;
	}
	set lockSleeveAccessory(value) {
		this.info.unlockSleeveAccessory = !value;
	}
	get lockWaistAccessory() {
		return !this.info.unlockWaistAccessory;
	}
	set lockWaistAccessory(value) {
		this.info.unlockWaistAccessory = !value;
	}
	get lockEyelashColor() {
		return !this.info.unlockEyelashColor;
	}
	set lockEyelashColor(value) {
		this.info.unlockEyelashColor = !value;
	}
	get lockEyeshadowColor() {
		return !this.info.unlockEyeshadowColor;
	}
	set lockEyeshadowColor(value) {
		this.info.unlockEyeshadowColor = !value;
	}
	icon(id: string) {
		return getProviderIcon(id);
	}
	hasSleeves(type: number) {
		return SLEEVED_ACCESSORIES.indexOf(type) !== -1;
	}
	ngOnInit() {
		if (this.model.account) {
			this.tags.push(...getAvailableTags(this.model.account));
		}

		this.sites = this.model.sites.filter(s => !!s.name);
		this.updateMuzzles();
		this.syncPreviewHeadTurnState();

		let last = Date.now();

		this.resetUndoHistory();

		return loadAndInitSpriteSheets().then(() => {
			this.loaded = true;
			this.interval = setInterval(() => {
				const now = Date.now();
				this.update((now - last) / 1000);
				last = now;
			}, 1000 / 24);
		});
	}
	ngOnDestroy() {
		clearInterval(this.interval);
	}
	ngDoCheck() {
		if (!this.applyingUndoRedo && !this.suppressUndoCapture && !this.colorDragActive) {
			this.captureUndoStep();
		}
	}
	get canUndo() {
		return this.undoHistory.length > 0;
	}
	get canRedo() {
		return this.redoHistory.length > 0;
	}
	get isMobile() {
		return isMobile;
	}
	private matchesKey(event: KeyboardEvent, code: string, keyCode: number) {
		return event.code === code || event.keyCode === keyCode || (event as any).which === keyCode;
	}
	@HostListener('window:keydown', ['$event'])
	onKeyDown(event: KeyboardEvent) {
		if (this.playing) return;
		const tag = ((event.target as HTMLElement) && (event.target as HTMLElement).tagName || '').toUpperCase();
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		if (event.ctrlKey || event.metaKey) {
			if (this.matchesKey(event, 'KeyZ', 90)) {
				event.preventDefault();
				this.undo();
			} else if (this.matchesKey(event, 'KeyY', 89)) {
				event.preventDefault();
				this.redo();
			}
			return;
		}
		if (!this.info) return;

		if (this.matchesKey(event, 'KeyH', 72)) {
			event.preventDefault();
			this.toggleHeadTurned();
			return;
		}

		if (this.matchesKey(event, 'KeyA', 65)) {
			if (this.info.flip) {
				event.preventDefault();
				this.info.flip = false;
				this.changed();
			}
			return;
		}

		if (this.matchesKey(event, 'KeyD', 68)) {
			if (!this.info.flip) {
				event.preventDefault();
				this.info.flip = true;
				this.changed();
			}
			return;
		}

		if (this.matchesKey(event, 'KeyG', 71)) {
			event.preventDefault();
			this.previewScale = this.previewScale >= 7 ? 1 : this.previewScale + 1;
			this.changed();
			return;
		}

		if (this.matchesKey(event, 'KeyF', 70)) {
			event.preventDefault();
			this.previewScale = this.previewScale <= 1 ? 7 : this.previewScale - 1;
			this.changed();
			return;
		}

		if (this.matchesKey(event, 'KeyY', 89)) {
			event.preventDefault();
			this.toggleHidePreviewName();
			return;
		}

		if (this.matchesKey(event, 'KeyT', 84)) {
			event.preventDefault();
			this.toggleHidePreviewTag();
			return;
		}
	}
	private createUndoPonySnapshot() {
		const pony = cloneDeep(this.pony);

		if (pony.ponyInfo) {
			pony.info = compressPonyString(pony.ponyInfo);
		}

		return pony;
	}
	private createUndoState(): CharacterUndoState {
		return {
			pony: this.createUndoPonySnapshot(),
			previewScale: this.previewScale,
			hidePreviewName: this.hidePreviewName,
			hidePreviewTag: this.hidePreviewTag,
			showBackground: this.showBackground,
		};
	}
	private getUndoStateKey(state: CharacterUndoState) {
		return JSON.stringify(state);
	}
	private resetUndoHistory() {
		this.undoHistory = [];
		this.redoHistory = [];
		this.suppressUndoCapture = false;
		this.colorDragActive = false;
		this.colorDragStartState = undefined;
		this.colorDragStartKey = '';
		this.colorDragStartUndoLength = 0;
		this.currentUndoState = this.createUndoState();
		this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
	}
	private captureUndoStep() {
		if (this.colorDragActive) {
			return;
		}

		const currentState = this.createUndoState();
		const currentStateKey = this.getUndoStateKey(currentState);

		if (!this.currentUndoState) {
			this.currentUndoState = currentState;
			this.currentUndoStateKey = currentStateKey;
			return;
		}

		if (currentStateKey === this.currentUndoStateKey) {
			return;
		}

		this.undoHistory.push(this.currentUndoState);
		if (this.undoHistory.length > 100) {
			this.undoHistory.shift();
		}
		this.redoHistory = [];
		this.currentUndoState = currentState;
		this.currentUndoStateKey = currentStateKey;
	}
	private applyUndoState(state: CharacterUndoState) {
		this.deleting = false;
		this.pony = cloneDeep(state.pony);
		this.previewScale = state.previewScale;
		this.hidePreviewName = state.hidePreviewName;
		this.hidePreviewTag = state.hidePreviewTag;
		this.showBackground = state.showBackground;
		this.updateMuzzles();
	}
	undo() {
		if (!this.canUndo) return;
		this.applyingUndoRedo = true;
		this.suppressUndoCapture = false;
		this.colorDragActive = false;
		if (this.currentUndoState) {
			this.redoHistory.push(cloneDeep(this.currentUndoState));
		}
		const snapshot = cloneDeep(this.undoHistory.pop()!);
		this.applyUndoState(snapshot);
		this.currentUndoState = this.createUndoState();
		this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
		this.changed();
		this.applyingUndoRedo = false;
	}
	redo() {
		if (!this.canRedo) return;
		this.applyingUndoRedo = true;
		this.suppressUndoCapture = false;
		this.colorDragActive = false;
		if (this.currentUndoState) {
			this.undoHistory.push(cloneDeep(this.currentUndoState));
			if (this.undoHistory.length > 100) {
				this.undoHistory.shift();
			}
		}
		const snapshot = cloneDeep(this.redoHistory.pop()!);
		this.applyUndoState(snapshot);
		this.currentUndoState = this.createUndoState();
		this.currentUndoStateKey = this.getUndoStateKey(this.currentUndoState);
		this.changed();
		this.applyingUndoRedo = false;
	}
	// called every tick during color drag — updates preview but does NOT push undo
	beginColorChange() {
		if (!this.colorDragActive) {
			const startState = this.currentUndoState ? cloneDeep(this.currentUndoState) : this.createUndoState();
			this.colorDragStartState = startState;
			this.colorDragStartKey = this.getUndoStateKey(startState);
			this.colorDragStartUndoLength = this.undoHistory.length;
		}
		this.colorDragActive = true;
		this.suppressUndoCapture = true;
	}
	colorChanged() {
		this.suppressUndoCapture = true;
		this.renderChanged();
	}
	// called when color drag ends or manual input commits — pushes undo step
	colorChangeDone() {
		this.suppressUndoCapture = false;
		const currentState = this.createUndoState();
		const currentStateKey = this.getUndoStateKey(currentState);

		if (this.colorDragActive && this.colorDragStartState) {
			if (this.undoHistory.length > this.colorDragStartUndoLength) {
				this.undoHistory.splice(this.colorDragStartUndoLength);
			}

			if (currentStateKey !== this.colorDragStartKey) {
				this.undoHistory.push(cloneDeep(this.colorDragStartState));
				if (this.undoHistory.length > 100) {
					this.undoHistory.shift();
				}
				this.redoHistory = [];
			}
			this.currentUndoState = currentState;
			this.currentUndoStateKey = currentStateKey;
		} else if (!this.applyingUndoRedo) {
			this.captureUndoStep();
		}

		this.colorDragActive = false;
		this.colorDragStartState = undefined;
		this.colorDragStartKey = '';
		this.colorDragStartUndoLength = 0;
		this.renderChanged();
	}
	changed() {
		this.suppressUndoCapture = false;
		this.colorDragActive = false;
		this.colorDragStartState = undefined;
		this.colorDragStartKey = '';
		this.colorDragStartUndoLength = 0;
		if (!this.applyingUndoRedo) {
			this.captureUndoStep();
		}
		this.renderChanged();
	}
	private renderChanged() {
		// normalize a few fields to prevent invalid UI state (e.g. strings or out-of-range numbers)
		this.info.flip = !!this.info.flip;
		this.info.headTurned = !!this.info.headTurned;
		this.info.headTurn = Math.max(0, Math.min(6, (this.info.headTurn === undefined ? 0 : (this.info.headTurn as any) | 0)));
		if (!this.canUseMagicEffect) {
			this.previewMagic = false;
		}
		if (!this.canUseEffects) {
			this.info.blush = false;
			this.info.sleeping = false;
			this.info.tears = false;
			this.info.crying = false;
			this.info.hearts = false;
			this.previewMagic = false;
		}

		// if head is forced turned by default, keep headTurn at 0 to avoid large offsets
		if (this.info.headTurned) {
			this.info.headTurn = 0;
		}

		if (!this.syncTimeout) {
			this.syncTimeout = requestAnimationFrame(() => {
				this.syncTimeout = undefined;
				this.syncPreviewHeadTurnState();
				// force preview redraw so flip/head settings apply immediately
				try { this.characterPreview && this.characterPreview.redraw && this.characterPreview.redraw(); } catch { }
				syncLockedPonyInfo(this.info);
			});
		}

		if (DEVELOPMENT || BETA) {
			this.state.blushColor = this.info.blushColor ? parseColorWithAlpha(this.info.blushColor, 1) : blushColor(parseColorWithAlpha(this.coatFill || '', 1));
		}
	}
	update(delta: number) {
		this.animationTime += delta;

		const animation = this.animations[this.activeAnimation]();
		this.state.animation = animation;

		if (this.playAnimation) {
			this.state.animationFrame = Math.floor(this.animationTime * animation.fps) % animation.frames.length;
		}
	}
	copyCoatColorToTail() {
		if (this.info.tail && this.info.tail.fills) {
			this.info.tail.fills[0] = this.info.coatFill;
			this.changed();
		}
	}

	resetBackground() {
		// default green (matches GRASS_COLOR = 0x90ee90ff)
		this.info.previewBackground = '90ee90';
		this.changed();
	}

	resetBlush() {
		this.info.blushColor = 'ff89ae';
		this.changed();
	}

	toggleBlushEffect() {
		this.info.blush = !this.info.blush;
		this.changed();
	}

	toggleSleepingEffect() {
		this.info.sleeping = !this.info.sleeping;
		this.changed();
	}

	toggleTearsEffect() {
		this.info.tears = !this.info.tears;
		if (this.info.tears) {
			this.info.crying = false;
		}
		this.changed();
	}

	toggleCryingEffect() {
		this.info.crying = !this.info.crying;
		if (this.info.crying) {
			this.info.tears = false;
		}
		this.changed();
	}

	toggleHeartsEffect() {
		this.info.hearts = !this.info.hearts;
		this.changed();
	}

	toggleMagicEffect() {
		if (!this.canUseMagicEffect) return;
		this.previewMagic = !this.previewMagic;
		this.changed();
	}

	toggleBackground() {
		this.showBackground = !this.showBackground;
		this.changed();
	}

	toggleHidePreviewName() {
		this.hidePreviewName = !this.hidePreviewName;
		this.changed();
	}

	toggleHidePreviewTag() {
		this.hidePreviewTag = !this.hidePreviewTag;
		this.changed();
	}

	toggleHeadTurned() {
		this.info.headTurned = !this.info.headTurned;
		this.syncPreviewHeadTurnState();
		this.changed();
	}

	private syncPreviewHeadTurnState() {
		const turned = !!this.info.headTurned;
		this.state.headTurned = turned;
		if (turned) {
			this.state.headTurn = 0;
		}
	}

	toggleFlip() {
		this.info.flip = !this.info.flip;
		this.changed();
	}

	eyeColorLockChanged(locked: boolean) {
		if (locked) {
			this.info.eyeColorLeft = this.info.eyeColorRight;
		}
	}
	eyeWhiteLockChanged(locked: boolean) {
		if (locked) {
			this.info.eyeWhitesLeft = this.info.eyeWhites;
		}
	}
	eyeOpennessChanged(locked: boolean) {
		if (locked) {
			this.info.eyeOpennessLeft = this.info.eyeOpennessRight;
		}
	}
	eyelashLockChanged(locked: boolean) {
		if (locked) {
			this.info.eyelashColorLeft = this.info.eyelashColor;
		}
	}
	eyeshadowLockChanged(locked: boolean) {
		if (locked) {
			this.info.eyeshadowLeft = this.info.eyeshadow;
			this.info.eyeshadowColorLeft = this.info.eyeshadowColor;
		}
	}
	earsLockChanged(locked: boolean) {
		if (locked) {
			this.info.earsRight = cloneDeep(this.info.ears);
		} else {
			this.info.earsRight = cloneDeep(this.info.earsRight || this.info.ears);
		}
	}
	wingsLockChanged(locked: boolean) {
		if (locked) {
			this.info.wingsRight = cloneDeep(this.info.wings);
		} else {
			this.info.wingsRight = cloneDeep(this.info.wingsRight || this.info.wings);
		}
	}
	sleeveLockChanged(locked: boolean) {
		if (locked) {
			this.info.sleeveAccessoryRight = cloneDeep(this.info.sleeveAccessory);
		} else {
			this.info.sleeveAccessoryRight = cloneDeep(this.info.sleeveAccessoryRight || this.info.sleeveAccessory);
		}
	}
	waistLockChanged(locked: boolean) {
		if (locked) {
			this.info.waistAccessoryRight = cloneDeep(this.info.waistAccessory);
		} else {
			this.info.waistAccessoryRight = cloneDeep(this.info.waistAccessoryRight || this.info.waistAccessory);
		}
	}
	bodyLockChanged(locked: boolean) {
		if (locked) {
			this.info.bodyRight = cloneDeep(this.info.body);
		} else {
			this.info.bodyRight = cloneDeep(this.info.bodyRight || this.info.body);
		}
	}
	frontLegsLockChanged(locked: boolean) {
		if (locked) {
			this.info.frontLegsRight = cloneDeep(this.info.frontLegs);
		} else {
			this.info.frontLegsRight = cloneDeep(this.info.frontLegsRight || this.info.frontLegs);
		}
	}
	frontHoovesLockChanged(locked: boolean) {
		if (locked) {
			this.info.frontHoovesRight = cloneDeep(this.info.frontHooves);
		} else {
			this.info.frontHoovesRight = cloneDeep(this.info.frontHoovesRight || this.info.frontHooves);
		}
	}
	backHoovesPairChanged(locked: boolean) {
		if (locked) {
			this.info.backHooves = cloneDeep(this.info.frontHooves);
			this.info.backHoovesRight = cloneDeep(this.lockFrontHooves ? this.info.frontHooves : this.info.frontHoovesRight);
		}
	}
	backHoovesLockChanged(locked: boolean) {
		if (locked) {
			this.info.backHoovesRight = cloneDeep(this.info.backHooves);
		} else {
			this.info.backHoovesRight = cloneDeep(this.info.backHoovesRight || this.info.backHooves);
		}
	}
	backLegsPairChanged(locked: boolean) {
		if (locked) {
			this.info.backLegs = cloneDeep(this.info.frontLegs);
			const sourceRight = this.lockFrontLegsMarkings ? this.info.frontLegs : this.info.frontLegsRight;
			this.info.backLegsRight = cloneDeep(sourceRight);
		} else {
			this.info.backLegs = cloneDeep(this.info.backLegs || this.info.frontLegs);

			if (this.lockBackLegsMarkings) {
				this.info.backLegsRight = cloneDeep(this.info.backLegs);
			} else {
				this.info.backLegsRight = cloneDeep(this.info.backLegsRight || this.info.backLegs);
			}
		}
	}
	backLegsLockChanged(locked: boolean) {
		if (locked) {
			this.info.backLegsRight = cloneDeep(this.info.backLegs);
		} else {
			this.info.backLegsRight = cloneDeep(this.info.backLegsRight || this.info.backLegs);
		}
	}
	select(pony: PonyObject | undefined) {
		if (pony) {
			this.deleting = false;
			this.pony = pony;
			this.resetUndoHistory();
		}
	}

	setActiveAnimation(index: number) {
		this.activeAnimation = index;
		this.animationTime = 0;
	}
	freeOutlinesChanged(_free: boolean) {
		this.changed();
	}
	darkenLockedOutlinesChanged(_darken: boolean) {
		this.changed();
	}
	get canSave() {
		return !this.model.pending && !!this.pony && !!this.pony.name && !this.savingLocked;
	}
	save() {
		if (this.canSave) {
			this.error = undefined;
			this.deleting = false;
			this.savingLocked = true;

			this.model.savePony(this.pony)
				.catch((e: Error) => this.error = e.message)
				.then((savedPony) => {
					if (savedPony) {
						this.resetUndoHistory();
					}
					return savedPony;
				})
				.then(() => delay(2000))
				.then(() => this.savingLocked = false);
		}
	}
	get canRevert() {
		return !!findById(this.ponies, this.pony.id);
	}
	revert() {
		if (this.canRevert) {
			this.select(findById(this.ponies, this.pony.id));
		}
	}
	get canDuplicate() {
		return this.ponies.length < this.model.characterLimit;
	}
	duplicate() {
		if (this.canDuplicate) {
			this.deleting = false;
			this.pony = cloneDeep(this.pony);
			this.pony.name = '';
			this.pony.id = '';
			this.resetUndoHistory();
		}
	}
	export(index?: number) {
		const frameWidth = 80;
		const frameHeight = 90;
		const animations = index === undefined ? this.animations.map(a => a()) : [this.animations[index]()];
		const frames = animations.reduce((sum, a) => sum + a.frames.length, 0);
		const info = toPalette(this.info);
		const options = defaultDrawPonyOptions();

		const canvas = drawCanvas(frameWidth * frames, frameHeight, sprites.paletteSpriteSheet, TRANSPARENT, batch => {
			let i = 0;

			animations.forEach(a => {
				for (let f = 0; f < a.frames.length; f++ , i++) {
					const state: PonyState = {
						...defaultPonyState(),
						animation: a,
						animationFrame: f,
						blinkFrame: 1,
					};

					drawPony(batch, info, state, i * frameWidth + frameWidth / 2, frameHeight - 10, options);
				}
			});
		});

		const name = animations.length === 1 ? animations[0].name : 'all';
		saveCanvas(canvas, `${this.pony.name}-${name}.png`);
	}
	import() {
		if (DEVELOPMENT) {
			const data = prompt('enter data');

			if (data) {
				this.importPony(data);
			}
		}
	}
	private importPony(data: string) {
		if (DEVELOPMENT) {
			this.pony.ponyInfo = decompressPonyString(data, true);
			const t = decompressPonyString(data, false);
			console.log(JSON.stringify(t, undefined, 2));
		}
	}
	addBlush() {
		if (DEVELOPMENT || BETA) {
			this.state = {
				...this.state,
				expression: createExpression(Eye.Neutral, Eye.Neutral, Muzzle.Smile, Iris.Forward, Iris.Forward, ExpressionExtra.Blush),
			};
			this.changed();
		}
	}
	testSize() {
		function stringifyValues(values: any[]): string {
			return values.map(x => JSON.stringify(x)).join(typeof values[0] === 'object' ? ',\n\t' : ', ');
		}

		if (DEVELOPMENT) {
			const compressed = compressPonyString(this.info);
			const regularSize = JSON.stringify(this.info).length;
			const ponyInfoNumber = decompressPony(compressed);
			const precomp = precompressPony(ponyInfoNumber, BLACK, x => x) as any;
			const details = Object.keys(precomp)
				.filter(key => key !== 'version')
				.map(key => ({ key, values: precomp[key] || [] as any[] }))
				.map(({ key, values }) => `${key}: [\n\t${stringifyValues(values)}\n]`)
				.join(',\n');
			const serialized = compressPonyString(this.info);

			console.log(serialized);
			console.log(details);
			console.log(`${serialized.length} / ${regularSize}`);
		}
	}
	testJSON() {
		if (DEVELOPMENT) {
			console.log(JSON.stringify(this.info, undefined, 2));
		}
	}
	exportPony() {
		const data = ponyToExport(this.pony) + '\r\n';
		saveAs(new Blob([data], { type: 'text/plain;charset=utf-8' }), `${this.pony.name}.txt`);
	}
	exportPonies() {
		const data = this.ponies.map(ponyToExport).join('\r\n') + '\r\n';
		saveAs(new Blob([data], { type: 'text/plain;charset=utf-8' }), 'ponies.txt');
	}
	async importPonies(file: File | undefined) {
		if (file) {
			const text = await readFileAsText(file);
			const lines = text.split(/\r?\n/g);
			const imported: PonyObject[] = [];

			for (const line of lines) {
				try {
					const [name, info, desc = ''] = line.split(/\t/g);

					if (name && info) {
						const pony: PonyObject = {
							name,
							id: '',
							info,
							desc,
							ponyInfo: decompressPonyString(info, true),
						};

						await this.model.savePony(pony, true);
						imported.push(pony);
					}
				} catch (e) {
					DEVELOPMENT && console.error(e);
				}
			}

			if (imported.length > 0) {
				this.importedPonies = imported;
				this.showImportedModal();
			}
		}
	}

	private showImportedModal() {
		const modalTpl = this.getImportedModalTemplate();
		this.pendingImportModal = this.modalService.show(modalTpl, { class: 'modal-lg' });
	}

	private getImportedModalTemplate(): TemplateRef<any> {
		return (this as any).importedModalTpl;
	}

	acceptImport() {
		this.importedPonies = [];
		if (this.pendingImportModal) {
			this.pendingImportModal.hide();
		}
	}

	rejectImport() {
		this.importedPonies.forEach(pony => {
			this.model.removePony(pony).catch(e => {
				DEVELOPMENT && console.error('Failed to delete imported pony:', e);
			});
		});
		this.importedPonies = [];
		if (this.pendingImportModal) {
			this.pendingImportModal.hide();
		}
	}
}

function ponyToExport(pony: PonyObject) {
	return `${pony.name}\t${pony.info}\t${pony.desc || ''}`.trim();
}
