import { Component } from '@angular/core';
import { faPaintBrush, faPlay, faFileAlt, faCog, faUser, faDesktop, faComments, faWrench, faChartPie, faCheckCircle, faMapMarkerAlt, faExclamationCircle } from '../../../client/icons';

@Component({
	selector: 'tools-index',
	templateUrl: 'tools-index.pug',
})
export class ToolsIndex {
	faPaintBrush = faPaintBrush;
	faPlay = faPlay;
	faFileAlt = faFileAlt;
	faCog = faCog;
	faUser = faUser;
	faDesktop = faDesktop;
	faComments = faComments;
	faWrench = faWrench;
	faChartPie = faChartPie;
	faCheckCircle = faCheckCircle;
	faMapMarkerAlt = faMapMarkerAlt;
	faExclamationCircle = faExclamationCircle;
}
