# Session 11 — Performance, Safety & Audit Fixes

**Date:** 2025-01-24
**Branch:** `api-backend-creation`
**Version:** v0.9.69

## Summary

Continued working through the open issue backlog, fixing 5 issues (#136-#139, #143), performing a full codebase audit, and filing 4 new issues (#140-#143). Added 14 new tests (600 → 614).

## Issues Fixed

### #138: processAPIResponse not re-entrant safe (Bug)

Added a sequential processing queue to `processAPIResponse` in `index.js`. Each call chains onto the previous via a Promise chain, ensuring only one handler runs at a time. This prevents concurrent IDB writes from interleaving and racing on dedup fingerprints like `_lastHeroHash`.

### #139: requestLog uses O(n) shift() (Performance)

Replaced the plain array push/shift pattern in `apiMonitor.js` with a `RingBuffer` class:
- O(1) push via circular overwrite
- Proxy-based numeric indexing (`buf[0]`) for backward compatibility
- `toArray()`, `slice()`, `forEach()`, `Symbol.iterator` for reads
- `clear()` for cleanup

### #137: _apiSamples Map unbounded memory (Performance)

Added LRU eviction cap at 100 methods to `_apiSamples` in `gameTracker.js`. When the Map exceeds `_apiSampleMaxMethods`, the oldest entry (first in Map insertion order) is deleted.

### #136: syncToServer single-pass categorization (Performance)

Replaced 17 separate `.filter()` passes in `syncClient.js` with `Object.groupBy()`:
- Battles: 5 filters → 1 groupBy
- Hero upgrades: 7 filters → 1 groupBy
- Titan upgrades: 5 filters → 1 groupBy

### #143: getHistoricalComparison returns wrong entry (Bug)

`getHistoricalComparison()` used `find()` on chronological history array, which returned the oldest entry meeting the age threshold instead of the closest. Replaced with `findLast()` (ES2023).

## Additional Audit Fixes

- **importStores batched transactions**: `importStores()` now opens one readwrite IDB transaction per store instead of one per record (was N transactions for N records)
- **_purgeStoreBefore uses timestamp index**: Now opens cursor on `timestamp` index when available and early-exits once past the cutoff, instead of full-table scan
- **Missing await**: Added `await` to `_logActivity()` call in `trackMailList()`

## Issues Filed

| Issue | Title | Labels |
|-------|-------|--------|
| #140 | Performance: syncToServer sends unbounded data from 20+ stores | enhancement, userscript |
| #141 | Performance: per-pet IDB transactions in trackPetsData | enhancement, userscript |
| #142 | Performance: _topologicalSortMethods has O(n² ) inner scan | enhancement, userscript |
| #143 | Bug: getHistoricalComparison returns oldest instead of closest entry | bug, userscript |

## Files Modified

- [userscript/src/index.js](../../userscript/src/index.js) — processAPIResponse sequential queue (#138)
- [userscript/src/modules/apiMonitor.js](../../userscript/src/modules/apiMonitor.js) — RingBuffer class, ring buffer requestLog (#139)
- [userscript/src/modules/gameTracker.js](../../userscript/src/modules/gameTracker.js) — _apiSamples LRU cap (#137), findLast (#143), await fix
- [userscript/src/modules/syncClient.js](../../userscript/src/modules/syncClient.js) — Object.groupBy (#136)
- [userscript/src/modules/indexedDBStorage.js](../../userscript/src/modules/indexedDBStorage.js) — importStores batch tx, _purgeStoreBefore index usage
- [userscript/tests/apiMonitor.test.js](../../userscript/tests/apiMonitor.test.js) — RingBuffer tests (10), updated constructor/trim tests
- [userscript/tests/gameTracker.test.js](../../userscript/tests/gameTracker.test.js) — _apiSamples LRU cap tests (4)
- [userscript/package.json](../../userscript/package.json) — v0.9.69

## Test Results

- **614 tests / 16 suites** — all passing
- 14 new tests added (10 RingBuffer, 4 apiSamples LRU)

## Key Decisions

1. **RingBuffer with Proxy** — Used a Proxy wrapper to support `buf[0]` bracket notation without breaking existing test code that accesses `monitor.requestLog[0]`
2. **Promise chain for mutex** — Chose a simple promise chain over a library-based mutex since it naturally handles error isolation (`.catch()` doesn't break the chain)
3. **Object.groupBy over reduce** — ES2024 `Object.groupBy` is supported in Node 22+ and Chrome 117+, which covers our target environments
4. **Index-based purge with early-exit** — Instead of key-range bounded cursors (which break on mixed timestamp types), iterate the index in order and early-exit when past the cutoff

## Open Issues (17 total, 6 fixed on branch)

| Fixed on branch | Issue |
|:---:|-------|
| ✅ | #129, #130, #131, #132, #133, #134, #136, #137, #138, #139, #143 |
| ⬜ | #99, #102, #125, #135, #140, #141, #142 |
