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

---

## Session
- Date: 2026-05-30
- Session Number: 7
- Scope: managed release dry-run preflight mode + timeout guardrails

## Summary
- Added managed `--dry-run` mode to `OrganizedJihad.Release.Cli` that prints execution planning details and exits without running migration/build/publish/smoke workflows.
- Added strict `--startup-timeout-seconds` validation with enforced `10..600` bounds and explicit parse failures for non-integer values.
- Added wrapper passthrough support (`Publish-ReleaseArtifacts*.ps1`) for `--dry-run` and `--startup-timeout-seconds` so legacy commands retain managed parity.
- Updated active release docs (`README`, v0.2.3 release plan/body, operational playbook) to include preflight planning and timeout controls.

## Files Modified
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- Publish-ReleaseArtifacts.ps1
- Publish-ReleaseArtifacts-0.2.3.ps1
- README.md
- ~docs/plans/release-v0.2.3.md
- ~docs/plans/release-v0.2.3-github-body.md
- ~docs/plans/operational-recovery-playbook.md
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Release pipeline migration: #335
- Notes/docs refresh: #332
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj -c Release (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64 --dry-run (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 8
- Scope: release pipeline safety guardrails (runtime tokens + artifact path boundaries)

## Summary
- Added `--runtimes` input safety validation (max 16 entries, no path separators, token character restrictions, bounded token length).
- Added artifact output-root safety guardrails to prevent accidental cleanup outside repository boundaries.
- Added helper coverage for artifact-root safety checks and runtime validation failure paths.
- Updated README release options with new safety behavior notes.

## Files Modified
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- README.md
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Release pipeline migration: #335
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj -c Release (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64 --dry-run --startup-timeout-seconds 120 (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 9
- Scope: release CLI usability hardening (help + json dry-run plan output)

## Summary
- Added built-in `--help` / `-h` usage output for `OrganizedJihad.Release.Cli` option discoverability.
- Added `--dry-run-format text|json` for structured preflight plan output, including machine-readable runtime/smoke/userscript settings.
- Updated legacy wrapper scripts to forward dry-run format and added wrapper-side `ValidateSet('text','json')` constraints.
- Updated v0.2.3 docs/README to include JSON preflight examples and help usage.

## Files Modified
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- Publish-ReleaseArtifacts.ps1
- Publish-ReleaseArtifacts-0.2.3.ps1
- README.md
- ~docs/plans/release-v0.2.3.md
- ~docs/plans/release-v0.2.3-github-body.md
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Release pipeline migration: #335
- Notes/docs refresh: #332
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj -c Release (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64 --dry-run --dry-run-format json (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --help (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 10
- Scope: CI-friendly dry-run export path for release planning artifacts

## Summary
- Added `--dry-run-output-path` to `OrganizedJihad.Release.Cli` so dry-run plan output can be persisted as a file artifact.
- Updated dry-run implementation to build plan payloads (`text` or `json`), optionally write them to a configured output path, and still emit to stdout.
- Updated wrapper scripts to forward `-DryRunOutputPath` and kept dry-run format guardrails via `ValidateSet('text','json')`.
- Updated active release docs with dry-run file export option for CI automation.

## Files Modified
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- Publish-ReleaseArtifacts.ps1
- Publish-ReleaseArtifacts-0.2.3.ps1
- README.md
- ~docs/plans/release-v0.2.3.md
- ~docs/plans/release-v0.2.3-github-body.md
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Release pipeline migration: #335
- Notes/docs refresh: #332
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj -c Release (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64 --dry-run --dry-run-format json --dry-run-output-path artifacts/dryrun/plan.json (pass)
- Get-Content artifacts/dryrun/plan.json -TotalCount 40 (verified file output)
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

---

## Session
- Date: 2026-05-30
- Session Number: 6
- Scope: release CLI parser strictness and release-note alignment

## Summary
- Hardened `ReleaseOptions.Parse` to reject unknown value-options and unknown flags instead of silently ignoring them.
- Added test coverage for unknown option and unknown flag rejection paths.
- Updated v0.2.3 release draft docs to reflect host-compatible smoke behavior and `--smoke-runtime auto|none|<runtime>` control.

## Files Modified
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- README.md
- ~docs/plans/release-v0.2.3-github-body.md
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Release pipeline migration: #335
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj -c Release (pass)
---

## Session
- Date: 2026-05-30
- Session Number: 11
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- ublish-ReleaseArtifacts-0.2.3.ps1
- Publish-ReleaseArtifacts.ps1
- README.md
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- userscript/package.json
- ~docs/oj-manual-prompts-log.txt
- ~docs/plans/release-v0.2.3-github-body.md

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-30T10:36:19.030Z

---

## Session
- Date: 2026-05-30
- Session Number: 12
- Scope: 0.2.3 release prep finalization (release notes + full artifact matrix build)

## Summary
- Finalized `~docs/plans/release-v0.2.3-github-body.md` with a polished release title, expanded install steps, integrity verification commands, and explicit userscript screenshot references.
- Added dry-run CI policy controls to managed release CLI (`--dry-run-fail-on-warnings`, `--dry-run-fail-on-errors`) with schema-stable JSON metadata fields for gating (`schemaVersion`, `notices`, `hasWarnings`, `hasErrors`).
- Updated legacy release wrapper scripts to forward new dry-run policy controls.
- Executed full managed release build for `win-x64`, `linux-x64`, `osx-x64`, and `osx-arm64` with migration and host-compatible smoke validation enabled.
- Verified generated artifact directories and expected installer + checksum files for each runtime.

## Files Modified
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- tests/OrganizedJihad.Release.Cli.Tests/ReleaseOptionsTests.cs
- Publish-ReleaseArtifacts.ps1
- Publish-ReleaseArtifacts-0.2.3.ps1
- README.md
- userscript/package.json
- ~docs/plans/release-v0.2.3-github-body.md
- ~docs/plans/release-v0.2.3.md
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer core migration: #334
- Release matrix and validation: #335
- Notes/docs refresh: #332
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Release.Cli.Tests/OrganizedJihad.Release.Cli.Tests.csproj -c Release (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes osx-arm64 --dry-run --dry-run-format json --dry-run-fail-on-warnings (expected fail; warning policy gate confirmed)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64 --dry-run --dry-run-format json --dry-run-fail-on-warnings (pass)
- dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64,osx-x64,osx-arm64 --output-root artifacts (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 13
- Scope: installer browser targeting + Opera/OperaGX detection + installer UI reflow

## Summary
- Updated installer UI external-link behavior to launch Tampermonkey store/setup guide in the selected browser executable when available, instead of always using the system default browser.
- Expanded browser executable discovery for Opera and Opera GX (additional install path candidates, registry App Paths lookups, and PATH resolution fallback).
- Updated installer CLI bootstrap/diagnostics link opening to honor selected browser arguments (`chrome`, `edge`, `firefox`, `opera`, `operaGX`) via explicit executable launch.
- Reworked installer UI layout with a root `ScrollViewer` (`VerticalScrollBarVisibility=Auto`), larger minimum window sizing, wrapped checkbox row, and stable content stacking to prevent overlap at smaller sizes.

## Files Modified
- installer-ui/MainWindow.axaml
- installer-ui/MainWindow.axaml.cs
- installer-core/OrganizedJihad.Installer.Cli/Program.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build installer-ui/OrganizedJihad.Installer.csproj -c Release (pass)
- dotnet build installer-core/OrganizedJihad.Installer.Cli/OrganizedJihad.Installer.Cli.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 15
- Scope: installer desktop-step reliability, Step 1 Tampermonkey UX, and tray icon asset refresh

## Summary
- Fixed desktop-step payload source resolution in managed installer CLI by adding repo publish fallback directories when bundled desktop payload is absent.
- Changed installer UI elevation requirement so desktop-only and userscript-only actions do not trigger UAC relaunch loops.
- Updated Step 1 UI behavior:
	- widened action column/button sizing so full label is visible,
	- auto-disabled Step 1 when Tampermonkey is already detected,
	- added right-click context command `Reinstall` (visible only in detected/disabled state).
- Added new OJ tray icon assets derived from Hero Wars favicon style direction:
	- primary icon: `oj-tray-primary` (used by tray host),
	- alternatives: `oj-tray-alt-steel`, `oj-tray-alt-gold`.
- Wired tray host icon loading to use bundled `Assets/Icons/oj-tray-primary.ico` with safe fallback to default system icon.

## Files Modified
- installer-core/OrganizedJihad.Installer.Cli/Program.cs
- installer-ui/MainWindow.axaml
- installer-ui/MainWindow.axaml.cs
- api/OrganizedJihad.Api.TrayHost/Program.cs
- api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-primary.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-primary.png
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-steel.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-steel.png
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-gold.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-gold.png
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build installer-ui/OrganizedJihad.Installer.csproj -c Release (pass)
- dotnet build installer-core/OrganizedJihad.Installer.Cli/OrganizedJihad.Installer.Cli.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 16
- Scope: tray icon visual redesign (transparent OJ monogram from Hero Wars favicon palette)

## Summary
- Replaced tray icon assets to remove legacy/H-like glyph treatment and use transparent-background `OJ` monogram only.
- Sampled Hero Wars favicon colors and applied them to the new icon set (yellow/orange/red/burgundy palette family).
- Regenerated primary icon used by tray host plus two alternate visual variants.

## Files Modified
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-primary.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-primary.png
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-steel.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-steel.png
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-gold.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-gold.png
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- Visual verification via direct image preview of regenerated PNG assets.

---

## Session
- Date: 2026-05-30
- Session Number: 14
- Scope: installer userscript step regression fixes (Opera GX detection + stale CLI path + unwanted elevation relaunch)

## Summary
- Fixed userscript-only installer steps to run without forced UAC relaunch, preventing browser selection reset and unexpected bootstrap opens in a different browser.
- Expanded Chromium Tampermonkey detection logic to support additional IDs and manifest-name fallback scanning so Opera GX installs from non-standard extension IDs are detected.
- Updated installer CLI resolution in UI to prefer Release CLI outputs before Debug outputs to avoid running stale installer logic from old local debug artifacts.

## Files Modified
- installer-ui/MainWindow.axaml.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build installer-ui/OrganizedJihad.Installer.csproj -c Release (pass)
- dotnet build installer-core/OrganizedJihad.Installer.Cli/OrganizedJihad.Installer.Cli.csproj -c Release (pass)
