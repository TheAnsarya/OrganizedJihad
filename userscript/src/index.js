// NOTE: The canonical TamperMonkey metadata block is emitted by
// webpack.BannerPlugin (see webpack.config.cjs).  The block below is
// kept only as human-readable documentation of the directives.
//
// ==UserScript==  (informational — webpack banner is authoritative)
// @name         OrganizedJihad - Hero Wars Tracker
// @namespace    http://tampermonkey.net/
// @version      3.0.1
// @description  Track and manage Hero Wars game data with IndexedDB storage and in-game UI
// @author       Andy Hubbard <me@ansarya.com>
// @match        https://i-heroes-fb.nextersglobal.com/*
// @match        https://i.hero-wars-fb.com/*
// @match        https://i-heroes-vk.nextersglobal.com/*
// @match        https://i-heroes-ok.nextersglobal.com/*
// @match        https://i-heroes-mm.nextersglobal.com/*
// @match        https://i-heroes-wb.nextersglobal.com/*
// @match        https://i-heroes-mg.nextersglobal.com/*
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
import './styles/main.css';

(async function () {
	'use strict';

	// ─── Guard: only run inside the game iframe ────────────────────────
	// The outer hero-wars.com page is just a shell; the real game and its
	// API traffic live inside an iframe on nextersglobal.com (or
	// hero-wars-fb.com).  Running the tracker on the outer page would
	// create a second badge, double-patch XHR, etc.
	const host = window.location.hostname;
	if (!host.includes('nextersglobal.com') && !host.includes('hero-wars-fb.com')) {
		console.log('[OrganizedJihad] Skipping — not in the game iframe (' + host + ')');
		return;
	}

	console.log(
		'%c[OrganizedJihad]%c Hero Wars Tracker v3.0.1 Loaded',
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
	const goalsManager = new GoalsManager(prefStorage);
	const calendarManager = new CalendarManager(prefStorage);
	const suggestionsEngine = new SuggestionsEngine(prefStorage, gameTracker, goalsManager);
	const uiManager = new UIManager(prefStorage, idbStorage, gameTracker, goalsManager, calendarManager, suggestionsEngine);

	// Initialize API Monitor for comprehensive API call logging
	const apiMonitor = new APIMonitor(idbStorage);
	await apiMonitor.init();
	console.log('[OrganizedJihad] ✅ API Monitor initialized');

	// ─── Wire Status Badge ──────────────────────────────────────────────

	// Hook into GameTracker to count API calls and update the badge.
	// GameTracker.processAPIResponse is called for every Hero Wars API response.
	const originalProcessAPI = gameTracker.processAPIResponse.bind(gameTracker);
	gameTracker.processAPIResponse = async function (request, response) {
		apiCallCount++;
		updateBadge(statusBadge, apiCallCount);
		return originalProcessAPI(request, response);
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

		// Set up API interception (XHR proxy)
		await gameTracker.init();

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
