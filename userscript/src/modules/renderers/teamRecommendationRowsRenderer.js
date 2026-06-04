/**
 * Team recommendation card-row renderer.
 */

/**
 * Render Team Recommendation Engine recommendation rows with provenance details.
 *
 * @param {object} params - Render params
 * @param {Array<object>} params.recommendations - Recommendation list
 * @param {(value: string) => string} params.escapeHtml - HTML escape callback
 * @returns {string} HTML rows
 */
export function renderTeamRecommendationRows(params) {
	const recs = Array.isArray(params?.recommendations) ? params.recommendations : [];
	const escapeHtml = params?.escapeHtml;
	if (typeof escapeHtml !== 'function' || recs.length === 0) return '';

	return recs.slice(0, 3).map((rec, index) => {
		const win = Number(rec.estimatedWinProbability || 0);
		const ready = Number(rec.readinessScore || 0);
		const confidence = Number(rec.confidenceScore || 0);
		const finalScore = Number(rec.finalScore || 0);
		const simWin = Number(rec.simulatedWinProbability);
		const simLow = Number(rec.simulationConfidenceLow);
		const simHigh = Number(rec.simulationConfidenceHigh);
		const simRuns = Number(rec.simulationRuns || 0);
		const teamPowerEstimate = Number(rec.teamPowerEstimate || 0);
		const opponentPowerUsed = Number(rec.opponentPowerUsed || 0);
		const profile = escapeHtml(rec.modeProfile || 'default');
		const topProvenance = Array.isArray(rec.provenance) && rec.provenance.length > 0
			? rec.provenance[0]
			: null;
		const provenanceText = topProvenance
			? `${escapeHtml(topProvenance.sourceName || 'source')} ${(Number(topProvenance.confidence || 0) * 100).toFixed(0)}%`
			: 'no provenance';
		const provenanceRows = Array.isArray(rec.provenance)
			? rec.provenance.slice(0, 5).map((entry) => {
				const sourceName = escapeHtml(entry?.sourceName || 'unknown source');
				const sourceType = escapeHtml(entry?.sourceType || 'signal');
				const entryConfidence = (Number(entry?.confidence || 0) * 100).toFixed(0);
				const detail = escapeHtml(entry?.detail || 'no detail');
				const contribution = entry?.contribution && typeof entry.contribution === 'object'
					? entry.contribution
					: null;
				const contributionRows = contribution
					? [
						typeof contribution.winProbability === 'number' ? `W ${(contribution.winProbability * 100).toFixed(1)}%` : '',
						typeof contribution.readiness === 'number' ? `R ${(contribution.readiness * 100).toFixed(1)}%` : '',
						typeof contribution.confidence === 'number' ? `C ${(contribution.confidence * 100).toFixed(1)}%` : '',
						typeof contribution.winWeight === 'number' ? `wW ${(contribution.winWeight * 100).toFixed(0)}%` : '',
						typeof contribution.readinessWeight === 'number' ? `wR ${(contribution.readinessWeight * 100).toFixed(0)}%` : '',
						typeof contribution.confidenceWeight === 'number' ? `wC ${(contribution.confidenceWeight * 100).toFixed(0)}%` : '',
						typeof contribution.baseScore === 'number' ? `base ${(contribution.baseScore * 100).toFixed(1)}%` : '',
						typeof contribution.externalBonus === 'number' ? `bonus ${(contribution.externalBonus * 100).toFixed(1)}%` : '',
						typeof contribution.finalScore === 'number' ? `final ${(contribution.finalScore * 100).toFixed(1)}%` : '',
						typeof contribution.externalModeWeight === 'number' ? `modeW ${(contribution.externalModeWeight * 100).toFixed(0)}%` : '',
						typeof contribution.sourceScale === 'number' ? `scale ${(contribution.sourceScale * 100).toFixed(0)}%` : '',
						typeof contribution.sourceConfidence === 'number' ? `srcConf ${(contribution.sourceConfidence * 100).toFixed(0)}%` : '',
						typeof contribution.frictionPenalty === 'number' ? `friction ${(contribution.frictionPenalty * 100).toFixed(1)}%` : '',
						typeof contribution.resourcePressure === 'number' ? `pressure ${(contribution.resourcePressure * 100).toFixed(0)}%` : '',
					].filter(Boolean)
					: [];
				const sourceUrl = typeof entry?.sourceUrl === 'string' && entry.sourceUrl.trim()
					? `<a href="${escapeHtml(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer" style="color:#95d5b2;text-decoration:none">source</a>`
					: '';

				return `<div style="padding:4px 0;border-top:1px dashed #2d5845">
					<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
						<div style="font-size:10px;color:#9fd8bc">${sourceName} <span style="color:#739b89">(${sourceType})</span></div>
						<div style="font-size:10px;color:#8ac9a8">${entryConfidence}% ${sourceUrl}</div>
					</div>
					<div style="font-size:10px;color:#7f9f92;margin-top:2px">${detail}</div>
					${contributionRows.length > 0 ? `<div style="font-size:10px;color:#86b9a1;margin-top:2px">${escapeHtml(contributionRows.join(' • '))}</div>` : ''}
				</div>`;
			}).join('')
			: '';
		const preview = escapeHtml(rec.teamPreview || 'Unknown Team');
		const rationale = escapeHtml(rec.rationale || 'No rationale available.');
		const hasSimulation = Number.isFinite(simWin);
		const simulationRange = hasSimulation && Number.isFinite(simLow) && Number.isFinite(simHigh)
			? `${(Math.max(0, Math.min(1, simLow)) * 100).toFixed(1)}-${(Math.max(0, Math.min(1, simHigh)) * 100).toFixed(1)}%`
			: 'n/a';
		const simulationLine = hasSimulation
			? `<div style="font-size:10px;color:#7f9f92;margin-top:2px">Sim ${(Math.max(0, Math.min(1, simWin)) * 100).toFixed(1)}% • CI ${simulationRange} • Runs ${simRuns > 0 ? simRuns : 'n/a'}</div>`
			: '';
		const powerLine = (teamPowerEstimate > 0 || opponentPowerUsed > 0)
			? `<div style="font-size:10px;color:#7f9f92;margin-top:2px">Power team ${teamPowerEstimate > 0 ? teamPowerEstimate.toLocaleString() : 'n/a'} • opp ${opponentPowerUsed > 0 ? opponentPowerUsed.toLocaleString() : 'n/a'}</div>`
			: '';

		return `<div style="padding:8px;border:1px solid #2f5a3f;border-radius:8px;background:#182b24;margin-top:${index === 0 ? '0' : '6px'}">
			<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
				<div style="font-size:12px;font-weight:700;color:#a8e6c8">${preview}</div>
				<div style="font-size:11px;color:#8ad4ac">${escapeHtml(rec.source || 'engine')}</div>
			</div>
			<div style="font-size:10px;color:#7cc1a0;margin-top:2px">profile ${profile}</div>
			<div style="font-size:11px;color:#9fc7b2;margin-top:4px">Win ${(win * 100).toFixed(1)}% • Ready ${(ready * 100).toFixed(0)}% • Conf ${(confidence * 100).toFixed(0)}% • Final ${(finalScore * 100).toFixed(1)}%</div>
			<div style="font-size:10px;color:#7f9f92;margin-top:2px">${provenanceText}</div>
			${simulationLine}
			${powerLine}
			<div style="font-size:11px;color:#8c8c8c;margin-top:4px">${rationale}</div>
			${provenanceRows ? `<details style="margin-top:6px">
				<summary style="cursor:pointer;font-size:10px;color:#95d5b2">Provenance details</summary>
				<div style="margin-top:4px;background:#13261f;border:1px solid #2a4739;border-radius:6px;padding:4px 6px">${provenanceRows}</div>
			</details>` : ''}
		</div>`;
	}).join('');
}
