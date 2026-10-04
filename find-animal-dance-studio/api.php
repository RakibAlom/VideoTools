<?php
/**
 * Animal Dance Studio - Universal API Router & Remux Endpoint for Web Hosting
 */

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
    if (strpos($uri, 'remux-mp4') !== false) {
        $action = 'remux-mp4';
    } elseif (strpos($uri, 'save-file') !== false) {
        $action = 'save-file';
    } elseif (strpos($uri, 'status') !== false) {
        $action = 'status';
    }
}

if ($action === 'status' || isset($_GET['ping'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => 'ok',
        'server' => 'find-animal-dance-studio',
        'type' => 'php-hosting'
    ]);
    exit;
}

if ($action === 'remux-mp4') {
    $filename = basename($_GET['filename'] ?? ('animal_dance_' . date('Ymd_His') . '.mp4'));
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

if ($action === 'save-file') {
    // Disabled from writing to local disk to preserve user storage
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'notice' => 'Disk writing disabled. File delivered via client download.']);
    exit;
}

http_response_code(404);
echo json_encode(['error' => 'Endpoint not found']);
