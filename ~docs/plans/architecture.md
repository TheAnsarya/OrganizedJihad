# OrganizedJihad Architecture

## System Overview

OrganizedJihad is a three-tier game tracking solution for Hero Wars.

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Tier 1: Browser    │     │  Tier 3: API     │     │  Tier 2: Desktop│
│  TamperMonkey       │────>│  ASP.NET Core    │<────│  MAUI Blazor    │
│  Userscript         │     │  Web API         │     │  Hybrid App     │
│                     │     │                  │     │                 │
│  Intercepts game    │     │  Receives sync   │     │  Reads from     │
│  API traffic        │     │  payloads,       │     │  SQLite DB      │
│                     │     │  persists to     │     │  for analysis   │
│  IndexedDB v9       │     │  SQLite via EF   │     │  and display    │
│  local buffer       │     │  Core            │     │                 │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
                                     │
                            ┌────────┴────────┐
                            │  Data Layer     │
                            │  EF Core +      │
                            │  SQLite         │
                            │  35+ DbSets     │
                            └─────────────────┘
```

## Tier 1 — Browser Userscript

**Location**: `userscript/`
**Technology**: JavaScript (ES2024+), Webpack 5, Babel, TamperMonkey sandbox

### Key Modules

| Module | Purpose |
|--------|---------|
| `apiMonitor.js` | Intercepts XMLHttpRequest to capture game API traffic |
| `gameTracker.js` | Parses API responses and structures tracking data (~4700 lines) |
| `syncClient.js` | Sends captured data to the local API backend |
| `storageManager.js` | IndexedDB v9 persistence with 9+ object stores |
| `heroNames.js` | Hero/Titan/Pet ID-to-name resolution (71 heroes, 22 titans, 10 pets) |
| `uiManager.js` | Overlay UI management |
| `gameOverlay.js` | In-browser overlay rendering |

### Data Flow

1. Player loads Hero Wars in browser
2. `apiMonitor` intercepts all game API requests/responses
3. `gameTracker` parses the data and structures it into tracking objects
4. Data is buffered in IndexedDB via `storageManager`
5. `syncClient` periodically pushes accumulated data to the API backend

## Tier 2 — Desktop App

**Location**: `desktop-app/`
**Technology**: .NET 10 MAUI Blazor Hybrid, Bootstrap 5

### Pages

- **Dashboard** — Quick overview with latest snapshot stats
- **Hero Roster / Titan Roster** — Full roster display with progress bars
- **Hero Upgrades / Titan Upgrades** — Upgrade event history
- **Battles** — All battle types grouped (Arena, Grand Arena, Titan Arena, Guild War, Raid Boss, Expedition)
- **Resources** — Clickable resource balances with earn/spend transaction log
- **Chests** — Chest openings with individual drops, percentages, rarity distribution
- **Shop Purchases** — All shop/merchant purchases with currency analysis
- **Inventory** — Current inventory grouped by type + consumable usage log
- **Daily Activity** — Daily/guild quests, login rewards

### Design Patterns

- `IDbContextFactory<GameDatabaseContext>` for per-request DB contexts
- `AsNoTracking()` for all read-only queries
- Bootstrap 5 responsive grid layout
- Summary cards + detailed tables/logs on each page

## Tier 3 — API Backend

**Location**: `api/`
**Technology**: ASP.NET Core Web API (.NET 10)

### Endpoints

- `POST /api/sync` — Receives full sync payload from userscript
- `POST /api/sync/battles` — Battle-specific sync
- `POST /api/sync/chests` — Chest opening sync
- `POST /api/sync/resources` — Resource transaction sync
- Import methods include deduplication logic to prevent duplicate records

## Data Layer

**Location**: `data/`
**Technology**: Entity Framework Core 10, SQLite

### Entity Hierarchy

```
CreationAuditableEntity (immutable records)
  ├── ArenaBattle, GrandArenaBattle, TitanArenaBattle
  ├── GuildWarBattle, RaidBossAttack, ExpeditionBattle
  ├── ChestOpening, ChestDrop
  ├── ResourceTransaction, ShopPurchase
  ├── HeroSnapshot, TitanSnapshot, PetSnapshot, PlayerSnapshot
  ├── InventorySnapshot, InventoryItemUsage, EquipmentChange
  ├── DailyQuestCompletion, GuildQuestCompletion, LoginReward
  └── ... (35+ entity types)

AuditableEntity (mutable records)
  ├── Opponent, Goal, CalendarEvent
  └── SyncMetadata

SoftDeletableEntity (soft-delete)
  └── ChatMessage, GuildMember
```

### Key Features

- `AuditInterceptor` for automatic `CreatedAt` / `UpdatedAt` timestamps
- Composite indexes for frequently queried combinations
- JSON storage for complex nested data (e.g., `InventorySnapshot.InventoryData`)
- `HeroNames` static dictionary with `FrozenDictionary` for O(1) lookups

## Hero Name Resolution

Both C# and JS maintain synchronized dictionaries:

- **C#**: `data/HeroNames.cs` — `FrozenDictionary<long, string>` (71 heroes, 22 titans, 10 pets)
- **JS**: `userscript/src/modules/heroNames.js` — Plain object export

Methods: `Resolve(id)`, `ResolveWithFallback(id, fallback)`, `ResolveTitanElement(titanId)`

Titan elements are derived from the third digit of the titan ID:
- 0 = Water, 1 = Fire, 2 = Earth, 3 = Dark, 4 = Light
