# Hero Completion Percentage System — Design Plan

**Issue:** #33
**Date:** 2026-02-22
**Status:** In Progress

---

## Overview

Add a completion percentage indicator for each hero showing how "maxed out" they are
across all upgrade systems. Displayed both in our OJ overlay panel and as a floating
overlay on the game's actual UI.

---

## Hero Systems & Max Values

Each hero has multiple upgrade systems. We calculate per-system completion and a
weighted overall percentage.

| # | System | API Field | Max Value | Weight | Calculation |
|---|--------|-----------|-----------|--------|-------------|
| 1 | **Level** | `level` | 130¹ | 15% | `level / MAX_LEVEL` |
| 2 | **Stars** | `star` | 6 | 15% | `star / 6` |
| 3 | **Color/Rank** | `color` | 18 | 15% | `color / MAX_COLOR` |
| 4 | **Skills** | `skills` (obj: `{skillId: level}`) | 130 each¹ | 15% | `avg(skill levels) / MAX_LEVEL` |
| 5 | **Artifacts** | `artifacts` (array of 3: `{level, star}`) | Level 130¹, Star 6 | 15% | Per artifact: `(level/MAX_LEVEL + star/6) / 2`, then average |
| 6 | **Glyphs/Runes** | `runes` (array of 5 values) | 43,750 each | 10% | `avg(rune values) / MAX_RUNE` |
| 7 | **Skins** | `skins` (obj: `{skinId: level}`) | 60 per skin | 5% | `avg(skin levels) / MAX_SKIN` |
| 8 | **Titan Gift** | `titanGiftLevel` | 30 | 5% | `titanGiftLevel / MAX_TITAN_GIFT` |
| 9 | **Ascension** | `ascensions` (obj: `{tier: [nodes]}`) | 5 tiers, ~50 nodes² | 5% | `totalNodes / MAX_ASCENSION_NODES` |

¹ Max level may increase with game updates — stored as configurable constants.
² Node counts vary per tier (10-11 per tier). We sum all unlocked nodes across tiers.

**Overall = weighted sum of per-system scores.**

---

## Data Tracking Fix (Critical)

Current `trackHeroesData()` has bugs and missing fields:

### Bugs to Fix
- **Skills**: Accessed as `hero.skills?.skill1?.level` but API uses `{skillId: level}` format
- **Skins**: Stored as `hero.skins || 0` (number) but API returns `{skinId: level}` object

### Fields to Add
- `runes` — array of 5 glyph levels (currently stored as wrong `glyphs` key)
- `titanGiftLevel` — titan spark gift level (max 30)
- `ascensions` — object with tier keys and node arrays
- `rawSkills` — complete skills object `{skillId: level}`
- `rawSkins` — complete skins object `{skinId: level}`
- `artifactLevels` — `[level, level, level]` for 3 artifacts (currently only stars are stored)
- `petId` — assigned pet ID

### Backward Compatibility
- Keep existing `skillLevel1-4`, `artifactWeapon/Book/Ring` fields (these map to C# model)
- Add new fields alongside for richer tracking
- Store raw data as JSON blobs for fields that vary per hero

---

## Architecture

### New Module: `HeroCompletionCalculator`

Location: `userscript/src/modules/helpers/HeroCompletionCalculator.js`

```
class HeroCompletionCalculator {
    static MAX_VALUES = { level: 130, star: 6, color: 18, ... }
    static WEIGHTS = { level: 0.15, stars: 0.15, ... }

    static calculateCompletion(heroData) → { overall, systems: { level, stars, ... } }
    static calculateSystemScore(system, heroData) → number (0-1)
    static formatPercent(value) → string like "62.38%"
}
```

### Enhanced Heroes UI (OJ Overlay Panel)

- Each hero row gets a completion % column with a mini progress bar
- Sortable by completion %
- Click hero row to expand detailed per-system breakdown
- Color-coded: red (<25%), orange (<50%), yellow (<75%), green (>=75%), cyan (100%)

### Game Overlay Module: `gameOverlay.js`

Location: `userscript/src/modules/gameOverlay.js`

Since the game's rendering tech is unknown (could be canvas, WebGL, or DOM), we use a
**floating panel approach** rather than attempting to inject into game DOM elements:

1. **Compact floating panel** — small draggable panel showing hero completion %s
2. **Triggered by hotkey** (e.g., Alt+H) or button in OJ badge
3. **Shows the current hero roster** with completion bars in a compact grid
4. Semi-transparent, positioned over the game area
5. Auto-refreshes when hero data updates

This approach works regardless of the game's rendering technology because we overlay
HTML on top of the game iframe content, not inside the game's render tree.

---

## Implementation Steps

1. Fix `trackHeroesData()` to capture all required fields
2. Create `HeroCompletionCalculator` module with configurable max values
3. Enhance `renderHeroes()` in UIManager with completion % column
4. Create `gameOverlay.js` module for the floating hero completion panel
5. Add CSS for progress bars, completion colors, floating panel
6. Add tests for calculator and updated tracking
7. Wire everything in index.js

---

## Visual Design

### In OJ Panel (Heroes Tab)

```
┌──────────────────────────────────────────────────────────────────┐
│ 🦸 Heroes (52 • 8,234,567 total power)                         │
│ [Search: ________]                                              │
│                                                                 │
│ Name       Lvl  Stars  Rank      Power     Complete             │
│ ─────────────────────────────────────────────────────────────    │
│ Galahad    130  ⭐⭐⭐⭐⭐⭐  Red+2    198,058   ████████░░ 82.4%  │
│ Astaroth   130  ⭐⭐⭐⭐⭐⭐  Red+2    195,200   ███████░░░ 74.1%  │
│ Celeste    120  ⭐⭐⭐⭐⭐   Orange+3 145,000   █████░░░░░ 51.2%  │
└──────────────────────────────────────────────────────────────────┘
```

### Floating Game Overlay (compact)

```
┌─ Hero Completion ──── [×]
│ Galahad     ████████░░ 82.4%
│ Astaroth    ███████░░░ 74.1%
│ Celeste     █████░░░░░ 51.2%
│ Martha      ████░░░░░░ 43.8%
│ ...
└── Alt+H to toggle ──────
```
