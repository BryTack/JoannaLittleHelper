@echo off
title JLH Stop
cd /d "%~dp0"

echo ==============================================
echo   Joanna's Little Helper - Stop Services
echo ==============================================
echo.

:: Step 1: Kill processes listening on JLH ports
echo [..] Stopping services on ports 3000, 3002, 3003...
for %%P in (3000 3002 3003) do (
    for /f "tokens=5" %%i in ('netstat -ano 2^>nul ^| findstr ":%%P " ^| findstr "LISTENING"') do (
        echo      Port %%P: killing PID %%i
        taskkill /PID %%i /F /T >nul 2>&1
    )
)

:: Step 2: Close any remaining cmd windows launched by start-jlh.bat
echo [..] Closing service windows...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-jlh.ps1"

echo.
echo [OK] Done.
