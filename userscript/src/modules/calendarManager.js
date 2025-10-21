/**
 * CalendarManager Module
 * Manages events, schedules, and reminders
 */

class CalendarManager {
	constructor(storage) {
		this.storage = storage;
		this.events = [];
		this.loadEvents();
	}

	loadEvents() {
		const savedEvents = this.storage.get('calendarEvents');
		if (savedEvents) {
			this.events = savedEvents;
		}
	}

	saveEvents() {
		this.storage.set('calendarEvents', this.events);
	}

	/**
	 * Add a new event
	 * @param {Object} event - Event object
	 */
	addEvent(event) {
		const newEvent = {
			id: Date.now(),
			title: event.title,
			description: event.description || '',
			type: event.type || 'custom', // game-event, daily, weekly, custom
			startDate: event.startDate,
			endDate: event.endDate || event.startDate,
			recurring: event.recurring || false,
			recurringPattern: event.recurringPattern || null, // daily, weekly, monthly
			reminder: event.reminder || false,
			reminderTime: event.reminderTime || null,
			completed: false,
			createdAt: Date.now(),
		};

		this.events.push(newEvent);
		this.saveEvents();
		return newEvent;
	}

	/**
	 * Update an event
	 * @param {number} id - Event ID
	 * @param {Object} updates - Updates to apply
	 */
	updateEvent(id, updates) {
		const event = this.events.find((e) => e.id === id);
		if (event) {
			Object.assign(event, updates);
			this.saveEvents();
			return event;
		}
		return null;
	}

	/**
	 * Delete an event
	 * @param {number} id - Event ID
	 */
	deleteEvent(id) {
		this.events = this.events.filter((e) => e.id !== id);
		this.saveEvents();
	}

	/**
	 * Mark event as completed
	 * @param {number} id - Event ID
	 */
	completeEvent(id) {
		const event = this.events.find((e) => e.id === id);
		if (event) {
			event.completed = true;
			this.saveEvents();
			return event;
		}
		return null;
	}

	/**
	 * Get events for a specific date
	 * @param {Date|number} date - Date to get events for
	 */
	getEventsForDate(date) {
		const targetDate = new Date(date);
		targetDate.setHours(0, 0, 0, 0);
		const targetTime = targetDate.getTime();

		return this.events.filter((event) => {
			const eventStart = new Date(event.startDate);
			eventStart.setHours(0, 0, 0, 0);
			const eventEnd = new Date(event.endDate);
			eventEnd.setHours(23, 59, 59, 999);

			return targetTime >= eventStart.getTime() && targetTime <= eventEnd.getTime();
		});
	}

	/**
	 * Get events for a date range
	 * @param {Date|number} startDate - Start date
	 * @param {Date|number} endDate - End date
	 */
	getEventsInRange(startDate, endDate) {
		const start = new Date(startDate).getTime();
		const end = new Date(endDate).getTime();

		return this.events.filter((event) => {
			const eventStart = new Date(event.startDate).getTime();
			const eventEnd = new Date(event.endDate).getTime();

			return (
				(eventStart >= start && eventStart <= end) ||
				(eventEnd >= start && eventEnd <= end) ||
				(eventStart <= start && eventEnd >= end)
			);
		});
	}

	/**
	 * Get upcoming events
	 * @param {number} days - Number of days to look ahead
	 */
	getUpcomingEvents(days = 7) {
		const now = Date.now();
		const future = now + days * 24 * 60 * 60 * 1000;

		return this.events
			.filter((event) => {
				const eventStart = new Date(event.startDate).getTime();
				return eventStart >= now && eventStart <= future && !event.completed;
			})
			.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
	}

	/**
	 * Get events that need reminders
	 */
	getEventsNeedingReminders() {
		const now = Date.now();

		return this.events.filter((event) => {
			if (!event.reminder || event.completed) return false;

			const reminderTime = event.reminderTime || event.startDate;
			return new Date(reminderTime).getTime() <= now;
		});
	}

	/**
	 * Get all events
	 */
	getAllEvents() {
		return [...this.events];
	}

	/**
	 * Get events by type
	 * @param {string} type - Event type
	 */
	getEventsByType(type) {
		return this.events.filter((e) => e.type === type);
	}

	/**
	 * Get active game events
	 */
	getActiveGameEvents() {
		const now = Date.now();
		return this.events.filter((event) => {
			if (event.type !== 'game-event') return false;

			const start = new Date(event.startDate).getTime();
			const end = new Date(event.endDate).getTime();

			return now >= start && now <= end;
		});
	}

	/**
	 * Auto-add game events (to be called when game events are detected)
	 * @param {Object} gameEvent - Game event data
	 */
	addGameEvent(gameEvent) {
		// Check if event already exists
		const existing = this.events.find(
			(e) => e.type === 'game-event' && e.title === gameEvent.title && e.startDate === gameEvent.startDate
		);

		if (!existing) {
			return this.addEvent({
				...gameEvent,
				type: 'game-event',
			});
		}

		return existing;
	}

	/**
	 * Get calendar statistics
	 */
	getStats() {
		const now = Date.now();
		const upcoming = this.getUpcomingEvents(30);
		const activeGameEvents = this.getActiveGameEvents();

		return {
			total: this.events.length,
			upcoming: upcoming.length,
			activeGameEvents: activeGameEvents.length,
			completed: this.events.filter((e) => e.completed).length,
			withReminders: this.events.filter((e) => e.reminder).length,
		};
	}
}

export default CalendarManager;
