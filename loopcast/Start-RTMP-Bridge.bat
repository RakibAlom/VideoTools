@echo off
chcp 65001 >nul
title EasyLoop Cast - Multi-Platform RTMP Bridge
cd /d "%~dp0"

echo ===================================================
echo   EASYLOOP CAST - RTMP LIVE STREAMING BRIDGE
echo   (YouTube * Facebook * Instagram * TikTok * Custom)
echo ===================================================
echo.

:: Add known Python and FFmpeg install locations to PATH automatically
set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin;%PATH%"

:: Check if Bridge is already running and listening on port 3000
netstat -aon | findstr ":3000" | findstr "LISTENING" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ============================================================
    echo  [STATUS: ALREADY ONLINE AND RUNNING]
    echo  The RTMP Bridge Server is ALREADY ACTIVE on ws://localhost:3000!
    echo.
    echo  - You DO NOT need to open this file manually.
    echo  - EasyLoop Cast is already connected and ready to Go Live.
    echo ============================================================
    echo.
    echo If you want to keep the current running server, just close this window.
    echo If you want to FORCE RESTART the server, press any key below...
    pause
    echo.
    echo Stopping old bridge process on port 3000...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
        echo Freeing port 3000 - PID: %%a
        taskkill /F /PID %%a >nul 2>&1
    )
    ping 127.0.0.1 -n 2 >nul
    echo Old process stopped.
    echo.
)

:: Check for FFmpeg first
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] FFmpeg was not found in your system PATH!
    echo Please install FFmpeg or add it to your PATH to stream to YouTube/Facebook.
    echo Download: https://ffmpeg.org/download.html
    echo.
    pause
    exit /b 1
)

:: Check for Python
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [Python Engine Detected] Checking dependencies...
    python -c "import websockets, uvicorn, fastapi" >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [Setup] Installing required Python WebSocket packages...
        python -m pip install websockets uvicorn fastapi
    )
    echo Starting Python RTMP Bridge on ws://localhost:3000...
    python bridge.py
    pause
    exit /b 0
)

:: Check for Node.js fallback
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [Node.js Detected] Checking dependencies...
    if not exist "node_modules\ws" (
        echo Installing ws WebSocket package...
        call npm install ws
    )
    echo Starting Node.js RTMP Bridge on ws://localhost:3000...
    node server.js
    pause
    exit /b 0
)

echo [ERROR] Neither Python nor Node.js was found.
echo Please install Python to run the RTMP bridge.
pause
