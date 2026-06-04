/**
 * Adventure guide renderer.
 */

/**
 * Render an adventure guide panel from adventure battle records.
 *
 * @param {object} params - Render params
 * @param {Array} params.adventureBattles - Filtered adventure battle records
 * @param {(heroesJson: string, label: string) => string} params.renderBattleTeam - Team renderer callback
 * @param {(value: string) => string} params.escapeHtml - HTML escape callback
 * @returns {string} HTML panel
 */
export function renderAdventureGuide(params) {
	const adventureBattles = params?.adventureBattles;
	const renderBattleTeam = params?.renderBattleTeam;
	const escapeHtml = params?.escapeHtml;
	if (!Array.isArray(adventureBattles) || typeof renderBattleTeam !== 'function' || typeof escapeHtml !== 'function') {
		return '';
	}

	const nodeMap = new Map();
	for (const b of adventureBattles) {
		const nodeId = String(b?.mission || 'unknown');
		if (!nodeMap.has(nodeId)) {
			nodeMap.set(nodeId, { wins: 0, losses: 0, lastWinTeam: null, lastEnemyTeam: null, lastWinTime: null });
		}
		const node = nodeMap.get(nodeId);
		if (b?.isWin === true) {
			node.wins++;
			if (!node.lastWinTime || b.timestamp > node.lastWinTime) {
				node.lastWinTeam = b.playerHeroes;
				node.lastEnemyTeam = b.opponentHeroes;
				node.lastWinTime = b.timestamp;
			}
		} else {
			node.losses++;
		}
	}

	const sortedNodes = [...nodeMap.entries()].sort((a, b) => {
		return (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses);
	});
	const displayNodes = sortedNodes.slice(0, 20);
	if (displayNodes.length === 0) return '';

	const nodeRows = displayNodes.map(([nodeId, stats]) => {
		const total = stats.wins + stats.losses;
		const wr = total > 0 ? ((stats.wins / total) * 100).toFixed(0) : '0';
		const wrClass = parseInt(wr, 10) >= 50 ? 'oj-win' : 'oj-loss';
		const teamHtml = stats.lastWinTeam
			? renderBattleTeam(stats.lastWinTeam, '\u2705 Winning Team')
			: '<span class="oj-muted">No wins recorded</span>';
		const enemyHtml = stats.lastEnemyTeam
			? renderBattleTeam(stats.lastEnemyTeam, '\uD83D\uDC7E Enemies')
			: '';

		return `
			<div class="oj-adv-node">
				<div class="oj-adv-node-header">
					<span class="oj-mono">Node ${escapeHtml(nodeId)}</span>
					<span class="${wrClass}">${stats.wins}W / ${stats.losses}L (${wr}%)</span>
				</div>
				<div class="oj-adv-node-teams">${teamHtml}${enemyHtml}</div>
			</div>
		`;
	}).join('');

	return `
		<div class="oj-adventure-guide">
			<h4>\uD83D\uDDFA\uFE0F Adventure Guide <span class="oj-muted">(${nodeMap.size} nodes tracked)</span></h4>
			<p class="oj-muted" style="margin:0 0 8px;font-size:11px">Shows winning teams per adventure node. Expand battle rows for full details.</p>
			<div class="oj-adv-nodes">${nodeRows}</div>
		</div>
	`;
}
