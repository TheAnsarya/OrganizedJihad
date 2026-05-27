/**
 * Activity feed renderer.
 */

/**
 * Render color-coded activity feed rows and container.
 *
 * @param {object} params - Render params
 * @param {Array<object>} params.events - Activity events array
 * @param {number} params.displayLimit - Max number of rows to display
 * @param {(evt: object) => string} params.activityColorClass - Row color class callback
 * @param {(evt: object) => string} params.activityIcon - Icon callback
 * @param {(value: string) => string} params.escapeHtml - HTML escape callback
 * @returns {string} HTML content
 */
export function renderActivityEventsFeed(params) {
	const events = Array.isArray(params?.events) ? params.events : [];
	const displayLimit = Number(params?.displayLimit || 0);
	const activityColorClass = params?.activityColorClass;
	const activityIcon = params?.activityIcon;
	const escapeHtml = params?.escapeHtml;
	if (
		typeof activityColorClass !== 'function' ||
		typeof activityIcon !== 'function' ||
		typeof escapeHtml !== 'function'
	) {
		return '';
	}

	const rows = events.slice(0, displayLimit).map((evt) => {
		const time = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : '\u2014';
		const colorClass = activityColorClass(evt);
		const icon = activityIcon(evt);
		return `
			<div class="oj-activity-row ${colorClass}">
				<span class="oj-activity-time oj-mono">${time}</span>
				<span class="oj-activity-icon">${icon}</span>
				<span class="oj-activity-msg">${escapeHtml(evt.message || '')}</span>
			</div>
		`;
	}).join('');

	return `
		<div class="oj-activity">
			<h3>\uD83D\uDCE1 Live Activity Feed <span class="oj-muted">(showing ${Math.min(events.length, displayLimit)} of ${events.length} events)</span></h3>
			<div class="oj-activity-list">${rows}</div>
		</div>
	`;
}
