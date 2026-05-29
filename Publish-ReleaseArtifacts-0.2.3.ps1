param(
	[string]$Version = '0.2.3',
	[string]$Configuration = 'Release',
	[string[]]$Runtimes = @('win-x64', 'linux-x64', 'osx-x64', 'osx-arm64'),
	[string]$OutputRoot = '.\artifacts',
	[switch]$SkipMigrationCheck,
	[switch]$SkipSmokeTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$publishInstallerScript = Join-Path $repoRoot 'Publish-InstallerUI.ps1'
$apiProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.csproj'
$runtimeHostProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.TrayHost\OrganizedJihad.Api.TrayHost.csproj'
$installerCliProject = Join-Path $repoRoot 'installer-core\OrganizedJihad.Installer.Cli\OrganizedJihad.Installer.Cli.csproj'
$desktopProject = Join-Path $repoRoot 'desktop-app\OrganizedJihad.Desktop.csproj'
$migrationCheckScript = Join-Path $repoRoot 'Test-ApiMigrationPath.ps1'
$releaseSmokeScript = Join-Path $repoRoot 'Test-ReleaseSmoke.ps1'
$userscriptDir = Join-Path $repoRoot 'userscript'
$userscriptDist = Join-Path $userscriptDir 'dist'
$userscriptFile = Join-Path $userscriptDist 'organized-jihad.user.js'
$healthCheckScript = Join-Path $userscriptDir 'scripts\install-health-check.mjs'
$userscriptGuideSource = Join-Path $repoRoot '~docs\installer-guide\tampermonkey-setup.html'
$userscriptGuideScreenshotsSource = Join-Path $repoRoot '~docs\installer-guide\screenshots'
$releaseBody = Join-Path $repoRoot '~docs\plans\release-v0.2.3-github-body.md'

function Write-Step {
	param([string]$Message)
	Write-Host "[OJ Release 0.2.3] $Message" -ForegroundColor Cyan
}

function Get-TfmForRuntime {
	param([string]$Runtime)
	if ($Runtime -like 'win-*') {
		return 'net10.0-windows10.0.19041.0'
	}
	return 'net10.0'
}

if (-not (Test-Path -Path $publishInstallerScript)) { throw "Missing script: $publishInstallerScript" }
if (-not (Test-Path -Path $releaseBody)) { throw "Missing release body: $releaseBody" }
if (-not (Test-Path -Path $migrationCheckScript)) { throw "Missing migration check script: $migrationCheckScript" }
if (-not (Test-Path -Path $releaseSmokeScript)) { throw "Missing smoke script: $releaseSmokeScript" }
if (-not (Test-Path -Path $userscriptGuideSource)) { throw "Missing userscript guide: $userscriptGuideSource" }
if (-not (Test-Path -Path $userscriptGuideScreenshotsSource)) { throw "Missing userscript screenshots: $userscriptGuideScreenshotsSource" }

if (-not $SkipMigrationCheck) {
	Write-Step 'Running migration path check once before matrix publish.'
	& $migrationCheckScript -ApiProjectPath $apiProject
}

Write-Step 'Building userscript bundle once for all runtimes.'
Push-Location $userscriptDir
try {
	yarn install --frozen-lockfile
	yarn build
} finally {
	Pop-Location
}
if (-not (Test-Path -Path $userscriptFile)) {
	throw "Userscript bundle missing: $userscriptFile"
}

$desktopPublishDir = $null
if ($Runtimes -contains 'win-x64') {
	Write-Step 'Publishing desktop app payload for Windows runtime.'
	dotnet publish $desktopProject -f net10.0-windows10.0.19041.0 -c $Configuration -p:WindowsPackageType=None
	$desktopCandidates = @(
		(Join-Path $repoRoot 'desktop-app\bin\Release\net10.0-windows10.0.19041.0\win-x64\publish'),
		(Join-Path $repoRoot 'desktop-app\bin\Release\net10.0-windows10.0.19041.0\publish')
	)
	$desktopPublishDir = $desktopCandidates | Where-Object { Test-Path -Path $_ } | Select-Object -First 1
}

$artifactRoot = Join-Path $repoRoot (Join-Path $OutputRoot "v$Version")
if (Test-Path -Path $artifactRoot) {
	Remove-Item -Path $artifactRoot -Recurse -Force
}
New-Item -Path $artifactRoot -ItemType Directory -Force | Out-Null

$manifest = @()

foreach ($runtime in $Runtimes) {
	Write-Step "Publishing runtime matrix entry: $runtime"

	$bundlePayloadDir = Join-Path $repoRoot 'installer-ui\\bundle-payload'
	$bundledRoot = Join-Path $bundlePayloadDir 'bundled'
	$apiOut = Join-Path $bundledRoot 'api'
	$runtimeHostOut = Join-Path $bundledRoot 'runtime-host'
	$installerCliOut = Join-Path $bundlePayloadDir 'installer-cli'
	$desktopOut = Join-Path $bundledRoot 'desktop-app'

	foreach ($path in @($apiOut, $runtimeHostOut, $installerCliOut, $desktopOut)) {
		if (Test-Path -Path $path) {
			Remove-Item -Path $path -Recurse -Force
		}
	}

	New-Item -Path $apiOut -ItemType Directory -Force | Out-Null
	New-Item -Path $runtimeHostOut -ItemType Directory -Force | Out-Null
	New-Item -Path $installerCliOut -ItemType Directory -Force | Out-Null

	dotnet publish $apiProject -c $Configuration -r $runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $apiOut

	$runtimeHostTfm = Get-TfmForRuntime -Runtime $runtime
	dotnet publish $runtimeHostProject -f $runtimeHostTfm -c $Configuration -r $runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $runtimeHostOut
	dotnet publish $installerCliProject -c $Configuration -r $runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $installerCliOut

	if ($runtime -eq 'win-x64' -and $desktopPublishDir -and (Test-Path -Path $desktopPublishDir)) {
		New-Item -Path $desktopOut -ItemType Directory -Force | Out-Null
		Copy-Item -Path (Join-Path $desktopPublishDir '*') -Destination $desktopOut -Recurse -Force
	}

	Copy-Item -Path $userscriptFile -Destination (Join-Path $bundlePayloadDir 'organized-jihad.user.js') -Force
	Copy-Item -Path $healthCheckScript -Destination (Join-Path $bundlePayloadDir 'install-health-check.mjs') -Force
	Copy-Item -Path $userscriptGuideSource -Destination (Join-Path $bundlePayloadDir 'tampermonkey-setup.html') -Force
	Copy-Item -Path $userscriptGuideScreenshotsSource -Destination (Join-Path $bundlePayloadDir 'guide-screenshots') -Recurse -Force

	$installerOutDir = Join-Path $repoRoot (Join-Path 'installer-ui\publish' $runtime)
	& $publishInstallerScript -Runtime $runtime -Configuration $Configuration -OutputDir (Join-Path 'installer-ui\publish' $runtime)

	$installerBinaryName = if ($runtime -like 'win-*') { 'OrganizedJihad.Installer.exe' } else { 'OrganizedJihad.Installer' }
	$installerBinaryPath = Join-Path $installerOutDir $installerBinaryName
	if (-not (Test-Path -Path $installerBinaryPath)) {
		throw "Installer binary missing for $runtime at $installerBinaryPath"
	}

	if (-not $SkipSmokeTest -and $runtime -eq 'win-x64') {
		Write-Step 'Running smoke test against win-x64 API publish.'
		$smokeApiExecutable = Join-Path $apiOut 'OrganizedJihad.Api.exe'
		& $releaseSmokeScript -ApiExecutablePath $smokeApiExecutable
	}

	$runtimeArtifactDir = Join-Path $artifactRoot $runtime
	New-Item -Path $runtimeArtifactDir -ItemType Directory -Force | Out-Null
	$installerAssetPath = Join-Path $runtimeArtifactDir $installerBinaryName
	Copy-Item -Path $installerBinaryPath -Destination $installerAssetPath -Force

	$checksumsPath = Join-Path $runtimeArtifactDir 'SHA256SUMS.txt'
	$hash = Get-FileHash -Path $installerAssetPath -Algorithm SHA256
	Set-Content -Path $checksumsPath -Value "$($hash.Hash)  $installerBinaryName" -Encoding UTF8

	$manifest += [PSCustomObject]@{
		Runtime = $runtime
		Installer = $installerBinaryName
		ChecksumFile = 'SHA256SUMS.txt'
	}
}

$manifestPath = Join-Path $artifactRoot 'release-manifest.json'
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestPath -Encoding UTF8

Write-Step "Artifact matrix ready at: $artifactRoot"
Write-Step "Release notes body: $releaseBody"
