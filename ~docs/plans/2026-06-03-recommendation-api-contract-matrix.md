# Recommendation API Contract Matrix

Date: 2026-06-03
Related Epic: #346
Related Arena Milestone: #345
Related Platform Issue: #347

## Objective
Define stable response expectations for recommendation and simulation API surfaces used by userscript recommendation UIs.

## Endpoint Matrix

### GET /api/sync/battles/recommendations
Purpose: historical/simulator recommendation candidates for a target battle profile.

Request Query:
- battleType (arena | grandarena | titanarena)
- opponentId (optional)
- opponentPower (optional)
- powerWindow (optional)
- minSamples (optional)
- limit (optional)

Expected Response Fields:
- battleType: string
- opponentId: number|null
- opponentPower: number|null
- powerWindow: number
- minSamples: number
- limit: number
- sampleCount: number
- baselineWinRate: number (0..1)
- recommendations: array
- generatedAtUtc: ISO timestamp

Recommendation Row Expectations:
- teamPreview: string (required for display)
- weightedWinRate OR estimatedWinProbability OR simulatedWinProbability: number (0..1)
- confidence OR confidenceScore: number (0..1)
- score OR finalScore: number (0..1)
- battles OR sampleSize: number (optional)
- rationale: string (optional)

### GET /api/sync/teams/recommendations
Purpose: mode/objective recommendation engine fallback or primary source outside direct battle history.

Request Query:
- mode (arena | grandarena | guildwar | cow | adventure | dungeon | toe)
- objective (balanced | offense | defense | speed | sustain)
- limit (optional)
- minSamples (optional)
- preferredTrendWindowDays (optional)

Expected Response Fields:
- mode: string
- objective: string
- limit: number
- roster: object
- recommendations: array
- generatedAtUtc: ISO timestamp

Recommendation Row Expectations:
- source: string
- teamPreview: string (required)
- estimatedWinProbability: number (0..1)
- readinessScore: number (0..1)
- confidenceScore: number (0..1)
- finalScore: number (0..1)
- rationale: string (optional)
- provenance: array (optional)

### GET /api/sync/teams/recommendations/arena/simulate
Purpose: Arena-first integrated recommendation + simulation endpoint for userscript recco consumers.

Compatibility Role:
- Canonical fast-path for arena recommendation consumers in userscript.
- Additive-compatible with existing `/api/sync/teams/recommendations` and `/api/sync/battles/recommendations` routes.
- Existing recommendation routes remain supported for fallback/backward compatibility.

Request Query:
- objective (balanced | offense | defense | speed | sustain)
- limit (optional)
- minSamples (optional)
- opponentId (optional)
- opponentPower (optional)
- powerWindow (optional)
- preferredTrendWindowDays (optional)

Expected Response Fields:
- mode: "arena"
- objective: string
- opponentId: number|null
- opponentPower: number|null
- opponentPowerUsed: number
- powerWindow: number
- minSamples: number
- limit: number
- historySampleCount: number
- recommendations: array
- generatedAtUtc: ISO timestamp

Recommendation Row Expectations:
- source: "history" | "engine"
- teamPreview: string (required)
- estimatedWinProbability: number (0..1)
- simulatedWinProbability: number (0..1)
- simulationConfidenceLow: number (0..1)
- simulationConfidenceHigh: number (0..1)
- simulationRuns: number
- confidenceScore: number (0..1)
- finalScore: number (0..1)
- teamPowerEstimate: number
- opponentPowerUsed: number
- rationale: string

Nullable and Fallback Semantics:
- `opponentId` may be null when recommendations are generated from generalized arena context.
- `opponentPower` may be null; clients should prefer `opponentPowerUsed` for display and diagnostics.
- Client fallback order remains stable:
	1) win probability: `estimatedWinProbability` -> `simulatedWinProbability` -> `weightedWinRate`
	2) confidence: `confidenceScore` -> `confidence` -> (`simulationConfidenceHigh - simulationConfidenceLow`)
	3) score: `finalScore` -> `score` -> `weightedWinRate`

### GET /api/sync/teams/recommendations/profiles
Purpose: mode/objective options and weight metadata for client controls.

Expected Response Fields:
- modes: array
- objectives: array
- profiles: array

### GET /api/sync/teams/recommendations/preferences
Purpose: retrieve persisted trend-window preferences.

Expected Response Fields:
- modes: array with preferredTrendWindowDays

### PUT /api/sync/teams/recommendations/preferences
Purpose: save persisted trend-window preferences.

Request Body:
- mode: string
- preferredTrendWindowDays: 7|30|90

Expected Response Fields:
- mode: string
- preferredTrendWindowDays: number
- updatedAtUtc: ISO timestamp

### GET /api/sync/teams/recommendations/backtest
Purpose: evaluate recommendation calibration against recent outcomes.

Expected Response Fields:
- mode/objective/lookbackDays
- matchedSamples
- mae
- brier
- qualityLabel
- teamBreakdown[]

### GET /api/sync/teams/recommendations/calibration
Purpose: return calibration metadata and friction scale guidance.

Expected Response Fields:
- mode
- preferredTrendWindowDays
- supportedTrendWindowDays
- suggestedFrictionScale
- trendWindows[]

### GET /api/sync/teams/recommendations/operations-summary
Purpose: return compact per-mode operational projection for dashboard diagnostics.

Request Query:
- preferredTrendWindowDays (optional, 7|30|90)

Expected Response Fields:
- preferredTrendWindowDays
- modes[]
- generatedAtUtc

Mode Summary Row Expectations:
- mode: string
- suggestedFrictionScale: number
- meanAbsoluteError: number
- meanBrierScore: number
- predictionBias: number
- samples: number
- isStale: boolean
- lastUpdatedUtc: ISO timestamp|null

## Userscript Normalization Rules (Client Side)
- Win probability fallback order:
	1) estimatedWinProbability
	2) simulatedWinProbability
	3) weightedWinRate
- Confidence fallback order:
	1) confidenceScore
	2) confidence
	3) simulationConfidenceHigh - simulationConfidenceLow (derived where available)
- Score fallback order:
	1) finalScore
	2) score
	3) weightedWinRate

## Contract Hardening TODOs
- Add/maintain API integration tests per endpoint for required fields and numeric bounds.
- Expand response-shape projection endpoints for lightweight dashboard polling.
- Add explicit compatibility notes for nullable fields and fallback semantics (arena simulation complete; continue for remaining endpoints).
- Add versioning strategy note for breaking vs additive contract changes.
- Treat arena simulation endpoint as the canonical userscript fast-path while preserving existing endpoints for compatibility (documented).

## Versioning Strategy (Current)
- Additive fields to existing recommendation payloads are the default compatibility path.
- Breaking payload/route changes require explicit versioned route introduction.
- Contract consumers should tolerate additive fields and continue relying on documented fallback orders above.
