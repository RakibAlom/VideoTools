@echo off
title World Flag Guess Studio Launcher
echo ======================================================
echo    Starting World Flag Guess Studio Local Server...
echo ======================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
