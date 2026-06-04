/**
 * Determine whether the current page is an actual Hero Wars game surface.
 *
 * The userscript metadata intentionally matches broad hero-wars domains,
 * but overlays should only initialize on real game runtimes.
 *
 * @param {Location|{hostname?: string, pathname?: string}} locationLike - Browser location object
 * @returns {boolean} True when in-game UI should initialize
 */
export function isGameSurfaceLocation(locationLike) {
	const hostname = String(locationLike?.hostname || '').toLowerCase();
	const pathname = String(locationLike?.pathname || '').toLowerCase();

	if (!hostname) {
		return false;
	}

	// Explicitly block community/news surfaces.
	if (hostname === 'community.hero-wars.com') {
		return false;
	}
	if (pathname.startsWith('/feed/') || pathname === '/feed' || pathname.startsWith('/discussion')) {
		return false;
	}

	// Known direct game runtimes.
	if (hostname === 'www.hero-wars.com') {
		return true;
	}
	if (hostname === 'i.hero-wars-fb.com') {
		return true;
	}
	if (hostname.endsWith('.nextersglobal.com') && hostname.startsWith('i-heroes-')) {
		return true;
	}
	if (hostname.endsWith('.apps.fbsbx.com')) {
		return true;
	}

	return false;
}
