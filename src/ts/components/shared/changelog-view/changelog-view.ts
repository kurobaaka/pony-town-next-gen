import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChangelogSeasonGroup, ChangelogParsedEntry, buildSeasonGroups } from '../../../common/changelogUtils';

@Component({
	selector: 'changelog-view',
	templateUrl: 'changelog-view.pug',
	styleUrls: ['changelog-view.scss'],
})
export class ChangelogView implements OnChanges {
	@Input() rawEntries: { version: string; changes: string[]; }[] = [];
	@Input() changelogResponse: any;

	seasonGroups: ChangelogSeasonGroup[] = [];
	showAll = false;
	revealedPrevious = 0;

	ngOnChanges(changes: SimpleChanges) {
		if (changes.rawEntries) {
			this.seasonGroups = buildSeasonGroups(this.rawEntries);
			this.showAll = false;
			this.revealedPrevious = 0;
		}
		if (changes.changelogResponse && this.changelogResponse) {
			this.seasonGroups = this.changelogResponse.seasons || [];
			this.showAll = false;
			this.revealedPrevious = 0;
		}
	}

	get hiddenEntries() {
		const hidden: ChangelogParsedEntry[] = [];
		for (const season of this.seasonGroups) {
			season.patches.forEach(patch => {
				if (patch.hiddenIndex !== undefined && patch.hiddenIndex >= 0) {
					hidden.push(patch);
				}
			});
		}
		return hidden;
	}

	get canShowPrevious() {
		return this.revealedPrevious < this.hiddenEntries.length;
	}

	get canShowAll() {
		return !this.showAll && this.hiddenEntries.length > 0;
	}

	showPreviousPatch() {
		if (!this.canShowPrevious) {
			return;
		}

		this.revealedPrevious += 1;
	}

	showAllPatches() {
		this.showAll = true;
	}

	isPatchVisible(patch: ChangelogParsedEntry) {
		if (patch.hiddenIndex === undefined) {
			return true;
		}

		if (this.showAll) {
			return true;
		}

		return patch.hiddenIndex < this.revealedPrevious;
	}

	getSeasonImageUrl(season: number) {
		return `/assets/images/seasonal update previews/season${season}.png`;
	}
}
