/**
 * BattleRecommendationOverlay Module
 *
 * Renders a compact in-game panel with team recommendations for the
 * currently targeted enemy team (Arena/Grand Arena/Titan Arena) and
 * mode-level recommendations for broader PvP contexts (Guild War/CoW).
 *
 * The panel intentionally stays visible during battle states so the user
 * can reference recommendations while entering a fight.
 *
 * @module battleRecommendationOverlay
 */

const BATTLE_RECOMMENDATIONS_URL = 'http://localhost:5124/api/sync/battles/recommendations';
const TEAM_RECOMMENDATIONS_URL = 'http://localhost:5124/api/sync/teams/recommendations';

const ATTACK_CALL_TO_CONTEXT = Object.freeze({
	arenaAttack: { mode: 'arena', enemyMetadataKey: 'arenaEnemies' },
	arenaEnd: { mode: 'arena', enemyMetadataKey: 'arenaEnemies' },
	grandArenaAttack: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies' },
	grandArenaEnd: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies' },
	titanArenaAttack: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies' },
	titanArenaEnd: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies' },
});

const ENEMY_LIST_CALL_TO_CONTEXT = Object.freeze({
	arenaGetEnemies: { mode: 'arena', enemyMetadataKey: 'arenaEnemies' },
	arenaFindEnemies: { mode: 'arena', enemyMetadataKey: 'arenaEnemies' },
	grandArenaGetEnemies: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies' },
	titanArenaGetEnemies: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies' },
});

const MODE_ONLY_CALL_TO_CONTEXT = Object.freeze({
	clanWarAttack: { mode: 'guildwar' },
	clashGetInfo: { mode: 'cow' },
	clashBattle: { mode: 'cow' },
	clashEnd: { mode: 'cow' },
});

class BattleRecommendationOverlay {
	/**
	 * @param {import('./indexedDBStorage.js').default} idbStorage - IndexedDB storage wrapper
	 * @param {import('./storageManager.js').default} prefStorage - Preference storage wrapper
	 */
	constructor(idbStorage, prefStorage) {
		this.idbStorage = idbStorage;
		this.prefStorage = prefStorage;

		/** @type {HTMLDivElement|null} */
		this.panel = null;
		/** @type {boolean} */
		this.isVisible = this.prefStorage.get('battleRecommendationOverlayVisible', true);

		/** @type {{ mode: string, opponentId: number|null, opponentPower: number|null, opponentName: string }} */
		this._context = {
			mode: 'arena',
			opponentId: null,
			opponentPower: null,
			opponentName: '',
		};

		/** @type {number} */
		this._lastRefreshAt = 0;
		/** @type {string} */
		this._lastQueryKey = '';
		/** @type {AbortController|null} */
		this._activeFetchController = null;

		this._onHotkey = this._onHotkey.bind(this);
	}

	/**
	 * Initialize overlay panel and keyboard shortcut.
	 */
	init() {
		if (this.panel) return;

		this._createPanel();
		document.addEventListener('keydown', this._onHotkey);

		if (!this.isVisible && this.panel) {
			this.panel.style.display = 'none';
		}
	}

	/**
	 * Clean up listeners and DOM nodes.
	 */
	destroy() {
		document.removeEventListener('keydown', this._onHotkey);
		if (this._activeFetchController) {
			this._activeFetchController.abort();
			this._activeFetchController = null;
		}
		if (this.panel?.parentNode) {
			this.panel.parentNode.removeChild(this.panel);
			this.panel = null;
		}
	}

	/**
	 * Handle processed API calls and update recommendation context.
	 *
	 * @param {object} request - Parsed API request payload
	 * @returns {Promise<void>}
	 */
	async onApiProcessed(request) {
		if (!this.isVisible || !Array.isArray(request?.calls) || request.calls.length === 0) {
			return;
		}

		let shouldRefresh = false;
		for (const call of request.calls) {
			const callName = call?.name;
			if (!callName) continue;

			const attackContext = ATTACK_CALL_TO_CONTEXT[callName];
			if (attackContext) {
				await this._setContextFromAttackCall(attackContext, call?.args || {});
				shouldRefresh = true;
				continue;
			}

			const listContext = ENEMY_LIST_CALL_TO_CONTEXT[callName];
			if (listContext) {
				await this._setContextFromEnemyList(listContext);
				shouldRefresh = true;
				continue;
			}

			const modeContext = MODE_ONLY_CALL_TO_CONTEXT[callName];
			if (modeContext) {
				this._context.mode = modeContext.mode;
				this._context.opponentId = null;
				this._context.opponentPower = null;
				this._context.opponentName = '';
				shouldRefresh = true;
			}
		}

		if (shouldRefresh) {
			await this.refresh();
		}
	}

	/**
	 * Manually refresh overlay content.
	 *
	 * @returns {Promise<void>}
	 */
	async refresh() {
		const queryKey = this._buildQueryKey();
		const now = Date.now();

		if (queryKey === this._lastQueryKey && (now - this._lastRefreshAt) < 1500) {
			return;
		}

		this._lastQueryKey = queryKey;
		this._lastRefreshAt = now;
		this._renderLoading();

		const payload = await this._fetchRecommendations();
		this._renderPayload(payload);
	}

	/**
	 * Toggle panel visibility.
	 */
	toggle() {
		this.isVisible = !this.isVisible;
		this.prefStorage.set('battleRecommendationOverlayVisible', this.isVisible);
		if (this.panel) {
			this.panel.style.display = this.isVisible ? 'block' : 'none';
		}
		if (this.isVisible) {
			this.refresh();
		}
	}

	/**
	 * Build deterministic key for refresh throttling.
	 *
	 * @returns {string} Query key
	 * @private
	 */
	_buildQueryKey() {
		return `${this._context.mode}:${this._context.opponentId || 0}:${this._context.opponentPower || 0}`;
	}

	/**
	 * Set context from attack call args (best signal for "about to fight").
	 *
	 * @param {{ mode: string, enemyMetadataKey: string }} context - Context map entry
	 * @param {object} args - API call args
	 * @returns {Promise<void>}
	 * @private
	 */
	async _setContextFromAttackCall(context, args) {
		const enemyUserId = Number(args?.enemyUserId || args?.enemyId || 0);
		const enemyList = await this.idbStorage.getMetadata(context.enemyMetadataKey, []);
		const selected = Array.isArray(enemyList)
			? enemyList.find((item) => Number(item?.userId || item?.enemyUserId || 0) === enemyUserId)
			: null;

		this._context.mode = context.mode;
		this._context.opponentId = Number.isFinite(enemyUserId) && enemyUserId > 0 ? enemyUserId : null;
		this._context.opponentPower = this._extractOpponentPower(selected);
		this._context.opponentName = selected?.name || '';
	}

	/**
	 * Set context from latest enemy list metadata when opening enemy selection views.
	 *
	 * @param {{ mode: string, enemyMetadataKey: string }} context - Context map entry
	 * @returns {Promise<void>}
	 * @private
	 */
	async _setContextFromEnemyList(context) {
		const enemyList = await this.idbStorage.getMetadata(context.enemyMetadataKey, []);
		const selected = Array.isArray(enemyList) && enemyList.length > 0 ? enemyList[0] : null;
		const selectedId = Number(selected?.userId || selected?.enemyUserId || 0);

		this._context.mode = context.mode;
		this._context.opponentId = Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null;
		this._context.opponentPower = this._extractOpponentPower(selected);
		this._context.opponentName = selected?.name || '';
	}

	/**
	 * Extract opponent power from tracked enemy metadata records.
	 *
	 * @param {object|null|undefined} enemy - Enemy metadata row
	 * @returns {number|null} Opponent power
	 * @private
	 */
	_extractOpponentPower(enemy) {
		if (!enemy || typeof enemy !== 'object') return null;
		if (Number.isFinite(Number(enemy.power)) && Number(enemy.power) > 0) {
			return Number(enemy.power);
		}
		if (Array.isArray(enemy.teams) && enemy.teams.length > 0) {
			return enemy.teams.reduce((sum, team) => sum + Number(team?.power || 0), 0);
		}
		return null;
	}

	/**
	 * Fetch recommendations for current context.
	 *
	 * @returns {Promise<object|null>} Recommendation payload
	 * @private
	 */
	async _fetchRecommendations() {
		if (this._activeFetchController) {
			this._activeFetchController.abort();
		}
		this._activeFetchController = new AbortController();

		try {
			if (this._context.mode === 'arena' || this._context.mode === 'grandarena' || this._context.mode === 'titanarena') {
				const url = new URL(BATTLE_RECOMMENDATIONS_URL);
				url.searchParams.set('battleType', this._context.mode);
				url.searchParams.set('limit', '3');
				url.searchParams.set('minSamples', '2');
				if (this._context.opponentId) {
					url.searchParams.set('opponentId', String(this._context.opponentId));
				}
				if (this._context.opponentPower) {
					url.searchParams.set('opponentPower', String(this._context.opponentPower));
					url.searchParams.set('powerWindow', '40000');
				}

				const response = await fetch(url.toString(), { signal: this._activeFetchController.signal });
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}

				return await response.json();
			}

			const objective = this.prefStorage.get('teamRecommendationsObjective', 'balanced');
			const url = new URL(TEAM_RECOMMENDATIONS_URL);
			url.searchParams.set('mode', this._context.mode || 'arena');
			url.searchParams.set('objective', objective || 'balanced');
			url.searchParams.set('limit', '3');
			url.searchParams.set('minSamples', '2');

			const response = await fetch(url.toString(), { signal: this._activeFetchController.signal });
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			return await response.json();
		} catch {
			return null;
		} finally {
			this._activeFetchController = null;
		}
	}

	/**
	 * Create panel DOM.
	 *
	 * @private
	 */
	_createPanel() {
		const panel = document.createElement('div');
		panel.id = 'oj-battle-reco-overlay';
		panel.className = 'oj-battle-reco-overlay';

		panel.innerHTML = `
			<div class="oj-bro-header">
				<div class="oj-bro-title">Battle Recommendations</div>
				<div class="oj-bro-actions">
					<button class="oj-bro-btn" id="oj-bro-refresh" title="Refresh">↻</button>
					<button class="oj-bro-btn" id="oj-bro-close" title="Hide (Alt+R)">✕</button>
				</div>
			</div>
			<div class="oj-bro-subtitle" id="oj-bro-context">Waiting for arena enemy data...</div>
			<div class="oj-bro-body" id="oj-bro-body"></div>
		`;

		document.body.appendChild(panel);
		this.panel = panel;

		panel.querySelector('#oj-bro-refresh')?.addEventListener('click', () => this.refresh());
		panel.querySelector('#oj-bro-close')?.addEventListener('click', () => this.toggle());
	}

	/**
	 * Render loading state.
	 *
	 * @private
	 */
	_renderLoading() {
		if (!this.panel) return;
		const contextEl = this.panel.querySelector('#oj-bro-context');
		const bodyEl = this.panel.querySelector('#oj-bro-body');
		if (contextEl) {
			const target = this._context.opponentName || (this._context.opponentId ? `opponent #${this._context.opponentId}` : 'mode context');
			contextEl.textContent = `${this._labelForMode(this._context.mode)} • ${target}`;
		}
		if (bodyEl) {
			bodyEl.innerHTML = '<div class="oj-bro-empty">Loading recommendations...</div>';
		}
	}

	/**
	 * Render API payload to panel body.
	 *
	 * @param {object|null} payload - Recommendation payload
	 * @private
	 */
	_renderPayload(payload) {
		if (!this.panel) return;
		const bodyEl = this.panel.querySelector('#oj-bro-body');
		if (!bodyEl) return;

		const mode = this._context.mode;
		const cards = Array.isArray(payload?.recommendations)
			? payload.recommendations
			: [];

		if (cards.length === 0) {
			bodyEl.innerHTML = '<div class="oj-bro-empty">No recommendations yet. Fight a few battles in this mode to train the model.</div>';
			return;
		}

		bodyEl.innerHTML = cards.slice(0, 3).map((rec, index) => {
			const teamPreview = this._escapeHtml(rec?.teamPreview || 'Unknown Team');
			const battles = Number(rec?.battles || 0);
			const winRate = this._resolveWinRate(rec);
			const confidence = this._resolveConfidence(rec);
			const score = this._resolveScore(rec);
			const rationale = this._escapeHtml(rec?.rationale || 'No rationale provided.');

			return `<div class="oj-bro-row" style="margin-top:${index === 0 ? '0' : '6px'}">
				<div class="oj-bro-row-title">${teamPreview}</div>
				<div class="oj-bro-metrics">Win ${winRate} • Conf ${confidence} • Score ${score} • ${battles} battles</div>
				<div class="oj-bro-rationale">${rationale}</div>
			</div>`;
		}).join('');

		const contextEl = this.panel.querySelector('#oj-bro-context');
		if (contextEl) {
			const target = this._context.opponentName || (this._context.opponentId ? `opponent #${this._context.opponentId}` : 'mode-level recommendations');
			contextEl.textContent = `${this._labelForMode(mode)} • ${target}`;
		}
	}

	/**
	 * Resolve win rate string from heterogeneous payloads.
	 *
	 * @param {object} rec - Recommendation row
	 * @returns {string} Percent string
	 * @private
	 */
	_resolveWinRate(rec) {
		const candidate = Number(rec?.weightedWinRate ?? rec?.estimatedWinProbability ?? rec?.winRate ?? 0);
		return `${(Math.max(0, Math.min(1, candidate)) * 100).toFixed(1)}%`;
	}

	/**
	 * Resolve confidence string from heterogeneous payloads.
	 *
	 * @param {object} rec - Recommendation row
	 * @returns {string} Percent string
	 * @private
	 */
	_resolveConfidence(rec) {
		const candidate = Number(rec?.confidence ?? rec?.confidenceScore ?? 0);
		return `${(Math.max(0, Math.min(1, candidate)) * 100).toFixed(0)}%`;
	}

	/**
	 * Resolve score string from heterogeneous payloads.
	 *
	 * @param {object} rec - Recommendation row
	 * @returns {string} Percent string
	 * @private
	 */
	_resolveScore(rec) {
		const candidate = Number(rec?.score ?? rec?.finalScore ?? 0);
		return `${(Math.max(0, Math.min(1, candidate)) * 100).toFixed(1)}%`;
	}

	/**
	 * Label for mode context.
	 *
	 * @param {string} mode - Mode key
	 * @returns {string} Human label
	 * @private
	 */
	_labelForMode(mode) {
		switch ((mode || '').toLowerCase()) {
			case 'arena': return 'Arena';
			case 'grandarena': return 'Grand Arena';
			case 'titanarena': return 'Titan Arena';
			case 'guildwar': return 'Guild War';
			case 'cow': return 'Clash of Worlds';
			default: return mode || 'Battle';
		}
	}

	/**
	 * Alt+R hotkey toggles panel visibility.
	 *
	 * @param {KeyboardEvent} event - Keydown event
	 * @private
	 */
	_onHotkey(event) {
		if (event.altKey && (event.key === 'r' || event.key === 'R')) {
			event.preventDefault();
			this.toggle();
		}
	}

	/**
	 * Escape HTML special chars.
	 *
	 * @param {string} value - Raw string
	 * @returns {string} Escaped string
	 * @private
	 */
	_escapeHtml(value) {
		return String(value || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}
}

export default BattleRecommendationOverlay;
