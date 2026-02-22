# Session Log: Reference Extension Deep Dive & Architecture Research

**Date**: 2025-01-25
**Session**: #33

## Summary

Comprehensive research across 6 areas: game rendering technology, reference extension (Hero Wars Assistant) UI injection patterns, hwh2.js hero analysis, our apiMonitor.js, our index.js initialization, and data browser helpers.

## Key Findings

### 1. Canvas vs DOM — Game Rendering

**Finding: CANNOT be determined from the extension code.** The reference extension has ZERO interaction with game rendering. No references to `canvas`, `PIXI`, `PixiJS`, or `MutationObserver` (for game DOM observation) exist anywhere in the extension codebase.

The extension operates entirely at the **API layer** — it intercepts XHR/fetch requests and processes the JSON data. It never inspects, modifies, or overlays on any game visual elements.

The game's Heroes dialog rendering technology remains unknown from this analysis. It would need to be determined by inspecting the game iframe's DOM directly in the browser.

### 2. Reference Extension UI Injection Architecture

Three-layer injection pattern via `contentscript.js`:

1. **`injected.js`** → Injected into page context via `<script>` tag for XHR interception
2. **`ifr.js`** → Creates floating iframe overlay with Angular app from `dist/index.html`
3. **`hwh2.js`** → Automation bot scripts (subscription-gated, creates own popup DOM)

Communication flow: `injected.js` fires `HeroWarsInterceptedDataEvent` → `contentscript.js` listens → forwards via `chrome.runtime.sendMessage` → `background.js` processes

The overlay panel is a **completely separate Angular application** running inside an iframe (`<iframe id="hwa-iframe">`), positioned with `z-index: 40000`, dropping down from the top of the viewport. Toggled via backtick key.

### 3. hwh2.js Analysis

- 360KB minified automation bot (subscription-gated)
- Creates its OWN popup/dialog system via `document.createElement` with CSS classes (`PopUp_back`, `PopUp_`, `PopUp_blocks`)
- Has a `Caller` class that sends API calls directly to the game server
- Does NOT interact with game canvas or game DOM
- Localized in 10 languages (en, ru, de, fr, ja, ko, th, zh, etc.)
- Features: auto-quests, tower, dungeon, expeditions, brawls, arena, raids, boss attacks, seer, shops, etc.

**Hero Power Feature**: Sends `userGetInfo` + `heroGetAll` API calls, then:
- `maxSumPower.heroes` from userGetInfo response = max achievable total hero power
- Sums individual `hero.power` from heroGetAll
- Shows current vs max and difference

### 4. window.nxg

Game's internal module system. Only `"pushd"` module is used by the extension:
- Accessed via `window.nxg.getModule("pushd")`
- Provides real-time push event bus for server notifications
- Used via `pushd.on("message", callback)` to receive chat, arena attacks, war targets, clan events
- Retry logic: up to 10 attempts, every 10 seconds, if nxg not ready
- Also references `NXFlashVars.interface_lang` for language detection

### 5. HERO_FIELDS_TO_COMPRESS (from background.js/utils.js)

35-field array used for hero data compression in the reference extension:
```js
["agility","armor","armorPenetration","artifacts","ascensions","color",
"favorPetId","favorPower","hp","intelligence","level","magicPower",
"magicResist","perks","petId","physicalAttack","power","runes","skills",
"skins","slots","star","strength","titanGiftLevel","magicPenetration",
"type","elementAttack","elementArmor","elementSpiritPower","element",
"elementSpiritLevel","elementSpiritStar","scale","dodge","physicalCritChance"]
```

### 6. Our Userscript Initialization Flow

1. Guard: Only runs inside game iframe (hostname check)
2. Creates floating status badge (`#oj-status-badge`)
3. Sets up global error handlers
4. Initializes `IndexedDBStorage`
5. Initializes `StorageManager` (localStorage)
6. Initializes `SyncClient` → `http://localhost:5124`
7. Creates `GameTracker`, `GoalsManager`, `CalendarManager`, `SuggestionsEngine`, `UIManager`
8. Creates `APIMonitor` and calls `init()` (XHR/fetch interception)
9. Wraps `gameTracker.processAPIResponse` for badge updates
10. DOMContentLoaded → `gameTracker.init()`, `uiManager.init()`, auto-sync (15 min), suggestions (60s)

### 7. No Max Values / Hero Config Constants Found

No explicit `maxLevel`, `maxStar`, `maxColor`, `maxSkill` constants exist in the reference code. The only "max" concept is `maxSumPower.heroes` from the game API's `userGetInfo` response — this is server-calculated, not a hardcoded constant.

## Files Read/Analyzed

- `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/manifest.json`
- `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/contentscript.js`
- `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/injected.js`
- `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/ifr.js`
- `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/hwh2.js` (grep analysis only, 360KB minified)
- `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/background.js`
- `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/lib/utils.js`
- `~reference-code/mbffmikhmagljbpojlampkojpbabdbbo/3.3.3_0/lib/menu.js`
- `userscript/src/index.js`
- `userscript/src/modules/apiMonitor.js`
- `userscript/src/modules/helpers/GameDataHelpers.js`

## Issues Referenced

- No new issues created

## Known Issues / Follow-ups

- Game rendering technology (canvas vs DOM) still undetermined — requires live browser inspection
- Our hero compression uses 5 fields vs reference's 35 — could expand
- Reference extension uses `maxSumPower.heroes` from API — we could capture this too
- `window.nxg.getModule("pushd")` could be used for real-time event capture in our userscript
