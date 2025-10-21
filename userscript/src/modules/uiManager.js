/**
 * UIManager Module
 * Manages the browser UI overlay
 */

class UIManager {
	constructor(storage, gameTracker, goalsManager, calendarManager, suggestionsEngine) {
		this.storage = storage;
		this.gameTracker = gameTracker;
		this.goalsManager = goalsManager;
		this.calendarManager = calendarManager;
		this.suggestionsEngine = suggestionsEngine;

		this.isVisible = this.storage.get('uiVisible', true);
		this.currentView = 'dashboard';
		this.overlay = null;
	}

	init() {
		this.createOverlay();
		this.attachEventListeners();

		if (this.isVisible) {
			this.show();
		}

		// Add keyboard shortcut to toggle UI (Ctrl+Shift+H)
		document.addEventListener('keydown', (e) => {
			if (e.ctrlKey && e.shiftKey && e.key === 'H') {
				this.toggle();
			}
		});
	}

	createOverlay() {
		// Create main overlay container
		this.overlay = document.createElement('div');
		this.overlay.id = 'organizedJihad-overlay';
		this.overlay.className = 'oj-overlay';

		this.overlay.innerHTML = `
			<div class="oj-container">
				<div class="oj-header">
					<h2 class="oj-title">OrganizedJihad Tracker</h2>
					<div class="oj-header-actions">
						<button class="oj-btn oj-btn-icon" id="oj-minimize" title="Minimize">−</button>
						<button class="oj-btn oj-btn-icon" id="oj-close" title="Close">×</button>
					</div>
				</div>
				
				<div class="oj-nav">
					<button class="oj-nav-btn active" data-view="dashboard">Dashboard</button>
					<button class="oj-nav-btn" data-view="goals">Goals</button>
					<button class="oj-nav-btn" data-view="calendar">Calendar</button>
					<button class="oj-nav-btn" data-view="heroes">Heroes</button>
					<button class="oj-nav-btn" data-view="resources">Resources</button>
					<button class="oj-nav-btn" data-view="reports">Reports</button>
					<button class="oj-nav-btn" data-view="settings">Settings</button>
				</div>
				
				<div class="oj-content" id="oj-content">
					<!-- Content will be dynamically loaded here -->
				</div>
			</div>
		`;

		document.body.appendChild(this.overlay);

		// Render initial view
		this.renderView('dashboard');
	}

	attachEventListeners() {
		// Navigation buttons
		const navButtons = this.overlay.querySelectorAll('.oj-nav-btn');
		navButtons.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const view = e.target.dataset.view;
				this.switchView(view);
			});
		});

		// Close button
		document.getElementById('oj-close').addEventListener('click', () => {
			this.hide();
		});

		// Minimize button
		document.getElementById('oj-minimize').addEventListener('click', () => {
			this.overlay.classList.toggle('minimized');
		});

		// Make draggable
		this.makeDraggable();
	}

	makeDraggable() {
		const header = this.overlay.querySelector('.oj-header');
		let isDragging = false;
		let currentX, currentY, initialX, initialY;

		header.addEventListener('mousedown', (e) => {
			if (e.target.tagName === 'BUTTON') return;

			isDragging = true;
			initialX = e.clientX - this.overlay.offsetLeft;
			initialY = e.clientY - this.overlay.offsetTop;
			header.style.cursor = 'grabbing';
		});

		document.addEventListener('mousemove', (e) => {
			if (!isDragging) return;

			e.preventDefault();
			currentX = e.clientX - initialX;
			currentY = e.clientY - initialY;

			this.overlay.style.left = currentX + 'px';
			this.overlay.style.top = currentY + 'px';
		});

		document.addEventListener('mouseup', () => {
			isDragging = false;
			header.style.cursor = 'grab';
		});
	}

	switchView(view) {
		this.currentView = view;

		// Update nav buttons
		const navButtons = this.overlay.querySelectorAll('.oj-nav-btn');
		navButtons.forEach((btn) => {
			btn.classList.toggle('active', btn.dataset.view === view);
		});

		this.renderView(view);
	}

	renderView(view) {
		const content = document.getElementById('oj-content');

		switch (view) {
			case 'dashboard':
				content.innerHTML = this.renderDashboard();
				break;
			case 'goals':
				content.innerHTML = this.renderGoals();
				this.attachGoalEventListeners();
				break;
			case 'calendar':
				content.innerHTML = this.renderCalendar();
				this.attachCalendarEventListeners();
				break;
			case 'heroes':
				content.innerHTML = this.renderHeroes();
				break;
			case 'resources':
				content.innerHTML = this.renderResources();
				break;
			case 'reports':
				content.innerHTML = this.renderReports();
				break;
			case 'settings':
				content.innerHTML = this.renderSettings();
				this.attachSettingsEventListeners();
				break;
			default:
				content.innerHTML = '<p>View not found</p>';
		}
	}

	renderDashboard() {
		const gameData = this.gameTracker.getGameData();
		const activeGoals = this.goalsManager.getActiveGoals();
		const suggestions = this.suggestionsEngine.getSuggestions();
		const upcomingEvents = this.calendarManager.getUpcomingEvents(3);

		return `
			<div class="oj-dashboard">
				<div class="oj-section">
					<h3>Quick Stats</h3>
					<div class="oj-stats-grid">
						<div class="oj-stat-card">
							<div class="oj-stat-value">${gameData.heroes.length}</div>
							<div class="oj-stat-label">Heroes Tracked</div>
						</div>
						<div class="oj-stat-card">
							<div class="oj-stat-value">${activeGoals.shortTerm.length + activeGoals.longTerm.length}</div>
							<div class="oj-stat-label">Active Goals</div>
						</div>
						<div class="oj-stat-card">
							<div class="oj-stat-value">${upcomingEvents.length}</div>
							<div class="oj-stat-label">Upcoming Events</div>
						</div>
						<div class="oj-stat-card">
							<div class="oj-stat-value">${suggestions.length}</div>
							<div class="oj-stat-label">Suggestions</div>
						</div>
					</div>
				</div>
				
				<div class="oj-section">
					<h3>Suggestions</h3>
					<div class="oj-suggestions-list">
						${
							suggestions
								.slice(0, 5)
								.map(
									(s) => `
							<div class="oj-suggestion ${s.priority}">
								<div class="oj-suggestion-header">
									<span class="oj-suggestion-title">${s.title}</span>
									<span class="oj-suggestion-priority">${s.priority}</span>
								</div>
								<p class="oj-suggestion-desc">${s.description}</p>
								<button class="oj-btn oj-btn-sm" onclick="dismissSuggestion(${s.id})">Dismiss</button>
							</div>
						`
								)
								.join('') || '<p class="oj-empty">No suggestions at the moment!</p>'
						}
					</div>
				</div>
				
				<div class="oj-section">
					<h3>Upcoming Events (Next 3 Days)</h3>
					<div class="oj-events-list">
						${
							upcomingEvents
								.map(
									(e) => `
							<div class="oj-event-item">
								<div class="oj-event-date">${new Date(e.startDate).toLocaleDateString()}</div>
								<div class="oj-event-title">${e.title}</div>
							</div>
						`
								)
								.join('') || '<p class="oj-empty">No upcoming events</p>'
						}
					</div>
				</div>
			</div>
		`;
	}

	renderGoals() {
		const goals = this.goalsManager.getAllGoals();

		return `
			<div class="oj-goals">
				<div class="oj-section-header">
					<h3>Goals Management</h3>
					<button class="oj-btn" id="oj-add-goal">+ Add Goal</button>
				</div>
				
				<div class="oj-tabs">
					<button class="oj-tab-btn active" data-tab="short">Short Term</button>
					<button class="oj-tab-btn" data-tab="long">Long Term</button>
				</div>
				
				<div class="oj-tab-content active" data-tab="short">
					<div class="oj-goals-list">
						${this.renderGoalsList(goals.shortTerm)}
					</div>
				</div>
				
				<div class="oj-tab-content" data-tab="long">
					<div class="oj-goals-list">
						${this.renderGoalsList(goals.longTerm)}
					</div>
				</div>
			</div>
		`;
	}

	renderGoalsList(goals) {
		if (goals.length === 0) {
			return '<p class="oj-empty">No goals yet. Add one to get started!</p>';
		}

		return goals
			.map((goal) => {
				const progress = goal.target ? ((goal.current / goal.target) * 100).toFixed(1) : 0;
				return `
				<div class="oj-goal-card ${goal.status}">
					<div class="oj-goal-header">
						<h4>${goal.title}</h4>
						<span class="oj-badge ${goal.priority}">${goal.priority}</span>
					</div>
					<p class="oj-goal-desc">${goal.description}</p>
					${
						goal.target
							? `
						<div class="oj-progress-bar">
							<div class="oj-progress-fill" style="width: ${progress}%"></div>
							<span class="oj-progress-text">${goal.current} / ${goal.target}</span>
						</div>
					`
							: ''
					}
					<div class="oj-goal-footer">
						<span class="oj-goal-category">${goal.category}</span>
						${goal.deadline ? `<span class="oj-goal-deadline">Due: ${new Date(goal.deadline).toLocaleDateString()}</span>` : ''}
					</div>
				</div>
			`;
			})
			.join('');
	}

	renderCalendar() {
		const events = this.calendarManager.getUpcomingEvents(30);

		return `
			<div class="oj-calendar">
				<div class="oj-section-header">
					<h3>Calendar & Events</h3>
					<button class="oj-btn" id="oj-add-event">+ Add Event</button>
				</div>
				
				<div class="oj-events-list">
					${
						events
							.map(
								(e) => `
						<div class="oj-event-card ${e.type}">
							<div class="oj-event-header">
								<h4>${e.title}</h4>
								<span class="oj-badge">${e.type}</span>
							</div>
							<p>${e.description}</p>
							<div class="oj-event-dates">
								<span>Start: ${new Date(e.startDate).toLocaleString()}</span>
								<span>End: ${new Date(e.endDate).toLocaleString()}</span>
							</div>
						</div>
					`
							)
							.join('') || '<p class="oj-empty">No upcoming events</p>'
					}
				</div>
			</div>
		`;
	}

	renderHeroes() {
		const heroes = this.gameTracker.getHeroes();

		return `
			<div class="oj-heroes">
				<h3>Heroes</h3>
				<div class="oj-heroes-grid">
					${
						heroes
							.map(
								(hero) => `
						<div class="oj-hero-card">
							<h4>${hero.name}</h4>
							<div class="oj-hero-stats">
								<span>Level: ${hero.level}</span>
								<span>Power: ${hero.power}</span>
							</div>
						</div>
					`
							)
							.join('') || '<p class="oj-empty">No hero data tracked yet</p>'
					}
				</div>
			</div>
		`;
	}

	renderResources() {
		const resources = this.gameTracker.getResources();

		return `
			<div class="oj-resources">
				<h3>Resources</h3>
				<div class="oj-resources-grid">
					${
						Object.keys(resources)
							.map(
								(key) => `
						<div class="oj-resource-card">
							<h4>${key}</h4>
							<div class="oj-resource-amount">${resources[key].amount}</div>
							<div class="oj-resource-time">Updated: ${new Date(resources[key].timestamp).toLocaleString()}</div>
						</div>
					`
							)
							.join('') || '<p class="oj-empty">No resource data tracked yet</p>'
					}
				</div>
			</div>
		`;
	}

	renderReports() {
		const goalStats = this.goalsManager.getStats();
		const calendarStats = this.calendarManager.getStats();
		const suggestionStats = this.suggestionsEngine.getStats();

		return `
			<div class="oj-reports">
				<h3>Reports & Statistics</h3>
				
				<div class="oj-report-section">
					<h4>Goals Statistics</h4>
					<div class="oj-stats-grid">
						<div class="oj-stat-card">
							<div class="oj-stat-value">${goalStats.total}</div>
							<div class="oj-stat-label">Total Goals</div>
						</div>
						<div class="oj-stat-card">
							<div class="oj-stat-value">${goalStats.active}</div>
							<div class="oj-stat-label">Active</div>
						</div>
						<div class="oj-stat-card">
							<div class="oj-stat-value">${goalStats.completed}</div>
							<div class="oj-stat-label">Completed</div>
						</div>
						<div class="oj-stat-card">
							<div class="oj-stat-value">${goalStats.completionRate}%</div>
							<div class="oj-stat-label">Completion Rate</div>
						</div>
					</div>
				</div>
				
				<div class="oj-report-section">
					<h4>Calendar Statistics</h4>
					<div class="oj-stats-grid">
						<div class="oj-stat-card">
							<div class="oj-stat-value">${calendarStats.total}</div>
							<div class="oj-stat-label">Total Events</div>
						</div>
						<div class="oj-stat-card">
							<div class="oj-stat-value">${calendarStats.upcoming}</div>
							<div class="oj-stat-label">Upcoming</div>
						</div>
						<div class="oj-stat-card">
							<div class="oj-stat-value">${calendarStats.activeGameEvents}</div>
							<div class="oj-stat-label">Active Game Events</div>
						</div>
					</div>
				</div>
				
				<div class="oj-report-section">
					<h4>Suggestions Statistics</h4>
					<div class="oj-stats-grid">
						<div class="oj-stat-card">
							<div class="oj-stat-value">${suggestionStats.active}</div>
							<div class="oj-stat-label">Active Suggestions</div>
						</div>
						<div class="oj-stat-card high">
							<div class="oj-stat-value">${suggestionStats.high}</div>
							<div class="oj-stat-label">High Priority</div>
						</div>
						<div class="oj-stat-card medium">
							<div class="oj-stat-value">${suggestionStats.medium}</div>
							<div class="oj-stat-label">Medium Priority</div>
						</div>
						<div class="oj-stat-card low">
							<div class="oj-stat-value">${suggestionStats.low}</div>
							<div class="oj-stat-label">Low Priority</div>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	renderSettings() {
		return `
			<div class="oj-settings">
				<h3>Settings</h3>
				
				<div class="oj-settings-group">
					<h4>Data Management</h4>
					<button class="oj-btn" id="oj-export-data">Export Data</button>
					<button class="oj-btn" id="oj-import-data">Import Data</button>
					<button class="oj-btn oj-btn-danger" id="oj-clear-data">Clear All Data</button>
				</div>
				
				<div class="oj-settings-group">
					<h4>Display</h4>
					<label>
						<input type="checkbox" id="oj-auto-show" ${this.isVisible ? 'checked' : ''}>
						Show overlay on page load
					</label>
				</div>
				
				<div class="oj-settings-group">
					<h4>Keyboard Shortcuts</h4>
					<p>Ctrl+Shift+H - Toggle overlay visibility</p>
				</div>
				
				<div class="oj-settings-group">
					<h4>About</h4>
					<p>OrganizedJihad - Hero Wars Tracker v1.0.0</p>
					<p>Track your progress, manage goals, and optimize your gameplay!</p>
				</div>
			</div>
		`;
	}

	attachGoalEventListeners() {
		// Tab switching
		const tabBtns = this.overlay.querySelectorAll('.oj-tab-btn');
		tabBtns.forEach((btn) => {
			btn.addEventListener('click', (e) => {
				const tab = e.target.dataset.tab;
				tabBtns.forEach((b) => b.classList.remove('active'));
				e.target.classList.add('active');

				const contents = this.overlay.querySelectorAll('.oj-tab-content');
				contents.forEach((c) => {
					c.classList.toggle('active', c.dataset.tab === tab);
				});
			});
		});

		// Add goal button
		const addBtn = document.getElementById('oj-add-goal');
		if (addBtn) {
			addBtn.addEventListener('click', () => {
				this.showAddGoalDialog();
			});
		}
	}

	attachCalendarEventListeners() {
		const addBtn = document.getElementById('oj-add-event');
		if (addBtn) {
			addBtn.addEventListener('click', () => {
				this.showAddEventDialog();
			});
		}
	}

	attachSettingsEventListeners() {
		// Export data
		const exportBtn = document.getElementById('oj-export-data');
		if (exportBtn) {
			exportBtn.addEventListener('click', () => {
				const data = this.storage.exportData();
				const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `organizedJihad-backup-${Date.now()}.json`;
				a.click();
			});
		}

		// Clear data
		const clearBtn = document.getElementById('oj-clear-data');
		if (clearBtn) {
			clearBtn.addEventListener('click', () => {
				if (confirm('Are you sure you want to clear all data? This cannot be undone!')) {
					this.storage.clearAll();
					alert('All data cleared!');
					this.renderView(this.currentView);
				}
			});
		}

		// Auto-show checkbox
		const autoShowCheckbox = document.getElementById('oj-auto-show');
		if (autoShowCheckbox) {
			autoShowCheckbox.addEventListener('change', (e) => {
				this.isVisible = e.target.checked;
				this.storage.set('uiVisible', this.isVisible);
			});
		}
	}

	showAddGoalDialog() {
		// This would show a modal dialog for adding goals
		// For now, just a simple prompt
		const title = prompt('Goal title:');
		if (title) {
			this.goalsManager.addGoal({
				title,
				type: 'shortTerm',
				category: 'general',
			});
			this.renderView('goals');
		}
	}

	showAddEventDialog() {
		const title = prompt('Event title:');
		if (title) {
			this.calendarManager.addEvent({
				title,
				startDate: Date.now(),
				type: 'custom',
			});
			this.renderView('calendar');
		}
	}

	show() {
		if (this.overlay) {
			this.overlay.style.display = 'block';
			this.isVisible = true;
			this.storage.set('uiVisible', true);
		}
	}

	hide() {
		if (this.overlay) {
			this.overlay.style.display = 'none';
			this.isVisible = false;
			this.storage.set('uiVisible', false);
		}
	}

	toggle() {
		if (this.isVisible) {
			this.hide();
		} else {
			this.show();
		}
	}
}

export default UIManager;
