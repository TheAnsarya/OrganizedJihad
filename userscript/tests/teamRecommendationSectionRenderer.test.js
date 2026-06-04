import { renderTeamRecommendationEngineSection } from '../src/modules/renderers/teamRecommendationSectionRenderer.js';

describe('teamRecommendationSectionRenderer', () => {
	const escapeHtml = (value) => String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

	it('should render operations toggle and diagnostics section html', () => {
		const html = renderTeamRecommendationEngineSection({
			profileSummary: 'profile ok',
			calibrationSummary: 'calibration ok',
			modeOptions: [{ value: 'arena', label: 'Arena' }],
			objectiveOptions: [{ value: 'balanced', label: 'Balanced' }],
			trendWindowOptions: [7, 30, 90],
			selectedMode: 'arena',
			selectedObjective: 'balanced',
			selectedTrendWindowPreference: 'auto',
			defaultTrendWindowDays: 30,
			showOperationsSummary: true,
			operationsSummaryHtml: '<div id="ops-metrics">ops metrics</div>',
			rowsHtml: '<div id="rows">rows</div>',
			escapeHtml,
		});

		expect(html).toContain('id="oj-team-ops-summary-toggle"');
		expect(html).toContain('checked');
		expect(html).toContain('id="ops-metrics"');
		expect(html).toContain('id="rows"');
	});

	it('should render operations toggle unchecked when disabled', () => {
		const html = renderTeamRecommendationEngineSection({
			profileSummary: 'profile ok',
			calibrationSummary: 'calibration ok',
			modeOptions: [{ value: 'arena', label: 'Arena' }],
			objectiveOptions: [{ value: 'balanced', label: 'Balanced' }],
			trendWindowOptions: [30],
			selectedMode: 'arena',
			selectedObjective: 'balanced',
			selectedTrendWindowPreference: '30',
			defaultTrendWindowDays: 30,
			showOperationsSummary: false,
			operationsSummaryHtml: '',
			rowsHtml: '<div>rows</div>',
			escapeHtml,
		});

		expect(html).toContain('id="oj-team-ops-summary-toggle"');
		expect(html).not.toContain('id="oj-team-ops-summary-toggle" checked');
	});
});
