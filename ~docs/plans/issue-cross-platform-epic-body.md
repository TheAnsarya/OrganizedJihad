## Summary
Ensure release artifacts, runtime host behavior, and documentation provide first-class support for Windows, Linux, and macOS.

## Scope
- Release pipeline/runtime matrix verification and asset publishing for Linux/macOS installers.
- Tray host parity work so Linux/macOS get tray-icon mode rather than headless-only runtime mode.
- Documentation updates (release notes, install guide, compatibility statements).

## Deliverables
- Published release assets for Linux and macOS installer binaries.
- Tray host implementation updates for non-Windows platforms.
- Updated docs and release description clarifying support matrix and known caveats.

## Acceptance Criteria
- Linux/macOS installer assets attached to latest release.
- Runtime host launches with tray icon/menu on Linux/macOS where desktop tray support is available.
- API server launch/health-check behavior validated on non-Windows path in code/tests.
- Docs updated with support matrix and limitations.
