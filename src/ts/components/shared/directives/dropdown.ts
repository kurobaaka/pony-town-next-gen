import {
	Directive, HostListener, Input, Output, EventEmitter, TemplateRef, ViewContainerRef, ContentChild,
	Renderer2, ElementRef, EmbeddedViewRef, Component, Injectable
} from '@angular/core';
import { uniqueId } from 'lodash';
import { focusFirstElement } from '../../../client/htmlUtils';

@Injectable({ providedIn: 'root' })
export class DropdownOutletService {
	viewContainer?: ViewContainerRef;
	rootElement?: HTMLElement;
}

@Component({
	selector: 'dropdown-outlet',
	template: `<ng-template></ng-template>`,
})
export class DropdownOutlet {
	constructor(service: DropdownOutletService, viewContainer: ViewContainerRef, element: ElementRef) {
		service.viewContainer = viewContainer;
		service.rootElement = element.nativeElement.parentElement;
	}
}

@Directive({
	selector: '[dropdownMenu]',
})
export class DropdownMenu {
	ref?: EmbeddedViewRef<any>;
	id = uniqueId('dropdown-menu-');
	private onClose?: () => void;
	constructor(
		private templateRef: TemplateRef<any>,
		private viewContainer: ViewContainerRef,
		private renderer: Renderer2,
		private service: DropdownOutletService,
	) {
	}
	private get root(): HTMLElement {
		return this.ref && this.ref.rootNodes[0];
	}
	open(useOutlet: boolean, rootElement: HTMLElement) {
		if (!this.ref) {
			if (useOutlet) {
				this.ref = this.service.viewContainer!.createEmbeddedView(this.templateRef);
			} else {
				this.ref = this.viewContainer.createEmbeddedView(this.templateRef);
			}

			const { renderer, root } = this;

			renderer.addClass(root, 'show');
			renderer.addClass(root, 'ag-dropdown-menu');
			renderer.setAttribute(root, 'id', this.id);

			if (useOutlet) {
				const positionMenu = () => {
					const rect = rootElement.getBoundingClientRect();
					const menuRect = root.getBoundingClientRect();
					let transform: string;

					if ((rect.bottom + menuRect.height) > window.innerHeight) {
						transform = `translate3d(${Math.round(rect.left)}px, ${Math.round(rect.top - menuRect.height)}px, 0)`;
						renderer.addClass(root, 'dropdown-menu-up');
					} else {
						transform = `translate3d(${Math.round(rect.left)}px, ${Math.round(rect.bottom)}px, 0)`;
						renderer.removeClass(root, 'dropdown-menu-up');
					}

					renderer.setStyle(root, 'transform', transform);
				};

				renderer.addClass(root, 'dropdown-in-outlet');
				positionMenu();

				const closeDropdown = () => {
					this.close();
				};

				document.addEventListener('scroll', closeDropdown, true);
				window.addEventListener('resize', closeDropdown, true);

				this.onClose = () => {
					document.removeEventListener('scroll', closeDropdown, true);
					window.removeEventListener('resize', closeDropdown, true);
				};
			}
		}
	}
	close() {
		if (this.ref) {
			this.ref.destroy();
			this.ref = undefined;
		}

		if (this.onClose) {
			this.onClose();
			this.onClose = undefined;
		}
	}
	checkTarget(e: Event) {
		return this.root && this.root.contains(e.target as any);
	}
	focusFirstElement() {
		if (this.root) {
			focusFirstElement(this.root);
		}
	}
	getRootElement() {
		return this.root;
	}
}

@Directive({
	selector: '[dropdown]',
	exportAs: 'ag-dropdown',
	host: {
		'[class.show]': 'isOpen',
	},
})
export class Dropdown {
	dropdownToggle?: DropdownToggle;
	@ContentChild(DropdownMenu, { static: false }) menu!: DropdownMenu;
	@Input() autoClose: boolean | 'outsideClick' = true;
	@Input() preventAutoCloseOnOutlet = false;
	@Input() hookToCanvas = false;
	@Input() focusOnOpen = true;
	@Input() focusOnClose = true;
	@Input() useOutlet = false;
	@Input() isOpen = false;
	@Output() isOpenChange = new EventEmitter<boolean>();
	private menuItemClickHandler: any = (e: Event) => {
		const root = this.menu.getRootElement();
		if (!root) return;

		const target = e.target as HTMLElement | null;
		const item = target && target.closest('.dropdown-item') as HTMLElement | null;
		if (!item || !root.contains(item)) return;
		if (item.classList.contains('disabled') || item.hasAttribute('disabled')) return;

		this.applySelectedMarker();
		setTimeout(() => this.applySelectedMarker());
	};
	get menuId() {
		return this.isOpen ? this.menu.id : '';
	}
	constructor(private element: ElementRef, private service: DropdownOutletService) {
	}
	open() {
		if (!this.isOpen) {
			this.isOpen = true;
			this.isOpenChange.emit(true);
			this.menu.open(this.useOutlet, this.element.nativeElement);
			this.applySelectedMarker();

			setTimeout(() => {
				document.addEventListener('click', this.closeHandler);
				document.addEventListener('keydown', this.closeHandler);

				const root = this.menu.getRootElement();
				if (root) {
					root.addEventListener('click', this.menuItemClickHandler);
				}

				if (this.focusOnOpen) {
					this.menu.focusFirstElement();
				}

				if (this.hookToCanvas) {
					const canvas = document.getElementById('canvas');

					if (canvas) {
						canvas.addEventListener('touchstart', this.canvasCloseHandler);
						canvas.addEventListener('mousedown', this.canvasCloseHandler);
					}
				}

				this.applySelectedMarker();
			});
		}
	}
	close() {
		if (this.isOpen) {
			const root = this.menu.getRootElement();
			if (root) {
				root.removeEventListener('click', this.menuItemClickHandler);
			}

			this.isOpen = false;
			this.isOpenChange.emit(false);
			this.menu.close();

			if (this.focusOnClose && this.dropdownToggle) {
				this.dropdownToggle.focus();
			}

			document.removeEventListener('click', this.closeHandler);
			document.removeEventListener('keydown', this.closeHandler);

			if (this.hookToCanvas) {
				const canvas = document.getElementById('canvas');

				if (canvas) {
					canvas.removeEventListener('touchstart', this.canvasCloseHandler);
					canvas.removeEventListener('mousedown', this.canvasCloseHandler);
				}
			}
		}
	}
	toggle() {
		if (this.isOpen) {
			this.close();
		} else {
			this.open();
		}
	}
	private getMenuItems() {
		const root = this.menu.getRootElement();
		return root ? Array.from(root.querySelectorAll('.dropdown-item')) as HTMLElement[] : [];
	}
	private normalizeText(value: string | undefined | null) {
		return (value || '')
			.replace(/\s+/g, ' ')
			.replace(/\.\.\.$/, '')
			.trim()
			.toLowerCase();
	}
	private getToggleText() {
		const toggle = this.dropdownToggle && this.dropdownToggle.getText();
		return this.normalizeText(toggle);
	}
	private getItemText(item: HTMLElement) {
		return this.normalizeText(item.innerText || item.textContent || '');
	}
	private findItemIndexByToggleText(items: HTMLElement[]) {
		const toggleText = this.getToggleText();

		if (!toggleText) {
			return -1;
		}

		let index = items.findIndex(item => this.getItemText(item) === toggleText);

		if (index === -1) {
			index = items.findIndex(item => {
				const itemText = this.getItemText(item);
				return !!itemText && (itemText.startsWith(toggleText) || toggleText.startsWith(itemText));
			});
		}

		if (index === -1) {
			index = items.findIndex(item => {
				const itemText = this.getItemText(item);
				return !!itemText && (itemText.includes(toggleText) || toggleText.includes(itemText));
			});
		}

		return index;
	}
	private applySelectedMarker() {
		const items = this.getMenuItems();
		if (!items.length) return;

		const index = this.findItemIndexByToggleText(items);
		items.forEach((item, i) => item.classList.toggle('ag-selected', i === index));
	}
	private closeHandler: any = (e: KeyboardEvent) => {
		if (
			!e.keyCode
			&& (this.autoClose || (this.dropdownToggle && this.dropdownToggle.checkTarget(e)))
			&& !(this.preventAutoCloseOnOutlet && this.service.rootElement && this.service.rootElement.contains(e.target as any))
			&& !(this.autoClose === 'outsideClick' && this.menu.checkTarget(e))
		) {
			this.close();
		} else if (this.autoClose && e.keyCode === 27) { // esc
			this.close();
		}
	}
	private canvasCloseHandler: any = () => this.close();
}

@Directive({
	selector: '[dropdownToggle]',
	host: {
		'aria-haspopup': 'true',
		'[attr.aria-expanded]': 'dropdown.isOpen',
		'[attr.aria-controls]': 'dropdown.isOpen ? dropdown.menuId : undefined',
	},
})
export class DropdownToggle {
	constructor(private element: ElementRef, public dropdown: Dropdown) {
		dropdown.dropdownToggle = this;
	}
	@HostListener('click')
	click() {
		this.dropdown.toggle();
	}
	checkTarget(e: Event) {
		return this.element.nativeElement.contains(e.target);
	}
	getText() {
		return (this.element.nativeElement.innerText || this.element.nativeElement.textContent || '') as string;
	}
	focus() {
		this.element.nativeElement.focus();
	}
}

export const dropdownDirectives = [Dropdown, DropdownToggle, DropdownMenu, DropdownOutlet];
