import { CharacterTag, FontPalettes } from './interfaces';
import { hasRole, AccountRoles } from './accountUtils';
import { MOD_COLOR, ADMIN_COLOR, PATREON_COLOR, ANNOUNCEMENT_COLOR, WHITE, OWNER_COLOR } from './colors';
import {
	faUserCog,
	faCode,
	faPaintBrush,
	faVolumeUp,
	faStar,
	faEyeSlash,
	faBan,
	partyLeaderIcon,
} from '../client/icons';

const placeholder = { id: '', tagClass: '', label: '', icon: undefined };
const tags: { [key: string]: CharacterTag; } = {
	'mod': { ...placeholder, name: 'moderator', className: 'mod', color: MOD_COLOR, icon: faUserCog },
	'owner': { ...placeholder, name: 'server owner', className: 'owner', color: OWNER_COLOR, icon: partyLeaderIcon },
	'dev': { ...placeholder, name: 'developer', className: 'dev', color: ADMIN_COLOR, icon: faCode },
	'dev:art': { ...placeholder, name: 'dev artist', className: 'dev', color: ADMIN_COLOR, icon: faPaintBrush },
	'dev:music': { ...placeholder, name: 'dev musician', className: 'dev', color: ADMIN_COLOR, icon: faVolumeUp },
	'sup1': { ...placeholder, name: 'supporter', className: 'sup1', color: PATREON_COLOR, icon: faStar },
	'sup2': { ...placeholder, name: 'supporter', className: 'sup2', color: WHITE, icon: faStar },
	'sup3': { ...placeholder, name: 'supporter', className: 'sup3', color: WHITE, icon: faStar },
	'sup4': { ...placeholder, name: 'supporter', className: 'sup4', color: WHITE, icon: faStar },
	'hidden': { ...placeholder, name: 'hidden', className: 'hidden', color: ANNOUNCEMENT_COLOR, icon: faEyeSlash },
};

Object.keys(tags).forEach(id => {
	const tag = tags[id];
	tag.id = id;
	tag.label = `<${tag.name.toUpperCase()}>`;
	tag.tagClass = `tag-${tag.className}`;
});

export const emptyTag: CharacterTag = { id: '', name: 'no tag', label: '', className: '', tagClass: '', color: 0, icon: faBan };

export function getAllTags() {
	return Object.keys(tags).map(key => tags[key]);
}

export function getTag(id: string | undefined): CharacterTag | undefined {
	return id ? tags[id] : undefined;
}

export function getTagTooltipById(id: string | undefined): string | undefined {
	if (!id) return undefined;
	const supporter = /^sup([1-4])$/.exec(id);
	if (supporter) {
		return `supporter tier ${supporter[1]}`;
	}
	const tag = getTag(id);
	return tag ? tag.name : id;
}

export function getTagTooltip(tag: CharacterTag | undefined): string | undefined {
	return getTagTooltipById(tag && tag.id);
}

export function getTagPalette(tag: CharacterTag, palettes: FontPalettes) {
	switch (tag.id) {
		case 'sup2': return palettes.supporter2;
		case 'sup3': return palettes.supporter3;
		case 'sup4': return palettes.supporter4;
		case 'owner': return palettes.owner;
		default: return palettes.white;
	}
}

export function canUseTag(account: AccountRoles, tag: string) {
	if (tag === 'mod') {
		return hasRole(account, 'mod');
	} else if (tag === 'owner') {
		return hasRole(account, 'owner');
	} else if (tag === 'dev' || /^dev:/.test(tag)) {
		return hasRole(account, 'dev');
	} else {
		return false;
	}
}

export function getAvailableTags(account: AccountRoles): CharacterTag[] {
	return getAllTags().filter(tag => canUseTag(account, tag.id));
}
