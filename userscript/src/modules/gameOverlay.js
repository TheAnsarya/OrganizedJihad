/**
 * GameOverlay Module
 *
 * Renders a compact, draggable floating panel on top of the game UI
 * showing hero completion percentages. Designed to work regardless
 * of whether the game uses DOM or canvas rendering — the panel is
 * a standard HTML div positioned absolutely over the game area.
 *
 * Toggle: Alt+H hotkey or programmatic call to toggle()
 *
 * Reads the latest hero data from IndexedDB metadata cache and
 * computes completion percentages via HeroCompletionCalculator.
 *
 * @module GameOverlay
 * @see ~docs/plans/hero-completion-percentage-plan.md
 */

import HeroCompletionCalculator from './helpers/HeroCompletionCalculator.js';
import { decompressHeroStore } from './heroCompression.js';

/**
 * Floating game overlay panel for hero completion percentages.
 *
 * @class GameOverlay
 */
class GameOverlay {
	/**
	 * @param {import('./indexedDBStorage.js').default} idbStorage - Async IndexedDB wrapper
	 * @param {import('./storageManager.js').default} prefStorage - Sync localStorage wrapper
	 */
	constructor(idbStorage, prefStorage) {
		/** @type {import('./indexedDBStorage.js').default} */
		this.idbStorage = idbStorage;

		/** @type {import('./storageManager.js').default} */
		this.prefStorage = prefStorage;

		/** @type {HTMLDivElement|null} */
		this.panel = null;

		/** @type {boolean} */
		this.isVisible = false;

		/** @type {Array<Object>|null} Cached hero data */
		this._heroes = null;

		// Drag state
		this._isDragging = false;
		this._dragOffsetX = 0;
		this._dragOffsetY = 0;

		// Bind event handlers once
		this._onMouseMove = this._onMouseMove.bind(this);
		this._onMouseUp = this._onMouseUp.bind(this);
	}

	/**
	 * Initialise the overlay: create the DOM panel, bind the hotkey,
	 * and restore saved position.
	 * Idempotent — calling init() multiple times is safe; subsequent
	 * calls are no-ops.
	 */
	init() {
		if (this.panel) return; // already initialised — idempotency guard

		this._createPanel();
		this._bindHotkey();

		// Restore saved position
		const pos = this.prefStorage.get('gameOverlayPosition', null);
		if (pos && this.panel) {
			this.panel.style.top = pos.top;
			this.panel.style.left = pos.left;
			this.panel.style.right = 'auto';
		}
	}

	/**
	 * Toggle the overlay panel visibility.
	 * When showing, refreshes hero data from storage.
	 */
	async toggle() {
		this.isVisible = !this.isVisible;
		if (this.panel) {
			this.panel.style.display = this.isVisible ? 'block' : 'none';
		}
		if (this.isVisible) {
			await this.refresh();
		}
	}

	/**
	 * Show the overlay panel.
	 */
	async show() {
		this.isVisible = true;
		if (this.panel) {
			this.panel.style.display = 'block';
		}
		await this.refresh();
	}

	/**
	 * Hide the overlay panel.
	 */
	hide() {
		this.isVisible = false;
		if (this.panel) {
			this.panel.style.display = 'none';
		}
	}

	/**
	 * Refresh hero data and re-render the panel content.
	 */
	async refresh() {
		await this._loadHeroes();
		this._renderContent();
	}

	/**
	 * Notify the overlay that hero data has been updated.
	 * If the panel is visible, refreshes automatically.
	 */
	async onHeroDataUpdated() {
		if (this.isVisible) {
			await this.refresh();
		}
	}

	// ─── Private: DOM Creation ───────────────────────────────────────────

	/**
	 * Create the overlay panel DOM element and append to document.body.
	 * @private
	 */
	_createPanel() {
		const panel = document.createElement('div');
		panel.id = 'oj-game-overlay';
		panel.className = 'oj-game-overlay';
		panel.style.display = 'none'; // hidden by default

		panel.innerHTML = `
			<div class="oj-go-header" id="oj-go-drag-handle">
				<span class="oj-go-title">\uD83E\uDDB8 Hero Completion</span>
				<div class="oj-go-controls">
					<button class="oj-go-btn" id="oj-go-refresh" title="Refresh">\u21BB</button>
					<button class="oj-go-btn" id="oj-go-close" title="Close (Alt+H)">\u2715</button>
				</div>
			</div>
			<div class="oj-go-body" id="oj-go-body">
				<p class="oj-go-loading">Loading hero data...</p>
			</div>
			<div class="oj-go-footer">
				<span class="oj-go-hint">Alt+H to toggle</span>
			</div>
		`;

		document.body.appendChild(panel);
		this.panel = panel;

		// ── Close button ────────────────────────────────────────────────
		panel.querySelector('#oj-go-close').addEventListener('click', (e) => {
			e.stopPropagation();
			this.hide();
		});

		// ── Refresh button ──────────────────────────────────────────────
		panel.querySelector('#oj-go-refresh').addEventListener('click', async (e) => {
			e.stopPropagation();
			await this.refresh();
		});

		// ── Dragging ────────────────────────────────────────────────────
		const handle = panel.querySelector('#oj-go-drag-handle');
		handle.addEventListener('mousedown', (e) => {
			// Don't drag when clicking buttons
			if (e.target.closest('.oj-go-btn')) return;
			e.preventDefault();
			this._isDragging = true;
			const rect = panel.getBoundingClientRect();
			this._dragOffsetX = e.clientX - rect.left;
			this._dragOffsetY = e.clientY - rect.top;
			document.addEventListener('mousemove', this._onMouseMove);
			document.addEventListener('mouseup', this._onMouseUp);
		});
	}

	/**
	 * Handle mouse move during drag.
	 * @param {MouseEvent} e
	 * @private
	 */
	_onMouseMove(e) {
		if (!this._isDragging || !this.panel) return;
		const x = Math.max(0, e.clientX - this._dragOffsetX);
		const y = Math.max(0, e.clientY - this._dragOffsetY);
		this.panel.style.left = `${x}px`;
		this.panel.style.top = `${y}px`;
		this.panel.style.right = 'auto';
	}

	/**
	 * Handle mouse up to end drag and save position.
	 * @private
	 */
	_onMouseUp() {
		this._isDragging = false;
		document.removeEventListener('mousemove', this._onMouseMove);
		document.removeEventListener('mouseup', this._onMouseUp);

		// Persist position
		if (this.panel) {
			this.prefStorage.set('gameOverlayPosition', {
				top: this.panel.style.top,
				left: this.panel.style.left,
			});
		}
	}

	// ─── Private: Hotkey ─────────────────────────────────────────────────

	/**
	 * Bind Alt+H to toggle the overlay.
	 * @private
	 */
	_bindHotkey() {
		/** @type {(e: KeyboardEvent) => void} */
		this._hotkeyHandler = (e) => {
			if (e.altKey && (e.key === 'h' || e.key === 'H')) {
				e.preventDefault();
				this.toggle();
			}
		};
		document.addEventListener('keydown', this._hotkeyHandler);
	}

	/**
	 * Clean up DOM elements and event listeners.
	 */
	destroy() {
		if (this._hotkeyHandler) {
			document.removeEventListener('keydown', this._hotkeyHandler);
			this._hotkeyHandler = null;
		}
		if (this.panel?.parentNode) {
			this.panel.parentNode.removeChild(this.panel);
			this.panel = null;
		}
	}

	// ─── Private: Data Loading ───────────────────────────────────────────

	/**
	 * Load latest hero data from IndexedDB metadata cache.
	 * Falls back to the heroes IDB store if cache is empty.
	 * @private
	 */
	async _loadHeroes() {
		try {
			const cached = await this.idbStorage.getMetadata('heroesData', null);
			if (Array.isArray(cached) && cached.length > 0) {
				this._heroes = cached;
				return;
			}
		} catch { /* empty */ }

		// Fallback: deduplicate from heroes store (handles compressed batches #43)
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
				this._heroes = Object.values(byId);
				return;
			}
		} catch { /* empty */ }

		this._heroes = [];
	}

	// ─── Private: Rendering ──────────────────────────────────────────────

	/**
	 * Render the hero completion grid into the panel body.
	 * @private
	 */
	_renderContent() {
		const body = this.panel?.querySelector('#oj-go-body');
		if (!body) return;

		if (!this._heroes || this._heroes.length === 0) {
			body.innerHTML = '<p class="oj-go-empty">No hero data. Open your hero roster in-game to capture data.</p>';
			return;
		}

		const Calc = HeroCompletionCalculator;

		// Calculate and sort by completion descending
		const ranked = Calc.calculateAll(this._heroes);

		// Average completion
		const avg = ranked.length > 0
			? ranked.reduce((s, r) => s + r.completion.overall, 0) / ranked.length
			: 0;

		// Build compact rows
		const rows = ranked.map(({ hero, completion }) => {
			const name = this._escapeHtml(hero.heroName || hero.name || `Hero #${hero.heroId || hero.id}`);
			const pct = completion.overall;
			const color = Calc.colorClass(pct);

			return `
				<div class="oj-go-row">
					<span class="oj-go-name" title="${name}">${name}</span>
					<div class="oj-go-bar-wrap">
						<div class="oj-go-bar oj-completion-${color}" style="width:${Math.min(100, pct)}%"></div>
					</div>
					<span class="oj-go-pct oj-completion-${color}">${Calc.formatPercent(pct)}</span>
				</div>
			`;
		}).join('');

		body.innerHTML = `
			<div class="oj-go-summary">
				<strong>${ranked.length}</strong> heroes \u2022 avg <strong>${Calc.formatPercent(avg)}</strong>
			</div>
			<div class="oj-go-list">${rows}</div>
		`;
	}

	/**
	 * Escape HTML special characters to prevent XSS.
	 * @param {string} str - Raw string
	 * @returns {string} Escaped string
	 * @private
	 */
	_escapeHtml(str) {
		const div = document.createElement('div');
		div.textContent = str;
		return div.innerHTML;
	}
}

export default GameOverlay;
