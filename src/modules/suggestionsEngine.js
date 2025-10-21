/**
 * SuggestionsEngine Module
 * Provides intelligent suggestions based on game data and goals
 */

class SuggestionsEngine {
    constructor(storage, gameTracker, goalsManager) {
        this.storage = storage;
        this.gameTracker = gameTracker;
        this.goalsManager = goalsManager;
        this.suggestions = [];
        this.loadSuggestions();
    }

    loadSuggestions() {
        const saved = this.storage.get('suggestions');
        if (saved) {
            this.suggestions = saved;
        }
    }

    saveSuggestions() {
        this.storage.set('suggestions', this.suggestions);
    }

    /**
     * Update suggestions based on current game state and goals
     */
    updateSuggestions() {
        this.suggestions = [];

        // Generate suggestions based on active goals
        this.analyzeGoals();

        // Generate suggestions based on resource optimization
        this.analyzeResources();

        // Generate suggestions based on hero development
        this.analyzeHeroes();

        // Generate suggestions based on battle patterns
        this.analyzeBattles();

        this.saveSuggestions();
        return this.suggestions;
    }

    analyzeGoals() {
        const activeGoals = this.goalsManager.getActiveGoals();
        const allActiveGoals = [...activeGoals.shortTerm, ...activeGoals.longTerm];

        allActiveGoals.forEach(goal => {
            if (goal.target && goal.current) {
                const progress = (goal.current / goal.target) * 100;
                
                if (progress < 25) {
                    this.addSuggestion({
                        type: 'goal',
                        priority: goal.priority,
                        title: `Focus on: ${goal.title}`,
                        description: `You're at ${progress.toFixed(1)}% progress. Consider prioritizing this goal.`,
                        goalId: goal.id,
                        category: goal.category
                    });
                }

                // Check if goal is overdue
                if (goal.deadline && goal.deadline < Date.now()) {
                    this.addSuggestion({
                        type: 'goal',
                        priority: 'high',
                        title: `Overdue: ${goal.title}`,
                        description: `This goal passed its deadline. Consider revising or extending it.`,
                        goalId: goal.id,
                        category: goal.category
                    });
                }
            }
        });
    }

    analyzeResources() {
        const resources = this.gameTracker.getResources();
        
        // Check for low resources
        Object.keys(resources).forEach(resourceType => {
            const resource = resources[resourceType];
            if (resource.amount < 1000) { // Arbitrary threshold
                this.addSuggestion({
                    type: 'resource',
                    priority: 'medium',
                    title: `Low ${resourceType}`,
                    description: `Your ${resourceType} is running low. Consider farming or saving.`,
                    category: 'resource'
                });
            }
        });
    }

    analyzeHeroes() {
        const heroes = this.gameTracker.getHeroes();
        
        if (heroes.length > 0) {
            // Find heroes that haven't been upgraded recently
            const stagnantHeroes = heroes.filter(hero => {
                const daysSinceUpdate = (Date.now() - hero.timestamp) / (1000 * 60 * 60 * 24);
                return daysSinceUpdate > 7;
            });

            if (stagnantHeroes.length > 0) {
                this.addSuggestion({
                    type: 'hero',
                    priority: 'low',
                    title: 'Hero Development',
                    description: `${stagnantHeroes.length} hero(es) haven't been upgraded recently.`,
                    category: 'hero'
                });
            }

            // Suggest balanced team development
            const avgPower = heroes.reduce((sum, h) => sum + h.power, 0) / heroes.length;
            const weakHeroes = heroes.filter(h => h.power < avgPower * 0.7);

            if (weakHeroes.length > 0) {
                this.addSuggestion({
                    type: 'hero',
                    priority: 'medium',
                    title: 'Balance Your Team',
                    description: `${weakHeroes.length} hero(es) are significantly weaker than your average.`,
                    category: 'hero'
                });
            }
        }
    }

    analyzeBattles() {
        const battles = this.gameTracker.getBattleHistory();
        
        if (battles.length >= 5) {
            const recent = battles.slice(-10);
            // Add battle pattern analysis here
            
            // For now, just suggest daily battles if no recent activity
            const lastBattle = battles[battles.length - 1];
            const hoursSinceLastBattle = (Date.now() - lastBattle.timestamp) / (1000 * 60 * 60);
            
            if (hoursSinceLastBattle > 12) {
                this.addSuggestion({
                    type: 'battle',
                    priority: 'medium',
                    title: 'Battle Activity',
                    description: 'You haven\'t battled in over 12 hours. Daily battles earn valuable rewards!',
                    category: 'battle'
                });
            }
        }
    }

    addSuggestion(suggestion) {
        const newSuggestion = {
            id: Date.now() + Math.random(),
            ...suggestion,
            timestamp: Date.now(),
            dismissed: false
        };

        // Avoid duplicates
        const exists = this.suggestions.find(s => 
            s.title === newSuggestion.title && 
            s.type === newSuggestion.type
        );

        if (!exists) {
            this.suggestions.push(newSuggestion);
        }
    }

    /**
     * Get all active suggestions
     */
    getSuggestions() {
        return this.suggestions.filter(s => !s.dismissed);
    }

    /**
     * Get suggestions by priority
     * @param {string} priority - Priority level
     */
    getSuggestionsByPriority(priority) {
        return this.suggestions.filter(s => !s.dismissed && s.priority === priority);
    }

    /**
     * Get suggestions by type
     * @param {string} type - Suggestion type
     */
    getSuggestionsByType(type) {
        return this.suggestions.filter(s => !s.dismissed && s.type === type);
    }

    /**
     * Dismiss a suggestion
     * @param {number} id - Suggestion ID
     */
    dismissSuggestion(id) {
        const suggestion = this.suggestions.find(s => s.id === id);
        if (suggestion) {
            suggestion.dismissed = true;
            this.saveSuggestions();
        }
    }

    /**
     * Clear old suggestions
     * @param {number} days - Keep suggestions from last X days
     */
    clearOldSuggestions(days = 7) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        this.suggestions = this.suggestions.filter(s => s.timestamp > cutoff);
        this.saveSuggestions();
    }

    /**
     * Get suggestion statistics
     */
    getStats() {
        const active = this.suggestions.filter(s => !s.dismissed);
        
        return {
            total: this.suggestions.length,
            active: active.length,
            dismissed: this.suggestions.length - active.length,
            high: active.filter(s => s.priority === 'high').length,
            medium: active.filter(s => s.priority === 'medium').length,
            low: active.filter(s => s.priority === 'low').length
        };
    }
}

export default SuggestionsEngine;
