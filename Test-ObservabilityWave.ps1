param(
	[string]$Configuration = 'Debug'
)

$ErrorActionPreference = 'Stop';

Write-Host '[Observability Wave] Running API SyncController test slice...' -ForegroundColor Cyan;
dotnet test tests/OrganizedJihad.Api.Tests/OrganizedJihad.Api.Tests.csproj --configuration $Configuration --filter "FullyQualifiedName~SyncControllerTests";

Write-Host '[Observability Wave] Running userscript recommendation/connection slices...' -ForegroundColor Cyan;
Push-Location userscript;
try {
	yarn test gameSurfaceGuard.test.js uiManagerConnectionView.test.js battleRecommendationOverlay.test.js uiManagerTeamRecommendationOperationsSummary.test.js;
} finally {
	Pop-Location;
}

Write-Host '[Observability Wave] Validation completed.' -ForegroundColor Green;
