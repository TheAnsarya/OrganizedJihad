/**
 * Tests for teamRecommendationRowsRenderer
 */

import { renderTeamRecommendationRows } from '../src/modules/renderers/teamRecommendationRowsRenderer.js';

describe('teamRecommendationRowsRenderer', () => {
	const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, '');

	it('should render simulation explainability details when present', () => {
		const html = renderTeamRecommendationRows({
			escapeHtml,
			recommendations: [{
				source: 'engine',
				teamPreview: 'Astaroth,Keira,Sebastian,Jet,Martha',
				modeProfile: 'arena-balanced',
				estimatedWinProbability: 0.71,
				readinessScore: 0.84,
				confidenceScore: 0.63,
				finalScore: 0.69,
				simulatedWinProbability: 0.74,
				simulationConfidenceLow: 0.58,
				simulationConfidenceHigh: 0.8,
				simulationRuns: 1400,
				teamPowerEstimate: 520000,
				opponentPowerUsed: 390000,
				rationale: 'Arena simulation detail',
				provenance: [],
			}],
		});

		expect(html).toContain('Sim 74.0%');
		expect(html).toContain('CI 58.0-80.0%');
		expect(html).toContain('Runs 1400');
		expect(html).toContain('Power team 520,000');
		expect(html).toContain('opp 390,000');
	});

	it('should omit simulation detail rows when simulation fields are absent', () => {
		const html = renderTeamRecommendationRows({
			escapeHtml,
			recommendations: [{
				source: 'history',
				teamPreview: 'Corvus,Morrigan,Keira,Phobos,Dorian',
				modeProfile: 'arena-history',
				estimatedWinProbability: 0.63,
				readinessScore: 0.72,
				confidenceScore: 0.57,
				finalScore: 0.61,
				rationale: 'No simulation fields on row',
				provenance: [],
			}],
		});

		expect(html).not.toContain('Runs');
		expect(html).not.toContain('Power team');
	});
});
