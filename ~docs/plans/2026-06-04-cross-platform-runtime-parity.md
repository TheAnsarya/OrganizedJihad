# Cross-Platform Runtime Parity Plan (2026-06-04)

## Scope

Align release packaging and runtime-host behavior for Windows, Linux, and macOS.

## Related Issues

- #373 Epic: Cross-platform release parity (Windows/Linux/macOS)
- #374 Implement Linux/macOS tray icon runtime host
- #375 Add Linux/macOS installer assets to v0.2.4 release and docs

## Work Items

1. Release matrix and artifact publishing
- Ensure release wrapper defaults to full runtime matrix.
- Produce artifacts for win-x64, linux-x64, osx-x64, osx-arm64.
- Upload runtime-specific installer/checksum assets to v0.2.4.

2. Runtime host behavior
- Keep existing Windows tray implementation unchanged.
- Add non-Windows tray UI runtime path for Linux/macOS using Avalonia tray integration.
- Preserve fallback to headless supervision if tray UI initialization fails.

3. Documentation
- Update release body draft with cross-platform asset matrix and support notes.
- Update installer guide notes with API/tray behavior matrix and fallback caveat.
- Record session-log addendum with validation summary.

## Validation Targets

- `dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release`
- `pwsh -ExecutionPolicy Bypass -File .\Publish-ReleaseArtifacts.ps1 -Version 0.2.4 -Runtime "win-x64,linux-x64,osx-x64,osx-arm64"`
- `gh release view v0.2.4 --json assets,body,url`

## Risks / Caveats

- Linux/macOS tray UX depends on desktop session tray/menu support.
- Host environments without tray infrastructure will use headless supervision fallback.
- macOS artifacts are unsigned in this pipeline and may require user trust override at launch.
