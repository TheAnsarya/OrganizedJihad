## OrganizedJihad v0.2.3 - Three Kingdoms, One Installer

Cross-platform installer/runtime milestone for Windows, macOS, and Linux.

### Downloads

- Windows: `artifacts/v0.2.3/win-x64/OrganizedJihad.Installer.exe`
- Linux: `artifacts/v0.2.3/linux-x64/OrganizedJihad.Installer`
- macOS Intel: `artifacts/v0.2.3/osx-x64/OrganizedJihad.Installer`
- macOS Apple Silicon: `artifacts/v0.2.3/osx-arm64/OrganizedJihad.Installer`

Each runtime folder includes `SHA256SUMS.txt`.

### What Changed

- New managed installer CLI (`OrganizedJihad.Installer.Cli`) for cross-platform install orchestration.
- Avalonia installer UI now prefers managed installer CLI (PS1 fallback retained for compatibility).
- Runtime host is now multi-targeted:
  - Windows tray mode retained.
  - macOS/Linux headless supervisor fallback enabled.
- New multi-runtime release script: `Publish-ReleaseArtifacts-0.2.3.ps1`.

### Install

#### Windows

1. Run `OrganizedJihad.Installer.exe`.
2. Complete installer step buttons.

#### macOS / Linux

```bash
chmod +x OrganizedJihad.Installer
./OrganizedJihad.Installer
```

Then complete installer workflow and userscript setup guide.

### Userscript Setup Guide

- Guide: `~docs/installer-guide/tampermonkey-setup.html`
- Screenshot links:
  - `~docs/installer-guide/screenshots/chrome-setup.png`
  - `~docs/installer-guide/screenshots/edge-setup.png`
  - `~docs/installer-guide/screenshots/firefox-setup.png`
  - `~docs/installer-guide/screenshots/opera-setup.png`
  - `~docs/installer-guide/screenshots/opera-gx-setup.png`

### Tracking Issues

- Epic: #333
- Installer core: #334
- Runtime host abstraction: #331
- Release matrix: #335
- Notes/docs refresh: #332
