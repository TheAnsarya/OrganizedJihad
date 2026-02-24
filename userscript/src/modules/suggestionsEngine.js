/**
 * SuggestionsEngine Module
 *
 * Provides intelligent suggestions based on game data and goals.
 * Analyses hero development, resource levels, and battle activity
 * to recommend actions the player should take.
 *
 * All analyse methods are async because GameTracker getters are async.
 *
 * @module suggestionsEngine
 */

class SuggestionsEngine {
	/**
	 * @param {Object} storage - Preference storage instance (get/set)
	 * @param {Object} gameTracker - GameTracker instance for data access
	 * @param {Object} goalsManager - GoalsManager instance for active goals
	 */
	constructor(storage, gameTracker, goalsManager) {
		this.storage = storage;
		this.gameTracker = gameTracker;
		this.goalsManager = goalsManager;

		/** @type {Array<Object>} Current suggestion list */
		this.suggestions = [];
		this._loadSuggestions();
	}

	/**
	 * Load persisted suggestions from storage.
	 * @private
	 */
	_loadSuggestions() {
		try {
			const saved = this.storage.get('suggestions');
			if (Array.isArray(saved)) {
				this.suggestions = saved;
			}
		} catch {
			// Storage unavailable — start empty
		}
	}

	/**
	 * Persist current suggestions to storage.
	 * @private
	 */
	_saveSuggestions() {
		try {
			this.storage.set('suggestions', this.suggestions);
		} catch {
			// Non-critical
		}
	}

	/**
	 * Update suggestions based on current game state and goals.
	 * Called periodically from the main setInterval.
	 *
	 * @returns {Promise<Array<Object>>} Updated suggestion list
	 */
	async updateSuggestions() {
		this.suggestions = [];

		await this._analyzeGoals();
		await this._analyzeResources();
		await this._analyzeHeroes();
		await this._analyzeBattles();

		this._saveSuggestions();
		return this.suggestions;
	}

	// ─── Analysers ───────────────────────────────────────────────────

	/**
	 * Generate suggestions from active goals progress.
	 * @private
	 */
	async _analyzeGoals() {
		try {
			const activeGoals = this.goalsManager.getActiveGoals();
			const allGoals = [...(activeGoals.shortTerm || []), ...(activeGoals.longTerm || [])];

			for (const goal of allGoals) {
				if (goal.target && goal.current != null) {
					const progress = (goal.current / goal.target) * 100;

					if (progress < 25) {
						this._addSuggestion({
							type: 'goal',
							priority: goal.priority || 'medium',
							title: `Focus on: ${goal.title}`,
							description: `You\u2019re at ${progress.toFixed(1)}% progress. Consider prioritizing this goal.`,
							goalId: goal.id,
							category: 'goal',
						});
					}

					// Overdue check
					if (goal.deadline && goal.deadline < Date.now()) {
						this._addSuggestion({
							type: 'goal',
							priority: 'high',
							title: `Overdue: ${goal.title}`,
							description: 'This goal passed its deadline. Consider revising or extending it.',
							goalId: goal.id,
							category: 'goal',
						});
					}
				}
			}
		} catch {
			// Goals data unavailable
		}
	}

	/**
	 * Generate suggestions from resource levels.
	 * Uses the flat { gold, emeralds, energy } shape returned by gameTracker.getResources().
	 * @private
	 */
	async _analyzeResources() {
		try {
			const resources = await this.gameTracker.getResources();

			// Thresholds for "low" resources
			/** @type {Record<string, { threshold: number, label: string }>} */
			const checks = {
				gold: { threshold: 50_000, label: 'Gold' },
				emeralds: { threshold: 100, label: 'Emeralds' },
				energy: { threshold: 20, label: 'Energy' },
			};

			for (const [key, cfg] of Object.entries(checks)) {
				const amount = resources[key] ?? 0;
				if (typeof amount === 'number' && amount < cfg.threshold) {
					this._addSuggestion({
						type: 'resource',
						priority: amount === 0 ? 'high' : 'medium',
						title: `Low ${cfg.label}`,
						description: `Your ${cfg.label} is at ${amount.toLocaleString()}. Consider farming or saving.`,
						category: 'resource',
					});
				}
			}
		} catch {
			// Resources unavailable
		}
	}

	/**
	 * Generate suggestions from hero roster data.
	 * Uses gameTracker.getHeroRoster() (async, returns array).
	 * @private
	 */
	async _analyzeHeroes() {
		try {
			const heroes = await this.gameTracker.getHeroRoster();
			if (!Array.isArray(heroes) || heroes.length === 0) return;

			// Find heroes that haven't been upgraded recently
			const now = Date.now();
			const stagnantHeroes = heroes.filter((hero) => {
				const ts = hero.timestamp ? new Date(hero.timestamp).getTime() : 0;
				const daysSince = (now - ts) / (1000 * 60 * 60 * 24);
				return daysSince > 7;
			});

			if (stagnantHeroes.length > 0) {
				this._addSuggestion({
					type: 'hero',
					priority: 'low',
					title: 'Hero Development',
					description: `${stagnantHeroes.length} hero(es) haven\u2019t been upgraded in over a week.`,
					category: 'hero',
				});
			}

			// Suggest balanced team development
			const avgPower = heroes.reduce((sum, h) => sum + (h.power || 0), 0) / heroes.length;
			const weakHeroes = heroes.filter((h) => (h.power || 0) < avgPower * 0.7);

			if (weakHeroes.length > 0) {
				this._addSuggestion({
					type: 'hero',
					priority: 'medium',
					title: 'Balance Your Team',
					description: `${weakHeroes.length} hero(es) are significantly weaker than your average power.`,
					category: 'hero',
				});
			}
		} catch {
			// Hero data unavailable
		}
	}

	/**
	 * Generate suggestions from battle activity.
	 * Uses gameTracker.getBattleHistory() (async, returns array).
	 * @private
	 */
	async _analyzeBattles() {
		try {
			const battles = await this.gameTracker.getBattleHistory();
			if (!Array.isArray(battles) || battles.length < 5) return;

			const lastBattle = battles[battles.length - 1];
			const lastTs = lastBattle.timestamp || 0;
			// Timestamps might be ISO strings or epoch ms
			const lastTime = typeof lastTs === 'string' ? new Date(lastTs).getTime() : lastTs;
			const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);

			if (hoursSince > 12) {
				this._addSuggestion({
					type: 'battle',
					priority: 'medium',
					title: 'Battle Activity',
					description: 'You haven\u2019t battled in over 12 hours. Daily battles earn valuable rewards!',
					category: 'battle',
				});
			}
		} catch {
			// Battle data unavailable
		}
	}

	// ─── Suggestion Management ───────────────────────────────────────

	/**
	 * Add a suggestion, avoiding duplicates by title + type.
	 *
	 * @param {Object} suggestion - Suggestion data
	 * @private
	 */
	_addSuggestion(suggestion) {
		const exists = this.suggestions.find(
			(s) => s.title === suggestion.title && s.type === suggestion.type
		);
		if (exists) return;

		this.suggestions.push({
			id: Date.now() + Math.random(),
			...suggestion,
			timestamp: Date.now(),
			dismissed: false,
		});
	}

	/**
	 * Get all active (non-dismissed) suggestions.
	 * @returns {Array<Object>} Active suggestions
	 */
	getSuggestions() {
		return this.suggestions.filter((s) => !s.dismissed);
	}

	/**
	 * Get suggestions filtered by priority.
	 *
	 * @param {string} priority - 'high', 'medium', or 'low'
	 * @returns {Array<Object>} Matching suggestions
	 */
	getSuggestionsByPriority(priority) {
		return this.suggestions.filter((s) => !s.dismissed && s.priority === priority);
	}

	/**
	 * Get suggestions filtered by type.
	 *
	 * @param {string} type - 'goal', 'resource', 'hero', 'battle'
	 * @returns {Array<Object>} Matching suggestions
	 */
	getSuggestionsByType(type) {
		return this.suggestions.filter((s) => !s.dismissed && s.type === type);
	}

	/**
	 * Dismiss a suggestion by ID.
	 *
	 * @param {number} id - Suggestion ID
	 */
	dismissSuggestion(id) {
		const suggestion = this.suggestions.find((s) => s.id === id);
		if (suggestion) {
			suggestion.dismissed = true;
			this._saveSuggestions();
		}
	}

	/**
	 * Clear suggestions older than the given number of days.
	 *
	 * @param {number} [days=7] - Retention period
	 */
	clearOldSuggestions(days = 7) {
		const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
		this.suggestions = this.suggestions.filter((s) => s.timestamp > cutoff);
		this._saveSuggestions();
	}

	/**
	 * Get suggestion statistics.
	 *
	 * @returns {Object} Stats: total, active, dismissed, high/medium/low counts
	 */
	getStats() {
		const active = this.suggestions.filter((s) => !s.dismissed);
		return {
			total: this.suggestions.length,
			active: active.length,
			dismissed: this.suggestions.length - active.length,
			high: active.filter((s) => s.priority === 'high').length,
			medium: active.filter((s) => s.priority === 'medium').length,
			low: active.filter((s) => s.priority === 'low').length,
		};
	}
}

export default SuggestionsEngine;
