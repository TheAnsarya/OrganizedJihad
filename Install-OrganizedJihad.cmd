@echo off
setlocal

set SCRIPT_DIR=%~dp0
set SCRIPT_PATH=%SCRIPT_DIR%Install-OrganizedJihad.ps1

if not exist "%SCRIPT_PATH%" (
	echo [OJ Installer] Could not find Install-OrganizedJihad.ps1 next to this file.
	exit /b 1
)

pwsh -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%" %*
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
	echo [OJ Installer] Failed with exit code %EXIT_CODE%.
	exit /b %EXIT_CODE%
)

echo [OJ Installer] Completed successfully.
exit /b 0
