# 2026-02-23 — Fix TamperMonkey Sandbox XHR Interception

## Session 10 (continued in Session 11)

### Summary

User reported "No information is being collected" from the userscript. Diagnosed the root cause as TamperMonkey sandbox isolation: when `@grant` directives are used, the script runs in a sandboxed context where `XMLHttpRequest.prototype` is a separate copy from the page's real `XMLHttpRequest`. The game creates XHR instances from the page's real constructor, completely bypassing our sandbox proxy — resulting in **zero data captured**.

Analyzed HeroWarsHelper (HWA) Chrome extension reference code to understand their interception strategy (content script + injected `<script>` elements running in page context). Applied the TamperMonkey equivalent: `unsafeWindow` to access the page's real `window` object.

### Root Cause

- `@grant GM_addStyle` and `@grant GM_notification` cause TamperMonkey to run the script in a **sandbox context**
- `XMLHttpRequest` in the sandbox is an isolated copy, NOT the page's real `XMLHttpRequest`
- Game's XHR calls use the page's `XMLHttpRequest`, bypassing our proxy entirely
- Same issue affects `WebSocket.prototype` and `window.nxg` (pushd module)
- HWA avoids this by injecting `<script>` elements that run in the page context directly
- TamperMonkey equivalent: `unsafeWindow` provides direct access to the page's real `window`

### Changes Made

#### Files Modified
- **userscript/src/modules/gameTracker.js**
  - Added `PAGE_WINDOW` constant: `(typeof unsafeWindow !== 'undefined') ? unsafeWindow : window`
  - `proxyAPIRequests()`: All `XMLHttpRequest.prototype` references → `PAGE_WINDOW.XMLHttpRequest.prototype`
  - `proxyWebSocket()`: `WebSocket.prototype.send` → `PAGE_WINDOW.WebSocket.prototype.send`
  - `_tryHookPushd()`: `window.nxg` → `PAGE_WINDOW.nxg`
  - `destroy()`: Restore originals on `PAGE_WINDOW.*` prototypes
  - `init()`: Reordered to call `proxyAPIRequests()` and `proxyWebSocket()` BEFORE `await storage.init()` to eliminate async gap

#### Files Created
- **~docs/plans/API-Interception-Fix-Plan.md** — Full root cause analysis, HWA architecture comparison, fix strategy, Zone.js implications

### GitHub Issues

| Issue | Title | Status |
|-------|-------|--------|
| #54 | Critical: Fix TamperMonkey sandbox XHR interception via unsafeWindow | **Closed** |
| #55 | Switch to @run-at document-start for earlier API interception | Open (deferred) |
| #56 | Reorder gameTracker.init() to proxy XHR before awaiting IDB | **Closed** |

### Key Decisions

1. **Used `unsafeWindow` over script injection**: TamperMonkey's built-in `unsafeWindow` is simpler and more reliable than the `<script>` element injection pattern HWA uses. Both achieve the same result (access to page context).
2. **Kept `@run-at document-end`**: Switching to `document-start` (#55) would require restructuring all DOM operations to defer to `DOMContentLoaded` and handling style-loader's dependency on `document.head`. Deferred to a follow-up issue since the `unsafeWindow` fix alone solves the zero-data-capture problem.
3. **Fallback to `window`**: `PAGE_WINDOW` falls back to `window` when `unsafeWindow` is undefined (e.g., in Jest/Node.js test environment or `@grant none` mode), ensuring backward compatibility.
4. **Init reorder (#56)**: Moving proxy setup before `await storage.init()` eliminates the async gap where early API calls could be missed during IndexedDB initialization.

### Test Results

- **Userscript**: 296 tests passed, 7 suites
- **.NET**: 75 tests passed (39 Data + 36 API)
- **Build**: Clean (webpack production build, 1.77 MiB)

### Known Issues / Follow-up

- **Zone.js compatibility**: The game uses Zone.js (Angular) which wraps `XMLHttpRequest` with `ZoneAwareXMLHttpRequest`. Our proxy works at the wrapper level since we patch `unsafeWindow.XMLHttpRequest.prototype` after Zone.js has replaced it. The wrapper delegates to real XHR instances, so our interception at the wrapper level captures all game API calls.

### Commits

- `e436022` — Fix #54, Fix #56: Use unsafeWindow for XHR/WS/nxg interception, reorder init()

---

## Session 11

### Summary

After the Session 10 `unsafeWindow` fix, user reported 10 chest trackings with sparse data but nothing else tracking. Diagnosed three additional issues:

1. **`@run-at document-end` (#55)**: Proxy installed too late — missed the entire initial login API batch (userGetInfo, heroGetAll, titanGetAll, inventoryGet, etc.). Only user-triggered actions (chest opens) fired after the proxy was active.
2. **Cross-realm `instanceof ArrayBuffer` (#57)**: TamperMonkey sandbox creates isolated constructors. `data instanceof ArrayBuffer` always returns false for page-context ArrayBuffers, causing request body parsing to silently fall through to `JSON.stringify(data)` → `'{}'` → no calls extracted.
3. **Sparse reward data (#58)**: `_normalizeRewards` may not match actual game reward keys. Added debug logging to output top-level response keys when zero drops are extracted.

### Changes Made

#### Files Modified
- **userscript/src/index.js** — Full restructuring into PHASE 1 (immediate: XHR/WS proxy + IDB init, no DOM ops) and PHASE 2 (DOMContentLoaded: badge, overlay, UI modules). Version bumped to 0.9.3.
- **userscript/src/modules/gameTracker.js** — Replaced `instanceof ArrayBuffer` chain with `TextDecoder.decode()` try/catch (cross-realm safe). Added binary response handling (`arraybuffer` responseType). Added `console.warn` when `_normalizeRewards` returns 0 drops with response key info.
- **userscript/webpack.config.cjs** — Changed `@run-at document-end` → `document-start`. Configured style-loader with custom `insertStyleDeferred` function that defers `<style>` injection if `<head>` doesn't exist yet. Version bumped to 0.9.3.
- **userscript/package.json** — Version bumped to 0.9.3.

### GitHub Issues

| Issue | Title | Status |
|-------|-------|--------|
| #55 | Switch to @run-at document-start for earlier API interception | **Closed** |
| #57 | Fix cross-realm instanceof ArrayBuffer in TamperMonkey XHR proxy | **Closed** |
| #58 | Add debug logging for reward normalization to diagnose sparse chest data | **Closed** |

### Key Decisions

1. **PHASE 1 / PHASE 2 architecture**: Rather than deferring everything to DOMContentLoaded, split init into two phases. PHASE 1 runs immediately at document-start (XHR/WS proxy + IDB + preferences) to catch the login batch. PHASE 2 waits for DOM (badge, overlay, all UI). The `processAPIResponse` wrapper is installed in PHASE 1 with a lazy UI callback set in PHASE 2.
2. **Style-loader deferred insert**: Custom `insertStyleDeferred` function that checks `document.head` existence and falls back to `DOMContentLoaded` listener. Avoids dynamic `import()` which would create separate chunks incompatible with single-file userscript output.
3. **TextDecoder over instanceof**: `TextDecoder.decode()` accepts any `BufferSource` and works cross-realm (uses internal slot checks, not prototype chain). This matches HWA's approach in `hwh2.js`.
4. **Debug-first for sparse rewards**: Rather than guessing the game's reward key names, added logging that dumps the actual response structure. User can check console output on next chest open to identify the correct keys.

### Test Results

- **Userscript**: 296 tests passed, 7 suites
- **.NET**: 75 tests passed (39 Data + 36 API)
- **Build**: Clean (webpack production, 1.78 MiB)

### Commits

- `9148cf9` — Fix #55, Fix #57, Fix #58: document-start + cross-realm instanceof + reward logging
