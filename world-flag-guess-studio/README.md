# 🚩 World Flag Guess Studio (All 197 Nations)

> **Interactive Flag Trivia Quiz & Automated Short-Form Video Production Engine**  
> Built with pure **HTML5, Tailwind CSS, and Vanilla ES6+ JavaScript**. Zero npm packages or Python installations required.

---

## ⚡ Quick Start: One-Click Launcher

To run World Flag Guess Studio with full voiceover audio generation enabled for video exports:

1. **Double-click `Start-Studio.bat`** inside the `world-flag-guess-studio` folder.
2. The built-in zero-dependency local server will start and automatically launch **`http://localhost:5500/index.html`** in your default browser.
3. Everything is active: **Neural Voiceover Studio**, **1080p Canvas Recording Engine**, **All 197 Sovereign World Flags**, **Continent Filters**, and **Dynamic Scene Builder**!

*(Note: You can also open `index.html` directly via `file:///` for interactive play; if the local server is running in the background, it connects automatically).*

---

## 🌟 Overview

**World Flag Guess Studio** is a dual-purpose web application designed for content creators, educators, and gamers:
1. **Interactive Responsive Quiz Game:** A responsive, dark-mode trivia guessing game with manual start/pause/stop controls, touch support, and keyboard shortcuts (`1`, `2`, `3`, `Spacebar`).
2. **Automated Video Production Studio:** Automatically generates clean, broadcast-standard video clips (.webm) formatted for **YouTube Shorts, Instagram Reels, TikTok (9:16 Vertical, 1080×1920)** or **Widescreen Landscape (16:9, 1920×1080)** with **zero administrative controls, buttons, or UI clutter** visible to viewers.

---

## 🚀 Key Features

### 1. Complete Dataset of All 197 Sovereign World Flags
- Complete dataset of **all 197 sovereign nations** across the globe (all 193 UN member states + Vatican City, Palestine, Kosovo, Taiwan) with verified CORS-friendly flagcdn graphics, accurate answers, distinct distractors, and curated educational fun facts.

### 2. Flexible Selection Modes & Continent Filtering
- **🌍 Filter by Continent:** One-click filtering to create continent-specific quizzes and video shorts:
  - **All Nations (197)**
  - **Asia (48 countries)**
  - **Europe (45 countries)**
  - **Africa (54 countries)**
  - **Americas (36 countries)**
  - **Oceania (14 countries)**
- **🎯 Count Mode:** Choose from quick presets (**10**, **20**, **30**, **40**, **50**, **100**, or **All Flags**), or input any **Custom Count** (e.g. 15, 25).
- **🔢 Segmented Range Mode (Part 1, 2, 3...):** Select exact country numbers (e.g. **1–10**, **11–20**, **21–30**, **41–50**, or custom From/To inputs) to produce serialized short-form videos without repeating any country.
- **📋 Interactive Manual Country Picker:**
  - Full-screen modal with searchable list of all 197 countries.
  - Search by country name or 2-letter ISO code.
  - Filter by continent inside the modal.
  - Individual checkboxes with "Select All Visible" and "Clear Visible" batch buttons.
  - Questions are strictly limited to the exact countries selected.
- **🔄 Dynamic Label & Scene Synchronization (Zero Hardcoded "100"s):**
  - Stage pill, top counter, idle start overlay, intro viral hook pill (`🔥 99% FAIL • CAN YOU GUESS ALL X?`), intro title, outro congratulations screen & voice narration, checkpoint triggers, drawer badges, and video export filenames (`range11-20_10countries.webm`, `custom_15countries.webm`, `asia_48countries.webm`) automatically adapt to the exact selected scope.
- **🔀 Random Question Order (Fisher-Yates Shuffle):** Toggle between **Random Order** and **Serial Order** in the Control Deck with zero duplicates.
- **🔀 Reshuffle Now Button:** Immediately reshuffles the active question pool on demand with instant stage preview.

### 3. Custom UI Brand Colors, Universal State Persistence & Cache Clearing
- **Unique Style Customizer for Every Creator:** Change UI colors (Background, Card/Surface, Text, Brand Accent) so every channel produces distinct, personalized content with zero duplicate templates or copyright issues across short-form platforms.
- **Live Color Pickers & Hex Inputs:** Real-time color updates across both the live stage DOM (via dynamic CSS variables) and the canvas video recorder (via reactive stage themes).
- **6 Quick One-Click Color Presets:**
  - *Deep Navy* (Default deep slate with indigo/violet accents)
  - *OLED Neon* (Dark neon purple with vibrant pink)
  - *Imperial Jade* (Deep forest emerald with jade green)
  - *Crimson Red* (Warm dark with crimson fire)
  - *Amber Gold* (Rich dark with gold accents)
  - *Crisp Light* (Clean high-contrast light theme)
- **↺ Reset Custom Colors to Studio Theme:** A dedicated button in the Custom Colors panel allows one-click removal of custom color overrides, resetting color pickers and restoring the Pro Dark Studio theme without wiping your question count or scene scripts.
- **💾 Universal `localStorage` Persistence:** All studio setups—question count limits (5, 10, 20, 50, 100), active themes, custom colors, TTS voice selection & speech rate, countdown timer durations, intro/midroll/outro texts, and watermark branding—automatically persist across page reloads.
- **🧹 Complete Reset & Clear Cache Option:** Available in both the Top Header (`🧹 Clear Cache`) and the Control Deck footer (`🧹 Reset All Settings & Clear Cache`). Wipes all cached local storage data, image caches, and CSS variables with a confirmation modal and instant toast feedback, restoring factory-fresh defaults.
- **High-Contrast Answer Reveal Contrast:** Guarantees vivid emerald green highlighting (`linear-gradient(135deg, #059669, #10b981)`) with glowing badges and checkmark icons for the correct answer, while distractors are cleanly dimmed to 32% opacity with line-through styling. If an incorrect answer is clicked, it highlights in rose-red with shake animation.

### 4. Expansive High-Retention Hook Scenes with Integrated Copyright & Brand Signature
- **Grand Screen-Commanding Card Design:** Upgraded from a small box to an expansive, high-impact glassmorphic card occupying ~72–75% height in 9:16 and ~82–88% in 16:9 widescreen, giving the intro challenge a commanding visual presence that stops viewers from swiping away.
- **Enlarged 5-Flag Visual Hook Showcase:** Displays an eye-catching, overlapping fan of 5 iconic popular flags (🇺🇸 USA, 🇯🇵 Japan, 🇧🇷 Brazil, 🇫🇷 France, 🇬🇧 UK) scaled up to large dimensions with 3D tilt angles, glowing border rings, gold accenting on the center flag, and high-resolution retina assets (`w320`) on both live DOM and canvas video recording. Viewers instantly recognize the trivia challenge in the first split-second!
- **Enlarged Hero Typography & Viral Challenge Badge:**
  - Scaled-up title (`font-black 5xl / 68px`) and subtitle (`font-semibold 2xl / 36px`) for bold legibility on mobile screens.
  - High-visibility pulsating challenge pill badge: `🔥 99% FAIL • CAN YOU GUESS ALL 100?`.
- **Integrated Bottom Brand & Copyright Signature:**
  - Dedicated toggle: **"Show Brand / Copyright on Scenes"** in Section 2.
  - Renders a clean copyright attribution bar (e.g. `© @CountryQuiz • Flag Quiz Studio` with verified badge) at the bottom of scene cards.
- **Fast & Punchy Hook Retention:** Snappy 1.85s pacing with high-energy challenge hook ("Can you guess all flags with zero mistakes? Question 1 starts now!") so viewers stay hooked and Question 1 begins right away without swiping.
- **Interactive Scene Preview Controls:** Dedicated **"🎬 Preview Intro Hook Scene"** and **"🎉 Preview Outro Scene"** buttons in Section 4 allow one-click instant preview of the enlarged scenes directly inside the stage viewport at any time.
- **Intro Options (Studio Scene vs. Custom Video Clip):**
  - Option A: **Animated Studio Scene** with expanded 5-flag hook showcase, customizable Screen Title, Subtitle, and synthesized voiceover narration.
  - Option B: **Custom Video Clip Upload** to seamlessly play an uploaded `.mp4` or `.webm` intro video before Question 1 starts.
- **Dynamic Mid-Roll Checkpoint Scenes:** Add custom checkpoints at any question trigger with personalized titles and voiceover scripts.

### 5. Guaranteed Voiceover in Video Recording & Silky Smooth Frame Rate
- **Direct Decoded Audio Buffer Architecture:** Direct speech audio is decoded into native `AudioBuffer` and routed into `voiceGain`, `masterGain`, and `mediaStreamDest`.
- **Inaudible Keepalive Carrier Oscillator:** Continuously runs an inaudible carrier oscillator (`0.00002` gain) into `mediaStreamDest` to guarantee that Chromium's `MediaRecorder` audio track never sleeps, mutes, or drops during silent gaps.
- **Mixed Single Audio Track:** Voiceover, sound effects (ticks, chimes, buzzers), and optional host live microphone are mixed together into track 0 of the `MediaStream`, preventing browsers from ignoring secondary audio tracks.
- **Smooth Canvas Recording Loop:** Delta-time synchronized rendering loop (`requestAnimationFrame`) prevents frame drops and eliminates micro-stuttering.
- **Encoding Quality Presets:**
  - *Smooth 1080p (2.8 Mbps, 30 FPS)*: Ideal for normal laptops and everyday PCs to record smoothly without lag.
  - *Studio Crisp (4.5 Mbps)*: Higher bitrate for performance PCs.
  - *Ultra (7.2 Mbps, 60 FPS)*: Maximum quality for high-end gaming rigs.
- **Clear Performance & Voiceover Advisory Notice:** Displayed prominently in the Video Production section to guide users on hardware requirements and remind them to keep voiceover enabled.

### 6. Channel Branding, Copyright & Custom Logo Anti-Theft Watermark
- **Content Theft Protection:** Automatically bakes your channel branding, copyright notice, and custom logo avatar directly onto every canvas recording frame and live stage preview.
- **Channel / Copyright Text Input:** Customize your handle or copyright notice (e.g., `@CountryQuiz`, `© GeographyMasters 2026`). Includes a quick `+ ©` preset button.
- **Custom Logo Upload:** Upload any PNG, JPG, or WebP logo file with real-time preview and reset option.
- **Customizable Logo Shapes:** Choose between **Round (Circle)**, **Rounded Square**, or **Square**.
- **Adjustable Size & Position:** Position watermark in `Bottom Right`, `Top Right`, or `Bottom Left`, with `Small`, `Medium`, or `Large` size scaling.

### 7. Dual-Zone Layout & Production Stage
- **Expanded Big Single-Line Question Title:** High-impact typography with dynamic auto-fitting (`fitQuestionText`) and strict `white-space: nowrap` to guarantee bold, enlarged size strictly on a single line across both the live stage DOM and 1080p canvas video recording.
- **Fluid 16:9 Cinema Mobile Responsiveness:** Dynamically scales all visual assets, flag graphics, question prompt, countdown timer, and option cards on mobile devices so all elements fit within the 16:9 frame with zero overflow, clipping, or distortion.
- **Flag Container (Zero Border, Zero Padding):** Flag graphic is presented as a clean direct photo with sleek border-radius and soft drop shadow, completely free of border pixels or inner padding.
- **Educational Fun Fact Toggle (Default: Enabled):** Rich country trivia with 4.2s reveal hold, or disable for fast-paced 1.8s video pacing.

---

## 🕹️ Keyboard Controls

| Key | Action |
|-----|--------|
| `1` | Select Option A |
| `2` | Select Option B |
| `3` | Select Option C |
| `Space` | Start Quiz / Reveal Answer / Advance to Next Question |
| `◀` / `▶` | Previous / Next Question |

---

## 💡 How to Run & Deploy

### A. Local PC (One-Click Launcher)
1. Double-click **`Start-Studio.bat`** inside the folder.
2. The local server opens **`http://localhost:5500/index.html`** in your browser automatically.
3. Everything is active: voice synthesis, video recording, 197 flags, and FastStart MP4 packaging.

### B. Web Hosting Server (Hostinger, cPanel, LiteSpeed, Apache, Nginx)
To host online or sell as a turnkey web tool:
1. Upload the entire project folder to your hosting file manager (e.g. `public_html/` or a subfolder like `public_html/flag-quiz/`).
2. Required files on server:
   - `index.html`
   - `api.php`
   - `.htaccess`
   - `lib/` (`fix-mp4.js`, `fix-webm-duration.js`)
3. Open `https://yourdomain.com/` (or `https://yourdomain.com/flag-quiz/index.html`).
4. The server health badge will show **`● Studio Active`**.
5. When exporting videos, voiceover audio and sound effects are automatically synthesized and 100% encoded into universal MP4 video downloads with zero Node.js, Python, or command-line configuration required!
