param(
	[string]$ApiProjectPath = '.\api\OrganizedJihad.Api.csproj',
	[string]$FirstRunUrl = 'http://localhost:5334',
	[string]$SecondRunUrl = 'http://localhost:5335',
	[int]$StartupTimeoutSeconds = 60
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
	param([string]$Message)
	Write-Host "[OJ Migration] $Message" -ForegroundColor Cyan
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
		Start-Sleep -Milliseconds 900
	}

	return $false
}

function Invoke-ApiCycle {
	param(
		[string]$ProjectPath,
		[string]$BaseUrl,
		[int]$TimeoutSeconds
	)

	$proc = $null
	try {
		$proc = Start-Process -FilePath 'dotnet' -ArgumentList @('run', '--project', $ProjectPath, '--', '--urls', $BaseUrl) -WindowStyle Hidden -PassThru
		if (-not (Wait-Healthy -BaseUrl $BaseUrl -TimeoutSeconds $TimeoutSeconds)) {
			throw "API did not become healthy for migration cycle at $BaseUrl within ${TimeoutSeconds}s."
		}
		Write-Step "API started and migrated successfully at $BaseUrl"
	} finally {
		if ($proc -and -not $proc.HasExited) {
			Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
			Wait-Process -Id $proc.Id -Timeout 8 -ErrorAction SilentlyContinue
		}
	}
}

$resolvedProject = Resolve-Path -Path $ApiProjectPath -ErrorAction Stop
$tempRoot = Join-Path $env:TEMP "oj-migration-$([Guid]::NewGuid().ToString('N'))"
$dbPath = Join-Path $tempRoot 'migration-herowars.db'
$previousDbOverride = $env:OJ_DB_PATH
New-Item -Path $tempRoot -ItemType Directory -Force | Out-Null

try {
	$env:OJ_DB_PATH = $dbPath
	Write-Step "Using migration test DB: $dbPath"

	Invoke-ApiCycle -ProjectPath $resolvedProject -BaseUrl $FirstRunUrl -TimeoutSeconds $StartupTimeoutSeconds
	Invoke-ApiCycle -ProjectPath $resolvedProject -BaseUrl $SecondRunUrl -TimeoutSeconds $StartupTimeoutSeconds

	if (-not (Test-Path -Path $dbPath)) {
		throw 'Migration test database was not created.'
	}

	$dbFile = Get-Item -Path $dbPath
	if ($dbFile.Length -le 0) {
		throw 'Migration test database file is empty.'
	}

	Write-Step 'Migration path check passed (cold start + repeat start with existing DB).'
} finally {
	$env:OJ_DB_PATH = $previousDbOverride
	if (Test-Path -Path $tempRoot) {
		Remove-Item -Path $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
	}
}
