Epic: #373

## Summary
Attach Linux/macOS installer artifacts to release v0.2.4 and update release/docs with cross-platform matrix details.

## Tasks
- Produce runtime artifacts for linux-x64, osx-x64, osx-arm64.
- Upload release assets with clear runtime-specific names.
- Update release body and RELEASE-NOTES.md asset to include those artifacts and compatibility notes.
- Update docs/install guide matrix.

## Acceptance Criteria
- v0.2.4 release includes Linux/macOS installer assets and checksums.
- Release notes/documents explicitly state API server/tray-host support by OS.
