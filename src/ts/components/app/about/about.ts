import { Component, OnInit } from '@angular/core';
import { emojis } from '../../../client/emoji';
import { getUrl } from '../../../client/rev';
import { CREDITS, CONTRIBUTORS, Credit } from '../../../client/credits';
import { isPrivilegedAccount } from '../../../common/changelogUtils';
import { SUPPORTER_REWARDS_LIST } from '../../../common/constants';
import { discordLink, contactEmail, contactDiscord, version, shortVersion } from '../../../client/data';
import { Model } from '../../services/model';

function toCredit(credit: Credit) {
	return {
		...credit,
		background: `url(${getUrl('images/avatars.jpg')})`,
		position: `${(credit.avatarIndex % 4) * -82}px ${Math.floor(credit.avatarIndex / 4) * -82}px`,
	};
}

@Component({
	selector: 'about',
	templateUrl: 'about.pug',
	styleUrls: ['about.scss'],
})
export class About implements OnInit {
	constructor(public model: Model) {}

	readonly title = document.title;
	readonly emotes = emojis;
	readonly credits = CREDITS.map(toCredit);
	readonly contributors = CONTRIBUTORS;
	readonly rewards = SUPPORTER_REWARDS_LIST;
	readonly discordLink = discordLink;
	readonly contactEmail = contactEmail;
	readonly contactDiscord = contactDiscord;
	readonly version = version;
	readonly shortVersion = shortVersion;

	changelogResponse: any = null;

	get isPrivileged() {
		return isPrivilegedAccount(this.model.account);
	}

	ngOnInit() {
		// Fetch changelog from server
		this.model.fetchChangelog().then(response => {
			this.changelogResponse = response;
		}).catch(err => {
			console.error('Failed to fetch changelog:', err);
		});
	}
}
