@echo off
title JLH Restart
cd /d "%~dp0"

call stop-jlh.bat

echo.
echo [..] Waiting for services to clear...
timeout /t 2 /nobreak >nul

echo [..] Launching JLH...
start "JLH Launcher" cmd /k start-jlh.bat
