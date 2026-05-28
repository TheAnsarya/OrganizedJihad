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
	powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','""%~f0" %*"' -Verb RunAs"
	if %errorlevel% neq 0 (
		echo [OJ Installer] Elevation request failed or was cancelled.
		exit /b %errorlevel%
	)
	exit /b 0
)

pwsh -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
	echo [OJ Installer] Failed with exit code %EXIT_CODE%.
	exit /b %EXIT_CODE%
)

echo [OJ Installer] Completed successfully.
exit /b 0
