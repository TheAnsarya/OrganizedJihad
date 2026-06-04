# Session 12 — Performance & Incremental Sync Overhaul

**Date**: 2025-02-27
**Branch**: `api-backend-creation`
**Version**: v0.9.70 → v0.9.72

---

## Summary

Major performance session focusing on four open issues: topological sort O(n²) complexity, per-record IDB transactions, unbounded sync payloads, and full-database sync every 15 minutes. Also discovered and fixed a critical bug where the `lastSync` timestamp was never persisted due to a property name mismatch between ASP.NET camelCase serialization and the JavaScript consumer.

---

## Issues Addressed

| Issue | Title | Status |
|-------|-------|--------|
| #142 | `_topologicalSortMethods` O(n²) inner loop | **Fixed** |
| #141 | Per-pet IDB transactions in hot loops | **Fixed** |
| #140 | `syncToServer` sends all data every sync | **Fixed** |
| #135 | `syncToServer` sends full DB every 15 min | **Fixed** |

---

## Changes Made

### Fix #142 — Topological Sort Rewrite

**File**: `gameTracker.js` (`_topologicalSortMethods`)

Rewrote the dependency-ordering algorithm from O(n²) to O(V+E):

- Built **reverse adjacency map** (`dependents: Map<string, Set<string>>`) instead of scanning all methods per dequeue
- Replaced `queue.shift()` (O(n) array shift) with **index-based queue** (`qi++`)
- Replaced `sorted.includes()` (O(n) linear scan) with **`sortedSet` (Set)** for O(1) membership checks
- Cycle detection uses `sortedSet.has()` instead of `methodNames.filter(n => !sorted.includes(n))`

### Fix #141 — Batch IDB Writes

**File**: `indexedDBStorage.js` (new methods)

Added two new methods for single-transaction batch operations:

- **`addBatch(storeName, records)`**: Opens one readwrite transaction for all records. Individual ConstraintErrors are swallowed with `e.preventDefault()` (no tx abort). Returns array of generated keys.
- **`putBatch(storeName, records)`**: Same pattern using `store.put()` for upserts. Returns array of keys.
- Both return `[]` for empty/null input (early return).

**File**: `gameTracker.js` (4 method conversions)

| Method | Before (transactions) | After (transactions) |
|--------|----------------------|---------------------|
| `trackPetsData` | N × `storage.add('pets', pet)` | 1 × `storage.addBatch('pets', pets)` |
| `trackConsumableOpening` | N × `storage.add('consumableRewards', drop)` | 1 × `storage.addBatch('consumableRewards', dropRecords)` |
| `trackMailRewards` | N × `storage.add('mailRewards', entry)` | 1 × `storage.addBatch('mailRewards', rewardEntries)` |
| `trackGuildMembers` | 2N × (`put` + `add` per member) | 2 × (`putBatch` + `addBatch`) |

### Fix #135/#140 — Incremental Sync

**File**: `syncClient.js`

- Reads `lastSync` from IDB metadata at the start of `syncToServer()`
- Pre-computes `lastSyncEpoch = new Date(lastSync).getTime()` for epoch-based stores
- **`getSince()` helper**: accepts `(store, indexName, format)` — returns `getByIndexRange()` with appropriate lower bound when `lastSync` exists, falls back to `getAll()` on first sync
- Stores with `timestamp` index use `getSince(store)` (ISO format)
- Chests store uses `getSince('chests', 'timestamp', 'epoch')` since it stores `Date.now()` numbers
- Stores with non-standard time indexes use explicit `getByIndexRange()`: `questCompletions`, `shopPurchases`, `dailyQuestCompletions`, `guildQuestCompletions`, `loginRewards`
- Small mutable stores always send all: `opponents`, `goals`, `events`, `missionProgress`, `towerProgress`

### Critical Bug Fix — `syncTimestamp` Property Name

**File**: `syncClient.js`

**Bug**: ASP.NET Core serializes C# `SyncTimestamp` as camelCase `syncTimestamp` in JSON, but the JavaScript code read `result.timestamp` (always `undefined`). This meant `lastSync` was **never persisted** to IDB metadata, so incremental sync never activated — every sync was always a full-database dump.

**Fix**: `result.timestamp` → `result.syncTimestamp`

### Timestamp Format Audit

Verified all store timestamp formats:

- **ISO string**: snapshots, battles, heroes, titans, pets, inventory, expeditionBattles, resourceTransactions, guildActivities, heroUpgrades, titanUpgrades, inventoryItemUsages, equipmentChanges, questCompletions, shopPurchases, dailyQuestCompletions, guildQuestCompletions, loginRewards
- **Epoch ms (number)**: chests (`Date.now()`), activityEvents, errorLog (latter two not synced)

### Tests

- Fixed syncClient test mocks: `{ timestamp: ... }` → `{ syncTimestamp: ... }` to match API response format
- Added `addBatch`/`putBatch` to gameTracker test mock storage
- Updated `trackConsumableOpening` test assertions for batch API
- **6 new syncClient tests**: first sync uses `getAll`, incremental sync uses `getByIndexRange`, epoch lower bound for chests, mutable stores always use `getAll`, `syncTimestamp` property persistence
- **6 new indexedDBStorage tests**: `addBatch` insert/empty/keys/large-batch, `putBatch` insert/empty/update
- **Final count**: 626 tests passing, 16 suites

---

## Files Modified

| File | Changes |
|------|---------|
| `userscript/src/modules/gameTracker.js` | Topological sort rewrite, 4 batch write conversions |
| `userscript/src/modules/indexedDBStorage.js` | Added `addBatch()` and `putBatch()` methods |
| `userscript/src/modules/syncClient.js` | Incremental sync, `getSince()` helper, `syncTimestamp` fix |
| `userscript/tests/syncClient.test.js` | Fixed mocks, added 6 incremental sync tests |
| `userscript/tests/indexedDBStorage.test.js` | Added 6 batch operation tests |
| `userscript/tests/gameTracker.test.js` | Added batch mocks, updated consumable test |
| `userscript/package.json` | Version bump (external) |

---

## Commits

| Hash | Message |
|------|---------|
| `35ebd91` | Fix #142, #141, #135, #140: Performance & incremental sync overhaul |

---

## Key Decisions

1. **Single-transaction batching over per-record**: `addBatch`/`putBatch` use one readwrite transaction for all records. ConstraintErrors on individual writes are silently skipped via `e.preventDefault()` to avoid aborting the whole transaction.
2. **ISO vs epoch handling**: Rather than normalizing all stores to one format, added a `format` parameter to `getSince()` and pre-compute `lastSyncEpoch`. This avoids touching 20+ tracking methods.
3. **Mutable stores always send all**: Stores like `opponents`, `goals`, `missionProgress` are small and upsert-based — always sending all is simpler and correct for these.
4. **`fake-indexeddb` limitation**: The ConstraintError `preventDefault()` test couldn't work with `fake-indexeddb` polyfill (it doesn't support preventing transaction abort on error). Replaced with a key-count verification test instead.

---

## Known Issues / Follow-Up

- #143: `getHistoricalComparison` returns stale data (not addressed this session)
- #125: Test coverage for Phase 12+ features
- #102: Extract gameTracker handler groups into tracker modules
- #99: heroNames test coverage gaps
