# 2026-03-04 — Bug Fixes, Missing Categories Discovery, Phase 12+13 Handler Tests

## Date & Session

- **Date**: 2026-03-04
- **Session**: 1
- **Branch**: `api-backend-creation`

## Summary

Worked through 10 open GitHub issues. Fixed 3 bugs, confirmed 1 already-fixed performance issue, discovered and fixed a critical silent-disablement bug in Phase 12+13 handler categories, and added 42 new tests covering Phase 12+13 handlers plus bug-fix regressions.

## Issues Addressed

| Issue | Title | Status |
|-------|-------|--------|
| #151 | addBatch non-ConstraintError rolls back entire batch silently | **Fixed** |
| #150 | getBattleStats loads entire battles store into memory | **Already fixed** (confirmed) |
| #149 | clearAll only strips first prefix occurrence in key | **Fixed** |
| #148 | WebSocket onmessage proxy captures stale handler | **Fixed** |
| #145 | Add tests for batch IDB operations and incremental sync | **Tests added** |
| #125 | Phase 12 + Phase 13 handler tests | **Tests added** |

### New Bug Discovered & Fixed

**Phase 12+13 handlers were silently disabled**: All handlers registered with categories `events`, `economy`, `pve`, `pets`, `cosmetics`, `social`, and `system` were being silently skipped because those categories weren't defined in `TRACKING_CATEGORIES`. The tracking prefs check `!this._trackingPrefs[entry.category]` evaluated to `!undefined` → `true` → skip. Fixed by adding 7 missing categories to `TRACKING_CATEGORIES`.

## Files Modified

### Source Files

- **userscript/src/modules/indexedDBStorage.js** — #151: `addBatch` `req.onerror` now calls `e.preventDefault()` for all error types (not just ConstraintError), logging non-duplicate errors as warnings
- **userscript/src/modules/storageManager.js** — #149: `clearAll()` and `exportData()` use `key.slice(this.prefix.length)` instead of `key.replace(this.prefix, '')`
- **userscript/src/modules/gameTracker.js** — #148: WebSocket proxy uses `Object.defineProperty` getter/setter for lazy `onmessage` capture; added 7 missing tracking categories to `TRACKING_CATEGORIES`

### Test Files

- **userscript/tests/indexedDBStorage.test.js** — Added `addBatch error resilience (#151)` (2 tests), `getByIndexRange with timestamps (#145)` (3 tests)
- **userscript/tests/storageManager.test.js** — Added `Prefix edge cases (#149)` (3 tests)
- **userscript/tests/gameTracker.test.js** — Added WebSocket lazy capture test (#148), Phase 12 handlers (17 tests), Phase 13 handlers (22 tests including 10 no-op system handlers)

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| Userscript (Jest) | 689 | All pass |
| .NET Data (xUnit) | 39 | All pass |
| .NET API (xUnit) | 36 | All pass |
| **Total** | **764** | **All pass** |

## Key Decisions

- **addBatch (#151)**: Chose to `preventDefault()` for ALL error types rather than selectively, since preserving partial writes is safer than losing the entire batch. Non-ConstraintErrors are logged as warnings.
- **clearAll (#149)**: Used `slice(prefix.length)` rather than `replaceAll` since the prefix is always at position 0 — more precise and performant.
- **WebSocket (#148)**: Used `Object.defineProperty` getter/setter over a `Proxy` since it's lighter-weight and only needs to intercept the `onmessage` property.
- **TRACKING_CATEGORIES**: Added all 7 missing Phase 12+13 categories rather than removing the category check, since category-based toggling is a user-facing feature.

## Benchmark Results (BenchmarkDotNet v0.14.0, .NET 10.0.3, ShortRun)

| Benchmark | Mean | Rank | Allocated |
|-----------|------|------|-----------|
| Insert single PlayerSnapshot | 75.81 μs | 1 | 38.46 KB |
| Upsert DailyActivitySummary | 104.57 μs | 2 | 42.88 KB |
| Insert 50 HeroLevelUpgrades | 384.69 μs | 3 | 259.22 KB |
| Batch insert 100 PlayerSnapshots | 869.10 μs | 4 | 617.79 KB |
| Insert 10 TitanStarUpgrades with dedup | 7.53 ms | 5 | 13.76 MB |
| Insert 10 GuildQuestCompletions with dedup | 10.13 ms | 6 | 14.62 MB |
| Query DailyActivity by date | 15.56 ms | 7 | 7.18 MB |
| Query InventoryHistory by category | 17.58 ms | 7 | 8.11 MB |
| Insert 20 DailyQuestCompletions with dedup | 18.17 ms | 7 | 27.54 MB |
| Insert 30 LoginRewards with dedup | 25.98 ms | 8 | 27.28 MB |
| Insert 50 InventoryItemUsages with dedup | 35.70 ms | 9 | 46.28 MB |
| Query TitanUpgradeHistory filtered | 36.13 ms | 9 | 15.75 MB |
| Query 100 snapshots AsNoTracking | 39.95 ms | 9 | 15.88 MB |
| Query 100 snapshots with tracking | 42.04 ms | 9 | 15.94 MB |
| Insert 30 EquipmentChanges with dedup | 115.18 ms | 10 | 69.44 MB |
| Insert 50 TitanLevelUpgrades with dedup | 124.23 ms | 10 | 91.41 MB |
| Insert 50 ArenaBattles with dedup | 196.82 ms | 11 | 134.16 MB |

**Notable**: AsNoTracking vs tracked queries show minimal difference (~40ms vs ~42ms). Dedup-heavy operations like ArenaBattles (196ms/50 records) and TitanLevelUpgrades (124ms/50 records) are the most expensive due to per-record `AnyAsync` checks — candidates for batch dedup optimization.

## Follow-up Items

- [ ] File new GitHub issue for "Phase 12+13 handlers silently disabled by missing TRACKING_CATEGORIES" (discovered & fixed this session)
- [ ] Close issues #148, #149, #150, #151 (fixes verified by tests)
- [ ] Close #145 (tests added) and #125 (Phase 12+13 tests added)
- [ ] Remaining open issues: #147 (session log auto-gen), #146 (timestamp format docs), #131 (battle tracking overhaul), #102 (gameTracker refactor)
