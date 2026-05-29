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
- pwsh -ExecutionPolicy Bypass -File .\Publish-ReleaseArtifacts.ps1 -Version 0.2.1 (pass)
- gh release upload v0.2.1 --clobber ... (pass)

## Follow-up
- Ask users to re-download `OrganizedJihad-v0.2.1-windows-installer.zip` after hotfix asset replacement.
