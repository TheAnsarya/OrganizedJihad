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
- Avalonia installer UI now runs managed installer CLI only (PowerShell fallback removed).
- Runtime host is now multi-targeted:
  - Windows tray mode retained.
  - macOS/Linux headless supervisor fallback enabled.
- New multi-runtime managed release CLI: `OrganizedJihad.Release.Cli`.
- Managed release CLI now includes built-in validation checks:
  - migration-path validation (cold start + repeat start)
  - host-compatible published API smoke probes for `/api/sync/health`, `/ui/settings`, `/ui/repair-status`, and `/ui/userscript-handshake`
  - configurable smoke runtime selection via `--smoke-runtime auto|none|<runtime>`
  - configurable API readiness bounds via `--startup-timeout-seconds <10..600>`
  - non-destructive plan mode via `--dry-run`
  - optional machine-readable plan output via `--dry-run-format json`
  - built-in option help via `--help`

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
