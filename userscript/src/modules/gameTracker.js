/**
 * gameTracker.js
 *
 * Tracks and extracts game data from Hero Wars API requests
 * Uses XMLHttpRequest/fetch proxying to intercept and monitor game communication
 * WITHOUT modifying data (read-only tracking for legitimate progress monitoring)
 *
 * Key Features:
 * - Request/response interception for data capture
 * - Player stats extraction from API calls (userGetInfo)
 * - Hero roster tracking from heroGetAll responses
 * - Resource monitoring from inventoryGet
 * - Battle results capture from battle API calls
 *
 * Technical Implementation:
 * Inspired by HeroWarsHelper's request proxying pattern:
 * https://greasyfork.org/en/scripts/450693-herowarshelper
 *
 * WARNING: This module does NOT modify game data or requests.
 * It only observes and logs information for tracking purposes.
 *
 * @module gameTracker
 */

import IndexedDBStorage from './indexedDBStorage.js';
import UpgradeTracker from './trackers/UpgradeTracker.js';
import { compressHeroBatch, compressTitanBatch } from './heroCompression.js';

/**
 * Tracking categories used for per-category enable/disable toggles (#27).
 * Each key is a category slug; the value is the human-readable label.
 * Handler registrations specify a category; the dispatch code skips
 * handlers whose category is disabled in preferences.
 *
 * @type {Object<string, string>}
 */
const TRACKING_CATEGORIES = {
	player: 'Player & Inventory',
	battles: 'Battles & Arena',
	chests: 'Chests & Drops',
	guild: 'Guild & Chat',
	quests: 'Quests & Daily',
	upgrades: 'Hero/Titan Upgrades',
};

/**
 * Game data tracking via API interception
 * Monitors Hero Wars API requests for legitimate data tracking
 *
 * @class GameTracker
 */
class GameTracker {
	constructor(storage) {
		this.storage = storage || new IndexedDBStorage();
		this.isTracking = false;
		this.lastUpdate = Date.now();
		this.originalXHR = null;
		this.originalFetch = null;
		this.apiUrl = '';
		this.requestHistory = {};

		// ── Tracking category toggles (#27) ──────────────────────────────
		// Per-category enable/disable. Default: all enabled.
		// Populated from prefStorage during init() via loadTrackingPrefs().
		/** @type {Object<string, boolean>} */
		this._trackingPrefs = {};
		for (const cat of Object.keys(TRACKING_CATEGORIES)) {
			this._trackingPrefs[cat] = true;
		}
		/**
		 * Optional reference to the preference storage.
		 * Set by the host (index.js) after construction.
		 * @type {Object|null}
		 */
		this.prefStorage = null;

		// ── Auth credentials captured from request headers (#36) ─────────
		// Captured via setRequestHeader proxy. Enables future active API
		// calls (opponent lookup, guild war scouting, etc.).
		/** @type {{ authToken: string|null, sessionId: string|null, requestId: string|null }} */
		this.capturedAuth = {
			authToken: null,
			sessionId: null,
			requestId: null,
		};

		// ── Request history cleanup interval (#37) ────────────────────────
		/** @type {number} Max age in ms before request history entries are pruned */
		this._requestHistoryMaxAge = 60_000; // 60 seconds
		/** @type {number|null} Interval ID for periodic cleanup */
		this._cleanupIntervalId = null;

		// ── Sentry / analytics blocking (#53) ─────────────────────────────
		/** @type {boolean} Whether to block Sentry/analytics requests */
		this.blockSentry = true;
		/** @type {number} Count of blocked requests this session */
		this._blockedRequestCount = 0;

		// ── Snapshot debounce (#28) ────────────────────────────────────────
		// Coalesces rapid API response bursts into a single snapshot write.
		// When processAPIResponse triggers updateSnapshot, instead of writing
		// immediately we start a 5-second debounce timer. If another trigger
		// arrives within 5s, the timer restarts. The snapshot is written only
		// once the burst settles.
		/** @type {number|null} Debounce timer ID for snapshot coalescing */
		this._snapshotDebounceTimer = null;
		/** @type {number} Debounce delay in milliseconds */
		this._snapshotDebounceDelay = 5000;

		// Dedicated trackers for complex event categories
		this.upgradeTracker = new UpgradeTracker(this.storage);

		// Cache current rank values to use when player data lacks specific rank info
		// These get updated whenever we see rank data in any API response
		this.lastKnownArenaRank = 0;
		this.lastKnownGrandArenaRank = 0;
		this.lastKnownTitanArenaRank = 0;

		// ── Deduplication fingerprints ──────────────────────────────────────
		// Prevents writing identical snapshots on repeated API calls.
		// Each fingerprint is a JSON string derived from the data's key fields;
		// if the fingerprint matches the previous write, the snapshot is skipped.

		/** @type {string|null} Last fingerprint of hero roster for dedup */
		this._lastHeroHash = null;
		/** @type {string|null} Last fingerprint of titan roster for dedup */
		this._lastTitanHash = null;
		/** @type {string|null} Last fingerprint of pet roster for dedup */
		this._lastPetHash = null;
		/** @type {string|null} Last fingerprint of player key fields for dedup */
		this._lastPlayerKey = null;
		/** @type {string|null} Last fingerprint of inventory totals for dedup */
		this._lastInventoryHash = null;

		// ── Error tracking ─────────────────────────────────────────────────
		/** @type {number} Count of errors encountered during this session */
		this.errorCount = 0;
		/**
		 * Optional callback invoked whenever a tracker error is logged.
		 * Set by the host (index.js) to update the status badge.
		 *
		 * @type {((count: number) => void)|null}
		 */
		this.onError = null;

		// ── Event emitter ──────────────────────────────────────────────────
		// Simple pub-sub for live activity feed (Issue #24).
		// Listeners subscribe via on(event, handler) and are notified with _emit().
		/** @type {Map<string, Set<Function>>} */
		this._eventListeners = new Map();

		// ── API Call Log (debug ring buffer) ──────────────────────────────
		// Keeps the last 100 API calls with request/response summaries,
		// dispatched call names, and any errors. Used by the "API Log" UI tab.
		/** @type {Array<{ts: number, callNames: string[], status: string, detail: string, error: string|null, url: string|null}>} */
		this._apiCallLog = [];
		/** @type {number} Max entries in the API call log */
		this._apiCallLogMax = 100;
		/** @type {string} Hostname where the script is running */
		this._pageHost = window.location.hostname;

		// ── Pushd / WebSocket (#38, #39) ────────────────────────────────────
		/** @type {object|null} Reference to the game's pushd module once found */
		this._pushdModule = null;
		/** @type {number} How many times we've attempted to find window.nxg */
		this._pushdRetryCount = 0;
		/** @type {number|null} setTimeout ID for pushd polling */
		this._pushdTimerId = null;
		/** @type {number} Count of push events received this session */
		this.pushEventCount = 0;
		/** @type {Function|null} Saved original WebSocket.prototype.send */
		this._originalWsSend = null;

		// ── Handler Registry (#46) ─────────────────────────────────────────
		// Build the dispatch map: API method name → handler function(s).
		// Called at construction so all handlers are ready before init().
		this._buildHandlerRegistry();
	}

	/**
	 * Compute a lightweight fingerprint for deduplication.
	 * Produces a JSON string from the data's key fields. Comparing two
	 * fingerprints is ~100× cheaper than re-writing to IndexedDB.
	 *
	 * @param {*} data - Any JSON-serialisable value
	 * @returns {string} Deterministic JSON string
	 * @private
	 */
	_computeDataFingerprint(data) {
		return JSON.stringify(data);
	}

	// =====================================================================
	// Event Emitter (Issue #24 — Live Activity Feed)
	// =====================================================================

	/**
	 * Subscribe to a named event.
	 *
	 * @param {string} event  - Event name (e.g. 'activity', 'error')
	 * @param {Function} handler - Callback receiving the event payload
	 */
	on(event, handler) {
		if (!this._eventListeners.has(event)) {
			this._eventListeners.set(event, new Set());
		}
		this._eventListeners.get(event).add(handler);
	}

	/**
	 * Unsubscribe from a named event.
	 *
	 * @param {string} event  - Event name
	 * @param {Function} handler - The exact handler reference passed to on()
	 */
	off(event, handler) {
		const listeners = this._eventListeners.get(event);
		if (listeners) {
			listeners.delete(handler);
		}
	}

	/**
	 * Emit a named event to all subscribers. Errors in handlers are swallowed.
	 *
	 * @param {string} event - Event name
	 * @param {*} payload - Data to pass to handlers
	 * @private
	 */
	_emit(event, payload) {
		const listeners = this._eventListeners.get(event);
		if (!listeners) return;
		for (const handler of listeners) {
			try {
				handler(payload);
			} catch {
				// Listener blew up — don't let it cascade
			}
		}
	}

	/**
	 * Log a live activity event to IndexedDB and emit it to subscribers.
	 *
	 * Event types:
	 *   - 'battle'   : Arena / Grand Arena / Titan Arena / Guild War (green=win, red=loss)
	 *   - 'resource'  : Gold, emeralds, energy changes
	 *   - 'hero'      : Hero data captured, upgrades detected
	 *   - 'chest'     : Chest openings
	 *   - 'info'      : General tracking events (snapshot, player data)
	 *   - 'upgrade'   : Hero/Titan upgrades
	 *   - 'error'     : Errors encountered
	 *
	 * The store is capped at 500 entries — oldest are pruned on write.
	 *
	 * @param {string} eventType - One of the types listed above
	 * @param {string} message   - Human-readable description
	 * @param {object} [extra]   - Optional extra data for the event detail
	 * @returns {Promise<void>}
	 * @private
	 */
	async _logActivity(eventType, message, extra = {}) {
		const entry = {
			eventType,
			message,
			timestamp: Date.now(),
			...extra,
		};

		// Emit to live listeners immediately (before IDB write)
		this._emit('activity', entry);

		try {
			await this.storage.add('activityEvents', entry);

			// Cap at 500 entries — prune oldest
			const all = await this.storage.getAll('activityEvents');
			if (all.length > 500) {
				const toDelete = all
					.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
					.slice(0, all.length - 500);
				for (const old of toDelete) {
					await this.storage.delete('activityEvents', old.id);
				}
			}
		} catch {
			// Activity logging is best-effort — don't bubble up
		}
	}

	/**
	 * Log a tracker error to IndexedDB (last 50 kept) and notify the host.
	 * This is intentionally defensive — if the error-logging itself fails,
	 * we silently swallow rather than creating a cascade.
	 *
	 * @param {string} context - Human-readable location where the error occurred
	 * @param {Error|string} error - The caught error
	 * @returns {Promise<void>}
	 * @private
	 */
	async _logError(context, error) {
		this.errorCount++;

		// Notify host (index.js) so it can update the UI badge
		if (typeof this.onError === 'function') {
			try {
				this.onError(this.errorCount);
			} catch {
				// Badge callback blew up — ignore
			}
		}

		try {
			// Write to dedicated errorLog IDB store (#28)
			await this.storage.add('errorLog', {
				context,
				message: error?.message || String(error),
				stack: error?.stack?.substring(0, 500) || null,
				timestamp: Date.now(),
			});

			// Cap at 200 entries — prune oldest
			const all = await this.storage.getAll('errorLog');
			if (all.length > 200) {
				const toDelete = all
					.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
					.slice(0, all.length - 200);
				for (const old of toDelete) {
					await this.storage.delete('errorLog', old.id);
				}
			}
		} catch {
			// Error logging itself failed — nothing more we can do
		}

		// Emit to activity feed (best-effort, separate try/catch)
		try {
			this._emit('activity', {
				eventType: 'error',
				message: `Error in ${context}: ${error?.message || String(error)}`,
				timestamp: Date.now(),
			});
		} catch { /* empty */ }
	}

	/**
	 * Known API method-name prefixes used to identify call names inside
	 * minified/shortened request objects.
	 *
	 * @type {RegExp}
	 * @private
	 */
	static _METHOD_PREFIX_RE = /^(user|hero|titan|clan|arena|guild|quest|pet|shop|tower|expedition|mission|inventory|chat|mail|dungeon|raid|artifact|skin|rune|boss|chest|consumable|campaign|adventure|offer|daily|grand|pet_|quest_|titanArena)/;

	/**
	 * URL patterns to block when Sentry/analytics blocking is enabled (#53).
	 * Prevents error reporting from leaking info about our extension.
	 *
	 * @type {RegExp}
	 * @private
	 */
	static _BLOCKED_URL_RE = /sentry\.io|bugsnag\.com|rollbar\.com|loggly\.com|errorception\.com/i;

	/**
	 * Prune stale entries from requestHistory to prevent memory leaks (#37).
	 * Called periodically (every 30s) and after response processing.
	 * Removes entries older than {@link _requestHistoryMaxAge} (60s default).
	 *
	 * Pattern from HeroWarsHelper hwh2.js requestHistory cleanup.
	 *
	 * @private
	 */
	_pruneRequestHistory() {
		const now = Date.now();
		const cutoff = now - this._requestHistoryMaxAge;
		let pruned = 0;
		for (const [id, entry] of Object.entries(this.requestHistory)) {
			if (entry.timestamp < cutoff) {
				delete this.requestHistory[id];
				pruned++;
			}
		}
		if (pruned > 0) {
			console.debug(`[OrganizedJihad] Pruned ${pruned} stale request history entries`);
		}
	}

	/**
	 * Extract the calls array from a request object, handling both standard
	 * (key = "calls") and minified/shortened property names produced by the
	 * game's webpack bundle (e.g. "MPm" instead of "calls").
	 *
	 * Strategy:
	 * 1. If `request.calls` exists → fast path, use it directly.
	 * 2. Otherwise scan every value in the request for an Array of Objects.
	 *    The first such array is assumed to be the calls array.
	 * 3. For each element, discover `name` / `ident` / `args` by:
	 *    a. Using standard keys if present.
	 *    b. Matching string values against known API method prefixes → name.
	 *    c. Matching string values against response.results[].ident → ident.
	 *    d. Any remaining plain-object value → args.
	 *
	 * @param {Object} request  – The request payload (possibly minified)
	 * @param {Object} response – The response payload (always standard format)
	 * @returns {{ calls: Array, callMap: Object<string,string>, callArgs: Object<string,Object> } | null}
	 * @private
	 */
	_extractCalls(request, response) {
		// ── Fast path: standard format ──
		if (request?.calls) {
			const callMap = {};
			const callArgs = {};
			request.calls.forEach((call) => {
				callMap[call.ident] = call.name;
				callArgs[call.ident] = call.args || {};
			});
			return { calls: request.calls, callMap, callArgs };
		}

		if (!request || typeof request !== 'object' || !response?.results) return null;

		// ── Minified path: find the calls array among request values ──
		let callsArray = null;
		try {
			for (const val of Object.values(request)) {
				if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object') {
					callsArray = val;
					break;
				}
			}
		} catch {
			// Object.values may throw on exotic objects
			return null;
		}
		if (!callsArray) return null;

		// Collect known response idents for cross-referencing
		const responseIdents = new Set(response.results.map((r) => r.ident));

		const callMap = {};
		const callArgs = {};
		const normalizedCalls = [];

		for (const callObj of callsArray) {
			let name = callObj.name || null;
			let ident = callObj.ident || null;
			let args = callObj.args || null;

			if (!name || !ident) {
				// Scan values to classify them
				const stringVals = [];
				let objectVal = null;

				try {
					for (const val of Object.values(callObj)) {
						if (typeof val === 'string') {
							stringVals.push(val);
						} else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
							objectVal = val;
						}
					}
				} catch { /* ignore exotic objects */ }

				// A string matching a known API prefix → method name
				// A string matching a response ident → call ident
				for (const sv of stringVals) {
					if (!name && GameTracker._METHOD_PREFIX_RE.test(sv)) {
						name = sv;
					} else if (!ident && responseIdents.has(sv)) {
						ident = sv;
					}
				}

				// Fallback: shortest remaining string as ident
				if (!ident) {
					const remaining = stringVals.filter((s) => s !== name).sort((a, b) => a.length - b.length);
					if (remaining.length > 0) ident = remaining[0];
				}

				if (!args) args = objectVal || {};
			}

			normalizedCalls.push({ name: name || '(unknown)', ident: ident || '(unknown)', args: args || {} });
			if (ident) {
				callMap[ident] = name || '(unknown)';
				callArgs[ident] = args || {};
			}
		}

		if (normalizedCalls.length > 0) {
			console.info('[OrganizedJihad] Extracted calls from minified request:', normalizedCalls.map((c) => c.name).join(', '));
		}
		return { calls: normalizedCalls, callMap, callArgs };
	}

	/**
	 * Push an entry to the in-memory API call log ring buffer.
	 * Keeps the most recent {@link _apiCallLogMax} entries.
	 *
	 * @param {string[]} callNames - API method names from request.calls
	 * @param {'ok'|'error'|'skipped'|'no-match'} status - Outcome
	 * @param {string} detail - Human-readable description
	 * @param {string|null} error - Error message(s), if any
	 * @private
	 */
	_pushApiLog(callNames, status, detail, error, url) {
		this._apiCallLog.push({
			ts: Date.now(),
			callNames,
			status,
			detail,
			error,
			url: url || null,
			page: this._pageHost,
		});
		if (this._apiCallLog.length > this._apiCallLogMax) {
			this._apiCallLog.shift();
		}
		// Emit event so UI can auto-refresh if the API Log tab is visible
		this._emit('apiLog', this._apiCallLog.length);
	}

	/**
	 * Initialize game tracking by proxying API requests
	 * Sets up interception of XMLHttpRequest and fetch calls
	 *
	 * Pattern learned from HeroWarsHelper script's request interception:
	 * - Proxy XMLHttpRequest.prototype.send
	 * - Proxy XMLHttpRequest.prototype.onreadystatechange
	 * - Intercept responses in readyState === 4
	 *
	 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
	 *
	 * @returns {Promise<void>}
	 */
	async init() {
		try {
			await this.storage.init();
			this.proxyAPIRequests();
			this.proxyWebSocket();
			this.isTracking = true;

			// Run initial data purge on startup (#45)
			this._schedulePurge();

			// Start polling for pushd module (#38)
			this._startPushdPolling();

			console.log('[OrganizedJihad] GameTracker initialized - monitoring Hero Wars API');
		} catch (error) {
			console.error('[OrganizedJihad] Failed to initialize GameTracker:', error);
		}
	}

	/**
	 * Schedule an automatic data purge on startup and then every 6 hours.
	 *
	 * Retention periods are defined in `IndexedDBStorage.DEFAULT_RETENTION`.
	 * The user can override them via the settings UI (stored in metadata key
	 * `'purgeRetention'`).
	 *
	 * @private
	 */
	_schedulePurge() {
		// Fire-and-forget initial purge (don't block init)
		this._runPurge();

		// Repeat every 6 hours (21 600 000 ms)
		this._purgeIntervalId = setInterval(() => this._runPurge(), 6 * 60 * 60 * 1000);
	}

	/**
	 * Execute a single purge cycle. Reads optional user overrides from
	 * metadata and delegates to `storage.purgeOldRecords()`.
	 *
	 * @private
	 */
	async _runPurge() {
		try {
			const overrides = await this.storage.getMetadata('purgeRetention', {});
			const summary = await this.storage.purgeOldRecords(overrides);
			const total = Object.values(summary).reduce((a, b) => a + b, 0);
			if (total > 0) {
				await this._logActivity('system', `Auto-purge removed ${total} old record(s)`);
			}
		} catch (error) {
			console.error('[OrganizedJihad] Auto-purge failed:', error);
		}
	}

	/**
	 * Clean up timers and restore original XHR methods.
	 * Call this if the tracker needs to be torn down gracefully.
	 */
	destroy() {
		if (this._cleanupIntervalId) {
			clearInterval(this._cleanupIntervalId);
			this._cleanupIntervalId = null;
		}
		if (this._purgeIntervalId) {
			clearInterval(this._purgeIntervalId);
			this._purgeIntervalId = null;
		}
		if (this._pushdTimerId) {
			clearTimeout(this._pushdTimerId);
			this._pushdTimerId = null;
		}
		if (this._snapshotDebounceTimer) {
			clearTimeout(this._snapshotDebounceTimer);
			this._snapshotDebounceTimer = null;
		}
		if (this.originalXHR) {
			XMLHttpRequest.prototype.open = this.originalXHR.open;
			XMLHttpRequest.prototype.send = this.originalXHR.send;
			XMLHttpRequest.prototype.setRequestHeader = this.originalXHR.setRequestHeader;
		}
		if (this._originalWsSend) {
			WebSocket.prototype.send = this._originalWsSend;
			this._originalWsSend = null;
		}
		this.isTracking = false;
	}

	// =====================================================================
	// Pushd Hook (#38) — Real-time server push events
	// =====================================================================

	/**
	 * Start polling for the game's `window.nxg` framework object.
	 *
	 * HeroWars exposes a global `window.nxg` object once the game engine
	 * loads. `nxg.getModule('pushd')` returns the push-notification daemon
	 * which has an EventEmitter-like `.on('message', cb)` API.
	 *
	 * We retry up to 10 times at 10-second intervals (matching HWA's
	 * strategy), starting 10 seconds after init.
	 *
	 * @private
	 */
	_startPushdPolling() {
		this._pushdRetryCount = 0;
		this._pushdTimerId = setTimeout(() => this._tryHookPushd(), 10_000);
	}

	/**
	 * Attempt to hook into the game's pushd module.
	 *
	 * @private
	 */
	_tryHookPushd() {
		this._pushdTimerId = null;

		try {
			if (typeof window !== 'undefined' && window.nxg && typeof window.nxg.getModule === 'function') {
				const pushd = window.nxg.getModule('pushd');
				if (pushd && typeof pushd.on === 'function') {
					this._pushdModule = pushd;
					pushd.on('message', (event) => this._handlePushEvent(event));
					console.log('[OrganizedJihad] Successfully hooked pushd module — real-time events active');
					return; // success, no more retries
				}
			}
		} catch (err) {
			console.warn('[OrganizedJihad] pushd hook attempt failed:', err);
		}

		// Retry
		this._pushdRetryCount++;
		if (this._pushdRetryCount < 10) {
			console.log(`[OrganizedJihad] pushd not available yet (attempt ${this._pushdRetryCount}/10), retrying in 10s`);
			this._pushdTimerId = setTimeout(() => this._tryHookPushd(), 10_000);
		} else {
			console.log('[OrganizedJihad] pushd hook: gave up after 10 attempts — push events unavailable');
		}
	}

	/**
	 * Handle a push event received from the game's pushd module.
	 *
	 * Push events are real-time server notifications about game state
	 * changes — new mail, chat messages, guild war updates, arena results,
	 * etc. The exact event shape varies by type.
	 *
	 * @param {Object} event - Push event payload from the game server
	 * @private
	 */
	async _handlePushEvent(event) {
		this.pushEventCount++;

		try {
			const eventType = event?.type || event?.action || event?.name || 'unknown';
			const eventData = event?.data || event;

			// Log to API call log with 'push' status for visibility
			this._pushApiLog([`push:${eventType}`], 'push', `Push event: ${eventType}`, null, 'pushd');

			// Dispatch to handler registry if a handler is registered for the push event type
			const handlers = this._handlerRegistry.get(`push:${eventType}`);
			if (handlers && handlers.length > 0) {
				for (const entry of handlers) {
					// Skip handlers whose tracking category is disabled (#27)
					if (entry.category && !this._trackingPrefs[entry.category]) {
						continue;
					}
					try {
						await entry.handler.call(this, `push:${eventType}`, {}, eventData);
					} catch (err) {
						console.error(`[OrganizedJihad] Error in push handler "${entry.label}" for ${eventType}:`, err);
						await this._logError(`pushHandler:${eventType}:${entry.label}`, err);
					}
				}
			}

			// Log a live activity event for significant push types
			const significantEvents = [
				'chatMessage', 'updateMail', 'guildWarPointsChanged',
				'arenaBattleResult', 'guildRaidDamage', 'dailyBonusReady',
			];
			if (significantEvents.includes(eventType)) {
				await this._logActivity('push', `Server push: ${eventType}`, { pushType: eventType });
			}
		} catch (error) {
			console.error('[OrganizedJihad] Error processing push event:', error);
			await this._logError('handlePushEvent', error);
		}
	}

	// =====================================================================
	// WebSocket Proxy (#39) — Login dedup
	// =====================================================================

	/**
	 * Proxy `WebSocket.prototype.send` to intercept WebSocket traffic.
	 *
	 * Based on HWA's hwh2.js pattern: wraps the `onmessage` handler on
	 * first `send()` call per WS instance to filter duplicate
	 * `iframeEvent.login` messages from the game's iframe communication.
	 *
	 * This is a complementary approach to the pushd hook — it doesn't
	 * capture push events directly (the pushd module handles that) but
	 * prevents duplicate login noise in the event stream.
	 *
	 * @private
	 */
	proxyWebSocket() {
		const self = this;

		// Save original for cleanup
		this._originalWsSend = WebSocket.prototype.send;
		const originalSend = this._originalWsSend;

		WebSocket.prototype.send = function (data) {
			// On first send, wrap onmessage to filter duplicate login events
			if (!this._ojPatched) {
				const originalOnMessage = this.onmessage;

				this.onmessage = function (msgEvent) {
					try {
						const parsed = JSON.parse(msgEvent.data);
						// Filter duplicate iframeEvent.login messages
						if (parsed?.result?.type === 'iframeEvent.login') {
							if (this._ojSeenLogin) {
								return; // suppress duplicate
							}
							this._ojSeenLogin = true;
						}
					} catch {
						// Not JSON — pass through
					}

					if (originalOnMessage) {
						return originalOnMessage.apply(this, arguments);
					}
				};

				this._ojPatched = true;
			}

			// Call original send
			return originalSend.call(this, data);
		};

		console.log('[OrganizedJihad] WebSocket proxy installed — login dedup active');
	}

	/**
	 * Proxy XMLHttpRequest to intercept Hero Wars API calls
	 *
	 * Implementation pattern from HeroWarsHelper:
	 * 1. Save original XHR methods
	 * 2. Override open() to detect API URL pattern
	 * 3. Override send() to capture request data
	 * 4. Override onreadystatechange to capture responses
	 *
	 * Hero Wars API pattern: *.nextersglobal.com/api/
	 * Request format: JSON with "calls" array containing API method calls
	 *
	 * @private
	 */
	proxyAPIRequests() {
		const self = this;

		// Store original methods
		this.originalXHR = {
			open: XMLHttpRequest.prototype.open,
			send: XMLHttpRequest.prototype.send,
			setRequestHeader: XMLHttpRequest.prototype.setRequestHeader,
		};

		// ── Start request history cleanup timer (#37) ────────────────────
		// Prune entries older than 60s every 30s to prevent memory leaks
		// during long play sessions.
		this._cleanupIntervalId = setInterval(() => {
			self._pruneRequestHistory();
		}, 30_000);

		/**
		 * Proxy XMLHttpRequest.open() to detect API calls.
		 * Also detects and optionally blocks Sentry/analytics requests (#53).
		 * Hero Wars uses POST requests to *.nextersglobal.com/api/
		 */
		XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
			this._ojTracking = {
				method,
				url,
				timestamp: Date.now(),
				requestId: `${Date.now()}_${Math.random()}`,
				headers: {},
			};

			// Detect Hero Wars API URL pattern
			if (method === 'POST' && url.includes('.nextersglobal.com/api/') && /api\/$/.test(url)) {
				this._ojTracking.isHeroWarsAPI = true;
				if (!self.apiUrl) {
					self.apiUrl = url;
					console.log('[OrganizedJihad] Detected Hero Wars API URL:', url);
				}
			}

			// Detect Sentry / analytics endpoints (#53)
			if (self.blockSentry && GameTracker._BLOCKED_URL_RE.test(url)) {
				this._ojTracking.blocked = true;
			}

			return self.originalXHR.open.call(this, method, url, async, user, password);
		};

		/**
		 * Proxy XMLHttpRequest.setRequestHeader() to capture auth headers (#36).
		 * The game sets X-Auth-Token, X-Auth-Session-Id, X-Request-Id on every
		 * API call. Capturing these enables future active API calls.
		 *
		 * Pattern from HeroWarsHelper hwh2.js setRequestHeader proxy.
		 */
		XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
			// Store all headers on the tracking object for this XHR
			if (this._ojTracking) {
				this._ojTracking.headers[name] = value;

				// Capture auth-related headers specifically
				switch (name) {
					case 'X-Auth-Token':
						self.capturedAuth.authToken = value;
						break;
					case 'X-Auth-Session-Id':
						self.capturedAuth.sessionId = value;
						break;
					case 'X-Request-Id':
						self.capturedAuth.requestId = value;
						break;
				}
			}

			return self.originalXHR.setRequestHeader.call(this, name, value);
		};

		/**
		 * Proxy XMLHttpRequest.send() to capture request data
		 * Hero Wars requests are JSON strings with format:
		 * {
		 *   "calls": [
		 *     {"name": "userGetInfo", "args": {}, "ident": "body"},
		 *     {"name": "heroGetAll", "args": {}, "ident": "heroGetAll"}
		 *   ]
		 * }
		 */
		XMLHttpRequest.prototype.send = function (data) {
			// ── Block Sentry / analytics requests (#53) ──────────────────
			// Silently abort blocked requests to prevent error reporting
			// from leaking info about our extension's presence.
			if (this._ojTracking?.blocked) {
				self._blockedRequestCount++;
				// Fake a successful response so callers don't retry
				Object.defineProperty(this, 'status', { get: () => 200, configurable: true });
				Object.defineProperty(this, 'readyState', { get: () => 4, configurable: true });
				Object.defineProperty(this, 'responseText', { get: () => '{}', configurable: true });
				Object.defineProperty(this, 'response', { get: () => '{}', configurable: true });
				// Fire readystatechange so any listeners see completion
				try {
					this.dispatchEvent(new Event('readystatechange'));
					this.dispatchEvent(new Event('load'));
				} catch { /* ignore */ }
				return; // Don't actually send
			}

			if (this._ojTracking?.isHeroWarsAPI && data) {
				try {
					// Decode request body to a string, then JSON.parse it.
					// The game sends the body as an ArrayBuffer (binary UTF-8
					// encoded JSON), NOT as a plain JS object. If we skip the
					// decode step we get the raw buffer/object with webpack-
					// minified property names instead of proper {calls, ident,
					// name} keys.
					//
					// Pattern from HeroWarsHelper injected.js & hwh2.js:
					//   ArrayBuffer  → TextDecoder.decode → string → JSON.parse
					//   string       → JSON.parse directly
					//   obj.bytes    → TextDecoder.decode(obj.bytes) (fallback)
					let bodyStr;
					if (typeof data === 'string') {
						bodyStr = data;
					} else if (data instanceof ArrayBuffer) {
						bodyStr = new TextDecoder('utf-8').decode(data);
					} else if (ArrayBuffer.isView(data)) {
						// TypedArray or DataView (Uint8Array, etc.)
						bodyStr = new TextDecoder('utf-8').decode(data);
					} else if (data?.bytes instanceof ArrayBuffer || ArrayBuffer.isView(data?.bytes)) {
						// Some builds wrap the buffer in {bytes: ArrayBuffer}
						bodyStr = new TextDecoder('utf-8').decode(data.bytes);
					} else {
						// Last resort: try stringifying/parsing as-is
						bodyStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
					}

					const requestData = JSON.parse(bodyStr);
					this._ojTracking.requestData = requestData;

					// Store request for later processing
					self.requestHistory[this._ojTracking.requestId] = {
						request: requestData,
						response: null,
						timestamp: this._ojTracking.timestamp,
						url: this._ojTracking.url,
					};
				} catch (error) {
					console.warn('[OrganizedJihad] Failed to parse request data:', error);
				}

				// Use addEventListener instead of wrapping onreadystatechange.
				// addEventListener can't be overwritten by the game setting
				// xhr.onreadystatechange after send(), which would clobber our
				// wrapper and silently drop all interception.
				const xhrRef = this;
				this.addEventListener('readystatechange', function () {
					if (xhrRef.readyState !== 4 || xhrRef.status !== 200) return;

					try {
						// Handle both text and json responseType.
						// If responseType is "json", responseText throws InvalidStateError;
						// use this.response (already parsed) instead.
						let responseData;
						const isText = xhrRef.responseType === '' || xhrRef.responseType === 'text';
						if (isText) {
							responseData = JSON.parse(xhrRef.responseText);
						} else {
							responseData = xhrRef.response;
						}

						const requestId = xhrRef._ojTracking?.requestId;

						if (requestId && self.requestHistory[requestId]) {
							self.requestHistory[requestId].response = responseData;
							// Stash URL for log
							self._lastInterceptedUrl = self.requestHistory[requestId].url;

							// processAPIResponse is async — use Promise.resolve().catch()
							// to properly handle rejections (instead of uncaught async in
							// sync callback which silently swallows errors after count++).
							Promise.resolve(
								self.processAPIResponse(self.requestHistory[requestId].request, responseData)
							).catch((err) => {
								console.error('[OrganizedJihad] processAPIResponse error:', err);
								self._pushApiLog(
									[],
									'error',
									'processAPIResponse threw',
									err?.message || String(err),
									self.requestHistory[requestId]?.url
								);
							}).finally(() => {
								// Clean up processed entry immediately (#37)
								delete self.requestHistory[requestId];
							});
						}
					} catch (error) {
						console.warn('[OrganizedJihad] Failed to parse response:', error);
						const reqId = xhrRef._ojTracking?.requestId;
						const callNames = reqId && self.requestHistory[reqId]?.request?.calls
							? self.requestHistory[reqId].request.calls.map((c) => c.name)
							: [];
						self._pushApiLog(
							callNames,
							'error',
							'XHR response parse failed',
							error?.message || String(error),
							xhrRef._ojTracking?.url
						);
					}
				});
			}

			return self.originalXHR.send.call(this, data);
		};
	}

	/**
	 * Process captured API response data
	 * Extracts relevant information based on API call types
	 *
	 * Hero Wars API response format:
	 * {
	 *   "results": [
	 *     {"ident": "body", "result": {"response": {...actual data...}}}
	 *   ]
	 * }
	 *
	 * Comprehensive API calls we track:
	 * - userGetInfo: Player level, VIP, resources, guild
	 * - heroGetAll: Hero roster with stats, equipment, skins
	 * - inventoryGet: Items, consumables, fragments, chests
	 * - missionEnd, towerEnd, etc: Battle results with teams
	 * - arenaAttack, arenaGetEnemies: Arena opponents and results
	 * - titanArenaAttack, titanArenaGetEnemies: Titan arena battles
	 * - grandArenaAttack: Grand arena battles
	 * - clanWarAttack, clanWarGetInfo: Guild war data
	 * - bossRaid: Guild raid boss attacks
	 * - shopBuy, shopRefresh: Shop purchases and inventory
	 * - chestOpen: Chest opening results for drop rate analysis
	 * - questComplete: Quest rewards tracking
	 * - expeditionGetState, expeditionBattle: Expedition progress
	 *
	 * @param {Object} request - The request data with "calls" array
	 * @param {Object} response - The response data with "results" array
	 * @private
	 */
	async processAPIResponse(request, response) {
		// Try to extract calls — handles both standard and minified keys
		const extracted = this._extractCalls(request, response);

		if (!extracted) {
			// Diagnostic logging: show what we actually received.
			// Wrap JSON.stringify in try/catch because non-serializable data
			// (BigInt, circular refs, etc.) would throw and silently kill the
			// entire function before we ever push to the API log.
			let reqKeys = '(null)';
			let resKeys = '(null)';
			let reqSnippet = '(null)';
			let resSnippet = '(null)';
			try {
				reqKeys = request ? Object.keys(request).join(', ') : '(null)';
				resKeys = response ? Object.keys(response).join(', ') : '(null)';
			} catch { /* ignore */ }
			try {
				reqSnippet = JSON.stringify(request)?.substring(0, 200) || '(null)';
			} catch {
				reqSnippet = `(unstringifiable: ${typeof request})`;
			}
			try {
				resSnippet = JSON.stringify(response)?.substring(0, 200) || '(null)';
			} catch {
				resSnippet = `(unstringifiable: ${typeof response})`;
			}
			const detail = `No .calls/.results | req keys=[${reqKeys}] res keys=[${resKeys}]`;
			console.warn('[OrganizedJihad] processAPIResponse: unexpected format', {
				requestKeys: reqKeys,
				responseKeys: resKeys,
				requestSnippet: reqSnippet,
				responseSnippet: resSnippet,
				page: this._pageHost,
			});
			this._pushApiLog([], 'skipped', detail, `req: ${reqSnippet} | res: ${resSnippet}`, this._lastInterceptedUrl);
			return;
		}

		// Destructure the normalized calls info
		const { calls: extractedCalls, callMap, callArgs } = extracted;
		const allCallNames = extractedCalls.map((c) => c.name);

		// Track which calls were dispatched vs unhandled
		const dispatched = [];
		const unhandled = [];
		const errors = [];

		// Topologically sort results so dependencies process first (#47)
		const resultsByIdent = new Map();
		for (const result of response.results) {
			resultsByIdent.set(result.ident, result);
		}
		const identOrder = response.results.map((r) => r.ident);
		const methodOrder = identOrder.map((ident) => callMap[ident]).filter(Boolean);
		const uniqueMethods = [...new Set(methodOrder)];
		const sortedMethods = this._topologicalSortMethods(uniqueMethods);

		// Build sorted results list: dependency-ordered methods first,
		// then any results without a mapped method name
		const sortedResults = [];
		for (const method of sortedMethods) {
			// Find all results that map to this method (in original order)
			for (const ident of identOrder) {
				if (callMap[ident] === method && resultsByIdent.has(ident)) {
					sortedResults.push(resultsByIdent.get(ident));
					resultsByIdent.delete(ident);
				}
			}
		}
		// Append any unmapped results at the end
		for (const ident of identOrder) {
			if (resultsByIdent.has(ident)) {
				sortedResults.push(resultsByIdent.get(ident));
			}
		}

		// Process each result using the handler registry (#46)
		for (const result of sortedResults) {
			const callName = callMap[result.ident];
			const args = callArgs[result.ident];
			const responseData = result.result?.response;

			if (!responseData) {
				if (callName) unhandled.push(callName + '(no data)');
				continue;
			}

			// Look up handlers in the registry
			const handlers = this._handlerRegistry.get(callName);
			if (!handlers || handlers.length === 0) {
				if (callName) unhandled.push(callName);
				continue;
			}

			// Execute all registered handlers for this API method
			for (const entry of handlers) {
				// Skip handlers whose tracking category is disabled (#27)
				if (entry.category && !this._trackingPrefs[entry.category]) {
					continue;
				}
				try {
					await entry.handler.call(this, callName, args, responseData);
					if (!dispatched.includes(callName)) {
						dispatched.push(callName);
					}
				} catch (error) {
					console.error(`[OrganizedJihad] Error in handler "${entry.label}" for ${callName}:`, error);
					errors.push(`${callName}/${entry.label}: ${error?.message || String(error)}`);
					await this._logError(`processAPIResponse:${callName}:${entry.label}`, error);
				}
			}
		}

		// Push to API call log ring buffer
		const status = errors.length > 0 ? 'error' : (dispatched.length > 0 ? 'ok' : 'no-match');
		const detail = dispatched.length > 0
			? `Dispatched: ${dispatched.join(', ')}` + (unhandled.length > 0 ? ` | Unhandled: ${unhandled.join(', ')}` : '')
			: `Unhandled: ${unhandled.join(', ') || 'none'}`;
		this._pushApiLog(allCallNames, status, detail, errors.length > 0 ? errors.join('; ') : null, this._lastInterceptedUrl);

		// Trigger debounced data snapshot (#28)
		// Uses a 5-second coalescing window so rapid API bursts produce
		// only a single snapshot write instead of one per response.
		this._debouncedSnapshot();
	}

	// =====================================================================
	// Handler Registry (#46)
	// =====================================================================

	/**
	 * Register a handler for one or more API method names.
	 *
	 * Handlers are called with `(callName, args, responseData)` and bound
	 * to `this` (the GameTracker instance). Multiple handlers can be
	 * registered for the same method — they execute in registration order
	 * (or dependency order if `dependsOn` is specified).
	 *
	 * @param {string|string[]} methods - API method name(s) to handle
	 * @param {Function} handler - `async (callName, args, responseData) => void`
	 * @param {string} [label] - Human-readable label for error logging
	 * @param {Object} [options] - Optional configuration
	 * @param {string[]} [options.dependsOn] - API method names that should
	 *     be processed before this handler runs (within a single batch
	 *     response). Used to topologically sort result processing order.
	 * @param {string} [options.category] - Tracking category for toggle support (#27).
	 *     One of: player, battles, chests, guild, quests, upgrades.
	 */
	registerHandler(methods, handler, label = handler.name || '(anonymous)', options = {}) {
		const methodList = Array.isArray(methods) ? methods : [methods];
		const dependsOn = options.dependsOn || [];
		const category = options.category || null;

		// Validate: detect obviously circular self-dependencies
		for (const method of methodList) {
			if (dependsOn.includes(method)) {
				console.warn(`[OrganizedJihad] Handler "${label}" has circular self-dependency on "${method}" — ignoring dependency`);
				dependsOn.splice(dependsOn.indexOf(method), 1);
			}
		}

		for (const method of methodList) {
			if (!this._handlerRegistry.has(method)) {
				this._handlerRegistry.set(method, []);
			}
			this._handlerRegistry.get(method).push({ handler, label, dependsOn, category });
		}
	}

	/**
	 * Topologically sort API method names so that dependencies are
	 * processed before dependents within a single batch response.
	 *
	 * Uses Kahn's algorithm. Methods without declared dependencies
	 * retain their original order. Any cycles are detected and logged
	 * as warnings — cycled nodes are appended at the end.
	 *
	 * @param {string[]} methodNames - Unordered method names from the response
	 * @returns {string[]} Topologically sorted method names
	 * @private
	 */
	_topologicalSortMethods(methodNames) {
		const nameSet = new Set(methodNames);

		// Build dependency graph: method → set of methods it depends on
		// (only include deps that are actually in this batch)
		/** @type {Map<string, Set<string>>} */
		const deps = new Map();
		/** @type {Map<string, number>} */
		const inDegree = new Map();

		for (const name of methodNames) {
			deps.set(name, new Set());
			inDegree.set(name, 0);
		}

		for (const name of methodNames) {
			const handlers = this._handlerRegistry.get(name) || [];
			for (const entry of handlers) {
				for (const dep of entry.dependsOn || []) {
					if (nameSet.has(dep) && dep !== name) {
						deps.get(name).add(dep);
					}
				}
			}
		}

		// Compute in-degrees
		for (const [name, depSet] of deps) {
			for (const dep of depSet) {
				inDegree.set(dep, (inDegree.get(dep) || 0)); // ensure dep exists
				// name depends on dep → dep must come first → name has in-degree from dep
			}
		}

		// Invert: for each name, count how many others depend on it
		// Actually, Kahn's works on in-degree of the node itself.
		// Edge: dep → name (dep must come before name).
		// in-degree of name = number of deps it has (in this batch).
		for (const [name, depSet] of deps) {
			inDegree.set(name, depSet.size);
		}

		// Kahn's algorithm
		const queue = [];
		for (const [name, degree] of inDegree) {
			if (degree === 0) {
				queue.push(name);
			}
		}

		const sorted = [];
		while (queue.length > 0) {
			const current = queue.shift();
			sorted.push(current);

			// For each method that depends on `current`, decrement its in-degree
			for (const [name, depSet] of deps) {
				if (depSet.has(current)) {
					depSet.delete(current);
					const newDegree = depSet.size;
					inDegree.set(name, newDegree);
					if (newDegree === 0 && !sorted.includes(name)) {
						queue.push(name);
					}
				}
			}
		}

		// Detect cycles: any remaining methods not in sorted
		const remaining = methodNames.filter((n) => !sorted.includes(n));
		if (remaining.length > 0) {
			console.warn(`[OrganizedJihad] Circular handler dependencies detected: ${remaining.join(', ')} — appending in original order`);
			sorted.push(...remaining);
		}

		return sorted;
	}

	/**
	 * Build the handler registry. Called once during construction.
	 * Each entry maps an API method name to one or more handler functions.
	 *
	 * Pattern inspired by HeroWarsHelper's handler array dispatch.
	 * @private
	 */
	_buildHandlerRegistry() {
		/** @type {Map<string, Array<{handler: Function, label: string}>>} */
		this._handlerRegistry = new Map();

		// ── Core player data ───────────────────────────────────────────
		this.registerHandler('userGetInfo', async (_call, _args, data) => {
			await this.trackPlayerData(data);
		}, 'trackPlayerData', { category: 'player' });

		this.registerHandler('heroGetAll', async (_call, _args, data) => {
			await this.trackHeroesData(data);
		}, 'trackHeroesData', { dependsOn: ['userGetInfo'], category: 'player' });

		this.registerHandler('inventoryGet', async (_call, _args, data) => {
			await this.trackInventoryData(data);
		}, 'trackInventoryData', { dependsOn: ['userGetInfo'], category: 'player' });

		// ── Battle systems ──────────────────────────────────────────────
		this.registerHandler('missionEnd', async (callName, args, data) => {
			await this.trackMissionProgress(args, data);
			await this.trackBattleResult(callName, args, data);
		}, 'trackMission', { category: 'battles' });

		this.registerHandler('towerEnd', async (callName, args, data) => {
			await this.trackTowerProgress(args, data);
			await this.trackBattleResult(callName, args, data);
		}, 'trackTower', { category: 'battles' });

		this.registerHandler('bossEnd', async (callName, args, data) => {
			await this.trackBattleResult(callName, args, data);
		}, 'trackBossEnd', { category: 'battles' });

		// ── Arena ───────────────────────────────────────────────────────
		this.registerHandler('arenaGetEnemies', async (_call, _args, data) => {
			await this.trackArenaEnemies(data);
		}, 'trackArenaEnemies', { category: 'battles' });

		this.registerHandler(['arenaAttack', 'arenaEnd'], async (_call, args, data) => {
			await this.trackArenaBattle(args, data);
		}, 'trackArenaBattle', { category: 'battles' });

		// ── Titan Arena ─────────────────────────────────────────────────
		this.registerHandler('titanArenaGetEnemies', async (_call, _args, data) => {
			await this.trackTitanArenaEnemies(data);
		}, 'trackTitanArenaEnemies', { category: 'battles' });

		this.registerHandler('titanArenaAttack', async (_call, args, data) => {
			await this.trackTitanArenaBattle(args, data);
		}, 'trackTitanArenaBattle', { category: 'battles' });

		// ── Grand Arena ─────────────────────────────────────────────────
		this.registerHandler('grandArenaGetEnemies', async (_call, _args, data) => {
			await this.trackGrandArenaEnemies(data);
		}, 'trackGrandArenaEnemies', { category: 'battles' });

		this.registerHandler('grandArenaAttack', async (_call, args, data) => {
			await this.trackGrandArenaBattle(args, data);
		}, 'trackGrandArenaBattle', { category: 'battles' });

		// ── Guild War ───────────────────────────────────────────────────
		this.registerHandler('clanWarAttack', async (_call, args, data) => {
			await this.trackGuildWarBattle(args, data);
		}, 'trackGuildWarBattle', { category: 'battles' });

		// ── Cross-Server War (#40) ──────────────────────────────────────
		this.registerHandler('clanWarGetBattleResults', async (_call, args, data) => {
			await this.trackCrossServerWarResults(args, data);
		}, 'trackCrossServerWarResults', { category: 'battles' });

		// ── Arena / Grand Arena Replays (#42) ───────────────────────────
		this.registerHandler('arenaGetReplay', async (callName, args, data) => {
			await this.trackArenaReplay(callName, args, data);
		}, 'trackArenaReplay', { category: 'battles' });

		this.registerHandler('grandGetReplay', async (callName, args, data) => {
			await this.trackArenaReplay(callName, args, data);
		}, 'trackGrandArenaReplay', { category: 'battles' });

		this.registerHandler('arenaFindEnemies', async (_call, _args, data) => {
			await this.trackArenaEnemies(data);
		}, 'trackArenaFindEnemies', { category: 'battles' });

		// ── Adventure / Boss Replays (#41) ──────────────────────────────
		this.registerHandler(['adventureGetReplay', 'bossGetReplay'], async (callName, args, data) => {
			await this.trackAdventureReplay(callName, args, data);
		}, 'trackAdventureReplay', { category: 'battles' });

		// ── Guild Raid ──────────────────────────────────────────────────
		this.registerHandler('bossRaidAttack', async (_call, args, data) => {
			await this.trackRaidBossAttack(args, data);
		}, 'trackRaidBossAttack', { category: 'battles' });

		// ── Loot and rewards ────────────────────────────────────────────
		this.registerHandler('chestOpen', async (_call, args, data) => {
			await this.trackChestOpening(args, data);
		}, 'trackChestOpening', { category: 'chests' });

		this.registerHandler('shopBuy', async (_call, args, data) => {
			await this.trackShopPurchase(args, data);
		}, 'trackShopPurchase', { category: 'chests' });

		this.registerHandler('questComplete', async (_call, args, data) => {
			await this.trackQuestComplete(args, data);
		}, 'trackQuestComplete', { category: 'quests' });

		// ── Other data ──────────────────────────────────────────────────
		this.registerHandler('questGetAll', async (_call, _args, data) => {
			await this.trackQuestsData(data);
		}, 'trackQuestsData', { category: 'quests' });

		this.registerHandler('clanGetInfo', async (_call, _args, data) => {
			await this.trackGuildData(data);
			await this.trackGuildMembers(data);
		}, 'trackGuildData', { category: 'guild' });

		this.registerHandler(['clanWarGetInfo', 'clanWarUserGetInfo'], async (_call, _args, data) => {
			await this.trackGuildWarInfo(data);
			await this.trackGuildWarParticipation(data);
		}, 'trackGuildWarInfo', { category: 'guild' });

		this.registerHandler('bossRaidGetInfo', async (_call, _args, data) => {
			await this.trackRaidBossInfo(data);
			await this.trackGuildRaidParticipation(data);
		}, 'trackRaidBossInfo', { category: 'guild' });

		this.registerHandler(['dungeonGetState', 'titanDungeonGetInfo'], async (_call, _args, data) => {
			await this.trackGuildDungeonParticipation(data);
		}, 'trackGuildDungeon', { category: 'guild' });

		this.registerHandler('expeditionGetState', async (_call, _args, data) => {
			await this.trackExpeditionState(data);
		}, 'trackExpeditionState', { category: 'battles' });

		this.registerHandler('expeditionBattle', async (_call, args, data) => {
			await this.trackExpeditionBattle(args, data);
		}, 'trackExpeditionBattle', { category: 'battles' });

		this.registerHandler('titanGetAll', async (_call, _args, data) => {
			await this.trackTitansData(data);
		}, 'trackTitansData', { category: 'player' });

		this.registerHandler('petGetAll', async (_call, _args, data) => {
			await this.trackPetsData(data);
		}, 'trackPetsData', { category: 'player' });

		// ── Chat and communication ──────────────────────────────────────
		this.registerHandler(['chatGetDialog', 'chatGetNewMessages'], async (callName, args, data) => {
			await this.trackChatMessages(args, data, callName);
		}, 'trackChatMessages', { category: 'guild' });

		this.registerHandler('chatSendMessage', async (_call, args, data) => {
			await this.trackOutgoingMessage(args, data);
		}, 'trackOutgoingMessage', { category: 'guild' });

		// ── Hero Upgrade Events (Phase 8) ───────────────────────────────
		this.registerHandler('heroUpgradeSkill', async (_call, args, data) => {
			await this.upgradeTracker.trackHeroSkillUpgrade(args, data, await this._getPlayerId());
		}, 'heroSkillUpgrade', { category: 'upgrades' });

		this.registerHandler('heroArtifactLevelUp', async (_call, args, data) => {
			await this.upgradeTracker.trackHeroArtifactUpgrade(args, data, await this._getPlayerId());
		}, 'heroArtifactUpgrade', { category: 'upgrades' });

		this.registerHandler('heroSkinUpgrade', async (_call, args, data) => {
			await this.upgradeTracker.trackHeroSkinUpgrade(args, data, await this._getPlayerId());
		}, 'heroSkinUpgrade', { category: 'upgrades' });

		this.registerHandler('heroEnchantRune', async (_call, args, data) => {
			await this.upgradeTracker.trackHeroGlyphUpgrade(args, data, await this._getPlayerId());
		}, 'heroGlyphUpgrade', { category: 'upgrades' });

		this.registerHandler('consumableUseHeroXp', async (_call, args, data) => {
			await this.upgradeTracker.trackHeroLevelUpgrade(args, data, await this._getPlayerId());
			await this.trackInventoryItemUsage(args, data, 'potion', 'hero_level');
		}, 'heroLevelUpgrade', { category: 'upgrades' });

		this.registerHandler('heroLevelUp', async (_call, args, data) => {
			await this.upgradeTracker.trackHeroGoldLevelUpgrade(args, data, await this._getPlayerId());
		}, 'heroGoldLevelUpgrade', { category: 'upgrades' });

		this.registerHandler(['heroEvolve', 'heroPromote'], async (_call, args, data) => {
			await this.upgradeTracker.trackHeroStarUpgrade(args, data, await this._getPlayerId());
		}, 'heroStarUpgrade', { category: 'upgrades' });

		this.registerHandler('heroColorEvolve', async (_call, args, data) => {
			await this.upgradeTracker.trackHeroColorUpgrade(args, data, await this._getPlayerId());
		}, 'heroColorUpgrade', { category: 'upgrades' });

		this.registerHandler('heroEquip', async (_call, args, data) => {
			await this.upgradeTracker.trackEquipmentChange(args, data, await this._getPlayerId(), 'equipped');
		}, 'heroEquip', { category: 'upgrades' });

		// ── Titan Upgrade Events (Phase 8) ──────────────────────────────
		this.registerHandler('titanArtifactLevelUp', async (_call, args, data) => {
			await this.upgradeTracker.trackTitanArtifactUpgrade(args, data, await this._getPlayerId());
		}, 'titanArtifactUpgrade', { category: 'upgrades' });

		this.registerHandler('titanUsePotions', async (_call, args, data) => {
			await this.upgradeTracker.trackTitanLevelUpgrade(args, data, await this._getPlayerId());
		}, 'titanLevelUpgrade', { category: 'upgrades' });

		this.registerHandler(['titanEvolve', 'titanStarUp'], async (_call, args, data) => {
			await this.upgradeTracker.trackTitanStarUpgrade(args, data, await this._getPlayerId());
		}, 'titanStarUpgrade', { category: 'upgrades' });

		this.registerHandler('titanUpgradeSkill', async (_call, args, data) => {
			await this.upgradeTracker.trackTitanSkillUpgrade(args, data, await this._getPlayerId());
		}, 'titanSkillUpgrade', { category: 'upgrades' });

		this.registerHandler('titanSkinUpgrade', async (_call, args, data) => {
			await this.upgradeTracker.trackTitanSkinUpgrade(args, data, await this._getPlayerId());
		}, 'titanSkinUpgrade', { category: 'upgrades' });

		// ── Daily Activity Events (Phase 8) ─────────────────────────────
		this.registerHandler('questFarm', async (_call, args, data) => {
			await this.trackDailyQuestFarm(args, data);
		}, 'trackDailyQuestFarm', { category: 'quests' });

		this.registerHandler('quest_questsFarm', async (_call, args, data) => {
			await this.trackBatchQuestFarm(args, data);
		}, 'trackBatchQuestFarm', { category: 'quests' });

		this.registerHandler('dailyBonusFarm', async (_call, args, data) => {
			await this.trackLoginReward(args, data);
		}, 'trackLoginReward', { category: 'quests' });

		this.registerHandler('dailyBonusGetInfo', async (_call, _args, data) => {
			await this.trackDailyBonusInfo(data);
		}, 'trackDailyBonusInfo', { category: 'quests' });

		// ── Consumable Reward / Drop-Rate Tracking (Phase 10) ───────────
		this.registerHandler('artifactChestOpen', async (_call, args, data) => {
			await this.trackConsumableOpening(args, data, 'artifactChest');
		}, 'consumable:artifactChest', { category: 'chests' });

		this.registerHandler('titanArtifactChestOpen', async (_call, args, data) => {
			await this.trackConsumableOpening(args, data, 'titanArtifactChest');
		}, 'consumable:titanArtifactChest', { category: 'chests' });

		this.registerHandler('pet_chestOpen', async (_call, args, data) => {
			await this.trackConsumableOpening(args, data, 'petChest');
		}, 'consumable:petChest', { category: 'chests' });

		this.registerHandler('consumableUseLootBox', async (_call, args, data) => {
			await this.trackConsumableOpening(args, data, 'lootBox');
		}, 'consumable:lootBox', { category: 'chests' });

		this.registerHandler('towerOpenChest', async (_call, args, data) => {
			await this.trackConsumableOpening(args, data, 'towerChest');
		}, 'consumable:towerChest', { category: 'chests' });

		this.registerHandler('bossOpenChestPay', async (_call, args, data) => {
			await this.trackConsumableOpening(args, data, 'outlandChest');
		}, 'consumable:outlandChest', { category: 'chests' });
	}

	/**
	 * Track player data from userGetInfo API call
	 * Now saves as a snapshot in IndexedDB
	 *
	 * @param {Object} data - Response from userGetInfo
	 * @private
	 */
	async trackPlayerData(data) {
		// Extract rank data from cached values or current response
		// Hero Wars API includes rank in various places depending on the call
		// See: https://community.hero-wars.com/discussion/arena-ranking-system
		const arenaRank = data.arenaRank || this.lastKnownArenaRank || 0;
		const grandArenaRank = data.grandArenaRank || this.lastKnownGrandArenaRank || 0;
		const titanArenaRank = data.titanArenaRank || this.lastKnownTitanArenaRank || 0;

		// ── Deduplication: skip if key fields unchanged since last call ───
		// userGetInfo fires on nearly every API batch, so this prevents
		// writing an identical snapshot row every few seconds.
		const playerKey = this._computeDataFingerprint([
			data.userId, data.level, data.vipLevel, data.power,
			data.gold, data.starmoney, data.clanId,
			arenaRank, grandArenaRank, titanArenaRank,
		]);
		if (playerKey === this._lastPlayerKey) {
			return; // Identical to previous snapshot — skip write
		}
		this._lastPlayerKey = playerKey;

		// Also cache the player ID for other tracker methods
		if (data.userId) {
			await this.storage.setMetadata('currentPlayerId', data.userId);
		}

		const snapshot = {
			playerId: data.userId,
			playerName: data.name || 'Unknown',
			level: data.level || 0,
			vipLevel: data.vipLevel || 0,
			teamPower: data.power || 0,
			gold: data.gold || 0,
			emeralds: data.starmoney || 0,
			guildName: data.clanTitle || null,
			guildId: data.clanId || null,
			arenaRank: arenaRank,
			grandArenaRank: grandArenaRank,
			titanArenaRank: titanArenaRank,
			titaniteDungeon: null, // Dungeon data comes from separate API call
			timestamp: new Date().toISOString(),
			rawData: JSON.stringify(data), // Store full data for future reference
		};

		await this.storage.add('snapshots', snapshot);
		console.log('[OrganizedJihad] Player snapshot saved:', snapshot.playerName, 'Level', snapshot.level);

		// Live activity event
		await this._logActivity('info', `Player snapshot: ${snapshot.playerName} (Lv${snapshot.level}, ${snapshot.gold?.toLocaleString()} gold, ${snapshot.emeralds?.toLocaleString()} emeralds)`);
	}

	/**
	 * Track heroes from heroGetAll API call.
	 * Stores complete hero snapshots in IndexedDB with full data for
	 * completion-percentage analysis.
	 *
	 * Game API hero object shape (heroGetAll response values):
	 *   id, level, star, color, power, xp,
	 *   skills: { skillId: level, ... },
	 *   artifacts: [ { level, star }, ... ],  (3 entries: weapon, book, ring)
	 *   runes: [ value, value, value, value, value ],  (5 glyphs)
	 *   skins: { skinId: level, ... },
	 *   titanGiftLevel,
	 *   ascensions: { tier: [nodeIndex, ...], ... },
	 *   slots: [0/1, ...],  (6 equipment slots)
	 *   petId, favorPetId, perks
	 *
	 * @param {Object} data - Response from heroGetAll (object with hero IDs as keys)
	 * @private
	 */
	async trackHeroesData(data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		// ── Deduplication: skip if hero roster hasn't changed ────────────
		// heroGetAll fires frequently; writing 50+ rows each time is
		// expensive when nothing has actually been upgraded.
		// Include skills/runes/skins/artifacts in fingerprint so upgrades
		// within a session are captured.
		const heroFingerprint = this._computeDataFingerprint(
			Object.values(data).map((h) => [
				h.id, h.level, h.star, h.color, h.power,
				h.skills, h.runes, h.skins, h.titanGiftLevel,
				h.artifacts?.map((a) => [a?.level, a?.star]),
			])
		);
		if (heroFingerprint === this._lastHeroHash) {
			console.log('[OrganizedJihad] Heroes unchanged — skipping snapshot');
			return;
		}
		this._lastHeroHash = heroFingerprint;

		const heroes = Object.values(data).map((hero) => {
			// ── Skills: API uses { skillId: level } object ──────────────
			const skillEntries = hero.skills && typeof hero.skills === 'object'
				? Object.values(hero.skills) : [];
			// Sort descending so skill slots 1-4 get the highest-leveled
			// skills (the core 4); extra skills (ascension) are tracked
			// in rawSkills.
			const sortedSkills = [...skillEntries]
				.filter((v) => typeof v === 'number')
				.sort((a, b) => b - a);

			// ── Skins: API returns { skinId: level } ────────────────────
			const skinObj = hero.skins && typeof hero.skins === 'object' ? hero.skins : {};
			const skinCount = Object.keys(skinObj).length;

			// ── Artifacts: array of { level, star } ─────────────────────
			const arts = Array.isArray(hero.artifacts) ? hero.artifacts : [];

			return {
				heroId: hero.id,
				heroName: hero.name || `Hero_${hero.id}`,
				level: hero.level || 0,
				stars: hero.star || 0,
				color: hero.color || 0,
				power: hero.power || 0,

				// Skin count (backward compat with C# model int field)
				skins: skinCount,

				// Individual skill levels (backward compat with C# model)
				skillLevel1: sortedSkills[0] || 0,
				skillLevel2: sortedSkills[1] || 0,
				skillLevel3: sortedSkills[2] || 0,
				skillLevel4: sortedSkills[3] || 0,

				// Individual artifact star levels (backward compat)
				artifactWeapon: arts[0]?.star || 0,
				artifactBook: arts[1]?.star || 0,
				artifactRing: arts[2]?.star || 0,

				// ── New fields for completion % calculation ──────────────
				// Raw skills object — preserves all skill IDs and levels
				rawSkills: JSON.stringify(hero.skills || {}),
				// Raw skins object — preserves skin IDs and levels
				rawSkins: JSON.stringify(skinObj),
				// Artifact levels (stars are in the backward-compat fields)
				artifactLevels: JSON.stringify(arts.map((a) => a?.level || 0)),
				// Glyph/rune levels (array of 5 values, max 43750 each)
				runes: JSON.stringify(hero.runes || []),
				// Titan spark gift level (max 30)
				titanGiftLevel: hero.titanGiftLevel || 0,
				// Ascension data (tiers → node arrays)
				ascensions: JSON.stringify(hero.ascensions || {}),
				// Pet assignment
				petId: hero.petId || 0,

				playerId: playerId,
				timestamp: timestamp,
			};
		});

		// ── Compressed batch storage (#43) ──────────────────────────────
		// Instead of 100+ individual rows, store a single compressed
		// batch record with shared playerId/timestamp and per-hero deltas
		// (only non-default fields).  Reduces IndexedDB size ~60-80%.
		const batch = compressHeroBatch(heroes);
		if (batch) {
			await this.storage.add('heroes', batch);
		}

		// Also cache full (uncompressed) records in metadata for fast UI
		// access — the primary read path uses this, not the store.
		await this.storage.setMetadata('heroesData', heroes);

		console.log(`[OrganizedJihad] Heroes tracked: ${heroes.length} heroes stored as compressed batch`);

		// Live activity event
		const topHero = heroes.reduce((best, h) => (h.power > (best?.power || 0) ? h : best), null);
		await this._logActivity('hero', `Hero roster captured: ${heroes.length} heroes (top: ${topHero?.heroName || '?'} at ${topHero?.power?.toLocaleString() || 0} power)`);
	}

	/**
	 * Track inventory from inventoryGet API call
	 * Stores complete inventory snapshot in IndexedDB (matches C# InventorySnapshot entity)
	 *
	 * Entity Structure (9 properties):
	 * - InventoryData: Complete JSON structure
	 * - Denormalized counts: TotalHeroSoulStones, TotalTitanSoulStones, TotalPetSoulStones,
	 *   TotalEvolutionItems, TotalConsumables, TotalChests
	 * - Tracking: PlayerId, Timestamp
	 *
	 * @param {Object} data - Response from inventoryGet
	 * @private
	 */
	async trackInventoryData(data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		// Calculate denormalized totals for performance
		const fragmentHero = data.fragmentHero || {};
		const fragmentTitan = data.fragmentTitan || {};
		const fragmentPet = data.fragmentPet || {};
		const consumable = data.consumable || {};
		const gear = data.gear || {};

		const totalHeroSoulStones = Object.values(fragmentHero).reduce((sum, count) => sum + (count || 0), 0);
		const totalTitanSoulStones = Object.values(fragmentTitan).reduce((sum, count) => sum + (count || 0), 0);
		const totalPetSoulStones = Object.values(fragmentPet).reduce((sum, count) => sum + (count || 0), 0);
		const totalEvolutionItems = Object.values(gear).reduce((sum, count) => sum + (count || 0), 0);
		const totalConsumables = Object.values(consumable).reduce((sum, count) => sum + (count || 0), 0);

		// Count chests (usually in consumable with specific IDs)
		const chestIds = Object.keys(consumable).filter((key) => key.includes('chest') || key.includes('box'));
		const totalChests = chestIds.reduce((sum, id) => sum + (consumable[id] || 0), 0);

		// ── Deduplication: skip if inventory totals haven't changed ──────
		const inventoryFingerprint = this._computeDataFingerprint([
			totalHeroSoulStones, totalTitanSoulStones, totalPetSoulStones,
			totalEvolutionItems, totalConsumables, totalChests,
		]);
		if (inventoryFingerprint === this._lastInventoryHash) {
			console.log('[OrganizedJihad] Inventory unchanged — skipping snapshot');
			return;
		}
		this._lastInventoryHash = inventoryFingerprint;

		const inventorySnapshot = {
			inventoryData: JSON.stringify(data), // Store complete raw data
			totalHeroSoulStones,
			totalTitanSoulStones,
			totalPetSoulStones,
			totalEvolutionItems,
			totalConsumables,
			totalChests,
			playerId: playerId,
			timestamp: timestamp,
		};

		// Store snapshot in IndexedDB inventory store
		await this.storage.add('inventory', inventorySnapshot);

		console.log(
			`[OrganizedJihad] Inventory tracked: ${totalHeroSoulStones} hero souls, ${totalTitanSoulStones} titan souls, ${totalPetSoulStones} pet souls, ${totalConsumables} consumables`
		);

		// Live activity event
		const totalItems = totalHeroSoulStones + totalTitanSoulStones + totalPetSoulStones + totalConsumables;
		await this._logActivity('info', `Inventory snapshot: ${totalItems.toLocaleString()} items tracked`);
	}

	/**
	 * Track titans from titanGetAll API call
	 * Stores complete titan snapshots in IndexedDB (matches C# Titan entity)
	 *
	 * Entity Structure (12 properties):
	 * - Identity: TitanId, TitanName
	 * - Stats: Level, Stars, Power, Element (fire/water/earth), SkinLevel
	 * - Skills: SkillLevel (single main skill)
	 * - Artifacts: ArtifactData (JSON - titans have different artifact system)
	 * - Special: SummonStars
	 * - Tracking: PlayerId, Timestamp
	 *
	 * @param {Object} data - Response from titanGetAll (object with titan IDs as keys)
	 * @private
	 */
	async trackTitansData(data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		// ── Deduplication: skip if titan roster hasn't changed ───────────
		const titanFingerprint = this._computeDataFingerprint(
			Object.values(data).map((t) => [t.id, t.level, t.star, t.power])
		);
		if (titanFingerprint === this._lastTitanHash) {
			console.log('[OrganizedJihad] Titans unchanged — skipping snapshot');
			return;
		}
		this._lastTitanHash = titanFingerprint;

		const titans = Object.values(data).map((titan) => ({
			titanId: titan.id,
			titanName: titan.name || `Titan_${titan.id}`,
			level: titan.level || 0,
			stars: titan.star || 0,
			power: titan.power || 0,
			skillLevel: titan.skill?.level || titan.skillLevel || 0, // Titans have one main skill
			artifactData: JSON.stringify(titan.artifacts || {}), // Titan artifacts are different from heroes
			summonStars: titan.summonStars || 0, // Special titan mechanic
			element: titan.element || titan.type || 'unknown', // fire, water, earth
			skinLevel: titan.skinLevel || 0,
			playerId: playerId,
			timestamp: timestamp,
		}));

		// ── Compressed batch storage (#43) ──────────────────────────────
		const batch = compressTitanBatch(titans);
		if (batch) {
			await this.storage.add('titans', batch);
		}

		// Cache full records in metadata for fast UI access
		await this.storage.setMetadata('titansData', titans);

		console.log(`[OrganizedJihad] Titans tracked: ${titans.length} titans stored as compressed batch`);
	}

	/**
	 * Track pets from petGetAll API call
	 * Stores complete pet snapshots in IndexedDB (matches C# Pet entity)
	 *
	 * Entity Structure (8 properties):
	 * - Identity: PetId, PetName
	 * - Stats: Stars, Power, Level
	 * - Special: PatronageData (JSON - which heroes the pet supports)
	 * - Tracking: PlayerId, Timestamp
	 *
	 * @param {Object} data - Response from petGetAll (object with pet IDs as keys)
	 * @private
	 */
	async trackPetsData(data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const pets = Object.values(data).map((pet) => ({
			petId: pet.id,
			petName: pet.name || `Pet_${pet.id}`,
			stars: pet.star || 0,
			power: pet.power || 0,
			level: pet.level || 0,
			patronageData: JSON.stringify(pet.patronage || {}), // Which heroes this pet supports
			playerId: playerId,
			timestamp: timestamp,
		}));

		// Store each pet snapshot in IndexedDB pets store
		for (const pet of pets) {
			await this.storage.add('pets', pet);
		}

		console.log(`[OrganizedJihad] Pets tracked: ${pets.length} pets stored as snapshots`);
	}

	/**
	 * Track battle results from various battle end API calls
	 *
	 * @param {string} battleType - Type of battle (missionEnd, towerEnd, etc)
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackBattleResult(battleType, args, data) {
		const battleRecord = {
			type: battleType.replace('End', ''),
			result: data.result?.win ? 'victory' : 'defeat',
			reward: data.reward || {},
			timestamp: Date.now(),
			mission: args.mission || args.id || 'unknown',
		};

		const battleHistory = await this.storage.getMetadata('battleHistory', []);
		battleHistory.push(battleRecord);

		// Keep last 1000 battles
		if (battleHistory.length > 1000) {
			battleHistory.shift();
		}

		await this.storage.setMetadata('battleHistory', battleHistory);
	}

	/**
	 * Track arena enemies for matchmaking analysis
	 *
	 * @param {Object} data - Arena enemies data
	 * @private
	 */
	async trackArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current arena rank if present
		// Arena API calls include user rank: https://community.hero-wars.com/discussion/arena-api
		if (data.user?.arenaRank) {
			this.lastKnownArenaRank = data.user.arenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			power: this.calculateTeamPower(enemy.heroes),
			heroes: this.compressHeroTeam(enemy.heroes),
			timestamp,
		}));

		// Store current arena enemies
		await this.storage.setMetadata('arenaEnemies', enemies);

		// Track historical arena encounters
		const encounterHistory = (await this.storage.getMetadata('arenaEncounterHistory', [])).concat(
			enemies.map((e) => ({ ...e, encounter: 'available' }))
		);

		// Keep last 500 encounters
		if (encounterHistory.length > 500) {
			encounterHistory.splice(0, encounterHistory.length - 500);
		}

		await this.storage.setMetadata('arenaEncounterHistory', encounterHistory);
	}

	/**
	 * Track arena battle results with opponent and team composition
	 * Stores in battles IndexedDB store with battleType='Arena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackArenaBattle(args, data) {
		const battle = {
			battleType: 'Arena',
			opponentId: args.enemyUserId,
			opponentName: null, // Will be filled from opponents tracking
			isWin: data.result?.win || false,
			playerPower: data.attackers ? this.calculateTeamPower(data.attackers) : 0,
			opponentPower: data.defenders ? this.calculateTeamPower(data.defenders) : 0,
			playerHeroes: data.attackers ? JSON.stringify(this.compressHeroTeam(data.attackers)) : null,
			opponentHeroes: data.defenders ? JSON.stringify(this.compressHeroTeam(data.defenders)) : null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		// Deduplication check (#44)
		if (this._isBattleDuplicate(battle)) {
			console.log('[OrganizedJihad] Skipping duplicate Arena battle');
			return;
		}

		await this.storage.add('battles', battle);

		// Live activity event
		await this._logActivity('battle', `Arena ${battle.isWin ? 'WIN' : 'LOSS'} vs opponent #${battle.opponentId || '?'}`, { isWin: battle.isWin });

		// Update opponent record (#51 — fixed param order, boolean→string, use IDB store)
		await this.updateOpponentRecord('Arena', args.enemyUserId, battle.isWin, {
			name: data.response?.user?.name,
			power: data.response?.user?.power || battle.opponentPower,
		});

		// Track resource rewards from arena battle
		// Hero Wars arena rewards: gold, arena tokens, and sometimes emeralds
		// See: https://community.hero-wars.com/discussion/arena-rewards-system
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'arena');
		}
		if (rewards.arenaToken) {
			await this.trackResourceTransaction('arena_coins', rewards.arenaToken, 'battle', 'arena');
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'arena');
		}
	}

	/**
	 * Track Titan Arena enemies
	 *
	 * @param {Object} data - Titan arena enemies data
	 * @private
	 */
	async trackTitanArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current Titan Arena rank if present
		// Titan Arena structure includes user.titanArenaRank
		if (data.user?.titanArenaRank) {
			this.lastKnownTitanArenaRank = data.user.titanArenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			power: this.calculateTeamPower(enemy.titans),
			titans: this.compressHeroTeam(enemy.titans),
			timestamp,
		}));

		await this.storage.setMetadata('titanArenaEnemies', enemies);
	}

	/**
	 * Track Titan Arena battle results
	 * Stores in battles IndexedDB store with battleType='TitanArena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackTitanArenaBattle(args, data) {
		const battle = {
			battleType: 'TitanArena',
			opponentId: args.enemyUserId,
			opponentName: null,
			isWin: data.result?.win || false,
			playerPower: data.attackers ? this.calculateTeamPower(data.attackers) : 0,
			opponentPower: data.defenders ? this.calculateTeamPower(data.defenders) : 0,
			playerHeroes: data.attackers ? JSON.stringify(this.compressHeroTeam(data.attackers)) : null,
			opponentHeroes: data.defenders ? JSON.stringify(this.compressHeroTeam(data.defenders)) : null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		// Deduplication check (#44)
		if (this._isBattleDuplicate(battle)) {
			console.log('[OrganizedJihad] Skipping duplicate TitanArena battle');
			return;
		}

		await this.storage.add('battles', battle);
		// #51 — fixed param order, boolean→string, use IDB store
		await this.updateOpponentRecord('TitanArena', args.enemyUserId, battle.isWin, {
			name: data.response?.user?.name,
			power: data.response?.user?.power || battle.opponentPower,
		});

		// Live activity event
		await this._logActivity('battle', `Titan Arena ${battle.isWin ? 'WIN' : 'LOSS'} vs opponent #${battle.opponentId || '?'}`, { isWin: battle.isWin });

		// Track resource rewards from titan arena battle
		// Titan Arena rewards: gold, titan tokens/potions
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'titan_arena');
		}
		if (rewards.titanPotion) {
			await this.trackResourceTransaction('titan_potion', rewards.titanPotion, 'battle', 'titan_arena');
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'titan_arena');
		}
	}

	/**
	 * Track Grand Arena enemies
	 *
	 * @param {Object} data - Grand arena enemies data
	 * @private
	 */
	async trackGrandArenaEnemies(data) {
		if (!data.enemies) return;

		// Extract and cache player's current Grand Arena rank if present
		// Grand Arena uses similar API structure with user.grandArenaRank
		if (data.user?.grandArenaRank) {
			this.lastKnownGrandArenaRank = data.user.grandArenaRank;
		}

		const timestamp = Date.now();
		const enemies = data.enemies.map((enemy) => ({
			userId: enemy.userId,
			name: enemy.name,
			level: enemy.level,
			teams: enemy.teams
				? enemy.teams.map((team) => ({
						power: this.calculateTeamPower(team.heroes),
						heroes: this.compressHeroTeam(team.heroes),
					}))
				: [],
			timestamp,
		}));

		await this.storage.setMetadata('grandArenaEnemies', enemies);
	}

	/**
	 * Track Grand Arena battle results (3 teams vs 3 teams)
	 * Stores in battles IndexedDB store with battleType='GrandArena'
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackGrandArenaBattle(args, data) {
		const battle = {
			battleType: 'GrandArena',
			opponentId: args.enemyUserId,
			opponentName: null,
			isWin: data.result?.win || false,
			playerPower: 0, // Grand arena has multiple teams
			opponentPower: 0,
			playerHeroes: data.battles
				? JSON.stringify(data.battles.map((b) => this.compressHeroTeam(b.attackers)))
				: null,
			opponentHeroes: data.battles
				? JSON.stringify(data.battles.map((b) => this.compressHeroTeam(b.defenders)))
				: null,
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		// Deduplication check (#44)
		if (this._isBattleDuplicate(battle)) {
			console.log('[OrganizedJihad] Skipping duplicate GrandArena battle');
			return;
		}

		await this.storage.add('battles', battle);
		// #51 — fixed param order, boolean→string, use IDB store
		await this.updateOpponentRecord('GrandArena', args.enemyUserId, battle.isWin, {
			name: data.response?.user?.name,
			power: data.response?.user?.power || battle.opponentPower,
		});

		// Live activity event
		await this._logActivity('battle', `Grand Arena ${battle.isWin ? 'WIN' : 'LOSS'} vs opponent #${battle.opponentId || '?'}`, { isWin: battle.isWin });

		// Track resource rewards from grand arena battle
		// Grand Arena rewards: gold, trophies, sometimes emeralds
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'grand_arena');
		}
		if (rewards.grandArenaTrophy) {
			await this.trackResourceTransaction(
				'grand_arena_trophies',
				rewards.grandArenaTrophy,
				'battle',
				'grand_arena'
			);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'grand_arena');
		}
	}

	/**
	 * Track Guild War information
	 *
	 * @param {Object} data - Guild war data
	 * @private
	 */
	async trackGuildWarInfo(data) {
		const warData = {
			warId: data.warId || data.war?.id,
			enemyGuildId: data.enemyClanId || data.enemyClan?.id,
			enemyGuildName: data.enemyClanName || data.enemyClan?.name,
			myGuildScore: data.myScore || 0,
			enemyScore: data.enemyScore || 0,
			defenders: data.defenders || {},
			attackers: data.attackers || {},
			timestamp: Date.now(),
		};

		await this.storage.setMetadata('currentGuildWar', warData);
	}

	/**
	 * Track Guild War battle results
	 *
	 * @param {Object} args - Battle request arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackGuildWarBattle(args, data) {
		const battleRecord = {
			type: 'guildWar',
			defenderId: args.defenderId,
			fortId: args.fortId,
			result: data.result?.win ? 'victory' : 'defeat',
			myTeam: data.attackers ? this.compressHeroTeam(data.attackers) : null,
			enemyTeam: data.defenders ? this.compressHeroTeam(data.defenders) : null,
			reward: data.reward || {},
			timestamp: Date.now(),
		};

		const guildWarHistory = await this.storage.getMetadata('guildWarBattleHistory', []);
		guildWarHistory.push(battleRecord);

		if (guildWarHistory.length > 500) {
			guildWarHistory.shift();
		}

		await this.storage.setMetadata('guildWarBattleHistory', guildWarHistory);

		// Live activity event
		const isWin = data.result?.win || false;
		await this._logActivity('battle', `Guild War ${isWin ? 'WIN' : 'LOSS'} at fort #${args.fortId || '?'}`, { isWin });

		// Track guild activity for guild war participation
		// Hero Wars guild wars are major guild events
		// See: https://community.hero-wars.com/discussion/guild-war-guide
		const guildData = await this.storage.getMetadata('guildData', {});
		await this.trackGuildActivity('war', {
			guildId: guildData.id || 'unknown',
			guildName: guildData.name || 'Unknown Guild',
			fortId: args.fortId,
			result: battleRecord.result,
			damage: data.damage || 0,
		});

		// Track resource rewards from guild war
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'guild_war');
		}
		if (rewards.guildWarToken) {
			await this.trackResourceTransaction('guild_war_coins', rewards.guildWarToken, 'battle', 'guild_war');
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'guild_war');
		}
	}

	/**
	 * Track Raid Boss information
	 *
	 * @param {Object} data - Raid boss data
	 * @private
	 */
	async trackRaidBossInfo(data) {
		const bossData = {
			bossId: data.bossId || data.boss?.id,
			bossLevel: data.bossLevel || data.boss?.level,
			bossHealth: data.bossHealth || data.boss?.health,
			maxHealth: data.maxHealth || data.boss?.maxHealth,
			myDamage: data.myDamage || 0,
			totalDamage: data.totalDamage || 0,
			timestamp: Date.now(),
		};

		await this.storage.setMetadata('currentRaidBoss', bossData);
	}

	/**
	 * Track Raid Boss attacks for damage analysis
	 *
	 * @param {Object} args - Attack request arguments
	 * @param {Object} data - Attack result data
	 * @private
	 */
	async trackRaidBossAttack(args, data) {
		const attackRecord = {
			bossId: args.bossId,
			damage: data.damage || 0,
			myTeam: data.attackers ? this.compressHeroTeam(data.attackers) : null,
			reward: data.reward || {},
			timestamp: Date.now(),
		};

		const raidHistory = await this.storage.getMetadata('raidBossAttackHistory', []);
		raidHistory.push(attackRecord);

		if (raidHistory.length > 500) {
			raidHistory.shift();
		}

		await this.storage.setMetadata('raidBossAttackHistory', raidHistory);

		// Track guild activity for raid boss attacks
		// Guild raids are cooperative PvE events
		// See: https://community.hero-wars.com/discussion/guild-raid-boss-guide
		const guildData = await this.storage.getMetadata('guildData', {});
		await this.trackGuildActivity('raid', {
			guildId: guildData.id || 'unknown',
			guildName: guildData.name || 'Unknown Guild',
			bossId: args.bossId,
			damage: data.damage || 0,
		});

		// Track resource rewards from raid boss
		const rewards = data.reward || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', 'guild_raid');
		}
		if (rewards.guildToken || rewards.clanToken) {
			await this.trackResourceTransaction(
				'guild_coins',
				rewards.guildToken || rewards.clanToken,
				'battle',
				'guild_raid'
			);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'battle', 'guild_raid');
		}
	}

	/**
	 * Track chest openings for drop rate analysis.
	 * Writes to both the `chests` IDB store AND metadata cache.
	 * Individual drops are recorded in `consumableRewards`.
	 * THIS IS KEY FOR UNDERSTANDING LOOT PROBABILITIES
	 *
	 * @param {Object} args - Chest opening arguments
	 * @param {Object} data - Chest rewards data
	 * @private
	 */
	async trackChestOpening(args, data) {
		await this.trackConsumableOpening(args, data, 'genericChest');
	}

	/**
	 * Unified handler for all consumable/chest opening types.
	 * Records the opening in the `chests` IDB store, extracts individual
	 * drops to `consumableRewards`, updates aggregated drop-rate metadata,
	 * and tracks known resource rewards as resource transactions.
	 *
	 * Supported sourceTypes:
	 *   genericChest, artifactChest, titanArtifactChest, petChest,
	 *   lootBox, towerChest, outlandChest
	 *
	 * @param {Object} args         - Request arguments (chestId, id, libId, amount, etc.)
	 * @param {Object} data         - Response data containing rewards
	 * @param {string} sourceType   - Consumable category key
	 * @private
	 */
	async trackConsumableOpening(args, data, sourceType) {
		const timestamp = Date.now();
		const sourceId = String(args.chestId || args.id || args.libId || 'unknown');
		const quantity = args.amount || 1;

		// Normalise the rewards from the varied game API formats
		const drops = this._normalizeRewards(data);

		// ── 1. Write to chests IDB store ────────────────────────────────
		const chestRecord = {
			chestType: sourceType,
			sourceId,
			quantity,
			dropCount: drops.length,
			timestamp,
		};

		let openingId = null;
		try {
			openingId = await this.storage.add('chests', chestRecord);
		} catch (err) {
			console.warn('[OrganizedJihad] Failed to write chest record:', err);
		}

		// ── 2. Write individual drops to consumableRewards ──────────────
		for (const drop of drops) {
			try {
				await this.storage.add('consumableRewards', {
					timestamp,
					sourceType,
					sourceId,
					itemType: drop.itemType,
					itemId: String(drop.itemId),
					quantity: drop.quantity,
					openingId: openingId || 0,
				});
			} catch (err) {
				console.warn('[OrganizedJihad] Failed to write drop record:', err);
			}
		}

		// ── 3. Mirror to metadata cache (for backward compat) ───────────
		try {
			const chestHistory = await this.storage.getMetadata('chestOpeningHistory', []);
			chestHistory.push({
				chestId: sourceId,
				chestType: sourceType,
				quantity,
				rewards: drops,
				timestamp,
			});
			if (chestHistory.length > 1000) chestHistory.shift();
			await this.storage.setMetadata('chestOpeningHistory', chestHistory);
		} catch { /* non-critical */ }

		// ── 4. Live activity event ──────────────────────────────────────
		const typeLabel = this._sourceTypeLabel(sourceType);
		await this._logActivity('chest', `${typeLabel} opened: ${sourceId} (${quantity}x, ${drops.length} drops)`);

		// ── 5. Update aggregated drop-rate statistics ────────────────────
		await this.updateChestDropRates({
			chestType: sourceType,
			chestId: sourceId,
			quantity,
			rewards: drops,
		});

		// ── 6. Track resource rewards as resource transactions ──────────
		const chestName = `${sourceType}_${sourceId}`;
		for (const drop of drops) {
			if (drop.itemType === 'gold') {
				await this.trackResourceTransaction('gold', drop.quantity, 'chest', chestName);
			} else if (drop.itemType === 'starmoney') {
				await this.trackResourceTransaction('emeralds', drop.quantity, 'chest', chestName);
			} else if (drop.itemType === 'coin') {
				// Coin subtypes: 3 = arena, 4 = outland, 5 = tower, 7 = skull
				const coinNames = { '3': 'arena_coins', '4': 'outland_coins', '5': 'tower_coins', '7': 'skull_coins' };
				const resName = coinNames[drop.itemId] || `coin_${drop.itemId}`;
				await this.trackResourceTransaction(resName, drop.quantity, 'chest', chestName);
			}
		}
	}

	/**
	 * Normalise game API reward data into a flat array of drop records.
	 *
	 * The game uses several reward formats depending on the API call:
	 *
	 * 1. **Category-keyed object** (most common):
	 *    `{ consumable: {45: 1}, gold: 500, gear: {123: 2} }`
	 *
	 * 2. **Array of category-keyed objects** (artifact/titan chests):
	 *    `[{consumable: {45: 1}}, {fragmentHero: {12: 50}}]`
	 *    Also used as `data.chestReward`, `data.reward`, `data.rewards`
	 *
	 * 3. **Nested count-keyed** (consumableUseLootBox):
	 *    `{ 500: { consumable: {362: 1}, gear: {55: 3} } }`
	 *    The outer key is the gold reward count.
	 *
	 * 4. **Tower chest** (towerOpenChest):
	 *    `{ skullReward: { coin: {7: 150} } }`
	 *
	 * Returns a flat array: `[{ itemType, itemId, quantity }, ...]`
	 *
	 * @param {Object} data - Raw response data
	 * @returns {Array<{itemType: string, itemId: string, quantity: number}>}
	 * @private
	 */
	_normalizeRewards(data) {
		if (!data || typeof data !== 'object') return [];

		const drops = [];

		// Determine where the rewards live in the response
		const sources = [];
		if (data.chestReward) sources.push(data.chestReward);
		if (data.reward) sources.push(data.reward);
		if (data.rewards) sources.push(data.rewards);
		if (data.skullReward) sources.push(data.skullReward);

		// If none of the known keys match, treat the whole response as rewards
		if (sources.length === 0) sources.push(data);

		for (const src of sources) {
			this._extractDrops(src, drops);
		}

		return drops;
	}

	/**
	 * Recursively extract drop records from a reward structure.
	 * Handles objects, arrays, and nested count-keyed formats.
	 *
	 * Known category keys: consumable, gear, coin, gold, starmoney,
	 * fragmentHero, fragmentTitan, petCard, titanCard, scroll,
	 * artifact, titanArtifact, skinStone, titanSkinStone
	 *
	 * @param {any} source - Reward data (object, array, or primitive)
	 * @param {Array} drops - Accumulator array
	 * @private
	 */
	_extractDrops(source, drops) {
		if (!source || typeof source !== 'object') return;

		// Array → extract each element
		if (Array.isArray(source)) {
			for (const item of source) {
				this._extractDrops(item, drops);
			}
			return;
		}

		// Known scalar resource keys (value is the quantity directly)
		const scalarKeys = new Set(['gold', 'starmoney', 'experience', 'stamina', 'titanExp']);

		// Known category keys (value is { itemId: quantity, ... })
		const categoryKeys = new Set([
			'consumable', 'gear', 'coin', 'fragmentHero', 'fragmentTitan',
			'petCard', 'titanCard', 'scroll', 'artifact', 'titanArtifact',
			'skinStone', 'titanSkinStone', 'heroSoulStone', 'titanSoulStone',
		]);

		let hasKnownKey = false;

		for (const [key, value] of Object.entries(source)) {
			if (scalarKeys.has(key) && typeof value === 'number') {
				drops.push({ itemType: key, itemId: key, quantity: value });
				hasKnownKey = true;
			} else if (categoryKeys.has(key) && typeof value === 'object' && value !== null) {
				hasKnownKey = true;
				for (const [itemId, qty] of Object.entries(value)) {
					drops.push({
						itemType: key,
						itemId: String(itemId),
						quantity: typeof qty === 'number' ? qty : 1,
					});
				}
			}
		}

		// If no known keys matched, this might be a count-keyed wrapper like
		// { 500: { consumable: {...} } } — recurse into numeric-keyed values.
		if (!hasKnownKey) {
			for (const [key, value] of Object.entries(source)) {
				if (typeof value === 'object' && value !== null && /^\d+$/.test(key)) {
					this._extractDrops(value, drops);
				}
			}
		}
	}

	/**
	 * Return a human-readable label for a consumable source type.
	 *
	 * @param {string} sourceType - Source type key
	 * @returns {string} Display label
	 * @private
	 */
	_sourceTypeLabel(sourceType) {
		const labels = {
			genericChest: 'Chest',
			artifactChest: 'Artifact Chest',
			titanArtifactChest: 'Titan Artifact Chest',
			petChest: 'Pet Chest',
			lootBox: 'Loot Box',
			towerChest: 'Tower Chest',
			outlandChest: 'Outland Chest',
		};
		return labels[sourceType] || sourceType;
	}

	/**
	 * Update aggregated chest drop rate statistics in metadata.
	 * Tracks per-chest-type open counts and per-item drop counts/totals.
	 *
	 * @param {Object} chestRecord - Record with chestType, chestId, quantity, rewards[]
	 * @private
	 */
	async updateChestDropRates(chestRecord) {
		const dropRates = await this.storage.getMetadata('chestDropRates', {});
		const chestKey = `${chestRecord.chestType}_${chestRecord.chestId}`;

		if (!dropRates[chestKey]) {
			dropRates[chestKey] = {
				chestType: chestRecord.chestType,
				chestId: chestRecord.chestId,
				openCount: 0,
				itemDrops: {},
			};
		}

		dropRates[chestKey].openCount += chestRecord.quantity;

		// Count each normalised drop
		if (Array.isArray(chestRecord.rewards)) {
			for (const drop of chestRecord.rewards) {
				const itemKey = `${drop.itemType}_${drop.itemId}`;
				if (!dropRates[chestKey].itemDrops[itemKey]) {
					dropRates[chestKey].itemDrops[itemKey] = {
						type: drop.itemType,
						id: drop.itemId,
						name: drop.itemName || itemKey,
						dropCount: 0,
						totalAmount: 0,
					};
				}
				dropRates[chestKey].itemDrops[itemKey].dropCount += 1;
				dropRates[chestKey].itemDrops[itemKey].totalAmount += drop.quantity || 1;
			}
		}

		await this.storage.setMetadata('chestDropRates', dropRates);
	}

	/**
	 * Track shop purchases for spending analysis
	 *
	 * @param {Object} args - Purchase arguments
	 * @param {Object} data - Purchase result data
	 * @private
	 */
	async trackShopPurchase(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const purchasedAt = new Date().toISOString();

		const purchase = {
			purchasedAt: purchasedAt,
			shopType: args.shopType || args.shopId || 'unknown', // arena, guild, tower, merchant, etc.
			itemId: args.itemId || 'unknown',
			itemName: data.itemName || args.itemName || `Item_${args.itemId}`,
			quantity: args.quantity || args.count || 1,
			costType: args.costType || Object.keys(args.cost || {})[0] || 'unknown', // gold, emeralds, trophies, etc.
			costAmount: args.costAmount || Object.values(args.cost || {})[0] || 0,
			playerId: playerId,
		};

		await this.storage.add('shopPurchases', purchase);
		console.log(`[OrganizedJihad] Shop purchase tracked: ${purchase.itemName} from ${purchase.shopType}`);

		// Track resource cost as negative transaction (spending)
		// Hero Wars shop costs can be gold, emeralds, arena coins, guild war coins, etc.
		// See: https://community.hero-wars.com/discussion/shop-currency-guide
		const cost = args.cost || {};
		const shopName = `${purchase.shopType}_shop`;

		if (cost.gold || (purchase.costType === 'gold' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction('gold', -(cost.gold || purchase.costAmount), 'shop', shopName);
		}
		if (cost.starmoney || (purchase.costType === 'emeralds' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction('emeralds', -(cost.starmoney || purchase.costAmount), 'shop', shopName);
		}
		if (cost.arenaToken || (purchase.costType === 'arena_coins' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction(
				'arena_coins',
				-(cost.arenaToken || purchase.costAmount),
				'shop',
				shopName
			);
		}
		if (cost.guildWarToken || (purchase.costType === 'guild_war_coins' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction(
				'guild_war_coins',
				-(cost.guildWarToken || purchase.costAmount),
				'shop',
				shopName
			);
		}
		if (cost.titanPotion || (purchase.costType === 'titan_potion' && purchase.costAmount > 0)) {
			await this.trackResourceTransaction(
				'titan_potion',
				-(cost.titanPotion || purchase.costAmount),
				'shop',
				shopName
			);
		}
	}

	/**
	 * Track quest completions
	 * Stores quest completion records in IndexedDB (matches C# QuestCompletion entity)
	 *
	 * Entity Structure (7 properties):
	 * - CompletedAt, QuestType (daily/weekly/event), QuestId, QuestName, RewardData (JSON), PlayerId
	 *
	 * @param {Object} args - Quest completion arguments
	 * @param {Object} data - Quest reward data
	 * @private
	 */
	async trackQuestComplete(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const completedAt = new Date().toISOString();

		const quest = {
			completedAt: completedAt,
			questType: args.questType || 'daily', // daily, weekly, event
			questId: args.questId || 'unknown',
			questName: args.questName || data.questName || `Quest_${args.questId}`,
			rewardData: JSON.stringify(data.reward || data.rewards || {}),
			playerId: playerId,
		};

		await this.storage.add('questCompletions', quest);
		console.log(`[OrganizedJihad] Quest completed: ${quest.questName} (${quest.questType})`);

		// Track resource rewards from quest completion
		// Hero Wars quest rewards format: {gold: 1000, starmoney: 50, exp: 100, ...}
		// See: https://community.hero-wars.com/discussion/quest-rewards-guide
		const rewards = data.reward || data.rewards || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'quest', quest.questName);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction('emeralds', rewards.starmoney, 'quest', quest.questName);
		}
		if (rewards.arenaToken) {
			await this.trackResourceTransaction('arena_coins', rewards.arenaToken, 'quest', quest.questName);
		}
		if (rewards.guildWarToken) {
			await this.trackResourceTransaction('guild_war_coins', rewards.guildWarToken, 'quest', quest.questName);
		}
		if (rewards.titanPotion) {
			await this.trackResourceTransaction('titan_potion', rewards.titanPotion, 'quest', quest.questName);
		}
	}

	/**
	 * Track expedition state
	 *
	 * @param {Object} data - Expedition data
	 * @private
	 */
	async trackExpeditionState(data) {
		const expeditionData = {
			currentNode: data.currentNode || 0,
			progress: data.progress || 0,
			rewards: data.rewards || [],
			timestamp: Date.now(),
		};

		await this.storage.setMetadata('expeditionState', expeditionData);
	}

	/**
	 * Track expedition battles (PvE boss fights)
	 * Stores expedition battle records in IndexedDB (matches C# ExpeditionBattle entity)
	 *
	 * Entity Structure (10 properties):
	 * - Timestamp, ExpeditionId, BossId, BossName, IsWin, TeamComposition (JSON),
	 *   DamageDealt, RewardData (JSON), PlayerId
	 *
	 * @param {Object} args - Battle arguments
	 * @param {Object} data - Battle result data
	 * @private
	 */
	async trackExpeditionBattle(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const battle = {
			timestamp: timestamp,
			expeditionId: args.expeditionId || args.nodeId || 'unknown',
			bossId: args.bossId || data.bossId || 'unknown',
			bossName: data.bossName || `Boss_${args.bossId}`,
			isWin: data.result?.win || data.win || false,
			teamComposition: JSON.stringify(data.attackers || data.myTeam || {}),
			damageDealt: data.damageDealt || data.damage || 0,
			rewardData: JSON.stringify(data.reward || data.rewards || {}),
			playerId: playerId,
		};

		await this.storage.add('expeditionBattles', battle);
		console.log(
			`[OrganizedJihad] Expedition battle tracked: ${battle.bossName} - ${battle.isWin ? 'Win' : 'Loss'}`
		);

		// Track resource rewards from expedition battles
		// Expeditions reward gold, items, and sometimes emeralds
		const rewards = data.reward || data.rewards || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', `expedition_${battle.expeditionId}`);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction(
				'emeralds',
				rewards.starmoney,
				'battle',
				`expedition_${battle.expeditionId}`
			);
		}
	}

	/**
	 * Track mission progress from missionEnd API call
	 * Stores/updates mission progress in IndexedDB (matches C# MissionProgress entity - MUTABLE)
	 *
	 * Entity Structure (9 properties):
	 * - MissionId (key), MissionName, Stars (0-3), HighestLevel, IsHeroic,
	 *   LastCompleted, CompletionCount, PlayerId
	 *
	 * @param {Object} args - Mission arguments
	 * @param {Object} data - Mission result data
	 * @private
	 */
	async trackMissionProgress(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const missionId = `${args.missionId || args.id}_${args.isHeroic ? 'heroic' : 'normal'}`;

		// Try to get existing progress
		let existing = null;
		try {
			existing = await this.storage.get('missionProgress', missionId);
		} catch (e) {
			// Doesn't exist yet
		}

		const newStars = data.stars || 0;
		const currentStars = existing?.stars || 0;

		const progress = {
			missionId: missionId,
			missionName: args.missionName || data.missionName || `Mission_${args.missionId}`,
			stars: Math.max(newStars, currentStars), // Keep highest stars
			highestLevel: args.level || existing?.highestLevel || 1,
			isHeroic: args.isHeroic || false,
			lastCompleted: new Date().toISOString(),
			completionCount: (existing?.completionCount || 0) + 1,
			playerId: playerId,
		};

		await this.storage.put('missionProgress', progress);
		console.log(`[OrganizedJihad] Mission progress updated: ${progress.missionName} - ${progress.stars} stars`);

		// Track resource rewards from mission completion
		// Campaign missions reward gold, experience, and sometimes items
		// See: https://community.hero-wars.com/discussion/campaign-rewards
		const rewards = data.reward || data.rewards || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', `mission_${progress.missionName}`);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction(
				'emeralds',
				rewards.starmoney,
				'battle',
				`mission_${progress.missionName}`
			);
		}
	}

	/**
	 * Track tower progress from towerEnd or tower state API calls
	 * Stores/updates tower progress in IndexedDB (matches C# TowerProgress entity - MUTABLE)
	 *
	 * Entity Structure (6 properties):
	 * - TowerType (key), HighestFloor, LastUpdate, FloorData (JSON), PlayerId
	 *
	 * @param {Object} args - Tower arguments
	 * @param {Object} data - Tower result data
	 * @private
	 */
	async trackTowerProgress(args, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const towerType = args.towerType || args.type || 'regular'; // regular, outland, guild

		// Try to get existing progress
		let existing = null;
		try {
			existing = await this.storage.get('towerProgress', towerType);
		} catch (e) {
			// Doesn't exist yet
		}

		const newFloor = data.floor || args.floor || 1;
		const currentFloor = existing?.highestFloor || 0;

		const progress = {
			towerType: towerType,
			highestFloor: Math.max(newFloor, currentFloor), // Keep highest floor reached
			lastUpdate: new Date().toISOString(),
			floorData: JSON.stringify(data.floorDetails || {}),
			playerId: playerId,
		};

		await this.storage.put('towerProgress', progress);
		console.log(`[OrganizedJihad] Tower progress updated: ${progress.towerType} - floor ${progress.highestFloor}`);

		// Track resource rewards from tower floor completion
		// Tower rewards vary by floor: gold, items, sometimes emeralds
		// See: https://community.hero-wars.com/discussion/tower-rewards
		const rewards = data.reward || data.rewards || {};
		if (rewards.gold) {
			await this.trackResourceTransaction('gold', rewards.gold, 'battle', `${towerType}_tower_floor_${newFloor}`);
		}
		if (rewards.starmoney) {
			await this.trackResourceTransaction(
				'emeralds',
				rewards.starmoney,
				'battle',
				`${towerType}_tower_floor_${newFloor}`
			);
		}
	}

	/**
	 * Track resource transactions (gold, emeralds, tokens, etc.)
	 * Stores resource change events in IndexedDB (matches C# ResourceTransaction entity)
	 *
	 * Entity Structure (7 properties):
	 * - Timestamp, ResourceType (gold/emeralds/tokens), Amount (+ gain, - loss),
	 *   Source (battle/shop/quest/chest), SourceDetail, PlayerId
	 *
	 * @param {string} resourceType - Type of resource changed
	 * @param {number} amount - Amount changed (positive = gain, negative = loss)
	 * @param {string} source - Source of change (battle/shop/quest/chest)
	 * @param {string} sourceDetail - Detailed source info
	 * @private
	 */
	async trackResourceTransaction(resourceType, amount, source, sourceDetail = '') {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const transaction = {
			timestamp: timestamp,
			resourceType: resourceType, // gold, emeralds, arena_coins, guild_war_coins, titan_potion, etc.
			amount: amount, // Positive for gains, negative for spending
			source: source, // battle, shop, quest, chest, levelup, etc.
			sourceDetail: sourceDetail, // Additional context
			playerId: playerId,
		};

		await this.storage.add('resourceTransactions', transaction);
		console.log(
			`[OrganizedJihad] Resource transaction: ${amount > 0 ? '+' : ''}${amount} ${resourceType} from ${source}`
		);
	}

	/**
	 * Track guild activities (donations, raids, wars, etc.)
	 * Stores guild activity records in IndexedDB (matches C# GuildActivity entity)
	 *
	 * Entity Structure (7 properties):
	 * - Timestamp, GuildId, GuildName, ActivityType (join/leave/donation/raid/war),
	 *   ActivityData (JSON), PlayerId
	 *
	 * @param {string} activityType - Type of guild activity
	 * @param {Object} data - Activity data
	 * @private
	 */
	async trackGuildActivity(activityType, data) {
		const playerId = (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
		const timestamp = new Date().toISOString();

		const activity = {
			timestamp: timestamp,
			guildId: data.guildId || 'unknown',
			guildName: data.guildName || `Guild_${data.guildId}`,
			activityType: activityType, // join, leave, donation, raid, war, chat, etc.
			activityData: JSON.stringify(data),
			playerId: playerId,
		};

		await this.storage.add('guildActivities', activity);
		console.log(`[OrganizedJihad] Guild activity tracked: ${activity.activityType} in ${activity.guildName}`);
	}

	/**
	 * Track pets data (metadata summary — called from petGetAll)
	 * NOTE: The earlier IDB-store version of this method is overridden by
	 * this definition (same method name, last-wins in ES6 classes).
	 *
	 * @param {Object} data - Pets data
	 * @private
	 */
	async trackPetsData(data) {
		const pets = Object.values(data).map((pet) => ({
			id: pet.id,
			level: pet.level || 0,
			stars: pet.star || 0,
			power: pet.power || 0,
		}));

		// ── Deduplication: skip if pet roster hasn't changed ─────────────
		const petFingerprint = this._computeDataFingerprint(
			pets.map((p) => [p.id, p.level, p.stars, p.power])
		);
		if (petFingerprint === this._lastPetHash) {
			return;
		}
		this._lastPetHash = petFingerprint;

		await this.storage.setMetadata('petsData', pets);
	}

	/**
	 * Update win/loss record against a specific opponent.
	 *
	 * Stores opponent intelligence in the dedicated `opponents` IDB object
	 * store (previously written to metadata which was incorrect — #51).
	 *
	 * Tracks per-battleType win/loss counts, overall totals, opponent name,
	 * and a bounded power-history array (last 50 observations).
	 *
	 * @param {string}  battleType - 'Arena', 'TitanArena', 'GrandArena', etc.
	 * @param {string}  opponentId - Opponent user ID
	 * @param {boolean} isWin      - true for victory, false for defeat
	 * @param {Object}  [extra]    - Optional extra data { name, power }
	 * @private
	 */
	async updateOpponentRecord(battleType, opponentId, isWin, extra = {}) {
		if (!opponentId) {
			return; // no opponent to track
		}

		const opponentIdStr = String(opponentId);

		// Read existing record from IDB opponents store (or create new)
		let record;
		try {
			record = await this.storage.get('opponents', opponentIdStr);
		} catch {
			record = null;
		}

		if (!record) {
			record = {
				opponentId: opponentIdStr,
				opponentName: extra.name || null,
				totalWins: 0,
				totalLosses: 0,
				battleTypes: {},
				powerHistory: [],
				firstSeen: Date.now(),
				lastSeen: Date.now(),
			};
		}

		// Update name if provided
		if (extra.name) {
			record.opponentName = extra.name;
		}

		// Update per-battleType stats
		if (!record.battleTypes[battleType]) {
			record.battleTypes[battleType] = { wins: 0, losses: 0 };
		}
		if (isWin) {
			record.battleTypes[battleType].wins++;
			record.totalWins++;
		} else {
			record.battleTypes[battleType].losses++;
			record.totalLosses++;
		}

		// Track power history (bounded to last 50 observations)
		if (extra.power && extra.power > 0) {
			record.powerHistory.push({
				power: extra.power,
				timestamp: Date.now(),
				battleType,
			});
			// Keep only last 50 entries
			if (record.powerHistory.length > 50) {
				record.powerHistory = record.powerHistory.slice(-50);
			}
		}

		record.lastSeen = Date.now();

		// Upsert to IDB opponents store
		await this.storage.put('opponents', record);
	}

	/**
	 * Calculate total team power
	 *
	 * @param {Object} team - Team object with heroes
	 * @returns {number} Total power
	 * @private
	 */
	calculateTeamPower(team) {
		if (!team) return 0;
		return Object.values(team).reduce((sum, hero) => sum + (hero.power || 0), 0);
	}

	/**
	 * Compress hero team data for storage efficiency
	 * Based on Hero Wars Assistant's compression algorithm
	 *
	 * @param {Object} team - Team object with heroes
	 * @returns {Array} Compressed team data
	 * @private
	 */
	compressHeroTeam(team) {
		if (!team) return [];
		return Object.values(team).map((hero) => [
			hero.id,
			hero.level || 0,
			hero.star || 0,
			hero.color || 0,
			hero.power || 0,
		]);
	}

	/**
	 * Compress battle replay data
	 *
	 * @param {Object} replay - Full replay data
	 * @returns {Object} Compressed replay
	 * @private
	 */
	compressReplay(replay) {
		return {
			result: replay.result,
			attackers: this.compressHeroTeam(replay.attackers),
			defenders: this.compressHeroTeam(replay.defenders),
			// Omit full battle progress to save space
		};
	}

	// =====================================================================
	// Battle Fingerprinting & Deduplication (#44)
	// =====================================================================

	/**
	 * Generate a stable fingerprint for a battle record to prevent duplicates.
	 *
	 * The fingerprint is built from: battleType + opponentId + timestamp (rounded
	 * to the nearest 10 seconds) + isWin. This catches replays viewed multiple
	 * times while still allowing legitimately distinct battles.
	 *
	 * @param {Object} battle - Battle record with battleType, opponentId, timestamp, isWin
	 * @returns {string} A fingerprint string
	 * @private
	 */
	_battleFingerprint(battle) {
		// Round timestamp to 10-second window to catch replays of the same battle
		const ts = typeof battle.timestamp === 'string'
			? new Date(battle.timestamp).getTime()
			: (battle.timestamp || 0);
		const bucket = Math.floor(ts / 10000);
		return `${battle.battleType || battle.type || '?'}|${battle.opponentId || battle.defenderId || '?'}|${bucket}|${battle.isWin ?? battle.result ?? '?'}`;
	}

	/**
	 * Check whether a battle record is a duplicate and, if not, record its
	 * fingerprint so future duplicates are caught.
	 *
	 * Fingerprints are stored in a bounded Set (max 2000) on `this._battleFingerprintSet`.
	 *
	 * @param {Object} battle - Battle record
	 * @returns {boolean} `true` if the battle is a duplicate
	 * @private
	 */
	_isBattleDuplicate(battle) {
		if (!this._battleFingerprintSet) {
			/** @type {Set<string>} */
			this._battleFingerprintSet = new Set();
		}
		const fp = this._battleFingerprint(battle);
		if (this._battleFingerprintSet.has(fp)) {
			return true;
		}
		this._battleFingerprintSet.add(fp);
		// Cap the set so it doesn't grow unbounded
		if (this._battleFingerprintSet.size > 2000) {
			const first = this._battleFingerprintSet.values().next().value;
			this._battleFingerprintSet.delete(first);
		}
		return false;
	}

	// =====================================================================
	// Replay Tracking (#42, #41)
	// =====================================================================

	/**
	 * Track an arena or grand arena battle replay.
	 *
	 * API methods: arenaGetReplay, grandGetReplay
	 *
	 * Stores a compressed copy of the replay in the `battles` IndexedDB store
	 * with `battleType` set to `'ArenaReplay'` / `'GrandArenaReplay'`.
	 * Dedup via `_isBattleDuplicate`.
	 *
	 * @param {string} callName - 'arenaGetReplay' or 'grandGetReplay'
	 * @param {Object} args - Request arguments (may contain battleId, opponentId, etc.)
	 * @param {Object} data - Replay response data (result, attackers, defenders, battles, etc.)
	 * @private
	 */
	async trackArenaReplay(callName, args, data) {
		const isGrand = callName.startsWith('grand');
		const battleType = isGrand ? 'GrandArenaReplay' : 'ArenaReplay';

		// Grand Arena replays may have multiple rounds in `data.battles`
		const rounds = isGrand && Array.isArray(data.battles)
			? data.battles
			: [data];

		for (const round of rounds) {
			const battle = {
				battleType,
				opponentId: args.enemyUserId || args.opponentId || args.userId || null,
				opponentName: null,
				isWin: round.result?.win ?? data.result?.win ?? false,
				playerPower: round.attackers ? this.calculateTeamPower(round.attackers) : 0,
				opponentPower: round.defenders ? this.calculateTeamPower(round.defenders) : 0,
				playerHeroes: round.attackers ? JSON.stringify(this.compressHeroTeam(round.attackers)) : null,
				opponentHeroes: round.defenders ? JSON.stringify(this.compressHeroTeam(round.defenders)) : null,
				replayData: JSON.stringify(this.compressReplay(round)),
				rewards: data.reward ? JSON.stringify(data.reward) : null,
				timestamp: new Date().toISOString(),
			};

			if (this._isBattleDuplicate(battle)) {
				console.log(`[OrganizedJihad] Skipping duplicate ${battleType} replay`);
				continue;
			}

			await this.storage.add('battles', battle);
		}

		console.log(`[OrganizedJihad] ${battleType} tracked from ${callName}`);
	}

	/**
	 * Track an adventure (campaign / expedition boss) battle replay.
	 *
	 * API methods: adventureGetReplay, bossGetReplay
	 *
	 * @param {string} callName - 'adventureGetReplay' or 'bossGetReplay'
	 * @param {Object} args - Request arguments (missionId, bossId, etc.)
	 * @param {Object} data - Replay response data
	 * @private
	 */
	async trackAdventureReplay(callName, args, data) {
		const battleType = callName === 'bossGetReplay' ? 'BossReplay' : 'AdventureReplay';

		const battle = {
			battleType,
			opponentId: args.missionId || args.bossId || args.id || null,
			opponentName: null,
			isWin: data.result?.win ?? false,
			playerPower: data.attackers ? this.calculateTeamPower(data.attackers) : 0,
			opponentPower: data.defenders ? this.calculateTeamPower(data.defenders) : 0,
			playerHeroes: data.attackers ? JSON.stringify(this.compressHeroTeam(data.attackers)) : null,
			opponentHeroes: data.defenders ? JSON.stringify(this.compressHeroTeam(data.defenders)) : null,
			replayData: JSON.stringify(this.compressReplay(data)),
			rewards: data.reward ? JSON.stringify(data.reward) : null,
			timestamp: new Date().toISOString(),
		};

		if (this._isBattleDuplicate(battle)) {
			console.log(`[OrganizedJihad] Skipping duplicate ${battleType} replay`);
			return;
		}

		await this.storage.add('battles', battle);
		console.log(`[OrganizedJihad] ${battleType} tracked from ${callName}`);
	}

	// =====================================================================
	// Cross-Server War Tracking (#40)
	// =====================================================================

	/**
	 * Track cross-server (CoW) war battle results.
	 *
	 * API method: clanWarGetBattleResults
	 *
	 * Cross-server wars use a different API surface from regular guild wars.
	 * Results are stored in the `battles` store with `battleType: 'CrossServerWar'`.
	 *
	 * @param {Object} args - Request arguments
	 * @param {Object} data - Battle results response (may contain multiple battles)
	 * @private
	 */
	async trackCrossServerWarResults(args, data) {
		const battles = Array.isArray(data.battles) ? data.battles : (data.results || [data]);

		for (const result of battles) {
			const battle = {
				battleType: 'CrossServerWar',
				opponentId: result.defenderId || result.opponentId || args.defenderId || null,
				opponentName: result.defenderName || null,
				isWin: result.result?.win ?? result.win ?? false,
				playerPower: result.attackers ? this.calculateTeamPower(result.attackers) : 0,
				opponentPower: result.defenders ? this.calculateTeamPower(result.defenders) : 0,
				playerHeroes: result.attackers ? JSON.stringify(this.compressHeroTeam(result.attackers)) : null,
				opponentHeroes: result.defenders ? JSON.stringify(this.compressHeroTeam(result.defenders)) : null,
				rewards: result.reward ? JSON.stringify(result.reward) : null,
				fortId: result.fortId || args.fortId || null,
				warId: result.warId || args.warId || null,
				timestamp: new Date().toISOString(),
			};

			if (this._isBattleDuplicate(battle)) {
				console.log('[OrganizedJihad] Skipping duplicate CrossServerWar battle');
				continue;
			}

			await this.storage.add('battles', battle);
		}

		await this._logActivity('battle', `Cross-server war results tracked (${battles.length} battle(s))`);
		console.log(`[OrganizedJihad] Cross-server war: ${battles.length} battle result(s) tracked`);
	}

	/**
	 * Track cross-server war state / matchup info.
	 *
	 * API method: clanWarGetInfo (when cross-server context detected)
	 *
	 * Note: The regular clanWarGetInfo handler already processes guild war info.
	 * This method specifically handles cross-server war metadata when the
	 * response contains cross-server markers.
	 *
	 * @param {Object} data - War info response
	 * @private
	 */
	async trackCrossServerWarInfo(data) {
		const warData = {
			warId: data.warId || data.id,
			isCrossServer: true,
			enemyGuildId: data.enemy?.id || data.enemyClanId,
			enemyGuildName: data.enemy?.name || data.enemyClanName || 'Unknown',
			enemyServer: data.enemy?.serverId || data.enemyServerId || null,
			myScore: data.myScore ?? data.score ?? 0,
			enemyScore: data.enemyScore ?? data.enemy?.score ?? 0,
			state: data.state || data.phase,
			timestamp: Date.now(),
		};

		await this.storage.setMetadata('currentCrossServerWar', warData);
		console.log(`[OrganizedJihad] Cross-server war info tracked: vs ${warData.enemyGuildName} (server ${warData.enemyServer || '?'})`);
	}

	/**
	 * Track quests from questGetAll API call
	 *
	 * @param {Array} data - Array of quest objects
	 * @private
	 */
	async trackQuestsData(data) {
		const quests = data.map((quest) => ({
			id: quest.id,
			state: quest.state, // 0=locked, 1=available, 2=ready to collect
			progress: quest.progress || 0,
			lastUpdate: Date.now(),
		}));

		await this.storage.setMetadata('questsData', quests);
	}

	/**
	 * Track guild data from clanGetInfo API call
	 *
	 * @param {Object} data - Response from clanGetInfo
	 * @private
	 */
	async trackGuildData(data) {
		const oldGuildData = await this.storage.getMetadata('guildData', {});

		const guildData = {
			id: data.clan?.id || null,
			name: data.clan?.name || 'No Guild',
			level: data.clan?.level || 0,
			members: Object.keys(data.clan?.members || {}).length,
			lastUpdate: Date.now(),
		};

		await this.storage.setMetadata('guildData', guildData);

		// Track guild join/leave events by detecting guild ID changes
		// Hero Wars allows players to leave and join guilds
		// See: https://community.hero-wars.com/discussion/guild-management
		if (oldGuildData.id !== guildData.id) {
			if (guildData.id && !oldGuildData.id) {
				// Joined a guild
				await this.trackGuildActivity('join', {
					guildId: guildData.id,
					guildName: guildData.name,
					guildLevel: guildData.level,
					memberCount: guildData.members,
				});
			} else if (!guildData.id && oldGuildData.id) {
				// Left a guild
				await this.trackGuildActivity('leave', {
					guildId: oldGuildData.id,
					guildName: oldGuildData.name,
				});
			} else if (guildData.id && oldGuildData.id) {
				// Changed guilds (leave old, join new)
				await this.trackGuildActivity('leave', {
					guildId: oldGuildData.id,
					guildName: oldGuildData.name,
				});
				await this.trackGuildActivity('join', {
					guildId: guildData.id,
					guildName: guildData.name,
					guildLevel: guildData.level,
					memberCount: guildData.members,
				});
			}
		}
	}

	/**
	 * Track chat messages from guild, private, adventure, and AoC chats
	 * Captures incoming messages from chatGetDialog and chatGetNewMessages API calls
	 *
	 * Hero Wars chat system supports:
	 * - Guild chat: Communication within guild
	 * - Private messages: 1-on-1 conversations
	 * - Adventure chat: Party communication during dungeon/adventure runs
	 * - AoC (Altar of Chaos) chat: Team communication during AoC battles
	 *
	 * Reference: https://hw-mobile.fandom.com/wiki/Chat
	 *
	 * @param {Object} args - Original API call arguments (contains chat type, conversation ID)
	 * @param {Object} data - Response data containing message array
	 * @param {string} callName - API method name (chatGetDialog or chatGetNewMessages)
	 * @private
	 */
	async trackChatMessages(args, data, callName) {
		try {
			// Extract chat type from args
			// chatType can be: 'guild', 'private', 'adventure', 'aoc'
			const chatType = args.type || args.chatType || 'unknown';
			const conversationId = String(args.dialogId || args.conversationId || args.chatId || '');

			// Get current player ID for determining message direction
			const playerData = await this.storage.getMetadata('playerData', {});
			const currentPlayerId = playerData.player?.id || 0;

			// Get guild data for guild name context
			const guildData = await this.storage.getMetadata('guildData', {});

			// Extract messages array
			// Hero Wars chat API typically returns { messages: [...], users: {...} }
			const messages = data.messages || data.messageList || [];
			const users = data.users || {}; // User info lookup table

			// Process each message
			for (const msg of messages) {
				// Skip if message already tracked (use server message ID to detect duplicates)
				const serverId = String(msg.id || msg.messageId || '');
				if (!serverId) continue;

				// Determine if message is outgoing (sent by player) or incoming
				const senderId = msg.senderId || msg.fromUserId || msg.userId || 0;
				const isOutgoing = senderId === currentPlayerId;

				// Get sender info from users lookup or message data
				const senderInfo = users[senderId] || msg.sender || {};
				const senderName = senderInfo.name || msg.senderName || 'Unknown';

				// Get recipient info (for private messages)
				const recipientId = msg.recipientId || msg.toUserId || null;
				const recipientInfo = recipientId ? users[recipientId] || {} : null;
				const recipientName = recipientInfo?.name || msg.recipientName || null;

				// Extract message text and metadata
				const messageText = msg.text || msg.message || msg.content || '';
				const messageMetadata = {
					hasAttachment: msg.hasAttachment || false,
					itemLinks: msg.itemLinks || [],
					mentions: msg.mentions || [],
					reactions: msg.reactions || [],
					edited: msg.edited || false,
					editedAt: msg.editedAt || null,
				};

				// Build chat message record
				// Matches ChatMessage entity model in database
				const chatMessage = {
					timestamp: new Date(msg.timestamp || msg.time || Date.now()),
					chatType: chatType,
					conversationId: conversationId,
					senderId: senderId,
					senderName: senderName,
					recipientId: recipientId,
					recipientName: recipientName,
					messageText: messageText,
					messageMetadata: JSON.stringify(messageMetadata),
					isOutgoing: isOutgoing,
					guildName: chatType === 'guild' ? guildData.name : null,
					partyName: chatType === 'adventure' || chatType === 'aoc' ? args.partyName || null : null,
					serverMessageId: serverId,
					playerLevel: playerData.player?.level || null,
				};

				// Store in IndexedDB
				// Use 'chatMessages' store (matches existing pattern for other tracking)
				await this.storage.add('chatMessages', chatMessage);

				console.log(`[OrganizedJihad] Tracked ${chatType} chat message from ${senderName}`);
			}

			// Update chat activity summary for the day
			await this.updateChatActivitySummary(chatType, conversationId, messages.length, currentPlayerId);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking chat messages:', error);
		}
	}

	/**
	 * Track outgoing messages sent by the player
	 * Captures messages from chatSendMessage API call
	 *
	 * @param {Object} args - API call arguments (contains message data)
	 * @param {Object} data - Response data (may contain message ID from server)
	 * @private
	 */
	async trackOutgoingMessage(args, data) {
		try {
			// Extract message details from args
			const chatType = args.type || args.chatType || 'unknown';
			const conversationId = String(args.dialogId || args.conversationId || args.chatId || '');
			const messageText = args.text || args.message || '';

			// Get player data
			const playerData = await this.storage.getMetadata('playerData', {});
			const playerId = playerData.player?.id || 0;
			const playerName = playerData.player?.name || 'Unknown';

			// Get guild data for context
			const guildData = await this.storage.getMetadata('guildData', {});

			// Build outgoing message record
			// Note: Server message ID comes from response data
			const serverId = String(data.messageId || data.id || Date.now());

			const chatMessage = {
				timestamp: new Date(),
				chatType: chatType,
				conversationId: conversationId,
				senderId: playerId,
				senderName: playerName,
				recipientId: args.recipientId || null,
				recipientName: args.recipientName || null,
				messageText: messageText,
				messageMetadata: JSON.stringify({
					hasAttachment: false,
					itemLinks: args.itemLinks || [],
					mentions: args.mentions || [],
				}),
				isOutgoing: true, // Always true for chatSendMessage
				guildName: chatType === 'guild' ? guildData.name : null,
				partyName: chatType === 'adventure' || chatType === 'aoc' ? args.partyName || null : null,
				serverMessageId: serverId,
				playerLevel: playerData.player?.level || null,
			};

			// Store in IndexedDB
			await this.storage.add('chatMessages', chatMessage);

			console.log(`[OrganizedJihad] Tracked outgoing ${chatType} chat message`);

			// Update activity summary
			await this.updateChatActivitySummary(chatType, conversationId, 1, playerId);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking outgoing message:', error);
		}
	}

	/**
	 * Update daily chat activity summary statistics
	 * Aggregates message counts by chat type and date
	 *
	 * @param {string} chatType - Type of chat (guild, private, adventure, aoc)
	 * @param {string} conversationId - Conversation/chat identifier
	 * @param {number} messageCount - Number of messages in this batch
	 * @param {number} currentPlayerId - Current player's user ID
	 * @private
	 */
	async updateChatActivitySummary(chatType, conversationId, messageCount, currentPlayerId) {
		try {
			// Get today's date (YYYY-MM-DD format)
			const today = new Date().toISOString().split('T')[0];

			// Retrieve existing summary or create new one
			const summaryKey = `chatActivity_${chatType}_${today}`;
			const existingSummary = await this.storage.getMetadata(summaryKey, null);

			// Get messages to count sent vs received
			const todayStart = new Date(today).getTime();
			const todayEnd = todayStart + 86400000; // +24 hours

			// Query messages for today (simplified - in real implementation would use IndexedDB query)
			// For now, just increment counts based on message batch
			const messagesSent = existingSummary?.messagesSent || 0;
			const messagesReceived = existingSummary?.messagesReceived || 0;

			const summary = {
				summaryDate: new Date(today),
				chatType: chatType,
				messagesSent: messagesSent + messageCount, // Approximate, improve with actual query
				messagesReceived: messagesReceived,
				uniqueContacts: existingSummary?.uniqueContacts || 1,
				conversationId: conversationId,
				groupName: existingSummary?.groupName || null,
			};

			await this.storage.setMetadata(summaryKey, summary);
		} catch (error) {
			console.error('[OrganizedJihad] Error updating chat activity summary:', error);
		}
	}

	/**
	 * Track guild members roster and statistics
	 * Captures member list, levels, power, contribution, activity status
	 *
	 * Hero Wars clanGetInfo API returns full guild roster with member details:
	 * - Member list with IDs, names, levels, team power
	 * - Guild ranks (leader, officer, member)
	 * - Contribution points (titanite donations, activity)
	 * - Last online timestamps
	 * - Arena/Grand Arena/Titan Arena ranks
	 * - Prestige points
	 *
	 * Reference: https://hw-mobile.fandom.com/wiki/Guild
	 *
	 * @param {Object} data - Response from clanGetInfo API
	 * @private
	 */
	async trackGuildMembers(data) {
		try {
			if (!data.clan || !data.clan.members) {
				console.warn('[OrganizedJihad] No guild member data found in clanGetInfo');
				return;
			}

			const guildId = data.clan.id || 0;
			const guildName = data.clan.name || 'Unknown Guild';
			const members = data.clan.members || {};

			// Get current player ID to identify self
			const playerData = await this.storage.getMetadata('playerData', {});
			const currentPlayerId = playerData.player?.id || 0;

			// Track each guild member
			for (const [memberId, memberInfo] of Object.entries(members)) {
				// Skip tracking self (already tracked in playerData)
				if (parseInt(memberId) === currentPlayerId) continue;

				// Build guild member record
				// Matches GuildMember entity model in database
				const guildMember = {
					guildId: guildId,
					guildName: guildName,
					playerId: parseInt(memberId),
					playerName: memberInfo.name || 'Unknown',
					level: memberInfo.level || 0,
					teamPower: memberInfo.power || memberInfo.teamPower || 0,
					guildRank: memberInfo.rank || memberInfo.role || 'member',
					vipLevel: memberInfo.vipLevel || null,
					lastOnline: new Date(memberInfo.lastOnlineTime || Date.now()),
					isOnline: memberInfo.isOnline || false,
					joinedAt: memberInfo.joinedAt ? new Date(memberInfo.joinedAt) : null,
					currentContribution: memberInfo.contribution || memberInfo.weeklyContribution || 0,
					totalContribution: memberInfo.totalContribution || memberInfo.lifetimeContribution || 0,
					arenaRank: memberInfo.arenaRank || null,
					grandArenaRank: memberInfo.grandArenaRank || null,
					titanArenaRank: memberInfo.titanArenaRank || null,
					prestige: memberInfo.prestige || 0,
					isActive: true,
					heroRoster: memberInfo.heroes ? JSON.stringify(memberInfo.heroes) : null,
					titanRoster: memberInfo.titans ? JSON.stringify(memberInfo.titans) : null,
				};

				// Store/update in IndexedDB
				// Use 'guildMembers' store (upsert by playerId)
				await this.storage.put('guildMembers', guildMember);

				// Create historical snapshot for trend tracking
				const snapshot = {
					timestamp: new Date(),
					playerId: guildMember.playerId,
					playerName: guildMember.playerName,
					guildId: guildId,
					level: guildMember.level,
					teamPower: guildMember.teamPower,
					guildRank: guildMember.guildRank,
					contribution: guildMember.currentContribution,
					totalContribution: guildMember.totalContribution,
					prestige: guildMember.prestige,
					isOnline: guildMember.isOnline,
					lastOnline: guildMember.lastOnline,
				};

				await this.storage.add('guildMemberSnapshots', snapshot);
			}

			console.log(`[OrganizedJihad] Tracked ${Object.keys(members).length} guild members from ${guildName}`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking guild members:', error);
		}
	}

	/**
	 * Track Guild War participation for all members
	 * Captures attack counts, damage dealt, fort defense stats
	 *
	 * @param {Object} data - Response from clanWarGetInfo/clanWarUserGetInfo API
	 * @private
	 */
	async trackGuildWarParticipation(data) {
		try {
			if (!data.war || !data.war.participants) {
				console.warn('[OrganizedJihad] No guild war participation data found');
				return;
			}

			const warId = data.war.id || data.war.warId || String(Date.now());
			const warDate = new Date(data.war.startTime || data.war.date || Date.now());
			const guildId = data.clan?.id || await this.getStoredGuildId();
			const participants = data.war.participants || {};

			// Track each member's participation
			for (const [memberId, participantInfo] of Object.entries(participants)) {
				const participation = {
					warId: warId,
					warDate: warDate,
					playerId: parseInt(memberId),
					playerName: participantInfo.name || 'Unknown',
					guildId: guildId,
					attacksMade: participantInfo.attacks || participantInfo.attackCount || 0,
					maxAttacks: participantInfo.maxAttacks || data.war.maxAttacks || 3,
					totalDamage: participantInfo.damage || participantInfo.totalDamage || 0,
					fortsDefended: participantInfo.fortsDefended || 0,
					defensePoints: participantInfo.defensePoints || 0,
					participated: (participantInfo.attacks || 0) > 0,
					warResult: data.war.result || null,
					attackDetails: participantInfo.attackLog ? JSON.stringify(participantInfo.attackLog) : null,
				};

				await this.storage.add('guildWarParticipations', participation);
			}

			console.log(`[OrganizedJihad] Tracked Guild War participation for ${Object.keys(participants).length} members`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking guild war participation:', error);
		}
	}

	/**
	 * Track Guild Raid (Boss Raid) participation for all members
	 * Captures boss/minion damage, titanite earned, attack counts
	 *
	 * Reference: https://hw-mobile.fandom.com/wiki/Guild_Raid
	 *
	 * @param {Object} data - Response from bossRaidGetInfo API
	 * @private
	 */
	async trackGuildRaidParticipation(data) {
		try {
			if (!data.raid || !data.raid.participants) {
				console.warn('[OrganizedJihad] No guild raid participation data found');
				return;
			}

			const raidId = data.raid.id || data.raid.raidId || String(Date.now());
			const raidDate = new Date(data.raid.startTime || data.raid.date || Date.now());
			const guildId = data.clan?.id || await this.getStoredGuildId();
			const bossName = data.raid.bossName || data.raid.bossType || 'unknown';
			const bossLevel = data.raid.bossLevel || data.raid.difficulty || 0;
			const participants = data.raid.participants || {};

			// Track each member's raid performance
			for (const [memberId, participantInfo] of Object.entries(participants)) {
				// Calculate total damage (boss + minions)
				const bossDamage = participantInfo.bossDamage || 0;
				const minionDamage = participantInfo.minionDamage || participantInfo.supportDamage || 0;
				const totalDamage = bossDamage + minionDamage;

				const participation = {
					raidId: raidId,
					raidDate: raidDate,
					playerId: parseInt(memberId),
					playerName: participantInfo.name || 'Unknown',
					guildId: guildId,
					bossName: bossName,
					bossLevel: bossLevel,
					bossDamage: bossDamage,
					minionDamage: minionDamage,
					totalDamage: totalDamage,
					attacksMade: participantInfo.attacks || participantInfo.attackCount || 0,
					maxAttacks: participantInfo.maxAttacks || data.raid.maxAttacks || 3,
					participated: totalDamage > 0,
					titaniteEarned: participantInfo.titaniteEarned || participantInfo.reward?.titanite || 0,
					guildRank: data.raid.guildRank || null,
					attackDetails: participantInfo.attackLog ? JSON.stringify(participantInfo.attackLog) : null,
				};

				await this.storage.add('guildRaidParticipations', participation);

				// Track titanite earnings as transaction
				if (participation.titaniteEarned > 0) {
					await this.trackTitaniteTransaction(
						participation.playerId,
						participation.playerName,
						guildId,
						'earned',
						participation.titaniteEarned,
						'raid',
						`${bossName} Level ${bossLevel}`
					);
				}
			}

			console.log(`[OrganizedJihad] Tracked Guild Raid participation for ${Object.keys(participants).length} members`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking guild raid participation:', error);
		}
	}

	/**
	 * Track Guild Dungeon (Titan Dungeon) participation
	 * Captures titan charges used, damage dealt, stages completed
	 *
	 * @param {Object} data - Response from dungeonGetState/titanDungeonGetInfo API
	 * @private
	 */
	async trackGuildDungeonParticipation(data) {
		try {
			if (!data.dungeon || !data.dungeon.participants) {
				console.warn('[OrganizedJihad] No guild dungeon participation data found');
				return;
			}

			const dungeonId = data.dungeon.id || data.dungeon.dungeonId || String(Date.now());
			const dungeonDate = new Date(data.dungeon.startTime || data.dungeon.date || Date.now());
			const guildId = data.clan?.id || await this.getStoredGuildId();
			const dungeonType = data.dungeon.type || data.dungeon.dungeonType || 'unknown';
			const participants = data.dungeon.participants || {};

			// Track each member's dungeon progress
			for (const [memberId, participantInfo] of Object.entries(participants)) {
				const participation = {
					dungeonId: dungeonId,
					dungeonDate: dungeonDate,
					playerId: parseInt(memberId),
					playerName: participantInfo.name || 'Unknown',
					guildId: guildId,
					dungeonType: dungeonType,
					titanChargesUsed: participantInfo.chargesUsed || participantInfo.titanCharges || 0,
					maxTitanCharges: participantInfo.maxCharges || data.dungeon.maxCharges || 6,
					battlesFought: participantInfo.battles || participantInfo.battleCount || 0,
					totalDamage: participantInfo.damage || participantInfo.totalDamage || 0,
					highestStage: participantInfo.stage || participantInfo.maxStage || 0,
					participated: (participantInfo.chargesUsed || 0) > 0,
					titaniteEarned: participantInfo.titaniteEarned || participantInfo.reward?.titanite || 0,
					titanTeam: participantInfo.titanTeam ? JSON.stringify(participantInfo.titanTeam) : null,
				};

				await this.storage.add('guildDungeonParticipations', participation);

				// Track titanite earnings as transaction
				if (participation.titaniteEarned > 0) {
					await this.trackTitaniteTransaction(
						participation.playerId,
						participation.playerName,
						guildId,
						'earned',
						participation.titaniteEarned,
						'dungeon',
						`${dungeonType} Stage ${participation.highestStage}`
					);
				}
			}

			console.log(`[OrganizedJihad] Tracked Guild Dungeon participation for ${Object.keys(participants).length} members`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking guild dungeon participation:', error);
		}
	}

	/**
	 * Track titanite transaction (donation, earning, spending)
	 * Monitors guild currency flow for economic analysis
	 *
	 * @param {number} playerId - Player ID
	 * @param {string} playerName - Player name
	 * @param {number} guildId - Guild ID
	 * @param {string} transactionType - "donation", "earned", "spent"
	 * @param {number} amount - Amount (positive for gain, negative for spending)
	 * @param {string} source - Source/reason for transaction
	 * @param {string} description - Optional purchase/activity description
	 * @private
	 */
	async trackTitaniteTransaction(playerId, playerName, guildId, transactionType, amount, source, description = null) {
		try {
			const transaction = {
				timestamp: new Date(),
				playerId: playerId,
				playerName: playerName,
				guildId: guildId,
				transactionType: transactionType,
				amount: amount,
				source: source,
				purchaseDescription: description,
				balanceAfter: null, // Could be calculated if we track running balance
			};

			await this.storage.add('titaniteTransactions', transaction);

			console.log(`[OrganizedJihad] Tracked titanite ${transactionType}: ${amount} from ${source}`);
		} catch (error) {
			console.error('[OrganizedJihad] Error tracking titanite transaction:', error);
		}
	}

	/**
	 * Helper: Get stored guild ID from storage
	 * @returns {Promise<number>} Guild ID
	 * @private
	 */
	async getStoredGuildId() {
		const guildData = await this.storage.getMetadata('guildData', {});
		return guildData.id || 0;
	}

	/**
	 * Debounced snapshot trigger (#28).
	 *
	 * Called after every processAPIResponse dispatch cycle. Instead of
	 * writing the snapshot immediately, starts (or restarts) a 5-second
	 * timer. When the timer fires, `updateSnapshot()` is called once.
	 *
	 * This coalesces rapid API bursts — the game often sends 5-15 API calls
	 * in a single batch, each dispatched sequentially. Without debounce,
	 * `updateSnapshot` would be called once per batch anyway (60s throttle)
	 * but the debounce avoids unnecessary throttle checks and makes the
	 * intent explicit.
	 *
	 * @private
	 */
	_debouncedSnapshot() {
		if (this._snapshotDebounceTimer !== null) {
			clearTimeout(this._snapshotDebounceTimer);
		}
		this._snapshotDebounceTimer = setTimeout(async () => {
			this._snapshotDebounceTimer = null;
			try {
				await this.updateSnapshot();
			} catch (error) {
				console.error('[OrganizedJihad] Error in updateSnapshot:', error);
				await this._logError('updateSnapshot', error);
			}
		}, this._snapshotDebounceDelay);
	}

	/**
	 * Create periodic snapshot of all tracked data
	 * Updates historical records for trend analysis
	 *
	 * @private
	 */
	async updateSnapshot() {
		const now = Date.now();
		if (now - this.lastUpdate < 60000) return; // 1 minute throttle

		const snapshot = {
			timestamp: now,
			player: await this.storage.getMetadata('playerData', {}),
			heroes: await this.storage.getMetadata('heroesData', []),
			inventory: await this.storage.getMetadata('inventoryData', {}),
			guild: await this.storage.getMetadata('guildData', {}),
		};

		// Save current snapshot
		await this.storage.setMetadata('lastGameData', snapshot);

		// Update historical data
		const history = await this.storage.getMetadata('gameHistory', []);
		history.push({
			timestamp: now,
			level: snapshot.player.level || 0,
			power: snapshot.heroes.reduce((sum, h) => sum + h.power, 0),
			gold: snapshot.player.gold || 0,
			emeralds: snapshot.player.starmoney || 0,
		});

		// Keep last 1000 snapshots
		if (history.length > 1000) {
			history.shift();
		}

		await this.storage.setMetadata('gameHistory', history);
		this.lastUpdate = now;
	}

	/**
	 * Manually trigger data capture
	 * Note: This only returns the last captured data, as we can't
	 * force the game to make API calls
	 *
	 * @returns {Object} Last captured game data
	 */
	async captureCurrentState() {
		return await this.storage.getMetadata('lastGameData', {});
	}

	/**
	 * Get current player statistics
	 * @returns {Object} Player data
	 */
	async getPlayerStats() {
		return await this.storage.getMetadata('playerData', {});
	}

	/**
	 * Get current hero roster
	 * @returns {Array} Array of hero objects
	 */
	async getHeroRoster() {
		return await this.storage.getMetadata('heroesData', []);
	}

	/**
	 * Get resource amounts
	 * @returns {Object} Resource data
	 */
	async getResources() {
		const player = await this.getPlayerStats();
		const inventory = await this.storage.getMetadata('inventoryData', {});

		return {
			gold: player.gold || 0,
			emeralds: player.starmoney || 0,
			energy: player.stamina || 0,
			consumables: inventory.consumable || {},
			coins: inventory.coin || {},
		};
	}

	/**
	 * Get battle history
	 * @returns {Array} Array of battle records
	 */
	async getBattleHistory() {
		return await this.storage.getMetadata('battleHistory', []);
	}

	/**
	 * Get arena battle history with win/loss statistics
	 * @returns {Object} Arena data with history and stats
	 */
	async getArenaData() {
		const history = await this.storage.getMetadata('arenaBattleHistory', []);
		const currentEnemies = await this.storage.getMetadata('arenaEnemies', []);
		const encounters = await this.storage.getMetadata('arenaEncounterHistory', []);

		const stats = this.calculateBattleStats(history);

		return {
			currentEnemies,
			history,
			encounters,
			stats,
		};
	}

	/**
	 * Get titan arena data
	 * @returns {Object} Titan arena data
	 */
	async getTitanArenaData() {
		const history = await this.storage.getMetadata('titanArenaBattleHistory', []);
		const currentEnemies = await this.storage.getMetadata('titanArenaEnemies', []);
		const stats = this.calculateBattleStats(history);

		return {
			currentEnemies,
			history,
			stats,
		};
	}

	/**
	 * Get grand arena data
	 * @returns {Object} Grand arena data
	 */
	async getGrandArenaData() {
		const history = await this.storage.getMetadata('grandArenaBattleHistory', []);
		const currentEnemies = await this.storage.getMetadata('grandArenaEnemies', []);
		const stats = this.calculateBattleStats(history);

		return {
			currentEnemies,
			history,
			stats,
		};
	}

	/**
	 * Get guild war data
	 * @returns {Object} Guild war data with current war and history
	 */
	async getGuildWarData() {
		const currentWar = await this.storage.getMetadata('currentGuildWar', null);
		const history = await this.storage.getMetadata('guildWarBattleHistory', []);
		const stats = this.calculateBattleStats(history);

		return {
			currentWar,
			history,
			stats,
		};
	}

	/**
	 * Get raid boss data
	 * @returns {Object} Raid boss data with current boss and attack history
	 */
	async getRaidBossData() {
		const currentBoss = await this.storage.getMetadata('currentRaidBoss', null);
		const history = await this.storage.getMetadata('raidBossAttackHistory', []);

		const totalDamage = history.reduce((sum, attack) => sum + attack.damage, 0);
		const averageDamage = history.length > 0 ? totalDamage / history.length : 0;

		return {
			currentBoss,
			history,
			totalDamage,
			averageDamage,
		};
	}

	/**
	 * Get chest opening statistics with drop rates
	 * @returns {Object} Chest opening data and calculated drop rates
	 */
	async getChestStatistics() {
		const history = await this.storage.getMetadata('chestOpeningHistory', []);
		const dropRates = await this.storage.getMetadata('chestDropRates', {});

		// Calculate drop probabilities
		const probabilityData = {};
		for (const [chestKey, data] of Object.entries(dropRates)) {
			probabilityData[chestKey] = {
				...data,
				itemProbabilities: {},
			};

			for (const [itemKey, itemData] of Object.entries(data.itemDrops)) {
				probabilityData[chestKey].itemProbabilities[itemKey] = {
					...itemData,
					dropRate: ((itemData.dropCount / data.openCount) * 100).toFixed(2) + '%',
					averageAmount: (itemData.totalAmount / itemData.dropCount).toFixed(2),
				};
			}
		}

		return {
			history,
			dropRates: probabilityData,
		};
	}

	/**
	 * Get opponent records (win/loss against specific players)
	 * @returns {Object} Opponent records by battle type
	 */
	async getOpponentRecords() {
		return await this.storage.getMetadata('opponentRecords', {});
	}

	/**
	 * Get expedition data
	 * @returns {Object} Expedition state and battle history
	 */
	async getExpeditionData() {
		const state = await this.storage.getMetadata('expeditionState', null);
		const history = await this.storage.getMetadata('expeditionBattleHistory', []);
		const stats = this.calculateBattleStats(history);

		return {
			state,
			history,
			stats,
		};
	}

	/**
	 * Get titans roster
	 * @returns {Array} Array of titan objects
	 */
	async getTitansRoster() {
		return await this.storage.getMetadata('titansData', []);
	}

	/**
	 * Get pets roster
	 * @returns {Array} Array of pet objects
	 */
	async getPetsRoster() {
		return await this.storage.getMetadata('petsData', []);
	}

	/**
	 * Get shop purchase history
	 * @returns {Array} Purchase history
	 */
	async getShopPurchaseHistory() {
		return await this.storage.getMetadata('shopPurchaseHistory', []);
	}

	/**
	 * Get quest completion history
	 * @returns {Array} Quest completion history
	 */
	async getQuestHistory() {
		return await this.storage.getMetadata('questCompletionHistory', []);
	}

	/**
	 * Get comprehensive historical data comparison
	 * Shows current vs historical state with trends
	 *
	 * @returns {Object} Historical comparison data
	 */
	async getHistoricalComparison() {
		const history = await this.storage.getMetadata('gameHistory', []);
		const current = await this.captureCurrentState();

		if (history.length === 0) {
			return {
				current,
				trends: null,
				message: 'Not enough historical data yet',
			};
		}

		// Get data from 1 day, 7 days, and 30 days ago
		const now = Date.now();
		const oneDayAgo = history.find((h) => now - h.timestamp >= 86400000); // 24 hours
		const sevenDaysAgo = history.find((h) => now - h.timestamp >= 604800000); // 7 days
		const thirtyDaysAgo = history.find((h) => now - h.timestamp >= 2592000000); // 30 days

		const trends = {
			level: {
				current: current.player?.level || 0,
				oneDayAgo: oneDayAgo?.level || 0,
				sevenDaysAgo: sevenDaysAgo?.level || 0,
				thirtyDaysAgo: thirtyDaysAgo?.level || 0,
			},
			power: {
				current: current.heroes?.reduce((sum, h) => sum + h.power, 0) || 0,
				oneDayAgo: oneDayAgo?.power || 0,
				sevenDaysAgo: sevenDaysAgo?.power || 0,
				thirtyDaysAgo: thirtyDaysAgo?.power || 0,
			},
			gold: {
				current: current.player?.gold || 0,
				oneDayAgo: oneDayAgo?.gold || 0,
				sevenDaysAgo: sevenDaysAgo?.gold || 0,
				thirtyDaysAgo: thirtyDaysAgo?.gold || 0,
			},
			emeralds: {
				current: current.player?.starmoney || 0,
				oneDayAgo: oneDayAgo?.emeralds || 0,
				sevenDaysAgo: sevenDaysAgo?.emeralds || 0,
				thirtyDaysAgo: thirtyDaysAgo?.emeralds || 0,
			},
		};

		return {
			current,
			trends,
			history,
		};
	}

	/**
	 * Calculate battle statistics from history
	 *
	 * @param {Array} history - Battle history array
	 * @returns {Object} Battle statistics
	 * @private
	 */
	calculateBattleStats(history) {
		const wins = history.filter((b) => b.result === 'victory').length;
		const losses = history.filter((b) => b.result === 'defeat').length;
		const total = history.length;
		const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';

		return {
			total,
			wins,
			losses,
			winRate: winRate + '%',
		};
	}

	/**
	 * Export all tracked data for analysis or backup
	 * @returns {Object} All tracked game data
	 */
	async exportAllData() {
		return {
			player: await this.getPlayerStats(),
			heroes: await this.getHeroRoster(),
			titans: await this.getTitansRoster(),
			pets: await this.getPetsRoster(),
			resources: await this.getResources(),
			battleHistory: await this.getBattleHistory(),
			arena: await this.getArenaData(),
			titanArena: await this.getTitanArenaData(),
			grandArena: await this.getGrandArenaData(),
			guildWar: await this.getGuildWarData(),
			raidBoss: await this.getRaidBossData(),
			chests: await this.getChestStatistics(),
			opponents: await this.getOpponentRecords(),
			expedition: await this.getExpeditionData(),
			shopPurchases: await this.getShopPurchaseHistory(),
			quests: await this.getQuestHistory(),
			historical: await this.getHistoricalComparison(),
			exportedAt: new Date().toISOString(),
		};
	}

	/**
	 * Export raw IndexedDB data for all (or specific) stores.
	 * Unlike exportAllData() which returns curated/transformed data,
	 * this returns the raw IDB records exactly as stored.
	 *
	 * @param {string[]} [storeNames] - Specific stores to export (default: all)
	 * @returns {Promise<Object>} Raw store data with _meta header
	 */
	async exportRawData(storeNames) {
		return this.storage.exportAllStores(storeNames);
	}

	/**
	 * Import raw data from a previously exported JSON dump.
	 *
	 * @param {Object} data - Exported data object (from exportRawData)
	 * @param {Object} [options] - Import options passed to storage.importStores
	 * @returns {Promise<Object>} Import summary
	 */
	async importRawData(data, options) {
		return this.storage.importStores(data, options);
	}

	/**
	 * Load tracking preferences from prefStorage.
	 * Called during initialization to restore per-category toggles.
	 *
	 * @param {Object} prefStorage - The preference storage instance
	 */
	loadTrackingPrefs(prefStorage) {
		this.prefStorage = prefStorage;
		const saved = prefStorage.get('trackingPrefs', null);
		if (saved && typeof saved === 'object') {
			for (const cat of Object.keys(TRACKING_CATEGORIES)) {
				if (typeof saved[cat] === 'boolean') {
					this._trackingPrefs[cat] = saved[cat];
				}
			}
		}
	}

	/**
	 * Update a tracking category toggle and persist to preferences.
	 *
	 * @param {string} category - Category key (e.g. 'battles', 'chests')
	 * @param {boolean} enabled - Whether tracking is enabled
	 */
	setTrackingCategory(category, enabled) {
		if (category in this._trackingPrefs) {
			this._trackingPrefs[category] = enabled;
			if (this.prefStorage) {
				this.prefStorage.set('trackingPrefs', { ...this._trackingPrefs });
			}
		}
	}

	/**
	 * Get all tracking category states.
	 *
	 * @returns {Object<string, boolean>} Map of category → enabled
	 */
	getTrackingPrefs() {
		return { ...this._trackingPrefs };
	}

	// ========================================================================
	// Phase 8: Daily Activity & Inventory Tracking Methods
	// ========================================================================

	/**
	 * Get the current player ID from metadata cache.
	 * Used by upgrade tracking methods that need the player ID.
	 *
	 * @returns {Promise<string|number>} Player ID or 'unknown'
	 * @private
	 */
	async _getPlayerId() {
		return (await this.storage.getMetadata('currentPlayerId')) || 'unknown';
	}

	/**
	 * Track a single daily quest farm (reward collection).
	 * API call: questFarm({questId})
	 *
	 * Daily quests have IDs in the 10000-10999 range.
	 * Guild quests may have different ID ranges.
	 *
	 * Reference: data/Models/DailyActivityModels.cs
	 *
	 * @param {Object} args - Request arguments {questId: number}
	 * @param {Object} responseData - Response with quest reward data
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackDailyQuestFarm(args, responseData) {
		const playerId = await this._getPlayerId();
		const timestamp = new Date().toISOString();
		const questId = String(args.questId || args.id || 0);
		const questIdNum = parseInt(questId, 10);

		// Determine if this is a daily quest (10001-10999) or guild quest
		const isDailyQuest = questIdNum >= 10000 && questIdNum < 11000;

		if (isDailyQuest) {
			// Store as daily quest completion
			const record = {
				completedAt: timestamp,
				questDate: new Date().toISOString().split('T')[0], // Date-only portion
				questId,
				questName: `Daily Quest ${questId}`,
				category: null, // Would need quest name mapping
				activityPoints: responseData?.reward?.activityPoints || 0,
				rewardData: JSON.stringify(responseData?.reward || responseData || {}),
				playerId,
			};

			await this.storage.add('dailyQuestCompletions', record);
			console.log(`[OrganizedJihad] Daily quest farmed: ${questId}`);
		} else {
			// Store as guild quest completion
			const guildId = (await this.storage.getMetadata('currentGuildId')) || 0;
			const record = {
				completedAt: timestamp,
				questDate: new Date().toISOString().split('T')[0],
				questId,
				questName: `Guild Quest ${questId}`,
				difficulty: null,
				guildActivityPoints: responseData?.reward?.guildActivityPoints || 0,
				rewardData: JSON.stringify(responseData?.reward || responseData || {}),
				playerId,
				guildId,
			};

			await this.storage.add('guildQuestCompletions', record);
			console.log(`[OrganizedJihad] Guild quest farmed: ${questId}`);
		}
	}

	/**
	 * Track batch quest farming (multiple quests at once).
	 * API call: quest_questsFarm({questIds: [...]})
	 *
	 * Used primarily for battle pass quests and batch daily completions.
	 *
	 * @param {Object} args - Request arguments {questIds: number[]}
	 * @param {Object} responseData - Response with quest reward data
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackBatchQuestFarm(args, responseData) {
		const questIds = args.questIds || [];

		// Process each quest ID as a separate farm event
		for (const questId of questIds) {
			await this.trackDailyQuestFarm({ questId }, responseData);
		}

		console.log(`[OrganizedJihad] Batch quest farm: ${questIds.length} quests`);
	}

	/**
	 * Track daily login reward collection.
	 * API call: dailyBonusFarm({vip})
	 *
	 * Matches C# LoginReward entity in data/Models/DailyActivityModels.cs
	 *
	 * @param {Object} args - Request arguments {vip: boolean}
	 * @param {Object} responseData - Response with reward data
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackLoginReward(args, responseData) {
		const playerId = await this._getPlayerId();
		const timestamp = new Date().toISOString();
		const isVip = args.vip || false;

		const record = {
			claimedAt: timestamp,
			dayNumber: responseData?.day || responseData?.dayCount || 0,
			streakLength: responseData?.loginCount || responseData?.streak || 0,
			isVipBonus: isVip,
			rewardData: JSON.stringify(responseData?.reward || responseData || {}),
			playerId,
		};

		await this.storage.add('loginRewards', record);
		console.log(`[OrganizedJihad] Login reward claimed: day ${record.dayNumber}, VIP: ${isVip}`);
	}

	/**
	 * Track daily bonus info for reference (cache streak/day info).
	 * API call: dailyBonusGetInfo
	 *
	 * Stores the current day number and streak length in metadata
	 * for use by subsequent dailyBonusFarm calls.
	 *
	 * @param {Object} responseData - Response with daily bonus state
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackDailyBonusInfo(responseData) {
		// Cache the daily bonus info for use when farming
		if (responseData?.day || responseData?.dayCount) {
			await this.storage.setMetadata('dailyBonusDay', responseData.day || responseData.dayCount);
		}
		if (responseData?.loginCount || responseData?.streak) {
			await this.storage.setMetadata('dailyBonusStreak', responseData.loginCount || responseData.streak);
		}

		console.log('[OrganizedJihad] Daily bonus info cached');
	}

	/**
	 * Track inventory item usage when consumables are spent.
	 * Called from upgrade event handlers (e.g., XP potion usage) and other
	 * consumable-spending API calls.
	 *
	 * Matches C# InventoryItemUsage entity in data/Models/InventoryModels.cs
	 *
	 * @param {Object} args - Request arguments with item info
	 * @param {Object} responseData - Response data
	 * @param {string} category - Item category: 'potion', 'fragment', 'scroll', etc.
	 * @param {string} usageContext - Usage context: 'hero_level', 'artifact', etc.
	 * @returns {Promise<void>}
	 * @private
	 */
	async trackInventoryItemUsage(args, responseData, category, usageContext) {
		const playerId = await this._getPlayerId();
		const timestamp = new Date().toISOString();

		const record = {
			timestamp,
			itemId: String(args.libId || args.itemId || 'unknown'),
			itemName: `Item_${args.libId || args.itemId || 'unknown'}`, // Name lookup not available
			category,
			quantityUsed: args.amount || 1,
			quantityRemaining: 0, // Not always available in response
			usageContext,
			targetEntity: args.heroId ? `Hero_${args.heroId}` : (args.titanId ? `Titan_${args.titanId}` : null),
			playerId,
		};

		await this.storage.add('inventoryItemUsages', record);
		console.log(`[OrganizedJihad] Inventory item used: ${record.itemId} x${record.quantityUsed} for ${usageContext}`);
	}

}

export default GameTracker;
export { TRACKING_CATEGORIES };
