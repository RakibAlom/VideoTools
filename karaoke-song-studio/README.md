# Karaoke Song Studio 2.0 - Automated Viral Karaoke Video Production Suite

> **Zero-Python All-In-One Production Suite for Multi-Resolution Karaoke Videos for TikTok, YouTube Shorts, Reels, and YouTube.**  
> Built strictly with modern JavaScript (ES6+), HTML5 Canvas, Web Audio API DSP Synthesis & Center-Channel Vocal Reduction, IndexedDB Storage, and EBML-Patched Video Recording. Zero Python, Conda, or Pip dependencies required.

---

## Quick Start: One-Click Launcher

1. Navigate to: `d:\VideoTools\karaoke-song-studio`
2. **Double-click `Start-Studio.bat`**  
   *(The zero-dependency PowerShell server starts on port `5502` and automatically opens `http://localhost:5502/index.html` in your default browser).*

---

## 3 Simple Steps to Create Your Karaoke Video

### Step 1: Add or Choose Audio / Music
- **Option A (Upload):** Click **"Upload Audio or Video"** in the left sidebar under **STEP 1** and select any MP3, WAV, M4A, or MP4 video.
- **Option B (1-Click Demos):** Click **"Ready Demos"** at the top and pick from 4 built-in copyright-free songs (*Cyber 9:16*, *Funk 16:9*, *Lo-Fi 1:1*, or *15s Hook*).
- **Vocal Processor:** Switch between **Original Mix**, **Backing Track (Vocal Removed)**, or **Isolated Vocals**.
- **Anti-Copyright FX Rack:** Adjust pitch, tempo, and reverb to modify the acoustic fingerprint and prevent Content ID matches.

### Step 2: Set Title & Subtitle / Hook Banner
- In the left sidebar under **STEP 2**:
  - Enter your **Main Title** (e.g. `SONG NAME` or `CAN YOU SING THIS?`).
  - Enter your **Subtitle / Sub-text** (e.g. `Duet Challenge --- Can You Hit The High Note?`).
  - Adjust Title Font Size, Subtitle Gap, and Vertical Position.
  - Check/uncheck "Show Title" or "Show Subtitle".

### Step 3: Add & Customize Lyrics
- In the right sidebar under **STEP 3**:
  - **Quick Paste & Auto-Sync:** Click **"Import / Paste"**, paste any plain song lyrics lines, and click **"Apply & Auto-Sync"**. The engine will automatically distribute them across the song with word timings!
  - **Import Synced (.LRC / .SRT):** Paste standard timestamped lyrics `[00:12.34] Lyrics text`.
  - **Edit Lines:** Click on any line to edit the words or adjust start/end seconds.
  - **Split Line:** Click **Split** on any card to split a long line in two at the center word!
  - **Merge Line:** Click **Merge** to join two lines together.
  - **Audition:** Click any card to jump and play that exact lyric line.

### Step 4: Export Multi-Resolution Video
- Click **"Export Video"** in the top-right header.
- Select your resolution (720p HD, 1080p FHD, 2K QHD, 4K UHD) and frame rate (30 FPS or 60 FPS).
- Click **Start Export**. The video records and autoplays inside the player for preview.
- Confirm the legal compliance checkbox and download your universal MP4!

---

## File Structure

```
karaoke-song-studio/
--------- index.html               # Main Studio User Interface
--------- style.css                # Dark Glassmorphic Design System
--------- Start-Studio.bat         # One-click Windows Launcher
--------- server.ps1               # Zero-dependency PowerShell HTTP Server (Port 5502)
--------- README.md                # Documentation & Guide
--------- lib/
---   --------- db.js                # IndexedDB persistent storage manager
---   --------- fix-webm-duration.js # EBML Header Patcher
---   --------- fix-mp4.js           # Client-side MP4 utilities
---   --------- mp4-muxer.min.js     # Browser MP4 Muxer fallback
--------- js/
---   --------- audio-engine.js      # Web Audio DSP, vocal processor & Anti-Copyright FX
---   --------- lyrics-engine.js     # LRC/SRT parser, splitting, merging & hook extraction
---   --------- karaoke-renderer.js  # Canvas 2D engine with wiping lyrics, titles & backgrounds
---   --------- app.js               # Master studio coordinator, undo/redo & export pipeline
--------- assets/
    --------- audio/               # Custom audio assets
    --------- backgrounds/         # Custom background assets
```