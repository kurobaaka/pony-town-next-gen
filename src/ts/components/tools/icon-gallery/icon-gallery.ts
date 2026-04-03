import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
	// Social
	faPatreon, faDeviantart, faTwitter, faTumblr, faFacebook, faGithub, faVk, faGoogle, faDiscord, faTiktok, faTelegram,
	// UI Navigation
	faHome, faArrowLeft, faArrowRight, faArrowUp, faArrowDown, faChevronUp, faChevronDown, faChevronLeft, faChevronRight,
	faAngleDoubleUp, faAngleDoubleDown, faAngleDoubleLeft, faAngleDoubleRight,
	// Actions
	faEdit, faSave, faTrash, faCopy, faShare, faCode, faTerminal, faClone, faRedo, faUndo, faSearch, faDownload, faUpload,
	// Common UI
	faCheck, faPlus, faMinus, faTimes, faBan, faLock, faCog, faCogs, faEllipsisV, faQuestionCircle, faInfo, faInfoCircle, faExclamationCircle,
	// Communication
	faComment, faComments, faCommentSlash, faEnvelope, faBell,
	// File & Media
	faFile, faFileAlt, faFileImage, faImage, faClipboard,
	// User & Social
	faUser, faUsers, faUserFriends, faUserPlus, faUserMinus, faUserTimes, faUserCog, faUserSecret,
	// Status & Indicators
	faSpinner, faClock, faCircle, faHeart, faStar, faCheckCircle, faPlusCircle, faMinusCircle, faCaretUp, faCaretSquareUp, faCaretSquareDown,
	// Device & Browser
	faApple, faWindows, faLinux, faAndroid, faChrome, faFirefox, faSafari, faOpera, faInternetExplorer, faEdge,
	// Sound & Volume
	faVolumeUp, faVolumeDown, faVolumeOff, faMicrophoneSlash,
	// Media Control
	faPlay, faPause, faStop, faStepForward,
	// Settings & System
	faFilter, faEraser, faPaintBrush, faEyeDropper, faLanguage, faFont, faExchangeAlt, faSlidersH, faSync,
	// Data & Storage
	faDatabase, faHdd, faMicrochip, faFolderOpen, faHorseHead,
	// UI Elements
	faCompressArrowsAlt, faCrosshairs, faDrawPolygon, faWrench, faIdBadge,
	// Other
	faGlobe, faCalendar, faChartPie, faMapMarkerAlt, faFlag, faStickyNote, faCertificate, faDesktop, faTablet, faTv, faMobile, faGamepad,
	faRetweet, faEyeSlash, faSignOutAlt, faHammer, faHashtag, faYandexInternational, faAmilia,
	// Additional
	faCrown, faPlug, faLaughBeam,
	faCircleUser, faHandWave, faMegaphone, faNote, faPencil, faSlash, faThumbtack, faUserCheck, faUsersSlash
} from '../../../client/icons';

export interface IconCategory {
	name: string;
	icons: { name: string; icon: any; }[];
}

@Component({
	selector: 'icon-gallery',
	templateUrl: 'icon-gallery.pug',
	styleUrls: ['icon-gallery.scss'],
})
export class IconGallery {
	searchControl = new FormControl('');

	get filteredCategories(): IconCategory[] {
		const q = (this.searchControl.value || '').trim().toLowerCase();
		if (!q) {
			return this.categories;
		}

		return this.categories
			.map(category => ({
				name: category.name,
				icons: category.icons.filter(icon => icon.name.toLowerCase().includes(q)),
			}))
			.filter(category => category.icons.length > 0);
	}

	categories: IconCategory[] = [
		{
			name: 'Social Networks',
			icons: [
				{ name: 'faPatreon', icon: faPatreon },
				{ name: 'faDeviantart', icon: faDeviantart },
				{ name: 'faTwitter', icon: faTwitter },
				{ name: 'faTumblr', icon: faTumblr },
				{ name: 'faFacebook', icon: faFacebook },
				{ name: 'faGithub', icon: faGithub },
				{ name: 'faVk', icon: faVk },
				{ name: 'faGoogle', icon: faGoogle },
				{ name: 'faDiscord', icon: faDiscord },
				{ name: 'faTiktok', icon: faTiktok },
				{ name: 'faTelegram', icon: faTelegram },
			]
		},
		{
			name: 'Navigation',
			icons: [
				{ name: 'faHome', icon: faHome },
				{ name: 'faArrowLeft', icon: faArrowLeft },
				{ name: 'faArrowRight', icon: faArrowRight },
				{ name: 'faArrowUp', icon: faArrowUp },
				{ name: 'faArrowDown', icon: faArrowDown },
				{ name: 'faChevronUp', icon: faChevronUp },
				{ name: 'faChevronDown', icon: faChevronDown },
				{ name: 'faChevronLeft', icon: faChevronLeft },
				{ name: 'faChevronRight', icon: faChevronRight },
				{ name: 'faAngleDoubleUp', icon: faAngleDoubleUp },
				{ name: 'faAngleDoubleDown', icon: faAngleDoubleDown },
				{ name: 'faAngleDoubleLeft', icon: faAngleDoubleLeft },
				{ name: 'faAngleDoubleRight', icon: faAngleDoubleRight },
			]
		},
		{
			name: 'Actions & Editing',
			icons: [
				{ name: 'faEdit', icon: faEdit },
				{ name: 'faSave', icon: faSave },
				{ name: 'faTrash', icon: faTrash },
				{ name: 'faCopy', icon: faCopy },
				{ name: 'faShare', icon: faShare },
				{ name: 'faCode', icon: faCode },
				{ name: 'faTerminal', icon: faTerminal },
				{ name: 'faClone', icon: faClone },
				{ name: 'faRedo', icon: faRedo },
				{ name: 'faSearch', icon: faSearch },
				{ name: 'faDownload', icon: faDownload },
				{ name: 'faUpload', icon: faUpload },
				{ name: 'faHammer', icon: faHammer },
				{ name: 'faPaintBrush', icon: faPaintBrush },
				{ name: 'faEyeDropper', icon: faEyeDropper },
				{ name: 'faEraser', icon: faEraser },
				{ name: 'faWrench', icon: faWrench },
			]
		},
		{
			name: 'UI Elements & Common',
			icons: [
				{ name: 'faCheck', icon: faCheck },
				{ name: 'faPlus', icon: faPlus },
				{ name: 'faMinus', icon: faMinus },
				{ name: 'faTimes', icon: faTimes },
				{ name: 'faBan', icon: faBan },
				{ name: 'faLock', icon: faLock },
				{ name: 'faCog', icon: faCog },
				{ name: 'faCogs', icon: faCogs },
				{ name: 'faEllipsisV', icon: faEllipsisV },
				{ name: 'faQuestionCircle', icon: faQuestionCircle },
				{ name: 'faInfo', icon: faInfo },
				{ name: 'faInfoCircle', icon: faInfoCircle },
				{ name: 'faExclamationCircle', icon: faExclamationCircle },
				{ name: 'faFilter', icon: faFilter },
				{ name: 'faSlidersH', icon: faSlidersH },
				{ name: 'faSync', icon: faSync },
			]
		},
		{
			name: 'Communication',
			icons: [
				{ name: 'faComment', icon: faComment },
				{ name: 'faComments', icon: faComments },
				{ name: 'faCommentSlash', icon: faCommentSlash },
				{ name: 'faEnvelope', icon: faEnvelope },
				{ name: 'faBell', icon: faBell },
			]
		},
		{
			name: 'Files & Media',
			icons: [
				{ name: 'faFile', icon: faFile },
				{ name: 'faFileAlt', icon: faFileAlt },
				{ name: 'faFileImage', icon: faFileImage },
				{ name: 'faImage', icon: faImage },
				{ name: 'faClipboard', icon: faClipboard },
				{ name: 'faFolderOpen', icon: faFolderOpen },
			]
		},
		{
			name: 'User & Social',
			icons: [
				{ name: 'faUser', icon: faUser },
				{ name: 'faUsers', icon: faUsers },
				{ name: 'faUserFriends', icon: faUserFriends },
				{ name: 'faUserPlus', icon: faUserPlus },
				{ name: 'faUserMinus', icon: faUserMinus },
				{ name: 'faUserTimes', icon: faUserTimes },
				{ name: 'faUserCog', icon: faUserCog },
				{ name: 'faUserSecret', icon: faUserSecret },
				{ name: 'faIdBadge', icon: faIdBadge },
			]
		},
		{
			name: 'Status & Indicators',
			icons: [
				{ name: 'faSpinner', icon: faSpinner },
				{ name: 'faClock', icon: faClock },
				{ name: 'faCircle', icon: faCircle },
				{ name: 'faHeart', icon: faHeart },
				{ name: 'faStar', icon: faStar },
				{ name: 'faCheckCircle', icon: faCheckCircle },
				{ name: 'faPlusCircle', icon: faPlusCircle },
				{ name: 'faMinusCircle', icon: faMinusCircle },
				{ name: 'faCaretUp', icon: faCaretUp },
				{ name: 'faCaretSquareUp', icon: faCaretSquareUp },
				{ name: 'faCaretSquareDown', icon: faCaretSquareDown },
			]
		},
		{
			name: 'Devices & Browsers',
			icons: [
				{ name: 'faApple', icon: faApple },
				{ name: 'faWindows', icon: faWindows },
				{ name: 'faLinux', icon: faLinux },
				{ name: 'faAndroid', icon: faAndroid },
				{ name: 'faChrome', icon: faChrome },
				{ name: 'faFirefox', icon: faFirefox },
				{ name: 'faSafari', icon: faSafari },
				{ name: 'faOpera', icon: faOpera },
				{ name: 'faInternetExplorer', icon: faInternetExplorer },
				{ name: 'faEdge', icon: faEdge },
				{ name: 'faYandexInternational', icon: faYandexInternational },
				{ name: 'faAmilia', icon: faAmilia },
				{ name: 'faDesktop', icon: faDesktop },
				{ name: 'faTablet', icon: faTablet },
				{ name: 'faTv', icon: faTv },
				{ name: 'faMobile', icon: faMobile },
				{ name: 'faGamepad', icon: faGamepad },
			]
		},
		{
			name: 'Audio & Media Control',
			icons: [
				{ name: 'faVolumeUp', icon: faVolumeUp },
				{ name: 'faVolumeDown', icon: faVolumeDown },
				{ name: 'faVolumeOff', icon: faVolumeOff },
				{ name: 'faMicrophoneSlash', icon: faMicrophoneSlash },
				{ name: 'faPlay', icon: faPlay },
				{ name: 'faPause', icon: faPause },
				{ name: 'faStop', icon: faStop },
				{ name: 'faStepForward', icon: faStepForward },
			]
		},
		{
			name: 'Data & Storage',
			icons: [
				{ name: 'faDatabase', icon: faDatabase },
				{ name: 'faHdd', icon: faHdd },
				{ name: 'faMicrochip', icon: faMicrochip },
				{ name: 'faGlobe', icon: faGlobe },
				{ name: 'faCrown', icon: faCrown },
				{ name: 'faPlug', icon: faPlug },
				{ name: 'faHorseHead', icon: faHorseHead },
			]
		},
		{
			name: 'Layout & Drawing',
			icons: [
				{ name: 'faCompressArrowsAlt', icon: faCompressArrowsAlt },
				{ name: 'faCrosshairs', icon: faCrosshairs },
				{ name: 'faDrawPolygon', icon: faDrawPolygon },
				{ name: 'faLanguage', icon: faLanguage },
				{ name: 'faFont', icon: faFont },
				{ name: 'faExchangeAlt', icon: faExchangeAlt },
			]
		},
		{
			name: 'New Icons',
			icons: [
				{ name: 'faCircleUser', icon: faCircleUser },
				{ name: 'faHandWave', icon: faHandWave },
				{ name: 'faMegaphone', icon: faMegaphone },
				{ name: 'faNote', icon: faNote },
				{ name: 'faPencil', icon: faPencil },
				{ name: 'faRedo', icon: faRedo },
				{ name: 'faSlash', icon: faSlash },
				{ name: 'faThumbtack', icon: faThumbtack },
				{ name: 'faUndo', icon: faUndo },
				{ name: 'faUserCheck', icon: faUserCheck },
				{ name: 'faUserMinus', icon: faUserMinus },
				{ name: 'faUsersSlash', icon: faUsersSlash },
			]
		},
		{
			name: 'Other',
			icons: [
				{ name: 'faCalendar', icon: faCalendar },
				{ name: 'faChartPie', icon: faChartPie },
				{ name: 'faMapMarkerAlt', icon: faMapMarkerAlt },
				{ name: 'faFlag', icon: faFlag },
				{ name: 'faStickyNote', icon: faStickyNote },
				{ name: 'faCertificate', icon: faCertificate },
				{ name: 'faRetweet', icon: faRetweet },
				{ name: 'faEyeSlash', icon: faEyeSlash },
				{ name: 'faSignOutAlt', icon: faSignOutAlt },
				{ name: 'faHashtag', icon: faHashtag },
				{ name: 'faLaughBeam', icon: faLaughBeam },
			]
		}
	];

	copyToClipboard(name: string) {
		navigator.clipboard.writeText(name).then(() => {
			// Feedback could be added here
		});
	}
}
