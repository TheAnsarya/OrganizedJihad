param(
	[string]$BaseUrl = 'http://localhost:5124'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
	param([string]$Message)
	Write-Host "[OJ OpenAPI Smoke] $Message" -ForegroundColor Cyan
}

function Assert-True {
	param(
		[bool]$Condition,
		[string]$Message
	)

	if (-not $Condition) {
		throw $Message
	}
}

function Get-OpenApiDocument {
	param(
		[string]$ResolvedBaseUrl
	)

	$candidateUrls = @(
		"$ResolvedBaseUrl/swagger/v1/swagger.json",
		"$ResolvedBaseUrl/openapi/v1.json"
	)

	foreach ($candidateUrl in $candidateUrls) {
		try {
			$document = Invoke-RestMethod -Uri $candidateUrl -Method Get -TimeoutSec 15
			return @{
				Url = $candidateUrl
				Document = $document
			}
		} catch {
			# Try next known OpenAPI route shape.
		}
	}

	throw "Unable to fetch OpenAPI JSON from known routes: $($candidateUrls -join ', ')"
}

Write-Step "Checking API health at $BaseUrl/api/sync/health"
$healthResponse = Invoke-WebRequest -Uri "$BaseUrl/api/sync/health" -UseBasicParsing -TimeoutSec 10
Assert-True -Condition ($healthResponse.StatusCode -ge 200 -and $healthResponse.StatusCode -lt 300) -Message 'Health endpoint did not return success.'

$openApiResult = Get-OpenApiDocument -ResolvedBaseUrl $BaseUrl
$openApiUrl = [string]$openApiResult.Url
$openApi = $openApiResult.Document
Write-Step "Fetched OpenAPI document: $openApiUrl"

$requiredPaths = @(
	'/api/sync/import',
	'/api/sync/battles/recommendations',
	'/api/sync/teams/recommendations',
	'/api/sync/teams/recommendations/arena/simulate',
	'/api/sync/teams/recommendations/profiles',
	'/api/sync/teams/recommendations/preferences',
	'/api/sync/teams/recommendations/backtest',
	'/api/sync/teams/recommendations/calibration',
	'/api/sync/teams/recommendations/operations-summary'
)

$pathsObject = $openApi.paths
Assert-True -Condition ($null -ne $pathsObject) -Message 'OpenAPI document has no paths section.'
$pathKeys = @($pathsObject.PSObject.Properties.Name)

foreach ($requiredPath in $requiredPaths) {
	Assert-True -Condition ($pathKeys -contains $requiredPath) -Message "Missing required OpenAPI route: $requiredPath"
}

Write-Step 'Recommendation and import routes are present in OpenAPI.'

$browserSyncProperties = $openApi.components.schemas.BrowserSyncData.properties
Assert-True -Condition ($null -ne $browserSyncProperties) -Message 'BrowserSyncData schema/properties not found in OpenAPI components.'
$browserSyncPropertyKeys = @($browserSyncProperties.PSObject.Properties.Name)

$requiredBrowserSyncProperties = @(
	'arenaBattles',
	'heroes',
	'titans',
	'currentInventory',
	'inventoryItemUsages',
	'equipmentChanges',
	'mailMessages',
	'mailRewards',
	'airshipGifts'
)

foreach ($requiredProperty in $requiredBrowserSyncProperties) {
	Assert-True -Condition ($browserSyncPropertyKeys -contains $requiredProperty) -Message "Missing BrowserSyncData property in OpenAPI: $requiredProperty"
}

Write-Step 'BrowserSyncData schema includes required sync properties.'

Write-Step "Checking Scalar docs at $BaseUrl/docs"
$docsResponse = Invoke-WebRequest -Uri "$BaseUrl/docs" -UseBasicParsing -TimeoutSec 10
Assert-True -Condition ($docsResponse.StatusCode -ge 200 -and $docsResponse.StatusCode -lt 300) -Message 'Scalar docs route did not return success.'
Assert-True -Condition ($docsResponse.Content -match 'scalar.aspnetcore.js') -Message 'Scalar docs payload did not include expected runtime script.'

Write-Step 'OpenAPI/Scalar smoke check passed.'
