# Comprehensive Tracking + Simulator Epic Plan

Date: 2026-05-25
Epic: #153

## Objective
Deliver complete reward/progression telemetry and an in-house battle recommendation/simulation system that can surface actionable team guidance in UI.

## Linked Issues
- #158 Feature: API battle recommendation baseline endpoint
- #159 Feature: Reward telemetry parity audit (all chests/items/drops)
- #160 Feature: Battle simulator architecture and model package
- #161 Feature: Recommendations UI (desktop + userscript integration)

## Current Baseline
- Userscript already tracks extensive battle/chest/progression events and writes to IndexedDB.
- API + data layers already persist broad entity coverage.
- Recommendation and simulator capabilities are currently limited/fragmented.

## Delivery Phases

## Phase A - Recommendation Baseline (#158)
- Add API endpoint for ranked team recommendations by battle type.
- Rank by recency-weighted win rate + sample confidence.
- Support filters: opponentId, opponentPower +/- window.
- Document request/response and intended UI usage.

## Phase B - Reward Parity Audit (#159)
- Produce parity matrix: API method -> userscript store -> sync payload -> API DTO -> DB table -> UI panel.
- Verify all chest/reward pathways:
	- chestOpen, artifactChestOpen, titanArtifactChestOpen, pet_chestOpen
	- consumableUseLootBox, towerOpenChest, bossOpenChest, skinChestOpen, runeChestOpen, gachaOpen
- Add missing mappings and tests where gaps are found.

## Phase C - Simulator Architecture (#160)
- Define simulation interfaces:
	- feature extractor (teams/opponent/context)
	- deterministic rule layer (known game mechanics approximations)
	- stochastic layer (Monte Carlo runs)
	- confidence estimator/calibration
- Build first local model package from first principles (no direct copyrighted code copy).
- Add validation harness against recorded real outcomes.

## Phase D - UI Integration (#161)
- Userscript and desktop surfaces for recommendations:
	- top candidate teams
	- estimated win probability
	- confidence / sample size
	- rationale and caveats
- Add operator controls (battle type, opponent power band, minimum samples).

## Success Criteria
- Recommendation endpoint is usable and stable with real data.
- Reward parity matrix confirms complete chest/item coverage, with gaps closed.
- Simulator architecture documented and scaffolded for iterative improvement.
- UI displays explainable recommendations sourced from local telemetry.
