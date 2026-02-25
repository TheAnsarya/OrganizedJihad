/**
 * PetCompletionCalculator.js
 *
 * Static calculator for pet completion percentage in Hero Wars.
 * Evaluates level and stars as weighted systems.
 *
 * Pet data model (from petGetAll API):
 *   - level        (1–130)
 *   - stars / star (1–6)
 *   - power        (derived, not scored)
 *   - patronageData (JSON string of hero patronage assignments)
 *
 * Reference: https://hw-mobile.fandom.com/wiki/Pets
 *
 * @module PetCompletionCalculator
 */

class PetCompletionCalculator {
	// ─── Max Values ──────────────────────────────────────────────────────

	/** @type {number} Maximum pet level */
	static MAX_LEVEL = 130;

	/** @type {number} Maximum pet stars */
	static MAX_STARS = 6;

	/** @type {number} Maximum pet equipment slots (6 slots, indexed 0–5) */
	static MAX_ITEMS = 6;

	// ─── System Weights ──────────────────────────────────────────────────
	// Must sum to 1.0

	/** @type {Object<string, number>} Weight of each system in overall score */
	static WEIGHTS = {
		level: 0.45,
		stars: 0.35,
		items: 0.20,
	};

	// ─── Pet Type Emojis ─────────────────────────────────────────────────

	/**
	 * Emoji icons for patronage display.
	 * @type {string}
	 */
	static PET_EMOJI = '\uD83D\uDC3E'; // 🐾

	// ─── Color Thresholds ────────────────────────────────────────────────

	/**
	 * Get a CSS color class suffix for a completion percentage.
	 * Matches Hero/TitanCompletionCalculator thresholds.
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

	// ─── System Labels & Icons ───────────────────────────────────────────

	/**
	 * Descriptive labels for each scored system.
	 * @type {Object<string, string>}
	 */
	static SYSTEM_LABELS = {
		level: 'Level',
		stars: 'Stars',
		items: 'Items',
	};

	/**
	 * Emoji icons for each scored system.
	 * @type {Object<string, string>}
	 */
	static SYSTEM_ICONS = {
		level: '\uD83D\uDCC8',  // 📈
		stars: '\u2B50',         // ⭐
		items: '\uD83D\uDEE1\uFE0F',  // 🛡️
	};

	// ─── Main Calculation ────────────────────────────────────────────────

	/**
	 * Calculate overall and per-system completion for a pet.
	 *
	 * @param {Object} pet - Pet data object
	 * @param {number} [pet.level] - Current level (1–130)
	 * @param {number} [pet.stars] - Current stars (1–6)
	 * @param {number} [pet.star] - Alias for stars (API uses singular)
	 * @param {number} [pet.items] - Equipped item count (0–6)
	 * @returns {{ overall: number, systems: Object<string, number>, systemDetails: Object }}
	 */
	static calculateCompletion(pet) {
		if (!pet || typeof pet !== 'object') {
			return {
				overall: 0,
				systems: { level: 0, stars: 0, items: 0 },
				systemDetails: {},
			};
		}

		const level = pet.level || 0;
		const stars = pet.stars || pet.star || 0;
		const items = pet.items || 0;

		// Per-system scores (0–100)
		const systems = {
			level: this._clamp((level / this.MAX_LEVEL) * 100),
			stars: this._clamp((stars / this.MAX_STARS) * 100),
			items: this._clamp((items / this.MAX_ITEMS) * 100),
		};

		// Weighted overall score (0–100)
		let overall = 0;
		for (const [key, weight] of Object.entries(this.WEIGHTS)) {
			overall += (systems[key] || 0) * weight;
		}
		overall = this._clamp(overall);

		// System details for expandable breakdown
		const systemDetails = {
			level: { current: level, max: this.MAX_LEVEL },
			stars: { current: stars, max: this.MAX_STARS },
			items: { current: items, max: this.MAX_ITEMS },
		};

		return { overall, systems, systemDetails };
	}

	// ─── Formatting Helpers ──────────────────────────────────────────────

	/**
	 * Format a percentage for display.
	 * @param {number} pct - Percentage value (0–100)
	 * @param {number} [decimals=2] - Decimal places
	 * @returns {string} Formatted string like "85.50%"
	 */
	static formatPercent(pct, decimals = 2) {
		return `${(pct || 0).toFixed(decimals)}%`;
	}

	/**
	 * Generate an inline HTML progress bar.
	 * @param {number} pct - Percentage value (0–100)
	 * @returns {string} HTML string for a completion bar
	 */
	static renderBar(pct) {
		const clamped = this._clamp(pct || 0);
		const color = this.colorClass(clamped);
		return `<div class="oj-completion-bar">` +
			`<div class="oj-completion-fill oj-completion-${color}" style="width:${clamped}%"></div>` +
			`<div class="oj-completion-label">${this.formatPercent(clamped)}</div>` +
			`</div>`;
	}

	/**
	 * Parse patronage data for display.
	 * Returns the count of heroes this pet supports.
	 *
	 * @param {string|Object} patronageData - JSON string or object of patronage assignments
	 * @returns {number} Count of patronage assignments
	 */
	static countPatronage(patronageData) {
		try {
			const data = typeof patronageData === 'string'
				? JSON.parse(patronageData)
				: patronageData;
			if (!data || typeof data !== 'object') return 0;
			return Object.keys(data).length;
		} catch {
			return 0;
		}
	}

	// ─── Internal Helpers ────────────────────────────────────────────────

	/**
	 * Clamp a value between 0 and 100.
	 * @param {number} val - Value to clamp
	 * @returns {number} Clamped value
	 * @private
	 */
	static _clamp(val) {
		return Math.max(0, Math.min(100, val));
	}
}

export default PetCompletionCalculator;
