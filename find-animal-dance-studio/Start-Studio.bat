@echo off
title Animal Dance Studio Launcher
echo ======================================================
echo    Starting Animal Dance Studio Local Server...
echo ======================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
