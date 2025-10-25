// ==UserScript==
// @name         OrganizedJihad - Hero Wars Tracker
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Track and manage Hero Wars game data with IndexedDB storage and API sync
// @author       Your Name
// @match        https://www.hero-wars.com/*
// @match        https://*.hero-wars.com/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

import GameTracker from './modules/gameTracker.js';
import UIManager from './modules/uiManager.js';
import IndexedDBStorage from './modules/indexedDBStorage.js';
import SyncClient from './modules/syncClient.js';
import GoalsManager from './modules/goalsManager.js';
import CalendarManager from './modules/calendarManager.js';
import SuggestionsEngine from './modules/suggestionsEngine.js';
import APIMonitor from './modules/apiMonitor.js';
import './styles/main.css';

(async function () {
	'use strict';

	console.log('OrganizedJihad - Hero Wars Tracker v2.0 Loaded');

	// Initialize IndexedDB storage
	const storage = new IndexedDBStorage();
	await storage.init();
	console.log('IndexedDB storage initialized');

	// Initialize sync client
	const syncClient = new SyncClient('http://localhost:5124');

	// Check if API is available
	const apiAvailable = await syncClient.checkHealth();
	if (apiAvailable) {
		console.log('✅ API server connected at http://localhost:5124');
	} else {
		console.warn('⚠️ API server not available - data will only be stored locally');
	}

	// Initialize core modules
	const gameTracker = new GameTracker(storage);
	const goalsManager = new GoalsManager(storage);
	const calendarManager = new CalendarManager(storage);
	const suggestionsEngine = new SuggestionsEngine(storage, gameTracker, goalsManager);
	const uiManager = new UIManager(storage, gameTracker, goalsManager, calendarManager, suggestionsEngine, syncClient);
	
	// Initialize API Monitor for comprehensive API call logging
	const apiMonitor = new APIMonitor(storage);
	await apiMonitor.init();
	console.log('✅ API Monitor initialized - logging all Hero Wars API calls');

	// Start tracking when page is loaded
	async function initialize() {
		console.log('Initializing OrganizedJihad tracker...');

		// Set up game data observers
		await gameTracker.init();

		// Initialize UI overlay
		await uiManager.init();

		// Start auto-sync if API is available (every 15 minutes)
		if (apiAvailable) {
			const syncIntervalId = syncClient.startAutoSync(storage, 15);
			console.log('Auto-sync enabled (every 15 minutes). Interval ID:', syncIntervalId);

			// Store interval ID for later cleanup
			window.organizedJihadSyncInterval = syncIntervalId;
		}

		// Set up periodic suggestions update
		setInterval(async () => {
			await suggestionsEngine.updateSuggestions();
		}, 60000); // Every minute
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
