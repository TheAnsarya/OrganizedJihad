# 2026-05-26 Architecture Modernization Epic Plan

## Linked Issues

- Epic: #174
- API boundaries: #175
- Userscript modularization: #176
- Desktop contract parity: #177
- Test/benchmark uplift: #178

## Why Now

The current implementation has successfully expanded capability (sync coverage, recommendation engine, installer automation), but core services and UI layers are accumulating coupling that will slow future delivery and increase regression risk.

## Modernization Goals

1. Reduce cross-layer coupling and implicit dependencies.
2. Clarify service/module boundaries so changes are local and testable.
3. Normalize API contracts across backend, userscript, and desktop surfaces.
4. Improve CI confidence and feedback speed with stronger test/benchmark architecture.

## Target Architecture Direction

### API Layer

- Split `SyncService` into focused domain services:
	- Import orchestration service
	- Recommendation service
	- Calibration service
	- Tool catalog service
- Keep controllers thin and endpoint-compatible while extracting behavior.
- Move shared recommendation constants/configuration to dedicated providers.

### Userscript Layer

- Separate pipeline stages:
	- Capture/intercept
	- Call normalization
	- Persistence routing
	- UI projection
- Standardize handler contracts for call processors (name, category, expected payload shape, side effects).
- Reduce direct UI dependencies from tracking modules.

### Desktop Layer

- Introduce typed API client for recommendation endpoints.
- Consolidate duplicated inline DTOs in Razor pages.
- Centralize settings + recommendation state management.

### Quality Layer

- Reorganize tests by behavioral boundaries rather than large service class scope.
- Add benchmark baselines for recommendation scoring and sync ingestion hot paths.
- Partition CI checks for fast lint/build/test cycles with targeted suites.

## Phased Execution

### Phase 1: Contract and Boundary Mapping

- Inventory current dependencies and call graphs.
- Produce architecture map (current -> target).
- Freeze external endpoint contracts for compatibility.

### Phase 2: API Boundary Refactor

- Extract recommendation/calibration flows from `SyncService` first.
- Add focused tests around extracted services.
- Keep endpoint behavior unchanged.

### Phase 3: Userscript Pipeline Modularization

- Introduce explicit pipeline interfaces.
- Migrate handlers incrementally with test parity checks.
- Preserve runtime behavior and API payloads.

### Phase 4: Desktop Contract Parity

- Add typed recommendation client and state helpers.
- Replace local ad-hoc response model duplication.
- Validate parity with userscript-visible recommendation controls.

### Phase 5: Test/Benchmark Uplift

- Expand and restructure integration test fixtures.
- Add/refresh benchmark baselines.
- Tune CI partitioning and enforce thresholds where practical.

## Compatibility Rules

- No breaking API route or payload changes without explicit versioning.
- Preserve userscript runtime behavior and existing settings migration.
- Keep desktop pages functional during refactor (feature flags if needed).

## Risks and Mitigations

- Risk: Regression in sync/recommendation behavior during extraction.
	- Mitigation: Golden path integration tests before/after each extraction step.
- Risk: Over-refactor stalls feature work.
	- Mitigation: Incremental slices tied to issues #175-#178 with small PRs.
- Risk: Contract drift across surfaces.
	- Mitigation: Shared typed clients/models where possible and contract tests.

## Exit Criteria

- All child issues (#175-#178) completed.
- Endpoint behavior stable with passing test suites.
- Benchmark baseline snapshots captured for key paths.
- Architecture docs updated to reflect new structure.
