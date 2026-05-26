param(
	[string]$InstallRoot = "$env:LOCALAPPDATA\OrganizedJihad",
	[string]$ApiUrl = 'http://localhost:5124',
	[switch]$SkipTampermonkeyBootstrap,
	[switch]$SkipYarnInstall
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
		$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
		$trigger = New-ScheduledTaskTrigger -AtLogOn

		Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
		Write-Step "Registered startup task '$TaskName' (logon fallback; run installer as Administrator for system startup registration)."
	}

	try {
		Start-ScheduledTask -TaskName $TaskName
		Write-Step "Started '$TaskName' immediately."
	} catch {
		Write-Step "Could not start '$TaskName' immediately. It will run at next logon."
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

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.csproj'
$userscriptDir = Join-Path $repoRoot 'userscript'
$userscriptDist = Join-Path $userscriptDir 'dist'
$userscriptFile = Join-Path $userscriptDist 'organized-jihad.user.js'
$publishDir = Join-Path $repoRoot 'api\bin\Release\net10.0\win-x64\publish'

$apiInstallDir = Join-Path $InstallRoot 'api'
$userscriptInstallDir = Join-Path $InstallRoot 'userscript'
$apiExecutablePath = Join-Path $apiInstallDir 'OrganizedJihad.Api.exe'
$taskName = 'OrganizedJihad.Api.Autostart'

Write-Step "Validating prerequisites"
Assert-Command -Name 'dotnet' -HelpText 'Install .NET SDK 10 preview or later.'
Assert-Command -Name 'yarn' -HelpText 'Install Yarn (classic) and Node.js 18+.'

Write-Step "Building userscript bundle"
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

Write-Step "Publishing API backend"
dotnet publish $apiProject -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true

if (-not (Test-Path -Path $publishDir)) {
	throw "API publish output not found at '$publishDir'."
}

Write-Step "Installing artifacts into '$InstallRoot'"
Ensure-Directory -Path $InstallRoot
Copy-BuildArtifacts -Source $publishDir -Destination $apiInstallDir
Copy-BuildArtifacts -Source $userscriptDist -Destination $userscriptInstallDir

if (-not (Test-Path -Path $apiExecutablePath)) {
	throw "Expected API executable missing at '$apiExecutablePath'."
}

Write-Step "Configuring API startup"
Ensure-AutostartTask -TaskName $taskName -ExecutablePath $apiExecutablePath -ApiUrlValue $ApiUrl -WorkingDirectory $apiInstallDir

if (-not $SkipTampermonkeyBootstrap) {
	Write-Step 'Opening Tampermonkey install pages and generated userscript file.'
	Start-Process 'https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo' | Out-Null
	Start-Process 'https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd' | Out-Null
	Start-Process 'https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/' | Out-Null

	$installedScript = Join-Path $userscriptInstallDir 'organized-jihad.user.js'
	if (Test-Path -Path $installedScript) {
		Start-Process $installedScript | Out-Null
		Write-Step 'Opened userscript file for Tampermonkey import.'
	}
}

Write-Step 'Installation complete.'
Write-Host ""
Write-Host 'What was configured:' -ForegroundColor Green
Write-Host "- API installed to: $apiInstallDir"
Write-Host "- Userscript installed to: $userscriptInstallDir"
Write-Host "- Startup task: $taskName"
Write-Host "- API URL: $ApiUrl"
Write-Host ""
Write-Host 'Recommended next checks:' -ForegroundColor Green
Write-Host '- Open Hero Wars in your browser'
Write-Host '- Confirm Tampermonkey has the OrganizedJihad script enabled'
Write-Host '- Verify API health at http://localhost:5124/api/sync/health'
