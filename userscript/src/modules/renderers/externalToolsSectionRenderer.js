/**
 * External tools dashboard section renderer.
 */

/**
 * Render external tools cards and filter controls.
 *
 * @param {object} params - Render params
 * @param {Array<object>} params.tools - Tools array
 * @param {Array<string>} params.statusOptions - Verification status options
 * @param {string} params.selectedStatus - Active status filter
 * @param {(value: string) => string} params.escapeHtml - HTML escape callback
 * @returns {string} HTML section
 */
export function renderExternalToolsSection(params) {
	const tools = Array.isArray(params?.tools) ? params.tools : [];
	if (tools.length === 0) return '';
	const statusOptions = Array.isArray(params?.statusOptions) ? params.statusOptions : [];
	const selectedStatus = typeof params?.selectedStatus === 'string' ? params.selectedStatus : '';
	const escapeHtml = params?.escapeHtml;
	if (typeof escapeHtml !== 'function') return '';

	const rows = tools.slice(0, 4).map((tool) => {
		const status = (tool.verificationStatus || 'unknown').toLowerCase();
		const confidence = Number(tool.confidenceScore || 0);
		const reviewed = tool.lastReviewedUtc ? new Date(tool.lastReviewedUtc) : null;
		const ageDays = reviewed ? Math.floor((Date.now() - reviewed.getTime()) / (24 * 60 * 60 * 1000)) : 9999;
		const staleTag = ageDays > 90 ? ' • stale' : '';
		const statusColor = status === 'verified'
			? '#81c784'
			: status === 'partial'
				? '#ffb74d'
				: '#ef5350';

		return `<div style="padding:8px;border:1px solid #37474f;border-radius:8px;background:#1f252b;margin-top:6px">
			<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
				<div style="font-size:12px;font-weight:700;color:#cfd8dc">${escapeHtml(tool.name || 'Unknown Tool')}</div>
				<span style="font-size:10px;color:${statusColor}">${escapeHtml(status)} ${(confidence * 100).toFixed(0)}%</span>
			</div>
			<div style="font-size:11px;color:#a7b3bb;margin-top:3px">${escapeHtml(tool.category || 'tool')} • reviewed ${reviewed ? reviewed.toISOString().slice(0, 10) : 'n/a'}${staleTag}</div>
			<div style="font-size:11px;color:#93a1aa;margin-top:4px">${escapeHtml(tool.capabilities || '')}</div>
			<div style="font-size:10px;color:#7f8b92;margin-top:3px">${escapeHtml(tool.caveats || '')}</div>
			<div style="margin-top:6px"><a href="${escapeHtml(tool.url || '#')}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#64b5f6">Open Tool</a></div>
		</div>`;
	}).join('');

	return `<div class="oj-section">
		<h3>\uD83E\uDDF0 External Tools</h3>
		<div style="margin:4px 0 8px 0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
			<label for="oj-tools-status-filter" style="font-size:11px;color:#a7b3bb">Status</label>
			<select id="oj-tools-status-filter" style="background:#1f252b;border:1px solid #37474f;color:#cfd8dc;border-radius:6px;padding:3px 6px;font-size:11px">
				<option value="" ${selectedStatus === '' ? 'selected' : ''}>all</option>
				${statusOptions.map((status) => `<option value="${escapeHtml(status)}" ${selectedStatus === status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
			</select>
		</div>
		${rows}
		${tools.length > 4 ? `<div style="font-size:11px;color:#888;margin-top:6px;text-align:center">+ ${tools.length - 4} more in desktop Settings</div>` : ''}
	</div>`;
}
