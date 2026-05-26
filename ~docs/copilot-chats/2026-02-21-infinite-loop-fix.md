# Session Log: 2026-02-21 — Infinite Loop & Metadata Fix

## Date & Session

2026-02-21 — Session 8, Conversation 3

## Summary

User reported TamperMonkey "spiraling in an infinite loop" and changes not auto-updating. Root-cause analysis found three compounding issues:

1. **Webpack stripped TamperMonkey metadata** — The `// ==UserScript==` block ended up at line ~7600 of the webpack output (buried inside the bundle). TamperMonkey requires it at line 1 to parse `@match`, `@grant`, `@run-at`. Without it, the script either ran everywhere or didn't load properly.

2. **IndexedDBStorage.init() called 4× concurrently** — The constructor called `this.init()`, then `index.js` called `await idbStorage.init()`, then `gameTracker.init()` called `await this.storage.init()`, then `apiMonitor.init()` called `await this.storage.init()`. Each call created a new `indexedDB.open()` request, racing for `this.db`.

3. **Script ran on outer page AND game iframe** — `@match` included both `hero-wars.com` (outer shell page) and `nextersglobal.com` (game iframe). This caused double XHR monkey-patching and double UI badge creation.

## Files Modified

- `userscript/webpack.config.cjs` — Added `webpack.BannerPlugin` to prepend the TamperMonkey metadata block at line 1 of the output.
- `userscript/src/index.js` — Removed outer-page `@match` patterns (`hero-wars.com`). Added runtime hostname guard to abort on non-game pages. Replaced `await idbStorage.init()` with `await idbStorage.initPromise`. Bumped version to 3.0.1.
- `userscript/src/modules/indexedDBStorage.js` — Made `init()` idempotent: constructor calls `_openDatabase()` once and stores in `initPromise`; `init()` just returns that promise.
- `userscript/INSTALL.md` — Updated Option C loader script to remove outer-page @match patterns.
- `~docs/copilot-chats/2026-02-21-infinite-loop-fix.md` — This session log.

## Key Decisions

- **Removed `hero-wars.com` @match patterns** — The game runs entirely in the iframe on `nextersglobal.com` / `hero-wars-fb.com`. Running on the outer shell page served no purpose and caused duplicate initialization.
- **Kept apiMonitor's XHR patching** — Both `apiMonitor` and `gameTracker` patch XHR, creating a wrapper chain. This is intentional (apiMonitor logs raw traffic, gameTracker processes game data). The chain works correctly without loops.
- **Metadata canonical source is now webpack.config.cjs** — The `index.js` metadata block is annotated as informational only.

## Issues Referenced

- Related to #29 (window functionality), #30 (tab content), #31 (data collection verification)

## Auto-Update Guidance

For changes to auto-reload in TamperMonkey on page refresh, use **Option C** from `INSTALL.md`:
1. Run `yarn dev` (watch mode — rebuilds on file changes)
2. Use the loader script with `@require file:///...` pointing to the build output
3. Page refresh picks up the rebuilt file automatically

## Follow-up Items

- 34 pre-existing test failures need fixing (storage mock API mismatches from prior refactors)
- Consider creating a GitHub issue for test cleanup
