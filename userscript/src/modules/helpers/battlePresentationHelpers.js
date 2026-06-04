/**
 * Shared battle presentation helpers.
 */

/**
 * Format a number in compact notation (e.g. 1.2M, 45K).
 *
 * @param {number} n - Number to format
 * @returns {string} Compact string
 */
export function formatCompact(n) {
	if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
	if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
	return String(n);
}

/**
 * Map Hero Wars numeric color/rank to a human-readable name.
 *
 * @param {number|string} color - Numeric color rank
 * @returns {string} Rank name
 */
export function colorRankName(color) {
	const names = {
		0: 'Gray', 1: 'Green', 2: 'Green+1',
		3: 'Blue', 4: 'Blue+1', 5: 'Blue+2',
		6: 'Violet', 7: 'Violet+1', 8: 'Violet+2', 9: 'Violet+3',
		10: 'Orange', 11: 'Orange+1', 12: 'Orange+2', 13: 'Orange+3', 14: 'Orange+4',
		15: 'Red', 16: 'Red+1', 17: 'Red+2', 18: 'Red+2 (Legacy Max)', 19: 'Red+3',
	};
	const num = typeof color === 'string' ? parseInt(color, 10) : color;
	return names[num] ?? (color != null ? `Rank ${color}` : '\u2014');
}

/**
 * Return a CSS class for a Hero Wars color rank.
 *
 * @param {number|string} color - Numeric color rank
 * @returns {string} CSS class name
 */
export function colorRankClass(color) {
	const num = typeof color === 'string' ? parseInt(color, 10) : color;
	if (num == null || isNaN(num)) return 'oj-rank-gray';
	if (num <= 0) return 'oj-rank-gray';
	if (num <= 2) return 'oj-rank-green';
	if (num <= 5) return 'oj-rank-blue';
	if (num <= 9) return 'oj-rank-violet';
	if (num <= 14) return 'oj-rank-orange';
	return 'oj-rank-red';
}
