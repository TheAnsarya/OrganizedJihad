/**
 * Install health diagnostics renderer.
 * Isolates first-run diagnostics output markup from UIManager.
 */

/**
 * Build diagnostic checks from current local state.
 *
 * @param {object} params - Input values for checks
 * @param {boolean} params.apiOk - Whether local API is reachable
 * @param {Record<string, number>} params.stats - IndexedDB storage stats
 * @param {string|number|null} params.currentPlayerId - Current tracked player id
 * @returns {{ checks: Array<{label: string, ok: boolean, hint: string}>, totalRecords: number }} Result payload
 */
export function buildInstallHealthCheckModel(params) {
	const apiOk = !!params?.apiOk;
	const stats = params?.stats || {};
	const currentPlayerId = params?.currentPlayerId;

	const totalRecords = Object.values(stats).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
	const snapshots = Number(stats.snapshots || 0);
	const heroRows = Number(stats.heroes || 0);
	const playerBound = currentPlayerId && currentPlayerId !== 'unknown';

	const checks = [
		{
			label: 'Local API reachable (http://localhost:5124)',
			ok: apiOk,
			hint: 'Run Install-OrganizedJihad.ps1 or start api with dotnet run --project api.',
		},
		{
			label: 'Game account detected',
			ok: !!playerBound,
			hint: 'Open Hero Wars and wait for userGetInfo to be captured.',
		},
		{
			label: 'Snapshot data captured',
			ok: snapshots > 0,
			hint: 'Play for 10-30 seconds to trigger initial API calls.',
		},
		{
			label: 'Hero roster captured',
			ok: heroRows > 0,
			hint: 'Open the Heroes screen once to capture roster data.',
		},
	];

	return { checks, totalRecords };
}

/**
 * Render install health check results markup.
 *
 * @param {Array<{label: string, ok: boolean, hint: string}>} checks - Diagnostic checks
 * @param {number} totalRecords - Total captured record count
 * @param {(input: string) => string} escapeHtml - HTML escape function
 * @returns {string} HTML output for diagnostics panel
 */
export function renderInstallHealthDiagnosticsOutput(checks, totalRecords, escapeHtml) {
	const escaped = typeof escapeHtml === 'function'
		? escapeHtml
		: (value) => String(value ?? '');
	const safeChecks = Array.isArray(checks) ? checks : [];
	const passed = safeChecks.filter((c) => c.ok).length;
	const rows = safeChecks.map((check) => {
		const icon = check.ok ? 'OK' : 'FAIL';
		const color = check.ok ? '#81c784' : '#ef9a9a';
		const hint = check.ok ? '' : `<div style="color:#999;font-size:10px;margin-left:18px">${escaped(check.hint)}</div>`;
		return `<div style="margin-bottom:4px"><span style="color:${color}">${icon}</span> ${escaped(check.label)}</div>${hint}`;
	}).join('');

	return `<div style="margin-bottom:6px"><strong>${passed}/${safeChecks.length}</strong> checks passed • ${Number(totalRecords || 0).toLocaleString()} records captured locally</div>${rows}`;
}
