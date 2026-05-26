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

---

## Session
- Date: 2026-05-26
- Session Number: 3
- Scope: Add inventory-aware shortage calculations and UI columns for projected hero requirements.

## Summary
- Extended requirements projection output with owned and shortage quantities by item.
- Corrected overall totals so projected totals are computed across all items, not only the displayed top-N rows.
- Updated Heroes panel table to show Needed, Owned, and Shortage columns with aggregate shortage summary.
- Added calculator tests for ownership/shortage behavior and top-limit total correctness.

## Files Modified
- userscript/src/modules/helpers/HeroMaterialRequirementsCalculator.js
- userscript/src/modules/uiManager.js
- userscript/tests/heroMaterialRequirementsCalculator.test.js
- userscript/package.json

## Validation
- yarn test heroMaterialRequirementsCalculator.test.js --runInBand: passed (5 tests)
- yarn test --runInBand: passed (17 suites, 694 tests)
- yarn build: passed

## Deferred Follow-up (Updated)
- Deterministic per-hero recipe catalog ingestion for exact ingredient trees.
- Item name/icon resolution for human-readable requirements table entries.
- API/desktop parity endpoint and shared contract for projections.
- Installer UX extras (post-install health summary and shortcuts).

---

## Session
- Date: 2026-05-26
- Session Number: 4
- Scope: Improve readability of requirements panel by resolving item IDs into names when possible.

## Summary
- Added item name mapping in Heroes requirements flow by reusing parsed inventory metadata.
- Requirements table now renders each row with item ID and a readable label.
- Added fallback prettifier for non-mapped IDs (snake/kebab IDs become title-cased labels).

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/package.json

## Validation
- yarn test --runInBand: passed (17 suites, 694 tests)
- yarn build: passed

## Deferred Follow-up (Updated)
- Deterministic per-hero recipe catalog ingestion for exact ingredient trees.
- Icon enrichment for requirements table labels.
- API/desktop parity endpoint and shared contract for projections.
- Installer UX extras (post-install health summary and shortcuts).

---

## Session
- Date: 2026-05-26
- Session Number: 5
- Scope: Improve installation simplicity with one-click first-run validation.

## Summary
- Added a new Settings action: `Run Health Check` in a `First-Run Health Check` section.
- Implemented local checks for API reachability, account detection, snapshot capture, and hero roster capture.
- Added pass/fail output with inline hints to reduce setup troubleshooting time.
- Updated install guide to include health-check verification step.
- Created a dedicated issue for this installer UX slice: #180.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/INSTALL.md
- userscript/package.json

## Issues Referenced
- #179 Hero material requirements projection/UI
- #180 Improve userscript installation UX with first-run health checks

## Validation
- yarn test --runInBand: passed (17 suites, 694 tests)
- yarn build: passed

## Deferred Follow-up (Updated)
- Deterministic per-hero recipe catalog ingestion for exact ingredient trees.
- Icon enrichment for requirements table labels.
- API/desktop parity endpoint and shared contract for projections.
- Installer UX shortcut actions (open diagnostics and API endpoint directly).
