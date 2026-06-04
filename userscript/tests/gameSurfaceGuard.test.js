import { isGameSurfaceLocation } from '../src/modules/helpers/gameSurfaceGuard.js';

describe('gameSurfaceGuard', () => {
	it('should reject community feed pages', () => {
		const result = isGameSurfaceLocation({
			hostname: 'community.hero-wars.com',
			pathname: '/feed/all/1',
		});

		expect(result).toBe(false);
	});

	it('should allow main game host', () => {
		const result = isGameSurfaceLocation({
			hostname: 'www.hero-wars.com',
			pathname: '/play',
		});

		expect(result).toBe(true);
	});

	it('should allow nexters game hosts', () => {
		const result = isGameSurfaceLocation({
			hostname: 'i-heroes-fb.nextersglobal.com',
			pathname: '/',
		});

		expect(result).toBe(true);
	});

	it('should reject unknown hosts', () => {
		const result = isGameSurfaceLocation({
			hostname: 'example.com',
			pathname: '/',
		});

		expect(result).toBe(false);
	});
});
