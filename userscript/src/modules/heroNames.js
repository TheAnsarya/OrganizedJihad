/**
 * @fileoverview Static hero/titan/pet ID-to-name mapping.
 *
 * The Hero Wars API does NOT include hero names in responses — names are
 * resolved client-side via the game's translation system (LIB_HERO_NAME_{id}).
 * This dictionary provides the English display names for all known heroes,
 * titans, and pets.
 *
 * Source: HeroWarsHelper (HWA) 3.3.3 reference data, updated 2026-02-23.
 *
 * @module heroNames
 */

/**
 * Map of game entity ID → display name.
 * Covers heroes (1–70), titans (4000–4043), and pets (6000–6009).
 *
 * @type {Object<number, string>}
 */
const HERO_NAMES = {
	// ── Heroes ───────────────────────────────────────────────────────────
	1: 'Aurora',
	2: 'Galahad',
	3: 'Keira',
	4: 'Astaroth',
	5: 'Kai',
	6: 'Phobos',
	7: 'Thea',
	8: 'Daredevil',
	9: 'Heidi',
	10: 'Faceless',
	11: 'Chabba',
	12: 'Arachne',
	13: 'Orion',
	14: 'Fox',
	15: 'Ginger',
	16: 'Dante',
	17: 'Mojo',
	18: 'Judge',
	19: 'Dark Star',
	20: 'Artemis',
	21: 'Markus',
	22: 'Peppy',
	23: 'Lian',
	24: 'Cleaver',
	25: 'Ishmael',
	26: 'Lilith',
	27: 'Luther',
	28: 'Qing Mao',
	29: 'Dorian',
	30: 'Cornelius',
	31: 'Jet',
	32: 'Helios',
	33: 'Lars',
	34: 'Krista',
	35: 'Jorgen',
	36: 'Maya',
	37: 'Jhu',
	38: 'Elmir',
	39: 'Ziri',
	40: 'Nebula',
	41: "K'arkh",
	42: 'Rufus',
	43: 'Celeste',
	44: 'Astrid & Lucas',
	45: 'Satori',
	46: 'Martha',
	47: 'Andvari',
	48: 'Sebastian',
	49: 'Yasmine',
	50: 'Corvus',
	51: 'Morrigan',
	52: 'Isaac',
	53: 'Alvanor',
	54: 'Tristan',
	55: 'Iris',
	56: 'Amira',
	57: 'Fafnir',
	58: 'Aidan',
	59: 'Kayla',
	60: 'Mushy & Shroom',
	61: 'Julius',
	62: 'Polaris',
	63: 'Lara Croft',
	64: 'Augustus',
	65: 'Ninja Turtles',
	66: 'Folio',
	67: 'Lyria',
	68: 'Guus',
	69: 'Cascade',
	70: 'Un1',

	// ── Titans ────────────────────────────────────────────────────────────
	4000: 'Sigurd',
	4001: 'Nova',
	4002: 'Mairi',
	4003: 'Hyperion',
	4010: 'Moloch',
	4011: 'Vulcan',
	4012: 'Ignis',
	4013: 'Araji',
	4020: 'Angus',
	4021: 'Sylva',
	4022: 'Avalon',
	4023: 'Eden',
	4024: 'Verdoc & Phyto',
	4030: 'Brustar',
	4031: 'Keros',
	4032: 'Mort',
	4033: 'Tenebris',
	4040: 'Rigel',
	4041: 'Amon',
	4042: 'Iyari',
	4043: 'Solaris',

	// ── Pets ──────────────────────────────────────────────────────────────
	6000: 'Fenris',
	6001: 'Oliver',
	6002: 'Merlin',
	6003: 'Mara',
	6004: 'Cain',
	6005: 'Albus',
	6006: 'Axel',
	6007: 'Biscuit',
	6008: 'Khorus',
	6009: 'Vex',
};

/**
 * Resolves a hero/titan/pet ID to its display name.
 * Falls back to "Hero_{id}" if the ID is not in the dictionary.
 *
 * @param {number} id - The game's internal entity ID.
 * @returns {string} The entity's display name or a fallback string.
 */
export function resolveHeroName(id) {
	return HERO_NAMES[id] || `Hero_${id}`;
}

/**
 * Resolves a hero name, preferring a stored name if it's not a
 * fallback pattern (Hero_NNN). Falls back to the static dictionary
 * when the stored name is missing or is a fallback.
 *
 * @param {number} id - The game's internal hero ID.
 * @param {string|null|undefined} storedName - The name from the API or storage.
 * @returns {string} The best available display name.
 */
export function resolveHeroNameWithFallback(id, storedName) {
	if (storedName && !storedName.startsWith('Hero_')) {
		return storedName;
	}
	return resolveHeroName(id);
}

export default HERO_NAMES;
