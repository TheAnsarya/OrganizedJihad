# Session 10 — Performance, Lifecycle Cleanup, & Codebase Audit

**Date:** 2025-01-24
**Session:** 10
**Version:** v0.9.63 → v0.9.64
**Tests:** 591 → 600 (9 new)
**Branch:** `api-backend-creation`

---

## Summary

Continued working through open issues. Fixed #132 (dashboard loads all battles 3× per render) and #133 (UIManager/APIMonitor missing destroy()). Performed a comprehensive 28-finding codebase audit, fixed several high-impact issues in-session, and filed 4 new issues for remaining findings.

---

## Issues Fixed

### #132 — Dashboard loads ALL battles 3× per render

**Problem:** `renderDashboard()`, `_renderWinRateCards()`, and `_renderDailySummary()` each independently called `getAll('battles')`, loading the entire battles table three times per dashboard render. Additionally, `_renderDailySummary()` loaded ALL chests, quests, and upgrades just to filter for today's records.

**Solution:**

- Load battles **once** in `renderDashboard()` and pass the array to both sub-methods
- Changed `_renderWinRateCards(battles)` to accept pre-loaded battles parameter
- Changed `_renderDailySummary(battles)` to accept pre-loaded battles + use new index-range queries
- Added `getByIndexRange()` to `IndexedDBStorage` — uses `IDBKeyRange` for bounded index queries
- Daily summary now uses `getByIndexRange('chests', 'timestamp', { lower: todayISO })` instead of loading all records

### #133 — UIManager/APIMonitor missing destroy() methods

**Problem:** Neither UIManager nor APIMonitor had cleanup methods. UIManager registered 6 document-level event listeners (keydown ×2, mousemove ×2, mouseup ×2) with anonymous arrows that could never be removed. APIMonitor patched XHR/fetch prototypes without a way to restore them.

**Solution:**

- **UIManager:**
  - Added `_docListeners` array to constructor for tracking document-level handlers
  - Added `_addDocListener(event, handler)` helper — registers + tracks for later removal
  - Converted all 6 `document.addEventListener` calls to use `_addDocListener()`
  - Added `destroy()` — removes all tracked listeners, detaches overlay DOM
- **APIMonitor:**
  - Added `destroy()` — restores original XHR prototype methods, restores original fetch, removes `window.apiMonitor`, clears internal state
- **index.js:**
  - Added `uiManager` and `apiMonitor` to `_destroyables` array
  - Stored suggestions interval ID for cleanup (`window.organizedJihadSuggestionsInterval`)
  - Added `clearInterval` for suggestions in `beforeunload` handler

### Pruning Optimization (audit finding #1/#2/#15)

**Problem:** `_logActivity` and `_logError` in gameTracker.js called `getAll()` to load ALL records every time, sorted them, then deleted excess records one-by-one with individual IDB transactions. Similarly, `clearOldAPILogs` loaded all API logs for trimming.

**Solution:**

- Added `pruneOldest(storeName, indexName, maxRecords)` to IndexedDBStorage
  - Uses `count()` to short-circuit when no pruning needed (no full-table scan)
  - Opens a single cursor on the index in ascending order and deletes excess records
  - Single IDB transaction for all deletions
- `_logActivity` now calls `pruneOldest('activityEvents', 'timestamp', 500)`
- `_logError` now calls `pruneOldest('errorLog', 'timestamp', 200)`
- `clearOldAPILogs` now delegates to `pruneOldest('apiLogs', 'timestamp', keepCount)`

### Misc Quick Fixes (audit #21, #27)

- **apiMonitor.js:** Replaced deprecated `substr(2, 9)` with `substring(2, 11)` in ID generation
- **apiMonitor.js:** Added divide-by-zero guard in `generateDocumentation()` success rate calculation

---

## New Issues Filed

| Issue | Title | Type |
|-------|-------|------|
| [#136](https://github.com/TheAnsarya/OrganizedJihad/issues/136) | Performance: syncToServer single-pass categorization | enhancement |
| [#137](https://github.com/TheAnsarya/OrganizedJihad/issues/137) | Performance: _apiSamples Map unbounded memory | enhancement |
| [#138](https://github.com/TheAnsarya/OrganizedJihad/issues/138) | Bug: processAPIResponse not re-entrant safe | bug |
| [#139](https://github.com/TheAnsarya/OrganizedJihad/issues/139) | Performance: apiMonitor requestLog uses O(n) shift() | enhancement |

---

## Codebase Audit Summary

28 findings total from comprehensive audit:

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 3 | 2 fixed (pruning), 1 existing (#135) |
| High | 7 | 2 fixed (dash perf), 5 filed as issues |
| Medium | 10 | 3 fixed (interval, clearOldAPILogs, pruning race), rest tracked |
| Low | 8 | 2 fixed (substr, divide-by-zero), rest low priority |

---

## Files Modified

- [userscript/src/modules/uiManager.js](userscript/src/modules/uiManager.js) — battles param passing, _addDocListener, destroy()
- [userscript/src/modules/indexedDBStorage.js](userscript/src/modules/indexedDBStorage.js) — getByIndexRange(), pruneOldest(), clearOldAPILogs refactor
- [userscript/src/modules/gameTracker.js](userscript/src/modules/gameTracker.js) — pruneOldest usage in _logActivity/_logError
- [userscript/src/modules/apiMonitor.js](userscript/src/modules/apiMonitor.js) — destroy(), substr fix, divide-by-zero guard
- [userscript/src/index.js](userscript/src/index.js) — _destroyables registration, suggestions interval tracking
- [userscript/tests/indexedDBStorage.test.js](userscript/tests/indexedDBStorage.test.js) — 9 new tests
- [userscript/tests/gameTracker.test.js](userscript/tests/gameTracker.test.js) — Updated pruning tests
- [userscript/package.json](userscript/package.json) — v0.9.64

---

## Open Issues (14 total)

| Issue | Title | Labels |
|-------|-------|--------|
| #139 | Performance: apiMonitor requestLog uses O(n) shift() | enhancement, userscript |
| #138 | Bug: processAPIResponse not re-entrant safe | bug, userscript |
| #137 | Performance: _apiSamples Map unbounded memory | enhancement, userscript |
| #136 | Performance: syncToServer single-pass categorization | enhancement, userscript |
| #135 | Performance: syncToServer sends entire DB every 15 min | enhancement, userscript |
| #134 | Race condition: renderView() | bug, userscript |
| #133 | Memory leak: UIManager/APIMonitor missing destroy() | bug, userscript |
| #132 | Performance: Dashboard loads ALL battles 3× per render | enhancement, userscript |
| #131 | Enhancement: Comprehensive battle tracking overhaul | enhancement |
| #130 | Enhancement: No user-visible feedback when API sync fails | enhancement |
| #129 | Enhancement: IndexedDB missing close/onclose/onversionchange | enhancement |
| #125 | Test coverage: Phase 12 + Phase 13 handler tests | testing |
| #102 | Refactor: Extract gameTracker.js handler groups into tracker modules | enhancement |

Note: #129, #130, #132, #133, #134 are fixed on this branch but show as open since the branch hasn't been merged to default.

---

## Key Decisions

1. **pruneOldest over getAll+filter+delete:** Cursor-based single-transaction pruning is O(excess) vs O(n) for the old pattern. Uses count() to skip entirely when under cap.
2. **getByIndexRange for daily summary:** IDBKeyRange.lowerBound avoids loading months of historical records for a "today only" query. Only materializes matching rows.
3. **_addDocListener pattern:** Stores handler references in an array for later removal, avoiding the "can't remove anonymous arrow" problem without refactoring all existing listeners to named functions.
4. **Filed issues vs fixed in-session:** Fixed items with clear solutions and broad impact (pruning, lifecycle). Filed items requiring design decisions (ring buffer, mutex, LRU eviction) as separate issues.
