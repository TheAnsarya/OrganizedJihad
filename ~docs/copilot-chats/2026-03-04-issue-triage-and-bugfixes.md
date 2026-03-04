# 2026-03-04 — Issue Triage, Audit, and Bugfixes

## Session Summary

Performed a comprehensive triage of all 22 open GitHub issues, audited the
userscript codebase for additional bugs, fixed newly discovered issues, and
closed 15 issues that were already resolved in code.

## Closed Issues (already fixed in code)

The following issues were confirmed fixed in the current codebase and closed:

| Issue | Title | Fix Location |
|-------|-------|-------------|
| #129 | IndexedDB missing close()/onclose/onversionchange handlers | indexedDBStorage.js L134-148 |
| #130 | No user-visible feedback when API sync fails | syncClient.js L340-347, uiManager.js L759-1032 |
| #132 | Dashboard loads ALL battles 3x per render | uiManager.js L662 (single load, passed to sub-renders) |
| #133 | UIManager and APIMonitor missing destroy() methods | uiManager.js L4427, apiMonitor.js L795 |
| #134 | renderView() has no concurrency guard | uiManager.js L471 (_renderGeneration counter) |
| #135 | syncToServer sends entire database every 15 minutes | syncClient.js L95-131 (incremental getSince helper) |
| #136 | syncToServer single-pass categorization | syncClient.js L147-149 (Object.groupBy) |
| #137 | _apiSamples Map unbounded memory | gameTracker.js L195 (LRU eviction) |
| #138 | processAPIResponse not re-entrant safe | index.js L125 (_processingChain) |
| #139 | apiMonitor requestLog uses O(n) shift() | apiMonitor.js L192 (RingBuffer) |
| #140 | syncToServer sends unbounded data from 20+ stores | syncClient.js L95-131 (incremental queries) |
| #141 | per-pet IDB transactions in trackPetsData | gameTracker.js L3540 (addBatch) |
| #142 | _topologicalSortMethods has O(n^2) inner scan | gameTracker.js L1385 (Kahn's algorithm) |
| #143 | getHistoricalComparison returns oldest instead of closest | gameTracker.js L6279 (findLast) |
| #144 | syncClient never persisted lastSync due to property mismatch | syncClient.js L338 (result.syncTimestamp) |

## Bugs Fixed

### 1. Non-deterministic dedup fingerprint (Medium)
- **File:** gameTracker.js `_computeDataFingerprint()`
- **Problem:** `JSON.stringify(data)` doesn't guarantee property order for objects.
  Hero fingerprints include raw API objects (`h.skills`, `h.runes`, `h.skins`)
  whose key order could vary between calls, defeating deduplication.
- **Fix:** Added a replacer function that sorts object keys recursively before
  serialising, ensuring deterministic output.

### 2. updateSnapshot crash on non-array heroesData (Medium)
- **File:** gameTracker.js `updateSnapshot()` line ~6018
- **Problem:** `snapshot.heroes.reduce(...)` throws TypeError if heroesData
  metadata is null/undefined/not an array (e.g. corrupted IDB data).
- **Fix:** Added `Array.isArray()` guard with fallback to empty array, plus
  null-safe `h?.power || 0` in the reduce callback.

### 3. GameOverlay double-init DOM leak (Low)
- **File:** gameOverlay.js `init()`
- **Problem:** No idempotency guard — calling `init()` twice created duplicate
  panels with leaked event listeners.
- **Fix:** Early return if `this.panel` already exists.

### 4. Global error listeners never cleaned up (Low)
- **File:** index.js (error/unhandledrejection handlers)
- **Problem:** Anonymous listeners on `window` were never removed during
  beforeunload cleanup. In SPA-like reinit scenarios, handlers accumulate.
- **Fix:** Named handler functions stored on `window._ojGlobal*` refs,
  removed in the beforeunload cleanup block.

### 5. Processing chain swallows errors silently (Low)
- **File:** index.js (_processingChain catch block)
- **Problem:** The `.catch()` handler logged to console but never surfaced
  errors to the UI. The XHR proxy's own error handler was never reached.
- **Fix:** Emit error events via `gameTracker._emit('error', ...)` in the
  catch block so errors appear in the API Log tab.

## New Issues Created

| Issue | Title | Severity |
|-------|-------|----------|
| #148 | Bug: WebSocket onmessage proxy captures stale handler | Medium |
| #149 | Bug: StorageManager.clearAll() only strips first prefix occurrence | Medium |
| #150 | Performance: getBattleStats() loads entire battles store into memory | Medium |
| #151 | Bug: addBatch non-ConstraintError rolls back entire batch silently | Low |

## Files Modified

- `userscript/src/modules/gameTracker.js` — fingerprint fix, snapshot guard
- `userscript/src/modules/gameOverlay.js` — idempotency guard
- `userscript/src/index.js` — error listener cleanup, chain error visibility

## Test Results

All 626 tests pass across 16 suites. No regressions from changes.

## Remaining Open Issues

| Issue | Title | Category |
|-------|-------|----------|
| #99 | Test coverage: heroNames.js (tests exist, issue can be closed) | Testing |
| #102 | Refactor: Extract gameTracker.js handler groups into tracker modules | Refactor |
| #125 | Test coverage: Phase 12 + Phase 13 handler tests | Testing |
| #131 | Comprehensive battle tracking overhaul | Enhancement |
| #145 | Add tests for batch IDB operations and incremental sync | Testing |
| #146 | Document timestamp format for all stores | Documentation |
| #147 | Add session log auto-generation to userscript build | Enhancement |
| #148 | WebSocket onmessage proxy stale handler | Bug |
| #149 | StorageManager clearAll prefix stripping | Bug |
| #150 | getBattleStats loads entire store | Performance |
| #151 | addBatch transaction rollback | Bug |
