/**
 * Battle team renderer.
 */

/**
 * Render a compressed hero team as avatar rows with optional stats.
 *
 * @param {object} params - Render params
 * @param {string|null} params.heroesJson - JSON string of compressed team array
 * @param {string} [params.label='Team'] - Label shown above the team
 * @param {(value: string) => string} params.escapeHtml - HTML escape callback
 * @param {(color: number|string) => string} params.colorRankClass - Rank-class callback
 * @param {(color: number|string) => string} params.colorRankName - Rank-name callback
 * @param {(value: number) => string} params.formatCompact - Compact-number callback
 * @param {(id: number|string) => string} params.resolveHeroName - Hero-name resolver callback
 * @returns {string} HTML fragment
 */
export function renderBattleTeam(params) {
	const heroesJson = params?.heroesJson;
	const label = params?.label ?? 'Team';
	const escapeHtml = params?.escapeHtml;
	const colorRankClass = params?.colorRankClass;
	const colorRankName = params?.colorRankName;
	const formatCompact = params?.formatCompact;
	const resolveHeroName = params?.resolveHeroName;
	if (
		typeof escapeHtml !== 'function' ||
		typeof colorRankClass !== 'function' ||
		typeof colorRankName !== 'function' ||
		typeof formatCompact !== 'function' ||
		typeof resolveHeroName !== 'function'
	) {
		return '';
	}

	if (!heroesJson) return '';

	let heroes;
	try {
		heroes = JSON.parse(heroesJson);
	} catch {
		return '';
	}
	if (!Array.isArray(heroes) || heroes.length === 0) return '';

	const isNested = Array.isArray(heroes[0]) && Array.isArray(heroes[0][0]);
	const teams = isNested ? heroes : [heroes];

	const teamHtmls = teams.map((team, teamIdx) => {
		if (!Array.isArray(team)) return '';
		const avatars = team.map((h) => {
			const id = h[0] || 0;
			const level = h[1] || 0;
			const star = h[2] || 0;
			const color = h[3] || 0;
			const power = h[4] || 0;
			const damage = h[5] || 0;
			const healing = h[6] || 0;
			const petId = h[7] || 0;

			const avatarId = id >= 7000 ? id - 7000 : id;
			const avatarUrl = `https://calc2.hw-assist.com/static/assets/images/hero_icons/${String(avatarId).padStart(4, '0')}.png`;
			const name = resolveHeroName(id) || `#${id}`;
			const colorClass = colorRankClass(color);

			const statsTitle = `${name} Lv${level} ${'★'.repeat(Math.min(star, 6))} ${colorRankName(color)} | Power: ${power.toLocaleString()}` +
				(damage ? ` | DMG: ${damage.toLocaleString()}` : '') +
				(healing ? ` | Heal: ${healing.toLocaleString()}` : '');

			let petHtml = '';
			if (petId > 0) {
				const petAvatarId = petId >= 7000 ? petId - 7000 : petId;
				const petUrl = `https://calc2.hw-assist.com/static/assets/images/hero_icons/${String(petAvatarId).padStart(4, '0')}.png`;
				petHtml = `<img class="oj-battle-pet-icon" src="${petUrl}" alt="Pet" loading="lazy" onerror="this.style.display='none'" title="${resolveHeroName(petId) || 'Pet'}">`;
			}

			return `<div class="oj-battle-hero" title="${escapeHtml(statsTitle)}">` +
				`<img class="oj-hero-avatar ${colorClass}" src="${avatarUrl}" alt="${name}" loading="lazy" onerror="this.style.display='none'">` +
				petHtml +
				(damage ? `<div class="oj-battle-dmg">${formatCompact(damage)}</div>` : '') +
				`</div>`;
		}).join('');

		const teamLabel = teams.length > 1 ? ` ${teamIdx + 1}` : '';
		return `<div class="oj-battle-team-row">${avatars}</div>${teamLabel ? '' : ''}`;
	}).join('');

	return `<div class="oj-battle-team-block">` +
		`<div class="oj-battle-team-label">${label}</div>` +
		teamHtmls +
		`</div>`;
}
