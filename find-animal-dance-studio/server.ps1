# Animal Dance Studio - Zero-Dependency Local HTTP Server
param(
    [int]$port = 5501
)

$root = $PSScriptRoot
if (-not $root) { $root = "d:\VideoTools\find-animal-dance-studio" }

# Function to test if a port is in use
function Test-PortInUse([int]$p) {
    $listener = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return ($listener | Where-Object { $_.Port -eq $p }) -ne $null
}

# Auto-increment port if 5501 is busy
while (Test-PortInUse $port) {
    Write-Host "Port $port is currently in use, trying port $($port + 1)..." -ForegroundColor Yellow
    $port++
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "   🦆 Animal Dance Studio - Local Server Running!        " -ForegroundColor Green
    Write-Host "   URL: http://localhost:$port/index.html                 " -ForegroundColor Yellow
    Write-Host "   Root: $root                                            " -ForegroundColor Gray
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
            $response.AddHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")

            if ($request.HttpMethod -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
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
    if ($listener -and $listener.IsListening) {
        $listener.Stop()
    }
}
