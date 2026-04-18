import { Component, ElementRef, NgZone, AfterViewInit, ViewChild, OnDestroy, Input, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { ChatType, MessageType, isPartyChat, Entity, FakeEntity, isTypingIndicatorMessage } from '../../../common/interfaces';
import { SAY_MAX_LENGTH } from '../../../common/constants';
import { Key } from '../../../client/input/input';
import { PonyTownGame } from '../../../client/game';
import { cleanMessage, isSpamMessage } from '../../../client/clientUtils';
import { faComment, faAngleDoubleRight } from '../../../client/icons';
import { isInParty } from '../../../client/partyUtils';
import { handleActionCommand } from '../../../client/playerActions';
import { hasHeadAnimation } from '../../../common/pony';
import { AutocompleteState, autocompleteMesssage, replaceEmojis, emojis } from '../../../client/emoji';
import { replaceNodes } from '../../../client/htmlUtils';
import { invalidEnumReturn } from '../../../common/utils';
import { isAdmin, isMod } from '../../../common/accountUtils';
import { isMobile } from '../../../client/data';
import { findMatchingEntityNames, findEntityOrMockByAnyMeans, findBestEntityByName } from '../../../client/handlers';
import { sample } from 'lodash';

const chatTypeNames: string[] = [];
const chatTypeClasses: string[] = [];

type ChatModeId = ChatType | 'mod' | 'admin';

interface ChatTypeSectionItem {
	id: ChatModeId;
	label: string;
	className: string;
}

interface ChatTypeSection {
	title: string;
	items: ChatTypeSectionItem[];
}

function setupChatType(type: ChatType, name: string) {
	chatTypeNames[type] = name;
	chatTypeClasses[type] = `chat-${name.replace(/ /, '-')}`;
}

setupChatType(ChatType.Say, 'say');
setupChatType(ChatType.Party, 'party');
setupChatType(ChatType.Supporter, 'sup');
setupChatType(ChatType.Supporter1, 'sup1');
setupChatType(ChatType.Supporter2, 'sup2');
setupChatType(ChatType.Supporter3, 'sup3');
setupChatType(ChatType.Supporter4, 'sup4');
setupChatType(ChatType.Whisper, 'whisper');
setupChatType(ChatType.Think, 'think');
setupChatType(ChatType.PartyThink, 'party think');

function isActionCommand(message: string) {
	return /^\/(yawn|sneeze|excite|tada|achoo|laugh|lol|haha|хаха|jaja)/i.test(message);
}

const typingIndicatorShowDelay = 700;
const typingIndicatorHideDelay = 1500;
const chatTypeTooltipDelay = 8000;
const chatTypeTooltipDuration = 5000;
const chatTypeTouchHoldDelay = 450;

@Component({
	selector: 'chat-box',
	templateUrl: 'chat-box.pug',
	styleUrls: ['chat-box.scss'],
})
export class ChatBox implements AfterViewInit, OnDestroy {
	readonly maxSayLength = SAY_MAX_LENGTH;
	readonly commentIcon = faComment;
	readonly sendIcon = faAngleDoubleRight;
	readonly emotes = emojis;
	emojiBoxState = 'none';
	@ViewChild('inputElement', { static: true }) inputElement!: ElementRef;
	@ViewChild('typeBox', { static: true }) typeBox!: ElementRef;
	@ViewChild('typePrefix', { static: true }) typePrefix!: ElementRef;
	@ViewChild('typeName', { static: true }) typeName!: ElementRef;
	@ViewChild('chatBox', { static: true }) chatBox!: ElementRef;
	@ViewChild('chatBoxInput', { static: true }) chatBoxInput!: ElementRef;
	isOpen = false;
	message: string | undefined = '';
	chatType = ChatType.Say;
	btnEmoji = emojis[0].names[0];
	private pasted = false;
	private lastMessages: string[] = [];
	private state: AutocompleteState = {};
	private subscriptions: Subscription[];
	private _disabled = false;
	chatTypeMenuOpen = false;
	chatTypeTooltipVisible = false;
	private chatModeOverride: 'mod' | 'admin' | undefined;
	private typingIndicatorActive = false;
	private typingIndicatorType = MessageType.Chat;
	private typingIndicatorEntityId = 0;
	private pendingTypingType = MessageType.Chat;
	private pendingTypingEntityId = 0;
	private typingShowTimeout: any;
	private typingHideTimeout: any;
	private chatTypeTooltipShowTimeout: any;
	private chatTypeTooltipHideTimeout: any;
	private chatTypeHoldTimeout: any;
	private suppressNextChatTypeTap = false;
	constructor(private game: PonyTownGame, zone: NgZone) {
		this.subscriptions = [
			this.game.onChat.subscribe(() => zone.run(() => this.chat(undefined))),
			this.game.onToggleChat.subscribe(() => zone.run(() => this.toggle())),
			this.game.onCommand.subscribe(() => zone.run(() => this.command())),
			this.game.onLeft.subscribe(() => {
				this.chatType = ChatType.Say;
				this.chatModeOverride = undefined;
				this.close();
			}),
		];

		this.game.onCancel = () => this.isOpen ? (zone.run(() => this.close()), true) : false;
	}
	@Input() get disabled() {
		return this._disabled;
	}
	set disabled(value) {
		this._disabled = value;

		if (value) {
			this.close();
		}
	}
	get input() {
		return this.inputElement.nativeElement as HTMLInputElement;
	}
	get currentChatMode(): ChatModeId {
		return this.chatModeOverride || this.chatType;
	}
	get chatTypeSections(): ChatTypeSection[] {
		return getChatTypeSections(this.game);
	}
	get isMobile() {
		return isMobile;
	}
	get usesTouchChatHint() {
		return this.isMobile || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);
	}
	get chatTypeTooltipText() {
		return this.usesTouchChatHint ? 'Hold [say] for all chat modes' : 'Right click for all chat modes';
	}
	get remainingCharacters() {
		return Math.max(0, this.maxSayLength - (this.message || '').length);
	}
	get showRemainingCharacters() {
		return (this.message || '').length >= Math.ceil(this.maxSayLength * 0.8);
	}
	get remainingCharactersDanger() {
		return (this.message || '').length >= Math.ceil(this.maxSayLength * 0.9);
	}
	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent) {
		this.closeChatTypeMenuIfOutside(event);
	}
	@HostListener('document:touchstart', ['$event'])
	onDocumentTouchStart(event: TouchEvent) {
		this.closeChatTypeMenuIfOutside(event);
	}
	private closeChatTypeMenuIfOutside(event: Event) {
		if (this.chatTypeMenuOpen && this.typeBox && !this.typeBox.nativeElement.contains(event.target as Node)) {
			this.chatTypeMenuOpen = false;
		}
	}
	private setCurrentChatMode(mode: ChatModeId) {
		if (mode === 'mod' || mode === 'admin') {
			this.chatModeOverride = mode;
			this.chatType = ChatType.Say;
		} else {
			this.chatModeOverride = undefined;
			this.chatType = mode;
		}

		this.updateChatType();
	}
	ngAfterViewInit() {
		this.chatBox.nativeElement.hidden = true;
		this.input.addEventListener('paste', () => this.pasted = true);
	}
	ngOnDestroy() {
		this.clearTypingTimers();
		this.clearChatTypeTooltipTimers();
		this.subscriptions.forEach(s => s.unsubscribe());
	}
	addEmoji(emoji: string) {
		this.toggleEmojiBox();
		if (!this.message) {
			this.message = emoji;
		} else if (this.input.maxLength > this.message.length) {
			this.message += emoji;
		}
		this.updateTypingIndicator();
	}
	toggleEmojiBox() {
		if (this.emojiBoxState === 'none') {
			this.emojiBoxState = 'inline-block';
		} else {
			this.emojiBoxState = 'none';
		}
	}
	onMessageChange() {
		this.updateTypingIndicator();
		this.updateChatTypeTooltip();
	}
	send(_event: Event | undefined) {
		const { chatType, message, entityId } = this.getMessageState();
		const handled = handleActionCommand(message, this.game);
		const spam = this.pasted && chatType !== ChatType.Party && isSpamMessage(message, this.lastMessages);
		const empty = !this.game.player || !message;
		const ignoreAction = isActionCommand(message) && this.game.player && hasHeadAnimation(this.game.player);

		if (empty && !handled) {
			this.close();
			return;
		}

		const sent = !handled && !spam && !empty && !ignoreAction ? (this.stopTypingIndicator(true), this.say(message, chatType, entityId)) : false;

		if (sent || handled) {
			if (sent) {
				this.lastMessages.push(message);

				if (this.lastMessages.length > 10) {
					this.lastMessages.shift();
				}
			}

			this.close();
		}
	}
	keydown(e: KeyboardEvent) {
		if (e.keyCode !== Key.TAB && e.keyCode !== Key.SHIFT) {
			this.state.lastEmoji = undefined;
		}

		if (e.keyCode === Key.TAB) {
			if (this.message) {
				if (/^\/(w|whisper) .+$/i.test(this.message)) {
					const space = this.message.indexOf(' ');
					const names = findMatchingEntityNames(this.game, this.message.substr(space + 1));

					if (names.length === 1) {
						this.message = `${this.message.substring(0, space)} ${names[0]}`;
					}
				} else {
					this.message = autocompleteMesssage(this.message, e.shiftKey, this.state);
				}
			}

			e.preventDefault();
		} else if (e.keyCode === Key.ENTER && this.isOpen) {
			this.send(e);
		} else if (e.keyCode === Key.ESCAPE) {
			this.close();
			e.preventDefault();
		} else if (e.keyCode === Key.SPACE) {
			const modeSwitch = this.getModeSwitchFromCommand();

			if (modeSwitch) {
				if (modeSwitch.whisperTo) {
					this.game.whisperTo = modeSwitch.whisperTo;
				}

				this.changeChatType(e, modeSwitch.mode);
			}
		}
	}
	private getModeSwitchFromCommand(): { mode: ChatModeId; whisperTo?: Entity | FakeEntity; } | undefined {
		const message = this.message || '';
		const supporter = this.game.model.supporter || 0;
		const account = this.game.model.account;

		if (/^\/(s|say)\s$/i.test(message)) {
			return { mode: ChatType.Say };
		} else if (/^\/(p|party)\s$/i.test(message)) {
			return { mode: isInParty(this.game) ? ChatType.Party : ChatType.Say };
		} else if (/^\/(t|think)\s$/i.test(message)) {
			return { mode: isPartyChat(this.chatType) ? ChatType.PartyThink : ChatType.Think };
		} else if (/^\/ss\s$/i.test(message)) {
			return { mode: supporter > 0 ? ChatType.Supporter : ChatType.Say };
		} else if (/^\/s1\s$/i.test(message)) {
			return { mode: supporter >= 1 ? ChatType.Supporter1 : ChatType.Say };
		} else if (/^\/s2\s$/i.test(message)) {
			return { mode: supporter >= 2 ? ChatType.Supporter2 : ChatType.Say };
		} else if (/^\/s3\s$/i.test(message)) {
			return { mode: supporter >= 3 ? ChatType.Supporter3 : ChatType.Say };
		} else if (/^\/s4\s$/i.test(message)) {
			return { mode: supporter >= 4 ? ChatType.Supporter4 : ChatType.Say };
		} else if (/^\/m\s$/i.test(message) && account && isMod(account)) {
			return { mode: 'mod' };
		} else if (/^\/a\s$/i.test(message) && account && isAdmin(account)) {
			return { mode: 'admin' };
		} else if (/^\/(r|reply)\s$/i.test(message)) {
			const lastWhisperFrom = this.game.lastWhisperFrom;
			const entity = lastWhisperFrom && findEntityOrMockByAnyMeans(this.game, lastWhisperFrom.entityId);
			return entity ? { mode: ChatType.Whisper, whisperTo: entity } : { mode: ChatType.Say };
		} else if (/^\/(w|whisper) .+\s$/i.test(message)) {
			const name = message.substr(/^\/w /i.test(message) ? 3 : 9).trim();
			const entity = findBestEntityByName(this.game, name);

			if (entity) {
				return { mode: ChatType.Whisper, whisperTo: entity };
			}
		}

		return undefined;
	}
	private getMessageState() {
		const mode = this.currentChatMode;
		let chatType = mode === 'mod' || mode === 'admin' ? ChatType.Say : mode;
		let message = replaceEmojis(cleanMessage(this.message || '')).substr(0, SAY_MAX_LENGTH);
		const whisperTo = this.game.whisperTo;
		let entityId = whisperTo && whisperTo.id || 0;

		if (mode === 'mod' && message && !/^\//.test(message)) {
			message = `/m ${message}`;
		} else if (mode === 'admin' && message && !/^\//.test(message)) {
			message = `/a ${message}`;
		}

		if (/^\/(w|whisper) .+$/i.test(message)) {
			chatType = ChatType.Whisper;
			message = message.substr(/^\/w /i.test(message) ? 3 : 9);

			let offset = 0;
			let entity: Entity | FakeEntity | undefined = undefined;

			do {
				offset = message.indexOf(' ', offset);

				if (offset === -1)
					break;

				const name = message.substr(0, offset);
				entity = findBestEntityByName(this.game, name);
				offset++;
			} while (!entity);

			if (entity) {
				message = message.substr(offset);
				entityId = entity.id;
			} else {
				entityId = 0;
			}
		}

		return { chatType, message, entityId };
	}
	private clearTypingStartTimeout() {
		if (this.typingShowTimeout !== undefined) {
			clearTimeout(this.typingShowTimeout);
			this.typingShowTimeout = undefined;
		}

		this.pendingTypingType = MessageType.Chat;
		this.pendingTypingEntityId = 0;
	}
	private clearTypingHideTimeout() {
		if (this.typingHideTimeout !== undefined) {
			clearTimeout(this.typingHideTimeout);
			this.typingHideTimeout = undefined;
		}
	}
	private clearTypingTimers() {
		this.clearTypingStartTimeout();
		this.clearTypingHideTimeout();
	}
	private clearChatTypeTooltipShowTimeout() {
		if (this.chatTypeTooltipShowTimeout !== undefined) {
			clearTimeout(this.chatTypeTooltipShowTimeout);
			this.chatTypeTooltipShowTimeout = undefined;
		}
	}
	private clearChatTypeTooltipHideTimeout() {
		if (this.chatTypeTooltipHideTimeout !== undefined) {
			clearTimeout(this.chatTypeTooltipHideTimeout);
			this.chatTypeTooltipHideTimeout = undefined;
		}
	}
	private clearChatTypeTooltipTimers() {
		this.clearChatTypeTooltipShowTimeout();
		this.clearChatTypeTooltipHideTimeout();
	}
	private clearChatTypeHoldTimeout() {
		if (this.chatTypeHoldTimeout !== undefined) {
			clearTimeout(this.chatTypeHoldTimeout);
			this.chatTypeHoldTimeout = undefined;
		}
	}
	private updateChatTypeTooltip() {
		const hasMessage = !!cleanMessage(this.message || '');

		if (!this.isOpen || !hasMessage) {
			this.chatTypeTooltipVisible = false;
			this.clearChatTypeTooltipTimers();
			return;
		}

		if (!this.chatTypeTooltipVisible && this.chatTypeTooltipShowTimeout === undefined && !this.chatTypeMenuOpen) {
			this.chatTypeTooltipShowTimeout = setTimeout(() => {
				this.chatTypeTooltipShowTimeout = undefined;

				if (!this.isOpen || !cleanMessage(this.message || '') || this.chatTypeMenuOpen) {
					return;
				}

				this.chatTypeTooltipVisible = true;
				this.clearChatTypeTooltipHideTimeout();
				this.chatTypeTooltipHideTimeout = setTimeout(() => {
					this.chatTypeTooltipHideTimeout = undefined;
					this.chatTypeTooltipVisible = false;

					if (this.isOpen && cleanMessage(this.message || '') && !this.chatTypeMenuOpen) {
						this.updateChatTypeTooltip();
					}
				}, chatTypeTooltipDuration);
			}, chatTypeTooltipDelay);
		}
	}
	private getTypingMessageType(chatType: ChatType) {
		switch (chatType) {
			case ChatType.Party:
				return MessageType.Party;
			case ChatType.Think:
				return MessageType.Thinking;
			case ChatType.PartyThink:
				return MessageType.PartyThinking;
			case ChatType.Supporter:
				switch (this.game.model.supporter) {
					case 1: return MessageType.Supporter1;
					case 2: return MessageType.Supporter2;
					case 3: return MessageType.Supporter3;
					case 4: return MessageType.Supporter4;
					default: return MessageType.Chat;
				}
			case ChatType.Supporter1:
				return this.game.model.supporter >= 1 ? MessageType.Supporter1 : MessageType.Chat;
			case ChatType.Supporter2:
				return this.game.model.supporter >= 2 ? MessageType.Supporter2 : MessageType.Chat;
			case ChatType.Supporter3:
				return this.game.model.supporter >= 3 ? MessageType.Supporter3 : MessageType.Chat;
			case ChatType.Supporter4:
				return this.game.model.supporter >= 4 ? MessageType.Supporter4 : MessageType.Chat;
			case ChatType.Whisper:
				return MessageType.Whisper;
			default:
				return MessageType.Chat;
		}
	}
	private getTypingPreviewState(): { entityId: number; type: MessageType; } | undefined {
		const mode = this.currentChatMode;
		const { chatType, message, entityId } = this.getMessageState();
		const rawMessage = replaceEmojis(cleanMessage(this.message || '')).substr(0, SAY_MAX_LENGTH);
		const trimmedMessage = message.trim();

		if (!rawMessage) {
			return undefined;
		}

		if (!/^\//.test(rawMessage)) {
			if (mode === 'mod') {
				return { entityId: 0, type: MessageType.Mod };
			} else if (mode === 'admin') {
				return { entityId: 0, type: MessageType.Admin };
			}
		}

		if (/^\//.test(rawMessage)) {
			const commandMatch = /^\/([^\s]+)(?:\s+(.*))?$/.exec(rawMessage);
			const command = commandMatch && commandMatch[1].toLowerCase();
			const args = (commandMatch && commandMatch[2] || '').trim();

			switch (command) {
				case 's':
				case 'say':
					return args ? { entityId: 0, type: MessageType.Chat } : undefined;
				case 'p':
				case 'party':
					return args ? { entityId: 0, type: MessageType.Party } : undefined;
				case 't':
				case 'think':
					return args ? { entityId: 0, type: isPartyChat(this.chatType) ? MessageType.PartyThinking : MessageType.Thinking } : undefined;
				case 'ss':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter) } : undefined;
				case 's1':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter1) } : undefined;
				case 's2':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter2) } : undefined;
				case 's3':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter3) } : undefined;
				case 's4':
					return args ? { entityId: 0, type: this.getTypingMessageType(ChatType.Supporter4) } : undefined;
				case 'm':
					return args ? { entityId: 0, type: MessageType.Mod } : undefined;
				case 'a':
					return args ? { entityId: 0, type: MessageType.Admin } : undefined;
				case 'w':
				case 'whisper':
					return trimmedMessage && entityId ? { entityId, type: MessageType.Whisper } : undefined;
				case 'r':
				case 'reply': {
					const lastWhisperFrom = this.game.lastWhisperFrom;
					const target = lastWhisperFrom && findEntityOrMockByAnyMeans(this.game, lastWhisperFrom.entityId);
					return args && target ? { entityId: target.id, type: MessageType.Whisper } : undefined;
				}
				default:
					return undefined;
			}
		}

		if (!trimmedMessage) {
			return undefined;
		}

		if (chatType === ChatType.Whisper && !entityId) {
			return undefined;
		}

		return { entityId, type: this.getTypingMessageType(chatType) };
	}
	private scheduleTypingIndicatorStart(entityId: number, type: MessageType) {
		if (
			this.typingShowTimeout !== undefined &&
			this.pendingTypingType === type &&
			this.pendingTypingEntityId === entityId
		) {
			return;
		}

		this.clearTypingStartTimeout();
		this.pendingTypingType = type;
		this.pendingTypingEntityId = entityId;
		this.typingShowTimeout = setTimeout(() => {
			this.typingShowTimeout = undefined;
			this.pendingTypingType = MessageType.Chat;
			this.pendingTypingEntityId = 0;
			const preview = this.getTypingPreviewState();

			if (!preview || preview.type !== type || preview.entityId !== entityId || this.typingIndicatorActive) {
				return;
			}

			if (this.game.send(server => server.typing(entityId, type, true))) {
				this.typingIndicatorActive = true;
				this.typingIndicatorType = type;
				this.typingIndicatorEntityId = entityId;
				this.scheduleTypingIndicatorHide();
			}
		}, typingIndicatorShowDelay);
	}
	private scheduleTypingIndicatorHide() {
		this.clearTypingHideTimeout();

		if (this.typingIndicatorActive) {
			this.typingHideTimeout = setTimeout(() => this.stopTypingIndicator(), typingIndicatorHideDelay);
		}
	}
	private dismissLocalTypingIndicator() {
		const player = this.game.player;
		const says = player && player.says;

		if (says && isTypingIndicatorMessage(says.message)) {
			says.timer = 0;
		}
	}
	private updateTypingIndicator() {
		if (!this.isOpen || this.disabled || !this.game.player || this.game.settings.account.showTypingIndicator === false) {
			this.stopTypingIndicator();
			return;
		}

		const preview = this.getTypingPreviewState();

		if (!preview) {
			this.clearTypingStartTimeout();
			this.scheduleTypingIndicatorHide();
			return;
		}

		if (this.typingIndicatorActive) {
			if (this.typingIndicatorType !== preview.type || this.typingIndicatorEntityId !== preview.entityId) {
				this.stopTypingIndicator();
				this.scheduleTypingIndicatorStart(preview.entityId, preview.type);
			} else {
				this.scheduleTypingIndicatorHide();
			}
		} else {
			this.scheduleTypingIndicatorStart(preview.entityId, preview.type);
		}
	}
	private stopTypingIndicator(immediately = false) {
		this.clearTypingTimers();

		if (immediately) {
			this.dismissLocalTypingIndicator();
		}

		if (this.typingIndicatorActive) {
			const type = this.typingIndicatorType;
			const entityId = this.typingIndicatorEntityId;
			this.typingIndicatorActive = false;
			this.typingIndicatorType = MessageType.Chat;
			this.typingIndicatorEntityId = 0;
			this.game.send(server => server.typing(entityId, type, false));
		}
	}
	private say(message: string, chatType: ChatType, entityId: number): boolean {
		this.game.lastChatMessageType = chatType;
		if (message.toLowerCase().startsWith('/shrug')) {
			var rawMessage = message.substring(6);
			return !!this.game.send(server =>
				server.say(entityId, ((rawMessage !== '') ? rawMessage + ' ' : '') + `¯\\_(ツ)_/¯`,
				chatType));
		} else {
			return !!this.game.send(server => server.say(entityId, message, chatType));
		}
	}
	private changeChatType(e: KeyboardEvent, chatType: ChatModeId) {
		this.stopTypingIndicator();
		this.chatTypeMenuOpen = false;
		this.setCurrentChatMode(chatType);
		this.message = '';
		e.preventDefault();
	}
	private chat(event: Event | undefined) {
		if (this.isOpen) {
			this.send(event);
		} else {
			this.open();
		}
	}
	private command() {
		if (!this.isOpen) {
			this.chat(undefined);
			this.message = '/';
			this.input.selectionStart = this.input.selectionEnd = 10000;
		}
	}
	private open() {
		if (!this.isOpen) {
			this.isOpen = true;
			this.chatBox.nativeElement.hidden = false;
		}

		const chatMode = isValidChatMode(this.currentChatMode, this.game) ? this.currentChatMode : ChatType.Say;
		this.clearChatTypeHoldTimeout();
		this.suppressNextChatTypeTap = false;
		this.chatTypeMenuOpen = false;
		this.setCurrentChatMode(chatMode);
		this.input.focus();
		this.updateTypingIndicator();
		this.updateChatTypeTooltip();
	}
	private close() {
		if (this.isOpen) {
			this.stopTypingIndicator();
			this.clearChatTypeHoldTimeout();
			this.suppressNextChatTypeTap = false;
			this.chatTypeMenuOpen = false;
			this.chatTypeTooltipVisible = false;
			this.clearChatTypeTooltipTimers();
			this.emojiBoxState = 'none';
			this.input.blur();
			this.isOpen = false;
			this.chatBox.nativeElement.hidden = true;
			this.message = '';
			this.pasted = false;
		}
	}
	toggle() {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}
	onMouseEnterEmojiButton(event: MouseEvent) {
		if (!event.target) return;
		const emoji = sample(emojis)!;
		this.btnEmoji = emoji.names[0];
	}
	private setChatTypeMenuOpen(open: boolean) {
		this.chatTypeTooltipVisible = false;
		this.clearChatTypeTooltipTimers();
		this.chatTypeMenuOpen = open;
	}
	openChatTypeMenu(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		this.clearChatTypeHoldTimeout();
		this.setChatTypeMenuOpen(!this.chatTypeMenuOpen);
	}
	onChatTypeTouchStart(_event: TouchEvent) {
		if (!this.usesTouchChatHint) {
			return;
		}

		this.clearChatTypeHoldTimeout();
		this.suppressNextChatTypeTap = false;
		this.chatTypeHoldTimeout = setTimeout(() => {
			this.chatTypeHoldTimeout = undefined;
			this.suppressNextChatTypeTap = true;
			this.setChatTypeMenuOpen(true);
		}, chatTypeTouchHoldDelay);
	}
	onChatTypeTouchEnd(event?: TouchEvent) {
		if (!this.usesTouchChatHint) {
			return;
		}

		this.clearChatTypeHoldTimeout();

		if (this.suppressNextChatTypeTap && event) {
			event.preventDefault();
			event.stopPropagation();
		}
	}
	selectChatType(mode: ChatModeId, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		this.suppressNextChatTypeTap = false;
		this.chatTypeMenuOpen = false;
		this.setCurrentChatMode(mode);
		this.input.focus();
		this.updateTypingIndicator();
		this.updateChatTypeTooltip();
	}
	toggleChatType(event?: MouseEvent) {
		if (event && event.button !== 0) {
			return;
		}

		if (this.isMobile && this.suppressNextChatTypeTap) {
			event && event.preventDefault();
			event && event.stopPropagation();
			this.suppressNextChatTypeTap = false;
			return;
		}

		this.chatTypeMenuOpen = false;
		const chatTypes = getChatTypes(this.game);
		const currentMode = this.currentChatMode;
		const index = chatTypes.indexOf(currentMode);
		const next = chatTypes[(index === -1 ? 0 : (index + 1)) % chatTypes.length];
		this.setCurrentChatMode(next);
		this.input.focus();
		this.updateTypingIndicator();
		this.updateChatTypeTooltip();
	}
	setChatType(type: 'say' | 'party' | 'whisper') {
		if (type === 'say') {
			this.setCurrentChatMode(ChatType.Say);
			this.open();
		} else if (type === 'party' && isInParty(this.game)) {
			this.setCurrentChatMode(ChatType.Party);
			this.open();
		} else if (type === 'whisper') {
			this.setCurrentChatMode(ChatType.Whisper);
			this.open();
		}

		this.updateTypingIndicator();
	}
	private currentTypeClass = '';
	private currentTypePrefix = '';
	private currentTypeName = '';
	private updateChatType() {
		let typeName: string;
		let typePrefix: string;
		let changed = false;

		const currentMode = this.currentChatMode;
		const typeClass = chatTypeClass(currentMode, this.game.model.supporter);

		if (this.currentTypeClass !== typeClass) {
			this.currentTypeClass = typeClass;
			(this.chatBoxInput.nativeElement as HTMLElement).className = typeClass;
		}

		if (currentMode === ChatType.Whisper) {
			typePrefix = 'To ';
			typeName = this.game.whisperTo && this.game.whisperTo.name || 'unknown';
		} else {
			typePrefix = '';
			typeName = getChatModeName(currentMode);
		}

		if (this.currentTypePrefix !== typePrefix) {
			changed = true;
			this.currentTypePrefix = typePrefix;
			(this.typePrefix.nativeElement as HTMLElement).textContent = typePrefix;
		}

		if (this.currentTypeName !== typeName) {
			changed = true;
			this.currentTypeName = typeName;
			replaceNodes(this.typeName.nativeElement, typeName);
		}

		if (changed) {
			const { width } = (this.typeBox.nativeElement as HTMLElement).getBoundingClientRect();
			const padding = 35 + 13 + Math.ceil(width);
			(this.inputElement.nativeElement as HTMLElement).style.paddingLeft = `${padding}px`;
		}
	}
}

function getChatModeName(mode: ChatModeId) {
	switch (mode) {
		case 'mod': return 'mod';
		case 'admin': return 'admin';
		default: return chatTypeNames[mode];
	}
}

function chatTypeClass(chatType: ChatModeId, supporter: number) {
	if (chatType === 'mod') {
		return 'chat-mod';
	} else if (chatType === 'admin') {
		return 'chat-admin';
	} else if (chatType === ChatType.Supporter) {
		switch (supporter) {
			case 1: return 'chat-sup chat-sup1';
			case 2: return 'chat-sup chat-sup2';
			case 3: return 'chat-sup chat-sup3';
			case 4: return 'chat-sup chat-sup4';
		}
	}

	return chatTypeClasses[chatType];
}

function isValidChatType(type: ChatType, game: PonyTownGame) {
	const supporter = game.model.supporter;

	switch (type) {
		case ChatType.Say:
		case ChatType.Think:
		case ChatType.Whisper:
			return true;
		case ChatType.Party:
		case ChatType.PartyThink:
			return isInParty(game);
		case ChatType.Supporter:
			return supporter > 0;
		case ChatType.Supporter1:
			return supporter >= 1;
		case ChatType.Supporter2:
			return supporter >= 2;
		case ChatType.Supporter3:
			return supporter >= 3;
		case ChatType.Supporter4:
			return supporter >= 4;
		case ChatType.Dismiss:
			return false;
		default:
			return invalidEnumReturn(type, false);
	}
}

function isValidChatMode(type: ChatModeId, game: PonyTownGame) {
	const account = game.model.account;

	if (type === 'mod') {
		return !!account && isMod(account);
	} else if (type === 'admin') {
		return !!account && isAdmin(account);
	} else {
		return isValidChatType(type, game);
	}
}

function getChatTypes(game: PonyTownGame): ChatModeId[] {
	const chatTypes: ChatModeId[] = [ChatType.Say];
	const supporter = game.model.supporter;

	if (isInParty(game)) {
		chatTypes.push(ChatType.Party);
	}

	if (supporter) {
		chatTypes.push(ChatType.Supporter);
	}

	return chatTypes;
}

function isDefined<T>(value: T | undefined): value is T {
	return value !== undefined;
}

function getChatTypeSections(game: PonyTownGame): ChatTypeSection[] {
	const supporter = game.model.supporter || 0;
	const account = game.model.account;
	const createItem = (id: ChatModeId): ChatTypeSectionItem => ({
		id,
		label: getChatModeName(id),
		className: chatTypeClass(id, supporter),
	});

	const sections: ChatTypeSection[] = [
		{
			title: 'Regular',
			items: ([
				ChatType.Say,
				isInParty(game) ? ChatType.Party : undefined,
				game.whisperTo ? ChatType.Whisper : undefined,
			] as Array<ChatModeId | undefined>).filter(isDefined).map(createItem),
		},
		{
			title: 'Other',
			items: ([
				ChatType.Think,
				isInParty(game) ? ChatType.PartyThink : undefined,
				supporter > 0 ? ChatType.Supporter : undefined,
				supporter >= 1 ? ChatType.Supporter1 : undefined,
				supporter >= 2 ? ChatType.Supporter2 : undefined,
				supporter >= 3 ? ChatType.Supporter3 : undefined,
				supporter >= 4 ? ChatType.Supporter4 : undefined,
			] as Array<ChatModeId | undefined>).filter(isDefined).map(createItem),
		},
		{
			title: 'Moderation / Admin',
			items: ([
				account && isMod(account) ? 'mod' : undefined,
				account && isAdmin(account) ? 'admin' : undefined,
			] as Array<ChatModeId | undefined>).filter(isDefined).map(createItem),
		},
	];

	return sections.filter(section => section.items.length > 0);
}
