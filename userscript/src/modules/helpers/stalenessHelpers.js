/**
 * Staleness/time formatting helpers.
 */

/**
 * Format a timestamp as a human-readable relative time string.
 *
 * @param {number|null} timestamp - Unix timestamp in ms
 * @returns {string} Relative time string
 */
export function timeAgo(timestamp) {
	if (!timestamp) return '';
	const diff = Date.now() - timestamp;
	if (diff < 0) return 'just now';
	const secs = Math.floor(diff / 1000);
	if (secs < 60) return 'just now';
	const mins = Math.floor(secs / 60);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return `${Math.floor(days / 7)}w ago`;
}

/**
 * Render a tiny staleness indicator for dashboard cards.
 *
 * @param {number|null} lastUpdate - Timestamp from metadata
 * @returns {string} HTML string for staleness indicator
 */
export function stalenessTag(lastUpdate) {
	if (!lastUpdate) return '';
	const ago = timeAgo(lastUpdate);
	if (!ago) return '';
	const isStale = (Date.now() - lastUpdate) > 24 * 60 * 60 * 1000;
	const color = isStale ? '#ef9a9a' : '#666';
	return `<div style="font-size:8px;color:${color};margin-top:1px">${ago}</div>`;
}
