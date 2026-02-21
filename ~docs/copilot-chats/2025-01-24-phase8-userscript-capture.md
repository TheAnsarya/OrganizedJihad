# Session: Phase 8 — Userscript Capture + Desktop Visualization

**Date**: 2025-01-24
**Issues**: #15 — Userscript capture, #16 — Desktop visualization
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

---

## Issue #16: Desktop App Data Visualization

### New Files

- **`desktop-app/Components/Pages/HeroUpgrades.razor`** (~280 lines)
	- Unified timeline of all 7 hero upgrade types
	- Filter by hero name, upgrade type, and date range
	- Summary cards with per-type counts
	- Paginated table (max 200 rows) with color-coded badges

- **`desktop-app/Components/Pages/TitanUpgrades.razor`** (~260 lines)
	- Timeline of all 5 titan upgrade types
	- Same filter/display pattern as HeroUpgrades

- **`desktop-app/Components/Pages/DailyActivity.razor`** (~310 lines)
	- Dashboard with daily/guild quest counts, login rewards, activity points
	- CSS-based bar chart showing quests completed by day (last 30 days)
	- Login streak info card
	- Unified activity log table

- **`desktop-app/Components/Pages/InventoryUsage.razor`** (~310 lines)
	- Item usage and equipment change tracking
	- Category breakdown with progress bars
	- Equipment change type summary
	- Combined usage log table

### Modified Files

- **`desktop-app/Components/Layout/NavMenu.razor`**
	- Replaced boilerplate links (Counter, Weather) with proper navigation
	- Added section header for "Tracking" pages
	- Links: Dashboard, Hero Upgrades, Titan Upgrades, Daily Activity, Inventory Usage

### Verification

- ✅ `dotnet build desktop-app` — 0 errors, 0 warnings
- ✅ `dotnet test` — All 55 tests pass (39 data + 16 API)
