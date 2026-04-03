import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { faSpinner } from '../../../client/icons';
import { SettingsService } from '../../services/settingsService';
import { Model } from '../../services/model';
import { isPrivilegedAccount } from '../../../common/changelogUtils';

@Component({
	selector: 'changelog-modal',
	templateUrl: 'changelog-modal.pug',
	styleUrls: ['changelog-modal.scss'],
})
export class ChangelogModal implements OnInit {
	@Output() close = new EventEmitter<void>();
	
	readonly spinnerIcon = faSpinner;
	readonly debug = (typeof DEVELOPMENT !== 'undefined' && (DEVELOPMENT || typeof BETA !== 'undefined' && BETA));
	
	alwaysShowAfterLoad = true;
	changelogResponse: any = null;
	
	constructor(
		public settingsService: SettingsService,
		public model: Model,
	) {}

	get headerTitle() {
		if (this.changelogResponse && this.changelogResponse.seasons.length > 0) {
			const firstSeason = this.changelogResponse.seasons[0];
			if (firstSeason.patches.length > 0) {
				return `Welcome to ${firstSeason.patches[0].version}!`;
			}
		}
		return 'Changelog';
	}

	get isPrivileged() {
		return isPrivilegedAccount(this.model.account);
	}
	
	ngOnInit() {
		// Load saved preference (default to true if not set)
		this.alwaysShowAfterLoad = !this.settingsService.browser.hideChangelogModal;

		// Fetch changelog from server
		this.model.fetchChangelog().then(response => {
			this.changelogResponse = response;
		}).catch(err => {
			console.error('Failed to fetch changelog:', err);
		});
	}
	
	closeModal() {
		this.close.emit();
	}
}
