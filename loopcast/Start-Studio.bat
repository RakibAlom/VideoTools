@echo off
chcp 65001 >nul
title EasyLoop Cast - Studio and RTMP Broadcaster
cd /d "%~dp0"

echo ===================================================
echo     EASYLOOP CAST - LIVE BROADCASTER LAUNCHER
echo     (YouTube, Facebook, Instagram, TikTok)
echo ===================================================
echo.

:: Add known Python and FFmpeg install locations to PATH automatically
set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin;%PATH%"

:: Check if Python is available
python --version >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :USE_PYTHON

:: Check if Node.js is available
node -v >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :USE_NODE

:: Fallback: Open index.html directly in browser
echo [Notice] Neither Python nor Node.js was found in PATH.
echo Opening EasyLoop Cast directly in your web browser...
start "" "%~dp0index.html"
echo.
echo Press any key to exit...
pause >nul
exit /b 0

:USE_PYTHON
echo [Python Engine] Verifying dependencies...
python -c "import websockets, uvicorn, fastapi" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [Setup] Installing required packages...
    python -m pip install websockets uvicorn fastapi
)

echo.
echo [Launch] Starting Studio and RTMP Bridge on http://localhost:3000 ...
echo [Notice] Keep this window OPEN while broadcasting live!
echo.
start "" "http://localhost:3000/"
python bridge.py
echo.
echo Server stopped.
pause
exit /b 0

:USE_NODE
echo [Node.js Engine] Checking dependencies...
if not exist "node_modules\ws" (
    call npm install ws
)
echo.
echo [Launch] Starting Studio and RTMP Bridge on http://localhost:3000 ...
start "" "%~dp0index.html"
node server.js
echo.
echo Server stopped.
pause
exit /b 0
