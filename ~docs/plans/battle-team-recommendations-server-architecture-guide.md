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

## What userscript calls

Primary battle overlay calls (`userscript/src/modules/battleRecommendationOverlay.js`):

- `GET /api/sync/teams/recommendations/arena/simulate` (arena first-path)
- `GET /api/sync/battles/recommendations` (arena-family + segmented grand arena)
- `GET /api/sync/teams/recommendations` (mode-level fallback)
- `GET /api/sync/teams/recommendations/operations-summary` (optional ops diagnostics)

Dashboard Team Recommendation section (`userscript/src/modules/uiManager.js`) also calls:

- `GET /api/sync/teams/recommendations/profiles`
- `GET /api/sync/teams/recommendations/backtest`
- `GET /api/sync/teams/recommendations/calibration`
- `GET /api/sync/teams/recommendations/preferences`
- `PUT /api/sync/teams/recommendations/preferences`

## Troubleshooting missing endpoints in /docs

If recommendation endpoints do not appear in `http://localhost:5124/docs/`:

1. Confirm the API process started successfully.
2. Check for EF migration startup failures (pending model changes can crash startup before docs load).
3. Validate OpenAPI directly:
	- `GET /swagger/v1/swagger.json`
4. Ensure you are querying the currently running instance (stale/older process can expose outdated contracts).
5. If testing a published binary, republish before smoke checks; stale publish artifacts can expose outdated route maps and cause false 404 results on docs/OpenAPI endpoints.

Expected recommendation routes in OpenAPI:

- `/api/sync/battles/recommendations`
- `/api/sync/teams/recommendations`
- `/api/sync/teams/recommendations/arena/simulate`
- `/api/sync/teams/recommendations/profiles`
- `/api/sync/teams/recommendations/preferences`
- `/api/sync/teams/recommendations/backtest`
- `/api/sync/teams/recommendations/calibration`
- `/api/sync/teams/recommendations/operations-summary`

## Why this boundary matters

- Consistency: recommendation logic is centralized and versioned server-side.
- Testability: recommendation math/state is covered by API tests.
- Evolvability: scoring/calibration upgrades do not require userscript-heavy rewrites.
- Trust: userscript acts as UI/transport, while ranking logic stays in a controlled backend path.

## Operational note

If recommendation behavior changes, update API tests/benchmarks first, then validate userscript rendering contracts.
