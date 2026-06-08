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

import { buildConfiguredApiUrl, getApiBaseUrlCandidates } from './helpers/apiConfig.js';
import HERO_NAMES, { resolveHeroName } from './heroNames.js';

const BATTLE_RECOMMENDATIONS_PATH = '/api/sync/battles/recommendations';
const TEAM_RECOMMENDATIONS_PATH = '/api/sync/teams/recommendations';
const ARENA_SIMULATION_RECOMMENDATIONS_PATH = '/api/sync/teams/recommendations/arena/simulate';
const TEAM_RECOMMENDATION_OPERATIONS_SUMMARY_PATH = '/api/sync/teams/recommendations/operations-summary';
const AUTO_REFRESH_MS = 20000;
const MAX_BACKOFF_MS = 30000;
const MIN_REFRESH_GAP_MS = 1200;
const OPERATIONS_SUMMARY_REFRESH_MS = 90000;
const OPERATIONS_SUMMARY_ERROR_BACKOFF_MS = 20000;
const MAX_DEEP_SCAN_DEPTH = 4;
const MAX_CANDIDATES = 30;
const MODE_SWITCH_COOLDOWN_MS = 1500;
const MAX_VALID_ID = 2147483647;
const MAX_VALID_POWER = 500000000;
const CONTEXT_FRESHNESS_OVERRIDE_MS = 60000;
const CONTEXT_CONFIDENCE_GUARD_DELTA = 0.15;
const DEFAULT_CANDIDATE_MAX_AGE_MS = 15 * 60 * 1000;
const DEFAULT_HINT_TTL_MS = 7000;
const MODE_CANDIDATE_MAX_AGE_MS = Object.freeze({
	arena: 8 * 60 * 1000,
	grandarena: 8 * 60 * 1000,
	titanarena: 8 * 60 * 1000,
	guildwar: 20 * 60 * 1000,
	cow: 20 * 60 * 1000,
	adventure: 12 * 60 * 1000,
	dungeon: 10 * 60 * 1000,
	toe: 15 * 60 * 1000,
});
const OVERLAY_MIN_VISIBLE_PX = 48;

const ATTACK_CALL_TO_CONTEXT = Object.freeze({
	arenaAttack: { mode: 'arena', enemyMetadataKey: 'arenaEnemies', sourceLabel: 'arena attack target' },
	arenaEnd: { mode: 'arena', enemyMetadataKey: 'arenaEnemies', sourceLabel: 'arena result target' },
	grandArenaAttack: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies', sourceLabel: 'grand arena target' },
	grandArenaEnd: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies', sourceLabel: 'grand arena result target' },
	titanArenaAttack: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies', sourceLabel: 'titan arena target' },
	titanArenaEnd: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies', sourceLabel: 'titan arena result target' },
	clanWarAttack: { mode: 'guildwar', sourceLabel: 'guild war attack target' },
	clanWarBattle: { mode: 'guildwar', sourceLabel: 'guild war battle target' },
	clanWarEnd: { mode: 'guildwar', sourceLabel: 'guild war result target' },
	adventureBattle: { mode: 'adventure', sourceLabel: 'adventure battle target' },
	adventureEnd: { mode: 'adventure', sourceLabel: 'adventure result target' },
	adventureSoloBattle: { mode: 'adventure', sourceLabel: 'adventure solo target' },
	adventureSoloEnd: { mode: 'adventure', sourceLabel: 'adventure solo result target' },
	dungeonBattle: { mode: 'dungeon', sourceLabel: 'dungeon battle target' },
	dungeonEnd: { mode: 'dungeon', sourceLabel: 'dungeon result target' },
	titanDungeonBattle: { mode: 'dungeon', sourceLabel: 'titan dungeon battle target' },
	titanDungeonEnd: { mode: 'dungeon', sourceLabel: 'titan dungeon result target' },
	titanDungeonFight: { mode: 'dungeon', sourceLabel: 'titan dungeon fight target' },
	clanDungeonBattle: { mode: 'dungeon', sourceLabel: 'clan dungeon target' },
	tournamentBattle: { mode: 'toe', sourceLabel: 'tournament target' },
	tournamentEnd: { mode: 'toe', sourceLabel: 'tournament result target' },
	clashBattle: { mode: 'cow', sourceLabel: 'clash target' },
	clashEnd: { mode: 'cow', sourceLabel: 'clash result target' },
});

const ENEMY_LIST_CALL_TO_CONTEXT = Object.freeze({
	arenaGetEnemies: { mode: 'arena', enemyMetadataKey: 'arenaEnemies', sourceLabel: 'arena enemy list' },
	arenaFindEnemies: { mode: 'arena', enemyMetadataKey: 'arenaEnemies', sourceLabel: 'arena enemy list' },
	grandArenaGetEnemies: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies', sourceLabel: 'grand arena enemy list' },
	grandArenaFindEnemies: { mode: 'grandarena', enemyMetadataKey: 'grandArenaEnemies', sourceLabel: 'grand arena enemy list' },
	titanArenaGetEnemies: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies', sourceLabel: 'titan arena enemy list' },
	titanArenaFindEnemies: { mode: 'titanarena', enemyMetadataKey: 'titanArenaEnemies', sourceLabel: 'titan arena enemy list' },
	clanWarGetDefence: { mode: 'guildwar', sourceLabel: 'guild war defence list' },
	clanWarGetDefense: { mode: 'guildwar', sourceLabel: 'guild war defence list' },
	clanWarGetBriefInfo: { mode: 'guildwar', sourceLabel: 'guild war brief state' },
	adventureGetAll: { mode: 'adventure', sourceLabel: 'adventure active data' },
	adventure_getActiveData: { mode: 'adventure', sourceLabel: 'adventure active data' },
	adventureSolo_getActiveData: { mode: 'adventure', sourceLabel: 'adventure solo data' },
	dungeonGetState: { mode: 'dungeon', sourceLabel: 'dungeon state' },
	titanDungeonGetInfo: { mode: 'dungeon', sourceLabel: 'titan dungeon state' },
	towerGetState: { mode: 'dungeon', sourceLabel: 'tower state' },
	tournamentGetInfo: { mode: 'toe', sourceLabel: 'tournament state' },
	tournament_getInfo: { mode: 'toe', sourceLabel: 'tournament state' },
	powerTournament_getState: { mode: 'toe', sourceLabel: 'power tournament state' },
	crossClanWar_getAttackMap: { mode: 'cow', sourceLabel: 'clash attack map' },
});

const MODE_ONLY_CALL_TO_CONTEXT = Object.freeze({
	clanWarGetInfo: { mode: 'guildwar', sourceLabel: 'guild war state' },
	clanWarUserGetInfo: { mode: 'guildwar', sourceLabel: 'guild war user state' },
	adventure_find: { mode: 'adventure', sourceLabel: 'adventure lobby state' },
	seasonAdventure_getInfo: { mode: 'adventure', sourceLabel: 'season adventure state' },
	crossClanWar_getInfo: { mode: 'cow', sourceLabel: 'clash state' },
	clashGetInfo: { mode: 'cow', sourceLabel: 'clash state' },
	crossClanWar_getSettings: { mode: 'cow', sourceLabel: 'clash settings' },
});

const MODE_METADATA_KEYS = Object.freeze({
	arena: ['battleRecommendationLastTargetArena', 'arenaEnemies'],
	grandarena: ['battleRecommendationLastTargetGrandArena', 'grandArenaEnemies'],
	titanarena: ['battleRecommendationLastTargetTitanArena', 'titanArenaEnemies'],
	guildwar: ['battleRecommendationLastTargetGuildWar', 'guildWarDefense', 'currentGuildWar', 'guildWarWarlord', 'guildWarBrief'],
	adventure: ['battleRecommendationLastTargetAdventure', 'adventureActive', 'adventureSoloActive', 'soloAdventure', 'adventurePassed', 'adventureLobbies', 'seasonAdventure'],
	dungeon: ['battleRecommendationLastTargetDungeon', 'towerState', 'currentRaidBoss', 'raidRating', 'raidSubscription', 'guildActivityStats'],
	toe: ['battleRecommendationLastTargetToe', 'powerTournament', 'hallOfFame'],
	cow: ['cowAttackMap', 'cowDefensePlan', 'cowSettings'],
});

const SUPPORTED_MODES = new Set(['arena', 'grandarena', 'titanarena', 'guildwar', 'cow', 'adventure', 'dungeon', 'toe']);
const ARENA_FAMILY_MODES = new Set(['arena', 'grandarena', 'titanarena']);
const SUPPORTED_OBJECTIVES = new Set(['balanced', 'offense', 'defense', 'speed', 'sustain']);
const MODE_DEFAULT_OBJECTIVE = Object.freeze({
	arena: 'balanced',
	grandarena: 'balanced',
	titanarena: 'offense',
	guildwar: 'defense',
	cow: 'balanced',
	adventure: 'sustain',
	dungeon: 'sustain',
	toe: 'defense',
});
const MODE_CONTEXT_PRIORITY = Object.freeze({
	attack: 3,
	enemyList: 2,
	modeState: 1,
});
const MODE_POWER_WINDOW = Object.freeze({
	arena: 40000,
	grandarena: 25000,
	titanarena: 30000,
});
const ENGINE_MODE_MAP = Object.freeze({
	arena: 'arena',
	grandarena: 'grandarena',
	titanarena: 'arena',
	guildwar: 'guildwar',
	cow: 'cow',
	adventure: 'adventure',
	dungeon: 'dungeon',
	toe: 'toe',
});

const HERO_NAME_TO_ID = Object.freeze(
	Object.entries(HERO_NAMES).reduce((acc, [id, name]) => {
		const normalized = normalizeEntityNameToken(name);
		if (normalized && !(normalized in acc)) {
			acc[normalized] = Number(id);
		}
		return acc;
	}, {})
);

function normalizeEntityNameToken(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

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
		this.isVisible = this.prefStorage.get('battleRecommendationOverlayVisible', false);
		/** @type {boolean} */
		this._autoShowOnCombatContext = this.prefStorage.get('battleRecommendationOverlayAutoShow', false);
		/** @type {number} */
		this._autoShowNoticeUntil = 0;
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
			signalConfidence: 0,
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
		/** @type {string} */
		this._lastRequestError = '';
		/** @type {number} */
		this._lastContextPriority = 0;
		/** @type {number} */
		this._lastModeSwitchAt = 0;
		/** @type {{ message:string, level:'info'|'warning'|'error' }|null} */
		this._activeHint = null;
		/** @type {number|null} */
		this._hintTimer = null;
		/** @type {string} */
		this._lastHintKey = '';
		/** @type {number} */
		this._lastHintAt = 0;

		/** @type {boolean} */
		this._showOperationsSummary = this.prefStorage.get('battleRecommendationOverlayShowOps', false);
		/** @type {{ preferredTrendWindowDays:number, modes:Array<object>, generatedAtUtc?:string }|null} */
		this._operationsSummary = null;
		/** @type {number} */
		this._operationsSummaryLastFetchedAt = 0;
		/** @type {number} */
		this._operationsSummaryErrorUntil = 0;

		// Drag state
		this._isDragging = false;
		this._dragOffsetX = 0;
		this._dragOffsetY = 0;

		this._onHotkey = this._onHotkey.bind(this);
		this._onVisibilityChange = this._onVisibilityChange.bind(this);
		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);
		this._onVisibilityChanged = null;

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

		this._notifyVisibilityChanged();

		if (this.isVisible) {
			this._scheduleRefresh(250);
		}
	}

	/**
	 * Register callback invoked whenever overlay visibility changes.
	 *
	 * @param {(isVisible:boolean) => void|null} callback - Visibility callback
	 */
	setVisibilityChangedCallback(callback) {
		this._onVisibilityChanged = typeof callback === 'function' ? callback : null;
		this._notifyVisibilityChanged();
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
		if (this._hintTimer) {
			clearTimeout(this._hintTimer);
			this._hintTimer = null;
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
		if (!Array.isArray(request?.calls) || request.calls.length === 0) {
			return;
		}

		if (!this.isVisible && this._autoShowOnCombatContext) {
			const shouldAutoShow = request.calls.some((call) => {
				const callName = typeof call?.name === 'string' ? call.name : '';
				if (!callName) return false;
				return Boolean(ATTACK_CALL_TO_CONTEXT[callName] || ENEMY_LIST_CALL_TO_CONTEXT[callName]);
			});

			if (shouldAutoShow) {
				this.isVisible = true;
				this._autoShowNoticeUntil = Date.now() + 8000;
				this.prefStorage.set('battleRecommendationOverlayVisible', true);
				if (this.panel) {
					this.panel.style.display = 'block';
					this._clampPanelToViewport();
				}
				this._notifyVisibilityChanged();
				this._showHint('Recommendations panel auto-opened for combat context.', 'info', 7000, 'auto-open');
			}
		}

		let shouldRefresh = false;
		for (const call of request.calls) {
			const callName = typeof call?.name === 'string' ? call.name : '';
			if (!callName) continue;

			const attackContext = ATTACK_CALL_TO_CONTEXT[callName];
			if (attackContext) {
				if (attackContext.enemyMetadataKey) {
					await this._setContextFromAttackCall(attackContext, call?.args || {}, MODE_CONTEXT_PRIORITY.attack);
				} else {
					await this._setContextFromMetadataOnlyMode(attackContext, call?.args || {}, MODE_CONTEXT_PRIORITY.attack);
				}
				shouldRefresh = true;
				continue;
			}

			const listContext = ENEMY_LIST_CALL_TO_CONTEXT[callName];
			if (listContext) {
				if (listContext.enemyMetadataKey) {
					await this._setContextFromEnemyList(listContext, MODE_CONTEXT_PRIORITY.enemyList);
				} else {
					await this._setContextFromMetadataOnlyMode(listContext, call?.args || {}, MODE_CONTEXT_PRIORITY.enemyList);
				}
				shouldRefresh = true;
				continue;
			}

			const modeContext = MODE_ONLY_CALL_TO_CONTEXT[callName];
			if (modeContext) {
				await this._setContextFromMetadataOnlyMode(modeContext, call?.args || {}, MODE_CONTEXT_PRIORITY.modeState);
				shouldRefresh = true;
			}
		}

		if (shouldRefresh && this.isVisible) {
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
		await this._refreshOperationsSummary(now);
		this._renderPayload(payload);
		this._scheduleRefresh(AUTO_REFRESH_MS);
	}

	/**
	 * Refresh operations summary diagnostics with cache-aware throttling.
	 *
	 * @param {number} now - Current timestamp
	 * @returns {Promise<void>}
	 * @private
	 */
	async _refreshOperationsSummary(now) {
		if (!this._showOperationsSummary) {
			return;
		}

		if ((now - this._operationsSummaryLastFetchedAt) < OPERATIONS_SUMMARY_REFRESH_MS) {
			return;
		}

		if (now < this._operationsSummaryErrorUntil) {
			return;
		}

		try {
			const preferredTrendWindowDays = this._resolvePreferredTrendWindowDays();
			const url = new URL(this._buildApiUrl(TEAM_RECOMMENDATION_OPERATIONS_SUMMARY_PATH));
			url.searchParams.set('preferredTrendWindowDays', String(preferredTrendWindowDays));

			const response = await this._request(url.toString(), { signal: this._activeFetchController?.signal });
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const payload = await response.json();
			const modes = Array.isArray(payload?.modes) ? payload.modes : [];
			this._operationsSummary = {
				preferredTrendWindowDays: Number(payload?.preferredTrendWindowDays || preferredTrendWindowDays),
				modes,
				generatedAtUtc: typeof payload?.generatedAtUtc === 'string' ? payload.generatedAtUtc : '',
			};
			this._operationsSummaryLastFetchedAt = now;
			this._operationsSummaryErrorUntil = 0;
		} catch {
			this._operationsSummaryErrorUntil = now + OPERATIONS_SUMMARY_ERROR_BACKOFF_MS;
		}
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
		this._notifyVisibilityChanged();
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
		const objective = this._resolveObjectiveForMode(this._context.mode);
		const confidenceBucket = Math.round(this._sanitizeConfidence(this._context.signalConfidence || 0) * 10);
		return [
			this._context.mode,
			this._context.opponentId || 0,
			this._context.opponentPower || 0,
			objective,
			confidenceBucket,
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
	 * @param {number} priority - Context priority
	 * @returns {Promise<void>}
	 * @private
	 */
	async _setContextFromAttackCall(context, args, priority) {
		const resolvedMode = this._normalizeMode(context.mode);
		const enemyUserId = this._extractEnemyUserId(args);
		const enemyList = await this.idbStorage.getMetadata(context.enemyMetadataKey, []);
		const selected = Array.isArray(enemyList)
			? enemyList.find((item) => this._extractEnemyUserId(item) === enemyUserId) || null
			: null;
		const argCandidate = this._buildCandidateFromArgs(args, resolvedMode, `${context.sourceLabel || 'attack'} args`);
		const metadataFallback = (!selected && !argCandidate)
			? await this._findMetadataFallbackCandidate(resolvedMode, enemyUserId)
			: null;
		const active = selected || argCandidate || metadataFallback;

		const teams = this._extractOpponentTeams(active);
		const powerFromTeams = teams.reduce((sum, team) => sum + Number(team.power || 0), 0) || null;
		const activeId = active?.userId || enemyUserId;
		const activeUpdatedAt = this._extractTimestamp(active) || Date.now();

		this._commitContext({
			mode: resolvedMode,
			opponentId: Number.isFinite(activeId) && activeId > 0 ? activeId : null,
			opponentPower: this._extractOpponentPower(active) || powerFromTeams,
			opponentName: active?.name || '',
			opponentTeams: teams,
			signalConfidence: this._resolveCandidateConfidence(active, teams, this._extractOpponentPower(active) || powerFromTeams, activeId, active?.name),
			source: selected ? (context.sourceLabel || 'attack') : (argCandidate?.source || context.sourceLabel || 'attack'),
			updatedAt: activeUpdatedAt,
		}, priority);
	}

	/**
	 * Set context from latest enemy list metadata when opening enemy selection views.
	 *
	 * @param {{ mode: string, enemyMetadataKey: string, sourceLabel: string }} context - Context map entry
	 * @param {number} priority - Context priority
	 * @returns {Promise<void>}
	 * @private
	 */
	async _setContextFromEnemyList(context, priority) {
		const resolvedMode = this._normalizeMode(context.mode);
		const enemyList = await this.idbStorage.getMetadata(context.enemyMetadataKey, []);
		const selected = this._pickEnemyFromList(enemyList);
		const selectedId = this._extractEnemyUserId(selected);
		const teams = this._extractOpponentTeams(selected);
		const powerFromTeams = teams.reduce((sum, team) => sum + Number(team.power || 0), 0) || null;
		const selectedUpdatedAt = this._extractTimestamp(selected) || Date.now();

		this._commitContext({
			mode: resolvedMode,
			opponentId: Number.isFinite(selectedId) && selectedId > 0 ? selectedId : null,
			opponentPower: this._extractOpponentPower(selected) || powerFromTeams,
			opponentName: selected?.name || '',
			opponentTeams: teams,
			signalConfidence: this._resolveCandidateConfidence(selected, teams, this._extractOpponentPower(selected) || powerFromTeams, selectedId, selected?.name),
			source: context.sourceLabel || 'enemy list',
			updatedAt: selectedUpdatedAt,
		}, priority);
	}

	/**
	 * Set context for modes where enemy metadata may be nested in broad state payloads.
	 *
	 * @param {{ mode: string, sourceLabel: string }} context - Context map entry
	 * @param {object} args - API call args
	 * @param {number} priority - Context priority
	 * @returns {Promise<void>}
	 * @private
	 */
	async _setContextFromMetadataOnlyMode(context, args, priority) {
		const mode = this._normalizeMode(context.mode);
		const preferredId = this._extractEnemyUserId(args);
		const candidates = await this._collectModeCandidates(mode);
		const argCandidate = this._buildCandidateFromArgs(args, mode, `${context.sourceLabel || 'mode'} args`);

		const pool = argCandidate ? [argCandidate, ...candidates] : candidates;

		const selected = this._selectBestCandidate(pool, preferredId, mode);

		this._commitContext({
			mode,
			opponentId: selected?.userId || (preferredId > 0 ? preferredId : null),
			opponentPower: selected?.power || null,
			opponentName: selected?.name || '',
			opponentTeams: Array.isArray(selected?.teams) ? selected.teams : [],
			signalConfidence: this._resolveCandidateConfidence(selected, selected?.teams, selected?.power, selected?.userId, selected?.name),
			source: selected?.source || context.sourceLabel || 'mode metadata',
			updatedAt: this._extractTimestamp(selected) || Date.now(),
		}, priority);
	}

	/**
	 * Collect and age-filter metadata candidates for mode context resolution.
	 *
	 * @param {string} mode - Recommendation mode
	 * @returns {Promise<Array<object>>} candidates
	 * @private
	 */
	async _collectModeCandidates(mode) {
		const keys = MODE_METADATA_KEYS[mode] || [];
		const candidates = [];
		const metadataPayloads = await Promise.all(keys.map((key) => this.idbStorage.getMetadata(key, null)));
		for (let index = 0; index < keys.length; index += 1) {
			const key = keys[index];
			const payload = metadataPayloads[index];
			if (!payload) continue;
			const extracted = this._extractEnemyCandidates(payload, key);
			for (const row of extracted) {
				if (candidates.length >= MAX_CANDIDATES) break;
				if (!this._isCandidateUsable(row, mode)) continue;
				candidates.push(row);
			}
		}
		return candidates;
	}

	/**
	 * Resolve a metadata fallback candidate when attack/list payloads are sparse.
	 *
	 * @param {string} mode - Recommendation mode
	 * @param {number} preferredId - Preferred enemy id
	 * @returns {Promise<object|null>} candidate
	 * @private
	 */
	async _findMetadataFallbackCandidate(mode, preferredId) {
		const candidates = await this._collectModeCandidates(mode);
		return this._selectBestCandidate(candidates, preferredId, mode);
	}

	/**
	 * Build candidate row directly from attack/list args for modes where metadata can lag.
	 *
	 * @param {object|null|undefined} args - API call args
	 * @param {string} mode - Mode key
	 * @param {string} source - Source label
	 * @returns {{ userId:number|null, name:string, power:number, teams:Array<{slot:number,power:number}>, source:string }|null} candidate
	 * @private
	 */
	_buildCandidateFromArgs(args, mode, source) {
		if (!args || typeof args !== 'object') return null;
		const userId = this._extractEnemyUserId(args) || null;
		const name = this._resolveCandidateName(args);
		const teams = this._extractOpponentTeams(args);
		const power = this._resolveCandidatePower(args) || teams.reduce((sum, team) => sum + this._sanitizePower(Number(team.power || 0)), 0) || 0;
		const updatedAt = this._extractTimestamp(args) || Date.now();
		const confidence = this._resolveCandidateConfidence(args, teams, power, userId, name);

		if (!userId && !name && power <= 0 && teams.length === 0) {
			return null;
		}

		return {
			userId,
			name,
			power,
			teams,
			confidence,
			updatedAt,
			source: source || `${mode || 'mode'} args`,
		};
	}

	/**
	 * Commit context if it satisfies priority and mode-switch stability constraints.
	 *
	 * @param {object} nextContext - Proposed context
	 * @param {number} priority - Context source priority
	 * @private
	 */
	_commitContext(nextContext, priority) {
		const now = Date.now();
		const normalizedPriority = Number.isFinite(priority) ? Number(priority) : 0;
		const switchingMode = nextContext?.mode && nextContext.mode !== this._context.mode;
		const nextConfidence = this._sanitizeConfidence(nextContext?.signalConfidence || 0);
		const currentConfidence = this._sanitizeConfidence(this._context?.signalConfidence || 0);
		const nextUpdatedAt = Number(nextContext?.updatedAt || now);
		const currentUpdatedAt = Number(this._context?.updatedAt || 0);
		const isNotFreshUpgrade = (nextUpdatedAt - currentUpdatedAt) < CONTEXT_FRESHNESS_OVERRIDE_MS;
		const confidenceDrop = currentConfidence - nextConfidence;

		if (switchingMode && normalizedPriority < this._lastContextPriority && (now - this._lastModeSwitchAt) < MODE_SWITCH_COOLDOWN_MS) {
			return;
		}

		if (!switchingMode && normalizedPriority <= this._lastContextPriority && confidenceDrop >= CONTEXT_CONFIDENCE_GUARD_DELTA && isNotFreshUpgrade) {
			return;
		}

		if (switchingMode) {
			this._lastModeSwitchAt = now;
		}

		this._lastContextPriority = normalizedPriority;
		this._context = {
			...this._context,
			...nextContext,
			updatedAt: Number(nextContext?.updatedAt || now),
		};
	}

	/**
	 * Pick best enemy row from enemy-list metadata.
	 *
	 * @param {Array<object>|null|undefined} enemyList - Enemy list
	 * @returns {object|null} Best row
	 * @private
	 */
	_pickEnemyFromList(enemyList) {
		if (!Array.isArray(enemyList) || enemyList.length === 0) {
			return null;
		}
		return enemyList
			.slice(0, MAX_CANDIDATES)
			.sort((a, b) => {
				const powerDiff = this._extractOpponentPower(b) - this._extractOpponentPower(a);
				if (powerDiff !== 0) {
					return powerDiff;
				}
				return this._extractTimestamp(b) - this._extractTimestamp(a);
			})[0] || null;
	}

	/**
	 * Select the strongest candidate from args/metadata pool.
	 *
	 * @param {Array<object>} pool - Candidate pool
	 * @param {number} preferredId - Preferred opponent id
	 * @param {string} mode - Context mode
	 * @returns {object|null} Selected candidate
	 * @private
	 */
	_selectBestCandidate(pool, preferredId, mode) {
		if (!Array.isArray(pool) || pool.length === 0) {
			return null;
		}
		let best = null;
		let bestScore = -Infinity;
		for (const candidate of pool.slice(0, MAX_CANDIDATES)) {
			if (!this._isCandidateUsable(candidate, mode)) {
				continue;
			}
			const score = this._scoreCandidate(candidate, preferredId, mode);
			if (score > bestScore) {
				best = candidate;
				bestScore = score;
			}
		}
		return best;
	}

	/**
	 * Score candidate using id match, signal richness, recency and source trust.
	 *
	 * @param {object|null|undefined} candidate - Candidate
	 * @param {number} preferredId - Preferred id
	 * @param {string} mode - Mode key
	 * @returns {number} Score
	 * @private
	 */
	_scoreCandidate(candidate, preferredId, mode) {
		if (!candidate || typeof candidate !== 'object') {
			return -1000;
		}

		let score = 0;
		if (preferredId > 0 && candidate.userId === preferredId) {
			score += 500;
		}
		if (candidate.userId) {
			score += 80;
		}
		if (candidate.name) {
			score += 35;
		}
		score += Math.round(this._sanitizeConfidence(candidate.confidence || 0) * 140);
		if (candidate.power > 0) {
			score += Math.min(200, Math.round(candidate.power / 50000));
		}
		if (Array.isArray(candidate.teams) && candidate.teams.length > 0) {
			score += Math.min(120, candidate.teams.length * 40);
		}

		const ageMs = Date.now() - this._extractTimestamp(candidate);
		if (Number.isFinite(ageMs) && ageMs >= 0) {
			score += Math.max(0, 100 - Math.floor(ageMs / 60000) * 10);
		}

		const source = String(candidate.source || '').toLowerCase();
		if (source.includes('args')) {
			score += 120;
		}
		if (source.includes('guildwar') || source.includes('dungeon') || source.includes('tournament') || source.includes('power')) {
			score += 20;
		}
		if (source.includes('lasttarget')) {
			score += 45;
		}

		if (mode === 'guildwar' && source.includes('guildwarbrief')) {
			score -= 50;
		}

		if (!this._isCandidateUsable(candidate, mode)) {
			score -= 600;
		}

		return score;
	}

	/**
	 * Check whether candidate is usable by age and signal quality.
	 *
	 * @param {object|null|undefined} candidate - Candidate row
	 * @param {string} mode - Recommendation mode
	 * @returns {boolean} true when candidate should remain in selection pool
	 * @private
	 */
	_isCandidateUsable(candidate, mode) {
		if (!candidate || typeof candidate !== 'object') {
			return false;
		}
		const hasSignal = Boolean(candidate.userId) || Boolean(candidate.name) || Number(candidate.power || 0) > 0 || (Array.isArray(candidate.teams) && candidate.teams.length > 0);
		if (!hasSignal) {
			return false;
		}
		const confidence = this._sanitizeConfidence(candidate.confidence || 0);
		if (!candidate.userId && (!Array.isArray(candidate.teams) || candidate.teams.length === 0) && confidence < 0.20) {
			return false;
		}

		const maxAgeMs = MODE_CANDIDATE_MAX_AGE_MS[this._normalizeMode(mode)] || DEFAULT_CANDIDATE_MAX_AGE_MS;
		const updatedAt = this._extractTimestamp(candidate);
		if (updatedAt <= 0) {
			return true;
		}
		return (Date.now() - updatedAt) <= maxAgeMs;
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
		const payloadUpdatedAt = this._extractTimestamp(payload);
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
			const updatedAt = this._extractTimestamp(node) || payloadUpdatedAt;
			const key = `${userId || 0}:${name}:${power}`;
			if ((userId || name || power > 0 || teams.length > 0) && !seen.has(key)) {
				seen.add(key);
				candidates.push({
					userId: userId || null,
					name,
					power,
					teams,
					source,
					updatedAt,
					confidence: this._resolveCandidateConfidence(node, teams, power, userId, name),
				});
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
	 * Extract a timestamp from mixed payloads.
	 *
	 * @param {object|null|undefined} node - Candidate node
	 * @returns {number} Epoch milliseconds or 0
	 * @private
	 */
	_extractTimestamp(node) {
		if (!node || typeof node !== 'object') {
			return 0;
		}
		const raw = Number(
			node.updatedAt
			|| node.lastUpdate
			|| node.updatedAtUtc
			|| node.timestamp
			|| node.time
			|| 0
		);
		if (!Number.isFinite(raw) || raw <= 0) {
			return 0;
		}
		if (raw < 1000000000000) {
			return raw * 1000;
		}
		return raw;
	}

	/**
	 * Resolve candidate display name from arbitrary object shape.
	 *
	 * @param {object} node - Candidate object
	 * @returns {string} Name
	 * @private
	 */
	_resolveCandidateName(node) {
		const raw = node?.name
			|| node?.opponentName
			|| node?.userName
			|| node?.nickname
			|| node?.nick
			|| node?.enemyName
			|| node?.defenderName
			|| node?.targetName
			|| node?.enemy?.name
			|| node?.opponent?.name
			|| node?.defender?.name
			|| node?.target?.name
			|| '';
		if (typeof raw === 'string' && raw.trim().length > 0) {
			return raw;
		}

		const floor = Number(node?.floor || node?.towerFloor || node?.stage || node?.dungeonFloor || 0);
		if (Number.isFinite(floor) && floor > 0) {
			return `Floor ${Math.trunc(floor)}`;
		}

		const tournamentSlot = Number(node?.slot || node?.group || node?.position || 0);
		if (Number.isFinite(tournamentSlot) && tournamentSlot > 0) {
			return `Slot ${Math.trunc(tournamentSlot)}`;
		}

		return '';
	}

	/**
	 * Resolve candidate power from arbitrary object shape.
	 *
	 * @param {object} node - Candidate object
	 * @returns {number} Power
	 * @private
	 */
	_resolveCandidatePower(node) {
		const value = this._sanitizePower(Number(
			node?.power
			|| node?.teamPower
			|| node?.lastKnownPower
			|| node?.totalPower
			|| node?.targetPower
			|| node?.enemyPower
			|| node?.defenderPower
			|| node?.opponentPower
			|| node?.enemy?.power
			|| node?.opponent?.power
			|| node?.defender?.power
			|| node?.target?.power
			|| 0
		));
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
			|| args?.id
			|| args?.enemy?.userId
			|| args?.opponent?.userId
			|| args?.defender?.userId
			|| args?.target?.userId
			|| args?.enemy?.id
			|| args?.opponent?.id
			|| args?.defender?.id
			|| args?.target?.id
			|| 0
		);
		return this._sanitizeId(value);
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
		const primary = this._sanitizePower(Number(enemy.power || enemy.teamPower || enemy.totalPower || 0));
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
		if (!enemy || typeof enemy !== 'object') {
			return [];
		}

		const collectionKeys = ['teams', 'enemyTeams', 'opponentTeams', 'defenders', 'lineups', 'squads', 'battleTeams', 'slots'];
		let rows = [];
		for (const key of collectionKeys) {
			if (Array.isArray(enemy[key])) {
				rows = enemy[key];
				break;
			}
		}

		if (rows.length === 0 && enemy.team && typeof enemy.team === 'object') {
			rows = [enemy.team];
		}

		return rows
			.map((team, index) => ({
				slot: index + 1,
				power: this._resolveTeamPower(team),
			}))
			.filter((row) => Number.isFinite(row.power) && row.power > 0)
			.slice(0, 3);
	}

	/**
	 * Resolve team power from heterogeneous team payloads.
	 *
	 * @param {object|null|undefined} team - Team object
	 * @returns {number} Team power
	 * @private
	 */
	_resolveTeamPower(team) {
		if (!team || typeof team !== 'object') return 0;
		const direct = this._sanitizePower(Number(team.power || team.teamPower || team.totalPower || team.heroPower || team.targetPower || 0));
		if (Number.isFinite(direct) && direct > 0) {
			return direct;
		}
		if (!Array.isArray(team.heroes)) {
			return 0;
		}
		const sum = team.heroes.reduce((acc, hero) => {
			const value = this._sanitizePower(Number(hero?.power || hero?.teamPower || 0));
			return acc + (Number.isFinite(value) && value > 0 ? value : 0);
		}, 0);
		return sum > 0 ? sum : 0;
	}

	/**
	 * Build full local API URL from configured base URL.
	 *
	 * @param {string} path - API path
	 * @returns {string} Absolute URL
	 * @private
	 */
	_buildApiUrl(path) {
		return buildConfiguredApiUrl(this.prefStorage, path);
	}

	/**
	 * Sanitize candidate id to expected numeric range.
	 *
	 * @param {number} value - Raw id
	 * @returns {number} Safe id or 0
	 * @private
	 */
	_sanitizeId(value) {
		if (!Number.isFinite(value) || value <= 0 || value > MAX_VALID_ID) {
			return 0;
		}
		return Math.trunc(value);
	}

	/**
	 * Sanitize power value to expected numeric range.
	 *
	 * @param {number} value - Raw power
	 * @returns {number} Safe power or 0
	 * @private
	 */
	_sanitizePower(value) {
		if (!Number.isFinite(value) || value <= 0 || value > MAX_VALID_POWER) {
			return 0;
		}
		return Math.trunc(value);
	}

	/**
	 * Fetch recommendations for current context.
	 *
	 * @returns {Promise<object|null>} Recommendation payload
	 * @private
	 */
	async _fetchRecommendations() {
		let usedEngineFallback = false;
		let hadSuccessfulResponse = false;
		let lastSuccessfulPayload = null;
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

		const contextMode = this._normalizeMode(this._context.mode);
		const mode = this._resolveEngineMode(contextMode);
		const objective = this._resolveObjectiveForMode(contextMode);
		const minSamples = this._resolveMinSamples(contextMode);

		try {
			let payload = null;
			const fetchSource = async (fetcher, sourceLabel) => {
				const result = await this._safeRecommendationFetch(fetcher, sourceLabel);
				if (result.success) {
					hadSuccessfulResponse = true;
					if (result.payload && typeof result.payload === 'object') {
						lastSuccessfulPayload = result.payload;
					}
				}
				return result;
			};

			if (contextMode === 'grandarena' && this._context.opponentTeams.length > 1) {
				const segmentedResult = await fetchSource(
					() => this._fetchGrandArenaSegmentedRecommendations(sequence, minSamples),
					'grand-arena-segmented'
				);
				payload = segmentedResult.payload;
			} else if (contextMode === 'arena') {
				const arenaSimulationResult = await fetchSource(
					() => this._fetchArenaSimulationRecommendations(sequence, objective, minSamples),
					'arena-simulate'
				);
				payload = arenaSimulationResult.payload;

				if (!this._hasRecommendations(payload)) {
					const arenaBattleFallbackResult = await fetchSource(
						() => this._fetchBattleRecommendationsForTarget(sequence, contextMode, minSamples),
						'arena-battle-fallback'
					);
					payload = arenaBattleFallbackResult.payload;
				}
			} else if (ARENA_FAMILY_MODES.has(contextMode)) {
				const arenaFamilyResult = await fetchSource(
					() => this._fetchBattleRecommendationsForTarget(sequence, contextMode, minSamples),
					'arena-family-battle'
				);
				payload = arenaFamilyResult.payload;
			}

			if (!this._hasRecommendations(payload)) {
				usedEngineFallback = true;
				const modeEngineResult = await fetchSource(
					() => this._fetchModeEngineRecommendations(sequence, mode, objective, minSamples),
					'mode-engine'
				);
				payload = modeEngineResult.payload;
			}

			if (sequence !== this._requestSequence) {
				return this._lastSuccessfulPayload;
			}

			if (this._hasRecommendations(payload)) {
				if (usedEngineFallback) {
					this._showHint('Using engine fallback recommendations while battle history is sparse.', 'warning', DEFAULT_HINT_TTL_MS, `fallback:${contextMode}`);
				}
				this._recordFetchSuccess(payload);
				return payload;
			}

			if (hadSuccessfulResponse) {
				const emptyPayload = lastSuccessfulPayload || {
					recommendations: [],
					note: 'No recommendation candidates yet. Play more battles and sync roster snapshots to train recommendations.',
				};
				this._recordFetchNoRecommendations(emptyPayload);
				return emptyPayload;
			}

			this._recordFetchFailure();
			return this._lastSuccessfulPayload;
		} finally {
			if (this._activeFetchController) {
				this._activeFetchController = null;
			}
		}
	}

	/**
	 * Execute recommendation source fetch and return null on source-specific failure.
	 *
	 * @param {() => Promise<object|null>} fetcher - Source fetch callback
	 * @param {string} sourceLabel - Source label for diagnostics
	 * @returns {Promise<object|null>} payload or null
	 * @private
	 */
	async _safeRecommendationFetch(fetcher, sourceLabel) {
		try {
			return {
				success: true,
				payload: await fetcher(),
			};
		} catch (error) {
			this._lastRequestError = `${sourceLabel}: ${String(error?.message || error || 'request failed')}`;
			return {
				success: false,
				payload: null,
			};
		}
	}

	/**
	 * Fetch Arena-first integrated recommendation/simulation payload.
	 *
	 * @param {number} sequence - Request sequence for stale response guard
	 * @param {string} objective - Recommendation objective
	 * @param {number} minSamples - Min sample threshold
	 * @returns {Promise<object|null>} payload
	 * @private
	 */
	async _fetchArenaSimulationRecommendations(sequence, objective, minSamples) {
		const url = new URL(this._buildApiUrl(ARENA_SIMULATION_RECOMMENDATIONS_PATH));
		url.searchParams.set('objective', objective);
		url.searchParams.set('limit', '3');
		url.searchParams.set('minSamples', String(minSamples));
		url.searchParams.set('preferredTrendWindowDays', String(this._resolvePreferredTrendWindowDays()));

		if (this._context.opponentId) {
			url.searchParams.set('opponentId', String(this._context.opponentId));
		}

		if (this._context.opponentPower) {
			url.searchParams.set('opponentPower', String(this._context.opponentPower));
			url.searchParams.set('powerWindow', String(this._resolvePowerWindow('arena', this._context.opponentPower)));
		}

		const payload = await this._requestJson(url.toString(), sequence);
		if (!payload) return null;

		return {
			...payload,
			sourceType: 'arena-simulate',
		};
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
		const url = new URL(this._buildApiUrl(BATTLE_RECOMMENDATIONS_PATH));
		url.searchParams.set('battleType', mode);
		url.searchParams.set('limit', '3');
		url.searchParams.set('minSamples', String(minSamples));

		if (this._context.opponentId) {
			url.searchParams.set('opponentId', String(this._context.opponentId));
		}

		if (this._context.opponentPower) {
			url.searchParams.set('opponentPower', String(this._context.opponentPower));
			url.searchParams.set('powerWindow', String(this._resolvePowerWindow(mode, this._context.opponentPower)));
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
			const url = new URL(this._buildApiUrl(BATTLE_RECOMMENDATIONS_PATH));
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
		const url = new URL(this._buildApiUrl(TEAM_RECOMMENDATIONS_PATH));
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
		const response = await this._request(url, { signal: this._activeFetchController?.signal });
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
	 * Execute HTTP request with fetch-first strategy and Tampermonkey fallback.
	 *
	 * @param {string} url - Absolute URL
	 * @param {{method?:string, headers?:Object, body?:string, signal?:AbortSignal}} options - Request options
	 * @returns {Promise<{ok:boolean,status:number,statusText:string,json:Function,text:Function}>}
	 * @private
	 */
	async _request(url, options = {}) {
		const candidates = this._buildApiRequestCandidates(url);
		let lastError = null;

		for (const candidateUrl of candidates) {
			try {
				const response = await this._requestSingle(candidateUrl, options);

				if (response.ok) {
					this._persistSuccessfulApiBase(candidateUrl);
					return response;
				}

				if (response.status === 404 && candidateUrl !== candidates[candidates.length - 1]) {
					continue;
				}

				return response;
			} catch (error) {
				lastError = error;
			}
		}

		throw lastError || new Error('API request failed');
	}

	/**
	 * Execute one request URL with fetch-first and Tampermonkey fallback.
	 *
	 * @param {string} url - Absolute URL
	 * @param {{method?:string, headers?:Object, body?:string, signal?:AbortSignal}} options - Request options
	 * @returns {Promise<{ok:boolean,status:number,statusText:string,json:Function,text:Function}>}
	 * @private
	 */
	async _requestSingle(url, options = {}) {
		try {
			return await fetch(url, options);
		} catch (fetchError) {
			try {
				return await this._requestWithTampermonkey(url, options);
			} catch (gmError) {
				if (String(gmError?.message || '').includes('unavailable')) {
					throw fetchError;
				}
				throw gmError;
			}
		}
	}

	/**
	 * Build candidate request URLs from configured and local fallback API origins.
	 *
	 * @param {string} rawUrl - Original absolute URL
	 * @returns {string[]} Candidate absolute URLs
	 * @private
	 */
	_buildApiRequestCandidates(rawUrl) {
		try {
			const parsed = new URL(rawUrl);
			const suffix = `${parsed.pathname}${parsed.search}${parsed.hash}`;
			const candidates = getApiBaseUrlCandidates(this.prefStorage).map((base) => `${base}${suffix}`);
			if (!candidates.includes(rawUrl)) {
				candidates.unshift(rawUrl);
			}
			return candidates;
		} catch {
			return [rawUrl];
		}
	}

	/**
	 * Persist resolved working API base URL so future requests use the recovered origin.
	 *
	 * @param {string} url - Successful absolute URL
	 * @private
	 */
	_persistSuccessfulApiBase(url) {
		try {
			const parsed = new URL(url);
			const recoveredBase = `${parsed.protocol}//${parsed.host}`;
			const currentBase = this.prefStorage.get('apiBaseUrl', '');
			if (recoveredBase && recoveredBase !== currentBase) {
				this.prefStorage.set('apiBaseUrl', recoveredBase);
			}
		} catch {
			// best effort
		}
	}

	/**
	 * Execute HTTP request via Tampermonkey cross-origin API.
	 *
	 * @param {string} url - Absolute URL
	 * @param {{method?:string, headers?:Object, body?:string}} options - Request options
	 * @returns {Promise<{ok:boolean,status:number,statusText:string,json:Function,text:Function}>}
	 * @private
	 */
	async _requestWithTampermonkey(url, options = {}) {
		const gmRequest = typeof GM_xmlhttpRequest === 'function'
			? GM_xmlhttpRequest
			: (typeof window !== 'undefined' && typeof window.GM_xmlhttpRequest === 'function'
				? window.GM_xmlhttpRequest
				: null);

		if (!gmRequest) {
			throw new Error('GM_xmlhttpRequest unavailable');
		}

		const method = String(options?.method || 'GET').toUpperCase();
		const headers = options?.headers || {};
		const body = options?.body;

		return await new Promise((resolve, reject) => {
			gmRequest({
				method,
				url,
				headers,
				data: body,
				responseType: 'text',
				onload: (response) => {
					const status = Number(response?.status || 0);
					const statusText = String(response?.statusText || '');
					const text = typeof response?.responseText === 'string'
						? response.responseText
						: String(response?.response || '');
					resolve({
						ok: status >= 200 && status < 300,
						status,
						statusText,
						json: async () => JSON.parse(text || '{}'),
						text: async () => text,
					});
				},
				onerror: (error) => reject(new Error(error?.error || error?.message || 'GM request failed')),
				ontimeout: () => reject(new Error('GM request timed out')),
			});
		});
	}

	/**
	 * Notify visibility listeners about current panel state.
	 *
	 * @private
	 */
	_notifyVisibilityChanged() {
		if (typeof this._onVisibilityChanged !== 'function') return;
		try {
			this._onVisibilityChanged(Boolean(this.isVisible));
		} catch {
			// best effort callback
		}
	}

	/**
	 * Record successful recommendation fetch.
	 *
	 * @param {object} payload - Recommendation payload
	 * @private
	 */
	_recordFetchSuccess(payload) {
		const hadFailures = this._consecutiveFailures > 0;
		this._consecutiveFailures = 0;
		this._nextAllowedRequestAt = 0;
		this._dataHealth = 'live';
		this._lastRequestError = '';
		this._lastSuccessfulPayload = payload;
		if (hadFailures) {
			this._showHint('Recommendation API connection recovered.', 'info', 4500, 'api-recovered');
		}
	}

	/**
	 * Record successful API reachability when no recommendation cards are currently available.
	 *
	 * @param {object} payload - Successful no-data payload
	 * @private
	 */
	_recordFetchNoRecommendations(payload) {
		this._consecutiveFailures = 0;
		this._nextAllowedRequestAt = 0;
		this._dataHealth = 'live';
		this._lastRequestError = '';
		this._lastSuccessfulPayload = payload;
		this._showHint('API connected. No recommendation samples yet for this context.', 'warning', DEFAULT_HINT_TTL_MS, 'api-no-recommendations');
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
		if (this._lastSuccessfulPayload) {
			this._showHint('API fetch failed. Showing cached recommendations.', 'warning', DEFAULT_HINT_TTL_MS, 'api-cached');
			return;
		}

		const detail = this._lastRequestError ? ` (${this._lastRequestError})` : '';
		this._showHint(`API temporarily unavailable. Retrying with backoff.${detail}`, 'error', DEFAULT_HINT_TTL_MS, 'api-backoff');
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
			case 'dungeon':
			case 'toe':
				return 1;
			default:
				return 2;
		}
	}

	/**
	 * Resolve context mode to API-supported team engine mode.
	 *
	 * @param {string} mode - Context mode
	 * @returns {string} Engine mode
	 * @private
	 */
	_resolveEngineMode(mode) {
		const normalized = this._normalizeMode(mode);
		return ENGINE_MODE_MAP[normalized] || 'arena';
	}

	/**
	 * Resolve objective with mode-specific defaults when preference remains balanced.
	 *
	 * @param {string} mode - Context mode
	 * @returns {string} Objective key
	 * @private
	 */
	_resolveObjectiveForMode(mode) {
		const normalizedMode = this._normalizeMode(mode);
		const preferred = this._normalizeObjective(this.prefStorage.get('teamRecommendationsObjective', 'balanced'));
		if (preferred !== 'balanced') {
			return preferred;
		}
		return MODE_DEFAULT_OBJECTIVE[normalizedMode] || 'balanced';
	}

	/**
	 * Resolve battle power window with mode baseline and opponent scaling.
	 *
	 * @param {string} mode - Battle mode
	 * @param {number} opponentPower - Opponent power
	 * @returns {number} powerWindow
	 * @private
	 */
	_resolvePowerWindow(mode, opponentPower) {
		const base = MODE_POWER_WINDOW[this._normalizeMode(mode)] || 35000;
		const power = Number(opponentPower || 0);
		if (!Number.isFinite(power) || power <= 0) {
			return base;
		}
		const scaled = Math.round(power * 0.08);
		return Math.max(20000, Math.min(120000, Math.max(base, scaled)));
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
					<button class="oj-bro-btn ${this._showOperationsSummary ? 'oj-bro-btn-active' : ''}" id="oj-bro-ops-toggle" title="Toggle operations diagnostics">◎</button>
					<button class="oj-bro-btn" id="oj-bro-refresh" title="Refresh">↻</button>
					<button class="oj-bro-btn" id="oj-bro-collapse" title="Collapse/Expand">▾</button>
					<button class="oj-bro-btn" id="oj-bro-close" title="Hide (Alt+R)">✕</button>
				</div>
			</div>
			<div class="oj-bro-content" id="oj-bro-content">
				<div class="oj-bro-subtitle" id="oj-bro-context">Waiting for battle context data...</div>
				<div class="oj-bro-hints" id="oj-bro-hints" aria-live="polite"></div>
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
		this._clampPanelToViewport();

		panel.querySelector('#oj-bro-refresh')?.addEventListener('click', () => this._scheduleRefresh(0));
		panel.querySelector('#oj-bro-ops-toggle')?.addEventListener('click', () => this._toggleOperationsSummary());
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
	 * Toggle operations diagnostics section visibility.
	 *
	 * @private
	 */
	_toggleOperationsSummary() {
		this._showOperationsSummary = !this._showOperationsSummary;
		this.prefStorage.set('battleRecommendationOverlayShowOps', this._showOperationsSummary);

		if (this.panel) {
			this.panel.querySelector('#oj-bro-ops-toggle')?.classList.toggle('oj-bro-btn-active', this._showOperationsSummary);
		}

		if (this._showOperationsSummary) {
			this._operationsSummaryLastFetchedAt = 0;
		}

		this._scheduleRefresh(0);
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
	 * Clamp overlay position so at least part of the panel stays visible.
	 *
	 * @private
	 */
	_clampPanelToViewport() {
		if (!this.panel) return;

		const rect = this.panel.getBoundingClientRect();
		const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
		const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

		const minX = -Math.max(0, rect.width - OVERLAY_MIN_VISIBLE_PX);
		const maxX = Math.max(0, viewportWidth - OVERLAY_MIN_VISIBLE_PX);
		const minY = 0;
		const maxY = Math.max(0, viewportHeight - OVERLAY_MIN_VISIBLE_PX);

		const nextX = Math.min(maxX, Math.max(minX, rect.left));
		const nextY = Math.min(maxY, Math.max(minY, rect.top));

		this.panel.style.left = `${Math.round(nextX)}px`;
		this.panel.style.top = `${Math.round(nextY)}px`;
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
			const signal = this._escapeHtml(this._describeContextSignal());
			const autoShowNotice = this._buildAutoShowNoticeLabel();
			contextEl.innerHTML = `${this._labelForMode(this._context.mode)} • ${this._escapeHtml(target)} • ${source} • ${signal}${autoShowNotice ? ` • ${this._escapeHtml(autoShowNotice)}` : ''}`;
		}
		if (bodyEl) {
			bodyEl.innerHTML = '<div class="oj-bro-empty">Loading recommendations...</div>';
		}
		this._renderHintArea();
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
		const operationsSummary = this._renderOperationsSummary(this._context.mode);
		const payloadNote = typeof payload?.note === 'string' && payload.note.trim().length > 0
			? `<div class="oj-bro-empty" style="margin:6px 0 2px 0">${this._escapeHtml(payload.note)}</div>`
			: '';
		const sourceType = String(payload?.sourceType || '').trim();
		const rows = segmented.length > 0
			? this._renderSegmentedRows(segmented, sourceType)
			: this._renderCardRows(
				cards.slice(0, 3).map((rec) => ({
					...rec,
					sourceType: rec?.sourceType || sourceType,
				}))
			);

		bodyEl.innerHTML = `
			<div class="oj-bro-health-row">${healthBadge}</div>
			${operationsSummary}
			${payloadNote}
			${rows}
		`;

		const contextEl = this.panel.querySelector('#oj-bro-context');
		if (contextEl) {
			const target = this._context.opponentName || (this._context.opponentId ? `opponent #${this._context.opponentId}` : 'mode-level recommendations');
			const source = this._escapeHtml(this._context.source || 'detected context');
			const signal = this._escapeHtml(this._describeContextSignal());
			const autoShowNotice = this._buildAutoShowNoticeLabel();
			contextEl.innerHTML = `${this._labelForMode(mode)} • ${this._escapeHtml(target)} • ${source} • ${signal}${autoShowNotice ? ` • ${this._escapeHtml(autoShowNotice)}` : ''}`;
		}
		this._renderHintArea();
	}

	/**
	 * Show a transient in-panel hint message.
	 *
	 * @param {string} message - Hint text
	 * @param {'info'|'warning'|'error'} level - Visual severity
	 * @param {number} ttlMs - Visibility duration in milliseconds
	 * @param {string} key - Deduplication key
	 * @private
	 */
	_showHint(message, level = 'info', ttlMs = DEFAULT_HINT_TTL_MS, key = '') {
		const normalizedMessage = String(message || '').trim();
		if (!normalizedMessage) return;

		const now = Date.now();
		const dedupeKey = String(key || normalizedMessage).toLowerCase();
		if (dedupeKey && dedupeKey === this._lastHintKey && (now - this._lastHintAt) < 6000) {
			return;
		}

		this._lastHintKey = dedupeKey;
		this._lastHintAt = now;
		this._activeHint = {
			message: normalizedMessage,
			level: level === 'error' ? 'error' : (level === 'warning' ? 'warning' : 'info'),
		};
		this._renderHintArea();

		if (this._hintTimer) {
			clearTimeout(this._hintTimer);
		}
		this._hintTimer = setTimeout(() => {
			this._hintTimer = null;
			this._activeHint = null;
			this._renderHintArea();
		}, Math.max(1200, Number(ttlMs || DEFAULT_HINT_TTL_MS)));
	}

	/**
	 * Render current hint state in panel.
	 *
	 * @private
	 */
	_renderHintArea() {
		if (!this.panel) return;
		const hintEl = this.panel.querySelector('#oj-bro-hints');
		if (!hintEl) return;

		if (!this._activeHint) {
			hintEl.innerHTML = '';
			hintEl.style.display = 'none';
			return;
		}

		const levelClass = this._activeHint.level === 'error'
			? 'oj-bro-hint-error'
			: (this._activeHint.level === 'warning' ? 'oj-bro-hint-warning' : 'oj-bro-hint-info');
		hintEl.style.display = 'block';
		hintEl.innerHTML = `<div class="oj-bro-hint ${levelClass}">${this._escapeHtml(this._activeHint.message)}</div>`;
	}

	/**
	 * Builds a short context suffix after automatic panel opening.
	 *
	 * @returns {string}
	 * @private
	 */
	_buildAutoShowNoticeLabel() {
		if (Date.now() > this._autoShowNoticeUntil) {
			return '';
		}

		return 'Auto-opened';
	}

	/**
	 * Describe current context signal quality for quick operator confidence.
	 *
	 * @returns {string} Human label
	 * @private
	 */
	_describeContextSignal() {
		const source = String(this._context?.source || '').toLowerCase();
		const ageMs = Math.max(0, Date.now() - Number(this._context?.updatedAt || 0));
		if (source.includes('args')) {
			return 'Live Args';
		}
		const confidence = this._sanitizeConfidence(this._context?.signalConfidence || 0);
		if ((ageMs <= 60000 && confidence >= 0.35) || (ageMs <= 180000 && confidence >= 0.90)) {
			return 'Fresh Metadata';
		}
		return 'Stale Metadata';
	}

	/**
	 * Resolve candidate confidence using explicit field when available, otherwise derive a heuristic confidence.
	 *
	 * @param {object|null|undefined} node - Candidate node
	 * @param {Array<{slot:number,power:number}>|null|undefined} teams - Candidate teams
	 * @param {number} power - Candidate power
	 * @param {number|null|undefined} userId - Candidate user id
	 * @param {string|null|undefined} name - Candidate display name
	 * @returns {number} Confidence in range [0..1]
	 * @private
	 */
	_resolveCandidateConfidence(node, teams, power, userId, name) {
		const explicit = this._sanitizeConfidence(Number(
			node?.confidence
			|| node?.signalConfidence
			|| node?.confidenceScore
			|| node?.quality
			|| 0
		));
		if (explicit > 0) {
			return explicit;
		}

		let score = 0.20;
		if (Number(userId || 0) > 0) score += 0.25;
		if (typeof name === 'string' && name.trim().length > 0) score += 0.15;
		if (Number(power || 0) > 0) score += 0.20;
		if (Array.isArray(teams) && teams.length > 0) score += 0.20;

		const source = String(node?.source || node?.sourceCall || '').toLowerCase();
		if (source.includes('attack') || source.includes('battle')) score += 0.05;

		return this._sanitizeConfidence(score);
	}

	/**
	 * Clamp confidence to [0, 1].
	 *
	 * @param {number} value - Raw confidence
	 * @returns {number} Normalized confidence
	 * @private
	 */
	_sanitizeConfidence(value) {
		if (!Number.isFinite(value)) {
			return 0;
		}
		return Math.max(0, Math.min(1, Number(value)));
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
				return '<span class="oj-bro-badge oj-bro-badge-cached">Cached fallback</span>';
			case 'backoff':
				return '<span class="oj-bro-badge oj-bro-badge-backoff">Retry backoff</span>';
			default:
				return '<span class="oj-bro-badge oj-bro-badge-live">Live data</span>';
		}
	}

	/**
	 * Render per-mode operations diagnostics section.
	 *
	 * @param {string} mode - Current context mode
	 * @returns {string} HTML
	 * @private
	 */
	_renderOperationsSummary(mode) {
		if (!this._showOperationsSummary) {
			return '';
		}

		const modeSummary = this._resolveOperationsSummaryForMode(mode);
		if (!modeSummary) {
			return '<div class="oj-bro-ops"><div class="oj-bro-ops-title">Ops Metrics</div><div class="oj-bro-ops-empty">Waiting for operations summary data...</div></div>';
		}

		const mae = Number(modeSummary.meanAbsoluteError || 0);
		const brier = Number(modeSummary.meanBrierScore || 0);
		const bias = Number(modeSummary.predictionBias || 0);
		const samples = Number(modeSummary.samples || 0);
		const friction = Number(modeSummary.suggestedFrictionScale || 0);
		const isStale = Boolean(modeSummary.isStale);
		const healthStatus = this._resolveOperationsHealthStatus(modeSummary, mae, brier, isStale);
		const healthLabel = this._resolveOperationsHealthLabel(modeSummary, healthStatus);
		const qualityClass = this._resolveOperationsQualityClass(healthStatus);

		return `<div class="oj-bro-ops">
			<div class="oj-bro-ops-title">Ops Metrics <span class="oj-bro-ops-quality ${qualityClass}">${healthLabel}</span></div>
			<div class="oj-bro-ops-grid">
				<div class="oj-bro-ops-item"><span>MAE</span><strong>${mae.toFixed(3)}</strong></div>
				<div class="oj-bro-ops-item"><span>Brier</span><strong>${brier.toFixed(3)}</strong></div>
				<div class="oj-bro-ops-item"><span>Bias</span><strong>${bias.toFixed(3)}</strong></div>
				<div class="oj-bro-ops-item"><span>Scale</span><strong>${friction.toFixed(2)}</strong></div>
				<div class="oj-bro-ops-item"><span>Samples</span><strong>${samples.toLocaleString()}</strong></div>
			</div>
		</div>`;
	}

	/**
	 * Resolve operations summary row for the current mode.
	 *
	 * @param {string} mode - Context mode
	 * @returns {object|null} mode summary row
	 * @private
	 */
	_resolveOperationsSummaryForMode(mode) {
		const rows = Array.isArray(this._operationsSummary?.modes) ? this._operationsSummary.modes : [];
		if (rows.length === 0) {
			return null;
		}

		const contextMode = this._normalizeMode(mode);
		const engineMode = this._resolveEngineMode(contextMode);
		return rows.find((row) => this._normalizeMode(String(row?.mode || '')) === engineMode)
			|| rows.find((row) => this._normalizeMode(String(row?.mode || '')) === contextMode)
			|| null;
	}

	/**
	 * Resolve css quality class based on operations thresholds.
	 *
	 * @param {string} status - Canonical operations health status
	 * @returns {string} css class
	 * @private
	 */
	_resolveOperationsQualityClass(status) {
		if (status === 'stale' || status === 'monitor') {
			return 'oj-bro-ops-quality-warn';
		}
		return 'oj-bro-ops-quality-ok';
	}

	/**
	 * Resolve canonical operations health status from API row or local fallback thresholds.
	 *
	 * @param {object} modeSummary - Mode summary row
	 * @param {number} mae - Mean absolute error
	 * @param {number} brier - Mean Brier score
	 * @param {boolean} isStale - Staleness flag
	 * @returns {string} status key
	 * @private
	 */
	_resolveOperationsHealthStatus(modeSummary, mae, brier, isStale) {
		const apiStatus = String(modeSummary?.healthStatus || '').trim().toLowerCase();
		if (apiStatus === 'healthy' || apiStatus === 'monitor' || apiStatus === 'stale') {
			return apiStatus;
		}

		if (isStale) {
			return 'stale';
		}

		if (mae > 0.22 || brier > 0.28) {
			return 'monitor';
		}

		return 'healthy';
	}

	/**
	 * Resolve human label for operations health status.
	 *
	 * @param {object} modeSummary - Mode summary row
	 * @param {string} status - Health status key
	 * @returns {string} label
	 * @private
	 */
	_resolveOperationsHealthLabel(modeSummary, status) {
		const apiLabel = String(modeSummary?.healthLabel || '').trim();
		if (apiLabel) {
			return this._escapeHtml(apiLabel);
		}

		switch (status) {
			case 'stale':
				return 'Stale';
			case 'monitor':
				return 'Needs Attention';
			default:
				return 'Healthy';
		}
	}

	/**
	 * Resolve preferred trend window for operations summary endpoint.
	 *
	 * @returns {number} preferred trend window days
	 * @private
	 */
	_resolvePreferredTrendWindowDays() {
		const value = Number(this.prefStorage.get('teamRecommendationsPreferredTrendWindowDays', 30));
		if (value === 7 || value === 30 || value === 90) {
			return value;
		}
		return 30;
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
			const teamPreview = this._escapeHtml(rec?.teamPreview || rec?.TeamPreview || rec?.team || 'Unknown Team');
			const avatars = this._renderTeamAvatarStrip(rec);
			const tags = this._renderRecommendationTags(rec);
			const battles = Number(rec?.battles || rec?.sampleSize || rec?.totalBattles || rec?.sampleCount || 0);
			const winRate = this._resolveWinRate(rec);
			const confidence = this._resolveConfidence(rec);
			const score = this._resolveScore(rec);
			const simulationWinRate = this._resolveSimulationWinRate(rec);
			const simulationInterval = this._resolveSimulationInterval(rec);
			const simulationRuns = Number(rec?.simulationRuns || 0);
			const teamPowerEstimate = Number(rec?.teamPowerEstimate || 0);
			const opponentPowerUsed = Number(rec?.opponentPowerUsed || 0);
			const rationale = this._escapeHtml(rec?.rationale || 'No rationale provided.');
			const simulationLine = simulationWinRate
				? `<div class="oj-bro-metrics">Sim ${simulationWinRate} • CI ${simulationInterval} • Runs ${simulationRuns > 0 ? simulationRuns : 'n/a'}</div>`
				: '';
			const powerLine = (teamPowerEstimate > 0 || opponentPowerUsed > 0)
				? `<div class="oj-bro-metrics">Power team ${teamPowerEstimate > 0 ? teamPowerEstimate.toLocaleString() : 'n/a'} • opp ${opponentPowerUsed > 0 ? opponentPowerUsed.toLocaleString() : 'n/a'}</div>`
				: '';

			return `<div class="oj-bro-row" style="margin-top:${index === 0 ? '0' : '6px'}">
				<div class="oj-bro-row-title">${teamPreview}</div>
				${avatars}
				${tags}
				<div class="oj-bro-metrics">Win ${winRate} • Conf ${confidence} • Score ${score} • ${battles} samples</div>
				${simulationLine}
				${powerLine}
				<div class="oj-bro-rationale">${rationale}</div>
			</div>`;
		}).join('');
	}

	/**
	 * Render compact quality/source tags for a recommendation card.
	 *
	 * @param {object} rec - Recommendation row
	 * @returns {string} HTML
	 * @private
	 */
	_renderRecommendationTags(rec) {
		const tags = [];
		const confidenceRaw = Number(rec?.confidence ?? rec?.confidenceScore ?? 0);
		const sampleCount = Number(rec?.battles || rec?.sampleSize || rec?.totalBattles || rec?.sampleCount || 0);
		const simulationRuns = Number(rec?.simulationRuns || 0);
		const sourceType = String(rec?.sourceType || rec?.source || '').trim().toLowerCase();

		if (Number.isFinite(confidenceRaw) && confidenceRaw > 0) {
			const confidenceLabel = confidenceRaw >= 0.7
				? 'High confidence'
				: confidenceRaw >= 0.45
					? 'Medium confidence'
					: 'Low confidence';
			tags.push(`<span class="oj-bro-tag oj-bro-tag-confidence" title="Confidence score ${(Math.max(0, Math.min(1, confidenceRaw)) * 100).toFixed(0)}%">${confidenceLabel}</span>`);
		}

		if (sampleCount > 0) {
			const sampleLabel = sampleCount >= 30
				? 'Strong sample'
				: sampleCount >= 10
					? 'Growing sample'
					: 'Sparse sample';
			tags.push(`<span class="oj-bro-tag oj-bro-tag-sample" title="${sampleCount} historical matches">${sampleLabel}</span>`);
		}

		if (simulationRuns > 0 || Number.isFinite(Number(rec?.simulatedWinProbability))) {
			tags.push('<span class="oj-bro-tag oj-bro-tag-sim">Simulator</span>');
		}

		if (sourceType.includes('engine')) {
			tags.push('<span class="oj-bro-tag oj-bro-tag-source">Engine fallback</span>');
		} else if (sourceType.includes('battle')) {
			tags.push('<span class="oj-bro-tag oj-bro-tag-source">Battle history</span>');
		}

		if (tags.length === 0) {
			return '';
		}

		return `<div class="oj-bro-tags">${tags.join('')}</div>`;
	}

	/**
	 * Render compact avatar strip for a recommendation card.
	 *
	 * @param {object} rec - Recommendation row
	 * @returns {string} HTML
	 * @private
	 */
	_renderTeamAvatarStrip(rec) {
		const heroIds = this._extractRecommendationHeroIds(rec).slice(0, 5);
		if (heroIds.length === 0) {
			return '';
		}

		const avatars = heroIds.map((heroId) => {
			const resolvedId = Number(heroId);
			if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
				return '';
			}

			const avatarUrl = this._resolveAvatarUrl(resolvedId);
			const name = this._escapeHtml(resolveHeroName(resolvedId));
			return `<img class="oj-bro-team-icon" src="${avatarUrl}" alt="${name}" title="${name}" loading="lazy" onerror="this.style.display='none'">`;
		}).join('');

		if (!avatars) {
			return '';
		}

		return `<div class="oj-bro-team-icons">${avatars}</div>`;
	}

	/**
	 * Resolve avatar URL for hero/titan/pet entity ids.
	 *
	 * @param {number} entityId - Hero/titan/pet id
	 * @returns {string} Avatar URL
	 * @private
	 */
	_resolveAvatarUrl(entityId) {
		if (entityId >= 4000 && entityId < 5000) {
			return `https://calc2.hw-assist.com/static/assets/images/titan_icons/titan_icon_${entityId}.png`;
		}

		const iconId = entityId >= 7000 ? entityId - 7000 : entityId;
		return `https://calc2.hw-assist.com/static/assets/images/hero_icons/${String(iconId).padStart(4, '0')}.png`;
	}

	/**
	 * Extract hero/titan ids from recommendation payload variants.
	 *
	 * @param {object} rec - Recommendation row
	 * @returns {number[]} Ordered unique ids
	 * @private
	 */
	_extractRecommendationHeroIds(rec) {
		const seen = new Set();
		const ids = [];

		const pushId = (raw) => {
			const id = Number(raw);
			if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
				return;
			}
			seen.add(id);
			ids.push(id);
		};

		const idLists = [
			rec?.heroIds,
			rec?.HeroIds,
			rec?.teamHeroIds,
			rec?.TeamHeroIds,
			rec?.recommendedHeroIds,
			rec?.RecommendedHeroIds,
			rec?.teamIds,
			rec?.TeamIds,
		];

		for (const list of idLists) {
			if (!Array.isArray(list)) continue;
			for (const entry of list) {
				pushId(entry);
			}
		}

		const heroRows = [rec?.heroes, rec?.Heroes, rec?.team, rec?.Team];
		for (const list of heroRows) {
			if (!Array.isArray(list)) continue;
			for (const row of list) {
				if (typeof row === 'number' || typeof row === 'string') {
					pushId(row);
					continue;
				}

				if (row && typeof row === 'object') {
					pushId(row.heroId || row.id || row.entityId);
				}
			}
		}

		if (ids.length > 0) {
			return ids;
		}

		const preview = String(rec?.teamPreview || rec?.TeamPreview || rec?.team || '');
		if (!preview) {
			return ids;
		}

		const tokens = preview
			.split(/[,|]/)
			.map((token) => token.trim())
			.filter(Boolean);

		for (const token of tokens) {
			const normalized = normalizeEntityNameToken(token);
			if (!normalized) continue;
			const mappedId = HERO_NAME_TO_ID[normalized];
			if (mappedId) {
				pushId(mappedId);
			}
		}

		return ids;
	}

	/**
	 * Render Grand Arena segmented recommendation rows.
	 *
	 * @param {Array<object>} segments - Segment list
	 * @returns {string} HTML
	 * @private
	 */
	_renderSegmentedRows(segments, defaultSourceType = '') {
		return segments.map((segment) => {
			const power = Number(segment?.opponentPower || 0).toLocaleString();
			const title = `Team ${Number(segment?.slot || 0)} • target ${power}`;
			const cards = Array.isArray(segment?.recommendations) ? segment.recommendations : [];
			const rows = cards.length > 0
				? this._renderCardRows(cards.map((rec) => ({
					...rec,
					sourceType: rec?.sourceType || segment?.sourceType || defaultSourceType,
				})))
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
		const candidate = Number(
			rec?.weightedWinRate
			?? rec?.estimatedWinProbability
			?? rec?.simulatedWinProbability
			?? rec?.winRate
			?? rec?.WinRate
			?? 0
		);
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
		const interval = Number(rec?.simulationConfidenceHigh ?? 0) - Number(rec?.simulationConfidenceLow ?? 0);
		const candidate = Number(rec?.confidence ?? rec?.confidenceScore ?? (interval > 0 ? interval : 0));
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
		const candidate = Number(
			rec?.score
			?? rec?.finalScore
			?? rec?.weightedWinRate
			?? rec?.estimatedWinProbability
			?? rec?.simulatedWinProbability
			?? 0
		);
		return `${(Math.max(0, Math.min(1, candidate)) * 100).toFixed(1)}%`;
	}

	/**
	 * Resolve simulation win rate string when simulator fields are present.
	 *
	 * @param {object} rec - Recommendation row
	 * @returns {string} Percent string or empty
	 * @private
	 */
	_resolveSimulationWinRate(rec) {
		const candidate = Number(rec?.simulatedWinProbability);
		if (!Number.isFinite(candidate)) {
			return '';
		}
		return `${(Math.max(0, Math.min(1, candidate)) * 100).toFixed(1)}%`;
	}

	/**
	 * Resolve simulation confidence interval string when present.
	 *
	 * @param {object} rec - Recommendation row
	 * @returns {string} Interval string or n/a
	 * @private
	 */
	_resolveSimulationInterval(rec) {
		const low = Number(rec?.simulationConfidenceLow);
		const high = Number(rec?.simulationConfidenceHigh);
		if (!Number.isFinite(low) || !Number.isFinite(high)) {
			return 'n/a';
		}
		const lower = `${(Math.max(0, Math.min(1, low)) * 100).toFixed(1)}%`;
		const upper = `${(Math.max(0, Math.min(1, high)) * 100).toFixed(1)}%`;
		return `${lower}-${upper}`;
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
			case 'adventure': return 'Adventure';
			case 'dungeon': return 'Dungeon';
			case 'toe': return 'Tournament of Elements';
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
