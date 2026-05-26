# Team Recommendation Engine Architecture

Date: 2026-05-26
Related Epic: #163
Related Issues: #167, #168, #169, #170

## Purpose
Define the architecture for a mode-aware Team Recommendation Engine that combines simulator output, current roster readiness, and curated external signals for userscript in-game recommendations.

## Scope (Current Increment)

- API endpoint scaffold for team recommendations by mode/objective.
- Initial candidate sources:
	- Historical battle-derived candidates (Arena/Grand Arena)
	- Synthetic roster-derived fallback candidates (all modes)
- Userscript dashboard panel with mode/objective controls.
- Mode profile catalog + external signal adapter contract + provenance output fields.

## Core API Contract

- Endpoint: GET /api/sync/teams/recommendations
- Query:
	- mode: arena | grandarena | guildwar | cow | campaign | adventure
	- objective: balanced | offense | defense | speed | sustain
	- limit: 1..10
	- minSamples: minimum history samples for historical candidates
- Response:
	- mode/objective/limit
	- roster summary (heroes/titans/pets/teamPower/resources)
	- ranked recommendation cards with:
		- source
		- teamPreview
		- estimatedWinProbability
		- readinessScore
		- confidenceScore
		- finalScore
		- rationale

## Engine Flow

1. Normalize mode/objective.
2. Load latest roster state from heroes/titans/pets snapshots.
3. For Arena/Grand Arena:
	- Pull historical battle recommendations (existing simulator path).
	- Convert to engine cards and compute readiness from roster match.
4. Generate synthetic fallback teams from current roster for all modes.
5. Blend win/readiness/confidence into final score using objective profile.
6. Rank, dedupe, and return top N cards.

## Objective Weight Profiles

- balanced: win 0.50, readiness 0.30, confidence 0.20
- offense: win 0.60, readiness 0.20, confidence 0.20
- defense: win 0.35, readiness 0.40, confidence 0.25
- speed: win 0.55, readiness 0.30, confidence 0.15
- sustain: win 0.40, readiness 0.35, confidence 0.25

## External Signal Strategy


- Adapter interfaces now provide metadata-derived priors.
- Keep strict compliance:
	- no third-party code ingestion
	- metadata + derived scoring features only
- Recommendation provenance now includes source-level external detail and scoring context.

## Implemented In This Iteration

- `TeamRecommendationProfileCatalog` resolves per-mode/per-objective weights.
- `IExternalRecommendationSignalProvider` introduced with curated tool-backed implementation.
- Recommendation cards now include:
	- `modeProfile`
	- structured `provenance[]` entries with source name/type/url/confidence/detail.
- Userscript cards render profile and top provenance source summary.

## Implemented In This Iteration (Continuation)

- Added profile metadata endpoint: `GET /api/sync/teams/recommendations/profiles`.
- Metadata payload now includes:
	- mode options (value + label)
	- objective options (value + label)
	- resolved profile weight matrix for all mode/objective combinations
	- mode-specific external signal influence map
- Userscript Team Recommendation Engine now consumes metadata endpoint for dynamic controls and profile weight summary display.

## Implemented In This Iteration (Continuation 2)

- Expanded synthetic lineup generation with mode/objective-aware heuristics:
	- hero ranking uses maturity + mode bias + objective bias
	- CoW titan recommendations use titan maturity and depth scoring
	- campaign/adventure/guildwar produce additional sustain/fallback variants
- Added richer recommendation rationale text for tactical context.
- Userscript cards now include expandable provenance drill-down with:
	- source name/type/confidence
	- source link when available
	- detail text for score component traceability
- Added API integration test assertions for final score bounds and provenance score detail presence.

## Implemented In This Iteration (Continuation 3)

- Added structured numeric contribution payload on recommendation provenance records:
	- component values (win/readiness/confidence)
	- profile weights (win/readiness/confidence)
	- base score, external bonus, final score
	- mode external weight, source scale, source confidence
- Updated provenance generation to populate per-source external bonus allocation for top external signals.
- Updated userscript provenance drill-down to render structured numeric contribution rows for chart-ready explainability.
- Extended integration test coverage to assert contribution presence and numeric bounds.

## Implemented In This Iteration (Continuation 4)

- Added roster-friction scoring to recommendation ranking:
	- computes normalized resource-pressure from snapshot and inventory (gold, emeralds, consumables, evolution items, soul stones)
	- computes mode/objective-aware friction penalty reduced by roster readiness
	- applies friction penalty before external bonus blending
- Added structured friction explainability fields in provenance contribution payload:
	- `frictionPenalty`
	- `resourcePressure`
- Updated recommendation rationale text to include friction impact.
- Updated userscript provenance details to display friction and pressure metrics.

## Implemented In This Iteration (Continuation 5)

- Added Team Recommendation backtest endpoint:
	- `GET /api/sync/teams/recommendations/backtest`
	- evaluates recommendation predictions against recorded Arena/Grand Arena outcomes
	- returns aggregate calibration metrics (MAE, Brier, quality) and per-team drift/error.
- Added service-level normalization/matching of recommendation team previews to historical team keys for calibration.
- Added integration coverage for backtest endpoint contract and value bounds.
- Updated userscript Team Recommendation section to fetch/show compact calibration summary:
	- quality label
	- MAE
	- matched samples and teams
	- optional no-data/unsupported note.

## Implemented In This Iteration (Continuation 6)

- Added persisted calibration state for recommendation friction scaling:
	- backtest results now update mode-specific rolling calibration stats in `SyncMetadata`
	- tracked stats include running MAE, running Brier, prediction bias, and sample count
	- derived per-mode `suggestedFrictionScale` from observed prediction bias.
- Added calibration metadata endpoint:
	- `GET /api/sync/teams/recommendations/calibration?mode=...`
	- returns suggested friction scale + calibration telemetry for requested mode.
- Team recommendation scoring now reads mode calibration scale and applies it to friction penalty.
- Userscript calibration summary now includes persisted friction scale for the selected mode.
- Added integration assertions to verify calibration endpoint behavior after backtest updates.

## Implemented In This Iteration (Continuation 7)

- Added calibration trend windows (7/30/90 days) to calibration metadata:
	- trend windows compute mean MAE, mean Brier, bias, sample count, and trend-specific suggested friction scale
	- 30-day trend scale is now preferred for active friction scaling when observations exist.
- Persisted calibration observations with timestamps and pruning policy (last 120 days, bounded list size).
- Updated userscript calibration summary to display 30-day friction scale with observation count.
- Extended integration tests to assert trend window presence and value bounds.

## Implemented In This Iteration (Continuation 8)

- Added mode-aware calibration trend-window defaults and API-configurable preference handling:
	- Arena default 7d, Grand Arena 30d, Guild War 30d, CoW 90d, Campaign 30d, Adventure 30d
	- supported window set currently: 7/30/90.
- Team recommendation scoring endpoint now accepts optional `preferredTrendWindowDays` and uses it for friction-scale resolution.
- Calibration endpoint now accepts optional `preferredTrendWindowDays` and returns:
	- `preferredTrendWindowDays`
	- `supportedTrendWindowDays`
	- friction scale resolved from preferred window when observations exist.
- Profile metadata now exposes per-mode default/supported trend-window options for clients.
- Userscript Team Recommendation UI now includes a Trend selector:
	- `Auto (mode default)` / `7d` / `30d` / `90d`
	- selection flows through recommendations + calibration API calls and summary label (`frictionScaleXd`).
- Expanded integration tests for mode metadata trend defaults and calibration override behavior.

## Implemented In This Iteration (Continuation 9)

- Added API-side persistence for mode trend-window preferences:
	- persisted in `SyncMetadata` under `team_recommendation_trend_preferences_v1`
	- model stores per-mode preferred window with update timestamp.
- Added new Team Recommendation preference endpoints:
	- `GET /api/sync/teams/recommendations/preferences`
	- `PUT /api/sync/teams/recommendations/preferences` with `{ mode, preferredTrendWindowDays }`.
- Team Recommendation profile metadata endpoint now resolves preferred trend window per mode from persisted preferences and marks `isUserPreference` when overridden.
- Calibration/recommendation friction-scale resolution now checks priority:
	- explicit query override
	- persisted mode preference
	- calibration-mode fallback
	- profile default.
- Userscript trend selector now persists preference to API and invalidates profile metadata cache so Auto reflects saved server-side defaults.
- Added integration coverage for preference persistence and metadata reflection.

## UI Integration

- Userscript dashboard section: Team Recommendation Engine.
- Controls:
	- Mode selector
	- Objective selector
- Display fields:
	- Team preview, source, win %, readiness %, confidence %, final score, rationale.
	- expandable provenance details per card.
- Cache keys segmented by mode/objective.

## Validation

- API integration tests for contract, ranges, and mode normalization.
- Build verification:
	- dotnet build OrganizedJihad.sln
	- yarn build (userscript)

## Next Steps

1. Add desktop app controls for trend preference and calibration summary parity with userscript.
2. Expand backtest support for additional modes where deterministic team-key mapping is feasible.
3. Wire profile metadata + recommendation explainability into desktop app views.
4. Add compact API projection endpoint for dashboard-friendly recommendation summary cards.
