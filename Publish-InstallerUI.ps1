param(
	[string]$Runtime = 'win-x64',
	[string]$Configuration = 'Release',
	[string]$OutputDir = '.\installer-ui\publish\win-x64',
	[switch]$SkipPayloadRefresh
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$bundleRoot = Join-Path $repoRoot 'installer-ui\bundle-payload'
$bundledRoot = Join-Path $bundleRoot 'bundled'
$projectPath = Join-Path $repoRoot 'installer-ui\OrganizedJihad.Installer.csproj'
$resolvedOutput = Resolve-Path -Path (Join-Path $repoRoot $OutputDir) -ErrorAction SilentlyContinue
if (-not $resolvedOutput) {
	New-Item -Path (Join-Path $repoRoot $OutputDir) -ItemType Directory -Force | Out-Null
}

function Invoke-DotnetPublish {
	param(
		[Parameter(Mandatory = $true)][string]$ProjectPath,
		[Parameter(Mandatory = $true)][string[]]$Arguments
	)

		Write-Host "[OJ Installer UI] dotnet publish $ProjectPath $($Arguments -join ' ')" -ForegroundColor DarkCyan
		dotnet publish $ProjectPath @Arguments
	if ($LASTEXITCODE -ne 0) {
		throw "dotnet publish failed for '$ProjectPath'"
	}
}

if (-not $SkipPayloadRefresh) {
	Write-Host '[OJ Installer UI] Refreshing bundle payload with latest binaries/assets...' -ForegroundColor Cyan

	if (Test-Path $bundleRoot) {
		Remove-Item -Recurse -Force $bundleRoot
	}

	New-Item -ItemType Directory -Force -Path $bundleRoot | Out-Null
	New-Item -ItemType Directory -Force -Path $bundledRoot | Out-Null

	$apiProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.csproj'
	$runtimeHostProject = Join-Path $repoRoot 'api\OrganizedJihad.Api.TrayHost\OrganizedJihad.Api.TrayHost.csproj'
	$installerCliProject = Join-Path $repoRoot 'installer-core\OrganizedJihad.Installer.Cli\OrganizedJihad.Installer.Cli.csproj'
	$userscriptDir = Join-Path $repoRoot 'userscript'

	if (Test-Path $userscriptDir) {
		Write-Host '[OJ Installer UI] Building latest userscript bundle before payload copy...' -ForegroundColor DarkCyan
		Push-Location $userscriptDir
		try {
			yarn install --frozen-lockfile
			if ($LASTEXITCODE -ne 0) {
				throw 'yarn install failed while preparing installer payload.'
			}

			yarn build
			if ($LASTEXITCODE -ne 0) {
				throw 'yarn build failed while preparing installer payload.'
			}
		} finally {
			Pop-Location
		}
	} else {
		Write-Warning "Userscript source directory not found at '$userscriptDir'. Reusing existing dist artifact if present."
	}

	$apiOut = Join-Path $bundledRoot 'api'
	$runtimeHostOut = Join-Path $bundledRoot 'runtime-host'
	$apiTrayOut = Join-Path $bundledRoot 'api-tray'
	$installerCliOut = Join-Path $bundleRoot 'installer-cli'

		Invoke-DotnetPublish -ProjectPath $apiProject -Arguments @(
			'-c', $Configuration,
			'-r', $Runtime,
			'--self-contained', 'true',
			'-p:PublishSingleFile=true',
			'-p:IncludeNativeLibrariesForSelfExtract=true',
			'-o', $apiOut
		)

	$runtimeHostTfm = if ($Runtime -like 'win-*') { 'net10.0-windows10.0.19041.0' } else { 'net10.0' }
		Invoke-DotnetPublish -ProjectPath $runtimeHostProject -Arguments @(
			'-f', $runtimeHostTfm,
			'-c', $Configuration,
			'-r', $Runtime,
			'--self-contained', 'true',
			'-o', $runtimeHostOut
		)

	New-Item -ItemType Directory -Force -Path $apiTrayOut | Out-Null
	Copy-Item -Path (Join-Path $runtimeHostOut '*') -Destination $apiTrayOut -Recurse -Force

		Invoke-DotnetPublish -ProjectPath $installerCliProject -Arguments @(
			'-c', $Configuration,
			'-r', $Runtime,
			'--self-contained', 'true',
			'-o', $installerCliOut
		)

	$userscriptFile = Join-Path $repoRoot 'userscript\dist\organized-jihad.user.js'
	$healthCheckFile = Join-Path $repoRoot 'userscript\scripts\install-health-check.mjs'
	$guideHtml = Join-Path $repoRoot '~docs\installer-guide\tampermonkey-setup.html'
	$guideScreenshots = Join-Path $repoRoot '~docs\installer-guide\screenshots'

	if (-not (Test-Path $userscriptFile)) {
		throw "Userscript payload missing: $userscriptFile"
	}
	if (-not (Test-Path $healthCheckFile)) {
		throw "Install health-check payload missing: $healthCheckFile"
	}
	if (-not (Test-Path $guideHtml)) {
		throw "Tampermonkey setup guide missing: $guideHtml"
	}
	if (-not (Test-Path $guideScreenshots)) {
		throw "Tampermonkey guide screenshots missing: $guideScreenshots"
	}

	Copy-Item -Path $userscriptFile -Destination (Join-Path $bundleRoot 'organized-jihad.user.js') -Force
	Copy-Item -Path $healthCheckFile -Destination (Join-Path $bundleRoot 'install-health-check.mjs') -Force
	Copy-Item -Path $guideHtml -Destination (Join-Path $bundleRoot 'tampermonkey-setup.html') -Force
	Copy-Item -Path $userscriptFile -Destination (Join-Path $installerCliOut 'organized-jihad.user.js') -Force
	Copy-Item -Path $healthCheckFile -Destination (Join-Path $installerCliOut 'install-health-check.mjs') -Force
	Copy-Item -Path $guideHtml -Destination (Join-Path $installerCliOut 'tampermonkey-setup.html') -Force

	$guideScreenshotsOut = Join-Path $bundleRoot 'guide-screenshots'
	New-Item -ItemType Directory -Force -Path $guideScreenshotsOut | Out-Null
	Copy-Item -Path (Join-Path $guideScreenshots '*') -Destination $guideScreenshotsOut -Recurse -Force

	$installerCliScreenshotsOut = Join-Path $installerCliOut 'guide-screenshots'
	New-Item -ItemType Directory -Force -Path $installerCliScreenshotsOut | Out-Null
	Copy-Item -Path (Join-Path $guideScreenshots '*') -Destination $installerCliScreenshotsOut -Recurse -Force

	Write-Host '[OJ Installer UI] Bundle payload refresh complete.' -ForegroundColor Green
}

Write-Host '[OJ Installer UI] Publishing Avalonia installer executable...' -ForegroundColor Cyan
dotnet publish $projectPath -c $Configuration -r $Runtime --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:IncludeAllContentForSelfExtract=true -o (Join-Path $repoRoot $OutputDir)
if ($LASTEXITCODE -ne 0) {
	throw "dotnet publish failed for '$projectPath'"
}

$binaryName = if ($Runtime -like 'win-*') { 'OrganizedJihad.Installer.exe' } else { 'OrganizedJihad.Installer' }
$binaryPath = Join-Path $repoRoot (Join-Path $OutputDir $binaryName)
if (-not (Test-Path -Path $binaryPath)) {
	throw "Publish did not produce expected installer binary at '$binaryPath'."
}

Write-Host "[OJ Installer UI] Ready: $binaryPath" -ForegroundColor Green
