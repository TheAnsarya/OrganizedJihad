# Next Slice Execution Note

Date: 2026-06-03
Status: Ready

## Immediate Next Objectives
Objective A: Close Arena 100% capability criteria (#337) with in-game smoke evidence.

Objective B: Complete wave-1 parity implementation for remaining mode-edge call variants (#339).

Objective C: Expose operations-summary consumption in userscript diagnostics UI (#340).

## Slice A - Arena Closure Evidence (#337)
Step A1: Run manual smoke checklist in real game flow using ~docs/plans/2026-06-03-arena-recommendation-smoke-checklist.md.

Step A2: Capture screenshots for arena list context, attack target recommendations with win percentage and confidence, and fallback/backoff hint states where reproducible.

Step A3: Add evidence comment in issue #337 and mark acceptance checklist items complete.

## Slice B - Wave-1 Residual Parity (#339)
Step B1: Verify whether additional real-world call aliases appear in live logs for grand arena enemy list, titan arena enemy list, and guild war defence/state flows.

Step B2: Add alias mappings and tests only when confirmed by captured call evidence.

Step B3: Keep fallback and context signal semantics unchanged.

## Slice C - Operations UI Consumption (#340)
Step C1: Add userscript API call path to GET /api/sync/teams/recommendations/operations-summary.

Step C2: Render compact operations health block with mode, suggested friction scale, MAE/Brier, and stale status.

Step C3: Add userscript tests for summary payload rendering and missing-field resilience.

## Validation Targets
Validation A: userscript `yarn test --runInBand`.

Validation B: userscript `yarn build`.

Validation C: api `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj`.

## Exit Criteria For Next Session
Exit A: #337 is either closed or only blocked by external/manual evidence.

Exit B: #339 has explicit alias coverage map tied to observed calls.

Exit C: #340 has first-pass userscript diagnostics integration merged and tested.
