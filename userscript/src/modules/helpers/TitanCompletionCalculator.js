/**
 * TitanCompletionCalculator.js
 *
 * Calculates per-system and overall completion percentages for Hero Wars titans.
 * Each titan has multiple upgrade systems: level, stars, artifacts, skins, and
 * totem (element spirit). This calculator produces a 0–100% score for each
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

	/** @type {number} Maximum artifact level per slot */
	static MAX_ARTIFACT_LEVEL = 130;

	/** @type {number} Maximum artifact star rank */
	static MAX_ARTIFACT_STARS = 6;

	/** @type {number} Maximum skin level per skin slot */
	static MAX_SKIN_LEVEL = 60;

	/** @type {number} Maximum totem (element spirit) level */
	static MAX_TOTEM_LEVEL = 130;

	/** @type {number} Maximum totem (element spirit) star rank */
	static MAX_TOTEM_STARS = 6;

	// ─── System Weights ──────────────────────────────────────────────────
	// Must sum to 1.0

	/** @type {Object<string, number>} Weight of each system in overall score */
	static WEIGHTS = {
		level: 0.25,
		stars: 0.25,
		artifacts: 0.20,
		skins: 0.15,
		totem: 0.15,
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

		// ── Artifacts ───────────────────────────────────────────────────
		systems.artifacts = this._calcArtifactScore(titan);
		systemDetails.artifacts = { score: systems.artifacts, current: 'see detail', max: `L${this.MAX_ARTIFACT_LEVEL}` };

		// ── Skins ───────────────────────────────────────────────────────
		// Skins are stored as JSON object: { skinId: { level, ... }, ... }
		// or as a legacy single number (skinLevel)
		systems.skins = this._calcSkinScore(titan);
		systemDetails.skins = { score: systems.skins, current: 'see detail', max: `L${this.MAX_SKIN_LEVEL}` };

		// ── Totem (Element Spirit) ──────────────────────────────────────
		// API fields: elementSpiritLevel, elementSpiritStar, elementSpiritPower
		// Stored as: totemLevel, totemStar
		const totemLevel = titan.totemLevel || 0;
		const totemStar = titan.totemStar || 0;
		const totemLevelScore = totemLevel / this.MAX_TOTEM_LEVEL;
		const totemStarScore = totemStar / this.MAX_TOTEM_STARS;
		systems.totem = this._clamp((totemLevelScore + totemStarScore) / 2);
		systemDetails.totem = {
			score: systems.totem,
			current: `${totemStar}\u2605 L${totemLevel}`,
			max: `${this.MAX_TOTEM_STARS}\u2605 L${this.MAX_TOTEM_LEVEL}`,
		};

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
	 * Calculate titan artifact score (0–1).
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

	/**
	 * Calculate titan skin score (0–1).
	 * Skins can be stored as:
	 *   - skinData (JSON string/object): { skinId: { level, ... }, ... }
	 *   - skinLevel (legacy single number)
	 *
	 * When stored as an object, averages all skin levels vs MAX_SKIN_LEVEL.
	 *
	 * @param {Object} titan - Titan record
	 * @returns {number} Score 0–1
	 * @private
	 */
	static _calcSkinScore(titan) {
		// New format: skinData as JSON object { skinId: { level, ... } }
		const skinData = this._parseJSON(titan.skinData, null);
		if (skinData && typeof skinData === 'object' && !Array.isArray(skinData)) {
			const entries = Object.values(skinData);
			if (entries.length > 0) {
				let total = 0;
				for (const skin of entries) {
					if (typeof skin === 'object' && skin !== null) {
						total += (skin.level || 0) / this.MAX_SKIN_LEVEL;
					} else if (typeof skin === 'number') {
						total += skin / this.MAX_SKIN_LEVEL;
					}
				}
				return this._clamp(total / entries.length);
			}
		}

		// Legacy format: single skinLevel number
		const skinLevel = titan.skinLevel || 0;
		if (skinLevel > 0) {
			return this._clamp(skinLevel / this.MAX_SKIN_LEVEL);
		}

		return 0;
	}

	/**
	 * Parse artifact data into an array of { level, star } objects for display.
	 * Handles JSON strings, objects, and arrays.
	 *
	 * @param {Object} titan - Titan record with artifactData
	 * @returns {Array<{id: string, level: number, star: number}>} Parsed artifacts
	 */
	static parseArtifacts(titan) {
		const artifacts = this._parseJSON(titan?.artifactData, {});
		const result = [];

		if (typeof artifacts === 'object' && !Array.isArray(artifacts)) {
			for (const [id, art] of Object.entries(artifacts)) {
				if (typeof art === 'object' && art !== null) {
					result.push({
						id: id,
						level: art.level || 0,
						star: art.star || art.stars || 0,
					});
				}
			}
		} else if (Array.isArray(artifacts)) {
			for (let i = 0; i < artifacts.length; i++) {
				const art = artifacts[i];
				result.push({
					id: String(i),
					level: art?.level || 0,
					star: art?.star || art?.stars || 0,
				});
			}
		}

		return result;
	}

	/**
	 * Parse skin data into an array of { id, level } objects for display.
	 *
	 * @param {Object} titan - Titan record with skinData (or legacy skinLevel)
	 * @returns {Array<{id: string, level: number}>} Parsed skins
	 */
	static parseSkins(titan) {
		const skinData = this._parseJSON(titan?.skinData, null);
		const result = [];

		if (skinData && typeof skinData === 'object' && !Array.isArray(skinData)) {
			for (const [id, skin] of Object.entries(skinData)) {
				const level = (typeof skin === 'object' && skin !== null)
					? (skin.level || 0)
					: (typeof skin === 'number' ? skin : 0);
				result.push({ id, level });
			}
		}

		return result;
	}

	/**
	 * Get the star-based color class for an artifact/totem star count.
	 * Used for colored borders on artifact icons.
	 *
	 * @param {number} stars - Star count (0–6)
	 * @returns {string} CSS class name for the border color
	 */
	static artifactStarClass(stars) {
		if (stars >= 6) return 'oj-rank-red';
		if (stars >= 5) return 'oj-rank-orange';
		if (stars >= 4) return 'oj-rank-violet';
		if (stars >= 3) return 'oj-rank-blue';
		if (stars >= 1) return 'oj-rank-green';
		return 'oj-rank-gray';
	}

	// ─── System Labels for UI ────────────────────────────────────────────

	/**
	 * Human-readable labels for each titan system.
	 * @type {Object<string, string>}
	 */
	static SYSTEM_LABELS = {
		level: 'Level',
		stars: 'Stars',
		artifacts: 'Artifacts',
		skins: 'Skins',
		totem: 'Totem',
	};

	/**
	 * Emoji icons for each titan system.
	 * @type {Object<string, string>}
	 */
	static SYSTEM_ICONS = {
		level: '\uD83D\uDCCA',   // 📊
		stars: '\u2B50',          // ⭐
		artifacts: '\uD83D\uDCA0', // 💠
		skins: '\uD83C\uDFAD',   // 🎭
		totem: '\uD83D\uDD2E',   // 🔮
	};
}

export default TitanCompletionCalculator;
