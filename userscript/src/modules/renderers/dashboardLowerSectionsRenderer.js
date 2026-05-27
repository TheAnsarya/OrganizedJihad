/**
 * Dashboard lower subsection renderers.
 */

/**
 * Render the Tracked Data section.
 *
 * @param {object} params - Render params
 * @param {(value: number|string, label: string, color?: string) => string} params.statCard - Stat-card callback
 * @param {number} params.snapshotCount
 * @param {number} params.heroCount
 * @param {number} params.battleCount
 * @param {number} params.chestCount
 * @param {number} params.resourceTxCount
 * @param {number} params.questCount
 * @param {number} params.apiLogCount
 * @param {number} params.goalCount
 * @returns {string} HTML section
 */
export function renderDashboardTrackedDataSection(params) {
	const statCard = params?.statCard;
	if (typeof statCard !== 'function') return '';

	return `
		<div class="oj-section">
			<h3>\uD83D\uDCCA Tracked Data</h3>
			<div class="oj-stats-grid">
				${statCard(params.snapshotCount, 'Snapshots', '#4fc3f7')}
				${statCard(params.heroCount, 'Hero Records', '#81c784')}
				${statCard(params.battleCount, 'Battles', '#ffb74d')}
				${statCard(params.chestCount, 'Chests', '#ce93d8')}
				${statCard(params.resourceTxCount, 'Transactions', '#ef9a9a')}
				${statCard(params.questCount, 'Quests', '#fff176')}
				${statCard(params.apiLogCount, 'API Logs', '#90a4ae')}
				${statCard(params.goalCount, 'Goals', '#a5d6a7')}
			</div>
		</div>
	`;
}

/**
 * Render the Status section.
 *
 * @param {object} params - Render params
 * @param {boolean} params.isTracking - API interception active flag
 * @param {string} params.lastSnapshotTime - Last snapshot display string
 * @param {object} params.syncStatus - Sync status metadata
 * @param {number} params.errorCount - Tracker error count
 * @param {string} params.version - UI version
 * @param {(value: string) => string} params.escapeHtml - HTML escape callback
 * @returns {string} HTML section
 */
export function renderDashboardStatusSection(params) {
	const escapeHtml = params?.escapeHtml;
	if (typeof escapeHtml !== 'function') return '';
	const isTracking = !!params?.isTracking;
	const syncStatus = params?.syncStatus || {};
	const errorCount = Number(params?.errorCount || 0);

	const syncHtml = syncStatus.timestamp
		? `<span class="${syncStatus.ok ? 'oj-status-ok' : 'oj-status-err'}" title="${escapeHtml(syncStatus.message || '')}">${syncStatus.ok ? '\u2705' : '\u274C'} ${new Date(syncStatus.timestamp).toLocaleTimeString()}${!syncStatus.ok ? ` \u2014 ${escapeHtml(syncStatus.message || 'Error')}` : ''}</span>`
		: '<span style="color:#888">Not synced</span>';

	return `
		<div class="oj-section">
			<h3>\u2139\uFE0F Status</h3>
			<div class="oj-status-list">
				<div class="oj-status-row">
					<span>IndexedDB</span>
					<span class="oj-status-ok">Connected</span>
				</div>
				<div class="oj-status-row">
					<span>API Interception</span>
					<span class="${isTracking ? 'oj-status-ok' : 'oj-status-err'}">${isTracking ? 'Active' : 'Inactive'}</span>
				</div>
				<div class="oj-status-row">
					<span>Last Snapshot</span>
					<span class="oj-mono">${params.lastSnapshotTime}</span>
				</div>
				<div class="oj-status-row">
					<span>API Sync</span>
					${syncHtml}
				</div>
				${errorCount > 0 ? `<div class="oj-status-row"><span>Errors</span><span class="oj-status-err">${errorCount}</span></div>` : ''}
				<div class="oj-status-row">
					<span>Version</span>
					<span>${params.version}</span>
				</div>
			</div>
		</div>
	`;
}

/**
 * Render dashboard quick tips section.
 *
 * @returns {string} HTML section
 */
export function renderDashboardQuickTipsSection() {
	return `
		<div class="oj-section">
			<h3>\uD83C\uDFAF Quick Tips</h3>
			<ul class="oj-tips">
				<li>Play the game normally \u2014 all API calls are intercepted automatically</li>
				<li>Open your hero roster, arena, or inventory to capture data</li>
				<li>Check the <strong>Activity</strong> tab to see intercepted calls in real-time</li>
				<li>Press <kbd>Ctrl+Shift+H</kbd> to toggle this panel</li>
			</ul>
		</div>
	`;
}
