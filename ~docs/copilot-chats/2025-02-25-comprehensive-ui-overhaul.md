# 2025-02-25 — Comprehensive UI Overhaul

## Session Summary

Major multi-issue session addressing 8 open issues (#90–#98) covering dashboard, inventory, API log, titans, pets, mail tracking, and dynamic refresh. All issues created, implemented, tested, and closed in a single session.

## Issues Addressed

| Issue | Title | Status |
|-------|-------|--------|
| #98 | Dashboard: playerData metadata never written | ✅ Closed |
| #90 | Dashboard/UI: No dynamic refresh | ✅ Closed |
| #97 | Inventory tab broken: renders snapshots as items | ✅ Closed |
| #91 | API Log: Add request/response payload viewer | ✅ Closed |
| #92 | Titans UI: Fix labels (Summon Stars, Totems/Artifacts) | ✅ Closed |
| #93 | Pets tab: No data shown, no update trigger | ✅ Closed |
| #94 | Add mail tracking (new feature) | ✅ Closed |
| #95 | Dashboard counters show 0 / wrong values | ✅ Closed |

## Files Modified

### Source Files
- **`gameTracker.js`** — Added `setMetadata('playerData', ...)` in `trackPlayerData()`, `setMetadata('inventoryData', ...)` in `trackInventoryData()`, `_emit('dataUpdate')` in `_logActivity()`, expanded `_pushApiLog()` with payload parameter, built payload map in `processAPIResponse()`, pet names via `resolveHeroName()`, patronageData in pet metadata, mail handler registrations (`mailGetAll`, `mailFarm`, `mailCollect`), `trackMailList()` and `trackMailRewards()` methods
- **`uiManager.js`** — Added `import { resolveHeroName }`, `dataUpdate` event subscriber with 2s debounce, rewrote `renderInventory()` with `_parseRawInventory()` and `_resolveEntityName()`, expanded `renderApiLog()` with payload viewer, pet name resolution via `resolveHeroName()`, new `renderMail()` method with Mail tab, fixed `GuildRaid` → `RaidBoss` battleType match, proper playerData merge in dashboard
- **`TitanCompletionCalculator.js`** — Removed `summonStars` system entirely, renamed "Totems/Artifacts" → "Artifacts", redistributed weights (level=0.25, stars=0.25, skill=0.15, artifacts=0.25, skins=0.10)
- **`indexedDBStorage.js`** — Bumped to v10, added `mailRewards` IDB store with indexes (timestamp, mailId, mailType, playerId)
- **`main.css`** — Added API Log payload viewer styles (`.oj-btn-tiny`, `.oj-log-payload`, `.oj-payload-*`)

### Test Files
- **`titanCompletionCalculator.test.js`** — Updated for 5 systems (removed summonStars), fixed weight calculations, updated system count assertion
- **`indexedDBStorage.test.js`** — Updated version to 10, store count to 37, added `mailRewards` store assertion

### Config Files
- **`.vscode/settings.json`** — Created with `diffEditor.maxComputationTime: 0` to disable diff timeout for large files

## Key Decisions

1. **Summon Stars removed entirely** — Not a real game mechanic per user; redistributed weight to other systems
2. **"Totems/Artifacts" → "Artifacts"** — Simplified label; totems are part of artifacts in the game
3. **Mail tracking architecture** — New `mailRewards` IDB store (v10) + metadata cache for mail list; separate from resource transactions to enable mail-specific analytics
4. **Dynamic refresh** — Used `dataUpdate` event emitted from `_logActivity()` with 2-second debounce to avoid rapid re-renders during API call bursts
5. **API payload storage** — Truncated at 2KB (args) and 5KB (response) per call to manage memory in the ring buffer
6. **Diff timeout** — Set `diffEditor.maxComputationTime: 0` in workspace settings to prevent "diff algorithm stopped early" errors on large files

## Build & Test Results

- **Build**: v0.9.17 (2.11 MiB)
- **Tests**: 462 passed, 0 failed, 13 suites
- **Commit**: `7388dd5`

## Follow-up Items

- Verify mail API method names match actual Hero Wars API (`mailFarm`, `mailCollect`) — may need adjustment based on live testing
- Chests tab appears functional per audit but user reported issues — verify in-game
- Consider adding quest name mapping for daily/guild quest display names
- Mail tab could benefit from pagination of collected rewards section
