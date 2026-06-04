# Tampermonkey Installation Automation Notes

Date: 2026-05-31
Project: OrganizedJihad installer

## What can be automated

1. Detect supported browser and detect Tampermonkey extension presence.
2. Install/copy the userscript file to local install path.
3. Open Tampermonkey utilities/options page for import workflow.
4. Open a hosted `.user.js` URL (`/ui/organized-jihad.user.js`) that Tampermonkey can recognize as an installable script source.

## What cannot be fully automated (by design)

1. Final script install confirmation requires a user action in browser/Tampermonkey UI.
2. Browser-level extension permissions (for userscript execution) can require explicit user consent.
3. Extensions isolate privileged pages; external installers cannot silently click Tampermonkey "Install" buttons.

This is a browser security boundary, not an installer limitation.

## Recommended installer flow (implemented)

1. Ensure Tampermonkey is installed for selected browser.
2. Open Tampermonkey utilities/options page.
3. Open API-hosted userscript URL:
   - `http://localhost:5124/ui/organized-jihad.user.js`
4. User confirms install in Tampermonkey prompt tab.
5. If auto-open fails, fallback to manual import from:
   - `%LocalAppData%\\OrganizedJihad\\userscript\\organized-jihad.user.js`

## Manual fallback steps

1. Open Tampermonkey dashboard.
2. Go to Utilities/Import.
3. Import `organized-jihad.user.js` from install folder.
4. Ensure script is Enabled.
5. Refresh Hero Wars tab.

## Notes

- The installer should never claim fully silent userscript install.
- The installer should describe the expected permission/install prompt clearly to reduce confusion.

## Installer UI behavior clarification (2026-06-04)

The installer now separates two concepts in the UI:

1. Install Run Options
- These are toggle options that affect what happens when you run Step 2, Step 3, or Run Full Install.
- Toggling them does not immediately open pages or run checks by itself.

2. Quick Actions (run now)
- These buttons execute immediately without running full install:
   - Open Tampermonkey Setup Now
   - Run API Diagnostics Probe
   - Open Diagnostics Pages

If users expect immediate behavior, use the Quick Actions buttons. If users want behavior applied during install execution, use the Install Run Options toggles.
