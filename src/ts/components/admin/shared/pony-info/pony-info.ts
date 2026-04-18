import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { hasFlag } from '../../../../common/utils';
import { Character, CharacterFlags, Account } from '../../../../common/adminInterfaces';
import { isForbiddenName } from '../../../../common/security';
import { supporterLevel } from '../../../../common/adminUtils';
import { AdminModel } from '../../../services/adminModel';
import { Subscription } from '../../../../common/interfaces';

@Component({
	selector: 'pony-info',
	templateUrl: 'pony-info.pug',
	styleUrls: ['pony-info.scss'],
})
export class PonyInfo implements OnChanges, OnDestroy {
	@Input() pony?: Character;
	@Input() highlight = false;
	labelClass = 'badge-none';
	account?: Account;
	private promise?: Promise<void>;
	private subscription?: Subscription;
	constructor(private model: AdminModel) {
	}
	get isBadCM() {
		return !!this.pony && hasFlag(this.pony.flags, CharacterFlags.BadCM);
	}
	get previewTag() {
		if (this.pony && this.pony.tag) {
			return this.pony.tag;
		}

		const account = this.account;
		if (!account) {
			return undefined;
		}

		const roles = account.roles || [];
		if (roles.indexOf('owner') !== -1) return 'owner';
		if (roles.indexOf('dev') !== -1) return 'dev';
		if (roles.indexOf('mod') !== -1) return 'mod';

		const level = supporterLevel(account as any);
		if (level > 0 && this.pony && !hasFlag(this.pony.flags, CharacterFlags.HideSupport)) {
			return `sup${Math.min(4, level)}`;
		}

		return undefined;
	}
	ngOnChanges() {
		if (this.pony) {
			if (isForbiddenName(this.pony.name)) {
				this.labelClass = 'badge-forbidden';
			} else if (hasFlag(this.pony.flags, CharacterFlags.BadCM)) {
				this.labelClass = 'badge-danger';
			} else {
				this.labelClass = 'badge-none';
			}
		}
	}
	ngOnDestroy() {
		this.subscription && this.subscription.unsubscribe();
	}
	onShown() {
		if (this.pony) {
			if (!this.pony.ponyInfo && !this.promise) {
				this.promise = this.model.getPonyInfo(this.pony)
					.finally(() => this.promise = undefined);
			}
			if (this.pony.account && !this.account && !this.subscription) {
				this.subscription = this.model.accounts
					.subscribe(this.pony.account, account => this.account = account);
			}
		}
	}
	click() {
		console.log(this.pony);
	}
}
