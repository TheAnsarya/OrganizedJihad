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

---

## Session
- Date: 2026-05-30
- Session Number: 3
- Scope: continue managed release hardening and PS1 validation path retirement

## Summary
- Integrated migration-path and win-x64 smoke checks directly into `OrganizedJihad.Release.Cli` so release validation no longer requires running `Test-ApiMigrationPath.ps1` / `Test-ReleaseSmoke.ps1` manually.
- Added managed release CLI controls:
	- `--skip-migration-check`
	- `--skip-smoke-test`
	- `--migration-first-run-url`
	- `--migration-second-run-url`
	- `--smoke-api-url`
	- `--startup-timeout-seconds`
- Updated active docs (`README`, `userscript/INSTALL.md`, operational + v0.2.3 release docs) to prioritize managed .NET installer/release commands.

## Files Modified
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- README.md
- userscript/INSTALL.md
- ~docs/plans/operational-recovery-playbook.md
- ~docs/plans/release-v0.2.3.md
- ~docs/plans/release-v0.2.3-github-body.md
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- Release pipeline migration: #335
- Notes/docs refresh: #332
- PR tracking: #209

## Validation
- dotnet build installer-core/OrganizedJihad.Release.Cli/OrganizedJihad.Release.Cli.csproj -c Release (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64 --output-root artifacts-managed-validate --skip-userscript-build (pass; includes built-in migration + smoke checks)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes linux-x64 --output-root artifacts-managed-fast --skip-userscript-build --skip-migration-check --skip-smoke-test (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 4
- Scope: release CLI parser hardening + automated tests

## Summary
- Hardened `ReleaseOptions.Parse` with runtime deduplication and strict HTTP/HTTPS absolute URL validation for migration/smoke endpoint options.
- Added `InternalsVisibleTo` bridge for test access to internal release CLI parser types.
- Added new test project `tests/OrganizedJihad.Release.Cli.Tests` with focused unit coverage for defaults, skip-flag parsing, runtime dedupe, and invalid URL rejection.
- Verified test project and full solution release build are green with the new coverage.

## Files Modified
- OrganizedJihad.sln
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- installer-core/OrganizedJihad.Release.Cli/AssemblyInfo.cs
- tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Release pipeline migration: #335
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj -c Release (pass)
- dotnet build OrganizedJihad.sln -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 5
- Scope: host-aware smoke runtime control + legacy release script delegation

## Summary
- Added runtime-aware smoke selection to managed release pipeline with new `--smoke-runtime` option (`auto`, `none`, or explicit runtime).
- Updated smoke behavior so validation runs only for host-compatible runtime in the selected matrix (or explicit runtime when provided), preventing non-runnable cross-OS smoke attempts.
- Converted `Publish-ReleaseArtifacts.ps1` and `Publish-ReleaseArtifacts-0.2.3.ps1` into compatibility wrappers that forward to `OrganizedJihad.Release.Cli`.
- Expanded release CLI unit tests to cover smoke runtime parsing and resolution behavior.
- Updated README and v0.2.3 release plan docs to reflect managed smoke-runtime controls and wrapper behavior.

## Files Modified
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- Publish-ReleaseArtifacts.ps1
- Publish-ReleaseArtifacts-0.2.3.ps1
- README.md
- ~docs/plans/release-v0.2.3.md
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Release pipeline migration: #335
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj -c Release (pass)
- dotnet build installer-core/OrganizedJihad.Release.Cli/OrganizedJihad.Release.Cli.csproj -c Release (pass)
