/**
 * Dashboard insight builder helpers.
 */

/**
 * Build win-rate card models for dashboard rendering.
 *
 * @param {Array<object>} battles - Battle records
 * @returns {Array<object>} Card models
 */
export function buildWinRateCards(battles = []) {
	if (!Array.isArray(battles) || battles.length === 0) return [];
	const now = Date.now();
	const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
	const types = [
		{ key: 'Arena', label: '\u2694\uFE0F Arena', color: '#4fc3f7' },
		{ key: 'TitanArena', label: '\uD83D\uDEE1\uFE0F Titan Arena', color: '#ce93d8' },
		{ key: 'GrandArena', label: '\uD83C\uDFC6 Grand Arena', color: '#ffb74d' },
	];

	return types.map(({ key, label, color }) => {
		const all = battles.filter((b) => b.battleType === key);
		const recent = all.filter((b) => {
			const ts = b.timestamp ? new Date(b.timestamp).getTime() : 0;
			return ts >= sevenDaysAgo;
		});
		if (all.length === 0) return null;
		const allWins = all.filter((b) => b.isWin).length;
		const allPct = Math.round((allWins / all.length) * 100);
		const recentWins = recent.filter((b) => b.isWin).length;
		const recentPct = recent.length > 0 ? Math.round((recentWins / recent.length) * 100) : 0;
		return {
			label,
			color,
			allPct,
			allWins,
			allLosses: all.length - allWins,
			recentCount: recent.length,
			recentWins,
			recentPct,
		};
	}).filter(Boolean);
}

/**
 * Build dashboard suggestion row models.
 *
 * @param {Array<object>} suggestions - Suggestion records
 * @param {(value: string) => string} escapeHtml - HTML escape callback
 * @returns {Array<object>} Row models
 */
export function buildSuggestionsRows(suggestions = [], escapeHtml) {
	if (!Array.isArray(suggestions) || suggestions.length === 0 || typeof escapeHtml !== 'function') return [];
	const priMap = {
		high: { icon: '\uD83D\uDD34', color: '#ef5350' },
		medium: { icon: '\uD83D\uDFE1', color: '#ffb74d' },
		low: { icon: '\uD83D\uDFE2', color: '#81c784' },
	};
	const catIcon = {
		goal: '\uD83C\uDFAF',
		resource: '\uD83D\uDCB0',
		hero: '\uD83E\uDDB8',
		battle: '\u2694\uFE0F',
	};
	const order = { high: 0, medium: 1, low: 2 };
	const sorted = [...suggestions]
		.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
		.slice(0, 6);

	return sorted.map((s) => {
		const pri = priMap[s.priority] || priMap.medium;
		return {
			icon: catIcon[s.type] || '\uD83D\uDCA1',
			priorityIcon: pri.icon,
			priorityColor: pri.color,
			title: escapeHtml(s.title),
			description: escapeHtml(s.description),
		};
	});
}

/**
 * Build battle recommendation row models.
 *
 * @param {Array<object>} recommendations - Recommendation records
 * @param {(value: string) => string} escapeHtml - HTML escape callback
 * @returns {Array<object>} Row models
 */
export function buildBattleRecommendationRows(recommendations = [], escapeHtml) {
	if (!Array.isArray(recommendations) || recommendations.length === 0 || typeof escapeHtml !== 'function') return [];
	return recommendations.slice(0, 3).map((rec, index) => {
		const sim = Number(rec.simulatedWinProbability || 0);
		const low = Number(rec.simulationConfidenceLow || 0);
		const high = Number(rec.simulationConfidenceHigh || 0);
		const wr = Number(rec.weightedWinRate || rec.winRate || 0);
		return {
			index,
			simPct: sim * 100,
			weightedPct: wr * 100,
			lowPct: low * 100,
			highPct: high * 100,
			preview: escapeHtml(rec.teamPreview || rec.teamKey || 'Unknown Team'),
			rationale: escapeHtml(rec.rationale || 'No rationale available.'),
		};
	});
}

/**
 * Resolve external tools section model.
 *
 * @param {object|null} metadata - Filters metadata payload
 * @param {object|null} payload - Tools payload
 * @param {string} selectedStatus - Selected status filter
 * @returns {{tools:Array<object>, statusOptions:Array<string>, selectedStatus:string}} section model
 */
export function buildExternalToolsSectionModel(metadata, payload, selectedStatus = '') {
	const tools = Array.isArray(payload?.tools) ? payload.tools : [];
	const statusOptions = Array.isArray(metadata?.verificationStatuses) && metadata.verificationStatuses.length > 0
		? metadata.verificationStatuses
		: ['verified', 'partial', 'unverified', 'stale'];
	return {
		tools,
		statusOptions,
		selectedStatus: typeof selectedStatus === 'string' ? selectedStatus : '',
	};
}

/**
 * Aggregate today's activity counters used by dashboard summary.
 *
 * @param {object} params - Aggregation params
 * @param {object} params.idbStorage - IndexedDB storage adapter
 * @param {Array<object>} params.battles - Preloaded battles
 * @param {string} params.todayISO - Lower-bound ISO timestamp
 * @returns {Promise<object>} Aggregate counters
 */
export async function aggregateDailySummaryStats(params) {
	const idbStorage = params?.idbStorage;
	const battles = Array.isArray(params?.battles) ? params.battles : [];
	const todayISO = params?.todayISO;
	if (!idbStorage || !todayISO) {
		return {
			todayBattles: 0,
			todayWins: 0,
			todayChests: 0,
			todayQuests: 0,
			todayUpgrades: 0,
		};
	}

	let todayBattles = 0;
	let todayWins = 0;
	let todayChests = 0;
	let todayQuests = 0;
	let todayUpgrades = 0;

	try {
		const todayB = battles.filter((b) => b.timestamp >= todayISO);
		todayBattles = todayB.length;
		todayWins = todayB.filter((b) => b.isWin).length;
	} catch { /* empty */ }

	try {
		const todayC = await idbStorage.getByIndexRange('chests', 'timestamp', { lower: todayISO });
		todayChests = todayC.length;
	} catch { /* empty */ }

	try {
		const dailyQ = await idbStorage.getByIndexRange('dailyQuestCompletions', 'completedAt', { lower: todayISO });
		const guildQ = await idbStorage.getByIndexRange('guildQuestCompletions', 'completedAt', { lower: todayISO });
		todayQuests = dailyQ.length + guildQ.length;
	} catch { /* empty */ }

	try {
		const heroUp = await idbStorage.getByIndexRange('heroUpgrades', 'timestamp', { lower: todayISO });
		const titanUp = await idbStorage.getByIndexRange('titanUpgrades', 'timestamp', { lower: todayISO });
		todayUpgrades = heroUp.length + titanUp.length;
	} catch { /* empty */ }

	return { todayBattles, todayWins, todayChests, todayQuests, todayUpgrades };
}
