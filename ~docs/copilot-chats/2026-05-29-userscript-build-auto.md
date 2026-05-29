# 2026-05-29 - Userscript Build Auto Session Log

---

## Session
- Date: 2026-05-29
- Session Number: 1
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- Install-OrganizedJihad.cmd
- userscript/package.json
- ~docs/oj-manual-prompts-log.txt

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-29T11:02:23.634Z

---

## Session
- Date: 2026-05-29
- Session Number: 2
- Scope: #328 cmd elevation hotfix and release-asset replacement

## Summary
- Fixed `Install-OrganizedJihad.cmd` elevation relaunch path to avoid false failure/cancel messages.
- Added shell fallback to run installer via Windows PowerShell when `pwsh` is unavailable.
- Rebuilt and re-uploaded v0.2.1 release assets so public download includes launcher hotfix.

## Files Modified
- Install-OrganizedJihad.cmd
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Created/implemented: #328
- Referenced epic: #206
- PR tracking: #209

## Validation
- dotnet build installer-ui/OrganizedJihad.Installer.csproj (pass)

---

## Session
- Date: 2026-05-29
- Session Number: 6
- Scope: ignore generated release payload folders

## Summary
- Added explicit ignore rules for release-generated payload folders to reduce working tree noise.
- Prevented accidental tracking of large generated payload content from publish/smoke-test flows.

## Files Modified
- .gitignore
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up maintenance for: #329
- PR tracking: #209

## Validation
- git status --short (artifacts and installer-ui/bundle-payload no longer listed)

---

## Session
- Date: 2026-05-29
- Session Number: 7
- Scope: installer fix for locked API executable during copy

## Summary
- Added resilient API deployment handling when `OrganizedJihad.Api.exe` is locked by another process.
- Installer now retries copy for lock contention and falls back to side-by-side API executable deployment if lock persists.
- Added broader process-stop targeting by exact executable path and alternate executable name matching.

## Files Modified
- Install-OrganizedJihad.ps1
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up maintenance for: #329
- PR tracking: #209

## Validation
- pwsh -ExecutionPolicy Bypass -File .\Install-OrganizedJihad.ps1 -AllowNonAdmin -SkipDesktopAppInstall -SkipUserscriptInstall -SkipTampermonkeyBootstrap -SkipRunInstallHealthCheck -SkipOpenUserscriptDiagnostics (pass with side-by-side fallback)
- pwsh -ExecutionPolicy Bypass -File .\Publish-ReleaseArtifacts.ps1 -Version 0.2.1 (pass)
- gh release upload v0.2.1 --clobber ... (pass)

## Follow-up
- Ask users to re-download the latest release assets after hotfix replacement.
---

## Session
- Date: 2026-05-29
- Session Number: 3
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- Install-OrganizedJihad.ps1
- Publish-InstallerUI.ps1
- Publish-ReleaseArtifacts.ps1
- README.md
- installer-ui/MainWindow.axaml
- installer-ui/MainWindow.axaml.cs
- installer-ui/OrganizedJihad.Installer.csproj
- userscript/package.json
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md
- ~docs/oj-manual-prompts-log.txt
- ~docs/plans/release-v0.2.1-github-body.md
- ~docs/plans/release-v0.2.1.md

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-29T12:14:43.420Z

---

## Session
- Date: 2026-05-29
- Session Number: 4
- Scope: #329 guided installer UX and single-EXE release publishing

## Summary
- Added component selection toggles (API/Desktop/userscript) in installer UI.
- Added installed-browser detection and browser picker for Tampermonkey setup guidance.
- Updated installer argument wiring to support component-conditional install flow.
- Refactored release artifact pipeline to stage bundled payload into installer single-file publish.
- Published updated v0.2.1 assets with one-file installer and refreshed release notes.

## Files Modified
- Install-OrganizedJihad.ps1
- Publish-InstallerUI.ps1
- Publish-ReleaseArtifacts.ps1
- README.md
- installer-ui/MainWindow.axaml
- installer-ui/MainWindow.axaml.cs
- installer-ui/OrganizedJihad.Installer.csproj
- userscript/package.json
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md
- ~docs/plans/release-v0.2.1-github-body.md
- ~docs/plans/release-v0.2.1.md

## Issues
- Created/implemented: #329
- Referenced epic: #206
- PR tracking: #209

## Validation
- dotnet build installer-ui/OrganizedJihad.Installer.csproj (pass)
- pwsh -ExecutionPolicy Bypass -File .\Publish-ReleaseArtifacts.ps1 -Version 0.2.1 (pass)
- dotnet build OrganizedJihad.sln (pass)
- gh release upload v0.2.1 --clobber artifacts/v0.2.1/OrganizedJihad.Installer.exe (pass)
- gh release upload v0.2.1 --clobber artifacts/v0.2.1/SHA256SUMS.txt (pass)
- gh release delete-asset v0.2.1 OrganizedJihad-v0.2.1-windows-installer.zip --yes (pass)
- gh release edit v0.2.1 --notes-file ~docs/plans/release-v0.2.1-github-body.md (pass)

---

## Session
- Date: 2026-05-29
- Session Number: 5
- Scope: #329 UX wording and guided option-state polish

## Summary
- Added a clear Quick Start panel in installer UI so first-time users see exact next steps before clicking install.
- Added dynamic option-state behavior so API URL, browser target, and diagnostics toggles reflect selected components.
- Added pre-install selected-component logging and clearer userscript post-install instructions.

## Files Modified
- installer-ui/MainWindow.axaml
- installer-ui/MainWindow.axaml.cs
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Implemented follow-up polish for: #329
- PR tracking: #209

## Validation
- dotnet build installer-ui/OrganizedJihad.Installer.csproj (pass)
---

## Session
- Date: 2026-05-29
- Session Number: 8
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- userscript/package.json

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-29T13:33:07.320Z

---

## Session
- Date: 2026-05-29
- Session Number: 9
- Scope: publish patched release asset for locked API executable fix

## Summary
- Rebuilt release artifacts for v0.2.1 after locked-API installer fix.
- Uploaded refreshed `OrganizedJihad.Installer.exe` and `SHA256SUMS.txt` to GitHub release v0.2.1 with `--clobber`.

## Files Modified
- userscript/package.json
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up maintenance for: #329
- PR tracking: #209

## Validation
- pwsh -ExecutionPolicy Bypass -File .\Publish-ReleaseArtifacts.ps1 -Version 0.2.1 (pass)
- gh release upload v0.2.1 --clobber artifacts/v0.2.1/OrganizedJihad.Installer.exe artifacts/v0.2.1/SHA256SUMS.txt (pass)
---

## Session
- Date: 2026-05-29
- Session Number: 10
- Scope: Automated userscript build session logging

## Summary
- Auto-generated entry from userscript build pipeline.
- Captures a timestamp and a git working-tree snapshot for traceability.

## Files Modified
- Install-OrganizedJihad.ps1
- OrganizedJihad.sln
- Publish-ReleaseArtifacts.ps1
- README.md
- api/OrganizedJihad.Api.csproj
- installer-ui/MainWindow.axaml
- installer-ui/MainWindow.axaml.cs
- installer-ui/OrganizedJihad.Installer.csproj
- userscript/package.json
- ~docs/oj-manual-prompts-log.txt
- api/OrganizedJihad.Api.TrayHost/
- ~docs/installer-guide/
- ~docs/plans/release-v0.2.2-github-body.md
- ~docs/plans/release-v0.2.2.md

## Validation
- yarn build

## Generated
- Timestamp UTC: 2026-05-29T14:09:46.007Z

---

## Session
- Date: 2026-05-29
- Session Number: 11
- Scope: #330 installer browser UX, setup guide, v0.2.2 docs, and API tray-host startup

## Summary
- Added Opera + Opera GX browser support improvements in installer UI and bootstrap script logic.
- Reduced tab noise by defaulting diagnostics toggles off and opening bootstrap for only the selected browser target.
- Added a local userscript setup guide HTML with per-browser screenshots and linked it into installer flow.
- Added API tray-host project and integrated startup-task configuration so interactive startup can show tray icon mode.
- Updated README and new v0.2.2 release docs to include EXE keep/unblock instructions and installer run guidance.

## Files Modified
- Install-OrganizedJihad.ps1
- OrganizedJihad.sln
- Publish-ReleaseArtifacts.ps1
- README.md
- api/OrganizedJihad.Api.csproj
- installer-ui/MainWindow.axaml
- installer-ui/MainWindow.axaml.cs
- installer-ui/OrganizedJihad.Installer.csproj
- userscript/package.json
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md
- api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj
- api/OrganizedJihad.Api.TrayHost/Program.cs
- ~docs/installer-guide/tampermonkey-setup.html
- ~docs/installer-guide/screenshots/chrome-setup.svg
- ~docs/installer-guide/screenshots/edge-setup.svg
- ~docs/installer-guide/screenshots/firefox-setup.svg
- ~docs/installer-guide/screenshots/opera-setup.svg
- ~docs/installer-guide/screenshots/opera-gx-setup.svg
- ~docs/plans/release-v0.2.2-github-body.md
- ~docs/plans/release-v0.2.2.md

## Issues
- Created/implemented: #330
- PR tracking: #209

## Validation
- dotnet build installer-ui/OrganizedJihad.Installer.csproj (pass)
- dotnet build api/OrganizedJihad.Api.csproj (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj (pass)
- pwsh -ExecutionPolicy Bypass -File .\Install-OrganizedJihad.ps1 -AllowNonAdmin -SkipDesktopAppInstall -SkipUserscriptInstall -SkipTampermonkeyBootstrap -SkipRunInstallHealthCheck -SkipOpenUserscriptDiagnostics (pass)
- pwsh -ExecutionPolicy Bypass -File .\Publish-ReleaseArtifacts.ps1 -Version 0.2.2 (pass)

---

## Session
- Date: 2026-05-29
- Session Number: 12
- Scope: replace setup-guide placeholder SVGs with captured PNG screenshots

## Summary
- Replaced all userscript setup-guide screenshot placeholders with real captured PNG screenshots from live Tampermonkey store pages.
- Updated the setup guide HTML image references from `.svg` to `.png`.
- Removed obsolete SVG placeholder assets from the screenshot folder.

## Files Modified
- ~docs/installer-guide/tampermonkey-setup.html
- ~docs/installer-guide/screenshots/chrome-setup.png
- ~docs/installer-guide/screenshots/edge-setup.png
- ~docs/installer-guide/screenshots/firefox-setup.png
- ~docs/installer-guide/screenshots/opera-setup.png
- ~docs/installer-guide/screenshots/opera-gx-setup.png
- ~docs/installer-guide/screenshots/chrome-setup.svg (removed)
- ~docs/installer-guide/screenshots/edge-setup.svg (removed)
- ~docs/installer-guide/screenshots/firefox-setup.svg (removed)
- ~docs/installer-guide/screenshots/opera-setup.svg (removed)
- ~docs/installer-guide/screenshots/opera-gx-setup.svg (removed)
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up on: #330
- PR tracking: #209

## Validation
- Verified PNG screenshot assets exist in `~docs/installer-guide/screenshots`.
- Verified setup guide image sources now reference `.png` paths.

---

## Session
- Date: 2026-05-29
- Session Number: 13
- Scope: step-button installer workflow + Tampermonkey gating + expanded guide screenshots

## Summary
- Reworked installer UI from checkbox component toggles to explicit step buttons: install/verify Tampermonkey, install API, install desktop app, install userscript, and userscript bypass.
- Added Tampermonkey detection per selected browser so normal userscript install is enabled only when detection succeeds.
- Kept bypass path available so userscript install can still run even when Tampermonkey auto-detection misses.
- Updated tray host to open API UI URL on double-click and added explicit `Open API UI` context-menu action for Plex-style tray behavior.
- Expanded guide to show all userscript setup steps in every browser section using step-labeled screenshots and added fallback image paths for bundled installer payloads.

## Files Modified
- installer-ui/MainWindow.axaml
- installer-ui/MainWindow.axaml.cs
- api/OrganizedJihad.Api.TrayHost/Program.cs
- ~docs/installer-guide/tampermonkey-setup.html
- ~docs/installer-guide/screenshots/tampermonkey-import-utilities.png
- ~docs/installer-guide/screenshots/tampermonkey-enabled-dashboard.png
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up on: #330
- PR tracking: #209

## Validation
- dotnet build installer-ui/OrganizedJihad.Installer.csproj (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj (pass)

---

## Session
- Date: 2026-05-29
- Session Number: 14
- Scope: doc sync for new step-button installer UX

## Summary
- Updated README install walkthrough to match the new button-based GUI flow (Step 1/2/3/4/4b + full install).
- Documented Tampermonkey detection gating and explicit bypass path in end-user instructions.
- Updated v0.2.2 release-body docs to reflect step-by-step button flow and API tray-host UI behavior.

## Files Modified
- README.md
- ~docs/plans/release-v0.2.2-github-body.md
- ~docs/plans/release-v0.2.2.md
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up on: #330
- PR tracking: #209

## Validation
- Documentation wording verified against current installer button labels and behavior.

---

## Session
- Date: 2026-05-29
- Session Number: 15
- Scope: Plex-style API startup model (no command prompt) with service+tray behavior

## Summary
- Reworked API startup registration in installer script to use split tasks:
	- `OrganizedJihad.Api.Service` runs API in background at system startup (service-style, no visible command prompt)
	- `OrganizedJihad.Api.Tray` runs tray host at user logon for notification-area controls
- Added hidden background process fallback path for non-admin scenarios to avoid visible console windows.
- Updated tray host to attach to existing API instance via health checks, self-heal by restarting API when down, and manage restart/stop for both tray-managed and externally started API processes.
- Kept tray UX aligned with Plex-style expectation: notification icon remains control point and opens API UI directly.

## Files Modified
- Install-OrganizedJihad.ps1
- api/OrganizedJihad.Api.TrayHost/Program.cs
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up on: #330
- PR tracking: #209

## Validation
- PowerShell parser check for `Install-OrganizedJihad.ps1` (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj (pass)
- dotnet build installer-ui/OrganizedJihad.Installer.csproj (pass)

---

## Session
- Date: 2026-05-29
- Session Number: 16
- Scope: add dedicated API web UI shell route and wire tray open action

## Summary
- Added a new API endpoint at `/ui` that serves a local control/status page for service-style runtime monitoring.
- The new page includes API health status, last sync timestamp display, and direct links to health/last-sync/stats JSON endpoints.
- Updated tray host `Open API UI` behavior to target `/ui` so notification-area actions open the control shell directly.
- Root API info payload now advertises the `/ui` route.

## Files Modified
- api/Program.cs
- api/OrganizedJihad.Api.TrayHost/Program.cs
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up on: #330
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj (pass)
- dotnet build api/OrganizedJihad.Api.TrayHost/OrganizedJihad.Api.TrayHost.csproj (pass)

---

## Session
- Date: 2026-05-29
- Session Number: 17
- Scope: tranche continuation - API UI settings persistence, repair diagnostics, test coverage, NU1903 mitigation

## Summary
- Extended the API `/ui` control shell with persisted settings endpoints (`GET/POST /ui/settings`) and client-side save/load UX.
- Added runtime setup diagnostics endpoint (`GET /ui/repair-status`) to help guide setup/update repair checks.
- Added focused API integration tests for `/ui` HTML route and `/ui/settings` payload.
- Mitigated installer dependency advisory NU1903 by explicitly upgrading `Tmds.DBus.Protocol` to `0.94.1` in installer project.

## Files Modified
- api/Program.cs
- tests/OrganizedJihad.Api.Tests/SyncControllerTests.cs
- installer-ui/OrganizedJihad.Installer.csproj
- ~docs/copilot-chats/2026-05-29-userscript-build-auto.md

## Issues
- Follow-up on: #330
- PR tracking: #209

## Validation
- dotnet build api/OrganizedJihad.Api.csproj (pass)
- dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj --filter "Api_Ui_Route_Should_Return_Html|Api_Ui_Settings_Should_Return_Payload|Health_Check_Should_Return_Ok" (pass)
- dotnet build installer-ui/OrganizedJihad.Installer.csproj (pass)
- dotnet list installer-ui/OrganizedJihad.Installer.csproj package --include-transitive (Tmds.DBus.Protocol resolved to 0.94.1; NU1903 warning cleared)
