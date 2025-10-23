using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OrganizedJihad.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddChatTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChatActivitySummaries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    SummaryDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ChatType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    MessagesSent = table.Column<int>(type: "INTEGER", nullable: false),
                    MessagesReceived = table.Column<int>(type: "INTEGER", nullable: false),
                    UniqueContacts = table.Column<int>(type: "INTEGER", nullable: false),
                    ConversationId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    GroupName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatActivitySummaries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ChatType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    ConversationId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                    SenderId = table.Column<long>(type: "INTEGER", nullable: false),
                    SenderName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    RecipientId = table.Column<long>(type: "INTEGER", nullable: true),
                    RecipientName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    MessageText = table.Column<string>(type: "TEXT", nullable: false),
                    MessageMetadata = table.Column<string>(type: "TEXT", nullable: true),
                    IsOutgoing = table.Column<bool>(type: "INTEGER", nullable: false),
                    GuildName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    PartyName = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    ServerMessageId = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    PlayerLevel = table.Column<int>(type: "INTEGER", nullable: true),
                    DateCreated = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessages", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatActivitySummaries");

            migrationBuilder.DropTable(
                name: "ChatMessages");
        }
    }
}
