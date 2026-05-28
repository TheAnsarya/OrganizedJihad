# 🚀 OrganizedJihad v0.2.1 — Release Candidate Notes

**Release Header**

| Field | Value |
|---|---|
| Product | OrganizedJihad (OJ) |
| Version | `0.2.1` |
| Release Type | Feature + Installer Reliability + Release UX Hardening |
| Date (UTC) | 2026-05-28 |
| Branch | `feature/204-architecture-modernization` |
| PR | #209 |
| Primary Issues | #321, #322, #323, #324 |
| Target Platform | Windows (single-run installer + GUI installer) |

---

## ✨ Executive Summary

`v0.2.1` focuses on making installation and first-run setup far more reliable and beginner-friendly.

This release hardens the one-click install flow across three major waves:

1. **#321**: single-run ecosystem bootstrap hardening (API + Desktop + userscript)
2. **#322**: no-CLI Avalonia installer executable with browser picker
3. **#323/#324**: admin-elevation-first UX, preflight checks, persisted logs, release packaging docs

Result: users can install the full stack with fewer failure points, better diagnostics, and clearer guided steps.

---

## 🧰 What’s New

### 1) Installer Elevation-First Flow (NEW in v0.2.1)

| Capability | Behavior |
|---|---|
| Early admin request | Installer now asks for admin privileges at startup for full install capability |
| Clear message | Explicit user-facing prompt: "Please give us admin privileges so we can install fully." |
| Script self-elevation | `Install-OrganizedJihad.ps1` relaunches elevated when needed |
| Launcher elevation | `Install-OrganizedJihad.cmd` requests UAC elevation up front |
| Controlled non-admin path | Optional `-AllowNonAdmin` for constrained runs |

### 2) One-Click GUI Installer Improvements

| Capability | Behavior |
|---|---|
| Browser target selection | Opera GX, Chrome, Edge, Firefox |
| Preflight validation | Validates install root and API URL before execution |
| Actionable UX | Status + live log stream in installer window |
| Quick actions | Open install folder + open log folder directly from GUI |
| Persisted run logs | Timestamped logs at `%LOCALAPPDATA%\\OrganizedJihad\\installer-logs` |

### 3) Single-Run Install Robustness (API/Desktop/Userscript)

| Area | Hardening |
|---|---|
| API process refresh | Stops prior installed API process before artifact copy |
| API readiness | Waits for `/api/sync/health` before health checks |
| Desktop install | Reliable publish output discovery and install copy |
| Browser bootstrap | Tampermonkey links include Opera GX-compatible flow |
| Diagnostics | First-run health/diagnostic options integrated into installer |

---

## 📦 Release Contents

| Component | Status in v0.2.1 | Notes |
|---|---|---|
| API Backend | ✅ Included | ASP.NET Core API publish/install path hardened |
| Desktop App | ✅ Included | Windows desktop publish/install integrated |
| Userscript | ✅ Included | Build + install flow integrated in installer |
| GUI Installer | ✅ Included | Avalonia executable (`OrganizedJihad.Installer.exe`) |
| CLI Installer | ✅ Included | PowerShell + cmd launcher with elevation support |

---

## 🧪 Validation Matrix

| Validation | Result |
|---|---|
| `dotnet build installer-ui/OrganizedJihad.Installer.csproj` | ✅ Pass |
| `pwsh -ExecutionPolicy Bypass -File .\\Publish-InstallerUI.ps1` | ✅ Pass |
| `dotnet build OrganizedJihad.sln` | ✅ Pass |
| Installer artifact exists at `installer-ui/publish/win-x64/OrganizedJihad.Installer.exe` | ✅ Yes |

---

## 🛠️ Installation / Upgrade Guide (v0.2.1)

### Recommended (No CLI)

1. Run `OrganizedJihad.Installer.exe`.
2. Approve UAC when prompted.
3. Select browser target for userscript bootstrap.
4. Click `Install Ecosystem`.
5. Wait for completion and review logs if needed.

### CLI Fallback

```powershell
pwsh -ExecutionPolicy Bypass -File .\Install-OrganizedJihad.ps1
```

Default behavior requests admin privileges early.
For constrained environments only:

```powershell
pwsh -ExecutionPolicy Bypass -File .\Install-OrganizedJihad.ps1 -AllowNonAdmin
```

---

## 🔄 Breaking Changes / Compatibility

| Topic | Impact |
|---|---|
| Installer privilege model | Installer now defaults to admin-elevation-first behavior |
| Non-admin installs | Still possible with `-AllowNonAdmin`, but reduced setup capabilities |
| Runtime baseline | Windows-focused installer flow; uses current .NET 10 preview toolchain |

---

## ⚠️ Known Issues

| Issue | Status | Mitigation |
|---|---|---|
| NU1903 advisory on transitive `Tmds.DBus.Protocol` | Open | Track dependency graph updates in follow-up slice |
| Users may cancel UAC prompt | Expected | Re-run installer and accept elevation for full install |

---

## 🧭 File-Level Change Highlights

| Area | Representative Files |
|---|---|
| Installer elevation + orchestration | `Install-OrganizedJihad.ps1`, `Install-OrganizedJihad.cmd` |
| GUI UX + logging | `installer-ui/MainWindow.axaml`, `installer-ui/MainWindow.axaml.cs` |
| GUI publish | `Publish-InstallerUI.ps1` |
| User docs | `README.md`, `userscript/INSTALL.md`, `userscript/README.md` |
| Project tracking | `~docs/plans/architecture-modernization-roadmap.md`, `~docs/copilot-chats/2026-05-28-userscript-build-auto.md` |

---

## ✅ Release Sign-Off Checklist

| Check | Owner | Status |
|---|---|---|
| Installer elevation prompt appears early | Engineering | ✅ |
| GUI installer build + publish green | Engineering | ✅ |
| Solution build green | Engineering | ✅ |
| Docs updated for admin/default + non-admin override | Engineering | ✅ |
| Release notes package prepared for v0.2.1 | Engineering | ✅ |

---

## 🎉 Suggested GitHub Release Title

**`v0.2.1` — One-Click Installer Hardening, Admin Elevation Flow, and Release UX Upgrade**

## 📝 Suggested GitHub Release Short Description

**OJ v0.2.1 delivers a stronger single-run install experience with admin-elevation-first setup, a polished Avalonia GUI installer, persisted installer logs, and improved first-run diagnostics/bootstrap guidance for API + Desktop + userscript.**
