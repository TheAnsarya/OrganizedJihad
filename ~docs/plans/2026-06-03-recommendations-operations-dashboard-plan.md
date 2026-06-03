# Recommendations Operations Dashboard Plan

Date: 2026-06-03
Related Epic: #336
Related Issue: #340

## Goal
Provide a robust operational surface for recommendation quality, calibration drift, API health, and fallback behavior so confidence is measurable and actionable.

## Dashboard Domains
Domain A, Quality Metrics: track MAE, Brier, and calibration quality label, along with matched sample counts by mode and objective and trend-window quality comparison for 7/30/90 day windows.

Domain B, Calibration and Drift: track suggested friction scale by mode, trend deltas for quality metrics, and stale observation warnings.

Domain C, Runtime Health: track API response health across live/cached/backoff rates, fallback usage rate from battle to engine path, and missing-context or stale-context frequency.

Domain D, Contract Health: track contract-shape test status from latest run and endpoint compatibility markers by version/date.

## API Support Needed
Need A: projection endpoint for compact dashboard payloads with mode-level quality summary, fallback ratio, and stale-context counts.

Need B: keep existing backtest and calibration endpoints as source-of-truth for deep detail.

## Userscript/UI Support Needed
Need A: compact diagnostics panel section for recommendation health.

Need B: mode filter and trend-window selector parity with recommendation controls.

Need C: clear status badges for live/cached/backoff and fallback usage.

## Acceptance Criteria
Criterion A: Operator can identify per-mode quality regression within one view.

Criterion B: Operator can detect API degradation and fallback overuse quickly.

Criterion C: Dashboard values match API response contracts and test expectations.

Criterion D: Documentation includes interpretation guidance and thresholds.

## Implementation Sequence
Step 1: Define dashboard projection contract and tests.

Step 2: Implement API projection endpoint and aggregate calculations.

Step 3: Add userscript diagnostics rendering section.

Status Update 2026-06-03 (continuous mode):
Step 3 is now implemented in the Battle Recommendations overlay as an opt-in operations diagnostics section (preference key: `battleRecommendationOverlayShowOps`).
The section renders per-mode MAE, Brier, Bias, Suggested Friction Scale, Samples, and Fresh/Stale badge using `/api/sync/teams/recommendations/operations-summary` with cached refresh cadence.

Step 4: Add alerts and threshold labels plus operator docs.

Step 5: Validate with integration and userscript regression suite.

## Initial Threshold Suggestions
Threshold A: MAE warning above 0.22.

Threshold B: Brier warning above 0.28.

Threshold C: fallback usage warning above 40% over recent interval.

Threshold D: backoff/cached warning for sustained rates above 10% of requests.

## Deliverables
Deliverable A: API projection contract doc and endpoint.

Deliverable B: userscript diagnostics panel.

Deliverable C: operational interpretation guide.

Deliverable D: test evidence for contract and rendering behavior.
