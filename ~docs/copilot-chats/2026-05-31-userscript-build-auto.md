# 2026-05-31 - Userscript Build Auto Session Log

---

## Session
- Date: 2026-05-31
- Session Number: 1
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- serscript/package.json
- userscript/src/index.js
- userscript/src/styles/main.css
- ~docs/oj-manual-prompts-log.txt
- userscript/src/modules/battleRecommendationOverlay.js

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T14:55:10.533Z

---

## Session
- Date: 2026-05-31
- Session Number: 2
- Scope: in-game battle recommendation overlay for pre-fight enemy targeting contexts

## Summary
- Added a new floating userscript module `BattleRecommendationOverlay` that displays recommendation cards directly on gameplay screens.
- Wired overlay updates into live API-processing flow so recommendation context changes when enemy lists are opened and when attack calls target a specific opponent.
- Added mode detection/mapping for Arena, Grand Arena, Titan Arena, Guild War, and Clash of Worlds call paths.
- Implemented opponent-aware recommendation fetching for arena-family modes via `/api/sync/battles/recommendations` with `battleType`, `opponentId`, and `opponentPower` filters.
- Implemented mode-level fallback recommendations for Guild War/CoW via `/api/sync/teams/recommendations`.
- Added full styling for the new overlay in `main.css`, including compact battle-safe readability and mobile responsiveness.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/index.js
- userscript/src/styles/main.css
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Key Decisions
- Kept this overlay independent from `DomTargeting` auto-hide registration so recommendations remain visible during battle transitions.
- Used arena-family opponent filters where available instead of only mode-level recommendations to align with "about to fight" intent.
- Reused existing API recommendation surfaces to avoid introducing new backend contract risk during this slice.

## Known Issues / Follow-up
- Opponent targeting currently defaults to the first visible enemy after enemy-list calls when an explicit attack target has not yet been selected.
- Grand Arena currently surfaces one recommendation list for the selected opponent context rather than per-round team slot recommendations.
- Clash of Worlds and Guild War currently use mode-level fallback recommendations until explicit enemy roster extraction for those flows is added.

## Validation
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 3
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- serscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/styles/main.css
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt
- userscript/tests/battleRecommendationOverlay.test.js

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:10:32.157Z
---

## Session
- Date: 2026-05-31
- Session Number: 4
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- serscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/styles/main.css
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt
- userscript/tests/battleRecommendationOverlay.test.js

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:10:53.358Z

---

## Session
- Date: 2026-05-31
- Session Number: 5
- Scope: long-form recommendation overlay hardening pass (18 risk slices: 6 high, 12 medium)

## Summary
- Upgraded `BattleRecommendationOverlay` from initial v1 implementation into a robust battle-time recommendation surface with race-safe networking, metadata-driven target extraction, and segmented Grand Arena recommendations.
- Added targeted Jest coverage for the new behavior across context detection, request shaping, fallback paths, and overlay interactions.
- Preserved in-battle visibility while adding stronger reliability controls for API downtime and bursty API-call sequences.

## High-Risk Slices Completed (6)
1. Stale response/race protection via monotonic request sequencing to prevent out-of-order payload rendering.
2. In-flight fetch cancellation with `AbortController` to avoid rendering superseded contexts.
3. Exponential retry backoff with cached-payload fallback for API outage resiliency.
4. Deep metadata extraction pipeline for Guild War/CoW target context (`guildWarDefense/currentGuildWar/cowAttackMap/cowDefensePlan` etc.) when explicit enemy-list endpoints are absent.
5. Grand Arena per-team segmented recommendation flow (slot-specific opponent power windows instead of a single aggregate recommendation).
6. Strict mode/objective normalization to supported allowlists before query construction.

## Medium-Risk Slices Completed (12)
1. Expanded API-call context map coverage (`clanWarGetDefence`, `crossClanWar_getAttackMap`, `crossClanWar_getSettings`, etc.).
2. Added context source tagging (attack target vs enemy list vs metadata source) in subtitle rendering.
3. Added auto-refresh scheduling while overlay remains visible.
4. Added visibility-change refresh resume behavior after tab refocus.
5. Added minimum refresh-gap throttle to suppress burst duplicate fetches.
6. Added mode-specific `minSamples` strategy (lower threshold for sparse GW/CoW data).
7. Added collapsible overlay body with persisted preference.
8. Added draggable overlay header with persisted position.
9. Added health-state badges (`Live`, `Cached data`, `API retry backoff`).
10. Added segmented rendering section model/UI for Grand Arena team-slot cards.
11. Added helper normalization for mixed payload fields (`enemyUserId/targetUserId/opponentId`, power/team power variants).
12. Added dedicated Jest suite (`battleRecommendationOverlay.test.js`) covering hotkey toggle, URL construction, fallback behavior, segmented GA calls, metadata extraction, sanitization, cache/backoff behavior, drag persistence, and collapse persistence.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/styles/main.css
- userscript/tests/battleRecommendationOverlay.test.js
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 6
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- serscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:24:41.248Z

---

## Session
- Date: 2026-05-31
- Session Number: 7
- Scope: recommendation overlay mode expansion for Adventure, Guild War, Dungeon, and ToE flows

## Summary
- Expanded in-game recommendation context detection to include additional battle/event flows so the overlay remains active outside arena-family screens.
- Added explicit Adventure, Dungeon, and Tournament of Elements (ToE) context labels in the overlay subtitle.
- Added API-safe mode translation for contexts not yet represented as backend recommendation modes.

## Key Decisions
- Kept context mode and engine mode separate: UI keeps real gameplay context (`dungeon`, `toe`) while API requests map to supported modes (`adventure`, `guildwar`) for compatibility.
- Retained Guild War as first-class mode and preserved existing metadata extraction behavior.
- Lowered sparse-mode sample thresholds for Dungeon/ToE requests to improve cold-start usefulness.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass, 12/12)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 8
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- pi/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:28:44.681Z

---

## Session
- Date: 2026-05-31
- Session Number: 9
- Scope: first-class backend team-recommendation mode support for Dungeon and ToE (option 1)

## Summary
- Implemented real Team Recommendation Engine support for `dungeon` and `toe` modes in backend normalization, profile catalog metadata, external signal weighting, and scoring heuristics.
- Removed userscript compatibility remap for these contexts so overlay now requests `mode=dungeon` and `mode=toe` directly.
- Expanded API and userscript regression tests for the new modes and aliases.

## Files Modified
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Key Decisions
- Added aliases for likely inbound variants (`titan-dungeon`, `power-tournament`, `tournament-of-elements`) to avoid client breakage.
- Kept Dungeon aligned with PvE weighting/heuristics and ToE aligned with competitive guild/tournament heuristics.
- Preserved Titan Arena mapping in overlay as `titanarena -> arena` because backend team engine remains hero-centric for that path.

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass, 12/12)
- dotnet tests (focused): TeamRecommendationMathTests + SyncControllerTests (pass, 39/39)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 10
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- pi/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:31:21.607Z

---

## Session
- Date: 2026-05-31
- Session Number: 11
- Scope: option 2 deepening Dungeon/ToE opponent extraction from live args and metadata

## Summary
- Enhanced overlay context resolution to merge immediate call args with IndexedDB metadata, prioritizing about-to-fight signals for Dungeon and ToE flows.
- Expanded nested extraction coverage for candidate IDs, names, powers, and team arrays across mixed payload shapes (`target`, `defender`, `opponent`, `enemy`, `enemyTeams`, `lineups`, `squads`, etc.).
- Improved attack-path behavior so Arena-family and newer modes can still populate context from args when metadata is missing or stale.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Key Decisions
- Added `_buildCandidateFromArgs` and blended candidate selection (`args` + metadata pool) instead of metadata-only lookup for metadata-light battle calls.
- Kept request contract unchanged while enriching subtitle/target context quality to reduce stale/blank opponent labels.
- Limited deep extraction to existing safety caps (`MAX_DEEP_SCAN_DEPTH`, `MAX_CANDIDATES`) to avoid heavy scans.

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass, 14/14)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 12
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- pi/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:41:28.516Z

---

## Session
- Date: 2026-05-31
- Session Number: 13
- Scope: long-form continuation pass for Adventure/Guild War/Dungeon/ToE overlay hardening (18 slices)

## Summary
- Completed another deep reliability pass on in-game recommendation context quality under noisy mixed API call streams.
- Prioritized active battle signals over low-confidence state events, added mode-aware objective/query tuning, and strengthened extraction sanitization.
- Expanded tests to lock in behavior across Adventure, Guild War, Dungeon, and ToE context transitions.

## High-Risk Slices Completed (6)
1. Added priority-based context commit gate to prevent low-priority mode-state calls from clobbering active battle context.
2. Added short mode-switch cooldown guard to reduce cross-mode flapping during bursty mixed call sequences.
3. Introduced candidate scoring selector (ID match, signal richness, recency, source trust) for metadata+args fusion.
4. Added strict ID/power sanitization bounds to harden against malformed oversized payload values.
5. Added mode-aware objective defaults (`guildwar` defense, `dungeon` sustain, `toe` defense, etc.) to improve engine output relevance when user pref is generic.
6. Added adaptive arena-family power-window sizing based on opponent power to improve matchup neighborhood selection.

## Medium-Risk Slices Completed (12)
1. Expanded Adventure/GuildWar/Dungeon/ToE call-map coverage with additional aliases (`clanWarBattle`, `clanWarEnd`, `tournament_getInfo`, etc.).
2. Added Guild War brief metadata key to guild war candidate source pool.
3. Added dungeon-adjacent metadata key (`guildActivityStats`) to dungeon candidate pool.
4. Switched metadata loading to `Promise.all` in metadata-only context path for lower update latency.
5. Upgraded enemy-list selection from first-row bias to strongest-row preference (power/recency weighted).
6. Added candidate timestamp extraction from heterogeneous fields and integrated freshness into ranking.
7. Extended fallback name extraction with floor/stage/slot derivation for nameless dungeon/tournament payloads.
8. Added objective token into refresh query-key to avoid stale-throttle collisions across objective changes.
9. Improved args-source labeling in context subtitle for clearer signal provenance.
10. Preserved CoW balanced default objective to avoid behavior regression while still adding mode-default framework.
11. Added robust tests for high-priority context stability over low-priority mode-state updates.
12. Added robust tests for power-window adaptation, sanitization behavior, stronger enemy-list selection, and fallback floor labels.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass, 20/20)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 14
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- pi/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/modules/gameTracker.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:49:16.278Z

---

## Session
- Date: 2026-05-31
- Session Number: 15
- Scope: continuation wave - tracker last-target metadata, overlay source-confidence UX, and API mode integration tests

## Summary
- Added tracker-side explicit last-target metadata writes so overlay can resolve current battle targets for Adventure, Guild War, Dungeon, and ToE even when broad metadata is noisy.
- Extended overlay metadata pools to consume these focused keys and added subtitle confidence labeling (`Live Args`, `Fresh Metadata`, `Stale Metadata`).
- Added API integration coverage for `mode=dungeon` and `mode=toe` recommendation endpoints.

## High-Risk Slices Completed (6)
1. Added persistent last-target snapshots in tracker for Adventure/Dungeon/ToE battle-result flows.
2. Added persistent last-target snapshots in tracker for Guild War attack flow.
3. Added explicit mode-keyed metadata map for overlay consumption to reduce wrong-target drift.
4. Added overlay subtitle confidence labeling to surface real-time trust level of context source.
5. Added integration tests for `mode=dungeon` recommendation API response correctness.
6. Added integration tests for `mode=toe` recommendation API response correctness.

## Medium-Risk Slices Completed (12)
1. Added `_storeBattleRecommendationLastTarget` helper to centralize mode-key target metadata persistence.
2. Added opponent id extraction fallback chain for tracker target snapshots.
3. Added opponent name extraction fallback chain for tracker target snapshots.
4. Added defender team-power derivation for tracker target snapshots using compressed battle defenders.
5. Added metadata source-call marker for tracker target snapshots for better overlay diagnostics.
6. Added overlay metadata key ordering that prioritizes focused last-target snapshots before broad state blobs.
7. Added overlay test for dedicated last-target metadata priority in dungeon mode.
8. Added overlay test for `Live Args` context signal rendering.
9. Preserved all prior overlay behavior via full suite regression (expanded to 22 tests).
10. Preserved API controller behavior via focused SyncController integration run.
11. Kept build pipeline intact with successful userscript webpack output.
12. Updated mandatory session logging with full slice accounting and validation evidence.

## Files Modified
- userscript/src/modules/gameTracker.js
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass, 22/22)
- SyncController focused API tests (pass, 19/19)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 16
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- pi/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/modules/gameTracker.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T15:53:48.888Z

---

## Session
- Date: 2026-05-31
- Session Number: 17
- Scope: continuation wave - arena-family last-target hardening, metadata staleness controls, and calibration/profile regression expansion

## Summary
- Extended tracker last-target metadata persistence from Adventure/GuildWar/Dungeon/ToE to Arena/Grand Arena/Titan Arena battle flows.
- Hardened overlay candidate selection with mode TTL age-gates, metadata fallback resolution for sparse attack args, and timestamp-preserving context commits.
- Expanded API integration assertions for calibration/profile defaults (including dungeon/toe scenarios) while preserving test stability against persisted preference side effects.

## High-Risk Slices Completed (6)
1. Added arena-family tracker writes for `battleRecommendationLastTargetArena`, `battleRecommendationLastTargetGrandArena`, and `battleRecommendationLastTargetTitanArena`.
2. Added multi-team defender extraction in tracker for grand-arena style `data.battles` payloads to persist slot power rows for segmented recommendation targeting.
3. Added overlay mode candidate TTL policy and hard candidate usability gating to evict stale/no-signal metadata before selection.
4. Added metadata fallback path for attack-context resolution so sparse attack args can still resolve opponent id/power from dedicated last-target keys.
5. Changed overlay context commit timestamping to preserve source recency (`selected.updatedAt`) so stale/fresh signal reflects real source age.
6. Added calibration integration assertions for dungeon/toe default states to harden non-arena recommendation mode confidence.

## Medium-Risk Slices Completed (12)
1. Added arena-family mode metadata key pools in overlay (`arena`, `grandarena`, `titanarena`).
2. Added reusable `_collectModeCandidates` helper with async metadata fan-out and bounded candidate accumulation.
3. Added reusable `_findMetadataFallbackCandidate` helper to resolve mode fallback with existing candidate scoring.
4. Added candidate usability check in selection loop so stale rows are dropped before ranking.
5. Added score bonus for dedicated last-target sources to prefer focused telemetry over broad state blobs.
6. Added explicit stale-candidate score penalty for safety in mixed-quality pools.
7. Expanded tracker opponent-id extraction fallback chain to include `args.userId` and response target ids.
8. Expanded tracker team extraction from `args.enemyTeams` fallback when defenders are not included in battle result payload.
9. Updated tracker defender power resolution to aggregate multi-team totals when segmented teams are present.
10. Added overlay regression test: arena sparse attack args fallback to dedicated last-target metadata.
11. Added overlay regression test: grand arena segmented requests sourced from dedicated last-target team powers.
12. Added overlay regression tests for stale dungeon metadata eviction and stale-yet-usable metadata signal labeling.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/modules/gameTracker.js
- userscript/tests/battleRecommendationOverlay.test.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass, 26/26)
- SyncController + TeamRecommendationMath focused API tests (pass, 41/41)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 18
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- pi/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/modules/gameTracker.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T16:21:35.301Z

---

## Session
- Date: 2026-05-31
- Session Number: 19
- Scope: continuation wave - dirty workspace stabilization + API alias normalization + broad regression sweeps

## Summary
- Stabilized the remaining in-progress Team Recommendation API service files by unifying mode alias normalization across orchestration, scoring, profiles, and external signal weighting paths.
- Added integration and unit regression tests for alias behavior (`pvp`, `ga`, `titan-arena`, `dungeon-run`, `power-tournament`) to prevent mode drift and fallback regressions.
- Ran broad validation across both API and userscript test suites (not just focused files) to ensure the dirty branch state is safe for commit preparation.

## High-Risk Slices Completed (6)
1. Unified mode alias normalization contract across orchestration and scoring math to remove cross-module canonicalization drift.
2. Added titan-arena alias canonicalization to arena mode for recommendation and calibration endpoints.
3. Added profile-catalog mode normalization for trend-window defaults to prevent alias-specific default mismatch.
4. Added external-signal provider mode normalization so alias inputs always resolve expected mode weights.
5. Added API integration tests proving recommendation endpoint alias normalization for ToE and Dungeon aliases.
6. Added API integration tests proving calibration endpoint alias normalization for titan-arena mode.

## Medium-Risk Slices Completed (12)
1. Added orchestration alias support: `pvp` -> `arena`.
2. Added orchestration alias support: `ga` -> `grandarena`.
3. Added orchestration alias support: `titan-arena` / `titan_arena` / `ta` -> `arena`.
4. Added orchestration alias support: `dungeon-run` -> `dungeon`.
5. Added scoring alias support mirroring orchestration for all new aliases.
6. Added profile-catalog label overrides for `grandarena`, `guildwar`, `cow`, and `toe` to improve UI option readability.
7. Added profile-catalog internal mode normalization helper and reused it in both `Resolve` and default trend-window resolution.
8. Added external-signal provider alias normalization helper and reused it in signal generation and mode weight lookup.
9. Expanded orchestration unit test coverage for all new alias mappings.
10. Added recommendation integration test assertions for alias-normalized response modes (`toe`, `dungeon`).
11. Added calibration integration test assertions for alias-normalized response mode (`arena` from `titan-arena`).
12. Executed full API and full userscript regression sweeps to verify no hidden branch breakages.

## Files Modified
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/ExternalSignalProviders.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj (pass, 94/94)
- yarn test (pass, 37/37 suites, 840/840 tests)
- yarn test -- battleRecommendationOverlay.test.js (pass, 26/26)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 20
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- pi/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/modules/gameTracker.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T16:32:46.994Z

---

## Session
- Date: 2026-05-31
- Session Number: 21
- Scope: continuation wave - confidence-aware recommendation context + commit-prep chunk cleanup

## Summary
- Added confidence-aware context scoring and signal evaluation in overlay candidate selection so stale low-trust metadata is deprioritized while high-confidence fresh context remains actionable.
- Extended tracker last-target metadata payloads with explicit confidence signals consumed by overlay ranking logic.
- Performed commit-prep cleanup by dry-staging and verifying coherent chunk boundaries (API layer, userscript layer, session-log layer) without touching unrelated manual-log file.

## High-Risk Slices Completed (6)
1. Added confidence-aware candidate scoring in overlay so context ranking no longer relies only on id/name/power recency.
2. Added confidence-based signal freshness gate for metadata context labels to reduce false-fresh status under stale telemetry.
3. Added tracker-side confidence emission on last-target snapshots to carry source quality from capture point to overlay selection.
4. Added recommendation endpoint alias integration assertions for `ga` and `pvp` to guard mode normalization parity.
5. Added profile metadata integration assertions for normalized mode labels (`Grand Arena`, `Guild War`, `CoW`, `ToE`).
6. Ran broad API + userscript regressions after wave changes and after commit-prep staging rehearsal to verify branch stability.

## Medium-Risk Slices Completed (12)
1. Added `signalConfidence` to overlay context model.
2. Added context confidence derivation in attack-context commits.
3. Added context confidence derivation in enemy-list commits.
4. Added context confidence derivation in metadata-only mode commits.
5. Added confidence propagation from args-derived candidates.
6. Added confidence propagation from metadata-extracted candidates.
7. Added confidence contribution to candidate score weighting.
8. Added confidence threshold check in candidate usability guard for low-signal rows.
9. Added helper `_resolveCandidateConfidence` with explicit-field and heuristic fallback logic.
10. Added helper `_sanitizeConfidence` for safe [0..1] clamping.
11. Added overlay regression: high-confidence metadata remains fresh inside extended confidence window.
12. Performed dry-stage commit chunk verification with explicit file lists and reset between chunks.

## Files Modified
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/modules/gameTracker.js
- userscript/tests/battleRecommendationOverlay.test.js
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Commit-Prep Chunking
- Chunk 1 (API alias + tests):
	- api/Services/TeamRecommendation/ExternalSignalProviders.cs
	- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
	- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
	- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
	- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
	- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- Chunk 2 (userscript confidence hardening):
	- userscript/src/modules/battleRecommendationOverlay.js
	- userscript/src/modules/gameTracker.js
	- userscript/tests/battleRecommendationOverlay.test.js
	- userscript/package.json
- Chunk 3 (session logging):
	- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- Explicitly excluded from chunks: `~docs/oj-manual-prompts-log.txt`.

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass, 27/27)
- SyncController + TeamRecommendationMath focused API tests (pass, 42/42)
- dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj (pass, 94/94)
- yarn test (pass, 37/37 suites, 841/841 tests)
- yarn build (pass)
---

## Session
- Date: 2026-05-31
- Session Number: 22
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- pi/Services/TeamRecommendation/ExternalSignalProviders.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/modules/gameTracker.js
- userscript/tests/battleRecommendationOverlay.test.js
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt
- api/Services/TeamRecommendation/TeamRecommendationModeNormalization.cs

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-31T16:44:32.507Z

---

## Session
- Date: 2026-05-31
- Session Number: 23
- Scope: continuation wave - shared mode normalizer extraction, confidence overwrite guard, and commit-ready stabilization

## Summary
- Extracted duplicated Team Recommendation mode/objective alias logic into a shared API utility and rewired orchestration/scoring/profile/external-signal modules to consume the same canonical contract.
- Hardened overlay context commits with confidence downgrade protection and confidence-bucket query invalidation so weaker metadata cannot easily clobber stronger active context.
- Expanded regression coverage and reran full API/userscript sweeps to keep dirty branch state commit-safe.

## High-Risk Slices Completed (6)
1. Added shared `TeamRecommendationModeNormalization` utility and centralized canonical alias/objective handling.
2. Rewired orchestration normalization paths to shared utility to remove duplicate alias maps.
3. Rewired scoring normalization paths to shared utility to remove duplicate alias maps.
4. Rewired profile-catalog mode normalization to shared utility to prevent metadata/profile drift.
5. Rewired external-signal mode normalization and weight resolution to shared utility to prevent weighting drift.
6. Added same-mode confidence downgrade guard in overlay context commit path to block lower-confidence overwrites unless materially fresher.

## Medium-Risk Slices Completed (12)
1. Added shared objective normalization helper in `TeamRecommendationModeNormalization`.
2. Added orchestration wrapper methods to delegate `NormalizeMode`/`NormalizeObjective` to shared utility.
3. Added scoring wrapper methods to delegate mode/objective normalization to shared utility.
4. Removed duplicate local mode-normalization implementation from profile catalog.
5. Removed duplicate local mode-normalization implementation from external signal provider.
6. Added confidence bucket to overlay query key to force refresh when trust level materially changes.
7. Added context commit freshness override threshold for confidence guard (`CONTEXT_FRESHNESS_OVERRIDE_MS`).
8. Added context confidence guard delta threshold (`CONTEXT_CONFIDENCE_GUARD_DELTA`).
9. Added overlay regression test: ignore low-confidence same-mode overwrite when not significantly fresher.
10. Added overlay regression test: confidence bucket change triggers re-fetch with unchanged identity.
11. Added API regression test for shared normalizer parity in `TeamRecommendationMathTests`.
12. Executed full API and full userscript regression sweeps after refactor and confidence guard changes.

## Files Modified
- api/Services/TeamRecommendation/TeamRecommendationModeNormalization.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/TeamRecommendation/TeamRecommendationScoringMath.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/ExternalSignalProviders.cs
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/tests/battleRecommendationOverlay.test.js
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- userscript/package.json
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- yarn test -- battleRecommendationOverlay.test.js (pass, 29/29)
- SyncController + TeamRecommendationMath focused API tests (pass, 42/42)
- dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj (pass, 95/95)
- yarn test (pass, 37/37 suites, 843/843 tests)
- yarn build (pass)

---

## Session
- Date: 2026-05-31
- Session Number: 24
- Scope: continuation wave - separator-insensitive alias hardening and objective normalization parity

## Summary
- Hardened shared Team Recommendation normalization to collapse separator-heavy input (spaces, underscores, hyphens, slashes) before alias resolution, reducing noisy-query drift.
- Added broader objective alias support and rewired profile and external-signal layers to consume shared objective normalization for parity across scoring, metadata, and signal weighting.
- Expanded unit and integration regressions for spaced/slashed mode aliases and objective aliases, then reran focused and full API sweeps.

## High-Risk Slices Completed (6)
1. Added compact-token normalization pipeline in shared mode/objective normalizer to sanitize noisy query input consistently.
2. Extended canonical mode alias coverage to include additional live-query patterns (`ranked`, spaced mode names, slash-separated dungeon aliases).
3. Extended canonical objective alias coverage to include offensive/defensive/sustain/speed intent variants.
4. Switched Team Recommendation profile scoring resolution to shared objective normalization to prevent objective weighting drift.
5. Switched external signal objective-bias logic to shared objective normalization to prevent confidence adjustment drift.
6. Added integration-level alias regressions validating normalized response payload mode/objective values through the public HTTP endpoint.

## Medium-Risk Slices Completed (12)
1. Added mode token collapse helper that strips non-alphanumeric separators.
2. Added objective token collapse helper reuse for consistent alias matching behavior.
3. Added strict `IsKnownMode` helper with explicit alias-token catalog.
4. Added strict `IsKnownObjective` helper with explicit alias-token catalog.
5. Added mode unit test coverage for uppercase alias normalization (`PVP`).
6. Added mode unit test coverage for spaced alias normalization (`Grand Arena`, `Guild War`).
7. Added mode unit test coverage for slash alias normalization (`titan/dungeon`).
8. Added mode unit test coverage for spaced ToE alias normalization (`power tournament`).
9. Added objective unit test coverage for alias mapping (`atk`, `defensive`, `tempo`, `survival`, `healing`).
10. Added known-token helper assertions for positive and negative mode/objective cases.
11. Added team recommendation integration assertions for spaced and slash mode aliases.
12. Added team recommendation integration assertions for objective aliases (`attack`, `defensive`, `healing`).

## Files Modified
- api/Services/TeamRecommendation/TeamRecommendationModeNormalization.cs
- api/Services/TeamRecommendation/TeamRecommendationProfiles.cs
- api/Services/TeamRecommendation/ExternalSignalProviders.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj (pass, 96/96)
- runTests focused files (pass, 43/43)

---

## Session
- Date: 2026-05-31
- Session Number: 25
- Scope: continuation wave - calibration/objective-trend edge-case hardening and canonical preference hygiene

## Summary
- Hardened calibration/trend logic to resolve mode preferences through canonical mode normalization, including legacy alias-key fallback and safe supported-window fallback behavior.
- Hardened orchestration calibration updates so persisted mode keys and objective strings are normalized before state writes, preventing alias/objective drift in calibration metadata.
- Added unit/integration regressions for alias-keyed trend preference handling, canonical preference persistence, and objective alias normalization through backtest/calibration endpoints.

## High-Risk Slices Completed (6)
1. Added alias-aware trend preference resolution path so calibration lookup no longer depends on exact legacy mode key matches.
2. Added canonical preference save path with alias-duplicate cleanup to prevent multi-key drift (`titan-arena` + `arena`) in persisted preference state.
3. Normalized mode/objective values at orchestration calibration update boundary before persisting calibration state.
4. Normalized calibration `LastObjective` and observation `Objective` payload fields during persistence to prevent alias/objective drift in calibration telemetry.
5. Added integration regression validating alias-mode preference writes (`titan-arena`) are reflected under canonical `arena` mode in preferences/profile metadata.
6. Added integration regression validating objective alias backtest inputs (`attack`) are normalized and persisted consistently into calibration metadata (`LastObjective=offense`).

## Medium-Risk Slices Completed (12)
1. Added `TryGetPreferredWindowFromPreferences` helper with canonical mode fallback over legacy alias keys.
2. Added `ResolveDefaultSupportedTrendWindowDays` helper to avoid unsupported default-window returns when supported list changes.
3. Added `HasModeTrendPreference` helper so profile metadata user-preference flags recognize alias-keyed persisted preferences.
4. Added `SetModeTrendPreference` helper for canonical writes + legacy alias duplicate key removal.
5. Updated `ResolvePreferredCalibrationTrendWindowDays` to use alias-aware preference lookup.
6. Updated `ResolveModePreferredTrendWindowDays` to use alias-aware preference lookup.
7. Updated `ApplyBacktestObservation` to normalize mode/objective inputs and persist normalized objective in both summary + observations.
8. Updated profile metadata generation to use `HasModeTrendPreference` instead of exact dictionary key checks.
9. Updated trend preference save path in `SyncService` to use canonical setter helper and centralized validation.
10. Added unit test validating calibration update normalizes alias mode key (`ta` -> `arena`).
11. Added unit test validating calibration update normalizes persisted objective and consumes alias-keyed trend preferences.
12. Stabilized profile metadata integration assertions to avoid false failures from persisted trend preference state.

## Files Modified
- api/Services/TeamRecommendation/TeamRecommendationCalibrationStateMath.cs
- api/Services/TeamRecommendation/TeamRecommendationOrchestrationMath.cs
- api/Services/SyncService.cs
- tests/OrganizedJihad.Api.Tests/TeamRecommendationMathTests.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- ~docs/copilot-chats/2026-05-31-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration umbrella used by current branch workflow: #334
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj (pass, 99/99)
