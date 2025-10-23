# Tier 2 Desktop App - Architecture Specification

## Technology Choice: .NET MAUI

### Decision Rationale

**Chosen:** .NET MAUI (Multi-platform App UI)

**Pros:**
- ✅ Native C# integration (matches Tier 3 API)
- ✅ Cross-platform (Windows, macOS, Linux via MAUI Blazor Hybrid)
- ✅ Excellent SQLite support (Microsoft.Data.Sqlite)
- ✅ Built-in HTTP server capabilities (ASP.NET Core Kestrel)
- ✅ Modern UI framework (XAML or Blazor)
- ✅ Strong typing and performance
- ✅ Easy transition to Tier 3 (shared code)

**Cons:**
- ❌ Requires .NET 8/10 runtime
- ❌ Larger initial download (~150 MB)

**Alternatives Considered:**
- Electron: Heavier (~200 MB), JavaScript-based
- Flutter: Dart language, less ecosystem for desktop
- Avalonia: Good but smaller community

## Project Structure

```
desktop-app/
├── OrganizedJihad.Desktop.sln
├── README.md
│
├── src/
│   ├── OrganizedJihad.Desktop/           # Main MAUI app
│   │   ├── MauiProgram.cs
│   │   ├── App.xaml
│   │   ├── AppShell.xaml
│   │   ├── appsettings.json
│   │   ├── Pages/                        # Blazor pages
│   │   │   ├── Dashboard.razor
│   │   │   ├── Heroes.razor
│   │   │   ├── Arena.razor
│   │   │   ├── ChestStats.razor
│   │   │   ├── Trends.razor
│   │   │   └── Settings.razor
│   │   ├── Components/                   # Reusable UI components
│   │   │   ├── Charts/
│   │   │   ├── Tables/
│   │   │   └── Cards/
│   │   └── wwwroot/                      # Static files, CSS, JS
│   │
│   ├── OrganizedJihad.Database/          # Data layer
│   │   ├── OrganizedJihadContext.cs     # EF Core DbContext
│   │   ├── Models/                       # Entity models
│   │   │   ├── Player.cs
│   │   │   ├── Hero.cs
│   │   │   ├── Battle.cs
│   │   │   ├── ChestOpening.cs
│   │   │   └── ...
│   │   ├── Repositories/                 # Data access layer
│   │   │   ├── IRepository.cs
│   │   │   ├── PlayerRepository.cs
│   │   │   └── ...
│   │   ├── Migrations/                   # EF Core migrations
│   │   └── Schema.sql                    # SQL schema documentation
│   │
│   ├── OrganizedJihad.SyncService/       # Local HTTP API
│   │   ├── SyncServiceHost.cs           # Kestrel HTTP server
│   │   ├── Controllers/
│   │   │   ├── SyncController.cs        # Data upload/download
│   │   │   └── StatusController.cs      # Health checks
│   │   ├── Services/
│   │   │   ├── DataIngestionService.cs  # Process uploaded data
│   │   │   ├── DataExportService.cs     # Generate exports
│   │   │   └── ValidationService.cs     # Data validation
│   │   ├── Models/
│   │   │   ├── SyncRequest.cs
│   │   │   ├── SyncResponse.cs
│   │   │   └── HealthCheck.cs
│   │   └── Middleware/
│   │       ├── ApiKeyAuthMiddleware.cs
│   │       └── RateLimitMiddleware.cs
│   │
│   ├── OrganizedJihad.Analytics/         # Analytics engine
│   │   ├── Services/
│   │   │   ├── WinRateCalculator.cs
│   │   │   ├── DropRateAnalyzer.cs
│   │   │   ├── TeamCompositionAnalyzer.cs
│   │   │   ├── TrendAnalyzer.cs
│   │   │   └── OpponentIntelligence.cs
│   │   ├── Models/
│   │   │   ├── AnalyticsResult.cs
│   │   │   ├── WinRateStats.cs
│   │   │   ├── DropRateStats.cs
│   │   │   └── TrendData.cs
│   │   └── Caching/
│   │       └── AnalyticsCache.cs
│   │
│   └── OrganizedJihad.Common/            # Shared utilities
│       ├── Extensions/
│       ├── Helpers/
│       ├── Constants.cs
│       └── AppSettings.cs
│
├── tests/
│   ├── OrganizedJihad.Database.Tests/
│   ├── OrganizedJihad.SyncService.Tests/
│   └── OrganizedJihad.Analytics.Tests/
│
└── docs/
	├── API.md                            # Local API documentation
	├── DATABASE.md                       # Schema documentation
	└── DEVELOPMENT.md                    # Setup guide
```

## Database Schema (SQLite)

### Core Tables

```sql
-- Players
CREATE TABLE Players (
	UserId TEXT PRIMARY KEY,
	Name TEXT NOT NULL,
	Level INTEGER DEFAULT 0,
	VipLevel INTEGER DEFAULT 0,
	GuildId TEXT,
	GuildName TEXT,
	Gold BIGINT DEFAULT 0,
	Emeralds BIGINT DEFAULT 0,
	Energy INTEGER DEFAULT 0,
	LastUpdate TEXT NOT NULL,           -- ISO 8601 datetime
	CreatedAt TEXT NOT NULL,
	INDEX idx_players_name (Name)
);

-- Heroes
CREATE TABLE Heroes (
	Id TEXT PRIMARY KEY,                 -- GUID
	UserId TEXT NOT NULL,
	HeroId TEXT NOT NULL,
	Level INTEGER DEFAULT 0,
	Stars INTEGER DEFAULT 0,
	Color INTEGER DEFAULT 0,
	Power BIGINT DEFAULT 0,
	Experience BIGINT DEFAULT 0,
	Skills TEXT,                         -- JSON
	Artifacts TEXT,                      -- JSON
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_heroes_userid (UserId),
	INDEX idx_heroes_heroid (HeroId),
	INDEX idx_heroes_timestamp (Timestamp)
);

-- Titans
CREATE TABLE Titans (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	TitanId TEXT NOT NULL,
	Level INTEGER DEFAULT 0,
	Stars INTEGER DEFAULT 0,
	Power BIGINT DEFAULT 0,
	Skills TEXT,                         -- JSON
	Artifacts TEXT,                      -- JSON
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_titans_userid (UserId)
);

-- Pets
CREATE TABLE Pets (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	PetId TEXT NOT NULL,
	Level INTEGER DEFAULT 0,
	Stars INTEGER DEFAULT 0,
	Power BIGINT DEFAULT 0,
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_pets_userid (UserId)
);

-- Battles (all types)
CREATE TABLE Battles (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	BattleType TEXT NOT NULL,            -- arena, titanArena, grandArena, guildWar, etc.
	Result TEXT NOT NULL,                -- victory, defeat
	OpponentId TEXT,
	OpponentName TEXT,
	MyTeam TEXT,                         -- JSON compressed
	EnemyTeam TEXT,                      -- JSON compressed
	MyPower BIGINT,
	EnemyPower BIGINT,
	Reward TEXT,                         -- JSON
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_battles_userid_type (UserId, BattleType),
	INDEX idx_battles_timestamp (Timestamp),
	INDEX idx_battles_opponent (OpponentId)
);

-- Chest Openings
CREATE TABLE ChestOpenings (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	ChestType TEXT NOT NULL,
	ChestId TEXT NOT NULL,
	Quantity INTEGER DEFAULT 1,
	Rewards TEXT NOT NULL,               -- JSON array
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_chest_userid_type (UserId, ChestType, ChestId),
	INDEX idx_chest_timestamp (Timestamp)
);

-- Opponent Records
CREATE TABLE OpponentRecords (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	BattleType TEXT NOT NULL,
	OpponentId TEXT NOT NULL,
	OpponentName TEXT,
	Wins INTEGER DEFAULT 0,
	Losses INTEGER DEFAULT 0,
	LastBattle TEXT,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	UNIQUE (UserId, BattleType, OpponentId),
	INDEX idx_opponent_userid_type (UserId, BattleType)
);

-- Game Snapshots (historical data)
CREATE TABLE GameSnapshots (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	Level INTEGER,
	TotalPower BIGINT,
	Gold BIGINT,
	Emeralds BIGINT,
	HeroCount INTEGER,
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_snapshots_userid_timestamp (UserId, Timestamp)
);

-- Shop Purchases
CREATE TABLE ShopPurchases (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	ShopId TEXT,
	SlotId TEXT,
	ItemId TEXT,
	Cost TEXT,                           -- JSON
	Reward TEXT,                         -- JSON
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_purchases_userid (UserId),
	INDEX idx_purchases_timestamp (Timestamp)
);

-- Quest Completions
CREATE TABLE QuestCompletions (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	QuestId TEXT NOT NULL,
	Reward TEXT,                         -- JSON
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_quests_userid (UserId),
	INDEX idx_quests_timestamp (Timestamp)
);

-- Expedition Battles
CREATE TABLE ExpeditionBattles (
	Id TEXT PRIMARY KEY,
	UserId TEXT NOT NULL,
	NodeId TEXT,
	Result TEXT NOT NULL,
	MyTeam TEXT,
	EnemyTeam TEXT,
	Reward TEXT,
	Timestamp TEXT NOT NULL,
	FOREIGN KEY (UserId) REFERENCES Players(UserId) ON DELETE CASCADE,
	INDEX idx_expedition_userid (UserId),
	INDEX idx_expedition_timestamp (Timestamp)
);

-- Sync Metadata
CREATE TABLE SyncMetadata (
	Key TEXT PRIMARY KEY,
	Value TEXT NOT NULL,
	UpdatedAt TEXT NOT NULL
);
```

### Initial Metadata

```sql
INSERT INTO SyncMetadata (Key, Value, UpdatedAt) VALUES
('LastBrowserSync', '1970-01-01T00:00:00Z', datetime('now')),
('LastCloudSync', '1970-01-01T00:00:00Z', datetime('now')),
('ApiKey', '', datetime('now')),
('DatabaseVersion', '1.0.0', datetime('now'));
```

## Local Sync API Specification

### Base URL
`http://localhost:5000/api`

### Authentication
- API Key in header: `X-API-Key: {key}`
- Generated on first launch
- Stored in userscript localStorage

### Endpoints

#### POST /api/sync/upload
Upload data batch from userscript.

**Request:**
```json
{
  "userId": "user123",
  "timestamp": 1705852800000,
  "data": {
	"player": {...},
	"heroes": [...],
	"battles": [...],
	"chestOpenings": [...],
	"gameSnapshots": [...]
  }
}
```

**Response:**
```json
{
  "success": true,
  "recordsStored": 150,
  "lastSync": "2025-01-21T10:00:00Z"
}
```

#### GET /api/sync/download
Download user's data from database.

**Query Parameters:**
- `since`: ISO 8601 datetime (optional)
- `limit`: integer (default: 1000)

**Response:**
```json
{
  "player": {...},
  "heroes": [...],
  "battles": [...],
  "chestOpenings": [...],
  "snapshots": [...]
}
```

#### GET /api/sync/status
Check sync service health.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "lastSync": "2025-01-21T10:00:00Z",
  "databaseSize": "25.3 MB",
  "recordCount": 15420
}
```

#### GET /api/analytics/winrate
Get win rate statistics.

**Query Parameters:**
- `battleType`: arena | titanArena | grandArena | guildWar
- `days`: integer (default: 30)

**Response:**
```json
{
  "battleType": "arena",
  "period": 30,
  "total": 150,
  "wins": 120,
  "losses": 30,
  "winRate": 80.0
}
```

#### GET /api/analytics/droprates
Get chest drop rate statistics.

**Query Parameters:**
- `chestType`: string (optional)

**Response:**
```json
{
  "chests": [
	{
	  "chestType": "heroic",
	  "chestId": "001",
	  "openings": 250,
	  "items": [
		{
		  "itemId": "soulstone_001",
		  "dropCount": 45,
		  "dropRate": 18.0,
		  "avgAmount": 4.0
		}
	  ]
	}
  ]
}
```

## UI Design (Blazor Hybrid)

### Main Window
- **Top Bar**: App title, sync status indicator, settings button
- **Side Navigation**: Tab buttons (Dashboard, Heroes, Arena, etc.)
- **Content Area**: Active tab content
- **Bottom Bar**: Last sync time, database size, quick actions

### Pages

#### 1. Dashboard
- Quick stats cards (level, power, heroes, battles)
- Recent activity feed
- Upcoming events (if any)
- Sync status and manual sync button

#### 2. Heroes/Titans/Pets
- Roster grid/list view
- Sortable by power, level, stars
- Search and filter
- Details panel on selection

#### 3. Arena Analytics
- Win rate statistics per arena type
- Battle history table
- Opponent records table (W/L against each player)
- Team composition analysis

#### 4. Chest Statistics
- Drop rate tables per chest type
- Probability charts (pie/bar)
- Total openings counter
- Item rarity distribution

#### 5. Historical Trends
- Power progression line chart
- Resource trends (gold, emeralds)
- Level progression
- Battle activity heatmap

#### 6. Settings
- Sync configuration
- Database management (backup, restore, clear)
- Export/import data
- API key management
- Theme selection

## Data Flow

### Browser → Desktop

```
1. User plays Hero Wars
2. Userscript captures API calls
3. Data stored in browser storage (Tier 1)
4. Every 5 minutes:
   a. Check if desktop app running (HEAD /api/sync/status)
   b. If online: POST /api/sync/upload with all new data
   c. Desktop app validates and stores in SQLite
   d. Userscript trims old data from browser cache
5. Desktop app UI updates automatically
```

### Desktop → Browser (Initial Setup)

```
1. User installs desktop app
2. Desktop app generates API key
3. User enters API key in userscript settings
4. Userscript calls GET /api/sync/download
5. Desktop app returns existing data
6. Userscript merges with browser storage
```

## Key Features

### 1. Offline Mode
- Desktop app works independently
- Manual data import from JSON export
- Analytics run on local database

### 2. Auto-Backup
- Daily SQLite database backup
- Configurable backup location
- Backup rotation (keep last 30)

### 3. Performance
- Connection pooling for SQLite
- Indexed queries for fast analytics
- In-memory caching for frequently accessed data
- Lazy loading for large datasets

### 4. Security
- API key authentication
- CORS restricted to localhost
- No external network access (Tier 2 only)
- Data stays on user's machine

## Development Workflow

### Setup
```bash
cd desktop-app
dotnet restore
dotnet ef database update
dotnet run --project src/OrganizedJihad.Desktop
```

### Build
```bash
dotnet publish -c Release -r win-x64 --self-contained
dotnet publish -c Release -r osx-x64 --self-contained
dotnet publish -c Release -r linux-x64 --self-contained
```

### Testing
```bash
dotnet test
```

## Dependencies

### NuGet Packages
- `Microsoft.Maui` - UI framework
- `Microsoft.EntityFrameworkCore.Sqlite` - Database ORM
- `Microsoft.AspNetCore.Mvc` - HTTP API
- `System.Text.Json` - JSON serialization
- `Serilog` - Logging
- `Blazorise.Bootstrap` - UI components (optional)
- `ChartJs.Blazor` - Charts

### Estimated App Size
- **Windows**: ~80 MB (self-contained)
- **macOS**: ~85 MB
- **Linux**: ~85 MB

## Next Steps (Implementation Order)

1. ✅ Create project structure
2. Create database models and EF Core context
3. Implement database layer with migrations
4. Build local sync API (HTTP server)
5. Create Blazor UI pages
6. Implement analytics engine
7. Add data migration tool
8. Implement backup/restore
9. Build installer packages
10. Update userscript with sync client

## Timeline Estimate

- **Project Setup**: 4 hours
- **Database Layer**: 8 hours
- **Sync API**: 12 hours
- **UI Development**: 24 hours
- **Analytics Engine**: 16 hours
- **Migration & Backup**: 8 hours
- **Testing**: 16 hours
- **Documentation**: 8 hours

**Total**: ~96 hours (2-3 weeks full-time, 4-6 weeks part-time)
