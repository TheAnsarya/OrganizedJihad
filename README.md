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

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Node.js 20+](https://nodejs.org/)
- [Yarn](https://yarnpkg.com/) package manager
- [TamperMonkey](https://www.tampermonkey.net/) browser extension

### One-Command Windows Install / Upgrade

Run this from the repository root:

```powershell
pwsh -ExecutionPolicy Bypass -File .\Install-OrganizedJihad.ps1
```

Or double-click:

```
Install-OrganizedJihad.cmd
```

What it does:

- Builds the latest TamperMonkey userscript bundle
- Publishes the API backend as a self-contained Windows executable
- Installs/updates artifacts in `%LOCALAPPDATA%\OrganizedJihad`
- Registers `OrganizedJihad.Api.Autostart` scheduled task (runs on logon)
- Registers `OrganizedJihad.Api.Autostart` for system startup + logon when installer is run as Administrator
- Falls back to logon startup when not elevated
- Opens Tampermonkey extension install pages and opens the latest userscript file for import/update

Optional flags:

- `-SkipTampermonkeyBootstrap` to skip opening extension/script pages
- `-SkipYarnInstall` to skip `yarn install` during repeat installs
- `-InstallRoot "D:\Apps\OrganizedJihad"` to customize install location

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

### Running Tests

```powershell
# .NET tests (75 tests: 39 Data + 36 API)
dotnet test

# JavaScript tests (296 tests across 7 suites)
cd userscript
yarn test
```

## Project Structure

```
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
