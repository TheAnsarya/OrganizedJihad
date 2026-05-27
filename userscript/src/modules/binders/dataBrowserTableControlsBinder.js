/**
 * Data-browser table controls binder.
 * Isolates sort/search/pagination/sub-tab listener wiring from UIManager.
 */

/**
 * Bind table controls for data-browser views.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.content - Current rendered view root
 * @param {object} params.viewState - Mutable view state object
 * @param {string} params.viewName - Current view name
 * @param {(viewName: string) => void} params.renderView - View render callback
 */
export function bindDataBrowserTableControls(params) {
	const content = params?.content;
	const viewState = params?.viewState;
	const viewName = params?.viewName;
	const renderView = params?.renderView;
	if (!content || !viewState || !viewName || typeof renderView !== 'function') return;

	// Sort headers
	content.querySelectorAll('.oj-sort-header[data-sort]').forEach((th) => {
		th.addEventListener('click', () => {
			const field = th.dataset.sort;
			if (viewState.sortField === field) {
				viewState.sortDir = viewState.sortDir === 'asc' ? 'desc' : 'asc';
			} else {
				viewState.sortField = field;
				viewState.sortDir = 'desc';
			}
			viewState.page = 0;
			renderView(viewName);
		});
	});

	// Search input (debounced)
	const searchInput = content.querySelector('.oj-search-input');
	if (searchInput) {
		let debounceTimer = null;
		searchInput.addEventListener('input', (e) => {
			clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				viewState.filter = e.target.value.trim();
				viewState.page = 0;
				renderView(viewName);
			}, 250);
		});
		// Restore focus and cursor position after re-render.
		searchInput.focus();
		searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
	}

	// Pagination buttons
	const prevBtn = content.querySelector('.oj-page-prev');
	if (prevBtn) {
		prevBtn.addEventListener('click', () => {
			if (viewState.page > 0) {
				viewState.page--;
				renderView(viewName);
			}
		});
	}

	const nextBtn = content.querySelector('.oj-page-next');
	if (nextBtn) {
		nextBtn.addEventListener('click', () => {
			viewState.page++;
			renderView(viewName);
		});
	}

	// Sub-tab pills (battles view)
	content.querySelectorAll('.oj-pill-btn[data-subtab]').forEach((pill) => {
		pill.addEventListener('click', () => {
			viewState.subTab = pill.dataset.subtab;
			viewState.page = 0;
			renderView(viewName);
		});
	});
}
