/**
 * Shared data-browser render helpers.
 */

/**
 * Render a search/filter input bar.
 *
 * @param {string} currentFilter - Current filter text
 * @param {string} placeholder - Placeholder text
 * @param {(value: string) => string} escapeHtml - HTML escaping callback
 * @returns {string} HTML
 */
export function renderSearchBar(currentFilter, placeholder, escapeHtml) {
	const safePlaceholder = placeholder || 'Search...';
	const val = typeof escapeHtml === 'function'
		? escapeHtml(currentFilter || '')
		: (currentFilter || '');
	return `
		<div class="oj-search-bar">
			<input type="text" class="oj-search-input" placeholder="${safePlaceholder}"
			       value="${val}" aria-label="${safePlaceholder}">
		</div>
	`;
}

/**
 * Render pagination controls (Prev / Page X of Y / Next).
 *
 * @param {number} currentPage - Zero-based current page
 * @param {number} totalPages  - Total number of pages
 * @param {number} totalItems  - Total number of items
 * @returns {string} HTML
 */
export function renderPagination(currentPage, totalPages, totalItems) {
	if (totalPages <= 1) {
		return `<div class="oj-pagination"><span class="oj-muted">${totalItems} items</span></div>`;
	}
	const prevDisabled = currentPage <= 0 ? 'disabled' : '';
	const nextDisabled = currentPage >= totalPages - 1 ? 'disabled' : '';
	return `
		<div class="oj-pagination">
			<button class="oj-btn oj-btn-sm oj-page-prev" ${prevDisabled}>\u25C0 Prev</button>
			<span class="oj-page-info">Page ${currentPage + 1} of ${totalPages} <span class="oj-muted">(${totalItems} items)</span></span>
			<button class="oj-btn oj-btn-sm oj-page-next" ${nextDisabled}>Next \u25B6</button>
		</div>
	`;
}
