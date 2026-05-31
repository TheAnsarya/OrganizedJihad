# 2026-05-30 - Userscript Build Auto Session Log

---

## Session
- Date: 2026-05-31
- Session Number: 33
- Scope: continue high/medium-risk hardening for tray launch/cancellation safety + contract tests

## Summary
- Hardened tray API process startup argument handling by switching from raw argument string composition to `ProcessStartInfo.ArgumentList`.
- Hardened headless runtime loop shutdown path by explicitly handling `OperationCanceledException` during periodic supervision tick cancellation.
- Hardened tray options parsing with working-directory normalization/fallback to reduce invalid path drift and preserve safe defaults.
- Expanded tray host option tests for unsupported URL scheme fallback and working-directory normalization behavior.
- Expanded API UI safety tests for local API URL normalization contract and aligned expectations to current localhost/IPv4 loopback policy.
- Revalidated API and tray host test suites after updates.

## Files Modified
- api/OrganizedJihad.Api.TrayHost/ApiProcessRuntime.cs
- api/OrganizedJihad.Api.TrayHost/HeadlessRuntimeHost.cs
- api/OrganizedJihad.Api.TrayHost/TrayHostOptions.cs
- tests/OrganizedJihad.Api.Tests/ApiUiSafetyTests.cs
- tests/OrganizedJihad.Api.TrayHost.Tests/TrayRuntimeSettingsParserTests.cs
- tests/OrganizedJihad.Api.TrayHost.Tests/TrayHostOptionsAndUtilitiesTests.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj -c Release (pass)
- dotnet test tests/OrganizedJihad.Api.TrayHost.Tests/OrganizedJihad.Api.TrayHost.Tests.csproj -c Release (pass)

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

---

## Session
- Date: 2026-05-30
- Session Number: 21
- Scope: TrayHost Program.cs decomposition into focused runtime classes

## Summary
- Simplified `api/OrganizedJihad.Api.TrayHost/Program.cs` to entrypoint-only logic for both Windows tray and headless runtime modes.
- Extracted tray host argument parsing into `TrayHostOptions` and settings JSON parsing into `TrayRuntimeSettingsParser`.
- Moved Windows tray runtime behavior into dedicated `TrayContext.Windows.cs` file.
- Moved non-Windows headless supervisor behavior into dedicated `HeadlessRuntimeHost.cs` file.
- Added `AssemblyInfo.cs` for centralized `InternalsVisibleTo` instead of embedding assembly attributes in Program.cs.

## Files Modified
- api/OrganizedJihad.Api.TrayHost/Program.cs
- api/OrganizedJihad.Api.TrayHost/AssemblyInfo.cs
- api/OrganizedJihad.Api.TrayHost/TrayHostOptions.cs
- api/OrganizedJihad.Api.TrayHost/TrayRuntimeSettingsParser.cs
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.cs
- api/OrganizedJihad.Api.TrayHost/HeadlessRuntimeHost.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 25
- Scope: continue API endpoint architecture cleanup via partial endpoint modules

## Summary
- Refactored `ApiUiEndpoints` into concern-specific partial files while preserving endpoint behavior and routes.
- Kept `ApiUiEndpoints.cs` as a thin endpoint-orchestration shell calling settings/diagnostics/page mapping methods.
- Added `ApiUiEndpoints.Settings.cs` for `/ui/settings` GET/POST handlers.
- Added `ApiUiEndpoints.Diagnostics.cs` for `/ui/repair-status` and `/ui/userscript-handshake` handlers.
- Added `ApiUiEndpoints.Pages.cs` for `/ui` and `/ui/tray-health` handlers.

## Files Modified
- api/Endpoints/ApiUiEndpoints.cs
- api/Endpoints/ApiUiEndpoints.Settings.cs
- api/Endpoints/ApiUiEndpoints.Diagnostics.cs
- api/Endpoints/ApiUiEndpoints.Pages.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-31
- Session Number: 32
- Scope: continued high/medium-risk hardening (host-header safety, parser/file bounds, template/path safety)

## Summary
- Added `ApiLocalUrlBuilder` and integrated it into settings/page/probe flows to avoid deriving internal probe/base URLs from untrusted Host headers.
- Hardened Hero Wars URL validation to require exact domain or subdomain match (`hero-wars.com` / `*.hero-wars.com`) instead of substring matching.
- Hardened UI template rendering with file-name-only enforcement (path traversal protection), max-size guardrails, and replacement-key sanity checks.
- Hardened tray settings refresh utility with file-size guardrails, resilient read behavior, and URL normalization before applying updates.
- Hardened API UI settings store with bounded reads and serialized atomic writes (semaphore gate) to reduce concurrent write/race risk.

## Files Modified
- api/Services/Ui/ApiLocalUrlBuilder.cs
- api/Services/Ui/ApiUiInputNormalizer.cs
- api/Services/Ui/ApiUiTemplateRenderer.cs
- api/Services/Ui/ApiUiHealthProbeService.cs
- api/Services/Ui/ApiUiPageTokenBuilder.cs
- api/Services/Ui/ApiUiSettingsEndpointHandler.cs
- api/Services/Ui/ApiUiSettingsStore.cs
- api/Extensions/ApiServiceCollectionExtensions.cs
- api/OrganizedJihad.Api.TrayHost/TrayHostRuntimeUtilities.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-31
- Session Number: 31
- Scope: continue API UI decomposition via dedicated page/probe/recommendation builders

## Summary
- Added `ApiUiHealthProbeService` to isolate local `/api/sync/health` probe behavior from page handlers.
- Added `ApiUiPageTokenBuilder` to centralize HTML token-map construction for `/ui` and `/ui/tray-health` templates.
- Added `ApiUiRepairRecommendationBuilder` to isolate recommendation-text composition from diagnostics endpoint handling.
- Updated `ApiUiPageEndpointHandler` to delegate probe and token construction to dedicated services.
- Updated `ApiUiDiagnosticsEndpointHandler` to delegate recommendation assembly to dedicated builder service.
- Registered all new services in API DI composition.

## Files Modified
- api/Services/Ui/ApiUiHealthProbeService.cs
- api/Services/Ui/ApiUiPageTokenBuilder.cs
- api/Services/Ui/ApiUiRepairRecommendationBuilder.cs
- api/Services/Ui/ApiUiPageEndpointHandler.cs
- api/Services/Ui/ApiUiDiagnosticsEndpointHandler.cs
- api/Extensions/ApiServiceCollectionExtensions.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-31
- Session Number: 30
- Scope: continuation hardening slices for tray/runtime + diagnostics robustness

## Summary
- Hardened shared process runtime startup with explicit error reporting and timeout-safe shutdown semantics.
- Updated tray Windows/runtime and headless runtime hosts to consume startup error output and emit clearer logs on process launch failure.
- Reworked headless supervisor loop to use `PeriodicTimer` with cancellation token source instead of raw infinite sleep loop.
- Added API URL normalization/validation in `TrayHostOptions` parsing for safer runtime defaults.
- Hardened tray settings parser against malformed JSON by handling `JsonException` explicitly.
- Hardened scheduled task probe with explicit timeout detection and cleanup.
- Switched API UI settings persistence to atomic temp-write + replace/move semantics.

## Files Modified
- api/OrganizedJihad.Api.TrayHost/ApiProcessRuntime.cs
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.Runtime.cs
- api/OrganizedJihad.Api.TrayHost/HeadlessRuntimeHost.cs
- api/OrganizedJihad.Api.TrayHost/TrayHostOptions.cs
- api/OrganizedJihad.Api.TrayHost/TrayRuntimeSettingsParser.cs
- api/Services/Diagnostics/ScheduledTaskProbeService.cs
- api/Services/Ui/ApiUiSettingsStore.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-31
- Session Number: 29
- Scope: continue API diagnostics architecture with typed response models/builder

## Summary
- Added typed diagnostics response models for `/ui/repair-status` and `/ui/userscript-handshake` payloads.
- Added `ApiUiDiagnosticsResponseBuilder` to centralize response-object construction logic.
- Updated `ApiUiDiagnosticsEndpointHandler` to delegate response shaping to the builder instead of inline anonymous payload creation.
- Registered the diagnostics response builder in DI composition.
- Removed now-unused `GetRequestBaseUrl` helper from `ApiUiEndpoints` root shell.

## Files Modified
- api/Models/Ui/ApiUiDiagnosticsResponses.cs
- api/Services/Ui/ApiUiDiagnosticsResponseBuilder.cs
- api/Services/Ui/ApiUiDiagnosticsEndpointHandler.cs
- api/Extensions/ApiServiceCollectionExtensions.cs
- api/Endpoints/ApiUiEndpoints.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 26
- Scope: continue tray-host refactor by extracting shared API process runtime operations

## Summary
- Added `ApiProcessRuntime` helper to centralize API process start/stop operations.
- Rewired Windows tray runtime supervision and menu stop action to use shared process helper methods.
- Rewired headless runtime host start/stop paths to the same shared process helper methods.
- Preserved existing process lifecycle behavior while reducing duplicated runtime code.

## Files Modified
- api/OrganizedJihad.Api.TrayHost/ApiProcessRuntime.cs
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.Runtime.cs
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.MenuActions.cs
- api/OrganizedJihad.Api.TrayHost/HeadlessRuntimeHost.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 27
- Scope: continue tray host runtime decomposition (port probe + icon loading extraction)

## Summary
- Extracted tray port occupancy probing into `TrayPortProbe` to isolate network probing concerns from tray runtime orchestration.
- Extracted tray icon discovery/loading into `TrayIconLoader` to isolate asset selection concerns from runtime supervision logic.
- Updated `TrayContext.Windows.Runtime` to delegate both concerns to the new helper classes.
- Added Windows conditional compilation guard to `TrayIconLoader` to preserve cross-target compilation behavior (`net10.0` + `net10.0-windows`).

## Files Modified
- api/OrganizedJihad.Api.TrayHost/TrayPortProbe.cs
- api/OrganizedJihad.Api.TrayHost/TrayIconLoader.cs
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.Runtime.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 24
- Scope: continue tray host refactor by extracting shared runtime utilities

## Summary
- Added shared helper `TrayHostRuntimeUtilities` to centralize common runtime behavior used by both Windows tray and headless hosts.
- Moved shared health probing, settings-file URL update detection, log append behavior, and argument quoting into the utility class.
- Updated `TrayContext.Windows.Runtime` and `HeadlessRuntimeHost` to use the shared utility methods while preserving existing host-specific behavior.
- Kept runtime semantics unchanged; this refactor reduces duplication and clarifies architecture boundaries.

## Files Modified
- api/OrganizedJihad.Api.TrayHost/TrayHostRuntimeUtilities.cs
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.Runtime.cs
- api/OrganizedJihad.Api.TrayHost/HeadlessRuntimeHost.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 23
- Scope: continue tray host runtime decomposition without behavior change

## Summary
- Restructured Windows tray runtime implementation into partial class files by concern while preserving existing logic and call flow.
- Kept `TrayContext.Windows.cs` focused on state, constructor initialization, and lifecycle disposal.
- Moved menu/action handlers into `TrayContext.Windows.MenuActions.cs`.
- Moved API supervision, health checks, settings reload, port conflict handling, icon resolution, and logging into `TrayContext.Windows.Runtime.cs`.
- No endpoint or runtime behavior intent was changed; this is architecture-only code organization.

## Files Modified
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.cs
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.MenuActions.cs
- api/OrganizedJihad.Api.TrayHost/TrayContext.Windows.Runtime.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 22
- Scope: verify no functionality loss after Program decomposition + call-flow clarity

## Summary
- Verified that API and TrayHost entrypoint composition roots still invoke all previous behavior through extracted endpoint/service/runtime classes.
- Added explicit composition comments in startup entrypoints to make call flow discoverable for maintainers.
- Revalidated both TrayHost and API release builds after the clarification-only edits.

## Files Modified
- api/Program.cs
- api/OrganizedJihad.Api.TrayHost/Program.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)
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
- Date: 2026-05-31
- Session Number: 28
- Scope: continue API UI architecture decomposition into endpoint handler services

## Summary
- Extracted endpoint behavior from `ApiUiEndpoints` lambda bodies into dedicated handler classes under `api/Services/Ui`.
- Added `ApiUiSettingsEndpointHandler` for `/ui/settings` get/save behavior.
- Added `ApiUiDiagnosticsEndpointHandler` for `/ui/repair-status` and `/ui/userscript-handshake` behavior.
- Added `ApiUiPageEndpointHandler` for `/ui` and `/ui/tray-health` rendering/probe behavior.
- Updated endpoint mapping partials to delegate to these handlers while preserving route paths and behavior.
- Registered the new handler services in API DI composition.

## Files Modified
- api/Services/Ui/ApiUiSettingsEndpointHandler.cs
- api/Services/Ui/ApiUiDiagnosticsEndpointHandler.cs
- api/Services/Ui/ApiUiPageEndpointHandler.cs
- api/Extensions/ApiServiceCollectionExtensions.cs
- api/Endpoints/ApiUiEndpoints.Settings.cs
- api/Endpoints/ApiUiEndpoints.Diagnostics.cs
- api/Endpoints/ApiUiEndpoints.Pages.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 20
- Scope: API startup architecture cleanup by extracting Program.cs responsibilities

## Summary
- Refactored `api/Program.cs` into a thin composition root that only performs startup orchestration.
- Extracted API service registration to `api/Extensions/ApiServiceCollectionExtensions.cs`.
- Extracted database initialization and UI security middleware wiring to `api/Extensions/WebApplicationSetupExtensions.cs`.
- Extracted UI routes/settings/diagnostics pages to `api/Endpoints/ApiUiEndpoints.cs` and root/system endpoint mapping to `api/Endpoints/SystemEndpoints.cs`.
- Moved UI and diagnostics concerns into dedicated services and models (`ApiRuntimePaths`, `ApiUiAccessPolicy`, `ApiUiTemplateRenderer`, `ApiUiSettingsStore`, `ApiUiInputNormalizer`, `UserscriptHandshakeDiagnosticsService`, `ScheduledTaskProbeService`).
- Moved UI contract records out of Program.cs into `api/Models/Ui/*`.

## Files Modified
- api/Program.cs
- api/Extensions/ApiServiceCollectionExtensions.cs
- api/Extensions/WebApplicationSetupExtensions.cs
- api/Endpoints/ApiUiEndpoints.cs
- api/Endpoints/SystemEndpoints.cs
- api/Models/Ui/ApiUiSettings.cs
- api/Models/Ui/UserscriptHandshakeStatus.cs
- api/Models/Ui/ScheduledTaskProbeResult.cs
- api/Services/Ui/ApiRuntimePaths.cs
- api/Services/Ui/ApiUiAccessPolicy.cs
- api/Services/Ui/ApiUiTemplateRenderer.cs
- api/Services/Ui/ApiUiSettingsStore.cs
- api/Services/Ui/ApiUiInputNormalizer.cs
- api/Services/Diagnostics/UserscriptHandshakeDiagnosticsService.cs
- api/Services/Diagnostics/ScheduledTaskProbeService.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)

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
- Session Number: 17
- Scope: tray icon quality uplift for `ico` output + no-text alternative set

## Summary
- Rebuilt `oj-tray-alt-steel.ico` as a multi-resolution icon package (`16, 20, 24, 32, 40, 48, 64, 128, 256`) using 32-bit ARGB PNG icon entries to improve tray rendering clarity and color fidelity.
- Added graphics-only no-text alternative icon pair:
	- `oj-tray-alt-steel-glyph.png`
	- `oj-tray-alt-steel-glyph.ico`
- Updated tray host icon selection order to prefer `oj-tray-alt-steel.ico` by default, with primary icon fallback.

## Files Modified
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-steel.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-steel-glyph.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-alt-steel-glyph.png
- api/OrganizedJihad.Api.TrayHost/Program.cs
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)
- Visual preview of `oj-tray-alt-steel.png` and `oj-tray-alt-steel-glyph.png` (pass)

---

## Session
- Date: 2026-05-30
- Session Number: 18
- Scope: installer cleanup + installer size reduction + tray health dashboard + palette rollout + extra icons

## Summary
- Added installer-side cleanup for legacy API/tray executable variants under `%LOCALAPPDATA%/OrganizedJihad/api` and `%LOCALAPPDATA%/OrganizedJihad/runtime-host`.
- Added installer pre-copy process cleanup for legacy API and tray-host processes to improve replacement reliability.
- Reduced installer artifact size by:
	- enabling single-file compression,
	- disabling debug symbol output for installer publish,
	- pruning `.pdb/.xml/.dbg` payload files from bundled runtime payloads in release pipeline.
- Verified local publish size drop for win-x64 installer executable from ~1.07 GB range to ~324.89 MB.
- Updated tray host "Open API Health" action to open a rendered dashboard page (`/ui/tray-health`) instead of raw health JSON.
- Added `/ui/tray-health` endpoint with runtime summary (API health state, API base URL, userscript handshake status, quick links).
- Applied requested palette (`#3a143c`, `#2a1f14`, `#d4821d`, `#90590d`) across:
	- installer UI,
	- API local UI shell,
	- desktop app CSS/layout shell.
- Added extra fun icon variants:
	- `oj-tray-fun-orb` (PNG/ICO)
	- `oj-tray-fun-shield` (PNG/ICO)

## Files Modified
- installer-core/OrganizedJihad.Installer.Cli/Program.cs
- installer-core/OrganizedJihad.Release.Cli/Program.cs
- installer-ui/MainWindow.axaml
- installer-ui/OrganizedJihad.Installer.csproj
- api/OrganizedJihad.Api.TrayHost/Program.cs
- api/Program.cs
- desktop-app/wwwroot/app.css
- desktop-app/Components/Layout/MainLayout.razor.css
- desktop-app/Components/Layout/NavMenu.razor.css
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-fun-orb.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-fun-orb.png
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-fun-shield.ico
- api/OrganizedJihad.Api.TrayHost/Assets/Icons/oj-tray-fun-shield.png
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build installer-core/OrganizedJihad.Installer.Cli/OrganizedJihad.Installer.Cli.csproj -c Release (pass)
- dotnet build installer-core/OrganizedJihad.Release.Cli/OrganizedJihad.Release.Cli.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj -c Release (pass)
- dotnet build installer-ui/OrganizedJihad.Installer.csproj -c Release (pass)
- dotnet build desktop-app/OrganizedJihad.Desktop.csproj -c Release (pass)
- dotnet publish installer-ui/OrganizedJihad.Installer.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -o installer-ui/publish/win-x64 (pass)
- installer-ui/publish/win-x64/OrganizedJihad.Installer.exe => 324.89 MB

---

## Session
- Date: 2026-05-30
- Session Number: 19
- Scope: Program.cs UI template extraction + Program.cs cleanup

## Summary
- Removed large raw HTML/CSS route strings from `api/Program.cs` for `/ui` and `/ui/tray-health`.
- Added external UI template files under `api/Resources/UiTemplates/`:
	- `api-control.html`
	- `tray-health.html`
- Added Program.cs helpers to resolve/load template files and inject runtime tokens (base URL, health state, timestamps, handshake data).
- Updated API project file to copy template resources into build/publish outputs.
- Cleaned up Program.cs health probe flow by reusing a shared `HttpClient` for `/ui/tray-health` instead of allocating per request.

## Files Modified
- api/Program.cs
- api/OrganizedJihad.Api.csproj
- api/Resources/UiTemplates/api-control.html
- api/Resources/UiTemplates/tray-health.html
- ~docs/copilot-chats/2026-05-30-userscript-build-auto.md

## Issues
- Epic: #333
- Installer/runtime migration: #334
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release (pass)

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
