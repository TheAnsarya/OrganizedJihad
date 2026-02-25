# 2025-01-24 — Titans Tab Overhaul & Pet Soul Stones Rework

## Session Summary

Comprehensive overhaul of the Titans UI tab in the userscript: removed the non-existent "Skill" system, fixed broken Skins data capture, added visual artifact icons with colored borders, fixed titan avatar URLs, added Totem stats to the Element column, and completely reworked the Pet Soul Stones section to show per-pet breakdowns with meaningful numbers.

## Changes Made

### TitanCompletionCalculator.js

- **Removed Skill system** — "Skill" was not a real game mechanic; removed from weights, labels, icons, and calculation
- **Added Totem system** (weight 0.15) — Uses `totemLevel` (max 130) and `totemStar` (max 6), averages both scores
- **Fixed Skins scoring** — New `_calcSkinScore()` method parses `skinData` JSON object (was always 0 from `skinLevel`)
- **Added helper methods**: `parseArtifacts()`, `parseSkins()`, `artifactStarClass()`
- **Updated weights**: level: 0.25, stars: 0.25, artifacts: 0.20, skins: 0.15, totem: 0.15
- **Fixed extra closing brace** that broke Babel parsing

### gameTracker.js — `trackTitansData()`

- Removed `skillLevel` field
- Changed `skinLevel: titan.skinLevel || 0` → `skinData: JSON.stringify(titan.skins || {})`
- Added `totemLevel`, `totemStar`, `totemPower` from `elementSpiritLevel/Star/Power` API fields

### uiManager.js — `renderTitans()`

- **Fixed titan avatars**: Changed URL from `hero_icons/{padded}.png` (404) to `titan_icons/titan_icon_{id}.png`
- **Added Artifacts column**: Shows 3 artifact icons with star-ranked colored borders and level badges
- **Updated Element column**: Now shows "Element / Totem" with totem star/level stats below element name
- **Updated table colspan**: 7 → 8 for detail rows

### uiManager.js — Pet Soul Stones

- **Complete rewrite** from misleading totals to per-pet breakdown
- Shows: "X usable of Y in inventory / Z needed to max all"
- `totalUsable` excludes excess stones that can't be used on already-maxed or over-stocked pets
- Added collapsible `<details>` per-pet table: Pet name, Stars, Have, Next ★ cost, To Max
- Green highlighting for pets with enough stones for next star upgrade
- Added `STAR_COSTS_INCREMENTAL` array for next-star display

### main.css

- `.oj-artifact-cell`, `.oj-artifact-col` — column layout for artifact icons
- `.oj-artifact-icon` + `.oj-rank-*` variants — 24x24px bordered icons with star-based colors
- `.oj-artifact-level` — 9px level badge
- `.oj-totem-stats` — muted 10px text for totem stats
- `.oj-pet-soulstones`, `.oj-soulstone-details`, `.oj-soulstone-table` — soul stone breakdown
- `.oj-text-green` — green highlight for ready-to-upgrade pets

### titanCompletionCalculator.test.js

- Updated all existing tests to use new fields (`skinData`, `totemLevel`, `totemStar`)
- Added 16 new tests: skin scoring, totem scoring, parseArtifacts, parseSkins, artifactStarClass
- **569 tests passing** across 16 suites (was 553)

## Files Modified

- `userscript/src/modules/helpers/TitanCompletionCalculator.js`
- `userscript/src/modules/gameTracker.js`
- `userscript/src/modules/uiManager.js`
- `userscript/src/styles/main.css`
- `userscript/tests/titanCompletionCalculator.test.js`
- `userscript/package.json` (version bump to 0.9.26)

## Key Decisions

1. **Totem fields**: Used `elementSpiritLevel`, `elementSpiritStar`, `elementSpiritPower` from the HW API (found in reference code's `HERO_FIELDS_TO_COMPRESS`)
2. **Titan avatar CDN**: Confirmed `titan_icons/titan_icon_{id}.png` is the correct path (old `hero_icons/{id}.png` returns 404 for titan IDs)
3. **Skins data**: The API provides `titan.skins` as `{ skinId: { level, ... } }` — the old code's `skinLevel` was always 0
4. **Pet Soul Stones rework**: "Available" was misleading because pet-specific stones can't be used on other pets. New display shows usable (capped at needed) vs available (raw total) vs needed

## Build

- **Version**: 0.9.26
- **Tests**: 569 passed, 16 suites
- **Build**: webpack production compiled successfully

## Commit

```
d090dda Overhaul Titans tab: remove Skill, add Totem/Skins/Artifacts, fix avatars, rework Pet Soul Stones
```

Pushed to `api-backend-creation` branch.
