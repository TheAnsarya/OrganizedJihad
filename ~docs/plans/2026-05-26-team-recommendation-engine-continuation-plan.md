# Team Recommendation Engine Continuation Plan

Date: 2026-05-26
Scope: Continue from simulator + telemetry baseline into a production Team Recommendation Engine that uses current roster state, historical outcomes, and curated external knowledge signals.

## Objectives
- Deliver actionable team recommendations in userscript on-screen UI while playing.
- Cover modes incrementally: Arena, Grand Arena, Guild War (GW), Clash of Worlds (CoW), Campaign, Adventure.
- Ground recommendations in:
	- Internal telemetry (battles, snapshots, upgrades, inventory/resource state)
	- Current roster state (heroes/titans/pets and progression)
	- Simulator probabilities + confidence intervals
	- Curated external-source metadata/signals (reference-only, no copied proprietary code)

## Current Baseline (Already Implemented)
- API battle recommendations endpoint with simulator metrics.
- Userscript dashboard recommendation cards (arena-focused).
- External tools catalog endpoint + metadata freshness policy.
- Desktop and userscript clients consuming tool metadata.

## Incremental Delivery Strategy
### Phase 1: Engine Scaffold + Arena/Grand Arena Expansion
- Add Team Recommendation Engine service with mode-normalized request contract.
- Build candidate generation from historical winning teams and current roster viability.
- Add readiness scoring from current roster power/state.
- Add userscript panel for multi-mode recommendations.

### Phase 2: Guild War / CoW / Adventure / Campaign Heuristics
- Add mode-specific weighting profiles.
- Add objective-aware recommendations (offense push, defense hold, sustain, speed clear).
- Add resource-aware alternatives (low-invest vs best-in-slot).

### Phase 3: External Signal Adapters
- Add pluggable adapters that ingest curated external metadata/signals.
- Keep references and derived features only; do not import third-party code.
- Add provenance and confidence blending in recommendation rationale.

### Phase 4: Evaluation + Calibration
- Offline backtests by mode using historical outcomes.
- Calibration metrics (Brier/MAE) per mode and per confidence band.
- Drift monitoring and stale model/profile detection.

## Technical Plan
### API Surface
- New endpoint family:
	- GET /api/sync/teams/recommendations
	- Optional: GET /api/sync/teams/recommendation-modes
- Request parameters:
	- mode, objective, limit, includeAlternatives, minSamples
- Response:
	- Ranked teams with simulator probabilities, roster readiness, confidence, rationale, data-source provenance.

### Engine Layers
- Candidate Provider Layer:
	- Historical Team Candidate Provider
	- Roster-Aware Candidate Provider
	- External Signal Candidate Provider (future)
- Scoring Layer:
	- Simulator score
	- Readiness score (heroes/titans/pets availability + power/progression)
	- Resource friction score (upgrade cost pressure)
	- Blended final score by mode profile
- Explanation Layer:
	- Human-readable rationale and top contributing factors.

### Data Inputs
- Internal:
	- Arena/Grand/Titan/GW/raid/adventure battle records
	- Latest player/hero/titan/pet snapshots
	- Resource balances + inventory pressure indicators
- External (reference-only):
	- Tool catalog metadata + curated mode/tag mappings
	- Optional derived matchup priors from public guides (manually curated)

## Userscript UI Plan
- Add a new dashboard section: Team Recommendation Engine.
- Controls:
	- Mode selector (Arena, Grand Arena, GW, CoW, Campaign, Adventure)
	- Objective selector (balanced, offense, defense, speed, sustain)
- Cards show:
	- Team preview, simulator win %, roster readiness %, confidence band, rationale.
- Cache policy:
	- Short TTL with mode/objective-specific keys.

## Risk Controls
- Data sparsity: fallback to roster + simulator priors when mode history is sparse.
- Quality drift: expose confidence and sample counts visibly.
- Legal/compliance: no third-party code ingestion; metadata and derived features only.

## Resume Checklist
1. Confirm epic + child issues and ownership.
2. Implement API model contracts and endpoint scaffold.
3. Implement service layer with Arena/Grand Arena support.
4. Add userscript section with mode/objective controls.
5. Add integration and contract tests.
6. Run full solution build and userscript build.
7. Update session log and issue progress comments.

## Definition Of Done (Current Increment)
- Epic and child issues created.
- Plan + architecture docs committed.
- Team recommendation API endpoint scaffold implemented.
- Userscript panel integrated with mode-aware fetch.
- Tests/builds passing.
