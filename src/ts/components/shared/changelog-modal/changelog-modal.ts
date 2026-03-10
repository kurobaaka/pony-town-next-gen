import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { faSpinner } from '../../../client/icons';
import { CHANGELOG } from '../../../generated/changelog';
import { SettingsService } from '../../services/settingsService';

@Component({
	selector: 'changelog-modal',
	templateUrl: 'changelog-modal.pug',
	styleUrls: ['changelog-modal.scss'],
})
export class ChangelogModal implements OnInit {
	@Output() close = new EventEmitter<void>();
	
	readonly spinnerIcon = faSpinner;
	readonly changelog = CHANGELOG;
	readonly headerTitle = CHANGELOG.length > 0 ? `Welcome to ${CHANGELOG[0].version}!` : 'Changelog';
	readonly debug = (typeof DEVELOPMENT !== 'undefined' && (DEVELOPMENT || typeof BETA !== 'undefined' && BETA));
	
	alwaysShowAfterLoad = true;
	
	constructor(public settingsService: SettingsService) {}
	
	ngOnInit() {
		// Load saved preference (default to true if not set)
		this.alwaysShowAfterLoad = !this.settingsService.browser.hideChangelogModal;
	}
	
	closeModal() {
		this.close.emit();
	}
}
