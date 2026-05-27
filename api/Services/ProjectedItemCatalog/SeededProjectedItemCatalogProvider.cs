using OrganizedJihad.Api.Models;

namespace OrganizedJihad.Api.Services.ProjectedItemCatalog;

/// <summary>
/// Seeded projected-item catalog provider used by sync metadata endpoints.
/// </summary>
public sealed class SeededProjectedItemCatalogProvider : IProjectedItemCatalogProvider {
	private static readonly IReadOnlyDictionary<string, string> CatalogAliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
		["xp_potion_large"] = "xp_potion_l",
		["xp_potion_medium"] = "xp_potion_m",
		["xp_potion_small"] = "xp_potion_s",
		["red_fragment"] = "item_red_fragment",
		["orange_fragment"] = "item_orange_fragment",
		["violet_fragment"] = "item_violet_fragment",
		["green_fragment"] = "item_green_fragment",
		["blue_fragment"] = "item_blue_fragment",
		["gold"] = "gold_coin",
		["coin_gold"] = "gold_coin",
	};

	private static readonly IReadOnlyList<ProjectedItemCatalogEntry> CatalogSeed = [
		new() { ItemId = "xp_potion_l", DisplayName = "Large XP Potion", Category = "consumable", Icon = "🧪" },
		new() { ItemId = "xp_potion_m", DisplayName = "Medium XP Potion", Category = "consumable", Icon = "🧪" },
		new() { ItemId = "xp_potion_s", DisplayName = "Small XP Potion", Category = "consumable", Icon = "🧪" },
		new() { ItemId = "gold_coin", DisplayName = "Gold", Category = "resource", Icon = "🪙" },
		new() { ItemId = "stamina_potion", DisplayName = "Stamina Potion", Category = "consumable", Icon = "🧪" },
		new() { ItemId = "skin_stone", DisplayName = "Skin Stone", Category = "resource", Icon = "📦" },
		new() { ItemId = "rune_stone", DisplayName = "Rune Stone", Category = "resource", Icon = "📦" },
		new() { ItemId = "artifact_essence", DisplayName = "Artifact Essence", Category = "artifact", Icon = "🏺" },
		new() { ItemId = "artifact_scroll", DisplayName = "Artifact Scroll", Category = "artifact", Icon = "🏺" },
		new() { ItemId = "item_artifact_fragment", DisplayName = "Artifact Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_red_fragment", DisplayName = "Red Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_violet_fragment", DisplayName = "Violet Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_orange_fragment", DisplayName = "Orange Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_green_fragment", DisplayName = "Green Fragment", Category = "fragment", Icon = "🧩" },
		new() { ItemId = "item_blue_fragment", DisplayName = "Blue Fragment", Category = "fragment", Icon = "🧩" },
	];

	/// <inheritdoc />
	public ProjectedItemCatalogResponse BuildCatalog() {
		var items = CatalogSeed
			.Select(entry => new ProjectedItemCatalogEntry {
				ItemId = entry.ItemId,
				DisplayName = entry.DisplayName,
				Category = entry.Category,
				Icon = entry.Icon,
			})
			.OrderBy(entry => entry.ItemId)
			.ToList();

		var aliases = CatalogAliases
			.OrderBy(pair => pair.Key)
			.ToDictionary(pair => pair.Key, pair => pair.Value, StringComparer.OrdinalIgnoreCase);

		return new ProjectedItemCatalogResponse {
			GeneratedAtUtc = DateTime.UtcNow,
			Items = items,
			Aliases = aliases,
		};
	}
}
