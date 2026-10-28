<?php
/**
 * EasyLoop Cast — Universal PHP Live Streaming & RTMP Bridge
 * 100% Native support for Hostinger, cPanel, LiteSpeed, Apache & Nginx
 * Zero terminal needed • Works directly over HTTPS • No WebSocket restrictions
 */

// Disable all buffering & connection abort timeouts for continuous live streaming
@ini_set('zlib.output_compression', 'Off');
@ini_set('output_buffering', 'Off');
@ini_set('implicit_flush', 1);
@ob_implicit_flush(true);
while (ob_get_level() > 0) {
    @ob_end_clean();
}
@set_time_limit(0);
@ignore_user_abort(true);

// CORS Headers for seamless browser access
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Private-Network: true");
header("Access-Control-Allow-Headers: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD");
header("Access-Control-Expose-Headers: Content-Length, Content-Type, X-Stream-Status, X-FFmpeg-Version");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

/**
 * Locate FFmpeg binary on server
 */
function findFFmpegBinary() {
    $commonPaths = [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/bin/ffmpeg',
        '/opt/ffmpeg/ffmpeg',
        '/usr/bin/ffmpeg.exe',
        'ffmpeg'
    ];
    foreach ($commonPaths as $path) {
        if (@is_executable($path) || (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' && @file_exists($path))) {
            return $path;
        }
    }
    if (function_exists('exec')) {
        $cmd = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? 'where ffmpeg 2>nul' : 'which ffmpeg 2>/dev/null';
        $which = @shell_exec($cmd);
        if ($which && trim($which)) {
            $p = strtok(trim($which), "\r\n");
            if (@file_exists($p)) return $p;
        }
    }
    return 'ffmpeg';
}

$action = $_GET['action'] ?? $_GET['endpoint'] ?? '';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);

if (!$action) {
    if (strpos($uri, 'stream') !== false) {
        $action = 'stream';
    } elseif (strpos($uri, 'status') !== false) {
        $action = 'status';
    } elseif (strpos($uri, 'stop') !== false) {
        $action = 'stop';
    }
}

// -------------------------------------------------------------
// 1. HEALTH & CAPABILITY STATUS
// -------------------------------------------------------------
if ($action === 'status' || isset($_GET['ping'])) {
    header('Content-Type: application/json; charset=utf-8');
    $ffmpegBin = findFFmpegBinary();
    $ffmpegOk = false;
    $versionStr = '';

    if (function_exists('exec')) {
        $ver = @shell_exec(escapeshellcmd($ffmpegBin) . ' -version 2>&1');
        if ($ver && strpos($ver, 'ffmpeg version') !== false) {
            $ffmpegOk = true;
            if (preg_match('/ffmpeg version ([^\s]+)/', $ver, $m)) {
                $versionStr = $m[1];
            }
        }
    }

    echo json_encode([
        'status' => 'ok',
        'service' => 'EasyLoop Cast PHP Auto-Engine',
        'ffmpeg' => $ffmpegOk,
        'ffmpegPath' => $ffmpegBin,
        'ffmpegVersion' => $versionStr,
        'phpVersion' => PHP_VERSION,
        'procOpen' => function_exists('proc_open'),
        'server' => $_SERVER['SERVER_SOFTWARE'] ?? 'cPanel / Hostinger',
        'protocol' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http',
        'timestamp' => gmdate('Y-m-d\TH:i:s\Z')
    ]);
    exit;
}

// -------------------------------------------------------------
// 2. LIVE RTMP STREAM INGESTION (Continuous HTTP Streaming)
// -------------------------------------------------------------
if ($action === 'stream') {
    // Read stream parameters from query params or headers
    $rawTargets = $_GET['targets'] ?? $_SERVER['HTTP_X_STREAM_TARGETS'] ?? '';
    $targets = [];

    if ($rawTargets) {
        $decoded = json_decode($rawTargets, true);
        if (is_array($decoded)) {
            $targets = $decoded;
        }
    }

    if (empty($targets)) {
        // Check POST body for JSON setup header
        $headerTarget = $_SERVER['HTTP_X_TARGET_URL'] ?? '';
        if ($headerTarget) {
            $targets[] = ['name' => 'Custom RTMP', 'url' => $headerTarget];
        }
    }

    if (empty($targets)) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'No RTMP broadcast targets specified.']);
        exit;
    }

    $width = intval($_GET['width'] ?? $_SERVER['HTTP_X_STREAM_WIDTH'] ?? 1080);
    $height = intval($_GET['height'] ?? $_SERVER['HTTP_X_STREAM_HEIGHT'] ?? 1920);
    $fps = intval($_GET['fps'] ?? $_SERVER['HTTP_X_STREAM_FPS'] ?? 30);
    $bitrate = intval($_GET['bitrate'] ?? $_SERVER['HTTP_X_STREAM_BITRATE'] ?? 6000);

    // Ensure even dimensions for H.264 YUV420P compatibility
    $width = ($width % 2 === 0) ? $width : ($width + 1);
    $height = ($height % 2 === 0) ? $height : ($height + 1);

    // H.264 profile level
    $h264Level = ($width <= 1920 && $height <= 1920) ? '4.2' : '5.1';

    // Lanczos scale filter
    $scaleFilter = "scale={$width}:{$height}:force_original_aspect_ratio=decrease:flags=lanczos,pad={$width}:{$height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1";

    // Cap bitrate for Facebook if Facebook target is present
    $hasFacebook = false;
    foreach ($targets as $t) {
        if (stripos($t['url'] ?? '', 'facebook') !== false || stripos($t['url'] ?? '', 'fb') !== false) {
            $hasFacebook = true;
            break;
        }
    }
    if ($hasFacebook && $bitrate > 6000) {
        $bitrate = 6000;
    }

    $ffmpegBin = findFFmpegBinary();

    // Build FFmpeg command arguments
    $cmd = escapeshellcmd($ffmpegBin)
        . " -nostats -loglevel warning -f webm -i pipe:0"
        . " -vf " . escapeshellarg($scaleFilter)
        . " -c:v libx264 -preset veryfast -profile:v high -level " . escapeshellarg($h264Level)
        . " -b:v {$bitrate}k -maxrate {$bitrate}k -bufsize " . ($bitrate * 2) . "k"
        . " -pix_fmt yuv420p -r {$fps} -fps_mode cfr -g " . ($fps * 2) . " -keyint_min " . ($fps * 2)
        . " -sc_threshold 0 -x264-params repeat-headers=1:nal-hrd=cbr:force-cfr=1"
        . " -c:a aac -b:a 128k -ar 48000 -ac 2"
        . " -af aresample=async=1:min_hard_comp=0.100:first_pts=0"
        . " -flvflags no_duration_filesize -flags +global_header";

    // Append RTMP output targets (single or multi-stream tee muxer)
    if (count($targets) === 1) {
        $cmd .= " -f flv " . escapeshellarg($targets[0]['url']);
    } else {
        $teeParts = [];
        foreach ($targets as $t) {
            if (!empty($t['url'])) {
                $teeParts[] = "[f=flv:onfail=ignore]" . $t['url'];
            }
        }
        $cmd .= " -f tee -map 0:v -map 0:a " . escapeshellarg(implode('|', $teeParts));
    }

    $nullDev = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? 'NUL' : '/dev/null';
    $descriptors = [
        0 => ["pipe", "r"], // stdin (receives WebM chunks from browser)
        1 => ["file", $nullDev, "w"], // stdout redirected to null so it never blocks or buffers
        2 => ["pipe", "w"]  // stderr non-blocking for error diagnostics
    ];

    $process = @proc_open($cmd, $descriptors, $pipes);

    if (!is_resource($process)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Failed to spawn FFmpeg process on server. Ensure FFmpeg is accessible in system PATH.'
        ]);
        exit;
    }

    // Set non-blocking on stderr
    if (isset($pipes[2]) && is_resource($pipes[2])) {
        stream_set_blocking($pipes[2], 0);
    }

    // Save process PID to temp file for remote stop control
    $streamId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['id'] ?? $_GET['stream_id'] ?? uniqid('stream_', true));
    $pidFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'loopcast_' . $streamId . '.pid';
    $status = proc_get_status($process);
    if (!empty($status['pid'])) {
        @file_put_contents($pidFile, (string)$status['pid']);
    }

    header('Content-Type: application/json');
    header('X-Stream-Status: live');
    header('X-Stream-ID: ' . $streamId);
    header('Cache-Control: no-cache, no-store, must-revalidate');

    // Read continuous raw chunks from browser HTTP stream (php://input) and write to FFmpeg stdin
    $inputStream = fopen('php://input', 'rb');
    $bytesIngested = 0;
    $lastErrLog = '';

    if ($inputStream) {
        while (!feof($inputStream) && !connection_aborted()) {
            $chunk = fread($inputStream, 65536); // 64KB chunks
            if ($chunk !== false && strlen($chunk) > 0) {
                $bytesIngested += strlen($chunk);
                $written = @fwrite($pipes[0], $chunk);
                if ($written === false) {
                    break;
                }
            } else {
                usleep(5000); // 5ms sleep if no data available yet
            }

            // Drain stderr to prevent pipe buffer lockups and capture any warnings/errors
            if (isset($pipes[2]) && is_resource($pipes[2])) {
                $err = fread($pipes[2], 4096);
                if ($err) {
                    $lastErrLog .= $err;
                    if (strlen($lastErrLog) > 4096) {
                        $lastErrLog = substr($lastErrLog, -4096);
                    }
                }
            }

            // Check if FFmpeg has exited prematurely
            $procStatus = proc_get_status($process);
            if (!$procStatus['running']) {
                break;
            }
        }
        fclose($inputStream);
    }

    // Clean up FFmpeg process
    if (isset($pipes[0]) && is_resource($pipes[0])) {
        @fclose($pipes[0]);
    }
    if (isset($pipes[2]) && is_resource($pipes[2])) {
        @fclose($pipes[2]);
    }

    @proc_terminate($process);
    @proc_close($process);

    if (file_exists($pidFile)) {
        @unlink($pidFile);
    }

    if ($bytesIngested === 0 && !empty($lastErrLog)) {
        http_response_code(500);
        echo json_encode([
            'status' => 'error',
            'error' => 'FFmpeg exited prematurely: ' . trim($lastErrLog)
        ]);
        exit;
    }

    echo json_encode([
        'status' => 'ended',
        'streamId' => $streamId,
        'bytesIngested' => $bytesIngested,
        'message' => 'Broadcast ended successfully.'
    ]);
    exit;
}

// -------------------------------------------------------------
// 3. REMOTE STREAM TERMINATION (Stop Broadcast)
// -------------------------------------------------------------
if ($action === 'stop') {
    header('Content-Type: application/json; charset=utf-8');
    $streamId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['id'] ?? $_GET['stream_id'] ?? '');
    $killed = false;

    if ($streamId) {
        $pidFile = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'loopcast_' . $streamId . '.pid';
        if (file_exists($pidFile)) {
            $pid = intval(trim(file_get_contents($pidFile)));
            if ($pid > 0) {
                if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                    @shell_exec("taskkill /F /T /PID {$pid} 2>nul");
                } else {
                    if (function_exists('posix_kill')) {
                        @posix_kill($pid, SIGTERM);
                        usleep(100000);
                        @posix_kill($pid, SIGKILL);
                    } else {
                        @shell_exec("kill -9 {$pid} 2>/dev/null");
                    }
                }
                $killed = true;
            }
            @unlink($pidFile);
        }
    }

    echo json_encode(['status' => 'ok', 'stopped' => true, 'killed' => $killed]);
    exit;
}

http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'Endpoint not found. Use ?action=status, ?action=stream, or ?action=stop']);
