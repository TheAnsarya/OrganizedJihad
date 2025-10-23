using Microsoft.EntityFrameworkCore.Migrations;
using System;

#nullable disable

namespace OrganizedJihad.Data.Migrations;

/// <inheritdoc />
public partial class InitialCreateWithAudit : Migration {
	/// <inheritdoc />
	protected override void Up(MigrationBuilder migrationBuilder) {
		migrationBuilder.CreateTable(
			name: "ArenaBattles",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
				OpponentId = table.Column<long>(type: "INTEGER", nullable: false),
				OpponentName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				OpponentPower = table.Column<int>(type: "INTEGER", nullable: false),
				IsWin = table.Column<bool>(type: "INTEGER", nullable: false),
				RankBefore = table.Column<int>(type: "INTEGER", nullable: false),
				RankAfter = table.Column<int>(type: "INTEGER", nullable: false),
				OurTeam = table.Column<string>(type: "TEXT", nullable: true),
				OpponentTeam = table.Column<string>(type: "TEXT", nullable: true),
				DurationSeconds = table.Column<int>(type: "INTEGER", nullable: true),
				CoinsEarned = table.Column<int>(type: "INTEGER", nullable: false),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_ArenaBattles", x => x.Id));

		migrationBuilder.CreateTable(
			name: "CalendarEvents",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Title = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
				Description = table.Column<string>(type: "TEXT", nullable: true),
				Type = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
				EventDate = table.Column<DateTime>(type: "TEXT", nullable: false),
				DurationMinutes = table.Column<int>(type: "INTEGER", nullable: true),
				EnableReminders = table.Column<bool>(type: "INTEGER", nullable: false),
				ReminderMinutesBefore = table.Column<int>(type: "INTEGER", nullable: true),
				IsCompleted = table.Column<bool>(type: "INTEGER", nullable: false),
				IsRecurring = table.Column<bool>(type: "INTEGER", nullable: false),
				RecurrencePattern = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
				CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
				Notes = table.Column<string>(type: "TEXT", nullable: true),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				DateModified = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
				ModifiedBy = table.Column<string>(type: "TEXT", nullable: true),
				IsDeleted = table.Column<bool>(type: "INTEGER", nullable: false),
				DateDeleted = table.Column<DateTime>(type: "TEXT", nullable: true),
				DeletedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_CalendarEvents", x => x.Id));

		migrationBuilder.CreateTable(
			name: "ChestOpenings",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
				ChestType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
				OpenMethod = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
				Quantity = table.Column<int>(type: "INTEGER", nullable: false),
				TotalValue = table.Column<int>(type: "INTEGER", nullable: true),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_ChestOpenings", x => x.Id));

		migrationBuilder.CreateTable(
			name: "Goals",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Title = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
				Description = table.Column<string>(type: "TEXT", nullable: true),
				Type = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
				Category = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
				TargetValue = table.Column<int>(type: "INTEGER", nullable: true),
				CurrentValue = table.Column<int>(type: "INTEGER", nullable: true),
				Unit = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
				IsCompleted = table.Column<bool>(type: "INTEGER", nullable: false),
				CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
				TargetDate = table.Column<DateTime>(type: "TEXT", nullable: true),
				CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
				Priority = table.Column<int>(type: "INTEGER", nullable: false),
				Notes = table.Column<string>(type: "TEXT", nullable: true),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				DateModified = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
				ModifiedBy = table.Column<string>(type: "TEXT", nullable: true),
				IsDeleted = table.Column<bool>(type: "INTEGER", nullable: false),
				DateDeleted = table.Column<DateTime>(type: "TEXT", nullable: true),
				DeletedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_Goals", x => x.Id));

		migrationBuilder.CreateTable(
			name: "GrandArenaBattles",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
				OpponentId = table.Column<long>(type: "INTEGER", nullable: false),
				OpponentName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				OpponentPower = table.Column<int>(type: "INTEGER", nullable: false),
				IsWin = table.Column<bool>(type: "INTEGER", nullable: false),
				RankBefore = table.Column<int>(type: "INTEGER", nullable: false),
				RankAfter = table.Column<int>(type: "INTEGER", nullable: false),
				AttackTeam = table.Column<string>(type: "TEXT", nullable: true),
				DefenseTeam = table.Column<string>(type: "TEXT", nullable: true),
				OpponentAttackTeam = table.Column<string>(type: "TEXT", nullable: true),
				OpponentDefenseTeam = table.Column<string>(type: "TEXT", nullable: true),
				DurationSeconds = table.Column<int>(type: "INTEGER", nullable: true),
				CoinsEarned = table.Column<int>(type: "INTEGER", nullable: false),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_GrandArenaBattles", x => x.Id));

		migrationBuilder.CreateTable(
			name: "GuildWarBattles",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
				WarId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
				EnemyGuildName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				FortificationNumber = table.Column<int>(type: "INTEGER", nullable: false),
				IsWin = table.Column<bool>(type: "INTEGER", nullable: false),
				OurTeam = table.Column<string>(type: "TEXT", nullable: true),
				DefenderTeam = table.Column<string>(type: "TEXT", nullable: true),
				DurationSeconds = table.Column<int>(type: "INTEGER", nullable: true),
				StarsEarned = table.Column<int>(type: "INTEGER", nullable: false),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_GuildWarBattles", x => x.Id));

		migrationBuilder.CreateTable(
			name: "Opponents",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				OpponentId = table.Column<long>(type: "INTEGER", nullable: false),
				OpponentName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				LastKnownPower = table.Column<int>(type: "INTEGER", nullable: false),
				LastKnownRank = table.Column<int>(type: "INTEGER", nullable: true),
				GuildName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
				TotalWins = table.Column<int>(type: "INTEGER", nullable: false),
				TotalLosses = table.Column<int>(type: "INTEGER", nullable: false),
				ArenaWins = table.Column<int>(type: "INTEGER", nullable: false),
				ArenaLosses = table.Column<int>(type: "INTEGER", nullable: false),
				GrandArenaWins = table.Column<int>(type: "INTEGER", nullable: false),
				GrandArenaLosses = table.Column<int>(type: "INTEGER", nullable: false),
				TitanArenaWins = table.Column<int>(type: "INTEGER", nullable: false),
				TitanArenaLosses = table.Column<int>(type: "INTEGER", nullable: false),
				FirstSeen = table.Column<DateTime>(type: "TEXT", nullable: false),
				LastSeen = table.Column<DateTime>(type: "TEXT", nullable: false),
				LastKnownTeam = table.Column<string>(type: "TEXT", nullable: true),
				Notes = table.Column<string>(type: "TEXT", nullable: true),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				DateModified = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
				ModifiedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_Opponents", x => x.Id));

		migrationBuilder.CreateTable(
			name: "PlayerSnapshots",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
				PlayerName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
				Level = table.Column<int>(type: "INTEGER", nullable: false),
				TeamPower = table.Column<int>(type: "INTEGER", nullable: false),
				Gold = table.Column<long>(type: "INTEGER", nullable: false),
				Emeralds = table.Column<int>(type: "INTEGER", nullable: false),
				ArenaCoins = table.Column<int>(type: "INTEGER", nullable: false),
				GrandArenaCoins = table.Column<int>(type: "INTEGER", nullable: false),
				TitanArenaCoins = table.Column<int>(type: "INTEGER", nullable: false),
				GuildCoins = table.Column<int>(type: "INTEGER", nullable: false),
				HeroExpPotions = table.Column<int>(type: "INTEGER", nullable: false),
				TitanExpPotions = table.Column<int>(type: "INTEGER", nullable: false),
				ArenaRank = table.Column<int>(type: "INTEGER", nullable: true),
				GrandArenaRank = table.Column<int>(type: "INTEGER", nullable: true),
				TitanArenaRank = table.Column<int>(type: "INTEGER", nullable: true),
				GuildName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
				TeamComposition = table.Column<string>(type: "TEXT", nullable: true),
				TitanTeam = table.Column<string>(type: "TEXT", nullable: true),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_PlayerSnapshots", x => x.Id));

		migrationBuilder.CreateTable(
			name: "RaidBossAttacks",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
				BossName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				Difficulty = table.Column<int>(type: "INTEGER", nullable: false),
				DamageDealt = table.Column<long>(type: "INTEGER", nullable: false),
				AttackTeam = table.Column<string>(type: "TEXT", nullable: true),
				Rewards = table.Column<string>(type: "TEXT", nullable: true),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_RaidBossAttacks", x => x.Id));

		migrationBuilder.CreateTable(
			name: "SyncMetadata",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Key = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				Value = table.Column<string>(type: "TEXT", nullable: false),
				UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
				Notes = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_SyncMetadata", x => x.Id));

		migrationBuilder.CreateTable(
			name: "TitanArenaBattles",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
				OpponentId = table.Column<long>(type: "INTEGER", nullable: false),
				OpponentName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				OpponentPower = table.Column<int>(type: "INTEGER", nullable: false),
				IsWin = table.Column<bool>(type: "INTEGER", nullable: false),
				RankBefore = table.Column<int>(type: "INTEGER", nullable: false),
				RankAfter = table.Column<int>(type: "INTEGER", nullable: false),
				OurTitanTeam = table.Column<string>(type: "TEXT", nullable: true),
				OpponentTitanTeam = table.Column<string>(type: "TEXT", nullable: true),
				DurationSeconds = table.Column<int>(type: "INTEGER", nullable: true),
				CoinsEarned = table.Column<int>(type: "INTEGER", nullable: false),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => table.PrimaryKey("PK_TitanArenaBattles", x => x.Id));

		migrationBuilder.CreateTable(
			name: "ChestDrops",
			columns: table => new {
				Id = table.Column<int>(type: "INTEGER", nullable: false)
					.Annotation("Sqlite:Autoincrement", true),
				ChestOpeningId = table.Column<int>(type: "INTEGER", nullable: false),
				ItemId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
				ItemName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
				Quantity = table.Column<int>(type: "INTEGER", nullable: false),
				Rarity = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
				ItemType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
				EstimatedValue = table.Column<int>(type: "INTEGER", nullable: true),
				DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
				CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
			},
			constraints: table => {
				table.PrimaryKey("PK_ChestDrops", x => x.Id);
				table.ForeignKey(
					name: "FK_ChestDrops_ChestOpenings_ChestOpeningId",
					column: x => x.ChestOpeningId,
					principalTable: "ChestOpenings",
					principalColumn: "Id",
					onDelete: ReferentialAction.Cascade);
			});

		migrationBuilder.CreateIndex(
			name: "IX_ArenaBattles_IsWin_Timestamp",
			table: "ArenaBattles",
			columns: new[] { "IsWin", "Timestamp" });

		migrationBuilder.CreateIndex(
			name: "IX_ArenaBattles_OpponentId",
			table: "ArenaBattles",
			column: "OpponentId");

		migrationBuilder.CreateIndex(
			name: "IX_ArenaBattles_Timestamp",
			table: "ArenaBattles",
			column: "Timestamp");

		migrationBuilder.CreateIndex(
			name: "IX_CalendarEvents_EventDate",
			table: "CalendarEvents",
			column: "EventDate");

		migrationBuilder.CreateIndex(
			name: "IX_CalendarEvents_IsCompleted",
			table: "CalendarEvents",
			column: "IsCompleted");

		migrationBuilder.CreateIndex(
			name: "IX_ChestDrops_ChestOpeningId",
			table: "ChestDrops",
			column: "ChestOpeningId");

		migrationBuilder.CreateIndex(
			name: "IX_ChestDrops_ItemId",
			table: "ChestDrops",
			column: "ItemId");

		migrationBuilder.CreateIndex(
			name: "IX_ChestOpenings_ChestType",
			table: "ChestOpenings",
			column: "ChestType");

		migrationBuilder.CreateIndex(
			name: "IX_ChestOpenings_Timestamp",
			table: "ChestOpenings",
			column: "Timestamp");

		migrationBuilder.CreateIndex(
			name: "IX_Goals_CreatedAt",
			table: "Goals",
			column: "CreatedAt");

		migrationBuilder.CreateIndex(
			name: "IX_Goals_IsCompleted",
			table: "Goals",
			column: "IsCompleted");

		migrationBuilder.CreateIndex(
			name: "IX_Goals_Type",
			table: "Goals",
			column: "Type");

		migrationBuilder.CreateIndex(
			name: "IX_GrandArenaBattles_OpponentId",
			table: "GrandArenaBattles",
			column: "OpponentId");

		migrationBuilder.CreateIndex(
			name: "IX_GrandArenaBattles_Timestamp",
			table: "GrandArenaBattles",
			column: "Timestamp");

		migrationBuilder.CreateIndex(
			name: "IX_GuildWarBattles_Timestamp",
			table: "GuildWarBattles",
			column: "Timestamp");

		migrationBuilder.CreateIndex(
			name: "IX_GuildWarBattles_WarId",
			table: "GuildWarBattles",
			column: "WarId");

		migrationBuilder.CreateIndex(
			name: "IX_Opponents_OpponentId",
			table: "Opponents",
			column: "OpponentId",
			unique: true);

		migrationBuilder.CreateIndex(
			name: "IX_Opponents_OpponentName",
			table: "Opponents",
			column: "OpponentName");

		migrationBuilder.CreateIndex(
			name: "IX_PlayerSnapshots_PlayerId_Timestamp",
			table: "PlayerSnapshots",
			columns: new[] { "PlayerId", "Timestamp" });

		migrationBuilder.CreateIndex(
			name: "IX_PlayerSnapshots_Timestamp",
			table: "PlayerSnapshots",
			column: "Timestamp");

		migrationBuilder.CreateIndex(
			name: "IX_RaidBossAttacks_BossName",
			table: "RaidBossAttacks",
			column: "BossName");

		migrationBuilder.CreateIndex(
			name: "IX_RaidBossAttacks_Timestamp",
			table: "RaidBossAttacks",
			column: "Timestamp");

		migrationBuilder.CreateIndex(
			name: "IX_SyncMetadata_Key",
			table: "SyncMetadata",
			column: "Key",
			unique: true);

		migrationBuilder.CreateIndex(
			name: "IX_TitanArenaBattles_OpponentId",
			table: "TitanArenaBattles",
			column: "OpponentId");

		migrationBuilder.CreateIndex(
			name: "IX_TitanArenaBattles_Timestamp",
			table: "TitanArenaBattles",
			column: "Timestamp");
	}

	/// <inheritdoc />
	protected override void Down(MigrationBuilder migrationBuilder) {
		migrationBuilder.DropTable(
			name: "ArenaBattles");

		migrationBuilder.DropTable(
			name: "CalendarEvents");

		migrationBuilder.DropTable(
			name: "ChestDrops");

		migrationBuilder.DropTable(
			name: "Goals");

		migrationBuilder.DropTable(
			name: "GrandArenaBattles");

		migrationBuilder.DropTable(
			name: "GuildWarBattles");

		migrationBuilder.DropTable(
			name: "Opponents");

		migrationBuilder.DropTable(
			name: "PlayerSnapshots");

		migrationBuilder.DropTable(
			name: "RaidBossAttacks");

		migrationBuilder.DropTable(
			name: "SyncMetadata");

		migrationBuilder.DropTable(
			name: "TitanArenaBattles");

		migrationBuilder.DropTable(
			name: "ChestOpenings");
	}
}
