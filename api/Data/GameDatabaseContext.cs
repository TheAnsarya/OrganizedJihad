using Microsoft.EntityFrameworkCore;
using OrganizedJihad.Api.Data.Models;

namespace OrganizedJihad.Api.Data;

/// <summary>
/// Entity Framework Core database context for Hero Wars game data.
/// Manages all game-related tables and provides access to tracked data.
/// </summary>
public class GameDatabaseContext : DbContext {
	/// <summary>
	/// Player snapshot records showing account state at specific times
	/// </summary>
	public DbSet<PlayerSnapshot> PlayerSnapshots { get; set; }

	/// <summary>
	/// Arena battle records (regular arena)
	/// </summary>
	public DbSet<ArenaBattle> ArenaBattles { get; set; }

	/// <summary>
	/// Grand Arena battle records
	/// </summary>
	public DbSet<GrandArenaBattle> GrandArenaBattles { get; set; }

	/// <summary>
	/// Titan Arena battle records
	/// </summary>
	public DbSet<TitanArenaBattle> TitanArenaBattles { get; set; }

	/// <summary>
	/// Guild War battle records
	/// </summary>
	public DbSet<GuildWarBattle> GuildWarBattles { get; set; }

	/// <summary>
	/// Raid Boss attack records
	/// </summary>
	public DbSet<RaidBossAttack> RaidBossAttacks { get; set; }

	/// <summary>
	/// Chest opening records with drop information
	/// </summary>
	public DbSet<ChestOpening> ChestOpenings { get; set; }

	/// <summary>
	/// Individual items dropped from chests
	/// </summary>
	public DbSet<ChestDrop> ChestDrops { get; set; }

	/// <summary>
	/// Tracked opponents with win/loss records
	/// </summary>
	public DbSet<Opponent> Opponents { get; set; }

	/// <summary>
	/// User goals (short-term and long-term)
	/// </summary>
	public DbSet<Goal> Goals { get; set; }

	/// <summary>
	/// Calendar events and reminders
	/// </summary>
	public DbSet<CalendarEvent> CalendarEvents { get; set; }

	/// <summary>
	/// Sync metadata to track last sync with browser
	/// </summary>
	public DbSet<SyncMetadata> SyncMetadata { get; set; }

	public GameDatabaseContext(DbContextOptions<GameDatabaseContext> options)
		: base(options) {
	}

	protected override void OnModelCreating(ModelBuilder modelBuilder) {
		base.OnModelCreating(modelBuilder);

		// Configure PlayerSnapshot
		modelBuilder.Entity<PlayerSnapshot>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => new { e.PlayerId, e.Timestamp });
		});

		// Configure ArenaBattle
		modelBuilder.Entity<ArenaBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.OpponentId);
			entity.HasIndex(e => new { e.IsWin, e.Timestamp });
		});

		// Configure GrandArenaBattle
		modelBuilder.Entity<GrandArenaBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.OpponentId);
		});

		// Configure TitanArenaBattle
		modelBuilder.Entity<TitanArenaBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.OpponentId);
		});

		// Configure GuildWarBattle
		modelBuilder.Entity<GuildWarBattle>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.WarId);
		});

		// Configure RaidBossAttack
		modelBuilder.Entity<RaidBossAttack>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Timestamp);
			entity.HasIndex(e => e.BossName);
		});

		// Configure ChestOpening
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
		modelBuilder.Entity<ChestDrop>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.ItemId);
		});

		// Configure Opponent
		modelBuilder.Entity<Opponent>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.OpponentId).IsUnique();
			entity.HasIndex(e => e.OpponentName);
		});

		// Configure Goal
		modelBuilder.Entity<Goal>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.IsCompleted);
			entity.HasIndex(e => e.Type);
			entity.HasIndex(e => e.CreatedAt);
		});

		// Configure CalendarEvent
		modelBuilder.Entity<CalendarEvent>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.EventDate);
			entity.HasIndex(e => e.IsCompleted);
		});

		// Configure SyncMetadata
		modelBuilder.Entity<SyncMetadata>(entity => {
			entity.HasKey(e => e.Id);
			entity.HasIndex(e => e.Key).IsUnique();
		});
	}
}
