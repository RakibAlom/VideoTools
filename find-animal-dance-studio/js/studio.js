/**
 * Animal Dance Studio - Master Interactive Engine
 * Handles Canvas rendering, multi-animal scatter & depth sorting, drag-and-drop handles,
 * live 60fps GIF compositing, typography styles, audio mixing, and video export.
 */

class AnimalDanceStudio {
  constructor() {
    // Canvas & Stage
    this.canvas = document.getElementById('masterCanvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.stageWrapper = document.getElementById('stageWrapper');

    // Dimensions & Aspect Ratio
    this.aspectRatio = '9:16';
    this.canvasWidth = 1080;
    this.canvasHeight = 1920;
    this.resolutionPreset = '1080p';

    // Video Properties
    this.videoDuration = 15; // seconds
    this.fps = 30;
    this.bitrate = 16000000; // 16 Mbps
    this.currentTime = 0;
    this.isPlaying = false;
    this.lastFrameTime = 0;

    // View Modes
    this.creatorMode = true; // Show handles, numbers, bounding boxes
    this.answerRevealMode = false; // Show answer target rings
    this.appendRevealEnding = false;

    // Background State
    this.bg = {
      presetId: 'rustic_water_village',
      img: new Image(),
      isLoaded: false,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100
    };

    // Animals & Characters
    this.activeCharType = 'shuba_duck';
    this.loadedGifs = new Map(); // id -> gifData
    this.animals = []; // list of animal instances
    this.animalCount = 15;
    this.selectedAnimalId = null;

    // Title & Hook
    this.title = {
      text: 'Find 15 Ducks',
      autoSyncCount: true,
      subtitle: 'Can you spot all 15? 99% FAIL!',
      showSubtitle: true,
      nx: 0.5,
      ny: 0.11,
      style: 'viral_bold',
      fontFamily: 'Outfit',
      fontSize: 64,
      textColor: '#ffffff',
      strokeColor: '#000000',
      strokeWidth: 10,
      shadowBlur: 14,
      shadowOffsetY: 6,
      showBackplate: false
    };

    // Watermark & Branding
    this.watermark = {
      enabled: true,
      text: 'SmartBrain Game',
      nx: 0.5,
      ny: 0.965,
      opacity: 0.65,
      fontSize: 24,
      color: '#ffffff'
    };

    // Countdown Timer Bar
    this.timerBar = {
      enabled: true,
      height: 8,
      color: '#38bdf8'
    };

    // Dragging & Interaction State
    this.interaction = {
      isDragging: false,
      dragTarget: null, // 'animal', 'title', 'watermark', 'handle-resize', 'handle-rot', 'bg-pan'
      targetId: null,
      startX: 0,
      startY: 0,
      origItemX: 0,
      origItemY: 0,
      origScale: 1,
      origRot: 0,
      spaceDown: false
    };

    // Waveform canvas
    this.waveformCanvas = document.getElementById('waveformCanvas');
    this.waveformCtx = this.waveformCanvas.getContext('2d');

    // Exporting State
    this.isExporting = false;
    this.exportMediaRecorder = null;
    this.exportChunks = [];
    this.exportStartTime = 0;

    // Initialize
    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setAspectRatio('9:16');
    this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');

    // Load initial Duck GIF
    await this.loadCharacterGif('shuba_duck', 'assets/animals/shuba_duck.gif');
    // Preload Cat GIF too
    this.loadCharacterGif('dancing_cat', 'assets/animals/dancing_cat.gif');

    // Generate initial procedural soundtrack
    await window.audioEngine.generatePresetBGM('quack_hop', 60);
    this.drawWaveform();

    // Populate initial 15 animals with Smart Depth Scatter
    this.generateAnimals(15, true);

    // Start render loop
    requestAnimationFrame(this.renderLoop.bind(this));

    this.showToast('🦆 Animal Dance Studio Ready!', 'success');
  }

  // =========================================================================
  // CHARACTER & GIF LOADING
  // =========================================================================

  async loadCharacterGif(charId, url) {
    try {
      const gifData = await window.gifEngine.loadFromUrl(url, charId);
      this.loadedGifs.set(charId, gifData);
      return gifData;
    } catch (err) {
      console.error(`Failed to load GIF ${charId}:`, err);
      this.showToast(`Error loading GIF: ${err.message}`, 'error');
    }
  }

  async setCharacterType(charId) {
    this.activeCharType = charId;
    const badge = document.getElementById('charBadge');
    if (charId === 'shuba_duck') {
      badge.textContent = 'Shuba Duck';
      if (this.title.autoSyncCount) {
        this.title.text = `Find ${this.animals.length} Ducks`;
        document.getElementById('inputTitleText').value = this.title.text;
      }
    } else if (charId === 'dancing_cat') {
      badge.textContent = 'Dancing Cat';
      if (this.title.autoSyncCount) {
        this.title.text = `Find ${this.animals.length} Cats`;
        document.getElementById('inputTitleText').value = this.title.text;
      }
    } else {
      badge.textContent = 'Custom Character';
    }

    // Update active card styling
    document.querySelectorAll('.char-card').forEach(card => {
      card.classList.toggle('active', card.dataset.char === charId);
    });

    // Update existing animals to new character
    this.animals.forEach(a => a.charId = charId);
    this.renderLayerList();
  }

  // =========================================================================
  // BACKGROUND LOADING & TRANSFORMS
  // =========================================================================

  loadBackground(src, presetId = null) {
    this.bg.isLoaded = false;
    this.bg.presetId = presetId;
    this.bg.img = new Image();
    this.bg.img.crossOrigin = 'anonymous';
    this.bg.img.onload = () => {
      this.bg.isLoaded = true;
    };
    this.bg.img.src = src;

    // Update preset styling
    document.querySelectorAll('.bg-thumb-card').forEach(card => {
      card.classList.toggle('active', card.dataset.bg === presetId);
    });
  }

  resetBackgroundTransform() {
    this.bg.zoom = 1.0;
    this.bg.panX = 0;
    this.bg.panY = 0;
    document.getElementById('sliderBgZoom').value = 100;
    document.getElementById('bgZoomVal').textContent = '100%';
    document.getElementById('sliderBgPanX').value = 0;
    document.getElementById('bgPanXVal').textContent = '0px';
    document.getElementById('sliderBgPanY').value = 0;
    document.getElementById('bgPanYVal').textContent = '0px';
  }

  // =========================================================================
  // MULTI-ANIMAL SMART SCATTER & DEPTH
  // =========================================================================

  /**
   * Generates 'count' animals using a realistic depth distribution:
   * Foreground = larger, lower on screen.
   * Midground = medium.
   * Background = tiny, higher on screen, hidden in nooks!
   */
  generateAnimals(count, smartDepth = true) {
    this.animalCount = count;
    this.animals = [];

    // Distinct depth tiers
    for (let i = 0; i < count; i++) {
      let nx, ny, scale;

      if (smartDepth) {
        // Distribute: 25% foreground, 40% midground, 35% background
        const tier = Math.random();

        if (tier < 0.25) {
          // Foreground (Bottom area)
          nx = 0.12 + Math.random() * 0.76;
          ny = 0.65 + Math.random() * 0.24;
          scale = 1.25 + Math.random() * 0.55; // 1.25x - 1.8x
        } else if (tier < 0.65) {
          // Midground (Middle area)
          nx = 0.10 + Math.random() * 0.80;
          ny = 0.38 + Math.random() * 0.26;
          scale = 0.70 + Math.random() * 0.35; // 0.70x - 1.05x
        } else {
          // Background (High up, roofs, boats, baskets, windows)
          nx = 0.12 + Math.random() * 0.76;
          ny = 0.20 + Math.random() * 0.20;
          scale = 0.30 + Math.random() * 0.30; // 0.30x - 0.60x (tiny hidden!)
        }
      } else {
        // Pure random
        nx = 0.1 + Math.random() * 0.8;
        ny = 0.2 + Math.random() * 0.7;
        scale = 0.5 + Math.random() * 0.8;
      }

      this.animals.push({
        id: `animal_${Date.now()}_${i}`,
        index: i + 1,
        charId: this.activeCharType,
        nx: Math.max(0.06, Math.min(0.94, nx)),
        ny: Math.max(0.18, Math.min(0.92, ny)),
        scale: scale,
        rotation: (Math.random() - 0.5) * 16, // subtle tilt
        flipX: Math.random() > 0.5,
        baseWidth: 100,
        baseHeight: 100
      });
    }

    // Sort by Y so foreground animals render on top of background
    this.sortAnimalsByDepth();

    // Auto-sync title
    this.updateTitleCount();

    // Refresh layer inspector
    this.renderLayerList();
    this.updateBadges();
  }

  sortAnimalsByDepth() {
    this.animals.sort((a, b) => a.ny - b.ny);
    // Re-index cleanly
    this.animals.forEach((a, i) => a.index = i + 1);
  }

  updateTitleCount() {
    const count = this.animals.length;
    document.getElementById('countBadge').textContent = `${count} Animals`;
    document.getElementById('exactCountVal').textContent = count;
    document.getElementById('inputAnimalCount').value = count;
    document.getElementById('totalAnimalLayerCount').textContent = count;

    if (this.title.autoSyncCount) {
      const charName = this.activeCharType === 'shuba_duck' ? 'Ducks' : (this.activeCharType === 'dancing_cat' ? 'Cats' : 'Animals');
      this.title.text = `Find ${count} ${charName}`;
      document.getElementById('inputTitleText').value = this.title.text;
    }
  }

  randomizeSizes() {
    this.animals.forEach(a => {
      // Scale varies from 0.3 (tiny) to 1.6 (large)
      a.scale = parseFloat((0.3 + Math.random() * 1.3).toFixed(2));
    });
    this.renderLayerList();
    this.showToast('🎲 Animal sizes randomized!', 'info');
  }

  reshufflePositions() {
    this.animals.forEach(a => {
      a.nx = 0.08 + Math.random() * 0.84;
      a.ny = 0.20 + Math.random() * 0.72;
      a.flipX = Math.random() > 0.5;
    });
    this.sortAnimalsByDepth();
    this.renderLayerList();
    this.showToast('🔀 Positions reshuffled!', 'info');
  }

  addSingleAnimal(nx = 0.5, ny = 0.5) {
    const newAnimal = {
      id: `animal_${Date.now()}_${Math.random()}`,
      index: this.animals.length + 1,
      charId: this.activeCharType,
      nx: nx,
      ny: ny,
      scale: 1.0,
      rotation: 0,
      flipX: false,
      baseWidth: 100,
      baseHeight: 100
    };
    this.animals.push(newAnimal);
    this.selectedAnimalId = newAnimal.id;
    this.sortAnimalsByDepth();
    this.updateTitleCount();
    this.renderLayerList();
    this.showToast('Added +1 Animal', 'success');
  }

  deleteAnimal(id) {
    this.animals = this.animals.filter(a => a.id !== id);
    if (this.selectedAnimalId === id) {
      this.selectedAnimalId = null;
    }
    this.sortAnimalsByDepth();
    this.updateTitleCount();
    this.renderLayerList();
  }

  duplicateAnimal(id) {
    const a = this.animals.find(item => item.id === id);
    if (!a) return;
    const copy = {
      ...a,
      id: `animal_${Date.now()}_${Math.random()}`,
      nx: Math.min(0.9, a.nx + 0.04),
      ny: Math.min(0.9, a.ny + 0.04)
    };
    this.animals.push(copy);
    this.selectedAnimalId = copy.id;
    this.sortAnimalsByDepth();
    this.updateTitleCount();
    this.renderLayerList();
    this.showToast('Animal duplicated', 'info');
  }

  // =========================================================================
  // ASPECT RATIOS & CANVAS RESIZING
  // =========================================================================

  setAspectRatio(ratio) {
    this.aspectRatio = ratio;
    if (ratio === '9:16') {
      this.canvasWidth = 1080;
      this.canvasHeight = 1920;
    } else if (ratio === '16:9') {
      this.canvasWidth = 1920;
      this.canvasHeight = 1080;
    } else if (ratio === '1:1') {
      this.canvasWidth = 1080;
      this.canvasHeight = 1080;
    } else if (ratio === '4:5') {
      this.canvasWidth = 1080;
      this.canvasHeight = 1350;
    }

    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;

    // Update UI active buttons
    document.querySelectorAll('.ratio-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === ratio);
    });

    this.fitCanvasToScreen();
  }

  fitCanvasToScreen() {
    const container = this.stageWrapper;
    const maxW = container.parentElement.clientWidth - 40;
    const maxH = container.parentElement.clientHeight - 140;

    const aspect = this.canvasWidth / this.canvasHeight;
    let targetW = maxW;
    let targetH = targetW / aspect;

    if (targetH > maxH) {
      targetH = maxH;
      targetW = targetH * aspect;
    }

    this.canvas.style.width = `${Math.floor(targetW)}px`;
    this.canvas.style.height = `${Math.floor(targetH)}px`;
  }

  // =========================================================================
  // RENDERING ENGINE (60 FPS LOOP)
  // =========================================================================

  renderLoop(timestamp) {
    if (!this.lastFrameTime) this.lastFrameTime = timestamp;
    const delta = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    if (this.isPlaying && !this.isExporting) {
      this.currentTime += delta;
      if (this.currentTime >= this.videoDuration) {
        this.currentTime = 0; // loop
      }
      this.updatePlayheadUI();
    }

    // Render master frame
    this.drawFrame(this.ctx, this.canvasWidth, this.canvasHeight, this.currentTime * 1000, !this.creatorMode);

    requestAnimationFrame(this.renderLoop.bind(this));
  }

  /**
   * Draws a complete video frame onto any target context
   * @param {CanvasRenderingContext2D} ctx - Context to render to
   * @param {number} width - Target width
   * @param {number} height - Target height
   * @param {number} timeMs - Current playback time in milliseconds
   * @param {boolean} cleanMode - If true, omits editor handles and gizmos
   */
  drawFrame(ctx, width, height, timeMs, cleanMode = false) {
    ctx.save();

    // 1. Draw Background
    this.renderBackground(ctx, width, height);

    // 2. Draw Animals (sorted by depth)
    this.renderAnimals(ctx, width, height, timeMs, cleanMode);

    // 3. Draw Title & Hook
    this.renderTitle(ctx, width, height, cleanMode);

    // 4. Draw Watermark / Branding
    if (this.watermark.enabled) {
      this.renderWatermark(ctx, width, height, cleanMode);
    }

    // 5. Draw Countdown Timer Bar
    if (this.timerBar.enabled) {
      this.renderTimerBar(ctx, width, height, timeMs);
    }

    // 6. Draw Answer Reveal Target Rings (if enabled)
    if (this.answerRevealMode) {
      this.renderAnswerRevealRings(ctx, width, height, timeMs);
    }

    ctx.restore();
  }

  // --- Background Rendering ---
  renderBackground(ctx, width, height) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    if (!this.bg.isLoaded || !this.bg.img.width) return;

    ctx.save();
    // Apply atmosphere filters
    ctx.filter = `brightness(${this.bg.brightness}%) contrast(${this.bg.contrast}%) saturate(${this.bg.saturation}%)`;

    // Calculate Cover scaling with Pan & Zoom
    const imgRatio = this.bg.img.width / this.bg.img.height;
    const canvasRatio = width / height;

    let baseW, baseH;
    if (imgRatio > canvasRatio) {
      baseH = height;
      baseW = height * imgRatio;
    } else {
      baseW = width;
      baseH = width / imgRatio;
    }

    const drawW = baseW * this.bg.zoom;
    const drawH = baseH * this.bg.zoom;

    // Center image + pan
    const drawX = (width - drawW) / 2 + (this.bg.panX * (width / 1080));
    const drawY = (height - drawH) / 2 + (this.bg.panY * (height / 1920));

    ctx.drawImage(this.bg.img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  // --- Animals Rendering ---
  renderAnimals(ctx, width, height, timeMs, cleanMode) {
    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      const gifData = this.loadedGifs.get(a.charId);
      const frameCanvas = gifData ? window.gifEngine.getFrame(gifData, timeMs) : null;

      // Position in canvas coordinates
      const x = a.nx * width;
      const y = a.ny * height;

      // Base dimension scaled proportionally to resolution
      const resScale = width / 1080;
      const baseW = (gifData ? gifData.width : 100) * 0.9 * resScale;
      const baseH = (gifData ? gifData.height : 100) * 0.9 * resScale;

      const drawW = baseW * a.scale;
      const drawH = baseH * a.scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((a.rotation * Math.PI) / 180);
      if (a.flipX) {
        ctx.scale(-1, 1);
      }

      if (frameCanvas) {
        ctx.drawImage(frameCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        // Fallback placeholder duck icon
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, drawW * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // In Creator Mode, draw Editor Gizmos (# Badge, Bounding Box, Handles)
      if (!cleanMode && this.creatorMode) {
        this.renderAnimalGizmos(ctx, a, x, y, drawW, drawH);
      }
    }
  }

  // --- Animal Gizmos (Selection & Badges) ---
  renderAnimalGizmos(ctx, a, x, y, drawW, drawH) {
    const isSelected = a.id === this.selectedAnimalId;

    // Small Number Badge on top-right of animal
    ctx.save();
    const badgeR = 14;
    const badgeX = x + drawW * 0.35;
    const badgeY = y - drawH * 0.35;

    ctx.fillStyle = isSelected ? '#fbbf24' : 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = isSelected ? '#000000' : '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${a.index}`, badgeX, badgeY);
    ctx.restore();

    // If selected, draw transform box & handles
    if (isSelected) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((a.rotation * Math.PI) / 180);

      // Bounding box
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-drawW / 2 - 4, -drawH / 2 - 4, drawW + 8, drawH + 8);
      ctx.setLineDash([]);

      // Corner Resize Handle (Bottom-Right)
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(drawW / 2 + 4, drawH / 2 + 4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rotation Handle (Top-Center)
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(0, -drawH / 2 - 4);
      ctx.lineTo(0, -drawH / 2 - 22);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -drawH / 2 - 22, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }

  // --- Title & Hook Rendering ---
  renderTitle(ctx, width, height, cleanMode) {
    const x = this.title.nx * width;
    const y = this.title.ny * height;
    const scale = width / 1080;
    const fontSize = this.title.fontSize * scale;
    const strokeWidth = this.title.strokeWidth * scale;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px '${this.title.fontFamily}', sans-serif`;

    // Style presets application
    if (this.title.style === 'viral_bold') {
      // Classic Viral Reel: Heavy black outline, white text, 3D shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 12 * scale;
      ctx.shadowOffsetY = 6 * scale;
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = this.title.strokeColor;
      ctx.strokeText(this.title.text, x, y);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = this.title.textColor;
      ctx.fillText(this.title.text, x, y);

    } else if (this.title.style === 'neon_glow') {
      // Cyber Neon: Glowing multi-layer cyan/magenta
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 24 * scale;
      ctx.lineWidth = strokeWidth * 0.7;
      ctx.strokeStyle = '#0284c7';
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(this.title.text, x, y);

    } else if (this.title.style === 'golden_arcade') {
      // Golden 3D Arcade: Extruded brown shadow with gold face
      for (let s = 6 * scale; s >= 1; s--) {
        ctx.fillStyle = '#78350f';
        ctx.fillText(this.title.text, x + s, y + s);
      }
      ctx.lineWidth = strokeWidth * 0.5;
      ctx.strokeStyle = '#b45309';
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(this.title.text, x, y);

    } else if (this.title.style === 'danger_alert') {
      // Danger Alert: Red & Yellow sticker
      const textMetrics = ctx.measureText(this.title.text);
      const boxW = textMetrics.width + 40 * scale;
      const boxH = fontSize * 1.35;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(this.title.text, x, y);

    } else if (this.title.style === 'glass_pill') {
      // Frosted Glass Pill
      const textMetrics = ctx.measureText(this.title.text);
      const boxW = textMetrics.width + 50 * scale;
      const boxH = fontSize * 1.45;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(x - boxW / 2, y - boxH / 2, boxW, boxH, 20 * scale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2 * scale;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.title.text, x, y);

    } else {
      // Default Crisp
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = this.title.strokeColor;
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = this.title.textColor;
      ctx.fillText(this.title.text, x, y);
    }

    // Subtitle / Viral Hook
    if (this.title.showSubtitle && this.title.subtitle.trim().length > 0) {
      const subFontSize = fontSize * 0.38;
      const subY = y + fontSize * 0.78;
      ctx.font = `800 ${subFontSize}px '${this.title.fontFamily}', sans-serif`;

      // Subtitle pill
      const subMetrics = ctx.measureText(this.title.subtitle);
      const pW = subMetrics.width + 24 * scale;
      const pH = subFontSize * 1.5;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(x - pW / 2, subY - pH / 2, pW, pH, 8 * scale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();

      ctx.fillStyle = '#fde047'; // energetic yellow
      ctx.fillText(this.title.subtitle, x, subY);
    }

    // Creator Mode drag frame
    if (!cleanMode && this.creatorMode) {
      const metrics = ctx.measureText(this.title.text);
      const boxW = metrics.width + 40 * scale;
      const boxH = fontSize * (this.title.showSubtitle ? 2.3 : 1.4);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x - boxW / 2, y - fontSize * 0.7, boxW, boxH);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // --- Watermark Rendering ---
  renderWatermark(ctx, width, height, cleanMode) {
    const x = this.watermark.nx * width;
    const y = this.watermark.ny * height;
    const scale = width / 1080;
    const fontSize = this.watermark.fontSize * scale;

    ctx.save();
    ctx.globalAlpha = this.watermark.opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${fontSize}px 'Outfit', sans-serif`;

    // Subtle dark shadow for legibility on light backgrounds
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6 * scale;
    ctx.fillStyle = this.watermark.color;
    ctx.fillText(this.watermark.text, x, y);

    if (!cleanMode && this.creatorMode) {
      const metrics = ctx.measureText(this.watermark.text);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x - metrics.width / 2 - 8, y - fontSize / 2 - 4, metrics.width + 16, fontSize + 8);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // --- Countdown Timer Bar Rendering ---
  renderTimerBar(ctx, width, height, timeMs) {
    const progress = Math.max(0, Math.min(1, (timeMs / 1000) / this.videoDuration));
    const remainingRatio = 1 - progress; // shrinks over time
    const barH = this.timerBar.height * (width / 1080);

    ctx.save();
    // Background bar track
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, width, barH);

    // Active progress fill with gradient
    const grad = ctx.createLinearGradient(0, 0, width * remainingRatio, 0);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#6366f1');
    grad.addColorStop(1, '#f43f5e');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width * remainingRatio, barH);
    ctx.restore();
  }

  // --- Answer Reveal Rings ("Cheat Sheet" / End Clip) ---
  renderAnswerRevealRings(ctx, width, height, timeMs) {
    const pulse = 1 + Math.sin(timeMs * 0.008) * 0.15;

    ctx.save();
    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      const x = a.nx * width;
      const y = a.ny * height;
      const resScale = width / 1080;
      const radius = 60 * a.scale * resScale * pulse;

      // Pulsing neon target rings
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4 * resScale;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15 * resScale;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Center crosshair
      ctx.lineWidth = 2 * resScale;
      ctx.beginPath();
      ctx.moveTo(x - radius * 1.25, y);
      ctx.lineTo(x + radius * 1.25, y);
      ctx.moveTo(x, y - radius * 1.25);
      ctx.lineTo(x, y + radius * 1.25);
      ctx.stroke();

      // Number badge
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y - radius - 15 * resScale, 14 * resScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${14 * resScale}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${a.index}`, x, y - radius - 15 * resScale);
    }
    ctx.restore();
  }

  // =========================================================================
  // INTERACTIVE DRAG & DROP AND SELECTION HANDLERS
  // =========================================================================

  setupEventListeners() {
    window.addEventListener('resize', () => this.fitCanvasToScreen());

    // Pointer events on canvas
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));

    // Mouse wheel on canvas to zoom background
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      this.bg.zoom = Math.max(0.5, Math.min(3.0, this.bg.zoom + delta));
      document.getElementById('sliderBgZoom').value = Math.round(this.bg.zoom * 100);
      document.getElementById('bgZoomVal').textContent = `${Math.round(this.bg.zoom * 100)}%`;
    }, { passive: false });

    // Keyboard shortcuts (Spacebar for pan/play, Delete for remove, Arrows for nudge)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayback();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (this.selectedAnimalId) {
          e.preventDefault();
          this.deleteAnimal(this.selectedAnimalId);
        }
      } else if (e.code.startsWith('Arrow') && this.selectedAnimalId) {
        e.preventDefault();
        const a = this.animals.find(item => item.id === this.selectedAnimalId);
        if (!a) return;
        const step = e.shiftKey ? 0.02 : 0.005;
        if (e.code === 'ArrowLeft') a.nx = Math.max(0.02, a.nx - step);
        if (e.code === 'ArrowRight') a.nx = Math.min(0.98, a.nx + step);
        if (e.code === 'ArrowUp') a.ny = Math.max(0.02, a.ny - step);
        if (e.code === 'ArrowDown') a.ny = Math.min(0.98, a.ny + step);
      }
    });

    // Ratio selectors
    document.querySelectorAll('.ratio-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setAspectRatio(btn.dataset.ratio));
    });

    // Left Deck Tabs
    document.querySelectorAll('.deck-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.deck-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
      });
    });

    // Character Card Selector
    document.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', () => this.setCharacterType(card.dataset.char));
    });

    // Custom GIF Upload
    document.getElementById('customGifUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        this.showToast('Decoding animated GIF frames...', 'info');
        const customId = `custom_${Date.now()}`;
        const gifData = await window.gifEngine.loadFromFile(file, customId);
        this.loadedGifs.set(customId, gifData);
        this.setCharacterType(customId);
        this.showToast(`Loaded "${file.name}" (${gifData.frames.length} frames)!`, 'success');
      } catch (err) {
        console.error(err);
        this.showToast(`Error decoding GIF: ${err.message}`, 'error');
      }
    });

    // Quick Count Preset Chips
    document.querySelectorAll('.preset-chip[data-count]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip[data-count]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const count = parseInt(chip.dataset.count);
        this.generateAnimals(count, true);
      });
    });

    document.getElementById('inputAnimalCount').addEventListener('change', (e) => {
      const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 15));
      this.generateAnimals(val, true);
    });

    // Scatter & Randomize buttons
    document.getElementById('btnSmartScatter').addEventListener('click', () => {
      this.generateAnimals(this.animals.length, true);
      this.showToast('✨ Smart Depth Scatter applied!', 'success');
    });
    document.getElementById('btnRandomizeSizes').addEventListener('click', () => this.randomizeSizes());
    document.getElementById('btnReshufflePos').addEventListener('click', () => this.reshufflePositions());
    document.getElementById('btnStageReshuffle').addEventListener('click', () => this.reshufflePositions());
    document.getElementById('btnAddSingleAnimal').addEventListener('click', () => this.addSingleAnimal());

    // Background preset selection
    document.querySelectorAll('.bg-thumb-card').forEach(card => {
      card.addEventListener('click', () => {
        const bgId = card.dataset.bg;
        this.loadBackground(`assets/backgrounds/${bgId}.jpg`, bgId);
        this.showToast(`Backdrop changed to ${card.querySelector('.bg-label').textContent}`, 'info');
      });
    });

    // Custom Background Upload
    document.getElementById('customBgUpload').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        this.loadBackground(evt.target.result, 'custom_bg');
        this.showToast(`Custom background loaded!`, 'success');
      };
      reader.readAsDataURL(file);
    });

    // Background Zoom & Pan sliders
    document.getElementById('sliderBgZoom').addEventListener('input', (e) => {
      this.bg.zoom = parseInt(e.target.value) / 100;
      document.getElementById('bgZoomVal').textContent = `${e.target.value}%`;
    });
    document.getElementById('sliderBgPanX').addEventListener('input', (e) => {
      this.bg.panX = parseInt(e.target.value);
      document.getElementById('bgPanXVal').textContent = `${e.target.value}px`;
    });
    document.getElementById('sliderBgPanY').addEventListener('input', (e) => {
      this.bg.panY = parseInt(e.target.value);
      document.getElementById('bgPanYVal').textContent = `${e.target.value}px`;
    });
    document.getElementById('btnResetBgTransform').addEventListener('click', () => this.resetBackgroundTransform());

    // Lighting sliders
    document.getElementById('sliderBgBrightness').addEventListener('input', (e) => {
      this.bg.brightness = parseInt(e.target.value);
      document.getElementById('bgBrightnessVal').textContent = `${e.target.value}%`;
    });
    document.getElementById('sliderBgContrast').addEventListener('input', (e) => {
      this.bg.contrast = parseInt(e.target.value);
      document.getElementById('bgContrastVal').textContent = `${e.target.value}%`;
    });
    document.getElementById('sliderBgSaturation').addEventListener('input', (e) => {
      this.bg.saturation = parseInt(e.target.value);
      document.getElementById('bgSaturationVal').textContent = `${e.target.value}%`;
    });

    // Title Controls
    document.getElementById('inputTitleText').addEventListener('input', (e) => {
      this.title.text = e.target.value;
    });
    document.getElementById('checkAutoSyncCount').addEventListener('change', (e) => {
      this.title.autoSyncCount = e.target.checked;
      if (e.target.checked) this.updateTitleCount();
    });
    document.getElementById('inputSubtitleText').addEventListener('input', (e) => {
      this.title.subtitle = e.target.value;
    });
    document.getElementById('checkShowSubtitle').addEventListener('change', (e) => {
      this.title.showSubtitle = e.target.checked;
    });

    // Title Style Preset cards
    document.querySelectorAll('.title-style-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.title-style-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.title.style = card.dataset.style;
      });
    });

    document.getElementById('selectFontFamily').addEventListener('change', (e) => {
      this.title.fontFamily = e.target.value;
    });
    document.getElementById('sliderTitleSize').addEventListener('input', (e) => {
      this.title.fontSize = parseInt(e.target.value);
      document.getElementById('titleSizeVal').textContent = `${e.target.value}px`;
    });
    document.getElementById('inputTextColor').addEventListener('input', (e) => {
      this.title.textColor = e.target.value;
    });
    document.getElementById('inputStrokeColor').addEventListener('input', (e) => {
      this.title.strokeColor = e.target.value;
    });
    document.getElementById('sliderStrokeWidth').addEventListener('input', (e) => {
      this.title.strokeWidth = parseInt(e.target.value);
      document.getElementById('strokeWidthVal').textContent = `${e.target.value}px`;
    });

    // Audio Controls
    document.getElementById('selectPresetTrack').addEventListener('change', async (e) => {
      const track = e.target.value;
      this.showToast(`Synthesizing "${track}" music...`, 'info');
      await window.audioEngine.generatePresetBGM(track, 60);
      document.getElementById('currentTrackBadge').textContent = track.replace('_', ' ').toUpperCase();
      this.drawWaveform();
      this.showToast('Music updated!', 'success');
    });

    document.getElementById('customAudioUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        this.showToast(`Loading audio "${file.name}"...`, 'info');
        await window.audioEngine.loadFromFile(file);
        document.getElementById('currentTrackBadge').textContent = 'Custom Audio';
        this.drawWaveform();
        this.showToast(`Loaded ${file.name}!`, 'success');
      } catch (err) {
        this.showToast(`Audio load error: ${err.message}`, 'error');
      }
    });

    document.getElementById('sliderTrimStart').addEventListener('input', (e) => {
      window.audioEngine.trimStart = parseFloat(e.target.value);
      document.getElementById('trimStartVal').textContent = `${parseFloat(e.target.value).toFixed(1)}s`;
      this.drawWaveform();
    });
    document.getElementById('sliderTrimEnd').addEventListener('input', (e) => {
      window.audioEngine.trimEnd = parseFloat(e.target.value);
      document.getElementById('trimEndVal').textContent = `${parseFloat(e.target.value).toFixed(1)}s`;
      this.drawWaveform();
    });
    document.getElementById('sliderAudioVolume').addEventListener('input', (e) => {
      const vol = parseInt(e.target.value);
      window.audioEngine.setVolume(vol / 100);
      document.getElementById('audioVolumeVal').textContent = `${vol}%`;
    });
    document.getElementById('checkFadeIn').addEventListener('change', (e) => {
      window.audioEngine.fadeIn = e.target.checked;
    });
    document.getElementById('checkFadeOut').addEventListener('change', (e) => {
      window.audioEngine.fadeOut = e.target.checked;
    });
    document.getElementById('btnAudioPreviewToggle').addEventListener('click', () => {
      if (window.audioEngine.isPlaying) {
        window.audioEngine.stop();
        document.getElementById('btnAudioPreviewToggle').innerHTML = '<i class="fa-solid fa-play"></i> Preview Audio Track';
      } else {
        window.audioEngine.play(0);
        document.getElementById('btnAudioPreviewToggle').innerHTML = '<i class="fa-solid fa-stop"></i> Stop Audio';
      }
    });

    // Watermark Controls
    document.getElementById('checkWatermarkEnable').addEventListener('change', (e) => {
      this.watermark.enabled = e.target.checked;
    });
    document.getElementById('inputWatermarkText').addEventListener('input', (e) => {
      this.watermark.text = e.target.value;
    });
    document.querySelectorAll('.preset-chip[data-snap]').forEach(chip => {
      chip.addEventListener('click', () => {
        const snap = chip.dataset.snap;
        if (snap === 'bottom_center') { this.watermark.nx = 0.5; this.watermark.ny = 0.965; }
        else if (snap === 'bottom_right') { this.watermark.nx = 0.85; this.watermark.ny = 0.965; }
        else if (snap === 'top_right') { this.watermark.nx = 0.85; this.watermark.ny = 0.04; }
        else if (snap === 'top_left') { this.watermark.nx = 0.15; this.watermark.ny = 0.04; }
      });
    });
    document.getElementById('sliderWatermarkOpacity').addEventListener('input', (e) => {
      this.watermark.opacity = parseInt(e.target.value) / 100;
      document.getElementById('watermarkOpacityVal').textContent = `${e.target.value}%`;
    });
    document.getElementById('sliderWatermarkSize').addEventListener('input', (e) => {
      this.watermark.fontSize = parseInt(e.target.value);
      document.getElementById('watermarkSizeVal').textContent = `${e.target.value}px`;
    });

    // Timer Bar
    document.getElementById('checkTimerBarEnable').addEventListener('change', (e) => {
      this.timerBar.enabled = e.target.checked;
    });

    // Duration buttons
    document.querySelectorAll('.preset-chip[data-dur]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip[data-dur]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.videoDuration = parseInt(chip.dataset.dur);
        document.getElementById('inputCustomDuration').value = this.videoDuration;
        document.getElementById('stageTimeScrubber').max = this.videoDuration;
        this.updatePlayheadUI();
      });
    });
    document.getElementById('inputCustomDuration').addEventListener('change', (e) => {
      const val = Math.max(3, Math.min(180, parseInt(e.target.value) || 15));
      this.videoDuration = val;
      document.getElementById('stageTimeScrubber').max = val;
      this.updatePlayheadUI();
    });

    // Export Resolution & Bitrate
    document.getElementById('selectResolution').addEventListener('change', (e) => {
      this.resolutionPreset = e.target.value;
    });
    document.getElementById('selectFps').addEventListener('change', (e) => {
      this.fps = parseInt(e.target.value);
    });
    document.getElementById('selectBitrate').addEventListener('change', (e) => {
      this.bitrate = parseInt(e.target.value) * 1000000;
    });
    document.getElementById('checkAppendReveal').addEventListener('change', (e) => {
      this.appendRevealEnding = e.target.checked;
    });

    // Playback Controls
    const togglePlay = () => this.togglePlayback();
    document.getElementById('btnToolbarPlay').addEventListener('click', togglePlay);
    document.getElementById('btnDeckPlay').addEventListener('click', togglePlay);
    document.getElementById('btnResetPlayhead').addEventListener('click', () => {
      this.currentTime = 0;
      if (this.isPlaying) window.audioEngine.play(0);
      this.updatePlayheadUI();
    });

    document.getElementById('stageTimeScrubber').addEventListener('input', (e) => {
      this.currentTime = parseFloat(e.target.value);
      if (this.isPlaying) window.audioEngine.play(this.currentTime);
      this.updatePlayheadUI();
    });

    // Creator / Clean Audience View toggle
    document.getElementById('btnToggleMode').addEventListener('click', () => {
      this.creatorMode = !this.creatorMode;
      const label = document.getElementById('modeLabel');
      label.textContent = this.creatorMode ? 'Creator View' : 'Audience View';
      document.getElementById('btnToggleMode').classList.toggle('btn-primary', !this.creatorMode);
      this.showToast(`Switched to ${this.creatorMode ? 'Creator View (with handles)' : 'Clean Audience View'}`, 'info');
    });

    // Answer Reveal / Cheat Sheet toggle
    const toggleReveal = () => {
      this.answerRevealMode = !this.answerRevealMode;
      document.getElementById('revealBtnText').textContent = this.answerRevealMode ? 'Hide Answer Rings' : 'Show Answer Rings';
      document.getElementById('btnStageRevealToggle').classList.toggle('btn-primary', this.answerRevealMode);
      document.getElementById('btnToggleAnswerReveal').classList.toggle('btn-primary', this.answerRevealMode);
    };
    document.getElementById('btnToggleAnswerReveal').addEventListener('click', toggleReveal);
    document.getElementById('btnStageRevealToggle').addEventListener('click', toggleReveal);

    // Save Answer Key PNG
    document.getElementById('btnExportAnswerKeyPng').addEventListener('click', () => {
      const prevReveal = this.answerRevealMode;
      this.answerRevealMode = true;
      this.drawFrame(this.ctx, this.canvasWidth, this.canvasHeight, this.currentTime * 1000, true);
      const url = this.canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `answer-key-${this.animals.length}-animals.png`;
      a.click();
      this.answerRevealMode = prevReveal;
      this.showToast('Saved Answer Key PNG!', 'success');
    });

    // Save Frame as HD Thumbnail
    document.getElementById('btnExportThumbnail').addEventListener('click', () => {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = this.canvasWidth;
      offCanvas.height = this.canvasHeight;
      const offCtx = offCanvas.getContext('2d');
      this.drawFrame(offCtx, this.canvasWidth, this.canvasHeight, this.currentTime * 1000, true);
      const url = offCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnail-${this.aspectRatio.replace(':', '-')}.png`;
      a.click();
      this.showToast('Saved HD Thumbnail PNG!', 'success');
    });

    // Zoom Fit button
    document.getElementById('btnZoomFit').addEventListener('click', () => this.fitCanvasToScreen());

    // Highlight All Animals
    document.getElementById('btnPingAllAnimals').addEventListener('click', () => {
      const prev = this.answerRevealMode;
      this.answerRevealMode = true;
      setTimeout(() => { this.answerRevealMode = prev; }, 2200);
      this.showToast('🎯 Highlighting all animal positions!', 'info');
    });

    // Selected Animal Inspector Controls
    document.getElementById('sliderInspectScale').addEventListener('input', (e) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.scale = parseInt(e.target.value) / 100;
      document.getElementById('inspectScaleVal').textContent = `${e.target.value}%`;
    });
    document.getElementById('sliderInspectRot').addEventListener('input', (e) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.rotation = parseInt(e.target.value);
      document.getElementById('inspectRotVal').textContent = `${e.target.value}°`;
    });
    document.getElementById('btnInspectFlipX').addEventListener('click', () => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.flipX = !a.flipX;
    });
    document.getElementById('btnInspectDuplicate').addEventListener('click', () => {
      if (this.selectedAnimalId) this.duplicateAnimal(this.selectedAnimalId);
    });
    document.getElementById('btnInspectDelete').addEventListener('click', () => {
      if (this.selectedAnimalId) this.deleteAnimal(this.selectedAnimalId);
    });
    document.getElementById('btnInspectBringFront').addEventListener('click', () => {
      const idx = this.animals.findIndex(item => item.id === this.selectedAnimalId);
      if (idx !== -1 && idx < this.animals.length - 1) {
        const item = this.animals.splice(idx, 1)[0];
        this.animals.push(item);
        this.renderLayerList();
      }
    });
    document.getElementById('btnInspectSendBack').addEventListener('click', () => {
      const idx = this.animals.findIndex(item => item.id === this.selectedAnimalId);
      if (idx > 0) {
        const item = this.animals.splice(idx, 1)[0];
        this.animals.unshift(item);
        this.renderLayerList();
      }
    });

    // Project Save / Load
    document.getElementById('btnSaveProjectJson').addEventListener('click', () => this.saveProjectJson());
    document.getElementById('inputLoadProject').addEventListener('change', (e) => this.loadProjectJson(e.target.files[0]));

    // Export Modal Triggers
    document.getElementById('btnOpenExportModal').addEventListener('click', () => {
      document.querySelectorAll('.deck-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelector('.deck-tab-btn[data-tab="tab-export"]').classList.add('active');
      document.getElementById('tab-export').classList.add('active');
    });

    document.getElementById('btnStartExport').addEventListener('click', () => this.startVideoExport());
    document.getElementById('btnCancelExport').addEventListener('click', () => this.cancelVideoExport());
    document.getElementById('btnCloseExportModal').addEventListener('click', () => {
      document.getElementById('exportModal').classList.remove('active');
    });
  }

  // --- Pointer Down (Hit Detection for Dragging & Handles) ---
  onPointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvasWidth / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const clientX = (e.clientX - rect.left) * scaleX;
    const clientY = (e.clientY - rect.top) * scaleY;

    this.interaction.startX = clientX;
    this.interaction.startY = clientY;

    // Check Spacebar + Drag -> Background Pan
    if (e.spaceKey || this.interaction.spaceDown || e.button === 1) {
      this.interaction.isDragging = true;
      this.interaction.dragTarget = 'bg-pan';
      this.interaction.origItemX = this.bg.panX;
      this.interaction.origItemY = this.bg.panY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    // 1. If an animal is selected, check its Transform Handles
    if (this.selectedAnimalId) {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (a) {
        const ax = a.nx * this.canvasWidth;
        const ay = a.ny * this.canvasHeight;
        const gifData = this.loadedGifs.get(a.charId);
        const resScale = this.canvasWidth / 1080;
        const drawW = (gifData ? gifData.width : 100) * 0.9 * resScale * a.scale;
        const drawH = (gifData ? gifData.height : 100) * 0.9 * resScale * a.scale;

        // Resize corner handle (bottom-right)
        const cornerX = ax + drawW / 2 + 4;
        const cornerY = ay + drawH / 2 + 4;
        if (Math.hypot(clientX - cornerX, clientY - cornerY) < 22 * resScale) {
          this.interaction.isDragging = true;
          this.interaction.dragTarget = 'handle-resize';
          this.interaction.targetId = a.id;
          this.interaction.origScale = a.scale;
          return;
        }

        // Rotate handle (top-center)
        const rotX = ax;
        const rotY = ay - drawH / 2 - 22;
        if (Math.hypot(clientX - rotX, clientY - rotY) < 22 * resScale) {
          this.interaction.isDragging = true;
          this.interaction.dragTarget = 'handle-rot';
          this.interaction.targetId = a.id;
          this.interaction.origRot = a.rotation;
          return;
        }
      }
    }

    // 2. Check Animal hits (from top to bottom)
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const ax = a.nx * this.canvasWidth;
      const ay = a.ny * this.canvasHeight;
      const gifData = this.loadedGifs.get(a.charId);
      const resScale = this.canvasWidth / 1080;
      const drawW = (gifData ? gifData.width : 100) * 0.9 * resScale * a.scale;
      const drawH = (gifData ? gifData.height : 100) * 0.9 * resScale * a.scale;

      if (Math.abs(clientX - ax) < drawW / 2 && Math.abs(clientY - ay) < drawH / 2) {
        this.selectedAnimalId = a.id;
        this.interaction.isDragging = true;
        this.interaction.dragTarget = 'animal';
        this.interaction.targetId = a.id;
        this.interaction.origItemX = a.nx;
        this.interaction.origItemY = a.ny;

        this.updateInspectorUI(a);
        this.renderLayerList();
        return;
      }
    }

    // 3. Check Title hit
    const tx = this.title.nx * this.canvasWidth;
    const ty = this.title.ny * this.canvasHeight;
    const titleH = this.title.fontSize * (this.canvasWidth / 1080) * 2;
    if (Math.abs(clientX - tx) < 350 * (this.canvasWidth / 1080) && Math.abs(clientY - ty) < titleH / 2) {
      this.interaction.isDragging = true;
      this.interaction.dragTarget = 'title';
      this.interaction.origItemX = this.title.nx;
      this.interaction.origItemY = this.title.ny;
      return;
    }

    // 4. Check Watermark hit
    if (this.watermark.enabled) {
      const wx = this.watermark.nx * this.canvasWidth;
      const wy = this.watermark.ny * this.canvasHeight;
      if (Math.abs(clientX - wx) < 180 * (this.canvasWidth / 1080) && Math.abs(clientY - wy) < 30) {
        this.interaction.isDragging = true;
        this.interaction.dragTarget = 'watermark';
        this.interaction.origItemX = this.watermark.nx;
        this.interaction.origItemY = this.watermark.ny;
        return;
      }
    }

    // If nothing hit, deselect
    this.selectedAnimalId = null;
    this.renderLayerList();
  }

  onPointerMove(e) {
    if (!this.interaction.isDragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvasWidth / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const clientX = (e.clientX - rect.left) * scaleX;
    const clientY = (e.clientY - rect.top) * scaleY;

    const dx = clientX - this.interaction.startX;
    const dy = clientY - this.interaction.startY;

    if (this.interaction.dragTarget === 'animal') {
      const a = this.animals.find(item => item.id === this.interaction.targetId);
      if (!a) return;
      a.nx = Math.max(0.02, Math.min(0.98, this.interaction.origItemX + dx / this.canvasWidth));
      a.ny = Math.max(0.02, Math.min(0.98, this.interaction.origItemY + dy / this.canvasHeight));

    } else if (this.interaction.dragTarget === 'title') {
      this.title.nx = Math.max(0.05, Math.min(0.95, this.interaction.origItemX + dx / this.canvasWidth));
      this.title.ny = Math.max(0.05, Math.min(0.95, this.interaction.origItemY + dy / this.canvasHeight));

    } else if (this.interaction.dragTarget === 'watermark') {
      this.watermark.nx = Math.max(0.05, Math.min(0.95, this.interaction.origItemX + dx / this.canvasWidth));
      this.watermark.ny = Math.max(0.05, Math.min(0.95, this.interaction.origItemY + dy / this.canvasHeight));

    } else if (this.interaction.dragTarget === 'handle-resize') {
      const a = this.animals.find(item => item.id === this.interaction.targetId);
      if (!a) return;
      const factor = 1 + (dx + dy) / 200;
      a.scale = Math.max(0.2, Math.min(3.0, parseFloat((this.interaction.origScale * factor).toFixed(2))));
      document.getElementById('sliderInspectScale').value = Math.round(a.scale * 100);
      document.getElementById('inspectScaleVal').textContent = `${Math.round(a.scale * 100)}%`;

    } else if (this.interaction.dragTarget === 'handle-rot') {
      const a = this.animals.find(item => item.id === this.interaction.targetId);
      if (!a) return;
      const ax = a.nx * this.canvasWidth;
      const ay = a.ny * this.canvasHeight;
      const angle = Math.atan2(clientY - ay, clientX - ax) * (180 / Math.PI) + 90;
      a.rotation = Math.round(angle % 360);
      document.getElementById('sliderInspectRot').value = a.rotation;
      document.getElementById('inspectRotVal').textContent = `${a.rotation}°`;

    } else if (this.interaction.dragTarget === 'bg-pan') {
      this.bg.panX = Math.round(this.interaction.origItemX + dx);
      this.bg.panY = Math.round(this.interaction.origItemY + dy);
      document.getElementById('sliderBgPanX').value = this.bg.panX;
      document.getElementById('bgPanXVal').textContent = `${this.bg.panX}px`;
      document.getElementById('sliderBgPanY').value = this.bg.panY;
      document.getElementById('bgPanYVal').textContent = `${this.bg.panY}px`;
    }
  }

  onPointerUp() {
    this.interaction.isDragging = false;
    this.interaction.dragTarget = null;
    this.canvas.style.cursor = 'default';
  }

  // =========================================================================
  // PLAYBACK & AUDIO SYNC
  // =========================================================================

  togglePlayback() {
    this.isPlaying = !this.isPlaying;
    const playIcon = this.isPlaying ? 'pause' : 'play';
    const playText = this.isPlaying ? 'Pause' : 'Play';

    document.getElementById('btnToolbarPlay').innerHTML = `<i class="fa-solid fa-${playIcon}"></i> ${playText}`;
    document.getElementById('btnDeckPlay').innerHTML = `<i class="fa-solid fa-${playIcon}"></i>`;

    if (this.isPlaying) {
      window.audioEngine.play(this.currentTime);
    } else {
      window.audioEngine.stop();
    }
  }

  updatePlayheadUI() {
    document.getElementById('stageTimeScrubber').value = this.currentTime;
    const curMin = String(Math.floor(this.currentTime / 60)).padStart(2, '0');
    const curSec = String(Math.floor(this.currentTime % 60)).padStart(2, '0');
    const totMin = String(Math.floor(this.videoDuration / 60)).padStart(2, '0');
    const totSec = String(Math.floor(this.videoDuration % 60)).padStart(2, '0');
    document.getElementById('stageTimeReadout').textContent = `${curMin}:${curSec} / ${totMin}:${totSec}`;
  }

  drawWaveform() {
    const data = window.audioEngine.waveformData;
    const w = this.waveformCanvas.width;
    const h = this.waveformCanvas.height;
    const ctx = this.waveformCtx;

    ctx.clearRect(0, 0, w, h);
    if (!data || data.length === 0) return;

    // Draw trim boundaries
    const trimStartRatio = window.audioEngine.trimStart / Math.max(1, window.audioEngine.duration);
    const trimEndRatio = window.audioEngine.trimEnd / Math.max(1, window.audioEngine.duration);

    // Active trim box highlight
    ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
    ctx.fillRect(w * trimStartRatio, 0, w * (trimEndRatio - trimStartRatio), h);

    const barW = w / data.length;
    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      const barH = val * (h - 8);
      const isInsideTrim = (i / data.length) >= trimStartRatio && (i / data.length) <= trimEndRatio;

      ctx.fillStyle = isInsideTrim ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(i * barW, (h - barH) / 2, barW - 1, barH);
    }
  }

  // =========================================================================
  // LAYER DOCK & INSPECTOR UI
  // =========================================================================

  renderLayerList() {
    const container = document.getElementById('layerListScroller');
    container.innerHTML = '';

    // Render layers reversed so top layer is on top of list
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const isSelected = a.id === this.selectedAnimalId;

      const card = document.createElement('div');
      card.className = `layer-item-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="layer-info">
          <span class="layer-badge">${a.index}</span>
          <span class="layer-name">${a.charId === 'shuba_duck' ? 'Duck' : (a.charId === 'dancing_cat' ? 'Cat' : 'Animal')} #${a.index}</span>
        </div>
        <div class="layer-actions">
          <button class="btn btn-secondary btn-sm" title="Locate on canvas" onclick="studio.locateAnimal('${a.id}')">
            <i class="fa-solid fa-crosshairs"></i>
          </button>
          <button class="btn btn-secondary btn-sm" style="color:var(--accent-rose);" title="Delete" onclick="studio.deleteAnimal('${a.id}')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        this.selectedAnimalId = a.id;
        this.updateInspectorUI(a);
        this.renderLayerList();
      });
      container.appendChild(card);
    }
  }

  updateInspectorUI(animal) {
    if (!animal) return;
    document.getElementById('inspectAnimalTitle').textContent = `Selected: Animal #${animal.index}`;
    document.getElementById('sliderInspectScale').value = Math.round(animal.scale * 100);
    document.getElementById('inspectScaleVal').textContent = `${Math.round(animal.scale * 100)}%`;
    document.getElementById('sliderInspectRot').value = animal.rotation;
    document.getElementById('inspectRotVal').textContent = `${animal.rotation}°`;
  }

  locateAnimal(id) {
    this.selectedAnimalId = id;
    const a = this.animals.find(item => item.id === id);
    if (a) this.updateInspectorUI(a);
    this.renderLayerList();

    // Pulse answer reveal ring for this animal
    this.showToast(`Selected Animal #${a ? a.index : ''}`, 'info');
  }

  updateBadges() {
    document.getElementById('totalAnimalLayerCount').textContent = this.animals.length;
  }

  // =========================================================================
  // VIDEO EXPORT ENGINE (HIGH-DEFINITION MediaRecorder + Audio Stream)
  // =========================================================================

  async startVideoExport() {
    if (this.isExporting) return;

    this.isExporting = true;
    this.togglePlayback(); // ensure paused

    // Setup Export Modal
    const modal = document.getElementById('exportModal');
    modal.classList.add('active');
    document.getElementById('exportModalActions').style.display = 'none';
    document.getElementById('btnCancelExport').style.display = 'block';

    const bar = document.getElementById('exportProgressBar');
    const pct = document.getElementById('exportProgressPct');
    const framesLabel = document.getElementById('exportProgressFrames');
    const etaLabel = document.getElementById('exportEta');

    // Resolution calculation
    let exportW = 1080;
    let exportH = 1920;
    if (this.resolutionPreset === '720p') {
      exportW = this.aspectRatio === '9:16' ? 720 : (this.aspectRatio === '16:9' ? 1280 : 720);
      exportH = this.aspectRatio === '9:16' ? 1280 : (this.aspectRatio === '16:9' ? 720 : 720);
    } else if (this.resolutionPreset === '1080p') {
      exportW = this.aspectRatio === '9:16' ? 1080 : (this.aspectRatio === '16:9' ? 1920 : 1080);
      exportH = this.aspectRatio === '9:16' ? 1920 : (this.aspectRatio === '16:9' ? 1080 : 1080);
    } else if (this.resolutionPreset === '2k') {
      exportW = this.aspectRatio === '9:16' ? 1440 : (this.aspectRatio === '16:9' ? 2560 : 1440);
      exportH = this.aspectRatio === '9:16' ? 2560 : (this.aspectRatio === '16:9' ? 1440 : 1440);
    } else if (this.resolutionPreset === '4k') {
      exportW = this.aspectRatio === '9:16' ? 2160 : (this.aspectRatio === '16:9' ? 3840 : 2160);
      exportH = this.aspectRatio === '9:16' ? 3840 : (this.aspectRatio === '16:9' ? 2160 : 2160);
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const exportCtx = exportCanvas.getContext('2d');

    const totalSeconds = this.videoDuration + (this.appendRevealEnding ? 3 : 0);
    const totalFrames = Math.floor(totalSeconds * this.fps);
    const frameIntervalMs = 1000 / this.fps;

    // MediaRecorder setup
    const stream = exportCanvas.captureStream(this.fps);
    const audioTrack = window.audioEngine.getAudioTrack();
    if (audioTrack) {
      stream.addTrack(audioTrack);
    }

    // Determine supported mime type
    let mimeType = 'video/webm;codecs=vp9,opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }

    this.exportChunks = [];
    try {
      this.exportMediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: this.bitrate
      });
    } catch (e) {
      this.exportMediaRecorder = new MediaRecorder(stream);
    }

    this.exportMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.exportChunks.push(e.data);
      }
    };

    this.exportMediaRecorder.onstop = () => {
      const blob = new Blob(this.exportChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const downloadBtn = document.getElementById('btnDownloadExportedVideo');
      downloadBtn.href = url;
      downloadBtn.download = `find-${this.animals.length}-animals_${this.resolutionPreset}_SmartBrain.webm`;

      document.getElementById('exportModalActions').style.display = 'flex';
      document.getElementById('btnCancelExport').style.display = 'none';
      this.isExporting = false;
      this.showToast('🎉 Video Render Completed!', 'success');
    };

    this.exportMediaRecorder.start();
    window.audioEngine.play(0); // Synchronize audio playback during recording

    this.exportStartTime = performance.now();

    // Frame-by-frame rendering loop synchronized in real-time
    let currentFrame = 0;
    const renderNextFrame = () => {
      if (!this.isExporting) return;

      const timeMs = currentFrame * frameIntervalMs;
      const isRevealSection = this.appendRevealEnding && (timeMs >= this.videoDuration * 1000);

      // Temporarily toggle answer reveal for ending if requested
      const prevReveal = this.answerRevealMode;
      if (isRevealSection) this.answerRevealMode = true;

      // Draw clean video frame
      this.drawFrame(exportCtx, exportW, exportH, timeMs, true);

      this.answerRevealMode = prevReveal;

      currentFrame++;
      const progress = currentFrame / totalFrames;
      bar.style.width = `${Math.round(progress * 100)}%`;
      pct.textContent = `${Math.round(progress * 100)}%`;
      framesLabel.textContent = `Frame ${currentFrame} / ${totalFrames}`;

      const elapsed = (performance.now() - this.exportStartTime) / 1000;
      const eta = progress > 0 ? Math.max(0, Math.round((elapsed / progress) - elapsed)) : 0;
      etaLabel.textContent = `ETA: ${eta}s`;

      if (currentFrame < totalFrames) {
        setTimeout(renderNextFrame, frameIntervalMs * 0.8);
      } else {
        window.audioEngine.stop();
        this.exportMediaRecorder.stop();
      }
    };

    renderNextFrame();
  }

  cancelVideoExport() {
    this.isExporting = false;
    if (this.exportMediaRecorder && this.exportMediaRecorder.state !== 'inactive') {
      this.exportMediaRecorder.stop();
    }
    window.audioEngine.stop();
    document.getElementById('exportModal').classList.remove('active');
    this.showToast('Export cancelled', 'info');
  }

  // =========================================================================
  // PROJECT PRESET JSON (SAVE & LOAD)
  // =========================================================================

  saveProjectJson() {
    const data = {
      version: 1,
      aspectRatio: this.aspectRatio,
      duration: this.videoDuration,
      bg: {
        presetId: this.bg.presetId,
        zoom: this.bg.zoom,
        panX: this.bg.panX,
        panY: this.bg.panY,
        brightness: this.bg.brightness,
        contrast: this.bg.contrast,
        saturation: this.bg.saturation
      },
      activeCharType: this.activeCharType,
      animals: this.animals,
      title: this.title,
      watermark: this.watermark,
      timerBar: this.timerBar
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project_find_${this.animals.length}_animals.json`;
    a.click();
    this.showToast('Saved Project Preset JSON!', 'success');
  }

  loadProjectJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.aspectRatio) this.setAspectRatio(data.aspectRatio);
        if (data.duration) this.videoDuration = data.duration;
        if (data.animals) this.animals = data.animals;
        if (data.title) Object.assign(this.title, data.title);
        if (data.watermark) Object.assign(this.watermark, data.watermark);
        if (data.bg) Object.assign(this.bg, data.bg);
        if (data.activeCharType) this.setCharacterType(data.activeCharType);

        this.updateTitleCount();
        this.renderLayerList();
        this.showToast('Project loaded successfully!', 'success');
      } catch (err) {
        this.showToast(`Error parsing JSON: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'circle-exclamation';

    toast.innerHTML = `<i class="fa-solid fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.studio = new AnimalDanceStudio();
});
