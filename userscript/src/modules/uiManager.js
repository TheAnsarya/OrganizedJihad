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
import { renderHeroRequirementsProjectionPanel } from './renderers/heroRequirementsProjectionRenderer.js';
import {
	buildInstallHealthCheckModel,
	renderInstallHealthDiagnosticsOutput,
} from './renderers/installHealthDiagnosticsRenderer.js';
import { TRACKING_CATEGORIES } from './gameTracker.js';
import { decompressHeroStore, decompressTitanStore } from './heroCompression.js';
import { resolveHeroName } from './heroNames.js';
import { NOTIFICATION_TYPES } from './notificationManager.js';

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

/** @const {string} Local API endpoint for battle recommendations */
const BATTLE_RECOMMENDATIONS_URL = 'http://localhost:5124/api/sync/battles/recommendations?battleType=arena&limit=3&minSamples=2';

/** @const {string} Local API endpoint for mode-aware team recommendation engine */
const TEAM_RECOMMENDATIONS_URL = 'http://localhost:5124/api/sync/teams/recommendations';

/** @const {string} Local API endpoint for team recommendation profile metadata */
const TEAM_RECOMMENDATION_PROFILES_URL = 'http://localhost:5124/api/sync/teams/recommendations/profiles';

/** @const {string} Local API endpoint for team recommendation backtest calibration */
const TEAM_RECOMMENDATION_BACKTEST_URL = 'http://localhost:5124/api/sync/teams/recommendations/backtest';

/** @const {string} Local API endpoint for persisted team recommendation calibration metadata */
const TEAM_RECOMMENDATION_CALIBRATION_URL = 'http://localhost:5124/api/sync/teams/recommendations/calibration';
/** @const {string} Local API endpoint for persisted team recommendation trend preferences */
const TEAM_RECOMMENDATION_PREFERENCES_URL = 'http://localhost:5124/api/sync/teams/recommendations/preferences';
/** @const {string} Local API endpoint for quick install health checks */
const SYNC_HEALTH_URL = 'http://localhost:5124/api/sync/health';
/** @const {string} Local API docs endpoint for quick setup diagnostics */
const SYNC_DOCS_URL = 'http://localhost:5124/api/sync';

/** @const {string} Local API endpoint for curated external tools catalog */
const TOOLS_CATALOG_URL = 'http://localhost:5124/api/sync/tools/catalog';

/** @const {string} Local API endpoint for external tools catalog filter metadata */
const TOOLS_CATALOG_FILTERS_URL = 'http://localhost:5124/api/sync/tools/catalog/filters';

/** @const {number} Recommendation cache TTL in ms */
const RECOMMENDATIONS_CACHE_TTL_MS = 5 * 60 * 1000;

/** @const {number} External tools catalog cache TTL in ms */
const TOOLS_CATALOG_CACHE_TTL_MS = 30 * 60 * 1000;

/** @const {number} Max activity events to render in the feed */
const DISPLAY_LIMIT_ACTIVITY = 100;

class UIManager {
	/**
	 * @param {import('./storageManager.js').default} prefStorage - Synchronous localStorage wrapper
	 * @param {import('./indexedDBStorage.js').default} idbStorage - Async IndexedDB wrapper
	 * @param {import('./gameTracker.js').default} gameTracker - Game data tracker
	 * @param {import('./goalsManager.js').default} goalsManager - Goals management
	 * @param {import('./calendarManager.js').default} calendarManager - Calendar management
	 * @param {import('./suggestionsEngine.js').default} suggestionsEngine - Suggestions engine
	 */
	constructor(prefStorage, idbStorage, gameTracker, goalsManager, calendarManager, suggestionsEngine) {
		this.prefStorage = prefStorage;
		this.idbStorage = idbStorage;
		this.gameTracker = gameTracker;
		this.goalsManager = goalsManager;
		this.calendarManager = calendarManager;
		this.suggestionsEngine = suggestionsEngine;

		this.isVisible = this.prefStorage.get('uiVisible', false);
		this.currentView = this.prefStorage.get('defaultTab', 'dashboard');
		this.overlay = null;

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
	}

	/**
	 * Initialize the overlay: create DOM, attach events, restore state.
	 * Subscribes to live activity events from GameTracker.
	 */
	init() {
		this.createOverlay();
		this.attachEventListeners();

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
						this.renderView('apilog');
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
					<h2 class="oj-title">\u2694\uFE0F OrganizedJihad</h2>
					<div class="oj-header-actions">
						<button class="oj-btn oj-btn-icon" id="oj-reset-pos" title="Reset Position">\u21BA</button>
						<button class="oj-btn oj-btn-icon" id="oj-minimize" title="Minimize">\u2212</button>
						<button class="oj-btn oj-btn-icon" id="oj-close" title="Close">\u00D7</button>
					</div>
				</div>

				<div class="oj-nav">
					<button class="oj-nav-btn active" data-view="dashboard">Dashboard</button>
					<button class="oj-nav-btn" data-view="activity">Activity</button>
					<button class="oj-nav-btn" data-view="heroes">Heroes</button>
					<button class="oj-nav-btn" data-view="titans">Titans</button>
					<button class="oj-nav-btn" data-view="pets">\uD83D\uDC3E Pets</button>
					<button class="oj-nav-btn" data-view="upgrades">Upgrades</button>
					<button class="oj-nav-btn" data-view="battles">Battles</button>
					<button class="oj-nav-btn" data-view="chests">Chests</button>
					<button class="oj-nav-btn" data-view="inventory">Inventory</button>
					<button class="oj-nav-btn" data-view="mail">Mail</button>
					<button class="oj-nav-btn" data-view="apilog">API Log</button>
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
		// Navigation buttons
		this.overlay.querySelectorAll('.oj-nav-btn').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				this.switchView(e.target.dataset.view);
			});
		});

		// Close button — hide overlay
		this.overlay.querySelector('#oj-close').addEventListener('click', () => {
			this.hide();
		});

		// Minimize button — collapse to header-only, persist state
		this.overlay.querySelector('#oj-minimize').addEventListener('click', () => {
			const isMinimized = this.overlay.classList.toggle('minimized');
			const btn = this.overlay.querySelector('#oj-minimize');
			btn.textContent = isMinimized ? '+' : '\u2212';
			btn.title = isMinimized ? 'Expand' : 'Minimize';
			this._isMinimized = isMinimized;
			this.prefStorage.set('overlayMinimized', isMinimized);
		});

		// Reset position button — clear saved position/size, revert to CSS defaults
		this.overlay.querySelector('#oj-reset-pos').addEventListener('click', () => {
			this.overlay.style.left = '';
			this.overlay.style.top = '';
			this.overlay.style.right = '';
			this.overlay.style.width = '';
			this.overlay.style.height = '';
			this._savedPos = null;
			this._savedSize = null;
			this.prefStorage.delete('overlayPosition');
			this.prefStorage.delete('overlaySize');
		});

		// Escape key — close overlay when visible
		this._addDocListener('keydown', (e) => {
			if (e.key === 'Escape' && this.isVisible) {
				e.preventDefault();
				this.hide();
			}
		});

		// Draggable header
		this.makeDraggable();

		// Resizable via bottom-right handle
		this.makeResizable();
	}

	/**
	 * Make the overlay draggable by its header bar.
	 * Clears CSS "right" on first drag so "left" takes effect.
	 * Clamps position to viewport boundaries so the panel can't be
	 * dragged off-screen (#49).
	 */
	makeDraggable() {
		const header = this.overlay.querySelector('.oj-header');
		let isDragging = false;
		let startX, startY, startLeft, startTop;

		header.addEventListener('mousedown', (e) => {
			// Don't start drag on button clicks
			if (e.target.closest('button')) return;

			isDragging = true;

			// On first drag, switch from right-positioned to left-positioned
			if (this.overlay.style.left === '' || this.overlay.style.left === 'auto') {
				const rect = this.overlay.getBoundingClientRect();
				this.overlay.style.left = rect.left + 'px';
				this.overlay.style.top = rect.top + 'px';
				this.overlay.style.right = 'auto';
			}

			startX = e.clientX;
			startY = e.clientY;
			startLeft = parseInt(this.overlay.style.left, 10) || 0;
			startTop = parseInt(this.overlay.style.top, 10) || 0;

			header.style.cursor = 'grabbing';
			e.preventDefault();
		});

		this._addDocListener('mousemove', (e) => {
			if (!isDragging) return;
			e.preventDefault();

			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			// Clamp to viewport boundaries (#49)
			// Ensure at least 40px of the header stays visible so the user
			// can always grab it to drag it back.
			const w = this.overlay.offsetWidth;
			const h = this.overlay.offsetHeight;
			const vw = window.innerWidth;
			const vh = window.innerHeight;
			const minVisible = 40;

			let newLeft = startLeft + dx;
			let newTop = startTop + dy;

			newLeft = Math.max(-w + minVisible, Math.min(newLeft, vw - minVisible));
			newTop = Math.max(0, Math.min(newTop, vh - minVisible));

			this.overlay.style.left = newLeft + 'px';
			this.overlay.style.top = newTop + 'px';
		});

		this._addDocListener('mouseup', () => {
			if (!isDragging) return;
			isDragging = false;
			header.style.cursor = 'grab';

			// Persist position
			this._savedPos = {
				x: parseInt(this.overlay.style.left, 10),
				y: parseInt(this.overlay.style.top, 10),
			};
			this.prefStorage.set('overlayPosition', this._savedPos);
		});
	}

	/**
	 * Make the overlay resizable via a bottom-right drag handle.
	 * Enforces minimum size of 400×300, maximum constrained by viewport,
	 * and persists size in localStorage. (#49 — viewport clamping)
	 */
	makeResizable() {
		const handle = this.overlay.querySelector('#oj-resize-handle');
		if (!handle) return;

		const MIN_WIDTH = 400;
		const MIN_HEIGHT = 300;
		let isResizing = false;
		let startX, startY, startW, startH;

		handle.addEventListener('mousedown', (e) => {
			isResizing = true;

			// Need explicit left/top so resize works after position is set
			if (this.overlay.style.left === '' || this.overlay.style.left === 'auto') {
				const rect = this.overlay.getBoundingClientRect();
				this.overlay.style.left = rect.left + 'px';
				this.overlay.style.top = rect.top + 'px';
				this.overlay.style.right = 'auto';
			}

			startX = e.clientX;
			startY = e.clientY;
			startW = this.overlay.offsetWidth;
			startH = this.overlay.offsetHeight;

			e.preventDefault();
			e.stopPropagation();
		});

		this._addDocListener('mousemove', (e) => {
			if (!isResizing) return;
			e.preventDefault();

			// Clamp max size to viewport from current position (#49)
			const left = parseInt(this.overlay.style.left, 10) || 0;
			const top = parseInt(this.overlay.style.top, 10) || 0;
			const maxW = window.innerWidth - left;
			const maxH = window.innerHeight - top;

			const newW = Math.max(MIN_WIDTH, Math.min(startW + (e.clientX - startX), maxW));
			const newH = Math.max(MIN_HEIGHT, Math.min(startH + (e.clientY - startY), maxH));

			this.overlay.style.width = newW + 'px';
			this.overlay.style.height = newH + 'px';
			// Remove max-height constraint set by CSS so manual height works
			this.overlay.style.maxHeight = 'none';
		});

		this._addDocListener('mouseup', () => {
			if (!isResizing) return;
			isResizing = false;

			// Persist size
			this._savedSize = {
				w: this.overlay.offsetWidth,
				h: this.overlay.offsetHeight,
			};
			this.prefStorage.set('overlaySize', this._savedSize);
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
		const statusFilter = this.overlay?.querySelector('#oj-tools-status-filter');
		if (statusFilter) {
			statusFilter.addEventListener('change', (e) => {
				this.prefStorage.set('toolsCatalogStatusFilter', e.target.value || '');
				this.renderView('dashboard');
			});
		}

		const teamMode = this.overlay?.querySelector('#oj-team-mode-filter');
		if (teamMode) {
			teamMode.addEventListener('change', (e) => {
				this.prefStorage.set('teamRecommendationsMode', e.target.value || 'arena');
				this.renderView('dashboard');
			});
		}

		const teamObjective = this.overlay?.querySelector('#oj-team-objective-filter');
		if (teamObjective) {
			teamObjective.addEventListener('change', (e) => {
				this.prefStorage.set('teamRecommendationsObjective', e.target.value || 'balanced');
				this.renderView('dashboard');
			});
		}

		const teamTrendWindow = this.overlay?.querySelector('#oj-team-trend-window-filter');
		if (teamTrendWindow) {
			teamTrendWindow.addEventListener('change', (e) => {
				const selectedPreference = e.target.value || 'auto';
				const selectedMode = this.prefStorage.get('teamRecommendationsMode', 'arena');
				const defaultWindow = Number(e.target?.dataset?.defaultWindow || 30);
				const configuredWindow = Number(selectedPreference);
				const resolvedWindow = selectedPreference === 'auto'
					? defaultWindow
					: (Number.isFinite(configuredWindow) ? configuredWindow : defaultWindow);

				this.prefStorage.set('teamRecommendationsTrendWindow', selectedPreference);
				this._saveTeamRecommendationTrendPreference(selectedMode, resolvedWindow);
				this.renderView('dashboard');
			});
		}
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

		// Quest totals from questGetAll metadata (#117, #118)
		let questSummary = {};
		try {
			questSummary = (await this.idbStorage.getMetadata('questSummary', null)) || {};
		} catch { /* empty */ }
		const dailyQuestsCompleted = questSummary.dailyCompleted || 0;
		const dailyQuestsTotal = questSummary.dailyTotal || 0;
		const guildQuestsCompleted = questSummary.guildCompleted || 0;
		const guildQuestsTotal = questSummary.guildTotal || 0;

		// Guild War data from clanWarGetBriefInfo (#119)
		let gwBrief = {};
		try {
			gwBrief = (await this.idbStorage.getMetadata('guildWarBrief', null)) || {};
		} catch { /* empty */ }
		// tries is remaining attacks; GW gives 2 attacks Mon-Fri
		// When no active war, triesRemaining defaults to 0
		const gwAttacksMax = 2;
		const gwAttacksUsed = gwBrief.hasActiveWar ? (gwAttacksMax - (gwBrief.triesRemaining ?? 0)) : 0;

		// Clash of Worlds data from crossClanWar_getInfo (#119)
		let cowData = {};
		try {
			cowData = (await this.idbStorage.getMetadata('cowData', null)) || {};
		} catch { /* empty */ }
		const cowHeroUsed = cowData.heroAttacksMax ? (cowData.heroAttacksMax - (cowData.heroAttacksRemaining ?? 0)) : 0;
		const cowTitanUsed = cowData.titanAttacksMax ? (cowData.titanAttacksMax - (cowData.titanAttacksRemaining ?? 0)) : 0;

		// Raid Boss data from clanRaid_getInfo (#120)
		let raidBoss = {};
		try {
			raidBoss = (await this.idbStorage.getMetadata('currentRaidBoss', null)) || {};
		} catch { /* empty */ }
		const raidBossLevel = raidBoss.bossLevel || 0;
		const raidBossAttacksUsed = raidBoss.attemptsUsed || 0;
		const raidBossAttacksMax = raidBoss.attemptsMax || 5;
		const raidMyDamage = raidBoss.myDamage || 0;

		let guildWarBattlesToday = 0;
		let guildRaidMinionToday = 0;

		try {
			// Only load today's battles via timestamp index instead of entire store (#150)
			const todayBattles = await this.idbStorage.getByIndexRange('battles', 'timestamp', { lower: todayISO });
			guildWarBattlesToday = todayBattles.filter((b) => b.battleType === 'GuildWar').length;
			guildRaidMinionToday = todayBattles.filter((b) => b.battleType === 'RaidBoss').length;
		} catch { /* empty */ }

		// ── New: Arena stats from arenaGetAll (#112) ─────────────────
		let arenaStats = {};
		try {
			arenaStats = (await this.idbStorage.getMetadata('arenaStats', null)) || {};
		} catch { /* empty */ }

		// ── New: Campaign progress from missionGetAll (#112) ─────────
		let campaignProgress = {};
		try {
			campaignProgress = (await this.idbStorage.getMetadata('campaignProgress', null)) || {};
		} catch { /* empty */ }

		// ── New: Titan Arena stats from titanArenaGetStatus (#112) ───
		let titanArenaStats = {};
		try {
			titanArenaStats = (await this.idbStorage.getMetadata('titanArenaStats', null)) || {};
		} catch { /* empty */ }

		// ── New: Battle Pass from battlePass_getInfo (#112) ──────────
		let battlePassData = {};
		try {
			battlePassData = (await this.idbStorage.getMetadata('battlePassData', null)) || {};
		} catch { /* empty */ }

		// ── New: Guild Activity from clanGetActivityStat (#112) ──────
		let guildActivity = {};
		try {
			guildActivity = (await this.idbStorage.getMetadata('guildActivityStats', null)) || {};
		} catch { /* empty */ }

		// ── New: Gacha pity from gacha_getInfo (#112) ────────────────
		let gachaData = {};
		try {
			gachaData = (await this.idbStorage.getMetadata('gacha_heroGacha', null)) || {};
		} catch { /* empty */ }

		// ── Phase 13: New metadata caches (#121) ─────────────────────
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

		// Sync status from syncClient (#130)
		let syncStatus = {};
		try {
			syncStatus = (await this.idbStorage.getMetadata('syncStatus', null)) || {};
		} catch { /* empty */ }

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

		// ── Inline SVG icons for resources (cross-browser safe) ──────
		// Unicode emojis like 🪙 (U+1FA99) don't render in many browsers.
		// CSS hue-rotate on 💎 produces pink not green. Use inline SVGs instead.
		const goldIcon = '<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle"><circle cx="12" cy="12" r="10" fill="#FFD54F" stroke="#FFA000" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" font-size="12" font-weight="bold" fill="#E65100">$</text></svg>';
		const emeraldIcon = '<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8" fill="#43A047" stroke="#2E7D32" stroke-width="1.5"/><polygon points="12,5 18,9 18,15 12,19 6,15 6,9" fill="#66BB6A" stroke="#43A047" stroke-width="0.5"/></svg>';
		const energyIcon = '<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill="#FFD600" stroke="#F9A825" stroke-width="1"/></svg>';

		// ── Completion bar helper (inline, dark theme) ───────────────
		const _miniBar = (pct, color) => {
			const clamped = Math.min(100, Math.max(0, pct || 0));
			return `<div style="flex:1;background:#333;border-radius:3px;height:8px;min-width:60px">` +
				`<div style="background:${color};height:100%;border-radius:3px;width:${clamped}%;transition:width .3s"></div>` +
				`</div>`;
		};

		// ── Player header section (#63) ──────────────────────────────
		const playerSection = playerName
			? `<div class="oj-section" style="padding:12px 14px">
					<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
						<span style="font-size:20px;font-weight:700;color:#e0e0e0">${this._escapeHtml(playerName)}</span>
						<span style="font-size:18px;font-weight:600;color:#90caf9">Lv ${playerLevel}</span>
					</div>
					${playerGuild ? `<div style="font-size:11px;color:#888;margin-bottom:8px">\uD83C\uDFF0 ${this._escapeHtml(playerGuild)}</div>` : ''}
					<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
						<span style="font-size:11px;color:#aaa;white-space:nowrap">\uD83C\uDFAF Overall</span>
						${_miniBar(overallAvg, '#7e57c2')}
						<span style="font-size:12px;font-weight:600;color:#ce93d8;min-width:42px;text-align:right">${overallAvg.toFixed(1)}%</span>
					</div>
					<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px;text-align:center">
							<div style="font-size:18px">${goldIcon}</div>
							<div style="font-size:14px;font-weight:700;color:#ffd54f">${gold}</div>
							<div style="font-size:10px;color:#888">Gold</div>
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px;text-align:center">
							<div style="font-size:18px">${emeraldIcon}</div>
							<div style="font-size:14px;font-weight:700;color:#66bb6a">${emeralds}</div>
							<div style="font-size:10px;color:#888">Emeralds</div>
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px;text-align:center">
							<div style="font-size:18px">${energyIcon}</div>
							<div style="font-size:14px;font-weight:700;color:#4fc3f7">${energy}</div>
							<div style="font-size:10px;color:#888">Energy${bottledEnergy !== '0' ? ` <span style="color:#aaa">(${bottledEnergy} \uD83C\uDF76)</span>` : ''}</div>
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px">
							<div style="font-size:12px;margin-bottom:4px">\uD83E\uDDB8 Heroes</div>
							<div style="display:flex;align-items:center;gap:4px">
								${_miniBar(heroAvg, '#81c784')}
								<span style="font-size:11px;font-weight:600;color:#81c784;min-width:36px;text-align:right">${heroAvg.toFixed(1)}%</span>
							</div>
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px">
							<div style="font-size:12px;margin-bottom:4px">\uD83D\uDCA0 Titans</div>
							<div style="display:flex;align-items:center;gap:4px">
								${_miniBar(titanAvg, '#ce93d8')}
								<span style="font-size:11px;font-weight:600;color:#ce93d8;min-width:36px;text-align:right">${titanAvg.toFixed(1)}%</span>
							</div>
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px">
							<div style="font-size:12px;margin-bottom:4px">\uD83D\uDC3E Pets</div>
							<div style="display:flex;align-items:center;gap:4px">
								${_miniBar(petAvg, '#ffb74d')}
								<span style="font-size:11px;font-weight:600;color:#ffb74d;min-width:36px;text-align:right">${petAvg.toFixed(1)}%</span>
							</div>
						</div>
					</div>
					<div style="display:flex;gap:6px;flex-wrap:wrap">
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\u2705</div>
							<div style="font-size:16px;font-weight:700;color:#81c784">${dailyQuestsCompleted}/${dailyQuestsTotal || '?'}</div>
							<div style="font-size:10px;color:#888">Daily Quests</div>
							${this._stalenessTag(questSummary.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDFF0</div>
							<div style="font-size:16px;font-weight:700;color:#ffb74d">${guildQuestsCompleted}/${guildQuestsTotal || '?'}</div>
							<div style="font-size:10px;color:#888">Guild Quests</div>
							${this._stalenessTag(questSummary.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\u2694\uFE0F</div>
							<div style="font-size:16px;font-weight:700;color:#ef9a9a">${gwBrief.hasActiveWar ? `${gwAttacksUsed}/${gwAttacksMax}` : 'No War'}</div>
							<div style="font-size:10px;color:#888">Guild War</div>
							${this._stalenessTag(gwBrief.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDF0D</div>
							<div style="font-size:14px;font-weight:700;color:#ce93d8">${cowData.isActive ? `\uD83E\uDDB8${cowHeroUsed}/3 \uD83D\uDCA0${cowTitanUsed}/2` : 'No CoW'}</div>
							<div style="font-size:10px;color:#888">Clash of Worlds</div>
							${this._stalenessTag(cowData.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83D\uDC32</div>
							<div style="font-size:14px;font-weight:700;color:#4fc3f7">${raidBossAttacksUsed}/${raidBossAttacksMax}</div>
							<div style="font-size:10px;color:#888">Raid Boss${raidBossLevel ? ` (Lv${raidBossLevel})` : ''}</div>
							${raidMyDamage > 0 ? `<div style="font-size:9px;color:#aaa">${raidMyDamage.toLocaleString()} dmg</div>` : ''}
							${this._stalenessTag(raidBoss.lastUpdate)}
						</div>
					</div>
					<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDFC6</div>
							<div style="font-size:16px;font-weight:700;color:#4fc3f7">${arenaStats.arenaPlace ? `#${arenaStats.arenaPlace}` : '\u2014'}</div>
							<div style="font-size:10px;color:#888">Arena Rank</div>
							${arenaStats.totalBattles ? `<div style="font-size:9px;color:#aaa">${arenaStats.winRate}% WR (${arenaStats.totalWins}/${arenaStats.totalBattles})</div>` : ''}
							${this._stalenessTag(arenaStats.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDFDF\uFE0F</div>
							<div style="font-size:16px;font-weight:700;color:#ffb74d">${arenaStats.grandPlace ? `#${arenaStats.grandPlace}` : '\u2014'}</div>
							<div style="font-size:10px;color:#888">Grand Arena</div>
							${this._stalenessTag(arenaStats.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83D\uDCA0</div>
							<div style="font-size:16px;font-weight:700;color:#ce93d8">${titanArenaStats.rank ? `#${titanArenaStats.rank}` : '\u2014'}</div>
							<div style="font-size:10px;color:#888">Titan Arena</div>
							${titanArenaStats.tier ? `<div style="font-size:9px;color:#aaa">T${titanArenaStats.tier} · ${titanArenaStats.dailyScore?.toLocaleString() || 0} today</div>` : ''}
							${this._stalenessTag(titanArenaStats.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83D\uDDFA\uFE0F</div>
							<div style="font-size:14px;font-weight:700;color:#81c784">${campaignProgress.totalStars ? `${campaignProgress.totalStars}/${campaignProgress.maxStars}` : '\u2014'}</div>
							<div style="font-size:10px;color:#888">Campaign Stars</div>
							${campaignProgress.threeStarMissions ? `<div style="font-size:9px;color:#aaa">${campaignProgress.threeStarMissions}/${campaignProgress.totalMissions} ★★★</div>` : ''}
							${this._stalenessTag(campaignProgress.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDFAB</div>
							<div style="font-size:14px;font-weight:700;color:#fff176">${battlePassData.currentLevel ? `Lv${battlePassData.currentLevel}` : '\u2014'}</div>
							<div style="font-size:10px;color:#888">Battle Pass${battlePassData.ticketLabel ? ` (${battlePassData.ticketLabel})` : ''}</div>
							${battlePassData.exp ? `<div style="font-size:9px;color:#aaa">${battlePassData.exp?.toLocaleString()} XP</div>` : ''}
							${this._stalenessTag(battlePassData.lastUpdate)}
						</div>
						<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDFB0</div>
							<div style="font-size:14px;font-weight:700;color:#ef9a9a">${gachaData.pullsUntilPity != null && gachaData.pullsUntilPity >= 0 ? gachaData.pullsUntilPity : '\u2014'}</div>
							<div style="font-size:10px;color:#888">Pity Counter</div>
							${gachaData.totalOpenings ? `<div style="font-size:9px;color:#aaa">${gachaData.totalOpenings?.toLocaleString()} total pulls</div>` : ''}
							${this._stalenessTag(gachaData.lastUpdate)}
						</div>
					</div>
					${guildActivity.todayActivity ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
						<div style="flex:1;min-width:140px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\u2B50</div>
							<div style="font-size:14px;font-weight:700;color:#90caf9">${guildActivity.todayActivity.toLocaleString()}</div>
							<div style="font-size:10px;color:#888">Guild Activity Today</div>
							${this._stalenessTag(guildActivity.lastUpdate)}
						</div>
						<div style="flex:1;min-width:140px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDFF0</div>
							<div style="font-size:14px;font-weight:700;color:#90caf9">${guildActivity.todayDungeonActivity}</div>
							<div style="font-size:10px;color:#888">Dungeon Activity</div>
						</div>
						<div style="flex:1;min-width:140px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83D\uDCC8</div>
							<div style="font-size:14px;font-weight:700;color:#90caf9">${guildActivity.activitySum?.toLocaleString()}</div>
							<div style="font-size:10px;color:#888">Weekly Activity</div>
						</div>
					</div>` : ''}
					${(towerState.floorNumber || expeditionSlots.totalSlots || outlandBosses.bossCount || adventurePassed.totalAdventures) ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
						${towerState.floorNumber ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDFF0</div>
							<div style="font-size:16px;font-weight:700;color:#b39ddb">F${towerState.floorNumber}</div>
							<div style="font-size:10px;color:#888">Tower Floor</div>
							<div style="font-size:9px;color:#aaa">${Number(towerState.points || 0).toLocaleString()} pts${towerState.maySkipFloor ? ` · Skip\u2264${towerState.maySkipFloor}` : ''}</div>
							${this._stalenessTag(towerState.lastUpdate)}
						</div>` : ''}
						${expeditionSlots.totalSlots ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\u26F5</div>
							<div style="font-size:16px;font-weight:700;color:#80cbc4">${expeditionSlots.completeCount}/${expeditionSlots.totalSlots}</div>
							<div style="font-size:10px;color:#888">Expeditions</div>
							${expeditionSlots.activeCount ? `<div style="font-size:9px;color:#aaa">${expeditionSlots.activeCount} active</div>` : ''}
							${this._stalenessTag(expeditionSlots.lastUpdate)}
						</div>` : ''}
						${outlandBosses.bossCount ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83D\uDC80</div>
							<div style="font-size:16px;font-weight:700;color:#ef9a9a">${outlandBosses.totalChests}/${outlandBosses.bossCount * 3}</div>
							<div style="font-size:10px;color:#888">Outland Chests</div>
							${this._stalenessTag(outlandBosses.lastUpdate)}
						</div>` : ''}
						${adventurePassed.totalAdventures ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83D\uDDFA\uFE0F</div>
							<div style="font-size:16px;font-weight:700;color:#a5d6a7">${adventurePassed.totalCompletions}</div>
							<div style="font-size:10px;color:#888">Adventures</div>
							<div style="font-size:9px;color:#aaa">${adventurePassed.totalAdventures} maps</div>
							${this._stalenessTag(adventurePassed.lastUpdate)}
						</div>` : ''}
						${workshopBuffs.totalBuffs ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83D\uDD27</div>
							<div style="font-size:16px;font-weight:700;color:#ffcc80">${workshopBuffs.activeBuffs}/${workshopBuffs.totalBuffs}</div>
							<div style="font-size:10px;color:#888">Workshop Buffs</div>
							${this._stalenessTag(workshopBuffs.lastUpdate)}
						</div>` : ''}
						${(cosmeticCounts.avatars + cosmeticCounts.frames + cosmeticCounts.stickers) > 0 ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83C\uDFA8</div>
							<div style="font-size:14px;font-weight:700;color:#f48fb1">${cosmeticCounts.avatars + cosmeticCounts.frames + cosmeticCounts.stickers}</div>
							<div style="font-size:10px;color:#888">Cosmetics</div>
							<div style="font-size:9px;color:#aaa">${cosmeticCounts.avatars}\uD83D\uDC64 ${cosmeticCounts.frames}\uD83D\uDDBC\uFE0F ${cosmeticCounts.stickers}\u2B50</div>
						</div>` : ''}
						${invasionData.id ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
							<div style="font-size:14px">\uD83D\uDE80</div>
							<div style="font-size:16px;font-weight:700;color:#ff8a65">Active</div>
							<div style="font-size:10px;color:#888">Invasion</div>
							${invasionData.bestPlace ? `<div style="font-size:9px;color:#aaa">Best: #${invasionData.bestPlace}</div>` : ''}
							${this._stalenessTag(invasionData.lastUpdate)}
						</div>` : ''}
					</div>` : ''}
				</div>`
			: '';

		return `
			<div class="oj-dashboard">
				${playerSection}

				${winRateSection}

				${dailySummary}

				<div class="oj-section">
					<h3>\uD83D\uDCCA Tracked Data</h3>
					<div class="oj-stats-grid">
						${this._statCard(snapshotCount, 'Snapshots', '#4fc3f7')}
						${this._statCard(heroCount, 'Hero Records', '#81c784')}
						${this._statCard(battleCount, 'Battles', '#ffb74d')}
						${this._statCard(chestCount, 'Chests', '#ce93d8')}
						${this._statCard(resourceTxCount, 'Transactions', '#ef9a9a')}
						${this._statCard(questCount, 'Quests', '#fff176')}
						${this._statCard(apiLogCount, 'API Logs', '#90a4ae')}
						${this._statCard(goalCount, 'Goals', '#a5d6a7')}
					</div>
				</div>

				<div class="oj-section">
					<h3>\u2139\uFE0F Status</h3>
					<div class="oj-status-list">
						<div class="oj-status-row">
							<span>IndexedDB</span>
							<span class="oj-status-ok">Connected</span>
						</div>
						<div class="oj-status-row">
							<span>API Interception</span>
							<span class="${this.gameTracker?.isTracking ? 'oj-status-ok' : 'oj-status-err'}">${this.gameTracker?.isTracking ? 'Active' : 'Inactive'}</span>
						</div>
						<div class="oj-status-row">
							<span>Last Snapshot</span>
							<span class="oj-mono">${lastSnapshotTime}</span>
						</div>
						<div class="oj-status-row">
							<span>API Sync</span>
							${syncStatus.timestamp
								? `<span class="${syncStatus.ok ? 'oj-status-ok' : 'oj-status-err'}" title="${this._escapeHtml(syncStatus.message || '')}">${syncStatus.ok ? '\u2705' : '\u274C'} ${new Date(syncStatus.timestamp).toLocaleTimeString()}${!syncStatus.ok ? ` \u2014 ${this._escapeHtml(syncStatus.message || 'Error')}` : ''}</span>`
								: '<span style="color:#888">Not synced</span>'}
						</div>
						${errorCount > 0 ? `<div class="oj-status-row"><span>Errors</span><span class="oj-status-err">${errorCount}</span></div>` : ''}
						<div class="oj-status-row">
							<span>Version</span>
							<span>${__OJ_VERSION__}</span>
						</div>
					</div>
				</div>

				${await this._renderSuggestionsSection()}

				${await this._renderBattleRecommendationsSection()}

				${await this._renderTeamRecommendationEngineSection()}

				${await this._renderExternalToolsSection()}

				<div class="oj-section">
					<h3>\uD83C\uDFAF Quick Tips</h3>
					<ul class="oj-tips">
						<li>Play the game normally \u2014 all API calls are intercepted automatically</li>
						<li>Open your hero roster, arena, or inventory to capture data</li>
						<li>Check the <strong>Activity</strong> tab to see intercepted calls in real-time</li>
						<li>Press <kbd>Ctrl+Shift+H</kbd> to toggle this panel</li>
					</ul>
				</div>
			</div>
		`;
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

		const now = Date.now();
		const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

		// Group by type and calculate win rates
		const types = [
			{ key: 'Arena', label: '\u2694\uFE0F Arena', color: '#4fc3f7' },
			{ key: 'TitanArena', label: '\uD83D\uDEE1\uFE0F Titan Arena', color: '#ce93d8' },
			{ key: 'GrandArena', label: '\uD83C\uDFC6 Grand Arena', color: '#ffb74d' },
		];

		const cards = types.map(({ key, label, color }) => {
			const all = battles.filter((b) => b.battleType === key);
			const recent = all.filter((b) => {
				const ts = b.timestamp ? new Date(b.timestamp).getTime() : 0;
				return ts >= sevenDaysAgo;
			});

			if (all.length === 0) return '';

			const allWins = all.filter((b) => b.isWin).length;
			const allPct = Math.round((allWins / all.length) * 100);
			const recentWins = recent.filter((b) => b.isWin).length;
			const recentPct = recent.length > 0 ? Math.round((recentWins / recent.length) * 100) : 0;

			return `
				<div style="flex:1;min-width:140px;background:#2a2a2e;border-radius:6px;padding:8px">
					<div style="font-size:12px;font-weight:600;margin-bottom:4px">${label}</div>
					<div style="font-size:20px;font-weight:700;color:${color}">${allPct}%</div>
					<div style="background:#444;border-radius:3px;height:6px;margin:4px 0">
						<div style="background:${color};height:100%;border-radius:3px;width:${allPct}%"></div>
					</div>
					<div style="font-size:10px;color:#aaa">
						${allWins}W / ${all.length - allWins}L all time
						${recent.length > 0 ? `\u00B7 ${recentPct}% last 7d (${recentWins}/${recent.length})` : ''}
					</div>
				</div>`;
		}).filter(Boolean);

		if (cards.length === 0) return '';

		return `
			<div class="oj-section">
				<h3>\uD83C\uDFC5 Win Rates</h3>
				<div style="display:flex;gap:8px;flex-wrap:wrap">
					${cards.join('')}
				</div>
			</div>
		`;
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

			/** Map priority to icon + colour */
			const priMap = {
				high: { icon: '\uD83D\uDD34', color: '#ef5350' },
				medium: { icon: '\uD83D\uDFE1', color: '#ffb74d' },
				low: { icon: '\uD83D\uDFE2', color: '#81c784' },
			};

			/** Map category/type to icon */
			const catIcon = {
				goal: '\uD83C\uDFAF',
				resource: '\uD83D\uDCB0',
				hero: '\uD83E\uDDB8',
				battle: '\u2694\uFE0F',
			};

			// Show at most 6 suggestions, sorted by priority (high first)
			const order = { high: 0, medium: 1, low: 2 };
			const sorted = [...suggestions]
				.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9))
				.slice(0, 6);

			const rows = sorted.map((s) => {
				const pri = priMap[s.priority] || priMap.medium;
				const icon = catIcon[s.type] || '\uD83D\uDCA1';
				return `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid #333">
					<span style="font-size:14px;flex-shrink:0">${icon}</span>
					<div style="flex:1;min-width:0">
						<div style="font-size:12px;font-weight:600;color:${pri.color}">${pri.icon} ${this._escapeHtml(s.title)}</div>
						<div style="font-size:11px;color:#aaa;margin-top:2px">${this._escapeHtml(s.description)}</div>
					</div>
				</div>`;
			}).join('');

			const stats = this.suggestionsEngine.getStats();

			return `<div class="oj-section">
				<h3>\uD83D\uDCA1 Suggestions <span style="font-size:11px;font-weight:400;color:#888">(${stats.active} active)</span></h3>
				${rows}
				${suggestions.length > 6 ? `<div style="font-size:11px;color:#888;margin-top:6px;text-align:center">+ ${suggestions.length - 6} more</div>` : ''}
			</div>`;
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

			const rows = recs.slice(0, 3).map((rec, index) => {
				const sim = Number(rec.simulatedWinProbability || 0);
				const low = Number(rec.simulationConfidenceLow || 0);
				const high = Number(rec.simulationConfidenceHigh || 0);
				const wr = Number(rec.weightedWinRate || rec.winRate || 0);
				const preview = this._escapeHtml(rec.teamPreview || rec.teamKey || 'Unknown Team');
				const rationale = this._escapeHtml(rec.rationale || 'No rationale available.');

				return `<div style="padding:8px;border:1px solid #2f3f5a;border-radius:8px;background:#182234;margin-top:${index === 0 ? '0' : '6px'}">
					<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
						<div style="font-size:12px;font-weight:700;color:#9ed0ff">${preview}</div>
						<div style="font-size:11px;color:#8ec5ff">Sim ${(sim * 100).toFixed(1)}%</div>
					</div>
					<div style="font-size:11px;color:#9fb4cf;margin-top:4px">Weighted ${(wr * 100).toFixed(1)}% • CI ${(low * 100).toFixed(1)}-${(high * 100).toFixed(1)}%</div>
					<div style="font-size:11px;color:#8c8c8c;margin-top:4px">${rationale}</div>
				</div>`;
			}).join('');

			return `<div class="oj-section">
				<h3>\uD83E\uDDE0 Arena Recommendations</h3>
				${rows}
			</div>`;
		} catch {
			return '';
		}
	}

	/**
	 * Get recommendations from cache/API for dashboard cards.
	 *
	 * @returns {Promise<object|null>} API payload or cached payload
	 * @private
	 */
	async _getBattleRecommendationsPayload() {
		const cacheKey = 'battleRecommendations:arena';
		const now = Date.now();

		let cached = null;
		try {
			cached = await this.idbStorage.getMetadata(cacheKey, null);
			if (cached?.timestamp && (now - cached.timestamp) < RECOMMENDATIONS_CACHE_TTL_MS && cached?.payload) {
				return cached.payload;
			}
		} catch {
			cached = null;
		}

		try {
			const response = await fetch(BATTLE_RECOMMENDATIONS_URL);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const payload = await response.json();
			await this.idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
			return payload;
		} catch {
			return cached?.payload || null;
		}
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
			const payload = await this._getTeamRecommendationEnginePayload(selectedMode, selectedObjective, trendWindowDays);
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

			const rows = recs.slice(0, 3).map((rec, index) => {
				const win = Number(rec.estimatedWinProbability || 0);
				const ready = Number(rec.readinessScore || 0);
				const confidence = Number(rec.confidenceScore || 0);
				const finalScore = Number(rec.finalScore || 0);
				const profile = this._escapeHtml(rec.modeProfile || 'default');
				const topProvenance = Array.isArray(rec.provenance) && rec.provenance.length > 0
					? rec.provenance[0]
					: null;
				const provenanceText = topProvenance
					? `${this._escapeHtml(topProvenance.sourceName || 'source')} ${(Number(topProvenance.confidence || 0) * 100).toFixed(0)}%`
					: 'no provenance';
				const provenanceRows = Array.isArray(rec.provenance)
					? rec.provenance.slice(0, 5).map((entry) => {
						const sourceName = this._escapeHtml(entry?.sourceName || 'unknown source');
						const sourceType = this._escapeHtml(entry?.sourceType || 'signal');
						const entryConfidence = (Number(entry?.confidence || 0) * 100).toFixed(0);
						const detail = this._escapeHtml(entry?.detail || 'no detail');
						const contribution = entry?.contribution && typeof entry.contribution === 'object'
							? entry.contribution
							: null;
						const contributionRows = contribution
							? [
								typeof contribution.winProbability === 'number' ? `W ${(contribution.winProbability * 100).toFixed(1)}%` : '',
								typeof contribution.readiness === 'number' ? `R ${(contribution.readiness * 100).toFixed(1)}%` : '',
								typeof contribution.confidence === 'number' ? `C ${(contribution.confidence * 100).toFixed(1)}%` : '',
								typeof contribution.winWeight === 'number' ? `wW ${(contribution.winWeight * 100).toFixed(0)}%` : '',
								typeof contribution.readinessWeight === 'number' ? `wR ${(contribution.readinessWeight * 100).toFixed(0)}%` : '',
								typeof contribution.confidenceWeight === 'number' ? `wC ${(contribution.confidenceWeight * 100).toFixed(0)}%` : '',
								typeof contribution.baseScore === 'number' ? `base ${(contribution.baseScore * 100).toFixed(1)}%` : '',
								typeof contribution.externalBonus === 'number' ? `bonus ${(contribution.externalBonus * 100).toFixed(1)}%` : '',
								typeof contribution.finalScore === 'number' ? `final ${(contribution.finalScore * 100).toFixed(1)}%` : '',
								typeof contribution.externalModeWeight === 'number' ? `modeW ${(contribution.externalModeWeight * 100).toFixed(0)}%` : '',
								typeof contribution.sourceScale === 'number' ? `scale ${(contribution.sourceScale * 100).toFixed(0)}%` : '',
								typeof contribution.sourceConfidence === 'number' ? `srcConf ${(contribution.sourceConfidence * 100).toFixed(0)}%` : '',
								typeof contribution.frictionPenalty === 'number' ? `friction ${(contribution.frictionPenalty * 100).toFixed(1)}%` : '',
								typeof contribution.resourcePressure === 'number' ? `pressure ${(contribution.resourcePressure * 100).toFixed(0)}%` : '',
							].filter(Boolean)
							: [];
						const sourceUrl = typeof entry?.sourceUrl === 'string' && entry.sourceUrl.trim()
							? `<a href="${this._escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#95d5b2;text-decoration:none">source</a>`
							: '';

						return `<div style="padding:4px 0;border-top:1px dashed #2d5845">
							<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
								<div style="font-size:10px;color:#9fd8bc">${sourceName} <span style="color:#739b89">(${sourceType})</span></div>
								<div style="font-size:10px;color:#8ac9a8">${entryConfidence}% ${sourceUrl}</div>
							</div>
							<div style="font-size:10px;color:#7f9f92;margin-top:2px">${detail}</div>
							${contributionRows.length > 0 ? `<div style="font-size:10px;color:#86b9a1;margin-top:2px">${this._escapeHtml(contributionRows.join(' • '))}</div>` : ''}
						</div>`;
					}).join('')
					: '';
				const preview = this._escapeHtml(rec.teamPreview || 'Unknown Team');
				const rationale = this._escapeHtml(rec.rationale || 'No rationale available.');

				return `<div style="padding:8px;border:1px solid #2f5a3f;border-radius:8px;background:#182b24;margin-top:${index === 0 ? '0' : '6px'}">
					<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
						<div style="font-size:12px;font-weight:700;color:#a8e6c8">${preview}</div>
						<div style="font-size:11px;color:#8ad4ac">${this._escapeHtml(rec.source || 'engine')}</div>
					</div>
					<div style="font-size:10px;color:#7cc1a0;margin-top:2px">profile ${profile}</div>
					<div style="font-size:11px;color:#9fc7b2;margin-top:4px">Win ${(win * 100).toFixed(1)}% • Ready ${(ready * 100).toFixed(0)}% • Conf ${(confidence * 100).toFixed(0)}% • Final ${(finalScore * 100).toFixed(1)}%</div>
					<div style="font-size:10px;color:#7f9f92;margin-top:2px">${provenanceText}</div>
					<div style="font-size:11px;color:#8c8c8c;margin-top:4px">${rationale}</div>
					${provenanceRows ? `<details style="margin-top:6px">
						<summary style="cursor:pointer;font-size:10px;color:#95d5b2">Provenance details</summary>
						<div style="margin-top:4px;background:#13261f;border:1px solid #2a4739;border-radius:6px;padding:4px 6px">${provenanceRows}</div>
					</details>` : ''}
				</div>`;
			}).join('');

			return `<div class="oj-section">
				<h3>🧠 Team Recommendation Engine</h3>
				<div style="font-size:10px;color:#7dbba0;margin:2px 0 6px 0">${this._escapeHtml(profileSummary)}</div>
				<div style="font-size:10px;color:#8bc9b0;margin:2px 0 6px 0">${calibrationSummary}</div>
				<div style="margin:4px 0 8px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
					<label for="oj-team-mode-filter" style="font-size:11px;color:#a7b3bb">Mode</label>
					<select id="oj-team-mode-filter" style="background:#1f252b;border:1px solid #37474f;color:#cfd8dc;border-radius:6px;padding:3px 6px;font-size:11px">
						${modeOptions.map((mode) => {
							const value = this._escapeHtml(mode.value || 'arena');
							const label = this._escapeHtml(mode.label || mode.value || 'arena');
							return `<option value="${value}" ${selectedMode === mode.value ? 'selected' : ''}>${label}</option>`;
						}).join('')}
					</select>
					<label for="oj-team-objective-filter" style="font-size:11px;color:#a7b3bb">Objective</label>
					<select id="oj-team-objective-filter" style="background:#1f252b;border:1px solid #37474f;color:#cfd8dc;border-radius:6px;padding:3px 6px;font-size:11px">
						${objectiveOptions.map((obj) => {
							const value = this._escapeHtml(obj.value || 'balanced');
							const label = this._escapeHtml(obj.label || obj.value || 'balanced');
							return `<option value="${value}" ${selectedObjective === obj.value ? 'selected' : ''}>${label}</option>`;
						}).join('')}
					</select>
					<label for="oj-team-trend-window-filter" style="font-size:11px;color:#a7b3bb">Trend</label>
					<select id="oj-team-trend-window-filter" data-default-window="${this._escapeHtml(String(defaultTrendWindowDays))}" style="background:#1f252b;border:1px solid #37474f;color:#cfd8dc;border-radius:6px;padding:3px 6px;font-size:11px">
						<option value="auto" ${selectedTrendWindowPreference === 'auto' ? 'selected' : ''}>Auto (${defaultTrendWindowDays}d)</option>
						${trendWindowOptions.map((windowDays) => {
							const numericDays = Number(windowDays || 0);
							const value = Number.isFinite(numericDays) && numericDays > 0 ? String(numericDays) : '30';
							return `<option value="${value}" ${selectedTrendWindowPreference === value ? 'selected' : ''}>${this._escapeHtml(value)}d</option>`;
						}).join('')}
					</select>
				</div>
				${rows}
			</div>`;
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
			const response = await fetch(TEAM_RECOMMENDATION_PREFERENCES_URL, {
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
		const cacheKey = 'teamRecommendationProfiles:metadata';
		const now = Date.now();

		let cached = null;
		try {
			cached = await this.idbStorage.getMetadata(cacheKey, null);
			if (cached?.timestamp && (now - cached.timestamp) < TOOLS_CATALOG_CACHE_TTL_MS && cached?.payload) {
				return cached.payload;
			}
		} catch {
			cached = null;
		}

		try {
			const response = await fetch(TEAM_RECOMMENDATION_PROFILES_URL);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const payload = await response.json();
			await this.idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
			return payload;
		} catch {
			return cached?.payload || null;
		}
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
		const now = Date.now();

		let cached = null;
		try {
			cached = await this.idbStorage.getMetadata(cacheKey, null);
			if (cached?.timestamp && (now - cached.timestamp) < RECOMMENDATIONS_CACHE_TTL_MS && cached?.payload) {
				return cached.payload;
			}
		} catch {
			cached = null;
		}

		try {
			const url = new URL(TEAM_RECOMMENDATIONS_URL);
			url.searchParams.set('mode', mode || 'arena');
			url.searchParams.set('objective', objective || 'balanced');
			url.searchParams.set('limit', '3');
			url.searchParams.set('minSamples', '2');
			url.searchParams.set('preferredTrendWindowDays', String(Math.max(1, Number(trendWindowDays || 30))));

			const response = await fetch(url.toString());
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const payload = await response.json();
			await this.idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
			return payload;
		} catch {
			return cached?.payload || null;
		}
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
		const now = Date.now();

		let cached = null;
		try {
			cached = await this.idbStorage.getMetadata(cacheKey, null);
			if (cached?.timestamp && (now - cached.timestamp) < RECOMMENDATIONS_CACHE_TTL_MS && cached?.payload) {
				return cached.payload;
			}
		} catch {
			cached = null;
		}

		try {
			const url = new URL(TEAM_RECOMMENDATION_BACKTEST_URL);
			url.searchParams.set('mode', mode || 'arena');
			url.searchParams.set('objective', objective || 'balanced');
			url.searchParams.set('lookbackDays', '30');
			url.searchParams.set('limit', '3');
			url.searchParams.set('minSamples', '2');

			const response = await fetch(url.toString());
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const payload = await response.json();
			await this.idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
			return payload;
		} catch {
			return cached?.payload || null;
		}
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
		const now = Date.now();

		let cached = null;
		try {
			cached = await this.idbStorage.getMetadata(cacheKey, null);
			if (cached?.timestamp && (now - cached.timestamp) < RECOMMENDATIONS_CACHE_TTL_MS && cached?.payload) {
				return cached.payload;
			}
		} catch {
			cached = null;
		}

		try {
			const url = new URL(TEAM_RECOMMENDATION_CALIBRATION_URL);
			url.searchParams.set('mode', mode || 'arena');
			url.searchParams.set('preferredTrendWindowDays', String(Math.max(1, Number(trendWindowDays || 30))));

			const response = await fetch(url.toString());
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const payload = await response.json();
			await this.idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
			return payload;
		} catch {
			return cached?.payload || null;
		}
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
			const tools = Array.isArray(payload?.tools) ? payload.tools : [];
			if (tools.length === 0) return '';
			const selectedStatus = this.prefStorage.get('toolsCatalogStatusFilter', '');
			const statusOptions = Array.isArray(metadata?.verificationStatuses) && metadata.verificationStatuses.length > 0
				? metadata.verificationStatuses
				: ['verified', 'partial', 'unverified', 'stale'];

			const rows = tools.slice(0, 4).map((tool) => {
				const status = (tool.verificationStatus || 'unknown').toLowerCase();
				const confidence = Number(tool.confidenceScore || 0);
				const reviewed = tool.lastReviewedUtc ? new Date(tool.lastReviewedUtc) : null;
				const ageDays = reviewed ? Math.floor((Date.now() - reviewed.getTime()) / (24 * 60 * 60 * 1000)) : 9999;
				const staleTag = ageDays > 90 ? ' • stale' : '';
				const statusColor = status === 'verified'
					? '#81c784'
					: status === 'partial'
						? '#ffb74d'
						: '#ef5350';

				return `<div style="padding:8px;border:1px solid #37474f;border-radius:8px;background:#1f252b;margin-top:6px">
					<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
						<div style="font-size:12px;font-weight:700;color:#cfd8dc">${this._escapeHtml(tool.name || 'Unknown Tool')}</div>
						<span style="font-size:10px;color:${statusColor}">${this._escapeHtml(status)} ${(confidence * 100).toFixed(0)}%</span>
					</div>
					<div style="font-size:11px;color:#a7b3bb;margin-top:3px">${this._escapeHtml(tool.category || 'tool')} • reviewed ${reviewed ? reviewed.toISOString().slice(0, 10) : 'n/a'}${staleTag}</div>
					<div style="font-size:11px;color:#93a1aa;margin-top:4px">${this._escapeHtml(tool.capabilities || '')}</div>
					<div style="font-size:10px;color:#7f8b92;margin-top:3px">${this._escapeHtml(tool.caveats || '')}</div>
					<div style="margin-top:6px"><a href="${this._escapeHtml(tool.url || '#')}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#64b5f6">Open Tool</a></div>
				</div>`;
			}).join('');

			return `<div class="oj-section">
				<h3>\uD83E\uDDF0 External Tools</h3>
				<div style="margin:4px 0 8px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
					<label for="oj-tools-status-filter" style="font-size:11px;color:#a7b3bb">Status</label>
					<select id="oj-tools-status-filter" style="background:#1f252b;border:1px solid #37474f;color:#cfd8dc;border-radius:6px;padding:3px 6px;font-size:11px">
						<option value="" ${selectedStatus === '' ? 'selected' : ''}>all</option>
						${statusOptions.map((status) => `<option value="${this._escapeHtml(status)}" ${selectedStatus === status ? 'selected' : ''}>${this._escapeHtml(status)}</option>`).join('')}
					</select>
				</div>
				${rows}
				${tools.length > 4 ? `<div style="font-size:11px;color:#888;margin-top:6px;text-align:center">+ ${tools.length - 4} more in desktop Settings</div>` : ''}
			</div>`;
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
		const now = Date.now();

		let cached = null;
		try {
			cached = await this.idbStorage.getMetadata(cacheKey, null);
			if (cached?.timestamp && (now - cached.timestamp) < TOOLS_CATALOG_CACHE_TTL_MS && cached?.payload) {
				return cached.payload;
			}
		} catch {
			cached = null;
		}

		try {
			const url = new URL(TOOLS_CATALOG_URL);
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

			const response = await fetch(url.toString());
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const payload = await response.json();
			await this.idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
			return payload;
		} catch {
			return cached?.payload || null;
		}
	}

	/**
	 * Get external tools catalog filter metadata from cache/API.
	 *
	 * @returns {Promise<object|null>} Filter metadata payload or cached payload
	 * @private
	 */
	async _getExternalToolsFilterMetadata() {
		const cacheKey = 'toolsCatalog:filters';
		const now = Date.now();

		let cached = null;
		try {
			cached = await this.idbStorage.getMetadata(cacheKey, null);
			if (cached?.timestamp && (now - cached.timestamp) < TOOLS_CATALOG_CACHE_TTL_MS && cached?.payload) {
				return cached.payload;
			}
		} catch {
			cached = null;
		}

		try {
			const response = await fetch(TOOLS_CATALOG_FILTERS_URL);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);

			const payload = await response.json();
			await this.idbStorage.setMetadata(cacheKey, { timestamp: now, payload });
			return payload;
		} catch {
			return cached?.payload || {
				verificationStatuses: ['verified', 'partial', 'unverified', 'stale'],
				defaultMinConfidence: 0.65,
				defaultIncludeStale: false,
				defaultSort: 'confidence',
			};
		}
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

		let todayBattles = 0;
		let todayWins = 0;
		let todayChests = 0;
		let todayQuests = 0;
		let todayUpgrades = 0;

		// Battles: filter pre-loaded array (no extra DB call)
		try {
			const todayB = (battles || []).filter((b) => b.timestamp >= todayISO);
			todayBattles = todayB.length;
			todayWins = todayB.filter((b) => b.isWin).length;
		} catch { /* empty */ }

		// Chests: index-range query on 'timestamp' — only today's records
		try {
			const todayC = await this.idbStorage.getByIndexRange('chests', 'timestamp', { lower: todayISO });
			todayChests = todayC.length;
		} catch { /* empty */ }

		// Quests: index-range query on 'completedAt' — only today's records
		try {
			const dailyQ = await this.idbStorage.getByIndexRange('dailyQuestCompletions', 'completedAt', { lower: todayISO });
			const guildQ = await this.idbStorage.getByIndexRange('guildQuestCompletions', 'completedAt', { lower: todayISO });
			todayQuests = dailyQ.length + guildQ.length;
		} catch { /* empty */ }

		// Upgrades: index-range query on 'timestamp' — only today's records
		try {
			const heroUp = await this.idbStorage.getByIndexRange('heroUpgrades', 'timestamp', { lower: todayISO });
			const titanUp = await this.idbStorage.getByIndexRange('titanUpgrades', 'timestamp', { lower: todayISO });
			todayUpgrades = heroUp.length + titanUp.length;
		} catch { /* empty */ }

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

			if (logs.length === 0) {
				return `
					<div class="oj-activity">
						<h3>\uD83D\uDCE1 Live Activity Feed</h3>
						<p class="oj-empty">No activity captured yet. Navigate around in the game to generate events.</p>
					</div>
				`;
			}

			// Render fallback API log table
			const rows = logs.map((log) => {
				const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '\u2014';
				const name = log.name || log.endpoint || 'unknown';
				const status = log.success !== false
					? '<span class="oj-status-ok">OK</span>'
					: '<span class="oj-status-err">ERR</span>';
				return `
					<tr>
						<td class="oj-mono">${time}</td>
						<td>${this._escapeHtml(name)}</td>
						<td>${status}</td>
					</tr>
				`;
			}).join('');

			return `
				<div class="oj-activity">
					<h3>\uD83D\uDCE1 API Logs <span class="oj-muted">(${logs.length})</span></h3>
					<table class="oj-table">
						<thead><tr><th>Time</th><th>API Call</th><th>Status</th></tr></thead>
						<tbody>${rows}</tbody>
					</table>
				</div>
			`;
		}

		// Render color-coded activity events
		const displayLimit = DISPLAY_LIMIT_ACTIVITY;
		const rows = events.slice(0, displayLimit).map((evt) => {
			const time = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : '\u2014';
			const colorClass = this._activityColorClass(evt);
			const icon = this._activityIcon(evt);
			return `
				<div class="oj-activity-row ${colorClass}">
					<span class="oj-activity-time oj-mono">${time}</span>
					<span class="oj-activity-icon">${icon}</span>
					<span class="oj-activity-msg">${this._escapeHtml(evt.message || '')}</span>
				</div>
			`;
		}).join('');

		return `
			<div class="oj-activity">
				<h3>\uD83D\uDCE1 Live Activity Feed <span class="oj-muted">(showing ${Math.min(events.length, displayLimit)} of ${events.length} events)</span></h3>
				<div class="oj-activity-list">${rows}</div>
			</div>
		`;
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

		// Prefer the metadata cache (latest roster, one row per hero)
		let heroes = [];
		try {
			const cached = await this.idbStorage.getMetadata('heroesData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				heroes = cached;
			}
		} catch { /* empty */ }

		// Fallback: read from the heroes IDB store and deduplicate by heroId
		// Handles both legacy individual records and compressed batches (#43)
		if (heroes.length === 0) {
			try {
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
			} catch { /* empty */ }
		}

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
		let requirementsProjection = null;
		let requirementItemMeta = {};
		try {
			const [heroUpgrades, equipmentChanges, inventoryItemUsages, inventoryData] = await Promise.all([
				this.idbStorage.getAll('heroUpgrades', FETCH_LIMIT_LARGE).catch(() => []),
				this.idbStorage.getAll('equipmentChanges', FETCH_LIMIT_LARGE).catch(() => []),
				this.idbStorage.getAll('inventoryItemUsages', FETCH_LIMIT_LARGE).catch(() => []),
				this.idbStorage.getMetadata('inventoryData', {}).catch(() => ({})),
			]);

			const parsedInventory = this._parseRawInventory(inventoryData || {});
			requirementItemMeta = ProjectedItemCatalogResolver.buildRuntimeMetaMap(parsedInventory);

			requirementsProjection = HeroMaterialRequirementsCalculator.calculateProjectedRequirements({
				heroes,
				heroUpgrades,
				equipmentChanges,
				inventoryItemUsages,
				inventoryData,
				targetLevel: HeroCompletionCalculator.MAX_LEVEL,
				targetColorRank: 19,
				topItemLimit: 24,
			});
		} catch {
			requirementsProjection = null;
			requirementItemMeta = {};
		}

		const requirementsPanelHtml = this._renderHeroRequirementsPanel(requirementsProjection, requirementItemMeta);

		// Filter
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			heroes = heroes.filter((h) => {
				const name = (h.heroName || h.name || '').toLowerCase();
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
			const name = this._escapeHtml(h.heroName || h.name || `Hero #${hId}`);
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

		let allBattles = [];
		try {
			allBattles = await this.idbStorage.getAll('battles', FETCH_LIMIT_LARGE);
		} catch { /* empty */ }

		// Sort newest first
		allBattles.sort((a, b) => {
			const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
			const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
			return tb - ta;
		});

		if (allBattles.length === 0) {
			return `
				<div class="oj-battles">
					<h3>\u2694\uFE0F Battles</h3>
					<p class="oj-empty">No battle data captured yet. Fight in the arena to start tracking!</p>
				</div>
			`;
		}

		// Overall stats
		const totalWins = allBattles.filter((b) => b.isWin === true).length;
		const totalLosses = allBattles.length - totalWins;
		const overallWinRate = ((totalWins / allBattles.length) * 100).toFixed(1);

		// Per-type counts for sub-tab pills
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

		/** @type {Record<string, {count: number, wins: number}>} */
		const byType = {};
		for (const b of allBattles) {
			const t = b.battleType || 'Other';
			if (!byType[t]) byType[t] = { count: 0, wins: 0 };
			byType[t].count++;
			if (b.isWin === true) byType[t].wins++;
		}

		// Sub-tab pills (All + each type with counts, including unknown types from data)
		const knownTypes = new Set(types);
		const allTypes = [...types.filter((t) => byType[t])];
		// Add any additional types found in data that aren't in the known list
		for (const t of Object.keys(byType)) {
			if (!knownTypes.has(t) && t !== 'Other') allTypes.push(t);
		}
		const subTabs = ['all', ...allTypes];
		const pills = subTabs.map((t) => {
			const active = vs.subTab === t ? 'oj-pill-active' : '';
			if (t === 'all') {
				return `<button class="oj-pill oj-pill-btn ${active}" data-subtab="all">\uD83D\uDCCA All (${allBattles.length})</button>`;
			}
			const d = byType[t];
			const label = typeLabels[t] || t;
			const icon = typeIcons[t] || '\u2753';
			const wr = d.count > 0 ? ((d.wins / d.count) * 100).toFixed(0) : 0;
			return `<button class="oj-pill oj-pill-btn ${active}" data-subtab="${t}">${icon} ${label} ${d.count} (${wr}%)</button>`;
		}).join(' ');

		// Filter battles by selected sub-tab
		let filtered = vs.subTab === 'all'
			? allBattles
			: allBattles.filter((b) => b.battleType === vs.subTab);

		// Text filter (opponent name)
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			filtered = filtered.filter((b) => {
				const opp = (b.opponentName || b.defenderId || b.opponentId || '').toString().toLowerCase();
				return opp.includes(q);
			});
		}

		// Filtered stats
		const fWins = filtered.filter((b) => b.isWin === true).length;
		const fLosses = filtered.length - fWins;
		const fWinRate = filtered.length > 0 ? ((fWins / filtered.length) * 100).toFixed(1) : '0.0';

		// Paginate
		const totalCount = filtered.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = filtered.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		const rows = pageItems.map((b) => {
			const time = b.timestamp ? new Date(b.timestamp).toLocaleString() : '\u2014';
			const result = b.isWin === true
				? '<span class="oj-win">WIN</span>'
				: '<span class="oj-loss">LOSS</span>';
			const opponent = b.opponentName || b.defenderId || b.opponentId || '\u2014';
			const type = typeLabels[b.battleType] || b.battleType || '\u2014';

			// Rank change display for arena-type battles (#131)
			let rankHtml = '\u2014';
			if (b.rankBefore || b.rankAfter) {
				const before = b.rankBefore ? `#${b.rankBefore}` : '?';
				const after = b.rankAfter ? `#${b.rankAfter}` : '?';
				if (b.rankBefore && b.rankAfter) {
					const delta = b.rankBefore - b.rankAfter; // positive = rank improved (lower number)
					const cls = delta > 0 ? 'oj-win' : delta < 0 ? 'oj-loss' : 'oj-muted';
					const arrow = delta > 0 ? '\u25B2' : delta < 0 ? '\u25BC' : '\u25CF';
					rankHtml = `<span class="${cls}">${before}\u2192${after} ${arrow}</span>`;
				} else {
					rankHtml = `${before}\u2192${after}`;
				}
			}

			// Raid boss damage display (#131)
			let raidDmgHtml = '';
			if (b.battleType === 'RaidBoss' && b.damage > 0) {
				raidDmgHtml = `<span class="oj-mono oj-dmg">${this._formatCompact(b.damage)}</span>`;
			}

			// Calculate total damage/healing from compressed team data (#111)
			let totalDmg = 0;
			let totalHeal = 0;
			try {
				const team = b.playerHeroes ? JSON.parse(b.playerHeroes) : [];
				const flat = Array.isArray(team[0]) && Array.isArray(team[0][0]) ? team.flat() : team;
				for (const h of flat) {
					if (Array.isArray(h)) {
						totalDmg += h[5] || 0;
						totalHeal += h[6] || 0;
					}
				}
			} catch { /* empty */ }

			const dmgCell = raidDmgHtml || (totalDmg > 0 ? `<span class="oj-mono oj-dmg">${this._formatCompact(totalDmg)}</span>` : '\u2014');
			const healCell = totalHeal > 0 ? `<span class="oj-mono oj-heal">${this._formatCompact(totalHeal)}</span>` : '\u2014';

			// Grand Arena per-round results (#131)
			let roundResultsHtml = '';
			if (b.battleType === 'GrandArena' && b.roundResults) {
				try {
					const rounds = JSON.parse(b.roundResults);
					const pills = rounds.map((r, i) => {
						const cls = r.win ? 'oj-win' : 'oj-loss';
						return `<span class="oj-round-pill ${cls}" title="Round ${i + 1}: ${r.win ? 'Win' : 'Loss'} (${this._formatCompact(r.playerPower || 0)} vs ${this._formatCompact(r.opponentPower || 0)})">R${i + 1} ${r.win ? '\u2714' : '\u2718'}</span>`;
					}).join(' ');
					roundResultsHtml = `<div class="oj-round-results">${pills}</div>`;
				} catch { /* empty */ }
			}

			// Power display for PvP battles
			let powerHtml = '';
			if (b.playerPower || b.opponentPower) {
				powerHtml = `<span class="oj-mono oj-muted" title="Your power vs opponent power">${this._formatCompact(b.playerPower || 0)} vs ${this._formatCompact(b.opponentPower || 0)}</span>`;
			}

			// Battle detail row with team compositions and avatars
			const playerTeamHtml = this._renderBattleTeam(b.playerHeroes, '\uD83D\uDDE1\uFE0F Attack');
			const opponentTeamHtml = this._renderBattleTeam(b.opponentHeroes, '\uD83D\uDEE1\uFE0F Defense');
			const hasDetail = playerTeamHtml || opponentTeamHtml || roundResultsHtml || powerHtml;
			const battleId = `battle-${b.timestamp || Math.random()}`;

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

		let titans = [];
		try {
			const cached = await this.idbStorage.getMetadata('titansData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				titans = cached;
			}
		} catch { /* empty */ }

		// Fallback: read from the titans IDB store and deduplicate by titanId
		// Handles both legacy individual records and compressed batches (#43)
		if (titans.length === 0) {
			try {
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
			} catch { /* empty */ }
		}

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
				const name = (t.titanName || t.name || '').toLowerCase();
				return name.includes(q);
			});
		}

		// Sort (non-completion sort handled first, completion sort done after completionMap)
		if (vs.sortField !== 'completion') {
			titans = this._sortData(titans, vs.sortField, vs.sortDir);
		}

		const totalPower = titans.reduce((s, t) => s + (t.power || 0), 0);

		const TCalc = TitanCompletionCalculator;

		// Pre-compute completion for every titan (keyed by titanId for fast lookup)
		const completionMap = {};
		for (const t of titans) {
			const key = t.titanId || t.id;
			completionMap[key] = TCalc.calculateCompletion(t);
		}

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

		const rows = pageItems.map((t) => {
			const tId = t.titanId || t.id;
			const name = this._escapeHtml(t.titanName || t.name || `Titan #${tId}`);
			const elementDisplay = TCalc.formatElement(t.element);
			const comp = completionMap[tId] || { overall: 0, systems: {} };

			// Titan avatar from HW-Assist Calculator CDN (#109)
			// Titans use a separate directory with `titan_icon_` prefix, unlike heroes/pets
			const avatarUrl = `https://calc2.hw-assist.com/static/assets/images/titan_icons/titan_icon_${tId}.png`;

			// ── Artifacts column — 3 small icons with colored borders, star at top, level at bottom ──
			const artifacts = TCalc.parseArtifacts(t);
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

			// ── Totem (Element Spirit) stats ──
			const totemLevel = t.totemLevel || 0;
			const totemStar = t.totemStar || 0;
			const totemDisplay = (totemLevel > 0 || totemStar > 0)
				? `${elementDisplay}<br><span class="oj-totem-stats">${totemStar}\u2B50 L${totemLevel}</span>`
				: elementDisplay;

			// Build expandable per-system breakdown (hidden by default)
			const sysRows = Object.entries(TCalc.SYSTEM_LABELS).map(([key, label]) => {
				const pct = comp.systems[key] || 0;
				return `<div class="oj-sys-row">` +
					`<span class="oj-sys-icon">${TCalc.SYSTEM_ICONS[key] || ''}</span>` +
					`<span class="oj-sys-name">${label}</span>` +
					TCalc.renderBar(pct) +
					`</div>`;
			}).join('');

			return `
				<tr class="oj-titan-row" data-titan-id="${tId}">
					<td class="oj-avatar-cell"><img class="oj-hero-avatar" src="${avatarUrl}" alt="${name}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='';this.alt='\uD83D\uDCA0';this.className='oj-avatar-fallback'"></td>
					<td><strong>${name}</strong></td>
					<td>${t.level || '\u2014'}</td>
					<td>${'\u2B50'.repeat(Math.min(t.stars || 0, 6)) || '\u2014'}</td>
					<td>${totemDisplay}</td>
					<td class="oj-artifact-cell"><div class="oj-artifact-col">${artifactIcons}</div></td>
					<td class="oj-num">${t.power ? t.power.toLocaleString() : '\u2014'}</td>
					<td class="oj-completion-cell">${TCalc.renderBar(comp.overall)}</td>
				</tr>
				<tr class="oj-titan-detail" data-detail-for="${tId}" style="display:none">
					<td colspan="8">
						<div class="oj-sys-breakdown">${sysRows}</div>
					</td>
				</tr>
			`;
		}).join('');

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

		// Prefer the metadata cache (latest roster, one row per pet)
		let pets = [];
		try {
			const cached = await this.idbStorage.getMetadata('petsData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				pets = cached;
			}
		} catch { /* empty */ }

		// Fallback: read from the pets IDB store and deduplicate by petId
		if (pets.length === 0) {
			try {
				const raw = await this.idbStorage.getAll('pets', FETCH_LIMIT_MEDIUM);
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
			} catch { /* empty */ }
		}

		if (pets.length === 0) {
			return `
				<div class="oj-pets">
					<h3>\uD83D\uDC3E Pets</h3>
					<p class="oj-empty">No pet data captured yet. Open your pet roster in the game to trigger data capture.</p>
				</div>
			`;
		}

		// Pre-compute completion for every pet
		const completionMap = {};
		for (const p of pets) {
			const key = p.petId || p.id;
			completionMap[key] = PCalc.calculateCompletion(p);
		}

		// Filter by name
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			pets = pets.filter((p) => {
				const pId = p.petId || p.id;
				const name = (resolveHeroName(pId) || p.petName || p.name || '').toLowerCase();
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

		const rows = pageItems.map((p) => {
			const pId = p.petId || p.id;
			const name = this._escapeHtml(resolveHeroName(pId) || p.petName || p.name || `Pet #${pId}`);
			const comp = completionMap[pId] || { overall: 0, systems: {} };
			const patronageCount = PCalc.countPatronage(p.patronageData);

			// Pet avatar from HW-Assist Calculator CDN (#109)
			// Pet IDs are in the 6000-range; zero-padded to 4 digits
			const avatarUrl = `https://calc2.hw-assist.com/static/assets/images/hero_icons/${String(pId).padStart(4, '0')}.png`;

			// Build expandable per-system breakdown (hidden by default)
			const sysRows = Object.entries(PCalc.SYSTEM_LABELS).map(([key, label]) => {
				const pct = comp.systems[key] || 0;
				return `<div class="oj-sys-row">` +
					`<span class="oj-sys-icon">${PCalc.SYSTEM_ICONS[key] || ''}</span>` +
					`<span class="oj-sys-name">${label}</span>` +
					PCalc.renderBar(pct) +
					`</div>`;
			}).join('');

			// Patronage info for detail row
			const patronageInfo = patronageCount > 0
				? `<div class="oj-pet-patronage">\uD83D\uDC64 Supporting ${patronageCount} hero${patronageCount !== 1 ? 'es' : ''}</div>`
				: '';

			const colorVal = p.color || 0;
			const colorName = this._colorRankName(colorVal);
			const colorClass = this._colorRankClass(colorVal);

			return `
				<tr class="oj-pet-row" data-pet-id="${pId}">
					<td class="oj-avatar-cell"><img class="oj-hero-avatar ${colorClass}" src="${avatarUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'"></td>
					<td><strong>${name}</strong></td>
					<td>${p.level || '\u2014'}</td>
					<td>${'\u2B50'.repeat(Math.min(p.stars || p.star || 0, 6)) || '\u2014'}</td>
					<td class="${colorClass}">${colorName}</td>
					<td class="oj-num">${p.power ? p.power.toLocaleString() : '\u2014'}</td>
					<td class="oj-completion-cell">${PCalc.renderBar(comp.overall)}</td>
				</tr>
				<tr class="oj-pet-detail" data-detail-for="${pId}" style="display:none">
					<td colspan="7">
						<div class="oj-sys-breakdown">
							${sysRows}
						</div>
						${patronageInfo}
					</td>
				</tr>
			`;
		}).join('');

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

		let soulStonesHtml = '';
		try {
			const invData = await this.idbStorage.getMetadata('inventoryData', null);
			const fragPet = (invData && invData.fragmentPet) ? invData.fragmentPet : {};

			// Build per-pet soul stone breakdown
			const petStoneSummary = [];
			let totalUsable = 0; // Stones that can actually be applied (capped at what's needed)
			let totalNeeded = 0; // Total stones still needed across all pets
			let totalAvailable = 0; // Raw total stones in inventory

			for (const p of pets) {
				const pId = p.petId || p.id;
				const curStars = Math.min(p.stars || p.star || 0, 6);
				const stonesOwned = fragPet[pId] || fragPet[String(pId)] || 0;
				const alreadyUsed = STAR_COSTS_CUMULATIVE[curStars] || 0;
				const neededToMax = MAX_STONES_PER_PET - alreadyUsed;
				const nextStarCost = curStars < 6 ? STAR_COSTS_INCREMENTAL[curStars] : 0;
				const usable = Math.min(stonesOwned, neededToMax);

				totalAvailable += stonesOwned;
				totalUsable += usable;
				totalNeeded += neededToMax;

				const petName = this._escapeHtml(resolveHeroName(pId) || p.petName || p.name || `Pet #${pId}`);
				petStoneSummary.push({ pId, petName, curStars, stonesOwned, neededToMax, nextStarCost, usable });
			}

			// Overall progress: usable stones / needed stones
			const pct = totalNeeded > 0 ? Math.min(100, (totalUsable / totalNeeded) * 100) : 100;
			const barColor = PCalc.colorClass(pct);

			// Per-pet breakdown rows
			const stoneRows = petStoneSummary.map((s) => {
				const starDisplay = '\u2B50'.repeat(Math.min(s.curStars, 6));
				const isMaxed = s.curStars >= 6;
				const nextInfo = isMaxed
					? '<span class="oj-muted">MAX</span>'
					: `${s.nextStarCost} to ${s.curStars + 1}\u2605`;
				const statusClass = isMaxed ? 'oj-muted' : (s.stonesOwned >= s.nextStarCost && s.curStars < 6) ? 'oj-text-green' : '';
				return `<tr class="${statusClass}">` +
					`<td>${s.petName}</td>` +
					`<td>${starDisplay || '\u2014'}</td>` +
					`<td class="oj-num">${s.stonesOwned.toLocaleString()}</td>` +
					`<td class="oj-num">${nextInfo}</td>` +
					`<td class="oj-num">${isMaxed ? '\u2014' : s.neededToMax.toLocaleString()}</td>` +
					`</tr>`;
			}).join('');

			soulStonesHtml = `
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
		} catch { /* empty — no inventory data available yet */ }

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

		// ── Load all upgrade events from IDB stores ─────────────────────
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

		// Tag each record with its source category
		heroUpgrades.forEach((r) => { r._category = 'hero'; });
		titanUpgrades.forEach((r) => { r._category = 'titan'; });
		equipChanges.forEach((r) => { r._category = 'equipment'; r.upgradeType = r.changeType || 'equipped'; });

		const allUpgrades = [...heroUpgrades, ...titanUpgrades, ...equipChanges];

		if (allUpgrades.length === 0) {
			return `
				<div class="oj-upgrades">
					<h3>\uD83D\uDCC8 Upgrades</h3>
					<p class="oj-empty">No upgrade events captured yet. Upgrade heroes, titans, or equip gear to start tracking!</p>
				</div>
			`;
		}

		// ── Sub-tab pills for category filtering ────────────────────────
		const categoryCounts = {
			all: allUpgrades.length,
			hero: heroUpgrades.length,
			titan: titanUpgrades.length,
			equipment: equipChanges.length,
		};

		const subTab = vs.subTab || 'all';
		let filtered = subTab === 'all'
			? allUpgrades
			: allUpgrades.filter((r) => r._category === subTab);

		// ── Filter by name/type search ──────────────────────────────────
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			filtered = filtered.filter((r) => {
				const name = (r.heroName || r.titanName || '').toLowerCase();
				const type = (r.upgradeType || '').toLowerCase();
				return name.includes(q) || type.includes(q);
			});
		}

		// ── Sort ────────────────────────────────────────────────────────
		filtered.sort((a, b) => {
			const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
			const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
			return vs.sortDir === 'asc' ? ta - tb : tb - ta;
		});

		// ── Paginate ────────────────────────────────────────────────────
		const totalCount = filtered.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = filtered.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		// ── Upgrade type icons ──────────────────────────────────────────
		const typeIcons = {
			skill: '\uD83D\uDCD6',      // 📖
			artifact: '\uD83D\uDD2E',   // 🔮
			skin: '\uD83C\uDFA8',       // 🎨
			glyph: '\uD83D\uDD36',      // 🔶
			level: '\uD83D\uDCC8',       // 📈
			star: '\u2B50',              // ⭐
			color: '\uD83C\uDF08',       // 🌈
			equipped: '\uD83D\uDEE1\uFE0F', // 🛡️
			upgraded: '\u2B06\uFE0F',    // ⬆️
			evolved: '\uD83D\uDD04',     // 🔄
		};

		// ── Build rows ──────────────────────────────────────────────────
		const rows = pageItems.map((r) => {
			const ts = r.timestamp ? new Date(r.timestamp) : null;
			const timeStr = ts ? ts.toLocaleString() : '\u2014';
			const name = this._escapeHtml(r.heroName || r.titanName || '\u2014');
			const type = r.upgradeType || 'unknown';
			const icon = typeIcons[type] || '\u2728';
			const categoryBadge = r._category === 'hero'
				? '<span class="oj-badge-hero">Hero</span>'
				: r._category === 'titan'
					? '<span class="oj-badge-titan">Titan</span>'
					: '<span class="oj-badge-equip">Equip</span>';

			// Build detail string based on upgrade type
			let detail = '';
			if (type === 'skill') {
				detail = `Skill #${r.skillSlot ?? 0} \u2192 Lv.${r.skillLevelAfter || '?'}`;
			} else if (type === 'artifact') {
				detail = `${r.artifactType || r.artifactName || 'Artifact'} \u2192 Lv.${r.levelAfter || '?'}`;
			} else if (type === 'skin') {
				detail = `${r.skinName || 'Skin'} \u2192 Lv.${r.levelAfter || '?'}${r.isNewUnlock ? ' \uD83C\uDD95' : ''}`;
			} else if (type === 'glyph') {
				detail = `${r.glyphType || 'Glyph'} enchanted`;
			} else if (type === 'level') {
				detail = `\u2192 Lv.${r.levelAfter || '?'}`;
			} else if (type === 'star') {
				detail = `${r.starsBefore || '?'}\u2605 \u2192 ${r.starsAfter || '?'}\u2605`;
			} else if (type === 'color') {
				detail = `${r.colorBefore || '?'} \u2192 ${r.colorAfter || '?'}`;
			} else if (r._category === 'equipment') {
				detail = `Slot ${r.slotIndex ?? '?'} ${type}`;
			}

			const powerStr = r.powerAfter ? r.powerAfter.toLocaleString() : '\u2014';

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

		// ── Sub-tab pills ───────────────────────────────────────────────
		const pills = Object.entries(categoryCounts).map(([key, count]) => {
			const active = key === subTab ? 'oj-pill-active' : '';
			const labels = { all: 'All', hero: '\uD83E\uDDB8 Hero', titan: '\uD83D\uDCA0 Titan', equipment: '\uD83D\uDEE1\uFE0F Equipment' };
			return `<button class="oj-pill-btn ${active}" data-sub-tab="${key}">${labels[key] || key} (${count})</button>`;
		}).join('');

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

		// ── Load chest openings from IDB store first (proper source) ────
		let chests = [];
		try {
			chests = await this.idbStorage.getAll('chests', FETCH_LIMIT_LARGE);
		} catch { /* empty */ }

		// Fallback: metadata cache for pre-Phase-10 data
		if (chests.length === 0) {
			try {
				const cached = await this.idbStorage.getMetadata('chestOpeningHistory', null);
				if (Array.isArray(cached) && cached.length > 0) {
					chests = cached;
				}
			} catch { /* empty */ }
		}

		// ── Load aggregated drop rates from metadata ────────────────────
		let dropRates = {};
		try {
			dropRates = (await this.idbStorage.getMetadata('chestDropRates', null)) || {};
		} catch { /* empty */ }

		// Defer heavy consumableRewards load until we know it's needed.
		// This avoids fetching up to 50,000 records when pre-aggregated
		// drop rates already exist (#150 performance).
		let allDrops = [];
		let _dropsLoaded = false;
		const _ensureDrops = async () => {
			if (_dropsLoaded) return;
			_dropsLoaded = true;
			try {
				allDrops = await this.idbStorage.getAll('consumableRewards', FETCH_LIMIT_DROPS);
			} catch { /* empty */ }
		};

		if (chests.length === 0 && Object.keys(dropRates).length === 0) {
			return `
				<div class="oj-chests">
					<h3>\uD83C\uDF81 Chests & Drop Rates</h3>
					<p class="oj-empty">No chest data captured yet. Open some chests in the game to start tracking!</p>
				</div>
			`;
		}

		// Sort openings newest first
		chests.sort((a, b) => {
			const ta = typeof a.timestamp === 'number' ? a.timestamp : new Date(a.timestamp || 0).getTime();
			const tb = typeof b.timestamp === 'number' ? b.timestamp : new Date(b.timestamp || 0).getTime();
			return tb - ta;
		});

		// ── Summary stats: count by type ────────────────────────────────
		const byType = {};
		for (const c of chests) {
			const type = c.chestType || c.type || 'Unknown';
			byType[type] = (byType[type] || 0) + 1;
		}

		const sourceLabels = {
			genericChest: 'Chest', artifactChest: 'Artifact', titanArtifactChest: 'Titan Artifact',
			petChest: 'Pet', lootBox: 'Loot Box', towerChest: 'Tower', outlandChest: 'Outland',
		};

		const typePills = Object.entries(byType).map(([type, count]) => {
			const label = sourceLabels[type] || type;
			return `<span class="oj-pill">\uD83C\uDF81 ${this._escapeHtml(label)}: ${count}</span>`;
		}).join(' ');

		// ── Drop Rate Analytics ─────────────────────────────────────────
		let dropRateHtml = '';
		if (Object.keys(dropRates).length > 0) {
			const tables = [];
			for (const [chestKey, info] of Object.entries(dropRates)) {
				if (!info.itemDrops || Object.keys(info.itemDrops).length === 0) continue;

				const label = sourceLabels[info.chestType] || info.chestType || chestKey;
				const opens = info.openCount || 0;

				// Sort items by drop count descending
				const items = Object.values(info.itemDrops)
					.sort((a, b) => (b.dropCount || 0) - (a.dropCount || 0));

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
			if (tables.length > 0) {
				dropRateHtml = `
					<div class="oj-drop-rates">
						<h3>\uD83D\uDCCA Drop Rate Analysis</h3>
						${tables.join('')}
					</div>
				`;
			}
		}

		// Also build a drop-rate section from raw consumableRewards data if available
		if (!dropRateHtml) {
			await _ensureDrops();
		}
		if (allDrops.length > 0 && !dropRateHtml) {
			// Group by sourceType+sourceId → itemType+itemId
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

			// Count openings per source from chests store
			for (const c of chests) {
				const key = `${c.chestType}_${c.sourceId || c.chestId || 'unknown'}`;
				if (grouped[key]) grouped[key].openCount += (c.quantity || 1);
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
			if (tables.length > 0) {
				dropRateHtml = `<div class="oj-drop-rates"><h3>\uD83D\uDCCA Drop Rate Analysis</h3>${tables.join('')}</div>`;
			}
		}

		// ── Filter openings list ────────────────────────────────────────
		let filteredChests = chests;
		if (vs.filter) {
			const q = vs.filter.toLowerCase();
			filteredChests = chests.filter((c) => {
				const type = (c.chestType || c.type || '').toLowerCase();
				return type.includes(q);
			});
		}

		// ── Paginate ────────────────────────────────────────────────────
		const totalCount = filteredChests.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = filteredChests.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		const rows = pageItems.map((c) => {
			const time = c.timestamp
				? new Date(typeof c.timestamp === 'number' ? c.timestamp : c.timestamp).toLocaleString()
				: '\u2014';
			const type = this._escapeHtml(sourceLabels[c.chestType] || c.chestType || c.type || 'Unknown');
			const drops = c.dropCount ?? (Array.isArray(c.rewards) ? c.rewards.length : '\u2014');

			// Render individual reward items if available
			let rewardDetail = '\u2014';
			if (Array.isArray(c.rewards) && c.rewards.length > 0) {
				rewardDetail = c.rewards.map((r) => {
					const itemName = this._escapeHtml(r.name || r.itemName || `${r.type || r.itemType || '?'}:${r.id || r.itemId || '?'}`);
					const qty = r.quantity || r.count || 1;
					return `<span class="oj-reward-item">${itemName} \u00D7${qty}</span>`;
				}).join(', ');
			} else if (c.rewardSummary) {
				rewardDetail = this._escapeHtml(c.rewardSummary);
			}

			return `
				<tr>
					<td class="oj-mono">${time}</td>
					<td>${type}</td>
					<td class="oj-num">${drops}</td>
					<td class="oj-num">${c.quantity || 1}</td>
					<td class="oj-reward-list">${rewardDetail}</td>
				</tr>
			`;
		}).join('');

		return `
			<div class="oj-chests" data-browser="chests">
				<h3>\uD83C\uDF81 Chests & Drop Rates <span class="oj-muted">(${chests.length} openings${_dropsLoaded ? ` \u2022 ${allDrops.length} drops tracked` : ''})</span></h3>
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

		let items = [];
		try {
			// Primary: read raw inventory data from metadata cache (#97)
			// This is the raw API object: { fragmentHero: {id: qty}, consumable: {id: qty}, gear: {id: qty}, ... }
			const rawData = await this.idbStorage.getMetadata('inventoryData', null);
			if (rawData && typeof rawData === 'object') {
				items = this._parseRawInventory(rawData);
			}
		} catch { /* empty */ }

		// Fallback: parse inventoryData JSON from latest IDB snapshot
		if (items.length === 0) {
			try {
				const snapshots = await this.idbStorage.getPage('inventory', { limit: 1, direction: 'prev' });
				if (snapshots.length > 0 && snapshots[0].inventoryData) {
					const rawData = typeof snapshots[0].inventoryData === 'string'
						? JSON.parse(snapshots[0].inventoryData)
						: snapshots[0].inventoryData;
					items = this._parseRawInventory(rawData);
				}
			} catch { /* empty */ }
		}

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

		// Group by category
		const grouped = {};
		for (const it of items) {
			const cat = it.category || it.type || 'Uncategorized';
			if (!grouped[cat]) grouped[cat] = [];
			grouped[cat].push(it);
		}

		// Category display names and icons
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

		// Paginate across all items (flat) but render grouped
		const totalCount = items.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);

		// Build grouped HTML — each category is a collapsible section
		const categoryCount = Object.keys(grouped).length;
		const groupHtml = Object.entries(grouped)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([cat, catItems]) => {
				const label = catLabels[cat] || `\uD83D\uDCE6 ${cat}`;
				const itemRows = catItems.map((it) => {
					const name = this._escapeHtml(it.name || it.itemName || `Item #${it.itemId || it.id}`);
					const qty = it.count ?? it.quantity ?? '\u2014';
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

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		// ── Recent item usage history from inventoryItemUsages store ──
		let usageHtml = '';
		try {
			const usages = await this.idbStorage.getAll('inventoryItemUsages', FETCH_LIMIT_LARGE);
			if (usages.length > 0) {
				// Sort by timestamp descending, show last 50
				usages.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
				const recent = usages.slice(0, 50);
				const usageRows = recent.map((u) => {
					const ts = u.timestamp ? new Date(u.timestamp).toLocaleString() : '\u2014';
					const item = this._escapeHtml(u.itemName || u.itemId || 'Unknown');
					const qty = u.quantityUsed || 1;
					const target = this._escapeHtml(u.targetEntity || '\u2014');
					const ctx = this._escapeHtml(u.usageContext || '\u2014').replace(/_/g, ' ');
					const catBadge = this._escapeHtml(u.category || '');
					return `<tr>
						<td style="white-space:nowrap;font-size:11px">${ts}</td>
						<td>${item}</td>
						<td class="oj-num">${qty}</td>
						<td><span class="oj-badge">${catBadge}</span></td>
						<td>${ctx}</td>
						<td>${target}</td>
					</tr>`;
				}).join('');

				usageHtml = `
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
			}
		} catch { /* empty */ }

		return `
			<div class="oj-inventory" data-browser="inventory">
				<h3>\uD83C\uDF92 Inventory <span class="oj-muted">(${totalCount} items in ${categoryCount} categories)</span></h3>
				${this._renderSearchBar(vs.filter, 'Search items...')}
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
	_parseRawInventory(rawData) {
		const items = [];

		// Category mapping: API key → display category + name resolver
		const categories = {
			fragmentHero: { category: 'hero_soul_stones', prefix: 'Hero' },
			fragmentTitan: { category: 'titan_soul_stones', prefix: 'Titan' },
			fragmentPet: { category: 'pet_soul_stones', prefix: 'Pet' },
			consumable: { category: 'consumable', prefix: 'Consumable' },
			gear: { category: 'equipment', prefix: 'Gear' },
			craftItem: { category: 'fragment', prefix: 'Craft' },
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

				// Try to resolve name via heroNames dictionary for soul stones
				let name;
				if (apiKey === 'fragmentHero' || apiKey === 'fragmentTitan' || apiKey === 'fragmentPet') {
					const resolvedName = this._resolveEntityName(Number(itemId));
					name = resolvedName !== `Hero_${itemId}` ? `${resolvedName} Stones` : `${catInfo.prefix} #${itemId} Stones`;
				} else {
					name = `${catInfo.prefix} #${itemId}`;
				}

				items.push({
					itemId,
					name,
					category: catInfo.category,
					count: Number(qty) || 0,
				});
			}
		}

		// Sort by category then by count descending
		items.sort((a, b) => a.category.localeCompare(b.category) || b.count - a.count);
		return items;
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
		return resolveHeroName(id);
	}

	/**
	 * Resources — display player resources from metadata cache and recent
	 * resource transaction history from the `resourceTransactions` IDB store.
	 * @returns {Promise<string>} HTML content
	 */
	async renderResources() {
		// Get current player data from metadata (set by trackPlayerData)
		let playerData = null;
		try {
			playerData = await this.idbStorage.getMetadata('playerData', null);
		} catch { /* empty */ }

		// Also try the latest snapshot as fallback
		let snap = null;
		if (!playerData) {
			try {
				const snapshots = await this.idbStorage.getPage('snapshots', { limit: 1, direction: 'prev' });
				if (snapshots.length > 0) {
					snap = snapshots[0];
				}
			} catch { /* empty */ }
		}

		// Get recent resource transactions
		let transactions = [];
		try {
			transactions = await this.idbStorage.getAll('resourceTransactions', FETCH_LIMIT_TRANSACTIONS);
			transactions.sort((a, b) => {
				const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
				const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
				return tb - ta;
			});
		} catch { /* empty */ }

		const src = playerData || snap;
		if (!src && transactions.length === 0) {
			return `
				<div class="oj-resources">
					<h3>\uD83D\uDC8E Resources</h3>
					<p class="oj-empty">No resource data captured yet. Play the game \u2014 your first snapshot will be taken automatically.</p>
				</div>
			`;
		}

		// Current resources section
		let cardsHtml = '';
		if (src) {
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
			].filter((r) => r.value !== undefined && r.value !== null);

			const cards = resources.map((r) => `
				<div class="oj-resource-card${r.label === 'Emeralds' ? ' oj-clickable' : ''}"${r.label === 'Emeralds' ? ' data-resource-filter="emeralds"' : ''}>
					<div class="oj-resource-icon">${r.icon}</div>
					<div class="oj-resource-amount">${typeof r.value === 'number' ? r.value.toLocaleString() : r.value}</div>
					<div class="oj-resource-label">${r.label}</div>
				</div>
			`).join('');

			cardsHtml = cards
				? `<h4 class="oj-section-sub">Current Resources <span class="oj-muted">(as of ${ts})</span></h4>
				   <div class="oj-stats-grid">${cards}</div>`
				: '';
		}

		// Recent transactions section
		let txHtml = '';
		if (transactions.length > 0) {
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

			txHtml = `
				<h4 class="oj-section-sub">Recent Transactions <span class="oj-muted">(${transactions.length})</span></h4>
				<table class="oj-table">
					<thead><tr><th>Time</th><th>Resource</th><th>Amount</th><th>Source</th></tr></thead>
					<tbody>${txRows}</tbody>
				</table>
			`;
		}

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
		// ── Mail list from metadata ─────────────────────────────────────
		let mailData = null;
		try {
			mailData = await this.idbStorage.getMetadata('mailData', null);
		} catch { /* empty */ }

		// ── Collected rewards from IDB ──────────────────────────────────
		let rewards = [];
		try {
			rewards = await this.idbStorage.getAll('mailRewards', FETCH_LIMIT_MEDIUM);
		} catch { /* empty */ }

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

			let items = [...mailData.items];

			// Filter
			if (vs.filter) {
				const q = vs.filter.toLowerCase();
				items = items.filter((m) =>
					(m.subject || '').toLowerCase().includes(q) ||
					(m.mailType || '').toLowerCase().includes(q)
				);
			}

			// Sort
			items = this._sortData(items, vs.sortField, vs.sortDir);

			// Paginate
			const totalCount = items.length;
			const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
			vs.page = Math.min(vs.page, totalPages - 1);
			const pageItems = items.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

			const rows = pageItems.map((m) => {
				const statusIcon = m.isCollected ? '\u2705' : m.isRead ? '\uD83D\uDCE8' : '\uD83D\uDCE9';
				const subject = this._escapeHtml(m.subject || '(no subject)');
				const type = this._escapeHtml(m.mailType || 'unknown');
				const date = m.receivedAt ? new Date(m.receivedAt).toLocaleString() : '\u2014';

				// Summarize attached rewards
				let rewardSummary = '\u2014';
				if (m.rewards && typeof m.rewards === 'object') {
					const parts = [];
					for (const [key, val] of Object.entries(m.rewards)) {
						if (typeof val === 'number' && val > 0) {
							parts.push(`${key}: ${val.toLocaleString()}`);
						} else if (typeof val === 'object' && val !== null) {
							const count = Object.values(val).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
							if (count > 0) parts.push(`${key}: ${count.toLocaleString()} items`);
						}
					}
					if (parts.length > 0) rewardSummary = parts.join(', ');
				}

				return `
					<tr>
						<td>${statusIcon}</td>
						<td>${subject}</td>
						<td><span class="oj-badge">${type}</span></td>
						<td class="oj-muted">${date}</td>
						<td class="oj-muted">${rewardSummary}</td>
					</tr>
				`;
			}).join('');

			const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

			mailListHtml = `
				<div class="oj-mail-list" data-browser="mail">
					<h4>\uD83D\uDCE5 Inbox <span class="oj-muted">(${totalCount} messages \u2022 ${mailData.unread || 0} unread \u2022 ${mailData.uncollected || 0} uncollected)</span></h4>
					${this._renderSearchBar(vs.filter)}
					<table class="oj-table oj-sortable">
						<thead>
							<tr>
								<th style="width:30px">&nbsp;</th>
								<th data-sort="subject" class="oj-sort-header">Subject ${sortInd('subject')}</th>
								<th data-sort="mailType" class="oj-sort-header">Type ${sortInd('mailType')}</th>
								<th data-sort="receivedAt" class="oj-sort-header">Received ${sortInd('receivedAt')}</th>
								<th>Rewards</th>
							</tr>
						</thead>
						<tbody>${rows}</tbody>
					</table>
					${this._renderPagination(vs.page, totalPages, totalCount)}
				</div>
			`;
		}

		// ── Collected rewards section ───────────────────────────────────
		let rewardHtml = '';
		if (rewards.length > 0) {
			// Group by rewardType for a summary view
			const byType = {};
			for (const r of rewards) {
				const key = r.rewardType || 'unknown';
				if (!byType[key]) byType[key] = { count: 0, totalQty: 0, items: {} };
				byType[key].count++;
				byType[key].totalQty += r.quantity || 0;
				const itemKey = r.rewardId || 'unknown';
				byType[key].items[itemKey] = (byType[key].items[itemKey] || 0) + (r.quantity || 0);
			}

			const typeRows = Object.entries(byType)
				.sort((a, b) => b[1].totalQty - a[1].totalQty)
				.map(([type, info]) => {
					const topItems = Object.entries(info.items)
						.sort((a, b) => b[1] - a[1])
						.slice(0, 5)
						.map(([id, qty]) => `${this._escapeHtml(resolveHeroName(id) || id)}: ${qty.toLocaleString()}`)
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

			rewardHtml = `
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
	 * Settings — sync render (no async data needed).
	 * @returns {string} HTML content
	 */
	renderSettings() {
		const autoShow = this.prefStorage.get('uiVisible', false);
		const autoHideBattle = this.prefStorage.get('autoHideBattle', true);
		const trackingPrefs = this.gameTracker.getTrackingPrefs();
		const opacity = this.prefStorage.get('overlayOpacity', 95);
		const defaultTab = this.prefStorage.get('defaultTab', 'dashboard');

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
			['apilog', 'API Log'],
		].map(([val, label]) => {
			const sel = val === defaultTab ? 'selected' : '';
			return `<option value="${val}" ${sel}>${label}</option>`;
		}).join('');

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
		// ── Export curated data ──────────────────────────────────────────
		const exportBtn = this.overlay.querySelector('#oj-export-data');
		if (exportBtn) {
			exportBtn.addEventListener('click', async () => {
				try {
					const data = await this.gameTracker.exportAllData();
					this._downloadJson(data, 'organized-jihad-export');
				} catch (err) {
					console.error('[OrganizedJihad] Export failed:', err);
					alert('Export failed \u2014 check console for details.');
				}
			});
		}

		// ── Export raw IDB dump ──────────────────────────────────────────
		const exportRawBtn = this.overlay.querySelector('#oj-export-raw');
		if (exportRawBtn) {
			exportRawBtn.addEventListener('click', async () => {
				try {
					exportRawBtn.textContent = '\u23F3 Exporting...';
					exportRawBtn.disabled = true;
					const data = await this.gameTracker.exportRawData();
					this._downloadJson(data, 'organized-jihad-raw-export');
				} catch (err) {
					console.error('[OrganizedJihad] Raw export failed:', err);
					alert('Raw export failed \u2014 check console.');
				} finally {
					exportRawBtn.textContent = '\uD83D\uDCBE Export Raw';
					exportRawBtn.disabled = false;
				}
			});
		}

		// ── Export API Samples (for AI/developer debugging) ────────────
		const exportSamplesBtn = this.overlay.querySelector('#oj-export-api-samples');
		if (exportSamplesBtn) {
			exportSamplesBtn.addEventListener('click', () => {
				try {
					const count = this.gameTracker?.getApiSampleCount?.() || 0;
					if (count === 0) {
						alert('No API samples captured yet. Play the game for a while \u2014 visit different screens (arena, heroes, inventory, guild war) to populate samples.');
						return;
					}
					const data = this.gameTracker.exportApiSamples();
					this._downloadJson(data, 'hw-api-samples');
					// Update the stats display
					const statsEl = this.overlay.querySelector('#oj-api-sample-stats');
					if (statsEl) {
						statsEl.textContent = `Methods captured: ${count} \u2014 exported!`;
					}
				} catch (err) {
					console.error('[OrganizedJihad] API samples export failed:', err);
					alert('Export failed \u2014 check console.');
				}
			});
		}

		// ── Clear/reset API Samples ────────────────────────────────────
		const clearSamplesBtn = this.overlay.querySelector('#oj-clear-api-samples');
		if (clearSamplesBtn) {
			clearSamplesBtn.addEventListener('click', () => {
				if (confirm('Clear all captured API samples? They will be re-captured as you play.')) {
					this.gameTracker?.clearApiSamples?.();
					const statsEl = this.overlay.querySelector('#oj-api-sample-stats');
					if (statsEl) {
						statsEl.textContent = 'Methods captured: 0 \u2014 cleared! Play the game to re-capture.';
					}
				}
			});
		}

		// ── Import data ─────────────────────────────────────────────────
		const importBtn = this.overlay.querySelector('#oj-import-data');
		const importFile = this.overlay.querySelector('#oj-import-file');
		if (importBtn && importFile) {
			importBtn.addEventListener('click', () => importFile.click());
			importFile.addEventListener('change', async (e) => {
				const file = e.target.files?.[0];
				if (!file) return;

				if (!confirm(`Import data from "${file.name}"?\n\nExisting records with the same keys will be skipped (not overwritten).`)) {
					importFile.value = '';
					return;
				}

				try {
					importBtn.textContent = '\u23F3 Importing...';
					importBtn.disabled = true;
					const text = await file.text();
					const data = JSON.parse(text);
					const summary = await this.gameTracker.importRawData(data);

					const imported = Object.values(summary.imported).reduce((a, b) => a + b, 0);
					const skipped = Object.values(summary.skipped).reduce((a, b) => a + b, 0);
					const errors = summary.errors.length;
					alert(`Import complete!\n\n\u2705 ${imported} records imported\n\u23E9 ${skipped} duplicates skipped\n${errors > 0 ? `\u274C ${errors} errors` : ''}`);

					// Refresh storage stats
					this._loadStorageStats();
				} catch (err) {
					console.error('[OrganizedJihad] Import failed:', err);
					alert('Import failed \u2014 check console. File may be invalid JSON.');
				} finally {
					importBtn.textContent = '\uD83D\uDCE4 Import';
					importBtn.disabled = false;
					importFile.value = '';
				}
			});
		}

		// ── Clear all data ──────────────────────────────────────────────
		const clearBtn = this.overlay.querySelector('#oj-clear-data');
		if (clearBtn) {
			clearBtn.addEventListener('click', async () => {
				if (confirm('\u26A0\uFE0F This will delete ALL tracked data (heroes, battles, snapshots, etc.).\n\nAre you sure?')) {
					try {
						// Clear preferences
						this.prefStorage.clearAll();
						// Delete IndexedDB
						const dbName = 'OrganizedJihad';
						const deleteReq = indexedDB.deleteDatabase(dbName);
						deleteReq.onsuccess = () => {
							alert('All data cleared. The page will reload.');
							location.reload();
						};
						deleteReq.onerror = () => {
							alert('Failed to clear IndexedDB. Try clearing manually in DevTools.');
						};
					} catch (err) {
						console.error('[OrganizedJihad] Clear failed:', err);
						alert('Clear failed \u2014 check console.');
					}
				}
			});
		}

		// ── Auto-show checkbox ──────────────────────────────────────────
		const autoShowCb = this.overlay.querySelector('#oj-auto-show');
		if (autoShowCb) {
			autoShowCb.addEventListener('change', (e) => {
				this.prefStorage.set('uiVisible', e.target.checked);
			});
		}

		// ── Auto-hide during battles checkbox (#50) ─────────────────────
		const autoHideCb = this.overlay.querySelector('#oj-auto-hide-battle');
		if (autoHideCb) {
			autoHideCb.addEventListener('change', (e) => {
				this.prefStorage.set('autoHideBattle', e.target.checked);
			});
		}

		// ── Opacity slider ──────────────────────────────────────────────
		const opacitySlider = this.overlay.querySelector('#oj-opacity');
		const opacityVal = this.overlay.querySelector('#oj-opacity-val');
		if (opacitySlider) {
			opacitySlider.addEventListener('input', (e) => {
				const val = parseInt(e.target.value, 10);
				if (opacityVal) opacityVal.textContent = `${val}%`;
				if (this.overlay) {
					this.overlay.style.opacity = val / 100;
				}
			});
			opacitySlider.addEventListener('change', (e) => {
				this.prefStorage.set('overlayOpacity', parseInt(e.target.value, 10));
			});
		}

		// ── Default tab selector ────────────────────────────────────────
		const defaultTabSel = this.overlay.querySelector('#oj-default-tab');
		if (defaultTabSel) {
			defaultTabSel.addEventListener('change', (e) => {
				this.prefStorage.set('defaultTab', e.target.value);
			});
		}

		// ── Tracking category toggles ───────────────────────────────────
		const catCheckboxes = this.overlay.querySelectorAll('[data-track-cat]');
		for (const cb of catCheckboxes) {
			cb.addEventListener('change', (e) => {
				const cat = e.target.dataset.trackCat;
				this.gameTracker.setTrackingCategory(cat, e.target.checked);
			});
		}

		// ── Notification settings (#52) ─────────────────────────────────
		if (this.notificationManager) {
			const nm = this.notificationManager;

			// Master toggle
			const masterCb = this.overlay.querySelector('#oj-notify-master');
			if (masterCb) {
				masterCb.addEventListener('change', (e) => {
					nm.enabled = e.target.checked;
					// Enable/disable child controls
					const typeCbs = this.overlay.querySelectorAll('[data-notify-type]');
					for (const cb of typeCbs) cb.disabled = !e.target.checked;
					const quietStart = this.overlay.querySelector('#oj-quiet-start');
					const quietEnd = this.overlay.querySelector('#oj-quiet-end');
					if (quietStart) quietStart.disabled = !e.target.checked;
					if (quietEnd) quietEnd.disabled = !e.target.checked;
				});
			}

			// Request permission link
			const requestLink = this.overlay.querySelector('#oj-notify-request');
			if (requestLink) {
				requestLink.addEventListener('click', async (e) => {
					e.preventDefault();
					const result = await nm.requestPermission();
					requestLink.textContent = result === 'granted' ? '\u2705 Granted' : `\u274C ${result}`;
				});
			}

			// Per-type toggles
			const typeCbs = this.overlay.querySelectorAll('[data-notify-type]');
			for (const cb of typeCbs) {
				cb.addEventListener('change', (e) => {
					nm.setTypeEnabled(e.target.dataset.notifyType, e.target.checked);
				});
			}

			// Quiet hours inputs
			const quietStart = this.overlay.querySelector('#oj-quiet-start');
			const quietEnd = this.overlay.querySelector('#oj-quiet-end');
			if (quietStart && quietEnd) {
				const saveQuiet = () => nm.setQuietHours(quietStart.value, quietEnd.value);
				quietStart.addEventListener('change', saveQuiet);
				quietEnd.addEventListener('change', saveQuiet);
			}
		}

		// ── Load storage stats asynchronously ───────────────────────────
		this._loadStorageStats();

		// ── First-run install health check ──────────────────────────────
		const healthBtn = this.overlay.querySelector('#oj-install-health-check');
		if (healthBtn) {
			healthBtn.addEventListener('click', () => {
				this._runInstallHealthCheck();
			});
		}

		const openApiLogBtn = this.overlay.querySelector('#oj-health-open-apilog');
		if (openApiLogBtn) {
			openApiLogBtn.addEventListener('click', () => {
				this.switchView('apilog');
			});
		}

		const openApiHealthBtn = this.overlay.querySelector('#oj-health-open-api-health');
		if (openApiHealthBtn) {
			openApiHealthBtn.addEventListener('click', () => {
				this._openExternalUrl(SYNC_HEALTH_URL);
			});
		}

		const openApiDocsBtn = this.overlay.querySelector('#oj-health-open-api-docs');
		if (openApiDocsBtn) {
			openApiDocsBtn.addEventListener('click', () => {
				this._openExternalUrl(SYNC_DOCS_URL);
			});
		}
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
			const response = await fetch(SYNC_HEALTH_URL, {
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
		const val = this._escapeHtml(currentFilter || '');
		return `
			<div class="oj-search-bar">
				<input type="text" class="oj-search-input" placeholder="${placeholder}"
				       value="${val}" aria-label="${placeholder}">
			</div>
		`;
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
		if (totalPages <= 1) {
			return `<div class="oj-pagination"><span class="oj-muted">${totalItems} items</span></div>`;
		}
		const prevDisabled = currentPage <= 0 ? 'disabled' : '';
		const nextDisabled = currentPage >= totalPages - 1 ? 'disabled' : '';
		return `
			<div class="oj-pagination">
				<button class="oj-btn oj-btn-sm oj-page-prev" ${prevDisabled}>\u25C0 Prev</button>
				<span class="oj-page-info">Page ${currentPage + 1} of ${totalPages} <span class="oj-muted">(${totalItems} items)</span></span>
				<button class="oj-btn oj-btn-sm oj-page-next" ${nextDisabled}>Next \u25B6</button>
			</div>
		`;
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
		if (activeField !== field) return '';
		return activeDir === 'asc' ? '\u25B2' : '\u25BC';
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
		const mul = dir === 'asc' ? 1 : -1;
		// Map common aliases for hero/titan fields
		const fieldMap = {
			name: (obj) => (obj.heroName || obj.titanName || obj.name || obj.itemName || '').toLowerCase(),
			level: (obj) => obj.level || 0,
			stars: (obj) => obj.stars || 0,
			power: (obj) => obj.power || 0,
			color: (obj) => typeof obj.color === 'number' ? obj.color : parseInt(obj.color, 10) || 0,
			element: (obj) => (obj.element || '').toLowerCase(),
			count: (obj) => obj.count ?? obj.quantity ?? 0,
			category: (obj) => (obj.category || obj.type || '').toLowerCase(),
			timestamp: (obj) => obj.timestamp ? new Date(obj.timestamp).getTime() : 0,
		};
		const getter = fieldMap[field] || ((obj) => obj[field] ?? '');
		return data.sort((a, b) => {
			const va = getter(a);
			const vb = getter(b);
			if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
			return String(va).localeCompare(String(vb)) * mul;
		});
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

		// Sort headers
		content.querySelectorAll('.oj-sort-header[data-sort]').forEach((th) => {
			th.addEventListener('click', () => {
				const field = th.dataset.sort;
				if (vs.sortField === field) {
					vs.sortDir = vs.sortDir === 'asc' ? 'desc' : 'asc';
				} else {
					vs.sortField = field;
					vs.sortDir = 'desc';
				}
				vs.page = 0;
				this.renderView(viewName);
			});
		});

		// Search input (debounced)
		const searchInput = content.querySelector('.oj-search-input');
		if (searchInput) {
			let debounceTimer = null;
			searchInput.addEventListener('input', (e) => {
				clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => {
					vs.filter = e.target.value.trim();
					vs.page = 0;
					this.renderView(viewName);
				}, 250);
			});
			// Restore focus & cursor position after re-render
			searchInput.focus();
			searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
		}

		// Pagination buttons
		const prevBtn = content.querySelector('.oj-page-prev');
		if (prevBtn) {
			prevBtn.addEventListener('click', () => {
				if (vs.page > 0) {
					vs.page--;
					this.renderView(viewName);
				}
			});
		}
		const nextBtn = content.querySelector('.oj-page-next');
		if (nextBtn) {
			nextBtn.addEventListener('click', () => {
				vs.page++;
				this.renderView(viewName);
			});
		}

		// Sub-tab pills (battles view)
		content.querySelectorAll('.oj-pill-btn[data-subtab]').forEach((pill) => {
			pill.addEventListener('click', () => {
				vs.subTab = pill.dataset.subtab;
				vs.page = 0;
				this.renderView(viewName);
			});
		});

		// Hero row expand/collapse (heroes view only)
		content.querySelectorAll('.oj-hero-row[data-hero-id]').forEach((row) => {
			row.addEventListener('click', () => {
				const hId = row.dataset.heroId;
				const detailRow = content.querySelector(`tr.oj-hero-detail[data-detail-for="${hId}"]`);
				if (detailRow) {
					const isHidden = detailRow.style.display === 'none';
					detailRow.style.display = isHidden ? '' : 'none';
					row.classList.toggle('oj-expanded', isHidden);
				}
			});
		});

		// Persist projection section collapse state (heroes view only)
		content.querySelectorAll('details[data-projection-section]').forEach((detailsEl) => {
			detailsEl.addEventListener('toggle', () => {
				const section = detailsEl.dataset.projectionSection;
				const isOpen = detailsEl.open;
				this._saveProjectionSectionOpenPreference(section, isOpen);
			});
		});

		// Projection section global controls (heroes view only)
		content.querySelectorAll('[data-projection-control]').forEach((btn) => {
			btn.addEventListener('click', () => {
				const control = btn.dataset.projectionControl;
				const shouldOpen = control === 'expandAll';
				content.querySelectorAll('details[data-projection-section]').forEach((detailsEl) => {
					detailsEl.open = shouldOpen;
					this._saveProjectionSectionOpenPreference(detailsEl.dataset.projectionSection, shouldOpen);
				});
			});
		});

		// Top projected items paging controls (heroes view only)
		content.querySelectorAll('[data-projection-top-nav]').forEach((btn) => {
			btn.addEventListener('click', () => {
				if (!this._viewState.heroes) return;
				const current = Number(this._viewState.heroes.projectionTopItemsPage || 0);
				const direction = btn.dataset.projectionTopNav === 'next' ? 1 : -1;
				this._viewState.heroes.projectionTopItemsPage = Math.max(0, current + direction);
				this.renderView('heroes');
			});
		});

		// Titan row expand/collapse (titans view only)
		content.querySelectorAll('.oj-titan-row[data-titan-id]').forEach((row) => {
			row.addEventListener('click', () => {
				const tId = row.dataset.titanId;
				const detailRow = content.querySelector(`tr.oj-titan-detail[data-detail-for="${tId}"]`);
				if (detailRow) {
					const isHidden = detailRow.style.display === 'none';
					detailRow.style.display = isHidden ? '' : 'none';
					row.classList.toggle('oj-expanded', isHidden);
				}
			});
		});

		// Pet row expand/collapse (pets view only)
		content.querySelectorAll('.oj-pet-row[data-pet-id]').forEach((row) => {
			row.addEventListener('click', () => {
				const pId = row.dataset.petId;
				const detailRow = content.querySelector(`tr.oj-pet-detail[data-detail-for="${pId}"]`);
				if (detailRow) {
					const isHidden = detailRow.style.display === 'none';
					detailRow.style.display = isHidden ? '' : 'none';
					row.classList.toggle('oj-expanded', isHidden);
				}
			});
		});

		// Battle row expand/collapse (#111 — show team compositions with avatars)
		content.querySelectorAll('.oj-battle-row[data-battle-id]').forEach((row) => {
			row.addEventListener('click', () => {
				const bId = row.dataset.battleId;
				const detailRow = content.querySelector(`tr.oj-battle-detail[data-detail-for="${bId}"]`);
				if (detailRow) {
					const isHidden = detailRow.style.display === 'none';
					detailRow.style.display = isHidden ? '' : 'none';
					row.classList.toggle('oj-expanded', isHidden);
				}
			});
		});

		// Emerald click — navigate to resources tab and filter to emerald transactions
		content.querySelectorAll('[data-resource-filter="emeralds"]').forEach((el) => {
			el.addEventListener('click', () => {
				this.renderView('resources');
			});
		});

		// Inventory group header expand/collapse
		content.querySelectorAll('.oj-inv-group-header').forEach((header) => {
			header.addEventListener('click', () => {
				const table = header.nextElementSibling;
				if (table && table.classList.contains('oj-inv-group-table')) {
					table.classList.toggle('oj-collapsed');
					header.classList.toggle('oj-inv-collapsed');
				}
			});
		});

		// API Log payload expand/collapse (#91)
		content.querySelectorAll('.oj-payload-toggle').forEach((btn) => {
			btn.addEventListener('click', () => {
				const idx = btn.getAttribute('data-log-idx');
				const payloadDiv = content.querySelector(`.oj-log-payload[data-log-idx="${idx}"]`);
				if (payloadDiv) {
					const isHidden = payloadDiv.style.display === 'none';
					payloadDiv.style.display = isHidden ? '' : 'none';
					btn.textContent = isHidden ? '\uD83D\uDD0D Hide Payload' : '\uD83D\uDD0D Payload';
				}
			});
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
		if (!timestamp) return '';
		const diff = Date.now() - timestamp;
		if (diff < 0) return 'just now';
		const secs = Math.floor(diff / 1000);
		if (secs < 60) return 'just now';
		const mins = Math.floor(secs / 60);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		if (days < 7) return `${days}d ago`;
		return `${Math.floor(days / 7)}w ago`;
	}

	/**
	 * Render a tiny staleness indicator for dashboard cards (#123).
	 * Shows the relative time in a muted style. Warns if data is stale (>24h).
	 *
	 * @param {number|null} lastUpdate - Timestamp from metadata `lastUpdate`
	 * @returns {string} HTML string for the staleness indicator
	 */
	_stalenessTag(lastUpdate) {
		if (!lastUpdate) return '';
		const ago = this._timeAgo(lastUpdate);
		if (!ago) return '';
		const isStale = (Date.now() - lastUpdate) > 24 * 60 * 60 * 1000;
		const color = isStale ? '#ef9a9a' : '#666';
		return `<div style="font-size:8px;color:${color};margin-top:1px">${ago}</div>`;
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
		if (!heroesJson) return '';
		let heroes;
		try {
			heroes = JSON.parse(heroesJson);
		} catch {
			return '';
		}
		if (!Array.isArray(heroes) || heroes.length === 0) return '';

		// Grand Arena has nested arrays (array of teams); flatten for display
		const isNested = Array.isArray(heroes[0]) && Array.isArray(heroes[0][0]);
		const teams = isNested ? heroes : [heroes];

		const teamHtmls = teams.map((team, teamIdx) => {
			if (!Array.isArray(team)) return '';
			const avatars = team.map((h) => {
				const id = h[0] || 0;
				const level = h[1] || 0;
				const star = h[2] || 0;
				const color = h[3] || 0;
				const power = h[4] || 0;
				const damage = h[5] || 0;
				const healing = h[6] || 0;
				const petId = h[7] || 0;

				// Avatar URL — map enemy variant IDs (>=7000) back to base
				const avatarId = id >= 7000 ? id - 7000 : id;
				const avatarUrl = `https://calc2.hw-assist.com/static/assets/images/hero_icons/${String(avatarId).padStart(4, '0')}.png`;
				const name = resolveHeroName(id) || `#${id}`;
				const colorClass = this._colorRankClass(color);

				// Stats tooltip
				const statsTitle = `${name} Lv${level} ${'★'.repeat(Math.min(star, 6))} ${this._colorRankName(color)} | Power: ${power.toLocaleString()}` +
					(damage ? ` | DMG: ${damage.toLocaleString()}` : '') +
					(healing ? ` | Heal: ${healing.toLocaleString()}` : '');

				let petHtml = '';
				if (petId > 0) {
					const petAvatarId = petId >= 7000 ? petId - 7000 : petId;
					const petUrl = `https://calc2.hw-assist.com/static/assets/images/hero_icons/${String(petAvatarId).padStart(4, '0')}.png`;
					petHtml = `<img class="oj-battle-pet-icon" src="${petUrl}" alt="Pet" loading="lazy" onerror="this.style.display='none'" title="${resolveHeroName(petId) || 'Pet'}">`;
				}

				return `<div class="oj-battle-hero" title="${this._escapeHtml(statsTitle)}">` +
					`<img class="oj-hero-avatar ${colorClass}" src="${avatarUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'">` +
					petHtml +
					(damage ? `<div class="oj-battle-dmg">${this._formatCompact(damage)}</div>` : '') +
					`</div>`;
			}).join('');

			const teamLabel = teams.length > 1 ? ` ${teamIdx + 1}` : '';
			return `<div class="oj-battle-team-row">${avatars}</div>`;
		}).join('');

		return `<div class="oj-battle-team-block">` +
			`<div class="oj-battle-team-label">${label}</div>` +
			teamHtmls +
			`</div>`;
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
		// Group by node (mission) ID
		/** @type {Map<string, {wins: number, losses: number, lastWinTeam: string|null, lastEnemyTeam: string|null, lastWinTime: string|null}>} */
		const nodeMap = new Map();

		for (const b of adventureBattles) {
			const nodeId = String(b.mission || 'unknown');
			if (!nodeMap.has(nodeId)) {
				nodeMap.set(nodeId, { wins: 0, losses: 0, lastWinTeam: null, lastEnemyTeam: null, lastWinTime: null });
			}
			const node = nodeMap.get(nodeId);
			if (b.isWin === true) {
				node.wins++;
				// Track the most recent winning team
				if (!node.lastWinTime || b.timestamp > node.lastWinTime) {
					node.lastWinTeam = b.playerHeroes;
					node.lastEnemyTeam = b.opponentHeroes;
					node.lastWinTime = b.timestamp;
				}
			} else {
				node.losses++;
			}
		}

		// Sort nodes: most battles first
		const sortedNodes = [...nodeMap.entries()].sort((a, b) => {
			return (b[1].wins + b[1].losses) - (a[1].wins + a[1].losses);
		});

		// Only show top 20 nodes
		const displayNodes = sortedNodes.slice(0, 20);

		if (displayNodes.length === 0) return '';

		const nodeRows = displayNodes.map(([nodeId, stats]) => {
			const total = stats.wins + stats.losses;
			const wr = total > 0 ? ((stats.wins / total) * 100).toFixed(0) : '0';
			const wrClass = parseInt(wr, 10) >= 50 ? 'oj-win' : 'oj-loss';
			const teamHtml = stats.lastWinTeam
				? this._renderBattleTeam(stats.lastWinTeam, '\u2705 Winning Team')
				: '<span class="oj-muted">No wins recorded</span>';
			const enemyHtml = stats.lastEnemyTeam
				? this._renderBattleTeam(stats.lastEnemyTeam, '\uD83D\uDC7E Enemies')
				: '';

			return `
				<div class="oj-adv-node">
					<div class="oj-adv-node-header">
						<span class="oj-mono">Node ${this._escapeHtml(nodeId)}</span>
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

	/**
	 * Format a number in compact notation (e.g. 1.2M, 45K).
	 *
	 * @param {number} n - Number to format
	 * @returns {string} Compact string
	 * @private
	 */
	_formatCompact(n) {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return String(n);
	}

	/**
	 * Map Hero Wars numeric color/rank to a human-readable name.
	 *
	 * @param {number|string} color - Numeric color rank (0-17+)
	 * @returns {string} Rank name
	 */
	_colorRankName(color) {
		/** @type {Record<number, string>} */
		const names = {
			0: 'Gray', 1: 'Green', 2: 'Green+1',
			3: 'Blue', 4: 'Blue+1', 5: 'Blue+2',
			6: 'Violet', 7: 'Violet+1', 8: 'Violet+2', 9: 'Violet+3',
			10: 'Orange', 11: 'Orange+1', 12: 'Orange+2', 13: 'Orange+3', 14: 'Orange+4',
			15: 'Red', 16: 'Red+1', 17: 'Red+2', 18: 'Red+2 (Legacy Max)', 19: 'Red+3',
		};
		const num = typeof color === 'string' ? parseInt(color, 10) : color;
		return names[num] ?? (color != null ? `Rank ${color}` : '\u2014');
	}

	/**
	 * Return a CSS class for a Hero Wars color rank (for styling).
	 *
	 * @param {number|string} color - Numeric color rank
	 * @returns {string} CSS class name
	 */
	_colorRankClass(color) {
		const num = typeof color === 'string' ? parseInt(color, 10) : color;
		if (num == null || isNaN(num)) return 'oj-rank-gray';
		if (num <= 0) return 'oj-rank-gray';
		if (num <= 2) return 'oj-rank-green';
		if (num <= 5) return 'oj-rank-blue';
		if (num <= 9) return 'oj-rank-violet';
		if (num <= 14) return 'oj-rank-orange';
		return 'oj-rank-red';
	}

	/**
	 * Return a CSS class for an activity event row based on event type and data.
	 *
	 * @param {object} evt - Activity event object
	 * @returns {string} CSS class name
	 */
	_activityColorClass(evt) {
		const type = evt.eventType || '';
		if (type === 'error') return 'oj-event-red';
		if (type === 'battle') return evt.isWin ? 'oj-event-green' : 'oj-event-red';
		if (type === 'resource') return 'oj-event-green';
		if (type === 'hero' || type === 'upgrade') return 'oj-event-gold';
		if (type === 'chest') return 'oj-event-purple';
		return 'oj-event-blue'; // info, default
	}

	/**
	 * Return an emoji icon for an activity event type.
	 *
	 * @param {object} evt - Activity event object
	 * @returns {string} Emoji
	 */
	_activityIcon(evt) {
		const icons = {
			battle: '\u2694\uFE0F',
			resource: '\uD83D\uDCB0',
			hero: '\uD83E\uDDB8',
			chest: '\uD83C\uDF81',
			upgrade: '\u2B06\uFE0F',
			error: '\u274C',
			info: '\uD83D\uDCCB',
		};
		return icons[evt.eventType] || '\u2022';
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
