import {
	BASE_CHARACTER_LIMIT, ADDITIONAL_CHARACTERS_SUPPORTER1, ADDITIONAL_CHARACTERS_SUPPORTER2,
	ADDITIONAL_CHARACTERS_SUPPORTER3, ADDITIONAL_CHARACTERS_SUPPORTER4, ADDITIONAL_CHARACTERS_PAST_SUPPORTER,
	SUPPORTER_FRIENDS_LIMITS, FRIENDS_LIMIT
} from './constants';
import { AccountDataFlags } from './interfaces';
import { hasFlag } from './utils';

export interface AccountRoles {
	roles?: string[] | undefined;
}

export interface AccountSupporter extends AccountRoles {
	supporter?: number | undefined;
	supporterInvited?: boolean;
	flags?: AccountDataFlags;
}

export function hasRole(account: AccountRoles | undefined, role: string): boolean {
	return !!(account && account.roles && account.roles.indexOf(role) !== -1);
}

export function isAdmin(account: AccountRoles): boolean {
	return hasRole(account, 'admin') || hasRole(account, 'owner');
}

export function isMod(account: AccountRoles): boolean {
	return hasRole(account, 'mod') || isAdmin(account);
}

export function isDev(account: AccountRoles): boolean {
	return hasRole(account, 'dev');
}

export function meetsRequirement(account: AccountSupporter, require: string | undefined): boolean {
	return !require || hasRole(account, require) || meetsSupporterRequirement(account, require);
}

function meetsSupporterRequirement(account: AccountSupporter, require: string): boolean {
	const level = account.supporter || 0;
	const modOrDev = isMod(account) || isDev(account);

	if (require === 'inv') {
		return modOrDev || level >= 1 || !!account.supporterInvited;
	} else if (require === 'sup1') {
		return modOrDev || level >= 1;
	} else if (require === 'sup2') {
		return modOrDev || level >= 2;
	} else if (require === 'sup3') {
		return modOrDev || level >= 3;
	} else if (require === 'sup4') {
		return modOrDev || level >= 4;
	} else {
		return false;
	}
}

export function getCharacterLimit(account: AccountSupporter) {
	switch (account.supporter || 0) {
		case 1: return BASE_CHARACTER_LIMIT + ADDITIONAL_CHARACTERS_SUPPORTER1;
		case 2: return BASE_CHARACTER_LIMIT + ADDITIONAL_CHARACTERS_SUPPORTER2;
		case 3: return BASE_CHARACTER_LIMIT + ADDITIONAL_CHARACTERS_SUPPORTER3;
		case 4: return BASE_CHARACTER_LIMIT + ADDITIONAL_CHARACTERS_SUPPORTER4;
		default:
			if (hasFlag(account.flags, AccountDataFlags.PastSupporter)) {
				return BASE_CHARACTER_LIMIT + ADDITIONAL_CHARACTERS_PAST_SUPPORTER;
			} else {
				return BASE_CHARACTER_LIMIT;
			}
	}
}

export function getSupporterInviteLimit(account: AccountSupporter) {
	if (isMod(account) || isDev(account)) {
		return 100;
	} else {
		switch (account.supporter) {
			case 1: return 1;
			case 2: return 5;
			case 3: return 10;
			case 4: return 15;
			default: return 0;
		}
	}
}

export function getFriendsLimit(account: AccountSupporter | undefined) {
	if (!account) {
		return FRIENDS_LIMIT;
	}

	if (isMod(account) || isDev(account)) {
		return FRIENDS_LIMIT;
	}

	const level = Math.max(0, Math.min(4, account.supporter || 0));
	const limit = SUPPORTER_FRIENDS_LIMITS[level];
	return typeof limit === 'number' ? limit : FRIENDS_LIMIT;
}
