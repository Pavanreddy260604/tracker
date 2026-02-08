@echo off
setlocal
title Learning OS Launcher

echo ========================================================
echo       Starting Learning OS (Silent Mode)
echo ========================================================
echo.

:: 1. Database and AI connection check
echo [1/3] Verifying Services...
sc query MongoDB >nul 2>&1
if %errorlevel% equ 0 ( echo    - MongoDB Connection: ACTIVE )

curl http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% equ 0 ( echo    - AI Service (Ollama): ACTIVE )

:: 2. Launch Servers Silently
echo [2/3] Launching Background Services...
echo    - Starting Backend Server...
echo    - Starting Script Writer Service...
echo    - Starting Chroma Vector DB...
echo    - Starting Frontend Server...
:: Using wscript to run the VBS file which hides the windows
wscript "silent-start.vbs"

:: 3. Launch UI in App Mode
echo.
echo [WAIT] Waiting 15 seconds for services to be ready...
timeout /t 15 /nobreak >nul

echo [3/3] Opening Application...
:: Try Chrome/Edge in App Mode
start chrome --app=http://localhost:5173 2>nul
if %errorlevel% neq 0 (
    start msedge --app=http://localhost:5173 2>nul
    if %errorlevel% neq 0 (
        start http://localhost:5173
    )
)

echo.
echo ========================================================
echo    Learning OS is running in the background.
echo    To STOP the servers later, run: stop-learning-os.bat
echo    (I will create this stop script for you next)
echo ========================================================
timeout /t 5 >nul
exit
