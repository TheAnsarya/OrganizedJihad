# Phase 9: Comprehensive Enhancement Plan

**Date**: 2025-01-24
**Branch**: `api-backend-creation`
**Starting Version**: v0.9.23 (553 tests, 16 suites)

## Overview

Phase 9 covers four major enhancement areas requested by the user:

1. **Pet & Titan Avatars** — Add avatar images to Pets and Titans tabs (matching Heroes)
2. **Dashboard Fixes** — Emeralds green color, ##/## card format, Guild Raid minions+boss
3. **Battle Tracking Enhancement** — Enemy teams, damage/healing, pets, avatar display
4. **Comprehensive API Tracking** — Handle every API endpoint the game sends

---

## Issue #109: Add Avatars to Pets & Titans Tabs

### Problem

Heroes tab already shows 32×32 avatar images from the HW-Assist CDN, but Pets and Titans tabs lack avatars. The same CDN URL pattern works for all unit types.

### Solution

- **CDN Pattern**: `https://calc2.hw-assist.com/static/assets/images/hero_icons/{XXXX}.png`
- **ID Ranges**: Heroes 1-71, Titans 4000-4043, Pets 6000-6009
- **IDs are zero-padded to 4 digits**: e.g., Titan 4001 → `4001.png`, Pet 6003 → `6003.png`

### Implementation

1. In `renderTitans()` — Add `<td class="oj-avatar-cell"><img class="oj-hero-avatar" ...>` as first column
2. In `renderPets()` — Same avatar column addition
3. Both tables get `<th class="oj-avatar-header">` in thead
4. Expand `colspan` in detail rows from 6 to 7
5. Reuse existing `.oj-hero-avatar` and `.oj-avatar-cell` CSS classes

### Files Modified

- `userscript/src/modules/uiManager.js` — `renderTitans()`, `renderPets()`

---

## Issue #110: Dashboard UI Fixes

### Problem

1. Emeralds displayed in blue (`#4fc3f7`) — should be green
2. Second row cards (Daily Quests, Guild Quests, Guild War, Guild Raid) show bare counts
3. Guild Raid card doesn't distinguish minions from boss

### Solution

1. **Emeralds color**: Change from `#4fc3f7` to `#66bb6a` (Material green)
2. **##/## format**: Show context numbers:
   - Daily Quests: X completed today (simple count, no max needed — varies by level)
   - Guild Quests: X completed today
   - Guild War: X/3 attacks used today
   - Guild Raid: X/9 minions + Y/5 boss attacks
3. **Guild Raid**: Split into two sub-values showing minion and boss progress

### Implementation

1. Change emerald color constant from `#4fc3f7` to `#66bb6a`
2. For Guild War: Track max attacks (3 per day) — show `X/3`
3. For Guild Raid: Separate RaidBoss attacks by bossId or type, show `X/9 minions • Y/5 boss`
4. Daily/Guild Quests: Keep as "X today" format (max varies)

### Files Modified

- `userscript/src/modules/uiManager.js` — `renderDashboard()`

---

## Issue #111: Battle Tracking & Display Enhancement

### Problem

1. `compressHeroTeam()` only stores `[id, level, star, color, power]` — no damage/healing/pet data
2. Battle UI shows only Time | Type | Opponent | Result — no team compositions
3. No avatar display in battles
4. No damage/healing numbers tracked or shown

### Solution

### Data Layer Changes

1. **Enhanced compression**: Store additional battle stats from the API response:
   - `damage` — total damage dealt by each hero
   - `healing` — total healing done
   - `pet` — pet ID assigned (if any)
2. **New format**: `[id, level, star, color, power, damage, healing, petId]`
3. Backward-compatible — old 5-element tuples still parse fine

### UI Changes

1. **Battle detail rows**: Expandable rows showing both team compositions with avatars
2. **Damage/Healing columns**: Show total damage dealt and healing done per battle
3. **Pet display**: Show pet avatar alongside the team
4. **Avatar rendering**: Use hero avatar CDN for all unit icons in battle display

### Files Modified

- `userscript/src/modules/gameTracker.js` — `compressHeroTeam()`, all battle trackers
- `userscript/src/modules/uiManager.js` — `renderBattles()`

---

## Issue #112: Comprehensive API Endpoint Tracking

### Problem

Only ~60 of the game's API endpoints are handled. Many game actions go untracked.

### Missing Handlers Identified

#### Battle Endpoints
- `titanArenaEnd` — Titan Arena battle completion
- `grandArenaEnd` — Grand Arena battle completion
- `adventureEnd` — Adventure battle completion
- `dungeonBattle` / `dungeonEnd` — Dungeon battles
- `titanDungeonBattle` — Titan dungeon battles

#### Upgrade/Evolution Endpoints
- `pet_levelUp` — Pet level upgrade
- `pet_evolve` — Pet star evolution
- `titanEnchantRune` — Titan glyph upgrade
- `heroGiftOfElements` / `heroGiftCoins` — Gift of Elements events

#### Economy Endpoints
- `offerBuy` — Store offer purchases
- `campaignFarm` — Campaign loot farming
- `missionFarm` — Mission auto-farming rewards
- `friendSendGift` / `friendGetGift` — Friend gift exchange
- `gacha_open` — Gacha openings

#### Guild Endpoints
- `clanDungeonBattle` — Clan dungeon battles
- `clanSendMessage` — Clan chat (already partially handled)

#### Event Endpoints
- `eventGetInfo` / `eventFarm` — Seasonal events
- `seasonGetInfo` / `seasonFarm` — Season pass progress
- `adventureGetAll` — Adventure state

#### Miscellaneous
- `skinChestOpen` / `runeChestOpen` — Specialized chest types
- `seerFarm` — Seer stone farming
- `titanSpiritUpgrade` — Titan spirit levels
- `heroAbsoluteStarMission` — Absolute star missions

### Solution

Add handler stubs for all missing endpoints. Each handler should:

1. Log the call to the API log store
2. Extract and store relevant data where possible
3. Track resource changes (gains/losses)

### Files Modified

- `userscript/src/modules/gameTracker.js` — `_buildHandlerRegistry()`

---

## Execution Order

1. **Issue #109** — Avatars (simplest, self-contained)
2. **Issue #110** — Dashboard fixes (moderate complexity)
3. **Issue #111** — Battle tracking (high complexity, data/UI changes)
4. **Issue #112** — API tracking (large scope but mostly repetitive stubs)

---

## Testing Strategy

- Existing 553 tests should still pass
- Visual testing via TamperMonkey in-browser
- New unit tests for enhanced compression format
- Verify backward compatibility with old battle records
