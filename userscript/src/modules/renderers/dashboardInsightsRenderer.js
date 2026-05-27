/**
 * Dashboard insight section renderers.
 */

/**
 * Render win-rate cards section.
 *
 * @param {object} params - Render params
 * @param {Array<object>} params.cards - Win-rate card models
 * @returns {string} HTML section
 */
export function renderWinRateCardsSection(params) {
	const cards = Array.isArray(params?.cards) ? params.cards : [];
	if (cards.length === 0) return '';

	const cardsHtml = cards.map((card) => {
		const label = card?.label || '';
		const color = card?.color || '#4fc3f7';
		const allPct = Number(card?.allPct || 0);
		const allWins = Number(card?.allWins || 0);
		const allLosses = Number(card?.allLosses || 0);
		const recentCount = Number(card?.recentCount || 0);
		const recentPct = Number(card?.recentPct || 0);
		const recentWins = Number(card?.recentWins || 0);
		return `
			<div style="flex:1;min-width:140px;background:#2a2a2e;border-radius:6px;padding:8px">
				<div style="font-size:12px;font-weight:600;margin-bottom:4px">${label}</div>
				<div style="font-size:20px;font-weight:700;color:${color}">${allPct}%</div>
				<div style="background:#444;border-radius:3px;height:6px;margin:4px 0">
					<div style="background:${color};height:100%;border-radius:3px;width:${allPct}%"></div>
				</div>
				<div style="font-size:10px;color:#aaa">
					${allWins}W / ${allLosses}L all time
					${recentCount > 0 ? `\u00B7 ${recentPct}% last 7d (${recentWins}/${recentCount})` : ''}
				</div>
			</div>`;
	}).join('');

	return `
		<div class="oj-section">
			<h3>\uD83C\uDFC5 Win Rates</h3>
			<div style="display:flex;gap:8px;flex-wrap:wrap">
				${cardsHtml}
			</div>
		</div>
	`;
}

/**
 * Render dashboard suggestions section.
 *
 * @param {object} params - Render params
 * @param {Array<object>} params.rows - Suggestion row models
 * @param {number} params.activeCount - Active suggestions count
 * @param {number} params.totalCount - Total suggestions count
 * @returns {string} HTML section
 */
export function renderSuggestionsSection(params) {
	const rows = Array.isArray(params?.rows) ? params.rows : [];
	if (rows.length === 0) return '';
	const activeCount = Number(params?.activeCount || 0);
	const totalCount = Number(params?.totalCount || 0);

	const rowsHtml = rows.map((row) => `
		<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #333">
			<span style="font-size:14px;flex-shrink:0">${row?.icon || '\uD83D\uDCA1'}</span>
			<div style="flex:1;min-width:0">
				<div style="font-size:12px;font-weight:600;color:${row?.priorityColor || '#ffb74d'}">${row?.priorityIcon || '\uD83D\uDFE1'} ${row?.title || ''}</div>
				<div style="font-size:11px;color:#aaa;margin-top:2px">${row?.description || ''}</div>
			</div>
		</div>`).join('');

	return `<div class="oj-section">
		<h3>\uD83D\uDCA1 Suggestions <span style="font-size:11px;font-weight:400;color:#888">(${activeCount} active)</span></h3>
		${rowsHtml}
		${totalCount > rows.length ? `<div style="font-size:11px;color:#888;margin-top:6px;text-align:center">+ ${totalCount - rows.length} more</div>` : ''}
	</div>`;
}

/**
 * Render battle recommendation cards section.
 *
 * @param {object} params - Render params
 * @param {Array<object>} params.rows - Recommendation row models
 * @returns {string} HTML section
 */
export function renderBattleRecommendationsSection(params) {
	const rows = Array.isArray(params?.rows) ? params.rows : [];
	if (rows.length === 0) return '';

	const rowsHtml = rows.map((row, index) => `
		<div style="padding:8px;border:1px solid #2f3f5a;border-radius:8px;background:#182234;margin-top:${index === 0 ? '0' : '6px'}">
			<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
				<div style="font-size:12px;font-weight:700;color:#9ed0ff">${row?.preview || 'Unknown Team'}</div>
				<div style="font-size:11px;color:#8ec5ff">Sim ${Number(row?.simPct || 0).toFixed(1)}%</div>
			</div>
			<div style="font-size:11px;color:#9fb4cf;margin-top:4px">Weighted ${Number(row?.weightedPct || 0).toFixed(1)}% • CI ${Number(row?.lowPct || 0).toFixed(1)}-${Number(row?.highPct || 0).toFixed(1)}%</div>
			<div style="font-size:11px;color:#8c8c8c;margin-top:4px">${row?.rationale || ''}</div>
		</div>`).join('');

	return `<div class="oj-section">
		<h3>\uD83E\uDDE0 Arena Recommendations</h3>
		${rowsHtml}
	</div>`;
}

/**
 * Render daily summary section.
 *
 * @param {object} params - Render params
 * @param {number} params.todayBattles
 * @param {number} params.todayWins
 * @param {number} params.todayChests
 * @param {number} params.todayQuests
 * @param {number} params.todayUpgrades
 * @returns {string} HTML section
 */
export function renderDailySummarySection(params) {
	const todayBattles = Number(params?.todayBattles || 0);
	const todayWins = Number(params?.todayWins || 0);
	const todayChests = Number(params?.todayChests || 0);
	const todayQuests = Number(params?.todayQuests || 0);
	const todayUpgrades = Number(params?.todayUpgrades || 0);
	if (todayBattles + todayChests + todayQuests + todayUpgrades === 0) return '';

	return `
		<div class="oj-section">
			<h3>\uD83D\uDCC5 Today's Activity</h3>
			<div style="display:flex;gap:8px;flex-wrap:wrap">
				${todayBattles > 0 ? `<div style="background:#2a2a2e;border-radius:6px;padding:6px 10px;font-size:12px">
					\u2694\uFE0F <strong>${todayBattles}</strong> battles (${todayWins}W / ${todayBattles - todayWins}L)
				</div>` : ''}
				${todayChests > 0 ? `<div style="background:#2a2a2e;border-radius:6px;padding:6px 10px;font-size:12px">
					\uD83C\uDF81 <strong>${todayChests}</strong> chests opened
				</div>` : ''}
				${todayQuests > 0 ? `<div style="background:#2a2a2e;border-radius:6px;padding:6px 10px;font-size:12px">
					\u2705 <strong>${todayQuests}</strong> quests completed
				</div>` : ''}
				${todayUpgrades > 0 ? `<div style="background:#2a2a2e;border-radius:6px;padding:6px 10px;font-size:12px">
					\u2B06\uFE0F <strong>${todayUpgrades}</strong> upgrades
				</div>` : ''}
			</div>
		</div>
	`;
}
