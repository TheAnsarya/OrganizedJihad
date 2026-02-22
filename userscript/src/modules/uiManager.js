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
	 * Dashboard — overview with counts from IndexedDB.
	 * @returns {Promise<string>} HTML content
	 */
	async renderDashboard() {
		// Gather counts from IndexedDB (safe — returns 0 on error)
		const snapshotCount = await this._countStore('snapshots');
		const heroCount = await this._countStore('heroes');
		const battleCount = (await this._countStore('arenaBattles'))
			+ (await this._countStore('grandArenaBattles'))
			+ (await this._countStore('titanArenaBattles'));
		const chestCount = await this._countStore('chestOpenings');
		const apiLogCount = await this._countStore('apiLogs');

		const goals = this._safeCall(() => this.goalsManager.getActiveGoals(), { shortTerm: [], longTerm: [] });
		const goalCount = goals.shortTerm.length + goals.longTerm.length;

		return `
			<div class="oj-dashboard">
				<div class="oj-section">
					<h3>\uD83D\uDCCA Tracked Data</h3>
					<div class="oj-stats-grid">
						${this._statCard(snapshotCount, 'Snapshots', '#4fc3f7')}
						${this._statCard(heroCount, 'Hero Records', '#81c784')}
						${this._statCard(battleCount, 'Battles', '#ffb74d')}
						${this._statCard(chestCount, 'Chests', '#ce93d8')}
						${this._statCard(apiLogCount, 'API Logs', '#90a4ae')}
						${this._statCard(goalCount, 'Active Goals', '#fff176')}
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
							<span class="oj-status-ok">Active</span>
						</div>
						<div class="oj-status-row">
							<span>Version</span>
							<span>3.0.0</span>
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
	 * Activity feed — recent API log entries from IndexedDB.
	 * @returns {Promise<string>} HTML content
	 */
	async renderActivity() {
		let logs = [];
		try {
			logs = await this.idbStorage.getAll('apiLogs', 50);
			// Sort newest first
			logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
		} catch {
			// No logs yet
		}

		if (logs.length === 0) {
			return `
				<div class="oj-activity">
					<h3>\uD83D\uDCE1 Live Activity Feed</h3>
					<p class="oj-empty">No API calls captured yet. Navigate around in the game to generate activity.</p>
				</div>
			`;
		}

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
				<h3>\uD83D\uDCE1 Live Activity Feed <span class="oj-muted">(last ${logs.length})</span></h3>
				<table class="oj-table">
					<thead>
						<tr><th>Time</th><th>API Call</th><th>Status</th></tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
		`;
	}

	/**
	 * Heroes — display hero snapshot data from IndexedDB.
	 * @returns {Promise<string>} HTML content
	 */
	async renderHeroes() {
		let heroes = [];
		try {
			heroes = await this.idbStorage.getAll('heroes', 100);
		} catch {
			// No data yet
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

		const rows = heroes.map((h) => `
			<tr>
				<td><strong>${this._escapeHtml(h.name || 'Hero #' + (h.heroId || h.id))}</strong></td>
				<td>${h.level || '\u2014'}</td>
				<td>${h.stars || '\u2014'}\u2605</td>
				<td>${h.color || '\u2014'}</td>
				<td class="oj-num">${h.power ? h.power.toLocaleString() : '\u2014'}</td>
			</tr>
		`).join('');

		return `
			<div class="oj-heroes">
				<h3>\uD83E\uDDB8 Heroes <span class="oj-muted">(${heroes.length})</span></h3>
				<table class="oj-table">
					<thead>
						<tr><th>Name</th><th>Level</th><th>Stars</th><th>Color</th><th>Power</th></tr>
					</thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
		`;
	}

	/**
	 * Battles — display arena battle history from IndexedDB.
	 * @returns {Promise<string>} HTML content
	 */
	async renderBattles() {
		let arenaData = [];
		let grandData = [];
		let titanData = [];
		try {
			arenaData = await this.idbStorage.getAll('arenaBattles', 30);
			grandData = await this.idbStorage.getAll('grandArenaBattles', 30);
			titanData = await this.idbStorage.getAll('titanArenaBattles', 30);
		} catch {
			// No data yet
		}

		const allBattles = [
			...arenaData.map((b) => ({ ...b, type: 'Arena' })),
			...grandData.map((b) => ({ ...b, type: 'Grand Arena' })),
			...titanData.map((b) => ({ ...b, type: 'Titan Arena' })),
		];

		// Sort newest first
		allBattles.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

		if (allBattles.length === 0) {
			return `
				<div class="oj-battles">
					<h3>\u2694\uFE0F Battles</h3>
					<p class="oj-empty">No battle data captured yet. Fight in the arena to start tracking!</p>
				</div>
			`;
		}

		const wins = allBattles.filter((b) => b.result === 'victory' || b.won === true).length;
		const losses = allBattles.length - wins;
		const winRate = allBattles.length > 0 ? ((wins / allBattles.length) * 100).toFixed(1) : '0.0';

		const rows = allBattles.slice(0, 30).map((b) => {
			const time = b.timestamp ? new Date(b.timestamp).toLocaleString() : '\u2014';
			const result = (b.result === 'victory' || b.won === true)
				? '<span class="oj-win">WIN</span>'
				: '<span class="oj-loss">LOSS</span>';
			const opponent = b.opponentName || b.defenderId || '\u2014';
			return `
				<tr>
					<td class="oj-mono">${time}</td>
					<td>${b.type}</td>
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
	 * Resources — display latest snapshot resource data.
	 * @returns {Promise<string>} HTML content
	 */
	async renderResources() {
		let snapshots = [];
		try {
			snapshots = await this.idbStorage.getAll('snapshots', 1);
		} catch {
			// No data yet
		}

		if (snapshots.length === 0) {
			return `
				<div class="oj-resources">
					<h3>\uD83D\uDC8E Resources</h3>
					<p class="oj-empty">No resource data captured yet. Play the game \u2014 your first snapshot will be taken automatically.</p>
				</div>
			`;
		}

		// Use the most recent snapshot
		const snap = snapshots[snapshots.length - 1];
		const ts = snap.timestamp ? new Date(snap.timestamp).toLocaleString() : 'Unknown';

		// Extract resource fields (common Hero Wars player data fields)
		const resources = [
			{ label: 'Gold', value: snap.gold, icon: '\uD83E\uDE99' },
			{ label: 'Emeralds', value: snap.starmoney || snap.emeralds, icon: '\uD83D\uDC8E' },
			{ label: 'Energy', value: snap.stamina || snap.energy, icon: '\u26A1' },
			{ label: 'Level', value: snap.level, icon: '\uD83D\uDCC8' },
			{ label: 'VIP Level', value: snap.vipLevel || snap.vip, icon: '\uD83D\uDC51' },
			{ label: 'Team Level', value: snap.teamLevel, icon: '\uD83C\uDFC6' },
		].filter((r) => r.value !== undefined && r.value !== null);

		const cards = resources.map((r) => `
			<div class="oj-resource-card">
				<div class="oj-resource-icon">${r.icon}</div>
				<div class="oj-resource-amount">${typeof r.value === 'number' ? r.value.toLocaleString() : r.value}</div>
				<div class="oj-resource-label">${r.label}</div>
			</div>
		`).join('');

		return `
			<div class="oj-resources">
				<h3>\uD83D\uDC8E Resources <span class="oj-muted">(as of ${ts})</span></h3>
				${cards ? '<div class="oj-stats-grid">' + cards + '</div>' : '<p class="oj-empty">Snapshot exists but contains no recognizable resource fields.</p>'}
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
					<p>OrganizedJihad \u2014 Hero Wars Tracker v3.0.0</p>
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
}

export default UIManager;
