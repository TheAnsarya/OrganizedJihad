# 2026-05-26 - Hero Material Requirements UI

## Session
- Date: 2026-05-26
- Session Number: 2
- Scope: Implement userscript-side hero max-progression item requirements projection and display.

## Summary
- Created a new requirements projection helper that estimates roster-wide item demand to target hero level/rank based on tracked historical usage.
- Integrated a new "Overall Items Needed To Max Heroes" panel in the Heroes UI with item totals, level/rank mix, and confidence/coverage indicators.
- Added tests for projection behavior and sparse-data fallback.
- Documented deferred follow-up work for deterministic recipe integration and inventory-shortage parity.

## Files Created
- userscript/src/modules/helpers/HeroMaterialRequirementsCalculator.js
- userscript/tests/heroMaterialRequirementsCalculator.test.js
- ~docs/plans/hero-material-requirements-followups.md

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/package.json

## Issues Referenced
- #179 Userscript: Hero max-progression item requirements projection and rollup UI

## Key Decisions
- Used observed account history to provide immediate practical projections instead of blocking on full recipe catalog ingestion.
- Exposed confidence and signal coverage directly in UI to avoid overstating estimate certainty.
- Target rank set to Red+3 in projection output while preserving compatibility with existing rank naming.

## Validation
- yarn test heroMaterialRequirementsCalculator.test.js --runInBand: passed (3 tests)
- yarn test --runInBand: passed (all suites)
- yarn build: passed

## Deferred Follow-up
- Deterministic per-hero recipe catalog ingestion and item naming/icon enrichment.
- Inventory subtraction and shortage display.
- API/desktop parity endpoint and shared contracts.
- Installer UX extras (post-install health summary and shortcuts).
