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
- Status: Planned/In Progress on `feature/204-architecture-modernization`.
- Outcome target: extract high-risk userscript handler-registration clusters (battle/guild/chat/mail/chest/quest) into modular registry boundaries.

93. #298 Batch modernization: gameTracker registration phase decomposition (12 medium-risk slices)
- Status: Planned/In Progress on `feature/204-architecture-modernization`.
- Outcome target: decompose monolithic userscript registration surface into phase-oriented modular functions.

94. #299 Batch refactor: Team Recommendation orchestration decomposition in SyncService (6 high + 12 medium slices)
- Status: Completed on `feature/204-architecture-modernization`.
- Outcome target: extract battle recommendation pipeline + Team Recommendation normalization/external-signal/calibration orchestration helpers from `SyncService` into dedicated Team Recommendation modules.

## Validation Strategy
- API changes: run `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj` and `dotnet test OrganizedJihad.sln`.
- Userscript changes: run `yarn test --runInBand` and `yarn build`.
- No contract regressions on existing endpoints/UI behavior.

## Notes
- Parallel issue creation caused issue-number drift; canonical mapping is documented in epic #206 comments.
- Completed slices so far: #205, #208, #204, #207, #210, #211, #212, #213, #214, #215, #216, #217, #218, #219, #220, #221, #222, #223, #224, #225, #226, #227, #228, #229, #230, #231, #232, #233, #234, #235, #236, #237, #238, #239, #240, #241, #242, #243, #244, #245, #246, #247, #248, #249, #250, #251, #252, #253, #254, #255, #256, #257, #258, #259, #260, #261, #262, #263, #264, #265, #266, #267, #268, #269, #270, #271, #272, #273, #274, #275, #276, #277, #278, #279, #280, #281, #282, #283, #284, #285, #286, #287, #288, #289, #290, #291, #292, #293, #294, #295, #296, and #299 (API seams + controller split + userscript renderer/binder/helper extraction + Team Recommendation boundary extraction + desktop typed client parity + userscript build log automation + recommendation orchestration decomposition).
- Existing unrelated dirty files remain intentionally untouched:
  - `~docs/oj-manual-prompts-log.txt`
