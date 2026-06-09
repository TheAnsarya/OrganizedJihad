## Summary
Expand battle recommendation test/benchmark coverage and add architecture guide clarifying server ownership.

## Scope
- Add Team Recommendation benchmark suite (math/candidate-building hot paths).
- Add API tests where missing for report endpoints and recommendation contracts.
- Add architecture guide documenting recommendation execution boundary (API server owns logic; userscript consumes API output).
- Update copilot instructions to enforce branch-only workflow (no general work on main).

## Acceptance Criteria
- Benchmarks runnable via BenchmarkDotNet project.
- New/updated tests pass.
- Guide published under ~docs and linked from session notes.
- Copilot instructions explicitly require sub-branch workflow.
