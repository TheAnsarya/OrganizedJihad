param(
	[string]$Version = '0.2.1',
	[string]$Configuration = 'Release',
	[string]$Runtime = 'win-x64',
	[string]$OutputRoot = '.\artifacts'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$publishInstallerScript = Join-Path $repoRoot 'Publish-InstallerUI.ps1'
if (-not (Test-Path -Path $publishInstallerScript)) {
	throw "Required script not found: $publishInstallerScript"
}

Write-Host "[OJ Release] Building installer UI publish output for v$Version..." -ForegroundColor Cyan
& $publishInstallerScript -Runtime $Runtime -Configuration $Configuration -OutputDir '.\installer-ui\publish\win-x64'

$publishDir = Join-Path $repoRoot 'installer-ui\publish\win-x64'
$installerExe = Join-Path $publishDir 'OrganizedJihad.Installer.exe'
$installerPs1 = Join-Path $publishDir 'Install-OrganizedJihad.ps1'
$cliCmd = Join-Path $repoRoot 'Install-OrganizedJihad.cmd'
$releaseBody = Join-Path $repoRoot '~docs\plans\release-v0.2.1-github-body.md'

if (-not (Test-Path -Path $installerExe)) {
	throw "Missing installer executable: $installerExe"
}
if (-not (Test-Path -Path $installerPs1)) {
	throw "Missing bundled installer script: $installerPs1"
}
if (-not (Test-Path -Path $cliCmd)) {
	throw "Missing CLI launcher script: $cliCmd"
}
if (-not (Test-Path -Path $releaseBody)) {
	throw "Missing release body document: $releaseBody"
}

$artifactDir = Join-Path $repoRoot (Join-Path $OutputRoot "v$Version")
$bundleDir = Join-Path $artifactDir 'bundle'
$zipPath = Join-Path $artifactDir "OrganizedJihad-v$Version-windows-installer.zip"
$checksumsPath = Join-Path $artifactDir 'SHA256SUMS.txt'

if (Test-Path -Path $artifactDir) {
	Remove-Item -Path $artifactDir -Recurse -Force
}
New-Item -Path $bundleDir -ItemType Directory -Force | Out-Null

Copy-Item -Path $installerExe -Destination (Join-Path $bundleDir 'OrganizedJihad.Installer.exe') -Force
Copy-Item -Path $installerPs1 -Destination (Join-Path $bundleDir 'Install-OrganizedJihad.ps1') -Force
Copy-Item -Path $cliCmd -Destination (Join-Path $bundleDir 'Install-OrganizedJihad.cmd') -Force
Copy-Item -Path $releaseBody -Destination (Join-Path $bundleDir 'RELEASE-NOTES.md') -Force

if (Test-Path -Path $zipPath) {
	Remove-Item -Path $zipPath -Force
}
Compress-Archive -Path (Join-Path $bundleDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

$checksumLines = @()
$targets = @(
	$zipPath,
	(Join-Path $bundleDir 'OrganizedJihad.Installer.exe'),
	(Join-Path $bundleDir 'Install-OrganizedJihad.ps1'),
	(Join-Path $bundleDir 'Install-OrganizedJihad.cmd')
)

foreach ($target in $targets) {
	$hash = Get-FileHash -Path $target -Algorithm SHA256
	$relative = $target.Replace("$artifactDir\\", '')
	$checksumLines += "$($hash.Hash)  $relative"
}

Set-Content -Path $checksumsPath -Value $checksumLines -Encoding UTF8

Write-Host "[OJ Release] Artifacts ready at: $artifactDir" -ForegroundColor Green
Write-Host "[OJ Release] Bundle zip: $zipPath" -ForegroundColor Green
Write-Host "[OJ Release] Checksums: $checksumsPath" -ForegroundColor Green
