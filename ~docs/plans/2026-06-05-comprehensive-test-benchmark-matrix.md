# Comprehensive Test + Benchmark Matrix (2026-06-05)

## Objective

Drive toward broad automated coverage across API, userscript, data layer, installer/runtime host, and recommendation/simulation surfaces.

## API Coverage

- [x] Core sync endpoints smoke/integration tests
- [x] API UI safety tests
- [x] Daily report endpoint/page tests
- [x] Reporting overview endpoint/page tests
- [ ] Expanded recommendation endpoint calibration/regression matrix
- [ ] Negative-path coverage for report endpoint local-only access enforcement

## Team Recommendation Coverage

- [x] Recommendation math unit tests
- [x] Calibration tests against historical outcomes
- [x] State-store persistence tests
- [x] New benchmark suite for candidate build/filter hot paths
- [ ] External signal provider matrix/per-source weighting tests
- [ ] Long-running benchmark profile with larger sample sets and trend baselines

## Data Layer Coverage

- [x] Data-layer benchmark suite baseline
- [ ] Query-shape benchmark expansion for reporting aggregations
- [ ] Migration/compatibility performance trend checks

## Userscript Coverage

- [x] Recommendation rendering/operations summary tests
- [x] API monitor + sync client tests
- [ ] Expanded dashboard visualization parity tests for new reporting pages

## Installer/Runtime Host Coverage

- [x] Tray menu link tests
- [ ] Linux/macOS tray runtime interaction tests (where practical in CI)
- [ ] Runtime host startup fallback behavior stress tests

## Next Actionable Slice

1. Add recommendation endpoint contract/regression integration matrix tests.
2. Add reporting aggregation benchmark scenario over seeded in-memory datasets.
3. Add CI-friendly benchmark result capture + threshold checks for top hot paths.
