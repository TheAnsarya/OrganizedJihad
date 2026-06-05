# Battle Team Recommendations - Server Architecture Guide

Date: 2026-06-05

## Short answer

Battle team recommendations are generated in the API server, not in the userscript.

The userscript only requests recommendation data and renders it in the UI.

## Execution boundary

1. Userscript responsibilities (client)
- Collect gameplay telemetry from Hero Wars API calls.
- Sync captured data to local API endpoints.
- Request recommendation payloads from API and display cards/diagnostics.

2. API server responsibilities (source of truth)
- Store telemetry in SQLite via data layer.
- Normalize recommendation mode/objective inputs.
- Build candidate teams from historical battle samples.
- Run simulation/scoring math and rank recommendations.
- Persist calibration/trend preferences in SyncMetadata-backed state store.

3. Data layer responsibilities
- Persist immutable battle/activity snapshots and mutable metadata.
- Provide queryable historical corpus for recommendation generation.

## Key server modules

- `api/Services/TeamRecommendation/BattleRecommendationMath.cs`
- `api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs`
- `api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs`
- `api/Services/TeamRecommendation/TeamRecommendationCalibrationStateMath.cs`
- `api/Services/TeamRecommendation/TeamRecommendationStateStore.cs`
- `api/Services/Simulation/BattleMonteCarlo.cs`

## Request/response flow

1. Userscript calls recommendation endpoint on local API.
2. API loads relevant battle samples from database.
3. API applies filters and builds candidates.
4. API runs simulation/scoring and returns ranked recommendations.
5. Userscript renders returned payload and health diagnostics labels.

## Why this boundary matters

- Consistency: recommendation logic is centralized and versioned server-side.
- Testability: recommendation math/state is covered by API tests.
- Evolvability: scoring/calibration upgrades do not require userscript-heavy rewrites.
- Trust: userscript acts as UI/transport, while ranking logic stays in a controlled backend path.

## Operational note

If recommendation behavior changes, update API tests/benchmarks first, then validate userscript rendering contracts.
