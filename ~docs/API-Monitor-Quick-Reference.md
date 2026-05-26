# API Monitor - Quick Reference Card

**Module:** `apiMonitor.js` | **Version:** 1.0.0 | **Status:** Production Ready

## Installation

```bash
# 1. Build (already done)
cd userscript && yarn build

# 2. Install in browser
# Open: userscript/dist/organized-jihad.user.js
# TamperMonkey will prompt to install/update

# 3. Visit Hero Wars
# Navigate to: https://www.hero-wars.com/

# 4. Verify installation
# Open browser console (F12)
# Look for: [APIMonitor] Initialized - monitoring all Hero Wars API calls
```

## Quick Start

```javascript
// Open browser console (F12) on Hero Wars

// Check if monitor is running
window.apiMonitor // Should return APIMonitor object

// View discovered endpoints
console.table(apiMonitor.getEndpoints())

// View recent logs (last 10)
apiMonitor.getLogs().slice(-10)

// Get statistics
apiMonitor.getStats()
```

## Essential Commands

### View Logs
```javascript
// All logs
apiMonitor.getLogs()

// Only requests
apiMonitor.getLogs().filter(log => log.type === 'request')

// Only responses
apiMonitor.getLogs().filter(log => log.type === 'response')

// Logs containing specific endpoint
apiMonitor.getLogs().filter(log => 
	log.endpoints?.includes('userGetInfo')
)

// Logs for specific URL pattern
apiMonitor.getLogs().filter(log => 
	log.url.includes('arena')
)

// Recent logs (last N)
apiMonitor.getLogs().slice(-20)
```

### Endpoint Discovery
```javascript
// All discovered endpoints (sorted by call count)
apiMonitor.getEndpoints()

// Display as table
console.table(apiMonitor.getEndpoints())

// Get specific endpoint stats
apiMonitor.getEndpoints().find(e => e.name === 'userGetInfo')

// Most frequently called
apiMonitor.getEndpoints()[0]

// Recently discovered (sort by firstSeen)
apiMonitor.getEndpoints().sort((a, b) => 
	new Date(b.firstSeen) - new Date(a.firstSeen)
)
```

### Statistics
```javascript
// Full stats
apiMonitor.getStats()

// Specific metrics
const stats = apiMonitor.getStats()
console.log(`Requests: ${stats.totalRequests}`)
console.log(`Success Rate: ${(stats.successfulRequests/stats.totalResponses*100).toFixed(2)}%`)
console.log(`Endpoints: ${stats.endpointCount}`)
console.log(`Uptime: ${(stats.uptime/1000/60).toFixed(2)} minutes`)
```

### Export & Documentation
```javascript
// Export all logs as JSON (downloads file)
apiMonitor.exportLogs()
// → herowars-api-logs-[timestamp].json

// Generate API documentation (downloads .md file)
apiMonitor.generateDocumentation()
// → herowars-api-docs-[timestamp].md

// Get JSON string without download
const jsonString = JSON.stringify({
	endpoints: apiMonitor.getEndpoints(),
	logs: apiMonitor.getLogs(),
	stats: apiMonitor.getStats()
}, null, 2)
```

### Real-time Monitoring
```javascript
// Listen for all API events
apiMonitor.addListener((type, data) => {
	console.log(`[${type.toUpperCase()}]`, data)
})

// Listen for specific endpoint
apiMonitor.addListener((type, data) => {
	if (data.endpoints?.includes('arenaBattle')) {
		console.log('⚔️ Arena battle detected!', data)
	}
})

// Listen for new discoveries
apiMonitor.addListener((type, data) => {
	if (type === 'request' && data.endpoints) {
		data.endpoints.forEach(endpoint => {
			const isNew = !apiMonitor.getEndpoints()
				.some(e => e.name === endpoint)
			if (isNew) {
				console.log('🆕 NEW ENDPOINT:', endpoint)
			}
		})
	}
})
```

### Maintenance
```javascript
// Clear in-memory logs
apiMonitor.clearLogs()

// Check IndexedDB storage (requires storage access)
// Note: API monitor saves to storage automatically
```

## Common Use Cases

### Find Arena-Related Endpoints
```javascript
// Play some arena battles, then:
const arenaLogs = apiMonitor.getLogs().filter(log => 
	log.url.includes('arena') || 
	log.endpoints?.some(e => e.toLowerCase().includes('arena'))
)

// Extract unique arena endpoints
const arenaEndpoints = [...new Set(
	arenaLogs.flatMap(log => log.endpoints || [])
)].filter(e => e.toLowerCase().includes('arena'))

console.log('Arena Endpoints:', arenaEndpoints)
```

### Monitor Guild Activity
```javascript
// Visit guild page, then:
const guildLogs = apiMonitor.getLogs().filter(log => 
	log.endpoints?.some(e => e.toLowerCase().includes('guild'))
)

console.table(guildLogs.map(log => ({
	time: log.timestamp,
	endpoints: log.endpoints?.join(', ')
})))
```

### Track Shop Purchases
```javascript
// Make a purchase, then:
const shopLogs = apiMonitor.getLogs().filter(log => 
	log.endpoints?.some(e => e.toLowerCase().includes('shop') || e.toLowerCase().includes('buy'))
)

// Look at request bodies
shopLogs.forEach(log => {
	if (log.type === 'request') {
		console.log('Purchase Request:', log.body)
	}
})
```

### Analyze Response Structures
```javascript
// Get a specific endpoint's responses
const responses = apiMonitor.getLogs().filter(log => 
	log.type === 'response' && 
	log.dataStructure
)

// View data structures
responses.forEach(res => {
	console.log(`${res.url}:`, res.dataStructure)
})
```

## Console Output Reference

### Initialization
```
[APIMonitor] Initialized - monitoring all Hero Wars API calls
[APIMonitor] Access logs via window.apiMonitor.getLogs()
[APIMonitor] Export logs via window.apiMonitor.exportLogs()
[APIMonitor] XMLHttpRequest interception enabled
[APIMonitor] Fetch API interception enabled
[APIMonitor] Loaded 34 previously discovered endpoints
```

### Request Logged
```
[APIMonitor] → REQUEST: {
	url: "https://heroes-web-ru26.nextersglobal.com/api/",
	endpoints: ["userGetInfo", "heroGetAll"],
	body: { calls: [...] }
}
```

### Response Logged
```
[APIMonitor] ← RESPONSE (125ms): {
	url: "https://heroes-web-ru26.nextersglobal.com/api/",
	status: 200,
	body: { results: [...] },
	dataStructure: { type: "object", keys: ["results"], keyCount: 1 }
}
```

### New Endpoint Discovery
```
[APIMonitor] 🆕 New endpoint discovered: petGetAll
```

### Storage Save
```
[APIMonitor] Logs saved to IndexedDB
```

## Troubleshooting

### "apiMonitor is not defined"
```javascript
// Check if initialized
if (typeof window.apiMonitor === 'undefined') {
	console.error('API Monitor not initialized')
	console.log('Check userscript is installed and active')
}
```

### No Logs Appearing
```javascript
// 1. Verify monitor is running
apiMonitor.isMonitoring // Should be true

// 2. Check if any requests detected
apiMonitor.getStats().totalRequests // Should be > 0

// 3. Perform an action in game (open inventory, visit arena, etc.)

// 4. Check network tab
// Should see requests to: *.nextersglobal.com/api/
```

### Large Log Size
```javascript
// Check current size
apiMonitor.getLogs().length // Max 1000

// Export and clear if needed
apiMonitor.exportLogs()
apiMonitor.clearLogs()

// Verify cleared
apiMonitor.getLogs().length // Should be 0
```

### Performance Issues
```javascript
// Check memory usage
console.log('Logs in memory:', apiMonitor.getLogs().length)
console.log('Endpoints tracked:', apiMonitor.getEndpoints().length)

// Clear if too large
if (apiMonitor.getLogs().length > 800) {
	apiMonitor.exportLogs() // Save first
	apiMonitor.clearLogs()   // Then clear
}
```

## API Method Reference

| Method | Returns | Description |
|--------|---------|-------------|
| `getLogs()` | `Array` | All request/response log entries |
| `getEndpoints()` | `Array` | Discovered endpoints with stats |
| `getStats()` | `Object` | Monitoring statistics |
| `exportLogs()` | `String` | JSON export (auto-downloads) |
| `generateDocumentation()` | `String` | Markdown docs (auto-downloads) |
| `clearLogs()` | `void` | Clear in-memory logs |
| `addListener(callback)` | `void` | Add real-time event listener |
| `removeListener(callback)` | `void` | Remove event listener |

## Data Structures

### Endpoint Object
```javascript
{
	name: "userGetInfo",           // Endpoint name
	firstSeen: "2025-01-23T...",   // ISO timestamp
	lastSeen: "2025-01-23T...",    // ISO timestamp
	callCount: 45                   // Number of calls
}
```

### Request Log
```javascript
{
	id: "req_1706023456789_abc123",
	type: "request",
	timestamp: "2025-01-23T15:30:56.789Z",
	method: "POST",
	url: "https://heroes-web-ru26.nextersglobal.com/api/",
	headers: {...},
	body: { calls: [...] },
	endpoints: ["userGetInfo"],
	startTime: 1706023456789
}
```

### Response Log
```javascript
{
	id: "res_1706023456890_def456",
	type: "response",
	timestamp: "2025-01-23T15:30:56.890Z",
	url: "https://heroes-web-ru26.nextersglobal.com/api/",
	status: 200,
	statusText: "OK",
	headers: "...",
	body: { results: [...] },
	duration: 101,
	dataStructure: {...}
}
```

### Stats Object
```javascript
{
	totalRequests: 234,
	totalResponses: 232,
	successfulRequests: 230,
	failedRequests: 2,
	startTime: 1706023456789,
	uptime: 1847231,           // milliseconds
	endpointCount: 45,
	logSize: 468
}
```

## Best Practices

✅ **DO:**
- Export logs before clearing
- Use `console.table()` for readable endpoint display
- Filter logs to find specific data
- Add listeners for real-time monitoring of important endpoints
- Check stats periodically to track discovery progress

❌ **DON'T:**
- Let logs grow indefinitely (export and clear periodically)
- Modify the intercepted requests (observation only)
- Rely on logs for critical game data (use GameTracker instead)
- Disable the monitor if you want to discover new endpoints

## Performance Tips

1. **Export regularly** - Download logs every 30-60 minutes
2. **Clear after export** - Free memory after saving
3. **Use filters** - Don't process entire log array unnecessarily
4. **Limit listeners** - Too many listeners = performance hit
5. **Check size** - Monitor `getLogs().length` periodically

## Integration with GameTracker

```javascript
// API Monitor discovers endpoints → GameTracker implements tracking

// 1. Use API Monitor to find new endpoints
const endpoints = apiMonitor.getEndpoints()

// 2. Identify valuable data sources
const valuable = endpoints.filter(e => 
	e.callCount > 10 && // Frequently called
	!e.name.includes('Get') // Not just data retrieval
)

// 3. Export example request/response
apiMonitor.exportLogs()

// 4. Analyze exported data to understand structure

// 5. Implement tracking in GameTracker module
// (Requires code changes, not console commands)
```

## Quick Discovery Workflow

```javascript
// 1. Start monitoring
console.log('API Monitor Status:', apiMonitor.isMonitoring)

// 2. Play game for 10-15 minutes
// - Visit all major areas
// - Perform various actions
// - Trigger different game modes

// 3. Check discoveries
console.log(`Discovered ${apiMonitor.getEndpoints().length} endpoints`)
console.table(apiMonitor.getEndpoints())

// 4. Export findings
apiMonitor.exportLogs()
apiMonitor.generateDocumentation()

// 5. Clear for next session
apiMonitor.clearLogs()
```

---

**For full documentation, see:** `~docs/API-Monitoring-Guide.md`  
**For implementation details, see:** `~docs/copilot-chats/2025-01-23-api-monitoring-enhancement.md`

**Quick Support:** Open browser console → `window.apiMonitor` → Access all features
