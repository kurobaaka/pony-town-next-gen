import { Component } from '@angular/core';
import { Model } from '../../services/model';
import { emojis } from '../../../client/emoji';
import { faArrowLeft, faArrowRight, faArrowUp, faArrowDown } from '../../../client/icons';
import { contactEmail, contactDiscord } from '../../../client/data';
import { ActivatedRoute } from '@angular/router';

@Component({
	selector: 'help',
	templateUrl: 'help.pug',
	styleUrls: ['help.scss'],
})
export class Help {
	readonly leftIcon = faArrowLeft;
	readonly rightIcon = faArrowRight;
	readonly upIcon = faArrowUp;
	readonly downIcon = faArrowDown;
	readonly emotes = emojis.map(e => e.names[0]);
	readonly mac = /Macintosh/.test(navigator.userAgent);
	readonly contactEmail = contactEmail;
	readonly contactDiscord = contactDiscord;

	// allow scrolling to #issues and #rules fragments

	constructor(private route: ActivatedRoute, public model: Model) {}

	get isMod() { return this.model.isMod; }
	get isSupporter() {
		const a = this.model.account;
		return !!(a && a.supporter);
	}

	// expose account for convenience (matching other components)
	get account() {
		return this.model.account;
	}

	get isAdmin() {
		const a = this.model.account;
		return !!(a && a.roles && a.roles.indexOf('admin') !== -1);
	}
	get isOwner() {
		const a = this.model.account;
		return !!(a && a.roles && a.roles.indexOf('owner') !== -1);
	}

	ngAfterViewInit() {
		this.route.fragment.subscribe(f => {
		  const element = document.querySelector("#" + f);
		  if (element) setTimeout(() => element.scrollIntoView(), 10);
		})
	}
}
