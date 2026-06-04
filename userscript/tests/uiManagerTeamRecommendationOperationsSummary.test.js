import UIManager from '../src/modules/uiManager.js';

describe('uiManager team recommendation operations summary', () => {
	const makePrefStorage = (seed = {}) => ({
		get: jest.fn((key, fallback) => (Object.prototype.hasOwnProperty.call(seed, key) ? seed[key] : fallback)),
		set: jest.fn(),
		remove: jest.fn(),
	});

	const makeManager = () => new UIManager(
		makePrefStorage(),
		{},
		{},
		{},
		{},
		{}
	);

	it('should render API-provided canonical health label', () => {
		const manager = makeManager();
		const html = manager._renderTeamRecommendationOperationsSummary('arena', {
			modes: [{
				mode: 'arena',
				meanAbsoluteError: 0.15,
				meanBrierScore: 0.2,
				predictionBias: 0.01,
				suggestedFrictionScale: 1.08,
				samples: 40,
				isStale: false,
				healthStatus: 'monitor',
				healthLabel: 'Needs Attention',
			}],
		});

		expect(html).toContain('Ops Diagnostics');
		expect(html).toContain('Needs Attention');
		expect(html).toContain('0.150');
		expect(html).toContain('0.200');
	});

	it('should fallback to monitor label from thresholds when API health fields are missing', () => {
		const manager = makeManager();
		const html = manager._renderTeamRecommendationOperationsSummary('arena', {
			modes: [{
				mode: 'arena',
				meanAbsoluteError: 0.24,
				meanBrierScore: 0.29,
				predictionBias: 0,
				suggestedFrictionScale: 1.05,
				samples: 18,
				isStale: false,
			}],
		});

		expect(html).toContain('Needs Attention');
	});

	it('should fallback to stale label from staleness when API health fields are missing', () => {
		const manager = makeManager();
		const html = manager._renderTeamRecommendationOperationsSummary('arena', {
			modes: [{
				mode: 'arena',
				meanAbsoluteError: 0.12,
				meanBrierScore: 0.19,
				predictionBias: 0,
				suggestedFrictionScale: 1.02,
				samples: 22,
				isStale: true,
			}],
		});

		expect(html).toContain('Stale');
	});

	it('should match titanarena selection to arena mode summary row', () => {
		const manager = makeManager();
		const html = manager._renderTeamRecommendationOperationsSummary('titanarena', {
			modes: [{
				mode: 'arena',
				meanAbsoluteError: 0.11,
				meanBrierScore: 0.18,
				predictionBias: 0,
				suggestedFrictionScale: 1.01,
				samples: 31,
				isStale: false,
			}],
		});

		expect(html).toContain('Healthy');
	});
});
