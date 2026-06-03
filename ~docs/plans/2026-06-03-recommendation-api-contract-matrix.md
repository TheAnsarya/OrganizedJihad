# Recommendation API Contract Matrix

Date: 2026-06-03
Related Epic: #336
Related Issue: #338

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
- Add API integration tests per endpoint for required fields and numeric bounds.
- Expand response-shape projection endpoints for lightweight dashboard polling.
- Add explicit compatibility notes for nullable fields and fallback semantics.
- Add versioning strategy note for breaking vs additive contract changes.
