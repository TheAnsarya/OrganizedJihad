# 2026-06-04 In-Game UI Gating + Observability Wave

## Epic
- #350 Epic: In-game UI gating, API observability UX, and release hardening wave

## Child Issues (12-slice batch)
- #351 Fix: Gate overlay/UI modules to real game surfaces only
- #352 Fix: Remove recent game/JS API calls from Connection tab
- #348 Feature: Add Swagger and server logging links to userscript Connection tab
- #349 Feature: Add Swagger and server logging actions to tray icon context menu
- #353 Feature: Add local API log-view endpoint for observability links
- #356 Test: userscript coverage for game-surface gating helper
- #355 Test: userscript coverage for Connection tab observability links
- #357 Test: tray host tests for new context menu actions
- #354 Docs/Plan: observability and gating implementation plan
- #359 Release prep: stabilization release notes and smoke checklist
- #358 Ops: one-command validation task for this wave
- #361 Hardening: keep Connection tab API-health-only
- #360 Hardening: enforce game-surface-only overlay init

## Execution Order
1. Implement page gating for userscript UI initialization (#351)
2. Clean Connection tab scope and remove call stream (#352)
3. Add Connection tab observability links for Swagger/OpenAPI/logs (#348)
4. Add local API log endpoint (#353)
5. Add tray context menu actions for Swagger/OpenAPI/logs (#349)
6. Add/expand tests (#356 #355 #357)
7. Update docs + release prep artifacts (#354 #359 #358 #360 #361)

## Acceptance Snapshot
- No OJ overlay/badge on community/news pages
- OJ UI appears on game surfaces
- Connection tab does not show game/JS API call stream
- Connection tab has Swagger/OpenAPI/server-log links
- Tray menu has Swagger/OpenAPI/log links
- Focused API + userscript tests pass
