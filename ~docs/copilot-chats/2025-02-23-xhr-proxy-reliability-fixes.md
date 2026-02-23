# 2025-02-23 — XHR Proxy Reliability Fixes & HeroWarsHelper Analysis

## Session 8, Conversations 14–16

### Summary

Fixed three root causes preventing reliable API call interception in the TamperMonkey userscript:

1. **`onreadystatechange` wrapping replaced with `addEventListener`** — The game could overwrite `xhr.onreadystatechange` after `send()`, silently clobbering our interceptor. `addEventListener('readystatechange', ...)` can't be removed this way.

2. **Async error handling for `processAPIResponse`** — `processAPIResponse` (async) was called from a sync readystatechange handler without `await`. If the async code threw, it became an unhandled rejection and the API log entry was never pushed — explaining why the badge showed 6 calls but only 1 log entry. Fixed by wrapping with `Promise.resolve(...).catch()` and logging failures to the API log.

3. **Minified/shortened request property names** — The game's webpack bundle passes an internal object with minified keys (e.g., `MPm`, `Lj` instead of `calls`) to `xhr.send()` before its own serializer converts to proper JSON. Added `_extractCalls()` helper that:
   - Uses `request.calls` when available (fast path)
   - Otherwise scans object values for an array of objects (the calls array)
   - Pattern-matches string values against known API method prefixes → method name
   - Cross-references string values against `response.results[].ident` → call ident
   - Falls back to shortest remaining string as ident

4. **`JSON.stringify` guarding** — Wrapped all diagnostic `JSON.stringify` calls in individual try/catch blocks so un-serializable data (circular refs, BigInt, etc.) doesn't kill the log entry.

### Files Modified

- **`userscript/src/modules/gameTracker.js`**:
  - Rewrote `proxyAPIRequests()` send proxy: `addEventListener` + `Promise.resolve().catch()`
  - Added static `_METHOD_PREFIX_RE` regex for API method name detection
  - Added `_extractCalls(request, response)` helper method
  - Reworked `processAPIResponse()` to use `_extractCalls` instead of direct `request.calls`
  - Wrapped diagnostic `JSON.stringify` calls in try/catch with fallback strings

### Issues Referenced

- Continuation of debugging from Session 8, Conversations 11–14
- No new GitHub issue created (incremental fix to existing interception system)

### Key Decisions

- **`addEventListener` over `onreadystatechange`**: More robust because it can't be overwritten by game code. The game's own `onreadystatechange` handler still fires normally via the browser's event system.
- **Scan-based call extraction**: Rather than hardcoding minified key names (which change every game build), we scan object values and classify them by pattern. API method names are distinctive (camelCase with known prefixes like `user`, `hero`, `titan`, `clan`, etc.).
- **Static regex on class**: `_METHOD_PREFIX_RE` is a class-level static to avoid re-creating the regex on every call.

### Test Results

- 101/101 tests passing
- Build: 1.4 MiB (webpack production)

### Follow-Up Items

- [ ] Verify in Opera GX that all API calls now appear in the log
- [ ] Confirm hero data flows through after `heroGetAll` is properly intercepted
- [ ] Consider adding test coverage for `_extractCalls` with minified input
- [ ] Commit all uncommitted changes from Sessions 8.11–8.16

---

## Session 8, Conversation 16 — HeroWarsHelper Analysis & Improvement Plan

### Summary

Comprehensive analysis of the HeroWarsHelper (HWA) Chrome extension v3.3.3 reference code in `~reference-code/`. Discovered the **root cause** of the minified-keys bug: the game sends POST bodies as **ArrayBuffer** (binary UTF-8 encoded JSON), not as a string. Our proxy was passing the raw ArrayBuffer as a plain object. Fixed with `TextDecoder`. Created full documentation, improvement plans, code-level action plans, and 19 GitHub issues.

### Critical Discovery: ArrayBuffer Body Decoding

The game's `xhr.send()` passes an `ArrayBuffer` containing UTF-8-encoded JSON. Our proxy did:
```js
typeof data === 'string' ? JSON.parse(data) : data  // BUG: else branch captures raw ArrayBuffer
```

HWA does:
```js
new TextDecoder('utf-8').decode(data)  // → proper JSON string → JSON.parse
```

Fixed our proxy to use `TextDecoder` with fallbacks for `TypedArray`, `DataView`, and `data.bytes`.

### HWA Architecture (5-Layer)

1. **manifest.json** — MV3 extension declaration
2. **contentscript.js** — Injects `injected.js` into page context
3. **injected.js** — Read-only XHR proxy, forwards API data to background
4. **background.js** — Service worker, handler dispatch, storage coordination
5. **ifr.js** — Iframe-based Angular SPA UI
6. **hwh2.js** (404KB, subscriber-only) — Advanced XHR proxy with request modification, `Caller` class for active API calls, `getSignature` for auth, `requestHistory` with auto-cleanup

### Files Created

- **`~docs/HeroWarsHelper-Analysis.md`** — Comprehensive analysis document covering architecture, XHR interception patterns, API format, data flow, handler pattern, 50+ tracked API methods, storage strategy, hero compression, UI pattern, push events, and key differences vs OJ
- **`~docs/plans/userscript-improvement-plan.md`** — Strategic improvement plan with 7 epics and 19 issues
- **`~docs/plans/code-level-action-plan.md`** — Implementation-level details with code snippets for each improvement

### Files Modified

- **`userscript/src/modules/gameTracker.js`** — Fixed `send()` proxy to decode ArrayBuffer bodies via `TextDecoder` before `JSON.parse`

### GitHub Issues Created

| Issue | Title | Epic | Priority | Status |
|-------|-------|------|----------|--------|
| #34 | Fix XHR proxy: decode ArrayBuffer request bodies via TextDecoder | XHR Proxy Reliability | Critical | DONE |
| #35 | Fix XHR proxy: use addEventListener instead of onreadystatechange | XHR Proxy Reliability | High | DONE |
| #36 | Add setRequestHeader proxy to capture auth headers | XHR Proxy Reliability | Medium | Open |
| #37 | Add requestHistory cleanup to prevent memory leaks | XHR Proxy Reliability | Medium | Open |
| #38 | Hook WebSocket push events via window.nxg pushd module | WebSocket Push Events | High | Open |
| #39 | Add WebSocket proxy for raw push event capture | WebSocket Push Events | Medium | Open |
| #40 | Track cross-server war battles | Missing API Methods | Medium | Open |
| #41 | Track adventure replays | Missing API Methods | Low | Open |
| #42 | Track arena/grand arena battle replays | Missing API Methods | Medium | Open |
| #43 | Implement hero data compression | Data Storage | Low | Open |
| #44 | Add replay deduplication | Data Storage | Medium | Open |
| #45 | Implement automatic data purge | Data Storage | Medium | Open |
| #46 | Refactor handler dispatch to handler array pattern | Handler Architecture | High | Open |
| #47 | Add handler dependency declarations | Handler Architecture | Low | Open |
| #48 | Add keyboard shortcut to toggle overlay | UI Improvements | Medium | Open |
| #49 | Add panel resize and position persistence | UI Improvements | Low | Open |
| #50 | Improve DOM targeting with game-aware selectors | UI Improvements | Low | Open |
| #51 | Add opponent power tracking and history | Advanced Features | Medium | Open |
| #52 | Add configurable notifications | Advanced Features | Low | Open |
| #53 | Block Sentry error reporting | Advanced Features | Low | Open |

### Key Decisions

- **TextDecoder over heuristic scanning**: The `_extractCalls` helper from conv 15 was a workaround — the real fix is proper ArrayBuffer decoding. `_extractCalls` remains as defense-in-depth.
- **7-epic structure**: Organized improvements into logical epics matching HWA's feature areas, ordered by impact (XHR reliability → push events → API methods → storage → architecture → UI → advanced).
- **Issue numbering**: Issues #34-#53 span the full improvement plan.

### Test Results

- 101/101 tests passing
- Build: 1.4 MiB (webpack production, clean)
