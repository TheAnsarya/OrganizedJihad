@echo off
setlocal

set SCRIPT_DIR=%~dp0
set SCRIPT_PATH=%SCRIPT_DIR%Install-OrganizedJihad.ps1

if not exist "%SCRIPT_PATH%" (
	echo [OJ Installer] Could not find Install-OrganizedJihad.ps1 next to this file.
	exit /b 1
)

net session >nul 2>&1
if %errorlevel% neq 0 (
	echo [OJ Installer] Please give us admin privileges so we can install fully.
	echo [OJ Installer] Requesting elevation via Windows UAC...
	set "OJ_ELEVATION_ARGS=%*"
	powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$installer='%~f0'; $args=$env:OJ_ELEVATION_ARGS; if ([string]::IsNullOrWhiteSpace($args)) { Start-Process -FilePath $installer -Verb RunAs } else { Start-Process -FilePath $installer -ArgumentList $args -Verb RunAs }"
	set "OJ_ELEVATION_ARGS="
	if %errorlevel% neq 0 (
		echo [OJ Installer] Elevation request failed or was cancelled.
		exit /b %errorlevel%
	)
	exit /b 0
)

where pwsh >nul 2>&1
if %errorlevel% equ 0 (
	pwsh -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" %*
) else (
	powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" %*
)
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
	echo [OJ Installer] Failed with exit code %EXIT_CODE%.
	exit /b %EXIT_CODE%
)

echo [OJ Installer] Completed successfully.
exit /b 0
