import { Component, Input } from '@angular/core';
import { PonyInfo } from '../../../common/interfaces';

@Component({
	selector: 'pony-preview',
	templateUrl: 'pony-info.pug',
	styleUrls: ['pony-info.scss'],
})
export class PonyPreview {
	@Input() pony?: PonyInfo;
	@Input() name?: string;
	@Input() tag?: string;
	@Input() passive = true;
	@Input() scale = 1;
	@Input() noBackground = false;
	@Input() allowAnyTag = false;
	@Input() namePlateOffsetY = 10;
	@Input() tagOnlyNamePlateOffsetY = -1;
}
