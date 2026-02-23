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
import { TRACKING_CATEGORIES } from './gameTracker.js';
import { decompressHeroStore, decompressTitanStore } from './heroCompression.js';
import { NOTIFICATION_TYPES } from './notificationManager.js';

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
			heroes:    { page: 0, sortField: 'power', sortDir: 'desc', filter: '' },
			titans:    { page: 0, sortField: 'power', sortDir: 'desc', filter: '' },
			battles:   { page: 0, sortField: 'timestamp', sortDir: 'desc', filter: '', subTab: 'all' },
			chests:    { page: 0, sortField: 'timestamp', sortDir: 'desc', filter: '' },
			inventory: { page: 0, sortField: 'name', sortDir: 'asc', filter: '' },
		};
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
		document.addEventListener('keydown', (e) => {
			if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'O')) {
				e.preventDefault();
				this.toggle();
			}
		});

		// Subscribe to live activity events for real-time feed updates.
		// When the Activity tab is visible, re-render it on each new event.
		if (this.gameTracker && typeof this.gameTracker.on === 'function') {
			this.gameTracker.on('activity', () => {
				if (this.isVisible && this.currentView === 'activity') {
					this.renderView('activity');
				}
			});
			// Auto-refresh API Log tab when new calls arrive
			this.gameTracker.on('apiLog', () => {
				if (this.isVisible && this.currentView === 'apilog') {
					this.renderView('apilog');
				}
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
					<button class="oj-nav-btn" data-view="battles">Battles</button>
					<button class="oj-nav-btn" data-view="chests">Chests</button>
					<button class="oj-nav-btn" data-view="inventory">Inventory</button>
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
		document.addEventListener('keydown', (e) => {
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

		document.addEventListener('mousemove', (e) => {
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

		document.addEventListener('mouseup', () => {
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

		document.addEventListener('mousemove', (e) => {
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

		document.addEventListener('mouseup', () => {
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
		const content = this.overlay.querySelector('#oj-content');
		content.innerHTML = '<div class="oj-loading">Loading...</div>';

		try {
			switch (view) {
				case 'dashboard':
					content.innerHTML = await this.renderDashboard();
					break;
				case 'activity':
					content.innerHTML = await this.renderActivity();
					break;
				case 'heroes':
					content.innerHTML = await this.renderHeroes();
					this._attachDataBrowserListeners('heroes');
					break;
				case 'titans':
					content.innerHTML = await this.renderTitans();
					this._attachDataBrowserListeners('titans');
					break;
				case 'battles':
					content.innerHTML = await this.renderBattles();
					this._attachDataBrowserListeners('battles');
					break;
				case 'chests':
					content.innerHTML = await this.renderChests();
					this._attachDataBrowserListeners('chests');
					break;
				case 'inventory':
					content.innerHTML = await this.renderInventory();
					this._attachDataBrowserListeners('inventory');
					break;
				case 'apilog':
					content.innerHTML = this.renderApiLog();
					break;
				case 'resources':
					content.innerHTML = await this.renderResources();
					break;
				case 'settings':
					content.innerHTML = this.renderSettings();
					this.attachSettingsEventListeners();
					break;
				default:
					content.innerHTML = '<p class="oj-empty">Unknown view</p>';
			}
		} catch (err) {
			console.error('[OrganizedJihad] Error rendering view:', view, err);
			content.innerHTML = `
				<div class="oj-error">
					<h3>\u26A0\uFE0F Render Error</h3>
					<p>${err.message || 'Unknown error'}</p>
					<p class="oj-muted">Check the console for details.</p>
				</div>
			`;
		}
	}

	// =====================================================================
	// View Renderers
	// =====================================================================

	/**
	 * Dashboard — player overview, store counts, status, and quick tips.
	 * Pulls live data from IndexedDB metadata + store counts.
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
			const snaps = await this.idbStorage.getAll('snapshots', 1);
			if (snaps.length > 0) {
				// getAll returns oldest-first; grab last
				latestSnapshot = snaps[snaps.length - 1];
			}
		} catch { /* empty */ }

		// Merge snapshot fields into playerData for display
		const player = latestSnapshot || playerData || {};
		const playerName = player.playerName || player.name || null;
		const playerLevel = player.level || 0;
		const playerGuild = player.guildName || player.clanTitle || null;

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

		// Last snapshot time
		const lastSnapshotTime = player.timestamp
			? new Date(player.timestamp).toLocaleString()
			: 'None yet';

		// ── Win Rate Statistics (#26) ─────────────────────────────────
		const winRateSection = await this._renderWinRateCards();

		// ── Daily Summary (#26) ──────────────────────────────────────
		const dailySummary = await this._renderDailySummary();

		// Player info section
		const playerSection = playerName
			? `<div class="oj-section">
					<h3>\uD83D\uDC64 Player</h3>
					<div class="oj-status-list">
						<div class="oj-status-row"><span>Name</span><span><strong>${this._escapeHtml(playerName)}</strong></span></div>
						<div class="oj-status-row"><span>Level</span><span>${playerLevel}</span></div>
						${playerGuild ? `<div class="oj-status-row"><span>Guild</span><span>${this._escapeHtml(playerGuild)}</span></div>` : ''}
						${player.gold ? `<div class="oj-status-row"><span>\uD83E\uDE99 Gold</span><span>${Number(player.gold).toLocaleString()}</span></div>` : ''}
						${player.emeralds || player.starmoney ? `<div class="oj-status-row"><span>\uD83D\uDC8E Emeralds</span><span>${Number(player.emeralds || player.starmoney).toLocaleString()}</span></div>` : ''}
					</div>
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
						${errorCount > 0 ? `<div class="oj-status-row"><span>Errors</span><span class="oj-status-err">${errorCount}</span></div>` : ''}
						<div class="oj-status-row">
							<span>Version</span>
							<span>0.9.2</span>
						</div>
					</div>
				</div>

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
	 * @returns {Promise<string>} HTML section
	 * @private
	 */
	async _renderWinRateCards() {
		let battles = [];
		try {
			battles = await this.idbStorage.getAll('battles');
		} catch { return ''; }

		if (battles.length === 0) return '';

		const now = Date.now();
		const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

		// Group by type and calculate win rates
		const types = [
			{ key: 'arena', label: '\u2694\uFE0F Arena', color: '#4fc3f7' },
			{ key: 'titanArena', label: '\uD83D\uDEE1\uFE0F Titan Arena', color: '#ce93d8' },
			{ key: 'grandArena', label: '\uD83C\uDFC6 Grand Arena', color: '#ffb74d' },
		];

		const cards = types.map(({ key, label, color }) => {
			const all = battles.filter((b) => b.type === key);
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
	 * Render a daily summary showing today's activity (#26).
	 * Counts battles, quests, chests, and resource changes since midnight.
	 *
	 * @returns {Promise<string>} HTML section
	 * @private
	 */
	async _renderDailySummary() {
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayISO = todayStart.toISOString();

		let todayBattles = 0;
		let todayWins = 0;
		let todayChests = 0;
		let todayQuests = 0;
		let todayUpgrades = 0;

		try {
			const battles = await this.idbStorage.getAll('battles');
			const todayB = battles.filter((b) => b.timestamp >= todayISO);
			todayBattles = todayB.length;
			todayWins = todayB.filter((b) => b.isWin).length;
		} catch { /* empty */ }

		try {
			const chests = await this.idbStorage.getAll('chests');
			todayChests = chests.filter((c) => c.openedAt >= todayISO || c.timestamp >= todayISO).length;
		} catch { /* empty */ }

		try {
			const quests = await this.idbStorage.getAll('dailyQuestCompletions');
			const guildQ = await this.idbStorage.getAll('guildQuestCompletions');
			todayQuests = quests.filter((q) => q.completedAt >= todayISO).length
				+ guildQ.filter((q) => q.completedAt >= todayISO).length;
		} catch { /* empty */ }

		try {
			const upgrades = await this.idbStorage.getAll('heroUpgrades');
			const titanUp = await this.idbStorage.getAll('titanUpgrades');
			todayUpgrades = upgrades.filter((u) => u.timestamp >= todayISO).length
				+ titanUp.filter((u) => u.timestamp >= todayISO).length;
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
			events = await this.idbStorage.getAll('activityEvents', 200);
			events.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
		} catch { /* store may not exist yet on older DBs */ }

		// Fallback: show raw API logs if no activity events
		if (events.length === 0) {
			let logs = [];
			try {
				logs = await this.idbStorage.getAll('apiLogs', 50);
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
		const rows = events.slice(0, 100).map((evt) => {
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
				<h3>\uD83D\uDCE1 Live Activity Feed <span class="oj-muted">(${events.length} events)</span></h3>
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
	 *  15=Red, 16=Red+1, 17=Red+2
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
				const raw = await this.idbStorage.getAll('heroes', 5000);
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
					<td><strong>${name}</strong></td>
					<td>${h.level || '\u2014'}</td>
					<td>${'\u2B50'.repeat(Math.min(h.stars || 0, 6)) || '\u2014'}</td>
					<td><span class="${colorClass}">${colorName}</span></td>
					<td class="oj-num">${h.power ? h.power.toLocaleString() : '\u2014'}</td>
					<td class="oj-completion-cell">${Calc.renderBar(comp.overall)}</td>
				</tr>
				<tr class="oj-hero-detail" data-detail-for="${hId}" style="display:none">
					<td colspan="6">
						<div class="oj-sys-breakdown">${sysRows}</div>
					</td>
				</tr>
			`;
		}).join('');

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		return `
			<div class="oj-heroes" data-browser="heroes">
				<h3>\uD83E\uDDB8 Heroes <span class="oj-muted">(${totalCount} \u2022 ${totalPower.toLocaleString()} power \u2022 avg ${Calc.formatPercent(avgCompletion)} complete)</span></h3>
				${this._renderSearchBar(vs.filter)}
				<table class="oj-table oj-sortable">
					<thead>
						<tr>
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
	 * Battles — paginated battle history with sub-tab filtering by type.
	 * All battle types (Arena, GrandArena, TitanArena, GuildWar) are stored in
	 * a single `battles` store with a `battleType` field and `isWin` boolean.
	 * @returns {Promise<string>} HTML content
	 */
	async renderBattles() {
		const vs = this._viewState.battles;

		let allBattles = [];
		try {
			allBattles = await this.idbStorage.getAll('battles', 5000);
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
		const types = ['Arena', 'GrandArena', 'TitanArena', 'GuildWar'];
		const typeLabels = { Arena: 'Arena', GrandArena: 'Grand Arena', TitanArena: 'Titan Arena', GuildWar: 'Guild War' };
		const typeIcons = { Arena: '\uD83C\uDFC6', GrandArena: '\uD83C\uDFDF\uFE0F', TitanArena: '\uD83D\uDCA0', GuildWar: '\u2694\uFE0F' };

		/** @type {Record<string, {count: number, wins: number}>} */
		const byType = {};
		for (const b of allBattles) {
			const t = b.battleType || 'Other';
			if (!byType[t]) byType[t] = { count: 0, wins: 0 };
			byType[t].count++;
			if (b.isWin === true) byType[t].wins++;
		}

		// Sub-tab pills (All + each type with counts)
		const subTabs = ['all', ...types.filter((t) => byType[t])];
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
			return `
				<tr>
					<td class="oj-mono">${time}</td>
					<td>${type}</td>
					<td>${this._escapeHtml(String(opponent))}</td>
					<td>${result}</td>
				</tr>
			`;
		}).join('');

		return `
			<div class="oj-battles" data-browser="battles">
				<h3>\u2694\uFE0F Battles <span class="oj-muted">(${allBattles.length} total)</span></h3>
				<div class="oj-stats-grid oj-stats-sm">
					${this._statCard(fWins, 'Wins', '#4CAF50')}
					${this._statCard(fLosses, 'Losses', '#f44336')}
					${this._statCard(fWinRate + '%', 'Win Rate', '#2196F3')}
				</div>
				<div class="oj-sub-tabs">${pills}</div>
				${this._renderSearchBar(vs.filter, 'Search opponent...')}
				<table class="oj-table">
					<thead>
						<tr><th>Time</th><th>Type</th><th>Opponent</th><th>Result</th></tr>
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
				const raw = await this.idbStorage.getAll('titans', 5000);
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

		// Sort
		titans = this._sortData(titans, vs.sortField, vs.sortDir);

		const totalPower = titans.reduce((s, t) => s + (t.power || 0), 0);

		// Paginate
		const totalCount = titans.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = titans.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		const rows = pageItems.map((t) => {
			const name = this._escapeHtml(t.titanName || t.name || `Titan #${t.titanId || t.id}`);
			const element = this._escapeHtml(t.element || '\u2014');
			return `
				<tr>
					<td><strong>${name}</strong></td>
					<td>${t.level || '\u2014'}</td>
					<td>${'\u2B50'.repeat(Math.min(t.stars || 0, 6)) || '\u2014'}</td>
					<td>${element}</td>
					<td class="oj-num">${t.power ? t.power.toLocaleString() : '\u2014'}</td>
				</tr>
			`;
		}).join('');

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		return `
			<div class="oj-titans" data-browser="titans">
				<h3>\uD83D\uDCA0 Titans <span class="oj-muted">(${totalCount} \u2022 ${totalPower.toLocaleString()} total power)</span></h3>
				${this._renderSearchBar(vs.filter)}
				<table class="oj-table oj-sortable">
					<thead>
						<tr>
							<th data-sort="name" class="oj-sort-header">Name ${sortInd('name')}</th>
							<th data-sort="level" class="oj-sort-header">Lvl ${sortInd('level')}</th>
							<th data-sort="stars" class="oj-sort-header">Stars ${sortInd('stars')}</th>
							<th data-sort="element" class="oj-sort-header">Element ${sortInd('element')}</th>
							<th data-sort="power" class="oj-sort-header">Power ${sortInd('power')}</th>
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
			chests = await this.idbStorage.getAll('chests', 5000);
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

		// ── Load consumableRewards for drop-rate analysis ───────────────
		let allDrops = [];
		try {
			allDrops = await this.idbStorage.getAll('consumableRewards', 50000);
		} catch { /* empty */ }

		// ── Load aggregated drop rates from metadata ────────────────────
		let dropRates = {};
		try {
			dropRates = (await this.idbStorage.getMetadata('chestDropRates', null)) || {};
		} catch { /* empty */ }

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
			return `
				<tr>
					<td class="oj-mono">${time}</td>
					<td>${type}</td>
					<td class="oj-num">${drops}</td>
					<td class="oj-num">${c.quantity || 1}</td>
				</tr>
			`;
		}).join('');

		return `
			<div class="oj-chests" data-browser="chests">
				<h3>\uD83C\uDF81 Chests & Drop Rates <span class="oj-muted">(${chests.length} openings \u2022 ${allDrops.length} drops tracked)</span></h3>
				<div class="oj-pills">${typePills}</div>
				${dropRateHtml}
				<h4 class="oj-section-sub">Opening History</h4>
				${this._renderSearchBar(vs.filter, 'Filter by chest type...')}
				<table class="oj-table">
					<thead>
						<tr><th>Time</th><th>Type</th><th>Drops</th><th>Qty</th></tr>
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
			const cached = await this.idbStorage.getMetadata('inventoryData', null);
			if (cached) {
				// inventoryData might be a keyed object or an array
				if (Array.isArray(cached)) {
					items = cached;
				} else if (typeof cached === 'object') {
					// Convert { id: {...}, ... } to array
					items = Object.values(cached).map((v) =>
						typeof v === 'object' && v !== null ? v : { id: v }
					);
				}
			}
		} catch { /* empty */ }

		// Fallback: read from inventory IDB store
		if (items.length === 0) {
			try {
				const all = await this.idbStorage.getAll('inventory', 5000);
				if (all.length > 0) {
					// Keep only the latest record per item
					const byId = {};
					for (const it of all) {
						const key = it.itemId || it.id;
						if (!byId[key] || (it.timestamp || '') > (byId[key].timestamp || '')) {
							byId[key] = it;
						}
					}
					items = Object.values(byId);
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

		// Paginate
		const totalCount = items.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / this.PAGE_SIZE));
		vs.page = Math.min(vs.page, totalPages - 1);
		const pageItems = items.slice(vs.page * this.PAGE_SIZE, (vs.page + 1) * this.PAGE_SIZE);

		const rows = pageItems.map((it) => {
			const name = this._escapeHtml(it.name || it.itemName || `Item #${it.itemId || it.id}`);
			const qty = it.count ?? it.quantity ?? '\u2014';
			const category = this._escapeHtml(it.category || it.type || '\u2014');
			return `
				<tr>
					<td><strong>${name}</strong></td>
					<td>${category}</td>
					<td class="oj-num">${typeof qty === 'number' ? qty.toLocaleString() : qty}</td>
				</tr>
			`;
		}).join('');

		const sortInd = (field) => this._sortIndicator(vs.sortField, vs.sortDir, field);

		return `
			<div class="oj-inventory" data-browser="inventory">
				<h3>\uD83C\uDF92 Inventory <span class="oj-muted">(${totalCount} items)</span></h3>
				${this._renderSearchBar(vs.filter, 'Search items...')}
				<table class="oj-table oj-sortable">
					<thead>
						<tr>
							<th data-sort="name" class="oj-sort-header">Name ${sortInd('name')}</th>
							<th data-sort="category" class="oj-sort-header">Category ${sortInd('category')}</th>
							<th data-sort="count" class="oj-sort-header">Qty ${sortInd('count')}</th>
						</tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
				${this._renderPagination(vs.page, totalPages, totalCount)}
			</div>
		`;
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
				const snapshots = await this.idbStorage.getAll('snapshots', 10);
				if (snapshots.length > 0) {
					snap = snapshots[snapshots.length - 1];
				}
			} catch { /* empty */ }
		}

		// Get recent resource transactions
		let transactions = [];
		try {
			transactions = await this.idbStorage.getAll('resourceTransactions', 100);
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
				<div class="oj-resource-card">
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
			['battles', 'Battles'],
			['chests', 'Chests'],
			['inventory', 'Inventory'],
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
					<h4>Storage Usage</h4>
					<div id="oj-storage-stats" style="font-size:11px;color:#aaa">Loading...</div>
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
					<p>OrganizedJihad \u2014 Hero Wars Tracker v0.9.2</p>
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
	async _countStore(storeName) {
		try {
			const all = await this.idbStorage.getAll(storeName);
			return Array.isArray(all) ? all.length : 0;
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
	 * @param {string} str - Raw string
	 * @returns {string} HTML-safe string
	 */
	_escapeHtml(str) {
		const div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
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
			15: 'Red', 16: 'Red+1', 17: 'Red+2',
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
}

export default UIManager;
