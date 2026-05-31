# 2026-05-31 - Userscript Build Auto Session Log

---

## Session
- Date: 2026-05-31
- Session Number: 1
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- serscript/package.json
- userscript/src/index.js
- userscript/src/styles/main.css
- ~docs/oj-manual-prompts-log.txt
- userscript/src/modules/battleRecommendationOverlay.js

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T14:55:10.533Z

---

## Session
- Date: 2026-05-31
- Session Number: 2
- Scope: in-game battle recommendation overlay for pre-fight enemy targeting contexts

## Summary
- Added a new floating userscript module `BattleRecommendationOverlay` that displays recommendation cards directly on gameplay screens.
- Wired overlay updates into live API-processing flow so recommendation context changes when enemy lists are opened and when attack calls target a specific opponent.
- Added mode detection/mapping for Arena, Grand Arena, Titan Arena, Guild War, and Clash of Worlds call paths.
- Implemented opponent-aware recommendation fetching for arena-family modes via `/api/sync/battles/recommendations` with `battleType`, `opponentId`, and `opponentPower` filters.
- Implemented mode-level fallback recommendations for Guild War/CoW via `/api/sync/teams/recommendations`.
- Added full styling for the new overlay in `main.css`, including compact battle-safe readability and mobile responsiveness.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/index.js
- userscript/src/styles/main.css
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Key Decisions
- Kept this overlay independent from `DomTargeting` auto-hide registration so recommendations remain visible during battle transitions.
- Used arena-family opponent filters where available instead of only mode-level recommendations to align with "about to fight" intent.
- Reused existing API recommendation surfaces to avoid introducing new backend contract risk during this slice.

## Known Issues / Follow-up
- Opponent targeting currently defaults to the first visible enemy after enemy-list calls when an explicit attack target has not yet been selected.
- Grand Arena currently surfaces one recommendation list for the selected opponent context rather than per-round team slot recommendations.
- Clash of Worlds and Guild War currently use mode-level fallback recommendations until explicit enemy roster extraction for those flows is added.

## Validation
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 3
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- serscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/styles/main.css
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt
- userscript/tests/battleRecommendationOverlay.test.js

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:10:32.157Z
---

## Session
- Date: 2026-05-31
- Session Number: 4
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- serscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/styles/main.css
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt
- userscript/tests/battleRecommendationOverlay.test.js

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:10:53.358Z

---

## Session
- Date: 2026-05-31
- Session Number: 5
- Scope: long-form recommendation overlay hardening pass (18 risk slices: 6 high, 12 medium)

## Summary
- Upgraded `BattleRecommendationOverlay` from initial v1 implementation into a robust battle-time recommendation surface with race-safe networking, metadata-driven target extraction, and segmented Grand Arena recommendations.
- Added targeted Jest coverage for the new behavior across context detection, request shaping, fallback paths, and overlay interactions.
- Preserved in-battle visibility while adding stronger reliability controls for API downtime and bursty API-call sequences.

## High-Risk Slices Completed (6)
1. Stale response/race protection via monotonic request sequencing to prevent out-of-order payload rendering.
2. In-flight fetch cancellation with `AbortController` to avoid rendering superseded contexts.
3. Exponential retry backoff with cached-payload fallback for API outage resiliency.
4. Deep metadata extraction pipeline for Guild War/CoW target context (`guildWarDefense/currentGuildWar/cowAttackMap/cowDefensePlan` etc.) when explicit enemy-list endpoints are absent.
5. Grand Arena per-team segmented recommendation flow (slot-specific opponent power windows instead of a single aggregate recommendation).
6. Strict mode/objective normalization to supported allowlists before query construction.

## Medium-Risk Slices Completed (12)
1. Expanded API-call context map coverage (`clanWarGetDefence`, `crossClanWar_getAttackMap`, `crossClanWar_getSettings`, etc.).
2. Added context source tagging (attack target vs enemy list vs metadata source) in subtitle rendering.
3. Added auto-refresh scheduling while overlay remains visible.
4. Added visibility-change refresh resume behavior after tab refocus.
5. Added minimum refresh-gap throttle to suppress burst duplicate fetches.
6. Added mode-specific `minSamples` strategy (lower threshold for sparse GW/CoW data).
7. Added collapsible overlay body with persisted preference.
8. Added draggable overlay header with persisted position.
9. Added health-state badges (`Live`, `Cached data`, `API retry backoff`).
10. Added segmented rendering section model/UI for Grand Arena team-slot cards.
11. Added helper normalization for mixed payload fields (`enemyUserId/targetUserId/opponentId`, power/team power variants).
12. Added dedicated Jest suite (`battleRecommendationOverlay.test.js`) covering hotkey toggle, URL construction, fallback behavior, segmented GA calls, metadata extraction, sanitization, cache/backoff behavior, drag persistence, and collapse persistence.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/styles/main.css
- userscript/tests/battleRecommendationOverlay.test.js
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass)
- yarn build (pass)
