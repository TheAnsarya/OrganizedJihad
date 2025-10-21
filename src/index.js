// ==UserScript==
// @name         OrganizedJihad - Hero Wars Tracker
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Track and manage Hero Wars game data with goals, calendar, and insights
// @author       Your Name
// @match        https://www.hero-wars.com/*
// @match        https://*.hero-wars.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

import GameTracker from './modules/gameTracker.js';
import UIManager from './modules/uiManager.js';
import StorageManager from './modules/storageManager.js';
import GoalsManager from './modules/goalsManager.js';
import CalendarManager from './modules/calendarManager.js';
import SuggestionsEngine from './modules/suggestionsEngine.js';
import './styles/main.css';

(function() {
    'use strict';

    console.log('OrganizedJihad - Hero Wars Tracker Loaded');

    // Initialize core modules
    const storage = new StorageManager();
    const gameTracker = new GameTracker(storage);
    const goalsManager = new GoalsManager(storage);
    const calendarManager = new CalendarManager(storage);
    const suggestionsEngine = new SuggestionsEngine(storage, gameTracker, goalsManager);
    const uiManager = new UIManager(storage, gameTracker, goalsManager, calendarManager, suggestionsEngine);

    // Start tracking when page is loaded
    function initialize() {
        console.log('Initializing OrganizedJihad tracker...');
        
        // Set up game data observers
        gameTracker.startTracking();
        
        // Initialize UI overlay
        uiManager.init();
        
        // Set up periodic data sync
        setInterval(() => {
            gameTracker.syncData();
            suggestionsEngine.updateSuggestions();
        }, 60000); // Every minute
    }

    // Wait for game to fully load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
