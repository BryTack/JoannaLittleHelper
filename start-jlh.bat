@echo off
title JLH Launcher
cd /d "%~dp0"

echo ==============================================
echo   Joanna's Little Helper - Launcher
echo ==============================================
echo.

:: --- WebView2 loopback exemption (one-time, requires admin) ---
:: Allows WebView2 to connect to localhost during development.
:: Once set this check passes instantly with no prompt.
CheckNetIsolation.exe LoopbackExempt -s | findstr /i "Win32WebViewHost" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] WebView2 loopback exemption already set
) else (
    echo [..] Setting WebView2 loopback exemption ^(one-time admin prompt^)...
    powershell -Command "Start-Process CheckNetIsolation.exe -ArgumentList 'LoopbackExempt -a -n=Microsoft.Win32WebViewHost_cw5n1h2txyewy' -Verb RunAs -Wait"
    echo [OK] WebView2 loopback exemption set
)

:: --- Presidio service (port 3002) ---
netstat -ano | findstr ":3002 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] Presidio already running on port 3002
) else (
    echo [..] Starting Presidio service...
    start "JLH - Presidio" cmd /k "server\presidio-venv\Scripts\python server\presidioServer.py"
    echo [OK] Presidio started ^(new window^)
)

:: --- AI proxy server (port 3003) ---
netstat -ano | findstr ":3003 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo [OK] AI server already running on port 3003
) else (
    echo [..] Starting AI server...
    start "JLH - AI Server" cmd /k "node --env-file=.env server\aiServer.js"
    echo [OK] AI server started ^(new window^)
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

