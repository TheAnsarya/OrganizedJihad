param(
	[string]$Version = '0.2.3',
	[string]$Configuration = 'Release',
	[string]$Runtime = 'win-x64',
	[string]$OutputRoot = '.\artifacts',
	[switch]$SkipMigrationCheck,
	[switch]$SkipSmokeTest,
	[switch]$SkipYarnInstall,
	[switch]$SkipUserscriptBuild,
	[switch]$DryRun,
	[int]$StartupTimeoutSeconds,
	[ValidateSet('text', 'json')]
	[string]$DryRunFormat = 'text',
	[string]$SmokeRuntime = 'auto'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host '[OJ Release] Legacy script entrypoint detected. Forwarding to managed release CLI.' -ForegroundColor Yellow

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
	$Runtime,
	'--output-root',
	$OutputRoot,
	'--dry-run-format',
	$DryRunFormat,
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
