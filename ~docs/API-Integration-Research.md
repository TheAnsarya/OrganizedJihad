# Hero Wars API Integration Research Summary
**Date**: 2025-01-21  
**Project**: OrganizedJihad - Hero Wars Tracker

## Research Sources

### Primary References
1. **HeroWarsHelper Script**: https://greasyfork.org/en/scripts/450693-herowarshelper
   - Comprehensive TamperMonkey script for Hero Wars automation
   - Source code available at: https://update.greasyfork.org/scripts/450693/HeroWarsHelper.user.js

2. **Hero Wars Assistant (Browser Extension)**: https://hw-assist.com/
   - Community gifts auto-collection
   - Daily automation scripts (Tower, Expeditions, Tournament, Dungeon)
   - Endless arena/guild war logs with filtering
   - Guild War scouting reports

## Key Technical Findings

### Hero Wars API Architecture

#### API Endpoint Pattern
```
POST https://*.nextersglobal.com/api/
```
- Uses HTTPS POST requests to Nexters Global servers
- Specific pattern: URL ends with `/api/` (regex: `/api\/$/`)

#### Request Format
```javascript
{
	"calls": [
		{
			"name": "userGetInfo",      // API method name
			"args": {},                  // Method arguments
			"ident": "body",             // Identifier for response matching
			"context": {
				"actionTs": 1234567890   // Timestamp from performance.now()
			}
		},
		{
			"name": "heroGetAll",
			"args": {},
			"ident": "heroGetAll"
		}
	]
}
```

#### Response Format
```javascript
{
	"results": [
		{
			"ident": "body",                    // Matches request ident
			"result": {
				"response": { /* actual data */ },  // Main response data
				// Additional metadata fields...
			}
		}
	],
	"error": null  // Only present if request failed
}
```

### Common API Methods

Based on HeroWarsHelper analysis:

#### Player Data
- `userGetInfo` - Player level, VIP, resources, guild, refillables (energy, etc)
- `registration` - Initial player registration/login

#### Heroes & Titans
- `heroGetAll` - Complete hero roster with stats, power, skills, artifacts
- `titanGetAll` - Titan roster
- `heroUpgradeSkill` - Level up hero skills
- `heroArtifactLevelUp` - Upgrade hero artifacts
- `heroSkinUpgrade` - Upgrade hero skins

#### Inventory
- `inventoryGet` - All items, consumables, fragments, coins, gear
- `inventorySell` - Sell items
- `consumableUseLootBox` - Open loot boxes

#### Battles
- `missionStart` / `missionEnd` - Campaign missions
- `towerStartBattle` / `towerEnd` - Tower battles
- `arenaStart` / `arenaEnd` - Arena battles
- `bossStart` / `bossEnd` - Outland boss battles
- `dungeonStartBattle` / `dungeonEnd` - Guild dungeon

#### Quests & Events
- `questGetAll` - All available quests with progress
- `questFarm` - Collect quest rewards
- `offerGetAll` - Special offers and events
- `offerFarmReward` - Collect event rewards

#### Guild/Clan
- `clanGetInfo` - Guild information and members
- `clanWarGetInfo` - Guild war status and attempts
- `clanGetWeeklyStat` - Member activity statistics

#### Shop & Economy
- `shopGetAll` - All available shops
- `shopBuy` - Purchase items
- `billingGetAll` - Donation offers (for filtering)

#### Expeditions & Adventures
- `expeditionGet` - Expedition status
- `expeditionFarm` - Collect expedition rewards
- `adventure_getInfo` - Adventure/Sanctuary info
- `adventure_turnStartBattle` - Start adventure battle

#### Mail
- `mailGetAll` - Inbox messages
- `mailFarm` - Collect mail rewards

### Data Interception Pattern

#### XMLHttpRequest Proxying
```javascript
// 1. Save original methods
const originalXHR = {
	open: XMLHttpRequest.prototype.open,
	send: XMLHttpRequest.prototype.send,
	setRequestHeader: XMLHttpRequest.prototype.setRequestHeader
};

// 2. Override open() to detect API URL
XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
	// Detect Hero Wars API pattern
	if (method === 'POST' && url.includes('.nextersglobal.com/api/')) {
		this._trackingData = { /* store request metadata */ };
	}
	return originalXHR.open.call(this, method, url, async, user, password);
};

// 3. Override send() to capture request data
XMLHttpRequest.prototype.send = function(data) {
	if (this._trackingData) {
		const requestData = JSON.parse(data);
		// Store for later processing
		
		// Proxy onreadystatechange to capture response
		const originalHandler = this.onreadystatechange;
		this.onreadystatechange = function() {
			if (this.readyState === 4 && this.status === 200) {
				const responseData = JSON.parse(this.responseText);
				// Process captured data
				processAPIResponse(requestData, responseData);
			}
			if (originalHandler) return originalHandler.apply(this, arguments);
		};
	}
	return originalXHR.send.call(this, data);
};
```

### Data Structures

#### userGetInfo Response
```javascript
{
	userId: 12345,
	name: "PlayerName",
	level: 130,
	vipLevel: 15,
	gold: 5000000,
	starmoney: 25000,  // Emeralds
	clanId: 67890,
	clanTitle: "Guild Name",
	refillable: [
		{id: 1, amount: 150},   // Energy/Stamina
		{id: 45, amount: 5},    // Portal Spheres
		{id: 48, amount: 3}     // Guild War Attempts
	],
	nextDayTs: 1737504000,     // Timestamp for next day
	timeZone: -5
}
```

#### heroGetAll Response
```javascript
{
	"1": {  // Hero ID
		id: 1,
		level: 130,
		star: 6,        // Star rank
		color: 18,      // Promotion/evolution level
		power: 198058,
		xp: 3625195,
		skills: {
			2: 130,     // Skill ID: level
			3: 130,
			4: 130,
			5: 130
		},
		artifacts: [
			{level: 130, star: 6},
			{level: 130, star: 6},
			{level: 130, star: 6}
		],
		skins: {
			1: 60,      // Skin ID: level
			54: 60
		},
		currentSkin: 0,
		petId: 6004    // Patronage pet
	}
	// ... more heroes
}
```

#### inventoryGet Response
```javascript
{
	consumable: {
		81: 150,    // Prophecy Cards
		148: 25     // Platinum Boxes
	},
	gear: {
		1: 50,      // Equipment pieces
		2: 30
	},
	fragmentHero: {
		1: 100,     // Hero soul stones
		13: 250
	},
	coin: {
		7: 5000,    // Skull Coins
		18: 10000,  // Guild War Coins
		19: 8000    // Titan Arena Coins
	}
}
```

## Important Warnings

### From HeroWarsHelper Documentation
> "Using the script may result in a ban in the game"

### Cheating vs. Tracking
The HeroWarsHelper script includes features that MODIFY game data:
- Battle result manipulation (forcing wins)
- Resource generation (infinite cards)
- Subscription status spoofing

**OrganizedJihad's Approach**: READ-ONLY tracking
- **NO** data modification
- **NO** request alteration
- **ONLY** passive observation for progress tracking
- Legitimate use case: Personal analytics dashboard

## Implementation in OrganizedJihad

### Implemented Features (Read-Only)
✅ API request/response interception  
✅ Player stats tracking (level, VIP, resources)  
✅ Hero roster monitoring (power, levels, skills)  
✅ Inventory tracking (gold, emeralds, items)  
✅ Battle results logging (for analytics)  
✅ Quest progress monitoring  
✅ Guild/clan data capture  

### NOT Implemented (Cheating Features)
❌ Battle result modification  
❌ Resource generation/manipulation  
❌ Subscription spoofing  
❌ Auto-battle/automation  
❌ Any data alteration whatsoever  

### Safety Measures
1. **No Request Modification**: Original XHR send() passes data unchanged
2. **No Response Manipulation**: Response text remains intact
3. **Logging Only**: All captured data saved to local storage only
4. **Console Prefixing**: All logs tagged with `[OrganizedJihad]` for transparency
5. **Restore on Destroy**: Original XHR methods restored when tracker stops

## Testing Recommendations

1. **Install in TamperMonkey**: Load `dist/organized-jihad.user.js`
2. **Open Hero Wars**: Navigate to https://www.hero-wars.com
3. **Watch Console**: Look for `[OrganizedJihad]` messages:
   - "GameTracker initialized - monitoring Hero Wars API"
   - "Detected Hero Wars API URL: ..."
   - "Player data updated: [Name] Level [X]"
   - "Heroes updated: X heroes tracked"
4. **Check Storage**: DevTools → Application → Local Storage / GM Storage
   - `playerData` - Current player stats
   - `heroesData` - Hero roster
   - `inventoryData` - Resources
   - `gameHistory` - Historical snapshots

## Hero Wars Assistant Extension Analysis

### Extension Architecture (from manifest.json)

**Version**: 3.3.3  
**Manifest Version**: 3 (Modern Chrome extension)  
**Service Worker**: background.js

#### Supported Platforms
The extension works across all Hero Wars platforms:
- VK: `https://i-heroes-vk.nextersglobal.com/*`
- OK: `https://i-heroes-ok.nextersglobal.com/*`
- Facebook: `https://i-heroes-fb.nextersglobal.com/*` & `https://i.hero-wars-fb.com/*`
- Mail.ru: `https://i-heroes-mm.nextersglobal.com/*`
- Web: `https://i-heroes-wb.nextersglobal.com/*`
- MG: `https://i-heroes-mg.nextersglobal.com/*`
- Direct: `https://hero-wars.com/*` & `https://www.hero-wars.com/*`

#### API Backend
- Primary: `https://api.hw-assist.com/*`
- Backup: `https://api.hw-asist.com/*`
- Port variant: `https://api.hw-assist.com:8084/*`

### Injection Pattern (from injected.js)

```javascript
// 1. Intercept XMLHttpRequest
const original = XMLHttpRequest.prototype;
const originalOpen = original.open;
const originalSend = original.send;
const originalSetRequestHeader = original.setRequestHeader;

// 2. Override open() to track URL and method
XMLHttpRequest.prototype.open = function(method, url) {
	this._method = method;
	this._url = url;
	this._requestHeaders = {};
	return originalOpen.apply(this, arguments);
};

// 3. Override setRequestHeader() to capture headers
XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
	this._requestHeaders[name] = value;
	return originalSetRequestHeader.apply(this, arguments);
};

// 4. Override send() to capture request/response
XMLHttpRequest.prototype.send = function(postData) {
	this.addEventListener('load', function() {
		// Check if this is a Hero Wars API call
		const url = this._url && this._url.toLowerCase();
		if (url && isHeroWarsAPI(url)) {
			// Decode request data
			let requestBody = '';
			if (typeof postData === 'string') {
				requestBody = postData;
			} else if (typeof postData === 'object' && this._method === 'POST') {
				const decoder = new TextDecoder('utf-8');
				requestBody = decoder.decode(postData);
			}
			
			// Send to content script via custom event
			const interceptedData = {
				url: this._url,
				requestHeaders: this._requestHeaders,
				responseBody: this.responseText,
				requestBody: requestBody,
				method: this._method,
				responseHeaders: this.getAllResponseHeaders(),
				responseType: this.responseType,
				ts: Date.now()
			};
			
			// Dispatch custom event
			const event = new CustomEvent('HeroWarsInterceptedDataEvent', {
				detail: interceptedData
			});
			document.dispatchEvent(event);
		}
	});
	
	return originalSend.apply(this, arguments);
};
```

### Data Handler Pattern (from lib/)

The extension uses modular handlers for different API endpoints:

```javascript
// Handler structure
const handler = {
	calls: ["apiMethodName"],      // API methods this handler tracks
	results: ["body", "group_1_body"],  // Expected result identifiers
	handle: function(request, response, url, platform) {
		// 1. Find the relevant call
		const call = findCallByName(request.calls, handler.calls);
		if (!call) return;
		
		// 2. Extract the response data
		const ident = call.ident;
		const data = findByIdent(response.results, [ident]).result.response;
		
		// 3. Process and save
		data.ts = Date.now();
		sendAndSaveData(data, "handler_key");
		
		// 4. Update IndexedDB
		updateIndexDBCacheFor("handler_key");
	}
};
```

### Specific Handler Examples

#### Arena Enemies Handler (arena-cur-enemies.js)
```javascript
const arena_cur_enemies_handler = {
	calls: ["arenaFindEnemies"],
	results: ["body", "group_1_body"],
	handle: function(request, response, url, platform) {
		const ident = findIdentByCalls(request.calls, this.calls);
		const enemies = findByIdent(response.results, [ident]).result.response;
		sendAndSaveData({
			enemies: enemies,
			type: "arena"
		}, "arena_cur_enemies");
	}
};

const arena_cur_enemies_handler2 = {
	calls: ["arenaAttack"],
	results: ["body", "group_1_body"],
	handle: function(request, response, url, platform) {
		const ident = findIdentByCalls(request.calls, this.calls);
		const enemies = findByIdent(response.results, [ident]).result.response.enemies;
		sendAndSaveData({
			enemies: enemies,
			type: "arena"
		}, "arena_cur_enemies");
	}
};
```

#### Guild Stats Handler (guild-stats.js)
```javascript
const clanGetWeeklyStat_handler = {
	calls: ["clanGetWeeklyStat"],
	results: ["body", "group_1_body"],
	handle: function(request, response, url, platform) {
		const call = findCallByName(request.calls, this.calls);
		if (call) {
			const ident = call.ident;
			const stats = findByIdent(response.results, [ident]).result.response;
			stats.ts = Date.now();
			sendAndSaveData(stats, "clanGetWeeklyStat");
		}
	}
};

const clanGetInfo_handler = {
	calls: ["clanGetInfo"],
	results: ["body", "group_1_body"],
	handle: function(request, response, url, platform) {
		const call = findCallByName(request.calls, this.calls);
		if (call) {
			const ident = call.ident;
			const clanInfo = findByIdent(response.results, [ident]).result.response;
			if (clanInfo && clanInfo.clan && clanInfo.clan.members) {
				const members = clanInfo.clan.members;
				// Save to IndexedDB
				db.users.bulkPut(Object.values(members)).then(count => {
					console.log("clanGetInfo: " + count + " users updated");
				});
			}
		}
	}
};
```

### Utility Functions (utils.js)

```javascript
// Extract API call names from request
function extractCalls(request) {
	return request && request.calls 
		? request.calls.map(c => c.name) 
		: [];
}

// Extract result identifiers from response
function extractResults(response) {
	return response && response.results 
		? response.results.map(r => r.ident) 
		: [];
}

// Find result by identifier
function findByIdent(results, identifiers) {
	return results.find(r => identifiers.includes(r.ident));
}

// Find call by method name
function findCallByName(calls, methodNames) {
	return calls.find(c => methodNames.includes(c.name));
}

// Find identifier by call name
function findIdentByCalls(calls, methodNames) {
	const call = calls.find(c => methodNames.includes(c.name));
	return call ? call.ident : undefined;
}

// Determine platform from URL
function platform(url) {
	if (url.includes("heroes-vk")) return "vk";
	if (url.includes("heroes-ok")) return "ok";
	if (url.includes("heroes-fb")) return "fb";
	if (url.includes("heroes-mm")) return "mm";
	if (url.includes("heroes-wb")) return "wb";
	if (url.includes("heroes-mg")) return "mg";
	return "unknown_platform: " + url;
}
```

### Data Storage Strategy

#### Chrome Storage (Local)
Used for persistent cache:
```javascript
function sendAndSaveData(data, key) {
	GLOBAL_CACHE[key] = data;
	GLOBAL_CACHE_PERSISTED[key] = false;
	
	// Send to background script
	chrome.runtime.sendMessage({
		from: "regUpdate",
		subject: key
	});
}

function persistCache() {
	Object.keys(GLOBAL_CACHE_PERSISTED).forEach(key => {
		if (!GLOBAL_CACHE_PERSISTED[key]) {
			const storageObj = {};
			storageObj[key] = GLOBAL_CACHE[key];
			GLOBAL_CACHE_PERSISTED[key] = true;
			chrome.storage.local.set(storageObj);
		}
	});
}
```

#### IndexedDB (via Dexie.js)
Used for structured data (replays, teams, users):
```javascript
// Database schema
const db = new Dexie("HeroWarsAssistant");
db.version(1).stores({
	users: "id, name, level, clan",
	userTeams: "userId, ts",
	a_replays: "id, attackerId, defenderId, startTime",
	// ... other tables
});

// Bulk operations
async function updateUsersDb(users) {
	const userArray = Object.values(users);
	if (userArray && userArray.length > 0) {
		const timestamp = Date.now();
		for (const user of userArray) {
			user.dnow = timestamp;
		}
		await db.users.bulkPut(userArray);
	}
}
```

### Team Data Compression

To save storage space, hero data is compressed:

```javascript
const HERO_FIELDS_TO_COMPRESS = [
	"agility", "armor", "armorPenetration", "artifacts", "ascensions",
	"color", "favorPetId", "favorPower", "hp", "intelligence", "level",
	"magicPower", "magicResist", "perks", "petId", "physicalAttack",
	"power", "runes", "skills", "skins", "slots", "star", "strength",
	"titanGiftLevel", "magicPenetration", "type", "elementAttack",
	"elementArmor", "elementSpiritPower", "element", "elementSpiritLevel",
	"elementSpiritStar", "scale", "dodge", "physicalCritChance"
];

function compressHero(hero) {
	const compressed = [];
	HERO_FIELDS_TO_COMPRESS.forEach(field => {
		compressed.push(hero[field]);
	});
	return compressed;
}

function uncompressHero(compressed) {
	const hero = { id: compressed.id, ts: compressed.ts };
	for (let i = 0; i < compressed.c.length; i++) {
		hero[HERO_FIELDS_TO_COMPRESS[i]] = compressed.c[i];
	}
	return hero;
}
```

### Gift Collection System

The extension automatically collects community gifts:

```javascript
const freebieCheck = {
	calls: ["freebieCheck"],
	results: ["freebieCheck"],
	handle: function(request, response, url, platform) {
		const call = findCallByName(request.calls, this.calls);
		if (call && call.args && call.args.giftId) {
			const ident = call.ident;
			const giftData = findByIdent(response.results, [ident]).result.response;
			
			// Save gift as collected
			saveGiftsCollected(platform, call.args.giftId);
			
			if (giftData) {
				giftData.giftId = call.args.giftId;
				giftData.referrer = "group_posting";
				sendAndSaveData(giftData, "freebieCheck");
				
				// Send to backend server
				sendGiftToServer({
					giftId: giftData.giftId,
					referrer: giftData.referrer,
					platform: platform.platform,
					type: giftData.type,
					reward: JSON.stringify(giftData.reward),
					id: giftData.id
				}, platform);
			}
		}
	}
};
```

### Platform-Specific Gift Links

```javascript
const provider = {
	vk: {
		ident: "vkontakte",
		color: "#4680c2",
		h: {
			def: "https://vk.com/bestmoba",
			g_r: "ad_id",  // Gift referrer parameter
			g_d: "#"       // Gift delimiter
		}
	},
	ok: {
		ident: "odnoklassniki",
		color: "#eb722e",
		h: {
			def: "https://ok.ru/game/moba",
			g_r: "refplace",
			g_d: "&"
		}
	},
	fb: {
		ident: "facebook",
		color: "#3b5998",
		h: {
			def: "https://apps.facebook.com/mobaheroes/",
			g_r: "nx_source",
			g_d: "&"
		}
	},
	// ... more platforms
};

function get_gift_link(platform, giftId, referrer) {
	const config = provider[platform];
	let url = config.h.def;
	
	if (referrer) {
		if (platform === "fb") {
			return getFbGiftUrl(giftId);
		}
		url += "?" + config.h.g_r + "=" + referrer + 
		       config.h.g_d + "gift_id=" + giftId;
	} else {
		if (platform === "fb") {
			return getFbGiftUrl(giftId);
		}
		const delimiter = (config.h.g_d === "&") ? "?" : "#";
		url += delimiter + "gift_id=" + giftId;
	}
	
	return url;
}
```

## References & Resources

### Technical Documentation
- **MDN XHR Guide**: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
- **TamperMonkey API**: https://www.tampermonkey.net/documentation.php
- **GM Storage API**: https://wiki.greasespot.net/GM.setValue
- **Custom Events**: https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
- **TextDecoder API**: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder
- **Chrome Extension Manifest V3**: https://developer.chrome.com/docs/extensions/mv3/
- **Dexie.js (IndexedDB)**: https://dexie.org/

### Related Projects
- **HeroWarsHelper**: https://greasyfork.org/en/scripts/450693-herowarshelper
- **Hero Wars Assistant**: https://hw-assist.com/
- **HW Calc**: https://hwcalc.com/ (team calculator)

### Hero Wars Community
- **Official Site**: https://www.hero-wars.com
- **Nexters Global**: Developer/publisher
- **Telegram Communities**: Various game strategy groups

## UI Architecture Analysis

### Extension UI Stack

**Framework**: Angular (compiled to production bundles)  
**Routing**: Hash-based routing (`/#/notifications`, `/#/settings`)  
**Assets**: Bundled with webpack  
**Styling**: External CSS with hero/pet background gradients by color tier

### UI Entry Points (from menu.js)

The extension provides 4 main UI access points via context menu:

```javascript
// 1. Main Plugin Interface
{
	title: "Open HWA plugin",
	url: chrome.runtime.getURL("/dist/index.html")
}

// 2. Quick Game Access (with auto-gift collection)
{
	title: "Open game",
	onclick: function() {
		// Load user data from cache
		getCacheOrLoad([
			"settings",
			"clanwar_user_info",
			"cur_user",
			"gifts",
			"clanwar_user"
		]).then(data => {
			openHwWithGiftIfPossible(data);
		});
	}
}

// 3. Notifications View
{
	title: "Notifications",
	url: chrome.runtime.getURL("/dist/index.html?/#/notifications")
}

// 4. Settings Panel
{
	title: "Settings",
	url: chrome.runtime.getURL("/dist/index.html?/#/settings")
}
```

### Visual Design System

#### Hero/Pet Background Colors by Tier

The extension uses color-coded backgrounds for different hero/pet tiers:

```
White tier:  bg_hero_white.png / bg_pet_white.png
Green tier:  bg_hero_green.png / bg_pet_green.png  
Blue tier:   bg_hero_blue.png / bg_pet_blue.png
Purple tier: bg_hero_purple.png / bg_pet_purple.png
Gold tier:   bg_hero_gold.png
Red tier:    bg_hero_red.png (legendary)
```

These correspond to Hero Wars promotion levels:
- White: Base (0 stars)
- Green: 1-2 stars
- Blue: 3-4 stars
- Purple: 5-6 stars (Violet)
- Gold: Absolute Star
- Red: Special/event heroes

#### Icon System

**Font Awesome** integration for UI icons:
- `fontawesome-webfont.woff2` (modern browsers)
- `fontawesome-webfont.woff` (legacy support)
- `fontawesome-webfont.ttf` (fallback)
- `fontawesome-webfont.svg` (vector fallback)

### Communication Between Components

#### Content Script → Background Script

```javascript
// Send intercepted data
chrome.runtime.sendMessage({
	from: "regUpdate",     // Update type
	subject: "dataKey"     // Data identifier
});

// Request IndexedDB update
chrome.runtime.sendMessage({
	from: "indexDB",
	subject: "tableName"
});
```

#### Injected Script → Content Script

```javascript
// Custom event for passing intercepted XHR data
const event = new CustomEvent('HeroWarsInterceptedDataEvent', {
	detail: {
		url: url,
		requestHeaders: headers,
		responseBody: response,
		requestBody: request,
		method: method,
		responseHeaders: responseHeaders,
		responseType: responseType,
		ts: Date.now()
	}
});
document.dispatchEvent(event);
```

#### Game Events Monitoring

```javascript
// Hook into game's push notification system
if (window.nxg && window.nxg.getModule("pushd")) {
	const pushd = window.nxg.getModule("pushd");
	console.log("HWA: pushd initialised");
	
	pushd.on("message", function(event) {
		sendIntercepted({ gameEvent: event });
	});
}
```

### Notification System

The extension implements browser notifications for game events:

```javascript
// Permissions required
"permissions": [
	"notifications",  // Show desktop notifications
	"alarms"         // Schedule periodic checks
]

// Notification triggers (from context analysis):
// - Guild War defeats
// - Attack notifications
// - Event reminders
// - Gift availability
```

### Data Visualization Patterns

Based on the handler modules, the UI likely displays:

1. **Arena Logs** (arena-cur-enemies.js)
   - Current enemies with power levels
   - Attack history
   - Win/loss statistics

2. **Guild War Stats** (clan-raid-stats-handler.js, war-stats-count.js)
   - Member participation
   - Attack/defense maps
   - Boss replay analysis
   - Damage leaderboards

3. **Adventure Logs** (adventure-logs-handler.js)
   - Battle replays
   - Path taken
   - Rewards collected

4. **Top Arena Rankings** (top-arena-handler.js)
   - Leaderboard positions
   - Opponent analysis
   - Team compositions

5. **Guild Statistics** (guild-stats.js)
   - Weekly activity tracking
   - Member roster with levels
   - Contribution metrics

### Settings Storage Pattern

```javascript
// Settings are stored in chrome.storage.local
const settings = {
	ts: timestamp,           // Last update time
	// User preferences
	// Notification settings
	// Display options
};

// Loaded at startup
getCacheOrLoad(["settings"]).then(data => {
	if (data.settings) {
		applySettings(data.settings);
	}
});
```

### Internationalization (i18n)

The extension supports multiple languages via Chrome's i18n system:

**Supported Languages** (from _locales/):
- English (en)
- Russian (ru)
- German (de)
- French (fr)
- Japanese (ja)
- Korean (ko)
- Thai (th)
- Chinese Simplified (zh_CN)

```javascript
// Get localized messages
const lang = chrome.i18n.getMessage("lang");
const appName = chrome.i18n.getMessage("appName");
const appDesc = chrome.i18n.getMessage("appDesc");

// Example usage in menu
chrome.contextMenus.create({
	title: (lang === "ru") 
		? "Открыть плагин"      // Russian
		: "Open HWA plugin"     // English
});
```

### Performance Optimizations

#### Lazy Loading
```javascript
// Load data only when needed
function getCacheOrLoad(keys) {
	return new Promise((resolve, reject) => {
		const uncached = keys.filter(k => !GLOBAL_CACHE[k]);
		
		if (uncached.length === 0) {
			// All in memory, return immediately
			const result = {};
			keys.forEach(k => result[k] = GLOBAL_CACHE[k]);
			resolve(result);
		} else {
			// Load from chrome.storage
			chrome.storage.local.get(uncached, data => {
				// Merge with cache
				uncached.forEach(key => {
					if (data[key]) {
						GLOBAL_CACHE[key] = data[key];
					}
				});
				resolve(/* ... */);
			});
		}
	});
}
```

#### Batch Persistence
```javascript
// Don't write to storage immediately
function persistCache() {
	Object.keys(GLOBAL_CACHE_PERSISTED).forEach(key => {
		if (!GLOBAL_CACHE_PERSISTED[key]) {
			// Mark as persisted first
			GLOBAL_CACHE_PERSISTED[key] = true;
			
			// Then write (async)
			const obj = {};
			obj[key] = GLOBAL_CACHE[key];
			chrome.storage.local.set(obj);
		}
	});
}

// Call periodically, not on every change
setInterval(persistCache, 5000);  // Every 5 seconds
```

#### Data Compression for Replays
```javascript
function trimReplay(replay) {
	// Calculate team power (don't store individual powers)
	replay.attackerTeamPower = power(replay.attackers);
	replay.defenderTeamPower = power(replay.defenders[0]);
	
	// Compress hero data
	replay.attackers = trimHero(replay.attackers);
	replay.defenders[0] = trimHero(replay.defenders[0]);
	
	// Remove battle progress (can be recalculated)
	delete replay.progress;
	
	return replay;
}

function trimHero(team) {
	for (const heroId of Object.keys(team)) {
		const hero = team[heroId];
		team[heroId] = {
			id: hero.id,
			c: compressHero(hero)  // Array instead of object
		};
	}
	return team;
}
```

## Implementation Recommendations for OrganizedJihad

### UI Design Principles

Based on the Hero Wars Assistant analysis, OrganizedJihad should:

1. **Use Color Coding**
   - Hero tier backgrounds (white → green → blue → purple → gold)
   - Visual hierarchy for importance (red for critical, yellow for warnings)
   - Consistent color scheme matching game aesthetics

2. **Implement Lazy Loading**
   - Don't load all historical data at once
   - Cache frequently accessed data in memory
   - Batch storage writes to reduce I/O

3. **Provide Multiple Views**
   - Dashboard: Quick overview of current status
   - Goals: Progress tracking with visual indicators
   - Calendar: Upcoming events and reminders
   - Reports: Detailed analytics and history
   - Settings: User preferences and configuration

4. **Support Notifications**
   - Desktop notifications for important events
   - In-app notification center
   - Customizable notification preferences

5. **Enable Export/Import**
   - Backup user data
   - Share configurations
   - Migrate between devices

### Recommended UI Stack for TamperMonkey

Since TamperMonkey scripts run in the page context (not as extensions), use simpler technologies:

```javascript
// Instead of Angular, use vanilla JS with modern patterns
class UIManager {
	constructor() {
		this.overlay = null;
		this.currentTab = 'dashboard';
	}
	
	createOverlay() {
		// Inject HTML structure
		const overlay = document.createElement('div');
		overlay.className = 'oj-overlay';
		overlay.innerHTML = `
			<div class="oj-header">
				<h2>OrganizedJihad</h2>
				<button class="oj-minimize">−</button>
				<button class="oj-close">✕</button>
			</div>
			<nav class="oj-nav">
				<button data-tab="dashboard">Dashboard</button>
				<button data-tab="goals">Goals</button>
				<button data-tab="calendar">Calendar</button>
				<button data-tab="heroes">Heroes</button>
				<button data-tab="reports">Reports</button>
			</nav>
			<div class="oj-content" id="oj-content">
				<!-- Tab content inserted here -->
			</div>
		`;
		
		// Add styles via GM_addStyle
		GM_addStyle(this.getStyles());
		
		// Attach to page
		document.body.appendChild(overlay);
		this.overlay = overlay;
		
		// Set up event listeners
		this.attachListeners();
	}
	
	attachListeners() {
		// Tab switching
		this.overlay.querySelectorAll('[data-tab]').forEach(btn => {
			btn.addEventListener('click', (e) => {
				this.switchTab(e.target.dataset.tab);
			});
		});
		
		// Minimize/close
		this.overlay.querySelector('.oj-close').addEventListener('click', () => {
			this.overlay.style.display = 'none';
		});
	}
	
	switchTab(tabName) {
		this.currentTab = tabName;
		const content = document.getElementById('oj-content');
		content.innerHTML = this.getTabContent(tabName);
	}
	
	getTabContent(tab) {
		switch(tab) {
			case 'dashboard': return this.renderDashboard();
			case 'goals': return this.renderGoals();
			case 'calendar': return this.renderCalendar();
			// ... more tabs
		}
	}
}
```

### Storage Strategy Comparison

| Feature | Hero Wars Assistant | OrganizedJihad |
|---------|-------------------|----------------|
| **Primary Storage** | chrome.storage.local | GM_setValue / localStorage |
| **Structured Data** | IndexedDB (Dexie) | JSON in GM storage |
| **Cache Layer** | In-memory object | In-memory object |
| **Persistence** | Batch writes | Immediate writes |
| **Max Size** | ~10MB (chrome.storage) | ~10MB (GM) / 5-10MB (localStorage) |

**Recommendation**: Use GM_setValue for simplicity, implement in-memory cache for performance.

## Ethical Considerations

### Fair Use
OrganizedJihad is designed as a **personal analytics tool** for tracking your own gameplay progress. It does not:
- Automate gameplay
- Modify game state
- Provide unfair advantages
- Violate game economy

### Similar to Existing Tools
- **Steam Achievement Trackers**: Track game progress externally
- **Fitness App Integrations**: Monitor activity from other apps
- **Browser Extensions**: Save & organize web content

### Recommended Disclaimer
```
OrganizedJihad is an unofficial tracking tool for personal use only.
It monitors but does not modify Hero Wars gameplay. Use at your own risk.
Not affiliated with or endorsed by Nexters Global.
```

---

**Implemented By**: GitHub Copilot  
**Date**: January 21, 2025  
**Project**: OrganizedJihad v1.0  
**License**: MIT
