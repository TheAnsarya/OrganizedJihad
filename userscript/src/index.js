// NOTE: The canonical TamperMonkey metadata block is emitted by
// webpack.BannerPlugin (see webpack.config.cjs).  The block below is
// kept only as human-readable documentation of the directives.
//
// ==UserScript==  (informational — webpack banner is authoritative)
// @name         OrganizedJihad - Hero Wars Tracker
// @namespace    http://tampermonkey.net/
// @version      0.9.2
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
// @run-at       document-end
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
import './styles/main.css';

(async function () {
	'use strict';

	console.log(
		'%c[OrganizedJihad]%c Hero Wars Tracker v0.9.2 Loaded',
		'color: #4CAF50; font-weight: bold; font-size: 14px;',
		'color: #2196F3; font-size: 14px;'
	);

	// ─── Status Badge ───────────────────────────────────────────────────
	// Floating indicator showing the script is active and counting API calls.
	// Appears immediately so the user knows the script loaded, even before
	// any API calls are intercepted.

	/** @type {number} Running count of intercepted API calls */
	let apiCallCount = 0;

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
			<span class="oj-badge-dot"></span>
			<span class="oj-badge-text">OJ: Listening...</span>
		`;
		badge.title = 'OrganizedJihad Tracker — Click to open panel';
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
			text.textContent = `OJ: ${count} call${count !== 1 ? 's' : ''}`;
		}
	}

	// Inject badge styles directly (works before CSS bundle loads)
	const badgeStyles = document.createElement('style');
	badgeStyles.textContent = `
		#oj-status-badge {
			position: fixed;
			bottom: 16px;
			right: 16px;
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 6px 14px;
			background: rgba(30, 58, 95, 0.92);
			border: 1px solid rgba(255, 255, 255, 0.15);
			border-radius: 20px;
			color: #fff;
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			font-size: 12px;
			font-weight: 500;
			cursor: pointer;
			z-index: 999998;
			backdrop-filter: blur(8px);
			transition: all 0.3s ease;
			user-select: none;
			box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
		}
		#oj-status-badge:hover {
			background: rgba(30, 58, 95, 1);
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
			transform: translateY(-1px);
		}
		.oj-badge-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: #FFC107;
			animation: oj-pulse 2s infinite;
		}
		.oj-badge-dot-active {
			background: #4CAF50 !important;
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
			50% { opacity: 0.5; }
		}
	`;
	document.head.appendChild(badgeStyles);

	const statusBadge = createStatusBadge();

	// ─── Global Error Handlers ──────────────────────────────────────────
	// Catch any uncaught errors/rejections from our code and surface them
	// on the badge as a red indicator so the user knows something is off.

	/** @type {number} Running count of uncaught errors */
	let errorCount = 0;

	/**
	 * Show the error state on the status badge.
	 * Changes the dot to red and appends the error count.
	 *
	 * @param {number} count - Current error count
	 */
	function showBadgeError(count) {
		const dot = statusBadge.querySelector('.oj-badge-dot');
		if (dot) {
			dot.classList.add('oj-badge-dot-error');
		}
		statusBadge.title = `OrganizedJihad Tracker — ${count} error${count !== 1 ? 's' : ''} logged`;
	}

	/**
	 * Shared error handler for window.onerror and unhandledrejection.
	 * Only counts errors that originate from our own code.
	 *
	 * @param {string} source - Error origin description
	 * @param {Error|string} error - The error
	 */
	function handleGlobalError(source, error) {
		// Only count errors likely from our code (stack mentions OrganizedJihad or our bundle)
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

	// Catch synchronous errors
	window.addEventListener('error', (event) => {
		handleGlobalError('error', event.error || event.message);
	});

	// Catch unhandled promise rejections
	window.addEventListener('unhandledrejection', (event) => {
		handleGlobalError('rejection', event.reason);
	});

	// ─── Core Initialization ────────────────────────────────────────────

	// Initialize IndexedDB storage (for game data — heroes, battles, etc.)
	// The constructor starts init(); await it here so the DB is ready.
	const idbStorage = new IndexedDBStorage();
	await idbStorage.initPromise;
	console.log('[OrganizedJihad] IndexedDB storage initialized');

	// Initialize StorageManager (for preferences, goals, calendar — synchronous localStorage)
	const prefStorage = new StorageManager();

	// Initialize sync client (optional — only works if C# server is running)
	const syncClient = new SyncClient('http://localhost:5124');
	let apiAvailable = false;
	try {
		apiAvailable = await syncClient.checkHealth();
		if (apiAvailable) {
			console.log('[OrganizedJihad] ✅ API server connected at http://localhost:5124');
		}
	} catch {
		// Silently continue — API server is optional
	}
	if (!apiAvailable) {
		console.log('[OrganizedJihad] API server not available — storing data locally only');
	}

	// Initialize core modules
	// GameTracker and APIMonitor use IndexedDB for large game data
	// GoalsManager, CalendarManager, SuggestionsEngine use localStorage for preferences
	const gameTracker = new GameTracker(idbStorage);

	// Wire tracker-level error reporting to the badge
	gameTracker.onError = (count) => {
		errorCount = Math.max(errorCount, count); // Keep the higher count
		showBadgeError(errorCount);
	};

	const goalsManager = new GoalsManager(prefStorage);
	const calendarManager = new CalendarManager(prefStorage);
	const suggestionsEngine = new SuggestionsEngine(prefStorage, gameTracker, goalsManager);
	const uiManager = new UIManager(prefStorage, idbStorage, gameTracker, goalsManager, calendarManager, suggestionsEngine);

	// Initialize game overlay (floating hero completion panel, toggle via Alt+H)
	const gameOverlay = new GameOverlay(idbStorage, prefStorage);
	gameOverlay.init();

	// NOTE: APIMonitor is initialized AFTER gameTracker.init() (below)
	// to avoid double-proxying XMLHttpRequest. GameTracker's XHR proxy
	// handles API interception; APIMonitor only stores endpoints/stats.
	const apiMonitor = new APIMonitor(idbStorage);

	// ─── Wire Status Badge ──────────────────────────────────────────────

	// Hook into GameTracker to count API calls and update the badge.
	// GameTracker.processAPIResponse is called for every Hero Wars API response.
	const originalProcessAPI = gameTracker.processAPIResponse.bind(gameTracker);
	gameTracker.processAPIResponse = async function (request, response) {
		apiCallCount++;
		updateBadge(statusBadge, apiCallCount);
		const result = await originalProcessAPI(request, response);
		// Notify game overlay when hero data may have changed
		await gameOverlay.onHeroDataUpdated();
		return result;
	};

	// Click badge → toggle overlay
	statusBadge.addEventListener('click', () => {
		if (uiManager.isVisible) {
			uiManager.hide();
		} else {
			uiManager.show();
		}
	});

	// ─── Start Tracking ─────────────────────────────────────────────────

	/**
	 * Main initialization — called once the page DOM is ready.
	 * Sets up API interception, UI, and optional server sync.
	 */
	async function initialize() {
		console.log('[OrganizedJihad] Initializing tracker...');

		// Set up API interception (XHR proxy) — must run FIRST before any
		// other module that touches XMLHttpRequest
		await gameTracker.init();

		// Initialize API Monitor AFTER gameTracker so its XHR proxy layers
		// correctly on top (apiMonitor ← gameTracker ← real XHR)
		await apiMonitor.init();
		console.log('[OrganizedJihad] ✅ API Monitor initialized');

		// Initialize UI overlay (hidden by default until badge is clicked)
		await uiManager.init();

		// Start auto-sync if API server is available (every 15 minutes)
		if (apiAvailable) {
			const syncIntervalId = syncClient.startAutoSync(idbStorage, 15);
			console.log('[OrganizedJihad] Auto-sync enabled (every 15 min). Interval:', syncIntervalId);
			window.organizedJihadSyncInterval = syncIntervalId;
		}

		// Periodic suggestions update
		setInterval(async () => {
			try {
				await suggestionsEngine.updateSuggestions();
			} catch {
				// Non-critical — silently continue
			}
		}, 60000);

		console.log('[OrganizedJihad] ✅ Tracker ready — play the game normally');
	}

	// Wait for game to fully load
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize);
	} else {
		await initialize();
	}

	// Cleanup on page unload
	window.addEventListener('beforeunload', () => {
		if (window.organizedJihadSyncInterval) {
			clearInterval(window.organizedJihadSyncInterval);
		}
	});
})();
