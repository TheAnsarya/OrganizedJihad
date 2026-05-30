param(
	[string]$Version = '0.2.3',
	[string]$Configuration = 'Release',
	[string[]]$Runtimes = @('win-x64', 'linux-x64', 'osx-x64', 'osx-arm64'),
	[string]$OutputRoot = '.\artifacts',
	[switch]$SkipMigrationCheck,
	[switch]$SkipSmokeTest,
	[switch]$SkipYarnInstall,
	[switch]$SkipUserscriptBuild,
	[switch]$DryRun,
	[int]$StartupTimeoutSeconds,
	[string]$SmokeRuntime = 'auto'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$runtimeValue = ($Runtimes | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ','
if ([string]::IsNullOrWhiteSpace($runtimeValue)) {
	$runtimeValue = 'win-x64,linux-x64,osx-x64,osx-arm64'
}

Write-Host '[OJ Release 0.2.3] Legacy script entrypoint detected. Forwarding to managed release CLI.' -ForegroundColor Yellow

$releaseCliArgs = @(
	'run',
	'--project',
	'installer-core/OrganizedJihad.Release.Cli',
	'--',
	'--version',
	$Version,
	'--configuration',
	$Configuration,
	'--runtimes',
	$runtimeValue,
	'--output-root',
	$OutputRoot,
	'--smoke-runtime',
	$SmokeRuntime
)

if ($SkipMigrationCheck) {
	$releaseCliArgs += '--skip-migration-check'
}
if ($SkipSmokeTest) {
	$releaseCliArgs += '--skip-smoke-test'
}
if ($SkipYarnInstall) {
	$releaseCliArgs += '--skip-yarn-install'
}
if ($SkipUserscriptBuild) {
	$releaseCliArgs += '--skip-userscript-build'
}
if ($DryRun) {
	$releaseCliArgs += '--dry-run'
}
if ($PSBoundParameters.ContainsKey('StartupTimeoutSeconds')) {
	$releaseCliArgs += @('--startup-timeout-seconds', $StartupTimeoutSeconds)
}

& dotnet $releaseCliArgs
if ($LASTEXITCODE -ne 0) {
	throw "Managed release CLI failed with exit code $LASTEXITCODE."
}
