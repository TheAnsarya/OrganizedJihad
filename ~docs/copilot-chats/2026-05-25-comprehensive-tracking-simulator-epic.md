# Copilot Session Log

Date: 2026-05-25
Session: 1

## Summary
- Created and linked a new epic and child issues for comprehensive tracking + simulator work.
- Implemented baseline API battle recommendation endpoint tied to issue #158.
- Added implementation plan document for epic #153.

## GitHub Issues
- Created epic: #153 Epic: Comprehensive Tracking + Battle Recommendation/Simulation
- Created child issues:
	- #158 Feature: API battle recommendation baseline endpoint
	- #159 Feature: Reward telemetry parity audit (all chests/items/drops)
	- #160 Feature: Battle simulator architecture and model package
	- #161 Feature: Recommendations UI (desktop + userscript integration)
- Added linking comment to #153 with child issue list.

## Files Created
- api/Models/BattleRecommendationModels.cs
- ~docs/plans/2026-05-25-comprehensive-tracking-simulator-epic.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Files Modified
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs

## Key Decisions
- Start with empirical recommendations from recorded battles to provide immediate value.
- Use recency-weighted win rate and sample-confidence scoring for ranking.
- Keep simulator implementation as a dedicated follow-up stream (#160) to avoid blocking recommendation delivery.

## Validation
- Built API project successfully:
	- dotnet build api/OrganizedJihad.Api.csproj
	- Result: success

## Follow-up Items
- Add API tests for /api/sync/battles/recommendations.
- Implement parity matrix and close any reward tracking gaps (#159).
- Begin simulator architecture scaffolding and evaluation harness (#160).

---

Date: 2026-05-25
Session: 2

## Summary
- Implemented #159 reward telemetry parity closure from userscript capture through API import to persistent chest drops.
- Implemented #160 simulator core scaffold and integrated simulated probability into recommendation scoring.
- Implemented first #161 userscript recommendation cards sourced from API with cache-backed fallback.

## GitHub Issues
- Worked against: #159, #160, #161

## Files Created
- api/Services/Simulation/BattleSimulationContracts.cs
- api/Services/Simulation/BattleMonteCarlo.cs
- api/Services/Simulation/BattleSimulationEvaluationService.cs
- ~docs/plans/2026-05-25-reward-parity-matrix.md

## Files Modified
- userscript/src/modules/syncClient.js
- userscript/src/modules/uiManager.js
- api/Models/BrowserSyncData.cs
- api/Models/BattleRecommendationModels.cs
- api/Services/SyncService.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Key Decisions
- Normalize epoch timestamps to ISO in userscript before sync to guarantee DateTime binding.
- Treat consumable rewards as canonical per-drop records and map them to ChestDrops server-side.
- Blend simulator-estimated win probability with sample confidence for recommendation ranking.
- Use silent-failure + short metadata cache in userscript for recommendation API resilience.

## Validation
- Built full solution successfully:
	- dotnet build OrganizedJihad.sln
	- Result: success
- Built userscript successfully:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add tests covering reward replay deduplication and reward-to-opening fallback matching.
- Add simulator calibration tests using historical battle outcomes.
- Extend recommendation cards to desktop app and show explanation drill-down.

---

Date: 2026-05-25
Session: 3

## Summary
- Completed the three requested next steps from Session 2.
- Added API tests for chest reward replay dedupe and fallback opening matching.
- Added simulator calibration tests with Brier/MAE thresholds over historical-style observations.
- Mirrored recommendation cards into desktop dashboard for #161 surface parity.

## GitHub Issues
- Worked against: #159, #160, #161

## Files Created
- tests/OrganizedJihad.Api.Tests/BattleSimulationCalibrationTests.cs

## Files Modified
- tests/OrganizedJihad.Api.Tests/SyncServiceTests.cs
- desktop-app/Components/Pages/Dashboard.razor
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API tests passed:
	- runTests (SyncServiceTests + BattleSimulationCalibrationTests)
	- Result: 33 passed, 0 failed
- Full solution build:
	- dotnet build OrganizedJihad.sln
	- Result: success

## Follow-up Items
- Add desktop recommendations drill-down to show team composition and sample battle links.
- Add CI coverage gate for simulator calibration tests.

---

Date: 2026-05-26
Session: 4

## Summary
- Added desktop recommendation drill-down links from Dashboard cards into filtered Battles view.
- Added query-parameter support in Battles page (`type`, `outcome`, `team`) to apply recommendation context automatically.
- Added CI workflow to run API tests with coverage and execute simulator calibration tests explicitly.
- Fixed a real import-path gap discovered by tests: consumable rewards now import even when chest openings are absent in the same payload.

## GitHub Issues
- Continued implementation and hardening for: #159, #160, #161

## Files Created
- .github/workflows/api-simulator-calibration.yml

## Files Modified
- desktop-app/Components/Pages/Dashboard.razor
- desktop-app/Components/Pages/Battles.razor
- api/Services/SyncService.cs
- tests/OrganizedJihad.Api.Tests/BattleSimulationCalibrationTests.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API tests:
	- runTests (SyncServiceTests + BattleSimulationCalibrationTests)
	- Result: 37 passed, 0 failed
- Full solution build:
	- dotnet build ..\OrganizedJihad.sln
	- Result: success

## Follow-up Items
- Optionally unify desktop recommendation scoring by consuming API recommendation endpoint directly.
- Add PR status check requirement for the new workflow in repository branch protection settings.

---

Date: 2026-05-26
Session: 5

## Summary
- Unified desktop recommendation scoring with userscript/API by switching Dashboard recommendations to API-first retrieval.
- Added resilient fallback to local recommendation generation when API is unavailable.
- Added source/status indicator in desktop UI to make recommendation provenance explicit (API vs Local Fallback).

## GitHub Issues
- Continued implementation for #161 parity and #160 recommendation consistency

## Files Modified
- desktop-app/Components/Pages/Dashboard.razor
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Full solution build:
	- dotnet build ..\OrganizedJihad.sln
	- Result: success

## Follow-up Items
- Add configurable API base URL setting for desktop app (instead of hardcoded localhost endpoint).
- Add dashboard component tests for API-success and fallback rendering paths.

---

Date: 2026-05-26
Session: 6

## Summary
- Implemented configurable recommendation API base URL in desktop dashboard using persisted MAUI Preferences.
- Removed hard dependency on hardcoded `http://localhost:5124` by composing recommendation endpoint from user-configured base URL.
- Kept API-first recommendation retrieval with local fallback and improved UX by always showing recommendation section/settings, even with zero candidates.

## GitHub Issues
- Continued implementation for #161 recommendation parity hardening

## Files Modified
- desktop-app/Components/Pages/Dashboard.razor
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Full solution build:
	- dotnet build ..\OrganizedJihad.sln
	- Result: success

## Follow-up Items
- Add desktop component tests for recommendation source state + fallback UI messaging.
- Consider moving desktop recommendation settings into a dedicated Settings page.

---

Date: 2026-05-26
Session: 7

## Summary
- Added dedicated desktop Settings page for recommendation API configuration.
- Introduced `RecommendationSettingsService` to centralize persisted recommendation settings.
- Refactored Dashboard to read API base URL through service and removed in-card configuration editor.
- Added Settings navigation entry in desktop nav menu.

## GitHub Issues
- Continued #161 parity polish and desktop UX hardening

## Files Created
- desktop-app/Services/RecommendationSettingsService.cs
- desktop-app/Components/Pages/Settings.razor

## Files Modified
- desktop-app/MauiProgram.cs
- desktop-app/Components/_Imports.razor
- desktop-app/Components/Layout/NavMenu.razor
- desktop-app/Components/Pages/Dashboard.razor
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Full solution build:
	- dotnet build ..\OrganizedJihad.sln
	- Result: success

## Follow-up Items
- Add bUnit/component tests for Settings page save/reset flow and Dashboard recommendation source state.

---

Date: 2026-05-26
Session: 8

## Summary
- Expanded API integration coverage for battle recommendations endpoint.
- Added tests that validate simulator-derived response fields are present and in valid bounds.
- Added test for invalid `battleType` normalization behavior (fallback to `arena`).

## GitHub Issues
- Continued #160/#161 reliability and verification work

## Files Modified
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API tests:
	- SyncControllerTests + SyncServiceTests + BattleSimulationCalibrationTests
	- Result: 40 passed, 0 failed
- Full solution build:
	- dotnet build ..\OrganizedJihad.sln
	- Result: success

## Follow-up Items
- Add dedicated desktop component test harness if/when MAUI/Blazor component testing stack is added to solution.

---

Date: 2026-05-26
Session: 9

## Summary
- Performed online tool-source sweep for Hero Wars simulators/calculators/guides.
- Created issue #162 to track external tool catalog + integration adapters.
- Implemented `GET /api/sync/tools/catalog` returning curated external tool metadata.
- Added desktop Settings UI section to fetch/display external tool catalog from API.
- Added API integration test validating tool catalog endpoint payload contract.

## GitHub Issues
- Created: #162 Feature: External Hero Wars tools catalog and integration adapters
- Continued: #153, #160, #161

## Files Created
- api/Models/ToolCatalogModels.cs
- ~docs/plans/2026-05-26-online-tools-survey-and-integration.md

## Files Modified
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- desktop-app/Components/Pages/Settings.razor
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API tests:
	- SyncControllerTests + SyncServiceTests + BattleSimulationCalibrationTests
	- Result: 42 passed, 0 failed
- Full solution build:
	- dotnet build ..\OrganizedJihad.sln
	- Result: success

## Follow-up Items
- Add per-entry verification timestamp and stale-source warning in catalog payload.
- Add optional recommendation blending mode that can annotate external-guide-inspired suggestions.

---

Date: 2026-05-26
Session: 10

## Summary
- Added verification metadata fields to external tool catalog entries (`lastReviewedUtc`, `confidenceScore`, `verificationStatus`).
- Updated desktop Settings tool catalog table to show status badges, confidence percentages, and stale-source warnings.
- Added userscript dashboard external tools section with cache-backed API fetch and status display.
- Extended API integration tests to validate tool catalog metadata field contracts.

## GitHub Issues
- Continued #162 implementation
- Continued #161 parity across userscript + desktop surfaces

## Files Modified
- api/Models/ToolCatalogModels.cs
- api/Services/SyncService.cs
- desktop-app/Components/Pages/Settings.razor
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- API tests:
	- SyncControllerTests + SyncServiceTests + BattleSimulationCalibrationTests
	- Result: 43 passed, 0 failed
- Userscript build:
	- yarn build
	- Result: success
- Full solution build:
	- dotnet build ..\OrganizedJihad.sln
	- Result: success

## Follow-up Items
- Add optional server-side stale detection/score recalculation policy to keep metadata fresh automatically.

---

Date: 2026-05-26
Session: 11

## Summary
- Implemented server-side stale-policy derivation for external tool catalog metadata based on review age and confidence.
- Added query-param filtering/sorting contract to `GET /api/sync/tools/catalog` (`minConfidence`, `includeStale`, `category`, `verificationStatus`, `sort`).
- Added desktop Settings catalog filters and wired query-param fetch.
- Updated userscript tool-catalog fetch to use server-side filtering defaults.
- Added integration test coverage for catalog filter/sort query behavior.

## GitHub Issues
- Continued #162 implementation
- Continued #161 parity (userscript + desktop tool catalog UX)

## Files Modified
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- desktop-app/Components/Pages/Settings.razor
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Key Decisions
- Centralized verification status policy on the API so clients receive consistent freshness labels.
- Kept filter/sort options on the server to reduce duplicated client-side logic and support thin clients.
- Defaulted UI/client filtering to hide stale tools and prioritize higher-confidence entries.

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 6 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add explicit UI controls for `verificationStatus` in desktop Settings and userscript dashboard.
- Consider exposing available category/status enums from API metadata endpoint to avoid hardcoded client lists.

---

Date: 2026-05-26
Session: 12

## Summary
- Added `verificationStatus` filter control to desktop Settings tool catalog panel and wired it into catalog query construction.
- Added userscript dashboard status filter selector for external tools, persisted per-user in local preferences.
- Refactored userscript tools catalog fetch to build query params dynamically and segment cache keys by selected status filter.
- Extended API integration test to assert `verificationStatus` query behavior together with existing filter/sort assertions.

## GitHub Issues
- Continued #162 implementation
- Continued #161 parity and usability improvements

## Files Modified
- desktop-app/Components/Pages/Settings.razor
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 7 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add optional API metadata endpoint for catalog filter options to remove hardcoded category/status values from clients.

---

Date: 2026-05-26
Session: 13

## Summary
- Added API endpoint `GET /api/sync/tools/catalog/filters` to return supported catalog categories, verification statuses, sort options, and client defaults.
- Added `ToolCatalogFilterMetadataResponse` model for typed metadata contract.
- Updated desktop Settings page to load filter/sort options dynamically from API metadata with local fallbacks.
- Updated userscript dashboard external-tools section to load verification status options and default query values from API metadata (cached), removing hardcoded status option rendering.
- Added API integration test coverage for the new metadata endpoint contract.

## GitHub Issues
- Continued #162 implementation
- Continued #161 cross-surface parity hardening

## Files Modified
- api/Models/ToolCatalogModels.cs
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- desktop-app/Components/Pages/Settings.razor
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 7 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Optional: expose label/display-name metadata for filter values so UI can present title-cased labels without client-side formatting logic.

---

Date: 2026-05-26
Session: 14

## Summary
- Created continuation planning document for Team Recommendation Engine restart/resume workflow.
- Created new epic #163 and child issues #167, #168, #169 for backend, engine, and userscript UI workstreams.
- Added Team Recommendation Engine API model contracts and endpoint scaffold:
	- `GET /api/sync/teams/recommendations`
	- mode/objective query handling for arena, grandarena, guildwar, cow, campaign, adventure.
- Implemented first-pass engine logic in `SyncService`:
	- uses simulator-backed historical candidates for arena/grandarena,
	- blends with roster-aware synthetic fallbacks across all modes,
	- returns readiness/confidence/final score rationale cards.
- Added userscript dashboard Team Recommendation Engine section with mode/objective controls and cache-backed API fetch.
- Added integration test coverage for team recommendation endpoint contract.
- Added architecture plan doc for engine layering and next increments.

## GitHub Issues
- Created epic: #163 Epic: Team Recommendation Engine (Simulator + Roster + External Signals)
- Created children:
	- #167 Feature: Team Recommendation API and engine scaffold
	- #168 Feature: Multi-mode scoring profiles and external signal adapters
	- #169 Feature: Userscript Team Recommendation Engine panel

## Files Created
- ~docs/plans/2026-05-26-team-recommendation-engine-continuation-plan.md
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- api/Models/TeamRecommendationModels.cs

## Files Modified
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 8 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Expand mode-specific candidate generation for GW/CoW/Campaign/Adventure using dedicated profile heuristics (#168).
- Add external signal adapter contracts with provenance fields in response cards (#168).
- Add richer UI controls and drill-down explanations in userscript panel (#169).

---

Date: 2026-05-26
Session: 15

## Summary
- Implemented mode-profile and adapter foundation for #168:
	- Added `TeamRecommendationProfileCatalog` with mode+objective weight resolution.
	- Added external signal adapter contract `IExternalRecommendationSignalProvider` and curated implementation.
- Extended team recommendation API model with explainability fields:
	- `modeProfile`
	- structured `provenance[]` metadata per card.
- Integrated mode profile + external signals into recommendation scoring/provenance in `SyncService`.
- Updated userscript Team Recommendation Engine cards to display active profile and top provenance source.
- Extended integration tests to assert mode profile/provenance contract presence.
- Updated architecture plan with implemented status for profiles/adapters/provenance.

## GitHub Issues
- Continued #168 (Multi-mode scoring profiles and external signal adapters)
- Continued #169 (Userscript Team Recommendation Engine panel)

## Files Created
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/ExternalSignalProviders.cs

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/SyncService.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 9 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add mode-specific external signal weighting maps and provenance drill-down details by card.
- Add dedicated endpoint for recommendation profile metadata (labels/weights) to power UI tooltips.

---

Date: 2026-05-26
Session: 16

## Summary
- Implemented profile metadata API for Team Recommendation Engine:
	- `GET /api/sync/teams/recommendations/profiles`
	- returns mode/objective options (value+label), full profile weight matrix, default selections, and external signal mode-weight map.
- Added mode-specific external signal weighting map in curated signal provider and applied weighted external bonus into final recommendation score.
- Enhanced provenance drill-down details:
	- includes active profile weights
	- includes component values and score delta (base -> final)
	- includes external source details with applied mode weight context.
- Updated userscript Team Recommendation Engine panel to consume metadata endpoint for dynamic mode/objective dropdowns and profile weight summary display.
- Added integration test for profile metadata endpoint and weight contract checks.
- Updated architecture plan documentation to reflect these implemented capabilities.

## GitHub Issues
- Continued #168 implementation and posted progress comment with validation details.
- Continued #169 userscript UI explainability improvements.

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 10 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add a compact API endpoint that returns top profile summary for selected mode/objective to reduce client-side matrix search overhead.
- Expand external signal providers beyond curated static references into pluggable adapters with freshness timestamps.

---

Date: 2026-05-26
Session: 17

## Summary
- Expanded Team Recommendation Engine synthetic heuristics with mode/objective-aware lineup scoring:
	- Hero ranking now blends maturity metrics (level/stars/color/artifacts), objective bias, and mode bias.
	- CoW titan recommendations now use titan maturity/depth scoring and include reserve lineup generation.
	- Added additional sustain/fallback lineup generation for guildwar/campaign/adventure.
- Added helper-based card generation path to ensure consistent score blending and provenance formatting across synthetic cards.
- Upgraded userscript Team Recommendation Engine cards to include expandable provenance drill-down:
	- source name/type/confidence
	- source link when available
	- source detail text for explainability.
- Extended API integration test assertions:
	- final score bounds validation
	- campaign rationale presence
	- provenance detail includes score trace context.
- Updated architecture plan document to reflect implemented heuristics and provenance UI drill-down.

## GitHub Issues
- Continued #168 (mode/objective heuristic expansion and scoring quality).
- Continued #169 (userscript explainability drill-down UX).

## Files Modified
- api/Services/SyncService.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 10 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add structured per-source contribution values to API contract (not only detail strings) for richer UI charting.
- Add roster-friction penalties using resources/inventory scarcity to prevent impractical team suggestions.

---

Date: 2026-05-26
Session: 18

## Summary
- Added structured provenance contribution model to Team Recommendation Engine API contract:
	- component values (win/readiness/confidence)
	- profile weights (win/readiness/confidence)
	- base score, external bonus, final score
	- source confidence, source scale, mode external weight
- Updated `SyncService` provenance builder to populate numeric contribution payloads for profile, roster/history, and external signal records.
- Added per-source external bonus allocation for top external signals to improve explainability fidelity.
- Updated userscript Team Recommendation Engine provenance drill-down to render structured numeric contribution rows.
- Extended integration tests to assert contribution payload presence and value bounds.
- Updated architecture plan with continuation notes for structured contribution fields.

## GitHub Issues
- Continued #168 (structured recommendation explainability contract).
- Continued #169 (userscript explainability rendering).

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/SyncService.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 10 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Implement roster friction scoring based on inventory/resource scarcity and upgrade costs.
- Add desktop app recommendation explainability panel reusing structured provenance contribution fields.

---

Date: 2026-05-26
Session: 19

## Summary
- Implemented roster-friction scoring in Team Recommendation Engine:
	- computes normalized resource-pressure from `PlayerSnapshot` and `InventorySnapshot`
	- applies mode/objective-aware friction penalty reduced by readiness
	- applies penalty before external signal bonus blending.
- Extended structured provenance contribution payload with:
	- `frictionPenalty`
	- `resourcePressure`
- Updated recommendation rationale text to include friction penalty percentage.
- Updated userscript provenance details to render friction and pressure values in numeric contribution rows.
- Extended integration tests to assert friction/pressure contribution field presence and bounds.
- Updated architecture plan with continuation notes for friction model implementation.

## GitHub Issues
- Continued #168 (resource-aware scoring model and contract updates).
- Continued #169 (provenance UI contribution rendering updates).

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/SyncService.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 10 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Calibrate resource-pressure thresholds and penalty multipliers from real account progression telemetry.
- Add desktop app recommendation explainability panel reusing structured contribution payload.

---

Date: 2026-05-26
Session: 20

## Summary
- Created a dedicated issue for recommendation calibration/backtesting:
	- #170 `[Team Engine] Add recommendation backtest/calibration endpoint + UI summary`
- Implemented Team Recommendation backtest endpoint in API/controller/service:
	- `GET /api/sync/teams/recommendations/backtest`
	- computes per-team calibration metrics (actual win rate, absolute error, Brier, drift)
	- computes aggregate calibration summary (matched teams/samples, MAE, Brier, quality label)
	- currently supports arena and grandarena modes with explicit unsupported handling for others.
- Added team-signature normalization helper for robust recommendation-to-history matching.
- Added integration test for backtest endpoint contract/bounds and historical match behavior.
- Updated userscript Team Recommendation section to show compact calibration summary from the backtest endpoint.
- Updated architecture plan with continuation notes for calibration/backtest implementation.

## GitHub Issues
- Created: #170
- Continued: #168 (engine backend)
- Continued: #169 (userscript UI)

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 11 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Calibrate friction and quality thresholds with observed telemetry and backtest drift over time.
- Add desktop-side calibration widget using backtest summary endpoint.

---

Date: 2026-05-26
Session: 21

## Summary
- Added telemetry-driven calibration persistence for Team Recommendation Engine friction scaling:
	- backtest updates now persist rolling mode-specific stats in `SyncMetadata`
	- rolling stats include MAE, Brier, prediction bias, sample count, and last objective.
- Added calibration metadata endpoint:
	- `GET /api/sync/teams/recommendations/calibration?mode=...`
	- returns mode friction scale recommendation and current calibration state.
- Team recommendation scoring now reads persisted mode calibration scale and applies it to friction penalty.
- Extended provenance contribution payload with `calibrationScale`.
- Updated userscript calibration summary to include persisted friction scale for selected mode.
- Added/extended integration tests for calibration endpoint and calibration update flow.
- Updated architecture plan with continuation notes for persisted calibration state.

## GitHub Issues
- Continued: #170 (backtest/calibration endpoint and UI summary)
- Continued: #168 (engine calibration + friction integration)
- Continued: #169 (userscript calibration display)

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 11 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add calibration trend windows and recency weighting controls for mode drift analysis.
- Add desktop calibration panel consuming `/api/sync/teams/recommendations/calibration`.

---

Date: 2026-05-26
Session: 22

## Summary
- Implemented calibration trend windows for Team Recommendation Engine metadata:
	- 7/30/90-day trend metrics exposed from calibration endpoint
	- each trend includes samples, MAE, Brier, bias, and trend-specific suggested friction scale.
- Added persisted calibration observations with timestamps to support recency windows.
- Added pruning policy for calibration observations (last 120 days, bounded list size).
- Updated friction-scale selection to prefer 30-day trend-derived scale when available.
- Updated userscript Team Recommendation calibration summary to show 30-day friction scale and observation count.
- Extended integration tests to validate trend window presence and bounds.
- Updated architecture plan to reflect trend-window calibration implementation.

## GitHub Issues
- Continued: #170
- Continued: #168
- Continued: #169

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/SyncService.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 12 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add mode-specific trend preference controls for friction scaling (7d/30d/90d per mode).
- Add desktop calibration panel and trend visualization.

---

Date: 2026-05-26
Session: 23

## Summary
- Implemented mode-aware trend-window controls and API exposure for calibration friction scaling.
- Added default trend windows by mode via profile catalog:
	- arena=7d, grandarena=30d, guildwar=30d, cow=90d, campaign=30d, adventure=30d.
- Added supported window set (7/30/90) to profile mode metadata and calibration response payloads.
- Added optional `preferredTrendWindowDays` query support to:
	- `/api/sync/teams/recommendations`
	- `/api/sync/teams/recommendations/calibration`
- Recommendation scoring now resolves friction calibration scale using selected/default trend window.
- Userscript Team Recommendation UI now includes Trend selector (`Auto`/`7d`/`30d`/`90d`) and propagates the selected window in API requests.
- Calibration summary now labels dynamic trend window (`frictionScaleXd`) instead of fixed 30d text.
- Extended integration tests for:
	- mode metadata trend defaults
	- calibration override behavior (`preferredTrendWindowDays=7`).

## GitHub Issues
- Continued: #170
- Continued: #168
- Continued: #169

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 12 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add API-side persisted trend-window preference per mode (optional) for cross-client consistency.
- Add desktop calibration panel and trend visualization.

---

Date: 2026-05-26
Session: 24

## Summary
- Implemented API-side persistence for Team Recommendation trend-window preferences by mode.
- Added new preference endpoints:
	- `GET /api/sync/teams/recommendations/preferences`
	- `PUT /api/sync/teams/recommendations/preferences` with mode/window payload.
- Added metadata contract support:
	- mode options now include `isUserPreference`
	- profile metadata now resolves preferred trend windows from persisted server preference state.
- Updated calibration/recommendation scale resolution to include persisted preference priority.
- Updated userscript trend selector to save preference to API and invalidate profile metadata cache so Auto mode reflects server-side preference.
- Added integration test covering preference persistence and profile metadata reflection.

## GitHub Issues
- Continued: #170
- Continued: #168
- Continued: #169

## Files Modified
- api/Models/TeamRecommendationModels.cs
- api/Services/SyncService.cs
- api/Controllers/SyncController.cs
- userscript/src/modules/uiManager.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/plans/2026-05-26-team-recommendation-engine-architecture.md
- ~docs/copilot-chats/2026-05-25-comprehensive-tracking-simulator-epic.md

## Validation
- Targeted API integration tests:
	- runTests (SyncControllerTests)
	- Result: 12 passed, 0 failed
- Full solution build:
	- dotnet build c:\Users\me\source\repos\OrganizedJihad\OrganizedJihad.sln
	- Result: success
- Userscript build:
	- yarn build
	- Result: success (bundle size warnings only)

## Follow-up Items
- Add desktop app controls for mode trend preferences and calibration trend display parity.
- Expand backtest support beyond arena/grandarena where robust team matching is possible.
