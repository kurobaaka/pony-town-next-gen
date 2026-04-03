export interface VersionInfo {
	major: number;
	minor: number;
	patch: number;
	prerelease?: string;
	build?: string;
}

const VERSION_REGEX = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;

export function parseVersion(version: string): VersionInfo | undefined {
	const match = VERSION_REGEX.exec((version || '').trim());

	if (!match) {
		return undefined;
	}

	return {
		major: Number(match[1]) || 0,
		minor: Number(match[2]) || 0,
		patch: Number(match[3]) || 0,
		prerelease: match[4],
		build: match[5],
	};
}

export function formatVersion(info: VersionInfo): string {
	let value = `${info.major}.${info.minor}.${info.patch}`;

	if (info.prerelease) {
		value += `-${info.prerelease}`;
	}

	if (info.build) {
		value += `+${info.build}`;
	}

	return value;
}

export function normalizeVersion(version: string): string {
	const info = parseVersion(version);
	return info ? formatVersion(info) : version;
}

export function getChangelogVersion(version: string): string {
	// New version naming may include `v` prefix and optional tags, ensure canonical format.
	return normalizeVersion(version.replace(/^v/iu, ''));
}
