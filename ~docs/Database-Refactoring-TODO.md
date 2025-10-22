# Database Layer Refactoring - TODO List

## Phase 1: Create Separate Data Library Project

### 1.1 Project Setup
- [ ] Create new .NET class library project: `OrganizedJihad.Data`
  - Target: .NET 10.0
  - Location: `data/OrganizedJihad.Data.csproj`
  - Add NuGet packages:
    - `Microsoft.EntityFrameworkCore` (9.0.10)
    - `Microsoft.EntityFrameworkCore.Sqlite` (9.0.10)
    - `Microsoft.EntityFrameworkCore.Design` (9.0.10)

### 1.2 Move Database Context
- [ ] Move `GameDatabaseContext.cs` from `api/Data/` to `data/`
  - Update namespace to `OrganizedJihad.Data`
  - Keep all DbSet properties and OnModelCreating configuration
  - Ensure all entity configurations move with it

### 1.3 Move Entity Models
- [ ] Create `data/Models/` directory
- [ ] Move all model files from `api/Data/Models/`:
  - [ ] `PlayerSnapshot.cs`
  - [ ] `ArenaBattle.cs`
  - [ ] `ArenaModels.cs` (GrandArenaBattle, TitanArenaBattle)
  - [ ] `BattleModels.cs` (GuildWarBattle, RaidBossAttack)
  - [ ] `ChestModels.cs` (ChestOpening, ChestDrop)
  - [ ] `Opponent.cs`
  - [ ] `UserData.cs` (Goal, CalendarEvent)
  - [ ] `SyncMetadata.cs`
- [ ] Update all namespaces to `OrganizedJihad.Data.Models`

---

## Phase 2: Add Audit Infrastructure

### 2.1 Create Audit Interfaces
- [ ] Create `data/Interfaces/IAuditableEntity.cs`:
  ```csharp
  public interface IAuditableEntity
  {
      DateTime DateCreated { get; set; }
      DateTime DateModified { get; set; }
      string? CreatedBy { get; set; }
      string? ModifiedBy { get; set; }
  }
  ```

- [ ] Create `data/Interfaces/ICreationAuditableEntity.cs`:
  ```csharp
  // For records that are created but never modified (most game data)
  public interface ICreationAuditableEntity
  {
      DateTime DateCreated { get; set; }
      string? CreatedBy { get; set; }
  }
  ```

- [ ] Create `data/Interfaces/ISoftDelete.cs`:
  ```csharp
  public interface ISoftDelete
  {
      bool IsDeleted { get; set; }
      DateTime? DateDeleted { get; set; }
      string? DeletedBy { get; set; }
  }
  ```

### 2.2 Create Base Entity Classes
- [ ] Create `data/Entities/AuditableEntity.cs` (abstract base class):
  ```csharp
  public abstract class AuditableEntity : IAuditableEntity
  {
      public DateTime DateCreated { get; set; }
      public DateTime DateModified { get; set; }
      public string? CreatedBy { get; set; }
      public string? ModifiedBy { get; set; }
  }
  ```

- [ ] Create `data/Entities/CreationAuditableEntity.cs`:
  ```csharp
  public abstract class CreationAuditableEntity : ICreationAuditableEntity
  {
      public DateTime DateCreated { get; set; }
      public string? CreatedBy { get; set; }
  }
  ```

- [ ] Create `data/Entities/SoftDeletableEntity.cs`:
  ```csharp
  public abstract class SoftDeletableEntity : AuditableEntity, ISoftDelete
  {
      public bool IsDeleted { get; set; }
      public DateTime? DateDeleted { get; set; }
      public string? DeletedBy { get; set; }
  }
  ```

### 2.3 Update Entity Models with Audit Fields

#### Immutable Game Data (Creation Audit Only)
These records are captured from game and never modified:
- [ ] **PlayerSnapshot** - inherit from `CreationAuditableEntity`
  - Already has `Timestamp` - keep it for domain logic
  - Add `DateCreated` for audit trail
  - Remove: None needed (snapshots are immutable)

- [ ] **ArenaBattle** - inherit from `CreationAuditableEntity`
  - Already has `Timestamp` - keep it
  - Add `DateCreated`

- [ ] **GrandArenaBattle** - inherit from `CreationAuditableEntity`
  - Already has `Timestamp`
  - Add `DateCreated`

- [ ] **TitanArenaBattle** - inherit from `CreationAuditableEntity`
  - Already has `Timestamp`
  - Add `DateCreated`

- [ ] **GuildWarBattle** - inherit from `CreationAuditableEntity`
  - Already has `Timestamp`
  - Add `DateCreated`

- [ ] **RaidBossAttack** - inherit from `CreationAuditableEntity`
  - Already has `Timestamp`
  - Add `DateCreated`

- [ ] **ChestOpening** - inherit from `CreationAuditableEntity`
  - Already has `Timestamp`
  - Add `DateCreated`

- [ ] **ChestDrop** - inherit from `CreationAuditableEntity`
  - Parent: ChestOpening
  - Add `DateCreated`

#### Mutable User Data (Full Audit Trail)
These records can be updated by the user:
- [ ] **Goal** - inherit from `SoftDeletableEntity`
  - Already has `CreatedAt` - rename to `DateCreated` for consistency
  - Add `DateModified`
  - Already has `CompletedAt` - keep it (domain-specific)
  - Add `IsDeleted`, `DateDeleted`, `DeletedBy`

- [ ] **CalendarEvent** - inherit from `SoftDeletableEntity`
  - Already has `CreatedAt` - rename to `DateCreated`
  - Add `DateModified`
  - Add `IsDeleted`, `DateDeleted`, `DeletedBy`

#### Reference Data (Full Audit Trail)
- [ ] **Opponent** - inherit from `AuditableEntity`
  - Already has `LastSeen` - keep it (domain logic)
  - Add `DateCreated`
  - Add `DateModified`
  - Note: Opponent records are merged/updated with new encounters

- [ ] **SyncMetadata** - inherit from `AuditableEntity`
  - Already has `LastSync` - keep it
  - Add `DateCreated`
  - Add `DateModified`

---

## Phase 3: Update Database Context for Audit

### 3.1 Override SaveChangesAsync
- [ ] Add `SaveChangesAsync` override in `GameDatabaseContext`:
  ```csharp
  public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
  {
      var entries = ChangeTracker.Entries()
          .Where(e => e.Entity is IAuditableEntity || e.Entity is ICreationAuditableEntity);

      foreach (var entry in entries)
      {
          if (entry.Entity is ICreationAuditableEntity creationAuditable)
          {
              if (entry.State == EntityState.Added)
              {
                  creationAuditable.DateCreated = DateTime.UtcNow;
                  creationAuditable.CreatedBy = "system"; // TODO: Get from context
              }
          }

          if (entry.Entity is IAuditableEntity auditable)
          {
              if (entry.State == EntityState.Added)
              {
                  auditable.DateCreated = DateTime.UtcNow;
                  auditable.CreatedBy = "system";
              }

              if (entry.State == EntityState.Modified)
              {
                  auditable.DateModified = DateTime.UtcNow;
                  auditable.ModifiedBy = "system";
              }
          }

          if (entry.Entity is ISoftDelete softDelete && entry.State == EntityState.Deleted)
          {
              entry.State = EntityState.Modified;
              softDelete.IsDeleted = true;
              softDelete.DateDeleted = DateTime.UtcNow;
              softDelete.DeletedBy = "system";
          }
      }

      return await base.SaveChangesAsync(cancellationToken);
  }
  ```

### 3.2 Add Global Query Filters
- [ ] Add query filters for soft delete in `OnModelCreating`:
  ```csharp
  // For all entities implementing ISoftDelete
  modelBuilder.Entity<Goal>().HasQueryFilter(g => !g.IsDeleted);
  modelBuilder.Entity<CalendarEvent>().HasQueryFilter(e => !e.IsDeleted);
  ```

### 3.3 Add Audit Field Indexes
- [ ] Add indexes for audit fields in `OnModelCreating`:
  ```csharp
  // For each entity with DateCreated
  entity.HasIndex(e => e.DateCreated);
  
  // For soft-deletable entities
  entity.HasIndex(e => e.IsDeleted);
  entity.HasIndex(e => new { e.IsDeleted, e.DateCreated });
  ```

---

## Phase 4: Review API Data Collection

### 4.1 Verify Current Data Capture
Review what's currently being captured from the browser:

#### ✅ Currently Captured:
- [x] **PlayerSnapshot** - Full player state
  - PlayerId, PlayerName, Level, TeamPower
  - Resources: Gold, Emeralds, Coins (Arena, Grand, Titan, Guild)
  - Ranks: Arena, Grand Arena, Titan Arena
  - Guild: Name, ID
  - Additional: VIP level, dungeon progress

- [x] **Battle Data** (4 types):
  - Arena, Grand Arena, Titan Arena, Guild War
  - Opponent info, win/loss, team compositions
  - Rewards received

- [x] **Raid Boss Attacks**:
  - Damage dealt, team composition, rewards

- [x] **Chest Openings**:
  - Chest type, quantity, open method
  - Individual drops with rarity and value

- [x] **Opponents**:
  - Track history, win/loss records
  - Team compositions, power levels

- [x] **Goals & Calendar**:
  - User-defined goals and events

### 4.2 Missing Data to Consider Adding

#### 4.2.1 Hero Roster Details
- [ ] Create `Hero` model:
  ```csharp
  public class Hero : CreationAuditableEntity
  {
      public int Id { get; set; }
      public long HeroId { get; set; }  // Game's hero ID
      public string HeroName { get; set; }
      public int Level { get; set; }
      public int Stars { get; set; }  // Absolute stars
      public int Color { get; set; }  // Rank/promotion color
      public int Power { get; set; }
      public int Skins { get; set; }  // Skin level
      public DateTime Timestamp { get; set; }
      public long PlayerId { get; set; }  // Foreign key to player
      
      // Skills
      public int SkillLevel1 { get; set; }
      public int SkillLevel2 { get; set; }
      public int SkillLevel3 { get; set; }
      public int SkillLevel4 { get; set; }
      
      // Artifacts
      public int ArtifactWeapon { get; set; }
      public int ArtifactBook { get; set; }
      public int ArtifactRing { get; set; }
      
      // Glyphs
      public string? GlyphData { get; set; }  // JSON
  }
  ```

#### 4.2.2 Titan Roster Details
- [ ] Create `Titan` model (similar to Hero):
  ```csharp
  public class Titan : CreationAuditableEntity
  {
      public int Id { get; set; }
      public long TitanId { get; set; }
      public string TitanName { get; set; }
      public int Level { get; set; }
      public int Stars { get; set; }
      public int Power { get; set; }
      public DateTime Timestamp { get; set; }
      public long PlayerId { get; set; }
      
      // Titan-specific
      public int SkillLevel { get; set; }
      public string? ArtifactData { get; set; }  // JSON
      public int SummonStars { get; set; }
  }
  ```

#### 4.2.3 Pet Details
- [ ] Create `Pet` model:
  ```csharp
  public class Pet : CreationAuditableEntity
  {
      public int Id { get; set; }
      public long PetId { get; set; }
      public string PetName { get; set; }
      public int Stars { get; set; }
      public int Power { get; set; }
      public DateTime Timestamp { get; set; }
      public long PlayerId { get; set; }
  }
  ```

#### 4.2.4 Daily Quest/Mission Completion
- [ ] Create `DailyQuest` model:
  ```csharp
  public class DailyQuest : CreationAuditableEntity
  {
      public int Id { get; set; }
      public DateTime CompletedAt { get; set; }
      public string QuestType { get; set; }  // "daily", "weekly", "event"
      public string QuestId { get; set; }
      public string QuestName { get; set; }
      public string? RewardData { get; set; }  // JSON
      public long PlayerId { get; set; }
  }
  ```

#### 4.2.5 Campaign/Mission Progress
- [ ] Create `MissionProgress` model:
  ```csharp
  public class MissionProgress : AuditableEntity
  {
      public int Id { get; set; }
      public string MissionId { get; set; }
      public string MissionName { get; set; }
      public int Stars { get; set; }  // 0-3 stars
      public int HighestLevel { get; set; }
      public bool IsHeroic { get; set; }
      public DateTime LastCompleted { get; set; }
      public long PlayerId { get; set; }
  }
  ```

#### 4.2.6 Shop Purchases
- [ ] Create `ShopPurchase` model:
  ```csharp
  public class ShopPurchase : CreationAuditableEntity
  {
      public int Id { get; set; }
      public DateTime PurchasedAt { get; set; }
      public string ShopType { get; set; }  // "arena", "guild", "tower", "merchant"
      public string ItemId { get; set; }
      public string ItemName { get; set; }
      public int Quantity { get; set; }
      public string CostType { get; set; }  // "gold", "emeralds", "arena_coins"
      public int CostAmount { get; set; }
      public long PlayerId { get; set; }
  }
  ```

#### 4.2.7 Tower/Dungeon Progress
- [ ] Create `TowerProgress` model:
  ```csharp
  public class TowerProgress : AuditableEntity
  {
      public int Id { get; set; }
      public string TowerType { get; set; }  // "regular", "outland"
      public int HighestFloor { get; set; }
      public DateTime LastUpdate { get; set; }
      public string? FloorData { get; set; }  // JSON - detailed floor completion
      public long PlayerId { get; set; }
  }
  ```

#### 4.2.8 Expedition Battles
- [ ] Create `ExpeditionBattle` model:
  ```csharp
  public class ExpeditionBattle : CreationAuditableEntity
  {
      public int Id { get; set; }
      public DateTime Timestamp { get; set; }
      public string ExpeditionId { get; set; }
      public int BossId { get; set; }
      public string BossName { get; set; }
      public bool IsWin { get; set; }
      public string? TeamComposition { get; set; }  // JSON
      public string? RewardData { get; set; }  // JSON
      public long PlayerId { get; set; }
  }
  ```

#### 4.2.9 Resource Gain/Loss Tracking
- [ ] Create `ResourceTransaction` model:
  ```csharp
  public class ResourceTransaction : CreationAuditableEntity
  {
      public int Id { get; set; }
      public DateTime Timestamp { get; set; }
      public string ResourceType { get; set; }  // "gold", "emeralds", "arena_coins"
      public int Amount { get; set; }  // Positive for gain, negative for loss
      public string Source { get; set; }  // "battle", "shop", "quest", "chest"
      public string? SourceDetail { get; set; }  // Specific details
      public long PlayerId { get; set; }
  }
  ```

#### 4.2.10 Guild Activity Tracking
- [ ] Create `GuildActivity` model:
  ```csharp
  public class GuildActivity : CreationAuditableEntity
  {
      public int Id { get; set; }
      public DateTime Timestamp { get; set; }
      public long GuildId { get; set; }
      public string GuildName { get; set; }
      public string ActivityType { get; set; }  // "join", "leave", "donation", "raid"
      public string? ActivityData { get; set; }  // JSON - specific activity details
      public long PlayerId { get; set; }
  }
  ```

### 4.3 Update BrowserSyncData DTO
- [ ] Add new lists to `api/Models/BrowserSyncData.cs`:
  ```csharp
  public List<Hero>? Heroes { get; set; }
  public List<Titan>? Titans { get; set; }
  public List<Pet>? Pets { get; set; }
  public List<DailyQuest>? DailyQuests { get; set; }
  public List<MissionProgress>? MissionProgress { get; set; }
  public List<ShopPurchase>? ShopPurchases { get; set; }
  public List<TowerProgress>? TowerProgress { get; set; }
  public List<ExpeditionBattle>? ExpeditionBattles { get; set; }
  public List<ResourceTransaction>? ResourceTransactions { get; set; }
  public List<GuildActivity>? GuildActivities { get; set; }
  ```

### 4.4 Update ImportCounts DTO
- [ ] Add counts for new entity types in `ImportCounts`:
  ```csharp
  public int Heroes { get; set; }
  public int Titans { get; set; }
  public int Pets { get; set; }
  public int DailyQuests { get; set; }
  public int MissionProgress { get; set; }
  public int ShopPurchases { get; set; }
  public int TowerProgress { get; set; }
  public int ExpeditionBattles { get; set; }
  public int ResourceTransactions { get; set; }
  public int GuildActivities { get; set; }
  ```

### 4.5 Review Userscript Tracking
- [ ] Check `userscript/src/modules/gameTracker.js` for API calls being tracked
- [ ] Verify these API endpoints are being captured:
  - [x] `userGetInfo` - Player data ✓
  - [x] `heroGetAll` - Heroes ✓ (currently stored in metadata, needs proper table)
  - [ ] `titanGetAll` - Titans
  - [ ] `petGetAll` - Pets
  - [x] `inventoryGet` - Resources ✓ (in snapshot)
  - [x] `arenaAttack`, `arenaGetEnemies` - Arena ✓
  - [x] `grandArenaAttack` - Grand Arena ✓
  - [x] `titanArenaAttack` - Titan Arena ✓
  - [x] `clanWarAttack` - Guild War ✓
  - [x] `bossRaidAttack` - Raid Boss ✓
  - [x] `chestOpen` - Chests ✓
  - [ ] `shopBuy` - Shop purchases
  - [ ] `questComplete` - Quest completions
  - [ ] `missionEnd`, `towerEnd` - Campaign/Tower progress
  - [ ] `expeditionBattle` - Expedition battles

---

## Phase 5: Update API and Services

### 5.1 Update API Project References
- [ ] Add project reference in `api/OrganizedJihad.Api.csproj`:
  ```xml
  <ItemGroup>
    <ProjectReference Include="..\data\OrganizedJihad.Data.csproj" />
  </ItemGroup>
  ```

### 5.2 Update Using Statements
- [ ] Update all files in `api/` that reference:
  - `OrganizedJihad.Api.Data` → `OrganizedJihad.Data`
  - `OrganizedJihad.Api.Data.Models` → `OrganizedJihad.Data.Models`

### 5.3 Update SyncService Import Methods
- [ ] Add import methods for new entities:
  - [ ] `ImportHeroesAsync(context, List<Hero>)`
  - [ ] `ImportTitansAsync(context, List<Titan>)`
  - [ ] `ImportPetsAsync(context, List<Pet>)`
  - [ ] `ImportDailyQuestsAsync(context, List<DailyQuest>)`
  - [ ] `ImportMissionProgressAsync(context, List<MissionProgress>)`
  - [ ] `ImportShopPurchasesAsync(context, List<ShopPurchase>)`
  - [ ] `ImportTowerProgressAsync(context, List<TowerProgress>)`
  - [ ] `ImportExpeditionBattlesAsync(context, List<ExpeditionBattle>)`
  - [ ] `ImportResourceTransactionsAsync(context, List<ResourceTransaction>)`
  - [ ] `ImportGuildActivitiesAsync(context, List<GuildActivity>)`

### 5.4 Complete TODO Import Methods
- [ ] Implement `ImportGoalsAsync(context, List<Goal>)`
- [ ] Implement `ImportCalendarEventsAsync(context, List<CalendarEvent>)`

---

## Phase 6: Update Desktop App

### 6.1 Update Desktop Project References
- [ ] Add project reference in `desktop-app/OrganizedJihad.Desktop.csproj`:
  ```xml
  <ItemGroup>
    <ProjectReference Include="..\data\OrganizedJihad.Data.csproj" />
  </ItemGroup>
  ```

### 6.2 Update Using Statements
- [ ] Update all Blazor pages that reference:
  - `OrganizedJihad.Desktop.Data` → `OrganizedJihad.Data`
  - `OrganizedJihad.Desktop.Data.Models` → `OrganizedJihad.Data.Models`

### 6.3 Update MauiProgram.cs
- [ ] Update DbContext registration to use new namespace

---

## Phase 7: Update Userscript

### 7.1 Enhance gameTracker.js
- [ ] Add tracking for new entities (Heroes, Titans, Pets, etc.)
- [ ] Ensure all API calls are properly captured
- [ ] Update storage to handle new entity types

### 7.2 Update indexedDBStorage.js
- [ ] Add new object stores for new entity types
- [ ] Ensure proper indexing

### 7.3 Update syncClient.js
- [ ] Update sync payload to include new entity types

---

## Phase 8: Database Migration

### 8.1 Create EF Core Migration
- [ ] Generate migration for audit fields:
  ```bash
  cd data
  dotnet ef migrations add AddAuditFieldsAndNewEntities --startup-project ../api
  ```

### 8.2 Test Migration
- [ ] Run migration on test database
- [ ] Verify all audit fields are added
- [ ] Verify indexes are created
- [ ] Test soft delete functionality

### 8.3 Data Migration Script
- [ ] Create script to populate `DateCreated` for existing records:
  ```sql
  -- Use Timestamp as DateCreated for existing records
  UPDATE PlayerSnapshots SET DateCreated = Timestamp WHERE DateCreated IS NULL;
  UPDATE ArenaBattles SET DateCreated = Timestamp WHERE DateCreated IS NULL;
  -- ... etc for all battle tables
  ```

---

## Phase 9: Testing

### 9.1 Unit Tests
- [ ] Test audit field population on entity creation
- [ ] Test audit field updates on entity modification
- [ ] Test soft delete functionality
- [ ] Test query filters for soft-deleted entities

### 9.2 Integration Tests
- [ ] Test full sync flow from browser → API → database
- [ ] Verify audit fields are correctly populated
- [ ] Test desktop app can query all entities

### 9.3 Performance Tests
- [ ] Benchmark SaveChangesAsync with audit overhead
- [ ] Verify indexes improve query performance
- [ ] Test bulk import performance

---

## Phase 10: Documentation

### 10.1 Update Architecture Docs
- [ ] Document new project structure (3 projects: data, api, desktop-app)
- [ ] Document audit field strategy
- [ ] Document entity inheritance hierarchy

### 10.2 Update API Documentation
- [ ] Document new endpoints for new entity types
- [ ] Update sync payload schema
- [ ] Document audit field behavior

### 10.3 Update Developer Guide
- [ ] Explain how to add new entities with audit fields
- [ ] Document soft delete pattern
- [ ] Provide examples of querying with audit filters

---

## Priority Levels

### 🔴 High Priority (Core Functionality)
1. Phase 1: Create separate data project
2. Phase 2.1-2.2: Add basic audit interfaces and base classes
3. Phase 2.3: Update existing entities with `DateCreated`
4. Phase 3: Update database context for audit
5. Phase 5: Update API references
6. Phase 6: Update desktop app references

### 🟡 Medium Priority (Enhanced Tracking)
7. Phase 4.2: Add Hero, Titan, Pet models
8. Phase 4.2: Add DailyQuest, ShopPurchase models
9. Phase 7: Update userscript to track new entities
10. Phase 5.3: Implement new import methods

### 🟢 Low Priority (Nice to Have)
11. Phase 4.2: Add ResourceTransaction, GuildActivity models
12. Phase 4.2: Add MissionProgress, TowerProgress, ExpeditionBattle models
13. Phase 2.3: Add full audit trail (DateModified) to mutable entities
14. Phase 2.3: Add soft delete to user-managed entities

---

## Estimated Effort

- **Phase 1-3** (Data project + Audit): ~4-6 hours
- **Phase 4** (Review & Plan New Entities): ~2-3 hours
- **Phase 5-6** (Update API & Desktop): ~2-3 hours
- **Phase 7** (Update Userscript): ~3-4 hours
- **Phase 8** (Migration): ~1-2 hours
- **Phase 9** (Testing): ~3-4 hours
- **Phase 10** (Documentation): ~2-3 hours

**Total Estimated Time**: 17-25 hours

---

## Notes

### CreatedBy/ModifiedBy Population
Currently set to "system" as placeholder. Consider:
- Browser sync: `CreatedBy = "browser"`
- Manual entry: `CreatedBy = "user"`
- API sync: `CreatedBy = "api"`
- Future multi-user: Use actual user identifier

### Timestamp vs DateCreated
Many entities already have `Timestamp` for domain logic (when battle occurred, when snapshot taken).
`DateCreated` is purely for audit (when record was inserted into database).
Keep both - they serve different purposes!

### Soft Delete Considerations
Only apply to user-managed data (Goals, Calendar Events).
Game data (battles, chests) should never be deleted - it's historical fact.

### Index Strategy
Prioritize indexes on:
- DateCreated (for time-series queries)
- IsDeleted (for soft delete filtering)
- PlayerId + DateCreated (for player-specific time-series)
- Timestamp (already exists, domain logic)
