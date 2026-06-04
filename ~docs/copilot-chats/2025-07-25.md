# 2025-07-25 - Pets Tab: Items→Color Fix + Soul Stones Progress

## Date & Session
- **Date**: 2025-07-25
- **Session**: 1
- **Issue**: #108

## Summary

Fixed the Pets tab UI where the Items column always showed 100% (because pet equipment slots are always filled at the current color rank — you equip all 6 items then promote, consuming them). Replaced the Items metric with **Color (rank progression)** which tracks actual pet color/rank tier (1–10, max Orange for pets). Also added a **Pet Soul Stones progress bar** at the top of the Pets tab showing actual numbers (available vs needed to max all pets).

## Changes Made

### PetCompletionCalculator.js
- Replaced `MAX_ITEMS = 6` with `MAX_COLOR = 10`
- Updated WEIGHTS: `items: 0.20` → `color: 0.20`
- Updated SYSTEM_LABELS (`Color`) and SYSTEM_ICONS (`🎨`)
- `calculateCompletion()` reads `pet.color` instead of `pet.items`

### gameTracker.js
- `trackPetsData()`: Captures `color: pet.color || 0` instead of items from slots
- Updated dedup fingerprint array: `p.items` → `p.color`
- Updated metadata summary: `items: p.items` → `color: p.color`

### uiManager.js
- Replaced Items column with Color column using `_colorRankName()` and `_colorRankClass()` helpers for styled display
- Added pet soul stones progress bar at top of Pets tab:
  - Reads `fragmentPet` from cached `inventoryData` metadata
  - Calculates stones needed per pet based on current star level using cumulative cost table
  - Shows "X available / Y needed to max all" with visual progress bar

### petCompletionCalculator.test.js
- Updated all test cases from `items` to `color` (max 10 instead of 6)
- 553 tests passing, 16 suites

## Files Modified
- `userscript/src/modules/helpers/PetCompletionCalculator.js`
- `userscript/src/modules/gameTracker.js`
- `userscript/src/modules/uiManager.js`
- `userscript/tests/petCompletionCalculator.test.js`

## Issues
- Created and closed: #108

## Key Decisions
- **Items → Color**: Pet equipment (slots) is always 6/6 because the game requires equipping all items before color promotion. Color/rank (1–10) is the meaningful progression metric.
- **Pet MAX_COLOR = 10**: Pets max out at Orange (rank 10), unlike heroes which go to Red+2 (rank 18).
- **Soul stone star costs**: Used community-known cumulative values: [0, 10, 30, 80, 180, 330, 630] per pet (630 total to max).
- **Soul stones source**: `fragmentPet` from `inventoryGet` API response, already tracked in inventory metadata.

## Build
- Version: v0.9.23
- Tests: 553 passed, 16 suites
