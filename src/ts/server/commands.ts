import { range, compact, escapeRegExp } from 'lodash';
// Speed and time command fixes
import {
	MessageType, ChatType, Expression, Eye, Muzzle, Action, Weather, toAnnouncementMessageType,
} from '../common/interfaces';
import { hasRole } from '../common/accountUtils';
import { butterfly, bat, firefly, cloud, getEntityType, getEntityTypeName } from '../common/entities';
import { emojis } from '../client/emoji';
import { IClient, ServerMap } from './serverInterfaces';
import { World } from './world';
import { NotificationService } from './services/notification';
import { UserError } from './userError';
import { parseExpression, expression } from '../common/expressionUtils';
import { filterBadWords } from '../common/swears';
import { randomString } from '../common/stringUtils';
import {
	getCounter, holdToy, getCollectedToysCount, getCollectedToysList, holdItem, playerSleep, playerBlush, playerLove, playerCry,
	setEntityExpression, execAction, teleportTo, openGift
} from './playerUtils';
import { updateEntityOptions } from './entityUtils';
import { ServerLiveSettings, GameServerSettings } from '../common/adminInterfaces';
import { isCommand, processCommand, clamp, flatten, includes, randomPoint, parseSeason, parseHoliday, toInt, formatPlaytime, formatISODate } from '../common/utils';
import { formatHourMinutes } from '../common/timeUtils';
import { createNotifyUpdate, createShutdownServer } from './api/internal';
import { logger } from './logger';
import { pathTo } from './paths';
import { sayTo, sayToEveryone, sayToOthers, sayToAll, saySystem } from './chat';
import { resetTiles } from './serverRegion';
import { updateAccountState } from './accountUtils';
import {
	findEntities, updateMapState, loadMapFromFile, saveMapToFile, saveEntitiesToFile, getSizeOfMap,
	saveMapToFileBinaryAlt, saveRegionCollider, saveMap, loadMap
} from './serverMap';
import { PARTY_LIMIT, tileWidth, tileHeight, MAP_LOAD_SAVE_TIMEOUT } from '../common/constants';
import { PartyService } from './services/party';
import { getRegionGlobal } from '../common/worldMap';
import { swapCharacter } from './characterUtils';
import { writeFileAsync } from 'fs';
import { Account } from './db';
import { defaultHouseSave, removeToolbox, restoreToolbox } from './maps/houseMap';

export interface CommandContext {
	world: World;
	notifications: NotificationService;
	liveSettings: ServerLiveSettings;
	party: PartyService;
	random: (min: number, max: number, floating?: boolean) => number;
}

export type CommandHandler = (
	context: CommandContext, client: IClient, message: string, type: ChatType, target: IClient | undefined,
	settings: GameServerSettings
) => any;

export interface Command {
	names: string[];
	help: string;
	role: string;
	category?: string;
	spam?: boolean;
	handler: CommandHandler;
}

function hasRoleNull(client: IClient, role: string) {
	if (!role) return true; // No role requirement
	if (hasRole(client.account, role)) return true; // Has exact role

	// Role hierarchy: supporter levels
	if (role.startsWith('sup')) {
		const level = parseInt(role.charAt(3), 10);
		return (client.supporterLevel >= level || client.isMod);
	}

	// Role hierarchy: mod < admin < superadmin
	if (client.isMod) return role === 'mod';
	if (hasRole(client.account, 'admin')) return role === 'admin' || role === 'mod';
	if (hasRole(client.account, 'superadmin')) return role === 'superadmin' || role === 'admin' || role === 'mod';

	return false;
}

function command(names: string[], help: string, role: string, handler: CommandHandler, spam = false, category?: string): Command {
	return { names, help, role, handler, spam, category };
}

function emote(names: string[], expr: Expression, timeout?: number, cancellable?: boolean, category?: string) {
	return command(names, '', '', ({ }, { pony }) => setEntityExpression(pony, expr, timeout, cancellable), false, category);
}

function action(names: string[], actionName: Action, category?: string) {
	return command(names, '', '', ({ }, client, _, __, ___, settings) => execAction(client, actionName, settings), false, category);
}

function adminModChat(names: string[], help: string, role: string, type: MessageType, category?: string) {
	return command(names, help, role, ({ }, client, message, _, __, settings) => {
		sayToEveryone(client, message, filterBadWords(message), type, settings);
	}, false, category);
}

function parseWeather(value: string): Weather | undefined {
	switch (value.toLowerCase()) {
		case 'none': return Weather.None;
		case 'rain': return Weather.Rain;
		default: return undefined;
	}
}

function getSpawnTarget(map: ServerMap, message: string) {
	if (message === 'spawn') {
		return randomPoint(map.spawnArea);
	}

	const spawn = map.spawns.get(message);

	if (spawn) {
		return randomPoint(spawn);
	}

	// allow coordinates with decimal separator dot or comma
	const match = /^(\d+(?:[\.,]\d+)?)\s+(\d+(?:[\.,]\d+)?)$/.exec(message.trim());

	if (!match) {
		throw new UserError('invalid parameters');
	}

	let tx = match[1].replace(',', '.');
	let ty = match[2].replace(',', '.');
	const x = clamp(+tx, 0, map.width - 0.5 / tileWidth);
	const y = clamp(+ty, 0, map.height - 0.5 / tileHeight);
	return { x, y };
}

function execWithFileName(client: IClient, message: string, action: (fileName: string) => Promise<any>) {
	const fileName = message.replace(/[^a-zA-Z0-9_-]/g, '');

	if (!fileName) {
		throw new UserError('invalid file name');
	}

	action(fileName)
		.catch(e => (logger.error(e), e.message))
		.then(error => saySystem(client, error || 'saved'));
}

function shouldNotBeCalled() {
	throw new Error('Should not be called');
}

function isValidMapForEditing(map: ServerMap, client: IClient, checkTimeout: boolean, onlyLeader: boolean) {
	if (map.id !== 'house') {
		saySystem(client, 'Can only be done inside the house');
		return false;
	}

	if (checkTimeout && ((Date.now() - client.lastMapLoadOrSave) < MAP_LOAD_SAVE_TIMEOUT)) {
		saySystem(client, `You need to wait ${Math.floor(MAP_LOAD_SAVE_TIMEOUT / 1000)} seconds before loading or saving again`);
		return false;
	}

	if (onlyLeader && client.party && client.party.leader !== client) {
		saySystem(client, 'Only party leader can do this');
		return false;
	}

	return true;
}

let interval: any;

// backups for admin adjustments, allow reset to pre-change value
const playtimeBackup = new WeakMap<IClient, number>();
const createdBackup = new WeakMap<IClient, Date | undefined>();

export function createCommands(world: World): Command[] {
	const commands = compact([
		// chat
		command(['help', 'h', '?'], '/help - show help', '', ({ }, client) => {
			const filtered = commands
				.filter((c: Command) => c.help && hasRoleNull(client, c.role));
			
			// Group commands by category
			const grouped: { [key: string]: Command[] } = {};
			filtered.forEach((cmd: Command) => {
				const cat = cmd.category || 'Other';
				if (!grouped[cat]) grouped[cat] = [];
				grouped[cat].push(cmd);
			});
			
			// Build help text with categories
			const helpLines: string[] = [];
			const categoryOrder = ['Chat', 'Actions', 'Pony states', 'Emotes', 'Expressions', 'House', 'Supporters', 'Debug', 'Other', 'Mod', 'Admin', 'Superadmin'];
// moved Other above Mod so generic commands show earlier

			
			for (const cat of categoryOrder) {
				if (grouped[cat]) {
					helpLines.push('\n' + cat);
					helpLines.push(grouped[cat].map((c: Command) => c.help).join('\n'));
				}
			}
			
			saySystem(client, helpLines.join('\n'));
		}, false, 'Chat'),
		command(['roll', 'rand', 'random'], '/roll [[min-]max] - randomize a number', '',
			({ random }, client, args, type, target, settings) => {
				const ROLL_MAX = 1000000;
				const [, min, max] = /^(?:(\d+)-)?(\d+)$/.exec(args) || ['', '', ''];
				const minValue = clamp((min ? parseInt(min, 10) : 1) | 0, 0, ROLL_MAX);
				const maxValue = clamp((max ? parseInt(max, 10) : 100) | 0, minValue, ROLL_MAX);
				const result = args === '🍎' ? args : random(minValue, maxValue);
				const message = `🎲 rolled ${result} of ${minValue !== 1 ? `${minValue}-` : ''}${maxValue}`;
				sayToOthers(client, message, toAnnouncementMessageType(type), target, settings);
			}, true, 'Chat'),
		command(['s', 'say'], '/s - say', '', shouldNotBeCalled, false, 'Chat'),
		command(['p', 'party'], '/p - party chat', '', shouldNotBeCalled, false, 'Chat'),
		command(['t', 'think'], '/t - thinking balloon', '', shouldNotBeCalled, false, 'Chat'),
		command(['w', 'whisper'], '/w <name> - whisper to player', '', shouldNotBeCalled, false, 'Chat'),
		command(['r', 'reply'], '/r - reply to whisper', '', shouldNotBeCalled, false, 'Chat'),
		command(['shrug'], '/shrug - ¯\\_(ツ)_/¯', '', shouldNotBeCalled, false, 'Chat'),
		command(['e'], '/e - set permanent expression', '', ({ }, { pony }, message) => {
			pony.exprPermanent = parseExpression(message, true);
			setEntityExpression(pony, undefined, 0);
		}, false, 'Chat'),

		// actions
		command(['turn'], '/turn - turn head', '', ({ }, client, _, __, ___, settings) => {
			execAction(client, Action.TurnHead, settings);
		}, false, 'Actions'),
		command(['boop', ')'], '/boop or /) - a boop', '', ({ }, client, message, _, __, settings) => {
			const expression = parseExpression(message, true);

			if (expression) {
				setEntityExpression(client.pony, expression, 800);
			}

			execAction(client, Action.Boop, settings);
		}, false, 'Actions'),
		command(['drop'], '/drop - drop held item', '', ({ }, client, _, __, ___, settings) => {
			execAction(client, Action.Drop, settings);
		}, false, 'Actions'),
		command(['droptoy'], '/droptoy - drop held toy', '', ({ }, client, _, __, ___, settings) => {
			execAction(client, Action.DropToy, settings);
		}, false, 'Actions'),
		command(['open'], '/open - open gift', '', ({ }, client) => {
			openGift(client);
		}, false, 'Actions'),

		// counters
		command(['gifts', 'giftscore'], '/gifts - show gift score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'gifts')} 🎁`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['candies', 'candy', 'sweets'], '/candies - show candy score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'candies')} 🍬`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['eggs', 'eggcount'], '/eggs - show egg score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'eggs')} 🥚`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['clovers', 'clover', 'clovercount'], '/clovers - show clover score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'clovers')} 🍀`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['toys', 'toylist'], '/toys [list] - show number of collected toys (use "/toys list" to list your toys)', '', ({ }, client, message, type, target, settings) => {
			const now = Date.now();
			const { collected, total } = getCollectedToysCount(client);
			const cmd = (message || '').trim().toLowerCase();

			if (cmd === 'list') {
				const list = getCollectedToysList(client);
				if (!list.length) {
					sayToOthers(client, `У вас пока нет игрушек соберите подарки что бы открыть одну из игрушек`, toAnnouncementMessageType(type), target, settings);
				} else {
					sayToOthers(client, `Your toys: ${list.map(n => `#${n}`).join(' ')}`, toAnnouncementMessageType(type), target, settings);
				}
			} else {
				if (collected === 0) {
					sayToOthers(client, `У вас пока нет игрушек соберите подарки что бы открыть одну из игрушек`, toAnnouncementMessageType(type), target, settings);
				} else if (client.lastToysCommandTime && (now - client.lastToysCommandTime) < 10000) {
					const list = getCollectedToysList(client);
					sayToOthers(client, `Your toys: ${list.map(n => `#${n}`).join(' ')}`, toAnnouncementMessageType(type), target, settings);
				} else {
					sayToOthers(client, `collected ${collected}/${total} toys`, toAnnouncementMessageType(type), target, settings);
				}

				client.lastToysCommandTime = now;
			}
		}, false, 'Chat'),

		// collections summary command (same channel behavior as /toys)
		command(['collections', 'col'], '/collections - show counts of toys, gifts, eggs, clovers, candies', '', ({ }, client, _message, type, target, settings) => {
			const { collected, total } = getCollectedToysCount(client);
			const gifts = getCounter(client, 'gifts');
			const eggs = getCounter(client, 'eggs');
			const clovers = getCounter(client, 'clovers');
			const candies = getCounter(client, 'candies');

			const lines: string[] = [
				`collected ${collected}/${total} toys`,
				`collected ${gifts} gifts 🎁`,
				`collected ${eggs} eggs 🥚`,
				`collected ${clovers} clovers 🍀`,
				`collected ${candies} candies 🍬`,
			];

			sayToOthers(client, lines.join('\n'), toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),

		// achievements command
		command(['achievements', 'achs'], '/achievements - list collection milestones you have achieved', '', ({ }, client, _message, type, target, settings) => {
			const check = '✓ ';

			// helpers for formatting
			function ordinal(n: number) {
				const s = ['th','st','nd','rd'];
				const v = n % 100;
				return n + (s[(v-20)%10] || s[v] || s[0]);
			}

			function formatDate(d: Date) {
				const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
				return `${ordinal(d.getDate())} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
			}

			function formatPlayVerbose(seconds: number) {
				let s = Math.floor(seconds);
				const days = Math.floor(s / 86400); s %= 86400;
				const hours = Math.floor(s / 3600); s %= 3600;
				const mins = Math.floor(s / 60);
				const secs = s % 60;
				const parts: string[] = [];
				if (days) parts.push(`${days}day${days>1?'s':''}`);
				if (hours) parts.push(`${hours}hour${hours>1?'s':''}`);
				if (mins) parts.push(`${mins}min${mins>1?'s':''}`);
				if (secs || parts.length===0) parts.push(`${secs}sec${secs>1?'s':''}`);
				return parts.join(' ');
			}

			// Section 1: account age + playtime titles
			const accountLines: string[] = [];
			if (client.account.createdAt) {
				const created = new Date(client.account.createdAt);
				accountLines.push(`${check}Joined on ${formatDate(created)}`);
				const ageMs = Date.now() - created.getTime();
				const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
				if (days >= 1) accountLines.push(`${check}Still fresh after just a day`);
				if (days >= 30) accountLines.push(`${check}A month has passed since signup`);
				if (days >= 182) accountLines.push(`${check}Half a year veteran`);
				if (days >= 365) accountLines.push(`${check}One year wanderer`);
				if (days >= 730) accountLines.push(`${check}Two years strong`);
			}

			// playtime titles
			const stored = (client.account.counters && (client.account.counters as any).playtime) ? (client.account.counters as any).playtime : 0;
			const session = Math.round((Date.now() - client.connectedTime) / 1000);
			const totalSeconds = stored + session;
			accountLines.push(`${check}Total playtime: ${formatPlayVerbose(totalSeconds)}`);
			if (totalSeconds >= 3600) accountLines.push(`${check}Played at least an hour`);
			if (totalSeconds >= 36000) accountLines.push(`${check}Over 10 hours in-game`);
			if (totalSeconds >= 360000) accountLines.push(`${check}Centuries? Nah, 100 hours`);
			if (totalSeconds >= 1800000) accountLines.push(`${check}Half a million seconds logged`);

			// Section 2: counter milestones
			const counterLines: string[] = [];
			const gifts = getCounter(client, 'gifts');
			for (let m = 100; m <= gifts; m += 100) {
				counterLines.push(`${check}Collected ${m} gifts`);
			}
			const eggs = getCounter(client, 'eggs');
			for (let m = 50; m <= eggs; m += 50) {
				counterLines.push(`${check}Collected ${m} eggs`);
			}
			const clovers = getCounter(client, 'clovers');
			for (let m = 50; m <= clovers; m += 50) {
				counterLines.push(`${check}Collected ${m} clovers`);
			}
			const candies = getCounter(client, 'candies');
			for (let m = 100; m <= candies; m += 100) {
				counterLines.push(`${check}Collected ${m} candies`);
			}

			// Section 3: toy achievements
			const toyLines: string[] = [];
			const { collected, total } = getCollectedToysCount(client);
			if (collected >= 1) {
				toyLines.push(`${check}First toy collected (${collected}/${total})`);
			}
			if (collected === total && total > 0) {
				toyLines.push(`${check}All possible toys collected (${total}/${total})`);
			}

			// assemble final output respecting empty sections
			const sections: string[][] = [];
			if (accountLines.length) sections.push(accountLines);
			if (counterLines.length) sections.push(counterLines);
			if (toyLines.length) sections.push(toyLines);

			if (sections.length === 0) {
				sayToOthers(client, 'No achievements yet', toAnnouncementMessageType(type), target, settings);
			} else {
				const output = sections.map(sec => sec.join('\n')).join('\n---------\n');
				sayToOthers(client, output, toAnnouncementMessageType(type), target, settings);
			}
		}, false, 'Chat'),

// account-related info commands moved out of the generic /account
	command(['accountdate','accdate','creation','created'], '/accountdate - show date when your account was created', '', ({ }, client, _message, type, target, settings) => {
		const created = client.account.createdAt ? formatISODate(client.account.createdAt).replace(/-/g, '.') : 'unknown';
		sayToOthers(client, `Creation Date: ${created}`, toAnnouncementMessageType(type), target, settings);
	}, false, 'Other'),
	command(['accountid','accid','id','whoami'], '/accountid - show your account ID', '', ({ }, client, _message, type, target, settings) => {
		sayToOthers(client, `Your ID: ${client.accountId}`, toAnnouncementMessageType(type), target, settings);
	}, false, 'Other'),
	command(['playtime','ptime','timeplayed'], '/playtime - show total playtime', '', ({ }, client, _message, type, target, settings) => {
		const stored = (client.account.counters && (client.account.counters as any).playtime) ? (client.account.counters as any).playtime : 0;
		const session = Math.round((Date.now() - client.connectedTime) / 1000);
		const totalSeconds = stored + session;
		const text = `Total Playtime: ${formatPlaytime(totalSeconds)}`;
		sayToOthers(client, text, toAnnouncementMessageType(type), target, settings);
	}, false, 'Other'),

	command(['age','birthage'], '/age - show your age based on birthdate in settings', '', ({ }, client, _message, type, target, settings) => {
		if (!client.account.birthdate) {
			throw new UserError('birthdate not set');
		}
		const bd = new Date(client.account.birthdate);
		const now = new Date();
		let age = now.getFullYear() - bd.getFullYear();
		const m = now.getMonth() - bd.getMonth();
		if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) {
			age--;
		}
		sayToOthers(client, `Age: ${age} year${age !== 1 ? 's' : ''}`, toAnnouncementMessageType(type), target, settings);
	}, false, 'Other'),
		command(['lie', 'lay'], '/lie - lie down or sit up', '', shouldNotBeCalled, false, 'Pony states'),
		command(['fly'], '/fly - fly up or fly down', '', shouldNotBeCalled, false, 'Pony states'),
		command(['stand'], '/stand - stand up', '', shouldNotBeCalled, false, 'Pony states'),

		// emotes
		command(['blush'], '', '', ({ }, { pony }, message) => playerBlush(pony, message), false, 'Emotes'),
		command(['love', '<3'], '', '', ({ }, { pony }, message) => playerLove(pony, message), false, 'Emotes'),
		command(['sleep', 'zzz'], '', '', ({ }, { pony }, message) => playerSleep(pony, message), false, 'Emotes'),
		command(['cry'], '', '', ({ }, { pony }, message) => playerCry(pony, message), false, 'Emotes'),

		// expressions
		emote(['smile', 'happy'], expression(Eye.Neutral, Eye.Neutral, Muzzle.Smile), undefined, undefined, 'Expressions'),
		emote(['frown'], expression(Eye.Neutral, Eye.Neutral, Muzzle.Frown), undefined, undefined, 'Expressions'),
		emote(['angry'], expression(Eye.Angry, Eye.Angry, Muzzle.Frown), undefined, undefined, 'Expressions'),
		emote(['sad'], expression(Eye.Sad, Eye.Sad, Muzzle.Frown), undefined, undefined, 'Expressions'),
		emote(['thinking'], expression(Eye.Neutral, Eye.Frown2, Muzzle.Concerned), undefined, undefined, 'Expressions'),

		// actions
		action(['yawn'], Action.Yawn, 'Actions'),
		action(['laugh', 'lol', 'haha', 'хаха', 'jaja'], Action.Laugh, 'Actions'),
		action(['sneeze', 'achoo'], Action.Sneeze, 'Actions'),
		action(['excite', 'tada'], Action.Excite, 'Actions'),
		action(['magic'], Action.Magic, 'Actions'),
		action(['kiss'], Action.Kiss, 'Actions'),

		// house
		command(['savehouse'], '/savehouse - saves current house setup', '', async ({ }, client) => {
			if (!isValidMapForEditing(client.map, client, true, false))
				return;

			client.lastMapLoadOrSave = Date.now();

			const savedMap = JSON.stringify(saveMap(client.map,
				{ saveTiles: true, saveEntities: true, saveWalls: true, saveOnlyEditableEntities: true }));

			DEVELOPMENT && console.log(savedMap);

			client.account.savedMap = savedMap;
			await Account.updateOne({ _id: client.accountId }, { savedMap }).exec();

			saySystem(client, 'Saved');
			client.reporter.systemLog(`Saved house`);
		}, false, 'House'),
		command(['loadhouse'], '/loadhouse - loads saved house setup', '', ({ world }, client) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			if (!client.account.savedMap)
				return saySystem(client, 'No saved map state');

			client.lastMapLoadOrSave = Date.now();

			loadMap(world, client.map, JSON.parse(client.account.savedMap),
				{ loadEntities: true, loadWalls: true, loadEntitiesAsEditable: true });

			saySystem(client, 'Loaded');
			client.reporter.systemLog(`Loaded house`);
		}, false, 'House'),
		command(['resethouse'], '/resethouse - resets house setup to original state', '', ({ }, client) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			client.lastMapLoadOrSave = Date.now();

			if (defaultHouseSave) {
				loadMap(world, client.map, defaultHouseSave,
					{ loadEntities: true, loadWalls: true, loadEntitiesAsEditable: true });
			}

			saySystem(client, 'Reset');
			client.reporter.systemLog(`Reset house`);
		}, false, 'House'),
		command(['lockhouse'], '/lockhouse - prevents other people from changing the house', '', ({ }, client) => {
			if (!isValidMapForEditing(client.map, client, false, true))
				return;

			client.map.editingLocked = true;

			saySystem(client, 'House locked');
			client.reporter.systemLog(`House locked`);
		}, false, 'House'),
		command(['unlockhouse'], '/unlockhouse - enables editing by other people', '', ({ }, client) => {
			if (!isValidMapForEditing(client.map, client, false, true))
				return;

			client.map.editingLocked = false;

			saySystem(client, 'House unlocked');
			client.reporter.systemLog(`House unlocked`);
		}, false, 'House'),
		command(['removetoolbox'], '/removetoolbox - removes toolbox from the house', '', ({ world }, client) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			client.lastMapLoadOrSave = Date.now();

			removeToolbox(world, client.map);

			saySystem(client, 'Toolbox removed');
			client.reporter.systemLog(`Toolbox removed`);
		}, false, 'House'),
		command(['restoretoolbox'], '/restoretoolbox - restores toolbox to the house', '', ({ }, client) => {
			if (!isValidMapForEditing(client.map, client, true, true))
				return;

			client.lastMapLoadOrSave = Date.now();

			restoreToolbox(world, client.map);

			saySystem(client, 'Toolbox restored');
			client.reporter.systemLog(`Toolbox restored`);
		}, false, 'House'),

		// supporters
		command(['swap'], '/swap <name> - swap character', '', async ({ world }, client, message) => {
			if (!message) {
				return saySystem(client, `You need to provide name of the character`);
			}

			const regex = new RegExp(`^${escapeRegExp(message)}$`, 'i');
			const query = { account: client.account._id, name: { $regex: regex } };
			await swapCharacter(client, world, query);
		}, false, 'Supporters'),

		// mod
		adminModChat(['m'], '/m - mod text', 'mod', MessageType.Mod, 'Mod'),
		command(['emotetest'], '/emotetest - print all emotes', 'mod', (_context, client) => {
			let text = '';

			for (let i = 0; i < emojis.length;) {
				if (text) {
					text += '\n';
				}

				for (let j = 0; i < emojis.length && j < 20; j++ , i++) {
					text += emojis[i].symbol;
				}
			}

			sayTo(client, client.pony, text, MessageType.Chat);
		}, false, 'Mod'),
		command(['goto'], '/goto <map_id> [instance] - teleport to map spawn', 'mod', ({ world }, client, message) => {
			const parts = message.trim().split(/\s+/);
			
			if (parts.length === 0 || !parts[0]) {
				const mapsList = new Map<string, Set<string>>();
				for (const map of world.maps) {
					if (!mapsList.has(map.id)) {
						mapsList.set(map.id, new Set());
					}
					if (map.instance) {
						mapsList.get(map.id)!.add(map.instance);
					}
				}

				const lines = ['Available Maps:'];
				mapsList.forEach((instances, id) => {
					if (instances.size === 0) {
						lines.push(`  ${id}`);
					} else {
						lines.push(`  ${id} (instances: ${Array.from(instances).join(', ')})`);
					}
				});
				lines.push('', 'Usage: /goto <map_id> [instance]');
				saySystem(client, lines.join('\n'));
				return;
			}
			
			const [id, instance] = parts;
			const map = world.maps.find(map => map.id === id && (!instance || map.instance === instance));

			if (map) {
				const { x, y } = randomPoint(map.spawnArea);
				world.switchToMap(client, map, x, y);
				saySystem(client, `Teleported to ${id}${instance ? ` (${instance})` : ''}`);
			} else {
				throw new UserError(`Map "${id}" not found or instance mismatch`);
			}
		}, false, 'Mod'),
		command(['speed'], '/speed - manage player movement speed', 'mod', ({}, client, message) => {
			const parts = (message || '').trim().split(/\s+/);
			const arg = parts[0];

			if (!arg || arg.toLowerCase() === 'reset') {
				client.pony.speedMultiplier = 1;
				client.speedMultiplier = 1;
				updateEntityOptions(client.pony, { speedMultiplier: 1 });
				saySystem(client, 'Speed reset to 1x');
				return;
			}

			const value = parseFloat(arg);

			if (isNaN(value) || value <= 0 || value > 4) {
				saySystem(client, 'Invalid speed. Provide number > 0 and <= 4, or "reset"');
				return;
			}

			client.pony.speedMultiplier = value;
			client.speedMultiplier = value;
			updateEntityOptions(client.pony, { speedMultiplier: value });
			saySystem(client, `Speed set to ${value}x`);
		}, false, 'Mod'),
		command(['tp'], '/tp <location|x y|to <player>|here <player>|? - teleport around', 'mod', (_context, client, message) => {
		const input = message.trim();
		if (!input || input === '?') {
			const lines = [
				'Teleport command',
				'',
				'Usage:',
				'  /tp <location>                 - go to a named spawn (see /locations)',
				'  /tp <x> <y>                    - teleport to coords (decimals ok)',
				'  /tp to <player>                - teleport to another player',
				'  /tp here <player>              - bring a player to you',
				'  /tp ?                          - show this help message',
				'',
				'Examples:',
				'  /tp spawn',
				'  /tp 22.1 42,5',
				'  /tp to player2',
				'  /tp here player2',
				'',
				'Tip: enable "Show stats" to see Your Coords and use /players to list names',
			];
			saySystem(client, lines.join('\n'));
			return;
		}
		
		// handle to/here subcommands
		const parts = input.split(/\s+/);
		if (parts[0].toLowerCase() === 'to' && parts[1]) {
			const targetName = parts.slice(1).join(' ');
			const others = _context.world.clients.filter(c => c.accountName.toLowerCase() === targetName.toLowerCase());
			if (others.length === 0) {
				saySystem(client, 'player not found, try /players to see online names');
				return;
			}
			const target = others[0];
			teleportTo(client, target.pony.x, target.pony.y);
			saySystem(client, `Teleported to ${target.accountName}`);
			return;
		}
		if (parts[0].toLowerCase() === 'here' && parts[1]) {
			const targetName = parts.slice(1).join(' ');
			const others = _context.world.clients.filter(c => c.accountName.toLowerCase() === targetName.toLowerCase());
			if (others.length === 0) {
				saySystem(client, 'player not found, try /players to see online names');
				return;
			}
			const target = others[0];
			teleportTo(target, client.pony.x, client.pony.y);
			saySystem(client, `${target.accountName} has been teleported to you`);
			return;
		}
		
		const { x, y } = getSpawnTarget(client.map, input);
		teleportTo(client, x, y);
		saySystem(client, `Teleported to (${x.toFixed(1)}, ${y.toFixed(1)})`);
	}, false, 'Mod'),

		command(['locations'], '/locations - show list all spawn locations on current map', 'mod', ({ }, client) => {
			const map = client.map;
			const locations = Array.from(map.spawns.keys());
			
			if (locations.length === 0) {
				saySystem(client, 'No named locations on this map');
			} else {
				const locNames = locations.concat(map.spawnArea ? ['spawn'] : []).join(', ');
				saySystem(client, `Locations on: ${locNames}`);
			}
		}, false, 'Mod'),

		command(['players'], '/players - list all players on this map and total', 'mod', ({ world }, client) => {
			const mapClients = world.clients.filter(c => c.map === client.map);
			const totalClients = world.clients.length;
			if (totalClients <= 1) {
				saySystem(client, "You're the only one on the server right now");
				return;
			}
			const lines: string[] = [
				`PLAYERS (${mapClients.length} here / ${totalClients} total)`,
				'',
			];
			if (mapClients.length === 0) {
				lines.push('No players on this map');
			} else {
				mapClients.forEach(c => {
					const afkStatus = c.lastPacket && (Date.now() - c.lastPacket) > 300000 ? ' (afk)' : '';
					lines.push(`  ${c.characterName} - ${c.accountName}${afkStatus}`);
				});
			}
			saySystem(client, lines.join('\n'));
		}, false, 'Mod'),

		command(['maps'], '/maps - list all maps on the server', 'mod', ({ world }, client) => {
			// Count unique maps and their players
			const mapData = new Map<string, { instances: number; players: number }>();
			
			for (const map of world.maps) {
				const key = map.id;
				const mapPlayers = world.clients.filter(c => c.map === map).length;
				if (!mapData.has(key)) {
					mapData.set(key, { instances: 0, players: 0 });
				}
				const data = mapData.get(key)!;
				data.instances++;
				data.players += mapPlayers;
			}
			
			const lines = [
				`Server Maps (${mapData.size} total)`,
				'---------------------',
			];
			
			let index = 1;
			mapData.forEach((data, id) => {
				const playerText = data.players === 1 ? 'pony' : 'ponies';
				if (data.players === 0) {
					lines.push(`${index}. ${id}`);
				} else {
					lines.push(`${index}. ${id}: ${data.players} ${playerText}`);
				}
				index++;
			});
			
			saySystem(client, lines.join('\n'));
		}, false, 'Mod'),
		command(['map'], '/map - show current map info', 'mod', ({ world }, client) => {
			const map = client.map;
			const { memory, entities } = getSizeOfMap(map);
			const players = world.clients.filter(c => c.map === map).length;
			const mapName = map.id || 'unknown';
			
			const lines = [
				'Map info',
				'-----------------',
				`Name:        ${mapName}${map.instance ? ` (${map.instance})` : ''}`,
				`Position:    ${client.pony.x.toFixed(1)}x, ${client.pony.y.toFixed(1)}y`,
				`Dimensions:  ${map.width}x | ${map.height}y tiles`,
				`Players:     ${players}`,
				`Regions:     ${map.regions.length}`,
				`Entities:    ${entities}`,
				`Memory:      ${(memory / 1024).toFixed(2)} KB`,
			];
			
			saySystem(client, lines.join('\n'));
		}, false, 'Mod'),

		// admin
		adminModChat(['a'], '/a - admin text', 'admin', MessageType.Admin, 'Admin'),
		command(['announce'], '/announce - global announcement', 'admin', ({ }, client, message, _, __, settings) => {
			findEntities(client.map, e => e.type === butterfly.type || e.type === bat.type || e.type === firefly.type)
				.forEach(e => sayToAll(e, message, filterBadWords(message), MessageType.Admin, settings));
		}, false, 'Admin'),
		command(['time'], '/time <HH:MM|day|night|?|<HH:MM> stop> - set server time, ? for help', DEVELOPMENT ? '' : 'admin', ({ world }, client, message) => {
			const input = message.trim();

			if (!input) {
				const currentTime = world.time;
				saySystem(client, `Current time: ${formatHourMinutes(currentTime)}`);
				return;
			}

			const args = input.split(/\s+/).filter(p => p);
			const subcommand = args[0].toLowerCase();

			// Check if it's a time setting (HH:MM or HH MM)
			const colonRegex = /^(\d{1,2}):(\d{2})$/;

			let isTimeInput = false;
			let targetHour = 0;
			let targetMinute = 0;

			if (colonRegex.test(args[0])) {
				const match = colonRegex.exec(args[0])!;
				targetHour = parseInt(match[1], 10);
				targetMinute = parseInt(match[2], 10);
				isTimeInput = true;
			} else if (/^\d{1,2}$/.test(args[0]) && args.length === 2 && /^\d{2}$/.test(args[1])) {
				targetHour = parseInt(args[0], 10);
				targetMinute = parseInt(args[1], 10);
				isTimeInput = true;
			}

			if (isTimeInput) {
				// if user added "stop" as second argument, freeze at that time
				if (args.length > 1 && args[1].toLowerCase() === 'stop') {
					if ((world as any).timeIntervalId) {
						clearInterval((world as any).timeIntervalId);
					}
					const targetTimeValue = targetHour + (targetMinute / 60);
					world.setTime(targetTimeValue);
					(world as any).timeIntervalId = setInterval(() => {
						world.setTime(targetTimeValue);
					}, 1000);
					saySystem(client, `Time frozen at ${formatHourMinutes(world.time)}`);
					return;
				}
				// Stop any running interval
				if ((world as any).timeIntervalId) {
					clearInterval((world as any).timeIntervalId);
					(world as any).timeIntervalId = null;
				}
				// Set time to HH:MM
				if (targetHour < 0 || targetHour > 23 || targetMinute < 0 || targetMinute > 59) {
					throw new UserError('Invalid time. Hours must be 0-23, minutes must be 0-59');
				}
				const targetTimeValue = targetHour + (targetMinute / 60);
				world.setTime(targetTimeValue);
				const newTime = world.time;
				saySystem(client, `Time set to ${formatHourMinutes(newTime)}`);
				return;
			}

			// Special commands: day and night - set time periodically every 2.5 seconds
			if (subcommand === 'day') {
				// Stop any running interval first
				if ((world as any).timeIntervalId) {
					clearInterval((world as any).timeIntervalId);
				}
				
				// Immediately set time to day
				world.setTime(12);
				
// Periodically re-set time every 1 seconds to maintain eternal day
			(world as any).timeIntervalId = setInterval(() => {
				world.setTime(12);
			}, 1000);
				
				saySystem(client, 'Time set to eternal day (12:00) - continuously enforced');
				return;
			}

			if (subcommand === 'night') {
				// Stop any running interval first
				if ((world as any).timeIntervalId) {
					clearInterval((world as any).timeIntervalId);
				}
				
				// Immediately set time to night
				world.setTime(0);
				
// Periodically re-set time every 1 seconds to maintain eternal night
			(world as any).timeIntervalId = setInterval(() => {
				world.setTime(0);
			}, 1000);
				
				saySystem(client, 'Time set to eternal night (00:00) - continuously enforced');
				return;
			}

			throw new UserError('Usage: /time HH:MM or /time day or /time night');
		}, false, 'Admin'),
	
	// admin counter modification
	command(['collect'], '/collect <kind> [amount|clear] - give/remove counters. Syntax: /collect gift 100 or /collect 100 gift', 'admin', ({ }, client, message) => {
		const parts = message.trim().split(/\s+/).filter(p => p);

		// Show help if no arguments
		if (parts.length === 0) {
			saySystem(client, 'Usage: /collect <kind> [amount|clear]');
			saySystem(client, 'Types: gift/gifts, egg/eggs, clover/clovers, candy/candies, toy/toys');
			saySystem(client, 'Examples:');
			saySystem(client, '  /collect gift 100 - give 100 gifts');
			saySystem(client, '  /collect 100 gift - give 100 gifts (order is flexible)');
			saySystem(client, '  /collect gift -50 - remove 50 gifts');
			saySystem(client, '  /collect gift clear - clear all gifts to 0');
			return;
		}

		// Parse arguments flexibly
		let kind: string | null = null;
		let amountStr: string | null = null;

		for (const part of parts) {
			// Check if it's a kind
			if (['gift', 'gifts', 'egg', 'eggs', 'clover', 'clovers', 'candy', 'candies', 'toy', 'toys'].includes(part.toLowerCase())) {
				if (kind !== null) {
					throw new UserError('Type specified twice');
				}
				kind = part.toLowerCase();
			} else if (part.toLowerCase() === 'clear') {
				if (amountStr !== null) {
					throw new UserError('Cannot specify amount and clear together');
				}
				amountStr = 'clear';
			} else if (!isNaN(parseInt(part, 10))) {
				if (amountStr !== null) {
					throw new UserError('Amount specified twice');
				}
				amountStr = part;
			} else {
				throw new UserError(`Unknown param: "${part}"`);
			}
		}

		if (kind === null) {
			throw new UserError('Type not specified (gift, egg, clover, candy or toy)');
		}

		// Normalize kind to singular/proper form
		const kindMap: any = {
			'gift': 'gifts', 'gifts': 'gifts',
			'egg': 'eggs', 'eggs': 'eggs',
			'clover': 'clovers', 'clovers': 'clovers',
			'candy': 'candies', 'candies': 'candies',
			'toy': 'toys', 'toys': 'toys'
		};
		const normalizedKind = kindMap[kind];

		if (normalizedKind === 'toys') {
			// Handle toys - output like /toys command
			if (amountStr === null) {
				throw new UserError('For toys specify amount or clear');
			}

			if (amountStr === 'clear') {
				updateAccountState(client.account, (state: any) => state.toys = 0);
				saySystem(client, 'Toys cleared');
			} else {
				const amount = parseInt(amountStr, 10);
				if (isNaN(amount)) {
					throw new UserError('Invalid amount');
				}

				const n = Math.abs(amount);
				const total = getCollectedToysCount(client).total;
				const m = Math.min(n, total);

				if (m === 0 && amount !== 0) {
					saySystem(client, 'No toys to remove');
					return;
				}

				updateAccountState(client.account, (state: any) => {
					let mask = toInt(state.toys);
					if (amount >= 0) {
						for (let i = 0; i < m; i++) mask |= (1 << i);
					} else {
						for (let i = 0; i < m; i++) mask &= ~(1 << i);
					}
					state.toys = mask;
				});

				const { collected } = getCollectedToysCount(client);
				saySystem(client, `${amount >= 0 ? 'Given' : 'Removed'} toys #1-${m}, total: ${collected}/${total}`);
			}
		} else {
			// Handle gifts, eggs, clovers, candies
			if (amountStr === null) {
				throw new UserError('Specify amount or clear');
			}

			let amount: number;

			if (amountStr === 'clear') {
				amount = -(toInt((client.account as any)[normalizedKind]) || 0);
			} else {
				amount = parseInt(amountStr, 10);
				if (isNaN(amount)) {
					throw new UserError('Invalid amount');
				}
			}

			const k = normalizedKind as 'gifts' | 'eggs' | 'clovers' | 'candies';

			updateAccountState(client.account, (state: any) => {
				state[k] = Math.max(0, toInt(state[k]) + amount);
			});

			if (amountStr === 'clear') {
				saySystem(client, `${k} cleared`);
			} else {
				saySystem(client, `${amount >= 0 ? 'Given' : 'Removed'} ${Math.abs(amount)} ${k}`);
			}
		}
	}, false, 'Admin'),

		// admin helpers to set playtime & creation date with undo
		command(['setplaytime'], '/setplaytime <seconds|reset> - set or restore your playtime', 'admin', ({ }, client, message) => {
			const arg = (message || '').trim().toLowerCase();
			if (!arg) {
				throw new UserError('provide seconds or reset');
			}
			if (arg === 'reset') {
				const prev = playtimeBackup.get(client);
				if (prev === undefined) {
					saySystem(client, 'no backup available');
					return;
				}
				updateAccountState(client.account, (state: any) => {
					state.counters = state.counters || {};
					state.counters.playtime = prev;
				});
				playtimeBackup.delete(client);
				saySystem(client, 'playtime restored');
				return;
			}
			const sec = parseInt(arg, 10);
			if (isNaN(sec) || sec < 0) {
				throw new UserError('invalid seconds');
			}
			if (!playtimeBackup.has(client)) {
				const stored = (client.account.counters && (client.account.counters as any).playtime) ? (client.account.counters as any).playtime : 0;
				playtimeBackup.set(client, stored);
			}
			updateAccountState(client.account, (state: any) => {
				state.counters = state.counters || {};
				state.counters.playtime = sec;
			});
			saySystem(client, `playtime set to ${sec}`);
		}, false, 'Admin'),

		command(['setcreated'], '/setcreated <YYYY-MM-DD|reset> - change or restore account creation date', 'admin', ({ }, client, message) => {
			const arg = (message || '').trim();
			if (!arg) {
				throw new UserError('provide date or reset');
			}
			if (arg.toLowerCase() === 'reset') {
				const prev = createdBackup.get(client);
				if (prev === undefined) {
					saySystem(client, 'no backup available');
					return;
				}
				client.account.createdAt = prev;
				Account.updateOne({ _id: client.accountId }, { createdAt: prev }).exec();
				createdBackup.delete(client);
				saySystem(client, 'creation date restored');
				return;
			}
			const d = new Date(arg);
			if (isNaN(d.getTime())) {
				throw new UserError('invalid date format');
			}
			if (!createdBackup.has(client)) {
				createdBackup.set(client, client.account.createdAt);
			}
			client.account.createdAt = d;
			Account.updateOne({ _id: client.accountId }, { createdAt: d }).exec();
			saySystem(client, `creation date set to ${d.toISOString().replace(/T.*$/,'')}`);
		}, false, 'Admin'),

		command(['togglerestore'], '/togglerestore - toggle terrain restoration', 'admin', ({ world: { options } }, client) => {
			options.restoreTerrain = !options.restoreTerrain;
			saySystem(client, `restoration is ${options.restoreTerrain ? 'on' : 'off'}`);
		}, false, 'Admin'),
		command(['resettiles'], '/resettiles - reset tiles to original state', 'admin', ({ }, client) => {
			for (const region of client.map.regions) {
				resetTiles(client.map, region);
			}
		}, false, 'Admin'),
		BETA && command(['season'], '/season <season> [<holiday>]', 'admin', ({ world }, _client, message) => {
			const [s = '', h = ''] = message.split(' ');
			const season = parseSeason(s);
			const holiday = parseHoliday(h);

			if (season === undefined) {
				throw new UserError('invalid season');
			} else {
				world.setSeason(season, holiday === undefined ? world.holiday : holiday);
			}
		}, false, 'Admin'),
		BETA && command(['weather'], '/weather <none|rain>', 'admin', ({ }, client, message) => {
			const weather = parseWeather(message);

			if (weather === undefined) {
				throw new UserError('invalid weather');
			} else {
				updateMapState(client.map, { weather });
			}
		}, false, 'Admin'),

		// superadmin
		command(['update'], '/update - prepare server for update', 'superadmin', ({ world, liveSettings }) => {
			createNotifyUpdate(world, liveSettings)();
		}, false, 'Superadmin'),
		command(['shutdown'], '/shutdown - shutdown server for update', 'superadmin', ({ world, liveSettings }) => {
			createShutdownServer(world, liveSettings)(true);
	}, false, 'Superadmin'),
		command(['loadmap'], '/loadmap <file name> - load map from file', 'superadmin', ({ world }, client, message) => {
			execWithFileName(client, message, fileName =>
				loadMapFromFile(world, client.map, pathTo('store', `${fileName}.json`), { loadOnlyTiles: true }));
		}, false, 'Superadmin'),
		command(['savemap'], '/savemap <file name> - save map to file', 'superadmin', (_, client, message) => {
			execWithFileName(client, message, async fileName => {
				await saveMapToFile(client.map, pathTo('store', `${fileName}.json`), { saveTiles: true });
				// await saveMapToFileBinary(client.map, pathTo('store', `${fileName}.bin`));
			});
		}, false, 'Superadmin'),
		command(['savemapbin'], '/savemapbin <file name> - save map to file', 'superadmin', (_, client, message) => {
			execWithFileName(client, message, fileName => saveMapToFileBinaryAlt(client.map, pathTo('store', `${fileName}.json`)));
		}, false, 'Superadmin'),
		command(['saveentities'], '/saveentities <file name> - save entities to file', 'superadmin', (_, client, message) => {
			execWithFileName(client, message, fileName => saveEntitiesToFile(client.map, pathTo('store', `${fileName}.txt`)));
		}, false, 'Superadmin'),
		command(['savehides'], '/savehides - save hides to file', 'superadmin', async ({ world }, client) => {
			const json = world.hidingService.serialize();
			await writeFileAsync(pathTo('store', 'hides.json'), json, 'utf8');
			saySystem(client, 'saved');
		}, false, 'Superadmin'),
		command(['throwerror'], '/throwerror <message> - throw test error', 'superadmin', (_, _client, message) => {
			throw new Error(message || 'test');
		}, false, 'Superadmin'),
		BETA && command(['test'], '', 'superadmin', ({ }, client) => {
			client.map.regions.forEach(region => {
				console.log(region.x, region.y, region.colliders.length);
			});
		}, false, 'Superadmin'),
		BETA && command(['spamchat'], '/spamchat - spam chat messages', 'superadmin',
			({ world, random }, client, _, __, ___, settings) => {
				if (interval) {
					clearInterval(interval);
					interval = undefined;
				} else {
					interval = setInterval(() => {
						if (includes(world.clients, client)) {
							const message = range(random(1, 10)).map(() => randomString(random(1, 10))).join(' ');
							sayToEveryone(client, message, message, MessageType.Chat, settings);
						} else {
							clearInterval(interval);
						}
					}, 100);
				}
			}, false, 'Superadmin'),
		BETA && command(['noclouds'], '/noclouds - remove clouds', 'superadmin', ({ world }, client) => {
			findEntities(client.map, e => e.type === cloud.type).forEach(e => world.removeEntity(e, client.map));
		}, false, 'Superadmin'),
		BETA && command(['msg'], '/msg - say random stuff', 'superadmin', ({ }, client, _, __, ___, settings) => {
			findEntities(client.map, e => !!e.options && e.name === 'debug 2')
				.forEach(e => sayToAll(e, 'Hello there!', 'Hello there!', MessageType.Chat, settings));
		}, false, 'Superadmin'),
		BETA && command(['hold'], '/hold <name> - hold item', 'superadmin', ({ }, client, message) => {
			holdItem(client.pony, getEntityType(message));
		}, false, 'Superadmin'),
		BETA && command(['toy'], '/toy <number> - hold toy', 'superadmin', ({ }, client, message) => {
			holdToy(client.pony, parseInt(message, 10) | 0);
		}, false, 'Superadmin'),
		BETA && command(['dc'], '/dc', 'superadmin', ({ }, client) => {
			client.disconnect(true, false);
		}, false, 'Superadmin'),
		BETA && command(['disconnect'], '/disconnect', 'superadmin', ({ }, client) => {
			client.disconnect(true, true);
		}, false, 'Superadmin'),
		BETA && command(['info'], '/info <id>', 'superadmin', ({ world }, client, message) => {
			const id = parseInt(message, 10) | 0;
			const entity = world.getEntityById(id);

			if (entity) {
				const { id, type, x, y, options } = entity;
				const info = { id, type: getEntityTypeName(type), x, y, options };
				saySystem(client, JSON.stringify(info, null, 2));
			} else {
				saySystem(client, 'undefined');
			}
		}, false, 'Superadmin'),
		BETA && command(['collider'], '/collider', 'superadmin', ({ }, client) => {
			const region = getRegionGlobal(client.map, client.pony.x, client.pony.y);

			if (region) {
				saveRegionCollider(region);
				saySystem(client, 'saved');
				// console.log(region.tileIndices);
			}
		}, false, 'Superadmin'),
		DEVELOPMENT && command(['testparty'], '', 'superadmin', ({ party }, client) => {
			const entities = findEntities(client.map, e => !!e.client && /^debug/.test(e.name || ''));

			for (const e of entities.slice(0, PARTY_LIMIT - 1)) {
				party.invite(client, e.client!);
			}
		}, false, 'Superadmin'),
	]);

	return commands;
}

export function getSpamCommandNames(commands: Command[]): string[] {
	return flatten(commands.filter(c => c.spam).map(c => c.names));
}

export type RunCommand = ReturnType<typeof createRunCommand>;

export const createRunCommand =
	(context: CommandContext, commands: Command[]) =>
		(client: IClient, command: string, args: string, type: ChatType, target: IClient | undefined, settings: GameServerSettings) => {
			command = command.toLowerCase().trim();
			const func = commands.find(c => c.names.indexOf(command) !== -1);

			try {
				if (func && hasRoleNull(client, func.role)) {
					func.handler(context, client, args, type, target, settings);
				} else {
					return false;
				}
			} catch (err) {
				const e: any = err;
				if (e && typeof e.message === 'string') {
					saySystem(client, e.message);
				} else {
					throw err;
				}
			}

			return true;
		};

const chatTypes = new Map<string, ChatType>();
chatTypes.set('p', ChatType.Party);
chatTypes.set('party', ChatType.Party);
chatTypes.set('s', ChatType.Say);
chatTypes.set('say', ChatType.Say);
chatTypes.set('t', ChatType.Think);
chatTypes.set('think', ChatType.Think);
chatTypes.set('ss', ChatType.Supporter);
chatTypes.set('s1', ChatType.Supporter1);
chatTypes.set('s2', ChatType.Supporter2);
chatTypes.set('s3', ChatType.Supporter3);
chatTypes.set('r', ChatType.Whisper);
chatTypes.set('reply', ChatType.Whisper);
chatTypes.set('w', ChatType.Whisper);
chatTypes.set('whisper', ChatType.Whisper);

export function parseCommand(text: string, type: ChatType): { command?: string; args: string; type: ChatType; } {
	if (!isCommand(text) || text.toLowerCase().startsWith('/shrug')) {
		return { args: text, type };
	}

	const { command, args } = processCommand(text);

	if (command) {
		const chatType = chatTypes.get(command.toLowerCase());

		if (chatType !== undefined) {
			if (chatType === ChatType.Think) {
				type = type === ChatType.Party ? ChatType.PartyThink : ChatType.Think;
			} else {
				type = chatType;
			}

			return { args, type };
		}
	}

	return { command, args, type };
}

export function getChatPrefix(type: ChatType) {
	switch (type) {
		case ChatType.Party:
		case ChatType.PartyThink:
			return '/p ';
		case ChatType.Supporter:
			return '/ss ';
		case ChatType.Dismiss:
			return '/dismiss ';
		case ChatType.Whisper:
			return '/w ';
		default:
			return '';
	}
}
