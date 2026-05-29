param(
	[string]$Runtime = 'win-x64',
	[string]$Configuration = 'Release',
	[string]$OutputDir = '.\installer-ui\publish\win-x64'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Join-Path $repoRoot 'installer-ui\OrganizedJihad.Installer.csproj'
$resolvedOutput = Resolve-Path -Path (Join-Path $repoRoot $OutputDir) -ErrorAction SilentlyContinue
if (-not $resolvedOutput) {
	New-Item -Path (Join-Path $repoRoot $OutputDir) -ItemType Directory -Force | Out-Null
}

Write-Host '[OJ Installer UI] Publishing Avalonia installer executable...' -ForegroundColor Cyan
dotnet publish $projectPath -c $Configuration -r $Runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -o (Join-Path $repoRoot $OutputDir)

$binaryName = if ($Runtime -like 'win-*') { 'OrganizedJihad.Installer.exe' } else { 'OrganizedJihad.Installer' }
$binaryPath = Join-Path $repoRoot (Join-Path $OutputDir $binaryName)
if (-not (Test-Path -Path $binaryPath)) {
	throw "Publish did not produce expected installer binary at '$binaryPath'."
}

Write-Host "[OJ Installer UI] Ready: $binaryPath" -ForegroundColor Green
