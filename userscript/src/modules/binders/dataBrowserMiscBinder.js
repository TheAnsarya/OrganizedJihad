/**
 * Data-browser misc interaction binder.
 * Isolates resource shortcut and inventory group toggle wiring from UIManager.
 */

/**
 * Bind miscellaneous data-browser interactions.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.content - Current rendered view root
 * @param {() => void} params.renderResources - Callback to navigate to resources view
 */
export function bindDataBrowserMiscInteractions(params) {
	const content = params?.content;
	const renderResources = params?.renderResources;
	if (!content) return;

	// Emerald click — navigate to resources tab and filter to emerald transactions
	content.querySelectorAll('[data-resource-filter="emeralds"]').forEach((el) => {
		el.addEventListener('click', () => {
			renderResources?.();
		});
	});

	// Inventory group header expand/collapse
	content.querySelectorAll('.oj-inv-group-header').forEach((header) => {
		header.addEventListener('click', () => {
			const table = header.nextElementSibling;
			if (table && table.classList.contains('oj-inv-group-table')) {
				table.classList.toggle('oj-collapsed');
				header.classList.toggle('oj-inv-collapsed');
			}
		});
	});
}
