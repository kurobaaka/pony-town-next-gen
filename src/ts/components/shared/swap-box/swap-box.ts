import { Component, NgZone, ViewChild } from '@angular/core';
import { PonyTownGame } from '../../../client/game';
import { PonyObject, Action } from '../../../common/interfaces';
import { Dropdown } from '../directives/dropdown';
import { faClock, faExchangeAlt } from '../../../client/icons';
import { Model } from '../../services/model';
// import { SWAP_TIMEOUT, SECOND } from '../../../common/constants';

@Component({
	selector: 'swap-box',
	templateUrl: 'swap-box.pug',
	styleUrls: ['swap-box.scss'],
})
export class SwapBox {
	readonly swapIcon = faExchangeAlt;
	readonly timerIcon = faClock;
	@ViewChild('dropdown', { static: true }) dropdown!: Dropdown;
	timeout = false;
	constructor(private game: PonyTownGame, private zone: NgZone, private model: Model) {
	}
	toggleSwapDropdown() {
		this.zone.run(() => setTimeout(() => { }, 10));
	}
	swapPony(pony: PonyObject) {
		this.game.send(server => server.actionParam(Action.SwapCharacter, pony.id));
		setTimeout(() => {
			this.dropdown && this.dropdown.close();
			pony.lastUsed = (new Date()).toISOString();
			this.model.sortPonies();
		});

		// if (!this.timeout) {
		// 	this.timeout = true;
		// 	setTimeout(() => this.timeout = false, SWAP_TIMEOUT + SECOND);
		// }
	}
}
