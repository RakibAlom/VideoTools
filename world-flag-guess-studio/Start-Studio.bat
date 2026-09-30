@echo off
title World Flag Guess Studio Launcher
cd /d "%~dp0"

echo ======================================================
echo    Starting World Flag Guess Studio Local Server...
echo ======================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server stopped or encountered an issue.
    pause
)
