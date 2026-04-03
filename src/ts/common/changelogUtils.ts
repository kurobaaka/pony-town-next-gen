import { CHANGELOG_PUBLIC, CHANGELOG_DEV } from '../generated/changelog';
import { AccountRoles, isAdmin, isDev, isMod } from './accountUtils';

export interface ChangelogRawEntry {
	version: string;
	changes: string[];
}

export interface ChangelogParsedEntry extends ChangelogRawEntry {
	season: number;
	patch: number;
	status?: string;
	shortVersion: string;
	extraTitle: string;
	hiddenIndex?: number;
}

export interface ChangelogSeasonGroup {
	season: number;
	patches: ChangelogParsedEntry[];
}

export interface ChangelogResponse {
	public: ChangelogRawEntry[];
	dev: ChangelogRawEntry[];
}

const VERSION_REGEX = /^\s*Season\s+(\d+)\s*[—-]\s*Patch\s+(\d+)(?:\s*\|\s*(.+))?/i;

export function parseChangelogVersion(version: string): {
	season: number;
	patch: number;
	status?: string;
	shortVersion: string;
	extraTitle: string;
} {
	const match = VERSION_REGEX.exec(version);

	if (match) {
		const season = Number(match[1]);
		const patch = Number(match[2]);
		const status = match[3] ? match[3].trim() : undefined;
		const shortVersion = `S${season}-P${patch}`;
		const extraTitle = `Season ${season} — Patch ${patch}${status ? ` | ${status}` : ''}`;

		return { season, patch, status, shortVersion, extraTitle };
	}

	// fallback for unstructured entries
	return {
		season: 0,
		patch: 0,
		shortVersion: 'S0-P0',
		extraTitle: version,
	};
}

export function isPrivilegedAccount(account?: AccountRoles | undefined): boolean {
	return !!account && (isAdmin(account as any) || isMod(account as any) || isDev(account as any));
}

export function getServerChangelog(account?: AccountRoles | undefined): ChangelogResponse {
	const allowDev = isPrivilegedAccount(account);
	return {
		public: CHANGELOG_PUBLIC,
		dev: allowDev ? CHANGELOG_DEV : [],
	};
}

export function mergeChangelog(r: ChangelogResponse): ChangelogRawEntry[] {
	return [...r.public, ...r.dev];
}

export function buildSeasonGroups(entries: ChangelogRawEntry[]): ChangelogSeasonGroup[] {
	const parsed = entries.map(e => ({ ...e, ...parseChangelogVersion(e.version) }));
	const sorted = parsed.sort((a, b) => {
		if (b.season !== a.season) return b.season - a.season;
		if (b.patch !== a.patch) return b.patch - a.patch;
		return 0;
	});

	const resultMap = new Map<number, ChangelogParsedEntry[]>();
	for (const entry of sorted) {
		if (!resultMap.has(entry.season)) {
			resultMap.set(entry.season, []);
		}
		resultMap.get(entry.season)!.push(entry);
	}

	let hiddenCounter = 0;

	for (const season of Array.from(resultMap.values())) {
		for (let i = 0; i < season.length; i++) {
			if (i >= 2) {
				season[i].hiddenIndex = hiddenCounter++;
			}
		}
	}

	return Array.from(resultMap.entries()).map(([season, patches]) => ({ season, patches }));
}

