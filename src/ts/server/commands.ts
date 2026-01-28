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

	const match = /^(\d+) (\d+)$/.exec(message.trim());

	if (!match) {
		throw new UserError('invalid parameters');
	}

	const [, tx, ty] = match;
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
			const categoryOrder = ['Chat', 'Actions', 'Pony states', 'Emotes', 'Expressions', 'House', 'Supporters', 'Mod', 'Admin', 'Superadmin', 'Debug', 'Other'];
			
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
		command(['gifts'], '/gifts - show gift score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'gifts')} 🎁`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['candies', 'candy'], '/candies - show candy score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'candies')} 🍬`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['eggs'], '/eggs - show egg score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'eggs')} 🥚`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['clovers', 'clover'], '/clovers - show clover score', '', ({ }, client, _, type, target, settings) => {
			sayToOthers(client, `collected ${getCounter(client, 'clovers')} 🍀`, toAnnouncementMessageType(type), target, settings);
		}, true, 'Chat'),
		command(['toys'], '/toys [list] - show number of collected toys (use "/toys list" to list your toys)', '', ({ }, client, message, type, target, settings) => {
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

		command(['account'], '/account <id|playtime|creation> - show account info', '', ({ }, client, message, type, target, settings) => {
			const cmd = (message || '').trim().toLowerCase();

			switch (cmd) {
				case 'id': {
					sayToOthers(client, `Your ID: ${client.accountId}`, toAnnouncementMessageType(type), target, settings);
					break;
				}
				case 'playtime': {
					const stored = (client.account.counters && (client.account.counters as any).playtime) ? (client.account.counters as any).playtime : 0;
					const session = Math.round((Date.now() - client.connectedTime) / 1000);
					const totalSeconds = stored + session;
					const text = `Total Playtime: ${formatPlaytime(totalSeconds)}`;
					sayToOthers(client, text, toAnnouncementMessageType(type), target, settings);
					break;
				}
				case 'creation': {
					const created = client.account.createdAt ? formatISODate(client.account.createdAt).replace(/-/g, '.') : 'unknown';
					sayToOthers(client, `Creation Date: ${created}`, toAnnouncementMessageType(type), target, settings);
					break;
				}
				default: {
					saySystem(client, 'usage: /account <id|playtime|creation>');
				}
			}
		}),

		command(['leave'], '/leave - leave the game', '', ({ world }, client) => {
			world.kick(client, '/leave');
		}, false, 'Chat'),

		// pony states
		command(['sit'], '/sit - sit down or stand up', '', shouldNotBeCalled, false, 'Pony states'),
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
				for (const [id, instances] of mapsList) {
					if (instances.size === 0) {
						lines.push(`  ${id}`);
					} else {
						lines.push(`  ${id} (instances: ${Array.from(instances).join(', ')})`);
					}
				}
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
				(client.pony as any).speedMultiplier = 1;
				saySystem(client, 'Speed reset to 1x');
				return;
			}

			const value = parseFloat(arg);

			if (isNaN(value) || value <= 0 || value > 4) {
				saySystem(client, 'Invalid speed. Provide number > 0 and <= 4, or "reset"');
				return;
			}

			(client.pony as any).speedMultiplier = value;
			saySystem(client, `Speed set to ${value}x`);
		}, false, 'Mod'),
		command(['tp'], '/tp <location|x y> - teleport to location/coords. Enable "Show stats" for Your Coords', 'mod', (_context, client, message) => {
			if (!message.trim()) {
				const lines = [
					'Teleport help',
					'',
					'Usage: /tp <location> or /tp <x> <y>',
					'Examples:',
					'  /tp spawn',
					'  /tp 100 200',
					'',
					'Tip: Enable "Show stats" in settings to see Your Coords',
				];
				saySystem(client, lines.join('\n'));
				return;
			}
			
			const { x, y } = getSpawnTarget(client.map, message);
			teleportTo(client, x, y);
			saySystem(client, `Teleported to (${x.toFixed(1)}, ${y.toFixed(1)})`);
		}, false, 'Mod'),

		command(['locations'], '/locations - list all spawn locations on current map', 'mod', ({ }, client) => {
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
			const lines = [
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
			for (const [id, data] of mapData) {
				const playerText = data.players === 1 ? 'pony' : 'ponies';
				if (data.players === 0) {
					lines.push(`${index}. ${id}`);
				} else {
					lines.push(`${index}. ${id}: ${data.players} ${playerText}`);
				}
				index++;
			}
			
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
		command(['time'], '/time <HH:MM|day|night> - set server time', DEVELOPMENT ? '' : 'admin', ({ world }, client, message) => {
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
				
				// Periodically re-set time every 2.5 seconds to maintain eternal day
				(world as any).timeIntervalId = setInterval(() => {
					world.setTime(12);
				}, 2500);
				
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
				
				// Periodically re-set time every 2.5 seconds to maintain eternal night
				(world as any).timeIntervalId = setInterval(() => {
					world.setTime(0);
				}, 2500);
				
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
