# 📺 EasyLoop Cast — Pre-Recorded Video & YouTube Live Broadcaster

**EasyLoop Cast** is a lightweight, browser-based live broadcasting tool engineered specifically for continuous, scheduled, or looped live streaming of pre-recorded local videos and YouTube streams. Unlike complex screen recording or desktop capture studios, **EasyLoop Cast** takes your pre-made videos, organizes them into gapless playlists, and broadcasts them directly to **YouTube Live, Facebook Live, Instagram Live, TikTok Live**, and **Custom RTMP destinations** in pixel-perfect native quality.

---

## 🚀 Key Features & Capabilities

### 1. 📡 Multi-Platform RTMP Live Streaming Engine
- **Direct Streaming Destinations:**
  - **YouTube Live:** Standard RTMP (`rtmp://a.rtmp.youtube.com/live2`) with 1080p/720p broadcast profiles.
  - **Facebook Live:** Secure RTMPS (`rtmps://live-api-s.facebook.com:443/rtmp/`) with strict 2.0s keyframe compliance.
  - **Instagram Live:** Native RTMPS (`rtmps://live-upload.instagram.com:443/rtmp/`) with 1-click **9:16 vertical full-frame switch**.
  - **TikTok Live:** Standard RTMP (`rtmp://live-push.tiktok.com/live/`) with 1-click **9:16 vertical full-frame switch**.
  - **Custom RTMP:** Direct custom ingestion with presets for **Twitch**, **Kick**, **Twitter/X**, **Restream**, or private servers.
- **Simulcast (Multi-Stream) Mode:** Broadcast simultaneously to YouTube, Facebook, Instagram, and custom endpoints all at once from a single tab.
- **Direct Master Canvas Compositor:** Directly feeds a hardware-composited canvas stream into MediaRecorder and FFmpeg without any screen-share permission dialogs, full-window capture popups, or display cropping artifacts.
- **Continuous 200ms Packet Cadence:** Eliminates buffer starvation on YouTube Live and Facebook Live by steadily feeding small 200ms slices 5 times per second.
- **Live Broadcast Telemetry:** Real-time on-air duration timer (`00:00:00`), live bitrate monitor (`4500–5000 kbps`), active target indicators, and live data ingested counter (`MB`).

---

### 2. ⚡ 0ms Gapless Dual-Deck Playback Engine
- **A/B Dual-Deck System:** Uses two synchronized native HTML5 `<video>` players (`Player A` and `Player B`).
- **RAM Pre-buffering:** While Deck A is broadcasting live, Deck B pre-buffers the next video in the queue into memory (`preload="auto"`).
- **Zero Black Flashes:** When the active track finishes, Deck B seamlessly takes over with instant handoff, eliminating black screen blinks between track changes.
- **Freeze-Frame Fallback Shield:** If a video momentarily buffers or decodes during track changes, a cached good frame prevents any black frames from slipping into the live stream.

---

### 3. 🎨 Frame Composition, Visual FX & Logo Cover
- **Dynamic Aspect Ratio Switcher:**
  - `9:16 Vertical` (Shorts, Reels, TikTok, Instagram)
  - `16:9 Landscape` (Standard YouTube, Facebook, Twitch)
  - `1:1 Square`, `4:5 Social`, and `21:9 Ultrawide Cinema`
- **Frame Fit Modes:**
  - `Fill (Zoom & Crop)`: 100% Edge-to-edge frame. Fills the screen with zero black bars.
  - `Contain`: Complete uncropped video centered on a solid/custom background.
  - `Letterbox`: Classic centered presentation with letterbox bars.
- **Real-Time Visual FX:** Brightness, Contrast, Saturation, Blur, Grayscale, Sepia, and Mirror Mode.
- **Custom Logo & Watermarks:** Upload transparent PNG logos or sponsor badges, position in any corner, and scale opacity.
- **Logo Cover / Masking (Patch):** Cover up unwanted watermarks, timestamps, or broadcaster badges from source videos using color blocks or frosted blur patches.
- **Stage Pop-Out / Maximize:** Pop out a borderless stage window for secondary monitors or OBS integration.

---

### 4. 🔒 100% Client-Side Privacy & Browser Storage (No Account Needed)
- **Zero Registration:** No sign-up, no email, no password, and no external database.
- **Browser IndexedDB:** Local video files and folders are saved directly inside your browser sandbox on your local drive. Videos persist across page refreshes.
- **LocalStorage:** Playlists, stream keys, visual FX, and audio settings are preserved across sessions.
- **1-Click Backup & Restore:** Export your entire setup to a single JSON file via Settings (`Download Backup (JSON)`) and restore it on any computer in 1 second.
- *Notice:* Clearing your browser cache or site data will wipe the local IndexedDB database, requiring videos to be re-added. Use regular browsing windows (not Incognito) for permanent storage.

---

### 5. 🔌 Hardware-Accelerated RTMP Bridge Server (`bridge.py`)
EasyLoop Cast includes a high-performance Python FastAPI WebSocket bridge (`bridge.py`) that auto-detects and accelerates encoding via your hardware GPU:
- **AMD Radeon GPUs:** `h264_amf` (Zero-latency CBR with low async depth).
- **NVIDIA GeForce GPUs:** `h264_nvenc` (Low-latency `ll` profile).
- **Intel Graphics:** `h264_qsv`.
- **CPU Fallback:** `libx264` (`-preset veryfast -tune zerolatency`).
- **48kHz Audio Pipeline:** Standard 48,000 Hz stereo AAC with continuous sample sync (`aresample=async=1000`) and sub-bass anti-starvation tone to prevent platform drops.

---

## 📖 Step-by-Step Guide: How to Go Live

### Step 1: Create Your Playlist & Add Videos or Folders
1. Open the **Queue / Playlists** tab in the dashboard.
2. Click **Add Local Files** to select video files (`.mp4`, `.webm`, `.mov`, `.mkv`), or **Add Folder** to import an entire directory at once.
3. You can also paste direct YouTube video URLs.
4. Drag and drop items to arrange the playback order. Toggle **Loop Playlist** for continuous 24/7 streaming.

### Step 2: Choose Frame Aspect Ratio & Fit Mode
1. Open the **Frame** tab.
2. Choose your target format:
   - **9:16 Vertical:** For YouTube Shorts, Facebook Reels, TikTok & Instagram Live.
   - **16:9 Landscape:** For standard YouTube & Facebook broadcasts.
3. Choose your **Fit Mode** (`Fill`, `Contain`, or `Letterbox`) and adjust Zoom/Pan sliders if necessary.

### Step 3: Customize FX, Audio/BGM, Overlays & Logo Cover
1. **FX Tab:** Adjust Brightness, Contrast, Saturation, or toggle Mirror Mode.
2. **Audio Tab:** Set Master volume, or upload Background Music (BGM) with auto-ducking.
3. **Logo & Overlay Tabs:** Add your channel watermark or custom ticker.
4. **Masking Tab:** Cover unwanted source logos or timestamps with a blur patch.

### Step 4: Add Streaming URLs, Stream Keys & Bridge Settings
1. Open the **Go Live** tab.
2. Enter your platform stream keys:
   - **YouTube Live:** Paste stream key from YouTube Studio.
   - **Facebook Live:** Paste stream key from Facebook Live Producer.
   - **Instagram / TikTok / Custom:** Paste stream URL and stream key.
3. **Multi-Stream (Simulcast):** Turn ON the Multi-Stream toggle to stream to multiple platforms at the same time.
4. **Quality & Bitrate:** Choose **1080p30 Full HD** (recommended bitrate: 4500k-5000k for rock-solid stability).

### Step 5: Hit 'Start Broadcast' & '🔴 GO LIVE'!
1. Click **Start Broadcast** on the Live Deck to start playback on the stage.
2. Click **🔴 GO LIVE** in the RTMP panel.
3. The bridge connects immediately. Monitor real-time status: On-Air timer, bitrate, and total megabytes streamed!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause |
| `N` | Next Video (Skip) |
| `P` | Previous Video |
| `M` | Toggle Mute / Unmute |
| `T` | Toggle Clean Theater Mode |
| `F` | Toggle Fullscreen Mode |
| `S` | Toggle Left Control Deck |
| `Esc` | Exit Theater / Fullscreen |

---

## ☁️ Hosting & Cloud Deployment FAQ

### Can I publish this tool on shared hosting (Hostinger / cPanel)?
- **Website Interface (`index.html`):** **YES!** You can upload `index.html` to any shared hosting, cPanel, or Hostinger account. You and your viewers can open the dashboard in any web browser worldwide.
- **Direct RTMP Streaming (`bridge.py`):** Shared hosting accounts **do not support** running continuous 24/7 background Python daemons, custom TCP ports (like 3000), or heavy FFmpeg video encoding.

### How to run 24/7 without opening `.bat` files on your PC:

#### Option A: Cloud VPS ($4 - $5 / month — Recommended for 24/7 Automation)
1. Deploy `bridge.py` on a cheap Cloud VPS (Hostinger VPS, DigitalOcean, Hetzner, or AWS Lightsail).
2. Install Python & FFmpeg on the VPS once and start `bridge.py` as a system service.
3. Set your Bridge WebSocket URL to `wss://vps.yourdomain.com:3000`.
4. Now you can open EasyLoop Cast from any mobile phone, laptop, or PC anywhere in the world and click **Go Live** without keeping your local computer on!

#### Option B: Zero-Backend OBS Browser Source (100% Free)
1. Upload `index.html` to your shared hosting (e.g. `https://yourdomain.com`).
2. Open **OBS Studio** or **vMix** on your PC and add a **Browser Source** with the URL:
   `https://yourdomain.com/?mode=clean`
3. Set OBS canvas to:
   - `1080 x 1920` for 9:16 Vertical (Reels/Shorts/TikTok/Instagram)
   - `1920 x 1080` for 16:9 Landscape
4. OBS streams directly to YouTube/Facebook without any Python bridge or `.bat` files!

---

## 🚀 How to Launch Locally

1. **Start the RTMP Bridge:**
   - Double-click `Start-RTMP-Bridge.bat` or run `python bridge.py`.
   - The script automatically verifies FFmpeg, installs dependencies if missing, and listens on `ws://localhost:3000`.
2. **Open EasyLoop Cast:**
   - Double-click `Start-Studio.bat`, or open `http://localhost:3000` / `index.html` in Chrome or Edge.
