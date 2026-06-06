using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizedJihad.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMailAndAirshipTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AirshipGifts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    GiftId = table.Column<string>(type: "TEXT", maxLength: 96, nullable: false),
                    SourceType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    RewardSummaryText = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    RewardsJson = table.Column<string>(type: "TEXT", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AirshipGifts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MailMessages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    MailId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    MailType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SenderId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    SenderName = table.Column<string>(type: "TEXT", maxLength: 128, nullable: false),
                    Subject = table.Column<string>(type: "TEXT", maxLength: 256, nullable: false),
                    MessageText = table.Column<string>(type: "TEXT", nullable: false),
                    RewardSummaryText = table.Column<string>(type: "TEXT", maxLength: 512, nullable: false),
                    RewardsJson = table.Column<string>(type: "TEXT", nullable: true),
                    ReceivedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IsRead = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsCollected = table.Column<bool>(type: "INTEGER", nullable: false),
                    RawMailJson = table.Column<string>(type: "TEXT", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MailMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MailRewards",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    PlayerId = table.Column<long>(type: "INTEGER", nullable: false),
                    MailId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    MailType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    RewardType = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    RewardId = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Quantity = table.Column<int>(type: "INTEGER", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MailRewards", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AirshipGifts_PlayerId_GiftId_Timestamp",
                table: "AirshipGifts",
                columns: new[] { "PlayerId", "GiftId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_AirshipGifts_Timestamp",
                table: "AirshipGifts",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_MailMessages_PlayerId_MailId_ReceivedAt",
                table: "MailMessages",
                columns: new[] { "PlayerId", "MailId", "ReceivedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_MailMessages_ReceivedAt",
                table: "MailMessages",
                column: "ReceivedAt");

            migrationBuilder.CreateIndex(
                name: "IX_MailRewards_PlayerId_MailId_RewardType_RewardId_Timestamp",
                table: "MailRewards",
                columns: new[] { "PlayerId", "MailId", "RewardType", "RewardId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_MailRewards_Timestamp",
                table: "MailRewards",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AirshipGifts");

            migrationBuilder.DropTable(
                name: "MailMessages");

            migrationBuilder.DropTable(
                name: "MailRewards");
        }
    }
}
