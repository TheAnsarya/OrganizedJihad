# 2026-05-30 - Userscript Build Auto Session Log

---

## Session
- Date: 2026-05-30
- Session Number: 1
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- nstall-OrganizedJihad.cmd
- api/Program.cs
- userscript/package.json
- ~docs/oj-manual-prompts-log.txt
- ~docs/plans/operational-recovery-playbook.md

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-30T09:59:30.157Z

---

## Session
- Date: 2026-05-30
- Session Number: 2
- Scope: continue #333/#334/#335 managed install/release migration and full cross-platform artifact generation

## Summary
- Replaced `Install-OrganizedJihad.cmd` orchestration from PowerShell script execution to managed `dotnet run --project installer-core/OrganizedJihad.Installer.Cli` flow.
- Updated API `/ui/repair-status` recommendation messaging to managed installer command and fixed tray-host artifact detection to support both `runtime-host` (current) and legacy `api-tray` paths.
- Enhanced `OrganizedJihad.Release.Cli` with:
	- `--skip-userscript-build`
	- `--release-notes-path`
	- automatic copy of release notes draft into artifact root as `RELEASE-NOTES.md`
- Executed full managed matrix release run for `win-x64`, `linux-x64`, `osx-x64`, `osx-arm64` into `artifacts/v0.2.3` with manifest + checksums.
- Updated README and release/operations docs for managed command paths.

## Files Modified
- Install-OrganizedJihad.cmd
- api/Program.cs
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- README.md
- ~docs/plans/operational-recovery-playbook.md
- ~docs/plans/release-v0.2.3.md
- userscript/package.json
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- Release pipeline migration: #335
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)
- dotnet build installer-core/OrganizedJihad.Installer.Cli/OrganizedJihad.Installer.Cli.csproj -c Release (pass)
- dotnet build installer-core/OrganizedJihad.Release.Cli/OrganizedJihad.Release.Cli.csproj -c Release (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64,osx-x64,osx-arm64 --output-root artifacts (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes linux-x64 --output-root artifacts-managed-check --skip-userscript-build (pass)
