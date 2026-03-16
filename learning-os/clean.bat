@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       Learning OS - Repository Cleanup
echo ========================================================
echo.

echo [1/3] Removing Build Artifacts and Cache...
:: Use specialized PowerShell command for faster recursive deletion to avoid "Path too long"
powershell -Command "Get-ChildItem -Path . -Include node_modules,dist,build,.turbo,.next -Recurse -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"

echo [2/3] Removing Redundant Project Folders...
set TRASH_FOLDERS=sample frontend-v2 plans screenshots tmp artifacts tests coverage .pytest_cache
for %%f in (%TRASH_FOLDERS%) do (
    if exist "%%f" (
        echo    - Deleting: %%f
        rmdir /s /q "%%f" 2>nul
    )
)

echo [3/3] Cleaning Logs and Temporary Files...
del /s /f /q *.log 2>nul
del /s /f /q *.tmp 2>nul
del /s /f /q npm-debug.log* 2>nul
del /s /f /q yarn-error.log* 2>nul

echo.
echo ========================================================
echo   CLEANUP COMPLETE! 
echo   Redundant files and thick node_modules have been cleared.
echo   Run 'npm run setup' to restore necessary modules.
echo ========================================================
pause
