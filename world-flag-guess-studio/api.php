<?php
/**
 * World Flag Guess Studio - Universal API Router & TTS Proxy for Web Hosting (cPanel / Apache / Nginx / LiteSpeed)
 * Enables complete hosting server support with Zero Node.js or Python requirements.
 */

// Enable CORS and Private Network Access
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Private-Network: true");
header("Access-Control-Allow-Headers: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$action = $_GET['action'] ?? $_GET['endpoint'] ?? '';
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);

if (!$action) {
    if (strpos($uri, 'tts') !== false) {
        $action = 'tts';
    } elseif (strpos($uri, 'remux-mp4') !== false) {
        $action = 'remux-mp4';
    } elseif (strpos($uri, 'save-file') !== false) {
        $action = 'save-file';
    } elseif (strpos($uri, 'status') !== false) {
        $action = 'status';
    }
}

// 1. HEALTH / STATUS ENDPOINT
if ($action === 'status' || isset($_GET['ping'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'ok',
        'server' => 'world-flag-guess-studio',
        'type' => 'php-hosting',
        'ffmpeg' => function_exists('exec') && @exec('which ffmpeg || where ffmpeg') ? true : false,
        'voices' => ['google']
    ]);
    exit;
}

// 2. TTS AUDIO SYNTHESIS ENDPOINT
if ($action === 'tts') {
    if (isset($_GET['test']) || isset($_GET['ping']) || isset($_GET['status'])) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'ok',
            'server' => 'world-flag-guess-studio',
            'voices' => ['google']
        ]);
        exit;
    }

    $text = trim($_GET['text'] ?? 'Welcome to world flag guess studio!');
    $lang = trim($_GET['lang'] ?? 'en');
    $subText = mb_substr($text, 0, 130);
    $encoded = urlencode($subText);
    $googleUrl = "https://translate.google.com/translate_tts?ie=UTF-8&q={$encoded}&tl={$lang}&client=tw-ob";

    $opts = [
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n",
            'timeout' => 8
        ]
    ];
    $ctx = stream_context_create($opts);
    $audioBytes = @file_get_contents($googleUrl, false, $ctx);

    if ($audioBytes !== false && strlen($audioBytes) > 100) {
        header('Content-Type: audio/mpeg');
        header('Content-Length: ' . strlen($audioBytes));
        header('Cache-Control: public, max-age=86400');
        echo $audioBytes;
        exit;
    } else {
        http_response_code(502);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unable to fetch TTS audio stream']);
        exit;
    }
}

// 3. UNIVERSAL MP4 REMUX ENDPOINT
if ($action === 'remux-mp4') {
    $filename = basename($_GET['filename'] ?? ('quiz_video_' . date('Ymd_His') . '.mp4'));
    $tempIn = tempnam(sys_get_temp_dir(), 'in_') . '.mp4';
    $tempOut = tempnam(sys_get_temp_dir(), 'out_') . '.mp4';

    $inStream = fopen('php://input', 'rb');
    $outStream = fopen($tempIn, 'wb');
    if ($inStream && $outStream) {
        stream_copy_to_stream($inStream, $outStream);
        fclose($inStream);
        fclose($outStream);
    }

    $ffmpegPath = null;
    if (function_exists('exec')) {
        $check = @shell_exec('which ffmpeg 2>&1');
        if ($check && file_exists(trim($check))) {
            $ffmpegPath = trim($check);
        }
    }

    $remuxed = false;
    if ($ffmpegPath && file_exists($tempIn) && filesize($tempIn) > 500) {
        $cmd = escapeshellcmd($ffmpegPath) . " -y -fflags +genpts -avoid_negative_ts make_zero -i " . escapeshellarg($tempIn) . " -c copy -movflags +faststart " . escapeshellarg($tempOut) . " 2>&1";
        @exec($cmd, $out, $ret);
        if ($ret === 0 && file_exists($tempOut) && filesize($tempOut) > 500) {
            $remuxed = true;
        }
    }

    $finalFile = $remuxed ? $tempOut : $tempIn;
    if (file_exists($finalFile)) {
        header('Content-Type: video/mp4');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($finalFile));
        header('X-Remux-Status: ' . ($remuxed ? 'ffmpeg_faststart' : 'browser_stream'));
        readfile($finalFile);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Remux failed']);
    }

    @unlink($tempIn);
    @unlink($tempOut);
    exit;
}

// 4. SAVE FILE ENDPOINT (Disabled from writing to disk to preserve user storage)
if ($action === 'save-file') {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'notice' => 'Disk writing disabled. File delivered via client download.']);
    exit;
}

// Fallback: 404
http_response_code(404);
echo json_encode(['error' => 'Endpoint not found']);
