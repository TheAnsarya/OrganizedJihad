using OrganizedJihad.Api.Models.Ui;
using System.Net;

namespace OrganizedJihad.Api.Services.Ui;

/// <summary>
/// Builds encoded replacement token maps for UI templates.
/// </summary>
public sealed class ApiUiPageTokenBuilder {
	private readonly ApiLocalUrlBuilder _localUrlBuilder;

	/// <summary>
	/// Initializes a new instance of the page token builder.
	/// </summary>
	public ApiUiPageTokenBuilder(ApiLocalUrlBuilder localUrlBuilder) {
		_localUrlBuilder = localUrlBuilder;
	}

	/// <summary>
	/// Builds replacement tokens for the /ui page.
	/// </summary>
	public Dictionary<string, string> BuildUiTokens(HttpContext context) {
		var baseUrl = _localUrlBuilder.BuildLocalBaseUrl(context);
		return new Dictionary<string, string> {
			["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
		};
	}

	/// <summary>
	/// Builds replacement tokens for the /ui/tray-health page.
	/// </summary>
	public Dictionary<string, string> BuildTrayHealthTokens(HttpContext context, string healthStatus, UserscriptHandshakeStatus handshake, DateTime nowUtc) {
		var baseUrl = _localUrlBuilder.BuildLocalBaseUrl(context);
		return new Dictionary<string, string> {
			["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
			["__HEALTH_STATUS__"] = WebUtility.HtmlEncode(healthStatus),
			["__CHECKED_UTC__"] = WebUtility.HtmlEncode(nowUtc.ToString("yyyy-MM-dd HH:mm:ss")),
			["__HANDSHAKE_STATUS__"] = WebUtility.HtmlEncode(handshake.Status),
			["__LAST_SYNC_UTC__"] = WebUtility.HtmlEncode(handshake.LastSyncUtc is null ? "none" : handshake.LastSyncUtc.Value.ToString("u")),
		};
	}

	/// <summary>
	/// Builds replacement tokens for the /ui/daily-report-page page.
	/// </summary>
	public Dictionary<string, string> BuildDailyReportTokens(HttpContext context, ApiUiDailyReportResponse report) {
		var baseUrl = _localUrlBuilder.BuildLocalBaseUrl(context);
		return new Dictionary<string, string> {
			["__BASE_URL__"] = WebUtility.HtmlEncode(baseUrl),
			["__DATE_UTC__"] = WebUtility.HtmlEncode(report.DateUtc.ToString("yyyy-MM-dd")),
			["__CHECKED_UTC__"] = WebUtility.HtmlEncode(report.CheckedUtc.ToString("yyyy-MM-dd HH:mm:ss")),
			["__LAST_SYNC_UTC__"] = WebUtility.HtmlEncode(report.LastSyncUtc is null ? "none" : report.LastSyncUtc.Value.ToString("u")),
			["__PLAYER_SNAPSHOTS__"] = WebUtility.HtmlEncode(report.PlayerSnapshots.ToString()),
			["__BATTLES_TRACKED__"] = WebUtility.HtmlEncode(report.BattlesTracked.ToString()),
			["__ARENA_BATTLES__"] = WebUtility.HtmlEncode(report.ArenaBattles.ToString()),
			["__GRAND_ARENA_BATTLES__"] = WebUtility.HtmlEncode(report.GrandArenaBattles.ToString()),
			["__TITAN_ARENA_BATTLES__"] = WebUtility.HtmlEncode(report.TitanArenaBattles.ToString()),
			["__GUILD_WAR_BATTLES__"] = WebUtility.HtmlEncode(report.GuildWarBattles.ToString()),
			["__RAID_BOSS_ATTACKS__"] = WebUtility.HtmlEncode(report.RaidBossAttacks.ToString()),
			["__EXPEDITION_BATTLES__"] = WebUtility.HtmlEncode(report.ExpeditionBattles.ToString()),
			["__CHEST_OPENINGS__"] = WebUtility.HtmlEncode(report.ChestOpenings.ToString()),
			["__QUEST_COMPLETIONS__"] = WebUtility.HtmlEncode(report.QuestCompletions.ToString()),
			["__SHOP_PURCHASES__"] = WebUtility.HtmlEncode(report.ShopPurchases.ToString()),
			["__RESOURCE_TRANSACTIONS__"] = WebUtility.HtmlEncode(report.ResourceTransactions.ToString()),
			["__HERO_UPGRADES__"] = WebUtility.HtmlEncode(report.HeroUpgrades.ToString()),
			["__TITAN_UPGRADES__"] = WebUtility.HtmlEncode(report.TitanUpgrades.ToString()),
			["__INVENTORY_ITEM_USAGES__"] = WebUtility.HtmlEncode(report.InventoryItemUsages.ToString()),
			["__CHAT_MESSAGES__"] = WebUtility.HtmlEncode(report.ChatMessages.ToString()),
		};
	}
}
