@echo off
title MangaRecap AI Studio Launcher
cd /d "%~dp0"

echo ======================================================
echo    Starting MangaRecap AI Studio Local Server...
echo ======================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server stopped or encountered an issue.
    pause
)
