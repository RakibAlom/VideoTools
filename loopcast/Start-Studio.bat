@echo off
title EasyLoop Cast Launcher
cd /d "%~dp0"

echo ===================================================
echo               EASYLOOP CAST - LIVE BROADCASTER
echo ===================================================
echo Starting EasyLoop Cast local broadcast server...
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Python detected. Starting local HTTP server on port 8080...
    start "" http://localhost:8080/index.html
    python -m http.server 8080
) else (
    echo Opening EasyLoop Cast directly in your default browser...
    start "" "%~dp0index.html"
)
pause
