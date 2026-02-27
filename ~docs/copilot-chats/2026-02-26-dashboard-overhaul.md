# 2026-02-26 — Dashboard Overhaul (Phase 10)

**Date**: 2026-02-26
**Session**: Dashboard Player Info Complete Overhaul

## Summary

Used the API Sample Collector (v0.9.31) to export real Hero Wars API responses, then
fixed all dashboard player info display issues based on actual field names and data structures.

## What Was Accomplished

### API Analysis
- Analyzed 112 API methods from exported samples (`~docs/api-samples/hw-api-samples-2026-02-27.json`)
- Discovered critical data mapping errors through real API responses

### Data Tracking Fixes (gameTracker.js)
1. **Energy fix**: `userGetInfo` has NO `stamina` field — energy is in `refillable[id=1].amount`
2. **Bottled energy**: Added tracking for `refillable[id=49].amount`
3. **Raid handler**: Fixed from `bossRaidGetInfo` (doesn't exist) to `clanRaid_getInfo`
4. **Raid data**: Rewrote `trackRaidBossInfo()` for real `clanRaid_getInfo` response shape
5. **GW tracking**: Added `clanWarGetBriefInfo` handler (tries remaining, war active status)
6. **CoW tracking**: Added `crossClanWar_getInfo` handler (hero/titan attack usage)
7. **Quest totals**: Enhanced `trackQuestsData()` with category breakdown (daily/guild/battlepass)

### Dashboard UI Fixes (uiManager.js)
1. **Gold icon**: Replaced unrenderable 🪙 (U+1FA99) with inline SVG coin
2. **Emerald icon**: Replaced pink hue-rotated 💎 with green SVG hexagonal gem
3. **Energy icon**: Replaced ⚡ emoji with SVG lightning bolt
4. **Energy value**: Now shows actual energy from refillable data + bottled energy count
5. **Daily Quests**: Changed from "X today" to "X/Y" format
6. **Guild Quests**: Changed from "X today" to "X/Y" format
7. **Guild War**: Dynamic from `clanWarGetBriefInfo` (2 attacks), shows "No War" when inactive
8. **New CoW card**: Shows hero attacks (X/3) and titan attacks (X/2)
9. **Raid card**: Shows boss level, attacks X/5, total damage dealt

### Other
- Updated copilot instructions: "always yarn, never npm/npx"
- Dynamic version in About section (using `__OJ_VERSION__`)
- API Sample Collector HTML added to Settings tab

## Files Created or Modified
- `userscript/src/modules/gameTracker.js` — Data tracking fixes
- `userscript/src/modules/uiManager.js` — Dashboard UI overhaul + API Sample Collector HTML
- `userscript/tests/gameTracker.test.js` — Updated test for refillable structure
- `userscript/package.json` — Version bump
- `.github/copilot-instructions.md` — Yarn-only rule
- `~docs/plans/dashboard-overhaul-plan.md` — Created
- `~docs/api-samples/hw-api-samples-2026-02-27.json` — Added (user-exported)

## GitHub Issues Created
- #113 — [Epic] Dashboard Player Info Overhaul (Phase 10)
- #114 — Fix Gold emoji not rendering on dashboard
- #115 — Fix Emerald emoji showing pink instead of green
- #116 — Fix Energy showing 0 + add bottled energy count
- #117 — Daily Quests: show X/Y completion format
- #118 — Guild Quests: show X/Y format + fix 111 count
- #119 — Guild War: dynamic attacks + Clash of Worlds progress
- #120 — Raid: show boss info + damage totals + fix handler

## Key Decisions
- Used inline SVGs instead of emoji for Gold/Emerald/Energy icons for cross-browser compatibility
- Quest categorization by ID range: daily=10001-10999, guild=20000xxx, battlepass=1797xxxxxx+
- CoW max attacks hardcoded as 3 hero + 2 titan (confirmed from API sample)
- GW max attacks set to 2 (standard Mon-Fri, from API data)

## Tests
- 569/569 passing, 16 suites

## Follow-up Items
- Monitor that quest counts are accurate in live gameplay
- Verify energy tracking after page reload
- Consider adding raid minion node progress separately
- Boss name lookup still needs `lib.data` mapping (not available from API samples)

---

## Session 2: API Call Reference Documentation (2026-02-27)

### Summary
Created comprehensive API call reference documentation covering every API method
the userscript intercepts, with full response structures from real API samples,
IndexedDB storage mappings, metadata keys, and UI consumers.

### Files Created
- `~docs/API-Call-Reference.md` — Complete API reference (900+ lines)
  - 91 handler registrations documented across 14 categories
  - Response structures from 112 captured API methods
  - 30+ IndexedDB object stores mapped
  - 6 metadata keys documented with shapes
  - 47+ unhandled-but-captured methods catalogued for future work
  - Data flow diagram (ASCII art)

### Key Findings
- Userscript intercepts ~65+ unique API methods via 91 handler registrations
- 47+ captured API methods are NOT yet intercepted (future tracking opportunities)
- Notable unhandled methods: `arenaGetAll` (full arena stats), `missionGetAll` (all 220 missions),
  `clanWarGetWarlordInfo` (47KB defense data), `battlePass_getInfo`, `teamGetAll`
- `refillable` array has 59 entries — only IDs 1 and 49 are mapped (energy, bottled energy)
  - ID 5 = arena attempts, rest need mapping
