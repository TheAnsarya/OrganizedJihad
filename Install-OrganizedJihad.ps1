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
	[ValidateSet('chrome', 'edge', 'firefox', 'opera', 'operaGX')]
	[string[]]$TampermonkeyBrowsers = @('edge'),
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

function Start-BackgroundProcess {
	param(
		[string]$ExecutablePath,
		[string]$ExecutableArguments,
		[string]$WorkingDirectory,
		[string]$DisplayName
	)

	try {
		$startInfo = @{
			FilePath = $ExecutablePath
			WorkingDirectory = $WorkingDirectory
		}

		if (-not [string]::IsNullOrWhiteSpace($ExecutableArguments)) {
			$startInfo['ArgumentList'] = $ExecutableArguments
		}

		Start-Process @startInfo -WindowStyle Hidden | Out-Null
		Write-Step "Started $DisplayName in background mode (no visible console window)."
		return $true
	} catch {
		Write-Step "Could not start $DisplayName in background mode ($($_.Exception.Message))."
		return $false
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

function Remove-ScheduledTaskIfExists {
	param([string]$TaskName)

	if (-not (Get-Command -Name 'Get-ScheduledTask' -ErrorAction SilentlyContinue)) {
		return
	}

	try {
		$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
		if ($existingTask) {
			Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
		}
	} catch {
		Write-Step "Could not remove existing scheduled task '$TaskName' ($($_.Exception.Message))."
	}
}

function Ensure-ApiAutostartTasks {
	param(
		[string]$ApiServiceTaskName,
		[string]$ApiTrayTaskName,
		[string]$ApiExecutablePath,
		[string]$ApiWorkingDirectory,
		[string]$ApiTrayExecutablePath,
		[string]$ApiTrayWorkingDirectory,
		[string]$ApiUrlValue,
		[bool]$UseTrayHost
	)

	$apiArguments = "--urls $ApiUrlValue"
	$trayArguments = "--api-executable `"$ApiExecutablePath`" --api-url `"$ApiUrlValue`" --working-directory `"$ApiWorkingDirectory`""
	$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
	$elevated = Test-IsAdministrator
	$interactiveUser = "$env:USERDOMAIN\$env:USERNAME"
	$serviceAction = New-ScheduledTaskAction -Execute $ApiExecutablePath -Argument $apiArguments -WorkingDirectory $ApiWorkingDirectory
	$trayAction = $null

	if ($UseTrayHost -and (Test-Path -Path $ApiTrayExecutablePath)) {
		$trayAction = New-ScheduledTaskAction -Execute $ApiTrayExecutablePath -Argument $trayArguments -WorkingDirectory $ApiTrayWorkingDirectory
	}

	if ($elevated) {
		$servicePrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
		$serviceTrigger = New-ScheduledTaskTrigger -AtStartup

		Register-ScheduledTask -TaskName $ApiServiceTaskName -Action $serviceAction -Trigger $serviceTrigger -Settings $settings -Principal $servicePrincipal -Force | Out-Null
		Write-Step "Registered API background task '$ApiServiceTaskName' (system startup, no console window)."

		if ($trayAction) {
			$trayPrincipal = New-ScheduledTaskPrincipal -UserId $interactiveUser -LogonType Interactive -RunLevel Highest
			$trayTrigger = New-ScheduledTaskTrigger -AtLogOn
			Register-ScheduledTask -TaskName $ApiTrayTaskName -Action $trayAction -Trigger $trayTrigger -Settings $settings -Principal $trayPrincipal -Force | Out-Null
			Write-Step "Registered tray task '$ApiTrayTaskName' (interactive logon notification icon mode)."
		} else {
			Remove-ScheduledTaskIfExists -TaskName $ApiTrayTaskName
		}

		try {
			Start-ScheduledTask -TaskName $ApiServiceTaskName
			Write-Step "Started '$ApiServiceTaskName' immediately."
		} catch {
			Write-Step "Could not start '$ApiServiceTaskName' immediately. It will run on next startup."
			Start-BackgroundProcess -ExecutablePath $ApiExecutablePath -ExecutableArguments $apiArguments -WorkingDirectory $ApiWorkingDirectory -DisplayName 'API backend' | Out-Null
		}

		if ($trayAction) {
			Start-BackgroundProcess -ExecutablePath $ApiTrayExecutablePath -ExecutableArguments $trayArguments -WorkingDirectory $ApiTrayWorkingDirectory -DisplayName 'API tray host' | Out-Null
		}

		return
	}

	# Non-admin fallback: logon-only interactive task, plus hidden process start now.
	$runLevel = 'Limited'

	if ($trayAction) {
		$trayPrincipal = New-ScheduledTaskPrincipal -UserId $interactiveUser -LogonType Interactive -RunLevel $runLevel
		$trayTrigger = New-ScheduledTaskTrigger -AtLogOn

		try {
			Register-ScheduledTask -TaskName $ApiTrayTaskName -Action $trayAction -Trigger $trayTrigger -Settings $settings -Principal $trayPrincipal -Force | Out-Null
			Write-Step "Registered tray task '$ApiTrayTaskName' (logon fallback without elevation)."
		} catch {
			Write-Step "Could not register tray task without elevation ($($_.Exception.Message))."
		}

		Start-BackgroundProcess -ExecutablePath $ApiTrayExecutablePath -ExecutableArguments $trayArguments -WorkingDirectory $ApiTrayWorkingDirectory -DisplayName 'API tray host' | Out-Null
	} else {
		$apiPrincipal = New-ScheduledTaskPrincipal -UserId $interactiveUser -LogonType Interactive -RunLevel $runLevel
		$apiTrigger = New-ScheduledTaskTrigger -AtLogOn

		try {
			Register-ScheduledTask -TaskName $ApiServiceTaskName -Action $serviceAction -Trigger $apiTrigger -Settings $settings -Principal $apiPrincipal -Force | Out-Null
			Write-Step "Registered API task '$ApiServiceTaskName' (logon fallback without elevation)."
		} catch {
			Write-Step "Could not register API logon task without elevation ($($_.Exception.Message))."
		}

		Start-BackgroundProcess -ExecutablePath $ApiExecutablePath -ExecutableArguments $apiArguments -WorkingDirectory $ApiWorkingDirectory -DisplayName 'API backend' | Out-Null
	}

	Write-Step 'Run installer as Administrator to enable system-start background API service mode.'
}

function Copy-BuildArtifacts {
	param(
		[string]$Source,
		[string]$Destination,
		[int]$MaxRetries = 8
	)

	Ensure-Directory -Path $Destination

	for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
		try {
			Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force -ErrorAction Stop
			return
		} catch {
			$canRetry = $attempt -lt $MaxRetries
			if (-not $canRetry) {
				throw
			}

			Write-Step "Copy attempt $attempt failed ($($_.Exception.Message)). Retrying..."
			Start-Sleep -Milliseconds 750
		}
	}
}

function Copy-BuildArtifactsExcludingFiles {
	param(
		[string]$Source,
		[string]$Destination,
		[string[]]$ExcludedFileNames
	)

	Ensure-Directory -Path $Destination
	$sourceRoot = (Resolve-Path -Path $Source).Path

	Get-ChildItem -Path $sourceRoot -Recurse -File | ForEach-Object {
		if ($ExcludedFileNames -contains $_.Name) {
			return
		}

		$relativePath = $_.FullName.Substring($sourceRoot.Length).TrimStart('\', '/')
		$targetPath = Join-Path $Destination $relativePath
		$targetDir = Split-Path -Parent $targetPath
		Ensure-Directory -Path $targetDir
		Copy-Item -Path $_.FullName -Destination $targetPath -Force
	}
}

function Stop-InstalledApiProcess {
	param([string]$ExecutablePath)

	try {
		$targetProcessName = [System.IO.Path]::GetFileNameWithoutExtension($ExecutablePath)
		$processNameCandidates = @('OrganizedJihad.Api')
		if (-not [string]::IsNullOrWhiteSpace($targetProcessName)) {
			$processNameCandidates += $targetProcessName
		}

		$running = Get-Process -Name $processNameCandidates -ErrorAction SilentlyContinue
		if (-not $running) {
			$running = @()
		}

		if (Get-Command -Name 'Get-CimInstance' -ErrorAction SilentlyContinue) {
			try {
				$runningByPath = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -eq $ExecutablePath }
				foreach ($proc in $runningByPath) {
					$processById = Get-Process -Id $proc.ProcessId -ErrorAction SilentlyContinue
					if ($processById) {
						$running += $processById
					}
				}
			} catch {
				# Ignore CIM access issues.
			}
		}

		$running = $running | Sort-Object -Property Id -Unique
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
				try {
					Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
					Wait-Process -Id $proc.Id -Timeout 5 -ErrorAction SilentlyContinue
				} catch {
					# Ignore timeout/process state issues and continue trying remaining matches.
				}
			}
		}

		Write-Step 'Stopped running installed API process to refresh binaries.'
	} catch {
		Write-Step 'Could not stop existing API process automatically. If install copy fails, close OrganizedJihad.Api.exe and retry.'
	}
}

function Stop-ProcessByExecutablePath {
	param(
		[string]$ExecutablePath,
		[string]$DisplayName
	)

	if (-not (Test-Path -Path $ExecutablePath)) {
		return
	}

	try {
		if (Get-Command -Name 'Get-CimInstance' -ErrorAction SilentlyContinue) {
			$matched = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ExecutablePath -eq $ExecutablePath }
			foreach ($proc in $matched) {
				Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
				Wait-Process -Id $proc.ProcessId -Timeout 5 -ErrorAction SilentlyContinue
			}
		}
		Write-Step "Stopped $DisplayName."
	} catch {
		Write-Step "Could not stop $DisplayName ($($_.Exception.Message))."
	}
}

function Suspend-AutostartTask {
	param([string]$TaskName)

	if (-not (Get-Command -Name 'Get-ScheduledTask' -ErrorAction SilentlyContinue)) {
		return $false
	}

	try {
		$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
		if (-not $task) {
			return $false
		}

		Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
		Disable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
		Write-Step "Temporarily suspended startup task '$TaskName' while refreshing API binaries."
		return $true
	} catch {
		Write-Step "Could not suspend startup task '$TaskName' ($($_.Exception.Message)). Continuing install."
		return $false
	}
}

function Resume-AutostartTask {
	param([string]$TaskName)

	if (-not (Get-Command -Name 'Enable-ScheduledTask' -ErrorAction SilentlyContinue)) {
		return
	}

	try {
		$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
		if ($task) {
			Enable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
			Write-Step "Re-enabled startup task '$TaskName'."
		}
	} catch {
		Write-Step "Could not re-enable startup task '$TaskName' ($($_.Exception.Message))."
	}
}

function Get-AutostartTaskStatus {
	param([string]$TaskName)

	if (-not (Get-Command -Name 'Get-ScheduledTask' -ErrorAction SilentlyContinue)) {
		return [PSCustomObject]@{
			TaskName = $TaskName
			Exists = $false
			Enabled = $false
			State = 'Unavailable'
			Note = 'Get-ScheduledTask command not available on this host.'
		}
	}

	try {
		$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
		if (-not $task) {
			return [PSCustomObject]@{
				TaskName = $TaskName
				Exists = $false
				Enabled = $false
				State = 'Missing'
				Note = 'Task is not registered.'
			}
		}

		return [PSCustomObject]@{
			TaskName = $TaskName
			Exists = $true
			Enabled = [bool]$task.Settings.Enabled
			State = [string]$task.State
			Note = 'Task is registered.'
		}
	} catch {
		return [PSCustomObject]@{
			TaskName = $TaskName
			Exists = $false
			Enabled = $false
			State = 'Unknown'
			Note = $_.Exception.Message
		}
	}
}

function Verify-ApiAutostartTasks {
	param(
		[string]$ApiServiceTaskName,
		[string]$ApiTrayTaskName,
		[bool]$ExpectTrayTask
	)

	$serviceStatus = Get-AutostartTaskStatus -TaskName $ApiServiceTaskName
	$trayStatus = Get-AutostartTaskStatus -TaskName $ApiTrayTaskName

	if ($serviceStatus.Exists) {
		Write-Step "Verified startup task '$ApiServiceTaskName' (Enabled=$($serviceStatus.Enabled), State=$($serviceStatus.State))."
	} else {
		Write-Step "Startup verification: '$ApiServiceTaskName' is not registered ($($serviceStatus.Note))."
	}

	if ($ExpectTrayTask) {
		if ($trayStatus.Exists) {
			Write-Step "Verified startup task '$ApiTrayTaskName' (Enabled=$($trayStatus.Enabled), State=$($trayStatus.State))."
		} else {
			Write-Step "Startup verification: '$ApiTrayTaskName' is not registered ($($trayStatus.Note))."
		}
	}

	return [PSCustomObject]@{
		Service = $serviceStatus
		Tray = $trayStatus
	}
}

function Wait-FileUnlocked {
	param(
		[string]$Path,
		[int]$TimeoutSeconds = 12
	)

	if (-not (Test-Path -Path $Path)) {
		return $true
	}

	$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
	while ((Get-Date) -lt $deadline) {
		try {
			$stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
			$stream.Close()
			$stream.Dispose()
			return $true
		} catch {
			Start-Sleep -Milliseconds 500
		}
	}

	return $false
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

function Get-OperaExecutable {
	$candidates = @(
		(Join-Path $env:LOCALAPPDATA 'Programs\Opera\launcher.exe'),
		(Join-Path ${env:ProgramFiles} 'Opera\launcher.exe'),
		(Join-Path ${env:ProgramFiles(x86)} 'Opera\launcher.exe')
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
		[string]$UserscriptPath,
		[string]$GuidePath
	)

	$browserLinks = @{
		chrome = 'https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo'
		edge = 'https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd'
		firefox = 'https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/'
		opera = 'https://addons.opera.com/en/extensions/details/tampermonkey-beta/'
		operaGX = 'https://addons.opera.com/en/extensions/details/tampermonkey-beta/'
	}

	$targetBrowser = if ($Browsers -and $Browsers.Count -gt 0) { $Browsers[0] } else { $null }
	if (-not $targetBrowser) {
		Write-Step 'No browser target was provided for Tampermonkey bootstrap. Skipping automatic browser launch.'
		return
	}

	if (-not $browserLinks.ContainsKey($targetBrowser)) {
		Write-Step "Unsupported browser target '$targetBrowser' for Tampermonkey bootstrap."
		return
	}

	if ($targetBrowser -eq 'operaGX') {
		$operaExe = Get-OperaGxExecutable
		if ($operaExe) {
			Start-Process -FilePath $operaExe -ArgumentList $browserLinks[$targetBrowser] | Out-Null
			Write-Step 'Opened Opera GX Tampermonkey setup page.'
		} else {
			Write-Step 'Opera GX executable not found. Opening Opera-compatible Tampermonkey link in default browser.'
			Start-Process $browserLinks[$targetBrowser] | Out-Null
		}
	} elseif ($targetBrowser -eq 'opera') {
		$operaExe = Get-OperaExecutable
		if ($operaExe) {
			Start-Process -FilePath $operaExe -ArgumentList $browserLinks[$targetBrowser] | Out-Null
			Write-Step 'Opened Opera Tampermonkey setup page.'
		} else {
			Write-Step 'Opera executable not found. Opening Opera-compatible Tampermonkey link in default browser.'
			Start-Process $browserLinks[$targetBrowser] | Out-Null
		}
	} else {
		Start-Process $browserLinks[$targetBrowser] | Out-Null
		Write-Step "Opened $targetBrowser Tampermonkey setup page."
	}

	if (Test-Path -Path $GuidePath) {
		Start-Process -FilePath $GuidePath | Out-Null
		Write-Step "Opened local setup guide: $GuidePath"
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
$apiTrayProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.TrayHost\OrganizedJihad.Api.TrayHost.csproj'
$desktopProject = Join-Path $repoRoot 'desktop-app\OrganizedJihad.Desktop.csproj'
$userscriptDir = Join-Path $repoRoot 'userscript'
$userscriptDist = Join-Path $userscriptDir 'dist'
$userscriptFile = Join-Path $userscriptDist 'organized-jihad.user.js'
$userscriptGuideSource = Join-Path $repoRoot '~docs\installer-guide\tampermonkey-setup.html'
$userscriptGuideScreenshotsSource = Join-Path $repoRoot '~docs\installer-guide\screenshots'
$bundledRoot = Join-Path $repoRoot 'bundled'
$bundledApiPublishDir = Join-Path $bundledRoot 'api'
$bundledApiTrayPublishDir = Join-Path $bundledRoot 'api-tray'
$bundledDesktopPublishDir = Join-Path $bundledRoot 'desktop-app'
$bundledUserscriptFile = Join-Path $repoRoot 'organized-jihad.user.js'
$bundledUserscriptGuide = Join-Path $repoRoot 'tampermonkey-setup.html'
$bundledUserscriptGuideScreenshots = Join-Path $repoRoot 'guide-screenshots'
$bundledHealthCheckScript = Join-Path $repoRoot 'install-health-check.mjs'
$publishDir = Join-Path $repoRoot 'api\bin\Release\net10.0\win-x64\publish'
$apiTrayPublishCandidates = @(
	(Join-Path $repoRoot 'api\OrganizedJihad.Api.TrayHost\bin\Release\net10.0-windows10.0.19041.0\win-x64\publish'),
	(Join-Path $repoRoot 'api\OrganizedJihad.Api.TrayHost\bin\Release\net10.0-windows10.0.19041.0\publish')
)
$desktopPublishCandidates = @(
	(Join-Path $repoRoot 'desktop-app\bin\Release\net10.0-windows10.0.19041.0\win-x64\publish'),
	(Join-Path $repoRoot 'desktop-app\bin\Release\net10.0-windows10.0.19041.0\publish')
)

$apiInstallDir = Join-Path $InstallRoot 'api'
$apiTrayInstallDir = Join-Path $InstallRoot 'api-tray'
$desktopInstallDir = Join-Path $InstallRoot 'desktop-app'
$userscriptInstallDir = Join-Path $InstallRoot 'userscript'
$apiExecutablePath = Join-Path $apiInstallDir 'OrganizedJihad.Api.exe'
$apiTrayExecutablePath = Join-Path $apiTrayInstallDir 'OrganizedJihad.Api.TrayHost.exe'
$desktopExecutablePath = Join-Path $desktopInstallDir 'OrganizedJihad.Desktop.exe'
$apiServiceTaskName = 'OrganizedJihad.Api.Service'
$apiTrayTaskName = 'OrganizedJihad.Api.Tray'

$effectiveRunInstallHealthCheck = $RunInstallHealthCheck
$effectiveOpenUserscriptDiagnostics = $OpenUserscriptDiagnostics
$effectiveInstallHealthCheckOpen = $InstallHealthCheckOpen
$desktopPublishDir = $null
$apiPublishDir = $null
$apiTrayPublishDir = $null
$userscriptArtifactPath = $null
$userscriptGuidePath = $null
$userscriptGuideScreenshotsPath = $null
$autostartVerification = $null
$isBundledPayloadMode = (Test-Path -Path $bundledApiPublishDir) -or (Test-Path -Path $bundledUserscriptFile) -or (Test-Path -Path $bundledApiTrayPublishDir)

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

		if (Test-Path -Path $userscriptGuideSource) {
			$userscriptGuidePath = $userscriptGuideSource
		}
		if (Test-Path -Path $userscriptGuideScreenshotsSource) {
			$userscriptGuideScreenshotsPath = $userscriptGuideScreenshotsSource
		}
	}

	if (-not $SkipApiInstall) {
		Write-Step 'Publishing API backend from source repository.'
		dotnet publish $apiProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true

		if (-not (Test-Path -Path $publishDir)) {
			throw "API publish output not found at '$publishDir'."
		}
		$apiPublishDir = $publishDir

		if (Test-Path -Path $apiTrayProject) {
			Write-Step 'Publishing API tray host (Windows notification icon).'
			dotnet publish $apiTrayProject -f net10.0-windows10.0.19041.0 -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true

			foreach ($candidate in $apiTrayPublishCandidates) {
				if (Test-Path -Path $candidate) {
					$apiTrayPublishDir = $candidate
					break
				}
			}
		}
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

		if (Test-Path -Path $bundledApiTrayPublishDir) {
			$apiTrayPublishDir = $bundledApiTrayPublishDir
		}
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

		if (Test-Path -Path $bundledUserscriptGuide) {
			$userscriptGuidePath = $bundledUserscriptGuide
		}
		if (Test-Path -Path $bundledUserscriptGuideScreenshots) {
			$userscriptGuideScreenshotsPath = $bundledUserscriptGuideScreenshots
		}
	}
} else {
	throw 'Could not locate either source project structure or bundled release payloads.'
}

Write-Step "Installing artifacts into '$InstallRoot'"
Ensure-Directory -Path $InstallRoot
if (-not $SkipApiInstall) {
	$suspendedAutostartTasks = @()
	foreach ($autostartTaskName in @($apiServiceTaskName, $apiTrayTaskName)) {
		if (Suspend-AutostartTask -TaskName $autostartTaskName) {
			$suspendedAutostartTasks += $autostartTaskName
		}
	}
	try {
		Stop-InstalledApiProcess -ExecutablePath $apiExecutablePath
		$fileUnlocked = Wait-FileUnlocked -Path $apiExecutablePath -TimeoutSeconds 30
		if (-not $fileUnlocked) {
			Write-Step "API binary remained locked after wait window. Continuing with retrying copy operations."
		}

		try {
			Copy-BuildArtifacts -Source $apiPublishDir -Destination $apiInstallDir -MaxRetries 60
		} catch {
			$copyError = $_.Exception.Message
			if ($copyError -like '*OrganizedJihad.Api.exe*used by another process*') {
				Write-Step 'Detected locked OrganizedJihad.Api.exe during copy. Falling back to side-by-side executable deployment.'

				Copy-BuildArtifactsExcludingFiles -Source $apiPublishDir -Destination $apiInstallDir -ExcludedFileNames @('OrganizedJihad.Api.exe')

				$sourceApiExecutable = Join-Path $apiPublishDir 'OrganizedJihad.Api.exe'
				$sideBySideName = "OrganizedJihad.Api.$((Get-Date).ToString('yyyyMMddHHmmss')).exe"
				$sideBySidePath = Join-Path $apiInstallDir $sideBySideName
				Copy-Item -Path $sourceApiExecutable -Destination $sideBySidePath -Force
				$apiExecutablePath = $sideBySidePath

				Write-Step "Using side-by-side API executable: $apiExecutablePath"
			} else {
				throw
			}
		}
	} finally {
		foreach ($suspendedTaskName in $suspendedAutostartTasks) {
			Resume-AutostartTask -TaskName $suspendedTaskName
		}
	}
}

if (-not $SkipDesktopAppInstall) {
	Copy-BuildArtifacts -Source $desktopPublishDir -Destination $desktopInstallDir
}

if ((-not $SkipApiInstall) -and $apiTrayPublishDir -and (Test-Path -Path $apiTrayPublishDir)) {
	Stop-ProcessByExecutablePath -ExecutablePath $apiTrayExecutablePath -DisplayName 'running API tray host process'
	$fileUnlocked = Wait-FileUnlocked -Path $apiTrayExecutablePath -TimeoutSeconds 10
	if (-not $fileUnlocked) {
		Write-Step 'Tray host executable remained locked after wait window. Continuing with retrying copy operations.'
	}

	try {
		Copy-BuildArtifacts -Source $apiTrayPublishDir -Destination $apiTrayInstallDir -MaxRetries 30
	} catch {
		$copyError = $_.Exception.Message
		if ($copyError -like '*OrganizedJihad.Api.TrayHost.exe*used by another process*') {
			Write-Step 'Detected locked tray host executable during copy. Falling back to side-by-side tray-host deployment.'

			Copy-BuildArtifactsExcludingFiles -Source $apiTrayPublishDir -Destination $apiTrayInstallDir -ExcludedFileNames @('OrganizedJihad.Api.TrayHost.exe')

			$sourceTrayExecutable = Join-Path $apiTrayPublishDir 'OrganizedJihad.Api.TrayHost.exe'
			$traySideBySideName = "OrganizedJihad.Api.TrayHost.$((Get-Date).ToString('yyyyMMddHHmmss')).exe"
			$traySideBySidePath = Join-Path $apiTrayInstallDir $traySideBySideName
			Copy-Item -Path $sourceTrayExecutable -Destination $traySideBySidePath -Force
			$apiTrayExecutablePath = $traySideBySidePath

			Write-Step "Using side-by-side tray host executable: $apiTrayExecutablePath"
		} else {
			throw
		}
	}
}

if (-not $SkipUserscriptInstall) {
	Ensure-Directory -Path $userscriptInstallDir
	Copy-Item -Path $userscriptArtifactPath -Destination (Join-Path $userscriptInstallDir 'organized-jihad.user.js') -Force

	if ($userscriptGuidePath -and (Test-Path -Path $userscriptGuidePath)) {
		Copy-Item -Path $userscriptGuidePath -Destination (Join-Path $userscriptInstallDir 'tampermonkey-setup.html') -Force
	}

	if ($userscriptGuideScreenshotsPath -and (Test-Path -Path $userscriptGuideScreenshotsPath)) {
		$guideScreenshotInstallDir = Join-Path $userscriptInstallDir 'guide-screenshots'
		Copy-BuildArtifacts -Source $userscriptGuideScreenshotsPath -Destination $guideScreenshotInstallDir
	}
}

if ((-not $SkipApiInstall) -and (-not (Test-Path -Path $apiExecutablePath))) {
	throw "Expected API executable missing at '$apiExecutablePath'."
}

if ((-not $SkipDesktopAppInstall) -and (-not (Test-Path -Path $desktopExecutablePath))) {
	throw "Expected desktop executable missing at '$desktopExecutablePath'."
}

if (-not $SkipApiInstall) {
	Write-Step "Configuring API startup"
	$useTrayHost = Test-Path -Path $apiTrayExecutablePath
	if ($useTrayHost) {
		Write-Step 'Tray host found. Installer will configure service-style API startup plus interactive tray icon startup.'
	}

	Ensure-ApiAutostartTasks -ApiServiceTaskName $apiServiceTaskName -ApiTrayTaskName $apiTrayTaskName -ApiExecutablePath $apiExecutablePath -ApiWorkingDirectory $apiInstallDir -ApiTrayExecutablePath $apiTrayExecutablePath -ApiTrayWorkingDirectory $apiTrayInstallDir -ApiUrlValue $ApiUrl -UseTrayHost:$useTrayHost
	$autostartVerification = Verify-ApiAutostartTasks -ApiServiceTaskName $apiServiceTaskName -ApiTrayTaskName $apiTrayTaskName -ExpectTrayTask:$useTrayHost
}

if ((-not $SkipUserscriptInstall) -and (-not $SkipTampermonkeyBootstrap)) {
	Write-Step "Opening Tampermonkey bootstrap for: $($TampermonkeyBrowsers -join ', ')."
	$installedScript = Join-Path $userscriptInstallDir 'organized-jihad.user.js'
	$installedGuide = Join-Path $userscriptInstallDir 'tampermonkey-setup.html'
	Open-TampermonkeyBootstrap -Browsers $TampermonkeyBrowsers -UserscriptPath $installedScript -GuidePath $installedGuide
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
	$installedGuidePath = Join-Path $userscriptInstallDir 'tampermonkey-setup.html'
	if (Test-Path -Path $installedGuidePath) {
		Write-Host "- Userscript setup guide: $installedGuidePath"
	}
}
if (-not $SkipApiInstall) {
	Write-Host "- API background task: $apiServiceTaskName"
	if (Test-Path -Path $apiTrayExecutablePath) {
		Write-Host "- API tray task: $apiTrayTaskName"
	}
	if ($autostartVerification) {
		Write-Host "- Startup verification (service): $($autostartVerification.Service.State)"
		if (Test-Path -Path $apiTrayExecutablePath) {
			Write-Host "- Startup verification (tray): $($autostartVerification.Tray.State)"
		}
	}
	Write-Host "- API URL: $ApiUrl"
	if (Test-Path -Path $apiTrayExecutablePath) {
		Write-Host "- Tray host executable: $apiTrayExecutablePath"
	}
}
Write-Host ""
Write-Host 'Recommended next checks:' -ForegroundColor Green
if (-not $SkipUserscriptInstall) {
	Write-Host '- Open tampermonkey-setup.html for browser-specific steps and screenshots'
	Write-Host '- Open Tampermonkey dashboard and import organized-jihad.user.js if not already prompted'
	Write-Host '- Confirm Tampermonkey has the OrganizedJihad script enabled'
}
if (-not $SkipApiInstall) {
	Write-Host "- Verify API health at $ApiUrl/api/sync/health"
	if (Test-Path -Path $apiTrayExecutablePath) {
		Write-Host '- Verify the OrganizedJihad API tray icon appears in Windows notification area (background apps) and opens API UI on double-click.'
	}
}
if (-not $SkipDesktopAppInstall) {
	Write-Host '- Launch OrganizedJihad.Desktop.exe and confirm data views load'
}
Write-Host '- Optional: rerun check with browser-open failures: yarn install:check --open failed'
Write-Host '- Optional: open diagnostics entry points automatically: -OpenUserscriptDiagnostics'
Write-Host '- Optional: run first-run diagnostics bundle: -FirstRunDiagnostics'
