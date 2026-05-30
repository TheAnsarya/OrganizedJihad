# Operational Recovery Playbook

## Scope

This playbook covers common local-runtime failures for OrganizedJihad installs and upgrades on Windows.

## Fast Triage

1. Open API health: `http://localhost:5124/api/sync/health`
2. Open API repair status: `http://localhost:5124/ui/repair-status`
3. Open userscript handshake: `http://localhost:5124/ui/userscript-handshake`
4. Confirm tray icon exists in hidden icons and can open `/ui`.

## Failure Modes and Actions

### API Not Reachable

- Confirm task registration in `/ui/repair-status`:
  - `apiServiceTaskStatus`
  - `apiTrayTaskStatus`
- Re-run installer as Administrator:

```powershell
dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --first-run-diagnostics --run-install-health-check
```

### Userscript Not Syncing

- Check `/ui/userscript-handshake` status:
  - `active`: recent sync observed
  - `stale`: old sync timestamp
  - `missing`: no sync metadata recorded
- Verify Tampermonkey extension and script enablement.
- Run userscript diagnostics:

```powershell
cd userscript
yarn install:check --open failed
```

### Install Failed Mid-Run

- Installer now performs transactional rollback snapshots for API, desktop, tray, and userscript payloads.
- On failure, installer attempts restoration automatically and reports rollback progress.
- Check `%LOCALAPPDATA%\OrganizedJihad\rollback` if troubleshooting snapshot retention.

### Port Conflict or Duplicate Listener

- Tray host surfaces a notification when configured API port is occupied but health probe fails.
- Review `tray-host.log` beside API binaries for repeated conflict/startup events.
- Resolve conflicting process, then use tray menu `Restart API`.

## Pre-Release Reliability Checks

Run these checks before packaging or publishing:

```bash
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64
```

`OrganizedJihad.Release.Cli` runs migration-path + smoke validation by default unless explicitly skipped.
