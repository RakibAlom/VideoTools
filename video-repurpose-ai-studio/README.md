# VideoRepurpose AI Studio 🎬🛡️
**Anti-Copyright Video Remaster, Re-Voice & Multilingual Publishing Suite**

Transform videos from other channels, creators, or blogs (movie recaps, anime/manga explained, story breakdowns) into 100% unique, copyright-safe videos with authentic human voiceovers in multiple languages.

---

## 🌟 Key Features

### 1. 🛡️ Anti-Copyright & Perceptual Hash Breaking Engine
- **Horizontal Mirroring (Flip)**: Inverts video stream horizontally to break spatial fingerprinting.
- **Dynamic Speed Alteration (1.03x)**: Alters PTS and audio rate to defeat temporal hash matching.
- **Micro-Zoom Center Crop (2-3%)**: Destroys bounding pixel alignments used by automated visual crawlers.
- **Film Grain & Digital Noise Overlay**: Applies 1-2% randomized noise to invalidate exact byte hashing.
- **Radial Dark Vignette**: Darkens perimeter edges for cinematic tone and algorithm obfuscation.
- **Cinematic Color Grading**: Presets for Cinematic Warm, Hollywood Teal & Orange, Noir, and Vibrant.
- **Aspect Ratio & Canvas Framing**: 16:9 YouTube, 9:16 Shorts/Reels/TikTok, 1:1 Square with Gaussian-blurred ambient background padding.

### 2. 🚫 Automatic & Visual Watermark Removal (Delogo)
- **FFmpeg Delogo Integration**: Seamlessly interpolates and blurs surrounding pixels over original channel watermarks.
- **1-Click Corner Presets**: Top-Right, Top-Left, Bottom-Right, Bottom-Left presets.
- **Custom Watermark Overlay**: Burn your own channel handle (e.g. `@MyRecapStudio`) with customizable position, opacity, and font size.

### 3. 🎙️ Multilingual Re-Voice & Zero-Plagiarism Scripting
- **Audio Extraction & Speech-to-Text**: Automatically extracts speech and detects spoken language.
- **Total Paraphrase & Rewrite**:
  - **Same Language**: 100% rewrites sentences and vocabulary while preserving the exact story progression.
  - **Cross-Language Translation**: Translates into Hindi, English, Bengali, Urdu, Spanish, or Japanese with natural colloquial recapper phrasing.
- **Zero Robotic Voices**: High-retention neural voices via Edge-TTS (free, zero-cost) and ElevenLabs.
- **Atmospheric Background Music Bed**: Synthesized royalty-free cinematic suspense, action, and lo-fi audio beds with automated vocal ducking (-26dB).

### 4. ⏱️ Interactive Video Timeline & Overlays
- In-browser video scrubbing with timestamp display.
- Mark Cut In / Cut Out to trim unwanted sponsor plugs or channel intros.
- Timed text callouts (e.g., "CHAPTER 1: THE DISCOVERY") with custom colors and font sizes.

### 5. 📦 YouTube Packaging Kit & High-CTR Thumbnail
- **Zero-Name Rule**: Never mentions the original creator, source channel, or comic title.
- **High-CTR Thumbnail Generator**: Dramatic frame capture, 16:9 crop, contrast boost, and bold curiosity hook text.
- **5 Viral Video Titles, SEO Description, & Tags**: Ready to copy-paste.

---

## 🚀 Quick Start

1. Start the server:
   ```powershell
   cd d:\VideoTools\video-repurpose-ai-studio
   python -m uvicorn main:app --host 127.0.0.1 --port 5504
   ```
   Or double-click `Start-Studio.bat`.

2. Open your browser:
   **`http://127.0.0.1:5504`**
