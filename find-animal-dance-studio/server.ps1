# Animal Dance Studio - Zero-Dependency Local HTTP Server with Universal MP4 Optimizer
param(
    [int]$port = 5501
)

$root = $PSScriptRoot
if (-not $root) { $root = "d:\VideoTools\find-animal-dance-studio" }

# Function to test if a port is in use
function Test-PortInUse([int]$p) {
    $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    return ($conns | Where-Object { $_.State -eq "Listen" }) -ne $null
}

# Auto-increment port if 5501 is busy
while (Test-PortInUse $port) {
    Write-Host "Port $port is currently in use, trying port $($port + 1)..." -ForegroundColor Yellow
    $port++
}

function Find-FFmpeg {
    # 1. Local bin folder inside project
    $local = Join-Path $root "bin\ffmpeg.exe"
    if (Test-Path $local) {
        try {
            $p = Start-Process -FilePath $local -ArgumentList "-version" -NoNewWindow -Wait -PassThru -ErrorAction Stop
            if ($p.ExitCode -eq 0) { return $local }
        } catch {}
    }

    # 2. CapCut Apps directory (user's system has CapCut with working ffmpeg)
    $capcutDir = Join-Path $env:LOCALAPPDATA "CapCut\Apps"
    if (Test-Path $capcutDir) {
        $capFfmpeg = Get-ChildItem -Path $capcutDir -Filter "ffmpeg.exe" -Recurse -ErrorAction SilentlyContinue |
            Sort-Object { $_.DirectoryName } -Descending |
            Select-Object -First 1 -ExpandProperty FullName
        if ($capFfmpeg -and (Test-Path $capFfmpeg)) { return $capFfmpeg }
    }

    # 3. System PATH
    $cmd = Get-Command "ffmpeg" -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source) { return $cmd.Source }

    # 4. WinGet or AppData locations
    $wingetDir = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path $wingetDir) {
        $wingetFfmpeg = Get-ChildItem -Path $wingetDir -Filter "ffmpeg.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
        if ($wingetFfmpeg -and (Test-Path $wingetFfmpeg)) { return $wingetFfmpeg }
    }

    return $null
}

function Remux-ToUniversalMp4([string]$inPath, [string]$outPath) {
    $ffmpegPath = Find-FFmpeg
    if (-not $ffmpegPath) {
        Write-Host "Notice: FFmpeg not detected. Using source video container directly." -ForegroundColor Yellow
        return $false
    }

    $ffmpegDir = Split-Path $ffmpegPath
    $args = @("-y", "-i", $inPath, "-c", "copy", "-movflags", "+faststart", $outPath)
    try {
        $proc = Start-Process -FilePath $ffmpegPath -ArgumentList $args -WorkingDirectory $ffmpegDir -NoNewWindow -Wait -PassThru
        if ($proc.ExitCode -eq 0 -and (Test-Path $outPath) -and (Get-Item $outPath).Length -gt 1000) {
            Write-Host "Universal MP4 FastStart progressive optimization complete!" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "FFmpeg execution error: $_" -ForegroundColor Red
    }
    return $false
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    $detectedFfmpeg = Find-FFmpeg
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "   Animal Dance Studio - Local Server Running!            " -ForegroundColor Green
    Write-Host "   URL: http://localhost:$port/index.html                 " -ForegroundColor Yellow
    Write-Host "   Root: $root                                            " -ForegroundColor Gray
    if ($detectedFfmpeg) {
        Write-Host "   Video Optimizer: FastStart Universal MP4 ($detectedFfmpeg)" -ForegroundColor Green
    } else {
        Write-Host "   Video Optimizer: Client-side MP4 Fixer Active          " -ForegroundColor Yellow
    }
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C in this console to stop the server.`n" -ForegroundColor Gray

    # Launch browser automatically
    Start-Process "http://localhost:$port/index.html"

    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
            $request = $context.Request
            $response = $context.Response

            # CORS & Private Network Access Headers
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Private-Network", "true")
            $response.AddHeader("Access-Control-Allow-Headers", "*")
            $response.AddHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            # Handle Universal MP4 Remux Endpoint (/api/remux-mp4)
            # Transforms fragmented MediaRecorder MP4 into 100% universal FastStart progressive MP4 for mobile & desktop
            if ($request.HttpMethod -eq "POST" -and $request.Url.LocalPath -eq "/api/remux-mp4") {
                $filename = $request.QueryString["filename"]
                if (-not $filename) { $filename = "find-animals_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".mp4" }
                
                $tempIn = Join-Path $root ("temp_in_" + [System.Guid]::NewGuid().ToString("N") + ".mp4")
                $tempOut = Join-Path $root ("temp_out_" + [System.Guid]::NewGuid().ToString("N") + ".mp4")
                $finalDiskPath = Join-Path $root $filename

                try {
                    $fileStream = [System.IO.File]::Create($tempIn)
                    $request.InputStream.CopyTo($fileStream)
                    $fileStream.Close()

                    $remuxOk = Remux-ToUniversalMp4 $tempIn $tempOut
                    $outputFileToSend = if ($remuxOk -and (Test-Path $tempOut)) { $tempOut } else { $tempIn }

                    # Save copy to disk in studio folder
                    Copy-Item $outputFileToSend -Destination $finalDiskPath -Force

                    $bytes = [System.IO.File]::ReadAllBytes($outputFileToSend)
                    $response.ContentType = "video/mp4"
                    $response.AddHeader("Content-Disposition", "attachment; filename=`"$filename`"")
                    $response.AddHeader("X-Remux-Status", $(if ($remuxOk) { "faststart_progressive_mp4" } else { "raw_fmp4" }))
                    $response.ContentLength64 = $bytes.Length
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                } catch {
                    $response.StatusCode = 500
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"' + $_.Exception.Message + '"}')
                    $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                } finally {
                    $response.Close()
                    if (Test-Path $tempIn) { Remove-Item $tempIn -Force -ErrorAction SilentlyContinue }
                    if (Test-Path $tempOut) { Remove-Item $tempOut -Force -ErrorAction SilentlyContinue }
                }
                continue
            }

            if ($request.HttpMethod -eq "POST" -and $request.Url.LocalPath -eq "/api/save-file") {
                $fileName = $request.QueryString["filename"]
                if (-not $fileName) { $fileName = "downloaded_video.mp4" }
                $savePath = Join-Path $root $fileName

                $tempRaw = Join-Path $root ("temp_raw_" + [System.Guid]::NewGuid().ToString("N") + ".mp4")
                try {
                    $fs = [System.IO.File]::Create($tempRaw)
                    $request.InputStream.CopyTo($fs)
                    $fs.Close()

                    if ($fileName.ToLower().EndsWith(".mp4")) {
                        $optOk = Remux-ToUniversalMp4 $tempRaw $savePath
                        if (-not $optOk -or -not (Test-Path $savePath)) {
                            Copy-Item $tempRaw -Destination $savePath -Force
                        }
                    } else {
                        Copy-Item $tempRaw -Destination $savePath -Force
                    }

                    $response.StatusCode = 200
                    $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true,"path":"' + $savePath.Replace("\", "\\") + '"}')
                    $response.ContentType = "application/json"
                    $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                } finally {
                    if (Test-Path $tempRaw) { Remove-Item $tempRaw -Force -ErrorAction SilentlyContinue }
                    $response.Close()
                }
                continue
            }

            $localPath = $request.Url.LocalPath
            if ($localPath -eq "/" -or $localPath -eq "") {
                $localPath = "/index.html"
            }

            # Map to filesystem
            $cleanRelative = $localPath.TrimStart("/").Replace("/", "\")
            $filePath = Join-Path $root $cleanRelative

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = "application/octet-stream"

                switch ($ext) {
                    ".html" { $contentType = "text/html; charset=utf-8" }
                    ".css"  { $contentType = "text/css; charset=utf-8" }
                    ".js"   { $contentType = "application/javascript; charset=utf-8" }
                    ".json" { $contentType = "application/json; charset=utf-8" }
                    ".jpg"  { $contentType = "image/jpeg" }
                    ".jpeg" { $contentType = "image/jpeg" }
                    ".png"  { $contentType = "image/png" }
                    ".gif"  { $contentType = "image/gif" }
                    ".svg"  { $contentType = "image/svg+xml" }
                    ".webp" { $contentType = "image/webp" }
                    ".mp3"  { $contentType = "audio/mpeg" }
                    ".wav"  { $contentType = "audio/wav" }
                    ".ogg"  { $contentType = "audio/ogg" }
                    ".webm" { $contentType = "video/webm" }
                    ".mp4"  { $contentType = "video/mp4" }
                }

                $response.ContentType = $contentType
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length

                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
                $response.Close()
            } else {
                $response.StatusCode = 404
                $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
                $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                $response.Close()
            }
        } catch {
            # Client disconnect or minor socket error
        }
    }
} catch {
    Write-Host "Server Error: $_" -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}