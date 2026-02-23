# Session Log: 2025-01-24 — Batch 3 Implementation

## Date & Session

2025-01-24, Session 8 / Conversation 18

## Summary

Implemented 5 GitHub issues in a single batch: #38, #39, #47, #49, #51. All focused on userscript enhancements — real-time push events, WebSocket proxy, handler dependency ordering, viewport clamping for the overlay panel, and fixing opponent tracking to use the proper IDB store.

## Issues Closed

- **#38** — Hook WebSocket push events via `window.nxg` pushd module
- **#39** — Add WebSocket proxy for raw push event capture
- **#47** — Add handler dependency declarations for ordered processing
- **#49** — Add panel resize and position persistence (viewport clamping)
- **#51** — Add opponent power tracking and history

## Files Modified

- `userscript/src/modules/gameTracker.js` — pushd hook, WebSocket proxy, handler deps, opponent tracking fix
- `userscript/src/modules/uiManager.js` — viewport clamping for drag/resize/restore
- `userscript/tests/gameTracker.test.js` — 23 new tests (140 → 163 total)

## Key Decisions & Rationale

### Pushd Hook (#38)

- Follows HeroWarsHelper's exact pattern: `window.nxg.getModule('pushd').on('message', cb)`
- 10-second polling with 10 retries (game framework loads asynchronously)
- Push events dispatched through existing handler registry using `push:eventType` keys

### WebSocket Proxy (#39)

- Proxies `WebSocket.prototype.send` to wrap `onmessage` on first send
- Only filters duplicate `iframeEvent.login` messages (matching HWA's hwh2.js behavior)
- Not used for capturing push data — the pushd module handles that

### Handler Dependencies (#47)

- `registerHandler()` now accepts optional `{ dependsOn: ['methodName'] }` options
- `_topologicalSortMethods()` uses Kahn's algorithm for topological sort
- Circular dependencies detected and logged as warnings, appended in original order
- Applied to `heroGetAll` and `inventoryGet` (both depend on `userGetInfo`)

### Viewport Clamping (#49)

- Drag: clamped with 40px minimum visible header so user can always grab it back
- Resize: max dimensions constrained to available viewport from current position
- Restore: saved position clamped to current viewport on page load (handles monitor changes)

### Opponent Tracking Fix (#51)

- **Bug fixed**: All 3 call sites had swapped parameters — `(opponentId, battleType, isWin)` but signature was `(battleType, opponentId, result)`
- **Type fix**: Accepts boolean `isWin` instead of string `'victory'/'defeat'`
- **Storage migration**: Moved from metadata (`opponentRecords` key) to dedicated `opponents` IDB store
- **New features**: Per-battleType win/loss stats, power history (bounded to 50 entries), opponent name tracking, `firstSeen`/`lastSeen` timestamps

## Test Results

- **163 tests passing** (23 new tests added)
- Tests cover: pushd lifecycle, WebSocket proxy, handler dependency sorting, circular dep detection, opponent record CRUD, power history bounding, null input handling

## Build Output

- `organized-jihad.user.js`: 1.55 MiB (production build)

## Known Issues / Follow-up

- Pushd event types need real-world validation to map actual game push event shapes
- `opponents` IDB store has data from old metadata format that won't migrate automatically (new data will use the store correctly)
- Remaining open issues: #24-#33, #43, #50, #52

## Commit

`68f5b6f` on branch `api-backend-creation`
