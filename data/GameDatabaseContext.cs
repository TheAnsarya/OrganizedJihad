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
	}
}
