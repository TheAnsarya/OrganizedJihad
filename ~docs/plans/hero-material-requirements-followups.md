# Hero Material Requirements Follow-ups

## Context
Initial implementation in userscript projects roster-wide required item totals to max heroes using tracked account history (`heroUpgrades`, `equipmentChanges`, `inventoryItemUsages`).

## Implemented Now
- Projection helper computes total remaining level/color deficits and item rollups.
- Heroes tab shows "Overall Items Needed To Max Heroes" panel.
- Confidence/coverage metrics are shown so users can judge estimate quality.
- Projection output includes deterministic metadata resolution (name/icon/category) with seeded + alias support.
- Projection output includes owned + shortage totals from inventory snapshots.
- API/Desktop parity shipped for projected item catalog metadata endpoints and desktop views.
- Tier-by-tier material aggregates now rendered in Heroes panel (`Grey`, `Green`, `Blue`, `Violet`, `Orange`, `Red+`).
- Level-band material aggregates now rendered in Heroes panel (`1-40`, `41-80`, `81-120`, `121-130`).
- One-command install validation now available via `yarn install:check` with required/optional endpoint diagnostics.

## Deferred Work (Documented)
1. Exact deterministic recipe catalog integration (still pending)
- Pull per-hero/per-rank equipment recipes from game data catalogs (or trusted maintained dataset).
- Replace inferred per-step rates with exact ingredient trees.

2. Per-hero drill-down and tier deep links
- Add expandable per-hero requirement cards showing top shortages by tier.
- Link tier totals to filtered item views for faster planning.

3. Level-band projection granularity
- Add optional level-band groups (e.g., 1-40, 41-80, 81-120, 121-130) alongside color tiers.
- Provide toggle between color-tier and level-band aggregation.

4. Dense-panel usability
- Add collapse/expand controls for tier and level-band sections.
- Add sticky header + lightweight virtualization for large requirement tables.

Status update:
- Collapse/expand controls for tier and level-band sections are now implemented in Heroes projection panel.
- Persisted expand/collapse preferences are now implemented for projection sections.
- One-click Expand All / Collapse All controls are now implemented for projection sections.
- Sticky headers and bounded scroll containers are now implemented for projection tables.
- Lightweight virtualization (paged top-items rendering) is now implemented in the Heroes projection panel.
- Responsive max-height tuning is now implemented for projection scroll containers.
- Keyboard shortcuts are now implemented for projection paging controls (`Alt+Left`/`Alt+[`, `Alt+Right`/`Alt+]`).
- Remaining: optional shortcut remapping/customization if user demand appears.

5. Model calibration
- Recompute projection baselines by mode/time window (e.g., 30/90-day behavior).
- Auto-adjust confidence based on recency and sample density.

6. Installer/ease workflow enhancements
- Add optional post-install health check summary and shortcut creation in installer.
- Add one-click open of userscript diagnostics panel after installation.

Status update:
- Browser-open modes and JSON output are now implemented for `yarn install:check` (`--json`, `--open [failed|required|all]`).
- Remaining: optional post-install summary and one-click diagnostics-panel open path in installer script.

## Suggested Next Slices
- Slice A: Deterministic recipe catalog ingestion (exact per-rank ingredient trees).
- Slice B: Per-hero requirement drill-down and tier deep links.
- Slice C: Level-band/tier UI density controls + calibration tuning.
