/**
 * Team recommendation dashboard section renderer.
 */

/**
 * Render Team Recommendation Engine section shell and controls.
 *
 * @param {object} params - Render params
 * @param {string} params.profileSummary - Profile summary text
 * @param {string} params.calibrationSummary - Calibration summary text
 * @param {Array<object>} params.modeOptions - Mode options
 * @param {Array<object>} params.objectiveOptions - Objective options
 * @param {Array<number>} params.trendWindowOptions - Trend window options
 * @param {string} params.selectedMode - Selected mode
 * @param {string} params.selectedObjective - Selected objective
 * @param {string} params.selectedTrendWindowPreference - Selected trend window pref
 * @param {number} params.defaultTrendWindowDays - Default trend window days
 * @param {boolean} params.showOperationsSummary - Whether operations diagnostics are enabled
 * @param {string} params.operationsSummaryHtml - Pre-rendered operations summary html
 * @param {string} params.rowsHtml - Pre-rendered card rows html
 * @param {(value: string) => string} params.escapeHtml - HTML escape callback
 * @returns {string} HTML section
 */
export function renderTeamRecommendationEngineSection(params) {
	const escapeHtml = params?.escapeHtml;
	if (typeof escapeHtml !== 'function') return '';
	const modeOptions = Array.isArray(params?.modeOptions) ? params.modeOptions : [];
	const objectiveOptions = Array.isArray(params?.objectiveOptions) ? params.objectiveOptions : [];
	const trendWindowOptions = Array.isArray(params?.trendWindowOptions) ? params.trendWindowOptions : [];
	const selectedMode = params?.selectedMode || 'arena';
	const selectedObjective = params?.selectedObjective || 'balanced';
	const selectedTrendWindowPreference = params?.selectedTrendWindowPreference || 'auto';
	const defaultTrendWindowDays = Number(params?.defaultTrendWindowDays || 30);
	const showOperationsSummary = params?.showOperationsSummary !== false;
	const operationsSummaryHtml = params?.operationsSummaryHtml || '';
	const rowsHtml = params?.rowsHtml || '';
	const profileSummary = params?.profileSummary || '';
	const calibrationSummary = params?.calibrationSummary || '';

	return `<div class="oj-section">
		<h3>🧠 Team Recommendation Engine</h3>
		<div style="font-size:10px;color:#7dbba0;margin:2px 0 6px 0">${escapeHtml(profileSummary)}</div>
		<div style="font-size:10px;color:#8bc9b0;margin:2px 0 6px 0">${calibrationSummary}</div>
		<div style="margin:4px 0 8px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
			<label style="font-size:11px;color:#a7b3bb;display:flex;align-items:center;gap:4px">
				<input type="checkbox" id="oj-team-ops-summary-toggle" ${showOperationsSummary ? 'checked' : ''}>
				<span>Ops</span>
			</label>
			<label for="oj-team-mode-filter" style="font-size:11px;color:#a7b3bb">Mode</label>
			<select id="oj-team-mode-filter" style="background:#1f252b;border:1px solid #37474f;color:#cfd8dc;border-radius:6px;padding:3px 6px;font-size:11px">
				${modeOptions.map((mode) => {
					const value = escapeHtml(mode.value || 'arena');
					const label = escapeHtml(mode.label || mode.value || 'arena');
					return `<option value="${value}" ${selectedMode === mode.value ? 'selected' : ''}>${label}</option>`;
				}).join('')}
			</select>
			<label for="oj-team-objective-filter" style="font-size:11px;color:#a7b3bb">Objective</label>
			<select id="oj-team-objective-filter" style="background:#1f252b;border:1px solid #37474f;color:#cfd8dc;border-radius:6px;padding:3px 6px;font-size:11px">
				${objectiveOptions.map((obj) => {
					const value = escapeHtml(obj.value || 'balanced');
					const label = escapeHtml(obj.label || obj.value || 'balanced');
					return `<option value="${value}" ${selectedObjective === obj.value ? 'selected' : ''}>${label}</option>`;
				}).join('')}
			</select>
			<label for="oj-team-trend-window-filter" style="font-size:11px;color:#a7b3bb">Trend</label>
			<select id="oj-team-trend-window-filter" data-default-window="${escapeHtml(String(defaultTrendWindowDays))}" style="background:#1f252b;border:1px solid #37474f;color:#cfd8dc;border-radius:6px;padding:3px 6px;font-size:11px">
				<option value="auto" ${selectedTrendWindowPreference === 'auto' ? 'selected' : ''}>Auto (${defaultTrendWindowDays}d)</option>
				${trendWindowOptions.map((windowDays) => {
					const numericDays = Number(windowDays || 0);
					const value = Number.isFinite(numericDays) && numericDays > 0 ? String(numericDays) : '30';
					return `<option value="${value}" ${selectedTrendWindowPreference === value ? 'selected' : ''}>${escapeHtml(value)}d</option>`;
				}).join('')}
			</select>
		</div>
		${operationsSummaryHtml}
		${rowsHtml}
	</div>`;
}
