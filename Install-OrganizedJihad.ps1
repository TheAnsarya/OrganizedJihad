param(
	[string]$InstallRoot = "$env:LOCALAPPDATA\OrganizedJihad",
	[string]$ApiUrl = 'http://localhost:5124',
	[switch]$SkipApiInstall,
	[switch]$SkipDesktopAppInstall,
	[switch]$SkipUserscriptInstall,
	[switch]$SkipTampermonkeyBootstrap,
	[switch]$SkipYarnInstall,
	[switch]$AllowNonAdmin,
	[switch]$ElevationAttempted,
	[switch]$FirstRunDiagnostics,
	[switch]$RunInstallHealthCheck,
	[switch]$InstallHealthCheckJson,
	[switch]$OpenUserscriptDiagnostics,
	[ValidateSet('chrome', 'edge', 'firefox', 'operaGX')]
	[string[]]$TampermonkeyBrowsers = @('chrome', 'edge', 'firefox', 'operaGX'),
	[ValidateSet('none', 'failed', 'required', 'all')]
	[string]$InstallHealthCheckOpen = 'none'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
	param([string]$Message)
	Write-Host "[OJ Installer] $Message" -ForegroundColor Cyan
}

function Assert-Command {
	param(
		[string]$Name,
		[string]$HelpText
	)
	if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) {
		throw "Missing required command '$Name'. $HelpText"
	}
}

function Ensure-Directory {
	param([string]$Path)
	if (-not (Test-Path -Path $Path)) {
		New-Item -Path $Path -ItemType Directory -Force | Out-Null
	}
}

function Test-IsAdministrator {
	$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
	$principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
	return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Convert-BoundParametersToArgumentList {
	param(
		[hashtable]$BoundParameters,
		[string[]]$SkipKeys = @()
	)

	$arguments = @()
	foreach ($entry in $BoundParameters.GetEnumerator()) {
		if ($SkipKeys -contains $entry.Key) {
			continue
		}

		$key = "-$($entry.Key)"
		$value = $entry.Value

		if ($value -is [System.Management.Automation.SwitchParameter]) {
			if ($value.IsPresent) {
				$arguments += $key
			}
			continue
		}

		if ($null -eq $value) {
			continue
		}

		if ($value -is [Array]) {
			if ($value.Count -gt 0) {
				$arguments += $key
				foreach ($item in $value) {
					$arguments += [string]$item
				}
			}
			continue
		}

		$arguments += $key
		$arguments += [string]$value
	}

	return $arguments
}

function Resolve-PowerShellForElevation {
	if (Get-Command -Name 'pwsh' -ErrorAction SilentlyContinue) {
		return (Get-Command -Name 'pwsh').Source
	}

	if (Get-Command -Name 'powershell' -ErrorAction SilentlyContinue) {
		return (Get-Command -Name 'powershell').Source
	}

	return $null
}

function Ensure-InstallerElevation {
	param(
		[hashtable]$BoundParameters,
		[string]$ScriptPath
	)

	if ($AllowNonAdmin) {
		Write-Step 'Non-admin mode explicitly requested via -AllowNonAdmin. Some startup task capabilities may be limited.'
		return
	}

	if (Test-IsAdministrator) {
		Write-Step 'Installer is running with administrator privileges.'
		return
	}

	if ($ElevationAttempted) {
		throw 'Installer requires administrator privileges for full installation, but elevation did not complete.'
	}

	Write-Host ''
	Write-Host '[OJ Installer] Please give us admin privileges so we can install fully.' -ForegroundColor Yellow
	Write-Host '[OJ Installer] A Windows UAC prompt will open now.' -ForegroundColor Yellow

	$psExecutable = Resolve-PowerShellForElevation
	if (-not $psExecutable) {
		throw 'Could not find pwsh or powershell to request elevation.'
	}

	$elevatedArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ScriptPath)
	$elevatedArgs += Convert-BoundParametersToArgumentList -BoundParameters $BoundParameters -SkipKeys @('ElevationAttempted')
	$elevatedArgs += '-ElevationAttempted'

	try {
		$proc = Start-Process -FilePath $psExecutable -ArgumentList $elevatedArgs -Verb RunAs -Wait -PassThru
		exit $proc.ExitCode
	} catch {
		throw 'Administrator privileges were not granted. Re-run and accept the UAC prompt to install fully.'
	}
}

function Ensure-AutostartTask {
	param(
		[string]$TaskName,
		[string]$ExecutablePath,
		[string]$ApiUrlValue,
		[string]$WorkingDirectory
	)

	$action = New-ScheduledTaskAction -Execute $ExecutablePath -Argument "--urls $ApiUrlValue" -WorkingDirectory $WorkingDirectory
	$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
	$elevated = Test-IsAdministrator

	if ($elevated) {
		$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
		$triggers = @(
			(New-ScheduledTaskTrigger -AtStartup),
			(New-ScheduledTaskTrigger -AtLogOn)
		)

		Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Force | Out-Null
		Write-Step "Registered startup task '$TaskName' (system startup + logon, running as SYSTEM)."
	} else {
		$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
		$trigger = New-ScheduledTaskTrigger -AtLogOn

		try {
			Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
			Write-Step "Registered startup task '$TaskName' (logon fallback; run installer as Administrator for system startup registration)."
		} catch {
			Write-Step "Could not register startup task without elevation ($($_.Exception.Message)). API binaries were installed; run installer as Administrator to configure autostart."
			try {
				Start-Process -FilePath $ExecutablePath -ArgumentList "--urls $ApiUrlValue" -WorkingDirectory $WorkingDirectory | Out-Null
				Write-Step 'Started API process directly for this session (no autostart task configured).'
			} catch {
				Write-Step 'Could not start API process directly. Start it manually from the installed api folder.'
			}
			return
		}
	}

	try {
		Start-ScheduledTask -TaskName $TaskName
		Write-Step "Started '$TaskName' immediately."
	} catch {
		Write-Step "Could not start '$TaskName' immediately. It will run at next logon."
		try {
			Start-Process -FilePath $ExecutablePath -ArgumentList "--urls $ApiUrlValue" -WorkingDirectory $WorkingDirectory | Out-Null
			Write-Step 'Started API process directly for this session.'
		} catch {
			Write-Step 'Could not start API process directly. Start it manually from the installed api folder.'
		}
	}
}

function Copy-BuildArtifacts {
	param(
		[string]$Source,
		[string]$Destination
	)
	Ensure-Directory -Path $Destination
	Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force
}

function Stop-InstalledApiProcess {
	param([string]$ExecutablePath)

	try {
		$running = Get-Process -Name 'OrganizedJihad.Api' -ErrorAction SilentlyContinue
		if (-not $running) {
			return
		}

		foreach ($proc in $running) {
			$matchesPath = $false
			try {
				$matchesPath = ($proc.Path -eq $ExecutablePath)
			} catch {
				# Ignore path-read failures and fall back to process name only.
				$matchesPath = $true
			}

			if ($matchesPath) {
				Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
			}
		}

		Write-Step 'Stopped running installed API process to refresh binaries.'
	} catch {
		Write-Step 'Could not stop existing API process automatically. If install copy fails, close OrganizedJihad.Api.exe and retry.'
	}
}

function Get-OperaGxExecutable {
	$candidates = @(
		(Join-Path $env:LOCALAPPDATA 'Programs\Opera GX\launcher.exe'),
		(Join-Path ${env:ProgramFiles} 'Opera GX\launcher.exe'),
		(Join-Path ${env:ProgramFiles(x86)} 'Opera GX\launcher.exe')
	)

	foreach ($candidate in $candidates) {
		if ($candidate -and (Test-Path -Path $candidate)) {
			return $candidate
		}
	}

	return $null
}

function Open-TampermonkeyBootstrap {
	param(
		[string[]]$Browsers,
		[string]$UserscriptPath
	)

	$browserLinks = @{
		chrome = 'https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo'
		edge = 'https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd'
		firefox = 'https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/'
		operaGX = 'https://addons.opera.com/en/extensions/details/tampermonkey-beta/'
	}

	foreach ($browser in $Browsers) {
		if (-not $browserLinks.ContainsKey($browser)) {
			continue
		}

		if ($browser -eq 'operaGX') {
			$operaExe = Get-OperaGxExecutable
			if ($operaExe) {
				Start-Process -FilePath $operaExe -ArgumentList $browserLinks[$browser] | Out-Null
				Write-Step 'Opened Opera GX Tampermonkey setup page.'
				continue
			}

			Write-Step 'Opera GX executable not found. Opening Opera-compatible Tampermonkey links in default browser.'
		}

		Start-Process $browserLinks[$browser] | Out-Null
	}

	if (Test-Path -Path $UserscriptPath) {
		Write-Step "Userscript file is ready for manual Tampermonkey import: $UserscriptPath"
	}
}

function Wait-ApiHealth {
	param(
		[string]$ApiUrlValue,
		[int]$TimeoutSeconds = 30
	)

	$healthUrl = "$ApiUrlValue/api/sync/health"
	$deadline = (Get-Date).AddSeconds($TimeoutSeconds)

	while ((Get-Date) -lt $deadline) {
		try {
			$response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 5
			if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
				Write-Step "API health endpoint is reachable: $healthUrl"
				return $true
			}
		} catch {
			# Keep retrying until timeout.
		}

		Start-Sleep -Seconds 1
	}

	Write-Step "API health endpoint did not become reachable within ${TimeoutSeconds}s: $healthUrl"
	return $false
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.csproj'
$desktopProject = Join-Path $repoRoot 'desktop-app\OrganizedJihad.Desktop.csproj'
$userscriptDir = Join-Path $repoRoot 'userscript'
$userscriptDist = Join-Path $userscriptDir 'dist'
$userscriptFile = Join-Path $userscriptDist 'organized-jihad.user.js'
$bundledRoot = Join-Path $repoRoot 'bundled'
$bundledApiPublishDir = Join-Path $bundledRoot 'api'
$bundledDesktopPublishDir = Join-Path $bundledRoot 'desktop-app'
$bundledUserscriptFile = Join-Path $repoRoot 'organized-jihad.user.js'
$bundledHealthCheckScript = Join-Path $repoRoot 'install-health-check.mjs'
$publishDir = Join-Path $repoRoot 'api\bin\Release\net10.0\win-x64\publish'
$desktopPublishCandidates = @(
	(Join-Path $repoRoot 'desktop-app\bin\Release\net10.0-windows10.0.19041.0\win-x64\publish'),
	(Join-Path $repoRoot 'desktop-app\bin\Release\net10.0-windows10.0.19041.0\publish')
)

$apiInstallDir = Join-Path $InstallRoot 'api'
$desktopInstallDir = Join-Path $InstallRoot 'desktop-app'
$userscriptInstallDir = Join-Path $InstallRoot 'userscript'
$apiExecutablePath = Join-Path $apiInstallDir 'OrganizedJihad.Api.exe'
$desktopExecutablePath = Join-Path $desktopInstallDir 'OrganizedJihad.Desktop.exe'
$taskName = 'OrganizedJihad.Api.Autostart'

$effectiveRunInstallHealthCheck = $RunInstallHealthCheck
$effectiveOpenUserscriptDiagnostics = $OpenUserscriptDiagnostics
$effectiveInstallHealthCheckOpen = $InstallHealthCheckOpen
$desktopPublishDir = $null
$apiPublishDir = $null
$userscriptArtifactPath = $null
$isBundledPayloadMode = (Test-Path -Path $bundledApiPublishDir) -or (Test-Path -Path $bundledUserscriptFile)

if ($SkipApiInstall -and $SkipDesktopAppInstall -and $SkipUserscriptInstall) {
	throw 'At least one install component must be enabled. Remove one of: -SkipApiInstall, -SkipDesktopAppInstall, -SkipUserscriptInstall.'
}

Ensure-InstallerElevation -BoundParameters $PSBoundParameters -ScriptPath $PSCommandPath

if ($FirstRunDiagnostics) {
	$effectiveRunInstallHealthCheck = $true
	$effectiveOpenUserscriptDiagnostics = $true

	# Respect explicit -InstallHealthCheckOpen value when provided.
	if (-not $PSBoundParameters.ContainsKey('InstallHealthCheckOpen')) {
		$effectiveInstallHealthCheckOpen = 'failed'
	}
}

if ($SkipApiInstall) {
	$effectiveRunInstallHealthCheck = $false
	$effectiveOpenUserscriptDiagnostics = $false
}

Write-Step "Validating prerequisites"
if ((Test-Path -Path $userscriptDir) -and (Test-Path -Path $apiProject)) {
	if ((-not $SkipApiInstall) -or (-not $SkipDesktopAppInstall)) {
		Assert-Command -Name 'dotnet' -HelpText 'Install .NET SDK 10 preview or later.'
	}

	if (-not $SkipUserscriptInstall) {
		Assert-Command -Name 'node' -HelpText 'Install Node.js 18+.'
		Assert-Command -Name 'yarn' -HelpText 'Install Yarn (classic) and Node.js 18+.'
	}

	if (-not $SkipUserscriptInstall) {
		Write-Step 'Building userscript bundle from source repository.'
		Push-Location $userscriptDir
		try {
			if (-not $SkipYarnInstall) {
				yarn install --frozen-lockfile
			}
			yarn build
		} finally {
			Pop-Location
		}

		if (-not (Test-Path -Path $userscriptFile)) {
			throw "Userscript bundle not found at '$userscriptFile'."
		}
		$userscriptArtifactPath = $userscriptFile
	}

	if (-not $SkipApiInstall) {
		Write-Step 'Publishing API backend from source repository.'
		dotnet publish $apiProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true

		if (-not (Test-Path -Path $publishDir)) {
			throw "API publish output not found at '$publishDir'."
		}
		$apiPublishDir = $publishDir
	}

	if (-not $SkipDesktopAppInstall) {
		Write-Step 'Publishing desktop app (Windows) from source repository.'
		dotnet publish $desktopProject -f net10.0-windows10.0.19041.0 -c Release -p:WindowsPackageType=None

		foreach ($candidate in $desktopPublishCandidates) {
			if (Test-Path -Path $candidate) {
				$desktopPublishDir = $candidate
				break
			}
		}

		if ((-not $desktopPublishDir) -or (-not (Test-Path -Path $desktopPublishDir))) {
			throw "Desktop publish output not found at any expected path: $($desktopPublishCandidates -join '; ')."
		}
	}
} elseif ($isBundledPayloadMode) {
	Write-Step 'Source project structure not found. Using bundled release payloads.'

	if (-not $SkipApiInstall) {
		if (-not (Test-Path -Path $bundledApiPublishDir)) {
			throw "Bundled API payload not found at '$bundledApiPublishDir'."
		}
		$apiPublishDir = $bundledApiPublishDir
	}

	if (-not $SkipDesktopAppInstall) {
		if (-not (Test-Path -Path $bundledDesktopPublishDir)) {
			throw "Bundled desktop payload not found at '$bundledDesktopPublishDir'."
		}
		$desktopPublishDir = $bundledDesktopPublishDir
	}

	if (-not $SkipUserscriptInstall) {
		if (-not (Test-Path -Path $bundledUserscriptFile)) {
			throw "Bundled userscript artifact not found at '$bundledUserscriptFile'."
		}
		$userscriptArtifactPath = $bundledUserscriptFile
	}
} else {
	throw 'Could not locate either source project structure or bundled release payloads.'
}

Write-Step "Installing artifacts into '$InstallRoot'"
Ensure-Directory -Path $InstallRoot
if (-not $SkipApiInstall) {
	Stop-InstalledApiProcess -ExecutablePath $apiExecutablePath
	Copy-BuildArtifacts -Source $apiPublishDir -Destination $apiInstallDir
}

if (-not $SkipDesktopAppInstall) {
	Copy-BuildArtifacts -Source $desktopPublishDir -Destination $desktopInstallDir
}

if (-not $SkipUserscriptInstall) {
	Ensure-Directory -Path $userscriptInstallDir
	Copy-Item -Path $userscriptArtifactPath -Destination (Join-Path $userscriptInstallDir 'organized-jihad.user.js') -Force
}

if ((-not $SkipApiInstall) -and (-not (Test-Path -Path $apiExecutablePath))) {
	throw "Expected API executable missing at '$apiExecutablePath'."
}

if ((-not $SkipDesktopAppInstall) -and (-not (Test-Path -Path $desktopExecutablePath))) {
	throw "Expected desktop executable missing at '$desktopExecutablePath'."
}

if (-not $SkipApiInstall) {
	Write-Step "Configuring API startup"
	Ensure-AutostartTask -TaskName $taskName -ExecutablePath $apiExecutablePath -ApiUrlValue $ApiUrl -WorkingDirectory $apiInstallDir
}

if ((-not $SkipUserscriptInstall) -and (-not $SkipTampermonkeyBootstrap)) {
	Write-Step "Opening Tampermonkey bootstrap for: $($TampermonkeyBrowsers -join ', ')."
	$installedScript = Join-Path $userscriptInstallDir 'organized-jihad.user.js'
	Open-TampermonkeyBootstrap -Browsers $TampermonkeyBrowsers -UserscriptPath $installedScript
}

if ((-not $SkipApiInstall) -and $effectiveRunInstallHealthCheck) {
	Wait-ApiHealth -ApiUrlValue $ApiUrl -TimeoutSeconds 30 | Out-Null

	Write-Step 'Running userscript install health check.'
	$healthCheckScript = Join-Path $userscriptDir 'scripts\install-health-check.mjs'
	if ((-not (Test-Path -Path $healthCheckScript)) -and (Test-Path -Path $bundledHealthCheckScript)) {
		$healthCheckScript = $bundledHealthCheckScript
	}

	if (-not (Test-Path -Path $healthCheckScript)) {
		Write-Step 'Install health-check script is not included in this package. Skipping health check step.'
		$effectiveRunInstallHealthCheck = $false
	}

	if ($effectiveRunInstallHealthCheck) {
		Assert-Command -Name 'node' -HelpText 'Install Node.js 18+ for install health-check execution.'
		$healthCheckArgs = @($healthCheckScript, '--baseUrl', $ApiUrl)
		if ($InstallHealthCheckJson) {
			$healthCheckArgs += '--json'
		}
		if ($effectiveInstallHealthCheckOpen -ne 'none') {
			$healthCheckArgs += @('--open', $effectiveInstallHealthCheckOpen)
		}

		& node @healthCheckArgs
		if ($LASTEXITCODE -ne 0) {
			Write-Step "Health check reported issues (exit code $LASTEXITCODE). Review output above."
		} else {
			Write-Step 'Health check passed.'
		}
	}
}

if ((-not $SkipApiInstall) -and $effectiveOpenUserscriptDiagnostics) {
	Write-Step 'Opening userscript diagnostics entry points.'
	$apiHealthUrl = "$ApiUrl/api/sync/health"
	$apiDocsUrl = "$ApiUrl/api/sync"
	$heroWarsUrl = 'https://www.hero-wars.com/'

	Start-Process $heroWarsUrl | Out-Null
	Start-Process $apiHealthUrl | Out-Null
	Start-Process $apiDocsUrl | Out-Null

	Write-Step 'Opened Hero Wars + API health/docs URLs. In-game, press Ctrl+Shift+H to open overlay diagnostics panel.'
}

Write-Step 'Installation complete.'
Write-Host ""
Write-Host 'What was configured:' -ForegroundColor Green
if (-not $SkipApiInstall) {
	Write-Host "- API installed to: $apiInstallDir"
}
if (-not $SkipDesktopAppInstall) {
	Write-Host "- Desktop app installed to: $desktopInstallDir"
}
if (-not $SkipUserscriptInstall) {
	Write-Host "- Userscript installed to: $userscriptInstallDir"
	Write-Host "- Userscript import file: $(Join-Path $userscriptInstallDir 'organized-jihad.user.js')"
}
if (-not $SkipApiInstall) {
	Write-Host "- Startup task: $taskName"
	Write-Host "- API URL: $ApiUrl"
}
Write-Host ""
Write-Host 'Recommended next checks:' -ForegroundColor Green
if (-not $SkipUserscriptInstall) {
	Write-Host '- Open Tampermonkey dashboard and import organized-jihad.user.js if not already prompted'
	Write-Host '- Confirm Tampermonkey has the OrganizedJihad script enabled'
}
if (-not $SkipApiInstall) {
	Write-Host "- Verify API health at $ApiUrl/api/sync/health"
}
if (-not $SkipDesktopAppInstall) {
	Write-Host '- Launch OrganizedJihad.Desktop.exe and confirm data views load'
}
Write-Host '- Optional: rerun check with browser-open failures: yarn install:check --open failed'
Write-Host '- Optional: open diagnostics entry points automatically: -OpenUserscriptDiagnostics'
Write-Host '- Optional: run first-run diagnostics bundle: -FirstRunDiagnostics'
