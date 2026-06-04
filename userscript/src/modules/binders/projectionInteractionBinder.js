/**
 * Heroes projection interaction binder.
 * Isolates projection-specific event listener wiring from UIManager.
 */

/**
 * Bind projection interaction listeners for the rendered Heroes view.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.content - Current rendered view root
 * @param {object} params.heroesViewState - Mutable heroes view state
 * @param {(section: string, isOpen: boolean) => void} params.saveProjectionSectionOpenPreference - Pref persistence callback
 * @param {() => void} params.renderHeroes - Render callback for heroes view refresh
 */
export function bindProjectionInteractions(params) {
	const content = params?.content;
	if (!content) return;

	const heroesViewState = params?.heroesViewState || {};
	const saveProjectionSectionOpenPreference = params?.saveProjectionSectionOpenPreference;
	const renderHeroes = params?.renderHeroes;

	// Persist projection section collapse state (heroes view only)
	content.querySelectorAll('details[data-projection-section]').forEach((detailsEl) => {
		detailsEl.addEventListener('toggle', () => {
			const section = detailsEl.dataset.projectionSection;
			const isOpen = detailsEl.open;
			saveProjectionSectionOpenPreference?.(section, isOpen);
		});
	});

	// Projection section global controls (heroes view only)
	content.querySelectorAll('[data-projection-control]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const control = btn.dataset.projectionControl;
			const shouldOpen = control === 'expandAll';
			content.querySelectorAll('details[data-projection-section]').forEach((detailsEl) => {
				detailsEl.open = shouldOpen;
				saveProjectionSectionOpenPreference?.(detailsEl.dataset.projectionSection, shouldOpen);
			});
		});
	});

	// Top projected items paging controls (heroes view only)
	content.querySelectorAll('[data-projection-top-nav]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const current = Number(heroesViewState.projectionTopItemsPage || 0);
			const direction = btn.dataset.projectionTopNav === 'next' ? 1 : -1;
			heroesViewState.projectionTopItemsPage = Math.max(0, current + direction);
			renderHeroes?.();
		});
	});
}
