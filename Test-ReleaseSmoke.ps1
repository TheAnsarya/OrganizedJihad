param(
	[string]$ApiExecutablePath = '.\api\bin\Release\net10.0\win-x64\publish\OrganizedJihad.Api.exe',
	[string]$ApiUrl = 'http://localhost:5234',
	[int]$StartupTimeoutSeconds = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
	param([string]$Message)
	Write-Host "[OJ Smoke] $Message" -ForegroundColor Cyan
}

function Wait-Healthy {
	param(
		[string]$BaseUrl,
		[int]$TimeoutSeconds
	)

	$healthUrl = "$BaseUrl/api/sync/health"
	$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
	while ((Get-Date) -lt $deadline) {
		try {
			$response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
			if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
				return $true
			}
		} catch {
			# Keep waiting.
		}
		Start-Sleep -Milliseconds 750
	}

	return $false
}

$resolvedApiExe = Resolve-Path -Path $ApiExecutablePath -ErrorAction Stop
$workingDirectory = Split-Path -Parent $resolvedApiExe
$tempRoot = Join-Path $env:TEMP "oj-smoke-$([Guid]::NewGuid().ToString('N'))"
$dbPath = Join-Path $tempRoot 'smoke-herowars.db'
$previousDbOverride = $env:OJ_DB_PATH
New-Item -Path $tempRoot -ItemType Directory -Force | Out-Null

$process = $null
try {
	$env:OJ_DB_PATH = $dbPath
	Write-Step "Starting published API binary at: $resolvedApiExe"
	$process = Start-Process -FilePath $resolvedApiExe -ArgumentList "--urls $ApiUrl" -WorkingDirectory $workingDirectory -WindowStyle Hidden -PassThru
	$process | Out-Null

	if (-not (Wait-Healthy -BaseUrl $ApiUrl -TimeoutSeconds $StartupTimeoutSeconds)) {
		throw "API did not become healthy within ${StartupTimeoutSeconds}s."
	}

	Write-Step 'Health endpoint is online.'

	$probeEndpoints = @(
		"$ApiUrl/api/sync/health",
		"$ApiUrl/ui/settings",
		"$ApiUrl/ui/repair-status",
		"$ApiUrl/ui/userscript-handshake"
	)

	foreach ($endpoint in $probeEndpoints) {
		$response = Invoke-WebRequest -Uri $endpoint -UseBasicParsing -TimeoutSec 8
		if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
			throw "Smoke probe failed for $endpoint (HTTP $($response.StatusCode))."
		}
		Write-Step "Probe passed: $endpoint"
	}

	Write-Step 'Release smoke test passed.'
} finally {
	if ($process -and -not $process.HasExited) {
		Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
		Wait-Process -Id $process.Id -Timeout 5 -ErrorAction SilentlyContinue
	}

	if (Test-Path -Path $tempRoot) {
		Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
	}

	$env:OJ_DB_PATH = $previousDbOverride
}
