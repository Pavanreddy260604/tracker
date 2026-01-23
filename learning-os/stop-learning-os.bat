@echo off
echo Stopping Learning OS...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM ollama_llama_server.exe /T >nul 2>&1
taskkill /F /IM ollama.exe /T >nul 2>&1
echo.
echo All processes stopped.
pause
