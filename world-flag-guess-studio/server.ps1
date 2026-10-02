param(
    [int]$port = 5500
)

$root = $PSScriptRoot
if (-not $root) { $root = "d:\VideoTools\world-flag-guess-studio" }

# 1. Check if our studio server is already running and healthy on this port
try {
    $ping = Invoke-RestMethod -Uri "http://localhost:$port/api/tts?ping=1" -TimeoutSec 2 -ErrorAction Stop
    if ($ping.server -eq "world-flag-guess-studio") {
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "   World Flag Guess Studio is ALREADY running!            " -ForegroundColor Green
        Write-Host "   URL: http://localhost:$port/index.html                 " -ForegroundColor Yellow
        Write-Host "   Opening your web browser now...                        " -ForegroundColor Cyan
        Write-Host "==========================================================" -ForegroundColor Green
        Start-Process "http://localhost:$port/index.html"
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

# 3. If port is in use by an orphaned PowerShell instance, free it or find next available port
if (Test-PortInUse $port) {
    Write-Host "Port $port has an existing process. Checking ownership..." -ForegroundColor Yellow
    $tcp = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" } | Select-Object -First 1
    if ($tcp -and $tcp.OwningProcess -and $tcp.OwningProcess -ne $PID) {
        $proc = Get-Process -Id $tcp.OwningProcess -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -like "*powershell*") {
            Write-Host "Closing stale background server process ($($proc.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 600
        }
    }
}

# Auto-increment port if 5500 is still busy by another application
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
    Write-Host "   World Flag Guess Studio Local Server Running!          " -ForegroundColor Green
    Write-Host "   URL: http://localhost:$port/index.html                 " -ForegroundColor Yellow
    Write-Host "   Root: $root                                            " -ForegroundColor Gray
    if ($detectedFfmpeg) {
        Write-Host "   Video Optimizer: FastStart H.264 Active ($detectedFfmpeg)" -ForegroundColor Green
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

            # Crucial CORS & Private Network Access (PNA) Headers
            # Enables file:/// origins and local browser tabs to reach localhost:5500 without security blocks
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Private-Network", "true")
            $response.AddHeader("Access-Control-Allow-Headers", "*")
            $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            $localPath = $request.Url.LocalPath

            # Handle Universal MP4 Remux Endpoint (/api/remux-mp4)
            # Transforms fragmented MediaRecorder MP4 into 100% universal FastStart progressive MP4 for mobile & desktop
            if ($localPath -eq "/api/remux-mp4") {
                $filename = $request.QueryString["filename"]
                if (-not $filename) { $filename = "world-flag-quiz_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".mp4" }
                
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
                    if (Test-Path $tempIn) { Remove-Item $tempIn -Force -ErrorAction SilentlyContinue }
                    if (Test-Path $tempOut) { Remove-Item $tempOut -Force -ErrorAction SilentlyContinue }
                    $response.Close()
                }
                continue
            }

            # Handle File Saving Endpoint (/api/save-file) for testing and disk output
            if ($localPath -eq "/api/save-file") {
                $filename = $request.QueryString["filename"]
                if (-not $filename) { $filename = "saved_file_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".mp4" }
                $outPath = Join-Path $root $filename
                $ms = New-Object System.IO.MemoryStream
                $request.InputStream.CopyTo($ms)
                [System.IO.File]::WriteAllBytes($outPath, $ms.ToArray())
                $ms.Dispose()

                # If this is an MP4, apply FastStart progressive optimization so disk file is mobile-ready
                if ($filename.ToLower().EndsWith(".mp4")) {
                    $tempOptimized = Join-Path $root ("temp_opt_" + [System.Guid]::NewGuid().ToString("N") + ".mp4")
                    $optOk = Remux-ToUniversalMp4 $outPath $tempOptimized
                    if ($optOk -and (Test-Path $tempOptimized)) {
                        Move-Item $tempOptimized $outPath -Force
                    } else {
                        if (Test-Path $tempOptimized) { Remove-Item $tempOptimized -Force -ErrorAction SilentlyContinue }
                    }
                }

                $response.ContentType = "application/json"
                $resBytes = [System.Text.Encoding]::UTF8.GetBytes('{"success":true,"file":"' + $filename + '"}')
                $response.ContentLength64 = $resBytes.Length
                $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
                $response.Close()
                continue
            }

            # Quick status/ping check
            if ($localPath -eq "/api/status") {
                $response.ContentType = "application/json"
                $statusJson = '{"status":"ok","server":"world-flag-guess-studio","port":' + $port + ',"ffmpeg":' + $(if ($detectedFfmpeg) { 'true' } else { 'false' }) + '}'
                $sBytes = [System.Text.Encoding]::UTF8.GetBytes($statusJson)
                $response.ContentLength64 = $sBytes.Length
                $response.OutputStream.Write($sBytes, 0, $sBytes.Length)
                $response.Close()
                continue
            }

            # Handle TTS Audio Generation Endpoint (/api/tts)
            if ($localPath -eq "/api/tts") {
                # Quick healthcheck / ping support
                if ($request.QueryString["test"] -or $request.QueryString["ping"] -or $request.QueryString["status"]) {
                    $response.ContentType = "application/json"
                    $healthJson = '{"status":"ok","server":"world-flag-guess-studio","port":5500,"voices":["google","david","zira"]}'
                    $hBytes = [System.Text.Encoding]::UTF8.GetBytes($healthJson)
                    $response.ContentLength64 = $hBytes.Length
                    if ($request.HttpMethod -ne "HEAD") {
                        $response.OutputStream.Write($hBytes, 0, $hBytes.Length)
                    }
                    $response.Close()
                    continue
                }

                $text = $request.QueryString["text"]
                $voice = $request.QueryString["voice"]
                if (-not $text) { $text = "Welcome to world flag guess studio!" }
                if (-not $voice) { $voice = "google" }

                try {
                    $audioBytes = $null
                    $contentType = "audio/wav"

                    $isGoogle = ($voice -eq "google" -or $voice -like "*google*" -or $voice -like "*natural*")
                    if ($isGoogle) {
                        try {
                            $subText = if ($text.Length -gt 130) { $text.Substring(0, 130) } else { $text }
                            $encodedChunk = [System.Uri]::EscapeDataString($subText)
                            $googleUrl = "https://translate.google.com/translate_tts?ie=UTF-8&q=$encodedChunk&tl=en&client=tw-ob"
                            $wc = New-Object System.Net.WebClient
                            $wc.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                            $audioBytes = $wc.DownloadData($googleUrl)
                            if ($audioBytes -and $audioBytes.Length -gt 0) {
                                $contentType = "audio/mpeg"
                            }
                        } catch {
                            $audioBytes = $null
                        }
                    }

                    if (-not $audioBytes -or $audioBytes.Length -eq 0) {
                        # Local Windows SAPI Speech Synthesis - 100% Offline, Instant & High Quality
                        Add-Type -AssemblyName System.Speech
                        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
                        $installedVoices = @($synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })

                        $selectedVoiceName = $null
                        $cleanVoice = ($voice -replace '^native:', '').Trim()

                        # 1. Try exact or partial match on installed voice names
                        if ($cleanVoice) {
                            foreach ($iv in $installedVoices) {
                                if ($iv -eq $cleanVoice -or $iv -like "*$cleanVoice*") {
                                    $selectedVoiceName = $iv
                                    break
                                }
                            }
                        }

                        # 2. Check for female / Zira intent
                        if (-not $selectedVoiceName -and ($voice -like "*zira*" -or $voice -like "*female*")) {
                            $selectedVoiceName = ($installedVoices | Where-Object { $_ -like "*zira*" -or $_ -like "*female*" } | Select-Object -First 1)
                            if (-not $selectedVoiceName) { $selectedVoiceName = "Microsoft Zira Desktop" }
                        }

                        # 3. Check for male / David intent
                        if (-not $selectedVoiceName -and ($voice -like "*david*" -or $voice -like "*male*")) {
                            $selectedVoiceName = ($installedVoices | Where-Object { $_ -like "*david*" -or $_ -like "*male*" } | Select-Object -First 1)
                            if (-not $selectedVoiceName) { $selectedVoiceName = "Microsoft David Desktop" }
                        }

                        # 4. Fallback to any installed voice
                        if (-not $selectedVoiceName -and $installedVoices.Count -gt 0) {
                            $selectedVoiceName = $installedVoices[0]
                        }
                        if (-not $selectedVoiceName) {
                            $selectedVoiceName = "Microsoft David Desktop"
                        }

                        try {
                            $synth.SelectVoice($selectedVoiceName)
                        } catch {
                            # If specific voice selection failed, synth uses default
                        }

                        $ms = New-Object System.IO.MemoryStream
                        $synth.SetOutputToWaveStream($ms)
                        $synth.Speak($text)
                        $audioBytes = $ms.ToArray()
                        $synth.Dispose()
                        $ms.Dispose()
                        $contentType = "audio/wav"
                    }

                    $response.ContentType = $contentType
                    $response.ContentLength64 = $audioBytes.Length
                    if ($request.HttpMethod -ne "HEAD") {
                        $response.OutputStream.Write($audioBytes, 0, $audioBytes.Length)
                    }
                } catch {
                    $response.StatusCode = 500
                    $errBytes = [System.Text.Encoding]::UTF8.GetBytes("TTS Error: " + $_.Exception.Message)
                    $response.ContentLength64 = $errBytes.Length
                    if ($request.HttpMethod -ne "HEAD") {
                        $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
                    }
                }
                $response.Close()
                continue
            }

            # Handle Favicon cleanly (never 404)
            $cleanPath = [System.Uri]::UnescapeDataString($localPath).TrimStart('/')
            if ($cleanPath -eq "favicon.ico") {
                $response.ContentType = "image/svg+xml"
                $svgIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🌐</text></svg>'
                $svgBytes = [System.Text.Encoding]::UTF8.GetBytes($svgIcon)
                $response.ContentLength64 = $svgBytes.Length
                $response.OutputStream.Write($svgBytes, 0, $svgBytes.Length)
                $response.Close()
                continue
            }

            # Map requested path to local files across workspace
            $targetDir = $root
            $path = $cleanPath

            if ($path -like "find-animal-dance-studio/*") {
                $path = $path.Substring(25)
                $targetDir = "d:\VideoTools\find-animal-dance-studio"
            } elseif ($path -eq "find-animal-dance-studio" -or $path -eq "find-animal-dance-studio/") {
                $path = "index.html"
                $targetDir = "d:\VideoTools\find-animal-dance-studio"
            } elseif ($path -like "world-flag-guess-studio/*") {
                $path = $path.Substring(24)
                $targetDir = "d:\VideoTools\world-flag-guess-studio"
            } elseif ($path -like "100-countryguess/*") {
                $path = $path.Substring(17)
            } elseif ($path -like "QuizForge-Studio/*") {
                $path = $path.Substring(17)
            } elseif ($path -eq "world-flag-guess-studio" -or $path -eq "100-countryguess" -or $path -eq "QuizForge-Studio") {
                $path = "index.html"
            }

            if (-not $path -or $path -eq "" -or $path -eq "/") { 
                $path = "index.html" 
            }

            $filePath = Join-Path $targetDir ($path.Replace('/', '\'))

            # Fallback checks across workspace
            if (-not (Test-Path $filePath -PathType Leaf)) {
                $altPath1 = Join-Path $root ($cleanPath.Replace('/', '\'))
                $altPath2 = Join-Path "d:\VideoTools" ($cleanPath.Replace('/', '\'))
                if (Test-Path $altPath1 -PathType Leaf) {
                    $filePath = $altPath1
                } elseif (Test-Path $altPath2 -PathType Leaf) {
                    $filePath = $altPath2
                }
            }

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = switch ($ext) {
                    ".html" { "text/html; charset=utf-8" }
                    ".js"   { "application/javascript; charset=utf-8" }
                    ".css"  { "text/css; charset=utf-8" }
                    ".json" { "application/json; charset=utf-8" }
                    ".png"  { "image/png" }
                    ".jpg"  { "image/jpeg" }
                    ".webp" { "image/webp" }
                    ".svg"  { "image/svg+xml" }
                    ".mp4"  { "video/mp4" }
                    ".webm" { "video/webm" }
                    ".mp3"  { "audio/mp3" }
                    ".wav"  { "audio/wav" }
                    default { "application/octet-stream" }
                }
                $response.ContentType = $mime
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length

                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($bytes, 0, $bytes.Length)
                }
            } else {
                $response.StatusCode = 404
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path (Resolved: $filePath)")
                Write-Host "404: $localPath (Resolved: $filePath)" -ForegroundColor Red
                $response.ContentLength64 = $msg.Length
                if ($request.HttpMethod -ne "HEAD") {
                    $response.OutputStream.Write($msg, 0, $msg.Length)
                }
            }
            $response.Close()
        } catch {
            # Catch client disconnects silently
        }
    }
} finally {
    if ($listener -ne $null) {
        try { if ($listener.IsListening) { $listener.Stop() } } catch {}
        try { $listener.Close() } catch {}
    }
}
