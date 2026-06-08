/**
 * UIManager Module
 * Manages the browser overlay panel for OrganizedJihad tracker.
 *
 * Receives two storage backends:
 *   - prefStorage (StorageManager): synchronous localStorage for simple prefs
 *   - idbStorage  (IndexedDBStorage): async IndexedDB for game data queries
 *
 * All render methods are async-safe with try/catch + fallback empty states.
 */

import HeroCompletionCalculator from './helpers/HeroCompletionCalculator.js';
import HeroMaterialRequirementsCalculator from './helpers/HeroMaterialRequirementsCalculator.js';
import ProjectedItemCatalogResolver from './helpers/ProjectedItemCatalogResolver.js';
import TitanCompletionCalculator from './helpers/TitanCompletionCalculator.js';
import PetCompletionCalculator from './helpers/PetCompletionCalculator.js';
import { activityColorClass, activityIcon } from './helpers/activityPresentationHelpers.js';
import { colorRankClass, colorRankName, formatCompact } from './helpers/battlePresentationHelpers.js';
import {
	aggregateDailySummaryStats,
	buildBattleRecommendationRows,
	buildExternalToolsSectionModel,
	buildSuggestionsRows,
	buildWinRateCards,
} from './helpers/dashboardInsightsBuilders.js';
import { getCachedApiPayload } from './helpers/cachedApiPayloadHelper.js';
import { DEFAULT_API_BASE_URL, buildConfiguredApiUrl, getConfiguredApiBaseUrl, normalizeApiBaseUrl } from './helpers/apiConfig.js';
import { getApiServerCallLog, isLocalApiServerUrl, onApiServerCall } from './helpers/apiServerCallLog.js';
import { sortData, sortIndicator } from './helpers/dataBrowserSortHelpers.js';
import { stalenessTag, timeAgo } from './helpers/stalenessHelpers.js';
import { bindDataBrowserViewInteractions } from './binders/dataBrowserViewOrchestrationBinder.js';
import { bindDashboardFilters } from './binders/dashboardFiltersBinder.js';
import { bindOverlayChromeControls } from './binders/overlayChromeControlsBinder.js';
import { bindOverlayEscapeKey } from './binders/overlayEscapeKeyBinder.js';
import { bindOverlayDraggable, bindOverlayResizable } from './binders/overlayPointerInteractionsBinder.js';
import { bindSettingsHealthActions } from './binders/settingsHealthActionsBinder.js';
import { bindSettingsDataActions } from './binders/settingsDataActionsBinder.js';
import { bindSettingsDisplayTracking } from './binders/settingsDisplayTrackingBinder.js';
import { bindSettingsNotifications } from './binders/settingsNotificationBinder.js';
import { renderHeroRequirementsProjectionPanel } from './renderers/heroRequirementsProjectionRenderer.js';
import { renderBattleTeam } from './renderers/battleTeamRenderer.js';
import { renderPagination, renderSearchBar } from './renderers/dataBrowserSharedRenderer.js';
import { renderAdventureGuide } from './renderers/adventureGuideRenderer.js';
import { renderActivityEventsFeed, renderActivityFallback } from './renderers/activityFeedRenderer.js';
import {
	renderBattleRecommendationsSection,
	renderDailySummarySection,
	renderSuggestionsSection,
	renderWinRateCardsSection,
} from './renderers/dashboardInsightsRenderer.js';
import { renderExternalToolsSection } from './renderers/externalToolsSectionRenderer.js';
import { renderDashboardPlayerHeaderSection } from './renderers/dashboardPlayerHeaderRenderer.js';
import { renderTeamRecommendationEngineSection } from './renderers/teamRecommendationSectionRenderer.js';
import { renderTeamRecommendationRows } from './renderers/teamRecommendationRowsRenderer.js';
import {
	renderDashboardQuickTipsSection,
	renderDashboardStatusSection,
	renderDashboardTrackedDataSection,
} from './renderers/dashboardLowerSectionsRenderer.js';
import {
	buildInstallHealthCheckModel,
	renderInstallHealthDiagnosticsOutput,
} from './renderers/installHealthDiagnosticsRenderer.js';
import { TRACKING_CATEGORIES } from './gameTracker.js';
import { decompressHeroStore, decompressTitanStore } from './heroCompression.js';
import { resolveHeroName } from './heroNames.js';
import { NOTIFICATION_TYPES } from './notificationManager.js';

// eslint-disable-next-line no-undef
const PAGE_WINDOW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

// ─── Fetch & Display Limits ──────────────────────────────────────────
// Named constants for IndexedDB getAll() limits and display caps (#128).

/** @const {number} Default limit for large collections (heroes, battles, titans, upgrades, chests, inventory) */
const FETCH_LIMIT_LARGE = 5000;

/** @const {number} Limit for consumable reward drops (much higher due to many drops per chest) */
const FETCH_LIMIT_DROPS = 50000;

/** @const {number} Limit for medium collections (pets, mail rewards) */
const FETCH_LIMIT_MEDIUM = 500;

/** @const {number} Limit for activity events fetched from IDB */
const FETCH_LIMIT_ACTIVITY = 200;

/** @const {number} Limit for resource transactions fetched from IDB */
const FETCH_LIMIT_TRANSACTIONS = 100;

/** @const {number} Limit for API log entries */
const FETCH_LIMIT_API_LOGS = 50;

/** @const {string} Local API path for battle recommendations */
const BATTLE_RECOMMENDATIONS_PATH = '/api/sync/battles/recommendations';

/** @const {string} Local API path for mode-aware team recommendation engine */
const TEAM_RECOMMENDATIONS_PATH = '/api/sync/teams/recommendations';
/** @const {string} Local API path for arena integrated recommendation + simulation */
const TEAM_RECOMMENDATION_ARENA_SIMULATION_PATH = '/api/sync/teams/recommendations/arena/simulate';

/** @const {string} Local API path for team recommendation profile metadata */
const TEAM_RECOMMENDATION_PROFILES_PATH = '/api/sync/teams/recommendations/profiles';

/** @const {string} Local API path for team recommendation backtest calibration */
const TEAM_RECOMMENDATION_BACKTEST_PATH = '/api/sync/teams/recommendations/backtest';

/** @const {string} Local API path for persisted team recommendation calibration metadata */
const TEAM_RECOMMENDATION_CALIBRATION_PATH = '/api/sync/teams/recommendations/calibration';
/** @const {string} Local API path for persisted team recommendation trend preferences */
const TEAM_RECOMMENDATION_PREFERENCES_PATH = '/api/sync/teams/recommendations/preferences';
/** @const {string} Local API path for compact recommendation operations summary */
const TEAM_RECOMMENDATION_OPERATIONS_SUMMARY_PATH = '/api/sync/teams/recommendations/operations-summary';
/** @const {string} Local API path for quick install health checks */
const SYNC_HEALTH_PATH = '/api/sync/health';
/** @const {string} Local API path for quick setup diagnostics */
const SYNC_DOCS_PATH = '/api/sync';
/** @const {string} Local API path for UI runtime settings endpoint */
const UI_SETTINGS_PATH = '/ui/settings';
/** @const {string} Local API path for UI repair status endpoint */
const UI_REPAIR_STATUS_PATH = '/ui/repair-status';
/** @const {string} Local API path for userscript handshake diagnostics */
const UI_HANDSHAKE_PATH = '/ui/userscript-handshake';
/** @const {string} Local API path for Swagger UI */
const SWAGGER_UI_PATH = '/swagger';
/** @const {string} Local API path for OpenAPI JSON */
const OPENAPI_JSON_PATH = '/swagger/v1/swagger.json';
/** @const {string} Local API path for latest server log snapshot */
const UI_LOGS_LATEST_PATH = '/ui/logs/latest';

/** @const {string} Local API path for curated external tools catalog */
const TOOLS_CATALOG_PATH = '/api/sync/tools/catalog';

/** @const {string} Local API path for external tools catalog filter metadata */
const TOOLS_CATALOG_FILTERS_PATH = '/api/sync/tools/catalog/filters';

/** @const {number} Recommendation cache TTL in ms */
const RECOMMENDATIONS_CACHE_TTL_MS = 5 * 60 * 1000;

/** @const {number} External tools catalog cache TTL in ms */
const TOOLS_CATALOG_CACHE_TTL_MS = 30 * 60 * 1000;

/** @const {number} Max activity events to render in the feed */
const DISPLAY_LIMIT_ACTIVITY = 100;

/** @const {Array<{code: string, short: string, label: string}>} Supported UI language options */
const UI_LANGUAGE_OPTIONS = [
	{ code: 'en', short: 'EN', label: 'English' },
	{ code: 'ru', short: 'RU', label: 'Russian' },
	{ code: 'de', short: 'DE', label: 'German' },
	{ code: 'fr', short: 'FR', label: 'French' },
	{ code: 'es', short: 'ES', label: 'Spanish' },
	{ code: 'it', short: 'IT', label: 'Italian' },
	{ code: 'pt', short: 'PT', label: 'Portuguese' },
	{ code: 'tr', short: 'TR', label: 'Turkish' },
];

class UIManager {
	/**
	 * @param {import('./storageManager.js').default} prefStorage - Synchronous localStorage wrapper
	 * @param {import('./indexedDBStorage.js').default} idbStorage - Async IndexedDB wrapper
	 * @param {import('./gameTracker.js').default} gameTracker - Game data tracker
	 * @param {import('./goalsManager.js').default} goalsManager - Goals management
	 * @param {import('./calendarManager.js').default} calendarManager - Calendar management
	 * @param {import('./suggestionsEngine.js').default} suggestionsEngine - Suggestions engine
	 * @param {import('./syncClient.js').default|null} [syncClient=null] - Optional sync client for manual sync actions
	 */
	constructor(prefStorage, idbStorage, gameTracker, goalsManager, calendarManager, suggestionsEngine, syncClient = null) {
		this.prefStorage = prefStorage;
		this.idbStorage = idbStorage;
		this.gameTracker = gameTracker;
		this.goalsManager = goalsManager;
		this.calendarManager = calendarManager;
		this.suggestionsEngine = suggestionsEngine;
		this.syncClient = syncClient;

		this.isVisible = this.prefStorage.get('uiVisible', false);
		this.currentView = this.prefStorage.get('defaultTab', 'dashboard');
		this.overlay = null;
		this._uiLanguage = this._normalizeUiLanguage(this.prefStorage.get('uiLanguage', 'en'));
		/** @type {'unknown'|'online'|'degraded'|'offline'} */
		this._connectionNavStatus = 'unknown';

		// Saved position/size from last session (null = use CSS default)
		this._savedPos = this.prefStorage.get('overlayPosition', null);
		this._savedSize = this.prefStorage.get('overlaySize', null);
		this._isMinimized = this.prefStorage.get('overlayMinimized', false);

		// ── Pagination / sort / filter state for data-browser views ──
		/** @type {number} Default page size for paginated tables */
		this.PAGE_SIZE = 25;

		/**
		 * Per-view state: { page, sortField, sortDir, filter, subTab }
		 * @type {Record<string, object>}
		 */
		this._viewState = {
			heroes:    { page: 0, sortField: 'power', sortDir: 'desc', filter: '', projectionTopItemsPage: 0, projectionTopItemsPageSize: 25 },
			titans:    { page: 0, sortField: 'power', sortDir: 'desc', filter: '' },
			pets:      { page: 0, sortField: 'power', sortDir: 'desc', filter: '' },
			upgrades:  { page: 0, sortField: 'timestamp', sortDir: 'desc', filter: '', subTab: 'all' },
			battles:   { page: 0, sortField: 'timestamp', sortDir: 'desc', filter: '', subTab: 'all' },
			chests:    { page: 0, sortField: 'timestamp', sortDir: 'desc', filter: '' },
			inventory: { page: 0, sortField: 'name', sortDir: 'asc', filter: '' },
			mail:      { page: 0, sortField: 'receivedAt', sortDir: 'desc', filter: '' },
		};

		/**
		 * Monotonically increasing counter — incremented at the start of
		 * each `renderView()` call. If a prior async render is still in
		 * flight when a newer one starts, the stale render detects the
		 * mismatch and silently discards itself. (#134)
		 * @type {number}
		 */
		this._renderGeneration = 0;

		/**
		 * Tracked document-level event listeners for cleanup in `destroy()`.
		 * Each entry is `{ event, handler }` to pass to `removeEventListener`.
		 * @type {Array<{ event: string, handler: Function }>}
		 */
		this._docListeners = [];

		/**
		 * Cached completion averages to avoid recalculating on every
		 * dashboard render.  Each entry has `{ value, ts }`.  Invalidates
		 * after _completionCacheTTL ms (default 60 s).
		 * @type {{ hero?: {value:number,ts:number}, titan?: {value:number,ts:number}, pet?: {value:number,ts:number} }}
		 */
		this._completionCache = {};
		/** @type {number} Cache TTL in ms for completion averages */
		this._completionCacheTTL = 60_000;

		/** @type {Record<string, string>} Cached runtime item-name map for inventory display */
		this._runtimeItemNameCatalog = {};
		/** @type {number} Last refresh timestamp for runtime item-name catalog */
		this._runtimeItemNameCatalogTs = 0;
		/** @type {number} Cache TTL in ms for runtime item-name catalog */
		this._runtimeItemNameCatalogTtl = 5 * 60_000;

		/** @type {{generatedAt: string, unresolvedCount: number, unresolved: Array<object>}} Latest inventory name diagnostics */
		this._lastInventoryNameDiagnostics = { generatedAt: '', unresolvedCount: 0, unresolved: [] };
		/** @type {(() => void)|null} */
		this._unsubscribeApiServerCalls = null;
	}

	/**
	 * Initialize the overlay: create DOM, attach events, restore state.
	 * Subscribes to live activity events from GameTracker.
	 */
	init() {
		this.createOverlay();
		this.attachEventListeners();

		// Keep Connection tab live as local API server calls happen.
		this._unsubscribeApiServerCalls = onApiServerCall(() => {
			if (this.isVisible && this.currentView === 'connection') {
				this.renderView('connection');
			}
		});

		if (this.isVisible) {
			this.show();
		}

		// Keyboard shortcut: Ctrl+Shift+O (or Ctrl+Shift+H) (#48)
		this._addDocListener('keydown', (e) => {
			if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'O')) {
				e.preventDefault();
				this.toggle();
			}
		});

		// Heroes projection paging shortcuts (#199)
		// Alt+Left or Alt+[ => previous page; Alt+Right or Alt+] => next page
		this._addDocListener('keydown', (e) => {
			if (!this.isVisible || this.currentView !== 'heroes') return;
			const target = /** @type {HTMLElement|null} */ (e.target instanceof HTMLElement ? e.target : null);
			if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
				return;
			}

			const isPrev = e.altKey && (e.key === 'ArrowLeft' || e.key === '[');
			const isNext = e.altKey && (e.key === 'ArrowRight' || e.key === ']');
			if (!isPrev && !isNext) return;

			const heroesState = this._viewState.heroes || {};
			const currentPage = Number(heroesState.projectionTopItemsPage || 0);
			const nextPage = Math.max(0, currentPage + (isNext ? 1 : -1));
			if (nextPage === currentPage) return;

			e.preventDefault();
			heroesState.projectionTopItemsPage = nextPage;
			this.renderView('heroes');
		});

		// Subscribe to live activity events for real-time feed updates.
		// When the Activity tab is visible, re-render it on each new event.
		if (this.gameTracker && typeof this.gameTracker.on === 'function') {
			// Debounce activity/apiLog renders to 500ms to avoid rapid
			// re-renders during API bursts (a single response can fire
			// 5-15+ handler calls, each emitting 'activity').
			let activityTimer = null;
			this.gameTracker.on('activity', () => {
				if (this.isVisible && this.currentView === 'activity') {
					if (activityTimer) clearTimeout(activityTimer);
					activityTimer = setTimeout(() => {
						activityTimer = null;
						this.renderView('activity');
					}, 500);
				}
			});
			// Auto-refresh API Log tab when new calls arrive (debounced)
			let apiLogTimer = null;
			this.gameTracker.on('apiLog', () => {
				if (this.isVisible && this.currentView === 'apilog') {
					if (apiLogTimer) clearTimeout(apiLogTimer);
					apiLogTimer = setTimeout(() => {
						apiLogTimer = null;
						this.renderView(this.currentView);
					}, 500);
				}
			});
			// Auto-refresh any data tab when new data arrives (#90)
			// Debounced to 2s to avoid rapid re-renders during API bursts
			let dataUpdateTimer = null;
			this.gameTracker.on('dataUpdate', () => {
				if (!this.isVisible) return;
				// Skip tabs that already have their own live refresh
				if (this.currentView === 'activity' || this.currentView === 'apilog') return;
				if (dataUpdateTimer) clearTimeout(dataUpdateTimer);
				dataUpdateTimer = setTimeout(() => {
					dataUpdateTimer = null;
					this.renderView(this.currentView);
				}, 2000);
			});
		}
	}

	// =====================================================================
	// DOM Creation
	// =====================================================================

	/**
	 * Build the overlay container and inject it into the page.
	 */
	createOverlay() {
		const headerLanguageMenuItems = this._renderLanguageMenuMarkup(this._uiLanguage);

		this.overlay = document.createElement('div');
		this.overlay.id = 'organizedJihad-overlay';
		this.overlay.className = 'oj-overlay';

		// ARIA attributes for accessibility (role=dialog, aria-label)
		this.overlay.setAttribute('role', 'dialog');
		this.overlay.setAttribute('aria-label', 'OrganizedJihad Game Tracker');
		this.overlay.setAttribute('aria-modal', 'false');

		this.overlay.innerHTML = `
			<div class="oj-container">
				<div class="oj-header">
					<h2 class="oj-title">⚔️ OrganizedJihad</h2>
					<div class="oj-header-actions">
						<div class="oj-lang-menu-wrap" title="UI language">
							<button class="oj-btn oj-lang-menu-toggle" id="oj-lang-menu-toggle" aria-label="UI language" aria-haspopup="true" aria-expanded="false"></button>
							<div class="oj-lang-menu" id="oj-lang-menu" role="menu" aria-label="Select language">
								${headerLanguageMenuItems}
							</div>
						</div>
						<button class="oj-btn oj-btn-icon" id="oj-reset-pos" title="Reset Position">↺</button>
						<button class="oj-btn oj-btn-icon" id="oj-minimize" title="Minimize">−</button>
						<button class="oj-btn oj-btn-icon" id="oj-close" title="Close">×</button>
					</div>
				</div>

				<div class="oj-nav">
					<button class="oj-nav-btn active" data-view="dashboard">Dashboard</button>
					<button class="oj-nav-btn" data-view="activity">Activity</button>
					<button class="oj-nav-btn" data-view="heroes">Heroes</button>
					<button class="oj-nav-btn" data-view="titans">Titans</button>
					<button class="oj-nav-btn" data-view="pets">Pets</button>
					<button class="oj-nav-btn" data-view="upgrades">Upgrades</button>
					<button class="oj-nav-btn" data-view="battles">Battles</button>
					<button class="oj-nav-btn" data-view="chests">Chests</button>
					<button class="oj-nav-btn" data-view="inventory">Inventory</button>
					<button class="oj-nav-btn" data-view="mail">Mail</button>
					<button class="oj-nav-btn" data-view="apilog">API Log</button>
					<button class="oj-nav-btn" data-view="connection">Connection</button>
					<button class="oj-nav-btn" data-view="resources">Resources</button>
					<button class="oj-nav-btn" data-view="settings">Settings</button>
				</div>

				<div class="oj-content" id="oj-content">
					<div class="oj-loading">Loading...</div>
				</div>

				<div class="oj-resize-handle" id="oj-resize-handle" title="Drag to resize"></div>
			</div>
		`;

		document.body.appendChild(this.overlay);
		this._updateLanguageHeaderControl();
		this._updateNavButtonLabels();

		// Restore saved position if any, clamped to current viewport (#49)
		if (this._savedPos) {
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const minVisible = 40;
			const w = this.overlay.offsetWidth;

			const x = Math.max(-w + minVisible, Math.min(this._savedPos.x, vw - minVisible));
			const y = Math.max(0, Math.min(this._savedPos.y, vh - minVisible));

			this.overlay.style.left = x + 'px';
			this.overlay.style.top = y + 'px';
			this.overlay.style.right = 'auto';
		}

		// Restore saved size if any
		if (this._savedSize) {
			this.overlay.style.width = this._savedSize.w + 'px';
			this.overlay.style.height = this._savedSize.h + 'px';
		}

		// Restore minimized state
		if (this._isMinimized) {
			this.overlay.classList.add('minimized');
			const btn = this.overlay.querySelector('#oj-minimize');
			if (btn) {
				btn.textContent = '+';
				btn.title = 'Expand';
			}
		}

		// Render initial view
		this.renderView('dashboard');
	}

	// =====================================================================
	// Event Listeners
	// =====================================================================

	/**
	 * Wire up all button / interaction handlers.
	 */
	attachEventListeners() {
		bindOverlayChromeControls({
			overlay: this.overlay,
			switchView: (view) => this.switchView(view),
			hide: () => this.hide(),
			prefStorage: this.prefStorage,
			setMinimized: (isMinimized) => {
				this._isMinimized = isMinimized;
			},
			resetPositionAndSizeState: () => {
				this._savedPos = null;
				this._savedSize = null;
			},
		});

		bindOverlayEscapeKey({
			addDocListener: (eventName, handler) => this._addDocListener(eventName, handler),
			isVisible: () => this.isVisible,
			hide: () => this.hide(),
		});

		// Draggable header
		this.makeDraggable();

		// Resizable via bottom-right handle
		this.makeResizable();

		const langToggle = this.overlay.querySelector('#oj-lang-menu-toggle');
		const langMenu = this.overlay.querySelector('#oj-lang-menu');
		const closeLanguageMenu = () => {
			langMenu?.classList.remove('open');
			if (langToggle) langToggle.setAttribute('aria-expanded', 'false');
		};

		langToggle?.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			const willOpen = !langMenu?.classList.contains('open');
			if (willOpen) {
				langMenu?.classList.add('open');
				langToggle?.setAttribute('aria-expanded', 'true');
			} else {
				closeLanguageMenu();
			}
		});

		langMenu?.addEventListener('click', (event) => {
			const target = event.target instanceof HTMLElement
				? event.target.closest('[data-lang-code]')
				: null;
			if (!target) return;

			event.preventDefault();
			event.stopPropagation();
			const code = String(target?.dataset?.langCode || 'en');
			this._setUiLanguage(code);
			closeLanguageMenu();
		});

		this._addDocListener('click', (event) => {
			const target = event.target instanceof HTMLElement ? event.target : null;
			if (!target) return;
			if (target.closest('.oj-lang-menu-wrap')) return;
			closeLanguageMenu();
		});
	}

	/**
	 * Make the overlay draggable by its header bar.
	 * Clears CSS "right" on first drag so "left" takes effect.
	 * Clamps position to viewport boundaries so the panel can't be
	 * dragged off-screen (#49).
	 */
	makeDraggable() {
		bindOverlayDraggable({
			overlay: this.overlay,
			prefStorage: this.prefStorage,
			addDocListener: (eventName, handler) => this._addDocListener(eventName, handler),
			setSavedPos: (savedPos) => {
				this._savedPos = savedPos;
			},
		});
	}

	/**
	 * Make the overlay resizable via a bottom-right drag handle.
	 * Enforces minimum size of 400×300, maximum constrained by viewport,
	 * and persists size in localStorage. (#49 — viewport clamping)
	 */
	makeResizable() {
		bindOverlayResizable({
			overlay: this.overlay,
			prefStorage: this.prefStorage,
			addDocListener: (eventName, handler) => this._addDocListener(eventName, handler),
			setSavedSize: (savedSize) => {
				this._savedSize = savedSize;
			},
		});
	}

	// =====================================================================
	// View Switching
	// =====================================================================

	/**
	 * Switch to a different tab view.
	 * @param {string} view - The view name to render
	 */
	switchView(view) {
		this.currentView = view;

		// Update active nav button
		this.overlay.querySelectorAll('.oj-nav-btn').forEach((btn) => {
			btn.classList.toggle('active', btn.dataset.view === view);
		});

		this.renderView(view);
	}

	/**
	 * Build navigation label with icon for each view.
	 *
	 * @param {string} view - View key
	 * @returns {string} Tab label
	 * @private
	 */
	_getNavLabel(view) {
		const connectionIcon = this._connectionNavStatus === 'online'
			? '🟢'
			: this._connectionNavStatus === 'degraded'
				? '🟡'
				: this._connectionNavStatus === 'offline'
					? '🔴'
					: '⚪';

		const labelsEn = {
			dashboard: '📊 Dashboard',
			activity: '⚡ Activity',
			heroes: '🛡️ Heroes',
			titans: '🗿 Titans',
			pets: '🐾 Pets',
			upgrades: '📈 Upgrades',
			battles: '⚔️ Battles',
			chests: '🎁 Chests',
			inventory: '🎒 Inventory',
			mail: '✉️ Mail',
			apilog: '📡 API Log',
			connection: `${connectionIcon} Connection`,
			resources: '💰 Resources',
			settings: '⚙️ Settings',
		};

		const labelsRu = {
			dashboard: '📊 Панель',
			activity: '⚡ Активность',
			heroes: '🛡️ Герои',
			titans: '🗿 Титаны',
			pets: '🐾 Питомцы',
			upgrades: '📈 Улучшения',
			battles: '⚔️ Битвы',
			chests: '🎁 Сундуки',
			inventory: '🎒 Инвентарь',
			mail: '✉️ Почта',
			apilog: '📡 API Лог',
			connection: `${connectionIcon} Связь`,
			resources: '💰 Ресурсы',
			settings: '⚙️ Настройки',
		};

		const labels = this._uiLanguage === 'ru' ? labelsRu : labelsEn;

		return labels[view] || view;
	}

	/**
	 * Refresh nav button labels/icons to reflect current status state.
	 *
	 * @private
	 */
	_updateNavButtonLabels() {
		if (!this.overlay) return;
		this.overlay.querySelectorAll('.oj-nav-btn').forEach((button) => {
			const view = button?.dataset?.view || '';
			button.textContent = this._getNavLabel(view);
		});
		this._updateLanguageHeaderControl();
	}

	/**
	 * Render language option markup for header/settings selectors.
	 *
	 * @param {string} selectedLanguage - Selected language code
	 * @param {boolean} compact - Whether to render compact (icon+abbr) labels
	 * @returns {string} Option markup
	 * @private
	 */
	_renderLanguageOptionMarkup(selectedLanguage, compact = false) {
		return UI_LANGUAGE_OPTIONS.map((entry) => {
			const selected = entry.code === selectedLanguage ? 'selected' : '';
			const text = compact ? `🌐 ${entry.short}` : `${entry.label} (${entry.short})`;
			return `<option value="${entry.code}" ${selected}>${text}</option>`;
		}).join('');
	}

	/**
	 * Render language menu buttons for the header popout menu.
	 *
	 * @param {string} selectedLanguage - Selected language code
	 * @returns {string} Button markup
	 * @private
	 */
	_renderLanguageMenuMarkup(selectedLanguage) {
		return UI_LANGUAGE_OPTIONS.map((entry) => {
			const activeClass = entry.code === selectedLanguage ? ' oj-lang-menu-item-active' : '';
			return `<button class="oj-lang-menu-item${activeClass}" data-lang-code="${entry.code}" role="menuitem" type="button">` +
				`<span class="oj-lang-menu-item-code">${entry.short}</span>` +
				`<span class="oj-lang-menu-item-label">${this._escapeHtml(entry.label)}</span>` +
			`</button>`;
		}).join('');
	}

	/**
	 * Normalize requested UI language code.
	 *
	 * @param {string} value - Raw language code
	 * @returns {'en'|'ru'} Normalized language code
	 * @private
	 */
	_normalizeUiLanguage(value) {
		const code = String(value || '').trim().toLowerCase();
		return UI_LANGUAGE_OPTIONS.some((entry) => entry.code === code) ? code : 'en';
	}

	/**
	 * Persist and apply UI language across overlay controls.
	 *
	 * @param {'en'|'ru'|string} language - Target language
	 * @private
	 */
	_setUiLanguage(language) {
		const normalized = this._normalizeUiLanguage(language);
		if (this._uiLanguage === normalized) return;

		this._uiLanguage = normalized;
		this.prefStorage.set('uiLanguage', normalized);
		this._runtimeItemNameCatalogTs = 0;
		this._updateLanguageHeaderControl();
		this._updateNavButtonLabels();

		if (this.isVisible) {
			this.renderView(this.currentView);
		}
	}

	/**
	 * Sync language selectors and metadata with current language.
	 *
	 * @private
	 */
	_updateLanguageHeaderControl() {
		const activeOption = UI_LANGUAGE_OPTIONS.find((entry) => entry.code === this._uiLanguage) || UI_LANGUAGE_OPTIONS[0];
		const menuToggle = this.overlay?.querySelector('#oj-lang-menu-toggle');
		const menu = this.overlay?.querySelector('#oj-lang-menu');

		if (menuToggle) {
			menuToggle.textContent = `🌐 ${activeOption.short} ▾`;
			menuToggle.title = `UI language (${activeOption.label})`;
			menuToggle.setAttribute('aria-expanded', 'false');
		}

		if (menu) {
			menu.innerHTML = this._renderLanguageMenuMarkup(this._uiLanguage);
			menu.classList.remove('open');
		}

		this.overlay?.querySelectorAll('[data-lang-code]').forEach((button) => {
			const langCode = String(button?.dataset?.langCode || '');
			button.classList.toggle('oj-lang-menu-item-active', langCode === this._uiLanguage);
		});

		const settingsSelect = this.overlay?.querySelector('#oj-ui-language');
		if (settingsSelect) {
			settingsSelect.value = this._uiLanguage;
		}
	}

	/**
	 * Update connection tab status icon color/state.
	 *
	 * @param {'unknown'|'online'|'degraded'|'offline'} status - Connection state
	 * @private
	 */
	_setConnectionNavStatus(status) {
		const next = ['unknown', 'online', 'degraded', 'offline'].includes(status) ? status : 'unknown';
		if (this._connectionNavStatus === next) return;
		this._connectionNavStatus = next;
		this._updateNavButtonLabels();
	}

	/**
	 * Render the content for a given view.
	 * All render methods are async and wrapped in try/catch.
	 *
	 * @param {string} view - The view name
	 */
	async renderView(view) {
		// Concurrency guard: discard stale async renders when the user
		// switches tabs faster than the previous render can complete (#134)
		const gen = ++this._renderGeneration;

		const content = this.overlay.querySelector('#oj-content');
		content.innerHTML = '<div class="oj-loading">Loading...</div>';

		try {
			let html;
			switch (view) {
				case 'dashboard':
					html = await this.renderDashboard();
					break;
				case 'activity':
					html = await this.renderActivity();
					break;
				case 'heroes':
					html = await this.renderHeroes();
					break;
				case 'titans':
					html = await this.renderTitans();
					break;
				case 'pets':
					html = await this.renderPets();
					break;
				case 'upgrades':
					html = await this.renderUpgrades();
					break;
				case 'battles':
					html = await this.renderBattles();
					break;
				case 'chests':
					html = await this.renderChests();
					break;
				case 'inventory':
					html = await this.renderInventory();
					break;
				case 'mail':
					html = await this.renderMail();
					break;
				case 'apilog':
					html = this.renderApiLog();
					break;
				case 'connection':
					html = await this.renderConnection();
					break;
				case 'resources':
					html = await this.renderResources();
					break;
				case 'settings':
					html = this.renderSettings();
					break;
				default:
					html = '<p class="oj-empty">Unknown view</p>';
			}

			// If another render started while we were awaiting, discard this one (#134)
			if (gen !== this._renderGeneration) return;

			content.innerHTML = html;

			// Post-render hooks (attach event listeners to the new DOM)
			switch (view) {
				case 'dashboard':
					this.attachDashboardEventListeners();
					break;
				case 'heroes':
				case 'titans':
				case 'pets':
				case 'upgrades':
				case 'battles':
				case 'chests':
				case 'inventory':
				case 'mail':
					this._attachDataBrowserListeners(view);
					break;
				case 'settings':
					this.attachSettingsEventListeners();
					break;
				case 'connection':
					this.attachConnectionEventListeners();
					break;
			}
		} catch (err) {
			console.error('[OrganizedJihad] Error rendering view:', view, err);
			content.innerHTML = `
				<div class="oj-error">
					<h3>\u26A0\uFE0F Render Error</h3>
					<p>${this._escapeHtml(err.message || 'Unknown error')}</p>
					<p class="oj-muted">Check the console for details.</p>
				</div>
			`;
		}
	}

	/**
	 * Attach dashboard-specific controls.
	 */
	attachDashboardEventListeners() {
		bindDashboardFilters({
			overlay: this.overlay,
			prefStorage: this.prefStorage,
			renderView: (view) => this.renderView(view),
			saveTrendPreference: (mode, windowDays) => this._saveTeamRecommendationTrendPreference(mode, windowDays),
		});
	}

	// =====================================================================
	// View Renderers
	// =====================================================================

	/**
	 * Dashboard — redesigned player overview with card-based layout (#63).
	 * Row 1: Player name (large, left) + Level (large, right)
	 * Row 2: Overall progress bar (heroes + titans average)
	 * Row 3: Four resource/progress cards (Gold, Emeralds, Heroes %, Titans %)
	 * Row 4: Four activity cards (Daily Quests, Guild Quests, Guild War, Guild Raid)
	 * Then: win rates, daily summary, tracked data, status, tips.
	 *
	 * @returns {Promise<string>} HTML content
	 */
	async renderDashboard() {
		// Player data from metadata (cached by trackPlayerData)
		let playerData = {};
		try {
			playerData = (await this.idbStorage.getMetadata('playerData', null)) || {};
		} catch { /* empty */ }

		// Also try the latest snapshot for richer fields
		let latestSnapshot = null;
		try {
			const snaps = await this.idbStorage.getPage('snapshots', { limit: 1, direction: 'prev' });
			if (snaps.length > 0) {
				latestSnapshot = snaps[0];
			}
		} catch { /* empty */ }

		// Merge snapshot fields into playerData for display.
		// playerData (from trackPlayerData metadata) has nested structure:
		//   { player: { id, name, level }, gold, starmoney, emeralds, clanTitle, vipLevel, power }
		// Snapshots (from IDB) have flat structure:
		//   { playerName, level, gold, starmoney, guildName, ... }
		// Prefer playerData for resources (most recent), snapshot for player details.
		const pdPlayer = playerData?.player || {};
		const player = {
			...playerData,
			...(latestSnapshot || {}),
			// Ensure resources come from the most recent source
			// API field is `starMoney` (camelCase) — stored as both starMoney and emeralds
			gold: playerData?.gold ?? latestSnapshot?.gold ?? 0,
			starMoney: playerData?.starMoney ?? playerData?.emeralds ?? latestSnapshot?.emeralds ?? 0,
			emeralds: playerData?.starMoney ?? playerData?.emeralds ?? latestSnapshot?.emeralds ?? 0,
			// Energy comes from refillable[id=1].amount — stored in playerData.stamina (#116)
			stamina: playerData?.stamina ?? latestSnapshot?.stamina ?? 0,
			bottledEnergy: playerData?.bottledEnergy ?? latestSnapshot?.bottledEnergy ?? 0,
		};
		const playerName = player.playerName || pdPlayer.name || player.name || null;
		const playerLevel = pdPlayer.level || player.level || 0;
		const playerGuild = player.guildName || player.clanTitle || playerData?.clanTitle || null;

		// ── Hero, Titan & Pet completion averages (#63, #71) ────────
		const heroAvg = await this._calcAverageHeroCompletion();
		const titanAvg = await this._calcAverageTitanCompletion();
		const petAvg = await this._calcAveragePetCompletion();
		const overallAvg = (heroAvg + titanAvg + petAvg) / 3;

		// ── Today's quest & battle counts (#63) ─────────────────────
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayISO = todayStart.toISOString();

		const dashboardMetadata = await this._loadDashboardMetadataBundle();
		const dashboardConnectionProbe = await this._probeConnectionEndpoint(SYNC_HEALTH_PATH);
		const {
			questSummary,
			gwBrief,
			cowData,
			raidBoss,
			arenaStats,
			campaignProgress,
			titanArenaStats,
			battlePassData,
			guildActivity,
			gachaData,
			towerState,
			expeditionSlots,
			outlandBosses,
			adventurePassed,
			workshopBuffs,
			cosmeticCounts,
			invasionData,
			syncStatus,
		} = dashboardMetadata;

		const dashboardConnectionResolved = (!dashboardConnectionProbe.ok && syncStatus?.ok)
			? {
				...dashboardConnectionProbe,
				ok: true,
				statusText: dashboardConnectionProbe.statusText || 'Recent sync indicates API is reachable',
				error: '',
			}
			: dashboardConnectionProbe;

		this._setConnectionNavStatus(
			dashboardConnectionResolved.ok
				? 'online'
				: (dashboardConnectionResolved.status > 0 || syncStatus?.ok ? 'degraded' : 'offline')
		);

		const dailyQuestsCompleted = questSummary.dailyCompleted || 0;
		const dailyQuestsTotal = questSummary.dailyTotal || 0;
		const guildQuestsCompleted = questSummary.guildCompleted || 0;
		const guildQuestsTotal = questSummary.guildTotal || 0;

		// tries is remaining attacks; GW gives 2 attacks Mon-Fri
		// When no active war, triesRemaining defaults to 0
		const gwAttacksMax = 2;
		const gwAttacksUsed = gwBrief.hasActiveWar ? (gwAttacksMax - (gwBrief.triesRemaining ?? 0)) : 0;

		const cowHeroUsed = cowData.heroAttacksMax ? (cowData.heroAttacksMax - (cowData.heroAttacksRemaining ?? 0)) : 0;
		const cowTitanUsed = cowData.titanAttacksMax ? (cowData.titanAttacksMax - (cowData.titanAttacksRemaining ?? 0)) : 0;

		const raidBossLevel = raidBoss.bossLevel || 0;
		const raidBossAttacksUsed = raidBoss.attemptsUsed || 0;
		const raidBossAttacksMax = raidBoss.attemptsMax || 5;
		const raidMyDamage = raidBoss.myDamage || 0;

		const {
			allBattles,
			guildWarBattlesToday,
			guildRaidMinionToday,
		} = await this._loadDashboardBattleDatasets(todayISO);


		// Gather counts from actual IndexedDB stores
		const snapshotCount = await this._countStore('snapshots');
		const heroCount = await this._countStore('heroes');
		const battleCount = await this._countStore('battles');
		const chestCount = await this._countStore('chests');
		const apiLogCount = await this._countStore('apiLogs');
		const resourceTxCount = await this._countStore('resourceTransactions');
		const questCount = await this._countStore('questCompletions');

		const goals = this._safeCall(() => this.goalsManager.getActiveGoals(), { shortTerm: [], longTerm: [] });
		const goalCount = goals.shortTerm.length + goals.longTerm.length;

		// Error count from tracker
		const errorCount = this.gameTracker?.errorCount || 0;

		// Sync status from syncClient (#130) is loaded in _loadDashboardMetadataBundle.

		// Last snapshot time
		const lastSnapshotTime = player.timestamp
			? new Date(player.timestamp).toLocaleString()
			: 'None yet';

		// ── Win Rate Statistics (#26) ─────────────────────────────────
		const winRateSection = await this._renderWinRateCards(allBattles);

		// ── Daily Summary (#26) ──────────────────────────────────────
		const dailySummary = await this._renderDailySummary(allBattles);

		// Gold / Emeralds / Energy values
		const gold = player.gold ? Number(player.gold).toLocaleString() : '0';
		const emeralds = Number(player.starMoney || player.emeralds || 0).toLocaleString();
		const energy = Number(player.stamina || 0).toLocaleString();
		const bottledEnergy = Number(player.bottledEnergy || 0).toLocaleString();

		const playerSection = renderDashboardPlayerHeaderSection({
			playerName,
			playerLevel,
			playerGuild,
			overallAvg,
			heroAvg,
			titanAvg,
			petAvg,
			gold,
			emeralds,
			energy,
			bottledEnergy,
			dailyQuestsCompleted,
			dailyQuestsTotal,
			guildQuestsCompleted,
			guildQuestsTotal,
			questSummary,
			gwBrief,
			gwAttacksUsed,
			gwAttacksMax,
			cowData,
			cowHeroUsed,
			cowTitanUsed,
			raidBoss,
			raidBossLevel,
			raidBossAttacksUsed,
			raidBossAttacksMax,
			raidMyDamage,
			arenaStats,
			titanArenaStats,
			campaignProgress,
			battlePassData,
			gachaData,
			guildActivity,
			towerState,
			expeditionSlots,
			outlandBosses,
			adventurePassed,
			workshopBuffs,
			cosmeticCounts,
			invasionData,
			escapeHtml: (value) => this._escapeHtml(value),
			stalenessTag: (value) => this._stalenessTag(value),
		});

		return `
			<div class="oj-dashboard">
				${playerSection}

				${winRateSection}

				${dailySummary}

				${renderDashboardTrackedDataSection({
					statCard: (value, label, color) => this._statCard(value, label, color),
					snapshotCount,
					heroCount,
					battleCount,
					chestCount,
					resourceTxCount,
					questCount,
					apiLogCount,
					goalCount,
				})}

				${renderDashboardStatusSection({
					isTracking: this.gameTracker?.isTracking,
					lastSnapshotTime,
					syncStatus,
					apiConnection: dashboardConnectionResolved,
					errorCount,
					version: __OJ_VERSION__,
					escapeHtml: (value) => this._escapeHtml(value),
				})}

				${await this._renderSuggestionsSection()}

				${await this._renderBattleRecommendationsSection()}

				${await this._renderTeamRecommendationEngineSection()}

				${await this._renderExternalToolsSection()}

				${renderDashboardQuickTipsSection()}
			</div>
		`;
	}

	/**
	 * Load metadata bundles consumed by renderDashboard cards.
	 *
	 * @returns {Promise<object>} Dashboard metadata bundle
	 * @private
	 */
	async _loadDashboardMetadataBundle() {
		let questSummary = {};
		try {
			questSummary = (await this.idbStorage.getMetadata('questSummary', null)) || {};
		} catch { /* empty */ }

		let gwBrief = {};
		try {
			gwBrief = (await this.idbStorage.getMetadata('guildWarBrief', null)) || {};
		} catch { /* empty */ }

		let cowData = {};
		try {
			cowData = (await this.idbStorage.getMetadata('cowData', null)) || {};
		} catch { /* empty */ }

		let raidBoss = {};
		try {
			raidBoss = (await this.idbStorage.getMetadata('currentRaidBoss', null)) || {};
		} catch { /* empty */ }

		let arenaStats = {};
		try {
			arenaStats = (await this.idbStorage.getMetadata('arenaStats', null)) || {};
		} catch { /* empty */ }

		let campaignProgress = {};
		try {
			campaignProgress = (await this.idbStorage.getMetadata('campaignProgress', null)) || {};
		} catch { /* empty */ }

		let titanArenaStats = {};
		try {
			titanArenaStats = (await this.idbStorage.getMetadata('titanArenaStats', null)) || {};
		} catch { /* empty */ }

		let battlePassData = {};
		try {
			battlePassData = (await this.idbStorage.getMetadata('battlePassData', null)) || {};
		} catch { /* empty */ }

		let guildActivity = {};
		try {
			guildActivity = (await this.idbStorage.getMetadata('guildActivityStats', null)) || {};
		} catch { /* empty */ }

		let gachaData = {};
		try {
			gachaData = (await this.idbStorage.getMetadata('gacha_heroGacha', null)) || {};
		} catch { /* empty */ }

		let towerState = {};
		try {
			towerState = (await this.idbStorage.getMetadata('towerState', null)) || {};
		} catch { /* empty */ }

		let expeditionSlots = {};
		try {
			expeditionSlots = (await this.idbStorage.getMetadata('expeditionSlots', null)) || {};
		} catch { /* empty */ }

		let outlandBosses = {};
		try {
			outlandBosses = (await this.idbStorage.getMetadata('outlandBosses', null)) || {};
		} catch { /* empty */ }

		let adventurePassed = {};
		try {
			adventurePassed = (await this.idbStorage.getMetadata('adventurePassed', null)) || {};
		} catch { /* empty */ }

		let workshopBuffs = {};
		try {
			workshopBuffs = (await this.idbStorage.getMetadata('workshopBuffs', null)) || {};
		} catch { /* empty */ }

		let cosmeticCounts = { avatars: 0, frames: 0, stickers: 0 };
		try {
			const av = (await this.idbStorage.getMetadata('avatars', null)) || {};
			const fr = (await this.idbStorage.getMetadata('avatarFrames', null)) || {};
			const st = (await this.idbStorage.getMetadata('stickers', null)) || {};
			cosmeticCounts = { avatars: av.count || 0, frames: fr.count || 0, stickers: st.count || 0 };
		} catch { /* empty */ }

		let invasionData = {};
		try {
			invasionData = (await this.idbStorage.getMetadata('invasionData', null)) || {};
		} catch { /* empty */ }

		let syncStatus = {};
		try {
			syncStatus = (await this.idbStorage.getMetadata('syncStatus', null)) || {};
		} catch { /* empty */ }

		return {
			questSummary,
			gwBrief,
			cowData,
			raidBoss,
			arenaStats,
			campaignProgress,
			titanArenaStats,
			battlePassData,
			guildActivity,
			gachaData,
			towerState,
			expeditionSlots,
			outlandBosses,
			adventurePassed,
			workshopBuffs,
			cosmeticCounts,
			invasionData,
			syncStatus,
		};
	}

	/**
	 * Load battle datasets used by dashboard cards and summaries.
	 *
	 * @param {string} todayISO - Start-of-day ISO timestamp
	 * @returns {Promise<{allBattles:Array<object>, guildWarBattlesToday:number, guildRaidMinionToday:number}>} Battle datasets
	 * @private
	 */
	async _loadDashboardBattleDatasets(todayISO) {
		const allBattles = await this.idbStorage.getAll('battles', FETCH_LIMIT_LARGE).catch(() => []);
		let guildWarBattlesToday = 0;
		let guildRaidMinionToday = 0;
		try {
			const todayBattles = await this.idbStorage.getByIndexRange('battles', 'timestamp', { lower: todayISO });
			guildWarBattlesToday = todayBattles.filter((b) => b.battleType === 'GuildWar').length;
			guildRaidMinionToday = todayBattles.filter((b) => b.battleType === 'RaidBoss').length;
		} catch { /* empty */ }

		return { allBattles, guildWarBattlesToday, guildRaidMinionToday };
	}

	/**
	 * Render win rate cards for arena, grand arena, and titan arena (#26).
	 * Shows all-time and last-7-day win percentages with visual bars.
	 *
	 * @param {Array} battles - Pre-loaded battles array from renderDashboard
	 * @returns {Promise<string>} HTML section
	 * @private
	 */
	async _renderWinRateCards(battles = []) {
		if (!battles || battles.length === 0) return '';

		const cards = buildWinRateCards(battles);

		return renderWinRateCardsSection({ cards });
	}

	/**
	 * Render a suggestions section on the dashboard using SuggestionsEngine (#76).
	 * Shows up to 6 highest-priority actionable suggestions.
	 *
	 * @returns {Promise<string>} HTML section
	 * @private
	 */
	async _renderSuggestionsSection() {
		if (!this.suggestionsEngine) return '';

		try {
			const suggestions = this.suggestionsEngine.getSuggestions();
			if (!suggestions || suggestions.length === 0) return '';

			const rows = buildSuggestionsRows(suggestions, (value) => this._escapeHtml(value));

			const stats = this.suggestionsEngine.getStats();

			return renderSuggestionsSection({
				rows,
				activeCount: Number(stats?.active || 0),
				totalCount: suggestions.length,
			});
		} catch {
			return '';
		}
	}
	/**
	 * Render battle recommendation cards sourced from API recommendations (#161).
	 * Uses metadata cache and degrades silently when API is unavailable.
	 *
	 * @returns {Promise<string>} HTML section
	 * @private
	 */
	async _renderBattleRecommendationsSection() {
		try {
			const payload = await this._getBattleRecommendationsPayload();
			const recs = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
			if (recs.length === 0) return '';

			const rows = buildBattleRecommendationRows(recs, (value) => this._escapeHtml(value));

			return renderBattleRecommendationsSection({ rows });
		} catch {
			return '';
		}
	}

	/**
	 * Resolve a metadata-backed API payload with cache-first fallback semantics.
	 *
	 * @param {object} params - Fetch params
	 * @param {string} params.cacheKey - Metadata cache key
	 * @param {number} params.ttlMs - Cache TTL in milliseconds
	 * @param {string} params.requestUrl - Request URL
	 * @param {object|null} [params.fallbackPayload=null] - Fallback payload when request and cache miss
	 * @returns {Promise<object|null>} Payload or fallback
	 * @private
	 */
	async _getCachedApiPayload(params) {
		const cacheKey = params?.cacheKey;
		const ttlMs = Number(params?.ttlMs || 0);
		const requestUrl = params?.requestUrl;
		const fallbackPayload = params?.fallbackPayload ?? null;
		if (!cacheKey || !requestUrl) return fallbackPayload;

		const now = Date.now();
		let cached = null;
		try {
			cached = await this.idbStorage.getMetadata(cacheKey, null);
			if (cached?.timestamp && (now - cached.timestamp) < ttlMs && cached?.payload) {
				return cached.payload;
			}
		} catch {
			cached = null;
		}

		try {
			const response = await fetch(requestUrl);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const payload = await response.json();
			await this.idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
			return payload;
		} catch {
			return cached?.payload || fallbackPayload;
		}
	}

	/**
	 * Get recommendations from cache/API for dashboard cards.
	 *
	 * @returns {Promise<object|null>} API payload or cached payload
	 * @private
	 */
	async _getBattleRecommendationsPayload() {
		const url = new URL(this._buildApiUrl(BATTLE_RECOMMENDATIONS_PATH));
		url.searchParams.set('battleType', 'arena');
		url.searchParams.set('limit', '3');
		url.searchParams.set('minSamples', '2');

		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey: 'battleRecommendations:arena',
			ttlMs: RECOMMENDATIONS_CACHE_TTL_MS,
			requestUrl: url.toString(),
			fallbackPayload: null,
		});
	}

	/**
	 * Render Team Recommendation Engine cards for the selected mode/objective.
	 *
	 * @returns {Promise<string>} HTML section
	 * @private
	 */
	async _renderTeamRecommendationEngineSection() {
		try {
			const selectedMode = this.prefStorage.get('teamRecommendationsMode', 'arena');
			const selectedObjective = this.prefStorage.get('teamRecommendationsObjective', 'balanced');
			const selectedTrendWindowPreference = this.prefStorage.get('teamRecommendationsTrendWindow', 'auto');
			const showOperationsSummary = this.prefStorage.get('teamRecommendationsShowOperationsSummary', true);
			const profileMetadata = await this._getTeamRecommendationProfileMetadata();
			const modeOptions = Array.isArray(profileMetadata?.modes) && profileMetadata.modes.length > 0
				? profileMetadata.modes
				: [
					{ value: 'arena', label: 'Arena', preferredTrendWindowDays: 7, supportedTrendWindowDays: [7, 30, 90] },
					{ value: 'grandarena', label: 'Grand Arena', preferredTrendWindowDays: 30, supportedTrendWindowDays: [7, 30, 90] },
					{ value: 'guildwar', label: 'Guild War', preferredTrendWindowDays: 30, supportedTrendWindowDays: [7, 30, 90] },
					{ value: 'cow', label: 'CoW', preferredTrendWindowDays: 90, supportedTrendWindowDays: [7, 30, 90] },
					{ value: 'campaign', label: 'Campaign', preferredTrendWindowDays: 30, supportedTrendWindowDays: [7, 30, 90] },
					{ value: 'adventure', label: 'Adventure', preferredTrendWindowDays: 30, supportedTrendWindowDays: [7, 30, 90] },
				];
			const modeOption = modeOptions.find((mode) => mode.value === selectedMode) || null;
			const defaultTrendWindowDays = Number(modeOption?.preferredTrendWindowDays || 30);
			const configuredTrendWindowDays = Number(selectedTrendWindowPreference);
			const trendWindowDays = selectedTrendWindowPreference === 'auto'
				? defaultTrendWindowDays
				: (Number.isFinite(configuredTrendWindowDays) ? configuredTrendWindowDays : defaultTrendWindowDays);

			const backtest = await this._getTeamRecommendationBacktestPayload(selectedMode, selectedObjective);
			const calibration = await this._getTeamRecommendationCalibrationPayload(selectedMode, trendWindowDays);
			const operationsSummary = await this._getTeamRecommendationOperationsSummaryPayload(trendWindowDays);
			const payload = selectedMode === 'arena'
				? await this._getTeamRecommendationArenaSimulationPayload(selectedObjective, trendWindowDays)
				: await this._getTeamRecommendationEnginePayload(selectedMode, selectedObjective, trendWindowDays);
			const recs = Array.isArray(payload?.recommendations) ? payload.recommendations : [];
			if (recs.length === 0) return '';

			const objectiveOptions = Array.isArray(profileMetadata?.objectives) && profileMetadata.objectives.length > 0
				? profileMetadata.objectives
				: [
					{ value: 'balanced', label: 'Balanced' },
					{ value: 'offense', label: 'Offense' },
					{ value: 'defense', label: 'Defense' },
					{ value: 'speed', label: 'Speed' },
					{ value: 'sustain', label: 'Sustain' },
				];

			const selectedProfile = Array.isArray(profileMetadata?.profiles)
				? profileMetadata.profiles.find((p) => p.mode === selectedMode && p.objective === selectedObjective)
				: null;
			const profileSummary = selectedProfile
				? `weights W:${(Number(selectedProfile.winWeight || 0) * 100).toFixed(0)} R:${(Number(selectedProfile.readinessWeight || 0) * 100).toFixed(0)} C:${(Number(selectedProfile.confidenceWeight || 0) * 100).toFixed(0)}`
				: 'profile weights unavailable';
			const calibrationSummary = backtest && typeof backtest === 'object' && (backtest.calibrationQuality || backtest.note)
				? (() => {
					const quality = this._escapeHtml(String(backtest.calibrationQuality || 'no-data'));
					const mae = Number(backtest.meanAbsoluteError || 0);
					const matchedSamples = Number(backtest.matchedBattleSamples || 0);
					const matchedTeams = Number(backtest.matchedTeamCount || 0);
					const evaluatedTeams = Number(backtest.evaluatedTeamCount || 0);
					const note = typeof backtest.note === 'string' && backtest.note.trim()
						? ` • ${this._escapeHtml(backtest.note)}`
						: '';
					const trends = Array.isArray(calibration?.trendWindows) ? calibration.trendWindows : [];
					const preferredWindowDays = Number(calibration?.preferredTrendWindowDays || trendWindowDays || 30);
					const preferredTrend = trends.find((t) => Number(t?.windowDays) === preferredWindowDays) || null;
					const trendScale = Number(preferredTrend?.suggestedFrictionScale);
					const trendSamples = Number(preferredTrend?.samples || 0);
					const fallbackScale = Number(calibration?.suggestedFrictionScale || 1);
					const resolvedScale = Number.isFinite(trendScale) && trendScale > 0 ? trendScale : fallbackScale;
					const scaleText = Number.isFinite(resolvedScale)
						? ` • frictionScale${preferredWindowDays}d ${resolvedScale.toFixed(2)}${trendSamples > 0 ? ` (${trendSamples} obs)` : ''}`
						: '';
					return `calibration ${quality} • MAE ${(mae * 100).toFixed(1)}% • matches ${matchedSamples} samples / ${matchedTeams}/${evaluatedTeams} teams${scaleText}${note}`;
				})()
				: 'calibration unavailable';
			const trendWindowOptions = Array.isArray(modeOption?.supportedTrendWindowDays) && modeOption.supportedTrendWindowDays.length > 0
				? modeOption.supportedTrendWindowDays
				: [7, 30, 90];
			const operationsSummaryHtml = showOperationsSummary
				? this._renderTeamRecommendationOperationsSummary(selectedMode, operationsSummary)
				: '';
			const recommendationMetaHtml = this._renderTeamRecommendationMeta(selectedMode, payload);

			const rows = renderTeamRecommendationRows({
				recommendations: recs,
				escapeHtml: (value) => this._escapeHtml(value),
			});

			return renderTeamRecommendationEngineSection({
				profileSummary,
				calibrationSummary,
				modeOptions,
				objectiveOptions,
				trendWindowOptions,
				selectedMode,
				selectedObjective,
				selectedTrendWindowPreference,
				defaultTrendWindowDays,
				showOperationsSummary,
				operationsSummaryHtml,
				recommendationMetaHtml,
				rowsHtml: rows,
				escapeHtml: (value) => this._escapeHtml(value),
			});
		} catch {
			return '';
		}
	}

	/**
	 * Save Team Recommendation trend window preference for a mode.
	 *
	 * @param {string} mode - Gameplay mode
	 * @param {number} trendWindowDays - Preferred trend window in days
	 * @returns {Promise<void>}
	 * @private
	 */
	async _saveTeamRecommendationTrendPreference(mode, trendWindowDays) {
		const normalizedMode = typeof mode === 'string' && mode.trim() ? mode.trim() : 'arena';
		const resolvedWindowDays = Number(trendWindowDays || 30);
		if (![7, 30, 90].includes(resolvedWindowDays)) {
			return;
		}

		try {
			const response = await fetch(this._buildApiUrl(TEAM_RECOMMENDATION_PREFERENCES_PATH), {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: normalizedMode,
					preferredTrendWindowDays: resolvedWindowDays,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			// Refresh profile metadata cache so Auto mode reflects persisted preferences on next render.
			await this.idbStorage.setMetadata('teamRecommendationProfiles:metadata', {
				timestamp: 0,
				payload: null,
			});
		} catch {
			// Ignore preference persistence failures; local preference still drives UI behavior.
		}
	}

	/**
	 * Get Team Recommendation profile metadata from cache/API.
	 *
	 * @returns {Promise<object|null>} Profile metadata payload or cached payload
	 * @private
	 */
	async _getTeamRecommendationProfileMetadata() {
		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey: 'teamRecommendationProfiles:metadata',
			ttlMs: TOOLS_CATALOG_CACHE_TTL_MS,
			requestUrl: this._buildApiUrl(TEAM_RECOMMENDATION_PROFILES_PATH),
			fallbackPayload: null,
		});
	}

	/**
	 * Get Team Recommendation Engine payload from cache/API.
	 *
	 * @param {string} mode - Gameplay mode
	 * @param {string} objective - Objective profile
	 * @param {number} trendWindowDays - Preferred calibration trend window days
	 * @returns {Promise<object|null>} API payload or cached payload
	 * @private
	 */
	async _getTeamRecommendationEnginePayload(mode, objective, trendWindowDays = 30) {
		const cacheKey = `teamRecommendations:${mode}:${objective}:${trendWindowDays}`;
		const url = new URL(this._buildApiUrl(TEAM_RECOMMENDATIONS_PATH));
		url.searchParams.set('mode', mode || 'arena');
		url.searchParams.set('objective', objective || 'balanced');
		url.searchParams.set('limit', '3');
		url.searchParams.set('minSamples', '2');
		url.searchParams.set('preferredTrendWindowDays', String(Math.max(1, Number(trendWindowDays || 30))));

		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey,
			ttlMs: RECOMMENDATIONS_CACHE_TTL_MS,
			requestUrl: url.toString(),
			fallbackPayload: null,
		});
	}

	/**
	 * Get Arena integrated recommendation/simulation payload from cache/API.
	 *
	 * @param {string} objective - Objective profile
	 * @param {number} trendWindowDays - Preferred calibration trend window days
	 * @returns {Promise<object|null>} API payload or cached payload
	 * @private
	 */
	async _getTeamRecommendationArenaSimulationPayload(objective, trendWindowDays = 30) {
		const cacheKey = `teamRecommendations:arena:simulate:${objective}:${trendWindowDays}`;
		const url = new URL(this._buildApiUrl(TEAM_RECOMMENDATION_ARENA_SIMULATION_PATH));
		url.searchParams.set('objective', objective || 'balanced');
		url.searchParams.set('limit', '3');
		url.searchParams.set('minSamples', '2');
		url.searchParams.set('preferredTrendWindowDays', String(Math.max(1, Number(trendWindowDays || 30))));

		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey,
			ttlMs: RECOMMENDATIONS_CACHE_TTL_MS,
			requestUrl: url.toString(),
			fallbackPayload: null,
		});
	}

	/**
	 * Get Team Recommendation backtest calibration payload from cache/API.
	 *
	 * @param {string} mode - Gameplay mode
	 * @param {string} objective - Objective profile
	 * @returns {Promise<object|null>} API payload or cached payload
	 * @private
	 */
	async _getTeamRecommendationBacktestPayload(mode, objective) {
		const cacheKey = `teamRecommendationBacktest:${mode}:${objective}`;
		const url = new URL(this._buildApiUrl(TEAM_RECOMMENDATION_BACKTEST_PATH));
		url.searchParams.set('mode', mode || 'arena');
		url.searchParams.set('objective', objective || 'balanced');
		url.searchParams.set('lookbackDays', '30');
		url.searchParams.set('limit', '3');
		url.searchParams.set('minSamples', '2');

		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey,
			ttlMs: RECOMMENDATIONS_CACHE_TTL_MS,
			requestUrl: url.toString(),
			fallbackPayload: null,
		});
	}

	/**
	 * Get Team Recommendation persisted calibration metadata from cache/API.
	 *
	 * @param {string} mode - Gameplay mode
	 * @param {number} trendWindowDays - Preferred calibration trend window days
	 * @returns {Promise<object|null>} API payload or cached payload
	 * @private
	 */
	async _getTeamRecommendationCalibrationPayload(mode, trendWindowDays = 30) {
		const cacheKey = `teamRecommendationCalibration:${mode}:${trendWindowDays}`;
		const url = new URL(this._buildApiUrl(TEAM_RECOMMENDATION_CALIBRATION_PATH));
		url.searchParams.set('mode', mode || 'arena');
		url.searchParams.set('preferredTrendWindowDays', String(Math.max(1, Number(trendWindowDays || 30))));

		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey,
			ttlMs: RECOMMENDATIONS_CACHE_TTL_MS,
			requestUrl: url.toString(),
			fallbackPayload: null,
		});
	}

	/**
	 * Get Team Recommendation operations summary payload from cache/API.
	 *
	 * @param {number} trendWindowDays - Preferred calibration trend window days
	 * @returns {Promise<object|null>} API payload or cached payload
	 * @private
	 */
	async _getTeamRecommendationOperationsSummaryPayload(trendWindowDays = 30) {
		const resolvedWindow = [7, 30, 90].includes(Number(trendWindowDays)) ? Number(trendWindowDays) : 30;
		const cacheKey = `teamRecommendationOperationsSummary:${resolvedWindow}`;
		const url = new URL(this._buildApiUrl(TEAM_RECOMMENDATION_OPERATIONS_SUMMARY_PATH));
		url.searchParams.set('preferredTrendWindowDays', String(resolvedWindow));

		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey,
			ttlMs: RECOMMENDATIONS_CACHE_TTL_MS,
			requestUrl: url.toString(),
			fallbackPayload: null,
		});
	}

	/**
	 * Render mode-scoped operations diagnostics for Team Recommendation Engine section.
	 *
	 * @param {string} selectedMode - Selected dashboard mode
	 * @param {object|null} operationsSummary - Operations summary payload
	 * @returns {string} HTML fragment
	 * @private
	 */
	_renderTeamRecommendationOperationsSummary(selectedMode, operationsSummary) {
		const modes = Array.isArray(operationsSummary?.modes) ? operationsSummary.modes : [];
		if (modes.length === 0) {
			return '<div style="margin:4px 0 8px 0;padding:6px;border:1px dashed #385142;border-radius:6px;background:#15241d;font-size:10px;color:#89ad9a">Ops: waiting for summary data...</div>';
		}

		const normalizedMode = String(selectedMode || 'arena').toLowerCase();
		const modeAlias = normalizedMode === 'titanarena' ? 'arena' : normalizedMode;
		const row = modes.find((entry) => String(entry?.mode || '').toLowerCase() === modeAlias)
			|| modes.find((entry) => String(entry?.mode || '').toLowerCase() === normalizedMode)
			|| null;
		if (!row) {
			return '<div style="margin:4px 0 8px 0;padding:6px;border:1px dashed #385142;border-radius:6px;background:#15241d;font-size:10px;color:#89ad9a">Ops: no mode summary available for this selection yet.</div>';
		}

		const mae = Number(row.meanAbsoluteError || 0);
		const brier = Number(row.meanBrierScore || 0);
		const bias = Number(row.predictionBias || 0);
		const frictionScale = Number(row.suggestedFrictionScale || 0);
		const samples = Number(row.samples || 0);
		const isStale = Boolean(row.isStale);
		const healthStatus = (() => {
			const apiStatus = String(row?.healthStatus || '').trim().toLowerCase();
			if (apiStatus === 'healthy' || apiStatus === 'monitor' || apiStatus === 'stale') {
				return apiStatus;
			}
			if (isStale) return 'stale';
			if (mae > 0.22 || brier > 0.28) return 'monitor';
			return 'healthy';
		})();
		const healthLabel = (() => {
			const apiLabel = String(row?.healthLabel || '').trim();
			if (apiLabel) return this._escapeHtml(apiLabel);
			switch (healthStatus) {
				case 'stale': return 'Stale';
				case 'monitor': return 'Needs Attention';
				default: return 'Healthy';
			}
		})();
		const warn = healthStatus === 'stale' || healthStatus === 'monitor';
		const badgeStyle = warn
			? 'color:#ffd99a;background:rgba(255,167,38,0.16);border-color:rgba(255,167,38,0.38)'
			: 'color:#9cefc7;background:rgba(67,160,71,0.16);border-color:rgba(76,175,80,0.38)';

		return `<div style="margin:4px 0 8px 0;padding:6px;border:1px solid #2b4a3c;border-radius:6px;background:#15241d">
			<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
				<div style="font-size:10px;color:#9ed0b8;font-weight:700">Ops Diagnostics</div>
				<div style="font-size:9px;border:1px solid transparent;padding:2px 6px;border-radius:999px;${badgeStyle}">${healthLabel}</div>
			</div>
			<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px">
				<div style="font-size:10px;color:#95b7a6;background:#1b2b24;border:1px solid #2f4d3f;border-radius:5px;padding:4px">MAE <strong style="color:#d7f6e9">${mae.toFixed(3)}</strong></div>
				<div style="font-size:10px;color:#95b7a6;background:#1b2b24;border:1px solid #2f4d3f;border-radius:5px;padding:4px">Brier <strong style="color:#d7f6e9">${brier.toFixed(3)}</strong></div>
				<div style="font-size:10px;color:#95b7a6;background:#1b2b24;border:1px solid #2f4d3f;border-radius:5px;padding:4px">Bias <strong style="color:#d7f6e9">${bias.toFixed(3)}</strong></div>
				<div style="font-size:10px;color:#95b7a6;background:#1b2b24;border:1px solid #2f4d3f;border-radius:5px;padding:4px">Scale <strong style="color:#d7f6e9">${frictionScale.toFixed(2)}</strong></div>
				<div style="font-size:10px;color:#95b7a6;background:#1b2b24;border:1px solid #2f4d3f;border-radius:5px;padding:4px">Samples <strong style="color:#d7f6e9">${samples.toLocaleString()}</strong></div>
			</div>
		</div>`;
	}

	/**
	 * Render recommendation source-mix/fallback metadata banner.
	 *
	 * @param {string} selectedMode - Selected recommendation mode
	 * @param {object|null} payload - Recommendation payload
	 * @returns {string} HTML fragment
	 * @private
	 */
	_renderTeamRecommendationMeta(selectedMode, payload) {
		const mode = String(selectedMode || 'arena').toLowerCase();
		if (mode !== 'arena') {
			return '';
		}

		const historyCount = Number(payload?.historyRecommendationCount || 0);
		const engineCount = Number(payload?.engineRecommendationCount || 0);
		const note = typeof payload?.note === 'string' && payload.note.trim()
			? this._escapeHtml(payload.note)
			: '';

		if (historyCount <= 0 && engineCount <= 0 && !note) {
			return '';
		}

		const sourceMix = `<div style="font-size:10px;color:#9fd8bc">Source mix • history ${historyCount} • engine ${engineCount}</div>`;
		const noteHtml = note
			? `<div style="font-size:10px;color:#ffd99a;margin-top:2px">${note}</div>`
			: '';

		return `<div style="margin:4px 0 8px 0;padding:6px;border:1px solid #2b4a3c;border-radius:6px;background:#15241d">${sourceMix}${noteHtml}</div>`;
	}

	/**
	 * Render curated external tool references with verification metadata.
	 *
	 * @returns {Promise<string>} HTML section
	 * @private
	 */
	async _renderExternalToolsSection() {
		try {
			const metadata = await this._getExternalToolsFilterMetadata();
			const payload = await this._getExternalToolsCatalogPayload();
			const selectedStatus = this.prefStorage.get('toolsCatalogStatusFilter', '');
			const sectionModel = buildExternalToolsSectionModel(metadata, payload, selectedStatus);
			if (sectionModel.tools.length === 0) return '';

			return renderExternalToolsSection({
				tools: sectionModel.tools,
				statusOptions: sectionModel.statusOptions,
				selectedStatus: sectionModel.selectedStatus,
				escapeHtml: (value) => this._escapeHtml(value),
			});
		} catch {
			return '';
		}
	}

	/**
	 * Get external tools catalog payload from cache/API.
	 *
	 * @returns {Promise<object|null>} API payload or cached payload
	 * @private
	 */
	async _getExternalToolsCatalogPayload() {
		const metadata = await this._getExternalToolsFilterMetadata();
		const selectedStatus = this.prefStorage.get('toolsCatalogStatusFilter', '');
		const cacheKey = `toolsCatalog:external:${selectedStatus || 'all'}`;

		const url = new URL(this._buildApiUrl(TOOLS_CATALOG_PATH));
		const defaultMinConfidence = Number(metadata?.defaultMinConfidence);
		const normalizedMinConfidence = Number.isFinite(defaultMinConfidence)
			? Math.max(0, Math.min(1, defaultMinConfidence))
			: 0.65;
		url.searchParams.set('minConfidence', normalizedMinConfidence.toFixed(2));
		url.searchParams.set('includeStale', metadata?.defaultIncludeStale ? 'true' : 'false');
		url.searchParams.set('sort', metadata?.defaultSort || 'confidence');
		if (selectedStatus) {
			url.searchParams.set('verificationStatus', selectedStatus);
		}

		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey,
			ttlMs: TOOLS_CATALOG_CACHE_TTL_MS,
			requestUrl: url.toString(),
			fallbackPayload: null,
		});
	}

	/**
	 * Get external tools catalog filter metadata from cache/API.
	 *
	 * @returns {Promise<object|null>} Filter metadata payload or cached payload
	 * @private
	 */
	async _getExternalToolsFilterMetadata() {
		return getCachedApiPayload({
			idbStorage: this.idbStorage,
			cacheKey: 'toolsCatalog:filters',
			ttlMs: TOOLS_CATALOG_CACHE_TTL_MS,
			requestUrl: this._buildApiUrl(TOOLS_CATALOG_FILTERS_PATH),
			fallbackPayload: {
				verificationStatuses: ['verified', 'partial', 'unverified', 'stale'],
				defaultMinConfidence: 0.65,
				defaultIncludeStale: false,
				defaultSort: 'confidence',
			},
		});
	}

	/**
	 * Render the daily summary section on the dashboard.
	 * Uses pre-loaded battles and index-range queries for today-only data (#132).
	 *
	 * @param {Array} battles - Pre-loaded battles array from renderDashboard
	 * @returns {Promise<string>} HTML section
	 * @private
	 */
	async _renderDailySummary(battles = []) {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayISO = todayStart.toISOString();

		const {
			todayBattles,
			todayWins,
			todayChests,
			todayQuests,
			todayUpgrades,
		} = await aggregateDailySummaryStats({
			idbStorage: this.idbStorage,
			battles,
			todayISO,
		});

		return renderDailySummarySection({
			todayBattles,
			todayWins,
			todayChests,
			todayQuests,
			todayUpgrades,
		});
	}

	/**
	 * Activity feed — live, color-coded event log from the `activityEvents`
	 * IDB store. Falls back to `apiLogs` if no activity events exist yet.
	 *
	 * Color scheme:
	 *   green  = win / reward / gain
	 *   red    = loss / error
	 *   blue   = info / snapshot
	 *   gold   = upgrade / hero
	 *   purple = chest
	 *
	 * @returns {Promise<string>} HTML content
	 */
	async renderActivity() {
		// Try activityEvents first (richer, color-coded)
		let events = [];
		try {
			events = await this.idbStorage.getAll('activityEvents', FETCH_LIMIT_ACTIVITY);
			events.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
		} catch { /* store may not exist yet on older DBs */ }

		// Fallback: show raw API logs if no activity events
		if (events.length === 0) {
			let logs = [];
			try {
				logs = await this.idbStorage.getAll('apiLogs', FETCH_LIMIT_API_LOGS);
				logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
			} catch { /* empty */ }

			return renderActivityFallback({
				logs,
				escapeHtml: (value) => this._escapeHtml(value),
			});
		}

		return renderActivityEventsFeed({
			events,
			displayLimit: DISPLAY_LIMIT_ACTIVITY,
			activityColorClass: (evt) => this._activityColorClass(evt),
			activityIcon: (evt) => this._activityIcon(evt),
			escapeHtml: (value) => this._escapeHtml(value),
		});
	}

	/**
	 * Heroes — sortable, filterable, paginated hero roster.
	 * Pulls from metadata `heroesData` with IDB fallback + dedup by heroId.
	 *
	 * Hero Wars color/rank names for readability:
	 *  0=Gray, 1=Green, 2=Green+1, 3=Blue, 4=Blue+1, 5=Blue+2,
	 *  6=Violet, 7=Violet+1, 8=Violet+2, 9=Violet+3,
	 *  10=Orange, 11=Orange+1, 12=Orange+2, 13=Orange+3, 14=Orange+4,
	 *  15=Red, 16=Red+1, 17=Red+2, 18=Red+2 (Max)
	 *
	 * @returns {Promise<string>} HTML content
	 */
	async renderHeroes() {
		const vs = this._viewState.heroes;
		const Calc = HeroCompletionCalculator;

		let heroes = await this._loadHeroesRoster();

		if (heroes.length === 0) {
			return `
				<div class="oj-heroes">
					<h3>\uD83E\uDDB8 Heroes</h3>
					<p class="oj-empty">No hero data captured yet. Open your hero roster in the game to trigger data capture.</p>
				</div>
			`;
		}

		// Pre-compute completion for every hero (keyed by heroId for fast lookup)
		const completionMap = {};
		for (const h of heroes) {
			const key = h.heroId || h.id;
			completionMap[key] = Calc.calculateCompletion(h);
		}

		// Build projected overall item requirements for remaining hero progression.
		const {
			requirementsProjection,
			requirementItemMeta,
		} = await this._loadHeroRequirementsProjectionData(heroes);

		const requirementsPanelHtml = this._renderHeroRequirementsPanel(requirementsProjection, requirementItemMeta);

		// Filter
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			heroes = heroes.filter((h) => {
				const heroId = Number(h.heroId || h.id || 0);
				const localized = this._resolveEntityName(heroId);
				const name = this._pickBestInventoryLabel([localized, h.heroName, h.name]).toLowerCase();
				return name.includes(q);
			});
		}

		// Sort — add virtual 'completion' field for sorting
		if (vs.sortField === 'completion') {
			heroes.sort((a, b) => {
				const ca = completionMap[a.heroId || a.id]?.overall || 0;
				const cb = completionMap[b.heroId || b.id]?.overall || 0;
				return vs.sortDir === 'asc' ? ca - cb : cb - ca;
			});
		} else {
			heroes = this._sortData(heroes, vs.sortField, vs.sortDir);
		}

		// Total power (post-filter for accuracy)
		const totalPower = heroes.reduce((s, h) => s + (h.power || 0), 0);

		// Average completion
		const avgCompletion = heroes.length > 0
			? heroes.reduce((s, h) => s + (completionMap[h.heroId || h.id]?.overall || 0), 0) / heroes.length
			: 0;

		// Paginate
		const totalCount = heroes.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = heroes.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		const rows = pageItems.map((h) => {
			const hId = h.heroId || h.id;
			const localizedName = this._resolveEntityName(Number(hId));
			const name = this._escapeHtml(this._pickBestInventoryLabel([localizedName, h.heroName, h.name]) || `Hero #${hId}`);
			const colorName = this._colorRankName(h.color);
			const colorClass = this._colorRankClass(h.color);
			const comp = completionMap[hId] || { overall: 0, systems: {} };

			// Hero avatar from HW-Assist Calculator CDN
			// IDs are zero-padded to 4 digits; enemy variant IDs (>=7000) map back to base hero
			const avatarId = hId >= 7000 ? hId - 7000 : hId;
			const avatarUrl = `https://calc2.hw-assist.com/static/assets/images/hero_icons/${String(avatarId).padStart(4, '0')}.png`;

			// Build expandable per-system breakdown (hidden by default)
			const sysRows = Object.entries(Calc.SYSTEM_LABELS).map(([key, label]) => {
				const pct = comp.systems[key] || 0;
				return `<div class="oj-sys-row">` +
					`<span class="oj-sys-icon">${Calc.SYSTEM_ICONS[key] || ''}</span>` +
					`<span class="oj-sys-name">${label}</span>` +
					Calc.renderBar(pct) +
					`</div>`;
			}).join('');

			return `
				<tr class="oj-hero-row" data-hero-id="${hId}">
					<td class="oj-avatar-cell"><img class="oj-hero-avatar ${colorClass}" src="${avatarUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'"></td>
					<td><strong>${name}</strong></td>
					<td>${h.level || '\u2014'}</td>
					<td>${'\u2B50'.repeat(Math.min(h.stars || 0, 6)) || '\u2014'}</td>
					<td><span class="${colorClass}">${colorName}</span></td>
					<td class="oj-num">${h.power ? h.power.toLocaleString() : '\u2014'}</td>
					<td class="oj-completion-cell">${Calc.renderBar(comp.overall)}</td>
				</tr>
				<tr class="oj-hero-detail" data-detail-for="${hId}" style="display:none">
					<td colspan="7">
						<div class="oj-sys-breakdown">${sysRows}</div>
					</td>
				</tr>
			`;
		}).join('');

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		return `
			<div class="oj-heroes" data-browser="heroes">
				<h3>\uD83E\uDDB8 Heroes <span class="oj-muted">(${totalCount} \u2022 ${totalPower.toLocaleString()} power \u2022 avg ${Calc.formatPercent(avgCompletion)} complete)</span></h3>
				${requirementsPanelHtml}
				${this._renderSearchBar(vs.filter)}
				<table class="oj-table oj-sortable">
					<thead>
						<tr>
							<th class="oj-avatar-header"></th>
							<th data-sort="name" class="oj-sort-header">Name ${sortInd('name')}</th>
							<th data-sort="level" class="oj-sort-header">Lvl ${sortInd('level')}</th>
							<th data-sort="stars" class="oj-sort-header">Stars ${sortInd('stars')}</th>
							<th data-sort="color" class="oj-sort-header">Rank ${sortInd('color')}</th>
							<th data-sort="power" class="oj-sort-header">Power ${sortInd('power')}</th>
							<th data-sort="completion" class="oj-sort-header">Complete ${sortInd('completion')}</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				${this._renderPagination(vs.page, totalPages, totalCount)}
			</div>
		`;
	}

	/**
	 * Load latest hero roster with metadata-first + IDB dedupe fallback.
	 *
	 * @returns {Promise<Array<object>>} Hero roster
	 * @private
	 */
	async _loadHeroesRoster() {
		let heroes = [];
		try {
			const cached = await this.idbStorage.getMetadata('heroesData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				heroes = cached;
			}
		} catch { /* empty */ }

		if (heroes.length > 0) return heroes;

		try {
			const raw = await this.idbStorage.getAll('heroes', FETCH_LIMIT_LARGE);
			const all = decompressHeroStore(raw);
			if (all.length === 0) return [];
			const byId = {};
			for (const h of all) {
				const key = h.heroId || h.id;
				if (!byId[key] || (h.timestamp || '') > (byId[key].timestamp || '')) {
					byId[key] = h;
				}
			}
			return Object.values(byId);
		} catch {
			return [];
		}
	}

	/**
	 * Load hero projection datasets and compute requirements payload.
	 *
	 * @param {Array<object>} heroes - Hero roster
	 * @returns {Promise<{requirementsProjection: object|null, requirementItemMeta: object}>} Projection payload
	 * @private
	 */
	async _loadHeroRequirementsProjectionData(heroes) {
		try {
			const [heroUpgrades, equipmentChanges, inventoryItemUsages, inventoryData] = await Promise.all([
				this.idbStorage.getAll('heroUpgrades', FETCH_LIMIT_LARGE).catch(() => []),
				this.idbStorage.getAll('equipmentChanges', FETCH_LIMIT_LARGE).catch(() => []),
				this.idbStorage.getAll('inventoryItemUsages', FETCH_LIMIT_LARGE).catch(() => []),
				this.idbStorage.getMetadata('inventoryData', {}).catch(() => ({})),
			]);

			const parsedInventory = this._parseRawInventory(inventoryData || {});
			const requirementItemMeta = ProjectedItemCatalogResolver.buildRuntimeMetaMap(parsedInventory);
			const requirementsProjection = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
				heroes,
				heroUpgrades,
				equipmentChanges,
				inventoryItemUsages,
				inventoryData,
				targetLevel: HeroCompletionCalculator.MAX_LEVEL,
				targetColorRank: 19,
				topItemLimit: 24,
			});

			return { requirementsProjection, requirementItemMeta };
		} catch {
			return { requirementsProjection: null, requirementItemMeta: {} };
		}
	}

	/**
	 * Render a projected overall item requirements panel for hero progression.
	 *
	 * @param {object|null} projection - Projection payload from HeroMaterialRequirementsCalculator
	 * @param {Record<string, {name: string, category?: string, icon?: string}>} itemMetaMap - Optional map from item ID to display metadata
	 * @returns {string} HTML panel markup
	 * @private
	 */
	_renderHeroRequirementsPanel(projection, itemMetaMap = {}) {
		return renderHeroRequirementsProjectionPanel({
			projection,
			itemMetaMap,
			heroesViewState: this._viewState?.heroes || {},
			prefStorage: this.prefStorage,
			escapeHtml: (value) => this._escapeHtml(value),
		});

		const heroesViewState = this._viewState?.heroes || {};
		const topItems = Array.isArray(projection.items) ? projection.items : [];
		const topItemsPageSize = Math.max(10, Number(heroesViewState.projectionTopItemsPageSize || 25));
		const topItemsPageCount = Math.max(1, Math.ceil(topItems.length / topItemsPageSize));
		const topItemsPage = Math.min(Math.max(Number(heroesViewState.projectionTopItemsPage || 0), 0), topItemsPageCount - 1);
		heroesViewState.projectionTopItemsPage = topItemsPage;
		const topItemsSliceStart = topItemsPage * topItemsPageSize;
		const topItemsSliceEnd = Math.min(topItemsSliceStart + topItemsPageSize, topItems.length);
		const pagedTopItems = topItems.slice(topItemsSliceStart, topItemsSliceEnd);
		const confidencePct = Math.round((projection.confidenceScore || 0) * 100);
		const hasSignal = topItems.length > 0;
		const confidenceColor = confidencePct >= 70
			? '#81c784'
			: (confidencePct >= 40 ? '#ffb74d' : '#ef9a9a');

		const itemRows = pagedTopItems.map((entry) => {
			const levelPart = Number(entry.levelProjected || 0);
			const colorPart = Number(entry.colorProjected || 0);
			const needed = Number(entry.quantity || 0);
			const owned = Number(entry.ownedQuantity || 0);
			const shortage = Number(entry.shortageQuantity || 0);
			const mix = [];
			if (levelPart > 0) mix.push(`Lv ${levelPart.toLocaleString()}`);
			if (colorPart > 0) mix.push(`Rank ${colorPart.toLocaleString()}`);
			const mixLabel = mix.length > 0 ? mix.join(' • ') : 'Projected';
			const shortageStyle = shortage > 0 ? 'color:#ef9a9a;font-weight:700' : 'color:#a5d6a7;font-weight:700';
			const resolved = ProjectedItemCatalogResolver.resolveItemMeta(entry.itemId, itemMetaMap);
			const itemId = resolved.itemId;
			const resolvedName = resolved.name;
			const itemIcon = resolved.icon;

			return `<tr>` +
				`<td><div class="oj-mono" style="font-size:11px">${this._escapeHtml(itemId)}</div><div style="display:flex;align-items:center;gap:6px"><span>${this._escapeHtml(itemIcon)}</span><span>${this._escapeHtml(resolvedName)}</span></div></td>` +
				`<td class="oj-num"><strong>${needed.toLocaleString()}</strong></td>` +
				`<td class="oj-num">${owned.toLocaleString()}</td>` +
				`<td class="oj-num" style="${shortageStyle}">${shortage.toLocaleString()}</td>` +
				`<td class="oj-muted" style="font-size:11px">${this._escapeHtml(mixLabel)}</td>` +
			`</tr>`;
		}).join('');

		const coverage = projection.coverage || {};
		const tierSummaries = Array.isArray(projection.tierSummaries) ? projection.tierSummaries : [];
		const levelBandSummaries = Array.isArray(projection.levelBandSummaries) ? projection.levelBandSummaries : [];
		const isColorTierOpen = this.prefStorage.get('heroesProjectionColorTierOpen', true) !== false;
		const isLevelBandOpen = this.prefStorage.get('heroesProjectionLevelBandOpen', true) !== false;
		const isTopItemsOpen = this.prefStorage.get('heroesProjectionTopItemsOpen', true) !== false;
		const totalNeeds = Number(projection.totalProjectedItems || 0).toLocaleString();
		const totalOwned = Number(projection.totalOwnedForProjectedItems || 0).toLocaleString();
		const totalShortage = Number(projection.totalShortageItems || 0).toLocaleString();
		const tierSummaryTotal = tierSummaries.reduce((sum, tier) => sum + Number(tier.totalProjectedItems || 0), 0);
		const levelBandSummaryTotal = levelBandSummaries.reduce((sum, band) => sum + Number(band.totalProjectedItems || 0), 0);
		const tierRows = tierSummaries.map((tier) => {
			const need = Number(tier.totalProjectedItems || 0);
			const owned = Number(tier.totalOwnedForProjectedItems || 0);
			const shortage = Number(tier.totalShortageItems || 0);
			const shortageStyle = shortage > 0 ? 'color:#ef9a9a;font-weight:700' : 'color:#a5d6a7;font-weight:700';
			return `<tr>` +
				`<td><strong>${this._escapeHtml(tier.tierName || 'Unknown')}</strong></td>` +
				`<td class="oj-num">${need.toLocaleString()}</td>` +
				`<td class="oj-num">${owned.toLocaleString()}</td>` +
				`<td class="oj-num" style="${shortageStyle}">${shortage.toLocaleString()}</td>` +
				`<td class="oj-num oj-muted" style="font-size:11px">${Number(tier.distinctItems || 0).toLocaleString()}</td>` +
			`</tr>`;
		}).join('');
		const levelBandRows = levelBandSummaries.map((band) => {
			const levels = Number(band.levelCount || 0);
			const need = Number(band.totalProjectedItems || 0);
			const owned = Number(band.totalOwnedForProjectedItems || 0);
			const shortage = Number(band.totalShortageItems || 0);
			const shortageStyle = shortage > 0 ? 'color:#ef9a9a;font-weight:700' : 'color:#a5d6a7;font-weight:700';
			return `<tr>` +
				`<td><strong>${this._escapeHtml(band.bandName || 'Unknown')}</strong></td>` +
				`<td class="oj-num oj-muted" style="font-size:11px">${levels.toLocaleString()}</td>` +
				`<td class="oj-num">${need.toLocaleString()}</td>` +
				`<td class="oj-num">${owned.toLocaleString()}</td>` +
				`<td class="oj-num" style="${shortageStyle}">${shortage.toLocaleString()}</td>` +
				`<td class="oj-num oj-muted" style="font-size:11px">${Number(band.distinctItems || 0).toLocaleString()}</td>` +
			`</tr>`;
		}).join('');

		return `
			<div class="oj-section" style="margin-bottom:10px;padding:10px 12px">
				<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
					<div>
						<div style="font-size:13px;font-weight:700;color:#e0e0e0">\uD83E\uDDFE Overall Items Needed To Max Heroes</div>
						<div class="oj-muted" style="font-size:11px">Target: level ${projection.targetLevel}, ${this._escapeHtml(projection.targetColorName || `Rank ${projection.targetColorRank}`)} • ${projection.heroCount} heroes</div>
					</div>
					<div style="font-size:12px;color:${confidenceColor};font-weight:700">Confidence ${confidencePct}%</div>
				</div>
				<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;margin-bottom:8px">
					<div class="oj-muted" style="font-size:11px">Level gaps: <strong>${Number(projection.totalLevelDeficit || 0).toLocaleString()}</strong></div>
					<div class="oj-muted" style="font-size:11px">Rank gaps: <strong>${Number(projection.totalColorDeficit || 0).toLocaleString()}</strong></div>
					<div class="oj-muted" style="font-size:11px">Projected total: <strong>${totalNeeds}</strong></div>
					<div class="oj-muted" style="font-size:11px">Owned (matching IDs): <strong>${totalOwned}</strong></div>
					<div class="oj-muted" style="font-size:11px">Shortage: <strong style="color:#ef9a9a">${totalShortage}</strong></div>
					<div class="oj-muted" style="font-size:11px">Signals: lvlUp ${Number(coverage.levelUpgradeSamples || 0)}, colorUp ${Number(coverage.colorUpgradeSamples || 0)}, equip ${Number(coverage.equipmentChangeSamples || 0)}, itemUse ${Number(coverage.itemUsageSamples || 0)}</div>
				</div>
				<div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:4px">
					<button type="button" class="oj-btn oj-btn-xs" data-projection-control="expandAll">Expand All</button>
					<button type="button" class="oj-btn oj-btn-xs" data-projection-control="collapseAll">Collapse All</button>
				</div>
				${tierRows
					? `<details ${isColorTierOpen ? 'open' : ''} data-projection-section="colorTier" style="margin-top:4px">
						<summary style="cursor:pointer;font-size:12px;font-weight:700;color:#d0d0d0;list-style:disclosure-closed">Color Tier Summary • ${tierSummaries.length} tiers • ${tierSummaryTotal.toLocaleString()} needed</summary>
						<div class="oj-projection-scroll" style="margin-top:6px">
							<table class="oj-table oj-projection-table"><thead><tr><th>Tier</th><th>Needed</th><th>Owned</th><th>Shortage</th><th>Distinct</th></tr></thead><tbody>${tierRows}</tbody></table>
						</div>
					</details>`
					: ''
				}
				${levelBandRows
					? `<details ${isLevelBandOpen ? 'open' : ''} data-projection-section="levelBand" style="margin-top:4px">
						<summary style="cursor:pointer;font-size:12px;font-weight:700;color:#d0d0d0;list-style:disclosure-closed">Level Band Summary • ${levelBandSummaries.length} bands • ${levelBandSummaryTotal.toLocaleString()} needed</summary>
						<div class="oj-projection-scroll" style="margin-top:6px">
							<table class="oj-table oj-projection-table"><thead><tr><th>Level Band</th><th>Levels</th><th>Needed</th><th>Owned</th><th>Shortage</th><th>Distinct</th></tr></thead><tbody>${levelBandRows}</tbody></table>
						</div>
					</details>`
					: ''
				}
				${hasSignal
					? `<details ${isTopItemsOpen ? 'open' : ''} data-projection-section="topItems" style="margin-top:4px">
						<summary style="cursor:pointer;font-size:12px;font-weight:700;color:#d0d0d0;list-style:disclosure-closed">Top Projected Items • ${topItems.length} rows</summary>
						<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">
							<div class="oj-muted" style="font-size:11px">Showing ${topItems.length === 0 ? 0 : (topItemsSliceStart + 1).toLocaleString()}-${topItemsSliceEnd.toLocaleString()} of ${topItems.length.toLocaleString()}</div>
							<div style="display:flex;align-items:center;gap:6px">
								<button type="button" class="oj-btn oj-btn-xs" data-projection-top-nav="prev" ${topItemsPage <= 0 ? 'disabled' : ''}>Prev</button>
								<div class="oj-muted" style="font-size:11px">Page ${(topItemsPage + 1).toLocaleString()} / ${topItemsPageCount.toLocaleString()}</div>
								<button type="button" class="oj-btn oj-btn-xs" data-projection-top-nav="next" ${topItemsPage >= (topItemsPageCount - 1) ? 'disabled' : ''}>Next</button>
							</div>
						</div>
						<div class="oj-muted" style="font-size:11px;margin-top:4px">Shortcuts: Alt+Left / Alt+[ = Prev • Alt+Right / Alt+] = Next</div>
						<div class="oj-projection-scroll" style="margin-top:6px">
							<table class="oj-table oj-projection-table"><thead><tr><th>Item</th><th>Needed</th><th>Owned</th><th>Shortage</th><th>Mix</th></tr></thead><tbody>${itemRows}</tbody></table>
						</div>
					</details>`
					: `<p class="oj-empty" style="margin:0">Not enough tracked upgrade/equipment history yet to estimate concrete item IDs. Keep playing with tracking enabled and this panel will auto-fill.</p>`
				}
			</div>
		`;
	}

	/**
	 * Battles — paginated battle history with sub-tab filtering by type.
	 * All battle types (Arena, GrandArena, TitanArena, GuildWar) are stored in
	 * a single `battles` store with a `battleType` field and `isWin` boolean.
	 * @returns {Promise<string>} HTML content
	 */
	async renderBattles() {
		const vs = this._viewState.battles;
		const allBattles = await this._loadBattlesDataset();

		if (allBattles.length === 0) {
			return `
				<div class="oj-battles">
					<h3>\u2694\uFE0F Battles</h3>
					<p class="oj-empty">No battle data captured yet. Fight in the arena to start tracking!</p>
				</div>
			`;
		}

		const { types, typeLabels, typeIcons } = this._getBattleTypeMetadata();
		const byType = this._buildBattleTypeCounts(allBattles);
		const pills = this._renderBattleSubTabPills(vs, allBattles, byType, types, typeLabels, typeIcons);
		const {
			filtered,
			fWins,
			fLosses,
			fWinRate,
		} = this._filterBattlesForView(allBattles, vs);

		// Paginate
		const totalCount = filtered.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = filtered.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		const rows = this._renderBattleRows(pageItems, typeLabels);

		// Adventure Guide panel — shown on Adventure sub-tab (#131)
		let adventureGuideHtml = '';
		if (vs.subTab === 'Adventure' && filtered.length > 0) {
			adventureGuideHtml = this._renderAdventureGuide(filtered);
		}

		return `
			<div class="oj-battles" data-browser="battles">
				<h3>\u2694\uFE0F Battles <span class="oj-muted">(${allBattles.length} total)</span></h3>
				<div class="oj-stats-grid oj-stats-sm">
					${this._statCard(fWins, 'Wins', '#4CAF50')}
					${this._statCard(fLosses, 'Losses', '#f44336')}
					${this._statCard(fWinRate + '%', 'Win Rate', '#2196F3')}
				</div>
				<div class="oj-sub-tabs">${pills}</div>
				${adventureGuideHtml}
				${this._renderSearchBar(vs.filter, 'Search opponent...')}
				<table class="oj-table">
					<thead>
						<tr><th>Time</th><th>Type</th><th>Opponent</th><th>Rank</th><th>Dmg</th><th>Heal</th><th>Result</th></tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				${this._renderPagination(vs.page, totalPages, totalCount)}
			</div>
		`;
	}

	/**
	 * Titans — sortable, filterable, paginated titan roster.
	 * Pulls from metadata `titansData` with IDB `titans` store fallback.
	 * Deduplicates by titanId, keeping only the latest snapshot.
	 * @returns {Promise<string>} HTML content
	 */
	async renderTitans() {
		const vs = this._viewState.titans;
		let titans = await this._loadTitansRoster();

		if (titans.length === 0) {
			return `
				<div class="oj-titans">
					<h3>\uD83D\uDCA0 Titans</h3>
					<p class="oj-empty">No titan data captured yet. Open your titan roster in the game to trigger data capture.</p>
				</div>
			`;
		}

		// Filter by name
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			titans = titans.filter((t) => {
				const titanId = Number(t.titanId || t.id || 0);
				const localized = this._resolveEntityName(titanId);
				const name = this._pickBestInventoryLabel([localized, t.titanName, t.name]).toLowerCase();
				return name.includes(q);
			});
		}

		// Sort (non-completion sort handled first, completion sort done after completionMap)
		if (vs.sortField !== 'completion') {
			titans = this._sortData(titans, vs.sortField, vs.sortDir);
		}

		const totalPower = titans.reduce((s, t) => s + (t.power || 0), 0);

		const TCalc = TitanCompletionCalculator;

		const completionMap = this._buildTitanCompletionMap(titans, TCalc);

		// Average completion
		const avgCompletion = titans.length > 0
			? titans.reduce((s, t) => s + (completionMap[t.titanId || t.id]?.overall || 0), 0) / titans.length
			: 0;

		// Sort — add virtual 'completion' field for sorting
		if (vs.sortField === 'completion') {
			titans.sort((a, b) => {
				const ca = completionMap[a.titanId || a.id]?.overall || 0;
				const cb = completionMap[b.titanId || b.id]?.overall || 0;
				return vs.sortDir === 'asc' ? ca - cb : cb - ca;
			});
		}

		// Re-paginate after sort
		const totalCount = titans.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = titans.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		const rows = this._renderTitanRows(pageItems, completionMap, TCalc);

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		return `
			<div class="oj-titans" data-browser="titans">
				<h3>\uD83D\uDCA0 Titans <span class="oj-muted">(${totalCount} \u2022 ${totalPower.toLocaleString()} power \u2022 avg ${TCalc.formatPercent(avgCompletion)} complete)</span></h3>
				${this._renderSearchBar(vs.filter)}
				<table class="oj-table oj-sortable">
					<thead>
						<tr>
							<th class="oj-avatar-header"></th>
							<th data-sort="name" class="oj-sort-header">Name ${sortInd('name')}</th>
							<th data-sort="level" class="oj-sort-header">Lvl ${sortInd('level')}</th>
							<th data-sort="stars" class="oj-sort-header">Stars ${sortInd('stars')}</th>
							<th data-sort="element" class="oj-sort-header">Element / Totem ${sortInd('element')}</th>
							<th>Artifacts</th>
							<th data-sort="power" class="oj-sort-header">Power ${sortInd('power')}</th>
							<th data-sort="completion" class="oj-sort-header">Complete ${sortInd('completion')}</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				${this._renderPagination(vs.page, totalPages, totalCount)}
			</div>
		`;
	}

	/**
	 * Pets — sortable, filterable, paginated pet roster.
	 * Pulls from metadata `petsData` with IDB `pets` store fallback.
	 * Deduplicates by petId, keeping only the latest snapshot.
	 * @returns {Promise<string>} HTML content
	 */
	async renderPets() {
		const vs = this._viewState.pets;
		const PCalc = PetCompletionCalculator;

		let pets = await this._loadPetsRoster();

		if (pets.length === 0) {
			return `
				<div class="oj-pets">
					<h3>\uD83D\uDC3E Pets</h3>
					<p class="oj-empty">No pet data captured yet. Open your pet roster in the game to trigger data capture.</p>
				</div>
			`;
		}

		const completionMap = this._buildPetCompletionMap(pets, PCalc);

		// Filter by name
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			pets = pets.filter((p) => {
				const pId = p.petId || p.id;
				const localized = this._resolveEntityName(Number(pId));
				const name = this._pickBestInventoryLabel([localized, p.petName, p.name]).toLowerCase();
				return name.includes(q);
			});
		}

		// Sort
		if (vs.sortField === 'completion') {
			pets.sort((a, b) => {
				const ca = completionMap[a.petId || a.id]?.overall || 0;
				const cb = completionMap[b.petId || b.id]?.overall || 0;
				return vs.sortDir === 'asc' ? ca - cb : cb - ca;
			});
		} else {
			pets = this._sortData(pets, vs.sortField, vs.sortDir);
		}

		// Total power (post-filter)
		const totalPower = pets.reduce((s, p) => s + (p.power || 0), 0);

		// Average completion
		const avgCompletion = pets.length > 0
			? pets.reduce((s, p) => s + (completionMap[p.petId || p.id]?.overall || 0), 0) / pets.length
			: 0;

		// Paginate
		const totalCount = pets.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = pets.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		const rows = this._renderPetRows(pageItems, completionMap, PCalc);

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		// ── Pet Soul Stones Progress ────────────────────────────────────
		// Load fragmentPet data from cached inventory to show per-pet soul stone counts.
		// Star requirements (cumulative stones needed to reach each star):
		//   1★=10, 2★=30, 3★=80, 4★=180, 5★=330, 6★=630 (total 630 per pet to max)
		// Each pet has TYPE-SPECIFIC soul stones — Fenris stones only work on Fenris.
		// Reference: Hero Wars community data
		const STAR_COSTS_CUMULATIVE = [0, 10, 30, 80, 180, 330, 630];
		const STAR_COSTS_INCREMENTAL = [10, 20, 50, 100, 150, 300]; // cost for star N+1
		const MAX_STONES_PER_PET = 630;
		const soulStonesHtml = await this._renderPetSoulStonesSection(
			pets,
			PCalc,
			STAR_COSTS_CUMULATIVE,
			STAR_COSTS_INCREMENTAL,
			MAX_STONES_PER_PET,
		);

		return `
			<div class="oj-pets" data-browser="pets">
				<h3>\uD83D\uDC3E Pets <span class="oj-muted">(${totalCount} \u2022 ${totalPower.toLocaleString()} power \u2022 avg ${PCalc.formatPercent(avgCompletion)} complete)</span></h3>
				${soulStonesHtml}
				${this._renderSearchBar(vs.filter)}
				<table class="oj-table oj-sortable">
					<thead>
						<tr>
							<th class="oj-avatar-header"></th>
							<th data-sort="name" class="oj-sort-header">Name ${sortInd('name')}</th>
							<th data-sort="level" class="oj-sort-header">Lvl ${sortInd('level')}</th>
							<th data-sort="stars" class="oj-sort-header">Stars ${sortInd('stars')}</th>
							<th data-sort="color" class="oj-sort-header">Color ${sortInd('color')}</th>
							<th data-sort="power" class="oj-sort-header">Power ${sortInd('power')}</th>
							<th data-sort="completion" class="oj-sort-header">Complete ${sortInd('completion')}</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				${this._renderPagination(vs.page, totalPages, totalCount)}
			</div>
		`;
	}

	/**
	 * Upgrades — unified timeline of hero/titan upgrade events and equipment changes.
	 * Reads from `heroUpgrades`, `titanUpgrades`, and `equipmentChanges` IDB stores.
	 * Supports sub-tab filtering by category (hero/titan/equipment) and type.
	 * @returns {Promise<string>} HTML content
	 */
	async renderUpgrades() {
		const vs = this._viewState.upgrades;

		const {
			heroUpgrades,
			titanUpgrades,
			equipChanges,
			allUpgrades,
		} = await this._loadUpgradesDataset();

		if (allUpgrades.length === 0) {
			return `
				<div class="oj-upgrades">
					<h3>\uD83D\uDCC8 Upgrades</h3>
					<p class="oj-empty">No upgrade events captured yet. Upgrade heroes, titans, or equip gear to start tracking!</p>
				</div>
			`;
		}


		const {
			categoryCounts,
			filtered,
			subTab,
		} = this._buildUpgradesViewModel(allUpgrades, heroUpgrades, titanUpgrades, equipChanges, vs);

		// ── Paginate ────────────────────────────────────────────────────
		const totalCount = filtered.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = filtered.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);


		const rows = this._renderUpgradeRows(pageItems);


		const pills = this._renderUpgradeSubTabPills(categoryCounts, subTab);

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		return `
			<div class="oj-upgrades" data-browser="upgrades">
				<h3>\uD83D\uDCC8 Upgrades <span class="oj-muted">(${allUpgrades.length} events)</span></h3>
				<div class="oj-sub-tabs">${pills}</div>
				${this._renderSearchBar(vs.filter)}
				<table class="oj-table oj-sortable">
					<thead>
						<tr>
							<th data-sort="timestamp" class="oj-sort-header">Time ${sortInd('timestamp')}</th>
							<th>Category</th>
							<th>Name</th>
							<th>Type</th>
							<th>Detail</th>
							<th>Power</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				${this._renderPagination(vs.page, totalPages, totalCount)}
			</div>
		`;
	}

	/**
	 * Chests — paginated log of chest openings with drop details.
	 * Reads from metadata `chestOpeningHistory` and/or the `chests` IDB store.
	 * @returns {Promise<string>} HTML content
	 */
	async renderChests() {
		const vs = this._viewState.chests;

		const {
			chests,
			dropRates,
			allDrops,
			dropsLoaded,
		} = await this._loadChestDatasetBundle();

		if (chests.length === 0 && Object.keys(dropRates).length === 0) {
			return `
				<div class="oj-chests">
					<h3>\uD83C\uDF81 Chests & Drop Rates</h3>
					<p class="oj-empty">No chest data captured yet. Open some chests in the game to start tracking!</p>
				</div>
			`;
		}

		const sourceLabels = {
			genericChest: 'Chest', artifactChest: 'Artifact', titanArtifactChest: 'Titan Artifact',
			petChest: 'Pet', lootBox: 'Loot Box', towerChest: 'Tower', outlandChest: 'Outland',
		};

		const typePills = this._renderChestTypePills(chests, sourceLabels);
		let dropRateHtml = this._renderChestDropRatesFromMetadata(dropRates, sourceLabels);
		if (!dropRateHtml) {
			dropRateHtml = this._renderChestDropRatesFromRawDrops(allDrops, chests, sourceLabels);
		}


		const {
			pageItems,
			totalCount,
			totalPages,
		} = this._buildChestHistoryViewModel(chests, vs);
		const rows = this._renderChestOpeningRows(pageItems, sourceLabels);

		return `
			<div class="oj-chests" data-browser="chests">
				<h3>\uD83C\uDF81 Chests & Drop Rates <span class="oj-muted">(${chests.length} openings${dropsLoaded ? ` \u2022 ${allDrops.length} drops tracked` : ''})</span></h3>
				<div class="oj-pills">${typePills}</div>
				${dropRateHtml}
				<h4 class="oj-section-sub">Opening History</h4>
				${this._renderSearchBar(vs.filter, 'Filter by chest type...')}
				<table class="oj-table">
					<thead>
						<tr><th>Time</th><th>Type</th><th>Drops</th><th>Qty</th><th>Items</th></tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				${this._renderPagination(vs.page, totalPages, totalCount)}
			</div>
		`;
	}

	/**
	 * Inventory — display current inventory grouped by category.
	 * Reads from metadata `inventoryData` or the `inventory` IDB store.
	 * @returns {Promise<string>} HTML content
	 */
	async renderInventory() {
		const vs = this._viewState.inventory;

		let items = await this._loadInventoryItems();

		if (items.length === 0) {
			return `
				<div class="oj-inventory">
					<h3>\uD83C\uDF92 Inventory</h3>
					<p class="oj-empty">No inventory data captured yet. Open your bag in the game to trigger data capture.</p>
				</div>
			`;
		}

		// Filter
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			items = items.filter((it) => {
				const name = (it.name || it.itemName || '').toLowerCase();
				const cat = (it.category || it.type || '').toLowerCase();
				return name.includes(q) || cat.includes(q);
			});
		}

		// Sort
		items = this._sortData(items, vs.sortField, vs.sortDir);

		// Paginate across all items (flat) but render grouped
		const totalCount = items.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const { categoryCount, groupHtml } = this._renderInventoryGroupSections(items);
		const nameDiagnosticsHtml = this._renderInventoryNameDiagnosticsSection();

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		const usageHtml = await this._renderInventoryUsageSection();

		return `
			<div class="oj-inventory" data-browser="inventory">
				<h3>\uD83C\uDF92 Inventory <span class="oj-muted">(${totalCount} items in ${categoryCount} categories)</span></h3>
				${this._renderSearchBar(vs.filter, 'Search items...')}
				${nameDiagnosticsHtml}
				${groupHtml}
				${usageHtml}
			</div>
		`;
	}

	/**
	 * Parse raw inventory API data into a flat array of items suitable for display.
	 * The game's inventoryGet API returns an object like:
	 *   { fragmentHero: {id: qty}, fragmentTitan: {id: qty}, fragmentPet: {id: qty},
	 *     consumable: {id: qty}, gear: {id: qty}, ... }
	 *
	 * We convert each {id: qty} entry to { itemId, name, category, count }.
	 *
	 * @param {Object} rawData - Raw inventory data from the API
	 * @returns {Array<{itemId: string, name: string, category: string, count: number}>}
	 * @private
	 */
	_parseRawInventory(rawData, itemNameCatalog = {}) {
		const items = [];
		const unresolved = [];

		// Category mapping: API key → display category + name resolver
		const categories = {
			fragmentHero: { category: 'hero_soul_stones', prefix: 'Hero' },
			fragmentTitan: { category: 'titan_soul_stones', prefix: 'Titan' },
			fragmentPet: { category: 'pet_soul_stones', prefix: 'Pet' },
			consumable: { category: 'consumable', prefix: 'Consumable' },
			gear: { category: 'equipment', prefix: 'Gear' },
			craftItem: { category: 'fragment', prefix: 'Craft' },
			fragmentGear: { category: 'fragment', prefix: 'Gear Fragment' },
			fragmentScroll: { category: 'fragment', prefix: 'Scroll Fragment' },
			ascensionGear: { category: 'fragment', prefix: 'Ascension Item' },
			fragmentTitanArtifact: { category: 'artifact', prefix: 'Titan Artifact Fragment' },
			fragmentArtifact: { category: 'artifact', prefix: 'Artifact Fragment' },
			bannerStone: { category: 'resource', prefix: 'Banner Stone' },
			petGear: { category: 'equipment', prefix: 'Pet Gear' },
			scroll: { category: 'scroll', prefix: 'Scroll' },
			artifact: { category: 'artifact', prefix: 'Artifact' },
			experience: { category: 'resource', prefix: 'XP Item' },
			treasure: { category: 'resource', prefix: 'Treasure' },
			coin: { category: 'resource', prefix: 'Coin' },
		};

		for (const [apiKey, entries] of Object.entries(rawData)) {
			if (!entries || typeof entries !== 'object') continue;

			const catInfo = categories[apiKey] || { category: apiKey, prefix: apiKey };

			for (const [itemId, qty] of Object.entries(entries)) {
				if (qty <= 0) continue;

				const name = this._resolveInventoryItemName(apiKey, itemId, catInfo, itemNameCatalog);
				const fallbackPatterns = [
					`${catInfo.prefix} ${itemId}`,
					`${catInfo.prefix} ${itemId} Stones`,
					`${catInfo.prefix} ${itemId} Soul Stones`,
					this._formatSoulStoneLabel(`${catInfo.prefix} ${itemId}`),
				];

				if (fallbackPatterns.includes(name) || this._isPlaceholderItemLabel(name)) {
					const scopedKey = `${apiKey}:${itemId}`;
					const tokenKey = `${apiKey}${itemId}`;
					const directKey = `item:${itemId}`;
					const catalogHits = [
						itemNameCatalog[scopedKey],
						itemNameCatalog[tokenKey],
						itemNameCatalog[directKey],
					].filter((value) => value && !this._isPlaceholderItemLabel(value));

					unresolved.push({
						category: apiKey,
						itemId: String(itemId),
						quantity: Number(qty) || 0,
						renderedName: name,
						catalogKeys: [scopedKey, tokenKey, directKey],
						catalogHits,
						tokenAttempts: this._buildInventoryTokenCandidates(apiKey, itemId),
					});
				}

				items.push({
					itemId,
					name,
					category: catInfo.category,
					count: Number(qty) || 0,
				});
			}
		}

		this._lastInventoryNameDiagnostics = {
			generatedAt: new Date().toISOString(),
			unresolvedCount: unresolved.length,
			unresolved,
		};

		// Sort by category then by count descending
		items.sort((a, b) => a.category.localeCompare(b.category) || b.count - a.count);
		return items;
	}

	/**
	 * Resolve a display name for an inventory item.
	 * Prefers localized runtime/catalog names and falls back to deterministic placeholders.
	 *
	 * @param {string} apiKey - Inventory category key from API payload
	 * @param {string} itemId - Item ID
	 * @param {{prefix: string}} catInfo - Category metadata
	 * @param {Record<string, string>} itemNameCatalog - Name lookup map
	 * @returns {string} Display name
	 * @private
	 */
	_resolveInventoryItemName(apiKey, itemId, catInfo, itemNameCatalog) {
		if (apiKey === 'fragmentHero' || apiKey === 'fragmentTitan' || apiKey === 'fragmentPet') {
			const resolvedName = this._resolveEntityName(Number(itemId));
			if (!this._isPlaceholderItemLabel(resolvedName)) {
				return this._formatSoulStoneLabel(resolvedName);
			}

			const tokenResolved = this._resolveInventoryTokenName(apiKey, itemId);
			if (tokenResolved && !this._isPlaceholderItemLabel(tokenResolved)) {
				return tokenResolved;
			}

			return `${catInfo.prefix} ${itemId}`;
		}

		const tokenKey = `${apiKey}${itemId}`;
		const scopedKey = `${apiKey}:${itemId}`;
		const directKey = `item:${itemId}`;
		const resolved = this._pickBestInventoryLabel([
			itemNameCatalog[scopedKey],
			itemNameCatalog[tokenKey],
			itemNameCatalog[directKey],
		]);
		if (resolved && !this._isPlaceholderItemLabel(resolved)) {
			return resolved;
		}

		const tokenResolved = this._resolveInventoryTokenName(apiKey, itemId);
		if (tokenResolved && !this._isPlaceholderItemLabel(tokenResolved)) {
			return tokenResolved;
		}

		return `${catInfo.prefix} ${itemId}`;
	}

	/**
	 * Resolve inventory name from known locale token families.
	 *
	 * @param {string} apiKey - Inventory category key from payload
	 * @param {string|number} itemId - Item identifier
	 * @returns {string} Resolved localized name or empty string
	 * @private
	 */
	_resolveInventoryTokenName(apiKey, itemId) {
		for (const token of this._buildInventoryTokenCandidates(apiKey, itemId)) {
			const resolved = this._resolveLocaleToken(token);
			if (resolved && !this._isPlaceholderItemLabel(resolved)) {
				return resolved;
			}
		}

		return '';
	}

	/**
	 * Build likely locale token candidates for an inventory category/id pair.
	 *
	 * @param {string} apiKey - Inventory category key
	 * @param {string|number} itemId - Inventory item id
	 * @returns {string[]} Token candidates
	 * @private
	 */
	_buildInventoryTokenCandidates(apiKey, itemId) {
		const id = String(itemId || '').trim();
		if (!/^\d+$/.test(id)) return [];

		const tokenMap = {
			consumable: ['LIB_CONSUMABLE_NAME_'],
			gear: ['LIB_GEAR_NAME_'],
			scroll: ['LIB_SCROLL_NAME_'],
			coin: ['LIB_COIN_NAME_'],
			artifact: ['LIB_ARTIFACT_NAME_'],
			bannerStone: ['LIB_BANNER_STONE_NAME_', 'LIB_STONE_NAME_'],
			craftItem: ['LIB_CRAFT_NAME_', 'LIB_ITEM_NAME_'],
			experience: ['LIB_EXPERIENCE_NAME_', 'LIB_ITEM_NAME_'],
			treasure: ['LIB_TREASURE_NAME_', 'LIB_ITEM_NAME_'],
			ascensionGear: ['LIB_ASCENSION_GEAR_NAME_', 'LIB_GEAR_NAME_'],
			petGear: ['LIB_PET_GEAR_NAME_', 'LIB_GEAR_NAME_'],
			fragmentGear: ['LIB_GEAR_NAME_'],
			fragmentScroll: ['LIB_SCROLL_NAME_'],
			fragmentArtifact: ['LIB_ARTIFACT_NAME_'],
			fragmentTitanArtifact: ['LIB_TITAN_ARTIFACT_NAME_', 'LIB_ARTIFACT_NAME_'],
			fragmentHero: ['LIB_HERO_NAME_'],
			fragmentTitan: ['LIB_TITAN_NAME_'],
			fragmentPet: ['LIB_PET_NAME_'],
		};

		const prefixes = tokenMap[apiKey] || [];
		const candidates = new Set([
			`${apiKey}_${id}`,
			`${apiKey}${id}`,
			`item_${id}`,
		]);

		for (const prefix of prefixes) {
			candidates.add(`${prefix}${id}`);
		}

		const categoryStem = String(apiKey || '')
			.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
			.replace(/\s+/g, '_')
			.toUpperCase();
		if (categoryStem) {
			candidates.add(`LIB_${categoryStem}_NAME_${id}`);
			candidates.add(`LIB_${categoryStem}_${id}`);
		}

		candidates.add(`LIB_ITEM_NAME_${id}`);
		candidates.add(`LIB_RESOURCE_NAME_${id}`);

		return [...candidates];
	}

	/**
	 * Format localized soul-stone labels.
	 *
	 * @param {string} entityName - Entity display name
	 * @returns {string} Soul stone label
	 * @private
	 */
	_formatSoulStoneLabel(entityName) {
		const base = String(entityName || '').trim();
		if (!base) return '';

		if (this._uiLanguage === 'ru') {
			return `${base} Камни Душ`;
		}

		return `${base} Soul Stones`;
	}

	/**
	 * Resolve an entity ID to a display name using the heroNames dictionary.
	 * Falls back to "Hero_{id}" if not found (same as resolveHeroName).
	 *
	 * @param {number} id - Entity ID
	 * @returns {string} Display name
	 * @private
	 */
	_resolveEntityName(id) {
		const translated = this._pickBestInventoryLabel([
			this._resolveLocaleToken(`LIB_HERO_NAME_${id}`),
			this._resolveLocaleToken(`LIB_TITAN_NAME_${id}`),
			this._resolveLocaleToken(`LIB_PET_NAME_${id}`),
		]);

		if (translated) {
			return translated;
		}

		const mapped = resolveHeroName(id);
		if (mapped && mapped !== `Hero_${id}`) {
			return mapped;
		}

		return `Entity ${id}`;
	}

	/**
	 * Resources — display player resources from metadata cache and recent
	 * resource transaction history from the `resourceTransactions` IDB store.
	 * @returns {Promise<string>} HTML content
	 */
	async renderResources() {
		const { src, transactions } = await this._loadResourcesDataset();
		if (!src && transactions.length === 0) {
			return `
				<div class="oj-resources">
					<h3>\uD83D\uDC8E Resources</h3>
					<p class="oj-empty">No resource data captured yet. Play the game \u2014 your first snapshot will be taken automatically.</p>
				</div>
			`;
		}

		const cardsHtml = this._renderResourceCardsSection(src);
		const txHtml = this._renderResourceTransactionsSection(transactions);

		return `
			<div class="oj-resources">
				<h3>\uD83D\uDC8E Resources</h3>
				${cardsHtml}
				${txHtml}
				${!cardsHtml && !txHtml ? '<p class="oj-empty">No recognizable resource data found.</p>' : ''}
			</div>
		`;
	}

	// =====================================================================
	// API Log (Debug View)
	// =====================================================================
	// Mail Tab (#94)
	// =====================================================================

	/**
	 * Mail — displays mail messages and collected rewards from the in-game mailbox.
	 * Reads from `mailData` metadata (mail list) and `mailRewards` IDB store (collected items).
	 * @returns {Promise<string>} HTML content
	 */
	async renderMail() {
		const { mailData, rewards } = await this._loadMailDataset();

		if (!mailData && rewards.length === 0) {
			return `
				<div class="oj-mail">
					<h3>\uD83D\uDCEC Mail</h3>
					<p class="oj-empty">No mail data captured yet. Open your mailbox in the game to trigger data capture.</p>
				</div>
			`;
		}

		// ── Mail list section ───────────────────────────────────────────
		let mailListHtml = '';
		if (mailData && Array.isArray(mailData.items) && mailData.items.length > 0) {
			const vs = this._viewState.mail;

			const {
				pageItems,
				totalCount,
				totalPages,
			} = this._buildMailListViewModel(mailData.items, vs);
			const rows = this._renderMailInboxRows(pageItems);

			const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

			mailListHtml = `
				<div class="oj-mail-list" data-browser="mail">
					<h4>\uD83D\uDCE5 Inbox <span class="oj-muted">(${totalCount} messages \u2022 ${mailData.unread || 0} unread \u2022 ${mailData.uncollected || 0} uncollected)</span></h4>
					${this._renderSearchBar(vs.filter, 'Search sender, subject, message, type...')}
					<table class="oj-table oj-sortable">
						<thead>
							<tr>
								<th style="width:30px">&nbsp;</th>
								<th data-sort="senderName" class="oj-sort-header">From ${sortInd('senderName')}</th>
								<th data-sort="subject" class="oj-sort-header">Subject ${sortInd('subject')}</th>
								<th data-sort="mailType" class="oj-sort-header">Type ${sortInd('mailType')}</th>
								<th>Message</th>
								<th data-sort="receivedAt" class="oj-sort-header">Received ${sortInd('receivedAt')}</th>
								<th>Expected Rewards</th>
							</tr>
						</thead>
						<tbody>${rows}</tbody>
					</table>
					${this._renderPagination(vs.page, totalPages, totalCount)}
				</div>
			`;
		}

		// ── Collected rewards section ───────────────────────────────────
		const rewardHtml = this._renderMailCollectedRewardsSection(rewards);

		return `
			<div class="oj-mail">
				<h3>\uD83D\uDCEC Mail</h3>
				${mailListHtml}
				${rewardHtml}
			</div>
		`;
	}

	// =====================================================================
	// API Call Log
	// =====================================================================

	/**
	 * Render the API call log from GameTracker's in-memory ring buffer.
	 * Shows the last 100 intercepted API calls with timestamps, method
	 * names, dispatch status, and any errors encountered.
	 *
	 * @returns {string} HTML content
	 */
	renderApiLog() {
		const log = this.gameTracker?._apiCallLog || [];

		if (log.length === 0) {
			return `
				<div class="oj-apilog">
					<h3>\uD83D\uDCE1 API Call Log</h3>
					<p class="oj-empty">No API calls captured yet. Play the game — calls appear here in real time.</p>
				</div>
			`;
		}

		// Newest first
		const entries = [...log].reverse();

		const rows = entries.map((entry, i) => {
			const time = new Date(entry.ts).toLocaleTimeString();
			const names = (entry.callNames || []).join(', ') || '(none)';
			const statusIcon = entry.status === 'ok' ? '\u2705'
				: entry.status === 'error' ? '\u274C'
				: entry.status === 'skipped' ? '\u23ED\uFE0F'
				: '\u2753'; // no-match
			const statusClass = entry.status === 'ok' ? 'oj-log-ok'
				: entry.status === 'error' ? 'oj-log-error'
				: 'oj-log-skip';
			const errorInfo = entry.error
				? `<div class="oj-log-err-detail">\u26A0\uFE0F ${this._escapeHtml(entry.error)}</div>`
				: '';
			const urlInfo = entry.url
				? `<div class="oj-log-url">\u2192 ${this._escapeHtml(entry.url)}</div>`
				: '';
			const pageInfo = entry.page
				? `<span class="oj-log-page">[${this._escapeHtml(entry.page)}]</span>`
				: '';

			// Build expandable payload viewer (#91)
			let payloadHtml = '';
			if (entry.payload && Object.keys(entry.payload).length > 0) {
				const payloadRows = Object.entries(entry.payload).map(([callName, data]) => {
					let argsJson = '';
					let resJson = '';
					try { argsJson = JSON.stringify(data.args, null, 2); } catch { argsJson = String(data.args); }
					try { resJson = typeof data.response === 'string' ? data.response : JSON.stringify(data.response, null, 2); } catch { resJson = String(data.response); }
					return `<div class="oj-payload-call">` +
						`<strong>${this._escapeHtml(callName)}</strong>` +
						`<div class="oj-payload-section"><span class="oj-payload-label">\u2191 Args:</span><pre class="oj-payload-json">${this._escapeHtml(argsJson)}</pre></div>` +
						`<div class="oj-payload-section"><span class="oj-payload-label">\u2193 Response:</span><pre class="oj-payload-json">${this._escapeHtml(resJson)}</pre></div>` +
						`</div>`;
				}).join('');
				payloadHtml = `<div class="oj-log-payload" data-log-idx="${i}" style="display:none">${payloadRows}</div>` +
					`<button class="oj-btn-tiny oj-payload-toggle" data-log-idx="${i}">\uD83D\uDD0D Payload</button>`;
			}

			return `
				<div class="oj-log-entry ${statusClass}">
					<div class="oj-log-header">
						<span class="oj-log-status">${statusIcon}</span>
						<span class="oj-log-time">${time}</span>
						${pageInfo}
						<span class="oj-log-num">#${log.length - i}</span>
					</div>
					${urlInfo}
					<div class="oj-log-calls">${this._escapeHtml(names)}</div>
					<div class="oj-log-detail">${this._escapeHtml(entry.detail || '')}</div>
					${errorInfo}
					${payloadHtml}
				</div>
			`;
		}).join('');

		const blockedCount = this.gameTracker?._blockedRequestCount || 0;
		const hasAuth = this.gameTracker?.capturedAuth?.authToken ? '\u2705' : '\u274C';
		const historySize = Object.keys(this.gameTracker?.requestHistory || {}).length;

		return `
			<div class="oj-apilog">
				<h3>\uD83D\uDCE1 API Call Log <span class="oj-muted">(${log.length} calls)</span></h3>
				<p class="oj-muted" style="margin:0 0 4px">Auto-refreshes. Newest first. Last ${this.gameTracker._apiCallLogMax} kept.</p>
				<p class="oj-muted" style="margin:0 0 8px">Auth captured: ${hasAuth} | Pending requests: ${historySize} | Blocked (Sentry): ${blockedCount}</p>
				<div class="oj-log-list">${rows}</div>
			</div>
		`;
	}

	/**
	 * Resolve normalized API base URL from preferences.
	 *
	 * @returns {string} API base URL
	 * @private
	 */
	_getApiBaseUrl() {
		return getConfiguredApiBaseUrl(this.prefStorage);
	}

	/**
	 * Build absolute API URL from configured base and path.
	 *
	 * @param {string} path - API path
	 * @returns {string} Absolute URL
	 * @private
	 */
	_buildApiUrl(path) {
		return buildConfiguredApiUrl(this.prefStorage, path);
	}

	/**
	 * Probe a configured API endpoint and return status metadata.
	 *
	 * @param {string} path - API path
	 * @returns {Promise<object>} Probe result
	 * @private
	 */
	async _probeConnectionEndpoint(path) {
		const url = this._buildApiUrl(path);
		return this._probeConnectionAbsoluteUrl(url);
	}

	/**
	 * Probe an absolute endpoint URL and return status metadata.
	 *
	 * @param {string} url - Absolute URL
	 * @returns {Promise<object>} Probe result
	 * @private
	 */
	async _probeConnectionAbsoluteUrl(url) {
		const startedAt = performance.now();
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: { 'Accept': 'application/json' },
				cache: 'no-store',
			});
			let data = null;
			try {
				data = await response.json();
			} catch {
				data = null;
			}
			return {
				ok: response.ok,
				status: response.status,
				statusText: response.statusText || '',
				latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
				url,
				data,
				error: '',
			};
		} catch (err) {
			const gmResult = await this._probeConnectionWithTampermonkey(url, startedAt);
			if (gmResult) {
				return gmResult;
			}

			return {
				ok: false,
				status: 0,
				statusText: '',
				latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
				url,
				data: null,
				error: String(err?.message || err || 'Request failed'),
			};
		}
	}

	/**
	 * Probe endpoint using Tampermonkey request API when fetch is blocked by page-context restrictions.
	 *
	 * @param {string} url - Absolute URL
	 * @param {number} startedAt - Performance timestamp when probe started
	 * @returns {Promise<object|null>} Probe result or null when GM API is unavailable
	 * @private
	 */
	async _probeConnectionWithTampermonkey(url, startedAt) {
		const gmRequest = globalThis.GM_xmlhttpRequest || globalThis?.GM?.xmlHttpRequest;
		if (typeof gmRequest !== 'function') {
			return null;
		}

		return await new Promise((resolve) => {
			try {
				gmRequest({
					method: 'GET',
					url,
					headers: { 'Accept': 'application/json' },
					timeout: 5000,
					onload: (response) => {
						let data = null;
						try {
							data = response?.responseText ? JSON.parse(response.responseText) : null;
						} catch {
							data = null;
						}

						const status = Number(response?.status || 0);
						resolve({
							ok: status >= 200 && status < 300,
							status,
							statusText: String(response?.statusText || ''),
							latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
							url,
							data,
							error: '',
						});
					},
					onerror: (error) => {
						resolve({
							ok: false,
							status: 0,
							statusText: '',
							latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
							url,
							data: null,
							error: String(error?.error || error?.message || 'GM probe failed'),
						});
					},
					ontimeout: () => {
						resolve({
							ok: false,
							status: 0,
							statusText: 'Timeout',
							latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
							url,
							data: null,
							error: 'GM probe timed out',
						});
					},
				});
			} catch {
				resolve(null);
			}
		});
	}

	/**
	 * Render connection and server diagnostics view.
	 *
	 * Guardrail: this view includes only userscript -> local API server
	 * traffic and diagnostics. Do not surface Hero Wars game API
	 * call-stream content here.
	 *
	 * @returns {Promise<string>} HTML content
	 */
	async renderConnection() {
		const apiBaseUrl = this._getApiBaseUrl();
		let [apiHealth, uiSettings, repairStatus, handshake] = await Promise.all([
			this._probeConnectionEndpoint(SYNC_HEALTH_PATH),
			this._probeConnectionEndpoint(UI_SETTINGS_PATH),
			this._probeConnectionEndpoint(UI_REPAIR_STATUS_PATH),
			this._probeConnectionEndpoint(UI_HANDSHAKE_PATH),
		]);

		let syncStatus = {};
		try {
			syncStatus = (await this.idbStorage.getMetadata('syncStatus', null)) || {};
		} catch {
			syncStatus = {};
		}

		let healthFallbackNote = '';
		if (!apiHealth.ok && apiBaseUrl !== DEFAULT_API_BASE_URL) {
			const fallbackProbe = await this._probeConnectionAbsoluteUrl(`${DEFAULT_API_BASE_URL}${SYNC_HEALTH_PATH}`);
			if (fallbackProbe.ok) {
				healthFallbackNote = `Configured API URL is not reachable from userscript context, but default ${DEFAULT_API_BASE_URL} is reachable.`;
				apiHealth = {
					...fallbackProbe,
					note: healthFallbackNote,
				};
			}
		}

		if (!apiHealth.ok && syncStatus?.ok) {
			healthFallbackNote = healthFallbackNote || 'Direct health probe failed, but recent sync metadata indicates API is reachable.';
			apiHealth = {
				...apiHealth,
				ok: true,
				statusText: apiHealth.statusText || 'Recent sync indicates API is reachable',
				error: '',
				note: healthFallbackNote,
			};
		}

		this._setConnectionNavStatus(apiHealth.ok ? 'online' : (apiHealth.status > 0 || syncStatus?.ok ? 'degraded' : 'offline'));

		const classifyEndpointState = (probe, isCoreHealth = false) => {
			if (probe?.ok) return 'ok';
			if (isCoreHealth) {
				return probe?.status > 0 ? 'degraded' : 'down';
			}
			if (probe?.status > 0 || apiHealth.ok) {
				return 'warn';
			}
			return 'down';
		};

		const statusRows = [
			{
				label: 'API health',
				probe: apiHealth,
				detail: apiHealth.ok ? 'Sync API reachable' : 'Cannot reach sync API health endpoint',
				state: classifyEndpointState(apiHealth, true),
			},
			{
				label: 'Tray/API UI settings endpoint',
				probe: uiSettings,
				detail: uiSettings.ok ? 'UI settings endpoint reachable' : 'UI settings endpoint unavailable or access-restricted',
				state: classifyEndpointState(uiSettings, false),
			},
			{
				label: 'Tray/API repair-status endpoint',
				probe: repairStatus,
				detail: repairStatus.ok ? 'Repair diagnostics endpoint reachable' : 'Repair diagnostics endpoint unavailable or access-restricted',
				state: classifyEndpointState(repairStatus, false),
			},
			{
				label: 'Userscript handshake endpoint',
				probe: handshake,
				detail: handshake.ok
					? `Status: ${this._escapeHtml(String(handshake.data?.status || 'unknown'))}`
					: 'Handshake endpoint unavailable or access-restricted',
				state: classifyEndpointState(handshake, false),
			},
		];

		const rowsHtml = statusRows.map((row) => {
			const badge = row.state === 'ok' ? 'OK' : row.state === 'warn' ? 'WARN' : row.state === 'degraded' ? 'DEGRADED' : 'DOWN';
			const badgeStyle = row.state === 'ok'
				? 'background:#1e4d2b;color:#8ef1b0;border:1px solid #2f8f4a;'
				: row.state === 'warn' || row.state === 'degraded'
					? 'background:#4a4520;color:#ffe39a;border:1px solid #9b8e2f;'
					: 'background:#4d1e1e;color:#ffc0c0;border:1px solid #9f3a3a;';
			const statusLine = row.probe.status
				? `HTTP ${row.probe.status} ${this._escapeHtml(row.probe.statusText || '')}`
				: this._escapeHtml(row.probe.error || 'no response');
			return `
				<div style="padding:8px 0;border-bottom:1px solid #3a3a3a;">
					<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
						<strong>${this._escapeHtml(row.label)}</strong>
						<span style="font-size:10px;padding:2px 8px;border-radius:999px;${badgeStyle}">${badge}</span>
					</div>
					<div class="oj-muted" style="font-size:11px;margin-top:2px;">${row.detail}</div>
					<div class="oj-muted" style="font-size:10px;margin-top:2px;">${statusLine} • ${row.probe.latencyMs}ms</div>
					<div class="oj-muted" style="font-size:10px;margin-top:2px;word-break:break-all;">${this._escapeHtml(row.probe.url)}</div>
				</div>`;
		}).join('');

		const settingsPayload = uiSettings.data && typeof uiSettings.data === 'object'
			? JSON.stringify(uiSettings.data, null, 2)
			: '';

		const apiServerCalls = getApiServerCallLog()
			.filter((entry) => isLocalApiServerUrl(String(entry?.url || ''), apiBaseUrl))
			.slice(-50)
			.reverse();

		const apiServerCallRows = apiServerCalls.length
			? apiServerCalls.map((entry) => {
				const statusIcon = entry.ok ? '✅' : (entry.status > 0 ? '⚠️' : '❌');
				const statusLabel = entry.status > 0
					? `HTTP ${entry.status}${entry.statusText ? ` ${this._escapeHtml(entry.statusText)}` : ''}`
					: this._escapeHtml(entry.error || 'network error');
				return `
					<div style="padding:6px 0;border-bottom:1px solid #2d2d2d;">
						<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
							<strong style="font-size:11px;">${statusIcon} ${this._escapeHtml(entry.method)}</strong>
							<span class="oj-muted" style="font-size:10px;">${new Date(entry.ts).toLocaleTimeString()} • ${entry.latencyMs}ms</span>
						</div>
						<div style="font-size:11px;word-break:break-all;">${this._escapeHtml(entry.path || entry.url)}</div>
						<div class="oj-muted" style="font-size:10px;">${statusLabel}</div>
						<div class="oj-muted" style="font-size:10px;word-break:break-all;">${this._escapeHtml(entry.url)}</div>
					</div>`;
			}).join('')
			: '<p class="oj-empty" style="margin:0;">No local API server calls captured yet.</p>';

		return `
			<div class="oj-settings">
				<h3>Connection</h3>

				<div class="oj-settings-group">
					<h4>Connection Configuration</h4>
					<label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">
						<span>API base URL</span>
						<input id="oj-api-base-url" type="text" value="${this._escapeHtml(apiBaseUrl)}"
							style="background:#2a2a2e;color:#ddd;border:1px solid #555;border-radius:3px;padding:6px 8px;">
					</label>
					<p class="oj-muted" style="margin:6px 0 0;font-size:11px;">Used for recommendations, dashboard API cards, and health probes.</p>
					<div class="oj-btn-row" style="margin-top:8px;">
						<button class="oj-btn" id="oj-connection-save">Save URL</button>
						<button class="oj-btn" id="oj-connection-test">Test</button>
						<button class="oj-btn" id="oj-connection-reset">Reset Default</button>
					</div>
					<div id="oj-connection-feedback" class="oj-muted" style="margin-top:8px;font-size:11px;"></div>
				</div>

				${healthFallbackNote ? `<div class="oj-settings-group"><p class="oj-muted" style="margin:0;font-size:11px;">⚠️ ${this._escapeHtml(healthFallbackNote)}</p></div>` : ''}

				<div class="oj-settings-group">
					<h4>Server Status</h4>
					${rowsHtml}
					<div class="oj-btn-row" style="margin-top:8px;">
						<button class="oj-btn" id="oj-connection-refresh">Refresh Status</button>
						<button class="oj-btn" id="oj-connection-open-apilog">Open API Log</button>
						<button class="oj-btn" id="oj-connection-open-health">Open Health</button>
						<button class="oj-btn" id="oj-connection-open-swagger">Open Swagger</button>
						<button class="oj-btn" id="oj-connection-open-openapi">Open OpenAPI JSON</button>
						<button class="oj-btn" id="oj-connection-open-server-logs">Open Server Logs</button>
						<button class="oj-btn" id="oj-connection-open-settings">Open UI Settings</button>
						<button class="oj-btn" id="oj-connection-open-repair">Open Repair Status</button>
						<button class="oj-btn" id="oj-connection-open-handshake">Open Handshake</button>
					</div>
				</div>

				<div class="oj-settings-group">
					<h4>UI Settings Payload</h4>
					<pre style="max-height:180px;overflow:auto;background:#16161a;border:1px solid #333;padding:8px;border-radius:4px;font-size:11px;color:#bfc7d5;">${this._escapeHtml(settingsPayload || 'No payload available.')}</pre>
				</div>

				<div class="oj-settings-group">
					<h4>Local API Server Calls <span class="oj-muted">(Last ${Math.min(apiServerCalls.length, 50)})</span></h4>
					<p class="oj-muted" style="margin:0 0 8px;font-size:11px;">Shows userscript calls to ${this._escapeHtml(apiBaseUrl)} only (health probes, sync, recommendations, UI endpoints). Game API traffic is excluded.</p>
					<div style="max-height:260px;overflow:auto;background:#16161a;border:1px solid #333;padding:8px;border-radius:4px;">${apiServerCallRows}</div>
				</div>
			</div>
		`;
	}

	/**
	 * Attach event listeners for connection view controls.
	 */
	attachConnectionEventListeners() {
		const overlay = this.overlay;
		if (!overlay) return;

		const baseInput = overlay.querySelector('#oj-api-base-url');
		const feedback = overlay.querySelector('#oj-connection-feedback');

		const setFeedback = (message, isError = false) => {
			if (!feedback) return;
			feedback.textContent = message;
			feedback.style.color = isError ? '#ffb4b4' : '#9fd6ff';
		};

		const persistBaseUrl = async (runProbe) => {
			const normalized = normalizeApiBaseUrl(baseInput?.value || '');
			this.prefStorage.set('apiBaseUrl', normalized);
			if (baseInput) {
				baseInput.value = normalized;
			}

			// Invalidate recommendation/tool metadata caches that are API-backed.
			await Promise.allSettled([
				this.idbStorage.setMetadata('battleRecommendations:arena', { timestamp: 0, payload: null }),
				this.idbStorage.setMetadata('teamRecommendationProfiles:metadata', { timestamp: 0, payload: null }),
				this.idbStorage.setMetadata('toolsCatalog:filters', { timestamp: 0, payload: null }),
			]);

			if (runProbe) {
				const probe = await this._probeConnectionEndpoint(SYNC_HEALTH_PATH);
				if (probe.ok) {
					setFeedback(`Saved ${normalized}. Health check OK (${probe.latencyMs}ms).`, false);
					this._setConnectionNavStatus('online');
				} else {
					setFeedback(`Saved ${normalized}, but health probe failed (${probe.error || `HTTP ${probe.status}`}).`, true);
					this._setConnectionNavStatus(probe.status > 0 ? 'degraded' : 'offline');
				}
			} else {
				setFeedback(`Saved ${normalized}.`, false);
			}
		};

		const testCurrentUrl = async () => {
			const normalized = normalizeApiBaseUrl(baseInput?.value || '');
			if (baseInput) {
				baseInput.value = normalized;
			}
			const probe = await this._probeConnectionAbsoluteUrl(`${normalized}${SYNC_HEALTH_PATH}`);
			if (probe.ok) {
				setFeedback(`Test OK for ${normalized} (${probe.latencyMs}ms).`, false);
				this._setConnectionNavStatus('online');
			} else {
				setFeedback(`Test failed for ${normalized} (${probe.error || `HTTP ${probe.status}`}).`, true);
				this._setConnectionNavStatus(probe.status > 0 ? 'degraded' : 'offline');
			}
		};

		overlay.querySelector('#oj-connection-save')?.addEventListener('click', () => {
			persistBaseUrl(false);
		});

		overlay.querySelector('#oj-connection-test')?.addEventListener('click', () => {
			testCurrentUrl();
		});

		overlay.querySelector('#oj-connection-reset')?.addEventListener('click', () => {
			if (baseInput) {
				baseInput.value = 'http://localhost:5124';
			}
			persistBaseUrl(true);
		});

		overlay.querySelector('#oj-connection-refresh')?.addEventListener('click', () => {
			this.renderView('connection');
		});

		overlay.querySelector('#oj-connection-open-apilog')?.addEventListener('click', () => {
			this.switchView('apilog');
		});

		overlay.querySelector('#oj-connection-open-health')?.addEventListener('click', () => {
			this._openExternalUrl(this._buildApiUrl(SYNC_HEALTH_PATH));
		});

		overlay.querySelector('#oj-connection-open-swagger')?.addEventListener('click', () => {
			this._openExternalUrl(this._buildApiUrl(SWAGGER_UI_PATH));
		});

		overlay.querySelector('#oj-connection-open-openapi')?.addEventListener('click', () => {
			this._openExternalUrl(this._buildApiUrl(OPENAPI_JSON_PATH));
		});

		overlay.querySelector('#oj-connection-open-server-logs')?.addEventListener('click', () => {
			this._openExternalUrl(this._buildApiUrl(UI_LOGS_LATEST_PATH));
		});

		overlay.querySelector('#oj-connection-open-settings')?.addEventListener('click', () => {
			this._openExternalUrl(this._buildApiUrl(UI_SETTINGS_PATH));
		});

		overlay.querySelector('#oj-connection-open-repair')?.addEventListener('click', () => {
			this._openExternalUrl(this._buildApiUrl(UI_REPAIR_STATUS_PATH));
		});

		overlay.querySelector('#oj-connection-open-handshake')?.addEventListener('click', () => {
			this._openExternalUrl(this._buildApiUrl(UI_HANDSHAKE_PATH));
		});
	}

	/**
	 * Settings — sync render (no async data needed).
	 * @returns {string} HTML content
	 */
	renderSettings() {
		const autoShow = this.prefStorage.get('uiVisible', false);
		const autoHideBattle = this.prefStorage.get('autoHideBattle', true);
		const trackingPrefs = this.gameTracker.getTrackingPrefs();
		const opacity = this.prefStorage.get('overlayOpacity', 95);
		const defaultTab = this.prefStorage.get('defaultTab', 'dashboard');
		const uiLanguage = this._normalizeUiLanguage(this.prefStorage.get('uiLanguage', 'en'));

		// Notification settings (#52)
		const nm = this.notificationManager;
		const notifyEnabled = nm ? nm.enabled : false;
		const notifyPermission = nm ? nm.permission : 'denied';
		const notifyTypeStates = nm ? nm.getTypeStates() : {};
		const quietHours = nm ? nm.getQuietHours() : { start: '', end: '' };

		// Build notification type toggle rows
		const notifyToggleRows = Object.entries(NOTIFICATION_TYPES).map(([key, meta]) => {
			const checked = notifyTypeStates[key] !== false ? 'checked' : '';
			return `
				<label class="oj-checkbox-label">
					<input type="checkbox" data-notify-type="${key}" ${checked} ${notifyEnabled ? '' : 'disabled'}>
					${meta.icon} ${meta.label}
				</label>`;
		}).join('');

		// Build tracking toggle checkboxes
		const toggleRows = Object.entries(TRACKING_CATEGORIES).map(([key, label]) => {
			const checked = trackingPrefs[key] !== false ? 'checked' : '';
			return `
				<label class="oj-checkbox-label">
					<input type="checkbox" data-track-cat="${key}" ${checked}>
					${label}
				</label>`;
		}).join('');

		// Build default tab selector options
		const tabOptions = [
			['dashboard', 'Dashboard'],
			['activity', 'Activity'],
			['heroes', 'Heroes'],
			['titans', 'Titans'],
			['pets', 'Pets'],
			['upgrades', 'Upgrades'],
			['battles', 'Battles'],
			['chests', 'Chests'],
			['inventory', 'Inventory'],
			['mail', 'Mail'],
			['resources', 'Resources'],
			['connection', 'Connection'],
			['apilog', 'API Log'],
		].map(([val, label]) => {
			const sel = val === defaultTab ? 'selected' : '';
			return `<option value="${val}" ${sel}>${label}</option>`;
		}).join('');

		const languageOptions = this._renderLanguageOptionMarkup(uiLanguage, false);

		return `
			<div class="oj-settings">
				<h3>\u2699\uFE0F Settings</h3>

				<div class="oj-settings-group">
					<h4>Display</h4>
					<label class="oj-checkbox-label">
						<input type="checkbox" id="oj-auto-show" ${autoShow ? 'checked' : ''}>
						Show overlay automatically on page load
					</label>
					<label class="oj-checkbox-label">
						<input type="checkbox" id="oj-auto-hide-battle" ${autoHideBattle ? 'checked' : ''}>
						Auto-hide during battles
					</label>
					<div style="margin-top:6px">
						<label style="display:flex;align-items:center;gap:8px;font-size:12px">
							Opacity: <input type="range" id="oj-opacity" min="30" max="100" value="${opacity}" style="flex:1">
							<span id="oj-opacity-val">${opacity}%</span>
						</label>
					</div>
					<div style="margin-top:6px">
						<label style="display:flex;align-items:center;gap:8px;font-size:12px">
							Default tab:
							<select id="oj-default-tab" style="background:#2a2a2e;color:#ddd;border:1px solid #555;border-radius:3px;padding:2px 4px">
								${tabOptions}
							</select>
						</label>
					</div>
					<div style="margin-top:6px">
						<label style="display:flex;align-items:center;gap:8px;font-size:12px">
							Language:
							<select id="oj-ui-language" style="background:#2a2a2e;color:#ddd;border:1px solid #555;border-radius:3px;padding:2px 4px">
								${languageOptions}
							</select>
						</label>
						<p class="oj-muted" style="margin:2px 0 0;font-size:10px">Default is English. Use the header language button to quickly switch locales.</p>
					</div>
				</div>

				<div class="oj-settings-group">
					<h4>Tracking Categories</h4>
					<p class="oj-muted" style="margin:0 0 4px;font-size:11px">Disable categories to stop tracking that data type.</p>
					${toggleRows}
				</div>

				<div class="oj-settings-group">
					<h4>\uD83D\uDD14 Notifications</h4>
					<label class="oj-checkbox-label">
						<input type="checkbox" id="oj-notify-master" ${notifyEnabled ? 'checked' : ''}>
						Enable desktop notifications
					</label>
					<p class="oj-muted" style="margin:2px 0 4px;font-size:11px">
						Permission: <strong>${notifyPermission}</strong>
						${notifyPermission !== 'granted' ? ' — <a href="#" id="oj-notify-request" style="color:#4fa3ff">Request</a>' : ''}
					</p>
					${notifyToggleRows}
					<div style="margin-top:6px">
						<label style="display:flex;align-items:center;gap:8px;font-size:12px">
							Quiet hours:
							<input type="time" id="oj-quiet-start" value="${quietHours.start}" style="background:#2a2a2e;color:#ddd;border:1px solid #555;border-radius:3px;padding:2px 4px;width:80px" ${notifyEnabled ? '' : 'disabled'}>
							to
							<input type="time" id="oj-quiet-end" value="${quietHours.end}" style="background:#2a2a2e;color:#ddd;border:1px solid #555;border-radius:3px;padding:2px 4px;width:80px" ${notifyEnabled ? '' : 'disabled'}>
						</label>
						<p class="oj-muted" style="margin:2px 0 0;font-size:10px">Leave empty to disable quiet hours.</p>
					</div>
				</div>

				<div class="oj-settings-group">
					<h4>Data Management</h4>
					<div class="oj-btn-row">
						<button class="oj-btn" id="oj-export-data">\uD83D\uDCE5 Export All</button>
						<button class="oj-btn" id="oj-export-raw">\uD83D\uDCBE Export Raw</button>
						<button class="oj-btn" id="oj-import-data">\uD83D\uDCE4 Import</button>
						<button class="oj-btn oj-btn-danger" id="oj-clear-data">\uD83D\uDDD1\uFE0F Clear All</button>
					</div>
					<input type="file" id="oj-import-file" accept=".json" style="display:none">
				</div>

				<div class="oj-settings-group">
					<h4>Sync</h4>
					<p class="oj-muted" style="margin:0 0 8px;font-size:11px">Auto-sync runs on startup and every 15 minutes when API is reachable.</p>
					<div class="oj-btn-row">
						<button class="oj-btn" id="oj-sync-now">\uD83D\uDD04 Sync Now</button>
					</div>
					<div id="oj-sync-status" style="font-size:11px;color:#aaa;margin-top:8px">Loading sync status...</div>
				</div>

				<div class="oj-settings-group">
					<h4>API Sample Collector</h4>
					<p class="oj-muted" style="margin:0 0 8px;font-size:11px">
						Captures one complete, untruncated API response per method.
						Play the game (visit all screens), then export for AI analysis.
					</p>
					<div id="oj-api-sample-stats" style="font-size:11px;color:#aaa;margin-bottom:6px">
						${this.gameTracker.getApiSampleCount()} methods sampled this session
					</div>
					<div class="oj-btn-row">
						<button class="oj-btn" id="oj-export-api-samples">\uD83E\uDDEA Export API Samples</button>
						<button class="oj-btn oj-btn-danger" id="oj-clear-api-samples">\uD83D\uDD04 Reset Samples</button>
					</div>
				</div>

				<div class="oj-settings-group">
					<h4>Storage Usage</h4>
					<div id="oj-storage-stats" style="font-size:11px;color:#aaa">Loading...</div>
				</div>

				<div class="oj-settings-group">
					<h4>First-Run Health Check</h4>
					<p class="oj-muted" style="margin:0 0 8px;font-size:11px">Validate API connectivity and local capture status after installation.</p>
					<div class="oj-btn-row">
						<button class="oj-btn" id="oj-install-health-check">Run Health Check</button>
						<button class="oj-btn" id="oj-health-open-apilog">Open API Log</button>
					</div>
					<div class="oj-btn-row" style="margin-top:6px">
						<button class="oj-btn" id="oj-health-open-api-health">Open API Health URL</button>
						<button class="oj-btn" id="oj-health-open-api-docs">Open API Docs URL</button>
					</div>
					<div id="oj-install-health-output" style="font-size:11px;color:#aaa;margin-top:8px"></div>
				</div>

				<div class="oj-settings-group">
					<h4>Keyboard Shortcuts</h4>
					<div class="oj-shortcut-list">
						<div class="oj-shortcut-row">
							<kbd>Ctrl+Shift+O</kbd>
							<span>Toggle overlay visibility</span>
						</div>
						<div class="oj-shortcut-row">
							<kbd>Ctrl+Shift+H</kbd>
							<span>Toggle overlay visibility (alias)</span>
						</div>
					</div>
				</div>

				<div class="oj-settings-group">
					<h4>About</h4>
					<p>OrganizedJihad \u2014 Hero Wars Tracker v${__OJ_VERSION__}</p>
					<p class="oj-muted">Tracks gameplay data locally via IndexedDB. Optional C# API sync.</p>
				</div>
			</div>
		`;
	}

	/**
	 * Attach event listeners for the Settings view.
	 */
	attachSettingsEventListeners() {
		bindSettingsDataActions({
			overlay: this.overlay,
			gameTracker: this.gameTracker,
			prefStorage: this.prefStorage,
			syncClient: this.syncClient,
			idbStorage: this.idbStorage,
			downloadJson: (data, prefix) => this._downloadJson(data, prefix),
			refreshStorageStats: () => this._loadStorageStats(),
		});

		bindSettingsDisplayTracking({
			overlay: this.overlay,
			prefStorage: this.prefStorage,
			gameTracker: this.gameTracker,
			onUiLanguageChange: (language) => this._setUiLanguage(language),
		});

		bindSettingsNotifications({
			overlay: this.overlay,
			notificationManager: this.notificationManager,
		});

		// ── Load storage stats asynchronously ───────────────────────────
		this._loadStorageStats();

		bindSettingsHealthActions({
			overlay: this.overlay,
			runInstallHealthCheck: () => this._runInstallHealthCheck(),
			openApiLog: () => this.switchView('apilog'),
			openApiHealth: () => this._openExternalUrl(this._buildApiUrl(SYNC_HEALTH_PATH)),
			openApiDocs: () => this._openExternalUrl(this._buildApiUrl(SYNC_DOCS_PATH)),
		});
	}

	/**
	 * Download a JSON object as a file.
	 * @param {Object} data - Data to export
	 * @param {string} prefix - Filename prefix
	 * @private
	 */
	_downloadJson(data, prefix) {
		const blob = new Blob([JSON.stringify(data, null, '\t')], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	/**
	 * Load and display per-store record counts in the settings panel.
	 * @private
	 */
	async _loadStorageStats() {
		const el = this.overlay?.querySelector('#oj-storage-stats');
		if (!el) return;

		try {
			const stats = await this.idbStorage.getStorageStats();
			const total = Object.values(stats).reduce((a, b) => a + Math.max(b, 0), 0);

			const rows = Object.entries(stats)
				.sort(([, a], [, b]) => b - a)
				.filter(([, count]) => count > 0)
				.map(([name, count]) => `
					<div style="display:flex;justify-content:space-between;padding:1px 0">
						<span>${name}</span>
						<span style="color:#8cf">${count.toLocaleString()}</span>
					</div>`)
				.join('');

			el.innerHTML = `
				<div style="margin-bottom:4px"><strong>${total.toLocaleString()}</strong> total records across ${Object.keys(stats).length} stores</div>
				<div style="max-height:150px;overflow-y:auto">${rows || '<span class="oj-muted">No data stored yet</span>'}</div>
			`;
		} catch (err) {
			el.textContent = 'Failed to load stats';
		}
	}

	/**
	 * Run a quick first-run health check for local setup verification.
	 *
	 * @private
	 */
	async _runInstallHealthCheck() {
		const output = this.overlay?.querySelector('#oj-install-health-output');
		const button = this.overlay?.querySelector('#oj-install-health-check');
		if (!output || !button) {
			return;
		}

		button.disabled = true;
		button.textContent = 'Checking...';
		output.textContent = 'Running checks...';

		try {
			const [apiOk, stats, currentPlayerId] = await Promise.all([
				this._checkLocalApiHealth(),
				this.idbStorage.getStorageStats().catch(() => ({})),
				this.idbStorage.getMetadata('currentPlayerId', 'unknown').catch(() => 'unknown'),
			]);

			const healthModel = buildInstallHealthCheckModel({ apiOk, stats, currentPlayerId });
			output.innerHTML = renderInstallHealthDiagnosticsOutput(
				healthModel.checks,
				healthModel.totalRecords,
				(value) => this._escapeHtml(value),
			);
		} catch (err) {
			output.textContent = 'Health check failed. See console for details.';
			console.error('[OrganizedJihad] Health check failed:', err);
		} finally {
			button.disabled = false;
			button.textContent = 'Run Health Check';
		}
	}

	/**
	 * Check whether local sync API responds to /health.
	 *
	 * @returns {Promise<boolean>} True when local API is reachable
	 * @private
	 */
	async _checkLocalApiHealth() {
		try {
			const response = await fetch(this._buildApiUrl(SYNC_HEALTH_PATH), {
				method: 'GET',
				headers: { 'Accept': 'application/json' },
				cache: 'no-store',
			});
			return response.ok;
		} catch {
			return false;
		}
	}

	/**
	 * Open an external troubleshooting URL in a new tab.
	 *
	 * @param {string} url - Absolute URL to open
	 * @private
	 */
	_openExternalUrl(url) {
		if (!url) {
			return;
		}

		try {
			window.open(url, '_blank', 'noopener,noreferrer');
		} catch (err) {
			console.error('[OrganizedJihad] Failed to open URL:', url, err);
		}
	}

	// =====================================================================
	// Show / Hide / Toggle
	// =====================================================================

	/**
	 * Show the overlay panel and set focus for accessibility.
	 */
	show() {
		if (this.overlay) {
			this.overlay.style.display = 'block';
			this.isVisible = true;
			// Apply saved opacity (#27)
			const opacity = this.prefStorage.get('overlayOpacity', 95);
			this.overlay.style.opacity = opacity / 100;
			// Restore max-height if it was overridden by resize
			if (this._savedSize) {
				this.overlay.style.maxHeight = 'none';
			}
			// Re-render current view when opening
			this.renderView(this.currentView);
			// Set focus on the overlay for keyboard accessibility
			this.overlay.setAttribute('tabindex', '-1');
			this.overlay.focus();
		}
	}

	/**
	 * Hide the overlay panel and restore focus.
	 */
	hide() {
		if (this.overlay) {
			this.overlay.style.display = 'none';
			this.isVisible = false;
		}
	}

	/**
	 * Toggle overlay visibility.
	 */
	toggle() {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}

	// =====================================================================
	// Data Browser Shared Components
	// =====================================================================

	/**
	 * Render a search/filter input bar.
	 *
	 * @param {string} currentFilter - Current filter text
	 * @param {string} [placeholder='Search...'] - Placeholder text
	 * @returns {string} HTML
	 */
	_renderSearchBar(currentFilter, placeholder = 'Search...') {
		return renderSearchBar(currentFilter, placeholder, (value) => this._escapeHtml(value));
	}

	/**
	 * Render pagination controls (Prev / Page X of Y / Next).
	 *
	 * @param {number} currentPage - Zero-based current page
	 * @param {number} totalPages  - Total number of pages
	 * @param {number} totalItems  - Total number of items
	 * @returns {string} HTML
	 */
	_renderPagination(currentPage, totalPages, totalItems) {
		return renderPagination(currentPage, totalPages, totalItems);
	}

	/**
	 * Return a sort direction indicator arrow for a column header.
	 *
	 * @param {string} activeField - Currently active sort field
	 * @param {string} activeDir   - Current sort direction ('asc'|'desc')
	 * @param {string} field       - The field this header represents
	 * @returns {string} Unicode arrow or empty string
	 */
	_sortIndicator(activeField, activeDir, field) {
		return sortIndicator(activeField, activeDir, field);
	}

	/**
	 * Generic client-side sort for an array of objects.
	 * Handles string and numeric fields automatically.
	 *
	 * @param {Array<object>} data - Array to sort (mutated in-place)
	 * @param {string} field     - Field name to sort by
	 * @param {string} dir       - 'asc' or 'desc'
	 * @returns {Array<object>} Sorted array
	 */
	_sortData(data, field, dir) {
		return sortData(data, field, dir);
	}

	/**
	 * Attach interactive event listeners for data-browser views.
	 * Handles: sort headers, search input, pagination buttons, sub-tab pills.
	 * Re-renders the current view on any state change.
	 *
	 * @param {string} viewName - The view name (heroes/titans/battles/chests/inventory)
	 */
	_attachDataBrowserListeners(viewName) {
		const content = this.overlay.querySelector('#oj-content');
		if (!content) return;
		const vs = this._viewState[viewName];
		if (!vs) return;

		bindDataBrowserViewInteractions({
			content,
			viewState: vs,
			viewName,
			heroesViewState: this._viewState.heroes || {},
			renderView: (nextView) => this.renderView(nextView),
			renderHeroes: () => this.renderView('heroes'),
			saveProjectionSectionOpenPreference: (section, isOpen) => this._saveProjectionSectionOpenPreference(section, isOpen),
		});
	}

	/**
	 * Save projection section expand/collapse preference.
	 *
	 * @param {string} section - Section key
	 * @param {boolean} isOpen - Whether section is expanded
	 * @private
	 */
	_saveProjectionSectionOpenPreference(section, isOpen) {
		switch (section) {
			case 'colorTier':
				this.prefStorage.set('heroesProjectionColorTierOpen', isOpen);
				break;
			case 'levelBand':
				this.prefStorage.set('heroesProjectionLevelBandOpen', isOpen);
				break;
			case 'topItems':
				this.prefStorage.set('heroesProjectionTopItemsOpen', isOpen);
				break;
		}
	}

	// =====================================================================
	// Helper Methods
	// =====================================================================

	/**
	 * Safely count records in an IndexedDB object store.
	 * Returns 0 on any error (store doesn't exist, etc.).
	 *
	 * @param {string} storeName - The object store name
	 * @returns {Promise<number>} Record count
	 */
	/**
	 * Calculate the average hero completion percentage across all tracked heroes (#63).
	 * Loads heroes from metadata cache or IDB store, deduplicates by heroId,
	 * then computes each hero's overall completion and averages them.
	 *
	 * @returns {Promise<number>} Average hero completion percentage (0-100)
	 * @private
	 */
	async _calcAverageHeroCompletion() {
		const cached = this._completionCache.hero;
		if (cached && (Date.now() - cached.ts) < this._completionCacheTTL) return cached.value;

		try {
			let heroes = [];

			// Try metadata cache first
			const meta = await this.idbStorage.getMetadata('heroesData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				heroes = cached;
			}

			// Fallback: IDB store with dedup
			if (heroes.length === 0) {
				const raw = await this.idbStorage.getAll('heroes', FETCH_LIMIT_LARGE);
				const all = decompressHeroStore(raw);
				if (all.length > 0) {
					const byId = {};
					for (const h of all) {
						const key = h.heroId || h.id;
						if (!byId[key] || (h.timestamp || '') > (byId[key].timestamp || '')) {
							byId[key] = h;
						}
					}
					heroes = Object.values(byId);
				}
			}

			if (heroes.length === 0) return 0;

			let total = 0;
			for (const h of heroes) {
				total += HeroCompletionCalculator.calculateCompletion(h).overall;
			}
			const avg = total / heroes.length;
			this._completionCache.hero = { value: avg, ts: Date.now() };
			return avg;
		} catch {
			return 0;
		}
	}

	/**
	 * Calculate the average titan completion percentage across all tracked titans (#63).
	 * Loads titans from metadata cache or IDB store, deduplicates by titanId,
	 * then computes each titan's overall completion and averages them.
	 *
	 * @returns {Promise<number>} Average titan completion percentage (0-100)
	 * @private
	 */
	async _calcAverageTitanCompletion() {
		const cached = this._completionCache.titan;
		if (cached && (Date.now() - cached.ts) < this._completionCacheTTL) return cached.value;

		try {
			let titans = [];

			// Try metadata cache first
			const meta = await this.idbStorage.getMetadata('titansData', null);
			if (Array.isArray(meta) && meta.length > 0) {
				titans = meta;
			}

			// Fallback: IDB store with dedup
			if (titans.length === 0) {
				const raw = await this.idbStorage.getAll('titans', FETCH_LIMIT_LARGE);
				const all = decompressTitanStore(raw);
				if (all.length > 0) {
					const byId = {};
					for (const t of all) {
						const key = t.titanId || t.id;
						if (!byId[key] || (t.timestamp || '') > (byId[key].timestamp || '')) {
							byId[key] = t;
						}
					}
					titans = Object.values(byId);
				}
			}

			if (titans.length === 0) return 0;

			let total = 0;
			for (const t of titans) {
				total += TitanCompletionCalculator.calculateCompletion(t).overall;
			}
			const avg = total / titans.length;
			this._completionCache.titan = { value: avg, ts: Date.now() };
			return avg;
		} catch {
			return 0;
		}
	}

	/**
	 * Calculate the average pet completion percentage across all owned pets.
	 *
	 * Reads from metadata cache first, falls back to IDB pets store with dedup.
	 *
	 * @returns {Promise<number>} Average pet completion 0–100
	 * @private
	 */
	async _calcAveragePetCompletion() {
		const cached = this._completionCache.pet;
		if (cached && (Date.now() - cached.ts) < this._completionCacheTTL) return cached.value;

		try {
			let pets = [];

			// Try metadata cache first
			const meta = await this.idbStorage.getMetadata('petsData', null);
			if (Array.isArray(meta) && meta.length > 0) {
				pets = meta;
			}

			// Fallback: IDB store with dedup
			if (pets.length === 0) {
				const raw = await this.idbStorage.getAll('pets', FETCH_LIMIT_LARGE);
				if (raw.length > 0) {
					const byId = {};
					for (const p of raw) {
						const key = p.petId || p.id;
						if (!byId[key] || (p.timestamp || '') > (byId[key].timestamp || '')) {
							byId[key] = p;
						}
					}
					pets = Object.values(byId);
				}
			}

			if (pets.length === 0) return 0;

			let total = 0;
			for (const p of pets) {
				total += PetCompletionCalculator.calculateCompletion(p).overall;
			}
			const avg = total / pets.length;
			this._completionCache.pet = { value: avg, ts: Date.now() };
			return avg;
		} catch {
			return 0;
		}
	}

	/**
	 * Count the total entries in an IndexedDB store.
	 *
	 * @param {string} storeName - IDB store name
	 * @returns {Promise<number>} Entry count (0 on error)
	 * @private
	 */
	async _countStore(storeName) {
		try {
			return await this.idbStorage.count(storeName);
		} catch {
			return 0;
		}
	}

	/**
	 * Safely call a synchronous function, returning a fallback on error.
	 *
	 * @param {Function} fn - Function to call
	 * @param {*} fallback - Fallback value on error
	 * @returns {*} Result or fallback
	 */
	_safeCall(fn, fallback) {
		try {
			return fn() ?? fallback;
		} catch {
			return fallback;
		}
	}

	/**
	 * Generate HTML for a stat card.
	 *
	 * @param {number|string} value - Stat value
	 * @param {string} label - Stat label
	 * @param {string} color - CSS color for the value
	 * @returns {string} HTML
	 */
	_statCard(value, label, color = '#4fc3f7') {
		return `
			<div class="oj-stat-card">
				<div class="oj-stat-value" style="color: ${color}">${value}</div>
				<div class="oj-stat-label">${label}</div>
			</div>
		`;
	}

	/**
	 * Escape HTML to prevent XSS in rendered content.
	 *
	 * Uses pure string replacement instead of DOM element allocation
	 * for better performance — avoids creating a throwaway element on
	 * every call (48+ call sites, many inside .map() loops).
	 *
	 * @param {string} str - Raw string
	 * @returns {string} HTML-safe string
	 */
	_escapeHtml(str) {
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	/**
	 * Format a timestamp as a human-readable relative time string (#123).
	 * Returns empty string if timestamp is falsy.
	 *
	 * @param {number|null} timestamp - Unix timestamp in ms (from Date.now())
	 * @returns {string} Relative time string, e.g. "2m ago", "3h ago", "1d ago"
	 */
	_timeAgo(timestamp) {
		return timeAgo(timestamp);
	}

	/**
	 * Render a tiny staleness indicator for dashboard cards (#123).
	 * Shows the relative time in a muted style. Warns if data is stale (>24h).
	 *
	 * @param {number|null} lastUpdate - Timestamp from metadata `lastUpdate`
	 * @returns {string} HTML string for the staleness indicator
	 */
	_stalenessTag(lastUpdate) {
		return stalenessTag(lastUpdate);
	}

	async _loadBattlesDataset() {
		let allBattles = [];
		try {
			allBattles = await this.idbStorage.getAll('battles', FETCH_LIMIT_LARGE);
		} catch { /* empty */ }

		allBattles.sort((a, b) => {
			const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
			const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
			return tb - ta;
		});

		return allBattles;
	}

	_getBattleTypeMetadata() {
		const types = [
			'Arena', 'GrandArena', 'TitanArena', 'GuildWar',
			'GuildRaid', 'RaidBoss', 'Dungeon', 'Tower', 'Adventure',
			'ClashOfWorlds', 'TournamentOfElements', 'Expedition',
		];
		const typeLabels = {
			Arena: 'Arena', GrandArena: 'Grand Arena', TitanArena: 'Titan Arena',
			GuildWar: 'Guild War', GuildRaid: 'Guild Raid', RaidBoss: 'Raid Boss',
			Dungeon: 'Dungeon', Tower: 'Tower', Adventure: 'Adventure',
			ClashOfWorlds: 'Clash of Worlds', TournamentOfElements: 'Tournament of Elements',
			Expedition: 'Expedition',
		};
		const typeIcons = {
			Arena: '\uD83C\uDFC6', GrandArena: '\uD83C\uDFDF\uFE0F',
			TitanArena: '\uD83D\uDCA0', GuildWar: '\u2694\uFE0F',
			GuildRaid: '\uD83D\uDC32', RaidBoss: '\uD83D\uDC79',
			Dungeon: '\uD83C\uDFF0', Tower: '\uD83D\uDDFC',
			Adventure: '\uD83D\uDDFA\uFE0F', ClashOfWorlds: '\uD83C\uDF0D',
			TournamentOfElements: '\uD83C\uDF29\uFE0F', Expedition: '\u26F5',
		};

		return { types, typeLabels, typeIcons };
	}

	_buildBattleTypeCounts(allBattles) {
		/** @type {Record<string, {count: number, wins: number}>} */
		const byType = {};
		for (const battle of allBattles) {
			const type = battle.battleType || 'Other';
			if (!byType[type]) byType[type] = { count: 0, wins: 0 };
			byType[type].count++;
			if (battle.isWin === true) byType[type].wins++;
		}
		return byType;
	}

	_renderBattleSubTabPills(vs, allBattles, byType, types, typeLabels, typeIcons) {
		const knownTypes = new Set(types);
		const allTypes = [...types.filter((type) => byType[type])];
		for (const type of Object.keys(byType)) {
			if (!knownTypes.has(type) && type !== 'Other') allTypes.push(type);
		}

		const subTabs = ['all', ...allTypes];
		return subTabs.map((type) => {
			const active = vs.subTab === type ? 'oj-pill-active' : '';
			if (type === 'all') {
				return `<button class="oj-pill oj-pill-btn ${active}" data-subtab="all">\uD83D\uDCCA All (${allBattles.length})</button>`;
			}

			const data = byType[type];
			const label = typeLabels[type] || type;
			const icon = typeIcons[type] || '\u2753';
			const wr = data.count > 0 ? ((data.wins / data.count) * 100).toFixed(0) : 0;
			return `<button class="oj-pill oj-pill-btn ${active}" data-subtab="${type}">${icon} ${label} ${data.count} (${wr}%)</button>`;
		}).join(' ');
	}

	_filterBattlesForView(allBattles, vs) {
		let filtered = vs.subTab === 'all'
			? allBattles
			: allBattles.filter((battle) => battle.battleType === vs.subTab);

		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			filtered = filtered.filter((battle) => {
				const opp = (battle.opponentName || battle.defenderId || battle.opponentId || '').toString().toLowerCase();
				return opp.includes(q);
			});
		}

		const fWins = filtered.filter((battle) => battle.isWin === true).length;
		const fLosses = filtered.length - fWins;
		const fWinRate = filtered.length > 0 ? ((fWins / filtered.length) * 100).toFixed(1) : '0.0';
		return { filtered, fWins, fLosses, fWinRate };
	}

	_buildBattleDetailId(battle, index) {
		const ts = String(battle.timestamp || index);
		const opp = String(battle.opponentId || battle.defenderId || battle.opponentName || 'na').replace(/\W+/g, '_');
		return `battle-${ts}-${opp}-${index}`;
	}

	_computeBattleDamageHealing(battle) {
		let totalDmg = 0;
		let totalHeal = 0;
		try {
			const team = battle.playerHeroes ? JSON.parse(battle.playerHeroes) : [];
			const flat = Array.isArray(team[0]) && Array.isArray(team[0][0]) ? team.flat() : team;
			for (const hero of flat) {
				if (Array.isArray(hero)) {
					totalDmg += hero[5] || 0;
					totalHeal += hero[6] || 0;
				}
			}
		} catch { /* empty */ }

		const raidDmgHtml = (battle.battleType === 'RaidBoss' && battle.damage > 0)
			? `<span class="oj-mono oj-dmg">${this._formatCompact(battle.damage)}</span>`
			: '';

		const dmgCell = raidDmgHtml || (totalDmg > 0 ? `<span class="oj-mono oj-dmg">${this._formatCompact(totalDmg)}</span>` : '\u2014');
		const healCell = totalHeal > 0 ? `<span class="oj-mono oj-heal">${this._formatCompact(totalHeal)}</span>` : '\u2014';
		return { dmgCell, healCell };
	}

	_buildBattleDetailFragments(battle) {
		let roundResultsHtml = '';
		if (battle.battleType === 'GrandArena' && battle.roundResults) {
			try {
				const rounds = JSON.parse(battle.roundResults);
				const pills = rounds.map((round, i) => {
					const cls = round.win ? 'oj-win' : 'oj-loss';
					return `<span class="oj-round-pill ${cls}" title="Round ${i + 1}: ${round.win ? 'Win' : 'Loss'} (${this._formatCompact(round.playerPower || 0)} vs ${this._formatCompact(round.opponentPower || 0)})">R${i + 1} ${round.win ? '\u2714' : '\u2718'}</span>`;
				}).join(' ');
				roundResultsHtml = `<div class="oj-round-results">${pills}</div>`;
			} catch { /* empty */ }
		}

		let powerHtml = '';
		if (battle.playerPower || battle.opponentPower) {
			powerHtml = `<span class="oj-mono oj-muted" title="Your power vs opponent power">${this._formatCompact(battle.playerPower || 0)} vs ${this._formatCompact(battle.opponentPower || 0)}</span>`;
		}

		const playerTeamHtml = this._renderBattleTeam(battle.playerHeroes, '\uD83D\uDDE1\uFE0F Attack');
		const opponentTeamHtml = this._renderBattleTeam(battle.opponentHeroes, '\uD83D\uDEE1\uFE0F Defense');
		const hasDetail = playerTeamHtml || opponentTeamHtml || roundResultsHtml || powerHtml;
		return { roundResultsHtml, powerHtml, playerTeamHtml, opponentTeamHtml, hasDetail };
	}

	_renderBattleRows(pageItems, typeLabels) {
		return pageItems.map((battle, index) => {
			const time = battle.timestamp ? new Date(battle.timestamp).toLocaleString() : '\u2014';
			const result = battle.isWin === true
				? '<span class="oj-win">WIN</span>'
				: '<span class="oj-loss">LOSS</span>';
			const opponent = battle.opponentName || battle.defenderId || battle.opponentId || '\u2014';
			const type = typeLabels[battle.battleType] || battle.battleType || '\u2014';

			let rankHtml = '\u2014';
			if (battle.rankBefore || battle.rankAfter) {
				const before = battle.rankBefore ? `#${battle.rankBefore}` : '?';
				const after = battle.rankAfter ? `#${battle.rankAfter}` : '?';
				if (battle.rankBefore && battle.rankAfter) {
					const delta = battle.rankBefore - battle.rankAfter;
					const cls = delta > 0 ? 'oj-win' : delta < 0 ? 'oj-loss' : 'oj-muted';
					const arrow = delta > 0 ? '\u25B2' : delta < 0 ? '\u25BC' : '\u25CF';
					rankHtml = `<span class="${cls}">${before}\u2192${after} ${arrow}</span>`;
				} else {
					rankHtml = `${before}\u2192${after}`;
				}
			}

			const { dmgCell, healCell } = this._computeBattleDamageHealing(battle);
			const { roundResultsHtml, powerHtml, playerTeamHtml, opponentTeamHtml, hasDetail } = this._buildBattleDetailFragments(battle);
			const battleId = this._buildBattleDetailId(battle, index);

			return `
				<tr class="${hasDetail ? 'oj-battle-row' : ''}" data-battle-id="${battleId}">
					<td class="oj-mono">${time}</td>
					<td>${type}</td>
					<td>${this._escapeHtml(String(opponent))}</td>
					<td>${rankHtml}</td>
					<td>${dmgCell}</td>
					<td>${healCell}</td>
					<td>${result}</td>
				</tr>
				${hasDetail ? `<tr class="oj-battle-detail" data-detail-for="${battleId}" style="display:none">
					<td colspan="7">
						<div class="oj-battle-teams">
							${powerHtml ? `<div class="oj-battle-power">\u26A1 ${powerHtml}</div>` : ''}
							${roundResultsHtml}
							${playerTeamHtml}
							${opponentTeamHtml}
						</div>
					</td>
				</tr>` : ''}
			`;
		}).join('');
	}

	async _loadTitansRoster() {
		let titans = [];
		try {
			const cached = await this.idbStorage.getMetadata('titansData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				titans = cached;
			}
		} catch { /* empty */ }

		if (titans.length === 0) {
			try {
				const raw = await this.idbStorage.getAll('titans', FETCH_LIMIT_LARGE);
				const all = decompressTitanStore(raw);
				if (all.length > 0) {
					const byId = {};
					for (const titan of all) {
						const key = titan.titanId || titan.id;
						if (!byId[key] || (titan.timestamp || '') > (byId[key].timestamp || '')) {
							byId[key] = titan;
						}
					}
					titans = Object.values(byId);
				}
			} catch { /* empty */ }
		}

		return titans;
	}

	_buildTitanCompletionMap(titans, TCalc) {
		const completionMap = {};
		for (const titan of titans) {
			const key = titan.titanId || titan.id;
			completionMap[key] = TCalc.calculateCompletion(titan);
		}
		return completionMap;
	}

	_renderTitanRows(pageItems, completionMap, TCalc) {
		return pageItems.map((titan) => {
			const titanId = titan.titanId || titan.id;
			const localizedName = this._resolveEntityName(Number(titanId));
			const name = this._escapeHtml(this._pickBestInventoryLabel([localizedName, titan.titanName, titan.name]) || `Titan #${titanId}`);
			const elementDisplay = TCalc.formatElement(titan.element);
			const comp = completionMap[titanId] || { overall: 0, systems: {} };

			const avatarUrl = `https://calc2.hw-assist.com/static/assets/images/titan_icons/titan_icon_${titanId}.png`;

			const artifacts = TCalc.parseArtifacts(titan);
			const artifactIcons = artifacts.length > 0
				? artifacts.map((art) => {
					const borderClass = TCalc.artifactStarClass(art.star);
					const starTip = `${art.star}\u2605 L${art.level}`;
					return `<div class="oj-artifact-icon ${borderClass}" title="${starTip}">` +
						`<span class="oj-artifact-star">${art.star}\u2B50</span>` +
						`<span class="oj-artifact-level">${art.level}</span>` +
						`</div>`;
				}).join('')
				: '<span class="oj-muted">\u2014</span>';

			const totemLevel = titan.totemLevel || 0;
			const totemStar = titan.totemStar || 0;
			const totemDisplay = (totemLevel > 0 || totemStar > 0)
				? `${elementDisplay}<br><span class="oj-totem-stats">${totemStar}\u2B50 L${totemLevel}</span>`
				: elementDisplay;

			const sysRows = Object.entries(TCalc.SYSTEM_LABELS).map(([key, label]) => {
				const pct = comp.systems[key] || 0;
				return `<div class="oj-sys-row">` +
					`<span class="oj-sys-icon">${TCalc.SYSTEM_ICONS[key] || ''}</span>` +
					`<span class="oj-sys-name">${label}</span>` +
					TCalc.renderBar(pct) +
					`</div>`;
			}).join('');

			return `
				<tr class="oj-titan-row" data-titan-id="${titanId}">
					<td class="oj-avatar-cell"><img class="oj-hero-avatar" src="${avatarUrl}" alt="${name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='';this.alt='\uD83D\uDCA0';this.className='oj-avatar-fallback'"></td>
					<td><strong>${name}</strong></td>
					<td>${titan.level || '\u2014'}</td>
					<td>${'\u2B50'.repeat(Math.min(titan.stars || 0, 6)) || '\u2014'}</td>
					<td>${totemDisplay}</td>
					<td class="oj-artifact-cell"><div class="oj-artifact-col">${artifactIcons}</div></td>
					<td class="oj-num">${titan.power ? titan.power.toLocaleString() : '\u2014'}</td>
					<td class="oj-completion-cell">${TCalc.renderBar(comp.overall)}</td>
				</tr>
				<tr class="oj-titan-detail" data-detail-for="${titanId}" style="display:none">
					<td colspan="8">
						<div class="oj-sys-breakdown">${sysRows}</div>
					</td>
				</tr>
			`;
		}).join('');
	}

	async _loadPetsRoster() {
		let pets = [];
		try {
			const cached = await this.idbStorage.getMetadata('petsData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				pets = cached;
			}
		} catch { /* empty */ }

		if (pets.length === 0) {
			try {
				const raw = await this.idbStorage.getAll('pets', FETCH_LIMIT_MEDIUM);
				if (raw.length > 0) {
					const byId = {};
					for (const pet of raw) {
						const key = pet.petId || pet.id;
						if (!byId[key] || (pet.timestamp || '') > (byId[key].timestamp || '')) {
							byId[key] = pet;
						}
					}
					pets = Object.values(byId);
				}
			} catch { /* empty */ }
		}

		return pets;
	}

	_buildPetCompletionMap(pets, PCalc) {
		const completionMap = {};
		for (const pet of pets) {
			const key = pet.petId || pet.id;
			completionMap[key] = PCalc.calculateCompletion(pet);
		}
		return completionMap;
	}

	_renderPetRows(pageItems, completionMap, PCalc) {
		return pageItems.map((pet) => {
			const petId = pet.petId || pet.id;
			const localizedName = this._resolveEntityName(Number(petId));
			const name = this._escapeHtml(this._pickBestInventoryLabel([localizedName, pet.petName, pet.name]) || `Pet #${petId}`);
			const comp = completionMap[petId] || { overall: 0, systems: {} };
			const patronageCount = PCalc.countPatronage(pet.patronageData);
			const avatarUrl = `https://calc2.hw-assist.com/static/assets/images/hero_icons/${String(petId).padStart(4, '0')}.png`;

			const sysRows = Object.entries(PCalc.SYSTEM_LABELS).map(([key, label]) => {
				const pct = comp.systems[key] || 0;
				return `<div class="oj-sys-row">` +
					`<span class="oj-sys-icon">${PCalc.SYSTEM_ICONS[key] || ''}</span>` +
					`<span class="oj-sys-name">${label}</span>` +
					PCalc.renderBar(pct) +
					`</div>`;
			}).join('');

			const patronageInfo = patronageCount > 0
				? `<div class="oj-pet-patronage">\uD83D\uDC64 Supporting ${patronageCount} hero${patronageCount !== 1 ? 'es' : ''}</div>`
				: '';

			const colorVal = pet.color || 0;
			const colorName = this._colorRankName(colorVal);
			const colorClass = this._colorRankClass(colorVal);

			return `
				<tr class="oj-pet-row" data-pet-id="${petId}">
					<td class="oj-avatar-cell"><img class="oj-hero-avatar ${colorClass}" src="${avatarUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'"></td>
					<td><strong>${name}</strong></td>
					<td>${pet.level || '\u2014'}</td>
					<td>${'\u2B50'.repeat(Math.min(pet.stars || pet.star || 0, 6)) || '\u2014'}</td>
					<td class="${colorClass}">${colorName}</td>
					<td class="oj-num">${pet.power ? pet.power.toLocaleString() : '\u2014'}</td>
					<td class="oj-completion-cell">${PCalc.renderBar(comp.overall)}</td>
				</tr>
				<tr class="oj-pet-detail" data-detail-for="${petId}" style="display:none">
					<td colspan="7">
						<div class="oj-sys-breakdown">${sysRows}</div>
						${patronageInfo}
					</td>
				</tr>
			`;
		}).join('');
	}

	async _renderPetSoulStonesSection(pets, PCalc, STAR_COSTS_CUMULATIVE, STAR_COSTS_INCREMENTAL, MAX_STONES_PER_PET) {
		try {
			const invData = await this.idbStorage.getMetadata('inventoryData', null);
			const fragPet = (invData && invData.fragmentPet) ? invData.fragmentPet : {};

			const petStoneSummary = [];
			let totalUsable = 0;
			let totalNeeded = 0;
			let totalAvailable = 0;

			for (const pet of pets) {
				const petId = pet.petId || pet.id;
				const curStars = Math.min(pet.stars || pet.star || 0, 6);
				const stonesOwned = fragPet[petId] || fragPet[String(petId)] || 0;
				const alreadyUsed = STAR_COSTS_CUMULATIVE[curStars] || 0;
				const neededToMax = MAX_STONES_PER_PET - alreadyUsed;
				const nextStarCost = curStars < 6 ? STAR_COSTS_INCREMENTAL[curStars] : 0;
				const usable = Math.min(stonesOwned, neededToMax);

				totalAvailable += stonesOwned;
				totalUsable += usable;
				totalNeeded += neededToMax;

				const localizedName = this._resolveEntityName(Number(petId));
				const petName = this._escapeHtml(this._pickBestInventoryLabel([localizedName, pet.petName, pet.name]) || `Pet #${petId}`);
				petStoneSummary.push({ petName, curStars, stonesOwned, neededToMax, nextStarCost, usable });
			}

			const pct = totalNeeded > 0 ? Math.min(100, (totalUsable / totalNeeded) * 100) : 100;
			const barColor = PCalc.colorClass(pct);

			const stoneRows = petStoneSummary.map((stone) => {
				const starDisplay = '\u2B50'.repeat(Math.min(stone.curStars, 6));
				const isMaxed = stone.curStars >= 6;
				const nextInfo = isMaxed
					? '<span class="oj-muted">MAX</span>'
					: `${stone.nextStarCost} to ${stone.curStars + 1}\u2605`;
				const statusClass = isMaxed ? 'oj-muted' : (stone.stonesOwned >= stone.nextStarCost && stone.curStars < 6) ? 'oj-text-green' : '';
				return `<tr class="${statusClass}">` +
					`<td>${stone.petName}</td>` +
					`<td>${starDisplay || '\u2014'}</td>` +
					`<td class="oj-num">${stone.stonesOwned.toLocaleString()}</td>` +
					`<td class="oj-num">${nextInfo}</td>` +
					`<td class="oj-num">${isMaxed ? '\u2014' : stone.neededToMax.toLocaleString()}</td>` +
					`</tr>`;
			}).join('');

			return `
				<div class="oj-pet-soulstones">
					<div class="oj-pet-soulstones-label">
						\uD83D\uDC8E Pet Soul Stones: <strong>${totalUsable.toLocaleString()}</strong> usable of <strong>${totalAvailable.toLocaleString()}</strong> in inventory / <strong>${totalNeeded.toLocaleString()}</strong> needed to max all
					</div>
					<div class="oj-completion-bar oj-pet-soulstones-bar">
						<div class="oj-completion-fill oj-completion-${barColor}" style="width:${pct.toFixed(1)}%"></div>
						<div class="oj-completion-label">${totalUsable.toLocaleString()} / ${totalNeeded.toLocaleString()}</div>
					</div>
					<details class="oj-soulstone-details">
						<summary>Per-pet breakdown</summary>
						<table class="oj-table oj-soulstone-table">
							<thead><tr><th>Pet</th><th>Stars</th><th>Have</th><th>Next \u2605</th><th>To Max</th></tr></thead>
							<tbody>${stoneRows}</tbody>
						</table>
					</details>
				</div>
			`;
		} catch {
			return '';
		}
	}

	async _loadInventoryItems() {
		let items = [];
		const itemNameCatalog = await this._buildItemNameCatalog();
		try {
			const rawData = await this.idbStorage.getMetadata('inventoryData', null);
			if (rawData && typeof rawData === 'object') {
				items = this._parseRawInventory(rawData, itemNameCatalog);
			}
		} catch { /* empty */ }

		if (items.length === 0) {
			try {
				const snapshots = await this.idbStorage.getPage('inventory', { limit: 1, direction: 'prev' });
				if (snapshots.length > 0 && snapshots[0].inventoryData) {
					const rawData = typeof snapshots[0].inventoryData === 'string'
						? JSON.parse(snapshots[0].inventoryData)
						: snapshots[0].inventoryData;
					items = this._parseRawInventory(rawData, itemNameCatalog);
				}
			} catch { /* empty */ }
		}

		return items;
	}

	/**
	 * Build merged inventory name catalog from captured metadata and game client runtime libs.
	 *
	 * @returns {Promise<Record<string, string>>} Name map keyed by category/id tokens
	 * @private
	 */
	async _buildItemNameCatalog() {
		const now = Date.now();
		if (now - this._runtimeItemNameCatalogTs < this._runtimeItemNameCatalogTtl && Object.keys(this._runtimeItemNameCatalog).length > 0) {
			return this._runtimeItemNameCatalog;
		}

		const catalog = {};
		const seen = new WeakSet();
		let storedCatalog = {};
		const mergeCatalog = (source) => {
			for (const [key, value] of Object.entries(source || {})) {
				const label = String(value || '').trim();
				if (!label) continue;
				catalog[key] = label;
			}
		};

		try {
			const stored = await this.idbStorage.getMetadata('itemNameCatalog', null);
			storedCatalog = stored?.items || stored || {};
			mergeCatalog(storedCatalog);
		} catch { /* empty */ }

		try {
			const gameSettings = await this.idbStorage.getMetadata('gameSettings', null);
			if (gameSettings) {
				this._collectItemNamesFromAnySource(gameSettings, catalog, 0, seen);
			}
		} catch { /* empty */ }

		try {
			const billingCatalog = await this.idbStorage.getMetadata('billingCatalog', null);
			if (billingCatalog) {
				this._collectItemNamesFromAnySource(billingCatalog, catalog, 0, seen);
			}
		} catch { /* empty */ }

		this._collectItemNamesFromAnySource(PAGE_WINDOW?.lib || null, catalog, 0, seen);
		this._collectItemNamesFromAnySource(PAGE_WINDOW?.nxg?.lib || null, catalog, 0, seen);
		this._collectItemNamesFromAnySource(PAGE_WINDOW?.nxg?.data?.lib || null, catalog, 0, seen);
		this._collectItemNamesFromAnySource(PAGE_WINDOW?.nxg?.config?.lib || null, catalog, 0, seen);

		this._runtimeItemNameCatalog = catalog;
		this._runtimeItemNameCatalogTs = now;

		try {
			if (Object.keys(catalog).length > Object.keys(storedCatalog || {}).length) {
				await this.idbStorage.setMetadata('itemNameCatalog', {
					items: catalog,
					updatedAt: new Date(now).toISOString(),
					count: Object.keys(catalog).length,
				});
			}
		} catch { /* non-critical */ }

		return catalog;
	}

	/**
	 * Collect inventory item names recursively from candidate source trees.
	 *
	 * @param {any} source - Candidate source object
	 * @param {Record<string, string>} outCatalog - Mutable output catalog
	 * @param {number} depth - Current recursion depth
	 * @param {WeakSet<object>} seen - Visited node tracker
	 * @private
	 */
	_collectItemNamesFromAnySource(source, outCatalog, depth, seen) {
		if (!source || typeof source !== 'object') return;
		if (depth > 3) return;
		if (seen.has(source)) return;
		seen.add(source);

		const inventoryCategoryKeys = [
			'consumable', 'gear', 'scroll', 'coin', 'fragmentGear', 'fragmentScroll',
			'ascensionGear', 'fragmentTitanArtifact', 'bannerStone', 'petGear',
			'fragmentArtifact', 'fragmentHero', 'fragmentTitan', 'fragmentPet',
		];

		for (const key of inventoryCategoryKeys) {
			const categoryMap = source?.[key];
			if (categoryMap && typeof categoryMap === 'object') {
				this._collectItemNamesFromCategoryMap(key, categoryMap, outCatalog);
			}
		}

		this._collectItemNamesFromTokenMap(source, outCatalog);

		for (const child of Object.values(source)) {
			if (child && typeof child === 'object') {
				this._collectItemNamesFromAnySource(child, outCatalog, depth + 1, seen);
			}
		}
	}

	/**
	 * Collect names from a category map (`category -> { id -> descriptor }`).
	 *
	 * @param {string} categoryKey - Inventory category key
	 * @param {Record<string, any>} categoryMap - Category map
	 * @param {Record<string, string>} outCatalog - Output catalog
	 * @private
	 */
	_collectItemNamesFromCategoryMap(categoryKey, categoryMap, outCatalog) {
		for (const [itemId, descriptor] of Object.entries(categoryMap || {})) {
			if (!/^\d+$/.test(String(itemId))) continue;
			const label = this._extractPotentialItemLabel(descriptor);
			if (!label) continue;
			outCatalog[`${categoryKey}:${itemId}`] = label;
			outCatalog[`${categoryKey}${itemId}`] = label;
			outCatalog[`item:${itemId}`] = label;
		}
	}

	/**
	 * Collect names from flattened token maps (`consumable173: { name: ... }`).
	 *
	 * @param {Record<string, any>} source - Candidate map
	 * @param {Record<string, string>} outCatalog - Output catalog
	 * @private
	 */
	_collectItemNamesFromTokenMap(source, outCatalog) {
		const tokenPattern = /^(consumable|gear|scroll|coin|fragmentGear|fragmentScroll|ascensionGear|fragmentTitanArtifact|bannerStone|petGear|fragmentArtifact|fragmentHero|fragmentTitan|fragmentPet)(\d+)$/;
		for (const [key, value] of Object.entries(source || {})) {
			const match = key.match(tokenPattern);
			if (!match) continue;
			const label = this._extractPotentialItemLabel(value);
			if (!label) continue;
			const categoryKey = match[1];
			const itemId = match[2];
			outCatalog[`${categoryKey}:${itemId}`] = label;
			outCatalog[`${categoryKey}${itemId}`] = label;
			outCatalog[`item:${itemId}`] = label;
		}
	}

	/**
	 * Extract a potential human-readable item label from varied descriptor structures.
	 *
	 * @param {any} descriptor - Candidate descriptor payload
	 * @returns {string} Resolved label or empty string
	 * @private
	 */
	_extractPotentialItemLabel(descriptor) {
		if (!descriptor) return '';
		if (typeof descriptor === 'string') {
			const resolved = this._resolveLocaleToken(descriptor);
			return this._isPlaceholderItemLabel(resolved) ? '' : resolved;
		}
		if (typeof descriptor !== 'object') return '';

		const preferredLanguage = this._normalizeUiLanguage(this._uiLanguage || this.prefStorage.get('uiLanguage', 'en'));
		const localeKeys = this._buildLanguageLookupOrder(preferredLanguage);

		const localeCandidates = [];
		const localeSources = [
			descriptor.localeData,
			descriptor.locale,
			descriptor.translations,
			descriptor.i18n,
			descriptor.nameByLocale,
			descriptor.titleByLocale,
			descriptor.names,
			descriptor.titles,
		];

		for (const localeMap of localeSources) {
			if (!localeMap || typeof localeMap !== 'object') continue;
			for (const key of localeKeys) {
				if (typeof localeMap[key] === 'string') {
					localeCandidates.push(localeMap[key]);
				}
			}
		}

		const candidates = [
			...localeCandidates,
			...this._buildDescriptorLanguageFieldCandidates(descriptor, preferredLanguage),
			...this._buildDescriptorLanguageFieldCandidates(descriptor, 'en'),
			descriptor.en,
			descriptor.enUS,
			descriptor.en_us,
			descriptor.english,
			descriptor.displayName,
			descriptor.display_name,
			descriptor.localizedName,
			descriptor.nameEn,
			descriptor.name_en,
			descriptor.name,
			descriptor.title,
			descriptor.label,
			descriptor.caption,
			descriptor.localeId,
			descriptor.nameLocaleId,
			descriptor.titleLocaleId,
			descriptor.translationKey,
			descriptor.locale?.title,
			descriptor.locale?.name,
			descriptor.clientData?.locale?.title,
			descriptor.clientData?.locale?.name,
		];

		for (const candidate of candidates) {
			if (!candidate || typeof candidate !== 'string') continue;
			const resolved = this._resolveLocaleToken(candidate);
			if (resolved && !this._isPlaceholderItemLabel(resolved)) return resolved;
		}

		return '';
	}

	/**
	 * Build ordered language key lookup list (selected language first, English fallback).
	 *
	 * @param {string} preferredLanguage - Preferred language code
	 * @returns {string[]} Ordered language keys
	 * @private
	 */
	_buildLanguageLookupOrder(preferredLanguage) {
		const preferred = this._buildLanguageKeyCandidates(preferredLanguage);
		const english = this._buildLanguageKeyCandidates('en');
		return [...new Set([...preferred, ...english])];
	}

	/**
	 * Collect language-specific descriptor fields (e.g. `nameDe`, `fr`, `title_tr`).
	 *
	 * @param {Record<string, any>} descriptor - Source descriptor object
	 * @param {string} language - Language code
	 * @returns {string[]} Candidate localized fields
	 * @private
	 */
	_buildDescriptorLanguageFieldCandidates(descriptor, language) {
		if (!descriptor || typeof descriptor !== 'object') return [];

		const code = this._normalizeUiLanguage(language || 'en');
		const upper = code.toUpperCase();
		const titleCode = upper.charAt(0) + upper.slice(1).toLowerCase();
		const regional = code === 'en' ? 'US' : upper;

		const keys = [
			code,
			upper,
			`${code}_${regional}`,
			`${code}-${regional}`,
			`${code}US`,
			`name${titleCode}`,
			`name_${code}`,
			`name${upper}`,
			`title${titleCode}`,
			`title_${code}`,
			`title${upper}`,
			`displayName${titleCode}`,
			`localizedName${titleCode}`,
			`${code}Name`,
			`${code}_name`,
		].filter(Boolean);

		const values = [];
		for (const key of keys) {
			const value = descriptor[key];
			if (typeof value === 'string' && value.trim()) {
				values.push(value);
			}
		}

		return values;
	}

	/**
	 * Choose best usable label for the current preferred UI language.
	 *
	 * @param {Array<any>} candidates - Candidate labels
	 * @returns {string} Selected label or empty
	 * @private
	 */
	_pickBestInventoryLabel(candidates) {
		const filtered = (candidates || [])
			.map((value) => String(value || '').trim())
			.filter((value) => value.length > 0)
			.filter((value) => !this._isPlaceholderItemLabel(value));

		if (filtered.length === 0) return '';

		const preferredLanguage = this._normalizeUiLanguage(this._uiLanguage || this.prefStorage.get('uiLanguage', 'en'));
		const hasCyrillic = (value) => this._isCyrillicText(value);
		const nonCyrillic = filtered.filter((value) => !hasCyrillic(value));
		const cyrillic = filtered.filter((value) => hasCyrillic(value));

		if (preferredLanguage === 'ru') {
			if (cyrillic.length > 0) return cyrillic[0];
			if (nonCyrillic.length > 0) return nonCyrillic[0];
			return '';
		}

		// Prefer language-scored non-Cyrillic labels first, then Cyrillic fallback.
		if (nonCyrillic.length > 0) {
			const ranked = [...nonCyrillic]
				.map((value) => ({ value, score: this._scoreLabelForLanguage(value, preferredLanguage) }))
				.sort((a, b) => b.score - a.score);
			return ranked[0]?.value || nonCyrillic[0];
		}
		if (cyrillic.length > 0) return cyrillic[0];
		return '';
	}

	/**
	 * Score label fit for selected language based on script and language-specific glyphs.
	 *
	 * @param {string} value - Candidate label
	 * @param {string} language - Preferred language code
	 * @returns {number} Higher score is better
	 * @private
	 */
	_scoreLabelForLanguage(value, language) {
		const text = String(value || '').trim();
		if (!text) return 0;

		const normalized = this._normalizeUiLanguage(language || this._uiLanguage || 'en');
		const lower = text.toLowerCase();

		if (normalized === 'ru') {
			return this._isCyrillicText(text) ? 100 : 10;
		}

		if (this._isCyrillicText(text)) {
			return 1;
		}

		const accentsByLanguage = {
			de: /[äöüß]/i,
			fr: /[àâæçéèêëîïôœùûüÿ]/i,
			es: /[áéíóúñ¿¡]/i,
			it: /[àèéìíîòóù]/i,
			pt: /[ãõáàâéêíóôúç]/i,
			tr: /[çğıöşüİı]/i,
		};

		let score = 20;
		if (/^[\x20-\x7E]+$/.test(text)) score += 10;

		const accentPattern = accentsByLanguage[normalized];
		if (accentPattern) {
			if (accentPattern.test(text)) score += 50;
			else score += 5;
		}

		if (normalized === 'en') {
			if (/^[A-Za-z0-9\s'().,:\-/+&]+$/.test(text)) score += 30;
			if (/[à-ž]/i.test(text)) score -= 5;
		}

		const articleHints = {
			de: /\b(der|die|das|ein|eine)\b/i,
			fr: /\b(le|la|les|de|du|des)\b/i,
			es: /\b(el|la|los|las|de|del)\b/i,
			it: /\b(il|lo|la|gli|le|di|del)\b/i,
			pt: /\b(o|a|os|as|de|do|da)\b/i,
			tr: /\b(ve|ile|bir)\b/i,
		};

		if (articleHints[normalized]?.test(lower)) {
			score += 8;
		}

		return score;
	}

	/**
	 * Determine whether text contains Cyrillic characters.
	 *
	 * @param {string} value - Candidate text
	 * @returns {boolean} True when text contains Cyrillic letters
	 * @private
	 */
	_isCyrillicText(value) {
		return /[\u0400-\u04FF]/.test(String(value || ''));
	}

	/**
	 * Build language key aliases for translation map lookups.
	 *
	 * @param {string} language - Language code
	 * @returns {string[]} Language key candidates
	 * @private
	 */
	_buildLanguageKeyCandidates(language) {
		const normalized = this._normalizeUiLanguage(language || this._uiLanguage || 'en');
		const upper = normalized.toUpperCase();
		const baseKeys = [
			normalized,
			upper,
			`${normalized}_${upper}`,
			`${normalized}-${upper}`,
		];

		const languageAliases = {
			en: ['english', 'en_us', 'en-US', 'en_gb', 'en-GB'],
			ru: ['russian', 'ru_ru', 'ru-RU'],
			de: ['german', 'de_de', 'de-DE'],
			fr: ['french', 'fr_fr', 'fr-FR'],
			es: ['spanish', 'es_es', 'es-ES', 'es_mx', 'es-MX'],
			it: ['italian', 'it_it', 'it-IT'],
			pt: ['portuguese', 'pt_pt', 'pt-PT', 'pt_br', 'pt-BR'],
			tr: ['turkish', 'tr_tr', 'tr-TR'],
		};

		const keys = [...baseKeys, ...(languageAliases[normalized] || [])];

		return [...new Set(keys.filter(Boolean))];
	}

	/**
	 * Resolve locale token from runtime translation dictionaries.
	 *
	 * @param {string} localeToken - Locale token key
	 * @param {string} language - Requested language code
	 * @returns {string} Resolved label or empty string
	 * @private
	 */
	_resolveTokenFromTranslationMaps(localeToken, language) {
		const token = String(localeToken || '').trim();
		if (!token) return '';

		const tryGetToken = (container) => {
			if (!container || typeof container !== 'object') return '';

			const direct = container[token];
			if (typeof direct === 'string' && direct.trim()) {
				return String(direct).trim();
			}

			const nestedKeys = ['messages', 'data', 'values', 'dictionary', 'dict', 'translations'];
			for (const nestedKey of nestedKeys) {
				const nested = container[nestedKey];
				if (!nested || typeof nested !== 'object') continue;

				const nestedValue = nested[token];
				if (typeof nestedValue === 'string' && nestedValue.trim()) {
					return String(nestedValue).trim();
				}
			}

			return '';
		};

		const preferredLangKeys = this._buildLanguageKeyCandidates(language);
		const fallbackLangKeys = this._buildLanguageKeyCandidates('en');
		const sourceMaps = [
			PAGE_WINDOW?.nxg?.i18n?.translations,
			PAGE_WINDOW?.nxg?.i18n?.store?.translations,
			PAGE_WINDOW?.i18n?.translations,
			PAGE_WINDOW?.translations,
			PAGE_WINDOW?.lib?.locale,
			PAGE_WINDOW?.lib?.translations,
			PAGE_WINDOW?.nxg?.lib?.locale,
			PAGE_WINDOW?.nxg?.data?.lib?.locale,
			PAGE_WINDOW?.nxg?.config?.lib?.locale,
		].filter((source) => source && typeof source === 'object');

		for (const source of sourceMaps) {
			const direct = tryGetToken(source);
			if (direct && !this._isPlaceholderItemLabel(direct) && (language === 'ru' || !this._isCyrillicText(direct))) {
				return direct;
			}

			for (const langKey of [...preferredLangKeys, ...fallbackLangKeys]) {
				const bucket = source?.[langKey];
				const bucketValue = tryGetToken(bucket);
				if (!bucketValue || this._isPlaceholderItemLabel(bucketValue)) continue;
				if (language !== 'ru' && this._isCyrillicText(bucketValue)) continue;
				return bucketValue;
			}
		}

		return '';
	}

	/**
	 * Detect unresolved placeholder-like labels.
	 *
	 * @param {string} value - Candidate label
	 * @returns {boolean} True when value is unresolved placeholder text
	 * @private
	 */
	_isPlaceholderItemLabel(value) {
		const text = String(value || '').trim();
		if (!text) return true;

		if (/^Hero_\d+$/i.test(text)) return true;
		if (/^(consumable|gear|scroll|coin|fragment[a-z]*|petGear|bannerStone)_\d+$/i.test(text)) return true;
		if (/^[A-Z0-9_]{6,}$/.test(text)) return true;
		if (/^LIB[ _]/i.test(text)) return true;
		if (/^BUNDLE[ _]/i.test(text)) return true;
		if (/^(Artifact|Titan Artifact|Hero|Titan|Pet|Gear|Scroll|Consumable|Coin|Item|Resource|Unknown|Entity)( Fragment)?\s*#?\s*\d+( Stones?)?$/i.test(text)) {
			return true;
		}

		return false;
	}

	/**
	 * Resolve locale token to display label using available game translation functions.
	 *
	 * @param {string} token - Raw token or plain text
	 * @returns {string} Resolved label
	 * @private
	 */
	_resolveLocaleToken(token) {
		const raw = String(token || '').trim();
		if (!raw) return '';
		const preferredLanguage = this._normalizeUiLanguage(this._uiLanguage || this.prefStorage.get('uiLanguage', 'en'));
		const lookupTokens = this._buildLocaleTokenCandidates(raw);
		let cyrillicFallback = '';

		for (const localeToken of lookupTokens) {
			const preferredLookup = this._resolveTokenFromTranslationMaps(localeToken, preferredLanguage);
			if (preferredLookup) {
				return preferredLookup;
			}

			if (preferredLanguage !== 'en') {
				const englishFallbackLookup = this._resolveTokenFromTranslationMaps(localeToken, 'en');
				if (englishFallbackLookup) {
					return englishFallbackLookup;
				}
			}
		}

		const tryTranslate = (translate) => {
			for (const localeToken of lookupTokens) {
				const candidates = [
					() => translate(localeToken),
					() => translate(localeToken, preferredLanguage),
					() => translate(localeToken, { lang: preferredLanguage, locale: preferredLanguage, lng: preferredLanguage, language: preferredLanguage }),
					() => translate(localeToken, undefined, preferredLanguage),
				];

				for (const attempt of candidates) {
					try {
						const translated = String(attempt() || '').trim();
						if (!translated || translated === raw || translated === localeToken) continue;
						if (/^[A-Z0-9_]+$/.test(translated)) continue;
						if (this._isPlaceholderItemLabel(translated)) continue;

						if (preferredLanguage !== 'ru' && this._isCyrillicText(translated)) {
							if (!cyrillicFallback) cyrillicFallback = translated;
							continue;
						}

						if (preferredLanguage === 'ru' && !this._isCyrillicText(translated) && /^[A-Za-z\s\-:'(),.]+$/.test(translated)) {
							if (!/^[A-Z0-9_]+$/.test(localeToken)) {
								return translated;
							}
							continue;
						}

						return translated;
					} catch {
						// ignore attempt failures
					}
				}
			}

			return '';
		};

		const translators = [
			PAGE_WINDOW?.nxg?.i18n?.t,
			PAGE_WINDOW?.nxg?.i18n?.translate,
			PAGE_WINDOW?.nxg?.translate,
			PAGE_WINDOW?.i18n?.t,
			PAGE_WINDOW?.gettext,
		].filter((fn) => typeof fn === 'function');

		for (const translate of translators) {
			const translated = tryTranslate(translate);
			if (translated) {
				return translated;
			}
		}

		if (/^Hero_\d+$/i.test(raw)) {
			const idMatch = raw.match(/^Hero_(\d+)$/i);
			if (idMatch) {
				const entityName = this._resolveEntityName(Number(idMatch[1]));
				if (entityName && !this._isPlaceholderItemLabel(entityName)) {
					return entityName;
				}
			}
		}

		if (/^[A-Z0-9_]+$/.test(raw)) {
			const fallback = this._prettifyLocaleToken(raw);
			return this._isPlaceholderItemLabel(fallback) ? '' : fallback;
		}

		if (/^[a-z]+_\d+$/i.test(raw)) {
			const fallback = this._prettifyLocaleToken(raw.toUpperCase());
			return this._isPlaceholderItemLabel(fallback) ? '' : fallback;
		}

		if (cyrillicFallback) {
			return cyrillicFallback;
		}

		return this._isPlaceholderItemLabel(raw) ? '' : raw;
	}

	/**
	 * Build translation-key candidates for common item token formats.
	 *
	 * @param {string} rawToken - Raw token string
	 * @returns {string[]} Candidate translation keys
	 * @private
	 */
	_buildLocaleTokenCandidates(rawToken) {
		const raw = String(rawToken || '').trim();
		if (!raw) return [];

		const out = new Set([raw]);
		const compactToken = raw.replace(/\s+/g, '_');
		out.add(compactToken);

		const simpleMatch = compactToken.match(/^([a-z_]+?)[_-](\d+)$/i);
		if (simpleMatch) {
			const stem = simpleMatch[1].toUpperCase();
			const id = simpleMatch[2];
			out.add(`LIB_${stem}_NAME_${id}`);
			out.add(`LIB_${stem}_${id}`);
		}

		const heroMatch = raw.match(/^Hero_(\d+)$/i);
		if (heroMatch) {
			const id = heroMatch[1];
			out.add(`LIB_HERO_NAME_${id}`);
			out.add(`LIB_TITAN_NAME_${id}`);
			out.add(`LIB_PET_NAME_${id}`);
		}

		return [...out];
	}

	/**
	 * Prettify unresolved locale token into readable fallback text.
	 *
	 * @param {string} token - Locale token
	 * @returns {string} Human-readable label
	 * @private
	 */
	_prettifyLocaleToken(token) {
		return token
			.replace(/^(UI|LIB|BUNDLE)_/i, '')
			.replace(/_NAME_/gi, '_')
			.replace(/_DESC(RIPTION)?_/gi, '_')
			.replace(/_/g, ' ')
			.toLowerCase()
			.replace(/\b\w/g, (char) => char.toUpperCase())
			.trim();
	}

	/**
	 * Render inventory name diagnostics to identify unresolved placeholders.
	 *
	 * @returns {string} Diagnostics HTML
	 * @private
	 */
	_renderInventoryNameDiagnosticsSection() {
		const diag = this._lastInventoryNameDiagnostics || { generatedAt: '', unresolvedCount: 0, unresolved: [] };
		const unresolved = Array.isArray(diag.unresolved) ? diag.unresolved : [];
		const unresolvedCount = Number(diag.unresolvedCount || unresolved.length || 0);

		if (unresolvedCount <= 0) {
			return `
				<div class="oj-section" style="margin-bottom:10px;">
					<h4 style="margin:0 0 4px;">Name Resolution Diagnostics</h4>
					<p class="oj-muted" style="margin:0;font-size:11px;">All inventory names resolved without placeholder fallbacks in the latest parse.</p>
				</div>
			`;
		}

		const rows = unresolved.slice(0, 30).map((entry) => {
			const category = this._escapeHtml(String(entry.category || 'unknown'));
			const itemId = this._escapeHtml(String(entry.itemId || ''));
			const qty = Number(entry.quantity || 0).toLocaleString();
			const renderedName = this._escapeHtml(String(entry.renderedName || ''));
			const catalogHits = (entry.catalogHits || []).length > 0
				? (entry.catalogHits || []).map((value) => this._escapeHtml(String(value || ''))).join(' | ')
				: '<span class="oj-muted">none</span>';
			const tokenAttempts = (entry.tokenAttempts || []).slice(0, 6)
				.map((value) => this._escapeHtml(String(value || '')))
				.join(', ') || '—';

			return `
				<tr>
					<td>${category}</td>
					<td>${itemId}</td>
					<td class="oj-num">${qty}</td>
					<td>${renderedName}</td>
					<td>${catalogHits}</td>
					<td class="oj-mono" style="font-size:10px;">${tokenAttempts}</td>
				</tr>
			`;
		}).join('');

		const generatedAt = diag.generatedAt ? new Date(diag.generatedAt).toLocaleTimeString() : 'now';

		return `
			<div class="oj-section" style="margin-bottom:10px;">
				<h4 style="margin:0 0 4px;">Name Resolution Diagnostics <span class="oj-muted">(${unresolvedCount} unresolved)</span></h4>
				<p class="oj-muted" style="margin:0 0 6px;font-size:11px;">Latest parse at ${this._escapeHtml(generatedAt)}. Showing up to 30 unresolved rows.</p>
				<details>
					<summary style="cursor:pointer;font-size:12px;">Show unresolved IDs and attempted token paths</summary>
					<div style="margin-top:8px;max-height:240px;overflow:auto;">
						<table class="oj-table oj-table-compact">
							<thead>
								<tr><th>Category</th><th>ID</th><th>Qty</th><th>Rendered</th><th>Catalog Hits</th><th>Token Attempts</th></tr>
							</thead>
							<tbody>${rows}</tbody>
						</table>
					</div>
				</details>
			</div>
		`;
	}

	_renderInventoryGroupSections(items) {
		const grouped = {};
		for (const item of items) {
			const cat = item.category || item.type || 'Uncategorized';
			if (!grouped[cat]) grouped[cat] = [];
			grouped[cat].push(item);
		}

		const catLabels = {
			hero_soul_stones: '\uD83D\uDC8E Hero Soul Stones',
			titan_soul_stones: '\uD83D\uDCA0 Titan Soul Stones',
			equipment: '\uD83D\uDEE1\uFE0F Equipment',
			consumable: '\uD83E\uDDEA Consumables',
			fragment: '\uD83E\uDDE9 Fragments',
			scroll: '\uD83D\uDCDC Scrolls',
			gear: '\u2699\uFE0F Gear',
			potion: '\uD83E\uDDEB Potions',
			skin_stone: '\uD83C\uDFAD Skin Stones',
			artifact: '\uD83C\uDFFA Artifacts',
			rune: '\uD83D\uDD2E Runes',
			gold: '\uD83E\uDE99 Gold Items',
			resource: '\uD83D\uDCE6 Resources',
			Uncategorized: '\uD83D\uDCE6 Other',
		};

		const groupHtml = Object.entries(grouped)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([cat, catItems]) => {
				const label = catLabels[cat] || `\uD83D\uDCE6 ${cat}`;
				const itemRows = catItems.map((item) => {
					const name = this._escapeHtml(item.name || item.itemName || `Item #${item.itemId || item.id}`);
					const qty = item.count ?? item.quantity ?? '\u2014';
					return `
						<tr>
							<td><strong>${name}</strong></td>
							<td class="oj-num">${typeof qty === 'number' ? qty.toLocaleString() : qty}</td>
						</tr>
					`;
				}).join('');

				return `
					<div class="oj-inv-group">
						<div class="oj-inv-group-header" data-inv-cat="${this._escapeHtml(cat)}">
							<span>${label}</span>
							<span class="oj-muted">(${catItems.length} items)</span>
						</div>
						<table class="oj-table oj-table-compact oj-inv-group-table">
							<thead><tr><th>Name</th><th>Qty</th></tr></thead>
							<tbody>${itemRows}</tbody>
						</table>
					</div>
				`;
			}).join('');

		return { categoryCount: Object.keys(grouped).length, groupHtml };
	}

	async _renderInventoryUsageSection() {
		try {
			const usages = await this.idbStorage.getAll('inventoryItemUsages', FETCH_LIMIT_LARGE);
			if (usages.length === 0) return '';

			usages.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
			const recent = usages.slice(0, 50);
			const usageRows = recent.map((usage) => {
				const ts = usage.timestamp ? new Date(usage.timestamp).toLocaleString() : '\u2014';
				const item = this._escapeHtml(usage.itemName || usage.itemId || 'Unknown');
				const qty = usage.quantityUsed || 1;
				const target = this._escapeHtml(usage.targetEntity || '\u2014');
				const ctx = this._escapeHtml(usage.usageContext || '\u2014').replace(/_/g, ' ');
				const catBadge = this._escapeHtml(usage.category || '');
				return `<tr>
					<td style="white-space:nowrap;font-size:11px">${ts}</td>
					<td>${item}</td>
					<td class="oj-num">${qty}</td>
					<td><span class="oj-badge">${catBadge}</span></td>
					<td>${ctx}</td>
					<td>${target}</td>
				</tr>`;
			}).join('');

			return `
				<div class="oj-section" style="margin-top:12px">
					<h4>\uD83D\uDCC9 Recent Usage <span class="oj-muted">(${usages.length} total, showing last 50)</span></h4>
					<table class="oj-table oj-table-compact">
						<thead>
							<tr>
								<th>Time</th>
								<th>Item</th>
								<th>Qty</th>
								<th>Category</th>
								<th>Context</th>
								<th>Target</th>
							</tr>
						</thead>
						<tbody>${usageRows}</tbody>
					</table>
				</div>
			`;
		} catch {
			return '';
		}
	}

	async _loadUpgradesDataset() {
		let heroUpgrades = [];
		let titanUpgrades = [];
		let equipChanges = [];

		try {
			[heroUpgrades, titanUpgrades, equipChanges] = await Promise.all([
				this.idbStorage.getAll('heroUpgrades', FETCH_LIMIT_LARGE).catch(() => []),
				this.idbStorage.getAll('titanUpgrades', FETCH_LIMIT_LARGE).catch(() => []),
				this.idbStorage.getAll('equipmentChanges', FETCH_LIMIT_LARGE).catch(() => []),
			]);
		} catch { /* empty */ }

		heroUpgrades.forEach((row) => { row._category = 'hero'; });
		titanUpgrades.forEach((row) => { row._category = 'titan'; });
		equipChanges.forEach((row) => { row._category = 'equipment'; row.upgradeType = row.changeType || 'equipped'; });

		return {
			heroUpgrades,
			titanUpgrades,
			equipChanges,
			allUpgrades: [...heroUpgrades, ...titanUpgrades, ...equipChanges],
		};
	}

	_buildUpgradesViewModel(allUpgrades, heroUpgrades, titanUpgrades, equipChanges, vs) {
		const categoryCounts = {
			all: allUpgrades.length,
			hero: heroUpgrades.length,
			titan: titanUpgrades.length,
			equipment: equipChanges.length,
		};

		const subTab = vs.subTab || 'all';
		let filtered = subTab === 'all'
			? allUpgrades
			: allUpgrades.filter((row) => row._category === subTab);

		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			filtered = filtered.filter((row) => {
				const name = (row.heroName || row.titanName || '').toLowerCase();
				const type = (row.upgradeType || '').toLowerCase();
				return name.includes(q) || type.includes(q);
			});
		}

		filtered.sort((a, b) => {
			const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
			const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
			return vs.sortDir === 'asc' ? ta - tb : tb - ta;
		});

		return { categoryCounts, filtered, subTab };
	}

	_renderUpgradeRows(pageItems) {
		const typeIcons = {
			skill: '\uD83D\uDCD6',
			artifact: '\uD83D\uDD2E',
			skin: '\uD83C\uDFA8',
			glyph: '\uD83D\uDD36',
			level: '\uD83D\uDCC8',
			star: '\u2B50',
			color: '\uD83C\uDF08',
			equipped: '\uD83D\uDEE1\uFE0F',
			upgraded: '\u2B06\uFE0F',
			evolved: '\uD83D\uDD04',
		};

		return pageItems.map((row) => {
			const ts = row.timestamp ? new Date(row.timestamp) : null;
			const timeStr = ts ? ts.toLocaleString() : '\u2014';
			const name = this._escapeHtml(row.heroName || row.titanName || '\u2014');
			const type = row.upgradeType || 'unknown';
			const icon = typeIcons[type] || '\u2728';
			const categoryBadge = row._category === 'hero'
				? '<span class="oj-badge-hero">Hero</span>'
				: row._category === 'titan'
					? '<span class="oj-badge-titan">Titan</span>'
					: '<span class="oj-badge-equip">Equip</span>';

			let detail = '';
			if (type === 'skill') {
				detail = `Skill #${row.skillSlot ?? 0} \u2192 Lv.${row.skillLevelAfter || '?'}`;
			} else if (type === 'artifact') {
				detail = `${row.artifactType || row.artifactName || 'Artifact'} \u2192 Lv.${row.levelAfter || '?'}`;
			} else if (type === 'skin') {
				detail = `${row.skinName || 'Skin'} \u2192 Lv.${row.levelAfter || '?'}${row.isNewUnlock ? ' \uD83C\uDD95' : ''}`;
			} else if (type === 'glyph') {
				detail = `${row.glyphType || 'Glyph'} enchanted`;
			} else if (type === 'level') {
				detail = `\u2192 Lv.${row.levelAfter || '?'}`;
			} else if (type === 'star') {
				detail = `${row.starsBefore || '?'}\u2605 \u2192 ${row.starsAfter || '?'}\u2605`;
			} else if (type === 'color') {
				detail = `${row.colorBefore || '?'} \u2192 ${row.colorAfter || '?'}`;
			} else if (row._category === 'equipment') {
				detail = `Slot ${row.slotIndex ?? '?'} ${type}`;
			}

			const powerStr = row.powerAfter ? row.powerAfter.toLocaleString() : '\u2014';
			return `
				<tr class="oj-upgrade-row">
					<td class="oj-mono">${timeStr}</td>
					<td>${categoryBadge}</td>
					<td><strong>${name}</strong></td>
					<td>${icon} ${this._escapeHtml(type)}</td>
					<td>${detail}</td>
					<td class="oj-num">${powerStr}</td>
				</tr>
			`;
		}).join('');
	}

	_renderUpgradeSubTabPills(categoryCounts, subTab) {
		const labels = {
			all: 'All',
			hero: '\uD83E\uDDB8 Hero',
			titan: '\uD83D\uDCA0 Titan',
			equipment: '\uD83D\uDEE1\uFE0F Equipment',
		};
		return Object.entries(categoryCounts).map(([key, count]) => {
			const active = key === subTab ? 'oj-pill-active' : '';
			return `<button class="oj-pill-btn ${active}" data-sub-tab="${key}">${labels[key] || key} (${count})</button>`;
		}).join('');
	}

	async _loadChestDatasetBundle() {
		let chests = [];
		try {
			chests = await this.idbStorage.getAll('chests', FETCH_LIMIT_LARGE);
		} catch { /* empty */ }

		if (chests.length === 0) {
			try {
				const cached = await this.idbStorage.getMetadata('chestOpeningHistory', null);
				if (Array.isArray(cached) && cached.length > 0) {
					chests = cached;
				}
			} catch { /* empty */ }
		}

		let dropRates = {};
		try {
			dropRates = (await this.idbStorage.getMetadata('chestDropRates', null)) || {};
		} catch { /* empty */ }

		let allDrops = [];
		let dropsLoaded = false;
		if (Object.keys(dropRates).length === 0) {
			try {
				allDrops = await this.idbStorage.getAll('consumableRewards', FETCH_LIMIT_DROPS);
				dropsLoaded = allDrops.length > 0;
			} catch { /* empty */ }
		}

		chests.sort((a, b) => {
			const ta = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || 0).getTime();
			const tb = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || 0).getTime();
			return tb - ta;
		});

		return { chests, dropRates, allDrops, dropsLoaded };
	}

	_renderChestTypePills(chests, sourceLabels) {
		const byType = {};
		for (const chest of chests) {
			const type = chest.chestType || chest.type || 'Unknown';
			byType[type] = (byType[type] || 0) + 1;
		}

		return Object.entries(byType).map(([type, count]) => {
			const label = sourceLabels[type] || type;
			return `<span class="oj-pill">\uD83C\uDF81 ${this._escapeHtml(label)}: ${count}</span>`;
		}).join(' ');
	}

	_renderChestDropRatesFromMetadata(dropRates, sourceLabels) {
		if (Object.keys(dropRates).length === 0) return '';

		const tables = [];
		for (const [chestKey, info] of Object.entries(dropRates)) {
			if (!info.itemDrops || Object.keys(info.itemDrops).length === 0) continue;

			const label = sourceLabels[info.chestType] || info.chestType || chestKey;
			const opens = info.openCount || 0;
			const items = Object.values(info.itemDrops).sort((a, b) => (b.dropCount || 0) - (a.dropCount || 0));

			const itemRows = items.map((item) => {
				const rate = opens > 0 ? ((item.dropCount / opens) * 100).toFixed(1) : '0.0';
				const avg = item.dropCount > 0 ? (item.totalAmount / item.dropCount).toFixed(1) : '0';
				const name = this._escapeHtml(item.name || `${item.type}_${item.id}`);
				return `
					<tr>
						<td>${name}</td>
						<td class="oj-num">${item.dropCount}</td>
						<td class="oj-num">${item.totalAmount.toLocaleString()}</td>
						<td class="oj-num">${avg}</td>
						<td class="oj-num oj-drop-rate">${rate}%</td>
					</tr>
				`;
			}).join('');

			tables.push(`
				<div class="oj-drop-rate-section">
					<h4 class="oj-section-sub">${this._escapeHtml(label)} <span class="oj-muted">(${opens} openings)</span></h4>
					<table class="oj-table oj-table-compact">
						<thead>
							<tr><th>Item</th><th>Drops</th><th>Total Qty</th><th>Avg/Drop</th><th>Rate</th></tr>
						</thead>
						<tbody>${itemRows}</tbody>
					</table>
				</div>
			`);
		}

		if (tables.length === 0) return '';
		return `<div class="oj-drop-rates"><h3>\uD83D\uDCCA Drop Rate Analysis</h3>${tables.join('')}</div>`;
	}

	_renderChestDropRatesFromRawDrops(allDrops, chests, sourceLabels) {
		if (!Array.isArray(allDrops) || allDrops.length === 0) return '';

		const grouped = {};
		for (const drop of allDrops) {
			const key = `${drop.sourceType}_${drop.sourceId}`;
			if (!grouped[key]) {
				grouped[key] = { sourceType: drop.sourceType, sourceId: drop.sourceId, openCount: 0, items: {} };
			}
			const itemKey = `${drop.itemType}_${drop.itemId}`;
			if (!grouped[key].items[itemKey]) {
				grouped[key].items[itemKey] = { type: drop.itemType, id: drop.itemId, count: 0, totalQty: 0 };
			}
			grouped[key].items[itemKey].count++;
			grouped[key].items[itemKey].totalQty += drop.quantity || 0;
		}

		for (const chest of chests) {
			const key = `${chest.chestType}_${chest.sourceId || chest.chestId || 'unknown'}`;
			if (grouped[key]) grouped[key].openCount += (chest.quantity || 1);
		}

		const tables = [];
		for (const [key, info] of Object.entries(grouped)) {
			const label = sourceLabels[info.sourceType] || info.sourceType || key;
			const opens = info.openCount || Object.values(info.items).reduce((s, i) => Math.max(s, i.count), 0);
			const items = Object.values(info.items).sort((a, b) => b.count - a.count);

			const itemRows = items.map((item) => {
				const rate = opens > 0 ? ((item.count / opens) * 100).toFixed(1) : '?';
				const avg = item.count > 0 ? (item.totalQty / item.count).toFixed(1) : '0';
				return `
					<tr>
						<td>${this._escapeHtml(`${item.type}:${item.id}`)}</td>
						<td class="oj-num">${item.count}</td>
						<td class="oj-num">${item.totalQty.toLocaleString()}</td>
						<td class="oj-num">${avg}</td>
						<td class="oj-num oj-drop-rate">${rate}%</td>
					</tr>
				`;
			}).join('');

			tables.push(`
				<div class="oj-drop-rate-section">
					<h4 class="oj-section-sub">${this._escapeHtml(label)} <span class="oj-muted">(~${opens} openings)</span></h4>
					<table class="oj-table oj-table-compact">
						<thead><tr><th>Item</th><th>Drops</th><th>Total Qty</th><th>Avg/Drop</th><th>Rate</th></tr></thead>
						<tbody>${itemRows}</tbody>
					</table>
				</div>
			`);
		}

		if (tables.length === 0) return '';
		return `<div class="oj-drop-rates"><h3>\uD83D\uDCCA Drop Rate Analysis</h3>${tables.join('')}</div>`;
	}

	_buildChestHistoryViewModel(chests, vs) {
		let filteredChests = chests;
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			filteredChests = chests.filter((chest) => {
				const type = (chest.chestType || chest.type || '').toLowerCase();
				return type.includes(q);
			});
		}

		const totalCount = filteredChests.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = filteredChests.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);
		return { pageItems, totalCount, totalPages };
	}

	_renderChestOpeningRows(pageItems, sourceLabels) {
		return pageItems.map((chest) => {
			const time = chest.timestamp
				? new Date(typeof chest.timestamp === 'number' ? chest.timestamp : chest.timestamp).toLocaleString()
				: '\u2014';
			const type = this._escapeHtml(sourceLabels[chest.chestType] || chest.chestType || chest.type || 'Unknown');
			const drops = chest.dropCount ?? (Array.isArray(chest.rewards) ? chest.rewards.length : '\u2014');

			let rewardDetail = '\u2014';
			if (Array.isArray(chest.rewards) && chest.rewards.length > 0) {
				rewardDetail = chest.rewards.map((reward) => {
					const itemName = this._escapeHtml(reward.name || reward.itemName || `${reward.type || reward.itemType || '?'}:${reward.id || reward.itemId || '?'}`);
					const qty = reward.quantity || reward.count || 1;
					return `<span class="oj-reward-item">${itemName} \u00D7${qty}</span>`;
				}).join(', ');
			} else if (chest.rewardSummary) {
				rewardDetail = this._escapeHtml(chest.rewardSummary);
			}

			return `
				<tr>
					<td class="oj-mono">${time}</td>
					<td>${type}</td>
					<td class="oj-num">${drops}</td>
					<td class="oj-num">${chest.quantity || 1}</td>
					<td class="oj-reward-list">${rewardDetail}</td>
				</tr>
			`;
		}).join('');
	}

	async _loadResourcesDataset() {
		let playerData = null;
		try {
			playerData = await this.idbStorage.getMetadata('playerData', null);
		} catch { /* empty */ }

		let snap = null;
		if (!playerData) {
			try {
				const snapshots = await this.idbStorage.getPage('snapshots', { limit: 1, direction: 'prev' });
				if (snapshots.length > 0) {
					snap = snapshots[0];
				}
			} catch { /* empty */ }
		}

		let transactions = [];
		try {
			transactions = await this.idbStorage.getAll('resourceTransactions', FETCH_LIMIT_TRANSACTIONS);
			transactions.sort((a, b) => {
				const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
				const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
				return tb - ta;
			});
		} catch { /* empty */ }

		return { src: playerData || snap, transactions };
	}

	_renderResourceCardsSection(src) {
		if (!src) return '';

		const ts = src.timestamp ? new Date(src.timestamp).toLocaleString() : 'Unknown';
		const resources = [
			{ label: 'Gold', value: src.gold, icon: '\uD83E\uDE99' },
			{ label: 'Emeralds', value: src.starmoney || src.emeralds, icon: '\uD83D\uDC8E' },
			{ label: 'Energy', value: src.stamina || src.energy, icon: '\u26A1' },
			{ label: 'Level', value: src.level, icon: '\uD83D\uDCC8' },
			{ label: 'VIP Level', value: src.vipLevel || src.vip, icon: '\uD83D\uDC51' },
			{ label: 'Arena Coins', value: src.arenaCoins, icon: '\uD83C\uDFC6' },
			{ label: 'Tower Coins', value: src.towerCoins, icon: '\uD83C\uDFF0' },
			{ label: 'Friendship Pts', value: src.friendshipPoints || src.friendship, icon: '\uD83E\uDD1D' },
		].filter((row) => row.value !== undefined && row.value !== null);

		const cards = resources.map((row) => `
			<div class="oj-resource-card${row.label === 'Emeralds' ? ' oj-clickable' : ''}"${row.label === 'Emeralds' ? ' data-resource-filter="emeralds"' : ''}>
				<div class="oj-resource-icon">${row.icon}</div>
				<div class="oj-resource-amount">${typeof row.value === 'number' ? row.value.toLocaleString() : row.value}</div>
				<div class="oj-resource-label">${row.label}</div>
			</div>
		`).join('');

		if (!cards) return '';
		return `<h4 class="oj-section-sub">Current Resources <span class="oj-muted">(as of ${ts})</span></h4><div class="oj-stats-grid">${cards}</div>`;
	}

	_renderResourceTransactionsSection(transactions) {
		if (!Array.isArray(transactions) || transactions.length === 0) return '';

		const txRows = transactions.slice(0, 30).map((tx) => {
			const time = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : '\u2014';
			const amount = tx.amount || 0;
			const sign = amount >= 0 ? '+' : '';
			const amtClass = amount >= 0 ? 'oj-positive' : 'oj-negative';
			const type = this._escapeHtml(tx.resourceType || tx.type || '\u2014');
			const source = this._escapeHtml(tx.source || tx.reason || '\u2014');
			return `
				<tr>
					<td class="oj-mono">${time}</td>
					<td>${type}</td>
					<td class="${amtClass} oj-num">${sign}${amount.toLocaleString()}</td>
					<td>${source}</td>
				</tr>
			`;
		}).join('');

		return `
			<h4 class="oj-section-sub">Recent Transactions <span class="oj-muted">(${transactions.length})</span></h4>
			<table class="oj-table">
				<thead><tr><th>Time</th><th>Resource</th><th>Amount</th><th>Source</th></tr></thead>
				<tbody>${txRows}</tbody>
			</table>
		`;
	}

	async _loadMailDataset() {
		let mailData = null;
		let rewards = [];

		try {
			mailData = await this.idbStorage.getMetadata('mailData', null);
		} catch { /* empty */ }

		try {
			rewards = await this.idbStorage.getAll('mailRewards', FETCH_LIMIT_MEDIUM);
		} catch { /* empty */ }

		return { mailData, rewards };
	}

	_buildMailListViewModel(items, vs) {
		let filtered = [...items];
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			filtered = filtered.filter((mail) => {
				const rewardSummary = this._buildMailRewardSummary(mail).toLowerCase();
				return (mail.subject || '').toLowerCase().includes(q)
					|| (mail.mailType || '').toLowerCase().includes(q)
					|| (mail.senderName || '').toLowerCase().includes(q)
					|| (mail.messageText || '').toLowerCase().includes(q)
					|| rewardSummary.includes(q);
			});
		}

		filtered = this._sortData(filtered, vs.sortField, vs.sortDir);
		const totalCount = filtered.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = filtered.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);
		return { pageItems, totalCount, totalPages };
	}

	_buildMailRewardSummary(mail) {
		if (!mail) return '\u2014';
		if (mail.rewardSummaryText && String(mail.rewardSummaryText).trim()) {
			return String(mail.rewardSummaryText).trim();
		}
		if (!mail.rewards || typeof mail.rewards !== 'object') return '\u2014';

		const parts = [];
		for (const [key, val] of Object.entries(mail.rewards)) {
			if (typeof val === 'number' && val > 0) {
				parts.push(`${key}: ${Number(val).toLocaleString()}`);
			} else if (typeof val === 'object' && val !== null) {
				const rewardEntries = Object.entries(val)
					.filter(([, qty]) => typeof qty === 'number' && qty > 0)
					.slice(0, 3)
					.map(([id, qty]) => `${id} x${Number(qty).toLocaleString()}`);
				const count = Object.values(val).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
				if (count > 0) {
					parts.push(rewardEntries.length > 0
						? `${key}: ${rewardEntries.join(', ')}${Object.keys(val).length > rewardEntries.length ? '…' : ''}`
						: `${key}: ${count.toLocaleString()} items`);
				}
			}
		}

		return parts.length > 0 ? parts.join(', ') : '\u2014';
	}

	_buildMailMessageText(mail) {
		const raw = String(mail?.messageText || mail?.rawMail?.letter || mail?.rawMail?.body || mail?.rawMail?.text || '').trim();
		if (!raw) return '';

		const tokenResolved = this._resolveLocaleToken(raw);
		return String(tokenResolved || raw).trim();
	}

	_buildMailSubjectText(mail) {
		const raw = String(mail?.subject || mail?.rawMail?.subject || mail?.rawMail?.title || '').trim();
		if (!raw) return '';

		const tokenResolved = this._resolveLocaleToken(raw);
		return String(tokenResolved || raw).trim();
	}

	_renderMailInboxRows(pageItems) {
		return pageItems.map((mail) => {
			const statusIcon = mail.isCollected ? '\u2705' : mail.isRead ? '\uD83D\uDCE8' : '\uD83D\uDCE9';
			const subject = this._escapeHtml(this._buildMailSubjectText(mail) || '(no subject)');
			const type = this._escapeHtml(mail.mailType || 'unknown');
			const sender = this._escapeHtml(mail.senderName || mail.senderId || 'System');
			const messageText = this._buildMailMessageText(mail);
			const messagePreview = this._escapeHtml(messageText ? (messageText.length > 140 ? `${messageText.slice(0, 140)}…` : messageText) : '—');
			const messageFull = this._escapeHtml(messageText || 'No message body captured.');
			const date = mail.receivedAt ? new Date(mail.receivedAt).toLocaleString() : '\u2014';
			const rewardSummary = this._escapeHtml(this._buildMailRewardSummary(mail));
			const statusLabel = mail.isCollected ? 'Collected' : (mail.isRead ? 'Read' : 'Unread');
			const mailId = this._escapeHtml(String(mail.mailId || ''));
			return `
				<tr>
					<td title="${statusLabel}">${statusIcon}</td>
					<td>${sender}</td>
					<td>
						<div><strong>${subject}</strong></div>
						<div class="oj-muted" style="font-size:10px;">ID: ${mailId || '—'}</div>
					</td>
					<td><span class="oj-badge">${type}</span></td>
					<td>
						<div class="oj-muted" style="font-size:11px;max-width:280px;">${messagePreview}</div>
						<details>
							<summary style="cursor:pointer;font-size:10px;">View full message</summary>
							<div style="white-space:pre-wrap;margin-top:4px;font-size:11px;">${messageFull}</div>
						</details>
					</td>
					<td class="oj-muted">${date}</td>
					<td class="oj-muted" style="max-width:260px;">${rewardSummary}</td>
				</tr>
			`;
		}).join('');
	}

	_renderMailCollectedRewardsSection(rewards) {
		if (!Array.isArray(rewards) || rewards.length === 0) return '';

		const byType = {};
		for (const reward of rewards) {
			const key = reward.rewardType || 'unknown';
			if (!byType[key]) byType[key] = { count: 0, totalQty: 0, items: {} };
			byType[key].count++;
			byType[key].totalQty += reward.quantity || 0;
			const itemKey = reward.rewardId || 'unknown';
			byType[key].items[itemKey] = (byType[key].items[itemKey] || 0) + (reward.quantity || 0);
		}

		const typeRows = Object.entries(byType)
			.sort((a, b) => b[1].totalQty - a[1].totalQty)
			.map(([type, info]) => {
				const topItems = Object.entries(info.items)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 5)
					.map(([id, qty]) => `${this._escapeHtml(this._resolveEntityName(Number(id)) || id)}: ${qty.toLocaleString()}`)
					.join(', ');

				return `
					<tr>
						<td><strong>${this._escapeHtml(type)}</strong></td>
						<td class="oj-num">${info.count.toLocaleString()}</td>
						<td class="oj-num">${info.totalQty.toLocaleString()}</td>
						<td class="oj-muted">${topItems}</td>
					</tr>
				`;
			}).join('');

		return `
			<div class="oj-mail-rewards">
				<h4>\uD83C\uDF81 Collected Rewards <span class="oj-muted">(${rewards.length} entries)</span></h4>
				<table class="oj-table">
					<thead>
						<tr>
							<th>Type</th>
							<th>Collections</th>
							<th>Total Qty</th>
							<th>Top Items</th>
						</tr>
					</thead>
					<tbody>${typeRows}</tbody>
				</table>
			</div>
		`;
	}

	/**
	 * Render a compressed hero team as a row of avatar icons with optional stats.
	 * Handles both old 5-element tuples and new 8-element tuples (#111).
	 *
	 * Compressed format: [id, level, star, color, power, damage, healing, petId]
	 *
	 * @param {string|null} heroesJson - JSON string of compressed team array
	 * @param {string} [label='Team'] - Label shown above the team
	 * @returns {string} HTML fragment
	 * @private
	 */
	_renderBattleTeam(heroesJson, label = 'Team') {
		return renderBattleTeam({
			heroesJson,
			label,
			escapeHtml: (value) => this._escapeHtml(value),
			colorRankClass: (color) => this._colorRankClass(color),
			colorRankName: (color) => this._colorRankName(color),
			formatCompact: (value) => this._formatCompact(value),
			resolveHeroName: (id) => this._resolveEntityName(Number(id)),
		});
	}

	/**
	 * Render an Adventure Guide panel showing per-node win/loss stats
	 * and recommended teams (#131).
	 *
	 * Groups adventure battles by mission (node) ID, computes win rate,
	 * and displays the most recent winning team for each node.
	 *
	 * @param {Array} adventureBattles - Filtered adventure-type battle records
	 * @returns {string} HTML panel
	 * @private
	 */
	_renderAdventureGuide(adventureBattles) {
		return renderAdventureGuide({
			adventureBattles,
			renderBattleTeam: (heroesJson, label) => this._renderBattleTeam(heroesJson, label),
			escapeHtml: (value) => this._escapeHtml(value),
		});
	}

	/**
	 * Format a number in compact notation (e.g. 1.2M, 45K).
	 *
	 * @param {number} n - Number to format
	 * @returns {string} Compact string
	 * @private
	 */
	_formatCompact(n) {
		return formatCompact(n);
	}

	/**
	 * Map Hero Wars numeric color/rank to a human-readable name.
	 *
	 * @param {number|string} color - Numeric color rank (0-17+)
	 * @returns {string} Rank name
	 */
	_colorRankName(color) {
		return colorRankName(color);
	}

	/**
	 * Return a CSS class for a Hero Wars color rank (for styling).
	 *
	 * @param {number|string} color - Numeric color rank
	 * @returns {string} CSS class name
	 */
	_colorRankClass(color) {
		return colorRankClass(color);
	}

	/**
	 * Return a CSS class for an activity event row based on event type and data.
	 *
	 * @param {object} evt - Activity event object
	 * @returns {string} CSS class name
	 */
	_activityColorClass(evt) {
		return activityColorClass(evt);
	}

	/**
	 * Return an emoji icon for an activity event type.
	 *
	 * @param {object} evt - Activity event object
	 * @returns {string} Emoji
	 */
	_activityIcon(evt) {
		return activityIcon(evt);
	}

	// =====================================================================
	// Lifecycle helpers (#133)
	// =====================================================================

	/**
	 * Register a document-level event listener *and* track it so
	 * {@link destroy} can remove it on page unload.
	 *
	 * @param {string} event   - DOM event name (e.g. 'keydown')
	 * @param {Function} handler - Event handler function
	 * @private
	 */
	_addDocListener(event, handler) {
		document.addEventListener(event, handler);
		this._docListeners.push({ event, handler });
	}

	/**
	 * Tear down the UIManager: remove all document-level event listeners,
	 * detach the overlay from the DOM, and null out references (#133).
	 *
	 * Called automatically via `_destroyables` on `beforeunload`.
	 */
	destroy() {
		if (this._unsubscribeApiServerCalls) {
			try {
				this._unsubscribeApiServerCalls();
			} catch { /* best-effort */ }
			this._unsubscribeApiServerCalls = null;
		}

		// Remove all tracked document-level listeners
		for (const { event, handler } of this._docListeners) {
			try {
				document.removeEventListener(event, handler);
			} catch { /* best-effort */ }
		}
		this._docListeners.length = 0;

		// Remove overlay DOM node
		if (this.overlay && this.overlay.parentNode) {
			this.overlay.parentNode.removeChild(this.overlay);
		}
		this.overlay = null;
	}
}

export default UIManager;
