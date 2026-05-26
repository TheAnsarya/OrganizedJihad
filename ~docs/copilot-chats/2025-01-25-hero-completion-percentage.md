# Session Log: Hero Completion Percentage Bars with Game Overlay

**Date:** 2025-01-25
**Session:** 8, Conversations 10-11
**Issue:** [#33 — Hero completion percentage bars with game overlay](https://github.com/TheAnsarya/OrganizedJihad/issues/33)

---

## Summary

Implemented a comprehensive hero completion percentage system that calculates and displays how much of each upgrade system (level, stars, rank, skills, artifacts, glyphs, skins, titan gift, ascension) a hero has completed. Includes an enhanced Heroes view in the OJ overlay panel and a new floating game overlay panel.

## What Was Accomplished

### Research (Conversation 10)

- **Deep-dived into game API hero object structure**: Discovered that skills use `{skillId: level}` format (not our old `skill1.level`), skins use `{skinId: level}` format (not a count), and identified missing fields (runes, titanGiftLevel, ascensions, artifactLevels, petId)
- **Investigated game rendering technology**: Game rendering tech is unknown from code alone. The reference extension (hwh2) has zero interaction with game visuals — it creates its own iframe with an Angular app. Decided on floating HTML overlay approach.
- **Identified bugs in `trackHeroesData()`**: Skills were accessed incorrectly, skins stored as raw object instead of count, dedup fingerprint was too narrow (missed skill/rune/skin upgrades)

### Implementation (Conversations 10-11)

1. **Fixed `trackHeroesData()`** in `gameTracker.js`:
   - Fixed skills extraction from `{skillId: level}` object format
   - Fixed skins counting from `{skinId: level}` object format
   - Added new fields: `rawSkills`, `rawSkins`, `artifactLevels`, `runes`, `titanGiftLevel`, `ascensions`, `petId`
   - Expanded dedup fingerprint to include skills/runes/skins/artifacts/titanGiftLevel
   - Added metadata cache write for fast UI access

2. **Created `HeroCompletionCalculator.js`** (~483 lines):
   - 9 weighted systems: level (15%), stars (15%), color (15%), skills (15%), artifacts (15%), runes (10%), skins (5%), titan gift (5%), ascension (5%)
   - Configurable max values (level=130, stars=6, color=18, etc.)
   - Handles both tracked IDB format (JSON strings) and raw API format
   - `calculateCompletion(hero)` → per-system scores + weighted overall
   - `calculateAll(heroes)` → sorted array
   - `formatPercent()`, `renderBar()`, `colorClass()` for UI display

3. **Enhanced `renderHeroes()`** in `uiManager.js`:
   - Added completion column with color-coded progress bars
   - Expandable detail rows with per-system breakdown (9 bars in 3-column grid)
   - Average completion percentage in header
   - Click-to-expand interaction

4. **Created `gameOverlay.js`** (~300 lines):
   - Floating, draggable panel positioned over the game UI
   - Alt+H hotkey toggle
   - Shows all heroes ranked by completion % with compact bars
   - Position saved to localStorage
   - Auto-refreshes when hero data is updated

5. **Added ~250 lines of CSS** for completion bars, hero expansion, and game overlay

6. **Wrote comprehensive tests** (30 new tests):
   - `heroCompletionCalculator.test.js`: All 9 systems, edge cases, formatting, sorting
   - `gameTracker.test.js`: New tests for skill extraction, skin counting, new fields, metadata cache, dedup fingerprint

## Files Created

- `userscript/src/modules/helpers/HeroCompletionCalculator.js` — Calculator module
- `userscript/src/modules/gameOverlay.js` — Floating game overlay module
- `userscript/tests/heroCompletionCalculator.test.js` — Calculator tests
- `~docs/plans/hero-completion-percentage-plan.md` — Design document

## Files Modified

- `userscript/src/modules/gameTracker.js` — Fixed `trackHeroesData()` with new fields + bugs
- `userscript/src/modules/uiManager.js` — Enhanced `renderHeroes()` with completion column
- `userscript/src/index.js` — Wired GameOverlay initialization and data hooks
- `userscript/src/styles/main.css` — Added completion bar, hero expansion, overlay CSS
- `userscript/tests/gameTracker.test.js` — Added 9 new hero tracking tests

## Issues Referenced

- **#33** — Hero completion percentage bars with game overlay (created and implemented)

## Key Decisions

1. **Floating overlay vs DOM injection**: Since the game's rendering technology is unknown and the reference extension never touches game DOM, we chose a floating HTML panel approach that works regardless of canvas/DOM rendering
2. **9 systems with configurable weights**: Weights sum to 1.0, max values are static properties that can be updated when game raises caps
3. **Dual format support**: Calculator handles both tracked IDB format (JSON strings) and raw API format for flexibility
4. **Metadata cache**: Heroes data cached via `setMetadata('heroesData', heroes)` for instant UI access without querying all IDB records

## Test Results

- **101/101 tests passing** (was 71, added 30 new)
- Build successful (webpack production, 1.34 MiB bundle)

## Commits

- `dde0cd3` — Feat #33: Hero completion percentage bars with game overlay

## Known Issues / Follow-up

- Game overlay positioning may need tuning based on actual game UI layout
- Max values may need updating as game adds new content (currently at level 130 cap)
- Could add hero filtering/search to the game overlay panel
- Future: investigate if game DOM is accessible for more integrated overlay
