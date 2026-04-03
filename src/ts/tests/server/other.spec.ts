import '../lib';
import { expect } from 'chai';
import { CHANGELOG_PUBLIC } from '../../generated/changelog';

describe('other', () => {
	it('package version is the same as latest public changelog version entry', () => {
		const packageJson: any = require('../../../../package.json');
		const packageVersion = packageJson.version.replace(/-alpha$/, '');
		const publicEntry = CHANGELOG_PUBLIC.find((entry: any) => !entry.dev) || CHANGELOG_PUBLIC[0];
		const changelogVersion = (publicEntry && publicEntry.version || '').replace(/^v/, '');
		expect(packageVersion).equal(changelogVersion, `package: ${packageVersion}, changelog: ${changelogVersion}`);
	});
});
