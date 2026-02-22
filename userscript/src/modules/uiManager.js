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
		this.currentView = 'dashboard';
		this.overlay = null;

		// Saved position/size from last session (null = use CSS default)
		this._savedPos = this.prefStorage.get('overlayPosition', null);
		this._savedSize = this.prefStorage.get('overlaySize', null);
		this._isMinimized = this.prefStorage.get('overlayMinimized', false);
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

		// Keyboard shortcut: Ctrl+Shift+H
		document.addEventListener('keydown', (e) => {
			if (e.ctrlKey && e.shiftKey && e.key === 'H') {
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
					<button class="oj-nav-btn" data-view="battles">Battles</button>
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

		// Restore saved position if any
		if (this._savedPos) {
			this.overlay.style.left = this._savedPos.x + 'px';
			this.overlay.style.top = this._savedPos.y + 'px';
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

			this.overlay.style.left = (startLeft + dx) + 'px';
			this.overlay.style.top = (startTop + dy) + 'px';
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
	 * Enforces minimum size of 400×300 and persists size in localStorage.
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

			const newW = Math.max(MIN_WIDTH, startW + (e.clientX - startX));
			const newH = Math.max(MIN_HEIGHT, startH + (e.clientY - startY));

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
					break;
				case 'battles':
					content.innerHTML = await this.renderBattles();
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
							<span>3.1.0</span>
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
	 * Heroes — display current hero roster from metadata cache.
	 * Falls back to the `heroes` IDB store if metadata is empty.
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
		// Prefer the metadata cache (latest roster, one row per hero)
		let heroes = [];
		try {
			const cached = await this.idbStorage.getMetadata('heroesData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				heroes = cached;
			}
		} catch { /* empty */ }

		// Fallback: read from the heroes IDB store and deduplicate by heroId
		if (heroes.length === 0) {
			try {
				const all = await this.idbStorage.getAll('heroes', 5000);
				if (all.length > 0) {
					// Keep only the latest record per heroId
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

		// Sort by power descending
		heroes.sort((a, b) => (b.power || 0) - (a.power || 0));

		// Total team power
		const totalPower = heroes.reduce((s, h) => s + (h.power || 0), 0);

		const rows = heroes.map((h) => {
			const name = this._escapeHtml(h.heroName || h.name || `Hero #${h.heroId || h.id}`);
			const colorName = this._colorRankName(h.color);
			const colorClass = this._colorRankClass(h.color);
			return `
				<tr>
					<td><strong>${name}</strong></td>
					<td>${h.level || '\u2014'}</td>
					<td>${'\u2B50'.repeat(Math.min(h.stars || 0, 6)) || '\u2014'}</td>
					<td><span class="${colorClass}">${colorName}</span></td>
					<td class="oj-num">${h.power ? h.power.toLocaleString() : '\u2014'}</td>
				</tr>
			`;
		}).join('');

		return `
			<div class="oj-heroes">
				<h3>\uD83E\uDDB8 Heroes <span class="oj-muted">(${heroes.length} \u2022 ${totalPower.toLocaleString()} total power)</span></h3>
				<table class="oj-table">
					<thead>
						<tr><th>Name</th><th>Lvl</th><th>Stars</th><th>Rank</th><th>Power</th></tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
		`;
	}

	/**
	 * Battles — display battle history from the unified `battles` IDB store.
	 * All battle types (Arena, GrandArena, TitanArena, GuildWar) are stored in
	 * a single store with a `battleType` field and `isWin` boolean.
	 * @returns {Promise<string>} HTML content
	 */
	async renderBattles() {
		let allBattles = [];
		try {
			allBattles = await this.idbStorage.getAll('battles', 200);
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
		const wins = allBattles.filter((b) => b.isWin === true).length;
		const losses = allBattles.length - wins;
		const winRate = ((wins / allBattles.length) * 100).toFixed(1);

		// Per-type breakdown
		const types = ['Arena', 'GrandArena', 'TitanArena', 'GuildWar'];
		const typeLabels = { Arena: 'Arena', GrandArena: 'Grand Arena', TitanArena: 'Titan Arena', GuildWar: 'Guild War' };
		const typeIcons = { Arena: '\uD83C\uDFC6', GrandArena: '\uD83C\uDFDF\uFE0F', TitanArena: '\uD83D\uDCA0', GuildWar: '\u2694\uFE0F' };
		const byType = {};
		for (const t of types) {
			const group = allBattles.filter((b) => b.battleType === t);
			if (group.length > 0) {
				const w = group.filter((b) => b.isWin === true).length;
				byType[t] = { battles: group, wins: w, losses: group.length - w };
			}
		}
		// Catch any unlabelled battles
		const knownTypes = new Set(types);
		const otherBattles = allBattles.filter((b) => !knownTypes.has(b.battleType));
		if (otherBattles.length > 0) {
			const w = otherBattles.filter((b) => b.isWin === true).length;
			byType['Other'] = { battles: otherBattles, wins: w, losses: otherBattles.length - w };
		}

		// Type summary pills
		const pills = Object.entries(byType).map(([t, d]) => {
			const label = typeLabels[t] || t;
			const icon = typeIcons[t] || '\u2753';
			const wr = ((d.wins / d.battles.length) * 100).toFixed(0);
			return `<span class="oj-pill" title="${label}: ${d.wins}W / ${d.losses}L">${icon} ${label} ${d.battles.length} (${wr}%)</span>`;
		}).join(' ');

		// Recent battles table (last 40)
		const rows = allBattles.slice(0, 40).map((b) => {
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
			<div class="oj-battles">
				<h3>\u2694\uFE0F Battles <span class="oj-muted">(${allBattles.length} total)</span></h3>
				<div class="oj-stats-grid oj-stats-sm">
					${this._statCard(wins, 'Wins', '#4CAF50')}
					${this._statCard(losses, 'Losses', '#f44336')}
					${this._statCard(winRate + '%', 'Win Rate', '#2196F3')}
				</div>
				<div class="oj-pills">${pills}</div>
				<table class="oj-table">
					<thead>
						<tr><th>Time</th><th>Type</th><th>Opponent</th><th>Result</th></tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
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

	/**
	 * Settings — sync render (no async data needed).
	 * @returns {string} HTML content
	 */
	renderSettings() {
		const autoShow = this.prefStorage.get('uiVisible', false);

		return `
			<div class="oj-settings">
				<h3>\u2699\uFE0F Settings</h3>

				<div class="oj-settings-group">
					<h4>Display</h4>
					<label class="oj-checkbox-label">
						<input type="checkbox" id="oj-auto-show" ${autoShow ? 'checked' : ''}>
						Show overlay automatically on page load
					</label>
				</div>

				<div class="oj-settings-group">
					<h4>Data Management</h4>
					<div class="oj-btn-row">
						<button class="oj-btn" id="oj-export-data">\uD83D\uDCE5 Export All Data</button>
						<button class="oj-btn oj-btn-danger" id="oj-clear-data">\uD83D\uDDD1\uFE0F Clear All Data</button>
					</div>
				</div>

				<div class="oj-settings-group">
					<h4>Keyboard Shortcuts</h4>
					<div class="oj-shortcut-list">
						<div class="oj-shortcut-row">
							<kbd>Ctrl+Shift+H</kbd>
							<span>Toggle overlay visibility</span>
						</div>
					</div>
				</div>

				<div class="oj-settings-group">
					<h4>About</h4>
					<p>OrganizedJihad \u2014 Hero Wars Tracker v3.1.0</p>
					<p class="oj-muted">Tracks gameplay data locally via IndexedDB. Optional C# API sync.</p>
				</div>
			</div>
		`;
	}

	/**
	 * Attach event listeners for the Settings view.
	 */
	attachSettingsEventListeners() {
		// Export data
		const exportBtn = this.overlay.querySelector('#oj-export-data');
		if (exportBtn) {
			exportBtn.addEventListener('click', async () => {
				try {
					const data = await this.gameTracker.exportAllData();
					const blob = new Blob([JSON.stringify(data, null, '\t')], { type: 'application/json' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = 'organized-jihad-export-' + new Date().toISOString().slice(0, 10) + '.json';
					a.click();
					URL.revokeObjectURL(url);
				} catch (err) {
					console.error('[OrganizedJihad] Export failed:', err);
					alert('Export failed \u2014 check console for details.');
				}
			});
		}

		// Clear all data
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

		// Auto-show checkbox
		const autoShowCb = this.overlay.querySelector('#oj-auto-show');
		if (autoShowCb) {
			autoShowCb.addEventListener('change', (e) => {
				this.prefStorage.set('uiVisible', e.target.checked);
			});
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
