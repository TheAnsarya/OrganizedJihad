/**
 * TitanCompletionCalculator.js
 *
 * Calculates per-system and overall completion percentages for Hero Wars titans.
 * Each titan has multiple upgrade systems: level, stars, skill, artifacts/totems,
 * skins, and summon stars. This calculator produces a 0–100% score for each
 * system and a weighted overall score.
 *
 * Max values are configurable so they can be updated when the game raises caps.
 *
 * Used by:
 *   - UIManager.renderTitans()  — completion column in OJ overlay panel
 *
 * @module helpers/TitanCompletionCalculator
 */

/**
 * Titan completion percentage calculator.
 * All methods are static / pure — no side effects.
 *
 * @class TitanCompletionCalculator
 */
class TitanCompletionCalculator {
	// ─── Configurable Max Values ─────────────────────────────────────────

	/** @type {number} Maximum titan level */
	static MAX_LEVEL = 130;

	/** @type {number} Maximum star rank */
	static MAX_STARS = 6;

	/** @type {number} Maximum skill level */
	static MAX_SKILL_LEVEL = 130;

	/** @type {number} Maximum artifact/totem level per slot */
	static MAX_ARTIFACT_LEVEL = 130;

	/** @type {number} Maximum artifact/totem star rank */
	static MAX_ARTIFACT_STARS = 6;

	/** @type {number} Maximum skin level */
	static MAX_SKIN_LEVEL = 60;

	/** @type {number} Maximum summon stars */
	static MAX_SUMMON_STARS = 6;

	// ─── System Weights ──────────────────────────────────────────────────
	// Must sum to 1.0

	/** @type {Object<string, number>} Weight of each system in overall score */
	static WEIGHTS = {
		level: 0.25,
		stars: 0.20,
		skill: 0.15,
		artifacts: 0.20,
		skins: 0.10,
		summonStars: 0.10,
	};

	// ─── Element Emojis ──────────────────────────────────────────────────

	/**
	 * Emoji icons for titan elements.
	 * @type {Object<string, string>}
	 */
	static ELEMENT_EMOJIS = {
		water: '\uD83D\uDCA7',   // 💧
		fire: '\uD83D\uDD25',    // 🔥
		earth: '\uD83C\uDF3F',   // 🌿
		dark: '\uD83C\uDF11',    // 🌑
		light: '\u2728',         // ✨
	};

	/**
	 * Resolve element emoji for display.
	 * @param {string} element - Element name (water/fire/earth/dark/light)
	 * @returns {string} Emoji + element name
	 */
	static formatElement(element) {
		const el = (element || '').toLowerCase();
		const emoji = this.ELEMENT_EMOJIS[el] || '\u2753'; // ❓
		const name = el.charAt(0).toUpperCase() + el.slice(1);
		return `${emoji} ${name}`;
	}

	// ─── Color Thresholds ────────────────────────────────────────────────

	/**
	 * Get a CSS color class suffix for a completion percentage.
	 * Matches HeroCompletionCalculator thresholds.
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
	 * Calculate completion percentages for a single titan.
	 *
	 * Accepts a titan record in the format written by `trackTitansData()`:
	 *   - level, stars, power, skillLevel
	 *   - artifactData (JSON string of titan artifacts/totems)
	 *   - skinLevel
	 *   - summonStars
	 *   - element (resolved from titan ID)
	 *
	 * @param {Object} titan - Titan record from IDB or metadata
	 * @returns {{
	 *   overall: number,
	 *   systems: Object<string, number>,
	 *   systemDetails: Object<string, {score: number, current: number|string, max: number|string}>
	 * }}
	 */
	static calculateCompletion(titan) {
		if (!titan) return { overall: 0, systems: {}, systemDetails: {} };

		const systems = {};
		const systemDetails = {};

		// ── Level ───────────────────────────────────────────────────────
		const level = titan.level || 0;
		systems.level = this._clamp(level / this.MAX_LEVEL);
		systemDetails.level = { score: systems.level, current: level, max: this.MAX_LEVEL };

		// ── Stars ───────────────────────────────────────────────────────
		const stars = titan.stars ?? titan.star ?? 0;
		systems.stars = this._clamp(stars / this.MAX_STARS);
		systemDetails.stars = { score: systems.stars, current: stars, max: this.MAX_STARS };

		// ── Skill ───────────────────────────────────────────────────────
		const skillLevel = titan.skillLevel || 0;
		systems.skill = this._clamp(skillLevel / this.MAX_SKILL_LEVEL);
		systemDetails.skill = { score: systems.skill, current: skillLevel, max: this.MAX_SKILL_LEVEL };

		// ── Artifacts / Totems ───────────────────────────────────────────
		systems.artifacts = this._calcArtifactScore(titan);
		systemDetails.artifacts = { score: systems.artifacts, current: 'see detail', max: `L${this.MAX_ARTIFACT_LEVEL}` };

		// ── Skins ───────────────────────────────────────────────────────
		const skinLevel = titan.skinLevel || 0;
		systems.skins = this._clamp(skinLevel / this.MAX_SKIN_LEVEL);
		systemDetails.skins = { score: systems.skins, current: skinLevel, max: this.MAX_SKIN_LEVEL };

		// ── Summon Stars ────────────────────────────────────────────────
		const summonStars = titan.summonStars || 0;
		systems.summonStars = this._clamp(summonStars / this.MAX_SUMMON_STARS);
		systemDetails.summonStars = { score: systems.summonStars, current: summonStars, max: this.MAX_SUMMON_STARS };

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
	 * Uses same CSS classes as HeroCompletionCalculator for visual consistency.
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
	 * @param {number} v
	 * @returns {number}
	 * @private
	 */
	static _clamp(v) {
		return Math.min(1, Math.max(0, v || 0));
	}

	/**
	 * Safely parse a JSON string, returning fallback on failure.
	 * @param {string|any} value
	 * @param {any} fallback
	 * @returns {any}
	 * @private
	 */
	static _parseJSON(value, fallback) {
		if (value === null || value === undefined) return fallback;
		if (typeof value === 'object') return value;
		try {
			return JSON.parse(value);
		} catch {
			return fallback;
		}
	}

	/**
	 * Calculate titan artifact/totem score (0–1).
	 * Titan artifacts are stored as JSON in artifactData.
	 * Handles both raw API objects and JSON strings.
	 *
	 * @param {Object} titan - Titan record
	 * @returns {number} Score 0–1
	 * @private
	 */
	static _calcArtifactScore(titan) {
		const artifacts = this._parseJSON(titan.artifactData, {});

		// If artifacts is an object with entries like { id: { level, star } }
		if (typeof artifacts === 'object' && !Array.isArray(artifacts)) {
			const entries = Object.values(artifacts);
			if (entries.length === 0) return 0;

			let total = 0;
			for (const art of entries) {
				if (typeof art === 'object' && art !== null) {
					const levelScore = (art.level || 0) / this.MAX_ARTIFACT_LEVEL;
					const starScore = (art.star || art.stars || 0) / this.MAX_ARTIFACT_STARS;
					total += (levelScore + starScore) / 2;
				}
			}
			return this._clamp(total / entries.length);
		}

		// Array format
		if (Array.isArray(artifacts) && artifacts.length > 0) {
			let total = 0;
			for (const art of artifacts) {
				const levelScore = (art?.level || 0) / this.MAX_ARTIFACT_LEVEL;
				const starScore = (art?.star || art?.stars || 0) / this.MAX_ARTIFACT_STARS;
				total += (levelScore + starScore) / 2;
			}
			return this._clamp(total / artifacts.length);
		}

		return 0;
	}

	// ─── System Labels for UI ────────────────────────────────────────────

	/**
	 * Human-readable labels for each titan system.
	 * @type {Object<string, string>}
	 */
	static SYSTEM_LABELS = {
		level: 'Level',
		stars: 'Stars',
		skill: 'Skill',
		artifacts: 'Totems/Artifacts',
		skins: 'Skins',
		summonStars: 'Summon Stars',
	};

	/**
	 * Emoji icons for each titan system.
	 * @type {Object<string, string>}
	 */
	static SYSTEM_ICONS = {
		level: '\uD83D\uDCCA',   // 📊
		stars: '\u2B50',          // ⭐
		skill: '\u2694\uFE0F',   // ⚔️
		artifacts: '\uD83D\uDCA0', // 💠
		skins: '\uD83C\uDFAD',   // 🎭
		summonStars: '\uD83C\uDF1F', // 🌟
	};
}

export default TitanCompletionCalculator;
