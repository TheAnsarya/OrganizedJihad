# OrganizedJihad — Development Roadmap

## Current Status: Phase 8

### Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Project initialization, workspace structure | Done |
| 2 | TamperMonkey userscript with API monitoring | Done |
| 3 | IndexedDB storage, game tracking core | Done |
| 4 | In-browser overlay UI | Done |
| 5 | API backend (ASP.NET Core) + Data layer (EF Core) | Done |
| 6 | Comprehensive entity models (35+ DbSets) | Done |
| 7 | Enhanced userscript tracking (chests, battles, resources, shops, inventory, daily quests, guild) | Done |
| 7.5 | Hero/Titan name dictionaries, titan element resolution, TamperMonkey sandbox fixes | Done |
| 8 | Desktop app visualization pages (Battles, Chests, Resources, Shop, Inventory, Rosters, Upgrades) | **Current** |

### Phase 8 — Desktop App Visualization (Current)

- [x] Dashboard overview page
- [x] Hero Roster with progress bars
- [x] Titan Roster with progress bars and element display
- [x] Hero Upgrades tracking page
- [x] Titan Upgrades tracking page
- [x] Daily Activity tracking page
- [x] Battles page (6 battle types, filters, win rate)
- [x] Chests page (drops, percentages, rarity breakdown)
- [x] Resources page (clickable balances, transaction log)
- [x] Shop Purchases page (shop type analysis, currency breakdown)
- [x] Inventory page (current inventory grouped by type + usage log)
- [x] NavMenu reorganized with Roster / Combat / Economy / Activity sections

### Phase 9 — Enhanced Tracking (Planned)

- [ ] Track Clash of Worlds battles
- [ ] Track Dungeon battles
- [ ] Track Adventure progress
- [ ] Track Tournament of the Elements
- [ ] Track Tower progress and chests
- [ ] Track Outland chest rewards
- [ ] Track Guild Raid minion battles
- [ ] Separate Guild Raid Boss tracking (Osh vs Maestro)
- [ ] Player power trending over time

### Phase 10 — Advanced Analytics (Planned)

- [ ] Win/loss trends over time (charts)
- [ ] Resource income/spending graphs
- [ ] Hero power progression timelines
- [ ] Team composition analysis (best teams for arena)
- [ ] Guild member activity scoring
- [ ] Automated daily report generation
- [ ] Export reports as PDF/CSV

### Phase 11 — Polish & Quality (Planned)

- [ ] Comprehensive test coverage (>90%)
- [ ] Performance benchmarking with BenchmarkDotNet
- [ ] Dark/Light theme toggle
- [ ] Mobile-responsive layout improvements
- [ ] Error handling and retry logic in sync
- [ ] Data integrity validation
- [ ] User settings persistence

### Phase 12 — Future Considerations

- [ ] Browser extension (Chrome/Firefox) as alternative to TamperMonkey
- [ ] Cloud sync option (opt-in)
- [ ] Team composition optimizer
- [ ] Resource farming calculator
- [ ] Multi-account support
