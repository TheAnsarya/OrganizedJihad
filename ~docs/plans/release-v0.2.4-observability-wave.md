# Release Plan - v0.2.4 (Observability + In-Game UI Gating)

## Scope
- Overlay/UI initialization restricted to game surfaces only (community/news excluded)
- Connection tab is API-health/config only (no game/JS call stream)
- Connection tab links include Swagger UI, OpenAPI JSON, and server logs endpoint
- Tray menu links include Swagger UI, OpenAPI JSON, and server logs endpoint
- Local API endpoint `/ui/logs/latest` added for server log access

## Verification Commands
- `dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj --filter "FullyQualifiedName~SyncControllerTests"`
- `yarn test gameSurfaceGuard.test.js uiManagerConnectionView.test.js battleRecommendationOverlay.test.js uiManagerTeamRecommendationOperationsSummary.test.js`
- `pwsh -File .\Test-ObservabilityWave.ps1`

## Release Checklist
- [ ] Confirm `main` is green on focused API and userscript slices
- [ ] Manual smoke: verify no OJ overlay on `community.hero-wars.com/feed/all/1`
- [ ] Manual smoke: verify overlays/badge on game runtime hosts
- [ ] Manual smoke: verify Connection tab links open Swagger/OpenAPI/server logs
- [ ] Manual smoke: verify tray menu links open Swagger/OpenAPI/server logs
- [ ] Update release notes and publish artifact bundle
