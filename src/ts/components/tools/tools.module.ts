import { NgModule, NO_ERRORS_SCHEMA } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { PopoverModule } from 'ngx-bootstrap/popover';
import { TypeaheadModule } from 'ngx-bootstrap/typeahead';
import { ButtonsModule } from 'ngx-bootstrap/buttons';

import { SharedModule } from '../shared/shared.module';

import { ErrorReporter } from '../services/errorReporter';

import { ToolsRange } from './shared/tools-range/tools-range';
import { ToolsFrame } from './shared/tools-frame/tools-frame';
import { ToolsOffset } from './shared/tools-offset/tools-offset';
import { ToolsXY } from './shared/tools-xy/tools-xy';

import { ToolsExpressions } from './tools-expressions/tools-expressions';
import { ToolsEyesMouths } from './tools-eyes-mouths/tools-eyes-mouths';
import { ToolsAnimation } from './tools-animation/tools-animation';
import { ToolsChat } from './tools-chat/tools-chat';
import { ToolsVariants } from './tools-variants/tools-variants';
import { ToolsWebgl } from './tools-webgl/tools-webgl';
import { ToolsPalette } from './tools-palette/tools-palette';
import { ToolsPerf } from './tools-perf/tools-perf';
import { ToolsRegions } from './tools-regions/tools-regions';
import { ToolsEntity } from './tools-entity/tools-entity';
import { ToolsSheet } from './tools-sheet/tools-sheet';
import { ToolsStates } from './tools-states/tools-states';
import { ToolsUI } from './tools-ui/tools-ui';
import { ToolsCollisions } from './tools-collisions/tools-collisions';
import { ToolsMap } from './tools-map/tools-map';
import { ToolsIndex } from './tools-index/tools-index';
import { IconGallery } from './icon-gallery/icon-gallery';
import { ToolsApp } from './tools';

export const routes: Routes = [
	{ path: '', component: ToolsIndex },
	{ path: 'sheet', component: ToolsSheet },
	{ path: 'states', component: ToolsStates },
	{ path: 'variants', component: ToolsVariants },
	{ path: 'webgl', component: ToolsWebgl },
	{ path: 'animation/:id', component: ToolsAnimation },
	{ path: 'animation', component: ToolsAnimation },
	{ path: 'chat', component: ToolsChat },
	{ path: 'expressions', component: ToolsExpressions },
	{ path: 'eyes-mouths', component: ToolsEyesMouths },
	{ path: 'entity', component: ToolsEntity },
	{ path: 'palette', component: ToolsPalette },
	{ path: 'perf', component: ToolsPerf },
	{ path: 'regions', component: ToolsRegions },
	{ path: 'ui', component: ToolsUI },
	{ path: 'collisions', component: ToolsCollisions },
	{ path: 'map', component: ToolsMap },
];

@NgModule({
	imports: [
		BrowserModule,
		RouterModule,
		FormsModule,
		ReactiveFormsModule,
		HttpClientModule,
		SharedModule,
		TooltipModule.forRoot(),
		PopoverModule.forRoot(),
		TypeaheadModule.forRoot(),
		ButtonsModule.forRoot(),
		RouterModule.forRoot(routes),
		FontAwesomeModule,
		NoopAnimationsModule,
	],
	schemas: [NO_ERRORS_SCHEMA],
	declarations: [
		ToolsRange,
		ToolsFrame,
		ToolsOffset,
		ToolsXY,
		ToolsExpressions,
		ToolsEyesMouths,
		ToolsAnimation,
		ToolsChat,
		ToolsVariants,
		ToolsWebgl,
		ToolsPalette,
		ToolsPerf,
		ToolsRegions,
		ToolsEntity,
		ToolsSheet,
		ToolsStates,
		ToolsCollisions,
		ToolsMap,
		ToolsUI,
		IconGallery,
		ToolsIndex,
		ToolsApp,
	],
	providers: [
		ErrorReporter,
	],
	bootstrap: [ToolsApp],
})
export class ToolsAppModule {
}
