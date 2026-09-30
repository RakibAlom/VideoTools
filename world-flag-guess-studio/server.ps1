$port = 5500
$root = $PSScriptRoot
if (-not $root) { $root = "d:\VideoTools\world-flag-guess-studio" }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "   World Flag Guess Studio Local Server Running!          " -ForegroundColor Green
    Write-Host "   URL: http://localhost:$port/index.html                 " -ForegroundColor Yellow
    Write-Host "   Root: $root                                            " -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C in this console to stop the server." -ForegroundColor Gray

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
            $response.AddHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }

            $localPath = $request.Url.LocalPath

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
                    if ($voice -eq "google" -or $voice -like "*google*" -or $voice -like "*natural*") {
                        # Google Voice TTS Proxy with automatic sentence/word chunking for long texts
                        $webClient = New-Object System.Net.WebClient
                        $webClient.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                        
                        $chunks = @()
                        if ($text.Length -le 140) {
                            $chunks += $text
                        } else {
                            $words = $text -split '\s+'
                            $curr = ""
                            foreach ($w in $words) {
                                if (($curr.Length + $w.Length + 1) -gt 130) {
                                    if ($curr.Length -gt 0) { $chunks += $curr }
                                    $curr = $w
                                } else {
                                    if ($curr.Length -eq 0) { $curr = $w } else { $curr += " " + $w }
                                }
                            }
                            if ($curr.Length -gt 0) { $chunks += $curr }
                        }

                        $allBytes = New-Object System.Collections.Generic.List[byte]
                        foreach ($chunk in $chunks) {
                            $encodedChunk = [System.Uri]::EscapeDataString($chunk)
                            $googleUrl = "https://translate.google.com/translate_tts?ie=UTF-8&q=$encodedChunk&tl=en&client=tw-ob"
                            $chunkBytes = $webClient.DownloadData($googleUrl)
                            if ($chunkBytes -and $chunkBytes.Length -gt 0) {
                                $allBytes.AddRange($chunkBytes)
                            }
                        }
                        $audioBytes = $allBytes.ToArray()
                        $response.ContentType = "audio/mpeg"
                        $response.ContentLength64 = $audioBytes.Length
                        if ($request.HttpMethod -ne "HEAD") {
                            $response.OutputStream.Write($audioBytes, 0, $audioBytes.Length)
                        }
                    } else {
                        # Local Windows SAPI Speech Synthesis (Microsoft David / Zira)
                        Add-Type -AssemblyName System.Speech
                        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
                        if ($voice -like "*zira*" -or $voice -like "*female*") {
                            $synth.SelectVoice("Microsoft Zira Desktop")
                        } else {
                            $synth.SelectVoice("Microsoft David Desktop")
                        }
                        $ms = New-Object System.IO.MemoryStream
                        $synth.SetOutputToWaveStream($ms)
                        $synth.Speak($text)
                        $audioBytes = $ms.ToArray()
                        $synth.Dispose()
                        $ms.Dispose()

                        $response.ContentType = "audio/wav"
                        $response.ContentLength64 = $audioBytes.Length
                        if ($request.HttpMethod -ne "HEAD") {
                            $response.OutputStream.Write($audioBytes, 0, $audioBytes.Length)
                        }
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

            # Map requested path to local files
            $path = $localPath.TrimStart('/')
            if ($path -like "world-flag-guess-studio/*") {
                $path = $path.Substring(24)
            } elseif ($path -like "100-countryguess/*") {
                $path = $path.Substring(17)
            } elseif ($path -like "QuizForge-Studio/*") {
                $path = $path.Substring(17)
            } elseif ($path -eq "world-flag-guess-studio" -or $path -eq "100-countryguess" -or $path -eq "QuizForge-Studio") {
                $path = "index.html"
            }

            if (-not $path -or $path -eq "") { 
                $path = "index.html" 
            }

            $filePath = Join-Path $root $path

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
                $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path in world-flag-guess-studio")
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
    $listener.Stop()
}
