/**
 * Dashboard player header renderer.
 */

/**
 * Render dashboard player header section.
 *
 * @param {object} p - Render params
 * @param {(value: string) => string} p.escapeHtml - HTML escape callback
 * @param {(value: string|number|null|undefined) => string} p.stalenessTag - Staleness tag callback
 * @returns {string} HTML section
 */
export function renderDashboardPlayerHeaderSection(p) {
	if (!p?.playerName) return '';
	const escapeHtml = p?.escapeHtml;
	const stalenessTag = p?.stalenessTag;
	if (typeof escapeHtml !== 'function' || typeof stalenessTag !== 'function') return '';

	const _miniBar = (pct, color) => {
		const clamped = Math.min(100, Math.max(0, pct || 0));
		return `<div style="flex:1;background:#333;border-radius:3px;height:8px;min-width:60px">` +
			`<div style="background:${color};height:100%;border-radius:3px;width:${clamped}%;transition:width .3s"></div>` +
		`</div>`;
	};

	const goldIcon = '<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle"><circle cx="12" cy="12" r="10" fill="#FFD54F" stroke="#FFA000" stroke-width="1.5"/><text x="12" y="16" text-anchor="middle" font-size="12" font-weight="bold" fill="#E65100">$</text></svg>';
	const emeraldIcon = '<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8" fill="#43A047" stroke="#2E7D32" stroke-width="1.5"/><polygon points="12,5 18,9 18,15 12,19 6,15 6,9" fill="#66BB6A" stroke="#43A047" stroke-width="0.5"/></svg>';
	const energyIcon = '<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align:middle"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" fill="#FFD600" stroke="#F9A825" stroke-width="1"/></svg>';

	return `<div class="oj-section" style="padding:12px 14px">
		<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px">
			<span style="font-size:20px;font-weight:700;color:#e0e0e0">${escapeHtml(p.playerName)}</span>
			<span style="font-size:18px;font-weight:600;color:#90caf9">Lv ${p.playerLevel || 0}</span>
		</div>
		${p.playerGuild ? `<div style="font-size:11px;color:#888;margin-bottom:8px">\uD83C\uDFF0 ${escapeHtml(p.playerGuild)}</div>` : ''}
		<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
			<span style="font-size:11px;color:#aaa;white-space:nowrap">\uD83C\uDFAF Overall</span>
			${_miniBar(p.overallAvg, '#7e57c2')}
			<span style="font-size:12px;font-weight:600;color:#ce93d8;min-width:42px;text-align:right">${Number(p.overallAvg || 0).toFixed(1)}%</span>
		</div>
		<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px;text-align:center">
				<div style="font-size:18px">${goldIcon}</div>
				<div style="font-size:14px;font-weight:700;color:#ffd54f">${p.gold || '0'}</div>
				<div style="font-size:10px;color:#888">Gold</div>
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px;text-align:center">
				<div style="font-size:18px">${emeraldIcon}</div>
				<div style="font-size:14px;font-weight:700;color:#66bb6a">${p.emeralds || '0'}</div>
				<div style="font-size:10px;color:#888">Emeralds</div>
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px;text-align:center">
				<div style="font-size:18px">${energyIcon}</div>
				<div style="font-size:14px;font-weight:700;color:#4fc3f7">${p.energy || '0'}</div>
				<div style="font-size:10px;color:#888">Energy${p.bottledEnergy !== '0' ? ` <span style="color:#aaa">(${p.bottledEnergy} \uD83C\uDF76)</span>` : ''}</div>
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px">
				<div style="font-size:12px;margin-bottom:4px">\uD83E\uDDB8 Heroes</div>
				<div style="display:flex;align-items:center;gap:4px">
					${_miniBar(p.heroAvg, '#81c784')}
					<span style="font-size:11px;font-weight:600;color:#81c784;min-width:36px;text-align:right">${Number(p.heroAvg || 0).toFixed(1)}%</span>
				</div>
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px">
				<div style="font-size:12px;margin-bottom:4px">\uD83D\uDCA0 Titans</div>
				<div style="display:flex;align-items:center;gap:4px">
					${_miniBar(p.titanAvg, '#ce93d8')}
					<span style="font-size:11px;font-weight:600;color:#ce93d8;min-width:36px;text-align:right">${Number(p.titanAvg || 0).toFixed(1)}%</span>
				</div>
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:8px">
				<div style="font-size:12px;margin-bottom:4px">\uD83D\uDC3E Pets</div>
				<div style="display:flex;align-items:center;gap:4px">
					${_miniBar(p.petAvg, '#ffb74d')}
					<span style="font-size:11px;font-weight:600;color:#ffb74d;min-width:36px;text-align:right">${Number(p.petAvg || 0).toFixed(1)}%</span>
				</div>
			</div>
		</div>
		<div style="display:flex;gap:6px;flex-wrap:wrap">
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\u2705</div>
				<div style="font-size:16px;font-weight:700;color:#81c784">${p.dailyQuestsCompleted || 0}/${p.dailyQuestsTotal || '?'}</div>
				<div style="font-size:10px;color:#888">Daily Quests</div>
				${stalenessTag(p.questSummary?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDFF0</div>
				<div style="font-size:16px;font-weight:700;color:#ffb74d">${p.guildQuestsCompleted || 0}/${p.guildQuestsTotal || '?'}</div>
				<div style="font-size:10px;color:#888">Guild Quests</div>
				${stalenessTag(p.questSummary?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\u2694\uFE0F</div>
				<div style="font-size:16px;font-weight:700;color:#ef9a9a">${p.gwBrief?.hasActiveWar ? `${p.gwAttacksUsed}/${p.gwAttacksMax}` : 'No War'}</div>
				<div style="font-size:10px;color:#888">Guild War</div>
				${stalenessTag(p.gwBrief?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDF0D</div>
				<div style="font-size:14px;font-weight:700;color:#ce93d8">${p.cowData?.isActive ? `\uD83E\uDDB8${p.cowHeroUsed}/3 \uD83D\uDCA0${p.cowTitanUsed}/2` : 'No CoW'}</div>
				<div style="font-size:10px;color:#888">Clash of Worlds</div>
				${stalenessTag(p.cowData?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83D\uDC32</div>
				<div style="font-size:14px;font-weight:700;color:#4fc3f7">${p.raidBossAttacksUsed || 0}/${p.raidBossAttacksMax || 0}</div>
				<div style="font-size:10px;color:#888">Raid Boss${p.raidBossLevel ? ` (Lv${p.raidBossLevel})` : ''}</div>
				${Number(p.raidMyDamage || 0) > 0 ? `<div style="font-size:9px;color:#aaa">${Number(p.raidMyDamage).toLocaleString()} dmg</div>` : ''}
				${stalenessTag(p.raidBoss?.lastUpdate)}
			</div>
		</div>
		<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDFC6</div>
				<div style="font-size:16px;font-weight:700;color:#4fc3f7">${p.arenaStats?.arenaPlace ? `#${p.arenaStats.arenaPlace}` : '\u2014'}</div>
				<div style="font-size:10px;color:#888">Arena Rank</div>
				${p.arenaStats?.totalBattles ? `<div style="font-size:9px;color:#aaa">${p.arenaStats.winRate}% WR (${p.arenaStats.totalWins}/${p.arenaStats.totalBattles})</div>` : ''}
				${stalenessTag(p.arenaStats?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDFDF\uFE0F</div>
				<div style="font-size:16px;font-weight:700;color:#ffb74d">${p.arenaStats?.grandPlace ? `#${p.arenaStats.grandPlace}` : '\u2014'}</div>
				<div style="font-size:10px;color:#888">Grand Arena</div>
				${stalenessTag(p.arenaStats?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83D\uDCA0</div>
				<div style="font-size:16px;font-weight:700;color:#ce93d8">${p.titanArenaStats?.rank ? `#${p.titanArenaStats.rank}` : '\u2014'}</div>
				<div style="font-size:10px;color:#888">Titan Arena</div>
				${p.titanArenaStats?.tier ? `<div style="font-size:9px;color:#aaa">T${p.titanArenaStats.tier} · ${p.titanArenaStats.dailyScore?.toLocaleString() || 0} today</div>` : ''}
				${stalenessTag(p.titanArenaStats?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83D\uDDFA\uFE0F</div>
				<div style="font-size:14px;font-weight:700;color:#81c784">${p.campaignProgress?.totalStars ? `${p.campaignProgress.totalStars}/${p.campaignProgress.maxStars}` : '\u2014'}</div>
				<div style="font-size:10px;color:#888">Campaign Stars</div>
				${p.campaignProgress?.threeStarMissions ? `<div style="font-size:9px;color:#aaa">${p.campaignProgress.threeStarMissions}/${p.campaignProgress.totalMissions} ★★★</div>` : ''}
				${stalenessTag(p.campaignProgress?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDFAB</div>
				<div style="font-size:14px;font-weight:700;color:#fff176">${p.battlePassData?.currentLevel ? `Lv${p.battlePassData.currentLevel}` : '\u2014'}</div>
				<div style="font-size:10px;color:#888">Battle Pass${p.battlePassData?.ticketLabel ? ` (${p.battlePassData.ticketLabel})` : ''}</div>
				${p.battlePassData?.exp ? `<div style="font-size:9px;color:#aaa">${p.battlePassData.exp?.toLocaleString()} XP</div>` : ''}
				${stalenessTag(p.battlePassData?.lastUpdate)}
			</div>
			<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDFB0</div>
				<div style="font-size:14px;font-weight:700;color:#ef9a9a">${p.gachaData?.pullsUntilPity != null && p.gachaData.pullsUntilPity >= 0 ? p.gachaData.pullsUntilPity : '\u2014'}</div>
				<div style="font-size:10px;color:#888">Pity Counter</div>
				${p.gachaData?.totalOpenings ? `<div style="font-size:9px;color:#aaa">${p.gachaData.totalOpenings?.toLocaleString()} total pulls</div>` : ''}
				${stalenessTag(p.gachaData?.lastUpdate)}
			</div>
		</div>
		${p.guildActivity?.todayActivity ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
			<div style="flex:1;min-width:140px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\u2B50</div>
				<div style="font-size:14px;font-weight:700;color:#90caf9">${p.guildActivity.todayActivity.toLocaleString()}</div>
				<div style="font-size:10px;color:#888">Guild Activity Today</div>
				${stalenessTag(p.guildActivity.lastUpdate)}
			</div>
			<div style="flex:1;min-width:140px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDFF0</div>
				<div style="font-size:14px;font-weight:700;color:#90caf9">${p.guildActivity.todayDungeonActivity}</div>
				<div style="font-size:10px;color:#888">Dungeon Activity</div>
			</div>
			<div style="flex:1;min-width:140px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83D\uDCC8</div>
				<div style="font-size:14px;font-weight:700;color:#90caf9">${p.guildActivity.activitySum?.toLocaleString()}</div>
				<div style="font-size:10px;color:#888">Weekly Activity</div>
			</div>
		</div>` : ''}
		${(p.towerState?.floorNumber || p.expeditionSlots?.totalSlots || p.outlandBosses?.bossCount || p.adventurePassed?.totalAdventures) ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
			${p.towerState?.floorNumber ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDFF0</div>
				<div style="font-size:16px;font-weight:700;color:#b39ddb">F${p.towerState.floorNumber}</div>
				<div style="font-size:10px;color:#888">Tower Floor</div>
				<div style="font-size:9px;color:#aaa">${Number(p.towerState.points || 0).toLocaleString()} pts${p.towerState.maySkipFloor ? ` · Skip\u2264${p.towerState.maySkipFloor}` : ''}</div>
				${stalenessTag(p.towerState.lastUpdate)}
			</div>` : ''}
			${p.expeditionSlots?.totalSlots ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\u26F5</div>
				<div style="font-size:16px;font-weight:700;color:#80cbc4">${p.expeditionSlots.completeCount}/${p.expeditionSlots.totalSlots}</div>
				<div style="font-size:10px;color:#888">Expeditions</div>
				${p.expeditionSlots.activeCount ? `<div style="font-size:9px;color:#aaa">${p.expeditionSlots.activeCount} active</div>` : ''}
				${stalenessTag(p.expeditionSlots.lastUpdate)}
			</div>` : ''}
			${p.outlandBosses?.bossCount ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83D\uDC80</div>
				<div style="font-size:16px;font-weight:700;color:#ef9a9a">${p.outlandBosses.totalChests}/${p.outlandBosses.bossCount * 3}</div>
				<div style="font-size:10px;color:#888">Outland Chests</div>
				${stalenessTag(p.outlandBosses.lastUpdate)}
			</div>` : ''}
			${p.adventurePassed?.totalAdventures ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83D\uDDFA\uFE0F</div>
				<div style="font-size:16px;font-weight:700;color:#a5d6a7">${p.adventurePassed.totalCompletions}</div>
				<div style="font-size:10px;color:#888">Adventures</div>
				<div style="font-size:9px;color:#aaa">${p.adventurePassed.totalAdventures} maps</div>
				${stalenessTag(p.adventurePassed.lastUpdate)}
			</div>` : ''}
			${p.workshopBuffs?.totalBuffs ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83D\uDD27</div>
				<div style="font-size:16px;font-weight:700;color:#ffcc80">${p.workshopBuffs.activeBuffs}/${p.workshopBuffs.totalBuffs}</div>
				<div style="font-size:10px;color:#888">Workshop Buffs</div>
				${stalenessTag(p.workshopBuffs.lastUpdate)}
			</div>` : ''}
			${((p.cosmeticCounts?.avatars || 0) + (p.cosmeticCounts?.frames || 0) + (p.cosmeticCounts?.stickers || 0)) > 0 ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83C\uDFA8</div>
				<div style="font-size:14px;font-weight:700;color:#f48fb1">${(p.cosmeticCounts.avatars || 0) + (p.cosmeticCounts.frames || 0) + (p.cosmeticCounts.stickers || 0)}</div>
				<div style="font-size:10px;color:#888">Cosmetics</div>
				<div style="font-size:9px;color:#aaa">${p.cosmeticCounts.avatars || 0}\uD83D\uDC64 ${p.cosmeticCounts.frames || 0}\uD83D\uDDBC\uFE0F ${p.cosmeticCounts.stickers || 0}\u2B50</div>
			</div>` : ''}
			${p.invasionData?.id ? `<div style="flex:1;min-width:100px;background:#2a2a2e;border-radius:6px;padding:6px 8px;text-align:center">
				<div style="font-size:14px">\uD83D\uDE80</div>
				<div style="font-size:16px;font-weight:700;color:#ff8a65">Active</div>
				<div style="font-size:10px;color:#888">Invasion</div>
				${p.invasionData.bestPlace ? `<div style="font-size:9px;color:#aaa">Best: #${p.invasionData.bestPlace}</div>` : ''}
				${stalenessTag(p.invasionData.lastUpdate)}
			</div>` : ''}
		</div>` : ''}
	</div>`;
}
