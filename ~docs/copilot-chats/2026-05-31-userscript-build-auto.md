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
