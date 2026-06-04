// NOTE: The canonical TamperMonkey metadata block is emitted by
// webpack.BannerPlugin (see webpack.config.cjs).  The block below is
// kept only as human-readable documentation of the directives.
//
// ==UserScript==  (informational — webpack banner is authoritative)
// @name         OrganizedJihad - Hero Wars Tracker
// @namespace    http://tampermonkey.net/
// @version      (auto-incremented by webpack — see webpack.config.cjs)
// @description  Track and manage Hero Wars game data with IndexedDB storage and in-game UI
// @author       Andy Hubbard <me@ansarya.com>
// @match        https://www.hero-wars.com/*
// @match        https://*.hero-wars.com/*
// @match        https://i-heroes-fb.nextersglobal.com/*
// @match        https://i.hero-wars-fb.com/*
// @match        https://i-heroes-vk.nextersglobal.com/*
// @match        https://i-heroes-ok.nextersglobal.com/*
// @match        https://i-heroes-mm.nextersglobal.com/*
// @match        https://i-heroes-wb.nextersglobal.com/*
// @match        https://i-heroes-mg.nextersglobal.com/*
// @match        https://apps-1701433570146040.apps.fbsbx.com/*
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @connect      127.0.0.1
// @run-at       document-start
// ==/UserScript==

import GameTracker from './modules/gameTracker.js';
import UIManager from './modules/uiManager.js';
import IndexedDBStorage from './modules/indexedDBStorage.js';
import StorageManager from './modules/storageManager.js';
import SyncClient from './modules/syncClient.js';
import GoalsManager from './modules/goalsManager.js';
import CalendarManager from './modules/calendarManager.js';
import SuggestionsEngine from './modules/suggestionsEngine.js';
import APIMonitor from './modules/apiMonitor.js';
import GameOverlay from './modules/gameOverlay.js';
import BattleRecommendationOverlay from './modules/battleRecommendationOverlay.js';
import DomTargeting from './modules/domTargeting.js';
import { getConfiguredApiBaseUrl } from './modules/helpers/apiConfig.js';
import { isGameSurfaceLocation } from './modules/helpers/gameSurfaceGuard.js';
import NotificationManager from './modules/notificationManager.js';
import './styles/main.css';

(async function () {
	'use strict';

	/** @type {string} Build version injected by webpack DefinePlugin */
	const OJ_VERSION = typeof __OJ_VERSION__ !== 'undefined' ? __OJ_VERSION__ : '0.0.0';

	console.log(
		`%c[OrganizedJihad]%c Hero Wars Tracker v${OJ_VERSION} Loaded`,
		'color: #4CAF50; font-weight: bold; font-size: 14px;',
		'color: #2196F3; font-size: 14px;'
	);
	console.log(
		'%c[OJ]%c unsafeWindow=%s, PAGE_WINDOW=%s',
		'color:#4CAF50;font-weight:bold',
		'color:#888',
		typeof unsafeWindow,
		typeof (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window)
	);

	// ═══════════════════════════════════════════════════════════════════
	// PHASE 1 — Immediate  (@run-at document-start safe)
	//
	// No DOM operations here.  Set up the XHR / WebSocket proxy as
	// early as possible so we capture the initial login API batch
	// that fires before the DOM is ready.  IndexedDB operations
	// internally await their initPromise, so writes that arrive
	// before the DB opens are safely queued.  (#55)
	// ═══════════════════════════════════════════════════════════════════

	/** @type {number} Running count of intercepted API calls */
	let apiCallCount = 0;

	/** @type {number} Running count of uncaught errors */
	let errorCount = 0;

	/**
	 * Callback invoked after each processAPIResponse dispatch cycle.
	 * Initially null; set in PHASE 2 once DOM is ready and UI elements
	 * exist.  This lets the counter run from the first API call while
	 * badge / overlay updates wait for the DOM.
	 *
	 * @type {Function|null}
	 */
	let onApiProcessed = null;

	/**
	 * Badge-error callback.  Set in PHASE 2.
	 * @type {Function|null}
	 */
	let showBadgeError = null;

	/**
	 * Modules that need cleanup on page unload.
	 * Each entry should implement a `destroy()` method.
	 * @type {Array<{ destroy: Function }>}
	 */
	const _destroyables = [];

	// ── Storage ──────────────────────────────────────────────────────
	// IndexedDB constructor starts the DB open asynchronously.
	// StorageManager uses localStorage (available at document-start).
	const idbStorage = new IndexedDBStorage();
	const prefStorage = new StorageManager();

	// ── GameTracker construction ─────────────────────────────────────
	const gameTracker = new GameTracker(idbStorage);
	gameTracker.loadTrackingPrefs(prefStorage);

	// Wire error reporting (badge callback set later in PHASE 2)
	gameTracker.onError = (count) => {
		errorCount = Math.max(errorCount, count);
		if (showBadgeError) showBadgeError(errorCount);
	};

	// ── processAPIResponse wrapper ───────────────────────────────────
	// Wrap BEFORE init() so the counter starts from the very first
	// intercepted API call (even those that arrive while IDB opens).
	//
	// A sequential queue ensures only one processAPIResponse runs at
	// a time (#138).  Without this, parallel XHR completions can
	// interleave async IDB writes and race on dedup fingerprints
	// (_lastHeroHash, etc.), causing duplicate records.
	const originalProcessAPI = gameTracker.processAPIResponse.bind(gameTracker);

	/** @type {Promise<*>} Chains processAPIResponse calls sequentially */
	let _processingChain = Promise.resolve();

	gameTracker.processAPIResponse = function (request, response) {
		apiCallCount++;

		// Each call chains onto the previous, ensuring serial execution.
		// We capture the current count so the UI callback sees the
		// correct value even after queued calls increment it further.
		const callSnapshot = apiCallCount;

		_processingChain = _processingChain
			.then(async () => {
				// Core processing (writes to IDB, dispatches handlers)
				const result = await originalProcessAPI(request, response);

				// Delegate to PHASE 2 UI callback (badge, overlay, etc.)
				if (onApiProcessed) {
					try {
						await onApiProcessed(request, response, callSnapshot);
					} catch (e) {
						console.warn('[OrganizedJihad] onApiProcessed callback error:', e);
					}
				}

				return result;
			})
			.catch((err) => {
				// Log but don't break the chain — next queued call must still run.
				// Emit as an activity event so it surfaces in the API Log tab.
				console.error('[OrganizedJihad] processAPIResponse error:', err);
				try {
					gameTracker._emit('error', {
						source: 'processAPIResponse',
						message: err?.message || String(err),
						timestamp: Date.now(),
					});
				} catch { /* best-effort */ }
			});

		return _processingChain;
	};

	// ── Start interception ───────────────────────────────────────────
	// gameTracker.init() installs the XHR/WS proxy synchronously, then
	// awaits IDB.  The proxy is active after the first two sync calls
	// inside init(), so API traffic captured during the IDB open is
	// queued by IndexedDBStorage (every write awaits initPromise).
	await gameTracker.init();
	console.log('[OrganizedJihad] PHASE 1 complete — XHR/WS proxy active, IDB ready');

	// ═══════════════════════════════════════════════════════════════════
	// PHASE 2 — DOM Ready
	//
	// All badge creation, style injection, overlay init, and DOM
	// manipulation happens here.  At @run-at document-start the DOM
	// may not exist yet, so we defer to DOMContentLoaded.
	// ═══════════════════════════════════════════════════════════════════

	/**
	 * Set up all DOM-dependent modules, UI elements, and post-init
	 * wiring.  Called once the document is interactive.
	 */
	async function setupUI() {
		console.log('[OrganizedJihad] PHASE 2 — Setting up UI...');

		if (!isGameSurfaceLocation(window.location)) {
			console.log('[OrganizedJihad] Skipping UI/overlay initialization on non-game page:', window.location.href);
			return;
		}

		// ─── Status Badge ───────────────────────────────────────────
		// Floating indicator showing the script is active and counting
		// API calls.  Appears immediately so the user knows the script
		// loaded, even before any API calls are intercepted.

		/**
		 * Creates the floating status badge element.
		 * The badge is a small pill in the bottom-right corner of the game.
		 * States:
		 *   - Yellow "Listening..." — waiting for first API interception
		 *   - Green "N calls" — actively tracking
		 * Click opens the full overlay panel.
		 *
		 * @returns {HTMLDivElement} The badge DOM element
		 */
		function createStatusBadge() {
			const badge = document.createElement('div');
			badge.id = 'oj-status-badge';
			badge.innerHTML = `
				<span class="oj-badge-logo">⚔️</span>
				<span class="oj-badge-text">OrganizedJihad</span>
				<span class="oj-badge-dot"></span>
			`;
			badge.title = `OrganizedJihad Tracker v${OJ_VERSION} — Click to open panel`;
			document.body.appendChild(badge);
			return badge;
		}

		/**
		 * Updates the status badge with the current API call count.
		 * Transitions from yellow "Listening" to green "N calls" state.
		 *
		 * @param {HTMLDivElement} badge - The badge element
		 * @param {number} count - Current intercepted call count
		 */
		function updateBadge(badge, count) {
			const dot = badge.querySelector('.oj-badge-dot');
			const text = badge.querySelector('.oj-badge-text');

			if (count > 0) {
				badge.classList.add('oj-badge-active');
				dot.classList.add('oj-badge-dot-active');
				text.textContent = `OrganizedJihad: ${count}`;
			}
		}

		// Inject badge styles directly (works before CSS bundle loads)
		const badgeStyles = document.createElement('style');
		badgeStyles.textContent = `
			#oj-status-badge {
				position: fixed;
				top: 8px;
				left: 200px;
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 8px 18px;
				background: #3b143d;
				border: 1px solid rgba(200, 150, 255, 0.25);
				border-radius: 24px;
				color: #f0e0ff;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				font-size: 13px;
				font-weight: 600;
				letter-spacing: 0.3px;
				cursor: pointer;
				z-index: 999998;
				backdrop-filter: blur(8px);
				transition: all 0.3s ease;
				user-select: none;
				box-shadow: 0 2px 16px rgba(59, 20, 61, 0.6), 0 0 0 1px rgba(200, 150, 255, 0.1);
			}
			#oj-status-badge:hover {
				background: #4d1a50;
				box-shadow: 0 4px 24px rgba(59, 20, 61, 0.8), 0 0 12px rgba(200, 150, 255, 0.15);
				transform: translateY(-1px);
			}
			.oj-badge-logo {
				font-size: 15px;
				line-height: 1;
			}
			.oj-badge-text {
				white-space: nowrap;
			}
			.oj-badge-dot {
				width: 9px;
				height: 9px;
				border-radius: 50%;
				background: #FFC107;
				animation: oj-pulse 2s infinite;
				flex-shrink: 0;
			}
			.oj-badge-dot-active {
				background: #4CAF50 !important;
				animation: none !important;
			}
			.oj-badge-dot-error {
				background: #F44336 !important;
				animation: oj-pulse 1s infinite !important;
			}
			.oj-badge-active {
				border-color: rgba(76, 175, 80, 0.4);
			}
			@keyframes oj-pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.4; }
			}
		`;
		document.head.appendChild(badgeStyles);

		const statusBadge = createStatusBadge();

		// ─── Global Error Handlers ──────────────────────────────────
		// Catch any uncaught errors/rejections from our code and
		// surface them on the badge as a red indicator.

		/**
		 * Show the error state on the status badge.
		 * Changes the dot to red and appends the error count.
		 *
		 * @param {number} count - Current error count
		 */
		showBadgeError = function (count) {
			const dot = statusBadge.querySelector('.oj-badge-dot');
			if (dot) {
				dot.classList.add('oj-badge-dot-error');
			}
			statusBadge.title = `OrganizedJihad Tracker — ${count} error${count !== 1 ? 's' : ''} logged`;
		};

		/**
		 * Shared error handler for window.onerror and unhandledrejection.
		 * Only counts errors that originate from our own code.
		 *
		 * @param {string} source - Error origin description
		 * @param {Error|string} error - The error
		 */
		function handleGlobalError(source, error) {
			const msg = String(error?.message || error || '');
			const stack = String(error?.stack || '');
			const isOurs = msg.includes('OrganizedJihad') ||
				stack.includes('organized-jihad') ||
				stack.includes('OrganizedJihad');

			if (!isOurs) return;

			errorCount++;
			console.error(`[OrganizedJihad] Uncaught ${source}:`, error);
			showBadgeError(errorCount);
		}

		/** @type {(event: ErrorEvent) => void} */
		const _onGlobalError = (event) => {
			handleGlobalError('error', event.error || event.message);
		};
		/** @type {(event: PromiseRejectionEvent) => void} */
		const _onUnhandledRejection = (event) => {
			handleGlobalError('rejection', event.reason);
		};
		window.addEventListener('error', _onGlobalError);
		window.addEventListener('unhandledrejection', _onUnhandledRejection);

		// Store references for cleanup in beforeunload
		window._ojGlobalErrorHandler = _onGlobalError;
		window._ojGlobalRejectionHandler = _onUnhandledRejection;

		// ─── Initialize sync client (optional) ──────────────────────
		const configuredApiBaseUrl = getConfiguredApiBaseUrl(prefStorage);
		const syncClient = new SyncClient(configuredApiBaseUrl);
		let apiAvailable = false;
		try {
			apiAvailable = await syncClient.checkHealth();
			if (apiAvailable) {
				console.log(`[OrganizedJihad] ✅ API server connected at ${configuredApiBaseUrl}`);
			}
		} catch {
			// Silently continue — API server is optional
		}
		if (!apiAvailable) {
			console.log('[OrganizedJihad] API server not available — storing data locally only');
		}

		// ─── Module construction ────────────────────────────────────
		const goalsManager = new GoalsManager(prefStorage);
		const calendarManager = new CalendarManager(prefStorage);
		const suggestionsEngine = new SuggestionsEngine(prefStorage, gameTracker, goalsManager);
		const uiManager = new UIManager(prefStorage, idbStorage, gameTracker, goalsManager, calendarManager, suggestionsEngine);

		// Initialize game overlay (floating hero completion panel, toggle via Alt+H)
		const gameOverlay = new GameOverlay(idbStorage, prefStorage);
		gameOverlay.init();

		// Initialize battle recommendation overlay (floating in-game helper, Alt+R)
		const battleRecommendationOverlay = new BattleRecommendationOverlay(idbStorage, prefStorage);
		battleRecommendationOverlay.init();

		// Initialize DOM targeting for game-aware positioning (#50)
		const domTargeting = new DomTargeting({
			prefStorage,
			onStateChange: (newState, oldState) => {
				console.log(`[OrganizedJihad] Game state changed: ${oldState} → ${newState}`);
			},
		});
		domTargeting.init();

		// Register OJ elements for auto-hide during battles.
		// The status badge is intentionally NOT registered — it should
		// always be visible so the user knows the script is active,
		// even during Arena / Grand Arena / other battles.
		if (uiManager.overlay) domTargeting.registerElement(uiManager.overlay);
		if (gameOverlay.panel) domTargeting.registerElement(gameOverlay.panel);

		// Initialize notification manager for game event alerts (#52)
		const notificationManager = new NotificationManager(prefStorage);
		notificationManager.requestPermission();
		notificationManager.startDailyResetCheck();
		uiManager.notificationManager = notificationManager;

		// Register push event handlers for notifications (#52)
		gameTracker.registerHandler('push:arenaBattleResult', (_call, _args, data) => {
			notificationManager.notifyArenaDefense({
				attacker: data?.attackerName || data?.name,
				result: data?.win === false ? 'You lost' : data?.win === true ? 'You won' : undefined,
			});
		}, 'notifyArenaDefense');

		gameTracker.registerHandler('push:guildWarPointsChanged', (_call, _args, data) => {
			notificationManager.notifyGuildWar({ phase: data?.phase || data?.status });
		}, 'notifyGuildWarChange');

		gameTracker.registerHandler('push:updateMail', (_call, _args, data) => {
			notificationManager.notifyMail({ count: data?.count });
		}, 'notifyMail');

		// Check energy level whenever player data arrives (#77)
		gameTracker.registerHandler('userGetInfo', (_call, _args, data) => {
			const energy = data?.stamina;
			if (energy != null) {
				notificationManager.checkEnergy(energy);
			}
		}, 'checkEnergy');

		// Initialize API Monitor AFTER gameTracker so its XHR proxy layers
		// correctly on top (apiMonitor ← gameTracker ← real XHR)
		const apiMonitor = new APIMonitor(idbStorage);

		// ─── Wire PHASE 2 UI Callbacks ──────────────────────────────
		// Now that all DOM-dependent modules exist, wire the callback
		// so future processAPIResponse calls update badge + overlay.
		onApiProcessed = async (request, _response, count) => {
			updateBadge(statusBadge, count);

			// Notify domTargeting about each API call for battle auto-hide (#86)
			if (request?.calls) {
				for (const call of request.calls) {
					if (call.name) {
						domTargeting.onApiCall(call.name);
					}
				}
			}

			await gameOverlay.onHeroDataUpdated();
			await battleRecommendationOverlay.onApiProcessed(request);
		};

		// Catch up the badge with API calls captured during PHASE 1
		if (apiCallCount > 0) {
			updateBadge(statusBadge, apiCallCount);
		}

		// Click badge → toggle overlay
		statusBadge.addEventListener('click', () => {
			if (uiManager.isVisible) {
				uiManager.hide();
			} else {
				uiManager.show();
			}
		});

		// ─── Finish Initialization ──────────────────────────────────
		// apiMonitor and uiManager need their own async init().
		await apiMonitor.init();
		console.log('[OrganizedJihad] ✅ API Monitor initialized');

		await uiManager.init();

		// Start auto-sync if API server is available (every 15 minutes)
		if (apiAvailable) {
			const syncIntervalId = syncClient.startAutoSync(idbStorage, 15);
			console.log('[OrganizedJihad] Auto-sync enabled (every 15 min). Interval:', syncIntervalId);
			window.organizedJihadSyncInterval = syncIntervalId;
		}

		// Periodic suggestions update — store interval for cleanup (#133)
		const suggestionsIntervalId = setInterval(async () => {
			try {
				await suggestionsEngine.updateSuggestions();
			} catch {
				// Non-critical — silently continue
			}
		}, 60000);

		console.log('[OrganizedJihad] ✅ PHASE 2 complete — Tracker ready');

		// Register modules for cleanup on page unload
		_destroyables.push(gameTracker, notificationManager, domTargeting, gameOverlay, battleRecommendationOverlay, uiManager, apiMonitor);
		// Store interval ID for cleanup alongside the sync interval
		window.organizedJihadSuggestionsInterval = suggestionsIntervalId;
	}

	// ── Entry point ─────────────────────────────────────────────────
	// At @run-at document-start the DOM is not yet available.
	// Wait for DOMContentLoaded before setting up any UI.
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => setupUI());
	} else {
		await setupUI();
	}

	// Cleanup on page unload — destroy all modules that have active
	// timers, event listeners, or XHR/WebSocket proxies (#126, #133)
	window.addEventListener('beforeunload', () => {
		if (window.organizedJihadSyncInterval) {
			clearInterval(window.organizedJihadSyncInterval);
		}
		if (window.organizedJihadSuggestionsInterval) {
			clearInterval(window.organizedJihadSuggestionsInterval);
		}
		// Remove global error/rejection listeners to prevent stale closures
		if (window._ojGlobalErrorHandler) {
			window.removeEventListener('error', window._ojGlobalErrorHandler);
		}
		if (window._ojGlobalRejectionHandler) {
			window.removeEventListener('unhandledrejection', window._ojGlobalRejectionHandler);
		}
		for (const mod of _destroyables) {
			try {
				mod?.destroy?.();
			} catch (e) {
				console.warn('[OrganizedJihad] Cleanup error:', e);
			}
		}
	});
})();
