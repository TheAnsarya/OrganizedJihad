/**
 * Dashboard filters binder.
 * Isolates dashboard filter listener wiring from UIManager.
 */

/**
 * Bind dashboard filter listeners.
 *
 * @param {object} params - Binding params
 * @param {HTMLElement} params.overlay - UI overlay root
 * @param {{ set: Function, get: Function }} params.prefStorage - Preference storage
 * @param {(view: string) => void} params.renderView - View rerender callback
 * @param {(mode: string, windowDays: number) => void} params.saveTrendPreference - Trend preference persistence callback
 */
export function bindDashboardFilters(params) {
	const overlay = params?.overlay;
	const prefStorage = params?.prefStorage;
	const renderView = params?.renderView;
	const saveTrendPreference = params?.saveTrendPreference;
	if (!overlay || !prefStorage || typeof renderView !== 'function' || typeof saveTrendPreference !== 'function') {
		return;
	}

	const statusFilter = overlay.querySelector('#oj-tools-status-filter');
	if (statusFilter) {
		statusFilter.addEventListener('change', (e) => {
			prefStorage.set('toolsCatalogStatusFilter', e.target.value || '');
			renderView('dashboard');
		});
	}

	const teamMode = overlay.querySelector('#oj-team-mode-filter');
	if (teamMode) {
		teamMode.addEventListener('change', (e) => {
			prefStorage.set('teamRecommendationsMode', e.target.value || 'arena');
			renderView('dashboard');
		});
	}

	const teamObjective = overlay.querySelector('#oj-team-objective-filter');
	if (teamObjective) {
		teamObjective.addEventListener('change', (e) => {
			prefStorage.set('teamRecommendationsObjective', e.target.value || 'balanced');
			renderView('dashboard');
		});
	}

	const teamTrendWindow = overlay.querySelector('#oj-team-trend-window-filter');
	if (teamTrendWindow) {
		teamTrendWindow.addEventListener('change', (e) => {
			const selectedPreference = e.target.value || 'auto';
			const selectedMode = prefStorage.get('teamRecommendationsMode', 'arena');
			const defaultWindow = Number(e.target?.dataset?.defaultWindow || 30);
			const configuredWindow = Number(selectedPreference);
			const resolvedWindow = selectedPreference === 'auto'
				? defaultWindow
				: (Number.isFinite(configuredWindow) ? configuredWindow : defaultWindow);

			prefStorage.set('teamRecommendationsTrendWindow', selectedPreference);
			saveTrendPreference(selectedMode, resolvedWindow);
			renderView('dashboard');
		});
	}
}
