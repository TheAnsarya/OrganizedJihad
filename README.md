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

- GitHub Release: <https://github.com/TheAnsarya/OrganizedJihad/releases/tag/v0.2.2>
- Recommended asset: `OrganizedJihad.Installer.exe`
- Verify integrity using bundled `SHA256SUMS.txt`
- The EXE is self-contained (API + desktop + userscript payloads included); source repository files are not required.

Windows download safety prompt guidance:

1. If your browser flags the EXE as uncommon, click `Keep` -> `Keep anyway`.
2. Right-click `OrganizedJihad.Installer.exe` -> `Properties`.
3. In the General tab, check `Unblock` if present.
4. Click `Apply`, then `OK`, then run the installer.

To build release artifacts locally:

```bash
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64
```

For cross-platform 0.2.3 matrix artifacts (Windows/macOS/Linux):

```bash
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3
```

Useful release CLI options:

- `--runtimes win-x64,linux-x64,osx-x64,osx-arm64` to choose target runtime matrix
- `--smoke-runtime auto|none|<runtime>` to control which published runtime gets smoke validation
- `--dry-run` to print the execution plan without running build/publish/check commands
- `--dry-run-format text|json` to choose human-readable or machine-readable plan output
- `--startup-timeout-seconds <10..600>` to tune migration/smoke API readiness wait bounds
- `--runtimes` now validates token safety (max 16 entries; no path separators)
- `--output-root` is safety-checked to ensure artifact cleanup stays inside repository boundaries
- `--skip-userscript-build` to reuse existing userscript bundle for faster reruns
- `--release-notes-path ~docs/plans/release-v0.2.3-github-body.md` to control copied release notes draft

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

Cross-platform note (v0.2.3):

- Installer UI is Avalonia and now supports Windows/macOS/Linux runtime execution.
- Windows keeps UAC/elevation flow for startup task integration.
- macOS/Linux run managed installer workflow without Windows task scheduler dependencies.

Installer UX hardening notes:

- Preflight checks validate install path and API URL before execution.
- Install logs are persisted under `%LOCALAPPDATA%\\OrganizedJihad\\installer-logs`.
- Quick actions in the installer allow opening install and log folders after runs.

If you are building the GUI installer from source:

```bash
dotnet publish installer-ui/OrganizedJihad.Installer.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -o installer-ui/publish/win-x64
```

This produces `installer-ui/publish/win-x64/OrganizedJihad.Installer.exe` on Windows and runtime-specific binaries for macOS/Linux when `-r` is changed.

### One-Command Install / Upgrade (CLI)

Run this from the repository root:

```bash
dotnet run --project installer-core/OrganizedJihad.Installer.Cli -- --run-install-health-check
```

What it does:

- Installs bundled API/runtime-host payloads to the configured install root
- Installs userscript + setup guide assets
- Starts runtime host or API directly depending on available binaries
- Runs optional health checks and diagnostics links
- Opens Tampermonkey install pages for selected browser bootstrap

Optional flags:

- `--skip-tampermonkey-bootstrap` to skip opening extension/script pages
- `--tampermonkey-browsers chrome,operaGX` to target specific browser bootstrap pages
- `--skip-desktop-app-install` to skip desktop payload install
- `--skip-userscript-install` to skip userscript payload install
- `--install-root "D:\Apps\OrganizedJihad"` to customize install location
- `--api-url "http://localhost:5124"` to customize runtime API URL

New reliability behaviors:

- Installer health diagnostics include `/ui/userscript-handshake` checks to confirm userscript-to-API handshake freshness.

Legacy note:

- `Install-OrganizedJihad.ps1` and `Install-OrganizedJihad.cmd` remain in the repository for compatibility, but v0.2.3 primary install flow is managed `.NET` CLI/UI.
- `Publish-ReleaseArtifacts.ps1` and `Publish-ReleaseArtifacts-0.2.3.ps1` are compatibility wrappers that now delegate to `OrganizedJihad.Release.Cli`.

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

```bash
# Validate migration path + host-compatible smoke checks as part of managed matrix run
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64,osx-x64,osx-arm64

# Force smoke checks on linux-x64 publish (when running on compatible host)
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes linux-x64,osx-arm64 --smoke-runtime linux-x64

# Show release plan only (no build/publish/check execution)
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64 --dry-run

# Emit plan as JSON for CI preflight checks
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64,linux-x64 --dry-run --dry-run-format json

# Print built-in command help
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --help

# Optional fast rerun while skipping managed validation checks
dotnet run --project installer-core/OrganizedJihad.Release.Cli -- --version 0.2.3 --runtimes win-x64 --skip-migration-check --skip-smoke-test --skip-userscript-build
```

`OrganizedJihad.Release.Cli` now runs migration + smoke checks by default.
Use `--skip-migration-check` and/or `--skip-smoke-test` only when intentionally bypassing validation.

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
