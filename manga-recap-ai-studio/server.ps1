# MangaRecap AI Studio 2.0 - Server Launcher
param(
    [int]$port = 5503
)

$root = $PSScriptRoot
if (-not $root) { $root = "d:\VideoTools\manga-recap-ai-studio" }

# 1. Check if our studio server is already running and healthy on this port
try {
    $ping = Invoke-RestMethod -Uri "http://localhost:$port/api/config" -TimeoutSec 2 -ErrorAction Stop
    if ($ping.server_port -eq $port -or $ping.default_voice_provider) {
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "   MangaRecap AI Studio is ALREADY running!               " -ForegroundColor Green
        Write-Host "   URL: http://localhost:$port/                           " -ForegroundColor Yellow
        Write-Host "   Opening your web browser now...                        " -ForegroundColor Cyan
        Write-Host "==========================================================" -ForegroundColor Green
        Start-Process "http://localhost:$port/"
        Start-Sleep -Seconds 2
        exit 0
    }
} catch {
    # Server not responding or not running yet, proceed with startup
}

# 2. Function to check if a port is in use
function Test-PortInUse([int]$p) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    return ($conns | Where-Object { $_.State -eq "Listen" }) -ne $null
}

# 3. If port is in use by an orphaned process, terminate it or auto-increment
if (Test-PortInUse $port) {
    Write-Host "Port $port has an existing process. Checking ownership..." -ForegroundColor Yellow
    $tcp = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" } | Select-Object -First 1
    if ($tcp -and $tcp.OwningProcess -and $tcp.OwningProcess -ne $PID) {
        $proc = Get-Process -Id $tcp.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and ($proc.ProcessName -like "*python*" -or $proc.ProcessName -like "*uvicorn*")) {
            Write-Host "Closing stale background server process ($($proc.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 600
        }
    }
}

while (Test-PortInUse $port) {
    Write-Host "Port $port is currently in use, trying port $($port + 1)..." -ForegroundColor Yellow
    $port++
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   MangaRecap AI Studio 2.0 Server Starting!              " -ForegroundColor Green
Write-Host "   URL: http://localhost:$port/                           " -ForegroundColor Yellow
Write-Host "   Root: $root                                            " -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Press Ctrl+C in this console to stop the server.`n" -ForegroundColor Gray

Start-Process "http://localhost:$port/"

Set-Location $root
python -m uvicorn main:app --host 127.0.0.1 --port $port
