## OrganizedJihad v0.2.4 - Installer UX and Recommendation Hardening

v0.2.4 delivers a broad stabilization wave across installer UX, recommendation quality/telemetry contracts, API observability, and userscript reliability.

This release includes all changes between `v0.2.3` and `v0.2.4`.

### Download Assets

- Windows x64 installer: `OrganizedJihad.Installer.exe`
- Linux x64 installer: `OrganizedJihad.Installer-linux-x64`
- macOS Intel installer: `OrganizedJihad.Installer-osx-x64`
- macOS Apple Silicon installer: `OrganizedJihad.Installer-osx-arm64`
- Runtime checksums:
  - `SHA256SUMS-win-x64.txt`
  - `SHA256SUMS-linux-x64.txt`
  - `SHA256SUMS-osx-x64.txt`
  - `SHA256SUMS-osx-arm64.txt`
- Build manifest: `release-manifest.json`

### Highlights

#### 1. Installer UX and operator clarity
- Added explicit separation between install-time options and immediate quick actions.
- Added quick action buttons:
  - Open Tampermonkey setup now
  - Run API diagnostics probe now
  - Open diagnostics pages now
- Added live installer option-state summary with immediate visual/log feedback when toggles change.
- Clarified installer behavior in docs (run-options vs quick actions).

#### 2. Recommendation and simulation hardening
- Arena simulation endpoint and recommendation ecosystem maturity improvements.
- Canonical health semantics aligned across API and userscript (`Healthy`, `Needs Attention`, `Stale`).
- Contract matrix strengthened for arena simulation compatibility, nullable semantics, and fallback behavior.
- API integration assertions hardened for required fields, bounds, and confidence interval validity.
- Userscript diagnostics coverage expanded (source-mix/fallback banner + operations summary semantics).

#### 3. Observability and operational safety
- Added/strengthened API observability surfaces and links (Swagger/OpenAPI/log access paths).
- Hardened `/ui/logs/latest` against active log-file lock contention and fallback-read scenarios.
- Expanded tray/runtime observability links and supporting tests.
- Added non-Windows tray runtime UI host path (Linux/macOS) with headless-supervision fallback.

#### 4. Userscript reliability and UI behavior
- Connection UX improvements and API call stream refinements.
- Overlay and recommendation context handling improvements for battle-related flows.
- Navigation tab wrapping improvement for dense tab sets on narrower overlays.
- Localization/name-resolution reliability hardening for inventory/entity labels.

#### 5. Codebase modernization and decomposition
- Continued architecture modernization merge and stabilization slices.
- Additional modular decomposition across recommendation, tracker orchestration, and installer/runtime supporting surfaces.
- Focused test suite growth across API, userscript, and tray/runtime components.

### Validation summary
- Release pipeline checks passed for this build:
  - Migration-path check (cold start + repeat start)
  - Userscript install/build steps
  - Published API smoke test
  - Runtime publish for `win-x64`, `linux-x64`, `osx-x64`, and `osx-arm64`

### OS support matrix

- Windows: installer, API server, tray icon host supported.
- Linux: installer artifact, API server, tray icon host supported where desktop tray implementation is available.
- macOS: installer artifact, API server, tray icon host supported where menu/tray integration is available.

If tray infrastructure is unavailable on the host desktop session, runtime host falls back to headless supervision mode.

### Installation (Windows)

1. Download `OrganizedJihad.Installer.exe` and `SHA256SUMS.txt`.
2. Optionally verify checksum.
3. Run installer and proceed through guided steps.
4. Use Quick Actions for immediate setup/diagnostics, or Install Run Options to affect Step 2/3 and Full Install behavior.

### Tracking and notable issue waves
- Recommendation/governance and contract hardening wave (including #345, #346, #347 and follow-up contract/testing slices).
- Installer UX clarification and quick-actions wave (including #370, #371, #372).
- Additional observability/reliability closures across API/userscript/tray host in the v0.2.4 window.
- Cross-platform parity wave: #373 (epic), #374 (tray runtime host), #375 (release assets/docs).
