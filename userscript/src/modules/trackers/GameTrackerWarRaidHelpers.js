/**
 * GameTrackerWarRaidHelpers
 *
 * Builder seams for guild war, raid boss, and cross-server war tracking payloads.
 */

/**
 * Build guild war metadata payload.
 *
 * @param {Object} data - guild war info payload
 * @returns {Object} metadata row
 */
export function buildGuildWarInfoMetadata(data) {
	return {
		warId: data.warId || data.war?.id,
		enemyGuildId: data.enemyClanId || data.enemyClan?.id,
		enemyGuildName: data.enemyClanName || data.enemyClan?.name,
		myGuildScore: data.myScore || 0,
		enemyScore: data.enemyScore || 0,
		defenders: data.defenders || {},
		attackers: data.attackers || {},
		timestamp: Date.now(),
	};
}

/**
 * Build raid boss metadata payload from clanRaid_getInfo response.
 *
 * @param {Object} data - raid boss info payload
 * @returns {Object} metadata row
 */
export function buildRaidBossInfoMetadata(data) {
	return {
		bossLevel: data.boss?.level || 0,
		currentBoss: data.stats?.currentBoss || '0',
		clanPoints: data.stats?.points || '0',
		bossKilled: data.stats?.bossKilled || [],
		myDamage: parseInt(data.userStats?.damage || '0', 10),
		myPoints: parseInt(data.userStats?.points || '0', 10),
		usedHeroes: data.userStats?.usedHeroes || [],
		attemptsUsed: data.attempts || 0,
		attemptsMax: data.bossAttempts || 5,
		coins: data.coins || 0,
		nodeCount: Object.keys(data.nodes || {}).length,
		timestamp: Date.now(),
	};
}

/**
 * Build raid boss attack history row.
 *
 * @param {Object} args - attack request args
 * @param {Object} data - attack response payload
 * @param {Function} compressHeroTeam - team compression callback
 * @returns {Object} history row
 */
export function buildRaidBossAttackHistoryRecord(args, data, compressHeroTeam) {
	return {
		bossId: args.bossId,
		damage: data.damage || 0,
		myTeam: data.attackers ? compressHeroTeam(data.attackers) : null,
		reward: data.reward || {},
		timestamp: Date.now(),
	};
}

/**
 * Append a record to bounded history.
 *
 * @param {Array<Object>} history - existing history array
 * @param {Object} record - row to append
 * @param {number} maxEntries - max length cap
 * @returns {Array<Object>} bounded history array
 */
export function appendBoundedHistory(history, record, maxEntries = 500) {
	const nextHistory = [...history, record];
	if (nextHistory.length > maxEntries) {
		nextHistory.shift();
	}
	return nextHistory;
}

/**
 * Build raid boss battle row for battles IDB store.
 *
 * @param {Object} args - attack request args
 * @param {Object} data - attack response payload
 * @param {Function} compressHeroTeam - team compression callback
 * @param {string} timestampIso - ISO timestamp for battle row
 * @returns {Object} battle row
 */
export function buildRaidBossBattleRecord(args, data, compressHeroTeam, timestampIso) {
	return {
		battleType: 'RaidBoss',
		isWin: true,
		damage: data.damage || 0,
		playerHeroes: data.attackers ? JSON.stringify(compressHeroTeam(data.attackers)) : null,
		opponentHeroes: null,
		rewards: data.reward ? JSON.stringify(data.reward) : null,
		mission: args.bossId || null,
		timestamp: timestampIso,
	};
}

/**
 * Build cross-server war metadata payload.
 *
 * @param {Object} data - cross-server war info payload
 * @returns {Object} metadata row
 */
export function buildCrossServerWarInfoMetadata(data) {
	return {
		warId: data.warId || data.id,
		isCrossServer: true,
		enemyGuildId: data.enemy?.id || data.enemyClanId,
		enemyGuildName: data.enemy?.name || data.enemyClanName || 'Unknown',
		enemyServer: data.enemy?.serverId || data.enemyServerId || null,
		myScore: data.myScore ?? data.score ?? 0,
		enemyScore: data.enemyScore ?? data.enemy?.score ?? 0,
		state: data.state || data.phase,
		timestamp: Date.now(),
	};
}

/**
 * Resolve cross-server battle result list from payload.
 *
 * @param {Object} data - battle result payload
 * @returns {Array<Object>} normalized battle result rows
 */
export function resolveCrossServerBattleResults(data) {
	return Array.isArray(data.battles) ? data.battles : (data.results || [data]);
}

/**
 * Build cross-server battle row for battles IDB store.
 *
 * @param {Object} args - request args
 * @param {Object} result - battle result row
 * @param {Function} calculateTeamPower - team power callback
 * @param {Function} compressHeroTeam - team compression callback
 * @returns {Object} battle row
 */
export function buildCrossServerWarBattleRecord(args, result, calculateTeamPower, compressHeroTeam) {
	return {
		battleType: 'CrossServerWar',
		opponentId: result.defenderId || result.opponentId || args.defenderId || null,
		opponentName: result.defenderName || null,
		isWin: result.result?.win ?? result.win ?? false,
		playerPower: result.attackers ? calculateTeamPower(result.attackers) : 0,
		opponentPower: result.defenders ? calculateTeamPower(result.defenders) : 0,
		playerHeroes: result.attackers ? JSON.stringify(compressHeroTeam(result.attackers)) : null,
		opponentHeroes: result.defenders ? JSON.stringify(compressHeroTeam(result.defenders)) : null,
		rewards: result.reward ? JSON.stringify(result.reward) : null,
		fortId: result.fortId || args.fortId || null,
		warId: result.warId || args.warId || null,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Build raid-boss getter summary from attack history.
 *
 * @param {Array<Object>} history - raid attack history rows
 * @returns {{totalDamage:number, averageDamage:number}} summary
 */
export function buildRaidBossDamageSummary(history) {
	const totalDamage = history.reduce((sum, attack) => sum + attack.damage, 0);
	const averageDamage = history.length > 0 ? totalDamage / history.length : 0;

	return {
		totalDamage,
		averageDamage,
	};
}

/**
 * Build guild-war getter response payload.
 *
 * @param {Object|null} currentWar - current guild war metadata
 * @param {Array<Object>} history - guild war history rows
 * @param {Object} stats - computed stats object
 * @returns {{currentWar:Object|null, history:Array<Object>, stats:Object}} response payload
 */
export function buildGuildWarDataResponse(currentWar, history, stats) {
	return {
		currentWar,
		history,
		stats,
	};
}

/**
 * Build raid-boss getter response payload.
 *
 * @param {Object|null} currentBoss - current raid-boss metadata
 * @param {Array<Object>} history - raid history rows
 * @param {{totalDamage:number, averageDamage:number}} summary - precomputed summary
 * @returns {{currentBoss:Object|null, history:Array<Object>, totalDamage:number, averageDamage:number}} response payload
 */
export function buildRaidBossDataResponse(currentBoss, history, summary) {
	return {
		currentBoss,
		history,
		totalDamage: summary.totalDamage,
		averageDamage: summary.averageDamage,
	};
}

/**
 * Build guild-war history record payload.
 *
 * @param {Object} args - battle request args
 * @param {Object} data - battle response payload
 * @param {Object} currentWar - cached war metadata
 * @param {Function} compressHeroTeam - team compression callback
 * @param {boolean} isWin - battle result flag
 * @returns {Object} guild-war history row
 */
export function buildGuildWarBattleHistoryRecord(args, data, currentWar, compressHeroTeam, isWin) {
	return {
		type: 'guildWar',
		defenderId: args.defenderId,
		fortId: args.fortId,
		warId: currentWar.warId || null,
		enemyGuildName: currentWar.enemyGuildName || null,
		result: isWin ? 'victory' : 'defeat',
		myTeam: data.attackers ? compressHeroTeam(data.attackers) : null,
		enemyTeam: data.defenders ? compressHeroTeam(data.defenders) : null,
		reward: data.reward || {},
		timestamp: Date.now(),
	};
}

/**
 * Build guild-war battle row for battles IDB store.
 *
 * @param {Object} args - battle request args
 * @param {Object} data - battle response payload
 * @param {Object} currentWar - cached war metadata
 * @param {Function} calculateTeamPower - team power callback
 * @param {Function} compressHeroTeam - team compression callback
 * @param {boolean} isWin - battle result flag
 * @param {string} timestampIso - ISO timestamp for battle row
 * @returns {Object} battles row
 */
export function buildGuildWarBattleStoreRecord(
	args,
	data,
	currentWar,
	calculateTeamPower,
	compressHeroTeam,
	isWin,
	timestampIso
) {
	return {
		battleType: 'GuildWar',
		opponentId: args.defenderId || null,
		opponentName: currentWar.enemyGuildName || null,
		isWin,
		playerPower: data.attackers ? calculateTeamPower(data.attackers) : 0,
		opponentPower: data.defenders ? calculateTeamPower(data.defenders) : 0,
		playerHeroes: data.attackers ? JSON.stringify(compressHeroTeam(data.attackers)) : null,
		opponentHeroes: data.defenders ? JSON.stringify(compressHeroTeam(data.defenders)) : null,
		rewards: data.reward ? JSON.stringify(data.reward) : null,
		mission: args.fortId || null,
		warId: currentWar.warId || null,
		timestamp: timestampIso,
	};
}

/**
 * Build guild-war activity payload.
 *
 * @param {Object} guildData - guild metadata
 * @param {Object} args - battle request args
 * @param {Object} battleRecord - guild war history row
 * @param {Object} data - battle response payload
 * @returns {Object} guild activity payload
 */
export function buildGuildWarActivityPayload(guildData, args, battleRecord, data) {
	return {
		guildId: guildData.id || 'unknown',
		guildName: guildData.name || 'Unknown Guild',
		fortId: args.fortId,
		result: battleRecord.result,
		damage: data.damage || 0,
	};
}

/**
 * Build guild-war reward transaction intents.
 *
 * @param {Object} rewards - reward payload
 * @returns {Array<Object>} transaction intents
 */
export function buildGuildWarRewardIntents(rewards) {
	const intents = [];

	if (rewards.gold) {
		intents.push({ resourceType: 'gold', amount: rewards.gold, source: 'battle', sourceDetail: 'guild_war' });
	}
	if (rewards.guildWarToken) {
		intents.push({
			resourceType: 'guild_war_coins',
			amount: rewards.guildWarToken,
			source: 'battle',
			sourceDetail: 'guild_war',
		});
	}
	if (rewards.starmoney) {
		intents.push({ resourceType: 'emeralds', amount: rewards.starmoney, source: 'battle', sourceDetail: 'guild_war' });
	}

	return intents;
}

/**
 * Build raid-boss activity payload.
 *
 * @param {Object} guildData - guild metadata
 * @param {Object} args - attack request args
 * @param {Object} data - attack response payload
 * @returns {Object} guild activity payload
 */
export function buildRaidBossActivityPayload(guildData, args, data) {
	return {
		guildId: guildData.id || 'unknown',
		guildName: guildData.name || 'Unknown Guild',
		bossId: args.bossId,
		damage: data.damage || 0,
	};
}

/**
 * Build raid-boss reward transaction intents.
 *
 * @param {Object} rewards - reward payload
 * @returns {Array<Object>} transaction intents
 */
export function buildRaidBossRewardIntents(rewards) {
	const intents = [];

	if (rewards.gold) {
		intents.push({ resourceType: 'gold', amount: rewards.gold, source: 'battle', sourceDetail: 'guild_raid' });
	}
	if (rewards.guildToken || rewards.clanToken) {
		intents.push({
			resourceType: 'guild_coins',
			amount: rewards.guildToken || rewards.clanToken,
			source: 'battle',
			sourceDetail: 'guild_raid',
		});
	}
	if (rewards.starmoney) {
		intents.push({ resourceType: 'emeralds', amount: rewards.starmoney, source: 'battle', sourceDetail: 'guild_raid' });
	}

	return intents;
}

/**
 * Apply resource transaction intents via tracker API.
 *
 * @param {Object} tracker - gameTracker instance
 * @param {Array<Object>} intents - transaction intents
 */
export async function applyResourceTransactionIntents(tracker, intents) {
	for (const intent of intents) {
		await tracker.trackResourceTransaction(intent.resourceType, intent.amount, intent.source, intent.sourceDetail);
	}
}
