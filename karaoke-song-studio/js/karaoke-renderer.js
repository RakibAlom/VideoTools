/**
 * Karaoke Video Studio 2.0 - Canvas 2D Master Karaoke Video Renderer
 * Features:
 * 1. Multi-Line Smooth Vertical Scrolling Lyrics Engine (Spotify / Apple Music Sing Style)
 * 2. Automatic Word Wrapping & Frame Bounding - NEVER Overflows the Canvas
 * 3. 6 World-Class Visual Themes (Spotify Clean, Apple Sing, Cinema Gold, Minimalist Studio, Pastel Lo-Fi, Cyber Neon)
 * 4. 6 Advanced Lyric Animation Styles (Spotify Flow, Apple Sing, Gradient Wipe, Bouncing Ball, Word Pop, 3D Gold)
 * 5. Background Video & Audio Volume / Mute Management
 * 6. Visual Video Crop & Framing System with Interactive Canvas Handles (Pan X/Y, Zoom, Insets)
 * 7. Multi-Aspect Video Canvas (9:16 Vertical, 16:9 Landscape, 1:1 Square, 4:5 Portrait)
 * 8. 100% Clean ASCII - Zero Python
 */

class KaraokeRenderer {
  constructor(canvas) {
    this.canvas = canvas || document.getElementById('previewCanvas') || document.getElementById('karaokeCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d', { alpha: false }) : null;

    // Output Dimensions & Aspect Ratio
    this.aspectRatio = '9:16';
    this.width = 1080;
    this.height = 1920;
    this.scaleFactor = 1.0;

    // Interactive Drag Selection Flags
    this.showSafeZones = false;
    this.cropModeActive = false;
    this.isTitleSelected = false;
    this.isSubtitleSelected = false;

    // 1. Independent Main Title
    this.title = {
      enabled: false,    // Off by default so lyrics have full focus, or on for branding
      text: 'KARAOKE STUDIO',
      nx: 0.5,           // Normalized X (0.0 to 1.0, default 0.5 center)
      ny: 0.10,          // Normalized Y (0.0 to 1.0, default 0.10 top)
      rotation: 0,
      fontSize: 48,
      fontFamily: 'Montserrat',
      color: '#ffffff',
      glowColor: '#1ed760',
      strokeWidth: 6,
      style: 'minimal_clean'
    };

    // 2. Independent Sub-Title / Artist Text (Vibrant High-Contrast Highlight)
    this.subtitle = {
      enabled: false,    // Off by default to avoid duplicate text
      text: 'VOCAL KARAOKE TRACK',
      nx: 0.5,
      ny: 0.16,
      rotation: 0,
      fontSize: 24,
      fontFamily: 'Montserrat',
      color: '#00f2fe',
      strokeWidth: 5,
      showBg: true,
      bgOpacity: 0.85
    };

    // Background Overlay & Contrast Tint (0.0 = 100% transparent, 1.0 = solid)
    this.bgOverlayColor = '#000000';
    this.bgOverlayOpacity = 0.45;

    // Cached Bounding Boxes for Hit-Testing & Canvas Dragging
    this.titleBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.subtitleBounds = { x: 0, y: 0, w: 0, h: 0 };

    // 3. Visual Background Media Crop & Framing
    this.crop = {
      scale: 1.0,        // 0.5x to 3.0x zoom
      panX: 0,           // -50% to +50%
      panY: 0,           // -50% to +50%
      cropLeft: 0,       // 0% to 45% inset
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0
    };

    // Master Subtitle / Lyrics Visibility Switch
    this.showLyrics = true;

    // 4. Lyrics Typography & Layout
    this.fontFamily = 'Montserrat';
    this.fontSize = 54;
    this.fontWeight = '800';
    this.lineHeight = 1.35;
    this.lyricYPercent = 50; // Active line vertical center (default 50%)

    // Lyrics Colors & Styling Tokens
    this.theme = 'spotify_clean'; // 'spotify_clean' | 'apple_sing' | 'cinema_gold' | 'minimalist_studio' | 'pastel_lofi' | 'cyber_neon'
    this.unsungColor = '#9da3b4';
    this.unsungOpacity = 0.82;
    this.unsungColor = '#ffffff';
    this.sungColor = '#ffffff';
    this.sungSecondaryColor = '#1ed760';
    this.glowColor = '#1ed760';
    this.glowBlur = 18;
    this.strokeColor = '#000000';
    this.strokeWidth = 6;

    // Animation / Wipe Style
    // 'spotify_flow' | 'apple_sing' | 'gradient_wipe' | 'bouncing_ball' | 'word_pop' | 'karaoke_gold'
    this.wipeStyle = 'spotify_flow';

    // Smooth Continuous Vertical Scroll State
    this.currentScrollY = null;
    this.targetScrollY = 0;

    // Background Layer
    this.bgType = 'procedural';
    this.proceduralStyle = 'studio_dark';
    this.bgImage = null;
    this.bgVideo = null;
    this.bgDarken = 0.50;
    this.bgVideoMuted = true;
    this.bgVideoVolume = 0.0;

    // Particles & Visualizer
    this.stars = [];
    this.particles = [];
    this.gridOffset = 0;
    this.initParticles();

    // Audio FFT Analyser Buffer
    this.fftData = new Uint8Array(128);
  }

  setDimensions(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.scaleFactor = Math.min(width / 1080, height / 1920) || 1.0;
    this.currentScrollY = null; // reset scroll on dimension change
  }

  setResolution(quality = '1080p') {
    const ratio = this.aspectRatio || '9:16';
    let baseShort = 1080;
    if (quality === '720p') baseShort = 720;
    else if (quality === '1080p') baseShort = 1080;
    else if (quality === '2k') baseShort = 1440;
    else if (quality === '4k') baseShort = 2160;

    let w, h;
    switch (ratio) {
      case '9:16':
        w = baseShort;
        h = Math.round(baseShort * 16 / 9);
        break;
      case '16:9':
        h = baseShort;
        w = Math.round(baseShort * 16 / 9);
        break;
      case '1:1':
        w = baseShort;
        h = baseShort;
        break;
      case '4:5':
        w = baseShort;
        h = Math.round(baseShort * 5 / 4);
        break;
      default:
        w = baseShort;
        h = Math.round(baseShort * 16 / 9);
        break;
    }
    // Ensure dimensions are even for MP4/H.264 encoding
    w = (w % 2 === 0) ? w : w + 1;
    h = (h % 2 === 0) ? h : h + 1;
    this.setDimensions(w, h);
    return { width: w, height: h };
  }

  setAspectRatio(ratioStr) {
    this.aspectRatio = ratioStr;
    switch (ratioStr) {
      case '9:16':
        this.setDimensions(1080, 1920);
        break;
      case '16:9':
        this.setDimensions(1920, 1080);
        break;
      case '1:1':
        this.setDimensions(1080, 1080);
        break;
      case '4:5':
        this.setDimensions(1080, 1350);
        break;
      default:
        this.setDimensions(1080, 1920);
        break;
    }
  }

  /**
   * Apply Visual Theme Presets
   */
  applyTheme(themeKey) {
    this.theme = themeKey;
    switch (themeKey) {
      case 'spotify_clean':
        this.bgType = 'procedural';
        this.proceduralStyle = 'studio_dark';
        this.unsungColor = '#8a8d9b';
        this.unsungOpacity = 0.82;
    this.unsungColor = '#ffffff';
        this.sungColor = '#ffffff';
        this.sungSecondaryColor = '#1ed760';
        this.glowColor = '#1ed760';
        this.glowBlur = 16;
        this.strokeColor = 'rgba(0, 0, 0, 0.7)';
        this.strokeWidth = 4;
        this.fontFamily = 'Montserrat';
        this.wipeStyle = 'spotify_flow';
        this.title.style = 'minimal_clean';
        this.title.color = '#ffffff';
        this.title.glowColor = '#1ed760';
        break;

      case 'apple_sing':
        this.bgType = 'procedural';
        this.proceduralStyle = 'sunset_waves';
        this.unsungColor = '#9bb0cf';
        this.unsungOpacity = 0.42;
        this.sungColor = '#ffffff';
        this.sungSecondaryColor = '#00f2fe';
        this.glowColor = '#00f2fe';
        this.glowBlur = 24;
        this.strokeColor = 'rgba(0, 0, 0, 0.5)';
        this.strokeWidth = 4;
        this.fontFamily = 'Outfit';
        this.wipeStyle = 'apple_sing';
        this.title.style = 'frosted_glass';
        this.title.color = '#ffffff';
        this.title.glowColor = '#00f2fe';
        break;

      case 'cinema_gold':
        this.bgType = 'procedural';
        this.proceduralStyle = 'bokeh_particles';
        this.unsungColor = '#c4b59d';
        this.unsungOpacity = 0.82;
    this.unsungColor = '#ffffff';
        this.sungColor = '#ffffff';
        this.sungSecondaryColor = '#ffd700';
        this.glowColor = '#ffd700';
        this.glowBlur = 22;
        this.strokeColor = 'rgba(0, 0, 0, 0.85)';
        this.strokeWidth = 6;
        this.fontFamily = 'Montserrat';
        this.wipeStyle = 'karaoke_gold';
        this.title.style = 'golden_3d';
        this.title.color = '#ffd700';
        this.title.glowColor = '#ffaa00';
        break;

      case 'minimalist_studio':
        this.bgType = 'procedural';
        this.proceduralStyle = 'studio_dark';
        this.unsungColor = '#606068';
        this.unsungOpacity = 0.35;
        this.sungColor = '#ffffff';
        this.sungSecondaryColor = '#e0e0e0';
        this.glowColor = '#ffffff';
        this.glowBlur = 8;
        this.strokeColor = '#000000';
        this.strokeWidth = 4;
        this.fontFamily = 'Inter';
        this.wipeStyle = 'spotify_flow';
        this.title.style = 'minimal_clean';
        this.title.color = '#ffffff';
        this.title.glowColor = '#ffffff';
        break;

      case 'pastel_lofi':
        this.bgType = 'procedural';
        this.proceduralStyle = 'sunset_waves';
        this.unsungColor = '#c4b0d0';
        this.unsungOpacity = 0.42;
        this.sungColor = '#ffffff';
        this.sungSecondaryColor = '#ff9a8b';
        this.glowColor = '#ff9a8b';
        this.glowBlur = 20;
        this.strokeColor = 'rgba(0, 0, 0, 0.6)';
        this.strokeWidth = 4;
        this.fontFamily = 'Outfit';
        this.wipeStyle = 'gradient_wipe';
        this.title.style = 'flame_gradient';
        this.title.color = '#ffffff';
        this.title.glowColor = '#ff9a8b';
        break;

      case 'cyber_neon':
        this.bgType = 'procedural';
        this.proceduralStyle = 'cyber_grid';
        this.unsungColor = '#ffffff';
        this.unsungOpacity = 0.50;
        this.sungColor = '#00f2fe';
        this.sungSecondaryColor = '#fe0979';
        this.glowColor = '#00f2fe';
        this.glowBlur = 24;
        this.strokeColor = '#000000';
        this.strokeWidth = 8;
        this.fontFamily = 'Montserrat';
        this.wipeStyle = 'gradient_wipe';
        this.title.style = 'cyber_neon';
        this.title.color = '#ffffff';
        this.title.glowColor = '#00f2fe';
        break;

      case 'lofi_cozy':
        this.bgType = 'procedural';
        this.proceduralStyle = 'lofi_cozy_bedroom';
        this.unsungColor = '#f5e6d3';
        this.sungColor = '#ffffff';
        this.sungSecondaryColor = '#ffb380';
        this.glowColor = '#ffb380';
        this.glowBlur = 20;
        this.strokeColor = 'rgba(20, 10, 5, 0.85)';
        this.strokeWidth = 5;
        this.fontFamily = 'Montserrat';
        this.wipeStyle = 'gradient_wipe';
        this.title.style = 'minimal_clean';
        this.title.color = '#ffecd2';
        this.title.glowColor = '#ffb380';
        break;

      case 'sleep_dream':
        this.bgType = 'procedural';
        this.proceduralStyle = 'sleep_moonlight_clouds';
        this.unsungColor = '#c9d1d9';
        this.sungColor = '#ffffff';
        this.sungSecondaryColor = '#c084fc';
        this.glowColor = '#c084fc';
        this.glowBlur = 22;
        this.strokeColor = 'rgba(5, 5, 15, 0.9)';
        this.strokeWidth = 5;
        this.fontFamily = 'Outfit';
        this.wipeStyle = 'liquid_fill';
        this.title.style = 'frosted_glass';
        this.title.color = '#e0e7ff';
        this.title.glowColor = '#c084fc';
        break;
    }
  }

  initParticles() {
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 1000 + 1,
        speed: Math.random() * 3 + 1
      });
    }

    this.particles = [];
    for (let i = 0; i < 35; i++) {
      this.particles.push({
        x: Math.random() * 1080,
        y: Math.random() * 1920,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2 - 0.5,
        radius: Math.random() * 8 + 3,
        alpha: Math.random() * 0.7 + 0.2,
        color: i % 2 === 0 ? '#ffd700' : '#ff9a8b'
      });
    }
  }

  setBgOverlay(color, opacity) {
    if (color !== undefined && color !== null) this.bgOverlayColor = color;
    if (opacity !== undefined && opacity !== null) {
      this.bgOverlayOpacity = Math.max(0.0, Math.min(1.0, parseFloat(opacity) || 0.0));
    }
  }

  setUnsungOpacity(opacity) {
    if (opacity !== undefined && opacity !== null) {
      this.unsungOpacity = Math.max(0.0, Math.min(1.0, parseFloat(opacity) || 0.0));
    }
  }

  setProceduralStyle(style) {
    this.proceduralStyle = style;
    this.bgType = 'procedural';
  }

  drawBgOverlay() {
    const opacity = parseFloat(this.bgOverlayOpacity);
    if (!isNaN(opacity) && opacity > 0.001) {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = Math.max(0.0, Math.min(1.0, opacity));
      ctx.fillStyle = this.bgOverlayColor || '#000000';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }

  /**
   * Master 60fps Render Pipeline
   */
  render(currentTime = 0, lines = [], analyserNode = null) {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // 1. Render Background Layer (Media with Crop or Procedural)
    this.renderBackground(currentTime, analyserNode);

    // 2. Background Overlay & Contrast Tint (Color + Transparency)
    this.drawBgOverlay();

    // 3. Render Independent Main Title (if enabled)
    if (this.showLyrics && this.title.enabled && this.title.text) {
      this.renderTitle();
    }

    // 4. Render Independent Sub-Title / Hook Text (if enabled)
    if (this.showLyrics && this.subtitle.enabled && this.subtitle.text) {
      this.renderSubtitle();
    }

    // 5. Render Full Multi-Line Smooth Vertical Scrolling Lyrics (Can be disabled for clean video + audio FX export)
    if (this.showLyrics) {
      this.renderLyrics(currentTime, lines);
    }

    // 6. Render Safe Zones Overlay
    if (this.showSafeZones) {
      this.renderSafeZonesOverlay();
    }

    // 7. Render Visual Crop Gizmo Frame (if Crop Mode is active)
    if (this.cropModeActive) {
      this.renderCropGizmo();
    }

    // 8. Render Selection Gizmos for Dragging
    if (this.isTitleSelected && this.title.enabled) {
      this.renderTitleSelectionGizmo();
    }
    if (this.isSubtitleSelected && this.subtitle.enabled) {
      this.renderSubtitleSelectionGizmo();
    }

    ctx.restore();
  }

  /**
   * Render Main Title with Presets
   */
  renderTitle() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const t = this.title;

    ctx.save();
    const x = t.nx * w;
    const y = t.ny * h;
    const fs = t.fontSize * this.scaleFactor;

    ctx.translate(x, y);
    if (t.rotation) {
      ctx.rotate((t.rotation * Math.PI) / 180);
    }

    ctx.font = `900 ${fs}px "${t.fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText(t.text).width;
    const paddingX = 28 * this.scaleFactor;
    const paddingY = 16 * this.scaleFactor;
    const boxW = textWidth + paddingX * 2;
    const boxH = fs * 1.5;

    // Cache bounding box for hit-testing
    this.titleBounds = {
      x: x - boxW / 2,
      y: y - boxH / 2,
      w: boxW,
      h: boxH
    };

    // Draw Style Presets
    if (t.style === 'frosted_glass') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2 * this.scaleFactor;
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 12 * this.scaleFactor);
      ctx.fill();
      ctx.stroke();
    }

    ctx.lineWidth = (t.strokeWidth || 6) * this.scaleFactor;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(t.text, 0, 0);

    ctx.shadowColor = t.glowColor || '#00f2fe';
    ctx.shadowBlur = 16 * this.scaleFactor;
    ctx.fillStyle = t.color || '#ffffff';
    ctx.fillText(t.text, 0, 0);

    ctx.restore();
  }

  /**
   * Render Subtitle / Artist Banner
   */
  renderSubtitle() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const s = this.subtitle;

    ctx.save();
    const x = s.nx * w;
    const y = s.ny * h;
    const fs = s.fontSize * this.scaleFactor;

    ctx.translate(x, y);
    if (s.rotation) {
      ctx.rotate((s.rotation * Math.PI) / 180);
    }

    ctx.font = `700 ${fs}px "${s.fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textWidth = ctx.measureText(s.text).width;
    const paddingX = 20 * this.scaleFactor;
    const paddingY = 8 * this.scaleFactor;
    const boxW = textWidth + paddingX * 2;
    const boxH = fs * 1.6;

    this.subtitleBounds = {
      x: x - boxW / 2,
      y: y - boxH / 2,
      w: boxW,
      h: boxH
    };

    if (s.showBg) {
      ctx.fillStyle = `rgba(0, 0, 0, ${s.bgOpacity || 0.7})`;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5 * this.scaleFactor;
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, boxH / 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = s.color || '#a0a5b8';
    ctx.fillText(s.text, 0, 0);

    ctx.restore();
  }

  /**
   * Hit Testing for Drag & Drop
   */
  hitTestTitle(px, py) {
    const b = this.titleBounds;
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }

  hitTestSubtitle(px, py) {
    const b = this.subtitleBounds;
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }

  renderTitleSelectionGizmo() {
    const ctx = this.ctx;
    const b = this.titleBounds;
    ctx.save();
    ctx.strokeStyle = '#00f2fe';
    ctx.lineWidth = 2 * this.scaleFactor;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.restore();
  }

  renderSubtitleSelectionGizmo() {
    const ctx = this.ctx;
    const b = this.subtitleBounds;
    ctx.save();
    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = 2 * this.scaleFactor;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.restore();
  }

  // =========================================================================
  // MASTER MULTI-LINE SMOOTH VERTICAL SCROLLING LYRICS ENGINE
  // =========================================================================

  /**
   * Auto-wraps text into balanced centered sub-lines so it NEVER overflows the screen width
   */
  wrapTextIntoSubLines(text, words, maxContentWidth, ctx) {
    const rawWords = (words && words.length > 0) ? words : text.split(/\s+/).map(w => ({ text: w, start: 0, end: 1 }));
    const spaceWidth = ctx.measureText(' ').width;

    const subLines = [];
    let currentLineWords = [];
    let currentLineWidth = 0;

    for (let wordObj of rawWords) {
      const wordText = wordObj.text;
      const wordWidth = ctx.measureText(wordText).width;

      if (currentLineWords.length > 0 && (currentLineWidth + spaceWidth + wordWidth) > maxContentWidth) {
        subLines.push({
          words: currentLineWords,
          text: currentLineWords.map(w => w.text).join(' '),
          width: currentLineWidth
        });
        currentLineWords = [wordObj];
        currentLineWidth = wordWidth;
      } else {
        currentLineWidth += (currentLineWords.length > 0 ? spaceWidth : 0) + wordWidth;
        currentLineWords.push(wordObj);
      }
    }

    if (currentLineWords.length > 0) {
      subLines.push({
        words: currentLineWords,
        text: currentLineWords.map(w => w.text).join(' '),
        width: currentLineWidth
      });
    }

    return subLines;
  }

  /**
   * Measures all lines and calculates cumulative vertical positions
   */
  measureAndLayoutLines(lines, baseFontSize, maxContentWidth, ctx) {
    const measuredLines = [];
    const subLineHeight = baseFontSize * this.lineHeight;
    const linePadding = baseFontSize * 0.95; // Breathing gap between lyric cues

    let currentY = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const subLines = this.wrapTextIntoSubLines(line.text, line.words, maxContentWidth, ctx);
      const totalBlockHeight = subLines.length * subLineHeight;

      measuredLines.push({
        index: i,
        lineObj: line,
        subLines: subLines,
        blockHeight: totalBlockHeight,
        centerY: currentY + totalBlockHeight / 2
      });

      currentY += totalBlockHeight + linePadding;
    }

    return {
      measured: measuredLines,
      totalHeight: currentY
    };
  }

  /**
   * Master Lyrics Renderer:
   * 1. Multi-line display: past lines above, active in center, future lines below
   * 2. Smooth 60fps vertical scroll interpolation
   * 3. Perfect text-wrapping (0 overflow)
   * 4. Top and bottom soft gradient vignette
   */
  renderLyrics(currentTime, lines) {
    if (!lines || lines.length === 0) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const scale = this.scaleFactor;
    const baseFontSize = this.fontSize * scale;
    const maxContentWidth = Math.min(w * 0.84, w - (80 * scale));
    const targetCenterY = (this.lyricYPercent / 100) * h;

    ctx.save();
    ctx.font = `${this.fontWeight} ${baseFontSize}px "${this.fontFamily}", sans-serif`;

    // 1. Layout all lines with automatic text-wrapping
    const layout = this.measureAndLayoutLines(lines, baseFontSize, maxContentWidth, ctx);
    const measured = layout.measured;
    if (measured.length === 0) {
      ctx.restore();
      return;
    }

    // 2. Identify active line index
    let activeIdx = -1;
    for (let i = 0; i < measured.length; i++) {
      const l = measured[i].lineObj;
      if (currentTime >= l.start && currentTime <= l.end) {
        activeIdx = i;
        break;
      }
    }

    // If between lines or before/after
    if (activeIdx === -1) {
      for (let i = 0; i < measured.length; i++) {
        if (measured[i].lineObj.start > currentTime) {
          activeIdx = i > 0 ? i - 1 : 0;
          break;
        }
      }
      if (activeIdx === -1) activeIdx = measured.length - 1;
    }

    const activeItem = measured[activeIdx];
    const activeLine = activeItem.lineObj;

    // 3. Calculate target scroll position with smooth transition spline
    let targetScroll = activeItem.centerY;
    const lineDuration = Math.max(0.3, activeLine.end - activeLine.start);
    const lineProgress = Math.max(0, Math.min(1.0, (currentTime - activeLine.start) / lineDuration));

    // When nearing completion of active line, smoothly ease towards next line
    if (lineProgress > 0.65 && activeIdx < measured.length - 1) {
      const nextItem = measured[activeIdx + 1];
      const transitionFactor = (lineProgress - 0.65) / 0.35;
      const smoothFactor = transitionFactor * transitionFactor * (3 - 2 * transitionFactor); // smoothstep
      targetScroll = activeItem.centerY + smoothFactor * (nextItem.centerY - activeItem.centerY);
    }

    // Initialize or smoothly interpolate scroll offset
    if (this.currentScrollY === null || Math.abs(this.currentScrollY - targetScroll) > (h * 1.5)) {
      this.currentScrollY = targetScroll;
    } else {
      this.currentScrollY += (targetScroll - this.currentScrollY) * 0.12;
    }

    // 4. Render All Visible Lyric Lines
    const subLineHeight = baseFontSize * this.lineHeight;
    const unsungVal = (typeof this.unsungOpacity === 'number') ? this.unsungOpacity : 0.82;

    for (let m of measured) {
      const lineYOnScreen = m.centerY - this.currentScrollY + targetCenterY;

      // Vertical Culling
      if (lineYOnScreen + m.blockHeight / 2 < -60 || lineYOnScreen - m.blockHeight / 2 > h + 60) {
        continue;
      }

      const isActive = (m.index === activeIdx);
      const isPast = (m.index < activeIdx);
      const distFromCenter = Math.abs(lineYOnScreen - targetCenterY);
      const normDist = Math.min(1.0, distFromCenter / (h * 0.45));

      // Single-Line Focus Mode: If user set Inactive Lyrics Visibility to 0%, strictly hide all non-active lines
      if (!isActive && unsungVal <= 0.01) {
        continue;
      }

      // Visual Hierarchy Opacity & Scale
      let lineOpacity = 1.0;
      let lineScale = 1.0;

      if (isActive) {
        lineOpacity = 1.0;
        lineScale = 1.05;
      } else {
        // Direct proportionality to user-selected visibility slider (0.0 to 1.0)
        // With gentle aesthetic distance falloff
        const distAttenuation = (1.0 - normDist * (1.0 - unsungVal * 0.5) * 0.32);
        lineOpacity = Math.max(0.0, Math.min(1.0, unsungVal * distAttenuation));
        lineScale = isPast ? 0.95 : 0.96;
      }

      // Draw each wrapped sub-line in this block
      const startSubLineY = lineYOnScreen - (m.subLines.length - 1) * (subLineHeight / 2);

      m.subLines.forEach((sub, subIdx) => {
        const subY = startSubLineY + subIdx * subLineHeight;
        this.renderSubLine(sub, subY, isActive, lineOpacity, lineScale, currentTime, activeLine, baseFontSize);
      });
    }

    // 5. Draw Top & Bottom Ambient Vignette Masks for Soft Dissolve
    this.renderVerticalFadeMask(w, h);

    ctx.restore();
  }

  /**
   * Renders a single sub-line with active highlight / word progress
   */
  renderSubLine(sub, yPos, isActive, opacity, lineScale, currentTime, activeLine, baseFontSize) {
    const ctx = this.ctx;
    const w = this.width;
    const scale = this.scaleFactor;
    const fontSize = baseFontSize * lineScale;
    const spaceWidth = ctx.measureText(' ').width;

    ctx.save();
    ctx.font = `${this.fontWeight} ${fontSize}px "${this.fontFamily}", sans-serif`;
    ctx.textBaseline = 'middle';

    // Calculate exact starting X so the sub-line is 100% centered horizontally
    const subLineWidth = sub.width;
    const startX = (w - subLineWidth) / 2;

    // Optional Active Pill Backplate (Spotify / Apple Music Sing style)
    if (isActive && (this.wipeStyle === 'spotify_flow' || this.wipeStyle === 'apple_sing')) {
      const pillPadX = 24 * scale;
      const pillPadY = 12 * scale;
      const pillW = subLineWidth + pillPadX * 2;
      const pillH = fontSize * 1.5;

      ctx.save();
      ctx.globalAlpha = 0.85;
      if (this.theme === 'spotify_clean') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.40)';
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
      }
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.roundRect((w - pillW) / 2, yPos - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    let curWordX = startX;

    sub.words.forEach((wordObj) => {
      const wordText = wordObj.text;
      const wordWidth = ctx.measureText(wordText).width;

      let wordProgress = 0;
      if (isActive) {
        if (currentTime >= wordObj.end) {
          wordProgress = 1.0;
        } else if (currentTime > wordObj.start) {
          const wDur = Math.max(0.08, wordObj.end - wordObj.start);
          wordProgress = Math.max(0, Math.min(1.0, (currentTime - wordObj.start) / wDur));
        }
      }

      // 1. Draw Inactive / Unsung Background Layer (Directly driven by user opacity)
      ctx.save();
      ctx.globalAlpha = Math.max(0.0, Math.min(1.0, opacity));
      ctx.textAlign = 'left';

      // Outline stroke with heavy dark edge and shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 8 * scale;
      ctx.lineWidth = (this.strokeWidth || 6) * scale;
      ctx.strokeStyle = this.strokeColor || '#000000';
      ctx.lineJoin = 'round';
      ctx.strokeText(wordText, curWordX, yPos);

      // Inactive fill - crisp white/silver for maximum clarity
      ctx.fillStyle = isActive ? '#ffffff' : (this.unsungColor || '#ffffff');
      ctx.fillText(wordText, curWordX, yPos);
      ctx.restore();

      // 2. Draw Active / Sung Layer
      if (isActive && wordProgress > 0) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.textAlign = 'left';

        // Clip rectangle to exact sung fraction of word
        ctx.beginPath();
        ctx.rect(curWordX - 2 * scale, yPos - fontSize * 0.9, (wordWidth * wordProgress) + 4 * scale, fontSize * 1.8);
        ctx.clip();

        // Glow
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = this.glowBlur * scale;

        // Custom Sung Color Fill
        if (this.wipeStyle === 'karaoke_gold' || this.theme === 'cinema_gold') {
          const goldGrad = ctx.createLinearGradient(curWordX, 0, curWordX + wordWidth, 0);
          goldGrad.addColorStop(0, '#ffffff');
          goldGrad.addColorStop(0.4, '#ffd700');
          goldGrad.addColorStop(1, '#ff9900');
          ctx.fillStyle = goldGrad;
        } else if (this.wipeStyle === 'rainbow_wave') {
          const rbGrad = ctx.createLinearGradient(curWordX, 0, curWordX + wordWidth, 0);
          const tHue = ((currentTime * 120) % 360);
          rbGrad.addColorStop(0, `hsl(${tHue}, 100%, 65%)`);
          rbGrad.addColorStop(0.5, `hsl(${(tHue + 60) % 360}, 100%, 65%)`);
          rbGrad.addColorStop(1, `hsl(${(tHue + 120) % 360}, 100%, 65%)`);
          ctx.fillStyle = rbGrad;
        } else if (this.wipeStyle === 'fire_flame') {
          const fireGrad = ctx.createLinearGradient(curWordX, yPos + fontSize * 0.5, curWordX, yPos - fontSize * 0.5);
          fireGrad.addColorStop(0, '#ff1a00');
          fireGrad.addColorStop(0.5, '#ff8000');
          fireGrad.addColorStop(1, '#ffff33');
          ctx.fillStyle = fireGrad;
        } else if (this.theme === 'spotify_clean') {
          ctx.fillStyle = '#ffffff';
        } else {
          const grad = ctx.createLinearGradient(curWordX, 0, curWordX + wordWidth, 0);
          grad.addColorStop(0, this.sungColor);
          grad.addColorStop(1, this.sungSecondaryColor);
          ctx.fillStyle = grad;
        }

        ctx.fillText(wordText, curWordX, yPos);
        ctx.restore();

        // 12 Visual Animation Styles
        if (this.wipeStyle === 'bouncing_ball' && wordProgress > 0 && wordProgress <= 1.0) {
          const ballX = curWordX + wordWidth * wordProgress;
          this.renderBouncingBall(ballX, yPos - fontSize * 0.65, wordProgress, fontSize);
        } else if (this.wipeStyle === 'word_pop' && wordProgress > 0.05 && wordProgress < 0.95) {
          ctx.save();
          ctx.lineWidth = 2.5 * scale;
          ctx.strokeStyle = '#ffffff';
          ctx.strokeText(wordText, curWordX, yPos);
          ctx.restore();
        } else if (this.wipeStyle === 'neon_box' && wordProgress > 0.05) {
          ctx.save();
          ctx.strokeStyle = this.glowColor || '#00f2fe';
          ctx.lineWidth = 2 * scale;
          ctx.shadowColor = this.glowColor || '#00f2fe';
          ctx.shadowBlur = 12 * scale;
          ctx.strokeRect(curWordX - 4 * scale, yPos - fontSize * 0.7, wordWidth + 8 * scale, fontSize * 1.4);
          ctx.restore();
        } else if (this.wipeStyle === 'fire_flame' && wordProgress > 0.1) {
          this.renderFireFx(curWordX + wordWidth * wordProgress, yPos, fontSize);
        } else if (this.wipeStyle === 'glitch_cyber' && wordProgress > 0.05) {
          this.renderGlitchFx(wordText, curWordX, yPos, scale);
        } else if (this.wipeStyle === 'liquid_fill' && wordProgress > 0.05) {
          this.renderLiquidFx(curWordX, yPos, wordWidth * wordProgress, fontSize);
        } else if (this.wipeStyle === 'typewriter_glow' && wordProgress > 0 && wordProgress < 0.98) {
          this.renderTypewriterCaret(curWordX + wordWidth * wordProgress, yPos, fontSize);
        } else if (this.wipeStyle === 'sparkle_star' && wordProgress > 0.1) {
          this.renderSparkleFx(curWordX + wordWidth * wordProgress, yPos, scale);
        } else if (this.wipeStyle === 'kinetic_pulse' && wordProgress > 0.1) {
          this.renderKineticPulseFx(curWordX, yPos, wordWidth, fontSize, currentTime);
        }
      }

      curWordX += wordWidth + spaceWidth;
    });

    ctx.restore();
  }

  /**
   * Top and bottom soft gradient vignette mask so lyrics smoothly emerge and fade out
   */
  renderVerticalFadeMask(w, h) {
    const ctx = this.ctx;
    ctx.save();

    // Top fade-out
    const topGrad = ctx.createLinearGradient(0, 0, 0, h * 0.18);
    topGrad.addColorStop(0, 'rgba(5, 7, 12, 0.92)');
    topGrad.addColorStop(1, 'rgba(5, 7, 12, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, h * 0.18);

    // Bottom fade-out
    const botGrad = ctx.createLinearGradient(0, h * 0.82, 0, h);
    botGrad.addColorStop(0, 'rgba(5, 7, 12, 0)');
    botGrad.addColorStop(1, 'rgba(5, 7, 12, 0.95)');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, h * 0.82, w, h * 0.18);

    ctx.restore();
  }

  renderBouncingBall(targetX, baseY, progress, fontSize) {
    const ctx = this.ctx;
    const bounceHeight = fontSize * 0.8;
    const arc = Math.sin(progress * Math.PI) * bounceHeight;
    const ballY = baseY - arc;
    const ballR = 10 * this.scaleFactor;

    ctx.save();
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 16 * this.scaleFactor;

    const ballGrad = ctx.createRadialGradient(targetX - 2, ballY - 2, 2, targetX, ballY, ballR);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.5, this.sungSecondaryColor);
    ballGrad.addColorStop(1, this.sungColor);

    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(targetX, ballY, ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // =========================================================================
  // BACKGROUND RENDERING & MEDIA MANAGEMENT
  // =========================================================================

  renderBackground(currentTime, analyserNode) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    if (this.bgType === 'image' && this.bgImage) {
      this.drawCoverMediaWithCrop(this.bgImage);
      return;
    }

    if (this.bgType === 'video' && this.bgVideo && this.bgVideo.readyState >= 2) {
      this.drawCoverMediaWithCrop(this.bgVideo);
      return;
    }

    switch (this.proceduralStyle) {
      case 'studio_dark':
        this.renderStudioDark(currentTime);
        break;
      case 'sunset_waves':
        this.renderSunsetWaves(currentTime);
        break;
      case 'bokeh_particles':
        this.renderBokehParticles(currentTime);
        break;
      case 'audio_spectrum':
        this.renderAudioSpectrum(currentTime, analyserNode);
        break;
      case 'starfield':
        this.renderStarfield(currentTime);
        break;
      case 'neon_matrix':
        this.renderNeonMatrix(currentTime);
        break;
      case 'aurora_borealis':
        this.renderAuroraBorealis(currentTime);
        break;
      case 'retro_sunset':
        this.renderRetroSunsetSynth(currentTime);
        break;
      case 'galaxy_nebula':
        this.renderGalaxyNebula(currentTime);
        break;
      case 'disco_lasers':
        this.renderDiscoLasers(currentTime);
        break;
      case 'fireflies_magic':
        this.renderFirefliesMagic(currentTime);
        break;
      case 'lofi_rain':
        this.renderLofiRainWindow(currentTime);
        break;
      case 'lofi_cozy_bedroom':
        this.renderLofiCozyBedroom(currentTime);
        break;
      case 'lofi_vinyl_coffee':
        this.renderLofiVinylCoffee(currentTime);
        break;
      case 'sleep_moonlight_clouds':
        this.renderSleepMoonlightClouds(currentTime);
        break;
      case 'sleep_floating_dreams':
        this.renderSleepFloatingDreams(currentTime);
        break;
      case 'sleep_night_ocean':
        this.renderSleepNightOcean(currentTime);
        break;
      case 'cyber_grid':
      default:
        this.renderCyberGrid(currentTime);
        break;
    }
  }

  drawCoverMediaWithCrop(media) {
    const ctx = this.ctx;
    const cw = this.width;
    const ch = this.height;
    const mw = media.videoWidth || media.naturalWidth || media.width;
    const mh = media.videoHeight || media.naturalHeight || media.height;

    if (!mw || !mh) return;

    const baseScale = Math.max(cw / mw, ch / mh);
    const finalScale = baseScale * (this.crop.scale || 1.0);
    const sw = mw * finalScale;
    const sh = mh * finalScale;

    // Apply Pan X & Pan Y
    const panOffsetX = (this.crop.panX / 100) * cw;
    const panOffsetY = (this.crop.panY / 100) * ch;

    const sx = (cw - sw) / 2 + panOffsetX;
    const sy = (ch - sh) / 2 + panOffsetY;

    ctx.save();
    if (this.crop.cropLeft > 0 || this.crop.cropRight > 0 || this.crop.cropTop > 0 || this.crop.cropBottom > 0) {
      const clipX = (this.crop.cropLeft / 100) * cw;
      const clipY = (this.crop.cropTop / 100) * ch;
      const clipW = cw - clipX - (this.crop.cropRight / 100) * cw;
      const clipH = ch - clipY - (this.crop.cropBottom / 100) * ch;
      ctx.beginPath();
      ctx.rect(clipX, clipY, clipW, clipH);
      ctx.clip();
    }

    ctx.drawImage(media, sx, sy, sw, sh);
    ctx.restore();
  }

  renderStudioDark(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const grad = ctx.createRadialGradient(w / 2, h * 0.45, 80, w / 2, h * 0.45, w * 0.95);
    grad.addColorStop(0, '#141824');
    grad.addColorStop(0.6, '#090c14');
    grad.addColorStop(1, '#040508');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  renderSunsetWaves(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#100a1c');
    bgGrad.addColorStop(0.5, '#1e102d');
    bgGrad.addColorStop(1, '#2d1424');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Ambient floating wave ribbons
    ctx.save();
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      const waveY = h * (0.45 + j * 0.15);
      ctx.moveTo(0, waveY);
      for (let x = 0; x <= w; x += 40) {
        const ny = waveY + Math.sin(x * 0.003 + time * 0.8 + j) * 45;
        ctx.lineTo(x, ny);
      }
      ctx.strokeStyle = j === 0 ? 'rgba(0, 242, 254, 0.12)' : (j === 1 ? 'rgba(255, 154, 139, 0.15)' : 'rgba(246, 213, 247, 0.10)');
      ctx.lineWidth = 40 * this.scaleFactor;
      ctx.stroke();
    }
    ctx.restore();
  }

  renderBokehParticles(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#0a0808';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -50) p.y = h + 50;
      if (p.x < -50) p.x = w + 50;
      if (p.x > w + 50) p.x = -50;

      const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.radius * 3.5);
      grad.addColorStop(0, `rgba(255, 215, 0, ${p.alpha * 0.45})`);
      grad.addColorStop(1, 'rgba(255, 215, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  renderAudioSpectrum(time, analyser) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, w, h);

    if (analyser) {
      analyser.getByteFrequencyData(this.fftData);
    } else {
      for (let k = 0; k < this.fftData.length; k++) {
        this.fftData[k] = Math.sin(k * 0.2 + time * 3) * 60 + 80;
      }
    }

    const bars = 48;
    const barWidth = w / bars;
    const baseY = h * 0.85;

    ctx.save();
    for (let i = 0; i < bars; i++) {
      const val = this.fftData[i % this.fftData.length] / 255;
      const barHeight = val * (h * 0.28);
      const x = i * barWidth;
      const y = baseY - barHeight;

      const barGrad = ctx.createLinearGradient(0, y, 0, baseY);
      barGrad.addColorStop(0, '#1ed760');
      barGrad.addColorStop(1, 'rgba(30, 215, 96, 0.08)');

      ctx.fillStyle = barGrad;
      ctx.fillRect(x + 2, y, barWidth - 4, barHeight);
    }
    ctx.restore();
  }

  renderStarfield(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#030408';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.fillStyle = '#ffffff';

    for (let star of this.stars) {
      star.z -= star.speed * 2.5;
      if (star.z <= 0) {
        star.z = 1000;
        star.x = (Math.random() - 0.5) * 2000;
        star.y = (Math.random() - 0.5) * 2000;
      }
      const k = 400 / star.z;
      const px = star.x * k;
      const py = star.y * k;
      const size = Math.max(1, (1 - star.z / 1000) * 4);

      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderCyberGrid(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#05070e');
    bgGrad.addColorStop(0.5, '#0b112c');
    bgGrad.addColorStop(1, '#1b052e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const horizonY = h * 0.65;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
    ctx.lineWidth = 1.5 * this.scaleFactor;

    const numLines = 18;
    const vanishX = w / 2;
    for (let i = -numLines; i <= numLines; i++) {
      const bottomX = vanishX + i * (w / 8);
      ctx.beginPath();
      ctx.moveTo(vanishX, horizonY);
      ctx.lineTo(bottomX, h);
      ctx.stroke();
    }

    const gridOffset = (time * 60) % 40;
    for (let y = horizonY; y < h; y += 14) {
      const norm = (y - horizonY) / (h - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, y + gridOffset * norm);
      ctx.lineTo(w, y + gridOffset * norm);
      ctx.stroke();
    }
    ctx.restore();
  }

  // =========================================================================
  // CROP GIZMO & SAFE ZONES
  // =========================================================================

  getCropRect() {
    const w = this.width;
    const h = this.height;
    const left = (this.crop.cropLeft / 100) * w;
    const top = (this.crop.cropTop / 100) * h;
    const right = w - (this.crop.cropRight / 100) * w;
    const bottom = h - (this.crop.cropBottom / 100) * h;
    return { x: left, y: top, w: Math.max(80, right - left), h: Math.max(80, bottom - top) };
  }

  hitTestCropHandle(px, py) {
    const r = this.getCropRect();
    const hs = 34 * this.scaleFactor;
    if (Math.hypot(px - r.x, py - r.y) < hs) return 'top-left';
    if (Math.hypot(px - (r.x + r.w), py - r.y) < hs) return 'top-right';
    if (Math.hypot(px - r.x, py - (r.y + r.h)) < hs) return 'bottom-left';
    if (Math.hypot(px - (r.x + r.w), py - (r.y + r.h)) < hs) return 'bottom-right';

    if (Math.abs(px - (r.x + r.w / 2)) < hs && Math.abs(py - r.y) < hs) return 'top';
    if (Math.abs(px - (r.x + r.w / 2)) < hs && Math.abs(py - (r.y + r.h)) < hs) return 'bottom';
    if (Math.abs(px - r.x) < hs && Math.abs(py - (r.y + r.h / 2)) < hs) return 'left';
    if (Math.abs(px - (r.x + r.w)) < hs && Math.abs(py - (r.y + r.h / 2)) < hs) return 'right';

    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return 'inside';
    return null;
  }

  renderCropGizmo() {
    const ctx = this.ctx;
    const cw = this.width;
    const ch = this.height;
    const r = this.getCropRect();

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, cw, r.y);
    ctx.fillRect(0, r.y + r.h, cw, ch - (r.y + r.h));
    ctx.fillRect(0, r.y, r.x, r.h);
    ctx.fillRect(r.x + r.w, r.y, cw - (r.x + r.w), r.h);

    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = 3 * this.scaleFactor;
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    const hs = 26 * this.scaleFactor;
    ctx.strokeStyle = '#ffd000';
    ctx.lineWidth = 6 * this.scaleFactor;

    ctx.beginPath();
    ctx.moveTo(r.x, r.y + hs); ctx.lineTo(r.x, r.y); ctx.lineTo(r.x + hs, r.y);
    ctx.moveTo(r.x + r.w - hs, r.y); ctx.lineTo(r.x + r.w); ctx.lineTo(r.x + r.w, r.y + hs);
    ctx.moveTo(r.x, r.y + r.h - hs); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x + hs, r.y + r.h);
    ctx.moveTo(r.x + r.w - hs, r.y + r.h); ctx.lineTo(r.x + r.w); ctx.lineTo(r.x + r.w, r.y + hs);
    ctx.stroke();

    ctx.restore();
  }

  renderSafeZonesOverlay() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.strokeStyle = 'rgba(254, 9, 121, 0.6)';
    ctx.lineWidth = 2 * this.scaleFactor;
    ctx.setLineDash([8, 8]);

    const topSafe = h * 0.12;
    const bottomSafe = h * 0.78;
    const sideMargin = w * 0.08;

    ctx.strokeRect(sideMargin, topSafe, w - sideMargin * 2, bottomSafe - topSafe);

    ctx.fillStyle = 'rgba(254, 9, 121, 0.85)';
    ctx.font = `700 ${12 * this.scaleFactor}px Inter, sans-serif`;
    ctx.fillText('9:16 Mobile UI Safe Zone (Reels / TikTok / Shorts)', sideMargin + 8, topSafe + 18);

    ctx.restore();
  }
  // =========================================================================
  // ADVANCED ANIMATION STYLE HELPERS
  // =========================================================================

  renderFireFx(x, y, fontSize) {
    const ctx = this.ctx;
    ctx.save();
    for (let k = 0; k < 4; k++) {
      const pY = y - (Math.random() * fontSize * 0.7);
      const pX = x + (Math.random() - 0.5) * 12 * this.scaleFactor;
      const pR = (Math.random() * 4 + 2) * this.scaleFactor;
      ctx.fillStyle = k % 2 === 0 ? 'rgba(255, 130, 0, 0.8)' : 'rgba(255, 220, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(pX, pY, pR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderGlitchFx(text, x, y, scale) {
    const ctx = this.ctx;
    ctx.save();
    const offset = (Math.random() - 0.5) * 6 * scale;
    ctx.fillStyle = 'rgba(0, 242, 254, 0.6)';
    ctx.fillText(text, x - offset, y);
    ctx.fillStyle = 'rgba(254, 9, 121, 0.6)';
    ctx.fillText(text, x + offset, y);
    ctx.restore();
  }

  renderLiquidFx(x, y, sungW, fontSize) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 242, 254, 0.35)';
    ctx.beginPath();
    const waveH = 4 * this.scaleFactor;
    const waveY = y + fontSize * 0.3;
    ctx.moveTo(x, waveY);
    for (let px = 0; px <= sungW; px += 4) {
      const py = waveY + Math.sin(px * 0.15 + Date.now() * 0.008) * waveH;
      ctx.lineTo(x + px, py);
    }
    ctx.lineTo(x + sungW, y + fontSize * 0.6);
    ctx.lineTo(x, y + fontSize * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  renderTypewriterCaret(x, y, fontSize) {
    const ctx = this.ctx;
    if (Math.floor(Date.now() / 250) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = this.glowColor || '#00f2fe';
      ctx.shadowColor = this.glowColor || '#00f2fe';
      ctx.shadowBlur = 8 * this.scaleFactor;
      ctx.fillRect(x + 2, y - fontSize * 0.45, 3 * this.scaleFactor, fontSize * 0.9);
      ctx.restore();
    }
  }

  renderSparkleFx(x, y, scale) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10 * scale;
    for (let k = 0; k < 3; k++) {
      const spX = x + Math.cos(k * 2.1 + Date.now() * 0.005) * 16 * scale;
      const spY = y + Math.sin(k * 2.1 + Date.now() * 0.005) * 14 * scale;
      ctx.beginPath();
      ctx.arc(spX, spY, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderKineticPulseFx(x, y, wordW, fontSize, time) {
    const ctx = this.ctx;
    ctx.save();
    const pulseScale = 1.0 + Math.sin(time * 12) * 0.06;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5 * this.scaleFactor;
    ctx.strokeRect(x - 2, y - fontSize * 0.5 * pulseScale, wordW + 4, fontSize * pulseScale);
    ctx.restore();
  }

  // =========================================================================
  // 7 NEW PROCEDURAL VISUALIZERS
  // =========================================================================

  renderNeonMatrix(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.fillStyle = '#010603';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.font = `900 ${16 * this.scaleFactor}px Courier, monospace`;
    ctx.textAlign = 'center';
    const cols = 28;
    const colW = w / cols;
    const chars = '0123456789ABCDEF!@#$%&*';
    for (let c = 0; c < cols; c++) {
      const speed = 1.2 + (c % 5) * 0.35;
      const headY = ((time * speed * 140 + c * 85) % (h + 300)) - 100;
      for (let r = 0; r < 14; r++) {
        const charY = headY - r * 20 * this.scaleFactor;
        if (charY > -20 && charY < h + 20) {
          const char = chars[(c * 7 + r * 3) % chars.length];
          if (r === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#00f2fe';
            ctx.shadowBlur = 10 * this.scaleFactor;
          } else {
            ctx.fillStyle = `rgba(0, 242, 254, ${Math.max(0, 1 - r * 0.075)})`;
            ctx.shadowBlur = 0;
          }
          ctx.fillText(char, c * colW + colW / 2, charY);
        }
      }
    }
    ctx.restore();
  }

  renderAuroraBorealis(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#020409');
    bgGrad.addColorStop(0.5, '#060e18');
    bgGrad.addColorStop(1, '#091522');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const baseY = h * (0.35 + k * 0.14);
      ctx.moveTo(0, baseY);
      for (let x = 0; x <= w; x += 30) {
        const y = baseY + Math.sin(x * 0.003 + time * 0.7 + k * 1.5) * 60 + Math.cos(x * 0.006 - time * 0.5) * 35;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      const aGrad = ctx.createLinearGradient(0, baseY - 60, 0, baseY + 120);
      if (k === 0) {
        aGrad.addColorStop(0, 'rgba(0, 245, 212, 0.28)');
        aGrad.addColorStop(1, 'rgba(0, 245, 212, 0)');
      } else if (k === 1) {
        aGrad.addColorStop(0, 'rgba(114, 9, 183, 0.25)');
        aGrad.addColorStop(1, 'rgba(114, 9, 183, 0)');
      } else {
        aGrad.addColorStop(0, 'rgba(0, 187, 249, 0.22)');
        aGrad.addColorStop(1, 'rgba(0, 187, 249, 0)');
      }
      ctx.fillStyle = aGrad;
      ctx.fill();
    }
    ctx.restore();
  }

  renderRetroSunsetSynth(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0a0316');
    bgGrad.addColorStop(0.5, '#1e0736');
    bgGrad.addColorStop(1, '#3b0d4f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    const sunR = Math.min(w, h) * 0.22;
    const sunX = w / 2;
    const sunY = h * 0.52;
    ctx.save();
    const sunGrad = ctx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
    sunGrad.addColorStop(0, '#fffa65');
    sunGrad.addColorStop(0.5, '#ff4757');
    sunGrad.addColorStop(1, '#7000ff');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    for (let s = 1; s <= 7; s++) {
      const sliceY = sunY + (s / 8) * sunR;
      const sliceH = 4 * this.scaleFactor * (s * 0.35);
      ctx.fillStyle = '#0a0316';
      ctx.fillRect(sunX - sunR - 10, sliceY, sunR * 2 + 20, sliceH);
    }
    const horizonY = h * 0.68;
    ctx.strokeStyle = 'rgba(255, 0, 128, 0.4)';
    ctx.lineWidth = 1.5 * this.scaleFactor;
    for (let x = -8; x <= 8; x++) {
      ctx.beginPath();
      ctx.moveTo(w / 2, horizonY);
      ctx.lineTo(w / 2 + x * (w / 6), h);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderGalaxyNebula(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.fillStyle = '#04020a';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    const centers = [
      { x: w * 0.35, y: h * 0.40, color: 'rgba(247, 37, 133, 0.25)', r: w * 0.55 },
      { x: w * 0.65, y: h * 0.60, color: 'rgba(76, 201, 240, 0.25)', r: w * 0.60 },
      { x: w * 0.50, y: h * 0.50, color: 'rgba(114, 9, 183, 0.28)', r: w * 0.70 }
    ];
    for (let c of centers) {
      const g = ctx.createRadialGradient(c.x + Math.sin(time * 0.4) * 40, c.y + Math.cos(time * 0.4) * 40, 10, c.x, c.y, c.r);
      g.addColorStop(0, c.color);
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  renderDiscoLasers(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    const colors = ['#00f2fe', '#fe0979', '#39ff14', '#ffd000'];
    const originX1 = w * 0.15;
    const originX2 = w * 0.85;
    for (let k = 0; k < 6; k++) {
      const sweepX = (w * 0.5) + Math.sin(time * 2.2 + k * 0.8) * (w * 0.45);
      const sweepY = h * (0.45 + (k % 3) * 0.20);
      ctx.strokeStyle = colors[k % colors.length];
      ctx.lineWidth = (2.5 + (k % 2) * 1.5) * this.scaleFactor;
      ctx.shadowColor = colors[k % colors.length];
      ctx.shadowBlur = 14 * this.scaleFactor;
      ctx.beginPath();
      ctx.moveTo(k % 2 === 0 ? originX1 : originX2, 0);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderFirefliesMagic(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#020706');
    bgGrad.addColorStop(0.5, '#05120e');
    bgGrad.addColorStop(1, '#091f19');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    for (let i = 0; i < 30; i++) {
      const fx = ((i * 127 + Math.sin(time * 0.6 + i) * 60) % w + w) % w;
      const fy = ((i * 89 + Math.cos(time * 0.5 + i * 1.4) * 70) % h + h) % h;
      const alpha = 0.35 + Math.sin(time * 3 + i * 2) * 0.35;
      const fr = (4 + (i % 4) * 2) * this.scaleFactor;
      const fGrad = ctx.createRadialGradient(fx, fy, 1, fx, fy, fr * 3);
      fGrad.addColorStop(0, `rgba(217, 255, 100, ${alpha})`);
      fGrad.addColorStop(0.5, `rgba(76, 201, 100, ${alpha * 0.4})`);
      fGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.arc(fx, fy, fr * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderLofiRainWindow(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.fillStyle = '#070a14';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    // Blurred street lights in background
    for (let k = 0; k < 12; k++) {
      const lx = (k * 180 + 90) % w;
      const ly = (h * 0.65) + Math.sin(k * 3) * (h * 0.15);
      const lr = (30 + (k % 4) * 15) * this.scaleFactor;
      const lGrad = ctx.createRadialGradient(lx, ly, 2, lx, ly, lr);
      const col = k % 3 === 0 ? 'rgba(255, 120, 50, 0.22)' : (k % 3 === 1 ? 'rgba(0, 200, 255, 0.20)' : 'rgba(255, 220, 100, 0.18)');
      lGrad.addColorStop(0, col);
      lGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lGrad;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rain streaks falling
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
    ctx.lineWidth = 1.2 * this.scaleFactor;
    for (let r = 0; r < 40; r++) {
      const rx = (r * 73) % w;
      const ry = ((time * 800 + r * 150) % (h + 100)) - 50;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8 * this.scaleFactor, ry + 28 * this.scaleFactor);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 14. Lo-Fi Cozy Bedroom & Amber Lamp Visualizer
  renderLofiCozyBedroom(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const scale = this.scaleFactor;

    // Warm ambient bedroom gradient (terracotta & espresso)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0c0709');
    bgGrad.addColorStop(0.5, '#170e0d');
    bgGrad.addColorStop(1, '#0e0807');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // Warm glowing desk lamp at bottom-right casting amber radial light
    const lampX = w * 0.78;
    const lampY = h * 0.75;
    const lampGrad = ctx.createRadialGradient(lampX, lampY, 10 * scale, lampX, lampY, w * 0.75);
    lampGrad.addColorStop(0, 'rgba(255, 175, 90, 0.45)');
    lampGrad.addColorStop(0.25, 'rgba(255, 130, 45, 0.22)');
    lampGrad.addColorStop(0.6, 'rgba(180, 70, 20, 0.08)');
    lampGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lampGrad;
    ctx.fillRect(0, 0, w, h);

    // Rainy window reflection in top-left
    const winX = w * 0.12;
    const winY = h * 0.15;
    const winW = w * 0.32;
    const winH = h * 0.28;
    ctx.fillStyle = 'rgba(15, 25, 45, 0.55)';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = 'rgba(255, 180, 110, 0.25)';
    ctx.lineWidth = 3 * scale;
    ctx.strokeRect(winX, winY, winW, winH);
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, winY);
    ctx.lineTo(winX + winW / 2, winY + winH);
    ctx.moveTo(winX, winY + winH / 2);
    ctx.lineTo(winX + winW, winY + winH / 2);
    ctx.stroke();

    // Floating cozy dust motes in the lamp beam
    for (let i = 0; i < 28; i++) {
      const mx = (lampX - w * 0.35) + ((i * 47 + time * 18) % (w * 0.5));
      const my = (lampY - h * 0.4) + ((i * 73 + Math.sin(time * 0.8 + i) * 35) % (h * 0.45));
      const mr = (1.5 + (i % 3)) * scale;
      ctx.fillStyle = `rgba(255, 220, 150, ${0.15 + (i % 4) * 0.08})`;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 15. Lo-Fi Coffee Shop & Spinning Vinyl Visualizer
  renderLofiVinylCoffee(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const scale = this.scaleFactor;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0a0605');
    bgGrad.addColorStop(0.5, '#160d09');
    bgGrad.addColorStop(1, '#080504');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const cx = w * 0.5;
    const cy = h * 0.48;
    const recordR = Math.min(w, h) * 0.38;
    const rot = time * 0.35;

    ctx.translate(cx, cy);
    ctx.rotate(rot);

    // Record disc base
    ctx.fillStyle = '#0f0f12';
    ctx.beginPath();
    ctx.arc(0, 0, recordR, 0, Math.PI * 2);
    ctx.fill();

    // Grooves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1 * scale;
    for (let r = recordR * 0.45; r < recordR * 0.95; r += 12 * scale) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Specular light sheen
    const sheenGrad = ctx.createLinearGradient(-recordR, -recordR, recordR, recordR);
    sheenGrad.addColorStop(0, 'rgba(255, 200, 140, 0.08)');
    sheenGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    sheenGrad.addColorStop(1, 'rgba(255, 200, 140, 0.06)');
    ctx.fillStyle = sheenGrad;
    ctx.beginPath();
    ctx.arc(0, 0, recordR, 0, Math.PI * 2);
    ctx.fill();

    // Center record label
    const labelR = recordR * 0.32;
    ctx.fillStyle = '#c85a32';
    ctx.beginPath();
    ctx.arc(0, 0, labelR, 0, Math.PI * 2);
    ctx.fill();

    // Spindle hole
    ctx.fillStyle = '#0a0605';
    ctx.beginPath();
    ctx.arc(0, 0, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Drifting warm coffee steam particles at bottom
    ctx.save();
    for (let s = 0; s < 18; s++) {
      const sx = w * 0.5 + Math.sin(time * 1.2 + s * 1.5) * (w * 0.18);
      const sy = h * 0.85 - ((time * 60 + s * 45) % (h * 0.38));
      const sr = (12 + (s % 5) * 8) * scale;
      const sGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, sr);
      sGrad.addColorStop(0, 'rgba(240, 200, 170, 0.08)');
      sGrad.addColorStop(1, 'rgba(240, 200, 170, 0)');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 16. Sleeping Moonlight & Drifting Clouds Visualizer
  renderSleepMoonlightClouds(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const scale = this.scaleFactor;

    // Deep serene midnight blue gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#030611');
    bgGrad.addColorStop(0.4, '#080d21');
    bgGrad.addColorStop(0.8, '#0d132a');
    bgGrad.addColorStop(1, '#050814');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    // Distant calm stars
    for (let s = 0; s < 35; s++) {
      const sx = (s * 97) % w;
      const sy = (s * 53) % (h * 0.55);
      const twinkle = 0.3 + Math.sin(time * 1.5 + s) * 0.25;
      ctx.fillStyle = `rgba(220, 235, 255, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(sx, sy, (1 + (s % 2)) * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glowing Crescent Moon in top right
    const moonX = w * 0.76;
    const moonY = h * 0.18;
    const moonR = 48 * scale;

    const halo = ctx.createRadialGradient(moonX, moonY, moonR * 0.8, moonX, moonY, moonR * 3.5);
    halo.addColorStop(0, 'rgba(200, 220, 255, 0.25)');
    halo.addColorStop(0.5, 'rgba(160, 190, 255, 0.08)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR * 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f0f6fc';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#080d21';
    ctx.beginPath();
    ctx.arc(moonX - moonR * 0.42, moonY - moonR * 0.15, moonR * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // 3 Layers of slow drifting slumber clouds
    for (let layer = 0; layer < 3; layer++) {
      const speed = 12 + layer * 8;
      const cY = h * (0.35 + layer * 0.22);
      const cAlpha = 0.07 + layer * 0.04;
      ctx.fillStyle = `rgba(180, 205, 245, ${cAlpha})`;
      for (let c = 0; c < 5; c++) {
        const cX = ((c * w * 0.45 + time * speed) % (w * 1.6)) - w * 0.3;
        const radX = (110 + (c % 3) * 35) * scale;
        const radY = (35 + (c % 2) * 15) * scale;
        ctx.beginPath();
        ctx.ellipse(cX, cY, radX, radY, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 17. Deep Sleep Floating Dream Orbs Visualizer
  renderSleepFloatingDreams(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const scale = this.scaleFactor;

    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.9);
    bgGrad.addColorStop(0, '#100a24');
    bgGrad.addColorStop(0.6, '#080514');
    bgGrad.addColorStop(1, '#030208');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    const orbColors = [
      'rgba(192, 132, 252, ',
      'rgba(129, 140, 248, ',
      'rgba(56, 189, 248, ',
      'rgba(244, 114, 182, '
    ];

    for (let i = 0; i < 14; i++) {
      const colPrefix = orbColors[i % orbColors.length];
      const ox = (i * 123 + Math.sin(time * 0.6 + i) * 60) % w;
      const oy = h - ((time * 25 + i * 140) % (h + 200)) + 50;
      const pulse = 1.0 + Math.sin(time * 0.8 + i * 2) * 0.18;
      const orad = (45 + (i % 4) * 25) * scale * pulse;

      const oGrad = ctx.createRadialGradient(ox, oy, 2, ox, oy, orad);
      oGrad.addColorStop(0, colPrefix + '0.28)');
      oGrad.addColorStop(0.5, colPrefix + '0.10)');
      oGrad.addColorStop(1, colPrefix + '0)');

      ctx.fillStyle = oGrad;
      ctx.beginPath();
      ctx.arc(ox, oy, orad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 18. Midnight Sleeping Ocean Waves Visualizer
  renderSleepNightOcean(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const scale = this.scaleFactor;

    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    skyGrad.addColorStop(0, '#020308');
    skyGrad.addColorStop(0.7, '#060a18');
    skyGrad.addColorStop(1, '#0a1024');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.55);

    const seaGrad = ctx.createLinearGradient(0, h * 0.55, 0, h);
    seaGrad.addColorStop(0, '#040916');
    seaGrad.addColorStop(0.5, '#02050c');
    seaGrad.addColorStop(1, '#010206');
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    ctx.save();
    ctx.strokeStyle = 'rgba(120, 160, 220, 0.15)';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.55);
    ctx.stroke();

    const moonCenterX = w * 0.5;
    for (let row = 0; row < 24; row++) {
      const ry = h * 0.56 + (row / 24) * (h * 0.42);
      const rowSpread = 20 * scale + (row / 24) * (w * 0.35);
      const waveShift = Math.sin(time * 1.5 + row * 0.5) * 15 * scale;
      const alpha = 0.22 * (1 - (row / 24) * 0.5);

      ctx.strokeStyle = `rgba(200, 230, 255, ${alpha})`;
      ctx.lineWidth = (1 + (row % 3) * 0.8) * scale;
      ctx.beginPath();
      ctx.moveTo(moonCenterX - rowSpread + waveShift, ry);
      ctx.lineTo(moonCenterX + rowSpread + waveShift, ry);
      ctx.stroke();
    }
    ctx.restore();
  }
}

window.KaraokeRenderer = KaraokeRenderer;