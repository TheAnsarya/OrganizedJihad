# 2025-02-23 — Hero Name Resolution & UI Enhancement

## Session 13

### Summary

Fixed the "Hero_49" display issue across the entire project. The Hero Wars game API does **not** return hero names — only numeric IDs. Names are resolved client-side via the game's translation system (`LIB_HERO_NAME_{id}`), which our userscript can't access. Created static hero/titan/pet name dictionaries (C# `FrozenDictionary` and JS module) mapping all 70 heroes, 22 titans, and 10 pets to their display names. Updated all UI pages and userscript trackers to use dictionary-based name resolution.

### Files Created

- `data/HeroNames.cs` — C# `FrozenDictionary<long, string>` with `Resolve()` and `ResolveWithFallback()` methods
- `userscript/src/modules/heroNames.js` — JS equivalent with `resolveHeroName()` and `resolveHeroNameWithFallback()` exports
- `desktop-app/Components/Pages/HeroRoster.razor` — New full hero roster page at `/heroes` with snapshot data, color ranks, glyph parsing, sort options

### Files Modified

- `userscript/src/modules/gameTracker.js` — Import heroNames, replace 3 fallback patterns with dictionary lookups
- `userscript/src/modules/trackers/UpgradeTracker.js` — Import heroNames, replace all 14 Hero_/Titan_ fallback patterns
- `desktop-app/Components/Pages/HeroUpgrades.razor` — Rewrote: added ID column, dictionary name resolution, Artifact/Glyph/Ascension columns
- `desktop-app/Components/Pages/TitanUpgrades.razor` — Added ID column, dictionary name resolution via `ResolveName()` static method
- `desktop-app/Components/Pages/InventoryUsage.razor` — Resolve equipment target names via `HeroNames.ResolveWithFallback()`
- `desktop-app/Components/Layout/NavMenu.razor` — Added "Hero Roster" nav link
- `userscript/tests/gameTracker.test.js` — Fixed 3 test blocks to use correct hero IDs matching dictionary (2=Galahad, 4=Astaroth)
- `userscript/src/modules/apiMonitor.js` — Whitespace cleanup (formatter only)

### Key Decisions

1. **Static dictionary approach** (same as HeroWarsHelper extension): Hardcoded ID-to-name mapping rather than runtime translation lookup, since the game's `Game.Translate` is not accessible from userscript context
2. **Shared IDs across heroes/titans/pets**: Single dictionary covers all entity types — hero IDs 1-70, titan IDs 4000-4043, pet IDs 6000-6009
3. **`ResolveWithFallback()` method**: Preserves any stored name that doesn't match the `Hero_NNN`/`Titan_NNN` pattern, enabling graceful handling of new/unknown entities

### Test Results

- **296 JS tests** — All passing (7 suites)
- **75 .NET tests** — All passing (39 Data + 36 API)
- **Build** — 0 errors, 0 warnings

### Commits

- `df45891` — Add hero/titan/pet name dictionaries and fix name resolution across all UI pages

### Known Issues / Follow-up

- Ascension column is a placeholder (data not yet persisted as a separate DB column)
- New heroes added to the game will need manual dictionary updates
- Existing DB records with "Hero_49" format will display correctly via `ResolveWithFallback()` at the display layer
