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

---

## Session 3: Comprehensive API Tracking Implementation (#112)

### Summary
Implemented 20+ new API handlers for previously-unhandled methods, closed issues #113-#120,
and added new dashboard cards for arena ranks, campaign progress, battle pass, titan arena,
gacha pity counter, and guild activity stats.

### Issues Closed
- #113 [Epic] Dashboard Player Info Overhaul (Phase 10)
- #114 Fix Gold emoji not rendering on dashboard
- #115 Fix Emerald emoji showing pink instead of green
- #116 Fix Energy showing 0 + add bottled energy count
- #117 Daily Quests: show X/Y completion format
- #118 Guild Quests: show X/Y format + fix 111 count
- #119 Guild War: dynamic attacks + Clash of Worlds progress
- #120 Raid: show boss info + damage totals + fix handler

### New Handlers Added to gameTracker.js
1. `arenaGetAll` → Arena/GA ranks, total wins/losses, defense teams
2. `missionGetAll` → Campaign progress (220 missions, stars)
3. `titanArenaGetStatus` → Titan Arena rank, tier, daily/weekly scores
4. `battlePass_getInfo` → Battle pass level, XP, ticket type, rewards claimed
5. `crossClanWar_getBriefInfo` → CoW brief status, merges with existing cowData
6. `clanGetActivityStat` → Guild activity/dungeon points, weekly totals
7. `gacha_getInfo` → Gacha pity counter, total pulls, next milestone
8. `teamGetAll` → 30+ named team compositions (arena, GW, CoW, raids)
9. `shopGetAll` → All 26 shops, slot counts, bought/available items
10. `friendsGetInfo` → Friends list (account/user counts)
11. `buffs_getInfo` → Active buffs
12. `ascensionChest_getInfo` → Ascension chest data
13. `stronghold_getInfo` → Stronghold info
14. `idle_getAll` → AFK/idle reward data
15. `chatGetAll` → Full chat history
16. `chatGetTalks` → DM conversations
17. `roleAscension_getAll` → All ascension tiers
18. `titanSpirit_getAll` → Titan spirit data

### New Dashboard Cards
- **Arena Rank**: Shows current arena rank with all-time win rate
- **Grand Arena**: Grand Arena rank
- **Titan Arena**: Rank + tier + daily score
- **Campaign Stars**: X/Y stars + ★★★ mission count
- **Battle Pass**: Level + ticket type + XP earned
- **Gacha Pity**: Pulls until next pity milestone + total pulls
- **Guild Activity** (conditional row): Today's activity, dungeon activity, weekly total

### Files Modified
- `userscript/src/modules/gameTracker.js` — 20+ new handler registrations (~280 lines added)
- `userscript/src/modules/uiManager.js` — New dashboard metadata reads + 3 rows of cards

### Tests
- 569/569 passing, 16 suites

### Commits
- `b82b1ea` — feat: add 20+ new API handlers + dashboard cards (#112)

---

## Session 4 — Comprehensive Handler Coverage (Phase 12)

**Date**: 2026-02-27

### Summary
Audited all open GitHub issues (#100-#112), verified they were already implemented, and closed them all. Then added 50+ additional API handlers covering nearly all remaining unhandled methods.

### Issues Closed
- **#100**: syncClient.js test coverage — already had 504 lines of tests
- **#101**: apiMonitor.js test coverage — already had 579 lines of tests
- **#103**: copilot-instructions.md phase status — updated to reflect current state
- **#104**: Pet handler name fix — already correct (`pet_getAll`)
- **#105**: bossOpenChest handler — already correct
- **#106**: battleGetReplay handler — already implemented
- **#107**: Pets tab Items column — superseded by #108
- **#108**: Pets Color column + soul stones — already implemented
- **#109**: Avatars for Pets/Titans — already implemented
- **#110**: Dashboard UI fixes — already implemented (emeralds green, ##/## format)
- **#111**: Battle tracking damage/healing/petId — already in compressHeroTeam
- **#112**: Track all API endpoints — all 24 listed methods already handled

### New API Handlers (Phase 12)
Added ~50 new handler registrations covering:
- **Guild War**: `clanWarGetDefence`, `clanWarGetWarlordInfo`, `clanWarGetLeagueInfo`
- **Guild Stats**: `clanGetWeeklyStat`, `clanGetLog`, `clanGetOnline`
- **Guild Economy**: `clan_prestigeGetInfo`, `clanRaid_ratingInfo`, `clanRaidSubscription_getInfo`, `clanGetAvailableDailyGifts`, `clanGetActivityRewardTable`, `clanInvites_getUserInbox`
- **CoW Extended**: `crossClanWar_getAttackMap`, `crossClanWar_getDefencePlan`, `crossClanWar_getSettings`
- **Leaderboards**: `topGet`, `heroRating_getInfo`, `hallOfFameGetTrophies`
- **Events**: `questGetEvents`, `powerTournament_getState`, `seasonAdventure_getInfo`, `eventPicker_getInfo`, `newYear_getInfo`
- **Economy**: `specialOffer_getAll`, `shopGet`, `billingGetAll`, `billingGetLast`, `bundleGetAllAvailableId`, `coopBundle_getInfo`, `subscriptionGetInfo`
- **Titans**: `titanGetSummoningCircle`, `titanUseSummonCircle`, `artifactGetChestLevel`, `titanArtifactGetChest`
- **Teams**: `teamGetFavor`, `team_getBanners`
- **Player**: `settingsGetAll`, `dailyBonusGetInfo`, `towerGetState`, `banner_getAll`, `campaignStoryGetList`
- **Social**: `socialQuestGetInfo`, `chatGetInfo`, `friendSendHearts`, `friendGetHearts`
- **Misc**: `adventureSolo_getActiveData`, `inventoryExchangeTitanStones`, `zeppelinGiftGet`
- **Battles**: `dungeonEnd`, `titanDungeonEnd`

### Files Modified
- `.github/copilot-instructions.md` — Updated phase status (items 7-17)
- `userscript/src/modules/gameTracker.js` — ~500 lines of new handlers
- `~docs/copilot-chats/2026-02-26-dashboard-overhaul.md` — This session log

### Stats
- **Total handler registrations**: ~155+
- **Total API methods covered**: ~180+
- **Tests**: 569/569 passing, 16 suites
- **Build**: v0.9.44
- **Open issues remaining**: 1 (#102 — refactor gameTracker.js)

### Commits
- `df9d791` — feat: add 50+ new API handlers for comprehensive tracking
