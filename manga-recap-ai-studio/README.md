# 🎬 MangaRecap AI Studio 2.0 - Long-Form Viral Recap Video Production Suite

> **All-In-One Production Suite for High-Retention Manga & Manhwa Video Recaps (20 Min to 2+ Hours)**  
> Built with FastAPI, PyMuPDF, OpenCV Gutter Detection, Google Gemini Vision Prompt Injection, ElevenLabs & Edge-TTS Synthesis, In-Browser Manual Microphone Recording, Dynamic Ken Burns FFmpeg Motion Engine, and Zero-Manga-Name High-CTR Packaging.

---

## ⚡ Quick Start: One-Click Launcher

1. Navigate to: `d:\VideoTools\manga-recap-ai-studio`
2. **Double-click `Start-Studio.bat`**  
   *(The server starts on port `5503` and automatically opens `http://localhost:5503/` in your default web browser).*
3. **Instant Audition:** Click the top header **"🌟 Load Demo Project"** button to immediately preview a ready-made 6-panel recap, test the narrator voice, record your own voiceover, and export a sample video with a single click!

---

## 🌟 Key Features & Architectural Highlights

### 1. 🧠 Custom Story & Style Directives (`<textarea>` System Prompt Injection)
- **Location:** Prominently placed in Step 1 (Setup & Directives).
- **Default Placeholder:**
  > `"e.g., Emphasize fight scenes and battle mechanics; keep the narrator tone dark and suspenseful; skip unnecessary side conversations; highlight the leveling system stats; refer to the main character as 'The Shadow King'..."`
- **Dynamic Gemini Injection:** Dynamically passes directives to Gemini Vision:
  ```
  CRITICAL USER DIRECTIVE: Prioritize the following custom guidelines when pacing, narrating, and summarizing these panels: {custom_instructions}
  ```
- Directly influences pacing, tension level, character aliases, and the curiosity hook tone of thumbnail titles!

---

### 2. 🎙️ Voice Synthesis & Manual Microphone Recording (100% Monetization Safe)
- **ElevenLabs High-Retention Storyteller Voices:**
  - English: **Adam** (deep authority), **George** (warm storyteller), **Marcus**, **Daniel**.
  - Hindi: **Prem** (expressive storyteller), **Kabir** (deep narrator), **Aditi**.
  - Custom Cloned Voice ID support.
  - Tuned with **Stability 0.48** & **Clarity 0.78** for natural human inflection.
- **Natural Breathing & Cadence:** Gemini script engine inserts ellipses (`...`), em dashes (`—`), and strategic commas, preventing robotic rushing.
- **Zero-Cost Edge-TTS Fallback:** Includes natural Microsoft neural voices (`ChristopherNeural`, `GuyNeural`, `MadhurNeural`) with random cadence jitter (±3%) so the app works even without an API key.
- **CRITICAL FEATURE — Manual Voice Recording per Segment:**
  - Click **"Record Mic"** on any script segment to record your own authentic voice directly in the browser!
  - Real-time recording timer with pulsing visual indicator.
  - Live upload & automatic FFmpeg mastering.
  - Upload custom pre-recorded `.mp3` / `.wav` voice tracks per segment.

---

### 3. 🎛️ Studio Audio Mastering Pipeline (FFmpeg)
All generated and recorded voice clips pass through an automated broadcast mastering filter:
- **80Hz Highpass Filter (`highpass=f=80`):** Strips microphone thumps, air pops, and low-end digital rumble.
- **Soft Vocal Compressor (`acompressor=threshold=-18dB:ratio=3:attack=10:release=100`):** Evens dynamic peaks for a rich broadcast presence.
- **Subtle Ambient Audio Bed (-28dB):** Layered background cinematic drone / room tone mixed under the narration, ensuring YouTube algorithms detect authentic multi-track audio.

---

### 4. 🛡️ Transformative Visuals & Anti-Copyright Protection
- **Smart Panel Cropping:** PyMuPDF + OpenCV contour and gutter detection crops individual action panels (`panel_001.png`, etc.) without showing raw full pages.
- **Dynamic Ken Burns Camera Motion:** Constant cinematic motion on every panel (`slow_zoom_in`, `slow_zoom_out`, `pan_up`, `pan_down`). Zero static frames.
- **Blurred Ambient Background:** Darkened Gaussian-blurred version of the panel fills 16:9 and 9:16 borders.
- **Anti-Hash Grade & 1% Grain Noise:** Subtle warm grade (`eq=contrast=1.05:saturation=1.08`) and subtle grain overlay (`noise=c0s=3:c0f=u`) breaks perceptual image-hashing algorithms.
- **Transformative Third-Person Commentary:** Strictly fair-use recap script, never reading speech bubbles verbatim.

---

### 5. 🎯 Zero-Manga-Name Packaging & High-CTR Thumbnail Engine
Successful recap channels never put the official comic title in metadata to maximize CTR and prevent automated crawling:
- **Pillow & OpenCV High-CTR Thumbnail:**
  - Automatically identifies the climax action panel (`is_climax_panel: true`).
  - 16:9 (1280x720) framing, contrast boost (+22%), color saturation boost (+25%), dark radial vignette, amber rim glow.
  - High-impact display typography (`Impact` / `Montserrat-Black`) with thick black stroke and drop shadow.
  - 3 to 6 word curiosity hooks: *"HE WAS BETRAYED!"*, *"BANNED FROM THE SECT..."*, *"HE AWAKENED GOD POWERS!"*.
  - Strict Rule: **Zero manga name, chapter, or author on the thumbnail.**
- **YouTube Metadata Package:**
  - **5 Viral Video Titles** based on high-concept tropes.
  - **SEO Description** with hook paragraph, exact video timestamps (`00:00 - Introduction`, etc.), Fair Use legal disclaimer, and subscriber CTA.
  - **Targeted Tags & Keywords** in copy-ready CSV format.
  - **Backend String Validator** verifies the manga title is strictly scrubbed from all public outputs.

---

## 📁 File Structure

```
d:\VideoTools\manga-recap-ai-studio/
├── app/
│   ├── config.py              # Configuration & settings management
│   ├── panel_extractor.py     # PyMuPDF & OpenCV panel gutter slicer
│   ├── script_generator.py    # Gemini Vision recap script engine with custom directives
│   ├── voice_engine.py        # ElevenLabs, Edge-TTS fallback & manual mic mastering
│   ├── video_renderer.py      # FFmpeg chunked Ken Burns motion & concat demuxer
│   ├── thumbnail_generator.py # OpenCV & Pillow high-CTR thumbnail engine
│   ├── metadata_generator.py  # 5 Viral titles, timestamped SEO description & tags
│   └── project_manager.py     # Project state & built-in 6-panel demo generator
├── static/
│   ├── index.html             # Dark glassmorphic responsive UI
│   ├── css/style.css          # Tailored CSS & animations
│   ├── js/
│   │   ├── app.js             # Client application coordinator
│   │   ├── audio-recorder.js  # In-browser microphone recorder & uploader
│   │   └── api-client.js      # REST API client & status polling
│   ├── fonts/                 # Heavy display fonts (Impact, Arial Bold)
│   └── assets/ambient/        # Subtle ambient background drone loops
├── Start-Studio.bat           # 1-Click Windows Launcher (Port 5503)
├── server.ps1                 # Optional PowerShell background server
├── main.py                    # FastAPI server entry point
├── requirements.txt           # Python dependencies
└── README.md                  # Comprehensive documentation
```

---

## 🕹️ Workflow Summary (5 Steps)

1. **Step 1: Setup & Directives** — Upload Manga PDF, enter internal comic reference, pick aspect ratio & voice, and write custom story directives in the `<textarea>`.
2. **Step 2: Panels & Slicing** — Review cropped panels; click *Generate AI Script*.
3. **Step 3: Story Script & Voiceover Studio** — Tweak narration lines, audition voiceover, or record manual microphone voice clips.
4. **Step 4: Video Compilation** — Render chunks with Ken Burns motion, blurred ambient backgrounds, and audio mastering into a seamless FastStart MP4.
5. **Step 5: Publishing Kit** — Download final video, preview high-CTR thumbnail, and copy 1-click viral titles, timestamps, and tags!
