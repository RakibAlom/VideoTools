/**
 * StreamFlow Studio — Multi-Platform Live Streaming Bridge
 * (YouTube, Facebook, Instagram, TikTok & Custom RTMP)
 * WebSocket to FFmpeg RTMP Ingestion Server
 */

const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 3000;

// Create standard HTTP server for health check & WebSocket handshake
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({
    service: 'StreamFlow Studio Multi-Platform RTMP Bridge',
    status: 'online',
    port: PORT,
    timestamp: new Date().toISOString()
  }));
});

const wss = new WebSocketServer({ server });

console.log('===========================================================');
console.log('   📺 StreamFlow Studio — Multi-Platform RTMP Live Bridge   ');
console.log('   (YouTube • Facebook • Instagram • TikTok • Custom)      ');
console.log('===========================================================');
console.log(`🚀 Bridge Server is listening on ws://localhost:${PORT}`);
console.log('💡 Keep this terminal open while live streaming.\n');

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[Bridge] 📡 Client connected from ${clientIp}`);

  let ffmpeg = null;
  let isStreaming = false;
  let totalBytesReceived = 0;

  ws.on('message', (message, isBinary) => {
    // 1. Binary Audio/Video chunks from frontend MediaRecorder
    if (isBinary) {
      if (ffmpeg && ffmpeg.stdin && ffmpeg.stdin.writable) {
        totalBytesReceived += message.length;
        ffmpeg.stdin.write(message);
      }
      return;
    }

    // 2. Control Messages (JSON)
    try {
      const data = JSON.parse(message.toString());

      // PING / Health Check
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', status: 'online', isStreaming }));
        return;
      }

      // START BROADCAST
      if (data.type === 'start') {
        if (isStreaming) {
          console.warn('[Bridge] ⚠️ Stream already running for this connection.');
          return;
        }

        const targets = data.targets || [];
        if (!targets || targets.length === 0) {
          ws.send(JSON.stringify({ type: 'error', message: 'No RTMP targets provided.' }));
          return;
        }

        let width = parseInt(data.width || 1080, 10);
        let height = parseInt(data.height || 1920, 10);
        const fps = parseInt(data.fps || 30, 10);
        const bitrate = parseInt(data.bitrate || 6000, 10); // in kbps

        // Ensure even dimensions for H.264 YUV420P compatibility
        width = width % 2 === 0 ? width : width + 1;
        height = height % 2 === 0 ? height : height + 1;

        // Select appropriate H.264 level for 1080p, 2K, or 4K
        const h264Level = (width <= 1920 && height <= 1920) ? '4.2' : '5.1';

        // High-quality Lanczos scaling filter with exact aspect ratio preservation, even padding, and 1:1 SAR
        const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;

        let safeBitrate = bitrate;
        const hasFacebook = targets.some(t => t.url.toLowerCase().includes('facebook') || t.url.toLowerCase().includes('fb'));
        if (hasFacebook && safeBitrate > 6000) {
          console.log(`[Bridge] ℹ️ Facebook Live detected: auto-capping bitrate to 6,000 kbps (Facebook ceiling).`);
          safeBitrate = 6000;
        }

        console.log(`\n[Bridge] 🔴 STARTING BROADCAST: ${width}x${height} @ ${fps}fps | Bitrate: ${safeBitrate} kbps | H.264 High L${h264Level}`);
        targets.forEach(t => console.log(`   ➡️ Target: ${t.name} -> ${t.url.replace(/\/[^/]+$/, '/***STREAM_KEY_HIDDEN***')}`));

        // Build FFmpeg command arguments (Do not use -re on live pipe:0!)
        const args = [
          '-nostats',
          '-loglevel', 'warning',
          '-f', 'webm',               // Input format: WebM from MediaRecorder
          '-i', 'pipe:0',             // Read from standard input
          '-vf', scaleFilter,         // High-quality Lanczos scaling and letterboxing
          '-c:v', 'libx264',          // Transcode video to standard H.264
          '-preset', 'veryfast',      // Low-latency CPU preset
          '-profile:v', 'high',       // High Profile for crisp stream quality
          '-level', h264Level,        // Level 4.2 for 1080p, Level 5.1 for 2K/4K
          '-b:v', `${safeBitrate}k`,  // Target video bitrate
          '-maxrate', `${safeBitrate}k`,  // Max bitrate
          '-bufsize', `${safeBitrate * 2}k`,
          '-pix_fmt', 'yuv420p',      // Standard pixel format for all RTMP decoders
          '-r', `${fps}`,             // Strict Constant Frame Rate (required by Facebook & YouTube)
          '-fps_mode', 'cfr',
          '-g', `${fps * 2}`,         // Strict 2-second keyframe GOP
          '-keyint_min', `${fps * 2}`,
          '-sc_threshold', '0',
          '-x264-params', 'repeat-headers=1:nal-hrd=cbr:force-cfr=1',
          '-c:a', 'aac',              // Transcode audio to AAC
          '-b:a', '128k',             // 128 kbps audio
          '-ar', '48000',             // 48 kHz sample rate (strictly required by Facebook)
          '-ac', '2',                 // 2-channel stereo
          '-af', 'aresample=async=1:min_hard_comp=0.100:first_pts=0',
          '-flvflags', 'no_duration_filesize',
          '-flags', '+global_header'  // Required for FLV muxing
        ];

        // Append targets (supports single and multi-platform simulcast via tee muxer)
        if (targets.length === 1) {
          args.push('-f', 'flv', targets[0].url);
        } else {
          // Robust Simulcast to YouTube & Facebook simultaneously via FFmpeg tee muxer
          const teeOutputs = targets.map(t => `[f=flv:onfail=ignore]${t.url}`).join('|');
          args.push('-f', 'tee', '-map', '0:v', '-map', '0:a', teeOutputs);
        }

        // Spawn FFmpeg process
        try {
          ffmpeg = spawn('ffmpeg', args);
          isStreaming = true;
          totalBytesReceived = 0;

          ffmpeg.on('error', (err) => {
            console.error('[Bridge] ❌ Failed to start FFmpeg process:', err.message);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to start FFmpeg. Ensure FFmpeg is installed and added to system PATH.'
            }));
            isStreaming = false;
          });

          let lastErrorMsg = '';
          ffmpeg.stderr.on('data', (d) => {
            const line = d.toString();
            // Log telemetry or warnings
            if (line.includes('fps=') || line.includes('bitrate=')) {
              process.stdout.write(`\r[FFmpeg Telemetry] ${line.trim().substring(0, 75)}`);
            } else if (line.toLowerCase().includes('error') || line.toLowerCase().includes('failed') || line.toLowerCase().includes('fatal alert')) {
              console.error(`\n[FFmpeg Error] ${line.trim()}`);
              if (line.toLowerCase().includes('i/o error') || line.toLowerCase().includes('fatal alert')) {
                lastErrorMsg = 'Destination platform rejected stream (I/O error / TLS alert). Please make sure your Facebook Stream Key is active and fresh in Facebook Live Producer!';
              } else if (line.toLowerCase().includes('authentication') || line.toLowerCase().includes('not authorized')) {
                lastErrorMsg = 'Stream Key rejected: unauthorized. Please verify your stream key.';
              }
            }
          });

          ffmpeg.on('close', (code) => {
            console.log(`\n[Bridge] ⏹️ FFmpeg process ended with exit code ${code}`);
            isStreaming = false;
            if (ws.readyState === ws.OPEN) {
              if (code !== 0 && lastErrorMsg) {
                ws.send(JSON.stringify({ type: 'error', message: lastErrorMsg }));
              }
              ws.send(JSON.stringify({ type: 'ended', code }));
            }
          });

          ws.send(JSON.stringify({ type: 'ready', message: 'FFmpeg ready. Live stream active!' }));

        } catch (err) {
          console.error('[Bridge] ❌ Exception launching FFmpeg:', err);
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
        return;
      }

      // STOP BROADCAST
      if (data.type === 'stop') {
        console.log('\n[Bridge] ⏹️ Stop request received from client.');
        stopStream();
        ws.send(JSON.stringify({ type: 'stopped' }));
        return;
      }

    } catch (e) {
      console.error('[Bridge] Invalid JSON message:', e.message);
    }
  });

  function stopStream() {
    if (ffmpeg) {
      try {
        if (ffmpeg.stdin && ffmpeg.stdin.writable) {
          ffmpeg.stdin.end();
        }
        ffmpeg.kill('SIGINT');
      } catch (e) {}
      ffmpeg = null;
    }
    isStreaming = false;
    console.log(`[Bridge] Total stream data ingested: ${(totalBytesReceived / (1024 * 1024)).toFixed(2)} MB`);
  }

  ws.on('close', () => {
    console.log(`[Bridge] 🔌 Client disconnected.`);
    stopStream();
  });

  ws.on('error', (err) => {
    console.error(`[Bridge] WebSocket client error:`, err.message);
    stopStream();
  });
});

server.listen(PORT, () => {
  console.log(`✨ RTMP Bridge ready. Listening on port ${PORT}`);
});
