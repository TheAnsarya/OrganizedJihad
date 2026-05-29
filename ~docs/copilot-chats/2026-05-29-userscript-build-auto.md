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
