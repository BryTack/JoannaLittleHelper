@echo off
title JLH Launcher
cd /d "%~dp0"

echo ==============================================
echo   Joanna's Little Helper - Launcher
echo ==============================================
echo.

:: --- Presidio service (port 3002) ---
netstat -ano | findstr ":3002 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Presidio already running on port 3002
) else (
    echo [..] Starting Presidio service...
    start "JLH - Presidio" cmd /k "server\presidio-venv\Scripts\python server\presidioServer.py"
    echo [OK] Presidio started ^(new window^)
)

:: --- Dev server (port 3000) ---
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Dev server already running on port 3000
) else (
    echo [..] Starting dev server...
    start "JLH - Dev Server" cmd /k "npm run dev-server"
    echo [OK] Dev server started ^(new window^)
)

:: --- Word ---
tasklist /fi "imagename eq WINWORD.EXE" 2>nul | findstr /i "WINWORD.EXE" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Word is already open
) else (
    echo [..] Launching Word with add-in...
    start "JLH - Word" cmd /k "npm start"
    echo [OK] Word launching ^(new window^)
)

echo.
echo ==============================================
echo   All done. You can close this window.
echo ==============================================
echo.
pause
