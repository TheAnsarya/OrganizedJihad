/**
 * Shared activity presentation helpers.
 */

/**
 * Return a CSS class for an activity event row based on event type and data.
 *
 * @param {object} evt - Activity event object
 * @returns {string} CSS class name
 */
export function activityColorClass(evt) {
	const type = evt?.eventType || '';
	if (type === 'error') return 'oj-event-red';
	if (type === 'battle') return evt?.isWin ? 'oj-event-green' : 'oj-event-red';
	if (type === 'resource') return 'oj-event-green';
	if (type === 'hero' || type === 'upgrade') return 'oj-event-gold';
	if (type === 'chest') return 'oj-event-purple';
	return 'oj-event-blue';
}

/**
 * Return an icon for an activity event type.
 *
 * @param {object} evt - Activity event object
 * @returns {string} Icon
 */
export function activityIcon(evt) {
	const icons = {
		battle: '\u2694\uFE0F',
		resource: '\uD83D\uDCB0',
		hero: '\uD83E\uDDB8',
		chest: '\uD83C\uDF81',
		upgrade: '\u2B06\uFE0F',
		error: '\u274C',
		info: '\uD83D\uDCCB',
	};
	return icons[evt?.eventType] || '\u2022';
}
