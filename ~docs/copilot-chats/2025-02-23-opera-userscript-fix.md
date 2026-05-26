# 2025-02-23 — Opera Userscript Fix + API Call Log + Debug (Session 8, Conversations 11-13)

## Summary

1. Fixed the TamperMonkey userscript not running in Opera GX by reverting the iframe detection/injection logic that was introduced in commit `4f3b7c2` and iterated on throughout the prior session. The root cause was a `return;` statement in index.js that killed the entire script when running on `hero-wars.com` (the outer page), preventing the badge, XHR hooks, and overlay from loading.

2. Added an "API Log" debug tab to the overlay UI showing the last 100 API calls, and fixed the XHR proxy to handle `responseType = "json"` (where `responseText` throws `InvalidStateError`).

3. Enhanced API Log with diagnostic info (URL, page hostname, data shape snippets) to debug why data tracking wasn't working. Fixed double XHR proxy conflict between `apiMonitor` and `gameTracker` by reordering initialization. Identified likely root cause: script runs on `hero-wars.com` outer page where XHR proxy can't intercept calls from the `nextersglobal.com` iframe (separate JS context).

## Root Cause

At commit `c4ecc06` (Fix #23), the script worked because:

- `@match` included both `hero-wars.com` and `nextersglobal.com` domains
- No iframe guard — the script simply ran on whatever page Tampermonkey injected it into

In commit `4f3b7c2` (Fix #29), an iframe-only guard was added that checked `window.location.hostname` and returned early if the page was not a known game domain (nextersglobal.com, hero-wars-fb.com, fbsbx.com). This caused the script to silently exit on hero-wars.com.

During this session, multiple failed approaches were attempted:

1. **`@require file://` dev loader** — blocked by Chromium security
2. **GM_xmlhttpRequest-based loader** — lost GM_ sandbox context
3. **Removing hero-wars.com from @match (v0.9.1)** — Tampermonkey in Opera does NOT inject into cross-origin iframes, so script never ran
4. **Iframe injection from outer page (v0.9.2)** — cross-origin iframes can't be accessed via contentDocument

The fix was simply reverting to the approach from `c4ecc06`: include both domains in `@match`, remove the iframe guard, let the script run directly.

## Files Modified

- **userscript/src/index.js** — Removed ~70 lines of iframe detection/injection logic (MutationObserver, contentDocument injection, localhost fallback). Updated version references to 0.9.2. Updated informational metadata block.
- **userscript/webpack.config.cjs** — Cleaned up `@match` patterns (use `https://*.hero-wars.com/*` wildcard). Removed `@updateURL`/`@downloadURL` (localhost dev server). Removed `@grant GM_info` (not needed).
- **userscript/src/modules/gameTracker.js** — Added `_apiCallLog` ring buffer (last 100 calls) with `_pushApiLog()` helper. Added call tracking (dispatched/unhandled/errors) in `processAPIResponse`. Fixed XHR proxy to handle `responseType = "json"` where `responseText` throws `InvalidStateError`. Added `default` case in switch to track unhandled API methods. Enhanced skipped-call logging to include data shape, top-level keys, and data snippet. Added URL and page hostname tracking to log entries. Added `_lastInterceptedUrl` and `_pageHost` fields.
- **userscript/src/modules/uiManager.js** — Added "API Log" nav tab. Added `renderApiLog()` method showing timestamped, color-coded entries with call names, dispatch status, error details, intercepted URL, and page hostname. Added auto-refresh via `apiLog` event subscription.
- **userscript/src/styles/main.css** — Added CSS for API log entries including `.oj-log-url` and `.oj-log-page` styles.
- **userscript/src/index.js** — Reordered initialization: `apiMonitor.init()` now runs AFTER `gameTracker.init()` inside `initialize()` to prevent double XHR proxy conflict.

## Files Created

- **userscript/serve-dev.cjs** — Local HTTP server on port 8765 for serving built userscript (created earlier in session, retained for future use)

## Issues Referenced

- Related to Fix #23 (status badge proof-of-life) — restoring the behavior from that fix
- Related to Fix #29 (iframe-only guard) — reverting the guard that broke things

## Key Decisions

1. **No iframe guard**: The script runs on any matching page. On hero-wars.com, the badge/XHR hooks/overlay still initialize. On nextersglobal.com, the game API calls are intercepted.
2. **No dev server auto-update**: The `@updateURL`/`@downloadURL` pointing to localhost:8765 was removed because it added complexity. Dev workflow is: `yarn build` → copy-paste dist file into Tampermonkey editor.
3. **Retained serve-dev.cjs**: The dev server file is kept in the repo for potential future use.

## Test Results

- 101/101 tests passing
- Build clean (1.38 MiB)

## Known Issues / Follow-up

- **DATA NOT TRACKING**: The script badge/UI works on `hero-wars.com`, but the XHR proxy can't intercept API calls made from the `nextersglobal.com` iframe (different JS context). The API Log will show diagnostic details (URL, page hostname, data shape) to confirm this.
- The script may create a badge on hero-wars.com (outer page) AND separately on the nextersglobal.com game iframe, depending on Tampermonkey's injection behavior. This is cosmetic and not harmful.
- Opera GX's Tampermonkey does not inject userscripts into cross-origin iframes. If the game architecture changes to require iframe-only injection, a Chrome Extension approach would be needed instead.
- **Double XHR proxy**: Fixed the initialization order so `gameTracker.init()` runs before `apiMonitor.init()`. Previously, apiMonitor was initialized first, the two proxy layers conflicted.
