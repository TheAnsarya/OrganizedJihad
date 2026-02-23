# HeroWarsHelper (HWA) Extension Analysis

## Reference: `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/`

## Architecture Overview

HeroWarsHelper is a **Chrome Extension (Manifest V3)** with a multi-layer architecture:

| Layer | File | Role |
|-------|------|------|
| **Content Script** | `contentscript.js` | Injects `injected.js` into game page at `document_start`; relays `CustomEvent` data to background via `chrome.runtime.sendMessage` |
| **Injected Script** | `injected.js` | XHR proxy in page context; fires `HeroWarsInterceptedDataEvent` CustomEvent with raw request/response data; also hooks `window.nxg.getModule("pushd")` for WebSocket push events |
| **Background Worker** | `background.js` | Service worker; receives intercepted data; parses `request.calls`/`response.results`; dispatches to handler array; stores in `chrome.storage.local` + Dexie IndexedDB; manages notifications, badges, gifts |
| **In-Game Panel** | `ifr.js` | Injects iframe overlay (75% height, z-index 40000) showing Angular UI from `dist/index.html`; toggle with backtick/tilde key |
| **HWH Lite 2** | `hwh2.js` (404KB) | Advanced in-page script: full XHR proxy with request/response **modification**, battle calculator, auto-features, UI controls. Only loaded for subscribed users. |
| **Angular UI** | `dist/` | Full SPA (Angular) for replay viewer, war analysis, notifications, settings |

---

## XHR Interception — The Critical Pattern

### Two-Layer Interception

**Layer 1: `injected.js`** (read-only, for all users)
- Overrides `XMLHttpRequest.prototype.open`, `.setRequestHeader`, `.send`
- On `send()`, uses `addEventListener("load", ...)` to capture completed responses
- Sends both `requestBody` and `responseBody` via CustomEvent to content script
- **Key body decoding**: If body is ArrayBuffer → `new TextDecoder("utf-8").decode(body)`; if string → use directly; also tries `body.bytes` as fallback
- Response accessed via `this.responseText` (only for `responseType` === `""` or `"text"`)

**Layer 2: `hwh2.js`** (read-write, for subscribers)
- Full XHR proxy with `async send()` override
- Uses `getClass(t) === "ArrayBuffer" ? decoder.decode(t) : t` to decode body
- `getClass(e)` = `{}.toString.call(e).slice(8, -1)` — returns `"ArrayBuffer"`, `"String"`, etc.
- Passes decoded string to `checkChangeSend()` for parsing and modification
- Wraps `onreadystatechange` (uses async function so await works inside)
- Can **modify** both request and response in-flight
- Rebuilds `X-Auth-Signature` after modification using `md5(RequestId:AuthToken:SessionId:body:...)`

### Request Body Format (After Decoding)

```json
{
	"calls": [
		{ "name": "userGetInfo", "args": {}, "ident": "body" },
		{ "name": "heroGetAll", "args": {}, "ident": "group_1_body" },
		{ "name": "clanWarGetInfo", "args": {}, "ident": "group_2_body" }
	]
}
```

- **Single call**: ident = `"body"`
- **Multiple calls**: ident = `"group_N_body"` (0-indexed)
- Each call has `name` (API method), `args` (parameters), `ident` (correlation key)
- Some calls include `context: { actionTs: performance.now() }`

### Response Format

```json
{
	"results": [
		{ "ident": "body", "result": { "response": { ... } } },
		{ "ident": "group_1_body", "result": { "response": [ ... ] } }
	],
	"date": 1771833935
}
```

- Results matched to calls by `ident`
- Actual data is in `result.response`
- Errors: `{ "error": { "name": "...", "description": "..." } }` instead of `results`

---

## Data Flow

```
Game JS → xhr.send(ArrayBuffer) → injected.js decodes to string → JSON.parse
                                         ↓
                              CustomEvent with requestBody + responseBody
                                         ↓
                              contentscript.js → chrome.runtime.sendMessage
                                         ↓
                              background.js parses JSON, dispatches to HANDLERS[]
                                         ↓
                              chrome.storage.local + Dexie IndexedDB
                                         ↓
                              Angular UI reads from storage + IndexedDB
```

---

## Handler Pattern in background.js

Each handler is an object with `calls`, `results`, and `handle`:

```javascript
const userGetInfoHandler = {
	calls: ["userGetInfo"],           // API method names to match
	results: ["userGetInfo"],         // Expected result idents
	handle: function(request, response, rawResponse, eventData) {
		const ident = findIdentByCalls(request.calls, this.calls);
		const data = findByIdent(response.results, [ident]).result.response;
		// Process and store data...
		sendAndSaveData(data, "cur_user");
	}
};
HANDLERS.push(userGetInfoHandler);
```

Helper functions:
- `extractCalls(req)` → array of call names from `req.calls`
- `extractResults(res)` → array of idents from `res.results`
- `intersection(a, b)` → calls present in both
- `findByIdent(results, idents)` → find result by ident
- `findIdentByCalls(calls, names)` → find the ident for a named call
- `findCallByName(calls, names)` → find the full call object

Dispatch loop:
```javascript
const callNames = extractCalls(request);
for (const handler of HANDLERS) {
	if (intersection(handler.calls, callNames).length > 0) {
		handler.handle(request, response, rawResponse, eventData);
	}
}
```

---

## API Methods Tracked by HWA

| Category | Methods |
|----------|---------|
| **User** | `userGetInfo` |
| **Heroes** | `heroGetAll` (via userGetInfo handler) |
| **Arena** | `arenaGetAll`, `arenaFindEnemies`, `arenaAttack`, `battleGetByType(arena)` |
| **Grand Arena** | `grandFindEnemies`, `battleGetByType(grand)` |
| **Titan Arena** | `titanArtifactGetChest`, `titanGetSummoningCircle` |
| **Guild War** | `clanWarGetInfo`, `clanWarGetDayHistory`, `clanWarGetAvailableHistory`, `clanWarGetLeagueTop` |
| **Cross-Server War** | `crossClanWar_getInfo`, `crossClanWar_getAttackMap`, `crossClanWar_getDefenceMap`, `crossClanWar_startBattle` |
| **Guild Raid** | `clanRaid_getInfo`, `clanRaid_logBoss`, `clanRaid_logNodes`, `clanRaid_logStats` |
| **Guild Info** | `clanGetInfo`, `clanGetWeeklyStat` |
| **Adventures** | `adventure_getInfo`, `adventure_join`, `adventure_start`, `adventure_getLog`, `adventure_getGlobalBuffs`, `adventure_find`, `adventure_getPassed` |
| **Castle** | `clanDomination_mapState`, `clanDomination_getBattleJournal` |
| **Replays** | `battleGetReplay` |
| **Rankings** | `topGet` |
| **Titan Spirits** | `titanSpirit_getAll` |
| **Pets** | `pet_getChest` |
| **Artifacts** | `artifactGetChestLevel` |
| **Gifts** | `freebieCheck`, `registration`, `newYearGiftGet` |
| **Brawl** | `epicBrawl_getEnemy`, `epicBrawl_getInfo` |
| **Billing** | `billingGetAll` |

---

## Storage Strategy

### chrome.storage.local (Simple Key-Value)
Used for current state, settings, active data:
- `cur_user` — current player info
- `cur_users` — all tracked users
- `settings` — extension settings with notification toggles
- `clanwar_war_info` — current war state
- `arena_cur_enemies` / `ga_cur_enemies` — current arena opponents
- `gifts` — collected gift IDs
- `wars_stats` — weekly war leaderboard snapshots
- Various `_getInfo` / `_getAttackMap` snapshots

### Dexie IndexedDB (Structured Data)
Used for historical/replay data:
- `users` — indexed by `id`, with `name`, `clanTitle`, `dnow`
- `a_replays` — arena replays, indexed by `id`, `startTime`, `comment`
- `ga_replays` — grand arena replay groups
- `gw_replays` / `gws_replays` — guild war replays + support data
- `other_replays` — adventures, challenges, cross-war, raid
- `userTeams` — hero team snapshots per user
- `totems` — totem data per user
- `notifications` — notification history
- `clan_domination_user` / `clan_domination_move` — castle data

### Hero Data Compression
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
	return HERO_FIELDS_TO_COMPRESS.map(f => hero[f]);
}
```

---

## UI Pattern

### In-Game Panel (`ifr.js`)
- Creates fixed-position div wrapper (`z-index: 40000`)
- Contains an iframe pointing to `dist/index.html`
- Toggle with backtick (`` ` ``) or tilde (`~`) key
- Arrow keys resize panel height (±20px per keypress)
- Cross-origin messaging via `window.postMessage`

### HWH2 Controls (`hwh2.js`)
- `createInterface()` called on first API request (`X-Request-Id <= 2`)
- Uses custom `ScriptMenu`, `popup`, `HotkeyManager` classes
- Injects buttons/controls directly into game DOM
- Targets `#flash-content` or `#game` elements

---

## Push Event Handling

```javascript
// injected.js hooks into game's WebSocket push system
function addListenerForGameEvents() {
	if (window.nxg && window.nxg.getModule("pushd")) {
		let pushd = window.nxg.getModule("pushd");
		pushd.on("message", function(event) {
			sendIntercepted({ gameEvent: event });
		});
	} else {
		// Retry after 10 seconds, up to 10 times
		setTimeout(addListenerForGameEvents, 10000);
	}
}
setTimeout(addListenerForGameEvents, 10000);
```

Events: `chatMessage`, `newMail`, `arenaPlaceChanged`, `clanWarTarget`, `clanWarEndBattle`, `clanWarAttack`, `crossClanWar_attack`, `crossClanWar_target`, `crossClanWar_endBattle`, `clanNewMember`, `clanDismissMember`, `clanDomination_move`, `clanDomination_defenseState`, etc.

---

## Key Differences: HWA vs OrganizedJihad

| Aspect | HWA | OJ (Current) |
|--------|-----|--------------|
| **Type** | Chrome Extension (MV3) | TamperMonkey Userscript |
| **XHR body access** | Decodes ArrayBuffer via TextDecoder | Captures raw JS object (gets minified keys!) |
| **Response access** | `this.responseText` (string) | `this.responseText` or `this.response` |
| **Data dispatch** | Handler array pattern | Giant switch statement |
| **Storage** | chrome.storage + Dexie | IndexedDB (raw IDB wrapper) |
| **UI** | Angular SPA in iframe | Inline DOM overlay |
| **Push events** | `window.nxg.getModule("pushd")` | Not implemented |
| **Request modification** | Yes (battle cancel, chest control) | No (read-only) |
| **requestHistory cleanup** | 5-minute auto-purge | None |
| **Error reporting** | Blocks Sentry error reports | N/A |
| **Hero compression** | Array of ordered field values | Full JSON snapshots |

---

## Critical Bug Found in OJ

**Root cause of minified keys**: Our XHR proxy captures the `data` argument passed to `xhr.send(data)`. The game passes an **ArrayBuffer** (binary-encoded JSON), not a JS object. But our proxy tries to use this as a JS object.

**Why it sometimes works**: When the game sends a string body, `JSON.parse()` works fine. When it sends an ArrayBuffer, our `typeof data === 'string' ? JSON.parse(data) : data` branch takes `data` as-is — getting the raw ArrayBuffer object, which has no `.calls` property.

**Fix**: Decode ArrayBuffer using `TextDecoder` before `JSON.parse()`, exactly like HWA does:
```javascript
let bodyStr;
if (data instanceof ArrayBuffer) {
	bodyStr = new TextDecoder('utf-8').decode(data);
} else if (typeof data === 'string') {
	bodyStr = data;
} else if (data?.bytes) {
	bodyStr = new TextDecoder('utf-8').decode(data.bytes);
} else {
	bodyStr = String(data);
}
const requestData = JSON.parse(bodyStr);
```
