using System.Collections.Frozen;

namespace OrganizedJihad.Data;

/// <summary>
/// Static dictionary mapping game hero/titan/pet IDs to their display names.
/// The Hero Wars API does not include hero names in API responses — names are
/// resolved client-side via the game's translation system (LIB_HERO_NAME_{id}).
/// This dictionary mirrors the mappings used by HeroWarsHelper (HWA) and is
/// used by API and userscript processing layers to resolve "Hero_49" →
/// "Yasmine" etc.
/// <para>
/// Updated 2026-02-23 from HWA 3.3.3 reference data.
/// </para>
/// </summary>
public static class HeroNames {
	/// <summary>
	/// Frozen dictionary of hero ID → display name.
	/// Includes heroes (1–71), titans (4000–4043), and pets (6000–6009).
	/// </summary>
	public static readonly FrozenDictionary<long, string> All = new Dictionary<long, string> {
		// ── Heroes ───────────────────────────────────────────────────────
		[1] = "Aurora",
		[2] = "Galahad",
		[3] = "Keira",
		[4] = "Astaroth",
		[5] = "Kai",
		[6] = "Phobos",
		[7] = "Thea",
		[8] = "Daredevil",
		[9] = "Heidi",
		[10] = "Faceless",
		[11] = "Chabba",
		[12] = "Arachne",
		[13] = "Orion",
		[14] = "Fox",
		[15] = "Ginger",
		[16] = "Dante",
		[17] = "Mojo",
		[18] = "Judge",
		[19] = "Dark Star",
		[20] = "Artemis",
		[21] = "Markus",
		[22] = "Peppy",
		[23] = "Lian",
		[24] = "Cleaver",
		[25] = "Ishmael",
		[26] = "Lilith",
		[27] = "Luther",
		[28] = "Qing Mao",
		[29] = "Dorian",
		[30] = "Cornelius",
		[31] = "Jet",
		[32] = "Helios",
		[33] = "Lars",
		[34] = "Krista",
		[35] = "Jorgen",
		[36] = "Maya",
		[37] = "Jhu",
		[38] = "Elmir",
		[39] = "Ziri",
		[40] = "Nebula",
		[41] = "K'arkh",
		[42] = "Rufus",
		[43] = "Celeste",
		[44] = "Astrid & Lucas",
		[45] = "Satori",
		[46] = "Martha",
		[47] = "Andvari",
		[48] = "Sebastian",
		[49] = "Yasmine",
		[50] = "Corvus",
		[51] = "Morrigan",
		[52] = "Isaac",
		[53] = "Alvanor",
		[54] = "Tristan",
		[55] = "Iris",
		[56] = "Amira",
		[57] = "Fafnir",
		[58] = "Aidan",
		[59] = "Kayla",
		[60] = "Mushy & Shroom",
		[61] = "Julius",
		[62] = "Polaris",
		[63] = "Lara Croft",
		[64] = "Augustus",
		[65] = "Ninja Turtles",
		[66] = "Folio",
		[67] = "Lyria",
		[68] = "Guus",
		[69] = "Cascade",
		[70] = "Un1",
		[71] = "Rosie",

		// ── Titans ───────────────────────────────────────────────────────
		[4000] = "Sigurd",
		[4001] = "Nova",
		[4002] = "Mairi",
		[4003] = "Hyperion",
		[4010] = "Moloch",
		[4011] = "Vulcan",
		[4012] = "Ignis",
		[4013] = "Araji",
		[4020] = "Angus",
		[4021] = "Sylva",
		[4022] = "Avalon",
		[4023] = "Eden",
		[4024] = "Verdoc & Phyto",
		[4030] = "Brustar",
		[4031] = "Keros",
		[4032] = "Mort",
		[4033] = "Tenebris",
		[4040] = "Rigel",
		[4041] = "Amon",
		[4042] = "Iyari",
		[4043] = "Solaris",

		// ── Pets ─────────────────────────────────────────────────────────
		[6000] = "Fenris",
		[6001] = "Oliver",
		[6002] = "Merlin",
		[6003] = "Mara",
		[6004] = "Cain",
		[6005] = "Albus",
		[6006] = "Axel",
		[6007] = "Biscuit",
		[6008] = "Khorus",
		[6009] = "Vex",
	}.ToFrozenDictionary();

	/// <summary>
	/// Resolves a hero ID to its display name.
	/// Falls back to "Hero_{id}" if the ID is not in the dictionary.
	/// </summary>
	/// <param name="heroId">The game's internal hero/titan/pet ID.</param>
	/// <returns>The hero's display name or a fallback string.</returns>
	public static string Resolve(long heroId) =>
		All.TryGetValue(heroId, out var name) ? name : $"Hero_{heroId}";

	/// <summary>
	/// Resolves a hero name, preferring the stored name if it's not a
	/// fallback pattern (Hero_NNN). Falls back to the static dictionary
	/// when the stored name is missing or is a fallback.
	/// </summary>
	/// <param name="heroId">The game's internal hero ID.</param>
	/// <param name="storedName">The name stored in the database.</param>
	/// <returns>The best available display name.</returns>
	public static string ResolveWithFallback(long heroId, string? storedName) {
		// If we have a real name stored (not a fallback), use it
		if (!string.IsNullOrEmpty(storedName) && !storedName.StartsWith("Hero_")) {
			return storedName;
		}
		return Resolve(heroId);
	}

	/// <summary>
	/// Resolves a titan's element based on its ID.
	/// Titan IDs encode the element in the third digit:
	/// 40[0]x = Water, 40[1]x = Fire, 40[2]x = Earth, 40[3]x = Dark, 40[4]x = Light.
	/// </summary>
	/// <param name="titanId">The titan's game ID (4000–4043).</param>
	/// <returns>The element name (water/fire/earth/dark/light) or "unknown".</returns>
	public static string ResolveTitanElement(long titanId) {
		var idStr = titanId.ToString();
		if (idStr.Length >= 3) {
			return idStr[2] switch {
				'0' => "water",
				'1' => "fire",
				'2' => "earth",
				'3' => "dark",
				'4' => "light",
				_ => "unknown",
			};
		}
		return "unknown";
	}
}
