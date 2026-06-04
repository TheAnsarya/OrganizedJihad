import { bindDashboardFilters } from '../src/modules/binders/dashboardFiltersBinder.js';

describe('dashboardFiltersBinder', () => {
	it('should persist ops summary toggle preference and rerender dashboard', () => {
		document.body.innerHTML = `
			<div id="overlay">
				<input id="oj-team-ops-summary-toggle" type="checkbox" />
			</div>
		`;

		const overlay = document.querySelector('#overlay');
		const prefStorage = {
			set: jest.fn(),
			get: jest.fn(() => 'arena'),
		};
		const renderView = jest.fn();
		const saveTrendPreference = jest.fn();

		bindDashboardFilters({
			overlay,
			prefStorage,
			renderView,
			saveTrendPreference,
		});

		const toggle = overlay.querySelector('#oj-team-ops-summary-toggle');
		toggle.checked = true;
		toggle.dispatchEvent(new Event('change', { bubbles: true }));

		expect(prefStorage.set).toHaveBeenCalledWith('teamRecommendationsShowOperationsSummary', true);
		expect(renderView).toHaveBeenCalledWith('dashboard');
	});
});
