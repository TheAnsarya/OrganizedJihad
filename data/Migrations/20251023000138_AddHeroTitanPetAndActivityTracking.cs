using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizedJihad.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHeroTitanPetAndActivityTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ExpeditionBattles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ExpeditionId = table.Column<string>(type: "TEXT", nullable: false),
                    BossId = table.Column<int>(type: "INTEGER", nullable: false),
                    BossName = table.Column<string>(type: "TEXT", nullable: false),
                    IsWin = table.Column<bool>(type: "INTEGER", nullable: false),
                    TeamComposition = table.Column<string>(type: "TEXT", nullable: true),
                    DamageDealt = table.Column<int>(type: "INTEGER", nullable: false),
                    RewardData = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExpeditionBattles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuildActivities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    GuildId = table.Column<long>(type: "INTEGER", nullable: false),
                    GuildName = table.Column<string>(type: "TEXT", nullable: false),
                    ActivityType = table.Column<string>(type: "TEXT", nullable: false),
                    ActivityData = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuildActivities", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Heroes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    HeroId = table.Column<long>(type: "INTEGER", nullable: false),
                    HeroName = table.Column<string>(type: "TEXT", nullable: false),
                    Level = table.Column<int>(type: "INTEGER", nullable: false),
                    Stars = table.Column<int>(type: "INTEGER", nullable: false),
                    Color = table.Column<int>(type: "INTEGER", nullable: false),
                    Power = table.Column<int>(type: "INTEGER", nullable: false),
                    Skins = table.Column<int>(type: "INTEGER", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    SkillLevel1 = table.Column<int>(type: "INTEGER", nullable: false),
                    SkillLevel2 = table.Column<int>(type: "INTEGER", nullable: false),
                    SkillLevel3 = table.Column<int>(type: "INTEGER", nullable: false),
                    SkillLevel4 = table.Column<int>(type: "INTEGER", nullable: false),
                    ArtifactWeapon = table.Column<int>(type: "INTEGER", nullable: false),
                    ArtifactBook = table.Column<int>(type: "INTEGER", nullable: false),
                    ArtifactRing = table.Column<int>(type: "INTEGER", nullable: false),
                    GlyphData = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Heroes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InventorySnapshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    InventoryData = table.Column<string>(type: "TEXT", nullable: false),
                    TotalHeroSoulStones = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalTitanSoulStones = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalPetSoulStones = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalEvolutionItems = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalConsumables = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalChests = table.Column<int>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventorySnapshots", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MissionProgress",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    MissionId = table.Column<string>(type: "TEXT", nullable: false),
                    MissionName = table.Column<string>(type: "TEXT", nullable: false),
                    Stars = table.Column<int>(type: "INTEGER", nullable: false),
                    HighestLevel = table.Column<int>(type: "INTEGER", nullable: false),
                    IsHeroic = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastCompleted = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletionCount = table.Column<int>(type: "INTEGER", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DateModified = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    ModifiedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MissionProgress", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Pets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PetId = table.Column<long>(type: "INTEGER", nullable: false),
                    PetName = table.Column<string>(type: "TEXT", nullable: false),
                    Stars = table.Column<int>(type: "INTEGER", nullable: false),
                    Power = table.Column<int>(type: "INTEGER", nullable: false),
                    Level = table.Column<int>(type: "INTEGER", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    PatronageData = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "QuestCompletions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    QuestType = table.Column<string>(type: "TEXT", nullable: false),
                    QuestId = table.Column<string>(type: "TEXT", nullable: false),
                    QuestName = table.Column<string>(type: "TEXT", nullable: false),
                    RewardData = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuestCompletions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ResourceTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ResourceType = table.Column<string>(type: "TEXT", nullable: false),
                    Amount = table.Column<int>(type: "INTEGER", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: false),
                    SourceDetail = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ResourceTransactions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ShopPurchases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PurchasedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ShopType = table.Column<string>(type: "TEXT", nullable: false),
                    ItemId = table.Column<string>(type: "TEXT", nullable: false),
                    ItemName = table.Column<string>(type: "TEXT", nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    CostType = table.Column<string>(type: "TEXT", nullable: false),
                    CostAmount = table.Column<int>(type: "INTEGER", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShopPurchases", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Titans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TitanId = table.Column<long>(type: "INTEGER", nullable: false),
                    TitanName = table.Column<string>(type: "TEXT", nullable: false),
                    Level = table.Column<int>(type: "INTEGER", nullable: false),
                    Stars = table.Column<int>(type: "INTEGER", nullable: false),
                    Power = table.Column<int>(type: "INTEGER", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    SkillLevel = table.Column<int>(type: "INTEGER", nullable: false),
                    ArtifactData = table.Column<string>(type: "TEXT", nullable: true),
                    SummonStars = table.Column<int>(type: "INTEGER", nullable: false),
                    Element = table.Column<string>(type: "TEXT", nullable: true),
                    SkinLevel = table.Column<int>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Titans", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TowerProgress",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    TowerType = table.Column<string>(type: "TEXT", nullable: false),
                    HighestFloor = table.Column<int>(type: "INTEGER", nullable: false),
                    LastUpdate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    FloorData = table.Column<string>(type: "TEXT", nullable: true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DateModified = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true),
                    ModifiedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TowerProgress", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExpeditionBattles_ExpeditionId",
                table: "ExpeditionBattles",
                column: "ExpeditionId");

            migrationBuilder.CreateIndex(
                name: "IX_ExpeditionBattles_PlayerId_Timestamp",
                table: "ExpeditionBattles",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_ExpeditionBattles_Timestamp",
                table: "ExpeditionBattles",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_GuildActivities_ActivityType",
                table: "GuildActivities",
                column: "ActivityType");

            migrationBuilder.CreateIndex(
                name: "IX_GuildActivities_GuildId_Timestamp",
                table: "GuildActivities",
                columns: new[] { "GuildId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_GuildActivities_PlayerId_Timestamp",
                table: "GuildActivities",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_GuildActivities_Timestamp",
                table: "GuildActivities",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_Heroes_HeroId",
                table: "Heroes",
                column: "HeroId");

            migrationBuilder.CreateIndex(
                name: "IX_Heroes_HeroName",
                table: "Heroes",
                column: "HeroName");

            migrationBuilder.CreateIndex(
                name: "IX_Heroes_PlayerId_Timestamp",
                table: "Heroes",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_Heroes_Timestamp",
                table: "Heroes",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_InventorySnapshots_PlayerId_Timestamp",
                table: "InventorySnapshots",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_InventorySnapshots_Timestamp",
                table: "InventorySnapshots",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_MissionProgress_IsHeroic",
                table: "MissionProgress",
                column: "IsHeroic");

            migrationBuilder.CreateIndex(
                name: "IX_MissionProgress_MissionId",
                table: "MissionProgress",
                column: "MissionId");

            migrationBuilder.CreateIndex(
                name: "IX_MissionProgress_PlayerId_MissionId",
                table: "MissionProgress",
                columns: new[] { "PlayerId", "MissionId" });

            migrationBuilder.CreateIndex(
                name: "IX_Pets_PetId",
                table: "Pets",
                column: "PetId");

            migrationBuilder.CreateIndex(
                name: "IX_Pets_PetName",
                table: "Pets",
                column: "PetName");

            migrationBuilder.CreateIndex(
                name: "IX_Pets_PlayerId_Timestamp",
                table: "Pets",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_Pets_Timestamp",
                table: "Pets",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_QuestCompletions_CompletedAt",
                table: "QuestCompletions",
                column: "CompletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_QuestCompletions_PlayerId_CompletedAt",
                table: "QuestCompletions",
                columns: new[] { "PlayerId", "CompletedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_QuestCompletions_QuestType",
                table: "QuestCompletions",
                column: "QuestType");

            migrationBuilder.CreateIndex(
                name: "IX_ResourceTransactions_PlayerId_Timestamp",
                table: "ResourceTransactions",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_ResourceTransactions_ResourceType",
                table: "ResourceTransactions",
                column: "ResourceType");

            migrationBuilder.CreateIndex(
                name: "IX_ResourceTransactions_ResourceType_Source",
                table: "ResourceTransactions",
                columns: new[] { "ResourceType", "Source" });

            migrationBuilder.CreateIndex(
                name: "IX_ResourceTransactions_Timestamp",
                table: "ResourceTransactions",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_ShopPurchases_PlayerId_PurchasedAt",
                table: "ShopPurchases",
                columns: new[] { "PlayerId", "PurchasedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ShopPurchases_PurchasedAt",
                table: "ShopPurchases",
                column: "PurchasedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ShopPurchases_ShopType",
                table: "ShopPurchases",
                column: "ShopType");

            migrationBuilder.CreateIndex(
                name: "IX_Titans_PlayerId_Timestamp",
                table: "Titans",
                columns: new[] { "PlayerId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_Titans_Timestamp",
                table: "Titans",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_Titans_TitanId",
                table: "Titans",
                column: "TitanId");

            migrationBuilder.CreateIndex(
                name: "IX_Titans_TitanName",
                table: "Titans",
                column: "TitanName");

            migrationBuilder.CreateIndex(
                name: "IX_TowerProgress_PlayerId_TowerType",
                table: "TowerProgress",
                columns: new[] { "PlayerId", "TowerType" });

            migrationBuilder.CreateIndex(
                name: "IX_TowerProgress_TowerType",
                table: "TowerProgress",
                column: "TowerType");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ExpeditionBattles");

            migrationBuilder.DropTable(
                name: "GuildActivities");

            migrationBuilder.DropTable(
                name: "Heroes");

            migrationBuilder.DropTable(
                name: "InventorySnapshots");

            migrationBuilder.DropTable(
                name: "MissionProgress");

            migrationBuilder.DropTable(
                name: "Pets");

            migrationBuilder.DropTable(
                name: "QuestCompletions");

            migrationBuilder.DropTable(
                name: "ResourceTransactions");

            migrationBuilder.DropTable(
                name: "ShopPurchases");

            migrationBuilder.DropTable(
                name: "Titans");

            migrationBuilder.DropTable(
                name: "TowerProgress");
        }
    }
}
