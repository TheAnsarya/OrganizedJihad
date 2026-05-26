/**
 * HeroMaterialRequirementsCalculator.js
 *
 * Projects roster-wide item requirements needed to reach target hero progression.
 *
 * This calculator intentionally uses observed account history instead of hardcoded
 * global game recipes so it can start producing useful totals immediately from
 * captured data. As more upgrade/equipment events are tracked, projections improve.
 *
 * Inputs:
 * - heroes: latest hero roster snapshots
 * - heroUpgrades: hero upgrade event history
 * - equipmentChanges: hero equipment change history
 * - inventoryItemUsages: tracked consumable/material usage history
 *
 * Output:
 * - aggregated item totals for remaining level + color progression
 * - simple coverage/confidence indicators
 *
 * @module helpers/HeroMaterialRequirementsCalculator
 */

/** @typedef {{[itemId: string]: number}} ItemTotals */

class HeroMaterialRequirementsCalculator {
	/** @type {number} Maximum supported hero level for projections */
	static DEFAULT_TARGET_LEVEL = 130;

	/** @type {number} Projection target rank for Red+3 accounts */
	static DEFAULT_TARGET_COLOR_RANK = 19;

	/** @type {number} Number of projected top items to keep by default */
	static DEFAULT_TOP_ITEM_LIMIT = 20;

	/**
	 * Build projected item requirements for an entire hero roster.
	 *
	 * @param {{
	 *  heroes?: Array<object>,
	 *  heroUpgrades?: Array<object>,
	 *  equipmentChanges?: Array<object>,
	 *  inventoryItemUsages?: Array<object>,
	 *  targetLevel?: number,
	 *  targetColorRank?: number,
	 *  topItemLimit?: number
	 * }} input - Projection input payload
	 * @returns {{
	 *  generatedAt: string,
	 *  targetLevel: number,
	 *  targetColorRank: number,
	 *  targetColorName: string,
	 *  heroCount: number,
	 *  totalLevelDeficit: number,
	 *  totalColorDeficit: number,
	 *  totalProjectedItems: number,
	 *  distinctItems: number,
	 *  confidenceScore: number,
	 *  coverage: {
	 *   levelUpgradeSamples: number,
	 *   colorUpgradeSamples: number,
	 *   equipmentChangeSamples: number,
	 *   itemUsageSamples: number,
	 *   levelSignalStrength: number,
	 *   colorSignalStrength: number
	 *  },
	 *  items: Array<{
	 *   itemId: string,
	 *   quantity: number,
	 *   levelProjected: number,
	 *   colorProjected: number
	 *  }>
	 * }} Projection summary
	 */
	static calculateProjectedRequirements(input = {}) {
		const heroes = this._normalizeHeroes(input.heroes || []);
		const heroUpgrades = Array.isArray(input.heroUpgrades) ? input.heroUpgrades : [];
		const equipmentChanges = Array.isArray(input.equipmentChanges) ? input.equipmentChanges : [];
		const inventoryItemUsages = Array.isArray(input.inventoryItemUsages) ? input.inventoryItemUsages : [];
		const targetLevel = Math.max(1, Number(input.targetLevel) || this.DEFAULT_TARGET_LEVEL);
		const targetColorRank = Math.max(0, Number(input.targetColorRank) || this.DEFAULT_TARGET_COLOR_RANK);
		const topItemLimit = Math.max(1, Number(input.topItemLimit) || this.DEFAULT_TOP_ITEM_LIMIT);

		const levelModel = this._buildLevelDemandModel(heroUpgrades, inventoryItemUsages);
		const colorModel = this._buildColorDemandModel(heroUpgrades, equipmentChanges, inventoryItemUsages);

		const projectedLevelItems = this._emptyTotals();
		const projectedColorItems = this._emptyTotals();
		let totalLevelDeficit = 0;
		let totalColorDeficit = 0;

		for (const hero of heroes) {
			const currentLevel = this._toNumber(hero.level);
			const currentColor = this._toNumber(hero.color);
			const levelDeficit = Math.max(0, targetLevel - currentLevel);
			const colorDeficit = Math.max(0, targetColorRank - currentColor);

			totalLevelDeficit += levelDeficit;
			totalColorDeficit += colorDeficit;

			if (levelDeficit > 0) {
				for (const [itemId, perLevel] of Object.entries(levelModel.perLevelDemand)) {
					this._addTotal(projectedLevelItems, itemId, perLevel * levelDeficit);
				}
			}

			if (colorDeficit > 0) {
				for (let step = currentColor + 1; step <= targetColorRank; step++) {
					const perStepDemand = colorModel.perStepByRank.get(step) || colorModel.globalPerStepDemand;
					for (const [itemId, perStep] of Object.entries(perStepDemand)) {
						this._addTotal(projectedColorItems, itemId, perStep);
					}
				}
			}
		}

		const mergedItems = this._mergeTotals(projectedLevelItems, projectedColorItems);
		const sortedItems = Object.entries(mergedItems)
			.map(([itemId, quantity]) => {
				const levelProjected = Math.ceil(projectedLevelItems[itemId] || 0);
				const colorProjected = Math.ceil(projectedColorItems[itemId] || 0);
				return {
					itemId,
					quantity: Math.ceil(quantity),
					levelProjected,
					colorProjected,
				};
			})
			.filter((entry) => entry.quantity > 0)
			.sort((a, b) => b.quantity - a.quantity)
			.slice(0, topItemLimit);

		const totalProjectedItems = sortedItems.reduce((sum, entry) => sum + entry.quantity, 0);
		const confidenceScore = this._calculateConfidence(levelModel, colorModel);

		return {
			generatedAt: new Date().toISOString(),
			targetLevel,
			targetColorRank,
			targetColorName: this.colorRankName(targetColorRank),
			heroCount: heroes.length,
			totalLevelDeficit,
			totalColorDeficit,
			totalProjectedItems,
			distinctItems: sortedItems.length,
			confidenceScore,
			coverage: {
				levelUpgradeSamples: levelModel.levelUpgradeSamples,
				colorUpgradeSamples: colorModel.colorUpgradeSamples,
				equipmentChangeSamples: colorModel.equipmentChangeSamples,
				itemUsageSamples: levelModel.itemUsageSamples + colorModel.itemUsageSamples,
				levelSignalStrength: levelModel.signalStrength,
				colorSignalStrength: colorModel.signalStrength,
			},
			items: sortedItems,
		};
	}

	/**
	 * Get user-friendly color name from rank.
	 *
	 * @param {number} rank - Numeric hero color rank
	 * @returns {string} Color rank label
	 */
	static colorRankName(rank) {
		const names = {
			0: 'Gray',
			1: 'Green',
			2: 'Green+1',
			3: 'Blue',
			4: 'Blue+1',
			5: 'Blue+2',
			6: 'Violet',
			7: 'Violet+1',
			8: 'Violet+2',
			9: 'Violet+3',
			10: 'Orange',
			11: 'Orange+1',
			12: 'Orange+2',
			13: 'Orange+3',
			14: 'Orange+4',
			15: 'Red',
			16: 'Red+1',
			17: 'Red+2',
			18: 'Red+2 (Legacy Max)',
			19: 'Red+3',
		};
		return names[rank] || `Rank ${rank}`;
	}

	static _buildLevelDemandModel(heroUpgrades, inventoryItemUsages) {
		let totalLevelGained = 0;
		let levelUpgradeSamples = 0;

		for (const upgrade of heroUpgrades) {
			if ((upgrade.upgradeType || '').toLowerCase() !== 'level') {
				continue;
			}
			const before = this._toNumber(upgrade.levelBefore);
			const after = this._toNumber(upgrade.levelAfter);
			const gained = Math.max(0, after - before);
			if (gained > 0) {
				totalLevelGained += gained;
				levelUpgradeSamples++;
			}
		}

		const levelUsageTotals = this._emptyTotals();
		let itemUsageSamples = 0;
		for (const usage of inventoryItemUsages) {
			const context = (usage.usageContext || '').toLowerCase();
			if (context !== 'hero_level') {
				continue;
			}
			const itemId = this._normalizeItemId(usage.itemId);
			const qty = Math.max(0, this._toNumber(usage.quantityUsed) || 1);
			if (!itemId || qty <= 0) {
				continue;
			}
			this._addTotal(levelUsageTotals, itemId, qty);
			itemUsageSamples++;
		}

		const denominator = Math.max(1, totalLevelGained);
		const perLevelDemand = this._emptyTotals();
		for (const [itemId, qty] of Object.entries(levelUsageTotals)) {
			perLevelDemand[itemId] = qty / denominator;
		}

		const signalStrength = Math.min(1, (totalLevelGained / 300) + (itemUsageSamples / 120));

		return {
			perLevelDemand,
			levelUpgradeSamples,
			itemUsageSamples,
			signalStrength,
		};
	}

	static _buildColorDemandModel(heroUpgrades, equipmentChanges, inventoryItemUsages) {
		let totalColorGained = 0;
		let colorUpgradeSamples = 0;

		for (const upgrade of heroUpgrades) {
			if ((upgrade.upgradeType || '').toLowerCase() !== 'color') {
				continue;
			}
			const before = this._toNumber(upgrade.colorRankBefore);
			const after = this._toNumber(upgrade.colorRankAfter);
			const gained = Math.max(0, after - before);
			if (gained > 0) {
				totalColorGained += gained;
				colorUpgradeSamples++;
			}
		}

		const perRankTotals = new Map();
		const perRankSamples = new Map();
		const globalTotals = this._emptyTotals();
		let equipmentChangeSamples = 0;

		for (const change of equipmentChanges) {
			const rank = this._toNumber(change.heroColorRank);
			const materials = this._parseMaterials(change.materialsConsumed);

			if ((Object.keys(materials).length === 0) && change.equipmentItemId) {
				materials[this._normalizeItemId(change.equipmentItemId)] = 1;
			}

			if (Object.keys(materials).length === 0) {
				continue;
			}

			const rankTotals = perRankTotals.get(rank) || this._emptyTotals();
			for (const [itemId, qty] of Object.entries(materials)) {
				this._addTotal(rankTotals, itemId, qty);
				this._addTotal(globalTotals, itemId, qty);
			}
			perRankTotals.set(rank, rankTotals);
			perRankSamples.set(rank, (perRankSamples.get(rank) || 0) + 1);
			equipmentChangeSamples++;
		}

		let itemUsageSamples = 0;
		for (const usage of inventoryItemUsages) {
			const context = (usage.usageContext || '').toLowerCase();
			if (context !== 'hero_evolve' && context !== 'craft') {
				continue;
			}
			const itemId = this._normalizeItemId(usage.itemId);
			const qty = Math.max(0, this._toNumber(usage.quantityUsed) || 1);
			if (!itemId || qty <= 0) {
				continue;
			}
			this._addTotal(globalTotals, itemId, qty);
			itemUsageSamples++;
		}

		const colorDenominator = Math.max(1, totalColorGained);
		const globalPerStepDemand = this._emptyTotals();
		for (const [itemId, qty] of Object.entries(globalTotals)) {
			globalPerStepDemand[itemId] = qty / colorDenominator;
		}

		const perStepByRank = new Map();
		for (const [rank, totals] of perRankTotals.entries()) {
			const samples = Math.max(1, perRankSamples.get(rank) || 0);
			const perStep = this._emptyTotals();
			for (const [itemId, qty] of Object.entries(totals)) {
				perStep[itemId] = qty / samples;
			}
			perStepByRank.set(rank, perStep);
		}

		const signalStrength = Math.min(1, (totalColorGained / 80) + (equipmentChangeSamples / 180) + (itemUsageSamples / 100));

		return {
			globalPerStepDemand,
			perStepByRank,
			colorUpgradeSamples,
			equipmentChangeSamples,
			itemUsageSamples,
			signalStrength,
		};
	}

	static _calculateConfidence(levelModel, colorModel) {
		const levelWeight = 0.45;
		const colorWeight = 0.55;
		const raw = (levelModel.signalStrength * levelWeight) + (colorModel.signalStrength * colorWeight);
		return Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;
	}

	static _normalizeHeroes(heroes) {
		if (!Array.isArray(heroes)) {
			return [];
		}
		const byId = new Map();
		for (const hero of heroes) {
			const heroId = this._toNumber(hero.heroId || hero.id);
			if (heroId <= 0) {
				continue;
			}
			byId.set(heroId, hero);
		}
		return [...byId.values()];
	}

	static _parseMaterials(materialsJson) {
		const parsed = this._parseJson(materialsJson, {});
		const totals = this._emptyTotals();
		for (const [rawId, rawQty] of Object.entries(parsed || {})) {
			const itemId = this._normalizeItemId(rawId);
			const qty = Math.max(0, this._toNumber(rawQty));
			if (!itemId || qty <= 0) {
				continue;
			}
			this._addTotal(totals, itemId, qty);
		}
		return totals;
	}

	static _parseJson(value, fallback) {
		if (value == null) {
			return fallback;
		}
		if (typeof value === 'object') {
			return value;
		}
		if (typeof value !== 'string' || !value.trim()) {
			return fallback;
		}
		try {
			return JSON.parse(value);
		} catch {
			return fallback;
		}
	}

	static _normalizeItemId(value) {
		if (value == null) {
			return '';
		}
		const text = String(value).trim();
		if (!text) {
			return '';
		}
		return text;
	}

	static _toNumber(value) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	static _emptyTotals() {
		return {};
	}

	/**
	 * @param {ItemTotals} totals - Totals object
	 * @param {string} itemId - Item ID key
	 * @param {number} quantity - Quantity to add
	 */
	static _addTotal(totals, itemId, quantity) {
		if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
			return;
		}
		totals[itemId] = (totals[itemId] || 0) + quantity;
	}

	/**
	 * @param {ItemTotals} a - First totals
	 * @param {ItemTotals} b - Second totals
	 * @returns {ItemTotals} Merged totals
	 */
	static _mergeTotals(a, b) {
		const merged = this._emptyTotals();
		for (const [itemId, qty] of Object.entries(a)) {
			this._addTotal(merged, itemId, qty);
		}
		for (const [itemId, qty] of Object.entries(b)) {
			this._addTotal(merged, itemId, qty);
		}
		return merged;
	}
}

export default HeroMaterialRequirementsCalculator;
