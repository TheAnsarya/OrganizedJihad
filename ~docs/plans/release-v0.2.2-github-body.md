# 🎉 OrganizedJihad v0.2.2

🔗 Release URL: https://github.com/TheAnsarya/OrganizedJihad/releases/tag/v0.2.2

## 🚀 Highlights

- ✅ One-click installer UX is now GUI-first and beginner-friendly
- 🔐 Installer requests admin privileges early for full install capability
- 🧪 Single-run install reliability improved across API + Desktop + userscript
- 🧾 Installer logs are persisted for troubleshooting
- 🧭 Release docs now include a complete v0.2.2 validation and sign-off package

## 🧩 What Changed

| Area | Improvement |
|---|---|
| Installer privilege flow | Early elevation prompt with explicit messaging |
| GUI install UX | Keeps users in UI flow instead of terminal-style interaction |
| Input safety | Preflight validation for install path + API URL |
| Diagnostics | Per-run installer logs under `%LOCALAPPDATA%\\OrganizedJihad\\installer-logs` |
| Browser bootstrap | Guided Tampermonkey bootstrap with Opera + Opera GX support |
| First-run readiness | Health-check + diagnostics options integrated |
| Step gating | Userscript step is enabled only when Tampermonkey is detected (bypass step available) |
| API tray UX | Hidden-icons tray host with direct API UI open action |

## 🛠️ Installation

### Recommended (No CLI)

`OrganizedJihad.Installer.exe` is standalone: API/Desktop/userscript payloads are bundled, so no source repo checkout or unzip step is needed.

1. Run `OrganizedJihad.Installer.exe`.
2. Approve UAC when asked.
3. Choose browser target.
4. Click `Step 1: Install / Verify Tampermonkey`.
5. Click `Step 2: Install API Server`.
6. Click `Step 3: Install Desktop App`.
7. Click `Step 4: Install Userscript`.
8. If Step 4 is unavailable because Tampermonkey is not detected, run `Step 4b: Install Userscript (Bypass)`.
9. Wait for `Status: Install complete`.

Windows download trust flow:

1. If the browser flags the EXE as uncommon, click `Keep` -> `Keep anyway`.
2. Right-click `OrganizedJihad.Installer.exe` -> `Properties`.
3. Check `Unblock` (if shown), then click `Apply` and `OK`.

Manual userscript fallback guide:

- `%LOCALAPPDATA%\OrganizedJihad\userscript\tampermonkey-setup.html`

### CLI (Optional Advanced Path)

```powershell
pwsh -ExecutionPolicy Bypass -File .\Install-OrganizedJihad.ps1
```

If you intentionally need constrained non-admin mode:

```powershell
pwsh -ExecutionPolicy Bypass -File .\Install-OrganizedJihad.ps1 -AllowNonAdmin
```

## ✅ Validation Summary

| Check | Result |
|---|---|
| `dotnet build installer-ui/OrganizedJihad.Installer.csproj` | ✅ Pass |
| `pwsh -ExecutionPolicy Bypass -File .\\Publish-InstallerUI.ps1` | ✅ Pass |
| `dotnet build OrganizedJihad.sln` | ✅ Pass |
| Installer output artifact present | ✅ `installer-ui/publish/win-x64/OrganizedJihad.Installer.exe` |

## ⚠️ Known Issues

| Issue | Status |
|---|---|
| NU1903 advisory on transitive `Tmds.DBus.Protocol` | Open |

## 🙌 Thanks

Thank you for testing and helping harden the release UX. This version is focused on making setup as simple and reliable as possible for real-world first-time installs.
