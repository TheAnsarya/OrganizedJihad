/**
 * apiMonitor.js
 *
 * Comprehensive API monitoring and logging system for Hero Wars
 * Intercepts ALL API requests and responses to discover new endpoints and data structures
 *
 * Features:
 * - Logs all request/response pairs with timestamps
 * - Automatically discovers new API endpoints
 * - Exports captured data for analysis
 * - Provides real-time API activity dashboard
 * - Stores comprehensive logs in IndexedDB
 *
 * Technical Implementation:
 * Uses both XMLHttpRequest and fetch interception to capture all network traffic
 * to Hero Wars API endpoints (*.nextersglobal.com/api/)
 *
 * References:
 * - XMLHttpRequest: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
 * - Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
 * - Proxy pattern: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
 *
 * @module apiMonitor
 */

import IndexedDBStorage from './indexedDBStorage.js';

/**
 * Fixed-capacity ring buffer that replaces push/shift O(n) trimming
 * with O(1) overwrites (#139).
 *
 * Externally it behaves like an array for reads: `.length`, `[index]`,
 * `.slice()`, `.forEach()`, and spread/iteration all return items in
 * insertion order.
 *
 * Uses a Proxy wrapper so bracket notation (`buf[0]`) resolves to the
 * correct logical position.
 *
 * @class RingBuffer
 * @template T
 */
class RingBuffer {
	/**
	 * @param {number} capacity - Maximum number of entries to retain
	 * @returns {RingBuffer & Array<T>} Proxy-wrapped instance supporting [index] access
	 */
	constructor(capacity) {
		/** @type {number} Max entries */
		this._capacity = capacity;
		/** @type {Array<T>} Backing storage */
		this._buf = [];
		/** @type {number} Next write position (only used once full) */
		this._writeIdx = 0;
		/** @type {boolean} Whether we've wrapped around at least once */
		this._full = false;

		// Return a Proxy so numeric bracket access works: buf[0], buf[4], etc.
		// Non-numeric property access (methods, .length) goes straight through.
		return new Proxy(this, {
			get(target, prop, receiver) {
				// Numeric string indices → delegate to logical-order lookup
				if (typeof prop === 'string' && /^\d+$/.test(prop)) {
					return target._getLogical(Number(prop));
				}
				return Reflect.get(target, prop, receiver);
			},
		});
	}

	/** @returns {number} Number of entries currently stored */
	get length() {
		return this._full ? this._capacity : this._buf.length;
	}

	/**
	 * Get the item at logical index `i` (0 = oldest, length-1 = newest).
	 *
	 * @param {number} i
	 * @returns {T|undefined}
	 * @private
	 */
	_getLogical(i) {
		const len = this.length;
		if (i < 0 || i >= len) return undefined;
		if (!this._full) return this._buf[i];
		return this._buf[(this._writeIdx + i) % this._capacity];
	}

	/**
	 * Append an entry.  O(1) — overwrites the oldest entry when full.
	 * @param {T} item
	 */
	push(item) {
		if (!this._full) {
			this._buf.push(item);
			if (this._buf.length === this._capacity) {
				this._full = true;
				this._writeIdx = 0; // next push wraps to slot 0
			}
		} else {
			this._buf[this._writeIdx] = item;
			this._writeIdx = (this._writeIdx + 1) % this._capacity;
		}
	}

	/**
	 * Return entries in insertion order as a plain Array.
	 * @returns {Array<T>}
	 */
	toArray() {
		if (!this._full) return this._buf.slice();
		// _writeIdx points to the oldest entry (it was the next to be
		// overwritten), so reading from _writeIdx → end, then 0 → _writeIdx
		// yields chronological order.
		return [
			...this._buf.slice(this._writeIdx),
			...this._buf.slice(0, this._writeIdx),
		];
	}

	/**
	 * Mimic Array.prototype.slice — operates on the logical
	 * (insertion-order) view.
	 *
	 * @param {number} [start]
	 * @param {number} [end]
	 * @returns {Array<T>}
	 */
	slice(start, end) {
		return this.toArray().slice(start, end);
	}

	/**
	 * Mimic Array.prototype.forEach in insertion order.
	 *
	 * @param {function(T, number, Array<T>): void} fn
	 */
	forEach(fn) {
		this.toArray().forEach(fn);
	}

	/** Make the ring buffer iterable (for `for..of` and spread). */
	[Symbol.iterator]() {
		const arr = this.toArray();
		let i = 0;
		return {
			next() {
				return i < arr.length
					? { value: arr[i++], done: false }
					: { done: true };
			},
		};
	}

	/** Discard all entries. */
	clear() {
		this._buf = [];
		this._writeIdx = 0;
		this._full = false;
	}
}

/**
 * Reference to the page's real `window` object.
 * When TamperMonkey runs with any `@grant`, the script executes in a
 * sandbox where globals like `XMLHttpRequest`, `fetch`, etc. are isolated
 * copies that the game never touches.  `unsafeWindow` bridges into the
 * real page context.  Falls back to `window` when unsafeWindow isn't
 * available (Node.js tests, `@grant none`).
 *
 * @see https://www.tampermonkey.net/documentation.php#api:unsafeWindow
 * @type {Window}
 */
const PAGE_WINDOW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

/**
 * API Monitor class for comprehensive request/response logging
 *
 * @class APIMonitor
 */
class APIMonitor {
	constructor(storage) {
		this.storage = storage || new IndexedDBStorage();
		this.isMonitoring = false;
		this.originalXHR = null;
		this.originalFetch = null;

		// Storage for discovered endpoints and their call counts
		this.discoveredEndpoints = new Map();

		// Request/response log — ring buffer for O(1) push (#139)
		this.requestLog = new RingBuffer(1000);
		this.maxLogSize = 1000;

		// Statistics
		this.stats = {
			totalRequests: 0,
			totalResponses: 0,
			successfulRequests: 0,
			failedRequests: 0,
			startTime: Date.now(),
		};

		// Event listeners for real-time monitoring
		this.listeners = [];
	}

	/**
	 * Initialize API monitoring
	 * Sets up interception of both XMLHttpRequest and fetch
	 *
	 * @returns {Promise<void>}
	 */
	async init() {
		try {
			await this.storage.init();

			// Set up request interception
			this.interceptXHR();
			this.interceptFetch();

			// Load previously discovered endpoints from storage
			await this.loadDiscoveredEndpoints();

			this.isMonitoring = true;
			console.log('[APIMonitor] Initialized - monitoring all Hero Wars API calls');
			console.log('[APIMonitor] Access logs via window.apiMonitor.getLogs()');
			console.log('[APIMonitor] Export logs via window.apiMonitor.exportLogs()');

			// Make available globally for console access (page context)
			PAGE_WINDOW.apiMonitor = this;
		} catch (error) {
			console.error('[APIMonitor] Failed to initialize:', error);
		}
	}

	/**
	 * Intercept XMLHttpRequest to capture all XHR-based API calls
	 * Hero Wars primarily uses XHR for API communication
	 *
	 * Pattern:
	 * 1. Save original XHR prototype methods
	 * 2. Override open() to capture URL and method
	 * 3. Override send() to capture request body
	 * 4. Override onreadystatechange to capture response
	 *
	 * @private
	 */
	interceptXHR() {
		const self = this;

		// Store original methods from the PAGE's prototype (not sandbox's)
		// Same pattern as gameTracker.js (#59)
		this.originalXHR = {
			open: PAGE_WINDOW.XMLHttpRequest.prototype.open,
			send: PAGE_WINDOW.XMLHttpRequest.prototype.send,
			setRequestHeader: PAGE_WINDOW.XMLHttpRequest.prototype.setRequestHeader,
		};

		// Override XMLHttpRequest.open() on the PAGE's prototype
		PAGE_WINDOW.XMLHttpRequest.prototype.open = function (method, url, ...args) {
			// Store request info on XHR object
			this._apiMonitor = {
				method: method,
				url: url,
				requestHeaders: {},
				startTime: Date.now(),
			};

			// Call original open
			return self.originalXHR.open.call(this, method, url, ...args);
		};

		// Override XMLHttpRequest.setRequestHeader() on the PAGE's prototype
		PAGE_WINDOW.XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
			// Store headers for logging
			if (this._apiMonitor) {
				this._apiMonitor.requestHeaders[header] = value;
			}

			// Call original setRequestHeader
			return self.originalXHR.setRequestHeader.call(this, header, value);
		};

		// Override XMLHttpRequest.send() on the PAGE's prototype
		PAGE_WINDOW.XMLHttpRequest.prototype.send = function (body) {
			const xhr = this;

			// Store request body
			if (xhr._apiMonitor) {
				xhr._apiMonitor.requestBody = body;

				// Check if this is a Hero Wars API call
				const isHeroWarsAPI = xhr._apiMonitor.url.includes('nextersglobal.com/api/');

				if (isHeroWarsAPI) {
					// Log the outgoing request
					self.logRequest(xhr._apiMonitor);

					// Use addEventListener instead of wrapping onreadystatechange
					// to avoid the game overwriting our handler after send() (#83)
					xhr.addEventListener('readystatechange', function () {
						// Capture response when complete
						if (xhr.readyState === 4) {
							self.logResponse(xhr._apiMonitor, {
								status: xhr.status,
								statusText: xhr.statusText,
								responseHeaders: xhr.getAllResponseHeaders(),
								responseBody: xhr.responseText,
								endTime: Date.now(),
							});
						}
					});
				}
			}

			// Call original send
			return self.originalXHR.send.call(this, body);
		};

		console.log('[APIMonitor] XMLHttpRequest interception enabled');
	}

	/**
	 * Intercept fetch API to capture all fetch-based API calls
	 * Provides coverage for any endpoints that might use modern fetch instead of XHR
	 *
	 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
	 *
	 * @private
	 */
	interceptFetch() {
		const self = this;

		// Store original fetch from the PAGE context
		this.originalFetch = PAGE_WINDOW.fetch;

		// Override fetch on the PAGE context
		PAGE_WINDOW.fetch = async function (url, options = {}) {
			const requestInfo = {
				method: options.method || 'GET',
				url: url.toString(),
				requestHeaders: options.headers || {},
				requestBody: options.body,
				startTime: Date.now(),
			};

			// Check if this is a Hero Wars API call
			const isHeroWarsAPI = requestInfo.url.includes('nextersglobal.com/api/');

			if (isHeroWarsAPI) {
				// Log the outgoing request
				self.logRequest(requestInfo);
			}

			try {
				// Call original fetch
				const response = await self.originalFetch.call(this, url, options);

				if (isHeroWarsAPI) {
					// Clone response to capture body without consuming it
					const responseClone = response.clone();
					const responseBody = await responseClone.text();

					// Log the response
					self.logResponse(requestInfo, {
						status: response.status,
						statusText: response.statusText,
						responseHeaders: [...response.headers.entries()],
						responseBody: responseBody,
						endTime: Date.now(),
					});
				}

				return response;
			} catch (error) {
				if (isHeroWarsAPI) {
					// Log failed request
					self.logResponse(requestInfo, {
						status: 0,
						statusText: 'Network Error',
						error: error.message,
						endTime: Date.now(),
					});
				}
				throw error;
			}
		};

		console.log('[APIMonitor] Fetch API interception enabled');
	}

	/**
	 * Log an outgoing API request
	 *
	 * @param {Object} requestInfo - Request metadata
	 * @private
	 */
	logRequest(requestInfo) {
		this.stats.totalRequests++;

		// Parse request body if it's JSON
		let parsedBody = requestInfo.requestBody;
		if (typeof requestInfo.requestBody === 'string') {
			try {
				parsedBody = JSON.parse(requestInfo.requestBody);
			} catch (e) {
				// Not JSON, keep as string
			}
		}

		const logEntry = {
			id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
			type: 'request',
			timestamp: new Date().toISOString(),
			method: requestInfo.method,
			url: requestInfo.url,
			headers: requestInfo.requestHeaders,
			body: parsedBody,
			startTime: requestInfo.startTime,
		};

		// Extract API endpoints from request if it's Hero Wars API format
		if (parsedBody && parsedBody.calls && Array.isArray(parsedBody.calls)) {
			logEntry.endpoints = parsedBody.calls.map((call) => call.name);

			// Track discovered endpoints
			parsedBody.calls.forEach((call) => {
				this.trackEndpoint(call.name);
			});
		}

		// Add to log
		this.addToLog(logEntry);

		// Notify listeners
		this.notifyListeners('request', logEntry);

		// Console log for immediate visibility
		console.log(`[APIMonitor] → REQUEST:`, {
			url: requestInfo.url,
			endpoints: logEntry.endpoints,
			body: parsedBody,
		});
	}

	/**
	 * Log an incoming API response
	 *
	 * @param {Object} requestInfo - Original request metadata
	 * @param {Object} responseInfo - Response metadata
	 * @private
	 */
	logResponse(requestInfo, responseInfo) {
		this.stats.totalResponses++;

		if (responseInfo.status >= 200 && responseInfo.status < 300) {
			this.stats.successfulRequests++;
		} else {
			this.stats.failedRequests++;
		}

		// Parse response body if it's JSON
		let parsedBody = responseInfo.responseBody;
		if (typeof responseInfo.responseBody === 'string') {
			try {
				parsedBody = JSON.parse(responseInfo.responseBody);
			} catch (e) {
				// Not JSON, keep as string
			}
		}

		const duration = responseInfo.endTime - requestInfo.startTime;

		const logEntry = {
			id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
			type: 'response',
			timestamp: new Date().toISOString(),
			url: requestInfo.url,
			status: responseInfo.status,
			statusText: responseInfo.statusText,
			headers: responseInfo.responseHeaders,
			body: parsedBody,
			duration: duration,
			error: responseInfo.error,
		};

		// Extract response data structure for documentation
		if (parsedBody && parsedBody.results) {
			logEntry.dataStructure = this.analyzeDataStructure(parsedBody.results);
		}

		// Add to log
		this.addToLog(logEntry);

		// Notify listeners
		this.notifyListeners('response', logEntry);

		// Console log for immediate visibility
		console.log(`[APIMonitor] ← RESPONSE (${duration}ms):`, {
			url: requestInfo.url,
			status: responseInfo.status,
			body: parsedBody,
			dataStructure: logEntry.dataStructure,
		});

		// Save to IndexedDB periodically (every 10 responses)
		if (this.stats.totalResponses % 10 === 0) {
			this.saveLogsToStorage();
		}
	}

	/**
	 * Track a discovered API endpoint
	 *
	 * @param {string} endpoint - Endpoint name (e.g., "userGetInfo")
	 * @private
	 */
	trackEndpoint(endpoint) {
		if (!this.discoveredEndpoints.has(endpoint)) {
			this.discoveredEndpoints.set(endpoint, {
				name: endpoint,
				firstSeen: new Date().toISOString(),
				callCount: 0,
				lastSeen: new Date().toISOString(),
			});
			console.log(`[APIMonitor] 🆕 New endpoint discovered: ${endpoint}`);
		}

		// Update call count and last seen
		const endpointData = this.discoveredEndpoints.get(endpoint);
		endpointData.callCount++;
		endpointData.lastSeen = new Date().toISOString();
	}

	/**
	 * Analyze response data structure to help with API documentation
	 *
	 * @param {Object} data - Response data
	 * @returns {Object} Structure analysis
	 * @private
	 */
	analyzeDataStructure(data) {
		if (!data || typeof data !== 'object') {
			return { type: typeof data };
		}

		if (Array.isArray(data)) {
			return {
				type: 'array',
				length: data.length,
				sampleItem: data.length > 0 ? this.analyzeDataStructure(data[0]) : null,
			};
		}

		// For objects, get top-level keys
		const structure = {
			type: 'object',
			keys: Object.keys(data),
			keyCount: Object.keys(data).length,
		};

		return structure;
	}

	/**
	 * Add entry to request log with size management
	 *
	 * @param {Object} entry - Log entry
	 * @private
	 */
	addToLog(entry) {
		this.requestLog.push(entry);
		// RingBuffer automatically evicts the oldest entry when full (#139)
	}

	/**
	 * Save logs to IndexedDB for persistent storage
	 *
	 * @private
	 */
	async saveLogsToStorage() {
		try {
			await this.storage.saveAPILogs({
				logs: this.requestLog.slice(-100), // Save last 100 entries
				endpoints: Array.from(this.discoveredEndpoints.values()),
				stats: this.stats,
				savedAt: new Date().toISOString(),
			});
			console.log('[APIMonitor] Logs saved to IndexedDB');
		} catch (error) {
			console.error('[APIMonitor] Failed to save logs:', error);
		}
	}

	/**
	 * Load previously discovered endpoints from storage
	 *
	 * @private
	 */
	async loadDiscoveredEndpoints() {
		try {
			const savedData = await this.storage.getAPILogs();
			if (savedData && savedData.endpoints) {
				savedData.endpoints.forEach((endpoint) => {
					this.discoveredEndpoints.set(endpoint.name, endpoint);
				});
				console.log(`[APIMonitor] Loaded ${savedData.endpoints.length} previously discovered endpoints`);
			}
		} catch (error) {
			console.error('[APIMonitor] Failed to load saved endpoints:', error);
		}
	}

	/**
	 * Add event listener for real-time API monitoring
	 *
	 * @param {Function} callback - Callback function (type, data) => void
	 */
	addListener(callback) {
		this.listeners.push(callback);
	}

	/**
	 * Remove event listener
	 *
	 * @param {Function} callback - Callback to remove
	 */
	removeListener(callback) {
		this.listeners = this.listeners.filter((cb) => cb !== callback);
	}

	/**
	 * Notify all listeners of an event
	 *
	 * @param {string} type - Event type ('request' or 'response')
	 * @param {Object} data - Event data
	 * @private
	 */
	notifyListeners(type, data) {
		this.listeners.forEach((callback) => {
			try {
				callback(type, data);
			} catch (error) {
				console.error('[APIMonitor] Listener error:', error);
			}
		});
	}

	/**
	 * Get all logged requests/responses
	 *
	 * @returns {Array} Request log
	 */
	getLogs() {
		return this.requestLog.toArray();
	}

	/**
	 * Get discovered endpoints with statistics
	 *
	 * @returns {Array} Discovered endpoints
	 */
	getEndpoints() {
		return Array.from(this.discoveredEndpoints.values()).sort((a, b) => b.callCount - a.callCount);
	}

	/**
	 * Get monitoring statistics
	 *
	 * @returns {Object} Statistics
	 */
	getStats() {
		return {
			...this.stats,
			uptime: Date.now() - this.stats.startTime,
			endpointCount: this.discoveredEndpoints.size,
			logSize: this.requestLog.length,
		};
	}

	/**
	 * Export all logs as JSON for external analysis
	 *
	 * @returns {string} JSON string of all logs and metadata
	 */
	exportLogs() {
		const exportData = {
			meta: {
				exportTime: new Date().toISOString(),
				version: '1.0.0',
				stats: this.getStats(),
			},
			endpoints: this.getEndpoints(),
			logs: this.requestLog.toArray(),
		};

		const jsonString = JSON.stringify(exportData, null, 2);

		// Also offer download
		this.downloadJSON(jsonString, `herowars-api-logs-${Date.now()}.json`);

		return jsonString;
	}

	/**
	 * Download data as JSON file
	 *
	 * @param {string} content - JSON content
	 * @param {string} filename - Filename for download
	 * @private
	 */
	downloadJSON(content, filename) {
		const blob = new Blob([content], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		console.log(`[APIMonitor] Logs exported to ${filename}`);
	}

	/**
	 * Clear all logs (useful for starting fresh)
	 */
	clearLogs() {
		this.requestLog.clear();
		console.log('[APIMonitor] Logs cleared');
	}

	/**
	 * Generate API documentation from discovered endpoints
	 *
	 * @returns {string} Markdown documentation
	 */
	generateDocumentation() {
		let doc = '# Hero Wars API Documentation\n\n';
		doc += `Generated: ${new Date().toISOString()}\n\n`;
		doc += `## Statistics\n\n`;
		doc += `- Total Endpoints Discovered: ${this.discoveredEndpoints.size}\n`;
		doc += `- Total Requests Logged: ${this.stats.totalRequests}\n`;
		doc += `- Total Responses Logged: ${this.stats.totalResponses}\n`;
		doc += `- Success Rate: ${this.stats.totalResponses > 0 ? ((this.stats.successfulRequests / this.stats.totalResponses) * 100).toFixed(2) : '0.00'}%\n\n`;

		doc += `## Discovered Endpoints\n\n`;
		doc += `| Endpoint | Call Count | First Seen | Last Seen |\n`;
		doc += `|----------|-----------|------------|----------|\n`;

		this.getEndpoints().forEach((endpoint) => {
			doc += `| \`${endpoint.name}\` | ${endpoint.callCount} | ${endpoint.firstSeen} | ${endpoint.lastSeen} |\n`;
		});

		doc += `\n## Request/Response Examples\n\n`;

		// Group logs by endpoint
		const logsByEndpoint = new Map();
		this.requestLog.forEach((log) => {
			if (log.endpoints) {
				log.endpoints.forEach((endpoint) => {
					if (!logsByEndpoint.has(endpoint)) {
						logsByEndpoint.set(endpoint, []);
					}
					logsByEndpoint.get(endpoint).push(log);
				});
			}
		});

		// Add examples for each endpoint
		logsByEndpoint.forEach((logs, endpoint) => {
			doc += `### ${endpoint}\n\n`;
			const exampleLog = logs[0];
			if (exampleLog.body && exampleLog.body.calls) {
				const call = exampleLog.body.calls.find((c) => c.name === endpoint);
				if (call) {
					doc += `**Request:**\n\`\`\`json\n${JSON.stringify(call, null, 2)}\n\`\`\`\n\n`;
				}
			}
		});

		// Download as file
		this.downloadJSON(doc, `herowars-api-docs-${Date.now()}.md`);

		return doc;
	}

	/**
	 * Tear down the APIMonitor: restore original XHR and fetch prototypes,
	 * remove the global console accessor, and clear internal state (#133).
	 *
	 * Called automatically via `_destroyables` on `beforeunload`.
	 */
	destroy() {
		// Restore original XMLHttpRequest prototype methods
		if (this.originalXHR) {
			try {
				PAGE_WINDOW.XMLHttpRequest.prototype.open = this.originalXHR.open;
				PAGE_WINDOW.XMLHttpRequest.prototype.send = this.originalXHR.send;
				PAGE_WINDOW.XMLHttpRequest.prototype.setRequestHeader = this.originalXHR.setRequestHeader;
			} catch { /* best-effort */ }
			this.originalXHR = null;
		}

		// Restore original fetch
		if (this.originalFetch) {
			try {
				PAGE_WINDOW.fetch = this.originalFetch;
			} catch { /* best-effort */ }
			this.originalFetch = null;
		}

		// Remove global console accessor
		try {
			delete PAGE_WINDOW.apiMonitor;
		} catch { /* best-effort */ }

		this.isMonitoring = false;
		this.requestLog.clear();
		this.discoveredEndpoints.clear();
		this.listeners = [];
	}
}

export default APIMonitor;
export { RingBuffer };
