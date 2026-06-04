# Arena Simulation Capability Slice (Issue #345)

Date: 2026-06-03
Parent Epic: #346
Arena Milestone: #345
Platform Track: #347
Umbrella: #204
Status: In Progress (Slices 1-2 implemented)

## Slice 1 Delivered In This Session

Area A: API contract and endpoint
- Added GET /api/sync/teams/recommendations/arena/simulate
- Added integrated response model: ArenaTeamRecommendationSimulationResponse
- Added simulator-enriched fields on TeamRecommendationCard for cross-endpoint parity

Area B: Arena orchestration
- Added SyncService.GetArenaTeamRecommendationSimulationAsync(...)
- Merges historical arena recos + engine recos
- Re-simulates candidates against effective opponent power
- Dedupe/rank output for userscript consumption

Area C: Userscript consumption
- Overlay arena context now calls arena simulation endpoint first
- Retains existing fallback flow to team engine when sparse/empty

Area D: Validation
- API tests passed for new endpoint contract
- Overlay tests passed with updated call-path assertions

## Remaining Work Under #345

Block 1: Arena explainability UI expansion
- Render simulation interval and power-used details on overlay rows (DONE)
- Render simulation interval/runs/power-used details in dashboard recommendation rows (DONE)

Block 2: Arena sparse-data policy hardening
- Add explicit no-data and sparse-data labels from API to userscript (DONE)
- Add source mix counts in arena simulation API response for diagnostics (DONE)
- Add backoff/fallback diagnostics parity in dashboard and overlay (remaining)

Block 3: Arena smoke checklist completion
- Execute and record in-game manual smoke for arena attack/end + enemy-list flows

Block 4: Arena API governance hooks (feeds #347)
- Add response envelope/version policy note
- Add endpoint-specific compatibility matrix update

## Next Slice (Immediate)

Implement dashboard operations/arena simulation parity badges and labels:
- source mix chip (history vs engine)
- fallback-state badge parity with overlay
- stale-data and sparse-data harmonized wording across surfaces
