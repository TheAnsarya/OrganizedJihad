/**
 * GoalsManager Module
 * Manages short-term and long-term goals
 */

class GoalsManager {
	constructor(storage) {
		this.storage = storage;
		this.goals = {
			shortTerm: [],
			longTerm: [],
		};
		this.loadGoals();
	}

	loadGoals() {
		const savedGoals = this.storage.get('goals');
		if (savedGoals) {
			this.goals = savedGoals;
		}
	}

	saveGoals() {
		this.storage.set('goals', this.goals);
	}

	/**
	 * Add a new goal
	 * @param {Object} goal - Goal object
	 */
	addGoal(goal) {
		const newGoal = {
			id: Date.now(),
			title: goal.title,
			description: goal.description || '',
			type: goal.type || 'shortTerm', // shortTerm or longTerm
			category: goal.category || 'general', // hero, resource, battle, event, etc.
			target: goal.target || null,
			current: goal.current || 0,
			deadline: goal.deadline || null,
			priority: goal.priority || 'medium', // low, medium, high
			status: 'active', // active, completed, cancelled
			createdAt: Date.now(),
			completedAt: null,
			notes: [],
		};

		if (newGoal.type === 'shortTerm') {
			this.goals.shortTerm.push(newGoal);
		} else {
			this.goals.longTerm.push(newGoal);
		}

		this.saveGoals();
		return newGoal;
	}

	/**
	 * Update a goal
	 * @param {number} id - Goal ID
	 * @param {Object} updates - Updates to apply
	 */
	updateGoal(id, updates) {
		let goal = this.findGoal(id);
		if (goal) {
			Object.assign(goal, updates);
			this.saveGoals();
			return goal;
		}
		return null;
	}

	/**
	 * Update goal progress
	 * @param {number} id - Goal ID
	 * @param {number} current - Current progress value
	 */
	updateProgress(id, current) {
		let goal = this.findGoal(id);
		if (goal) {
			goal.current = current;

			// Auto-complete if target reached
			if (goal.target && current >= goal.target) {
				goal.status = 'completed';
				goal.completedAt = Date.now();
			}

			this.saveGoals();
			return goal;
		}
		return null;
	}

	/**
	 * Complete a goal
	 * @param {number} id - Goal ID
	 */
	completeGoal(id) {
		let goal = this.findGoal(id);
		if (goal) {
			goal.status = 'completed';
			goal.completedAt = Date.now();
			this.saveGoals();
			return goal;
		}
		return null;
	}

	/**
	 * Delete a goal
	 * @param {number} id - Goal ID
	 */
	deleteGoal(id) {
		this.goals.shortTerm = this.goals.shortTerm.filter((g) => g.id !== id);
		this.goals.longTerm = this.goals.longTerm.filter((g) => g.id !== id);
		this.saveGoals();
	}

	/**
	 * Find a goal by ID
	 * @param {number} id - Goal ID
	 */
	findGoal(id) {
		return this.goals.shortTerm.find((g) => g.id === id) || this.goals.longTerm.find((g) => g.id === id);
	}

	/**
	 * Add a note to a goal
	 * @param {number} id - Goal ID
	 * @param {string} note - Note text
	 */
	addNote(id, note) {
		let goal = this.findGoal(id);
		if (goal) {
			goal.notes.push({
				text: note,
				timestamp: Date.now(),
			});
			this.saveGoals();
			return goal;
		}
		return null;
	}

	/**
	 * Get all goals
	 */
	getAllGoals() {
		return {
			shortTerm: [...this.goals.shortTerm],
			longTerm: [...this.goals.longTerm],
		};
	}

	/**
	 * Get active goals
	 */
	getActiveGoals() {
		return {
			shortTerm: this.goals.shortTerm.filter((g) => g.status === 'active'),
			longTerm: this.goals.longTerm.filter((g) => g.status === 'active'),
		};
	}

	/**
	 * Get completed goals
	 */
	getCompletedGoals() {
		return {
			shortTerm: this.goals.shortTerm.filter((g) => g.status === 'completed'),
			longTerm: this.goals.longTerm.filter((g) => g.status === 'completed'),
		};
	}

	/**
	 * Get goals by category
	 * @param {string} category - Category name
	 */
	getGoalsByCategory(category) {
		return {
			shortTerm: this.goals.shortTerm.filter((g) => g.category === category),
			longTerm: this.goals.longTerm.filter((g) => g.category === category),
		};
	}

	/**
	 * Get overdue goals
	 */
	getOverdueGoals() {
		const now = Date.now();
		return {
			shortTerm: this.goals.shortTerm.filter((g) => g.status === 'active' && g.deadline && g.deadline < now),
			longTerm: this.goals.longTerm.filter((g) => g.status === 'active' && g.deadline && g.deadline < now),
		};
	}

	/**
	 * Get goal statistics
	 */
	getStats() {
		const allGoals = [...this.goals.shortTerm, ...this.goals.longTerm];
		const active = allGoals.filter((g) => g.status === 'active');
		const completed = allGoals.filter((g) => g.status === 'completed');

		return {
			total: allGoals.length,
			active: active.length,
			completed: completed.length,
			shortTerm: this.goals.shortTerm.length,
			longTerm: this.goals.longTerm.length,
			completionRate: allGoals.length > 0 ? ((completed.length / allGoals.length) * 100).toFixed(1) : 0,
		};
	}
}

export default GoalsManager;
