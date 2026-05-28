# Architecture Modernization Roadmap

## Epic
- #206 Epic: Architecture modernization and module deepening across API/userscript

## Current Branch
- feature/204-architecture-modernization

## Intent
- Deepen high-leverage modules by separating orchestration from catalog/query concerns.
- Reduce risk in broad modules (`SyncService`, `SyncController`, `uiManager`) through explicit seams.
- Preserve endpoint/UI behavior while improving locality and testability.

## Workstream Backlog
1. #205 Extract projected item catalog module from SyncService
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: `SyncService` delegates projected catalog payload construction to dedicated provider interface.

2. #208 Extract external tool catalog module and filter metadata provider
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: move tool catalog/filter metadata logic into dedicated adapter module and delegate from sync orchestration.

3. #204 Split SyncController read/query endpoints from import orchestration surface
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: separate read-focused controller/module while preserving route compatibility.

4. #207 Decompose userscript uiManager projection and diagnostics rendering modules
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract projection/diagnostics render seams to improve maintainability and test focus.

5. #210 Decompose userscript uiManager projection interaction wiring into dedicated binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate projection interaction event wiring (section persistence, global controls, top-item paging) from `uiManager`.

6. #211 Extract uiManager data-row expand/collapse interaction wiring into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate data-row and payload toggle interaction wiring (hero/titan/pet/battle/api log) from `uiManager`.

7. #212 Extract uiManager data-browser table controls into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate sort/search/pagination/sub-tab listener wiring from `uiManager`.

8. #213 Extract uiManager misc data-browser interactions into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate resource shortcut and inventory group-toggle listener wiring from `uiManager`.

9. #214 Extract settings health-action listeners from uiManager into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate settings first-run health action listeners from `uiManager`.

10. #215 Extract settings data action listeners from uiManager into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate settings export/import/clear listener wiring from `uiManager`.

11. #216 Extract settings display and tracking toggle listeners from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate settings display preference and tracking category listener wiring from `uiManager`.

12. #217 Extract notification settings listeners from uiManager into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate notification settings listener wiring (master/type/permission/quiet hours) from `uiManager`.

13. #218 Extract dashboard filter listeners from uiManager into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate dashboard filter listener wiring (tools/team mode/objective/trend-window) from `uiManager`.

14. #219 Extract overlay chrome control listeners from uiManager into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate top-level overlay chrome controls (nav/close/minimize/reset) from `uiManager`.

15. #220 Extract shared data-browser search/pagination render helpers from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate shared data-browser render helper markup from `uiManager`.

16. #221 Extract overlay escape-key listener from uiManager into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate Escape-key document-listener wiring from `uiManager`.

17. #222 Extract overlay drag/resize pointer interactions from uiManager into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate drag/resize pointer-listener orchestration from `uiManager`.

18. #223 Extract shared data-browser sort helpers from uiManager into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate shared data-browser sort helper logic from `uiManager`.

19. #224 Extract data-browser listener orchestration from uiManager into binder module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate data-browser binder composition orchestration from `uiManager`.

20. #225 Extract staleness/time formatting helpers from uiManager into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate relative-time/staleness formatting helpers from `uiManager`.

21. #226 Extract battle presentation helpers from uiManager into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate compact-number and color-rank presentation helpers from `uiManager`.

22. #227 Extract activity presentation helpers from uiManager into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate activity event icon/color helper mappings from `uiManager`.

23. #228 Extract battle-team rendering from uiManager into renderer module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate compressed battle-team rendering from `uiManager`.

24. #229 Extract adventure-guide rendering from uiManager into renderer module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate adventure-guide panel rendering and grouping logic from `uiManager`.

25. #230 Extract activity event feed rendering from uiManager into renderer module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate live activity event row/list rendering from `uiManager`.

26. #231 Extract dashboard lower subsection rendering from uiManager into renderer module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate dashboard Tracked Data, Status, and Quick Tips section rendering from `uiManager`.

27. #232 Extract activity fallback API-log rendering from uiManager into renderer module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate activity empty-state and API-log fallback table rendering from `uiManager`.

28. #233 Extract daily-summary dashboard section renderer from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate daily summary section markup from `uiManager`.

29. #234 Extract battle recommendation cards renderer from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate dashboard battle recommendation card markup from `uiManager`.

30. #235 Extract dashboard suggestions renderer from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate suggestions section markup from `uiManager`.

31. #236 Extract win-rate dashboard section renderer from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate win-rate section markup from `uiManager`.

32. #237 Extract team recommendation engine section renderer from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate Team Recommendation Engine section shell/controls markup from `uiManager`.

33. #238 Introduce shared cached API metadata fetch helper in uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: centralize repeated cache/network/fallback fetch semantics across dashboard recommendation/tool payload paths.

34. #239 Extract dashboard player header renderer from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate large dashboard player-header markup block from `uiManager`.

35. #240 Extract external tools dashboard section renderer from uiManager
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate external tools section card/filter markup from `uiManager`.

36. #241 Extract dashboard win-rate card model builder into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate win-rate model calculation from `uiManager` rendering method.

37. #242 Extract dashboard metadata loading from renderDashboard into dedicated helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate dashboard metadata bundle loading from `renderDashboard` body.

38. #243 Extract heroes roster loading and dedupe logic from renderHeroes into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate metadata/IDB roster-loading and dedupe logic from `renderHeroes`.

39. #244 Extract team recommendation row rendering into dedicated renderer module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate Team Recommendation Engine recommendation/provenance card-row markup from `uiManager`.

40. #245 Extract dashboard daily-activity aggregation into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate today-only activity aggregation queries/counters from `_renderDailySummary`.

41. #246 Extract suggestions row-model builder from uiManager into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate suggestion sorting/mapping model preparation from `_renderSuggestionsSection`.

42. #247 Extract battle recommendation row-model builder from uiManager into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate recommendation row-model preparation from `_renderBattleRecommendationsSection`.

43. #248 Extract external tools section model builder from uiManager into helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate external tools section model shaping from `_renderExternalToolsSection`.

44. #249 Extract hero requirements projection data loading from renderHeroes into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate hero projection dataset loading from `renderHeroes`.

45. #250 Extract cached API payload helper from uiManager into shared helper module
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: move cache-backed API payload resolver into shared helper module and delegate all dashboard call sites.

46. #251 Extract dashboard battle dataset loader from renderDashboard into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate `allBattles` + today-only battle dataset loading from `renderDashboard` body.

47. #252 Extract battles dataset loader from renderBattles into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate battles store load/sort from `renderBattles`.

48. #253 Extract battles type metadata map from renderBattles into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate battle type labels/icons/default type list from `renderBattles`.

49. #254 Extract battles sub-tab pills model builder from renderBattles
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate sub-tab pill model/render composition from `renderBattles`.

50. #255 Extract battles filter and summary stats computation from renderBattles
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate filtered dataset and filtered stats computation from `renderBattles`.

51. #256 Extract battle row rendering from renderBattles into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate battle row/detail-row markup loop from `renderBattles`.

52. #257 Extract titans roster loading and dedupe from renderTitans into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate titans metadata/IDB roster loader and dedupe from `renderTitans`.

53. #258 Extract titan table row rendering from renderTitans into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate titan row/detail-row markup loop from `renderTitans`.

54. #259 Extract titans completion map computation from renderTitans into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate titan completion-map precomputation from `renderTitans`.

55. #260 Extract pets completion map computation from renderPets into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate pet completion-map precomputation from `renderPets`.

56. #261 Extract pets roster loading and dedupe from renderPets into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate pets metadata/IDB roster loader and dedupe from `renderPets`.

57. #262 Extract pet table row rendering from renderPets into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate pet row/detail-row markup loop from `renderPets`.

58. #263 Extract pet soul-stone section rendering from renderPets into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate pet soul-stone summary/progress/details rendering from `renderPets`.

59. #264 Extract battle detail fragment builder from renderBattles into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate battle detail fragment assembly (power/round/team) from row loop.

60. #265 Extract inventory grouping and group section rendering from renderInventory into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate inventory category grouping and grouped-section markup generation.

61. #266 Extract inventory usage history section rendering from renderInventory into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate recent inventory usage query/sort/markup section from `renderInventory`.

62. #267 Extract inventory dataset loading from renderInventory into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate inventory metadata/snapshot loading pipeline from `renderInventory`.

63. #268 Extract battles damage-healing computation from renderBattles into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate compressed-team damage/healing aggregation logic from battle row loop.

64. #269 Extract battle detail id generation from renderBattles into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate deterministic battle-detail row-id generation from row loop.

65. #270 Extract upgrades sub-tab filtering and category count model from renderUpgrades
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate upgrades category counts and filtered/sorted view-model prep from `renderUpgrades`.

66. #271 Extract upgrades sub-tab pill rendering from renderUpgrades into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate upgrades sub-tab pill markup generation from `renderUpgrades`.

67. #272 Extract upgrades row rendering from renderUpgrades into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate upgrades row markup/details composition from `renderUpgrades`.

68. #273 Extract upgrades dataset loader from renderUpgrades into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate upgrades multi-store loading and category tagging from `renderUpgrades`.

69. #274 Extract chest dataset and metadata loading from renderChests into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate chests/opening-history/drop-rate dataset loading and sorting from `renderChests`.

70. #275 Extract chest drop-rate analysis from metadata into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate metadata-driven drop-rate analytics section rendering from `renderChests`.

71. #276 Extract chest type pills renderer from renderChests into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate chest type pill summary rendering from `renderChests`.

72. #277 Extract chest drop-rate analysis fallback from raw consumable rewards into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate raw-drops fallback analytics model/render from `renderChests`.

73. #278 Extract chest history filtering and pagination model from renderChests
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate chest history filter/pagination view-model prep from `renderChests`.

74. #279 Extract chest opening row rendering from renderChests into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate chest opening row/reward-detail markup loop from `renderChests`.

75. #280 Extract resources dataset loading from renderResources into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate player snapshot fallback and transaction loading/sorting from `renderResources`.

76. #281 Extract resources card section renderer from renderResources into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate current resources cards section model/render from `renderResources`.

77. #282 Extract resource transaction table renderer from renderResources into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate recent transactions table rendering from `renderResources`.

78. #283 Extract mail dataset loading from renderMail into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate mail metadata/reward loading from `renderMail`.

79. #284 Extract mail reward summary text builder from renderMail into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate per-mail reward-summary string composition from `renderMail`.

80. #285 Extract mail list filter/sort/pagination model from renderMail
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate mail list view-model prep from `renderMail`.

81. #286 Extract mail inbox row rendering from renderMail into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate mail inbox row markup generation from `renderMail`.

82. #287 Extract collected mail rewards summary renderer from renderMail into helper method
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: isolate collected rewards aggregate/summary section rendering from `renderMail`.

83. #288 Extract Team Recommendation calibration-state metadata load/save into dedicated state store service
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: move calibration SyncMetadata persistence behind dedicated Team Recommendation state-store seam.

84. #289 Add Team Recommendation state-store interface seam for SyncService injection
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce `SyncService` coupling by injecting an explicit Team Recommendation state persistence seam.

85. #290 Extract Team Recommendation trend-preference metadata load/save into dedicated state store service
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: move trend preference SyncMetadata persistence behind dedicated Team Recommendation state-store seam.

86. #291 Route SyncService calibration/trend orchestration through injected state-store seam
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: route calibration/trend preference flows through the injected Team Recommendation persistence seam.

87. #292 Add API tests covering Team Recommendation state-store persistence and malformed metadata fallback
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: verify state round-trip persistence and malformed metadata fallback behavior for trend/calibration state.

88. #293 Document Team Recommendation state persistence boundary in architecture modernization roadmap
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: keep modernization roadmap/session logs synchronized with the new Team Recommendation state-store boundary.

89. #294 Batch modernization: Team Recommendation scoring pipeline extraction from SyncService
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract recommendation scoring/synthetic/provenance/signature helpers from `SyncService` into dedicated Team Recommendation scoring module and preserve API behavior.

90. #295 Batch parity refactor: Desktop Team Recommendation typed client layer and model consolidation
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: centralize Team Recommendation desktop endpoint calls/models in a shared service and remove page-local DTO duplication.

91. #296 Batch userscript build automation: Session log auto-generation and safeguards
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: auto-append daily userscript build session logs in `~docs/copilot-chats/` from the userscript build pipeline.

92. #297 Batch refactor: gameTracker handler registry extraction wave (6 high-risk slices)
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract high-risk userscript handler-registration clusters (battle/guild/chat/mail/chest/quest) into modular registry boundaries.
- Progress update: extracted chat/mail/core clusters into `userscript/src/modules/trackers/GameTrackerCoreRegistry.js` and battle/guild/chest/quest gameplay clusters into `userscript/src/modules/trackers/GameTrackerGameplayRegistry.js`, with `_buildHandlerRegistry` now delegating to registry modules.

93. #298 Batch modernization: gameTracker registration phase decomposition (12 medium-risk slices)
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: decompose monolithic userscript registration surface into phase-oriented modular functions.
- Progress update: completed decomposition of the pre-Phase-11 registration surface into modular phase functions (`registerBattleHandlers`, `registerQuestRewardHandlers`, `registerGuildAndSocialHandlers`, `registerUpgradeHandlers`) plus prior core/chat/mail extraction.

94. #299 Batch refactor: Team Recommendation orchestration decomposition in SyncService (6 high + 12 medium slices)
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract battle recommendation pipeline + Team Recommendation normalization/external-signal/calibration orchestration helpers from `SyncService` into dedicated Team Recommendation modules.

95. #300 Batch quality uplift: Team Recommendation math/orchestration test expansion (6 high + 12 medium slices)
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: add focused regression coverage for extracted Team Recommendation helper modules and sustain green solution tests.

96. #301 Batch userscript modernization: Phase 11 metadata/roster registry decomposition wave
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract Phase 11 metadata/roster registration handlers from `gameTracker._buildHandlerRegistry` into dedicated tracker module seams while preserving behavior.
- Progress update: added `userscript/src/modules/trackers/GameTrackerPhase11Registry.js` and delegated Phase 11 registrations from `gameTracker` via `registerPhase11MetadataHandlers`.

97. #302 Batch userscript modernization: Phase 12/13 extended registry decomposition wave
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract the remaining Phase 12 and Phase 13 long-tail registration blocks from `gameTracker._buildHandlerRegistry` into dedicated registry modules while preserving behavior.
- Progress update: added `userscript/src/modules/trackers/GameTrackerExtendedRegistry.js` and delegated via `registerPhase12Handlers` + `registerPhase13Handlers`.

98. #303 Batch userscript quality wave: registry parity tests and generic helper seam extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: increase regression confidence for extracted registry modules and extract remaining generic tracking helper seam from `gameTracker`.
- Progress update: added `userscript/tests/trackerRegistryModules.test.js`, introduced `userscript/src/modules/trackers/GameTrackerGenericTrackingHelpers.js`, and delegated `_trackGenericUpgrade`/`_trackGenericEvent` through helper module functions.

99. #304 Batch userscript hardening: table-driven system no-op registration and drift guards
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce long-tail no-op handler drift risk by centralizing Phase 13 system suppression registrations and locking behavior with targeted tests.
- Progress update: added `SYSTEM_NOOP_REGISTRATIONS` table in `userscript/src/modules/trackers/GameTrackerExtendedRegistry.js`, delegated no-op registration through helper, and expanded `userscript/tests/trackerRegistryModules.test.js` with no-op method/label/category drift guards.

100. #305 Batch userscript quality hardening: registry contracts, overlap policy, and metadata integrity guards
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: centralize registry contract assertions and enforce stricter overlap/metadata/duplicate-method integrity checks for extracted tracker registries.
- Progress update: added shared test contracts/harness modules (`userscript/tests/support/registryContracts.js`, `userscript/tests/support/trackerRegistryTestHarness.js`) and refactored `userscript/tests/trackerRegistryModules.test.js` to enforce category/label integrity, duplicate-method guards, and intentional-overlap policy via centralized constants.

101. #306 Batch userscript modernization: registry orchestration engine extraction and dispatch simplification
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract remaining registry orchestration mechanics from `gameTracker` into dedicated engine/bootstrap modules while preserving dispatch behavior.
- Progress update: added `userscript/src/modules/trackers/GameTrackerRegistryEngine.js` and `userscript/src/modules/trackers/GameTrackerRegistryBootstrap.js`, delegated `registerHandler`/`_topologicalSortMethods`/`_buildHandlerRegistry` in `userscript/src/modules/gameTracker.js`, and added focused module tests in `userscript/tests/gameTrackerRegistryEngine.test.js` and `userscript/tests/gameTrackerRegistryBootstrap.test.js`.

102. #307 Batch userscript modernization: processAPIResponse dispatch pipeline extraction and helper modularization
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: simplify `gameTracker.processAPIResponse` by extracting ordering/dispatch/payload/status orchestration into focused helpers while preserving behavior.
- Progress update: added `userscript/src/modules/trackers/GameTrackerResponseDispatchHelpers.js`, delegated ordering/dispatch/payload/status in `userscript/src/modules/gameTracker.js`, and added focused module tests in `userscript/tests/gameTrackerResponseDispatchHelpers.test.js`.

103. #309 Batch userscript modernization: processAPIResponse diagnostics and log-message synthesis extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract malformed-response diagnostics and dispatch console-message synthesis from `processAPIResponse` into dedicated helpers while preserving warning/log semantics.
- Progress update: added `userscript/src/modules/trackers/GameTrackerResponseDiagnosticsHelpers.js`, delegated malformed diagnostics + console summary composition in `userscript/src/modules/gameTracker.js`, and added focused tests in `userscript/tests/gameTrackerResponseDiagnosticsHelpers.test.js`.

104. #308 Batch userscript modernization: activity and economy tracking helper seam extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract high-churn activity/economy tracking methods from `gameTracker` into helper seams while preserving storage and log semantics.
- Progress update: added `userscript/src/modules/trackers/GameTrackerActivityEconomyHelpers.js`, delegated selected wrappers in `userscript/src/modules/gameTracker.js` (`trackResourceTransaction`, `trackGuildActivity`, `trackQuestsData`, `trackDailyQuestFarm`, `trackBatchQuestFarm`, `trackLoginReward`, `trackDailyBonusInfo`, `trackInventoryItemUsage`), and added focused tests in `userscript/tests/gameTrackerActivityEconomyHelpers.test.js`.

105. #310 Batch userscript modernization: response lifecycle finalization extraction and activity helper domain decomposition
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: further shrink `processAPIResponse` by extracting lifecycle finalization responsibilities and decompose activity/economy helper concerns into domain modules.
- Progress update: added `userscript/src/modules/trackers/GameTrackerResponseLifecycleHelpers.js` and delegated processAPIResponse finalization in `userscript/src/modules/gameTracker.js`; added domain helper modules (`GameTrackerEconomyTrackingHelpers.js`, `GameTrackerQuestTrackingHelpers.js`, `GameTrackerInventoryTrackingHelpers.js`), converted `GameTrackerActivityEconomyHelpers.js` to compatibility re-export surface, and added focused tests in `userscript/tests/gameTrackerResponseLifecycleHelpers.test.js` + `userscript/tests/gameTrackerActivityDomainModules.test.js`.

106. #311 Batch userscript modernization: guild tracking seam extraction (membership transitions + roster mapping)
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce high-churn guild tracking logic in `gameTracker` by extracting metadata transition and roster mapping/persistence seams into dedicated helpers.
- Progress update: added `userscript/src/modules/trackers/GameTrackerGuildTrackingHelpers.js`, delegated `trackGuildData` and `trackGuildMembers` orchestration in `userscript/src/modules/gameTracker.js`, and added focused helper tests in `userscript/tests/gameTrackerGuildTrackingHelpers.test.js`.

107. #312 Batch userscript modernization: guild participation normalization extraction (war/raid/dungeon)
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce high-churn participation mapping logic by extracting guild war/raid/dungeon normalization and titanite transaction intent generation into dedicated helper seams.
- Progress update: added `userscript/src/modules/trackers/GameTrackerGuildParticipationHelpers.js`, delegated war/raid/dungeon participation mapping paths in `userscript/src/modules/gameTracker.js`, and added focused helper tests in `userscript/tests/gameTrackerGuildParticipationHelpers.test.js`.

108. #313 Batch userscript modernization: guild participation execution + guild currency seam extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce orchestration/currency churn in `gameTracker` by extracting participation persistence+transaction dispatch execution seams and guild currency helpers.
- Progress update: added `userscript/src/modules/trackers/GameTrackerGuildParticipationExecutionHelpers.js` + `userscript/src/modules/trackers/GameTrackerGuildCurrencyHelpers.js`, delegated war/raid/dungeon execution paths and `trackTitaniteTransaction`/`getStoredGuildId` in `userscript/src/modules/gameTracker.js`, and added focused tests in `userscript/tests/gameTrackerGuildParticipationExecutionHelpers.test.js` + `userscript/tests/gameTrackerGuildCurrencyHelpers.test.js`.

109. #314 Batch userscript modernization: war/raid/cross-server metadata and summary helper extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce war/raid/cross-server churn in `gameTracker` by extracting metadata, record-building, bounded-history, and summary helper seams.
- Progress update: added `userscript/src/modules/trackers/GameTrackerWarRaidHelpers.js`, delegated guild-war info, raid-boss info/attack record building, cross-server metadata+battle mapping, and raid damage summary paths in `userscript/src/modules/gameTracker.js`, and added focused tests in `userscript/tests/gameTrackerWarRaidHelpers.test.js`.

110. #315 Batch userscript modernization: guild-war and raid battle orchestration side-effect seam extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce `gameTracker` battle-method churn by extracting guild-war/raid activity payload and reward intent composition into helper seams while preserving execution order.
- Progress update: expanded `userscript/src/modules/trackers/GameTrackerWarRaidHelpers.js` with guild-war/raid side-effect builders (`buildGuildWarBattleHistoryRecord`, activity payload builders, reward intent builders, intent applier), delegated composition paths in `userscript/src/modules/gameTracker.js` (`trackGuildWarBattle`, `trackRaidBossAttack`), and expanded focused tests in `userscript/tests/gameTrackerWarRaidHelpers.test.js`.

111. #316 Batch userscript modernization: cross-server execution and war-raid getter response seam extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce cross-server execution and getter composition churn by extracting dedupe/persistence loops and response payload builders into dedicated helper seams.
- Progress update: added `userscript/src/modules/trackers/GameTrackerCrossServerExecutionHelpers.js`, expanded `userscript/src/modules/trackers/GameTrackerWarRaidHelpers.js` with getter response builders, delegated `trackCrossServerWarResults`/`getGuildWarData`/`getRaidBossData` in `userscript/src/modules/gameTracker.js`, and added focused tests in `userscript/tests/gameTrackerCrossServerExecutionHelpers.test.js` + expanded `userscript/tests/gameTrackerWarRaidHelpers.test.js`.

112. #317 Batch userscript modernization: guild-war and raid battle execution orchestration extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce guild-war/raid battle wrapper churn by extracting remaining execution orchestration (history, dedupe battle write, activity, and reward side effects) into dedicated execution helpers.
- Progress update: added `userscript/src/modules/trackers/GameTrackerBattleExecutionHelpers.js`, expanded `userscript/src/modules/trackers/GameTrackerWarRaidHelpers.js` with `buildGuildWarBattleStoreRecord`, delegated `trackGuildWarBattle` + `trackRaidBossAttack` in `userscript/src/modules/gameTracker.js`, and added focused tests in `userscript/tests/gameTrackerBattleExecutionHelpers.test.js` plus expanded `userscript/tests/gameTrackerWarRaidHelpers.test.js`.

113. #318 Batch userscript modernization: consumable opening pipeline extraction (record builders + drop-rate updates)
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce consumable/chest opening wrapper churn by extracting opening/drop/history/drop-rate/resource-intent builders into dedicated helper seams while preserving side-effect order.
- Progress update: added `userscript/src/modules/trackers/GameTrackerConsumableOpeningHelpers.js`, delegated `trackConsumableOpening` composition paths plus `_sourceTypeLabel`/`updateChestDropRates` in `userscript/src/modules/gameTracker.js`, and added focused tests in `userscript/tests/gameTrackerConsumableOpeningHelpers.test.js`.

114. #319 Batch userscript modernization: reward normalization + economy/expedition tracking seam extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce reward normalization and economy/pve wrapper churn by extracting normalization walkers, record builders, and resource-intent composition into dedicated helper seams while preserving side-effect order.
- Progress update: added `userscript/src/modules/trackers/GameTrackerRewardEconomyHelpers.js`, delegated `_normalizeRewards`/`_extractDrops` plus `trackShopPurchase`/`trackQuestComplete`/`trackExpeditionState`/`trackExpeditionBattle` and mission+tower reward-intent mapping in `userscript/src/modules/gameTracker.js`, and added focused tests in `userscript/tests/gameTrackerRewardEconomyHelpers.test.js`.

115. #320 Batch userscript modernization: mission/tower progression orchestration seam extraction
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: reduce mission/tower progression wrapper churn by extracting key derivation, existing-row load semantics, row builders, log-message composition, and reward intent execution seams.
- Progress update: added `userscript/src/modules/trackers/GameTrackerProgressionTrackingHelpers.js`, delegated mission/tower progression orchestration in `userscript/src/modules/gameTracker.js` (`trackMissionProgress`, `trackTowerProgress`) and added focused tests in `userscript/tests/gameTrackerProgressionTrackingHelpers.test.js`.

116. #321 Batch release hardening: single-run installer ecosystem bootstrap
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: make release install a single-run ecosystem bootstrap for API + desktop + userscript with Opera GX Tampermonkey support and robust non-admin/repeat-run behavior.
- Progress update: expanded `Install-OrganizedJihad.ps1` with desktop publish/install flow, browser-targeted Tampermonkey bootstrap (`-TampermonkeyBrowsers` with `operaGX`), non-admin startup fallback, API process lock handling for repeat installs, and API readiness wait before health check; updated install docs in `README.md` + `userscript/INSTALL.md` + `userscript/README.md`; validated with `dotnet test`, `yarn test --runInBand`, `yarn build`, and repeated installer smoke runs.

117. #322 Batch release UX hardening: one-click Avalonia installer executable
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: provide a double-click installer executable that avoids command-line setup, lets users select a browser target for Tampermonkey bootstrap, and runs the existing install pipeline with minimal/no advanced configuration.
- Progress update: added `installer-ui/` Avalonia project and wired GUI flow to execute `Install-OrganizedJihad.ps1` with browser and diagnostics options, stream logs in-window, and resolve script location for debug/published layouts; added `Publish-InstallerUI.ps1` to emit a single-file self-contained installer executable at `installer-ui/publish/win-x64/OrganizedJihad.Installer.exe`; updated install docs in `README.md`, `userscript/INSTALL.md`, and `userscript/README.md`; validated with `dotnet build installer-ui/OrganizedJihad.Installer.csproj`, `pwsh -ExecutionPolicy Bypass -File .\Publish-InstallerUI.ps1`, and `dotnet build OrganizedJihad.sln`.

118. #323 Batch release UX hardening: installer preflight validation, log persistence, and safer process execution
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: harden one-click installer reliability and supportability by validating inputs up front, improving shell invocation robustness, and making install logs/location actions accessible to end-users.
- Progress update: added installer preflight validation for install root + API URL, switched PowerShell resolution toward fully-qualified PATH entries, persisted per-run logs to `%LOCALAPPDATA%\\OrganizedJihad\\installer-logs`, and added UI quick actions for opening install/log folders; updated install docs and validated with installer project build + publish and solution build.

119. #324 Release prep v0.2.1: admin-elevated installer flow and release notes package
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: enforce admin-elevation-first install behavior for full setup reliability and publish a release-ready v0.2.1 notes package.
- Progress update: added installer script self-elevation flow with explicit user prompt text (`Please give us admin privileges so we can install fully.`), updated cmd launcher to request elevation up front, documented `-AllowNonAdmin` constrained-mode override, and authored detailed release notes at `~docs/releases/v0.2.1-release-notes.md` with release header/summary/tables/checklists.

120. #325 UX hardening: UI-only elevated installer flow + release body finalization for v0.2.1
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: keep one-click EXE installs fully UI-driven while retaining CLI behavior for intentional terminal runs.
- Progress update: moved elevation ownership to installer UI relaunch flow (`runas`) so EXE users remain in GUI context, executes installer script in hidden shell mode from GUI path, documented explicit UI-only/no-terminal expectation in install docs, and added GitHub-release-ready copy body at `~docs/plans/release-v0.2.1-github-body.md`.

121. #326 Stable release cut: v0.2.1 artifacts, docs finalization, and GitHub release publication
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: produce stable installer artifacts, finalize release docs, and publish a live GitHub release for v0.2.1.
- Progress update: added `Publish-ReleaseArtifacts.ps1` for reproducible bundle + checksum generation, produced `OrganizedJihad-v0.2.1-windows-installer.zip` and `SHA256SUMS.txt`, and published release at `https://github.com/TheAnsarya/OrganizedJihad/releases/tag/v0.2.1`; docs updated with release URL/download guidance.

## Validation Strategy
- API changes: run `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj` and `dotnet test OrganizedJihad.sln`.
- Userscript changes: run `yarn test --runInBand` and `yarn build`.
- No contract regressions on existing endpoints/UI behavior.

## Notes
- Parallel issue creation caused issue-number drift; canonical mapping is documented in epic #206 comments.
- Completed slices so far: #205, #208, #204, #207, #210, #211, #212, #213, #214, #215, #216, #217, #218, #219, #220, #221, #222, #223, #224, #225, #226, #227, #228, #229, #230, #231, #232, #233, #234, #235, #236, #237, #238, #239, #240, #241, #242, #243, #244, #245, #246, #247, #248, #249, #250, #251, #252, #253, #254, #255, #256, #257, #258, #259, #260, #261, #262, #263, #264, #265, #266, #267, #268, #269, #270, #271, #272, #273, #274, #275, #276, #277, #278, #279, #280, #281, #282, #283, #284, #285, #286, #287, #288, #289, #290, #291, #292, #293, #294, #295, #296, #299, #300, #301, #302, #303, #304, #305, #306, #307, #308, #309, #310, #311, #312, #313, #314, #315, #316, #317, #318, #319, #320, #321, #322, #323, #324, #325, and #326 (API seams + controller split + userscript renderer/binder/helper extraction + Team Recommendation boundary extraction + desktop typed client parity + userscript build log automation + recommendation orchestration decomposition + Team Recommendation regression test expansion + userscript Phase 11/12/13 registry decomposition + registry parity test expansion + generic helper seam extraction + table-driven no-op hardening + registry contracts/overlap-policy hardening + registry orchestration engine/bootstrap extraction + response-dispatch pipeline helper extraction + diagnostics/message synthesis extraction + activity/economy helper seam extraction + response lifecycle extraction + activity helper domain decomposition + guild tracking seam extraction for transitions/roster mapping + guild participation normalization seam extraction + guild participation execution and guild currency seam extraction + war/raid/cross-server helper extraction + guild-war/raid side-effect orchestration seam extraction + cross-server execution and getter response seam extraction + guild-war/raid execution orchestration extraction + consumable opening pipeline helper extraction + reward normalization and economy/expedition seam extraction + mission/tower progression orchestration seam extraction + release installer ecosystem hardening with Opera GX bootstrap and repeat-run resilience + one-click Avalonia installer executable with browser picker and self-contained publish flow + installer preflight validation/log persistence/quick-action and shell-resolution hardening + admin-elevation-first installer flow and v0.2.1 release-notes packaging + UI-owned elevation relaunch and no-terminal EXE install UX guarantee + stable release cut, artifact publication, and live GitHub release upload).
- Existing unrelated dirty files remain intentionally untouched:
  - `~docs/oj-manual-prompts-log.txt`
