param(
	[string]$Version = '0.2.2',
	[string]$Configuration = 'Release',
	[string]$Runtime = 'win-x64',
	[string]$OutputRoot = '.\artifacts'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$publishInstallerScript = Join-Path $repoRoot 'Publish-InstallerUI.ps1'
$apiProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.csproj'
$apiTrayProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.TrayHost\OrganizedJihad.Api.TrayHost.csproj'
$desktopProject = Join-Path $repoRoot 'desktop-app\OrganizedJihad.Desktop.csproj'
$userscriptDir = Join-Path $repoRoot 'userscript'
$userscriptDist = Join-Path $userscriptDir 'dist'
$userscriptFile = Join-Path $userscriptDist 'organized-jihad.user.js'
$healthCheckScript = Join-Path $userscriptDir 'scripts\install-health-check.mjs'
$userscriptGuideSource = Join-Path $repoRoot '~docs\installer-guide\tampermonkey-setup.html'
$userscriptGuideScreenshotsSource = Join-Path $repoRoot '~docs\installer-guide\screenshots'
$apiPublishDir = Join-Path $repoRoot 'api\bin\Release\net10.0\win-x64\publish'
$apiTrayPublishCandidates = @(
	(Join-Path $repoRoot 'api\OrganizedJihad.Api.TrayHost\bin\Release\net10.0-windows10.0.19041.0\win-x64\publish'),
	(Join-Path $repoRoot 'api\OrganizedJihad.Api.TrayHost\bin\Release\net10.0-windows10.0.19041.0\publish')
)
$desktopPublishCandidates = @(
	(Join-Path $repoRoot 'desktop-app\bin\Release\net10.0-windows10.0.19041.0\win-x64\publish'),
	(Join-Path $repoRoot 'desktop-app\bin\Release\net10.0-windows10.0.19041.0\publish')
)
if (-not (Test-Path -Path $publishInstallerScript)) {
	throw "Required script not found: $publishInstallerScript"
}

$installerScriptSource = Join-Path $repoRoot 'Install-OrganizedJihad.ps1'
if (-not (Test-Path -Path $installerScriptSource)) {
	throw "Required installer script not found: $installerScriptSource"
}
if (-not (Test-Path -Path $userscriptGuideSource)) {
	throw "Required userscript setup guide not found: $userscriptGuideSource"
}
if (-not (Test-Path -Path $userscriptGuideScreenshotsSource)) {
	throw "Required userscript setup screenshots folder not found: $userscriptGuideScreenshotsSource"
}

Write-Host '[OJ Release] Building userscript bundle...' -ForegroundColor Cyan
Push-Location $userscriptDir
try {
	yarn install --frozen-lockfile
	yarn build
} finally {
	Pop-Location
}

if (-not (Test-Path -Path $userscriptFile)) {
	throw "Missing userscript artifact after build: $userscriptFile"
}

Write-Host '[OJ Release] Publishing API backend payload...' -ForegroundColor Cyan
dotnet publish $apiProject -c $Configuration -r $Runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true
if (-not (Test-Path -Path $apiPublishDir)) {
	throw "Missing API publish directory: $apiPublishDir"
}

Write-Host '[OJ Release] Publishing API tray host payload...' -ForegroundColor Cyan
dotnet publish $apiTrayProject -f net10.0-windows10.0.19041.0 -c $Configuration -r $Runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true

$apiTrayPublishDir = $null
foreach ($candidate in $apiTrayPublishCandidates) {
	if (Test-Path -Path $candidate) {
		$apiTrayPublishDir = $candidate
		break
	}
}
if (-not $apiTrayPublishDir) {
	throw "Missing API tray host publish output at expected paths: $($apiTrayPublishCandidates -join '; ')"
}

Write-Host '[OJ Release] Publishing desktop payload...' -ForegroundColor Cyan
dotnet publish $desktopProject -f net10.0-windows10.0.19041.0 -c $Configuration -p:WindowsPackageType=None

$desktopPublishDir = $null
foreach ($candidate in $desktopPublishCandidates) {
	if (Test-Path -Path $candidate) {
		$desktopPublishDir = $candidate
		break
	}
}
if (-not $desktopPublishDir) {
	throw "Missing desktop publish output at expected paths: $($desktopPublishCandidates -join '; ')"
}

$bundlePayloadDir = Join-Path $repoRoot 'installer-ui\bundle-payload'
if (Test-Path -Path $bundlePayloadDir) {
	Remove-Item -Path $bundlePayloadDir -Recurse -Force
}

$bundleApiDir = Join-Path $bundlePayloadDir 'bundled\api'
$bundleApiTrayDir = Join-Path $bundlePayloadDir 'bundled\api-tray'
$bundleDesktopDir = Join-Path $bundlePayloadDir 'bundled\desktop-app'
New-Item -Path $bundleApiDir -ItemType Directory -Force | Out-Null
New-Item -Path $bundleApiTrayDir -ItemType Directory -Force | Out-Null
New-Item -Path $bundleDesktopDir -ItemType Directory -Force | Out-Null

Copy-Item -Path $installerScriptSource -Destination (Join-Path $bundlePayloadDir 'Install-OrganizedJihad.ps1') -Force
Copy-Item -Path $userscriptFile -Destination (Join-Path $bundlePayloadDir 'organized-jihad.user.js') -Force
Copy-Item -Path $healthCheckScript -Destination (Join-Path $bundlePayloadDir 'install-health-check.mjs') -Force
Copy-Item -Path $userscriptGuideSource -Destination (Join-Path $bundlePayloadDir 'tampermonkey-setup.html') -Force
Copy-Item -Path $userscriptGuideScreenshotsSource -Destination (Join-Path $bundlePayloadDir 'guide-screenshots') -Recurse -Force
Copy-Item -Path (Join-Path $apiPublishDir '*') -Destination $bundleApiDir -Recurse -Force
Copy-Item -Path (Join-Path $apiTrayPublishDir '*') -Destination $bundleApiTrayDir -Recurse -Force
Copy-Item -Path (Join-Path $desktopPublishDir '*') -Destination $bundleDesktopDir -Recurse -Force

Write-Host "[OJ Release] Building installer UI publish output for v$Version..." -ForegroundColor Cyan
& $publishInstallerScript -Runtime $Runtime -Configuration $Configuration -OutputDir '.\installer-ui\publish\win-x64'

$publishDir = Join-Path $repoRoot 'installer-ui\publish\win-x64'
$installerExe = Join-Path $publishDir 'OrganizedJihad.Installer.exe'
$releaseBody = Join-Path $repoRoot '~docs\plans\release-v0.2.2-github-body.md'

if (-not (Test-Path -Path $installerExe)) {
	throw "Missing installer executable: $installerExe"
}
if (-not (Test-Path -Path $releaseBody)) {
	throw "Missing release body document: $releaseBody"
}

$artifactDir = Join-Path $repoRoot (Join-Path $OutputRoot "v$Version")
$exeAssetPath = Join-Path $artifactDir 'OrganizedJihad.Installer.exe'
$checksumsPath = Join-Path $artifactDir 'SHA256SUMS.txt'

if (Test-Path -Path $artifactDir) {
	Remove-Item -Path $artifactDir -Recurse -Force
}
New-Item -Path $artifactDir -ItemType Directory -Force | Out-Null
Copy-Item -Path $installerExe -Destination $exeAssetPath -Force

$checksumLines = @()
$targets = @(
	$exeAssetPath
)

foreach ($target in $targets) {
	$hash = Get-FileHash -Path $target -Algorithm SHA256
	$relative = $target.Replace("$artifactDir\\", '')
	$checksumLines += "$($hash.Hash)  $relative"
}

Set-Content -Path $checksumsPath -Value $checksumLines -Encoding UTF8

Write-Host "[OJ Release] Artifacts ready at: $artifactDir" -ForegroundColor Green
Write-Host "[OJ Release] Single EXE asset: $exeAssetPath" -ForegroundColor Green
Write-Host "[OJ Release] Checksums: $checksumsPath" -ForegroundColor Green
