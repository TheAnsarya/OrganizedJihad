# Recommendation/Simulation API Governance, Telemetry, and Mode Rollout Framework

Date: 2026-06-04
Related Issue: #347
Related Epics: #336, #346
Supporting Docs:
- ~docs/plans/2026-06-03-recommendation-api-contract-matrix.md
- ~docs/plans/2026-06-03-team-recommendations-ecosystem-roadmap.md
- ~docs/plans/2026-06-03-recommendations-operations-dashboard-plan.md

## 1. API Governance Standards

### 1.1 Versioning and Compatibility
- Preserve existing route families under `/api/sync/teams/recommendations/*` and `/api/sync/battles/recommendations` for compatibility.
- Prefer additive changes for response payload evolution.
- Reserve breaking changes for explicit versioned route introductions.
- Maintain userscript fallback semantics for key card fields:
	- win probability
	- confidence
	- score

### 1.2 Response Envelope Consistency
- Recommendation endpoints must return mode/objective identity fields and `generatedAtUtc`.
- Recommendation card rows must always provide a display-safe team field (`teamPreview`) and normalized numeric confidence/probability values in [0..1].
- Operations/calibration endpoints must include trend-window context when applicable.

### 1.3 Input Validation Rules
- Reject unsupported trend windows with 400 (allowed: 7, 30, 90).
- Reject unknown modes for persisted preference writes.
- Normalize known aliases consistently before evaluation/scoring.

## 2. Telemetry and Quality Contract

### 2.1 Required Observability Dimensions
- Per-request mode and objective context.
- Calibration metrics: MAE, Brier, bias, sample counts.
- Staleness/readiness signal for mode-level diagnostics.
- Friction scale recommendation and trend-window provenance.

### 2.2 Client-Facing Health Semantics
- Canonical health states:
	- `healthy` -> `Healthy`
	- `monitor` -> `Needs Attention`
	- `stale` -> `Stale`
- Clients should prefer API-provided health state/label and only fallback to local threshold inference when missing.

### 2.3 API Model Mapping (Schema Reflected in Models)
Documented telemetry contracts are reflected in endpoint payload models in `api/Models/TeamRecommendationModels.cs`, including:
- `TeamRecommendationCalibrationResponse`
- `TeamRecommendationCalibrationTrendWindow`
- `TeamRecommendationOperationsSummaryResponse`
- `TeamRecommendationModeOperationsSummary`

## 3. Mode Onboarding Checklist and Parity Template

Each new mode (post-Arena) must pass the following checklist before production rollout:

### 3.1 Context and Trigger Coverage
- Captured-call trigger map exists for mode-specific API name variants.
- Userscript context extraction supports observed call aliases.

### 3.2 Recommendation Contract and Rendering
- API mode/objective normalization is covered by tests.
- Recommendation rows render with stable probability/confidence/score semantics.
- Segmented or mode-specific response structures render with explicit labels.

### 3.3 Operations and Calibration Visibility
- `/calibration` returns mode metadata and trend windows.
- `/operations-summary` includes mode row with staleness and quality telemetry.
- Overlay/dashboard surfaces show canonical health labels.

### 3.4 Regression Coverage
- API integration tests for mode normalization, bounds, and required fields.
- Userscript tests for trigger path + card rendering fallback behavior.

## 4. Rollout Framework and Sequence

### Phase A (Completed Baseline)
- Arena-first capability and operations surfaces.

### Phase B (Wave 1)
- Grand Arena, Titan Arena, Guild War parity expansion.

### Phase C (Wave 2)
- CoW, Adventure, Dungeon, ToE expansion with mode-specific quality gates.

### Phase D (Steady-State Operations)
- Drift and staleness guardrail tuning.
- Calibration policy tuning from observed telemetry.

## 5. Governance Gate for Closing Mode Work

A mode slice is considered complete only when all of the following are true:
- Contract matrix entries are updated or confirmed unchanged.
- API and userscript tests for the mode are passing.
- Operations summary and calibration metadata are visible for that mode.
- Session log records validation commands and outcomes.

## 6. Ownership and Change Control

- API contract updates: update contract matrix and relevant model docs in the same change set.
- Userscript semantic changes: update overlay/dashboard diagnostics notes and tests together.
- Rollout scope changes: update roadmap issue mapping and acceptance criteria before implementation.
