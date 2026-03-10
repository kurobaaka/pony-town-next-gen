import { Component, DoCheck, ViewChild, TemplateRef } from '@angular/core';
import { faSpinner } from '../../../client/icons';
import { Model } from '../../services/model';
import { hardReload } from '../../../client/clientUtils';
import { BsModalService, BsModalRef } from 'ngx-bootstrap/modal';

@Component({
	selector: 'page-loader',
	templateUrl: 'page-loader.pug',
	styleUrls: ['page-loader.scss'],
})
export class PageLoader implements DoCheck {
	readonly spinnerIcon = faSpinner;
	@ViewChild('changelogModal', { static: true }) changelogModal!: TemplateRef<any>;
	modalRef?: BsModalRef;
	private wasUpdatingShown = false;
	private prevVisible = false;
	readonly debug = (typeof DEVELOPMENT !== 'undefined' && (DEVELOPMENT || typeof BETA !== 'undefined' && BETA));
	constructor(private model: Model, private modalService: BsModalService) {
	}
	get loading() {
		return this.model.loading;
	}
	get updating() {
		return this.model.updating;
	}
	get updatingTakesLongTime() {
		return this.model.updatingTakesLongTime;
	}
	get loadingError() {
		return this.model.loadingError;
	}
	reload() {
		hardReload();
	}
	ngDoCheck() {
		const visible = this.loading || this.updating;
		if (this.updating) {
			this.wasUpdatingShown = true;
		}
		// transition from visible -> hidden
		if (this.prevVisible && !visible) {
			// Only open if the loader previously showed "Updating..." or we are in debug mode
			if ((this.wasUpdatingShown || this.debug) && !this.modalRef) {
				this.modalRef = this.modalService.show(this.changelogModal, { class: 'modal-lg' });
				const mref: any = this.modalRef as any;
				if (mref && mref.onHidden && mref.onHidden.subscribe) {
					mref.onHidden.subscribe(() => {
						this.modalRef = undefined;
					});
				}
			}
			this.wasUpdatingShown = false;
		}
		this.prevVisible = visible;
	}
}
