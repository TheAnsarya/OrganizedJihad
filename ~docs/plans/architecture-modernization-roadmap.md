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

## Validation Strategy
- API changes: run `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj` and `dotnet test OrganizedJihad.sln`.
- Userscript changes: run `yarn test --runInBand` and `yarn build`.
- No contract regressions on existing endpoints/UI behavior.

## Notes
- Parallel issue creation caused issue-number drift; canonical mapping is documented in epic #206 comments.
- Completed slices so far: #205, #208, #204, #207, #210, #211, #212, #213, #214, #215, #216, #217, #218, #219, and #220 (API seams + controller split + userscript renderer/binder extraction).
- Existing unrelated dirty files remain intentionally untouched:
  - `userscript/package.json`
  - `~docs/oj-manual-prompts-log.txt`
