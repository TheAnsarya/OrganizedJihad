# Session: Phase 8 — Userscript Capture for Upgrades, Quests & Inventory

**Date**: 2025-01-24
**Issue**: #15 — Userscript: Capture hero/titan upgrades, daily quests, and inventory events
**Branch**: `api-backend-creation`

## Summary

Implemented browser-side capture of Phase 8 entity data in the TamperMonkey userscript. This adds tracking for hero/titan upgrade events, daily/guild quest completions, login rewards, and inventory item usage — completing the data pipeline from browser interception through IndexedDB storage to API sync.

## Changes Made

### New Files

- **`userscript/src/modules/trackers/UpgradeTracker.js`** (~270 lines)
	- Dedicated tracker module for hero and titan upgrade events
	- 6 methods: `trackHeroSkillUpgrade`, `trackHeroArtifactUpgrade`, `trackHeroSkinUpgrade`, `trackHeroGlyphUpgrade`, `trackHeroLevelUpgrade`, `trackTitanArtifactUpgrade`
	- Follows existing ArenaTracker pattern (constructor takes storage)
	- Maps Hero Wars API slot IDs to artifact names (Weapon/Book/Ring)
	- Maps glyph tier IDs to glyph type names

### Modified Files

- **`userscript/src/modules/indexedDBStorage.js`**
	- Bumped IndexedDB version from 5 → 6
	- Added 7 new object stores with appropriate indexes:
		- `heroUpgrades` (timestamp, heroId, playerId, upgradeType)
		- `titanUpgrades` (timestamp, titanId, playerId, upgradeType)
		- `dailyQuestCompletions` (completedAt, questDate, questId, playerId)
		- `guildQuestCompletions` (completedAt, questDate, questId, playerId, guildId)
		- `loginRewards` (claimedAt, playerId, dayNumber)
		- `inventoryItemUsages` (timestamp, playerId, itemId, category)
		- `equipmentChanges` (timestamp, heroId, playerId, changeType)

- **`userscript/src/modules/gameTracker.js`**
	- Added import and initialization of `UpgradeTracker` module
	- Added 10 new API call handlers in `processAPIResponse` switch:
		- Hero upgrades: `heroUpgradeSkill`, `heroArtifactLevelUp`, `heroSkinUpgrade`, `heroEnchantRune`, `consumableUseHeroXp`
		- Titan upgrades: `titanArtifactLevelUp`
		- Daily activity: `questFarm`, `quest_questsFarm`, `dailyBonusFarm`, `dailyBonusGetInfo`
	- Added 6 new handler methods:
		- `_getPlayerId()` — helper to get cached player ID
		- `trackDailyQuestFarm()` — single quest farm with daily/guild detection
		- `trackBatchQuestFarm()` — batch quest farming
		- `trackLoginReward()` — daily login reward claims
		- `trackDailyBonusInfo()` — caches bonus state in metadata
		- `trackInventoryItemUsage()` — consumable item usage tracking

- **`userscript/src/modules/syncClient.js`**
	- Added gathering of 7 new IndexedDB stores in `syncToServer()`
	- Splits `heroUpgrades` by `upgradeType` discriminator into 7 DTO arrays
	- Splits `titanUpgrades` by `upgradeType` discriminator into 5 DTO arrays
	- Added all Phase 8 properties to sync payload matching BrowserSyncData DTO
	- Added Phase 8 counts to sync diagnostic log

## API Calls Now Tracked (10 new, 42 total)

| API Call | Handler | Store |
|---|---|---|
| `heroUpgradeSkill` | UpgradeTracker.trackHeroSkillUpgrade | heroUpgrades |
| `heroArtifactLevelUp` | UpgradeTracker.trackHeroArtifactUpgrade | heroUpgrades |
| `heroSkinUpgrade` | UpgradeTracker.trackHeroSkinUpgrade | heroUpgrades |
| `heroEnchantRune` | UpgradeTracker.trackHeroGlyphUpgrade | heroUpgrades |
| `consumableUseHeroXp` | UpgradeTracker.trackHeroLevelUpgrade + trackInventoryItemUsage | heroUpgrades + inventoryItemUsages |
| `titanArtifactLevelUp` | UpgradeTracker.trackTitanArtifactUpgrade | titanUpgrades |
| `questFarm` | trackDailyQuestFarm | dailyQuestCompletions / guildQuestCompletions |
| `quest_questsFarm` | trackBatchQuestFarm | dailyQuestCompletions / guildQuestCompletions |
| `dailyBonusFarm` | trackLoginReward | loginRewards |
| `dailyBonusGetInfo` | trackDailyBonusInfo | metadata |

## Design Decisions

1. **Single store + discriminator**: Hero upgrades use one `heroUpgrades` IndexedDB store with `upgradeType` field rather than 7 separate stores. SyncClient filters by type when building the API payload. Same for titan upgrades.
2. **Quest type detection**: Daily quests detected by ID range (10000-10999). Other IDs treated as guild quests.
3. **UpgradeTracker module**: Follows ArenaTracker pattern — dedicated module to prevent gameTracker.js bloat.

## Verification

- ✅ `yarn build` — Webpack production build succeeded (no errors)
- ✅ `dotnet build` — .NET solution builds successfully (0 errors, 2 pre-existing warnings)
- ✅ `dotnet test` — All 55 tests pass (39 data + 16 API)
