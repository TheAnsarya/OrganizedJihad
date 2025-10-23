using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizedJihad.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGuildMemberTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GuildDungeonParticipations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    DungeonId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    DungeonDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PlayerName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    GuildId = table.Column<long>(type: "INTEGER", nullable: false),
                    DungeonType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    TitanChargesUsed = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxTitanCharges = table.Column<int>(type: "INTEGER", nullable: false),
                    BattlesFought = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalDamage = table.Column<long>(type: "INTEGER", nullable: false),
                    HighestStage = table.Column<int>(type: "INTEGER", nullable: false),
                    Participated = table.Column<bool>(type: "INTEGER", nullable: false),
                    TitaniteEarned = table.Column<int>(type: "INTEGER", nullable: false),
                    TitanTeam = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildDungeonParticipations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuildMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    GuildId = table.Column<long>(type: "INTEGER", nullable: false),
                    GuildName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PlayerName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Level = table.Column<int>(type: "INTEGER", nullable: false),
                    TeamPower = table.Column<int>(type: "INTEGER", nullable: false),
                    GuildRank = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    VipLevel = table.Column<int>(type: "INTEGER", nullable: true),
                    LastOnline = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsOnline = table.Column<bool>(type: "INTEGER", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    CurrentContribution = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalContribution = table.Column<int>(type: "INTEGER", nullable: false),
                    ArenaRank = table.Column<int>(type: "INTEGER", nullable: true),
                    GrandArenaRank = table.Column<int>(type: "INTEGER", nullable: true),
                    TitanArenaRank = table.Column<int>(type: "INTEGER", nullable: true),
                    Prestige = table.Column<int>(type: "INTEGER", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    HeroRoster = table.Column<string>(type: "TEXT", nullable: true),
                    TitanRoster = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DateModified = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    ModifiedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildMembers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuildMemberSnapshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PlayerName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    GuildId = table.Column<long>(type: "INTEGER", nullable: false),
                    Level = table.Column<int>(type: "INTEGER", nullable: false),
                    TeamPower = table.Column<int>(type: "INTEGER", nullable: false),
                    GuildRank = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Contribution = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalContribution = table.Column<int>(type: "INTEGER", nullable: false),
                    Prestige = table.Column<int>(type: "INTEGER", nullable: false),
                    IsOnline = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastOnline = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildMemberSnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuildRaidParticipations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    RaidId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    RaidDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PlayerName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    GuildId = table.Column<long>(type: "INTEGER", nullable: false),
                    BossName = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    BossLevel = table.Column<int>(type: "INTEGER", nullable: false),
                    BossDamage = table.Column<long>(type: "INTEGER", nullable: false),
                    MinionDamage = table.Column<long>(type: "INTEGER", nullable: false),
                    TotalDamage = table.Column<long>(type: "INTEGER", nullable: false),
                    AttacksMade = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxAttacks = table.Column<int>(type: "INTEGER", nullable: false),
                    Participated = table.Column<bool>(type: "INTEGER", nullable: false),
                    TitaniteEarned = table.Column<int>(type: "INTEGER", nullable: false),
                    GuildRank = table.Column<int>(type: "INTEGER", nullable: true),
                    AttackDetails = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildRaidParticipations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuildWarParticipations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    WarId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    WarDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PlayerName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    GuildId = table.Column<long>(type: "INTEGER", nullable: false),
                    AttacksMade = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxAttacks = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalDamage = table.Column<long>(type: "INTEGER", nullable: false),
                    FortsDefended = table.Column<int>(type: "INTEGER", nullable: false),
                    DefensePoints = table.Column<int>(type: "INTEGER", nullable: false),
                    Participated = table.Column<bool>(type: "INTEGER", nullable: false),
                    WarResult = table.Column<string>(type: "TEXT", maxLength: 10, nullable: true),
                    AttackDetails = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildWarParticipations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TitaniteTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PlayerName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    GuildId = table.Column<long>(type: "INTEGER", nullable: false),
                    TransactionType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    Amount = table.Column<int>(type: "INTEGER", nullable: false),
                    Source = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    PurchaseDescription = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    BalanceAfter = table.Column<int>(type: "INTEGER", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitaniteTransactions", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GuildDungeonParticipations");

            migrationBuilder.DropTable(
                name: "GuildMembers");

            migrationBuilder.DropTable(
                name: "GuildMemberSnapshots");

            migrationBuilder.DropTable(
                name: "GuildRaidParticipations");

            migrationBuilder.DropTable(
                name: "GuildWarParticipations");

            migrationBuilder.DropTable(
                name: "TitaniteTransactions");
        }
    }
}
