/**
 * Heroes requirements projection panel renderer.
 * Extracted from UIManager to keep projection markup isolated.
 */

import ProjectedItemCatalogResolver from '../helpers/ProjectedItemCatalogResolver.js';

/**
 * Render projected overall item requirements panel for hero progression.
 *
 * @param {object} options - Render options
 * @param {object|null} options.projection - Projection payload from HeroMaterialRequirementsCalculator
 * @param {Record<string, {name: string, category?: string, icon?: string}>} [options.itemMetaMap] - Optional item metadata map
 * @param {{ projectionTopItemsPage?: number, projectionTopItemsPageSize?: number }} [options.heroesViewState] - Heroes view state
 * @param {{ get: Function }} options.prefStorage - Preference storage implementation
 * @param {(input: string) => string} options.escapeHtml - HTML escape function
 * @returns {string} HTML panel markup
 */
export function renderHeroRequirementsProjectionPanel(options) {
	const projection = options?.projection || null;
	if (!projection) {
		return '';
	}

	const itemMetaMap = options?.itemMetaMap || {};
	const heroesViewState = options?.heroesViewState || {};
	const prefStorage = options?.prefStorage;
	const escapeHtml = typeof options?.escapeHtml === 'function'
		? options.escapeHtml
		: (value) => String(value ?? '');

	const topItems = Array.isArray(projection.items) ? projection.items : [];
	const topItemsPageSize = Math.max(10, Number(heroesViewState.projectionTopItemsPageSize || 25));
	const topItemsPageCount = Math.max(1, Math.ceil(topItems.length / topItemsPageSize));
	const topItemsPage = Math.min(Math.max(Number(heroesViewState.projectionTopItemsPage || 0), 0), topItemsPageCount - 1);
	heroesViewState.projectionTopItemsPage = topItemsPage;
	const topItemsSliceStart = topItemsPage * topItemsPageSize;
	const topItemsSliceEnd = Math.min(topItemsSliceStart + topItemsPageSize, topItems.length);
	const pagedTopItems = topItems.slice(topItemsSliceStart, topItemsSliceEnd);
	const confidencePct = Math.round((projection.confidenceScore || 0) * 100);
	const hasSignal = topItems.length > 0;
	const confidenceColor = confidencePct >= 70
		? '#81c784'
		: (confidencePct >= 40 ? '#ffb74d' : '#ef9a9a');

	const itemRows = pagedTopItems.map((entry) => {
		const levelPart = Number(entry.levelProjected || 0);
		const colorPart = Number(entry.colorProjected || 0);
		const needed = Number(entry.quantity || 0);
		const owned = Number(entry.ownedQuantity || 0);
		const shortage = Number(entry.shortageQuantity || 0);
		const mix = [];
		if (levelPart > 0) mix.push(`Lv ${levelPart.toLocaleString()}`);
		if (colorPart > 0) mix.push(`Rank ${colorPart.toLocaleString()}`);
		const mixLabel = mix.length > 0 ? mix.join(' • ') : 'Projected';
		const shortageStyle = shortage > 0 ? 'color:#ef9a9a;font-weight:700' : 'color:#a5d6a7;font-weight:700';
		const resolved = ProjectedItemCatalogResolver.resolveItemMeta(entry.itemId, itemMetaMap);
		const itemId = resolved.itemId;
		const resolvedName = resolved.name;
		const itemIcon = resolved.icon;

		return `<tr>` +
			`<td><div class="oj-mono" style="font-size:11px">${escapeHtml(itemId)}</div><div style="display:flex;align-items:center;gap:6px"><span>${escapeHtml(itemIcon)}</span><span>${escapeHtml(resolvedName)}</span></div></td>` +
			`<td class="oj-num"><strong>${needed.toLocaleString()}</strong></td>` +
			`<td class="oj-num">${owned.toLocaleString()}</td>` +
			`<td class="oj-num" style="${shortageStyle}">${shortage.toLocaleString()}</td>` +
			`<td class="oj-muted" style="font-size:11px">${escapeHtml(mixLabel)}</td>` +
		`</tr>`;
	}).join('');

	const coverage = projection.coverage || {};
	const tierSummaries = Array.isArray(projection.tierSummaries) ? projection.tierSummaries : [];
	const levelBandSummaries = Array.isArray(projection.levelBandSummaries) ? projection.levelBandSummaries : [];
	const isColorTierOpen = prefStorage?.get?.('heroesProjectionColorTierOpen', true) !== false;
	const isLevelBandOpen = prefStorage?.get?.('heroesProjectionLevelBandOpen', true) !== false;
	const isTopItemsOpen = prefStorage?.get?.('heroesProjectionTopItemsOpen', true) !== false;
	const totalNeeds = Number(projection.totalProjectedItems || 0).toLocaleString();
	const totalOwned = Number(projection.totalOwnedForProjectedItems || 0).toLocaleString();
	const totalShortage = Number(projection.totalShortageItems || 0).toLocaleString();
	const tierSummaryTotal = tierSummaries.reduce((sum, tier) => sum + Number(tier.totalProjectedItems || 0), 0);
	const levelBandSummaryTotal = levelBandSummaries.reduce((sum, band) => sum + Number(band.totalProjectedItems || 0), 0);
	const tierRows = tierSummaries.map((tier) => {
		const need = Number(tier.totalProjectedItems || 0);
		const owned = Number(tier.totalOwnedForProjectedItems || 0);
		const shortage = Number(tier.totalShortageItems || 0);
		const shortageStyle = shortage > 0 ? 'color:#ef9a9a;font-weight:700' : 'color:#a5d6a7;font-weight:700';
		return `<tr>` +
			`<td><strong>${escapeHtml(tier.tierName || 'Unknown')}</strong></td>` +
			`<td class="oj-num">${need.toLocaleString()}</td>` +
			`<td class="oj-num">${owned.toLocaleString()}</td>` +
			`<td class="oj-num" style="${shortageStyle}">${shortage.toLocaleString()}</td>` +
			`<td class="oj-num oj-muted" style="font-size:11px">${Number(tier.distinctItems || 0).toLocaleString()}</td>` +
		`</tr>`;
	}).join('');
	const levelBandRows = levelBandSummaries.map((band) => {
		const levels = Number(band.levelCount || 0);
		const need = Number(band.totalProjectedItems || 0);
		const owned = Number(band.totalOwnedForProjectedItems || 0);
		const shortage = Number(band.totalShortageItems || 0);
		const shortageStyle = shortage > 0 ? 'color:#ef9a9a;font-weight:700' : 'color:#a5d6a7;font-weight:700';
		return `<tr>` +
			`<td><strong>${escapeHtml(band.bandName || 'Unknown')}</strong></td>` +
			`<td class="oj-num oj-muted" style="font-size:11px">${levels.toLocaleString()}</td>` +
			`<td class="oj-num">${need.toLocaleString()}</td>` +
			`<td class="oj-num">${owned.toLocaleString()}</td>` +
			`<td class="oj-num" style="${shortageStyle}">${shortage.toLocaleString()}</td>` +
			`<td class="oj-num oj-muted" style="font-size:11px">${Number(band.distinctItems || 0).toLocaleString()}</td>` +
		`</tr>`;
	}).join('');

	return `
		<div class="oj-section" style="margin-bottom:10px;padding:10px 12px">
			<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
				<div>
					<div style="font-size:13px;font-weight:700;color:#e0e0e0">🧾 Overall Items Needed To Max Heroes</div>
					<div class="oj-muted" style="font-size:11px">Target: level ${projection.targetLevel}, ${escapeHtml(projection.targetColorName || `Rank ${projection.targetColorRank}`)} • ${projection.heroCount} heroes</div>
				</div>
				<div style="font-size:12px;color:${confidenceColor};font-weight:700">Confidence ${confidencePct}%</div>
			</div>
			<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;margin-bottom:8px">
				<div class="oj-muted" style="font-size:11px">Level gaps: <strong>${Number(projection.totalLevelDeficit || 0).toLocaleString()}</strong></div>
				<div class="oj-muted" style="font-size:11px">Rank gaps: <strong>${Number(projection.totalColorDeficit || 0).toLocaleString()}</strong></div>
				<div class="oj-muted" style="font-size:11px">Projected total: <strong>${totalNeeds}</strong></div>
				<div class="oj-muted" style="font-size:11px">Owned (matching IDs): <strong>${totalOwned}</strong></div>
				<div class="oj-muted" style="font-size:11px">Shortage: <strong style="color:#ef9a9a">${totalShortage}</strong></div>
				<div class="oj-muted" style="font-size:11px">Signals: lvlUp ${Number(coverage.levelUpgradeSamples || 0)}, colorUp ${Number(coverage.colorUpgradeSamples || 0)}, equip ${Number(coverage.equipmentChangeSamples || 0)}, itemUse ${Number(coverage.itemUsageSamples || 0)}</div>
			</div>
			<div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:4px">
				<button type="button" class="oj-btn oj-btn-xs" data-projection-control="expandAll">Expand All</button>
				<button type="button" class="oj-btn oj-btn-xs" data-projection-control="collapseAll">Collapse All</button>
			</div>
			${tierRows
				? `<details ${isColorTierOpen ? 'open' : ''} data-projection-section="colorTier" style="margin-top:4px">
					<summary style="cursor:pointer;font-size:12px;font-weight:700;color:#d0d0d0;list-style:disclosure-closed">Color Tier Summary • ${tierSummaries.length} tiers • ${tierSummaryTotal.toLocaleString()} needed</summary>
					<div class="oj-projection-scroll" style="margin-top:6px">
						<table class="oj-table oj-projection-table"><thead><tr><th>Tier</th><th>Needed</th><th>Owned</th><th>Shortage</th><th>Distinct</th></tr></thead><tbody>${tierRows}</tbody></table>
					</div>
				</details>`
				: ''
			}
			${levelBandRows
				? `<details ${isLevelBandOpen ? 'open' : ''} data-projection-section="levelBand" style="margin-top:4px">
					<summary style="cursor:pointer;font-size:12px;font-weight:700;color:#d0d0d0;list-style:disclosure-closed">Level Band Summary • ${levelBandSummaries.length} bands • ${levelBandSummaryTotal.toLocaleString()} needed</summary>
					<div class="oj-projection-scroll" style="margin-top:6px">
						<table class="oj-table oj-projection-table"><thead><tr><th>Level Band</th><th>Levels</th><th>Needed</th><th>Owned</th><th>Shortage</th><th>Distinct</th></tr></thead><tbody>${levelBandRows}</tbody></table>
					</div>
				</details>`
				: ''
			}
			${hasSignal
				? `<details ${isTopItemsOpen ? 'open' : ''} data-projection-section="topItems" style="margin-top:4px">
					<summary style="cursor:pointer;font-size:12px;font-weight:700;color:#d0d0d0;list-style:disclosure-closed">Top Projected Items • ${topItems.length} rows</summary>
					<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">
						<div class="oj-muted" style="font-size:11px">Showing ${topItems.length === 0 ? 0 : (topItemsSliceStart + 1).toLocaleString()}-${topItemsSliceEnd.toLocaleString()} of ${topItems.length.toLocaleString()}</div>
						<div style="display:flex;align-items:center;gap:6px">
							<button type="button" class="oj-btn oj-btn-xs" data-projection-top-nav="prev" ${topItemsPage <= 0 ? 'disabled' : ''}>Prev</button>
							<div class="oj-muted" style="font-size:11px">Page ${(topItemsPage + 1).toLocaleString()} / ${topItemsPageCount.toLocaleString()}</div>
							<button type="button" class="oj-btn oj-btn-xs" data-projection-top-nav="next" ${topItemsPage >= (topItemsPageCount - 1) ? 'disabled' : ''}>Next</button>
						</div>
					</div>
					<div class="oj-muted" style="font-size:11px;margin-top:4px">Shortcuts: Alt+Left / Alt+[ = Prev • Alt+Right / Alt+] = Next</div>
					<div class="oj-projection-scroll" style="margin-top:6px">
						<table class="oj-table oj-projection-table"><thead><tr><th>Item</th><th>Needed</th><th>Owned</th><th>Shortage</th><th>Mix</th></tr></thead><tbody>${itemRows}</tbody></table>
					</div>
				</details>`
				: '<p class="oj-empty" style="margin:0">Not enough tracked upgrade/equipment history yet to estimate concrete item IDs. Keep playing with tracking enabled and this panel will auto-fill.</p>'
			}
		</div>
	`;
}
