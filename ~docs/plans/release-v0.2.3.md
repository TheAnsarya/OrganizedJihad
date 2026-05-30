# OrganizedJihad v0.2.3 - "Three Kingdoms, One Installer"

## Release Theme

v0.2.3 is the first cross-platform installer/runtime milestone: one installer flow for Windows, macOS, and Linux.

## Highlights

- Cross-platform managed installer engine (`OrganizedJihad.Installer.Cli`) now available for GUI orchestration.
- Avalonia installer UI now requires the managed installer CLI (PowerShell fallback removed).
- Runtime host (`OrganizedJihad.Api.TrayHost`) now multi-targets Windows + non-Windows:
  - Windows: tray mode (existing behavior)
  - macOS/Linux: headless supervision fallback with `runtime-host.log`
- New managed release pipeline for 0.2.3:
  - `OrganizedJihad.Release.Cli`
  - Target runtimes: `win-x64`, `linux-x64`, `osx-x64`, `osx-arm64`
  - Built-in reliability checks:
    - migration cold-start + repeat-start validation
    - win-x64 published API smoke probes (`/api/sync/health`, `/ui/settings`, `/ui/repair-status`, `/ui/userscript-handshake`)

## Installation Instructions

### Windows

1. Download `artifacts/v0.2.3/win-x64/OrganizedJihad.Installer.exe`.
2. Verify checksum in `artifacts/v0.2.3/win-x64/SHA256SUMS.txt`.
3. Run installer and follow the step buttons.

### macOS

1. Download `artifacts/v0.2.3/osx-x64/OrganizedJihad.Installer` or `artifacts/v0.2.3/osx-arm64/OrganizedJihad.Installer`.
2. Mark executable and run:

```bash
chmod +x OrganizedJihad.Installer
./OrganizedJihad.Installer
```

3. Follow installer workflow and userscript guide.

### Linux

1. Download `artifacts/v0.2.3/linux-x64/OrganizedJihad.Installer`.
2. Mark executable and run:

```bash
chmod +x OrganizedJihad.Installer
./OrganizedJihad.Installer
```

3. Follow installer workflow and userscript guide.

## Setup Guide + Screenshots

- Userscript setup guide: `~docs/installer-guide/tampermonkey-setup.html`
- Screenshot references:
  - `~docs/installer-guide/screenshots/chrome-setup.png`
  - `~docs/installer-guide/screenshots/edge-setup.png`
  - `~docs/installer-guide/screenshots/firefox-setup.png`
  - `~docs/installer-guide/screenshots/opera-setup.png`
  - `~docs/installer-guide/screenshots/opera-gx-setup.png`

## Build + Artifact Commands

```bash
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3
```

Optional runtime selection:

```bash
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64,osx-arm64
```

Fast rerun (reuse existing userscript dist bundle):

```bash
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes linux-x64 --skip-userscript-build
```

Managed artifact output now also copies release-body draft into artifact root as `RELEASE-NOTES.md`.

Managed validation controls:

- `--skip-migration-check` to bypass migration validation
- `--skip-smoke-test` to bypass published API smoke checks
- `--smoke-runtime auto|none|<runtime>` to select which published runtime executes smoke probes

Compatibility entrypoint note:

- `Publish-ReleaseArtifacts.ps1` and `Publish-ReleaseArtifacts-0.2.3.ps1` now forward to `OrganizedJihad.Release.Cli` so legacy commands keep working without diverging release logic.

## Known Notes

- Windows keeps native tray icon UX.
- macOS/Linux use headless runtime host fallback in this milestone while tray abstraction work continues under #331.
