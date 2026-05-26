# API Interception Architecture — Root Cause Analysis & Fix Plan

## Date: 2026-02-23

## Problem

**No game data is being collected.** The userscript badge stays at "Listening…" with 0 API
calls intercepted. Hero, battle, chest, quest, and all other tracking is completely
non-functional.

## Root Cause: TamperMonkey Sandbox Isolation

When a TamperMonkey userscript uses any `@grant` directive (e.g., `GM_addStyle`,
`GM_notification`), the script runs inside an **isolated sandbox context**. In this context:

| Symbol                  | In Sandbox             | In Page (Real)                    |
|-------------------------|------------------------|-----------------------------------|
| `window`                | Sandbox wrapper proxy  | The actual page `window`          |
| `XMLHttpRequest`        | Sandbox's copy         | Game's (Zone.js-wrapped) copy     |
| `WebSocket`             | Sandbox's copy         | Game's actual WebSocket           |
| `window.nxg`            | `undefined`            | Game framework module registry    |
| `unsafeWindow`          | ✅ Real page `window`  | N/A (same as `window`)            |

**Our code patches `XMLHttpRequest.prototype.send` — the sandbox's copy.** The game creates
and uses XHR instances from the page's real `XMLHttpRequest`, which is completely separate.
Our proxy never fires.

### HWA's Solution (Reference)

HWA (`injected.js`) avoids this by being injected as a `<script>` element by a Chrome extension
content script. This `<script>` runs directly in the **page context** — no sandbox. Its XHR
proxy patches the real `XMLHttpRequest.prototype`, which the game actually uses.

```
HWA Architecture:
  contentscript.js (content script context, document_start)
    └─ injects <script src="injected.js"> into DOM
        └─ injected.js (PAGE CONTEXT — same world as game)
            ├─ XHR.prototype.open/send/setRequestHeader proxy
            ├─ Dispatches CustomEvent("HeroWarsInterceptedDataEvent")
            └─ pushd hook via window.nxg.getModule('pushd')
```

### Zone.js Complication

Hero Wars uses Angular, which loads Zone.js. Zone.js wraps `XMLHttpRequest` with a
`ZoneAwareXMLHttpRequest` that:

1. Saves original `XMLHttpRequest` as `window.__zone_symbol__originalXMLHttpRequest`
2. Replaces `window.XMLHttpRequest` with a wrapper constructor
3. Wrapper instances store real XHR in `this.__zone_symbol__originalInstance`
4. Prototype methods delegate to the real instance

At `@run-at document-end`, `unsafeWindow.XMLHttpRequest` IS the Zone-wrapped constructor.
Patching its prototype intercepts at the wrapper level, which works correctly because the
game calls wrapper methods.

## Fix Strategy

### Primary Fix: `unsafeWindow` for Page-Context Operations

Replace all page-context global access with `unsafeWindow` equivalents:

```javascript
// Define once at module scope
const PAGE_WINDOW = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

// XHR proxying
PAGE_WINDOW.XMLHttpRequest.prototype.open = function(...) { ... };
PAGE_WINDOW.XMLHttpRequest.prototype.send = function(...) { ... };
PAGE_WINDOW.XMLHttpRequest.prototype.setRequestHeader = function(...) { ... };

// WebSocket proxying
PAGE_WINDOW.WebSocket.prototype.send = function(...) { ... };

// Pushd module access
PAGE_WINDOW.nxg.getModule('pushd');
```

### Secondary Improvement: `@run-at document-start`

Currently `@run-at document-end`. The game's initial login API call (which carries the
full account state: heroes, titans, inventory, resources) happens early — potentially
before `document-end` for the game iframe.

Switching to `document-start` ensures our proxy is installed before ANY game JS executes.
This requires deferring DOM operations (badge, overlay, styles) until `DOMContentLoaded`.

**Risk:** `style-loader` tries to inject `<style>` elements into `<head>` which may not
exist at `document-start`. Needs testing or a fallback strategy.

### Tertiary: Reorder `gameTracker.init()` to Proxy First

Currently:
```
init() → await storage.init() → proxyAPIRequests() → proxyWebSocket()
```

Should be:
```
init() → proxyAPIRequests() → proxyWebSocket() → await storage.init() → timers
```

The proxy doesn't depend on storage. Intercepted data is processed in async callbacks
that fire later (when responses arrive), by which time storage will be ready.

## Files to Modify

| File | Change |
|------|--------|
| `gameTracker.js` | Add `PAGE_WINDOW` constant; replace all `XMLHttpRequest.prototype`, `WebSocket.prototype`, `window.nxg` with `PAGE_WINDOW.*`; reorder `init()` |
| `webpack.config.cjs` | Change `@run-at document-end` → `@run-at document-start` |
| `index.js` | Update informational metadata; add `DOMContentLoaded` deferral for DOM ops |
| Tests | Update mocks to account for `unsafeWindow` |

## Impact

- **Before fix:** 0% data capture — sandbox XHR proxy never fires
- **After fix:** ~100% data capture — proxy on page's real XMLHttpRequest
- **With `document-start`:** Catches initial login batch (full hero/titan/resource state)

## Related Issues

- New: #54 — Critical: Fix TamperMonkey sandbox XHR interception (unsafeWindow)
- New: #55 — Switch to `@run-at document-start` for earlier proxy setup
- Existing: #38 (pushd hook) — pushd also needs `unsafeWindow.nxg`
