@echo off
title Karaoke Video Studio Launcher
echo ======================================================
echo    Starting Karaoke Video Studio Local Server...
echo ======================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause