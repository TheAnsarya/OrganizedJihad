Completed automated daily report background slice.

Delivered:
- Added daily report automation options (`DailyReportAutomation`) for enable/interval/retention/startup run.
- Added `ApiUiDailyReportService` shared by endpoints and scheduler (build, latest, generate+persist, history load, CSV export).
- Added hosted background scheduler `ApiUiDailyReportAutomationHostedService` for periodic generation and retention pruning.
- Added endpoint `GET /ui/daily-report/history?limit=30` and linked it from API UI.
- Refactored existing daily-report endpoints to use shared service.

Validation:
- runTests (SyncControllerTests targeted set): pass
- dotnet build api/OrganizedJihad.Api.csproj -c Release: success
