/**
 * Shared data-browser sort helpers.
 */

/**
 * Return a sort direction indicator arrow for a column header.
 *
 * @param {string} activeField - Currently active sort field
 * @param {string} activeDir - Current sort direction ('asc' | 'desc')
 * @param {string} field - Field represented by this header
 * @returns {string} Unicode arrow or empty string
 */
export function sortIndicator(activeField, activeDir, field) {
	if (activeField !== field) return '';
	return activeDir === 'asc' ? '\u25B2' : '\u25BC';
}

/**
 * Generic client-side sort for an array of objects.
 * Handles string and numeric fields using common aliases.
 *
 * @param {Array<object>} data - Array to sort (mutated in-place)
 * @param {string} field - Field name to sort by
 * @param {string} dir - 'asc' or 'desc'
 * @returns {Array<object>} Sorted array
 */
export function sortData(data, field, dir) {
	const mul = dir === 'asc' ? 1 : -1;
	const fieldMap = {
		name: (obj) => (obj.heroName || obj.titanName || obj.name || obj.itemName || '').toLowerCase(),
		level: (obj) => obj.level || 0,
		stars: (obj) => obj.stars || 0,
		power: (obj) => obj.power || 0,
		color: (obj) => typeof obj.color === 'number' ? obj.color : parseInt(obj.color, 10) || 0,
		element: (obj) => (obj.element || '').toLowerCase(),
		count: (obj) => obj.count ?? obj.quantity ?? 0,
		category: (obj) => (obj.category || obj.type || '').toLowerCase(),
		timestamp: (obj) => obj.timestamp ? new Date(obj.timestamp).getTime() : 0,
		result: (obj) => (obj.isWin ? 1 : 0),
		type: (obj) => (obj.battleType || obj.type || '').toLowerCase(),
		attacker: (obj) => (obj.attackerName || obj.playerName || '').toLowerCase(),
		opponent: (obj) => (obj.opponentName || '').toLowerCase(),
	};

	const getter = fieldMap[field] || ((obj) => obj[field]);
	return data.sort((a, b) => {
		const av = getter(a);
		const bv = getter(b);
		if (av == null && bv == null) return 0;
		if (av == null) return 1;
		if (bv == null) return -1;

		if (typeof av === 'string' || typeof bv === 'string') {
			return String(av).localeCompare(String(bv)) * mul;
		}
		return (av - bv) * mul;
	});
}
