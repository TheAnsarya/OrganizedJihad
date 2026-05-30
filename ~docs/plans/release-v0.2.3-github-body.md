## OrganizedJihad v0.2.3 - Empire Forge: One Installer to Rule Three Platforms

v0.2.3 is the cross-platform release milestone: a unified managed install/release flow for Windows, Linux, and macOS.

### Download Assets

- Windows x64 installer: `artifacts/v0.2.3/win-x64/OrganizedJihad.Installer.exe`
- Linux x64 installer: `artifacts/v0.2.3/linux-x64/OrganizedJihad.Installer`
- macOS Intel installer: `artifacts/v0.2.3/osx-x64/OrganizedJihad.Installer`
- macOS Apple Silicon installer: `artifacts/v0.2.3/osx-arm64/OrganizedJihad.Installer`

Each runtime directory includes `SHA256SUMS.txt`.

### Highlights

- Managed installer-first architecture (`OrganizedJihad.Installer.Cli`) is now the baseline.
- Avalonia installer UI now depends on managed installer CLI only.
- Runtime host model is cross-platform:
  - Windows tray host flow retained.
  - Linux/macOS headless runtime-host supervision enabled.
- Managed release pipeline (`OrganizedJihad.Release.Cli`) now includes:
  - migration path validation (cold start + repeat start)
  - host-compatible smoke checks for `/api/sync/health`, `/ui/settings`, `/ui/repair-status`, `/ui/userscript-handshake`
  - dry-run planning modes (`--dry-run`, `--dry-run-format json`, `--dry-run-output-path`)
  - dry-run policy gates for CI (`--dry-run-fail-on-warnings`, `--dry-run-fail-on-errors`)
  - runtime and artifact path safety guardrails

Dry-run JSON output includes policy-friendly metadata: `schemaVersion`, `notices`, `hasWarnings`, and `hasErrors`.

### Installation

#### Windows

1. Run `OrganizedJihad.Installer.exe` from the `win-x64` asset folder.
2. In the installer UI, run each step in sequence:
   - Install or verify Tampermonkey
   - Install API server/runtime host
   - Install desktop app
   - Install userscript
3. Verify API health at `http://localhost:5124/api/sync/health`.

#### Linux and macOS

1. Download the runtime-matching `OrganizedJihad.Installer` binary.
2. Mark as executable and run:

```bash
chmod +x OrganizedJihad.Installer
./OrganizedJihad.Installer
```

1. Follow installer prompts and complete userscript setup.

### Userscript Setup Guide and Screenshots

- Local setup guide file: `~docs/installer-guide/tampermonkey-setup.html`
- Screenshot references:
  - `~docs/installer-guide/screenshots/chrome-setup.png`
  - `~docs/installer-guide/screenshots/edge-setup.png`
  - `~docs/installer-guide/screenshots/firefox-setup.png`
  - `~docs/installer-guide/screenshots/opera-setup.png`
  - `~docs/installer-guide/screenshots/opera-gx-setup.png`
  - `~docs/installer-guide/screenshots/tampermonkey-import-utilities.png`
  - `~docs/installer-guide/screenshots/tampermonkey-enabled-dashboard.png`

### Optional Integrity Verification

Use the runtime folder checksum file before install:

```bash
sha256sum -c SHA256SUMS.txt
```

On PowerShell:

```powershell
Get-FileHash .\OrganizedJihad.Installer.exe -Algorithm SHA256
```

### Tracking

- Epic: #333
- Installer core migration: #334
- Runtime host abstraction: #331
- Release matrix and validation: #335
- Notes/docs refresh: #332
