@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       Learning OS - One-Click Setup
echo ========================================================
echo.

:: 1. Dependency Check
echo [1/4] Checking System Dependencies...
node -v >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b 1
)
docker -v >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARNING] Docker is not installed or not in PATH. Infrastructure will not run.
)

:: 2. Recursive Install
echo [2/4] Installing dependencies recursively...
echo    - Root...
call npm install
echo    - Backend...
cd backend && call npm install && cd ..
echo    - Script Writer Service...
cd script-writer-service && call npm install && cd ..
echo    - Frontend...
cd frontend && call npm install && cd ..

:: 3. Environment Variable Setup
echo [3/4] Setting up Environment Variables...

:: Helper to generate random string
for /f "tokens=*" %%a in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set RANDOM_SECRET=%%a
for /f "tokens=*" %%a in ('node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"') do set RANDOM_KEY=%%a

:: Backend ENV
if not exist backend\.env (
    echo    - Creating backend/.env
    copy backend\.env.example backend\.env >nul
    powershell -Command "(gc backend\.env) -replace 'your-super-secret-key-change-this-in-production-minimum-32-chars', '!RANDOM_SECRET!' | Out-File -encoding ASCII backend\.env"
    powershell -Command "(gc backend\.env) -replace '0123456789abcdef0123456789abcdef', '!RANDOM_KEY!' | Out-File -encoding ASCII backend\.env"
)

:: Script Writer ENV
if not exist script-writer-service\.env (
    echo    - Creating script-writer-service/.env
    copy script-writer-service\.env.example script-writer-service\.env >nul
    powershell -Command "(gc script-writer-service\.env) -replace 'your-jwt-secret-here', '!RANDOM_SECRET!' | Out-File -encoding ASCII script-writer-service\.env"
)

:: Frontend ENV
if not exist frontend\.env (
    echo    - Creating frontend/.env
    copy frontend\.env.example frontend\.env >nul
)

:: 4. Final Instructions
echo.
echo ========================================================
echo       SETUP COMPLETE!
echo ========================================================
echo.
echo To run the project, follow these two steps:
echo.
echo 1. Launch Infrastructure (Docker + Chroma):
echo    npm run infra
echo.
echo 2. Launch Application:
echo    npm run app
echo.
echo ========================================================
pause
