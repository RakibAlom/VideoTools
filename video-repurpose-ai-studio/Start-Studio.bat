@echo off
title VideoRepurpose AI Studio
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -port 5504
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server stopped or PowerShell failed. Running direct fallback...
    start http://127.0.0.1:5504
    python -m uvicorn main:app --host 127.0.0.1 --port 5504
    pause
)
