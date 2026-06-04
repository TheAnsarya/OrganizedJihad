# OrganizedJihad v0.2.4 - Observability Wave

## Highlights
- In-game UI gating prevents overlays/panels from appearing on non-game Hero Wars surfaces.
- Connection tab now focuses on API health/configuration diagnostics only.
- New observability shortcuts from Connection tab and tray menu:
	- Swagger UI
	- OpenAPI JSON
	- Latest API server logs
- Added local-only endpoint `GET /ui/logs/latest` for fast diagnostics.

## Included Validation
- API focused tests: `SyncControllerTests` pass (33/33)
- Tray host tests pass including URL-link builder coverage (18/18)
- Userscript focused suites pass including connection and game-surface guard coverage (53/53)
- One-command validation script: `pwsh -File .\Test-ObservabilityWave.ps1`

## Smoke Checklist (Release Gate)
- [ ] Verify no overlay on `https://community.hero-wars.com/feed/all/1`
- [ ] Verify overlay appears on game runtime pages
- [ ] Verify Connection tab opens Swagger/OpenAPI/Logs links
- [ ] Verify tray menu opens Swagger/OpenAPI/Logs links
- [ ] Verify `/ui/logs/latest` rejects non-local requests

## Notes
- `baseline-browser-mapping` warning appears during Jest runs and is informational for this release.
