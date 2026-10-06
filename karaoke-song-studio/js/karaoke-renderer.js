/**
 * KaraokeRenderer - Real-Time HTML5 Canvas Animation Engine
 * Features:
 * 1. Millisecond-accurate word wiping gradient animation
 * 2. 2-line progressive lyric display (active top, dimmed read-ahead bottom)
 * 3. Pre-vocal 3-2-1 pulsating countdown dots
 * 4. Bouncing ball animation follower
 * 5. Audio-reactive procedural backgrounds (Cyber Grid, Starfield, Audio Spectrum, Bokeh, Sunset, Obsidian)
 * 6. TikTok / Reels / Shorts safe-zone overlay guides
 * 7. Multi-aspect ratio (9:16, 16:9, 1:1, 4:5) and resolution scaling (720p - 4K)
 */

class KaraokeRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement || document.getElementById('previewCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    // Canvas Dimensions & Aspect Ratio
    this.aspectRatio = '9:16'; // '9:16' | '16:9' | '1:1' | '4:5'
    this.width = 1080;
    this.height = 1920;
    this.scaleFactor = 1.0;

    // Viewport Zoom
    this.viewportZoom = 1.0;

    // UI Safe Zones
    this.showSafeZones = false;

    // Styling & Typography
    this.fontFamily = 'Montserrat';
    this.fontSize = 58; // Base font size
    this.fontWeight = '800';
    this.lineHeight = 1.4;
    this.lyricYPercent = 50; // Vertical position (0-100%)

    // Colors & Theme
    this.unsungColor = '#ffffff';
    this.unsungOpacity = 0.55;
    this.sungColor = '#00f2fe';
    this.sungSecondaryColor = '#4facfe';
    this.glowColor = '#00f2fe';
    this.glowBlur = 18;
    this.outlineColor = '#000000';
    this.outlineWidth = 8;
    this.countdownColor = '#fe0979';

    // Animation Style
    this.wipeStyle = 'gradient_wipe'; // 'gradient_wipe' | 'bouncing_ball' | 'neon_box' | 'word_pop'
    this.showCountdown = true;

    // Background System
    this.bgType = 'procedural'; // 'procedural' | 'image' | 'video'
    this.proceduralStyle = 'cyber_grid'; // 'cyber_grid' | 'starfield' | 'audio_spectrum' | 'bokeh_particles' | 'sunset_waves' | 'studio_dark'
    this.bgImage = null;
    this.bgVideo = null;
    this.bgDarken = 0.45; // Darken overlay for maximum lyric contrast

    // Procedural Particle / Stars state
    this.stars = [];
    this.particles = [];
    this.gridOffset = 0;
    this.initParticles();

    // Audio Analyser data buffer for audio-reactive visuals
    this.fftData = new Uint8Array(128);

    // Bouncing ball physics
    this.ballState = { x: 0, y: 0, targetX: 0, targetY: 0, progress: 0 };
  }

  setDimensions(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.scaleFactor = width / 1080;
  }

  setAspectRatio(ratio) {
    this.aspectRatio = ratio;
    switch (ratio) {
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
    }
  }

  initParticles() {
    this.stars = [];
    for (let i = 0; i < 200; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 1000 + 1,
        size: Math.random() * 2 + 1
      });
    }

    this.particles = [];
    for (let i = 0; i < 50; i++) {
      this.particles.push({
        x: Math.random() * 1080,
        y: Math.random() * 1920,
        radius: Math.random() * 40 + 20,
        speedX: (Math.random() - 0.5) * 0.8,
        speedY: -Math.random() * 1.2 - 0.4,
        alpha: Math.random() * 0.4 + 0.1,
        hue: Math.random() > 0.5 ? 190 : 320
      });
    }
  }

  /**
   * Main Render Entrypoint - called each animation frame
   */
  render(currentTime, lines, analyserNode = null) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();

    // 1. Render Background Layer
    this.renderBackground(currentTime, analyserNode);

    // 2. Render Dimmed Contrast Backdrop (Ensures text is 100% legible)
    if (this.bgDarken > 0) {
      ctx.fillStyle = `rgba(5, 7, 12, ${this.bgDarken})`;
      ctx.fillRect(0, 0, w, h);
    }

    // 3. Render Karaoke Lyrics Layer
    this.renderLyrics(currentTime, lines);

    // 4. Render Safe Zones Overlay (if enabled)
    if (this.showSafeZones) {
      this.renderSafeZonesOverlay();
    }

    ctx.restore();
  }

  /**
   * Renders Background: either custom image, looping video, or procedural canvas effects
   */
  renderBackground(currentTime, analyserNode) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    if (this.bgType === 'image' && this.bgImage && this.bgImage.complete) {
      this.drawCoverMedia(this.bgImage);
      return;
    }

    if (this.bgType === 'video' && this.bgVideo && this.bgVideo.readyState >= 2) {
      this.drawCoverMedia(this.bgVideo);
      return;
    }

    // Procedural Backgrounds
    switch (this.proceduralStyle) {
      case 'cyber_grid':
        this.renderCyberGrid(currentTime);
        break;
      case 'starfield':
        this.renderStarfield(currentTime);
        break;
      case 'audio_spectrum':
        this.renderAudioSpectrum(currentTime, analyserNode);
        break;
      case 'bokeh_particles':
        this.renderBokehParticles(currentTime);
        break;
      case 'sunset_waves':
        this.renderSunsetWaves(currentTime);
        break;
      case 'studio_dark':
      default:
        this.renderStudioDark(currentTime);
        break;
    }
  }

  drawCoverMedia(media) {
    const ctx = this.ctx;
    const cw = this.width;
    const ch = this.height;
    const mw = media.videoWidth || media.naturalWidth || media.width;
    const mh = media.videoHeight || media.naturalHeight || media.height;

    if (!mw || !mh) return;

    const scale = Math.max(cw / mw, ch / mh);
    const sw = mw * scale;
    const sh = mh * scale;
    const sx = (cw - sw) / 2;
    const sy = (ch - sh) / 2;

    ctx.drawImage(media, sx, sy, sw, sh);
  }

  // --- Procedural Background Visualizers ---

  renderCyberGrid(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Dark gradient sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#090a14');
    sky.addColorStop(0.5, '#1e0836');
    sky.addColorStop(1, '#05020a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Glowing Synthwave Sun
    const sunY = h * 0.42;
    const sunR = Math.min(w, h) * 0.22;
    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, '#ff007f');
    sunGrad.addColorStop(0.5, '#ff7700');
    sunGrad.addColorStop(1, '#ffee00');

    ctx.save();
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 40;
    ctx.beginPath();
    ctx.arc(w / 2, sunY, sunR, 0, Math.PI * 2);
    ctx.fillStyle = sunGrad;
    ctx.fill();
    ctx.restore();

    // Perspective Grid Floor
    const horizon = h * 0.55;
    this.gridOffset = (time * 120) % 60;

    ctx.strokeStyle = 'rgba(0, 242, 254, 0.45)';
    ctx.lineWidth = 2 * this.scaleFactor;

    // Horizontal moving grid lines
    for (let y = horizon; y < h; y += 30) {
      const p = (y - horizon) / (h - horizon);
      const curveY = horizon + Math.pow(p, 2.2) * (h - horizon) + (this.gridOffset * p);
      if (curveY > horizon && curveY <= h) {
        ctx.beginPath();
        ctx.moveTo(0, curveY);
        ctx.lineTo(w, curveY);
        ctx.stroke();
      }
    }

    // Vanishing perspective rays
    for (let x = -w * 0.5; x <= w * 1.5; x += w * 0.12) {
      ctx.beginPath();
      ctx.moveTo(w / 2, horizon);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  renderStarfield(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.fillStyle = '#05060b';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const speed = 18;

    for (let s of this.stars) {
      s.z -= speed;
      if (s.z <= 0) {
        s.z = 1000;
        s.x = (Math.random() - 0.5) * 2000;
        s.y = (Math.random() - 0.5) * 2000;
      }

      const k = 400 / s.z;
      const px = cx + s.x * k;
      const py = cy + s.y * k;
      const r = Math.max(0.8, (1 - s.z / 1000) * 3.5 * this.scaleFactor);

      if (px >= 0 && px <= w && py >= 0 && py <= h) {
        ctx.fillStyle = s.z < 300 ? '#00f2fe' : (s.z < 600 ? '#ffffff' : '#9d4edd');
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderAudioSpectrum(time, analyserNode) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Dark sleek background
    const bg = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w * 0.8);
    bg.addColorStop(0, '#101528');
    bg.addColorStop(1, '#05070d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (analyserNode) {
      analyserNode.getByteFrequencyData(this.fftData);
    } else {
      // Procedural fallback sine modulation
      for (let i = 0; i < this.fftData.length; i++) {
        this.fftData[i] = Math.sin(time * 6 + i * 0.2) * 80 + 100;
      }
    }

    const numBars = 48;
    const barWidth = (w / numBars) * 0.7;
    const gap = (w / numBars) * 0.3;
    const maxBarHeight = h * 0.32;
    const baseY = h * 0.88;

    for (let i = 0; i < numBars; i++) {
      const val = this.fftData[i * 2] || 0;
      const norm = val / 255;
      const barH = norm * maxBarHeight + 6;
      const x = i * (barWidth + gap) + gap;

      const grad = ctx.createLinearGradient(0, baseY, 0, baseY - barH);
      grad.addColorStop(0, 'rgba(0, 242, 254, 0.2)');
      grad.addColorStop(0.7, '#00f2fe');
      grad.addColorStop(1, '#fe0979');

      ctx.fillStyle = grad;
      ctx.fillRect(x, baseY - barH, barWidth, barH);
    }
  }

  renderBokehParticles(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0a0d17');
    bg.addColorStop(0.5, '#12182b');
    bg.addColorStop(1, '#070912');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (let p of this.particles) {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.y < -p.radius * 2) {
        p.y = h + p.radius;
        p.x = Math.random() * w;
      }

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * this.scaleFactor);
      grad.addColorStop(0, `hsla(${p.hue}, 100%, 65%, ${p.alpha * 0.8})`);
      grad.addColorStop(0.6, `hsla(${p.hue}, 90%, 50%, ${p.alpha * 0.3})`);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * this.scaleFactor, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderSunsetWaves(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#150628');
    grad.addColorStop(0.4, '#380e45');
    grad.addColorStop(0.75, '#6a165b');
    grad.addColorStop(1, '#0e0417');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Glowing sine ribbons
    ctx.lineWidth = 4 * this.scaleFactor;
    for (let wave = 0; wave < 3; wave++) {
      ctx.beginPath();
      ctx.strokeStyle = wave === 0 ? 'rgba(255, 110, 199, 0.4)' : (wave === 1 ? 'rgba(255, 178, 56, 0.35)' : 'rgba(0, 242, 254, 0.3)');
      for (let x = 0; x <= w; x += 20) {
        const y = h * 0.45 + Math.sin(x * 0.003 + time * 1.5 + wave) * 80 + Math.cos(x * 0.008 - time * 0.8) * 40;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  renderStudioDark(time) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Elegant deep obsidian vignette
    const bg = ctx.createRadialGradient(w / 2, h * 0.45, 100, w / 2, h * 0.45, w * 0.95);
    const breathe = Math.sin(time * 1.2) * 0.03 + 0.12;
    bg.addColorStop(0, `rgba(32, 42, 68, ${breathe + 0.1})`);
    bg.addColorStop(0.6, '#0d101a');
    bg.addColorStop(1, '#040508');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * --- SYNCHRONIZED KARAOKE LYRICS ENGINE (CANVAS) ---
   */
  renderLyrics(currentTime, lines) {
    if (!lines || lines.length === 0) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Find active and next lines
    let activeIdx = -1;
    let nextIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (currentTime >= l.start && currentTime <= l.end) {
        activeIdx = i;
        nextIdx = i + 1 < lines.length ? i + 1 : -1;
        break;
      }
    }

    // In gap between lines
    if (activeIdx === -1) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].start > currentTime) {
          nextIdx = i;
          break;
        }
      }
    }

    const currentLine = activeIdx >= 0 ? lines[activeIdx] : null;
    const upcomingLine = (activeIdx >= 0 && nextIdx >= 0) ? lines[nextIdx] : (nextIdx >= 0 ? lines[nextIdx] : null);

    // Compute Base Position
    const effectiveFontSize = this.fontSize * this.scaleFactor;
    const computedLineHeight = effectiveFontSize * this.lineHeight;
    const centerY = (h * (this.lyricYPercent / 100));

    // 1. Render Pre-Vocal 3-2-1 Countdown
    if (this.showCountdown) {
      const targetLine = currentLine || upcomingLine;
      if (targetLine) {
        const gap = targetLine.start - currentTime;
        if (gap > 0.1 && gap <= 3.2) {
          this.renderPreVocalCountdown(gap, centerY - computedLineHeight * 1.35);
        }
      }
    }

    // 2. Render Active Line (Top line with real-time syllable gradient wipe)
    if (currentLine) {
      const activeLineY = upcomingLine ? (centerY - computedLineHeight * 0.55) : centerY;
      this.renderProgressiveWipeLine(currentLine, currentTime, activeLineY, effectiveFontSize, 1.0);
    }

    // 3. Render Next Line (Dimmed read-ahead preview below)
    if (upcomingLine) {
      const nextLineY = currentLine ? (centerY + computedLineHeight * 0.65) : centerY;
      this.renderProgressiveWipeLine(upcomingLine, currentTime, nextLineY, effectiveFontSize * 0.88, 0.45);
    }
  }

  /**
   * Renders a single line with precise left-to-right syllable / word wiping
   */
  renderProgressiveWipeLine(line, currentTime, yPos, fontSize, lineOpacity) {
    const ctx = this.ctx;
    const w = this.width;

    ctx.save();
    ctx.globalAlpha = lineOpacity;
    ctx.font = `${this.fontWeight} ${fontSize}px "${this.fontFamily}", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const words = line.words || [];
    if (words.length === 0) {
      ctx.restore();
      return;
    }

    // Measure total line layout and word bounds
    const spaceWidth = ctx.measureText(' ').width;
    const wordWidths = words.map(w => ctx.measureText(w.text).width);
    const totalLineWidth = wordWidths.reduce((sum, val) => sum + val, 0) + spaceWidth * (words.length - 1);

    // Starting X offset for centered line
    let curX = (w - totalLineWidth) / 2;

    // PASS 1: Render All Words in Crisp Unsung Style (Background text with heavy shadow)
    words.forEach((wordObj, i) => {
      const wordW = wordWidths[i];
      const wordCenterX = curX + wordW / 2;

      // Draw dark outline for contrast
      ctx.lineWidth = this.outlineWidth * this.scaleFactor;
      ctx.strokeStyle = this.outlineColor;
      ctx.strokeText(wordObj.text, wordCenterX, yPos);

      // Draw Unsung Fill
      ctx.fillStyle = this.unsungColor;
      ctx.globalAlpha = lineOpacity * this.unsungOpacity;
      ctx.fillText(wordObj.text, wordCenterX, yPos);

      curX += wordW + spaceWidth;
    });

    // PASS 2: Render Sung Fill with Left-to-Right Millisecond Gradient Wipe
    curX = (w - totalLineWidth) / 2;

    words.forEach((wordObj, i) => {
      const wordW = wordWidths[i];
      const wordCenterX = curX + wordW / 2;

      let wordProgress = 0; // 0.0 to 1.0
      if (currentTime >= wordObj.end) {
        wordProgress = 1.0;
      } else if (currentTime > wordObj.start) {
        const dur = Math.max(0.05, wordObj.end - wordObj.start);
        wordProgress = Math.max(0, Math.min(1.0, (currentTime - wordObj.start) / dur));
      }

      if (wordProgress > 0) {
        ctx.save();
        ctx.globalAlpha = lineOpacity;

        // Clip region to exact word wiped proportion
        const wipeBoundaryX = curX + wordW * wordProgress;

        ctx.beginPath();
        ctx.rect(curX - 4, yPos - fontSize * 0.8, (wordW * wordProgress) + 4, fontSize * 1.6);
        ctx.clip();

        // Neon Glow effect
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = this.glowBlur * this.scaleFactor;

        // Gradient sung text fill
        const sungGrad = ctx.createLinearGradient(curX, 0, curX + wordW, 0);
        sungGrad.addColorStop(0, this.sungColor);
        sungGrad.addColorStop(1, this.sungSecondaryColor);

        ctx.fillStyle = sungGrad;
        ctx.fillText(wordObj.text, wordCenterX, yPos);

        // Word Pop Scale or Highlight
        if (this.wipeStyle === 'word_pop' && wordProgress > 0 && wordProgress < 1.0) {
          ctx.lineWidth = 3 * this.scaleFactor;
          ctx.strokeStyle = '#ffffff';
          ctx.strokeText(wordObj.text, wordCenterX, yPos);
        }

        ctx.restore();

        // Bouncing Ball Follower
        if (this.wipeStyle === 'bouncing_ball' && wordProgress > 0 && wordProgress <= 1.0 && lineOpacity >= 0.9) {
          this.renderBouncingBall(wordCenterX, yPos - fontSize * 0.65, wordProgress, fontSize);
        }
      }

      curX += wordW + spaceWidth;
    });

    ctx.restore();
  }

  /**
   * Bouncing Ball on Top of Current Word
   */
  renderBouncingBall(targetX, baseY, progress, fontSize) {
    const ctx = this.ctx;
    // Parabolic arc bounce: peak at progress = 0.5
    const bounceHeight = fontSize * 0.75;
    const arc = Math.sin(progress * Math.PI) * bounceHeight;
    const ballY = baseY - arc;
    const ballR = 12 * this.scaleFactor;

    ctx.save();
    ctx.shadowColor = '#fe0979';
    ctx.shadowBlur = 18 * this.scaleFactor;

    const ballGrad = ctx.createRadialGradient(targetX - 2, ballY - 2, 2, targetX, ballY, ballR);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.5, '#fe0979');
    ballGrad.addColorStop(1, '#ff0055');

    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(targetX, ballY, ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Pre-Vocal 3-2-1 Countdown Pulsating Dots
   */
  renderPreVocalCountdown(gapSeconds, yPos) {
    const ctx = this.ctx;
    const w = this.width;
    const dotRadius = 14 * this.scaleFactor;
    const spacing = 50 * this.scaleFactor;
    const cx = w / 2;

    // Which countdown dots are lit: 3, 2, 1
    // 3.0 -> 3 dots; 2.0 -> 2 dots; 1.0 -> 1 dot
    const activeDotCount = gapSeconds > 2.0 ? 3 : (gapSeconds > 1.0 ? 2 : 1);
    const pulsePhase = (gapSeconds % 1.0);
    const pulseScale = 1.0 + (1.0 - pulsePhase) * 0.45;

    ctx.save();
    for (let i = 0; i < 3; i++) {
      const dotX = cx + (i - 1) * spacing;
      const isLit = (3 - i) <= activeDotCount;

      ctx.save();
      if (isLit) {
        ctx.shadowColor = this.countdownColor;
        ctx.shadowBlur = 24 * this.scaleFactor;
        ctx.fillStyle = this.countdownColor;
        const currentR = (3 - i === activeDotCount) ? (dotRadius * pulseScale) : dotRadius;
        ctx.beginPath();
        ctx.arc(dotX, yPos, currentR, 0, Math.PI * 2);
        ctx.fill();

        // Inside white core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(dotX, yPos, currentR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(dotX, yPos, dotRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * Safe Zones Guide Lines (Shorts, TikTok, Instagram Reels)
   */
  renderSafeZonesOverlay() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.lineWidth = 2 * this.scaleFactor;
    ctx.strokeStyle = 'rgba(255, 220, 0, 0.75)';
    ctx.setLineDash([8 * this.scaleFactor, 6 * this.scaleFactor]);

    // Top safe zone (15% height: profile, search, sound)
    const topMargin = h * 0.15;
    ctx.beginPath();
    ctx.moveTo(0, topMargin);
    ctx.lineTo(w, topMargin);
    ctx.stroke();

    // Bottom safe zone (25% height: title, audio name, account, captions)
    const bottomMargin = h * 0.75;
    ctx.beginPath();
    ctx.moveTo(0, bottomMargin);
    ctx.lineTo(w, bottomMargin);
    ctx.stroke();

    // Right safe zone (15% width: like, comment, share, bookmark)
    const rightMargin = w * 0.85;
    ctx.beginPath();
    ctx.moveTo(rightMargin, topMargin);
    ctx.lineTo(rightMargin, bottomMargin);
    ctx.stroke();

    // Safe Zone Label
    ctx.font = `600 ${22 * this.scaleFactor}px Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255, 220, 0, 0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⚡ 9:16 Mobile Safe Zone (Keep lyrics inside)', 24 * this.scaleFactor, topMargin + 10);

    ctx.restore();
  }
}

window.KaraokeRenderer = KaraokeRenderer;