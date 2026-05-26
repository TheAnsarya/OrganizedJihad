using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizedJihad.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddComprehensiveTrackingEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "DailyActivitySummaries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SummaryDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TotalActivityPoints = table.Column<int>(type: "INTEGER", nullable: false),
                    DailyQuestsCompleted = table.Column<int>(type: "INTEGER", nullable: false),
                    GuildQuestsCompleted = table.Column<int>(type: "INTEGER", nullable: false),
                    ArenaBattlesFought = table.Column<int>(type: "INTEGER", nullable: false),
                    GrandArenaBattlesFought = table.Column<int>(type: "INTEGER", nullable: false),
                    TowerFloorsCleared = table.Column<int>(type: "INTEGER", nullable: false),
                    CampaignMissionsCompleted = table.Column<int>(type: "INTEGER", nullable: false),
                    OutlandBossesFought = table.Column<int>(type: "INTEGER", nullable: false),
                    GoldEarned = table.Column<long>(type: "INTEGER", nullable: false),
                    GoldSpent = table.Column<long>(type: "INTEGER", nullable: false),
                    EmeraldsEarned = table.Column<int>(type: "INTEGER", nullable: false),
                    EmeraldsSpent = table.Column<int>(type: "INTEGER", nullable: false),
                    DailyChestClaimed = table.Column<bool>(type: "INTEGER", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyActivitySummaries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DailyQuestCompletions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    QuestDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    QuestId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    QuestName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    ActivityPoints = table.Column<int>(type: "INTEGER", nullable: false),
                    RewardData = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DailyQuestCompletions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EquipmentChanges",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    SlotIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    EquipmentItemId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    EquipmentName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    ChangeType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    HeroColorRank = table.Column<int>(type: "INTEGER", nullable: false),
                    MaterialsConsumed = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EquipmentChanges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuildQuestCompletions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    QuestDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    QuestId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    QuestName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Difficulty = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    GuildActivityPoints = table.Column<int>(type: "INTEGER", nullable: false),
                    RewardData = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    GuildId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildQuestCompletions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HeroArtifactUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ArtifactType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    ArtifactName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    LevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    LevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    ResourcesConsumed = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HeroArtifactUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HeroColorUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ColorBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    ColorAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    ColorNameBefore = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    ColorNameAfter = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    EquipmentConsumed = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HeroColorUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HeroGlyphUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    GlyphType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    GlyphLevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    GlyphLevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    GoldSpent = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HeroGlyphUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HeroLevelUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    LevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    ExperienceSpent = table.Column<int>(type: "INTEGER", nullable: false),
                    GoldSpent = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HeroLevelUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HeroSkillUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SkillSlot = table.Column<int>(type: "INTEGER", nullable: false),
                    SkillName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    SkillLevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    SkillLevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    GoldSpent = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HeroSkillUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HeroSkinUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SkinName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    SkinId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    IsNewUnlock = table.Column<bool>(type: "INTEGER", nullable: false),
                    LevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    LevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    SkinStonesConsumed = table.Column<int>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HeroSkinUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "HeroStarUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    StarsBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    StarsAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    SoulStonesConsumed = table.Column<int>(type: "INTEGER", nullable: false),
                    GoldSpent = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HeroStarUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InventoryItemUsages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ItemId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    ItemName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Category = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    QuantityUsed = table.Column<int>(type: "INTEGER", nullable: false),
                    QuantityRemaining = table.Column<int>(type: "INTEGER", nullable: false),
                    UsageContext = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    TargetEntity = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryItemUsages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LoginRewards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ClaimedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DayNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    StreakLength = table.Column<int>(type: "INTEGER", nullable: false),
                    IsVipBonus = table.Column<bool>(type: "INTEGER", nullable: false),
                    RewardData = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoginRewards", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TitanArtifactUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ArtifactType = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    ArtifactName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    LevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    LevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    ResourcesConsumed = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TitanId = table.Column<long>(type: "INTEGER", nullable: false),
                    TitanName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitanArtifactUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TitanLevelUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    LevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    LevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    PotionsSpent = table.Column<int>(type: "INTEGER", nullable: false),
                    GoldSpent = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TitanId = table.Column<long>(type: "INTEGER", nullable: false),
                    TitanName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitanLevelUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TitanSkillUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SkillName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    SkillLevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    SkillLevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    TitaniteSpent = table.Column<int>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TitanId = table.Column<long>(type: "INTEGER", nullable: false),
                    TitanName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitanSkillUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TitanSkinUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SkinName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    SkinId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    IsNewUnlock = table.Column<bool>(type: "INTEGER", nullable: false),
                    LevelBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    LevelAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    SkinStonesConsumed = table.Column<int>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TitanId = table.Column<long>(type: "INTEGER", nullable: false),
                    TitanName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitanSkinUpgrades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TitanStarUpgrades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    StarsBefore = table.Column<int>(type: "INTEGER", nullable: false),
                    StarsAfter = table.Column<int>(type: "INTEGER", nullable: false),
                    SoulStonesConsumed = table.Column<int>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TitanId = table.Column<long>(type: "INTEGER", nullable: false),
                    TitanName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PowerAfter = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitanStarUpgrades", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DailyActivitySummaries_PlayerId_SummaryDate",
                table: "DailyActivitySummaries",
                columns: new[] { "PlayerId", "SummaryDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DailyActivitySummaries_SummaryDate",
                table: "DailyActivitySummaries",
                column: "SummaryDate");

            migrationBuilder.CreateIndex(
                name: "IX_DailyQuestCompletions_PlayerId_QuestDate",
                table: "DailyQuestCompletions",
                columns: new[] { "PlayerId", "QuestDate" });

            migrationBuilder.CreateIndex(
                name: "IX_DailyQuestCompletions_PlayerId_QuestId_CompletedAt",
                table: "DailyQuestCompletions",
                columns: new[] { "PlayerId", "QuestId", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_DailyQuestCompletions_QuestDate",
                table: "DailyQuestCompletions",
                column: "QuestDate");

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentChanges_HeroId_Timestamp",
                table: "EquipmentChanges",
                columns: new[] { "HeroId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentChanges_PlayerId_Timestamp",
                table: "EquipmentChanges",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_EquipmentChanges_Timestamp",
                table: "EquipmentChanges",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_GuildQuestCompletions_GuildId_QuestDate",
                table: "GuildQuestCompletions",
                columns: new[] { "GuildId", "QuestDate" });

            migrationBuilder.CreateIndex(
                name: "IX_GuildQuestCompletions_PlayerId_QuestDate",
                table: "GuildQuestCompletions",
                columns: new[] { "PlayerId", "QuestDate" });

            migrationBuilder.CreateIndex(
                name: "IX_GuildQuestCompletions_QuestDate",
                table: "GuildQuestCompletions",
                column: "QuestDate");

            migrationBuilder.CreateIndex(
                name: "IX_HeroArtifactUpgrades_HeroId_Timestamp",
                table: "HeroArtifactUpgrades",
                columns: new[] { "HeroId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroArtifactUpgrades_PlayerId_Timestamp",
                table: "HeroArtifactUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroColorUpgrades_HeroId_Timestamp",
                table: "HeroColorUpgrades",
                columns: new[] { "HeroId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroColorUpgrades_PlayerId_Timestamp",
                table: "HeroColorUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroGlyphUpgrades_HeroId_Timestamp",
                table: "HeroGlyphUpgrades",
                columns: new[] { "HeroId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroGlyphUpgrades_PlayerId_Timestamp",
                table: "HeroGlyphUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroLevelUpgrades_HeroId_Timestamp",
                table: "HeroLevelUpgrades",
                columns: new[] { "HeroId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroLevelUpgrades_PlayerId_Timestamp",
                table: "HeroLevelUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroSkillUpgrades_HeroId_Timestamp",
                table: "HeroSkillUpgrades",
                columns: new[] { "HeroId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroSkillUpgrades_PlayerId_Timestamp",
                table: "HeroSkillUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroSkinUpgrades_HeroId_Timestamp",
                table: "HeroSkinUpgrades",
                columns: new[] { "HeroId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroSkinUpgrades_PlayerId_Timestamp",
                table: "HeroSkinUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroStarUpgrades_HeroId_Timestamp",
                table: "HeroStarUpgrades",
                columns: new[] { "HeroId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_HeroStarUpgrades_PlayerId_Timestamp",
                table: "HeroStarUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItemUsages_Category",
                table: "InventoryItemUsages",
                column: "Category");

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItemUsages_ItemId_Timestamp",
                table: "InventoryItemUsages",
                columns: new[] { "ItemId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItemUsages_PlayerId_Timestamp",
                table: "InventoryItemUsages",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItemUsages_Timestamp",
                table: "InventoryItemUsages",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_LoginRewards_PlayerId_ClaimedAt",
                table: "LoginRewards",
                columns: new[] { "PlayerId", "ClaimedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanArtifactUpgrades_PlayerId_Timestamp",
                table: "TitanArtifactUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanArtifactUpgrades_TitanId_Timestamp",
                table: "TitanArtifactUpgrades",
                columns: new[] { "TitanId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanLevelUpgrades_PlayerId_Timestamp",
                table: "TitanLevelUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanLevelUpgrades_TitanId_Timestamp",
                table: "TitanLevelUpgrades",
                columns: new[] { "TitanId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanSkillUpgrades_PlayerId_Timestamp",
                table: "TitanSkillUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanSkillUpgrades_TitanId_Timestamp",
                table: "TitanSkillUpgrades",
                columns: new[] { "TitanId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanSkinUpgrades_PlayerId_Timestamp",
                table: "TitanSkinUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanSkinUpgrades_TitanId_Timestamp",
                table: "TitanSkinUpgrades",
                columns: new[] { "TitanId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanStarUpgrades_PlayerId_Timestamp",
                table: "TitanStarUpgrades",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_TitanStarUpgrades_TitanId_Timestamp",
                table: "TitanStarUpgrades",
                columns: new[] { "TitanId", "Timestamp" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DailyActivitySummaries");

            migrationBuilder.DropTable(
                name: "DailyQuestCompletions");

            migrationBuilder.DropTable(
                name: "EquipmentChanges");

            migrationBuilder.DropTable(
                name: "GuildQuestCompletions");

            migrationBuilder.DropTable(
                name: "HeroArtifactUpgrades");

            migrationBuilder.DropTable(
                name: "HeroColorUpgrades");

            migrationBuilder.DropTable(
                name: "HeroGlyphUpgrades");

            migrationBuilder.DropTable(
                name: "HeroLevelUpgrades");

            migrationBuilder.DropTable(
                name: "HeroSkillUpgrades");

            migrationBuilder.DropTable(
                name: "HeroSkinUpgrades");

            migrationBuilder.DropTable(
                name: "HeroStarUpgrades");

            migrationBuilder.DropTable(
                name: "InventoryItemUsages");

            migrationBuilder.DropTable(
                name: "LoginRewards");

            migrationBuilder.DropTable(
                name: "TitanArtifactUpgrades");

            migrationBuilder.DropTable(
                name: "TitanLevelUpgrades");

            migrationBuilder.DropTable(
                name: "TitanSkillUpgrades");

            migrationBuilder.DropTable(
                name: "TitanSkinUpgrades");

            migrationBuilder.DropTable(
                name: "TitanStarUpgrades");
        }
    }
}
