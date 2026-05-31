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
const AUTO_REFRESH_MS = 20000;
const MAX_BACKOFF_MS = 30000;
const MIN_REFRESH_GAP_MS = 1200;
const MAX_DEEP_SCAN_DEPTH = 4;
const MAX_CANDIDATES = 30;

const ATTACK_CALL_TO_CONTEXT = Object.freeze({
	arenaAttack: { mode: 'arena', enemyMetadataKey: 'arenaEnemies', sourceLabel: 'arena attack target' },
	arenaEnd: { mode: 'arena', enemyMetadataKey: 'arenaEnemies', sourceLabel: 'arena result target' },
	grandArenaAttack: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies', sourceLabel: 'grand arena target' },
	grandArenaEnd: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies', sourceLabel: 'grand arena result target' },
	titanArenaAttack: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies', sourceLabel: 'titan arena target' },
	titanArenaEnd: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies', sourceLabel: 'titan arena result target' },
	clanWarAttack: { mode: 'guildwar', sourceLabel: 'guild war attack target' },
	clashBattle: { mode: 'cow', sourceLabel: 'clash target' },
	clashEnd: { mode: 'cow', sourceLabel: 'clash result target' },
});

const ENEMY_LIST_CALL_TO_CONTEXT = Object.freeze({
	arenaGetEnemies: { mode: 'arena', enemyMetadataKey: 'arenaEnemies', sourceLabel: 'arena enemy list' },
	arenaFindEnemies: { mode: 'arena', enemyMetadataKey: 'arenaEnemies', sourceLabel: 'arena enemy list' },
	grandArenaGetEnemies: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies', sourceLabel: 'grand arena enemy list' },
	titanArenaGetEnemies: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies', sourceLabel: 'titan arena enemy list' },
	clanWarGetDefence: { mode: 'guildwar', sourceLabel: 'guild war defence list' },
	crossClanWar_getAttackMap: { mode: 'cow', sourceLabel: 'clash attack map' },
});

const MODE_ONLY_CALL_TO_CONTEXT = Object.freeze({
	clanWarGetInfo: { mode: 'guildwar', sourceLabel: 'guild war state' },
	clashGetInfo: { mode: 'cow', sourceLabel: 'clash state' },
	crossClanWar_getSettings: { mode: 'cow', sourceLabel: 'clash settings' },
});

const MODE_METADATA_KEYS = Object.freeze({
	guildwar: ['guildWarDefense', 'currentGuildWar', 'guildWarWarlord'],
	cow: ['cowAttackMap', 'cowDefensePlan', 'cowSettings'],
});

const SUPPORTED_MODES = new Set(['arena', 'grandarena', 'titanarena', 'guildwar', 'cow']);
const ARENA_FAMILY_MODES = new Set(['arena', 'grandarena', 'titanarena']);
const SUPPORTED_OBJECTIVES = new Set(['balanced', 'offense', 'defense', 'speed', 'sustain']);

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
		/** @type {boolean} */
		this._isCollapsed = this.prefStorage.get('battleRecommendationOverlayCollapsed', false);

		/**
		 * @type {{
		 * 	mode: string,
		 * 	opponentId: number|null,
		 * 	opponentPower: number|null,
		 * 	opponentName: string,
		 * 	opponentTeams: Array<{ slot:number, power:number }>,
		 * 	source: string,
		 * 	updatedAt: number,
		 * }}
		 */
		this._context = {
			mode: 'arena',
			opponentId: null,
			opponentPower: null,
			opponentName: '',
			opponentTeams: [],
			source: 'initial',
			updatedAt: Date.now(),
		};

		/** @type {number} */
		this._lastRefreshAt = 0;
		/** @type {string} */
		this._lastQueryKey = '';
		/** @type {AbortController|null} */
		this._activeFetchController = null;
		/** @type {number} */
		this._requestSequence = 0;
		/** @type {object|null} */
		this._lastSuccessfulPayload = null;
		/** @type {number} */
		this._consecutiveFailures = 0;
		/** @type {number} */
		this._nextAllowedRequestAt = 0;
		/** @type {'live'|'cached'|'backoff'} */
		this._dataHealth = 'live';
		/** @type {number|null} */
		this._refreshTimer = null;

		// Drag state
		this._isDragging = false;
		this._dragOffsetX = 0;
		this._dragOffsetY = 0;

		this._onHotkey = this._onHotkey.bind(this);
		this._onVisibilityChange = this._onVisibilityChange.bind(this);
		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);
	}

	/**
	 * Initialize overlay panel and keyboard shortcut.
	 */
	init() {
		if (this.panel) return;

		this._createPanel();
		document.addEventListener('keydown', this._onHotkey);
		document.addEventListener('visibilitychange', this._onVisibilityChange);

		if (!this.isVisible && this.panel) {
			this.panel.style.display = 'none';
		}

		if (this.isVisible) {
			this._scheduleRefresh(250);
		}
	}

	/**
	 * Clean up listeners and DOM nodes.
	 */
	destroy() {
		document.removeEventListener('keydown', this._onHotkey);
		document.removeEventListener('visibilitychange', this._onVisibilityChange);
		document.removeEventListener('mousemove', this._onMouseMove);
		document.removeEventListener('mouseup', this._onMouseUp);
		if (this._refreshTimer) {
			clearTimeout(this._refreshTimer);
			this._refreshTimer = null;
		}
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
			const callName = typeof call?.name === 'string' ? call.name : '';
			if (!callName) continue;

			const attackContext = ATTACK_CALL_TO_CONTEXT[callName];
			if (attackContext) {
				if (attackContext.enemyMetadataKey) {
					await this._setContextFromAttackCall(attackContext, call?.args || {});
				} else {
					await this._setContextFromMetadataOnlyMode(attackContext, call?.args || {});
				}
				shouldRefresh = true;
				continue;
			}

			const listContext = ENEMY_LIST_CALL_TO_CONTEXT[callName];
			if (listContext) {
				if (listContext.enemyMetadataKey) {
					await this._setContextFromEnemyList(listContext);
				} else {
					await this._setContextFromMetadataOnlyMode(listContext, call?.args || {});
				}
				shouldRefresh = true;
				continue;
			}

			const modeContext = MODE_ONLY_CALL_TO_CONTEXT[callName];
			if (modeContext) {
				await this._setContextFromMetadataOnlyMode(modeContext, call?.args || {});
				shouldRefresh = true;
			}
		}

		if (shouldRefresh) {
			this._scheduleRefresh(100);
		}
	}

	/**
	 * Manually refresh overlay content.
	 *
	 * @returns {Promise<void>}
	 */
	async refresh() {
		if (!this.isVisible || this._isCollapsed) {
			return;
		}

		const queryKey = this._buildQueryKey();
		const now = Date.now();
		if (queryKey === this._lastQueryKey && (now - this._lastRefreshAt) < MIN_REFRESH_GAP_MS) {
			return;
		}

		this._lastQueryKey = queryKey;
		this._lastRefreshAt = now;
		this._renderLoading();

		const payload = await this._fetchRecommendations();
		this._renderPayload(payload);
		this._scheduleRefresh(AUTO_REFRESH_MS);
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
		if (!this.isVisible && this._refreshTimer) {
			clearTimeout(this._refreshTimer);
			this._refreshTimer = null;
		}
		if (this.isVisible) {
			this._scheduleRefresh(0);
		}
	}

	/**
	 * Build deterministic key for refresh throttling.
	 *
	 * @returns {string} Query key
	 * @private
	 */
	_buildQueryKey() {
		const teamHash = this._context.opponentTeams.map((t) => `${t.slot}:${t.power}`).join(',');
		return [
			this._context.mode,
			this._context.opponentId || 0,
			this._context.opponentPower || 0,
			teamHash,
			this._context.source,
		].join(':');
	}

	/**
	 * Schedule next refresh.
	 *
	 * @param {number} delayMs - Delay before refresh
	 * @private
	 */
	_scheduleRefresh(delayMs) {
		if (this._refreshTimer) {
			clearTimeout(this._refreshTimer);
		}
		if (!this.isVisible || this._isCollapsed) return;

		this._refreshTimer = setTimeout(() => {
			this._refreshTimer = null;
			this.refresh();
		}, Math.max(0, Number(delayMs || 0)));
	}

	/**
	 * Set context from attack call args (best signal for "about to fight").
	 *
	 * @param {{ mode: string, enemyMetadataKey: string, sourceLabel: string }} context - Context map entry
	 * @param {object} args - API call args
	 * @returns {Promise<void>}
	 * @private
	 */
	async _setContextFromAttackCall(context, args) {
		const resolvedMode = this._normalizeMode(context.mode);
		const enemyUserId = this._extractEnemyUserId(args);
		const enemyList = await this.idbStorage.getMetadata(context.enemyMetadataKey, []);
		const selected = Array.isArray(enemyList)
			? enemyList.find((item) => this._extractEnemyUserId(item) === enemyUserId) || null
			: null;

		const teams = this._extractOpponentTeams(selected);
		const powerFromTeams = teams.reduce((sum, team) => sum + Number(team.power || 0), 0) || null;

		this._context.mode = resolvedMode;
		this._context.opponentId = Number.isFinite(enemyUserId) && enemyUserId > 0 ? enemyUserId : null;
		this._context.opponentPower = this._extractOpponentPower(selected) || powerFromTeams;
		this._context.opponentName = selected?.name || '';
		this._context.opponentTeams = teams;
		this._context.source = context.sourceLabel || 'attack';
		this._context.updatedAt = Date.now();
	}

	/**
	 * Set context from latest enemy list metadata when opening enemy selection views.
	 *
	 * @param {{ mode: string, enemyMetadataKey: string, sourceLabel: string }} context - Context map entry
	 * @returns {Promise<void>}
	 * @private
	 */
	async _setContextFromEnemyList(context) {
		const resolvedMode = this._normalizeMode(context.mode);
		const enemyList = await this.idbStorage.getMetadata(context.enemyMetadataKey, []);
		const selected = Array.isArray(enemyList) && enemyList.length > 0 ? enemyList[0] : null;
		const selectedId = this._extractEnemyUserId(selected);
		const teams = this._extractOpponentTeams(selected);
		const powerFromTeams = teams.reduce((sum, team) => sum + Number(team.power || 0), 0) || null;

		this._context.mode = resolvedMode;
		this._context.opponentId = Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null;
		this._context.opponentPower = this._extractOpponentPower(selected) || powerFromTeams;
		this._context.opponentName = selected?.name || '';
		this._context.opponentTeams = teams;
		this._context.source = context.sourceLabel || 'enemy list';
		this._context.updatedAt = Date.now();
	}

	/**
	 * Set context for modes where enemy metadata may be nested in broad state payloads.
	 *
	 * @param {{ mode: string, sourceLabel: string }} context - Context map entry
	 * @param {object} args - API call args
	 * @returns {Promise<void>}
	 * @private
	 */
	async _setContextFromMetadataOnlyMode(context, args) {
		const mode = this._normalizeMode(context.mode);
		const preferredId = this._extractEnemyUserId(args);
		const keys = MODE_METADATA_KEYS[mode] || [];
		const candidates = [];

		for (const key of keys) {
			const payload = await this.idbStorage.getMetadata(key, null);
			if (!payload) continue;
			const extracted = this._extractEnemyCandidates(payload, key);
			for (const row of extracted) {
				if (candidates.length >= MAX_CANDIDATES) break;
				candidates.push(row);
			}
		}

		const selected = candidates.find((c) => c.userId && c.userId === preferredId)
			|| candidates.find((c) => c.power > 0)
			|| candidates[0]
			|| null;

		this._context.mode = mode;
		this._context.opponentId = selected?.userId || (preferredId > 0 ? preferredId : null);
		this._context.opponentPower = selected?.power || null;
		this._context.opponentName = selected?.name || '';
		this._context.opponentTeams = Array.isArray(selected?.teams) ? selected.teams : [];
		this._context.source = selected?.source || context.sourceLabel || 'mode metadata';
		this._context.updatedAt = Date.now();
	}

	/**
	 * Extract enemy candidates from loosely shaped metadata payloads.
	 *
	 * @param {object} payload - Arbitrary metadata payload
	 * @param {string} source - Metadata source label
	 * @returns {Array<{ userId:number|null, name:string, power:number, teams:Array<{slot:number,power:number}>, source:string }>} candidates
	 * @private
	 */
	_extractEnemyCandidates(payload, source) {
		const candidates = [];
		const seen = new Set();
		const walk = (node, depth) => {
			if (!node || depth > MAX_DEEP_SCAN_DEPTH || candidates.length >= MAX_CANDIDATES) return;
			if (Array.isArray(node)) {
				for (const child of node) {
					walk(child, depth + 1);
					if (candidates.length >= MAX_CANDIDATES) break;
				}
				return;
			}
			if (typeof node !== 'object') return;

			const userId = this._extractEnemyUserId(node);
			const name = this._resolveCandidateName(node);
			const power = this._resolveCandidatePower(node);
			const teams = this._extractOpponentTeams(node);
			const key = `${userId || 0}:${name}:${power}`;
			if ((userId || name || power > 0 || teams.length > 0) && !seen.has(key)) {
				seen.add(key);
				candidates.push({ userId: userId || null, name, power, teams, source });
			}

			for (const value of Object.values(node)) {
				if (typeof value === 'object') {
					walk(value, depth + 1);
					if (candidates.length >= MAX_CANDIDATES) break;
				}
			}
		};

		walk(payload, 0);
		return candidates;
	}

	/**
	 * Resolve candidate display name from arbitrary object shape.
	 *
	 * @param {object} node - Candidate object
	 * @returns {string} Name
	 * @private
	 */
	_resolveCandidateName(node) {
		const raw = node?.name || node?.opponentName || node?.userName || node?.nickname || node?.nick || '';
		return typeof raw === 'string' ? raw : '';
	}

	/**
	 * Resolve candidate power from arbitrary object shape.
	 *
	 * @param {object} node - Candidate object
	 * @returns {number} Power
	 * @private
	 */
	_resolveCandidatePower(node) {
		const value = Number(node?.power || node?.teamPower || node?.lastKnownPower || node?.totalPower || 0);
		return Number.isFinite(value) && value > 0 ? value : 0;
	}

	/**
	 * Extract enemy id from mixed call args or metadata rows.
	 *
	 * @param {object|null|undefined} args - Candidate args row
	 * @returns {number} Enemy id or 0
	 * @private
	 */
	_extractEnemyUserId(args) {
		const value = Number(
			args?.enemyUserId
			|| args?.enemyId
			|| args?.targetUserId
			|| args?.defenderUserId
			|| args?.opponentId
			|| args?.userId
			|| 0
		);
		return Number.isFinite(value) && value > 0 ? value : 0;
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
		const primary = Number(enemy.power || enemy.teamPower || enemy.totalPower || 0);
		if (Number.isFinite(primary) && primary > 0) {
			return primary;
		}
		const teams = this._extractOpponentTeams(enemy);
		if (teams.length === 0) return null;
		const sum = teams.reduce((acc, team) => acc + Number(team.power || 0), 0);
		return sum > 0 ? sum : null;
	}

	/**
	 * Extract per-team powers for multi-team modes.
	 *
	 * @param {object|null|undefined} enemy - Enemy metadata row
	 * @returns {Array<{ slot:number, power:number }>} team power rows
	 * @private
	 */
	_extractOpponentTeams(enemy) {
		if (!enemy || typeof enemy !== 'object' || !Array.isArray(enemy.teams)) {
			return [];
		}
		return enemy.teams
			.map((team, index) => ({
				slot: index + 1,
				power: Number(team?.power || team?.teamPower || 0),
			}))
			.filter((row) => Number.isFinite(row.power) && row.power > 0)
			.slice(0, 3);
	}

	/**
	 * Fetch recommendations for current context.
	 *
	 * @returns {Promise<object|null>} Recommendation payload
	 * @private
	 */
	async _fetchRecommendations() {
		const now = Date.now();
		if (now < this._nextAllowedRequestAt) {
			this._dataHealth = 'backoff';
			return this._lastSuccessfulPayload;
		}

		if (this._activeFetchController) {
			this._activeFetchController.abort();
		}
		this._activeFetchController = new AbortController();
		const sequence = ++this._requestSequence;

		const mode = this._normalizeMode(this._context.mode);
		const objective = this._normalizeObjective(this.prefStorage.get('teamRecommendationsObjective', 'balanced'));
		const minSamples = this._resolveMinSamples(mode);

		try {
			let payload = null;

			if (mode === 'grandarena' && this._context.opponentTeams.length > 1) {
				payload = await this._fetchGrandArenaSegmentedRecommendations(sequence, minSamples);
			} else if (ARENA_FAMILY_MODES.has(mode)) {
				payload = await this._fetchBattleRecommendationsForTarget(sequence, mode, minSamples);
			}

			if (!this._hasRecommendations(payload)) {
				payload = await this._fetchModeEngineRecommendations(sequence, mode, objective, minSamples);
			}

			if (sequence !== this._requestSequence) {
				return this._lastSuccessfulPayload;
			}

			if (this._hasRecommendations(payload)) {
				this._recordFetchSuccess(payload);
				return payload;
			}

			this._recordFetchFailure();
			return this._lastSuccessfulPayload;
		} catch {
			this._recordFetchFailure();
			return this._lastSuccessfulPayload;
		} finally {
			if (this._activeFetchController) {
				this._activeFetchController = null;
			}
		}
	}

	/**
	 * Fetch arena-family recommendations for selected target context.
	 *
	 * @param {number} sequence - Request sequence for stale response guard
	 * @param {string} mode - Arena-family mode
	 * @param {number} minSamples - Min sample threshold
	 * @returns {Promise<object|null>} payload
	 * @private
	 */
	async _fetchBattleRecommendationsForTarget(sequence, mode, minSamples) {
		const url = new URL(BATTLE_RECOMMENDATIONS_URL);
		url.searchParams.set('battleType', mode);
		url.searchParams.set('limit', '3');
		url.searchParams.set('minSamples', String(minSamples));

		if (this._context.opponentId) {
			url.searchParams.set('opponentId', String(this._context.opponentId));
		}

		if (this._context.opponentPower) {
			url.searchParams.set('opponentPower', String(this._context.opponentPower));
			url.searchParams.set('powerWindow', '40000');
		}

		const payload = await this._requestJson(url.toString(), sequence);
		if (!payload) return null;

		return {
			...payload,
			sourceType: 'battle',
		};
	}

	/**
	 * Fetch Grand Arena recommendations per enemy team slot.
	 *
	 * @param {number} sequence - Request sequence
	 * @param {number} minSamples - Min samples
	 * @returns {Promise<object|null>} payload
	 * @private
	 */
	async _fetchGrandArenaSegmentedRecommendations(sequence, minSamples) {
		const segments = [];
		for (const team of this._context.opponentTeams.slice(0, 3)) {
			const url = new URL(BATTLE_RECOMMENDATIONS_URL);
			url.searchParams.set('battleType', 'grandarena');
			url.searchParams.set('limit', '2');
			url.searchParams.set('minSamples', String(minSamples));
			url.searchParams.set('opponentPower', String(team.power));
			url.searchParams.set('powerWindow', '25000');
			if (this._context.opponentId) {
				url.searchParams.set('opponentId', String(this._context.opponentId));
			}

			const payload = await this._requestJson(url.toString(), sequence);
			segments.push({
				slot: team.slot,
				opponentPower: team.power,
				recommendations: Array.isArray(payload?.recommendations) ? payload.recommendations.slice(0, 2) : [],
			});
		}

		const flattened = segments.flatMap((segment) =>
			segment.recommendations.map((rec) => ({
				...rec,
				teamSlot: segment.slot,
				targetPower: segment.opponentPower,
			}))
		);

		return {
			battleType: 'grandarena',
			recommendations: flattened,
			segmentedRecommendations: segments,
			sourceType: 'battle-segmented',
		};
	}

	/**
	 * Fetch mode-level recommendation engine payload.
	 *
	 * @param {number} sequence - Request sequence
	 * @param {string} mode - Mode key
	 * @param {string} objective - Objective key
	 * @param {number} minSamples - Min samples
	 * @returns {Promise<object|null>} payload
	 * @private
	 */
	async _fetchModeEngineRecommendations(sequence, mode, objective, minSamples) {
		const url = new URL(TEAM_RECOMMENDATIONS_URL);
		url.searchParams.set('mode', mode);
		url.searchParams.set('objective', objective);
		url.searchParams.set('limit', '3');
		url.searchParams.set('minSamples', String(minSamples));

		const payload = await this._requestJson(url.toString(), sequence);
		if (!payload) return null;

		return {
			...payload,
			sourceType: 'engine',
		};
	}

	/**
	 * Perform JSON fetch with stale-response guard.
	 *
	 * @param {string} url - Request URL
	 * @param {number} sequence - Request sequence
	 * @returns {Promise<object|null>} payload
	 * @private
	 */
	async _requestJson(url, sequence) {
		const response = await fetch(url, { signal: this._activeFetchController?.signal });
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}
		const payload = await response.json();
		if (sequence !== this._requestSequence) {
			return null;
		}
		return payload;
	}

	/**
	 * Record successful recommendation fetch.
	 *
	 * @param {object} payload - Recommendation payload
	 * @private
	 */
	_recordFetchSuccess(payload) {
		this._consecutiveFailures = 0;
		this._nextAllowedRequestAt = 0;
		this._dataHealth = 'live';
		this._lastSuccessfulPayload = payload;
	}

	/**
	 * Record fetch failure and apply backoff schedule.
	 *
	 * @private
	 */
	_recordFetchFailure() {
		this._consecutiveFailures += 1;
		const backoff = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, Math.min(5, this._consecutiveFailures - 1)));
		this._nextAllowedRequestAt = Date.now() + backoff;
		this._dataHealth = this._lastSuccessfulPayload ? 'cached' : 'backoff';
	}

	/**
	 * Check whether payload has recommendation cards.
	 *
	 * @param {object|null} payload - Recommendation payload
	 * @returns {boolean} true when payload includes recommendation rows
	 * @private
	 */
	_hasRecommendations(payload) {
		return Array.isArray(payload?.recommendations) && payload.recommendations.length > 0;
	}

	/**
	 * Resolve minSamples by mode for better initial usefulness in sparse modes.
	 *
	 * @param {string} mode - Recommendation mode
	 * @returns {number} minSamples
	 * @private
	 */
	_resolveMinSamples(mode) {
		switch (mode) {
			case 'guildwar':
			case 'cow':
				return 1;
			default:
				return 2;
		}
	}

	/**
	 * Normalize recommendation mode to supported values.
	 *
	 * @param {string} mode - Raw mode
	 * @returns {string} normalized mode
	 * @private
	 */
	_normalizeMode(mode) {
		const normalized = typeof mode === 'string' ? mode.trim().toLowerCase() : 'arena';
		return SUPPORTED_MODES.has(normalized) ? normalized : 'arena';
	}

	/**
	 * Normalize recommendation objective to supported values.
	 *
	 * @param {string} objective - Raw objective
	 * @returns {string} normalized objective
	 * @private
	 */
	_normalizeObjective(objective) {
		const normalized = typeof objective === 'string' ? objective.trim().toLowerCase() : 'balanced';
		return SUPPORTED_OBJECTIVES.has(normalized) ? normalized : 'balanced';
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
		if (this._isCollapsed) {
			panel.classList.add('oj-bro-collapsed');
		}

		panel.innerHTML = `
			<div class="oj-bro-header" id="oj-bro-header">
				<div class="oj-bro-title">Battle Recommendations</div>
				<div class="oj-bro-actions">
					<button class="oj-bro-btn" id="oj-bro-refresh" title="Refresh">↻</button>
					<button class="oj-bro-btn" id="oj-bro-collapse" title="Collapse/Expand">▾</button>
					<button class="oj-bro-btn" id="oj-bro-close" title="Hide (Alt+R)">✕</button>
				</div>
			</div>
			<div class="oj-bro-content" id="oj-bro-content">
				<div class="oj-bro-subtitle" id="oj-bro-context">Waiting for arena enemy data...</div>
				<div class="oj-bro-body" id="oj-bro-body"></div>
			</div>
		`;

		document.body.appendChild(panel);
		this.panel = panel;

		const pos = this.prefStorage.get('battleRecommendationOverlayPosition', null);
		if (pos && Number.isFinite(Number(pos?.x)) && Number.isFinite(Number(pos?.y))) {
			panel.style.left = `${Math.max(0, Number(pos.x))}px`;
			panel.style.top = `${Math.max(0, Number(pos.y))}px`;
		}

		panel.querySelector('#oj-bro-refresh')?.addEventListener('click', () => this._scheduleRefresh(0));
		panel.querySelector('#oj-bro-close')?.addEventListener('click', () => this.toggle());
		panel.querySelector('#oj-bro-collapse')?.addEventListener('click', () => this._toggleCollapsed());

		const header = panel.querySelector('#oj-bro-header');
		header?.addEventListener('mousedown', (event) => {
			if (!(event.target instanceof HTMLElement)) return;
			if (event.target.closest('.oj-bro-btn')) return;
			event.preventDefault();
			this._isDragging = true;
			const rect = panel.getBoundingClientRect();
			this._dragOffsetX = event.clientX - rect.left;
			this._dragOffsetY = event.clientY - rect.top;
			document.addEventListener('mousemove', this._onMouseMove);
			document.addEventListener('mouseup', this._onMouseUp);
		});
	}

	/**
	 * Toggle collapsed state for overlay body.
	 *
	 * @private
	 */
	_toggleCollapsed() {
		this._isCollapsed = !this._isCollapsed;
		this.prefStorage.set('battleRecommendationOverlayCollapsed', this._isCollapsed);
		if (this.panel) {
			this.panel.classList.toggle('oj-bro-collapsed', this._isCollapsed);
		}
		if (!this._isCollapsed) {
			this._scheduleRefresh(0);
		}
	}

	/**
	 * Handle mousemove drag updates.
	 *
	 * @param {MouseEvent} event - Mouse event
	 * @private
	 */
	_onMouseMove(event) {
		if (!this._isDragging || !this.panel) return;
		const x = Math.max(0, event.clientX - this._dragOffsetX);
		const y = Math.max(0, event.clientY - this._dragOffsetY);
		this.panel.style.left = `${x}px`;
		this.panel.style.top = `${y}px`;
	}

	/**
	 * Handle drag completion and persist position.
	 *
	 * @private
	 */
	_onMouseUp() {
		if (!this._isDragging) return;
		this._isDragging = false;
		document.removeEventListener('mousemove', this._onMouseMove);
		document.removeEventListener('mouseup', this._onMouseUp);
		if (!this.panel) return;
		const left = parseInt(this.panel.style.left || '0', 10);
		const top = parseInt(this.panel.style.top || '0', 10);
		this.prefStorage.set('battleRecommendationOverlayPosition', {
			x: Number.isFinite(left) ? left : 0,
			y: Number.isFinite(top) ? top : 0,
		});
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
			const source = this._escapeHtml(this._context.source || 'detected context');
			contextEl.innerHTML = `${this._labelForMode(this._context.mode)} • ${this._escapeHtml(target)} • ${source}`;
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
		const cards = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
		const segmented = Array.isArray(payload?.segmentedRecommendations) ? payload.segmentedRecommendations : [];

		if (cards.length === 0 && segmented.length === 0) {
			bodyEl.innerHTML = '<div class="oj-bro-empty">No recommendations yet. Fight more battles in this mode to train recommendations.</div>';
			return;
		}

		const healthBadge = this._renderHealthBadge();
		const rows = segmented.length > 0
			? this._renderSegmentedRows(segmented)
			: this._renderCardRows(cards.slice(0, 3));

		bodyEl.innerHTML = `
			<div class="oj-bro-health-row">${healthBadge}</div>
			${rows}
		`;

		const contextEl = this.panel.querySelector('#oj-bro-context');
		if (contextEl) {
			const target = this._context.opponentName || (this._context.opponentId ? `opponent #${this._context.opponentId}` : 'mode-level recommendations');
			const source = this._escapeHtml(this._context.source || 'detected context');
			contextEl.innerHTML = `${this._labelForMode(mode)} • ${this._escapeHtml(target)} • ${source}`;
		}
	}

	/**
	 * Render status badge for payload quality.
	 *
	 * @returns {string} HTML
	 * @private
	 */
	_renderHealthBadge() {
		switch (this._dataHealth) {
			case 'cached':
				return '<span class="oj-bro-badge oj-bro-badge-cached">Cached data</span>';
			case 'backoff':
				return '<span class="oj-bro-badge oj-bro-badge-backoff">API retry backoff</span>';
			default:
				return '<span class="oj-bro-badge oj-bro-badge-live">Live</span>';
		}
	}

	/**
	 * Render simple recommendation rows.
	 *
	 * @param {Array<object>} cards - Recommendation cards
	 * @returns {string} HTML
	 * @private
	 */
	_renderCardRows(cards) {
		return cards.map((rec, index) => {
			const teamPreview = this._escapeHtml(rec?.teamPreview || 'Unknown Team');
			const battles = Number(rec?.battles || rec?.sampleSize || 0);
			const winRate = this._resolveWinRate(rec);
			const confidence = this._resolveConfidence(rec);
			const score = this._resolveScore(rec);
			const rationale = this._escapeHtml(rec?.rationale || 'No rationale provided.');

			return `<div class="oj-bro-row" style="margin-top:${index === 0 ? '0' : '6px'}">
				<div class="oj-bro-row-title">${teamPreview}</div>
				<div class="oj-bro-metrics">Win ${winRate} • Conf ${confidence} • Score ${score} • ${battles} samples</div>
				<div class="oj-bro-rationale">${rationale}</div>
			</div>`;
		}).join('');
	}

	/**
	 * Render Grand Arena segmented recommendation rows.
	 *
	 * @param {Array<object>} segments - Segment list
	 * @returns {string} HTML
	 * @private
	 */
	_renderSegmentedRows(segments) {
		return segments.map((segment) => {
			const power = Number(segment?.opponentPower || 0).toLocaleString();
			const title = `Team ${Number(segment?.slot || 0)} • target ${power}`;
			const cards = Array.isArray(segment?.recommendations) ? segment.recommendations : [];
			const rows = cards.length > 0
				? this._renderCardRows(cards)
				: '<div class="oj-bro-empty">No team-slot recommendation yet.</div>';
			return `<div class="oj-bro-segment">
				<div class="oj-bro-segment-title">${this._escapeHtml(title)}</div>
				${rows}
			</div>`;
		}).join('');
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
	 * Handle page visibility changes.
	 *
	 * @private
	 */
	_onVisibilityChange() {
		if (document.hidden) return;
		if (this.isVisible && !this._isCollapsed) {
			this._scheduleRefresh(200);
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
