# 2026-06-02 - Connection Status And Nav Icons

## Session
- Date: 2026-06-02
- Session Number: 4
- Scope: Userscript connection diagnostics reliability and tab icon UX refinement

## Summary
- Improved connection status logic to reduce false "server down" reports when direct endpoint probes fail but recent sync metadata indicates API reachability.
- Added/confirmed dedicated Test button behavior in Connection settings workflow.
- Added nav icon rendering support for all major tabs and dynamic connection badge/icon state.
- Republished installer bundle and launched installer executable with updated userscript build.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/src/modules/renderers/dashboardLowerSectionsRenderer.js
- userscript/src/index.js
- userscript/src/modules/battleRecommendationOverlay.js
- userscript/src/modules/helpers/apiConfig.js
- userscript/package.json
- installer-ui/bundle-payload/organized-jihad.user.js
- userscript/dist/organized-jihad.user.js

## Validation
- get_errors userscript/src/modules/uiManager.js (no errors)
- yarn test --runInBand
- yarn build
- pwsh -ExecutionPolicy Bypass -File ./Publish-InstallerUI.ps1

---

## Session
- Date: 2026-06-02
- Session Number: 12
- Scope: Header language dropdown finalization + inventory unresolved-name diagnostics panel

## Summary
- Replaced header language toggle behavior with dropdown-only workflow suitable for future language expansion.
- Kept globe + two-letter label in header selector and synchronized header/settings language selectors.
- Added inventory diagnostics section that shows unresolved item IDs, rendered fallback labels, available catalog hits, and attempted token paths.
- Added parsing-time diagnostics capture for unresolved names so follow-up mapping work can target exact IDs quickly.
- Hardened resolver fallback flow to reuse token candidate generation in both resolution and diagnostics.
- Rebuilt userscript to `0.9.223` after diagnostics panel changes.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/src/modules/binders/settingsDisplayTrackingBinder.js
- userscript/src/styles/main.css
- userscript/package.json
- userscript/dist/organized-jihad.user.js
- ~docs/copilot-chats/2026-06-02-userscript-build-auto.md
- ~docs/copilot-chats/2026-06-02-connection-status-and-nav-icons.md

## Validation
- get_errors userscript/src/modules/uiManager.js (no errors)
- yarn test --runInBand (37/37 suites, 843/843 tests passed)
- yarn build (version 0.9.223)

---

## Session
- Date: 2026-06-02
- Session Number: 11
- Scope: Userscript language dropdown UX + inventory placeholder-name reduction

## Summary
- Replaced the header language quick-toggle button with a wider dropdown selector designed for more than two languages.
- Added multi-language selector options (EN/RU/DE/FR/ES/IT/PT/TR) and synchronized header/settings selectors with persisted preference.
- Updated settings language binder to pass through selected language codes instead of forcing EN/RU only.
- Added stronger placeholder detection and filtering for item/entity labels (e.g., `consumable_53`, `Hero_4044`, and generic `... #123` forms).
- Added token-family resolution fallback for inventory IDs using locale key patterns (`LIB_*_NAME_{id}`) to prefer real translated labels over placeholders.
- Expanded descriptor label extraction to check locale-specific fields and English-focused fields before accepting fallback labels.
- Rebuilt userscript to `0.9.221`, republished installer payload, and launched installer executable.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/src/modules/binders/settingsDisplayTrackingBinder.js
- userscript/src/styles/main.css
- userscript/package.json
- userscript/dist/organized-jihad.user.js
- installer-ui/bundle-payload/organized-jihad.user.js
- ~docs/copilot-chats/2026-06-02-userscript-build-auto.md
- ~docs/copilot-chats/2026-06-02-connection-status-and-nav-icons.md

## Validation
- get_errors userscript/src/modules/uiManager.js (no errors)
- get_errors userscript/src/modules/binders/settingsDisplayTrackingBinder.js (no errors)
- get_errors userscript/src/styles/main.css (existing cross-browser advisory warnings only)
- yarn test --runInBand (37/37 suites, 843/843 tests passed)
- yarn build (version 0.9.221)
- pwsh -ExecutionPolicy Bypass -File ./Publish-InstallerUI.ps1

---

## Session
- Date: 2026-06-02
- Session Number: 10
- Scope: Userscript global language selector + English-default naming + quick globe toggle

## Summary
- Added a global UI language preference (`en`/`ru`) with English default and persistence in preferences.
- Added a header quick-toggle globe button (`🌐 EN` / `🌐 RU`) to switch language instantly.
- Localized tab labels for EN/RU and wired live relabeling when language changes.
- Added Settings dropdown for language selection and wired binder callback flow to apply/re-render immediately.
- Updated locale-token translation resolution to prefer selected language and avoid Russian strings when English is selected.
- Rebuilt userscript to `0.9.220`, republished installer payload, and launched installer executable.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/src/modules/binders/settingsDisplayTrackingBinder.js
- userscript/package.json
- userscript/dist/organized-jihad.user.js
- installer-ui/bundle-payload/organized-jihad.user.js
- ~docs/copilot-chats/2026-06-02-userscript-build-auto.md
- ~docs/copilot-chats/2026-06-02-connection-status-and-nav-icons.md

## Validation
- get_errors userscript/src/modules/uiManager.js (no errors)
- get_errors userscript/src/modules/binders/settingsDisplayTrackingBinder.js (no errors)
- yarn test --runInBand (37/37 suites, 843/843 tests passed)
- yarn build (version 0.9.220)
- pwsh -ExecutionPolicy Bypass -File ./Publish-InstallerUI.ps1

---

## Session
- Date: 2026-06-02
- Session Number: 8
- Scope: Userscript connection-status false negative + duplicate nav regression + API transport hardening

## Summary
- Removed accidental duplicate tab button rows introduced in overlay template and restored the original single header + single nav structure.
- Added Tampermonkey fallback probe path in Connection diagnostics when page-context `fetch` is blocked.
- Added Tampermonkey fallback transport in `SyncClient` so health checks and sync imports can still run under browser-origin restrictions.
- Added userscript metadata directives for TM transport (`GM_xmlhttpRequest`, `@connect localhost`, `@connect 127.0.0.1`).
- Rebuilt userscript and republished installer with bundle version `0.9.218`, then launched installer.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/src/modules/syncClient.js
- userscript/src/index.js
- userscript/webpack.config.cjs
- userscript/package.json
- userscript/dist/organized-jihad.user.js
- installer-ui/bundle-payload/organized-jihad.user.js
- ~docs/copilot-chats/2026-06-02-userscript-build-auto.md
- ~docs/copilot-chats/2026-06-02-connection-status-and-nav-icons.md

## Validation
- get_errors userscript/src/modules/uiManager.js (no errors)
- get_errors userscript/src/modules/syncClient.js (no errors)
- yarn test --runInBand (37/37 suites, 843/843 tests passed)
- yarn build (version 0.9.218)
- pwsh -ExecutionPolicy Bypass -File ./Publish-InstallerUI.ps1

---

## Session
- Date: 2026-06-02
- Session Number: 9
- Scope: Inventory tab item-name resolution research + runtime name catalog integration

## Summary
- Confirmed `inventoryGet` API returns category maps of `itemId -> quantity` and does not include direct display names.
- Implemented inventory name resolution that merges multiple sources:
	- persisted `itemNameCatalog` metadata
	- captured metadata blobs (`gameSettings`, `billingCatalog`)
	- runtime game client libs (`unsafeWindow/window` via `lib` and `nxg.*.lib`)
- Added locale-token resolution attempts through runtime translators (`nxg.i18n.*`, `i18n.t`, `gettext`) with readable fallback formatting.
- Expanded inventory category mapping coverage for additional inventory sections (`fragmentGear`, `fragmentScroll`, `ascensionGear`, `fragmentTitanArtifact`, `bannerStone`, `petGear`, `fragmentArtifact`).
- Persisted newly discovered item names back into `itemNameCatalog` metadata for progressive enrichment over future sessions.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/package.json
- userscript/dist/organized-jihad.user.js
- ~docs/copilot-chats/2026-06-02-userscript-build-auto.md
- ~docs/copilot-chats/2026-06-02-connection-status-and-nav-icons.md

## Validation
- get_errors userscript/src/modules/uiManager.js (no errors)
- yarn test --runInBand (37/37 suites, 843/843 tests passed)
- yarn build (version 0.9.219)

## GitHub Issues
- Referenced: not specified in-session
- Closed: none in-session

## Key Decisions
- Treat recent successful sync metadata as a valid fallback signal for dashboard API status to avoid misleading offline state.
- Keep endpoint probe diagnostics, but classify status with degraded/warn semantics rather than hard-down where possible.
- Keep installer-based update flow as the canonical update path.

## Follow-Up
- Verify Connection tab icon/badge transitions across real runtime states in browser session (healthy, degraded, unreachable).
- If desired, split userscript changes into final logical commits after user acceptance.

---

## Session
- Date: 2026-06-02
- Session Number: 5
- Scope: Installer userscript step regression fix (three browser tabs opening)

## Summary
- Fixed installer UI argument wiring so userscript-only install no longer triggers CLI diagnostics link opening.
- Restored expected userscript install behavior (single install target flow) instead of opening three unrelated tabs.
- Rebuilt and republished installer artifacts, then relaunched installer executable.

## Files Modified
- installer-ui/MainWindow.axaml.cs

## Validation
- get_errors installer-ui/MainWindow.axaml.cs (no errors)
- dotnet build installer-ui/OrganizedJihad.Installer.csproj -c Release
- pwsh -ExecutionPolicy Bypass -File ./Publish-InstallerUI.ps1

## Key Decisions
- Diagnostics flags (`--first-run-diagnostics`, `--open-userscript-diagnostics`) are now gated to API-install workflows only.
- Userscript installation path remains controlled by the installer UI Tampermonkey import flow to avoid duplicate or unrelated browser launches.

---

## Session
- Date: 2026-06-02
- Session Number: 6
- Scope: Push + PR update + API /ui vertical stack layout change

## Summary
- Pushed previously committed userscript and installer hotfix commits to `feature/204-architecture-modernization`.
- Posted a concise status update comment on PR #209 summarizing the delivered fixes.
- Updated API `/ui` page template layout to stack sections vertically (single column) instead of multi-column grid.

## Files Modified
- api/Resources/UiTemplates/api-control.html
- ~docs/copilot-chats/2026-06-02-connection-status-and-nav-icons.md

## Validation
- dotnet build api/OrganizedJihad.Api.csproj -c Release
- git push

## Commits
- `a4bfc88` Fix #204: stack API /ui sections vertically

---

## Session
- Date: 2026-06-02
- Session Number: 7
- Scope: Userscript connection tab false-down mitigation + nav icon visibility + installer republish

## Summary
- Added stronger fallback logic for Connection tab API health so it no longer hard-reports down when direct probing fails but recent sync metadata confirms reachability.
- Kept separate Connection actions with explicit `Save URL` and `Test` buttons.
- Ensured tab icons are visible immediately from initial nav markup and kept dynamic connection icon state updates.
- Rebuilt userscript package (`0.9.216`), republished installer payload, and launched installer executable.

## Files Modified
- userscript/src/modules/uiManager.js
- userscript/package.json
- userscript/dist/organized-jihad.user.js
- installer-ui/bundle-payload/organized-jihad.user.js
- ~docs/copilot-chats/2026-06-02-userscript-build-auto.md
- ~docs/copilot-chats/2026-06-02-connection-status-and-nav-icons.md

## Validation
- get_errors userscript/src/modules/uiManager.js (no errors)
- yarn test --runInBand
- yarn build
- pwsh -ExecutionPolicy Bypass -File ./Publish-InstallerUI.ps1
