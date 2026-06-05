# Tests/Benchmarks/Guide Slice - Issue #378 (2026-06-05)

## Summary

Expand coverage for battle recommendations and add guidance clarifying architecture ownership boundaries.

## Delivered

- Added `TeamRecommendationBenchmarks` BenchmarkDotNet suite for recommendation math hot paths.
- Added benchmark project reference to API project.
- Added architecture guide clarifying recommendation logic ownership on API server.
- Updated repository copilot instructions with mandatory branch-only policy (no general work on `main`).

## Benchmark coverage

- Candidate build hot path (`BattleRecommendationMath.BuildCandidates`)
- Opponent filter hot path (`BattleRecommendationMath.ApplyOpponentFilters`)

## Validation target

`dotnet run --project benchmarks/OrganizedJihad.Benchmarks -c Release -- --filter *TeamRecommendationBenchmarks*`
