# Storage Architecture Plan - OrganizedJihad

## Current Storage Implementation

### Current State
**Location:** Browser-based storage via TamperMonkey
- **Primary:** `GM_setValue/GM_getValue` (TamperMonkey API)
- **Fallback:** `localStorage` (browser API)
- **Capacity:** ~10 MB per domain (GM) or 5-10 MB (localStorage)
- **Persistence:** Local browser only
- **Lifespan:** Until browser data cleared

### Current Limitations
- ❌ No cross-device synchronization
- ❌ No long-term archival
- ❌ No collective/aggregate analysis
- ❌ Risk of data loss if browser cleared
- ❌ No historical data beyond storage limits

## Proposed Three-Tier Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  TamperMonkey Userscript (Tier 1 - Real-time Cache)     │  │
│  │  - GM_setValue/localStorage                              │  │
│  │  - Last 100-500 records per type                         │  │
│  │  - Current game state                                    │  │
│  │  - Immediate access (0ms latency)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ↓ ↑                                  │
│                    Auto-sync every 5 min                        │
│                            ↓ ↑                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Desktop App - Local SQL Database (Tier 2 - Local)      │  │
│  │  - SQLite / SQL Server LocalDB                           │  │
│  │  - Complete historical data                              │  │
│  │  - Unlimited storage (disk-based)                        │  │
│  │  - Local analytics and queries                           │  │
│  │  - Backup to file system                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
							  ↓ ↑
					  Upload every 30 min
				  (or manual trigger)
							  ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│              CLOUD - C# .NET API (Tier 3 - Remote)             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ASP.NET Core Web API (C# .NET 10)                       │  │
│  │  - RESTful endpoints                                      │  │
│  │  - Authentication (JWT tokens)                           │  │
│  │  - Rate limiting                                          │  │
│  │  - Data validation                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SQL Server / PostgreSQL Database                        │  │
│  │  - Multi-user data aggregation                           │  │
│  │  - Long-term archival (unlimited)                        │  │
│  │  - Collective analytics                                   │  │
│  │  - Backup and replication                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Tier 1: Browser Cache (Current Implementation)

### Purpose
- Real-time game data capture
- Immediate UI updates
- Temporary storage during gameplay

### Technology
- **TamperMonkey GM API** (preferred)
- **localStorage** (fallback)

### Retention
- Recent data only (100-1,000 records per type)
- Auto-trim oldest data when limits reached

### Data Flow
```javascript
// Capture → Store locally → Sync to Tier 2
gameTracker.trackBattleResult() 
  → storageManager.set('battleHistory', data)
  → localDB.sync() // Push to desktop app
```

## Tier 2: Local SQL Database (NEW - Recommended)

### Why Local SQL First?

**Advantages:**
✅ **No dependency on internet connection**
✅ **Unlimited storage** (disk-based, not browser limits)
✅ **Fast queries** for analytics
✅ **No cloud costs** for personal use
✅ **Privacy** - data stays on your machine
✅ **Reliable** - no API downtime issues

### Technology Options

#### Option A: SQLite (Simplest)
```
Pros:
- Single file database
- No server needed
- Cross-platform
- Perfect for personal use
- Zero configuration

Cons:
- Single-user only
- No network access (need Tier 3 for sharing)
```

#### Option B: SQL Server LocalDB (Windows)
```
Pros:
- Full SQL Server features
- Better for complex queries
- Easy upgrade path to full SQL Server
- Great developer tools

Cons:
- Windows only
- Larger footprint
```

### Implementation Approach

**Desktop Companion App** (Electron or .NET Desktop)
```
OrganizedJihad Desktop App
├── Local SQL database (SQLite/LocalDB)
├── Sync service (listens for userscript data)
├── Analytics dashboard
└── Export/backup tools
```

### Data Schema (SQL)

```sql
-- Players table
CREATE TABLE Players (
	UserId VARCHAR(50) PRIMARY KEY,
	Name VARCHAR(100),
	Level INT,
	VipLevel INT,
	GuildId VARCHAR(50),
	GuildName VARCHAR(100),
	LastUpdate DATETIME
);

-- Heroes table
CREATE TABLE Heroes (
	Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
	UserId VARCHAR(50) FOREIGN KEY REFERENCES Players(UserId),
	HeroId VARCHAR(50),
	Level INT,
	Stars INT,
	Color INT,
	Power INT,
	Timestamp DATETIME DEFAULT GETDATE()
);

-- Battles table
CREATE TABLE Battles (
	Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
	UserId VARCHAR(50) FOREIGN KEY REFERENCES Players(UserId),
	BattleType VARCHAR(50), -- arena, titanArena, guildWar, etc
	Result VARCHAR(20), -- victory, defeat
	OpponentId VARCHAR(50),
	MyTeam NVARCHAR(MAX), -- JSON compressed team
	EnemyTeam NVARCHAR(MAX), -- JSON compressed team
	Reward NVARCHAR(MAX), -- JSON rewards
	Timestamp DATETIME DEFAULT GETDATE()
);

-- Chest Openings table
CREATE TABLE ChestOpenings (
	Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
	UserId VARCHAR(50) FOREIGN KEY REFERENCES Players(UserId),
	ChestType VARCHAR(50),
	ChestId VARCHAR(50),
	Quantity INT,
	Rewards NVARCHAR(MAX), -- JSON array of rewards
	Timestamp DATETIME DEFAULT GETDATE()
);

-- Historical Snapshots table
CREATE TABLE GameSnapshots (
	Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
	UserId VARCHAR(50) FOREIGN KEY REFERENCES Players(UserId),
	Level INT,
	TotalPower BIGINT,
	Gold BIGINT,
	Emeralds BIGINT,
	Timestamp DATETIME DEFAULT GETDATE()
);

-- Opponent Records table
CREATE TABLE OpponentRecords (
	Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
	UserId VARCHAR(50) FOREIGN KEY REFERENCES Players(UserId),
	BattleType VARCHAR(50),
	OpponentId VARCHAR(50),
	Wins INT DEFAULT 0,
	Losses INT DEFAULT 0,
	LastBattle DATETIME,
	UNIQUE(UserId, BattleType, OpponentId)
);

-- Indexes for performance
CREATE INDEX IX_Battles_UserId_Timestamp ON Battles(UserId, Timestamp);
CREATE INDEX IX_ChestOpenings_ChestType ON ChestOpenings(ChestType, ChestId);
CREATE INDEX IX_GameSnapshots_UserId_Timestamp ON GameSnapshots(UserId, Timestamp);
```

### Sync Protocol

**Browser → Desktop App Communication:**

```javascript
// In userscript: Send data to local app via WebSocket or HTTP
class LocalDBSync {
	constructor() {
		this.syncUrl = 'http://localhost:5000/api/sync';
		this.syncInterval = 300000; // 5 minutes
		this.lastSync = Date.now();
	}

	async syncData() {
		try {
			const data = await gameTracker.exportAllData();
			
			const response = await fetch(this.syncUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': localStorage.getItem('localApiKey')
				},
				body: JSON.stringify({
					userId: data.player.userId,
					timestamp: Date.now(),
					data: data
				})
			});

			if (response.ok) {
				console.log('[OJ] Data synced to local database');
				this.lastSync = Date.now();
				
				// Clear old browser data after successful sync
				this.trimBrowserCache();
			}
		} catch (error) {
			console.error('[OJ] Sync failed:', error);
			// Keep data in browser cache until next sync attempt
		}
	}

	trimBrowserCache() {
		// Keep only last 100 records after successful sync
		const limit = 100;
		
		['battleHistory', 'arenaBattleHistory', 'chestOpeningHistory'].forEach(key => {
			const history = storageManager.get(key, []);
			if (history.length > limit) {
				storageManager.set(key, history.slice(-limit));
			}
		});
	}

	startAutoSync() {
		setInterval(() => this.syncData(), this.syncInterval);
	}
}
```

## Tier 3: Cloud API (Optional - For Sharing)

### When to Use Cloud Storage?

**Use Cases:**
- 📊 Aggregate statistics across all users
- 🌐 Access data from multiple devices
- 🤝 Share data with guild members
- 📈 Community-wide analytics
- ☁️ Automatic cloud backup

### C# .NET 10 Web API Architecture

```
OrganizedJihad.API/
├── Controllers/
│   ├── AuthController.cs          // User authentication
│   ├── SyncController.cs           // Data upload/download
│   ├── AnalyticsController.cs      // Aggregate queries
│   └── ExportController.cs         // Data export
├── Models/
│   ├── Player.cs
│   ├── Battle.cs
│   ├── ChestOpening.cs
│   └── GameSnapshot.cs
├── Services/
│   ├── DataIngestionService.cs     // Validate and process uploads
│   ├── AnalyticsService.cs         // Calculate aggregate stats
│   └── BackupService.cs            // Automated backups
├── Data/
│   └── AppDbContext.cs             // Entity Framework Core
└── Program.cs                      // App configuration
```

### API Endpoints

```csharp
// Authentication
POST   /api/auth/register          // Create account
POST   /api/auth/login             // Get JWT token

// Data Sync
POST   /api/sync/upload            // Upload data batch
GET    /api/sync/download          // Download user's data
GET    /api/sync/status            // Check sync status

// Analytics (Aggregate)
GET    /api/analytics/chest-rates  // Global chest drop rates
GET    /api/analytics/meta-teams   // Most used team compositions
GET    /api/analytics/win-rates    // Arena win rates by power tier

// Export
GET    /api/export/user/{userId}   // Full data export
POST   /api/export/backup          // Trigger backup
```

### Example API Implementation

```csharp
// Controllers/SyncController.cs
[ApiController]
[Route("api/[controller]")]
[Authorize] // Require JWT token
public class SyncController : ControllerBase
{
	private readonly AppDbContext _context;
	private readonly IDataIngestionService _ingestionService;

	[HttpPost("upload")]
	[RequestSizeLimit(10_000_000)] // 10 MB limit
	public async Task<IActionResult> Upload([FromBody] SyncRequest request)
	{
		// Validate user owns this data
		var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
		if (request.UserId != userId)
			return Forbid();

		// Validate and sanitize data
		var validatedData = await _ingestionService.ValidateAsync(request.Data);

		// Store in database
		await _context.Battles.AddRangeAsync(validatedData.Battles);
		await _context.ChestOpenings.AddRangeAsync(validatedData.ChestOpenings);
		await _context.SaveChangesAsync();

		return Ok(new { 
			message = "Data synced successfully",
			recordsStored = validatedData.TotalRecords 
		});
	}

	[HttpGet("download")]
	public async Task<IActionResult> Download()
	{
		var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

		var data = new UserDataExport
		{
			Player = await _context.Players.FirstOrDefaultAsync(p => p.UserId == userId),
			Battles = await _context.Battles
				.Where(b => b.UserId == userId)
				.OrderByDescending(b => b.Timestamp)
				.Take(1000)
				.ToListAsync(),
			ChestOpenings = await _context.ChestOpenings
				.Where(c => c.UserId == userId)
				.OrderByDescending(c => c.Timestamp)
				.Take(1000)
				.ToListAsync()
		};

		return Ok(data);
	}
}
```

### Database (Cloud)

**Options:**
1. **SQL Server Azure** - Microsoft's cloud SQL
2. **PostgreSQL (Heroku/Azure)** - Open-source alternative
3. **MongoDB Atlas** - NoSQL for flexible schema

**Estimated Costs:**
- Free tier: 500 MB - 5 GB (sufficient for personal use)
- Paid: $5-20/month for 20 GB with backups

## Recommended Implementation Phases

### Phase 1: Keep Current (Browser Only) ✅ COMPLETE
- [x] TamperMonkey storage working
- [x] Data export functionality
- **Duration:** Already done
- **Effort:** 0 hours

### Phase 2: Add Local Database (HIGH PRIORITY)
- [ ] Create desktop app (Electron or .NET MAUI)
- [ ] Implement SQLite database
- [ ] Add sync service (HTTP server on localhost)
- [ ] Update userscript to auto-sync
- **Duration:** 2-3 weeks
- **Effort:** 40-60 hours
- **Benefit:** Unlimited storage, no data loss

### Phase 3: Add Cloud API (OPTIONAL)
- [ ] Create ASP.NET Core Web API
- [ ] Deploy to Azure/Heroku
- [ ] Add authentication
- [ ] Implement aggregate analytics
- **Duration:** 2-4 weeks
- **Effort:** 60-80 hours
- **Benefit:** Multi-device sync, community features

## Recommended Approach

### For Personal Use Only
**→ Tier 1 (Browser) + Tier 2 (Local SQL)**
- No cloud costs
- Complete privacy
- Unlimited local storage
- Fast and reliable

### For Sharing/Community
**→ All 3 Tiers**
- Full feature set
- Aggregate analytics
- Multi-device sync
- Cloud backup

## Next Steps

Would you like me to:

1. **Create the desktop app project** (Electron or .NET)?
   - SQLite database setup
   - Local sync API
   - Data migration from browser storage

2. **Create the C# .NET API project**?
   - ASP.NET Core Web API
   - Entity Framework Core
   - SQL Server / PostgreSQL setup
   - Authentication and authorization

3. **Update the userscript** to support syncing?
   - Add sync service
   - Implement upload/download
   - Handle offline scenarios

4. **All of the above**?
   - Complete three-tier architecture
   - Full implementation

Let me know your preference and I'll scaffold the appropriate project(s)!
