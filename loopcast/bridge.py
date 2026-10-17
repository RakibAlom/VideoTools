"""
EasyLoop Cast — Multi-Platform Live Streaming Bridge (Python Engine)
(YouTube, Facebook, Instagram, TikTok & Custom RTMP)
WebSocket to FFmpeg RTMP Ingestion Server
"""

import sys
import os
import json
import asyncio
import subprocess

# Ensure UTF-8 output encoding on Windows terminals to prevent charmap errors
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
        sys.stderr.reconfigure(encoding='utf-8', errors='replace', line_buffering=True)
    except Exception:
        pass

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn

app = FastAPI(title="EasyLoop Cast RTMP Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    index_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {
        "service": "EasyLoop Cast RTMP Bridge (Python Engine)",
        "status": "online",
        "port": 3000
    }

@app.get("/api/health")
def api_health():
    return {
        "service": "EasyLoop Cast RTMP Bridge (Python Engine)",
        "status": "online",
        "port": 3000
    }

def detect_hardware_encoder():
    # Test AMD AMF (Fastest on AMD Radeon GPU)
    try:
        r = subprocess.run(["ffmpeg", "-f", "lavfi", "-i", "nullsrc", "-t", "0.1", "-c:v", "h264_amf", "-f", "null", "-"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if r.returncode == 0:
            return "h264_amf", "yuv420p"
    except Exception:
        pass
    # Test NVIDIA NVENC
    try:
        r = subprocess.run(["ffmpeg", "-f", "lavfi", "-i", "nullsrc", "-t", "0.1", "-c:v", "h264_nvenc", "-f", "null", "-"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if r.returncode == 0:
            return "h264_nvenc", "yuv420p"
    except Exception:
        pass
    # Test Intel QSV
    try:
        r = subprocess.run(["ffmpeg", "-f", "lavfi", "-i", "nullsrc", "-t", "0.1", "-c:v", "h264_qsv", "-f", "null", "-"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if r.returncode == 0:
            return "h264_qsv", "nv12"
    except Exception:
        pass
    return "libx264", "yuv420p"

@app.websocket("/ws")
@app.websocket("/")
async def websocket_rtmp_bridge(websocket: WebSocket):
    await websocket.accept()
    print("[Bridge] 📡 Client connected via WebSocket.")

    ffmpeg_proc = None
    stderr_task = None
    monitor_task = None
    is_streaming = False
    total_bytes = 0
    last_ffmpeg_error = [""]

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                print("[Bridge] 🔌 Client requested disconnect.")
                break
            
            # Binary data: Video/Audio stream chunk from MediaRecorder
            if "bytes" in message and message["bytes"]:
                chunk = message["bytes"]
                total_bytes += len(chunk)
                if ffmpeg_proc:
                    if ffmpeg_proc.returncode is not None:
                        err_msg = last_ffmpeg_error[0] or f"Destination platform rejected connection (exit code {ffmpeg_proc.returncode}). Please verify your Facebook Stream Key."
                        print(f"[Bridge] ❌ FFmpeg exited: {err_msg}", flush=True)
                        try:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": err_msg
                            }))
                            await asyncio.sleep(0.3)
                        except Exception:
                            pass
                        break
                    if ffmpeg_proc.stdin:
                        try:
                            ffmpeg_proc.stdin.write(chunk)
                            await ffmpeg_proc.stdin.drain()
                        except (BrokenPipeError, ConnectionResetError):
                            print("[Bridge] ❌ FFmpeg stdin broken pipe.")
                            err_msg = last_ffmpeg_error[0] or "Destination RTMP server closed connection. Please check your stream key."
                            try:
                                await websocket.send_text(json.dumps({
                                    "type": "error",
                                    "message": err_msg
                                }))
                                await asyncio.sleep(0.3)
                            except Exception:
                                pass
                            break
                        except Exception as e:
                            print(f"[Bridge] ❌ Error writing chunk: {e}")
                continue

            # Text data: JSON Control commands
            if "text" in message and message["text"]:
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type")

                    if msg_type == "ping":
                        await websocket.send_text(json.dumps({
                            "type": "pong",
                            "status": "online",
                            "isStreaming": is_streaming
                        }))
                        continue

                    if msg_type == "start":
                        if is_streaming:
                            print("[Bridge] ⚠️ Stream already running.")
                            continue

                        targets = data.get("targets", [])
                        if not targets:
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": "No RTMP stream targets specified."
                            }))
                            continue

                        width = int(data.get("width", 1080))
                        height = int(data.get("height", 1920))
                        fps = int(data.get("fps", 30))
                        bitrate = int(data.get("bitrate", 6000))

                        # Universal Performance Safeguards for Rock-Solid Stability:
                        # Cap at 30fps and 1080p bounds to guarantee 0% CPU lag and prevent platform dropouts
                        has_facebook = any("facebook" in t.get("url", "").lower() or "fb" in t.get("url", "").lower() for t in targets)
                        if fps > 30:
                            fps = 30
                        if has_facebook and bitrate > 4500:
                            bitrate = 4500
                        elif bitrate > 5000:
                            bitrate = 5000

                        # Maintain exact user aspect ratio within 1080p bounds
                        if width >= height:
                            if width > 1920:
                                height = int(round(height * (1920 / width)))
                                width = 1920
                            if height > 1080:
                                width = int(round(width * (1080 / height)))
                                height = 1080
                        else:
                            if width > 1080:
                                height = int(round(height * (1080 / width)))
                                width = 1080
                            if height > 1920:
                                width = int(round(width * (1920 / height)))
                                height = 1920

                        # Ensure even dimensions for H.264 compatibility
                        width = width if width % 2 == 0 else width + 1
                        height = height if height % 2 == 0 else height + 1

                        # Calculate macroblocks for accurate H.264 level specification
                        macroblocks = (width // 16) * (height // 16)
                        if macroblocks <= 8192:
                            h264_level = "4.1"
                        elif macroblocks <= 8704:
                            h264_level = "4.2"
                        else:
                            h264_level = "5.1"

                        # Fast bilinear scaling and SAR=1 (eliminates 100% CPU bottleneck from Lanczos)
                        scale_filter = f"setpts=PTS-STARTPTS,scale={width}:{height}:flags=bilinear,setsar=1"

                        encoder, pix_fmt = detect_hardware_encoder()
                        # Facebook Live strictly enforces 2.0s IDR keyframes, constant frame rate (CBR/CFR), and 48kHz stereo AAC
                        active_encoder = "libx264" if has_facebook else encoder
                        active_pix_fmt = "yuv420p"

                        print(f"\n[Bridge] 🔴 STARTING BROADCAST: {width}x{height} @ {fps}fps | Bitrate: {bitrate} kbps | Engine: {active_encoder.upper()}", flush=True)
                        for t in targets:
                            safe_url = t["url"].rsplit('/', 1)[0] + '/***STREAM_KEY_HIDDEN***'
                            print(f"   ➡️ Target: {t.get('name', 'RTMP')} -> {safe_url}", flush=True)

                        # Broadcast-Compliant RTMP Command:
                        # 1. -nostats and -loglevel warning prevent pipe buffering deadlocks on Windows
                        # 2. setpts=PTS-STARTPTS guarantees stream starts at 0.000s, preventing any frame duplication bursts
                        # 3. -r {fps} and -fps_mode cfr guarantee strictly constant frame rate (required by Facebook & YouTube)
                        # 4. repeat-headers=1 / header_spacing=1 repeats SPS/PPS headers before every IDR frame for instant preview locking
                        # 5. Continuous smooth aresample eliminates audio cuts/stalls
                        args = [
                            "ffmpeg",
                            "-y",
                            "-nostats",
                            "-loglevel", "warning",
                            "-f", "webm",
                            "-i", "pipe:0",
                            "-vf", scale_filter,
                            "-c:v", active_encoder,
                        ]

                        if active_encoder == "libx264":
                            args.extend([
                                "-preset", "veryfast",
                                "-tune", "zerolatency",
                                "-profile:v", "high",
                                "-level", h264_level,
                                "-b:v", f"{bitrate}k",
                                "-maxrate", f"{bitrate}k",
                                "-bufsize", f"{bitrate * 2}k",
                                "-pix_fmt", "yuv420p",
                                "-r", str(fps),
                                "-fps_mode", "cfr",
                                "-g", str(fps * 2),
                                "-keyint_min", str(fps * 2),
                                "-sc_threshold", "0"
                            ])
                        elif active_encoder == "h264_amf":
                            args.extend([
                                "-quality", "speed",
                                "-rc", "cbr",
                                "-forced_idr", "1",
                                "-header_spacing", "1",
                                "-async_depth", "4",
                                "-b:v", f"{bitrate}k",
                                "-maxrate", f"{bitrate}k",
                                "-bufsize", f"{bitrate * 2}k",
                                "-pix_fmt", pix_fmt,
                                "-r", str(fps),
                                "-fps_mode", "cfr",
                                "-g", str(fps * 2)
                            ])
                        elif active_encoder == "h264_nvenc":
                            args.extend([
                                "-preset", "p4",
                                "-tune", "ll",
                                "-profile:v", "high",
                                "-b:v", f"{bitrate}k",
                                "-maxrate", f"{bitrate}k",
                                "-bufsize", f"{bitrate * 2}k",
                                "-pix_fmt", pix_fmt,
                                "-r", str(fps),
                                "-fps_mode", "cfr",
                                "-g", str(fps * 2),
                                "-keyint_min", str(fps * 2)
                            ])
                        else:
                            args.extend([
                                "-preset", "veryfast",
                                "-tune", "zerolatency",
                                "-profile:v", "high",
                                "-level", h264_level,
                                "-b:v", f"{bitrate}k",
                                "-maxrate", f"{bitrate}k",
                                "-bufsize", f"{bitrate * 2}k",
                                "-pix_fmt", pix_fmt,
                                "-r", str(fps),
                                "-fps_mode", "cfr",
                                "-g", str(fps * 2),
                                "-keyint_min", str(fps)
                            ])

                        # Standard broadcast-compliant 48kHz stereo AAC audio with smooth non-cutting sync
                        args.extend([
                            "-c:a", "aac",
                            "-b:a", "128k",
                            "-ar", "48000",
                            "-ac", "2",
                            "-af", "aresample=async=1000:first_pts=0",
                            "-flvflags", "no_duration_filesize",
                            "-flags", "+global_header"
                        ])

                        # Append targets with clean stream mapping
                        if len(targets) == 1:
                            target_url = targets[0]["url"]
                            args.extend(["-map", "0:v:0", "-map", "0:a:0?", "-f", "flv", target_url])
                        else:
                            tee_outputs = "|".join([f"[f=flv:onfail=ignore]{t['url']}" for t in targets])
                            args.extend(["-f", "tee", "-map", "0:v:0", "-map", "0:a:0?", tee_outputs])

                        last_ffmpeg_error[0] = ""
                        try:
                            # Use asyncio.create_subprocess_exec for true non-blocking pipe I/O
                            ffmpeg_proc = await asyncio.create_subprocess_exec(
                                *args,
                                stdin=asyncio.subprocess.PIPE,
                                stdout=asyncio.subprocess.DEVNULL,
                                stderr=asyncio.subprocess.PIPE
                            )

                            async def drain_ffmpeg_stderr(proc):
                                try:
                                    while True:
                                        line = await proc.stderr.readline()
                                        if not line:
                                            break
                                        text = line.decode('utf-8', errors='ignore').strip()
                                        if text:
                                            print(f"[FFmpeg] {text}")
                                            if any(k in text.lower() for k in ['error', 'failed', 'invalid', 'refused', 'broken pipe', 'fatal alert', 'i/o error']):
                                                if 'i/o error' in text.lower() or 'fatal alert' in text.lower():
                                                    last_ffmpeg_error[0] = "Destination platform rejected stream (I/O error / TLS alert). Please make sure your Facebook Stream Key is active and fresh in Facebook Live Producer!"
                                                elif 'authentication' in text.lower() or 'not authorized' in text.lower():
                                                    last_ffmpeg_error[0] = "Stream Key rejected: unauthorized. Please verify your stream key."
                                                else:
                                                    last_ffmpeg_error[0] = text
                                except Exception:
                                    pass

                            stderr_task = asyncio.create_task(drain_ffmpeg_stderr(ffmpeg_proc))

                            async def monitor_ffmpeg_proc(proc):
                                ret = await proc.wait()
                                if is_streaming and ret != 0:
                                    await asyncio.sleep(0.3)
                                    err_msg = last_ffmpeg_error[0] or f"Destination platform rejected stream (FFmpeg exit code {ret}). Please verify your Facebook Stream Key."
                                    print(f"[Bridge] ❌ Process exited unexpectedly: {err_msg}", flush=True)
                                    try:
                                        await websocket.send_text(json.dumps({
                                            "type": "error",
                                            "message": err_msg
                                        }))
                                    except Exception:
                                        pass

                            monitor_task = asyncio.create_task(monitor_ffmpeg_proc(ffmpeg_proc))

                            is_streaming = True
                            total_bytes = 0
                            await websocket.send_text(json.dumps({
                                "type": "ready",
                                "message": f"FFmpeg {width}x{height} live bridge active ({active_encoder.upper()})!"
                            }))
                        except Exception as e:
                            print(f"[Bridge] ❌ Error starting FFmpeg: {e}")
                            await websocket.send_text(json.dumps({
                                "type": "error",
                                "message": f"FFmpeg failed to launch: {str(e)}"
                            }))
                        continue

                    if msg_type == "stop":
                        print("\n[Bridge] ⏹️ Stop request received.")
                        break

                except Exception as e:
                    print(f"[Bridge] Error parsing JSON control message: {e}")

    except WebSocketDisconnect:
        print("[Bridge] 🔌 Client disconnected.")
    except Exception as e:
        print(f"[Bridge] WebSocket exception: {e}")
    finally:
        if stderr_task and not stderr_task.done():
            stderr_task.cancel()
        if monitor_task and not monitor_task.done():
            monitor_task.cancel()
        if ffmpeg_proc:
            try:
                if ffmpeg_proc.stdin:
                    ffmpeg_proc.stdin.close()
                    await ffmpeg_proc.stdin.wait_closed()
            except Exception:
                pass
            try:
                ffmpeg_proc.terminate()
                await asyncio.wait_for(ffmpeg_proc.wait(), timeout=2.0)
            except Exception:
                try:
                    ffmpeg_proc.kill()
                except Exception:
                    pass
        is_streaming = False
        print(f"[Bridge] Total stream data ingested: {total_bytes / (1024 * 1024):.2f} MB")
        print("[Bridge] Ready for next connection.\n")

if __name__ == "__main__":
    print("===========================================================")
    print("   StreamFlow Studio - Multi-Platform RTMP Live Bridge")
    print("   (YouTube * Facebook * Instagram * TikTok * Custom)")
    print("===========================================================")
    print(">> Bridge Server listening on ws://localhost:3000")
    # Ensure port 3000 is clean on Windows before starting
    if sys.platform == 'win32':
        import socket
        import time
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(('0.0.0.0', 3000))
            s.close()
        except OSError:
            print("[Bridge] Port 3000 is in use. Freeing port 3000...")
            subprocess.run(
                'for /f "tokens=5" %a in (\'netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"\') do taskkill /f /pid %a',
                shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            time.sleep(1)

    uvicorn.run(app, host="0.0.0.0", port=3000, log_level="warning")
