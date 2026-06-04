# Team Recommendations Ecosystem Roadmap (Arena-First)

Date: 2026-06-03
Status: Active Planning
Scope: Build a robust recommendations + simulation ecosystem across API and userscript with Arena as the first fully complete capability slice.
Primary Epic: #346
Primary Arena Milestone: #345
Platform Governance Track: #347

## Goals

Goal A: Deliver Arena recommendations as a complete, reliable, explainable experience in live attack flow.

Goal B: Standardize recommendation and simulation API contracts for long-term expansion.

Goal C: Expand mode coverage without degrading Arena reliability.

Goal D: Provide operational visibility through diagnostics, calibration, and confidence provenance.

## Definition Of 100% Capability (Arena)

Arena is considered 100% complete only when all are true:

Criterion A: Overlay visibility is deterministic in arena browse + attack flows.

Criterion B: On-screen hint and notice system explains auto-open and key state transitions.

Criterion C: Battle recommendation endpoint and team-engine fallback are contract-tested end-to-end.

Criterion D: Win probability, confidence, sample counts, and rationale fields render consistently.

Criterion E: Data sparsity and backoff states are visible and actionable.

Criterion F: Regression suite covers trigger names from captured API samples and tracker wiring.

## Epic Structure (Large Slices)

### Epic A: Arena Complete Experience

Deliver full Arena recommendation experience, from target detection through rendering and operator feedback.

Scope:

Scope A: Trigger and context parity against real API call names.

Scope B: Reusable in-overlay hint display system.

Scope C: Payload normalization and rendering resilience.

Scope D: Arena-focused contract and behavior tests.

### Epic B: Recommendation API Platform Hardening

Create a robust API platform for recommendation and simulation consumers.

Scope:

Scope A: Stable response contracts and schema/versioning strategy.

Scope B: Rich diagnostics and projections endpoints for UI and QA.

Scope C: Simulation and historical source provenance consistency.

Scope D: Compatibility guarantees for userscript clients.

### Epic C: Multi-Mode Expansion (Post-Arena)

Extend Arena architecture into Grand Arena, Titan Arena, Guild War, CoW, Adventure, Dungeon, and ToE.

Scope:

Scope A: Mode-specific context extraction and defaults.

Scope B: Objective and trend preference parity.

Scope C: Segmented recommendation handling where needed.

### Epic D: Evaluation, Calibration, and Operations

Operationalize model quality and recommendation trust.

Scope:

Scope A: Backtest and correlation reporting by mode and objective.

Scope B: Drift and stale-signal monitoring surfaces.

Scope C: Confidence calibration policy and guardrails.

## Issue Mapping

Issue A (#346): Parent epic for ecosystem delivery, acceptance, and phased rollout.

Issue B (#345): Arena 100% capability milestone (first complete production slice).

Issue C (#347): API governance, telemetry schema, and multi-mode onboarding framework.

Issue D (#204): Architecture modernization umbrella this workstream continues under.

## Delivery Sequence

Step 1: Complete Epic A (Arena) as the non-negotiable quality baseline.

Step 2: Harden API platform contracts and diagnostics (Epic B).

Step 3: Expand to additional modes using Arena/B-platform patterns (Epic C).

Step 4: Deepen evaluation and operations (Epic D).

## Initial Milestones

Milestone M1: Arena trigger and visibility parity plus hint system.

Milestone M2: Arena recommendation payload robustness and renderer guarantees.

Milestone M3: API contract hardening plus diagnostics endpoints.

Milestone M4: First multi-mode expansion batch covering Grand Arena, Titan Arena, and Guild War.

Milestone M5: Full mode expansion and calibration dashboards.

## Risks and Controls

Risk A: Sparse battle history causes empty recommendations.

Control A: Use a deterministic fallback path and explicit UI state labels.

Risk B: API call-name drift breaks context extraction.

Control B: Use sample-driven trigger parity tests and an alias lookup map.

Risk C: Confidence scores become misleading under drift.

Control C: Use calibration metadata, trend windows, and stale detection badges.

## Traceability

Rule A: Every implementation PR must map to a single parent issue in this roadmap.

Rule B: Child tasks should remain inside parent issue checklists unless they are independent deliverables.

Rule C: Avoid micro-issues for single-line or tiny style-only work.

## Session Start Package

For each implementation session, capture:

Session Field A: Target issue and acceptance criteria.

Session Field B: API endpoints and contracts touched.

Session Field C: Userscript modules and tests touched.

Session Field D: Validation commands and evidence.
