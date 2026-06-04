/**
 * Data-browser listener orchestration binder.
 */

import { bindDataBrowserTableControls } from './dataBrowserTableControlsBinder.js';
import { bindDataRowInteractions } from './dataRowInteractionBinder.js';
import { bindProjectionInteractions } from './projectionInteractionBinder.js';
import { bindDataBrowserMiscInteractions } from './dataBrowserMiscBinder.js';

/**
 * Bind all data-browser interactions for a rendered view.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.content - View content root
 * @param {object} params.viewState - View state object
 * @param {string} params.viewName - Current view name
 * @param {object} params.heroesViewState - Heroes view state
 * @param {(nextView: string) => void} params.renderView - View rerender callback
 * @param {() => void} params.renderHeroes - Heroes rerender callback
 * @param {(section: string, isOpen: boolean) => void} params.saveProjectionSectionOpenPreference - Projection preference callback
 */
export function bindDataBrowserViewInteractions(params) {
	const content = params?.content;
	const viewState = params?.viewState;
	const viewName = params?.viewName;
	const heroesViewState = params?.heroesViewState || {};
	const renderView = params?.renderView;
	const renderHeroes = params?.renderHeroes;
	const saveProjectionSectionOpenPreference = params?.saveProjectionSectionOpenPreference;

	if (!content || !viewState || !viewName || typeof renderView !== 'function' || typeof renderHeroes !== 'function' || typeof saveProjectionSectionOpenPreference !== 'function') {
		return;
	}

	bindDataBrowserTableControls({
		content,
		viewState,
		viewName,
		renderView,
	});

	bindDataRowInteractions({ content });

	bindProjectionInteractions({
		content,
		heroesViewState,
		saveProjectionSectionOpenPreference,
		renderHeroes,
	});

	bindDataBrowserMiscInteractions({
		content,
		renderResources: () => renderView('resources'),
	});
}
