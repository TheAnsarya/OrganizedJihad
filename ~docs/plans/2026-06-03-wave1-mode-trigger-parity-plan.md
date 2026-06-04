# Wave 1 Mode Trigger Parity Plan

Date: 2026-06-03
Related Epic: #336
Related Issue: #339

## Goal
Apply Arena reliability patterns to Grand Arena, Titan Arena, and Guild War by ensuring trigger parity, context quality, and recommendation rendering robustness.

## Scope
Scope A: Grand Arena segmented team-slot recommendation rendering and context confidence.

Scope B: Titan Arena target resolution parity and mode normalization stability.

Scope C: Guild War metadata-only context selection with clear quality signaling.

## Trigger Parity Matrix (Initial)
Grand Arena trigger set includes grandArenaGetEnemies, grandArenaAttack, and grandArenaEnd.

Titan Arena trigger set includes titanArenaGetEnemies, titanArenaAttack, and titanArenaEnd.

Guild War trigger set includes clanWarGetDefence, clanWarGetBriefInfo, clanWarGetInfo, clanWarAttack, clanWarBattle, and clanWarEnd.

## Acceptance Criteria
Criterion A: Each mode has deterministic context selection from attack, list, and state calls.

Criterion B: Overlay recommendations render for each mode with stable metrics fields.

Criterion C: Context signal labels accurately represent source quality.

Criterion D: Sparse data path clearly falls back to engine recommendations where applicable.

Criterion E: Integration tests assert trigger-driven request mode and parameters for each mode.

## Test Additions
Userscript test additions include mode-specific assertions in battleRecommendationOverlay.test.js for context source precedence, segmented row rendering where required, and fallback hint behavior by mode.

API test additions include mode normalization tests for wave-1 aliases and objective defaults, plus contract assertions for mode-specific payload fields when segmented responses are used.

## Rollout Sequence
Step 1: Grand Arena parity hardening and tests.

Step 2: Titan Arena parity hardening and tests.

Step 3: Guild War metadata-context quality pass and tests.

Step 4: End-to-end wave-1 regression run.

## Risks
Risk A: Mode-specific metadata sparsity may produce stale context.

Risk B: Segmented payload shape drift can break client rows.

## Mitigations
Mitigation A: Enforce fallback and signal labeling.

Mitigation B: Add JSON-shape regression tests for segmented outputs.

Mitigation C: Keep alias-normalization tests explicit.
