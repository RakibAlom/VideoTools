# 🦆 Animal Dance Studio 2.0 - Viral Hidden Animal Video Production Suite

> **All-In-One Production Suite for "Find The Hidden Dancing Animals" Reels, Shorts, and TikToks**  
> Built with HTML5, Vanilla ES6+ Canvas Engine, Web Audio API Synthesis, IndexedDB Storage, and EBML-Patched Video Recording. Zero Node.js or Python dependencies required.

---

## ⚡ Quick Start: One-Click Launcher

1. Navigate to: [d:\VideoTools\find-animal-dance-studio](file:///d:/VideoTools/find-animal-dance-studio)
2. **Double-click [Start-Studio.bat](file:///d:/VideoTools/find-animal-dance-studio/Start-Studio.bat)**  
   *(The built-in zero-dependency local server starts and automatically opens **`http://localhost:5501/index.html`** in your default web browser).*
3. *(The local server is already running and ready to use immediately at [http://localhost:5501/index.html](http://localhost:5501/index.html)).*

---

## 🌟 What's New in Version 2.0

### 1. 🎬 Flawless High-Definition Video Export & In-Modal Playback
- **Live DOM-Mounted Rendering Surface:** Renders into an in-DOM live canvas during recording, ensuring Chromium GPU compositing delivers all 30/60 FPS frames smoothly without dropping or freezing after 3–4 seconds.
- **In-Modal Video Player:** As soon as export completes, the video immediately autoplays inside the modal player so you can test and watch the complete video before downloading!
- **Real-Time Wall-Clock Synchronized Recorder:** Recording runs on accurate real-time wall-clock pacing so a 15-second video exports as an **exact 15.000-second** video clip (no shortened files or out-of-sync audio).
- **EBML Metadata Patcher (`fix-webm-duration`):** Automatically injects the missing WebM Segment Duration, TimecodeScale, and Seek Cues into the file header.
- **Universal Player Compatibility:** Downloaded videos play without freezing on **Windows Media Player, VLC, QuickTime, Instagram, TikTok, and YouTube Shorts**.

### 2. 🎯 Precision Animal Hit-Testing, Selection & Dragging
- **Guaranteed Clickable Area:** Even tiny scaled-down animals (e.g. 15% hidden inside corners, boats, or trees) maintain a minimum generous 45px hit target, preventing accidental misses.
- **Isolated Local-Space Transform:** Hit testing transforms mouse clicks directly into the animal's local rotated space.
- **Separated Resize & Rotation Handles:** Gizmo handles now maintain guaranteed minimum margin spacing around the animal body, eliminating the bug where resizing a GIF would cause the resize handle to overlap the body and block subsequent selection and dragging.

### 3. 📐 Top-Aligned Preview Canvas
- Canvas preview is neatly positioned directly beneath the navigation toolbar with maximized vertical height, eliminating unnecessary bottom dead space.

### 4. ↔️ Title to Subtitle Spacing (Gap) Control
- Slider and numeric input field (`0px` to `250px`, default 40px) allowing dynamic adjustment of the vertical spacing between the main title and subtitle.

### 5. 🎛️ Interactive Visual Waveform Trimmer & Multi-Audio Uploads
- **Interactive Dragging on Waveform:**
  - Drag the **Left Trim Pin (▶)** to adjust Trim Start time.
  - Drag the **Right Trim Pin (◀)** to adjust Trim End time.
  - Drag inside the active trim area to shift the entire trim window.
  - Real-time numerical input synchronization.
  - Animated glowing red needle playhead tracking live audio playback.
- **Multi-File Audio Upload:** Upload multiple audio tracks simultaneously.
- **Persistent IndexedDB Storage:** All uploaded tracks are saved permanently to IndexedDB.
- **Audio Audition Library:** Each saved track features an instant **Preview / Stop** audition button, **Use** track button, and **Delete** button.

### 6. 🌟 6 Ready-Made Viral Demo Templates (1-Click Setup)
Click the **"🌟 6 Ready Demos"** button in the top header to instantly load complete scene setups:
1. **Demo 1 — "Find 15 Ducks in Water Village":** Rustic stilt huts, wooden boats, classic Shuba dancing ducks, and Quack Hop bouncy music (15s).
2. **Demo 2 — "Find 20 Cats in Vintage Attic":** Cluttered library, grandfather clock, cat trees, vibing & white dancing cats with mystery jazz (15s).
3. **Demo 3 — "Find 12 Animals in Tokyo Night":** Lanterns, ramen stalls, dancing capybaras and happy dogs with upbeat 8-bit chiptune beats (15s).
4. **Demo 4 — "Extreme: 25 Tiny Hidden Ducks":** Micro-sized ducks hidden deep inside boat nooks, roofs, and baskets. Danger alert hook and suspense tension clock (20s).
5. **Demo 5 — "Speed Test: 10 Animals in 10s":** Fast-paced 10-second challenge with radial circular countdown and polka beat.
6. **Demo 6 — "Challenge + Answer Reveal Ending":** 15-second search challenge followed by a 3-second animated reveal circling all answers with glowing rings (18s).

### 3. 🦆 15+ Transparent Animal Characters & Categorized Tabs
- **5+ Dancing Ducks:**
  - `Shuba Duck` (Viral white cartoon duck with cap and orange feet)
  - `Wow B.Duck` (Animated yellow duck)
  - `Mallard Duck` (Realistic cartoon mallard)
  - `FOMO Duck` (Bouncing comic duck)
  - `B.Duck Dance` (Cute dancing duckling)
- **5+ Dancing Cats:**
  - `Vibing Cat` (Famous head-bobbing meme cat)
  - `White Dancer` (Animated white dancing kitten)
  - `Orange Tabby` (Grooving orange cat)
  - `Cute Popcat` (Viral popcat animation)
  - `Party Cat` (Celebration dancing cat)
- **5+ Other Animals:**
  - `Capybara Walk` (Walking capybara)
  - `Happy Dog` (Energetic dancing puppy)
  - `Dancing Penguin` (Waddling penguin dance)
  - `Dancing Rabbit` (Bouncing bunny)
  - `Dancing Hamster` (Cute hamster dance)

### 4. 🪄 GIF Background Remover (Chroma-Key Tool)
- Upload *any* animated GIF (even with solid white, black, or green backgrounds).
- Click **"Remove BG"**:
  - Sample the background color using the interactive canvas eyedropper or color picker.
  - Adjust the **Tolerance slider (1–120)**.
  - Click **"Make Transparent"** to automatically erase the background across all frames with anti-aliasing!
  - The transparent character is automatically saved to your character library.

### 5. 🎵 6 Copyright-Free Procedural Soundtracks + WAV Exporter
100% royalty-free, synthesized directly in the browser with zero copyright risk:
- 🦆 **Quack Hop:** 128 BPM upbeat bouncy marimba and funk synth bass.
- 🕵️ **Sneaky Detective:** 105 BPM mystery walking upright bass and jazzy chords.
- 👾 **Arcade Bounce:** 138 BPM fast 8-bit chiptune dance party.
- ⏱️ **Tick-Tock Tension:** 120 BPM dramatic countdown ticking clock with 808 sub-bass.
- ☕ **Cozy Lofi Vibes:** 90 BPM relaxing melodic chords and warm Rhodes piano.
- 🎪 **Funny Animal Polka:** 130 BPM whimsical bouncing cartoon march.
- **Save WAV Button:** Download any synthesized soundtrack as a standalone `.wav` audio file for external editing!

### 6. 💾 Permanent IndexedDB Storage
- All uploaded background images, custom GIFs, and audio tracks are saved to the browser's **IndexedDB**.
- Uploads persist permanently across page reloads and browser restarts.
- View and manage your saved files with instant **"Use"** and **"Delete"** buttons.

### 7. 🏷️ Unrestricted Watermark Positioning
- **No Bottom Limitation:** Place the watermark anywhere on the screen, all the way to 0% (top) or 100% (extreme bottom edge).
- Direct numeric inputs and percentage sliders for X (0%–100%) and Y (0%–100%).
- Free dragging with no dead zones.

### 8. 🔍 Viewport Zoom Controller (Editor Zoom)
- Zoom in on the canvas without affecting video resolution:
  - Zoom levels: **Fit (Auto), 50%, 75%, 100%, 150%, 200%, 300%**.
  - Zoom into small boats, roofs, or baskets to place tiny hidden animals with pixel-perfect precision.

### 9. ⏱️ 5 Countdown Timer Styles
- Fully optional (enable/disable toggle).
- Select from 5 distinct styles:
  1. **Top Shrinking Gradient Bar**
  2. **Bottom Shrinking Gradient Bar**
  3. **Digital Countdown Badge** (`15s... 0s` in top-right)
  4. **Radial Circular Ring** (Circular progress pie)
  5. **No Timer** (Clean presentation)

### 10. 🔢 Direct Numeric Inputs Everywhere
- **Animal Scale:** Slider + input field (`15%` to `350%`).
- **Rotation Angle:** Slider + input field (`-180°` to `+180°`).
- **Positions X & Y:** Direct numeric fields (`0%` to `100%`).
- **Unlimited Font Size:** Direct input field supporting **5px to 500px**!

### 11. ✍️ 12+ Title Style Presets & 15+ Google Fonts
- Presets: Viral Reel 3D, Cyber Neon, Golden 3D, Danger Alert, Frosted Glass, Emerald Pop, Rainbow Candy, Fire Flame, Retro Pixel, Y2K Bubble, Royal Gold, Stealth Dark.
- Fonts: `Outfit`, `Luckiest Guy`, `Bangers`, `Montserrat`, `Anton`, `Righteous`, `Fredoka`, `Titan One`, `Russo One`, `Black Ops One`, `Permanent Marker`, `Press Start 2P`, `Creepster`, `Cinzel`, `Inter`.
- Subtitle controls: independent font size (5–200px), color picker, and dark backplate pill toggle.

### 12. ↶ Complete Undo / Redo History
- Press `Ctrl+Z` to undo any change.
- Press `Ctrl+Y` or `Ctrl+Shift+Z` to redo.
- On-screen **Undo** and **Redo** buttons in the top header.
- **Reset Project** button to restore default setup.

### 13. 🎯 Fixed Highlight All Toggle & Centered Placement
- **Highlight All Button:** Functions as a clean **ON / OFF toggle** with glowing visual feedback.
- **Add +1 Animal:** Spawns the animal at the exact dead center (`0.5, 0.5`) without causing page scrolling or viewport jumps.

---

## 📁 File Structure

```
find-animal-dance-studio/
├── index.html               # Main Studio User Interface
├── style.css                # Dark Glassmorphic Design System
├── Start-Studio.bat         # One-click Windows Launcher
├── server.ps1               # Zero-dependency PowerShell HTTP Server (CORS enabled)
├── README.md                # Documentation & Guide
├── lib/
│   ├── omggif.js            # Pure JS GIF Reader & Frame Decoder
│   ├── fix-webm-duration.js # EBML Header Patcher (Fixes duration & playback)
│   └── db.js                # IndexedDB persistent storage manager
├── js/
│   ├── gif-engine.js        # Multi-frame caching & Chroma-Key Background Remover
│   ├── audio-engine.js      # 6 Web Audio synthesizers, trimmer, and WAV exporter
│   └── studio.js            # Master canvas engine, undo/redo, & video recorder
└── assets/
    ├── animals/
    │   ├── shuba_duck.gif   # Classic Shuba Dancing Duck
    │   ├── duck_wow.gif     # Dance Wow B.Duck
    │   ├── duck_mallard.gif # Mallard Duck
    │   ├── duck_fomo.gif    # FOMO Duck
    │   ├── duck_bduck.gif   # B.Duck Dance
    │   ├── cat_vibing.gif   # Vibing Cat
    │   ├── cat_white.gif    # White Dancing Cat
    │   ├── cat_orange.gif   # Orange Tabby Cat
    │   ├── cat_popcat.gif   # Popcat
    │   ├── cat_party.gif    # Party Cat
    │   ├── capybara_walk.gif# Capybara
    │   ├── dog_happy.gif    # Happy Dog
    │   ├── penguin_dance.gif# Dancing Penguin
    │   ├── rabbit_dance.gif # Dancing Rabbit
    │   └── hamster_dance.gif# Dancing Hamster
    └── backgrounds/
        ├── rustic_water_village.jpg  # Water Village with boats
        ├── cozy_cat_room.jpg         # Cozy Attic Library with cat trees
        └── asian_street_market.jpg   # Tokyo Night Alley Market
```
