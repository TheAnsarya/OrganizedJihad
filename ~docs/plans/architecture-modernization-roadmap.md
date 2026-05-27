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
- Status: Planned.
- Outcome target: extract projection/diagnostics render seams to improve maintainability and test focus.

## Validation Strategy
- API changes: run `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj` and `dotnet test OrganizedJihad.sln`.
- Userscript changes: run `yarn test --runInBand` and `yarn build`.
- No contract regressions on existing endpoints/UI behavior.

## Notes
- Parallel issue creation caused issue-number drift; canonical mapping is documented in epic #206 comments.
- Completed slices so far: #205, #208, and #204 (API metadata seams + controller responsibility split).
- Existing unrelated dirty files remain intentionally untouched:
  - `userscript/package.json`
  - `~docs/oj-manual-prompts-log.txt`
