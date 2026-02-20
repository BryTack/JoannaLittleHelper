@echo off
title JLH Stop
cd /d "%~dp0"

echo ==============================================
echo   Joanna's Little Helper - Stop Services
echo ==============================================
echo.

taskkill /fi "windowtitle eq JLH - Presidio"   /T /F >nul 2>&1 && echo [OK] Presidio stopped   || echo [--] Presidio was not running
taskkill /fi "windowtitle eq JLH - AI Server"  /T /F >nul 2>&1 && echo [OK] AI server stopped  || echo [--] AI server was not running
taskkill /fi "windowtitle eq JLH - Dev Server" /T /F >nul 2>&1 && echo [OK] Dev server stopped || echo [--] Dev server was not running
taskkill /fi "windowtitle eq JLH - Word"       /T /F >nul 2>&1 && echo [OK] Word launcher stopped || echo [--] Word launcher was not running

echo.
echo Done.
