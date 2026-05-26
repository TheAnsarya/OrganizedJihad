using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Data.Interceptors;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Data;

/// <summary>
/// Entity Framework Core database context for Hero Wars game data.
/// Manages all game-related tables and provides access to tracked data.
///
/// Design Pattern: Repository pattern with EF Core
/// https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/
/// </summary>
public class GameDatabaseContext : DbContext {
	/// <summary>
	/// Player snapshot records showing account state at specific times
	/// Immutable historical data captured from game API
	/// </summary>
	public DbSet<PlayerSnapshot> PlayerSnapshots { get; set; }

	/// <summary>
	/// Arena battle records (regular arena)
	/// Immutable historical data captured from battle results
	/// </summary>
	public DbSet<ArenaBattle> ArenaBattles { get; set; }

	/// <summary>
	/// Grand Arena battle records
	/// Immutable historical data with 3v3 team format
	/// </summary>
	public DbSet<GrandArenaBattle> GrandArenaBattles { get; set; }

	/// <summary>
	/// Titan Arena battle records
	/// Immutable historical data for titan battles
	/// </summary>
	public DbSet<TitanArenaBattle> TitanArenaBattles { get; set; }

	/// <summary>
	/// Guild War battle records
	/// Immutable historical data for guild war attacks
	/// </summary>
	public DbSet<GuildWarBattle> GuildWarBattles { get; set; }

	/// <summary>
	/// Raid Boss attack records
	/// Immutable historical data for raid boss damage
	/// </summary>
	public DbSet<RaidBossAttack> RaidBossAttacks { get; set; }

	/// <summary>
	/// Chest opening records with drop information
	/// Immutable historical data for chest analytics
	/// </summary>
	public DbSet<ChestOpening> ChestOpenings { get; set; }

	/// <summary>
	/// Individual items dropped from chests
	/// Immutable historical data linked to ChestOpening
	/// </summary>
	public DbSet<ChestDrop> ChestDrops { get; set; }

	/// <summary>
	/// Tracked opponents with win/loss records
	/// Mutable reference data updated with each battle
	/// </summary>
	public DbSet<Opponent> Opponents { get; set; }

	/// <summary>
	/// User goals (short-term and long-term)
	/// Mutable user-managed data with soft delete support
	/// </summary>
	public DbSet<Goal> Goals { get; set; }

	/// <summary>
	/// Calendar events and reminders
	/// Mutable user-managed data with recurring event support
	/// </summary>
	public DbSet<CalendarEvent> CalendarEvents { get; set; }

	/// <summary>
	/// Sync metadata to track last sync with browser
	/// Mutable metadata for sync coordination
	/// </summary>
	public DbSet<SyncMetadata> SyncMetadata { get; set; }

	// === Hero, Titan, and Pet Rosters ===

	/// <summary>
	/// Hero roster snapshots with full progression details
	/// Immutable historical data capturing hero state at sync time
	/// </summary>
	public DbSet<Hero> Heroes { get; set; }

	/// <summary>
	/// Titan roster snapshots with full progression details
	/// Immutable historical data capturing titan state at sync time
	/// </summary>
	public DbSet<Titan> Titans { get; set; }

	/// <summary>
	/// Pet roster snapshots
	/// Immutable historical data capturing pet state at sync time
	/// </summary>
	public DbSet<Pet> Pets { get; set; }

	/// <summary>
	/// Inventory snapshots showing all items and resources
	/// Immutable historical data for tracking resource accumulation
	/// </summary>
	public DbSet<InventorySnapshot> InventorySnapshots { get; set; }

	// === Activity and Progress Tracking ===

	/// <summary>
	/// Quest completions (daily, weekly, event quests)
	/// Immutable historical data for tracking quest completion patterns
	/// </summary>
	public DbSet<QuestCompletion> QuestCompletions { get; set; }

	/// <summary>
	/// Campaign and mission progress
	/// Mutable data tracking highest completion and star ratings
	/// </summary>
	public DbSet<MissionProgress> MissionProgress { get; set; }

	/// <summary>
	/// Shop purchases from all in-game shops
	/// Immutable historical data for spending analytics
	/// </summary>
	public DbSet<ShopPurchase> ShopPurchases { get; set; }

	/// <summary>
	/// Tower and dungeon progress
	/// Mutable data tracking highest floors reached
	/// </summary>
	public DbSet<TowerProgress> TowerProgress { get; set; }

	/// <summary>
	/// Expedition and campaign boss battles
	/// Immutable historical data for PvE battle tracking
	/// </summary>
	public DbSet<ExpeditionBattle> ExpeditionBattles { get; set; }

	/// <summary>
	/// Resource transactions (gains and losses)
	/// Immutable historical data for economic analytics
	/// </summary>
	public DbSet<ResourceTransaction> ResourceTransactions { get; set; }

	/// <summary>
	/// Guild activities and contributions
	/// Immutable historical data for guild participation tracking
	/// </summary>
	public DbSet<GuildActivity> GuildActivities { get; set; }

	// === Chat and Communication Tracking ===

	/// <summary>
	/// Chat messages from guild, private, adventure, and AoC chats
	/// Immutable historical data for communication pattern analysis
	/// Reference: https://hw-mobile.fandom.com/wiki/Chat
	/// </summary>
	public DbSet<ChatMessage> ChatMessages { get; set; }

	/// <summary>
	/// Aggregated chat activity summaries by date
	/// Immutable statistical data for engagement metrics
	/// </summary>
	public DbSet<ChatActivitySummary> ChatActivitySummaries { get; set; }

	// === Guild Member Tracking ===

	/// <summary>
	/// Guild member roster with current statistics
	/// Mutable data tracking fellow guild members
	/// Reference: https://hw-mobile.fandom.com/wiki/Guild
	/// </summary>
	public DbSet<GuildMember> GuildMembers { get; set; }

	/// <summary>
	/// Historical snapshots of guild member statistics
	/// Immutable data for tracking member progression over time
	/// </summary>
	public DbSet<GuildMemberSnapshot> GuildMemberSnapshots { get; set; }

	/// <summary>
	/// Guild War participation records per member
	/// Immutable data tracking attacks, damage, and participation
	/// </summary>
	public DbSet<GuildWarParticipation> GuildWarParticipations { get; set; }

	/// <summary>
	/// Guild Raid (Boss Raid) participation per member
	/// Immutable data tracking boss/minion damage and titanite earned
	/// Reference: https://hw-mobile.fandom.com/wiki/Guild_Raid
	/// </summary>
	public DbSet<GuildRaidParticipation> GuildRaidParticipations { get; set; }

	/// <summary>
	/// Guild Dungeon participation per member
	/// Immutable data tracking titan charges used and stage progression
	/// </summary>
	public DbSet<GuildDungeonParticipation> GuildDungeonParticipations { get; set; }

	/// <summary>
	/// Titanite transaction history (donations, earnings, spending)
	/// Immutable data for guild currency flow analysis
	/// </summary>
	public DbSet<TitaniteTransaction> TitaniteTransactions { get; set; }

	// === Hero Upgrade Tracking ===

	/// <summary>
	/// Hero level-up events tracking experience and gold spent
	/// Immutable historical data for hero progression analysis
	/// </summary>
	public DbSet<HeroLevelUpgrade> HeroLevelUpgrades { get; set; }

	/// <summary>
	/// Hero star (evolution) promotion events
	/// Immutable historical data for hero evolution tracking
	/// </summary>
	public DbSet<HeroStarUpgrade> HeroStarUpgrades { get; set; }

	/// <summary>
	/// Hero color (rank/tier) evolution events
	/// Immutable historical data for hero color progression
	/// </summary>
	public DbSet<HeroColorUpgrade> HeroColorUpgrades { get; set; }

	/// <summary>
	/// Hero skill level-up events
	/// Immutable historical data for skill progression tracking
	/// </summary>
	public DbSet<HeroSkillUpgrade> HeroSkillUpgrades { get; set; }

	/// <summary>
	/// Hero artifact upgrade events (weapon, book, ring)
	/// Immutable historical data for artifact progression
	/// </summary>
	public DbSet<HeroArtifactUpgrade> HeroArtifactUpgrades { get; set; }

	/// <summary>
	/// Hero glyph upgrade events
	/// Immutable historical data for glyph stat progression
	/// </summary>
	public DbSet<HeroGlyphUpgrade> HeroGlyphUpgrades { get; set; }

	/// <summary>
	/// Hero skin unlock and upgrade events
	/// Immutable historical data for skin collection tracking
	/// </summary>
	public DbSet<HeroSkinUpgrade> HeroSkinUpgrades { get; set; }

	// === Titan Upgrade Tracking ===

	/// <summary>
	/// Titan level-up events tracking potions and gold spent
	/// Immutable historical data for titan progression analysis
	/// </summary>
	public DbSet<TitanLevelUpgrade> TitanLevelUpgrades { get; set; }

	/// <summary>
	/// Titan star (evolution) promotion events
	/// Immutable historical data for titan evolution tracking
	/// </summary>
	public DbSet<TitanStarUpgrade> TitanStarUpgrades { get; set; }

	/// <summary>
	/// Titan skill level-up events
	/// Immutable historical data for titan skill progression
	/// </summary>
	public DbSet<TitanSkillUpgrade> TitanSkillUpgrades { get; set; }

	/// <summary>
	/// Titan artifact upgrade events
	/// Immutable historical data for titan artifact progression
	/// </summary>
	public DbSet<TitanArtifactUpgrade> TitanArtifactUpgrades { get; set; }

	/// <summary>
	/// Titan skin unlock and upgrade events
	/// Immutable historical data for titan skin collection tracking
	/// </summary>
	public DbSet<TitanSkinUpgrade> TitanSkinUpgrades { get; set; }

	// === Daily Activity Tracking ===

	/// <summary>
	/// Daily quest completion events
	/// Immutable historical data for daily quest tracking
	/// </summary>
	public DbSet<DailyQuestCompletion> DailyQuestCompletions { get; set; }

	/// <summary>
	/// Guild quest completion events
	/// Immutable historical data for guild quest tracking
	/// </summary>
	public DbSet<GuildQuestCompletion> GuildQuestCompletions { get; set; }

	/// <summary>
	/// Daily login reward claims
	/// Immutable historical data for login streak tracking
	/// </summary>
	public DbSet<LoginReward> LoginRewards { get; set; }

	/// <summary>
	/// Aggregated daily activity summaries
	/// Immutable statistical data for daily engagement metrics
	/// </summary>
	public DbSet<DailyActivitySummary> DailyActivitySummaries { get; set; }

	// === Inventory Tracking ===

	/// <summary>
	/// Inventory item usage events (potions, fragments, scrolls consumed)
	/// Immutable historical data for item consumption analytics
	/// </summary>
	public DbSet<InventoryItemUsage> InventoryItemUsages { get; set; }

	/// <summary>
	/// Equipment changes on heroes (equipping, upgrading, evolving)
	/// Immutable historical data for equipment progression tracking
	/// </summary>
	public DbSet<EquipmentChange> EquipmentChanges { get; set; }

	public GameDatabaseContext(DbContextOptions<GameDatabaseContext> options)
		: base(options) {
	}

	/// <summary>
	/// Configure DbContext options including audit interceptor.
	/// Called for each context instance created.
	/// https://learn.microsoft.com/en-us/ef/core/dbcontext-configuration/
	/// </summary>
	/// <param name="optionsBuilder">Options builder for DbContext</param>
	protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder) {
		base.OnConfiguring(optionsBuilder);

		// Add audit interceptor to automatically populate audit fields
		// User context defaults to "System" - can be customized via dependency injection
		optionsBuilder.AddInterceptors(new AuditInterceptor("System"));
	}

	/// <summary>
	/// Configure entity relationships, indexes, and constraints
	/// https://learn.microsoft.com/en-us/ef/core/modeling/
	/// </summary>
	/// <param name="modelBuilder">EF Core model builder</param>
	protected override void OnModelCreating(ModelBuilder modelBuilder) {
		base.OnModelCreating(modelBuilder);

		// Configure PlayerSnapshot
		// Index on timestamp for historical queries
		// Composite index on PlayerId + Timestamp for player-specific history
		modelBuilder.Entity<PlayerSnapshot>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure ArenaBattle
		// Index on timestamp for recent battles
		// Index on OpponentId for opponent analytics
		// Composite index on IsWin + Timestamp for win/loss trends
		modelBuilder.Entity<ArenaBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.OpponentId);
			entity.HasIndex(e => new { e.IsWin, e.Timestamp });
		});

		// Configure GrandArenaBattle
		// Index on timestamp for recent battles
		// Index on OpponentId for matchup analysis
		modelBuilder.Entity<GrandArenaBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.OpponentId);
		});

		// Configure TitanArenaBattle
		// Index on timestamp for recent battles
		// Index on OpponentId for titan matchup analysis
		modelBuilder.Entity<TitanArenaBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.OpponentId);
		});

		// Configure GuildWarBattle
		// Index on timestamp for recent wars
		// Index on WarId for war-specific queries
		modelBuilder.Entity<GuildWarBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.WarId);
		});

		// Configure RaidBossAttack
		// Index on timestamp for recent attacks
		// Index on BossName for boss-specific analytics
		modelBuilder.Entity<RaidBossAttack>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.BossName);
		});

		// Configure ChestOpening
		// Index on timestamp for recent openings
		// Index on ChestType for chest-specific drop rate analytics
		// One-to-many relationship with ChestDrops
		modelBuilder.Entity<ChestOpening>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.ChestType);
			entity.HasMany(e => e.Drops)
				.WithOne(d => d.ChestOpening)
				.HasForeignKey(d => d.ChestOpeningId)
				.OnDelete(DeleteBehavior.Cascade);
		});

		// Configure ChestDrop
		// Index on ItemId for item drop rate queries
		modelBuilder.Entity<ChestDrop>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.ItemId);
		});

		// Configure Opponent
		// Unique index on OpponentId for fast lookups
		// Index on OpponentName for search functionality
		modelBuilder.Entity<Opponent>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.OpponentId).IsUnique();
			entity.HasIndex(e => e.OpponentName);
		});

		// Configure Goal
		// Index on IsCompleted for active goals queries
		// Index on Type for goal categorization
		// Index on CreatedAt for chronological ordering
		// Global query filter: Exclude soft-deleted goals by default
		modelBuilder.Entity<Goal>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.IsCompleted);
			entity.HasIndex(e => e.Type);
			entity.HasIndex(e => e.CreatedAt);
			entity.HasQueryFilter(e => !e.IsDeleted);
		});

		// Configure CalendarEvent
		// Index on EventDate for upcoming events queries
		// Index on IsCompleted for active events
		// Global query filter: Exclude soft-deleted events by default
		modelBuilder.Entity<CalendarEvent>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.EventDate);
			entity.HasIndex(e => e.IsCompleted);
			entity.HasQueryFilter(e => !e.IsDeleted);
		});

		// Configure SyncMetadata
		// Unique index on Key for fast metadata lookups
		modelBuilder.Entity<SyncMetadata>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Key).IsUnique();
		});

		// === Hero, Titan, and Pet Configurations ===

		// Configure Hero
		// Composite index on PlayerId + Timestamp for player roster history
		// Index on HeroId for specific hero tracking across players
		// Index on HeroName for search functionality
		modelBuilder.Entity<Hero>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
			entity.HasIndex(e => e.HeroId);
			entity.HasIndex(e => e.HeroName);
			entity.HasIndex(e => e.Timestamp);
		});

		// Configure Titan
		// Composite index on PlayerId + Timestamp for player titan roster history
		// Index on TitanId for specific titan tracking
		modelBuilder.Entity<Titan>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
			entity.HasIndex(e => e.TitanId);
			entity.HasIndex(e => e.TitanName);
			entity.HasIndex(e => e.Timestamp);
		});

		// Configure Pet
		// Composite index on PlayerId + Timestamp for player pet roster history
		// Index on PetId for specific pet tracking
		modelBuilder.Entity<Pet>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
			entity.HasIndex(e => e.PetId);
			entity.HasIndex(e => e.PetName);
			entity.HasIndex(e => e.Timestamp);
		});

		// Configure InventorySnapshot
		// Composite index on PlayerId + Timestamp for inventory history
		modelBuilder.Entity<InventorySnapshot>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
			entity.HasIndex(e => e.Timestamp);
		});

		// === Activity and Progress Configurations ===

		// Configure QuestCompletion
		// Index on CompletedAt for recent quest queries
		// Index on QuestType for quest type analytics
		// Composite index on PlayerId + CompletedAt for player quest history
		modelBuilder.Entity<QuestCompletion>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.CompletedAt);
			entity.HasIndex(e => e.QuestType);
			entity.HasIndex(e => new { e.PlayerId, e.CompletedAt });
		});

		// Configure MissionProgress
		// Composite index on PlayerId + MissionId for player mission lookup
		// Index on MissionId for mission-specific queries
		modelBuilder.Entity<MissionProgress>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PlayerId, e.MissionId });
			entity.HasIndex(e => e.MissionId);
			entity.HasIndex(e => e.IsHeroic);
		});

		// Configure ShopPurchase
		// Index on PurchasedAt for recent purchase queries
		// Index on ShopType for shop-specific analytics
		// Composite index on PlayerId + PurchasedAt for player purchase history
		modelBuilder.Entity<ShopPurchase>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.PurchasedAt);
			entity.HasIndex(e => e.ShopType);
			entity.HasIndex(e => new { e.PlayerId, e.PurchasedAt });
		});

		// Configure TowerProgress
		// Composite index on PlayerId + TowerType for player tower progress
		// Index on TowerType for tower-specific queries
		modelBuilder.Entity<TowerProgress>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PlayerId, e.TowerType });
			entity.HasIndex(e => e.TowerType);
		});

		// Configure ExpeditionBattle
		// Index on Timestamp for recent expedition battles
		// Index on ExpeditionId for expedition-specific queries
		// Composite index on PlayerId + Timestamp for player expedition history
		modelBuilder.Entity<ExpeditionBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.ExpeditionId);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure ResourceTransaction
		// Index on Timestamp for recent transaction queries
		// Index on ResourceType for resource-specific analytics
		// Composite index on PlayerId + Timestamp for player transaction history
		// Composite index on ResourceType + Source for income/expense analysis
		modelBuilder.Entity<ResourceTransaction>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.ResourceType);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
			entity.HasIndex(e => new { e.ResourceType, e.Source });
		});

		// Configure GuildActivity
		// Index on Timestamp for recent guild activity queries
		// Index on ActivityType for activity-specific analytics
		// Composite index on PlayerId + Timestamp for player guild history
		// Composite index on GuildId + Timestamp for guild-wide activity
		modelBuilder.Entity<GuildActivity>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.ActivityType);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
			entity.HasIndex(e => new { e.GuildId, e.Timestamp });
		});

		// === Hero Upgrade Configurations ===

		// Configure HeroLevelUpgrade
		// Composite index on HeroId + Timestamp for hero-specific history
		// Composite index on PlayerId + Timestamp for player-wide upgrade history
		modelBuilder.Entity<HeroLevelUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.HeroId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure HeroStarUpgrade
		modelBuilder.Entity<HeroStarUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.HeroId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure HeroColorUpgrade
		modelBuilder.Entity<HeroColorUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.HeroId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure HeroSkillUpgrade
		modelBuilder.Entity<HeroSkillUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.HeroId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure HeroArtifactUpgrade
		modelBuilder.Entity<HeroArtifactUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.HeroId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure HeroGlyphUpgrade
		modelBuilder.Entity<HeroGlyphUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.HeroId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure HeroSkinUpgrade
		modelBuilder.Entity<HeroSkinUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.HeroId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// === Titan Upgrade Configurations ===

		// Configure TitanLevelUpgrade
		// Composite index on TitanId + Timestamp for titan-specific history
		// Composite index on PlayerId + Timestamp for player-wide upgrade history
		modelBuilder.Entity<TitanLevelUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.TitanId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure TitanStarUpgrade
		modelBuilder.Entity<TitanStarUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.TitanId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure TitanSkillUpgrade
		modelBuilder.Entity<TitanSkillUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.TitanId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure TitanArtifactUpgrade
		modelBuilder.Entity<TitanArtifactUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.TitanId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure TitanSkinUpgrade
		modelBuilder.Entity<TitanSkinUpgrade>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.TitanId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// === Daily Activity Configurations ===

		// Configure DailyQuestCompletion
		// Index on QuestDate for date-based queries
		// Composite index on PlayerId + QuestDate for player daily quest history
		// Composite index on PlayerId + QuestId + CompletedAt for deduplication
		modelBuilder.Entity<DailyQuestCompletion>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.QuestDate);
			entity.HasIndex(e => new { e.PlayerId, e.QuestDate });
			entity.HasIndex(e => new { e.PlayerId, e.QuestId, e.CompletedAt });
		});

		// Configure GuildQuestCompletion
		// Index on QuestDate for date-based queries
		// Composite index on PlayerId + QuestDate for player guild quest history
		modelBuilder.Entity<GuildQuestCompletion>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.QuestDate);
			entity.HasIndex(e => new { e.PlayerId, e.QuestDate });
			entity.HasIndex(e => new { e.GuildId, e.QuestDate });
		});

		// Configure LoginReward
		// Composite index on PlayerId + ClaimedAt for player login history
		modelBuilder.Entity<LoginReward>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PlayerId, e.ClaimedAt });
		});

		// Configure DailyActivitySummary
		// Composite index on PlayerId + SummaryDate for player daily summaries (unique per day)
		// Index on SummaryDate for date-based queries
		modelBuilder.Entity<DailyActivitySummary>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => new { e.PlayerId, e.SummaryDate }).IsUnique();
			entity.HasIndex(e => e.SummaryDate);
		});

		// === Inventory Tracking Configurations ===

		// Configure InventoryItemUsage
		// Index on Timestamp for recent usage queries
		// Index on Category for item category analytics
		// Composite index on PlayerId + Timestamp for player item usage history
		// Composite index on ItemId + Timestamp for item-specific usage tracking
		modelBuilder.Entity<InventoryItemUsage>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.Category);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
			entity.HasIndex(e => new { e.ItemId, e.Timestamp });
		});

		// Configure EquipmentChange
		// Index on Timestamp for recent equipment change queries
		// Composite index on HeroId + Timestamp for hero equipment history
		// Composite index on PlayerId + Timestamp for player equipment change history
		modelBuilder.Entity<EquipmentChange>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => new { e.HeroId, e.Timestamp });
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});
	}
}
