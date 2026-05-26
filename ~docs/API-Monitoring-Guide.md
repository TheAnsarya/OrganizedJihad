# Hero Wars API Monitoring Guide

**Created:** 2025-01-23  
**Version:** 1.0.0  
**Module:** `apiMonitor.js`

## Overview

The OrganizedJihad userscript now includes a comprehensive API monitoring system that intercepts and logs **ALL** Hero Wars API requests and responses. This allows for:

1. **Endpoint Discovery** - Find new API endpoints as you play
2. **Data Structure Analysis** - Understand response formats for better tracking
3. **Debugging** - Troubleshoot data capture issues
4. **Documentation** - Auto-generate API documentation from live traffic

## Features

### ✅ Comprehensive Interception
- **XMLHttpRequest** - Captures traditional AJAX calls (primary Hero Wars method)
- **Fetch API** - Captures modern fetch-based requests
- **Both Request & Response** - Logs complete request/response pairs

### ✅ Intelligent Logging
- **Endpoint Tracking** - Automatically discovers and counts API endpoint usage
- **Data Structure Analysis** - Analyzes response structures for documentation
- **Performance Metrics** - Tracks request duration and success rates
- **Smart Storage** - Limits log size to prevent memory issues

### ✅ Real-time Access
- **Console API** - Access logs directly from browser console
- **Event Listeners** - React to API calls in real-time
- **Export Functionality** - Download logs as JSON for external analysis

## How It Works

### Technical Implementation

The API Monitor uses a **proxy pattern** to intercept network requests:

```javascript
// Original XHR methods are stored
this.originalXHR = {
	open: XMLHttpRequest.prototype.open,
	send: XMLHttpRequest.prototype.send,
	setRequestHeader: XMLHttpRequest.prototype.setRequestHeader,
};

// Methods are overridden to add logging
XMLHttpRequest.prototype.send = function(body) {
	// Log the request
	self.logRequest({...});
	
	// Call original method
	return self.originalXHR.send.call(this, body);
};
```

### Hero Wars API Format

Hero Wars uses a **batch request format** where multiple API calls can be sent in a single HTTP request:

**Request Structure:**
```json
{
	"calls": [
		{
			"name": "userGetInfo",
			"ident": "request_1",
			"params": {}
		},
		{
			"name": "heroGetAll",
			"ident": "request_2",
			"params": {}
		}
	]
}
```

**Response Structure:**
```json
{
	"results": [
		{
			"ident": "request_1",
			"result": {
				"playerId": 12345,
				"playerName": "Example",
				// ... player data
			}
		},
		{
			"ident": "request_2",
			"result": {
				"heroes": [
					// ... hero data
				]
			}
		}
	]
}
```

## Usage Guide

### Accessing Logs from Console

The API Monitor is available globally as `window.apiMonitor`:

```javascript
// Get all logged requests/responses
apiMonitor.getLogs();

// Get discovered endpoints with statistics
apiMonitor.getEndpoints();

// Get monitoring statistics
apiMonitor.getStats();

// Export logs as JSON file (auto-downloads)
apiMonitor.exportLogs();

// Generate API documentation
apiMonitor.generateDocumentation();

// Clear all logs
apiMonitor.clearLogs();
```

### Example Console Session

```javascript
// Check what endpoints have been discovered
console.table(apiMonitor.getEndpoints());

// Output:
// ┌─────────┬──────────────────┬───────────┬─────────────────────────┐
// │ (index) │      name        │ callCount │       lastSeen          │
// ├─────────┼──────────────────┼───────────┼─────────────────────────┤
// │    0    │  'userGetInfo'   │    45     │ '2025-01-23T15:30:22Z'  │
// │    1    │  'heroGetAll'    │    23     │ '2025-01-23T15:28:15Z'  │
// │    2    │  'inventoryGet'  │    18     │ '2025-01-23T15:25:10Z'  │
// └─────────┴──────────────────┴───────────┴─────────────────────────┘

// View statistics
console.log(apiMonitor.getStats());

// Output:
// {
//   totalRequests: 127,
//   totalResponses: 125,
//   successfulRequests: 123,
//   failedRequests: 2,
//   startTime: 1706023456789,
//   uptime: 1847231,
//   endpointCount: 34,
//   logSize: 250
// }

// Filter logs by URL pattern
apiMonitor.getLogs().filter(log => log.url.includes('arena'));

// Get only response logs
apiMonitor.getLogs().filter(log => log.type === 'response');
```

### Real-time Monitoring

Add event listeners to react to API calls as they happen:

```javascript
// Listen for all API events
apiMonitor.addListener((type, data) => {
	console.log(`API ${type}:`, data);
});

// Listen for specific endpoint
apiMonitor.addListener((type, data) => {
	if (type === 'request' && data.endpoints?.includes('userGetInfo')) {
		console.log('Player info requested!', data);
	}
});
```

### Export and Analysis

```javascript
// Export all logs (downloads JSON file)
apiMonitor.exportLogs();

// Exported file contains:
// {
//   "meta": {
//     "exportTime": "2025-01-23T15:35:00Z",
//     "version": "1.0.0",
//     "stats": { ... }
//   },
//   "endpoints": [ ... ],
//   "logs": [ ... ]
// }

// Generate markdown documentation (downloads .md file)
apiMonitor.generateDocumentation();
```

## Log Entry Structure

### Request Log Entry

```javascript
{
	id: "req_1706023456789_abc123",
	type: "request",
	timestamp: "2025-01-23T15:30:56.789Z",
	method: "POST",
	url: "https://heroes-web-ru26.nextersglobal.com/api/",
	headers: {
		"Content-Type": "application/json",
		"X-Requested-With": "XMLHttpRequest"
	},
	body: {
		calls: [
			{ name: "userGetInfo", ident: "req_1", params: {} }
		]
	},
	endpoints: ["userGetInfo"],
	startTime: 1706023456789
}
```

### Response Log Entry

```javascript
{
	id: "res_1706023456890_def456",
	type: "response",
	timestamp: "2025-01-23T15:30:56.890Z",
	url: "https://heroes-web-ru26.nextersglobal.com/api/",
	status: 200,
	statusText: "OK",
	headers: "content-type: application/json\ncontent-length: 1234\n...",
	body: {
		results: [
			{
				ident: "req_1",
				result: { playerId: 12345, ... }
			}
		]
	},
	duration: 101,  // milliseconds
	dataStructure: {
		type: "object",
		keys: ["results"],
		keyCount: 1
	}
}
```

## Storage Architecture

### IndexedDB Integration

API logs are stored in two locations:

1. **metadata store** - Periodic snapshots of recent logs, endpoints, and stats
   - Key: `'apiMonitorLogs'`
   - Contains: Last 100 log entries, all discovered endpoints, statistics
   - Updated: Every 10 responses

2. **apiLogs store** - Individual log entries for long-term storage
   - Indexed by: timestamp, type, url, status
   - Auto-cleanup: Keeps only the 5000 most recent entries
   - Query support: Filter by type, URL pattern, status code

### Storage Methods

```javascript
// Save monitoring data (called automatically)
await storage.saveAPILogs({
	logs: [...],
	endpoints: [...],
	stats: {...}
});

// Load saved data (called on init)
const savedData = await storage.getAPILogs();

// Save individual log entries
await storage.saveAPILogEntries([...entries]);

// Query log entries with filters
const entries = await storage.getAPILogEntries({
	limit: 100,
	type: 'response',
	url: 'arena'
});

// Clear old logs (keeps 5000 most recent)
await storage.clearOldAPILogs(5000);
```

## Discovered Endpoints

As you use the API Monitor, new endpoints will be automatically discovered and tracked. Here are some commonly seen endpoints:

### Player Data
- `userGetInfo` - Player profile and stats
- `userGetGear` - Player equipment
- `userStat` - Player statistics

### Heroes & Titans
- `heroGetAll` - Complete hero roster
- `titanGetAll` - Complete titan roster
- `heroUpgrade` - Hero leveling/upgrade
- `titanUpgrade` - Titan leveling/upgrade

### Inventory & Resources
- `inventoryGet` - Complete inventory
- `shopBuy` - Shop purchases
- `chestOpen` - Chest opening

### PvP
- `arenaGetEnemies` - Arena opponent list
- `arenaBattle` - Arena battle execution
- `grandArenaGetInfo` - Grand Arena info
- `titanArenaGetInfo` - Titan Arena info

### Guild
- `guildGetInfo` - Guild information
- `guildGetMembers` - Guild member list
- `guildWarGetInfo` - Guild War data
- `guildRaidGetInfo` - Guild Raid data

### Missions & Quests
- `missionGetInfo` - Campaign mission data
- `questGetInfo` - Quest/task information
- `dailyBonusGet` - Daily bonus status

### Chat
- `chatGetMessages` - Chat message retrieval
- `chatSendMessage` - Send chat message

## Integration with GameTracker

The API Monitor **complements** the existing GameTracker:

- **APIMonitor** - Logs ALL API calls for discovery and debugging
- **GameTracker** - Extracts and processes specific data for tracking

Both can run simultaneously:
1. APIMonitor intercepts and logs everything
2. GameTracker processes known endpoints for game tracking
3. Use APIMonitor logs to find NEW endpoints to add to GameTracker

## Console Output

The API Monitor provides detailed console logging:

```
[APIMonitor] Initialized - monitoring all Hero Wars API calls
[APIMonitor] Access logs via window.apiMonitor.getLogs()
[APIMonitor] Export logs via window.apiMonitor.exportLogs()
[APIMonitor] XMLHttpRequest interception enabled
[APIMonitor] Fetch API interception enabled
[APIMonitor] Loaded 34 previously discovered endpoints

[APIMonitor] → REQUEST: {
  url: "https://heroes-web-ru26.nextersglobal.com/api/",
  endpoints: ["userGetInfo", "heroGetAll"],
  body: { calls: [...] }
}

[APIMonitor] ← RESPONSE (125ms): {
  url: "https://heroes-web-ru26.nextersglobal.com/api/",
  status: 200,
  body: { results: [...] },
  dataStructure: { type: "object", keys: ["results"], ... }
}

[APIMonitor] 🆕 New endpoint discovered: petGetAll
[APIMonitor] Logs saved to IndexedDB
```

## Performance Considerations

### Memory Management
- **Log size limit**: 1000 entries in memory (oldest dropped)
- **Periodic saves**: Every 10 responses to IndexedDB
- **Auto-cleanup**: Keeps 5000 most recent entries in database

### Impact on Game Performance
- **Minimal overhead**: Logging is asynchronous
- **No request modification**: Only observes, doesn't change requests
- **Conditional logging**: Only logs Hero Wars API calls (*.nextersglobal.com/api/)

### Best Practices
1. **Export regularly** - Download logs for external analysis
2. **Clear when done** - Use `apiMonitor.clearLogs()` after exporting
3. **Filter queries** - Use specific filters when querying large datasets
4. **Disable if needed** - Comment out initialization in index.js if not needed

## Troubleshooting

### No Logs Appearing

**Check initialization:**
```javascript
// Should see these in console
[APIMonitor] Initialized - monitoring all Hero Wars API calls
[APIMonitor] XMLHttpRequest interception enabled
[APIMonitor] Fetch API interception enabled
```

**Verify API calls are happening:**
- Open browser DevTools → Network tab
- Look for calls to `*.nextersglobal.com/api/`
- If none appear, the game may not be loaded yet

### Global Object Not Available

```javascript
// Check if apiMonitor exists
if (window.apiMonitor) {
	console.log('API Monitor ready!');
} else {
	console.error('API Monitor not initialized');
}
```

### Storage Errors

```javascript
// Check IndexedDB
const dbs = await indexedDB.databases();
console.log('Databases:', dbs);

// Look for OrganizedJihad database version 5
// Should see: { name: "OrganizedJihad", version: 5 }
```

## API Reference

### APIMonitor Class

#### Constructor
```javascript
new APIMonitor(storage)
```
- `storage` - IndexedDBStorage instance

#### Methods

**init()**
```javascript
await apiMonitor.init()
```
Initialize monitoring and set up interception

**getLogs()**
```javascript
const logs = apiMonitor.getLogs()
```
Returns: Array of all request/response log entries

**getEndpoints()**
```javascript
const endpoints = apiMonitor.getEndpoints()
```
Returns: Array of discovered endpoints with statistics

**getStats()**
```javascript
const stats = apiMonitor.getStats()
```
Returns: Monitoring statistics object

**exportLogs()**
```javascript
const jsonString = apiMonitor.exportLogs()
```
Returns: JSON string and downloads file

**generateDocumentation()**
```javascript
const markdown = apiMonitor.generateDocumentation()
```
Returns: Markdown documentation string and downloads file

**clearLogs()**
```javascript
apiMonitor.clearLogs()
```
Clears all in-memory logs

**addListener(callback)**
```javascript
apiMonitor.addListener((type, data) => {
	console.log(type, data);
})
```
Add real-time event listener

**removeListener(callback)**
```javascript
apiMonitor.removeListener(callback)
```
Remove event listener

## Next Steps

### Discovering New Endpoints

1. **Play the game normally** - Visit different areas (Arena, Guild, Tower, etc.)
2. **Check discovered endpoints** - `console.table(apiMonitor.getEndpoints())`
3. **Export logs** - `apiMonitor.exportLogs()`
4. **Analyze structures** - Look for new data to track
5. **Add to GameTracker** - Implement tracking for valuable new endpoints

### Contributing Discoveries

If you discover new endpoints that would be valuable to track:

1. Export your logs
2. Document the endpoint name and purpose
3. Include sample request/response structures
4. Note which game actions trigger the endpoint
5. Share findings for integration into GameTracker

## References

- [XMLHttpRequest - MDN](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest)
- [Fetch API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Proxy Pattern - MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
- [IndexedDB API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [TamperMonkey Documentation](https://www.tampermonkey.net/documentation.php)

---

**Last Updated:** 2025-01-23  
**Module Version:** 1.0.0  
**Compatible with:** OrganizedJihad v2.0.0+
