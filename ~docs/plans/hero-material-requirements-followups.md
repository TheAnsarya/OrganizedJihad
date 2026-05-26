# Hero Material Requirements Follow-ups

## Context
Initial implementation in userscript projects roster-wide required item totals to max heroes using tracked account history (`heroUpgrades`, `equipmentChanges`, `inventoryItemUsages`).

## Implemented Now
- Projection helper computes total remaining level/color deficits and item rollups.
- Heroes tab shows "Overall Items Needed To Max Heroes" panel.
- Confidence/coverage metrics are shown so users can judge estimate quality.

## Deferred Work (Documented)
1. Exact deterministic recipe catalog integration
- Pull per-hero/per-rank equipment recipes from game data catalogs (or trusted maintained dataset).
- Replace inferred per-step rates with exact ingredient trees.

2. Item name resolution
- Map item IDs to canonical localized names/icons in UI.
- Fall back to IDs only when unknown.

3. Inventory subtraction and shortage view
- Join projected totals with current inventory counts.
- Show "needed", "owned", and "shortage" columns.

4. Hero-level projection details
- Add per-hero expandable breakdown listing projected top needs per hero.
- Provide sorting by highest shortage pressure.

5. Model calibration
- Recompute projection baselines by mode/time window (e.g., 30/90-day behavior).
- Auto-adjust confidence based on recency and sample density.

6. API/desktop parity
- Expose projection endpoint in API for desktop-app consumption.
- Reuse one shared model contract between userscript and desktop settings/dashboard views.

7. Installer/ease workflow enhancements
- Add optional post-install health check summary and shortcut creation in installer.
- Add one-click open of userscript diagnostics panel after installation.

## Suggested Next Slices
- Slice A: Inventory subtraction + shortage columns.
- Slice B: Item name/icon mapping and UI polish.
- Slice C: Deterministic recipe catalog ingestion.
