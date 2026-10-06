<?php
/**
 * World Flag Guess Studio - Universal API Router & Resilient TTS Engine
 * Built for Web Hosting (cPanel / Hostinger / Apache / Nginx / LiteSpeed / IIS / DirectAdmin)
 * 
 * Features:
 * - Multi-provider audio synthesis fallback (Google GTX, Youdao Natural, Google tw-ob)
 * - Both cURL and stream_context support with SSL bypass for shared hosting environments
 * - Server-side persistent MP3 disk caching (instant 0ms response for repeated questions)
 * - Support for male/female voice variants (Google Natural, David US, Zira UK)
 * - Automatic sentence chunking for long narrations
 * - Universal MP4 remuxing with client-side detection headers
 * - Full CORS and Private Network Access support
 */

// 1. Enable Full CORS and Private Network Access
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Private-Network: true");
header("Access-Control-Allow-Headers: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS, HEAD");
header("Access-Control-Expose-Headers: Content-Length, Content-Type, X-TTS-Source, X-Remux-Status");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Universal Action Resolution
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

// Helper: Check for FFmpeg availability on server
function checkServerFfmpeg() {
    if (!function_exists('exec')) return false;
    $isWin = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN');
    $testCmd = $isWin ? 'where ffmpeg 2>nul' : 'which ffmpeg 2>/dev/null';
    $path = @exec($testCmd);
    return ($path && file_exists(trim($path))) ? trim($path) : false;
}

// Helper: Download audio from remote endpoint using cURL or stream context
function downloadAudioStream($url, $timeout = 8) {
    // Priority 1: cURL (Bypasses allow_url_fopen restrictions on Hostinger/cPanel)
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 4,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            CURLOPT_HTTPHEADER => [
                'Accept: audio/mpeg, audio/*;q=0.9, */*;q=0.8',
                'Accept-Language: en-US,en;q=0.9',
                'Referer: https://translate.google.com/'
            ]
        ]);
        $data = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code === 200 && $data !== false && strlen($data) > 150) {
            return $data;
        }
    }

    // Priority 2: stream_context fallback
    $opts = [
        'http' => [
            'method' => 'GET',
            'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\nAccept: audio/mpeg, */*\r\n",
            'timeout' => $timeout,
            'ignore_errors' => true
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ];
    $ctx = stream_context_create($opts);
    $data = @file_get_contents($url, false, $ctx);
    if ($data !== false && strlen($data) > 150) {
        return $data;
    }

    return null;
}

// Helper: Synthesize single phrase chunk with multi-provider waterfall
function synthesizeChunk($textChunk, $voice, $lang = 'en') {
    $clean = trim($textChunk);
    if (!$clean) return null;
    $encoded = urlencode($clean);

    // Determine voice dialect & style mapping
    $isMale = (stripos($voice, 'david') !== false || stripos($voice, 'male') !== false);
    $isFemale = (stripos($voice, 'zira') !== false || stripos($voice, 'female') !== false);

    $tl = $lang;
    if ($isMale) $tl = 'en-US';
    elseif ($isFemale) $tl = 'en-GB';

    $youdaoType = $isMale ? '2' : ($isFemale ? '1' : '1');

    // Multi-tier provider endpoints ordered for highest reliability on web hosting
    $providers = [
        'google_gtx' => "https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl={$tl}&q={$encoded}",
        'youdao'     => "https://dict.youdao.com/dictvoice?audio={$encoded}&type={$youdaoType}",
        'google_tw'  => "https://translate.google.com/translate_tts?ie=UTF-8&q={$encoded}&tl={$tl}&client=tw-ob"
    ];

    foreach ($providers as $provName => $url) {
        $bytes = downloadAudioStream($url, 7);
        if ($bytes !== null && strlen($bytes) > 150) {
            return ['bytes' => $bytes, 'source' => $provName];
        }
    }

    return null;
}

// ============================================================
// 3. HEALTH / STATUS ENDPOINT
// ============================================================
if ($action === 'status' || isset($_GET['ping']) || (isset($_GET['test']) && $action !== 'tts')) {
    $ffmpegPath = checkServerFfmpeg();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    echo json_encode([
        'status'  => 'ok',
        'server'  => 'world-flag-guess-studio',
        'type'    => 'php-hosting',
        'ffmpeg'  => ($ffmpegPath !== false),
        'tts'     => true,
        'cache'   => true,
        'voices'  => ['google', 'david', 'zira'],
        'version' => '2.5.0'
    ]);
    exit;
}

// ============================================================
// 4. TTS AUDIO SYNTHESIS ENDPOINT (Multi-Provider + Disk Cache)
// ============================================================
if ($action === 'tts') {
    // Quick probe / healthcheck
    if (isset($_GET['test']) || isset($_GET['ping']) || isset($_GET['status'])) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status'  => 'ok',
            'server'  => 'world-flag-guess-studio',
            'voices'  => ['google', 'david', 'zira']
        ]);
        exit;
    }

    $text  = trim($_GET['text'] ?? 'Welcome to world flag guess studio!');
    $voice = strtolower(trim($_GET['voice'] ?? 'google'));
    $lang  = strtolower(trim($_GET['lang'] ?? 'en'));

    if (!$text) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Text parameter required']);
        exit;
    }

    // Disk Cache check: instant 0ms responses for repeated questions and prompts
    $cacheDir = __DIR__ . '/cache/tts';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0755, true);
    }

    $cacheHash = md5($voice . '_' . $lang . '_' . $text);
    $cacheFile = $cacheDir . '/' . $cacheHash . '.mp3';

    if (file_exists($cacheFile) && filesize($cacheFile) > 150) {
        header('Content-Type: audio/mpeg');
        header('Content-Length: ' . filesize($cacheFile));
        header('Cache-Control: public, max-age=604800');
        header('X-TTS-Source: cache');
        readfile($cacheFile);
        exit;
    }

    $finalAudioBytes = '';
    $finalSource = 'none';

    // Chunking: If text exceeds 120 chars, split cleanly on sentence boundaries so no text is truncated
    if (mb_strlen($text) > 120) {
        $sentences = preg_split('/(?<=[.!?])\s+/', $text, -1, PREG_SPLIT_NO_EMPTY);
        if (!$sentences) $sentences = [$text];

        foreach ($sentences as $s) {
            $chunkRes = synthesizeChunk($s, $voice, $lang);
            if ($chunkRes && !empty($chunkRes['bytes'])) {
                $finalAudioBytes .= $chunkRes['bytes'];
                $finalSource = $chunkRes['source'];
            }
        }
    } else {
        $singleRes = synthesizeChunk($text, $voice, $lang);
        if ($singleRes && !empty($singleRes['bytes'])) {
            $finalAudioBytes = $singleRes['bytes'];
            $finalSource = $singleRes['source'];
        }
    }

    if (!empty($finalAudioBytes) && strlen($finalAudioBytes) > 150) {
        // Save to cache for future replays
        if (is_dir($cacheDir) && is_writable($cacheDir)) {
            @file_put_contents($cacheFile, $finalAudioBytes);
        }

        header('Content-Type: audio/mpeg');
        header('Content-Length: ' . strlen($finalAudioBytes));
        header('Cache-Control: public, max-age=604800');
        header('X-TTS-Source: ' . $finalSource);
        echo $finalAudioBytes;
        exit;
    } else {
        http_response_code(502);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Unable to fetch TTS audio stream',
            'detail' => 'Remote speech synthesis services unreachable from host'
        ]);
        exit;
    }
}

// ============================================================
// 5. UNIVERSAL MP4 REMUX ENDPOINT
// ============================================================
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

    $ffmpegPath = checkServerFfmpeg();
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

// ============================================================
// 6. SAVE FILE ENDPOINT (Preserves user storage)
// ============================================================
if ($action === 'save-file') {
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'notice' => 'Disk writing disabled. File delivered via client download.']);
    exit;
}

// Fallback: 404
http_response_code(404);
header('Content-Type: application/json');
echo json_encode(['error' => 'Endpoint not found', 'action' => $action]);
