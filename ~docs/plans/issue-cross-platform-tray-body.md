Epic: #373

## Summary
Implement Linux/macOS tray icon support in OrganizedJihad.Api.TrayHost so non-Windows runtimes get an actual tray/menu UX while preserving API supervision.

## Tasks
- Add non-Windows tray runtime with menu actions (open UI/health/swagger/logs, restart API, stop+exit).
- Keep existing Windows tray behavior unchanged.
- Ensure non-Windows fallback remains robust when tray infrastructure is unavailable.
- Update docs with support and caveats.

## Acceptance Criteria
- net10.0 non-Windows target starts with tray icon where supported.
- API supervision/health checks continue to function.
- Build passes for tray host project and release CLI runtime publish.
