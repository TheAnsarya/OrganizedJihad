/**
 * DOM Targeting & Game State Detection Module
 *
 * Improves OJ UI integration with the Hero Wars game by:
 * - Detecting the game canvas/container for relative positioning
 * - Tracking game state (idle, battle, loading) from intercepted API calls
 * - Auto-hiding OJ elements during full-screen game states (battles)
 * - Using MutationObserver to detect DOM structure changes
 *
 * Hero Wars web is primarily canvas-rendered, so stable DOM anchors are
 * limited.  This module gracefully degrades to viewport-fixed positioning
 * when game elements can't be found.
 *
 * @module domTargeting
 */

// ────────────────────────────────────────────────────────────────────────────
// Game state enum
// ────────────────────────────────────────────────────────────────────────────

/**
 * Known game states derived from API call patterns.
 *
 * @enum {string}
 */
export const GameState = Object.freeze({
	/** Game is loaded and player is in the main lobby / menus */
	IDLE: 'idle',
	/** A battle is in progress (arena, guild war, campaign, etc.) */
	BATTLE: 'battle',
	/** The game is still loading / login screen */
	LOADING: 'loading',
	/** Unknown state — no API activity detected yet */
	UNKNOWN: 'unknown',
});

// ────────────────────────────────────────────────────────────────────────────
// Known game DOM selectors (best-effort, may vary by platform/version)
// ────────────────────────────────────────────────────────────────────────────

/** Candidate selectors for the game canvas or container, ordered by likelihood */
const CANVAS_SELECTORS = [
	'canvas#canvas',           // Common ID on Nexters platforms
	'canvas.game-canvas',      // Possible class name
	'canvas',                  // Fallback: any canvas element
	'#game-container',         // Wrapper div on some platforms
	'.game-container',
	'#app',                    // Facebook app container
	'iframe#game_frame',       // Game inside iframe on VK/OK
];

/** API call names that indicate a battle has started */
const BATTLE_START_CALLS = new Set([
	'battleStart',
	'arenaAttack',
	'grandArenaAttack',
	'titanArenaAttack',
	'clanWarAttack',
	'clanRaidAttack',
	'adventureBattle',
	'towerAttack',
	'missionStart',
	'battleGetReplay',
]);

/** API call names that indicate a battle has ended */
const BATTLE_END_CALLS = new Set([
	'battleEnd',
	'arenaResult',
	'grandArenaResult',
	'titanArenaResult',
	'clanWarResult',
	'clanRaidResult',
	'adventureEnd',
	'towerResult',
	'missionEnd',
	'missionResult',
]);

// ────────────────────────────────────────────────────────────────────────────
// DomTargeting class
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detects game DOM structure and state, positions OJ elements relative
 * to the game container, and auto-hides during battles.
 */
export default class DomTargeting {
	/**
	 * @param {Object} options
	 * @param {import('./storageManager.js').default} options.prefStorage - Prefs
	 * @param {Function} [options.onStateChange] - Callback when game state changes
	 */
	constructor({ prefStorage, onStateChange } = {}) {
		/** @type {import('./storageManager.js').default} */
		this._prefStorage = prefStorage;

		/** @type {Function|null} */
		this._onStateChange = onStateChange || null;

		/** @type {string} Current detected game state */
		this._state = GameState.UNKNOWN;

		/** @type {Element|null} Cached game container reference */
		this._gameContainer = null;

		/** @type {MutationObserver|null} Active DOM observer */
		this._observer = null;

		/** @type {boolean} Whether auto-hide during battles is enabled */
		this._autoHideBattle = prefStorage?.get('autoHideBattle', true) ?? true;

		/** @type {Set<Element>} OJ elements to hide during battles */
		this._managedElements = new Set();

		/** @type {number|null} Timer for periodic container re-scan */
		this._scanInterval = null;

		/** @type {Object|null} Cached container bounds */
		this._containerBounds = null;
	}

	// ── Public API ──────────────────────────────────────────────────────

	/**
	 * Initialize DOM targeting: find game container, start observer, etc.
	 * Safe to call multiple times.
	 */
	init() {
		this._findGameContainer();
		this._startObserver();
		this._startPeriodicScan();

		// If we found a container, update state from loading to idle
		if (this._gameContainer) {
			this._setState(GameState.IDLE);
		}

		console.log(
			'[OrganizedJihad] DOM targeting initialized.',
			this._gameContainer
				? `Container: <${this._gameContainer.tagName.toLowerCase()}#${this._gameContainer.id || '(no-id)'}>`
				: 'No game container found — using viewport positioning.'
		);
	}

	/**
	 * Clean up observers and timers.
	 */
	destroy() {
		if (this._observer) {
			this._observer.disconnect();
			this._observer = null;
		}
		if (this._scanInterval) {
			clearInterval(this._scanInterval);
			this._scanInterval = null;
		}
		this._managedElements.clear();
	}

	/**
	 * Register an OJ DOM element to be auto-hidden during battles.
	 *
	 * @param {Element} el - DOM element to manage
	 */
	registerElement(el) {
		if (el) this._managedElements.add(el);
	}

	/**
	 * Unregister an element from auto-hide management.
	 *
	 * @param {Element} el
	 */
	unregisterElement(el) {
		this._managedElements.delete(el);
	}

	/**
	 * Notify the targeting system about an API call.
	 * Called from GameTracker's processAPIResponse to detect battle state.
	 *
	 * @param {string} callName - The API call name (e.g., 'battleStart')
	 */
	onApiCall(callName) {
		if (BATTLE_START_CALLS.has(callName)) {
			this._setState(GameState.BATTLE);
		} else if (BATTLE_END_CALLS.has(callName)) {
			this._setState(GameState.IDLE);
		}
	}

	/**
	 * Get the current game state.
	 *
	 * @returns {string} One of GameState values
	 */
	get state() {
		return this._state;
	}

	/**
	 * Get the game container element (if found).
	 *
	 * @returns {Element|null}
	 */
	get container() {
		return this._gameContainer;
	}

	/**
	 * Get the game container's bounding rectangle (cached, refreshed on
	 * resize/mutation).  Falls back to the full viewport if no container found.
	 *
	 * @returns {{ top: number, left: number, width: number, height: number }}
	 */
	get containerBounds() {
		if (this._containerBounds) return this._containerBounds;

		if (this._gameContainer) {
			const rect = this._gameContainer.getBoundingClientRect();
			this._containerBounds = {
				top: rect.top,
				left: rect.left,
				width: rect.width,
				height: rect.height,
			};
		} else {
			this._containerBounds = {
				top: 0,
				left: 0,
				width: window.innerWidth,
				height: window.innerHeight,
			};
		}
		return this._containerBounds;
	}

	/**
	 * Enable or disable auto-hide during battles.
	 *
	 * @param {boolean} enabled
	 */
	setAutoHideBattle(enabled) {
		this._autoHideBattle = enabled;
		this._prefStorage?.set('autoHideBattle', enabled);

		// If we just enabled and we're in battle, hide now
		if (enabled && this._state === GameState.BATTLE) {
			this._hideElements();
		}
		// If we just disabled and elements are hidden, show them
		if (!enabled) {
			this._showElements();
		}
	}

	/**
	 * Whether auto-hide during battles is enabled.
	 *
	 * @returns {boolean}
	 */
	get autoHideBattle() {
		return this._autoHideBattle;
	}

	// ── Internal ────────────────────────────────────────────────────────

	/**
	 * Attempt to find the game container using known selectors.
	 *
	 * @private
	 */
	_findGameContainer() {
		for (const selector of CANVAS_SELECTORS) {
			try {
				const el = document.querySelector(selector);
				if (el) {
					this._gameContainer = el;
					this._containerBounds = null; // invalidate cache
					return;
				}
			} catch {
				// Invalid selector — skip
			}
		}
		this._gameContainer = null;
	}

	/**
	 * Start a MutationObserver to watch for DOM structure changes.
	 * Re-scans for the game container when the body's direct children change.
	 *
	 * @private
	 */
	_startObserver() {
		if (this._observer) return;
		if (typeof MutationObserver === 'undefined') return;

		this._observer = new MutationObserver((mutations) => {
			let shouldRescan = false;
			for (const mutation of mutations) {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					shouldRescan = true;
					break;
				}
			}

			if (shouldRescan) {
				this._containerBounds = null; // invalidate
				if (!this._gameContainer) {
					this._findGameContainer();
					if (this._gameContainer) {
						console.log('[OrganizedJihad] Game container found via MutationObserver');
						this._setState(GameState.IDLE);
					}
				}
			}
		});

		this._observer.observe(document.body, {
			childList: true,
			subtree: false, // Only watch direct children to avoid perf issues
		});
	}

	/**
	 * Periodically re-scan for the game container and refresh bounds.
	 * Runs every 30 seconds, lightweight.
	 *
	 * @private
	 */
	_startPeriodicScan() {
		if (this._scanInterval) return;
		this._scanInterval = setInterval(() => {
			this._containerBounds = null; // Force refresh on next access
			if (!this._gameContainer) {
				this._findGameContainer();
			} else if (!document.body.contains(this._gameContainer)) {
				// Container was removed from DOM — rescan
				this._gameContainer = null;
				this._findGameContainer();
			}
		}, 30000);
	}

	/**
	 * Update game state and fire callbacks / auto-hide logic.
	 *
	 * @param {string} newState - New GameState value
	 * @private
	 */
	_setState(newState) {
		if (newState === this._state) return;

		const oldState = this._state;
		this._state = newState;

		console.log(`[OrganizedJihad] Game state: ${oldState} → ${newState}`);

		// Auto-hide during battles
		if (this._autoHideBattle) {
			if (newState === GameState.BATTLE) {
				this._hideElements();
			} else if (oldState === GameState.BATTLE) {
				this._showElements();
			}
		}

		// Notify listener
		if (this._onStateChange) {
			try {
				this._onStateChange(newState, oldState);
			} catch (err) {
				console.error('[OrganizedJihad] onStateChange callback error:', err);
			}
		}
	}

	/**
	 * Hide all managed OJ elements (battle mode).
	 *
	 * @private
	 */
	_hideElements() {
		for (const el of this._managedElements) {
			if (el && el.style) {
				el.dataset.ojPrevDisplay = el.style.display;
				el.style.display = 'none';
			}
		}
	}

	/**
	 * Restore visibility of managed OJ elements after battle.
	 *
	 * @private
	 */
	_showElements() {
		for (const el of this._managedElements) {
			if (el && el.style) {
				el.style.display = el.dataset.ojPrevDisplay || '';
				delete el.dataset.ojPrevDisplay;
			}
		}
	}
}
