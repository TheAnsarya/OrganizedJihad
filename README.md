# OrganizedJihad (OJ) - Hero Wars Comprehensive Tracker

A multi-tier game tracking solution for [Hero Wars](https://hero-wars.com) that captures, stores, and analyzes **all** gameplay data — account state, battles, hero/titan upgrades, inventory usage, daily/guild quests, chest rewards, shop purchases, resource transactions, and more.

## Architecture

OJ is a three-tier system:

| Tier | Technology | Purpose |
|------|-----------|---------|
| **1 - Browser Userscript** | TamperMonkey + Webpack 5 | Intercepts game API traffic in real time |
| **2 - Desktop App** | .NET MAUI Blazor Hybrid | View, analyze, and explore tracked data |
| **3 - API Backend** | ASP.NET Core Web API | Receives sync payloads, persists to SQLite via EF Core |

See [Architecture Details](~docs/plans/architecture.md) for the full design.

## What We Track

- **Account State** — Player snapshots (level, power, resources, ranks), full inventory snapshots
- **Battles** — Arena, Grand Arena, Titan Arena, Guild War, Raid Boss, Expedition (teams, outcomes, rank changes, damage)
- **Heroes** — Snapshots, level-ups, star promotions, color evolutions, skill upgrades, artifact upgrades
- **Titans** — Snapshots, level-ups, star promotions, element tracking (auto-resolved from ID)
- **Pets** — Snapshots, star/power/level tracking, patronage data
- **Chests** — Every chest opened with individual drop tracking (item name, rarity, quantity, percentages)
- **Resources** — Every gain/spend of emeralds, gold, arena coins, guild coins, tower coins, titan coins with source tracking
- **Shop Purchases** — Arena shop, guild shop, tower shop, merchant, outland, titan shop
- **Inventory** — Item usage (consumables, potions, scrolls), equipment changes (equip/upgrade/evolve)
- **Daily Activities** — Daily quests, guild quests, login rewards, mission progress, tower progress
- **Guild** — Member roster tracking, war/raid/dungeon participation, titanite transactions, chat archiving

See [Tracking Reference](~docs/plans/tracking-reference.md) for the complete data model.

## Quick Start

### Stable Release Download (v0.2.2)

- GitHub Release: https://github.com/TheAnsarya/OrganizedJihad/releases/tag/v0.2.2
- Recommended asset: `OrganizedJihad.Installer.exe`
- Verify integrity using bundled `SHA256SUMS.txt`
- The EXE is self-contained (API + desktop + userscript payloads included); source repository files are not required.

Windows download safety prompt guidance:

1. If your browser flags the EXE as uncommon, click `Keep` -> `Keep anyway`.
2. Right-click `OrganizedJihad.Installer.exe` -> `Properties`.
3. In the General tab, check `Unblock` if present.
4. Click `Apply`, then `OK`, then run the installer.

To build release artifacts locally:

```powershell
pwsh -ExecutionPolicy Bypass -File .\Publish-ReleaseArtifacts.ps1 -Version 0.2.2
```

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 20+](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/) package manager
- [TamperMonkey](https://www.tampermonkey.net/) browser extension

### One-Click GUI Installer (Recommended For Live Testing)

For release/live testing, use the Avalonia GUI installer executable and avoid command-line setup:

1. Open the release bundle and run `OrganizedJihad.Installer.exe`.
2. Pick your userscript browser target (Opera GX supported).
3. Click `Step 1: Install / Verify Tampermonkey`.
4. Click `Step 2: Install API Server` (starts with tray-host in hidden icons, Plex-style, and opens API UI from the tray icon).
5. Click `Step 3: Install Desktop App`.
6. Click `Step 4: Install Userscript`.
7. If Step 4 is locked because Tampermonkey is not detected, use `Step 4b: Install Userscript (Bypass)`.
8. Wait for `Status: Install complete` in the installer window.

For manual userscript setup, open this guide after install:

- `%LOCALAPPDATA%\OrganizedJihad\userscript\tampermonkey-setup.html`

The installer UI provides explicit buttons for each install step:

- Step 1: Install / Verify Tampermonkey
- Step 2: Install API Server
- Step 3: Install Desktop App
- Step 4: Install Userscript (enabled only when Tampermonkey is detected)
- Step 4b: Install Userscript (Bypass)
- Run Full Install (runs API + desktop + userscript in sequence)

When API install is enabled, the installer deploys an API tray host so startup runs with a Windows notification area icon (background apps menu). Double-clicking the tray icon opens the API UI URL.

GUI-first behavior guarantee:

- If you launch the EXE installer, installation stays in the installer UI flow.
- The installer requests Windows UAC elevation inside that UI flow.
- No command prompt usage is required unless you intentionally run the CLI installer from a terminal.

The GUI installer orchestrates:

- API install/startup setup
- Desktop app install
- userscript build/install artifact copy
- browser bootstrap links for Tampermonkey + userscript import
- first-run diagnostics and health checks

At the beginning of install, OJ requests administrator privileges so the full setup can complete (system startup task registration and full install permissions).

Installer UX hardening notes:

- Preflight checks validate install path and API URL before execution.
- Install logs are persisted under `%LOCALAPPDATA%\\OrganizedJihad\\installer-logs`.
- Quick actions in the installer allow opening install and log folders after runs.

If you are building the GUI installer from source:

```powershell
pwsh -ExecutionPolicy Bypass -File .\Publish-InstallerUI.ps1
```

This produces `installer-ui/publish/win-x64/OrganizedJihad.Installer.exe`.

### One-Command Windows Install / Upgrade (CLI)

Run this from the repository root:

```powershell
pwsh -ExecutionPolicy Bypass -File .\Install-OrganizedJihad.ps1
```

Or double-click:

```text
Install-OrganizedJihad.cmd
```

What it does:

- Builds the latest TamperMonkey userscript bundle
- Publishes the API backend as a self-contained Windows executable
- Publishes and installs the Desktop app for Windows (`OrganizedJihad.Desktop.exe`)
- Installs/updates artifacts in `%LOCALAPPDATA%\OrganizedJihad`
- Registers `OrganizedJihad.Api.Autostart` scheduled task (runs on logon)
- Registers `OrganizedJihad.Api.Autostart` for system startup + logon when installer is run as Administrator
- Falls back to logon startup when not elevated
- Opens Tampermonkey install pages and userscript import flow (including Opera GX support)

Optional flags:

- `-SkipTampermonkeyBootstrap` to skip opening extension/script pages
- `-TampermonkeyBrowsers chrome,operaGX` to target specific browser bootstrap pages
- `-SkipDesktopAppInstall` to skip desktop publish/install when only backend/userscript is needed
- `-SkipYarnInstall` to skip `yarn install` during repeat installs
- `-AllowNonAdmin` to bypass the elevation prompt (reduced install capabilities; no full system-level startup registration)
- `-InstallRoot "D:\Apps\OrganizedJihad"` to customize install location
- `-RunTaskModuleSelfTest` to run installer startup-task planning self-tests and exit without performing install steps

New reliability behaviors:

- Installer now captures a pre-install rollback snapshot per component and restores it automatically if install fails mid-run.
- Installer health diagnostics now include `/ui/userscript-handshake` checks to confirm userscript-to-API handshake freshness.

### Build & Run

```powershell
# Clone
git clone https://github.com/yourusername/OrganizedJihad.git
cd OrganizedJihad

# Build everything
dotnet build

# Start the API backend (http://localhost:5000)
dotnet run --project api

# Build the userscript
cd userscript
yarn install
yarn build
# Install dist/organized-jihad.user.js in TamperMonkey

# Run the desktop app
dotnet run --project desktop-app
```

### Release Validation Automation

```powershell
# Validate migration path across cold start + repeat start using same DB
pwsh -ExecutionPolicy Bypass -File .\Test-ApiMigrationPath.ps1

# Smoke-test published API binary and key endpoints
pwsh -ExecutionPolicy Bypass -File .\Test-ReleaseSmoke.ps1
```

`Publish-ReleaseArtifacts.ps1` now runs migration + smoke checks by default.
Use `-SkipMigrationCheck` and/or `-SkipSmokeTest` only when intentionally bypassing validation.

### Running Tests

```powershell
# .NET tests (75 tests: 39 Data + 36 API)
dotnet test

# JavaScript tests (296 tests across 7 suites)
cd userscript
yarn test
```

## Project Structure

```text
OrganizedJihad/
├── api/                    # ASP.NET Core Web API (Tier 3)
│   ├── Controllers/        #   SyncController (import/query endpoints)
│   ├── Models/             #   BrowserSyncData DTOs
│   └── Services/           #   SyncService (business logic)
│
├── data/                   # EF Core Data Layer (shared)
│   ├── Entities/           #   Base entity classes (Auditable, SoftDeletable)
│   ├── Models/             #   35+ game entity models
│   ├── Migrations/         #   Database migrations
│   └── GameDatabaseContext.cs
│
├── desktop-app/            # .NET MAUI Blazor Hybrid (Tier 2)
│   ├── Components/Pages/   #   Dashboard, Battles, Chests, Resources,
│   │                       #   ShopPurchases, Inventory, Hero/Titan Rosters,
│   │                       #   Hero/Titan Upgrades, Daily Activity
│   └── Services/           #   DataService, SyncService
│
├── userscript/             # TamperMonkey Userscript (Tier 1)
│   └── src/modules/        #   apiMonitor, gameTracker, syncClient,
│                           #   storageManager, heroNames, etc.
│
├── tests/                  # xUnit test projects
│   ├── OrganizedJihad.Data.Tests/
│   └── OrganizedJihad.Api.Tests/
│
└── ~docs/                  # Documentation and plans
    ├── plans/              #   Architecture, tracking reference, roadmap
    └── copilot-chats/      #   AI session logs
```

## Desktop App Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Overview with latest snapshot, quick stats, recent activity |
| Hero Roster | `/heroes` | All heroes with level, stars, color, power, progress bars |
| Hero Upgrades | `/hero-upgrades` | Every hero upgrade event (level, star, color, skill, artifact) |
| Titan Roster | `/titans` | All titans with level, stars, element, power, progress bars |
| Titan Upgrades | `/titan-upgrades` | Every titan upgrade event |
| Battles | `/battles` | All battle types grouped: Arena, Grand Arena, Titan Arena, Guild War, Raid Boss, Expedition |
| Resources | `/resources` | Clickable resource balances with earn/spend transaction log |
| Chests | `/chests` | Chest openings with individual drops, percentages, rarity breakdown |
| Shop Purchases | `/shop-purchases` | All shop/merchant purchases with currency analysis |
| Inventory | `/inventory-usage` | Current inventory grouped by type + consumable usage log |
| Daily Activity | `/daily-activity` | Daily quests, guild quests, login rewards |

## Development Guidelines

- **Formatting**: Tabs (width 4), CRLF, UTF-8, K&R braces (see `.editorconfig`)
- **C#**: File-scoped namespaces, XML doc comments, modern C# 13+ features
- **JavaScript**: ES2024+, JSDoc comments, single quotes, semicolons always
- **Entities**: Inherit from `CreationAuditableEntity` (immutable) or `AuditableEntity` (mutable)
- **Package manager**: Use `yarn` for the userscript project
- **Issue-first workflow**: Every task starts with a GitHub Issue
- **Branch naming**: `feature/<issue-number>-description` or `fix/<issue-number>-description`

See [Code Style Guide](~docs/Code-Style-Guide.md) for complete formatting rules.

## Privacy & Data

- All data is stored **locally** — browser data in IndexedDB, backend data in SQLite
- The userscript syncs to `localhost` only — no external servers
- Export your data regularly via the Settings panel

## License

MIT License — see [LICENSE](userscript/LICENSE) for details.

## Disclaimer

This is a fan-made tool and is not affiliated with or endorsed by Hero Wars or its developers.
