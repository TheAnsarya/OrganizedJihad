# 2026-05-27 - Requirements Item Icon Enrichment

## Session
- Date: 2026-05-27
- Session Number: 1
- Scope: Improve projected hero requirements readability with icon-enriched item rows.

## Summary
- Created and implemented issue #182.
- Extended Heroes requirements panel item rendering to include icons alongside item labels.
- Reused inventory category metadata when available to choose consistent icon families.
- Added deterministic fallback icon mapping based on item ID patterns when category metadata is missing.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/package.json

## Files Created
- ~docs/copilot-chats/2026-05-27-requirements-item-icon-enrichment.md

## Issues Referenced
- #182 Enrich projected hero requirement items with category icons

## Key Decisions
- Kept projection math untouched; this slice is purely display/readability focused.
- Prioritized stable deterministic fallbacks so unknown items still render with a useful visual cue.

## Validation
- yarn test --runInBand: passed (17 suites, 694 tests)
- yarn build: passed

## Known Follow-up
- Replace emoji icon fallbacks with sprite/icon assets when available.
- Add deterministic item-name catalog integration for richer labels and icon accuracy.
- Add API/Desktop parity for projection payload consumption.

---

## Session
- Date: 2026-05-27
- Session Number: 2
- Scope: Add deterministic projected item catalog resolver module and refactor Heroes requirements UI to use it.

## Summary
- Created and implemented issue #183.
- Added `ProjectedItemCatalogResolver` helper as a centralized resolver for projected requirement item display metadata.
- Refactored `uiManager` Heroes requirements panel to consume resolver APIs instead of inline item-name/icon logic.
- Added dedicated resolver unit tests covering runtime metadata preference and deterministic fallbacks.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/package.json

## Files Created
- userscript/src/modules/helpers/ProjectedItemCatalogResolver.js
- userscript/tests/projectedItemCatalogResolver.test.js

## Issues Referenced
- #183 Add deterministic projected item catalog resolver for hero requirements UI

## Validation
- yarn test projectedItemCatalogResolver.test.js --runInBand: passed (4 tests)
- yarn test --runInBand: passed (18 suites, 698 tests)
- yarn build: passed

## Known Follow-up
- Expand resolver with deterministic catalog entries beyond runtime metadata.
- Move from emoji glyphs to maintained icon asset mapping when available.
- Add API/Desktop parity for projection payload and display metadata contracts.

---

## Session
- Date: 2026-05-27
- Session Number: 3
- Scope: Seed deterministic projected item catalog entries and enforce metadata precedence.

## Summary
- Created and implemented issue #184.
- Added seeded deterministic entries in `ProjectedItemCatalogResolver` for high-frequency projected IDs.
- Implemented resolution precedence:
	1. Runtime metadata
	2. Seeded catalog metadata
	3. Pattern-based deterministic fallbacks
- Expanded resolver tests for seeded resolution and runtime-over-seeded overrides.

## Files Modified
- userscript/src/modules/helpers/ProjectedItemCatalogResolver.js
- userscript/tests/projectedItemCatalogResolver.test.js
- userscript/package.json

## Issues Referenced
- #184 Seed deterministic projected item catalog entries for hero requirements

## Validation
- yarn test projectedItemCatalogResolver.test.js --runInBand: passed (6 tests)
- yarn test --runInBand: passed (18 suites, 700 tests)
- yarn build: passed

## Known Follow-up
- Replace emoji-based seeded icons with maintained image/icon asset mapping.
- Expand seeded catalog breadth using observed top projected IDs from real accounts.
- Add API/Desktop parity contract for resolver metadata payloads.
