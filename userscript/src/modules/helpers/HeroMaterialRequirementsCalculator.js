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

	/** @type {number} Number of top items to keep for each tier summary */
	static DEFAULT_TIER_TOP_ITEM_LIMIT = 8;

	/** @type {Array<string>} Deterministic progression tier order */
	static COLOR_TIER_ORDER = ['Grey', 'Green', 'Blue', 'Violet', 'Orange', 'Red+'];

	/** @type {Array<{name: string, min: number, max: number}>} Deterministic level-band order */
	static LEVEL_BANDS = [
		{ name: '1-40', min: 1, max: 40 },
		{ name: '41-80', min: 41, max: 80 },
		{ name: '81-120', min: 81, max: 120 },
		{ name: '121-130', min: 121, max: 130 },
	];

	/**
	 * Build projected item requirements for an entire hero roster.
	 *
	 * @param {{
	 *  heroes?: Array<object>,
	 *  heroUpgrades?: Array<object>,
	 *  equipmentChanges?: Array<object>,
	 *  inventoryItemUsages?: Array<object>,
	 *  inventoryData?: object,
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
	 *  totalOwnedForProjectedItems: number,
	 *  totalShortageItems: number,
	 *  distinctItems: number,
	 *  confidenceScore: number,
	 *  tierSummaries: Array<{
	 *   tierName: string,
	 *   totalProjectedItems: number,
	 *   totalOwnedForProjectedItems: number,
	 *   totalShortageItems: number,
	 *   distinctItems: number,
	 *   items: Array<{
	 *    itemId: string,
	 *    quantity: number,
	 *    ownedQuantity: number,
	 *    shortageQuantity: number
	 *   }>
	 *  }>,
	 *  levelBandSummaries: Array<{
	 *   bandName: string,
	 *   levelCount: number,
	 *   totalProjectedItems: number,
	 *   totalOwnedForProjectedItems: number,
	 *   totalShortageItems: number,
	 *   distinctItems: number,
	 *   items: Array<{
	 *    itemId: string,
	 *    quantity: number,
	 *    ownedQuantity: number,
	 *    shortageQuantity: number
	 *   }>
	 *  }>,
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
	 *   ownedQuantity: number,
	 *   shortageQuantity: number,
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
		const inventoryData = this._parseJson(input.inventoryData, {});
		const targetLevel = Math.max(1, Number(input.targetLevel) || this.DEFAULT_TARGET_LEVEL);
		const targetColorRank = Math.max(0, Number(input.targetColorRank) || this.DEFAULT_TARGET_COLOR_RANK);
		const topItemLimit = Math.max(1, Number(input.topItemLimit) || this.DEFAULT_TOP_ITEM_LIMIT);
		const topTierItemLimit = Math.max(1, Number(input.topTierItemLimit) || this.DEFAULT_TIER_TOP_ITEM_LIMIT);

		const levelModel = this._buildLevelDemandModel(heroUpgrades, inventoryItemUsages);
		const colorModel = this._buildColorDemandModel(heroUpgrades, equipmentChanges, inventoryItemUsages);

		const projectedLevelItems = this._emptyTotals();
		const projectedColorItems = this._emptyTotals();
		const projectedColorItemsByTier = this._buildEmptyTierTotals();
		const projectedLevelItemsByBand = this._buildEmptyLevelBandTotals(targetLevel);
		const levelBandCounts = this._buildEmptyLevelBandCounts(targetLevel);
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

				const bandCounts = this._countMissingLevelsByBand(currentLevel, targetLevel);
				for (const [bandName, missingLevels] of Object.entries(bandCounts)) {
					if (missingLevels <= 0) {
						continue;
					}
					levelBandCounts[bandName] = (levelBandCounts[bandName] || 0) + missingLevels;
					const bandTotals = projectedLevelItemsByBand[bandName] || this._emptyTotals();
					projectedLevelItemsByBand[bandName] = bandTotals;
					for (const [itemId, perLevel] of Object.entries(levelModel.perLevelDemand)) {
						this._addTotal(bandTotals, itemId, perLevel * missingLevels);
					}
				}
			}

			if (colorDeficit > 0) {
				for (let step = currentColor + 1; step <= targetColorRank; step++) {
					const perStepDemand = colorModel.perStepByRank.get(step) || colorModel.globalPerStepDemand;
					const tierName = this._tierNameForColorRank(step);
					const tierTotals = projectedColorItemsByTier[tierName] || this._emptyTotals();
					projectedColorItemsByTier[tierName] = tierTotals;
					for (const [itemId, perStep] of Object.entries(perStepDemand)) {
						this._addTotal(projectedColorItems, itemId, perStep);
						this._addTotal(tierTotals, itemId, perStep);
					}
				}
			}
		}

		const mergedItems = this._mergeTotals(projectedLevelItems, projectedColorItems);
		const ownedItemTotals = this._buildOwnedItemTotals(inventoryData);
		const fullItems = Object.entries(mergedItems)
			.map(([itemId, quantity]) => {
				const levelProjected = Math.ceil(projectedLevelItems[itemId] || 0);
				const colorProjected = Math.ceil(projectedColorItems[itemId] || 0);
				const ownedQuantity = Math.max(0, Math.floor(this._toNumber(ownedItemTotals[itemId])));
				const projectedQuantity = Math.ceil(quantity);
				const shortageQuantity = Math.max(0, projectedQuantity - ownedQuantity);
				return {
					itemId,
					quantity: projectedQuantity,
					ownedQuantity,
					shortageQuantity,
					levelProjected,
					colorProjected,
				};
			})
			.filter((entry) => entry.quantity > 0)
			.sort((a, b) => b.shortageQuantity - a.shortageQuantity || b.quantity - a.quantity);

		const sortedItems = fullItems
			.slice(0, topItemLimit);

		const totalProjectedItems = fullItems.reduce((sum, entry) => sum + entry.quantity, 0);
		const totalOwnedForProjectedItems = fullItems.reduce((sum, entry) => sum + Math.min(entry.ownedQuantity, entry.quantity), 0);
		const totalShortageItems = fullItems.reduce((sum, entry) => sum + entry.shortageQuantity, 0);
		const tierSummaries = this._buildTierSummaries(projectedColorItemsByTier, ownedItemTotals, topTierItemLimit);
		const levelBandSummaries = this._buildLevelBandSummaries(projectedLevelItemsByBand, levelBandCounts, ownedItemTotals, topTierItemLimit, targetLevel);
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
			totalOwnedForProjectedItems,
			totalShortageItems,
			distinctItems: fullItems.length,
			confidenceScore,
			tierSummaries,
			levelBandSummaries,
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
	 * Build deterministic per-level-band summaries for level progression materials.
	 *
	 * @param {Record<string, ItemTotals>} bandTotalsMap - Level-band totals keyed by band name
	 * @param {Record<string, number>} levelBandCounts - Missing level counts per band
	 * @param {ItemTotals} ownedItemTotals - Owned inventory totals keyed by item ID
	 * @param {number} topItemLimit - Max top items per band
	 * @param {number} targetLevel - Projection target level
	 * @returns {Array<object>} Level-band summary array
	 */
	static _buildLevelBandSummaries(bandTotalsMap, levelBandCounts, ownedItemTotals, topItemLimit, targetLevel) {
		const summaries = [];
		for (const band of this._activeLevelBands(targetLevel)) {
			const bandName = band.name;
			const totals = bandTotalsMap[bandName] || this._emptyTotals();
			const entries = Object.entries(totals)
				.map(([itemId, quantity]) => {
					const projectedQuantity = Math.ceil(quantity);
					const ownedQuantity = Math.max(0, Math.floor(this._toNumber(ownedItemTotals[itemId])));
					const shortageQuantity = Math.max(0, projectedQuantity - ownedQuantity);
					return {
						itemId,
						quantity: projectedQuantity,
						ownedQuantity,
						shortageQuantity,
					};
				})
				.filter((entry) => entry.quantity > 0)
				.sort((a, b) => b.shortageQuantity - a.shortageQuantity || b.quantity - a.quantity || a.itemId.localeCompare(b.itemId));

			const totalProjectedItems = entries.reduce((sum, entry) => sum + entry.quantity, 0);
			const totalOwnedForProjectedItems = entries.reduce((sum, entry) => sum + Math.min(entry.ownedQuantity, entry.quantity), 0);
			const totalShortageItems = entries.reduce((sum, entry) => sum + entry.shortageQuantity, 0);

			summaries.push({
				bandName,
				levelCount: Math.max(0, Math.floor(this._toNumber(levelBandCounts[bandName]))),
				totalProjectedItems,
				totalOwnedForProjectedItems,
				totalShortageItems,
				distinctItems: entries.length,
				items: entries.slice(0, topItemLimit),
			});
		}
		return summaries;
	}

	/**
	 * Build deterministic per-tier summaries for color progression materials.
	 *
	 * @param {Record<string, ItemTotals>} tierTotalsMap - Tier totals keyed by tier name
	 * @param {ItemTotals} ownedItemTotals - Owned inventory totals keyed by item ID
	 * @param {number} topTierItemLimit - Max top items per tier
	 * @returns {Array<object>} Tier summary array
	 */
	static _buildTierSummaries(tierTotalsMap, ownedItemTotals, topTierItemLimit) {
		const summaries = [];
		for (const tierName of this.COLOR_TIER_ORDER) {
			const totals = tierTotalsMap[tierName] || this._emptyTotals();
			const entries = Object.entries(totals)
				.map(([itemId, quantity]) => {
					const projectedQuantity = Math.ceil(quantity);
					const ownedQuantity = Math.max(0, Math.floor(this._toNumber(ownedItemTotals[itemId])));
					const shortageQuantity = Math.max(0, projectedQuantity - ownedQuantity);
					return {
						itemId,
						quantity: projectedQuantity,
						ownedQuantity,
						shortageQuantity,
					};
				})
				.filter((entry) => entry.quantity > 0)
				.sort((a, b) => b.shortageQuantity - a.shortageQuantity || b.quantity - a.quantity || a.itemId.localeCompare(b.itemId));

			const totalProjectedItems = entries.reduce((sum, entry) => sum + entry.quantity, 0);
			const totalOwnedForProjectedItems = entries.reduce((sum, entry) => sum + Math.min(entry.ownedQuantity, entry.quantity), 0);
			const totalShortageItems = entries.reduce((sum, entry) => sum + entry.shortageQuantity, 0);

			summaries.push({
				tierName,
				totalProjectedItems,
				totalOwnedForProjectedItems,
				totalShortageItems,
				distinctItems: entries.length,
				items: entries.slice(0, topTierItemLimit),
			});
		}

		return summaries;
	}

	/**
	 * Build an empty tier totals container in deterministic tier order.
	 *
	 * @returns {Record<string, ItemTotals>} Empty tier totals map
	 */
	static _buildEmptyTierTotals() {
		const map = {};
		for (const tierName of this.COLOR_TIER_ORDER) {
			map[tierName] = this._emptyTotals();
		}
		return map;
	}

	/**
	 * Build empty totals map for active level bands.
	 *
	 * @param {number} targetLevel - Projection target level
	 * @returns {Record<string, ItemTotals>} Empty level-band totals map
	 */
	static _buildEmptyLevelBandTotals(targetLevel) {
		const map = {};
		for (const band of this._activeLevelBands(targetLevel)) {
			map[band.name] = this._emptyTotals();
		}
		return map;
	}

	/**
	 * Build empty level count map for active level bands.
	 *
	 * @param {number} targetLevel - Projection target level
	 * @returns {Record<string, number>} Empty level-band counts
	 */
	static _buildEmptyLevelBandCounts(targetLevel) {
		const counts = {};
		for (const band of this._activeLevelBands(targetLevel)) {
			counts[band.name] = 0;
		}
		return counts;
	}

	/**
	 * Count missing levels from current level to target level grouped by level band.
	 *
	 * @param {number} currentLevel - Hero current level
	 * @param {number} targetLevel - Projection target level
	 * @returns {Record<string, number>} Missing level counts by band name
	 */
	static _countMissingLevelsByBand(currentLevel, targetLevel) {
		const counts = this._buildEmptyLevelBandCounts(targetLevel);
		for (const band of this._activeLevelBands(targetLevel)) {
			const from = Math.max(currentLevel + 1, band.min);
			const to = Math.min(targetLevel, band.max);
			if (to >= from) {
				counts[band.name] += (to - from + 1);
			}
		}
		return counts;
	}

	/**
	 * Resolve active level bands clipped to the current target level.
	 *
	 * @param {number} targetLevel - Projection target level
	 * @returns {Array<{name: string, min: number, max: number}>} Active bands
	 */
	static _activeLevelBands(targetLevel) {
		return this.LEVEL_BANDS
			.filter((band) => band.min <= targetLevel)
			.map((band) => ({
				name: band.name,
				min: band.min,
				max: Math.min(band.max, targetLevel),
			}));
	}

	/**
	 * Map a color rank to high-level progression tier.
	 *
	 * @param {number} rank - Numeric hero color rank
	 * @returns {string} Tier label
	 */
	static _tierNameForColorRank(rank) {
		if (rank <= 0) return 'Grey';
		if (rank <= 2) return 'Green';
		if (rank <= 5) return 'Blue';
		if (rank <= 9) return 'Violet';
		if (rank <= 14) return 'Orange';
		return 'Red+';
	}

	/**
	 * Build item ownership totals keyed by item ID from raw inventory data.
	 *
	 * @param {object} inventoryData - Raw inventory payload captured from inventoryGet
	 * @returns {ItemTotals} Owned quantity totals
	 */
	static _buildOwnedItemTotals(inventoryData) {
		const totals = this._emptyTotals();
		if (!inventoryData || typeof inventoryData !== 'object') {
			return totals;
		}

		for (const value of Object.values(inventoryData)) {
			if (!value || typeof value !== 'object') {
				continue;
			}

			for (const [rawId, rawQty] of Object.entries(value)) {
				const itemId = this._normalizeItemId(rawId);
				const qty = Math.max(0, Math.floor(this._toNumber(rawQty)));
				if (!itemId || qty <= 0) {
					continue;
				}
				this._addTotal(totals, itemId, qty);
			}
		}

		return totals;
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
