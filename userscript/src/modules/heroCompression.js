/**
 * Hero & Titan data compression module.
 *
 * Instead of storing 100+ individual hero records per snapshot (each with
 * duplicated playerId/timestamp), this module compresses an entire roster
 * into a single batch record.  Only fields that differ from a well-known
 * default template are persisted, dramatically reducing IndexedDB storage.
 *
 * Compression format (v1):
 * ```json
 * {
 *   "_compressed": 1,
 *   "playerId": "12345",
 *   "timestamp": "2025-01-23T...",
 *   "heroes": [ { heroId: 1, level: 120, ... }, ... ]  // only non-default fields
 * }
 * ```
 *
 * Decompression is transparent and backward-compatible: records without a
 * `_compressed` flag are treated as legacy individual records and returned
 * as-is.
 *
 * @module heroCompression
 */

// ────────────────────────────────────────────────────────────────────────────
// Default templates — every field that can be omitted when it matches the
// default value.  Identity fields (heroId, heroName, titanId, titanName)
// are ALWAYS stored and never compared against the template.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Default/zero-state values for a hero snapshot record.
 * Fields listed here are omitted from the compressed delta when they match.
 *
 * @type {Object<string, *>}
 */
export const BASE_HERO = Object.freeze({
	level: 0,
	stars: 0,
	color: 0,
	power: 0,
	skins: 0,
	skillLevel1: 0,
	skillLevel2: 0,
	skillLevel3: 0,
	skillLevel4: 0,
	artifactWeapon: 0,
	artifactBook: 0,
	artifactRing: 0,
	rawSkills: '{}',
	rawSkins: '{}',
	artifactLevels: '[]',
	runes: '[]',
	titanGiftLevel: 0,
	ascensions: '{}',
	petId: 0,
});

/**
 * Default/zero-state values for a titan snapshot record.
 *
 * @type {Object<string, *>}
 */
export const BASE_TITAN = Object.freeze({
	level: 0,
	stars: 0,
	power: 0,
	skillLevel: 0,
	artifactData: '{}',
	summonStars: 0,
	element: 'unknown',
	skinLevel: 0,
});

/** Identity fields that are always kept in hero deltas */
const HERO_IDENTITY = new Set(['heroId', 'heroName']);

/** Identity fields that are always kept in titan deltas */
const TITAN_IDENTITY = new Set(['titanId', 'titanName']);

// ────────────────────────────────────────────────────────────────────────────
// Compression
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a delta object keeping only identity fields and fields that differ
 * from the base template.
 *
 * @param {Object} record - Full record
 * @param {Object} base - Default template (BASE_HERO or BASE_TITAN)
 * @param {Set<string>} identityKeys - Fields to always preserve
 * @returns {Object} Delta record
 * @private
 */
function _buildDelta(record, base, identityKeys) {
	const delta = {};

	// Always include identity fields
	for (const key of identityKeys) {
		if (record[key] !== undefined) {
			delta[key] = record[key];
		}
	}

	// Include only non-default values
	for (const [key, defaultVal] of Object.entries(base)) {
		const val = record[key];
		if (val !== undefined && val !== defaultVal) {
			delta[key] = val;
		}
	}

	return delta;
}

/**
 * Compress an array of hero records into a single batch record.
 *
 * Extracts the shared `playerId` and `timestamp` into a header, and
 * stores each hero as a delta (identity + non-default fields only).
 *
 * @param {Array<Object>} heroes - Full hero snapshot records
 * @returns {Object|null} Compressed batch record, or null if empty
 */
export function compressHeroBatch(heroes) {
	if (!Array.isArray(heroes) || heroes.length === 0) return null;

	const { playerId, timestamp } = heroes[0];

	const compressed = heroes.map((h) => _buildDelta(h, BASE_HERO, HERO_IDENTITY));

	return {
		_compressed: 1,
		playerId: playerId || 'unknown',
		timestamp: timestamp || new Date().toISOString(),
		heroes: compressed,
	};
}

/**
 * Compress an array of titan records into a single batch record.
 *
 * @param {Array<Object>} titans - Full titan snapshot records
 * @returns {Object|null} Compressed batch record, or null if empty
 */
export function compressTitanBatch(titans) {
	if (!Array.isArray(titans) || titans.length === 0) return null;

	const { playerId, timestamp } = titans[0];

	const compressed = titans.map((t) => _buildDelta(t, BASE_TITAN, TITAN_IDENTITY));

	return {
		_compressed: 1,
		playerId: playerId || 'unknown',
		timestamp: timestamp || new Date().toISOString(),
		titans: compressed,
	};
}

// ────────────────────────────────────────────────────────────────────────────
// Decompression
// ────────────────────────────────────────────────────────────────────────────

/**
 * Decompress a single batch record back to an array of full hero records.
 *
 * @param {Object} record - Compressed batch record (must have `_compressed`)
 * @returns {Array<Object>} Array of full hero records with all fields restored
 */
export function decompressHeroBatch(record) {
	if (!record || !record._compressed || !Array.isArray(record.heroes)) {
		return [];
	}

	return record.heroes.map((delta) => ({
		...BASE_HERO,
		...delta,
		playerId: record.playerId,
		timestamp: record.timestamp,
	}));
}

/**
 * Decompress a single batch record back to an array of full titan records.
 *
 * @param {Object} record - Compressed batch record (must have `_compressed`)
 * @returns {Array<Object>} Array of full titan records with all fields restored
 */
export function decompressTitanBatch(record) {
	if (!record || !record._compressed || !Array.isArray(record.titans)) {
		return [];
	}

	return record.titans.map((delta) => ({
		...BASE_TITAN,
		...delta,
		playerId: record.playerId,
		timestamp: record.timestamp,
	}));
}

// ────────────────────────────────────────────────────────────────────────────
// Mixed-format store readers (backward compatibile)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Decompress a mix of legacy individual records and new compressed batch
 * records from the `heroes` IDB store.
 *
 * - Records with `_compressed === 1` are expanded via {@link decompressHeroBatch}
 * - Records with a `heroId` field are treated as legacy individual records
 * - Anything else is silently skipped
 *
 * @param {Array<Object>} records - Raw records from `getAll('heroes')`
 * @returns {Array<Object>} Flat array of full hero records
 */
export function decompressHeroStore(records) {
	if (!Array.isArray(records)) return [];

	const result = [];
	for (const rec of records) {
		if (rec._compressed) {
			result.push(...decompressHeroBatch(rec));
		} else if (rec.heroId !== undefined) {
			// Legacy individual record — pass through
			result.push(rec);
		}
	}
	return result;
}

/**
 * Decompress a mix of legacy individual records and new compressed batch
 * records from the `titans` IDB store.
 *
 * @param {Array<Object>} records - Raw records from `getAll('titans')`
 * @returns {Array<Object>} Flat array of full titan records
 */
export function decompressTitanStore(records) {
	if (!Array.isArray(records)) return [];

	const result = [];
	for (const rec of records) {
		if (rec._compressed) {
			result.push(...decompressTitanBatch(rec));
		} else if (rec.titanId !== undefined) {
			// Legacy individual record — pass through
			result.push(rec);
		}
	}
	return result;
}
