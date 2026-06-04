@echo off
setlocal

set REPO_DIR=%~dp0

where dotnet >nul 2>&1
if %errorlevel% neq 0 (
	echo [OJ Installer] .NET SDK is required but dotnet was not found on PATH.
	echo [OJ Installer] Install .NET SDK 10 and retry.
	exit /b 1
)

pushd "%REPO_DIR%"
dotnet run --project installer-core\OrganizedJihad.Installer.Cli -- --run-install-health-check %*
set EXIT_CODE=%ERRORLEVEL%
popd

if not "%EXIT_CODE%"=="0" (
	echo [OJ Installer] Failed with exit code %EXIT_CODE%.
	exit /b %EXIT_CODE%
)

echo [OJ Installer] Completed successfully.
exit /b 0
