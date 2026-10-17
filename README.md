# 🎬 VideoTools — Modular Suite of Easy & Advanced Video Creation Engines

> **An actively expanding, all-in-one monorepo of specialized video production studios, automated short-form generators, AI recap pipelines, and 24/7 live broadcasting tools.**  
> Built for content creators, faceless channel operators, video editors, and developers.

[![Repository Status](https://img.shields.io/badge/Status-Actively%20Maintained%20%26%20Expanding-brightgreen.svg)](#-continuous-expansion-easy--advanced-tools)
[![Active Tools](https://img.shields.io/badge/Active%20Studios-6%20Production%20Suites-blue.svg)](#-current-tools-matrix)
[![Tiers](https://img.shields.io/badge/Tiers-Zero--Dependency%20to%20Advanced%20AI-orange.svg)](#-two-tier-architecture)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Web%20%7C%20Cloud-purple.svg)](#-universal-quick-start)

---

## 🚀 Continuous Expansion: Easy & Advanced Tools

**This repository is continuously updated with new video creation tools.**

The ecosystem is designed with a **modular architecture** so each studio operates independently with zero friction, dedicated ports, and zero cross-tool dependency conflicts. New tools are regularly added across two primary difficulty and engineering tiers:

```
VideoTools Monorepo
 ├── 🟢 Tier 1: Easy & Zero-Dependency Web Studios (Pure HTML5/Canvas/ES6+ — No Python or Node needed)
 └── 🟣 Tier 2: Advanced AI & Media Engines (FastAPI, OpenCV, Gemini Vision, Whisper, RTMP & FFmpeg)
```

- **🟢 Easy-Level Tools:** Zero-installation, browser-native client-side engines. Powered by HTML5 Canvas, Web Audio API, and IndexedDB. Double-click `Start-Studio.bat` and run immediately on any laptop or desktop with zero setup.
- **🟣 Advanced-Level Tools:** Heavyweight production suites leveraging Computer Vision (OpenCV), LLM Multimodal Vision (Google Gemini), Neural Voice Synthesis (ElevenLabs / Edge-TTS), Perceptual Hash Breaking, and Hardware-Accelerated Streaming (FFmpeg NVENC/AMF/QSV).

---

## 📑 Table of Contents

1. [Current Tools Matrix](#-current-tools-matrix)
2. [Universal Quick Start & Port Allocations](#-universal-quick-start)
3. [Deep Dive: Production Studios](#-deep-dive-production-studios)
   - [1. 🚩 World Flag Guess Studio](#1--world-flag-guess-studio-5500)
   - [2. 🦆 Animal Dance Studio 2.0](#2--animal-dance-studio-20-5501)
   - [3. 🎤 Karaoke Song Studio 2.0](#3--karaoke-song-studio-20-5502)
   - [4. 📺 EasyLoop Cast Live Broadcaster](#4--easyloop-cast-live-broadcaster-3000)
   - [5. 🎬 MangaRecap AI Studio 2.0](#5--mangarecap-ai-studio-20-5503)
   - [6. 🛡️ VideoRepurpose AI Studio](#6--videorepurpose-ai-studio-5504)
4. [Upcoming Tools Roadmap](#-upcoming-tools-roadmap)
5. [Directory Architecture](#-directory-architecture)
6. [Adding New Tools (Developer Guidelines)](#-adding-new-tools-developer-guidelines)

---

## 📊 Current Tools Matrix

| # | Tool Name | Tier | Port | Tech Stack | Primary Target Platforms | One-Click Launcher |
|---|-----------|------|------|------------|--------------------------|-------------------|
| **1** | [**World Flag Guess Studio**](#1--world-flag-guess-studio-5500) | 🟢 Easy | `5500` | Pure HTML5, Tailwind CSS, Web Audio, Canvas 2D | YouTube Shorts, Reels, TikTok (9:16) & Landscape (16:9) | `world-flag-guess-studio/Start-Studio.bat` |
| **2** | [**Animal Dance Studio 2.0**](#2--animal-dance-studio-20-5501) | 🟢 Easy | `5501` | Vanilla ES6+, Canvas Engine, Web Audio DSP, IndexedDB | Viral Hidden Object Shorts & Reels (9:16) | `find-animal-dance-studio/Start-Studio.bat` |
| **3** | [**Karaoke Song Studio 2.0**](#3--karaoke-song-studio-20-5502) | 🟢 Easy | `5502` | Modern JS, Center-Channel Vocal DSP, Canvas Wiping | Multi-Res Karaoke (9:16, 16:9, 1:1, 4:5, up to 4K) | `karaoke-song-studio/Start-Studio.bat` |
| **4** | [**EasyLoop Cast**](#4--easyloop-cast-live-broadcaster-3000) | 🟣 Advanced | `3000` | FastAPI WebSocket Bridge, FFmpeg GPU Accel, Canvas | 24/7 YouTube Live, Facebook Live, TikTok & RTMP | `loopcast/Start-Studio.bat` |
| **5** | [**MangaRecap AI Studio 2.0**](#5--mangarecap-ai-studio-20-5503) | 🟣 Advanced | `5503` | PyMuPDF, OpenCV, Gemini Vision, ElevenLabs, FFmpeg | Long-Form Recaps (20 min - 2+ hrs) & High-CTR Shorts | `manga-recap-ai-studio/Start-Studio.bat` |
| **6** | [**VideoRepurpose AI Studio**](#6--videorepurpose-ai-studio-5504) | 🟣 Advanced | `5504` | OpenCV Delogo, Whisper STT, LLM Rewrite, Edge-TTS | Anti-Copyright Remaster & Multilingual Re-Voicing | `video-repurpose-ai-studio/Start-Studio.bat` |

---

## ⚡ Universal Quick Start

All tools feature a zero-friction **one-click launcher** for Windows (`Start-Studio.bat`). Each studio operates on its own dedicated local port, allowing you to run multiple studios simultaneously without port collisions:

```powershell
# Open any project folder and double-click its Start-Studio.bat:
d:\Projects\VideoTools\world-flag-guess-studio\Start-Studio.bat    # Port 5500
d:\Projects\VideoTools\find-animal-dance-studio\Start-Studio.bat    # Port 5501
d:\Projects\VideoTools\karaoke-song-studio\Start-Studio.bat        # Port 5502
d:\Projects\VideoTools\loopcast\Start-Studio.bat                   # Port 3000
d:\Projects\VideoTools\manga-recap-ai-studio\Start-Studio.bat      # Port 5503
d:\Projects\VideoTools\video-repurpose-ai-studio\Start-Studio.bat  # Port 5504
```

> [!TIP]
> **Zero Dependency Guarantee for Tier 1 Tools:** `world-flag-guess-studio`, `find-animal-dance-studio`, and `karaoke-song-studio` do **not** require Python, Node.js, npm, or Conda. They utilize a lightweight PowerShell micro-server or direct browser loading!

---

## 🔍 Deep Dive: Production Studios

### 1. 🚩 World Flag Guess Studio (`:5500`)
**Category:** Interactive Flag Trivia Quiz & Automated Short-Form Video Generator  
**Directory:** [`world-flag-guess-studio/`](world-flag-guess-studio/)

- **197 Sovereign Nations Dataset:** Full database of all 193 UN member states + Vatican, Palestine, Kosovo, and Taiwan with CORS-friendly retina flags and curated fun facts.
- **Dynamic Scope & Continent Filters:** Filter by continent (Asia, Europe, Africa, Americas, Oceania) or run segmented batches (e.g., Countries 1–10, 11–20) for episodic YouTube Shorts series.
- **Automated Video Studio Mode:** Renders clean, clutter-free 1080p canvas video with custom countdown timer animations, answer reveal highlight effects, and zero UI control junk.
- **Neural Voiceover & Audio Pipeline:** Decoded audio buffer architecture with inaudible keepalive carrier oscillators to ensure Chromium never drops recording audio during pauses.
- **Creator Customizer:** Live color pickers (Background, Card, Accent), 6 instant one-click color themes, custom logo watermark overlay (Round, Square, Shield), and cache-clearing tools.

---

### 2. 🦆 Animal Dance Studio 2.0 (`:5501`)
**Category:** Viral "Find The Hidden Dancing Animals" Video Suite  
**Directory:** [`find-animal-dance-studio/`](find-animal-dance-studio/)

- **Flawless Real-Time Recording & EBML Patcher:** In-DOM live rendering surface ensuring full 30/60 FPS recording with automatic `fix-webm-duration` metadata injection for universal playback on VLC, QuickTime, Instagram, and TikTok.
- **Chroma-Key GIF Background Remover:** Upload any animated GIF and remove solid backgrounds using an interactive canvas eyedropper with configurable tolerance.
- **15+ Built-in Dancing Transparent Characters:** Shuba Duck, Wow Duck, Vibing Cat, Popcat, Party Cat, Capybara, Dancing Dog, Penguin, Rabbit, and Hamster.
- **Waveform Audio Trimmer & Multi-Track Library:** Interactive visual waveform trimmer with draggable start/end pins, live needle playhead, and permanent IndexedDB storage.
- **6 Procedural Synthesizers & WAV Exporter:** Royalty-free browser-synthesized audio tracks (Quack Hop, Sneaky Detective, Arcade Bounce, Tick-Tock Tension, Cozy Lofi, Animal Polka).
- **6 Ready-to-Use Viral Templates:** 1-click loading for scenes like *"Find 15 Ducks in Water Village"*, *"Attic Library Mystery"*, and *"Speed Test 10s"*.

---

### 3. 🎤 Karaoke Song Studio 2.0 (`:5502`)
**Category:** Automated Multi-Resolution Lyric Wiping & Karaoke Video Engine  
**Directory:** [`karaoke-song-studio/`](karaoke-song-studio/)

- **Multi-Resolution Video Rendering:** Instant canvas rendering in 9:16 (Shorts/TikTok), 16:9 (YouTube), 1:1 (Square), and 4:5 (Social) from 720p HD up to 4K UHD.
- **Browser-Native DSP Center-Channel Vocal Processor:** Real-time center-channel vocal reduction and vocal isolation directly via Web Audio API.
- **Anti-Copyright Audio FX Rack:** Dynamic pitch shifting, tempo tweaking, and reverb coloration to prevent Content ID matches while preserving listening quality.
- **Smart Lyrics Engine:** Paste raw song lyrics for auto-distribution across track timestamps, or import synchronized `.LRC` / `.SRT` files with 1-click line splitting and merging.
- **Kinetic Typography & Wiping Effects:** Smooth gradient wipes across active words with customizable hook banners, title cards, and floating particle backgrounds.

---

### 4. 📺 EasyLoop Cast Live Broadcaster (`:3000`)
**Category:** 24/7 Gapless Video Broadcaster & Multi-Platform RTMP Streamer  
**Directory:** [`loopcast/`](loopcast/)

- **Simulcast (Multi-Stream) RTMP/RTMPS:** Stream pre-recorded video playlists simultaneously to YouTube Live, Facebook Live, TikTok Live, Instagram Live, and custom RTMP endpoints.
- **0ms Gapless A/B Dual-Deck Engine:** Employs twin HTML5 video players with RAM pre-buffering and freeze-frame fallback shields, eliminating black screen blinks between video changes.
- **Hardware-Accelerated Encoding Bridge (`bridge.py`):** Auto-detects and engages GPU acceleration (NVIDIA `h264_nvenc`, AMD `h264_amf`, Intel `h264_qsv`, or CPU `libx264`) via FastAPI WebSockets.
- **Frame Composition & Logo Masking:** Real-time aspect ratio conversion (9:16 Vertical, 16:9 Landscape, 1:1), real-time visual FX, custom watermarks, and blur patches to cover original watermarks or timestamps.
- **Privacy-First Client Storage:** Playlists, stream configurations, and settings persist safely in local browser IndexedDB / LocalStorage with JSON backup & restore.

---

### 5. 🎬 MangaRecap AI Studio 2.0 (`:5503`)
**Category:** Long-Form Viral Recap Production Suite (20 Min – 2+ Hours)  
**Directory:** [`manga-recap-ai-studio/`](manga-recap-ai-studio/)

- **Automated Panel Extraction:** PyMuPDF and OpenCV contour/gutter detection slices raw PDF manga/manhwa chapters into clean individual action panels.
- **Multimodal AI Scriptwriter:** Powered by Google Gemini Vision with custom story directives (pacing, tone, character aliases) to generate transformative third-person narration.
- **Hybrid Voiceover Suite:** ElevenLabs high-retention human voices (Adam, George, Marcus, Prem), zero-cost Edge-TTS fallback, or **direct in-browser manual microphone recording** per segment.
- **Automated Audio Mastering Chain:** FFmpeg 80Hz highpass filter, soft vocal compressor, and -28dB cinematic ambient room-tone bed.
- **Anti-Copyright Visual Pipeline:** Dynamic Ken Burns camera zooms, blurred ambient border backgrounds, and subtle anti-hash grain noise.
- **High-CTR YouTube Packaging Kit:** Zero-Manga-Name thumbnail generator with curiosity hook badges, 5 viral titles, timestamped SEO descriptions, and tags.

---

### 6. 🛡️ VideoRepurpose AI Studio (`:5504`)
**Category:** Anti-Copyright Video Remaster, Re-Voice & Multilingual Suite  
**Directory:** [`video-repurpose-ai-studio/`](video-repurpose-ai-studio/)

- **Perceptual Hash Breaking:** Horizontal stream flipping, 1.03x dynamic PTS speed alteration, 2–3% micro-zoom cropping, and 1–2% randomized film grain overlay.
- **Intelligent Delogo Engine:** FFmpeg pixel interpolation and blurring over existing channel watermarks with 1-click corner presets.
- **Multilingual Re-Voicing Pipeline:** Automatic Whisper speech-to-text extraction, total script paraphrasing (same language or cross-language translation into Hindi, English, Bengali, Spanish, Japanese, Urdu), and neural voice synthesis.
- **Cinematic LUTs & Audio Ducking:** Cinematic color grading (Warm, Hollywood Teal/Orange, Noir) with automated background music bed ducking (-26dB under speech).
- **Interactive Timeline & Packaging:** Scrub video, cut unwanted sponsor segments, add timed text callouts, and generate high-CTR thumbnail hooks.

---

## 🔮 Upcoming Tools Roadmap

We are actively building and expanding this monorepo. Here is what is currently planned and in development:

### 🟢 Upcoming Easy-Level Tools (Zero-Dependency / Browser-Native)
- [ ] **Split-Screen Meme & Brainrot Combiner:** Browser-based tool to pair viral top videos with bottom gameplay (Subway Surfers, GTA Stunts, Satisfying Slime) with sync controls.
- [ ] **Rankings & Leaderboard Video Maker:** Dynamic animated tier-list and comparison bar-chart video generator for trending comparisons.
- [ ] **Fake Text / Reddit Storyreel Studio:** Realistic iMessage, WhatsApp, and Reddit conversation animator with automated speech synthesis and mechanical keyboard typing sound effects.
- [ ] **Before/After Video Slider Studio:** Interactive interactive slider comparison video generator for transformations, remodeling, and CGI breakdowns.

### 🟣 Upcoming Advanced-Level Tools (AI & Media Engines)
- [ ] **AI Faceless History & Myth Studio:** End-to-end documentary video generator turning historical prompts into stylized Ken Burns visual sequences with deep cinematic narration.
- [ ] **Smart Podcast Auto-Clipper & Face Tracker:** Automatically detects speakers in long-form podcasts, tracks faces, and formats into dynamic 9:16 Shorts with auto-captioning.
- [ ] **Voice-Clone Auto-Dubbing Hub:** Multi-speaker translation and voice-cloning pipeline preserving original vocal pitch, inflection, and room acoustics across languages.
- [ ] **Automated YouTube Shorts B-Roll Sync Engine:** Analyzes any voiceover script, extracts semantic keywords, fetches matching stock footage/B-roll, and renders fully captioned shorts.

---

## 📁 Directory Architecture

```
d:\Projects\VideoTools/
├── README.md                           # Main Monorepo Documentation (This File)
│
├── find-animal-dance-studio/           # [🟢 Port 5501] Animal Dance Studio 2.0
│   ├── index.html                      # Studio Interface & Canvas Compositor
│   ├── Start-Studio.bat                # 1-Click Windows Launcher
│   ├── server.ps1                      # Zero-dependency local server
│   ├── js/                             # GIF engine, Web Audio synth, Studio coordinator
│   └── assets/                         # Transparent animals & backgrounds
│
├── karaoke-song-studio/                # [🟢 Port 5502] Karaoke Song Studio 2.0
│   ├── index.html                      # Multi-Resolution Studio UI
│   ├── Start-Studio.bat                # 1-Click Windows Launcher
│   ├── js/                             # DSP Vocal Processor, Lyrics Auto-Sync, Canvas Renderer
│   └── lib/                            # MP4 muxer & duration patchers
│
├── world-flag-guess-studio/            # [🟢 Port 5500] World Flag Guess Studio
│   ├── index.html                      # Interactive Quiz & Automated Video Stage
│   ├── Start-Studio.bat                # 1-Click Windows Launcher
│   ├── lib/                            # Duration & MP4 utilities
│   └── api.php                         # Optional PHP helper for shared hosting
│
├── loopcast/                           # [🟣 Port 3000] EasyLoop Cast Broadcaster
│   ├── index.html                      # Broadcaster Dashboard & Dual-Deck Engine
│   ├── bridge.py                       # Hardware-Accelerated RTMP Streaming Server
│   ├── Start-Studio.bat                # 1-Click Broadcaster Launcher
│   └── Start-RTMP-Bridge.bat           # 1-Click Python RTMP Bridge Launcher
│
├── manga-recap-ai-studio/              # [🟣 Port 5503] MangaRecap AI Studio 2.0
│   ├── main.py                         # FastAPI Backend
│   ├── Start-Studio.bat                # 1-Click Windows Launcher
│   ├── requirements.txt                # Python dependencies (PyMuPDF, OpenCV, etc.)
│   ├── app/                            # Panel slicer, Gemini Vision script, Voice engine
│   └── static/                         # Dark glassmorphic UI & audio recorder
│
├── video-repurpose-ai-studio/          # [🟣 Port 5504] VideoRepurpose AI Studio
│   ├── main.py                         # FastAPI Backend
│   ├── Start-Studio.bat                # 1-Click Windows Launcher
│   ├── requirements.txt                # Python dependencies (Torch, Whisper, OpenCV)
│   ├── app/                            # Delogo, Hash Breaker, Whisper STT, Re-voicer
│   └── static/                         # Web Editor & Timeline
│
└── versions/                           # Production archive bundles (.rar)
```

---

## 🛠️ Adding New Tools (Developer Guidelines)

When contributing or adding a new video tool to this repository, follow these conventions:

### 1. Naming & Directory Convention
- Use kebab-case descriptive directory names: `my-new-video-studio`.
- Always include a dedicated `README.md` inside the tool's directory detailing its specific setup and features.

### 2. Dedicated Port Allocation
To avoid port conflicts, assign a unique port from our convention range:
- `5500`: `world-flag-guess-studio`
- `5501`: `find-animal-dance-studio`
- `5502`: `karaoke-song-studio`
- `5503`: `manga-recap-ai-studio`
- `5504`: `video-repurpose-ai-studio`
- `5505+`: **Reserved for newly added video tools**
- `3000`: `loopcast` (WebSocket & RTMP Bridge)

### 3. One-Click Launcher (`Start-Studio.bat`)
Every project must contain a root `Start-Studio.bat` that:
1. Validates prerequisites (or runs zero-dependency PowerShell micro-server).
2. Starts the backend or local web server on its assigned port.
3. Automatically launches the user's default browser to `http://localhost:<PORT>/`.

---

## 📜 License & Usage

All tools in this repository are developed for high-retention content creation, educational quiz gaming, automated video production, and social video distribution. Please ensure all uploaded assets and music comply with your platform's fair-use and copyright guidelines.
