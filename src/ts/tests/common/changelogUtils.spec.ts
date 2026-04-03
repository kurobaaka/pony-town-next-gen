import '../lib';
import { expect } from 'chai';
import { getServerChangelog, mergeChangelog, isPrivilegedAccount } from '../../common/changelogUtils';
import { account } from '../mocks';

describe('changelogUtils', () => {
	it('returns only public changelog entries for anonymous account', () => {
		const response = getServerChangelog();
		const changelog = mergeChangelog(response);
		expect(changelog.every((entry: any) => !entry.dev)).true;
	});

	it('returns dev changelog entries for dev account', () => {
		const response = getServerChangelog(account({ roles: ['dev'] }));
		const changelog = mergeChangelog(response);
		expect(changelog.some((entry: any) => entry.dev)).true;
	});

	it('isPrivilegedAccount returns true for admin/mod/dev', () => {
		expect(isPrivilegedAccount(account({ roles: ['admin'] }))).true;
		expect(isPrivilegedAccount(account({ roles: ['mod'] }))).true;
		expect(isPrivilegedAccount(account({ roles: ['dev'] }))).true;
	});

	it('isPrivilegedAccount returns false for regular accounts', () => {
		expect(isPrivilegedAccount(account({ roles: ['supporter'] }))).false;
		expect(isPrivilegedAccount(undefined)).false;
	});
});