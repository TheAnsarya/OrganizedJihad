/**
 * HeroCompletionCalculator.js
 *
 * Calculates per-system and overall completion percentages for Hero Wars heroes.
 * Each hero has multiple upgrade systems (level, stars, rank, skills, artifacts,
 * glyphs, skins, titan gift, ascension). This calculator produces a 0–100%
 * score for each system and a weighted overall score.
 *
 * Max values are configurable so they can be updated when the game raises caps.
 *
 * Used by:
 *   - UIManager.renderHeroes()  — completion column in OJ overlay panel
 *   - GameOverlay               — floating hero completion panel on game UI
 *
 * @module helpers/HeroCompletionCalculator
 * @see ~docs/plans/hero-completion-percentage-plan.md
 */

/**
 * Hero completion percentage calculator.
 * All methods are static / pure — no side effects.
 *
 * @class HeroCompletionCalculator
 */
class HeroCompletionCalculator {
	// ─── Configurable Max Values ─────────────────────────────────────────
	// These may increase with game updates. Keep them in one place.

	/** @type {number} Maximum hero level */
	static MAX_LEVEL = 130;

	/** @type {number} Maximum star rank */
	static MAX_STARS = 6;

	/** @type {number} Maximum color/promotion rank (18 = Red+2) */
	static MAX_COLOR = 18;

	/** @type {number} Maximum skill level (equals max hero level) */
	static MAX_SKILL_LEVEL = 130;

	/** @type {number} Maximum artifact level */
	static MAX_ARTIFACT_LEVEL = 130;

	/** @type {number} Maximum artifact star rank */
	static MAX_ARTIFACT_STARS = 6;

	/** @type {number} Maximum glyph/rune value per slot */
	static MAX_RUNE = 43750;

	/** @type {number} Maximum skin level per skin */
	static MAX_SKIN_LEVEL = 60;

	/** @type {number} Maximum titan gift level */
	static MAX_TITAN_GIFT = 30;

	/**
	 * Maximum total ascension nodes across all 5 tiers.
	 * Tiers 1,3,4 have 10 nodes (indices 0-9); tiers 2,5 have 11 (indices 0-10).
	 * Total: 10 + 11 + 10 + 10 + 11 = 52
	 * @type {number}
	 */
	static MAX_ASCENSION_NODES = 52;

	/** @type {number} Number of glyph/rune slots per hero */
	static RUNE_COUNT = 5;

	/** @type {number} Number of artifacts per hero (weapon, book, ring) */
	static ARTIFACT_COUNT = 3;

	// ─── System Weights ──────────────────────────────────────────────────
	// Must sum to 1.0

	/** @type {Object<string, number>} Weight of each system in overall score */
	static WEIGHTS = {
		level: 0.15,
		stars: 0.15,
		color: 0.15,
		skills: 0.15,
		artifacts: 0.15,
		runes: 0.10,
		skins: 0.05,
		titanGift: 0.05,
		ascension: 0.05,
	};

	// ─── Color Thresholds for UI ─────────────────────────────────────────
	// Returns a CSS class suffix based on completion percentage.

	/**
	 * Get a CSS color class suffix for a completion percentage.
	 *   0–24%  → 'red'
	 *   25–49% → 'orange'
	 *   50–74% → 'yellow'
	 *   75–99% → 'green'
	 *   100%   → 'cyan'
	 *
	 * @param {number} pct - Completion percentage (0–100)
	 * @returns {string} Color class suffix
	 */
	static colorClass(pct) {
		if (pct >= 100) return 'cyan';
		if (pct >= 75) return 'green';
		if (pct >= 50) return 'yellow';
		if (pct >= 25) return 'orange';
		return 'red';
	}

	// ─── Main Entry Point ────────────────────────────────────────────────

	/**
	 * Calculate completion percentages for a single hero.
	 *
	 * Accepts a hero record in the format written by `trackHeroesData()`:
	 *   - level, stars, color, power
	 *   - rawSkills (JSON string of {skillId: level})
	 *   - artifactWeapon/Book/Ring (star values)
	 *   - artifactLevels (JSON string of [level, level, level])
	 *   - runes (JSON string of [v, v, v, v, v])
	 *   - rawSkins (JSON string of {skinId: level})
	 *   - titanGiftLevel
	 *   - ascensions (JSON string of {tier: [nodeIdx, ...]})
	 *
	 * Also handles raw API hero objects (fields not JSON-stringified) for
	 * use in the game overlay where data comes directly from interception.
	 *
	 * @param {Object} hero - Hero record from IDB or raw API
	 * @returns {{
	 *   overall: number,
	 *   systems: Object<string, number>,
	 *   systemDetails: Object<string, {score: number, current: number|string, max: number|string}>
	 * }}
	 */
	static calculateCompletion(hero) {
		if (!hero) return { overall: 0, systems: {}, systemDetails: {} };

		const systems = {};
		const systemDetails = {};

		// ── Level ───────────────────────────────────────────────────────
		const level = hero.level || 0;
		systems.level = this._clamp(level / this.MAX_LEVEL);
		systemDetails.level = { score: systems.level, current: level, max: this.MAX_LEVEL };

		// ── Stars ───────────────────────────────────────────────────────
		const stars = hero.stars ?? hero.star ?? 0;
		systems.stars = this._clamp(stars / this.MAX_STARS);
		systemDetails.stars = { score: systems.stars, current: stars, max: this.MAX_STARS };

		// ── Color / Rank ────────────────────────────────────────────────
		const color = hero.color || 0;
		systems.color = this._clamp(color / this.MAX_COLOR);
		systemDetails.color = { score: systems.color, current: color, max: this.MAX_COLOR };

		// ── Skills ──────────────────────────────────────────────────────
		const skillLevels = this._parseSkillLevels(hero);
		if (skillLevels.length > 0) {
			const avg = skillLevels.reduce((s, v) => s + v, 0) / skillLevels.length;
			systems.skills = this._clamp(avg / this.MAX_SKILL_LEVEL);
		} else {
			systems.skills = 0;
		}
		systemDetails.skills = {
			score: systems.skills,
			current: skillLevels.length > 0 ? `${skillLevels.length} skills` : '0',
			max: this.MAX_SKILL_LEVEL,
		};

		// ── Artifacts ───────────────────────────────────────────────────
		systems.artifacts = this._calcArtifactScore(hero);
		const artLevels = this._parseJSON(hero.artifactLevels, []);
		systemDetails.artifacts = {
			score: systems.artifacts,
			current: `L${artLevels[0] || 0}/${artLevels[1] || 0}/${artLevels[2] || 0}`,
			max: `L${this.MAX_ARTIFACT_LEVEL} S${this.MAX_ARTIFACT_STARS}`,
		};

		// ── Glyphs / Runes ──────────────────────────────────────────────
		const runes = this._parseRunes(hero);
		if (runes.length > 0) {
			const avg = runes.reduce((s, v) => s + v, 0) / runes.length;
			systems.runes = this._clamp(avg / this.MAX_RUNE);
		} else {
			systems.runes = 0;
		}
		systemDetails.runes = {
			score: systems.runes,
			current: runes.length > 0 ? `avg ${Math.round(runes.reduce((s, v) => s + v, 0) / runes.length)}` : '0',
			max: this.MAX_RUNE,
		};

		// ── Skins ───────────────────────────────────────────────────────
		const skinLevels = this._parseSkinLevels(hero);
		if (skinLevels.length > 0) {
			const avg = skinLevels.reduce((s, v) => s + v, 0) / skinLevels.length;
			systems.skins = this._clamp(avg / this.MAX_SKIN_LEVEL);
		} else {
			systems.skins = 0;
		}
		systemDetails.skins = {
			score: systems.skins,
			current: `${skinLevels.length} skins`,
			max: this.MAX_SKIN_LEVEL,
		};

		// ── Titan Gift ──────────────────────────────────────────────────
		const tgl = hero.titanGiftLevel || 0;
		systems.titanGift = this._clamp(tgl / this.MAX_TITAN_GIFT);
		systemDetails.titanGift = { score: systems.titanGift, current: tgl, max: this.MAX_TITAN_GIFT };

		// ── Ascension ───────────────────────────────────────────────────
		const ascNodes = this._countAscensionNodes(hero);
		systems.ascension = this._clamp(ascNodes / this.MAX_ASCENSION_NODES);
		systemDetails.ascension = { score: systems.ascension, current: ascNodes, max: this.MAX_ASCENSION_NODES };

		// ── Overall weighted score ──────────────────────────────────────
		let overall = 0;
		for (const [key, weight] of Object.entries(this.WEIGHTS)) {
			overall += (systems[key] || 0) * weight;
		}

		return {
			overall: this._clamp(overall) * 100,
			systems: Object.fromEntries(
				Object.entries(systems).map(([k, v]) => [k, v * 100])
			),
			systemDetails,
		};
	}

	/**
	 * Calculate completion for an array of heroes and return sorted results.
	 *
	 * @param {Array<Object>} heroes - Array of hero records
	 * @returns {Array<{hero: Object, completion: Object}>} Sorted by overall % descending
	 */
	static calculateAll(heroes) {
		if (!heroes || !Array.isArray(heroes)) return [];

		return heroes
			.map((hero) => ({
				hero,
				completion: this.calculateCompletion(hero),
			}))
			.sort((a, b) => b.completion.overall - a.completion.overall);
	}

	/**
	 * Format a percentage value for display.
	 *
	 * @param {number} pct - Percentage value (0–100)
	 * @param {number} [decimals=2] - Decimal places
	 * @returns {string} Formatted string like "62.38%"
	 */
	static formatPercent(pct, decimals = 2) {
		return `${(pct || 0).toFixed(decimals)}%`;
	}

	/**
	 * Render an HTML progress bar string for a completion percentage.
	 *
	 * @param {number} pct - Percentage value (0–100)
	 * @param {string} [label] - Optional label (defaults to formatted %)
	 * @returns {string} HTML string
	 */
	static renderBar(pct, label) {
		const clamped = Math.min(100, Math.max(0, pct || 0));
		const color = this.colorClass(clamped);
		const text = label || this.formatPercent(clamped);
		return `<div class="oj-completion-bar">` +
			`<div class="oj-completion-fill oj-completion-${color}" style="width:${clamped}%"></div>` +
			`<span class="oj-completion-label">${text}</span>` +
			`</div>`;
	}

	// ─── Private Helpers ─────────────────────────────────────────────────

	/**
	 * Clamp a value between 0 and 1.
	 * @param {number} v - Value to clamp
	 * @returns {number}
	 * @private
	 */
	static _clamp(v) {
		return Math.min(1, Math.max(0, v || 0));
	}

	/**
	 * Safely parse a JSON string, returning fallback on failure.
	 * If input is already an object/array, returns it as-is.
	 *
	 * @param {string|any} value - JSON string or already-parsed value
	 * @param {any} fallback - Default return on parse failure
	 * @returns {any}
	 * @private
	 */
	static _parseJSON(value, fallback) {
		if (value === null || value === undefined) return fallback;
		if (typeof value === 'object') return value; // already parsed
		try {
			return JSON.parse(value);
		} catch {
			return fallback;
		}
	}

	/**
	 * Extract skill levels from hero data.
	 * Handles both tracked format (skillLevel1-4 + rawSkills JSON)
	 * and raw API format (skills: {skillId: level}).
	 *
	 * @param {Object} hero - Hero record
	 * @returns {number[]} Array of skill levels
	 * @private
	 */
	static _parseSkillLevels(hero) {
		// Try rawSkills JSON first (most complete)
		const raw = this._parseJSON(hero.rawSkills, null);
		if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
			return Object.values(raw).filter((v) => typeof v === 'number');
		}

		// Try direct skills object (raw API hero)
		if (hero.skills && typeof hero.skills === 'object' && !Array.isArray(hero.skills)) {
			return Object.values(hero.skills).filter((v) => typeof v === 'number');
		}

		// Fall back to skillLevel1-4 fields
		const levels = [];
		for (let i = 1; i <= 4; i++) {
			const v = hero[`skillLevel${i}`];
			if (v && typeof v === 'number') levels.push(v);
		}
		return levels;
	}

	/**
	 * Calculate artifact completion score (0–1).
	 * Uses both artifact levels and artifact stars if available.
	 * Score per artifact = (level/MAX_LEVEL + star/MAX_STAR) / 2
	 *
	 * @param {Object} hero - Hero record
	 * @returns {number} Score 0–1
	 * @private
	 */
	static _calcArtifactScore(hero) {
		// Parse artifact levels
		let levels = this._parseJSON(hero.artifactLevels, []);
		if (!Array.isArray(levels)) levels = [];

		// Parse artifact stars from backward-compat fields or raw artifacts
		let stars = [];
		if (hero.artifactWeapon !== undefined || hero.artifactBook !== undefined) {
			stars = [
				hero.artifactWeapon || 0,
				hero.artifactBook || 0,
				hero.artifactRing || 0,
			];
		}

		// Raw API artifacts array
		const rawArts = Array.isArray(hero.artifacts) ? hero.artifacts : [];
		if (rawArts.length > 0) {
			levels = rawArts.map((a) => a?.level || 0);
			stars = rawArts.map((a) => a?.star || 0);
		}

		if (levels.length === 0 && stars.length === 0) return 0;

		let totalScore = 0;
		const count = Math.max(levels.length, stars.length, this.ARTIFACT_COUNT);

		for (let i = 0; i < count; i++) {
			const levelScore = (levels[i] || 0) / this.MAX_ARTIFACT_LEVEL;
			const starScore = (stars[i] || 0) / this.MAX_ARTIFACT_STARS;
			totalScore += (levelScore + starScore) / 2;
		}

		return this._clamp(totalScore / count);
	}

	/**
	 * Parse rune/glyph values from hero data.
	 *
	 * @param {Object} hero - Hero record
	 * @returns {number[]} Array of rune values
	 * @private
	 */
	static _parseRunes(hero) {
		// Tracked format: runes as JSON string of array
		const parsed = this._parseJSON(hero.runes, null);
		if (Array.isArray(parsed) && parsed.length > 0) {
			return parsed.filter((v) => typeof v === 'number');
		}

		// Legacy: glyphData JSON (old tracking format)
		const glyphs = this._parseJSON(hero.glyphData, null);
		if (glyphs && typeof glyphs === 'object') {
			const vals = Object.values(glyphs).filter((v) => typeof v === 'number');
			if (vals.length > 0) return vals;
		}

		return [];
	}

	/**
	 * Parse skin levels from hero data.
	 *
	 * @param {Object} hero - Hero record
	 * @returns {number[]} Array of skin levels
	 * @private
	 */
	static _parseSkinLevels(hero) {
		// Tracked format: rawSkins JSON string
		const raw = this._parseJSON(hero.rawSkins, null);
		if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
			return Object.values(raw).filter((v) => typeof v === 'number');
		}

		// Raw API format: skins is an object directly
		if (hero.skins && typeof hero.skins === 'object' && !Array.isArray(hero.skins)) {
			return Object.values(hero.skins).filter((v) => typeof v === 'number');
		}

		return [];
	}

	/**
	 * Count total unlocked ascension nodes across all tiers.
	 *
	 * @param {Object} hero - Hero record
	 * @returns {number} Total node count
	 * @private
	 */
	static _countAscensionNodes(hero) {
		const asc = this._parseJSON(hero.ascensions, null);
		if (!asc || typeof asc !== 'object') return 0;

		let total = 0;
		for (const nodes of Object.values(asc)) {
			if (Array.isArray(nodes)) {
				total += nodes.length;
			}
		}
		return total;
	}

	// ─── System Labels for UI ────────────────────────────────────────────

	/**
	 * Human-readable labels for each system.
	 * @type {Object<string, string>}
	 */
	static SYSTEM_LABELS = {
		level: 'Level',
		stars: 'Stars',
		color: 'Rank',
		skills: 'Skills',
		artifacts: 'Artifacts',
		runes: 'Glyphs',
		skins: 'Skins',
		titanGift: 'Titan Gift',
		ascension: 'Ascension',
	};

	/**
	 * Emoji icons for each system.
	 * @type {Object<string, string>}
	 */
	static SYSTEM_ICONS = {
		level: '\uD83D\uDCCA',   // 📊
		stars: '\u2B50',          // ⭐
		color: '\uD83C\uDFA8',   // 🎨
		skills: '\u2694\uFE0F',   // ⚔️
		artifacts: '\uD83D\uDC8E', // 💎
		runes: '\uD83D\uDD2E',   // 🔮
		skins: '\uD83C\uDFAD',   // 🎭
		titanGift: '\u26A1',     // ⚡
		ascension: '\uD83C\uDF1F', // 🌟
	};
}

export default HeroCompletionCalculator;
