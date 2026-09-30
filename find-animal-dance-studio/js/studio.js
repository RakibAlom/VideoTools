/**
 * Animal Dance Studio - Master Interactive Engine (v2.0)
 * Includes:
 * 1. EBML-patched flawless video recording without freeze/stutter
 * 2. 6 Instant Demo Templates
 * 3. 15+ transparent characters (5 ducks, 5 cats, 5 others + custom uploads)
 * 4. GIF Chroma-Key Background Remover tool
 * 5. 6 Copyright-free synthesized sound tracks + WAV exporter
 * 6. IndexedDB persistent upload storage
 * 7. Unrestricted watermark positioning (0-100% X & Y)
 * 8. Viewport Zoom Controller (Fit, 50%, 100%, 150%, 200%, 300%)
 * 9. Multiple Countdown Timer styles (Top, Bottom, Digital, Radial Ring, None)
 * 10. Direct numeric inputs for scale, rotation, positions, and font size (5-500px)
 * 11. Undo / Redo History Stack (Ctrl+Z, Ctrl+Y)
 * 12. Fixed Highlight All toggle & centered Add +1 Animal
 */

class AnimalDanceStudio {
  constructor() {
    this.canvas = document.getElementById('masterCanvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.stageWrapper = document.getElementById('stageWrapper');
    this.stageMainContainer = document.getElementById('stageMainContainer');

    // Canvas & Aspect Ratio
    this.aspectRatio = '9:16';
    this.canvasWidth = 1080;
    this.canvasHeight = 1920;
    this.resolutionPreset = '1080p';

    // Viewport Zoom
    this.viewportZoom = 1.0; // 1.0 = fit

    // Video Properties
    this.videoDuration = 15; // seconds
    this.fps = 30;
    this.bitrate = 16000000; // 16 Mbps
    this.exportFormat = 'mp4'; // 'mp4' (universal default) or 'webm'
    this.currentTime = 0;
    this.isPlaying = false;
    this.lastFrameTime = 0;

    // View Modes
    this.creatorMode = true;
    this.answerRevealMode = false;
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

    // Characters & Animals
    this.activeCharType = 'shuba_duck';
    this.loadedGifs = new Map();
    this.animals = [];
    this.animalCount = 15;
    this.selectedAnimalId = null;

    // Title & Subtitle
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
      subtitleFontSize: 28,
      subtitleColor: '#fde047',
      subtitlePillColor: '#000000',
      showSubtitlePill: true,
      gap: 40 // Title to subtitle spacing margin (0-250px)
    };

    // Watermark (Unrestricted 0-100%)
    this.watermark = {
      enabled: true,
      text: 'SmartBrain Game',
      nx: 0.5,
      ny: 0.97, // right against bottom edge
      opacity: 0.65,
      fontSize: 24,
      color: '#ffffff'
    };

    // Countdown Timer
    this.timer = {
      enabled: true,
      style: 'top_bar', // 'top_bar', 'bottom_bar', 'digital_badge', 'radial_ring', 'none'
      height: 8,
      color: '#38bdf8'
    };

    // History (Undo / Redo)
    this.historyStack = [];
    this.redoStack = [];
    this.isApplyingHistory = false;

    // Dragging & Interaction
    this.interaction = {
      isDragging: false,
      dragTarget: null,
      targetId: null,
      startX: 0,
      startY: 0,
      origItemX: 0,
      origItemY: 0,
      origScale: 1,
      origRot: 0,
      spaceDown: false
    };

    // Waveform & Chroma
    this.waveformCanvas = document.getElementById('waveformCanvas');
    this.waveformCtx = this.waveformCanvas.getContext('2d');
    this.waveformDragTarget = null;
    this.waveformDragOffsetX = 0;
    this.waveformDragLength = 15;
    this.chromaCanvas = document.getElementById('chromaPreviewCanvas');
    this.chromaCtx = this.chromaCanvas.getContext('2d');
    this.activeChromaGif = null;

    // Export State
    this.isExporting = false;
    this.exportMediaRecorder = null;
    this.exportChunks = [];
    this.exportStartTime = 0;

    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setAspectRatio('9:16');
    this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');

    // Populate initial 15 ducks immediately on frame 1
    this.generateAnimals(15, true);
    this.pushHistoryState('Initial setup');

    // Start 60fps render loop immediately
    requestAnimationFrame(this.renderLoop.bind(this));

    // Preload built-in characters in background
    this.preloadBuiltinCharacters();

    // Initialize IndexedDB in background
    if (window.storageManager) {
      window.storageManager.init().then(() => {
        this.refreshSavedUploadsUI();
      });
    }

    // Generate initial Quack Hop BGM (20s for sub-second startup)
    window.audioEngine.generatePresetBGM('quack_hop', 20).then(() => {
      this.drawWaveform();
    });

    this.showToast('🦆 Animal Dance Studio 2.0 Ready!', 'success');
  }

  // =========================================================================
  // PRELOAD CHARACTERS
  // =========================================================================

  async preloadBuiltinCharacters() {
    const chars = [
      { id: 'shuba_duck', url: 'assets/animals/shuba_duck.gif' },
      { id: 'duck_dance', url: 'assets/animals/duck_dance.gif' },
      { id: 'dog_happy', url: 'assets/animals/dog_happy.gif' },
      { id: 'dog_dance', url: 'assets/animals/dog_dance.gif' },
      { id: 'cat_salsa', url: 'assets/animals/cat_salsa.gif' },
      { id: 'cat_popcat', url: 'assets/animals/cat_popcat.gif' },
      { id: 'frog_dance', url: 'assets/animals/frog_dance.gif' }
    ];

    for (const c of chars) {
      this.loadCharacterGif(c.id, c.url);
    }
  }

  async loadCharacterGif(charId, url) {
    try {
      const gifData = await window.gifEngine.loadFromUrl(url, charId);
      this.loadedGifs.set(charId, gifData);
      return gifData;
    } catch (err) {
      console.warn(`Could not load character GIF ${charId}:`, err);
    }
  }

  setCharacterType(charId, charDisplayName = null) {
    this.activeCharType = charId;
    const badge = document.getElementById('charBadge');

    let name = charDisplayName;
    if (!name) {
      if (charId.includes('duck')) name = 'Duck';
      else if (charId.includes('cat')) name = 'Cat';
      else if (charId.includes('capybara')) name = 'Capybara';
      else if (charId.includes('dog')) name = 'Dog';
      else if (charId.includes('penguin')) name = 'Penguin';
      else if (charId.includes('rabbit')) name = 'Rabbit';
      else if (charId.includes('hamster')) name = 'Hamster';
      else name = 'Animal';
    }
    badge.textContent = name;

    if (this.title.autoSyncCount) {
      const plural = name.endsWith('s') ? name : `${name}s`;
      this.title.text = `Find ${this.animals.length} ${plural}`;
      document.getElementById('inputTitleText').value = this.title.text;
    }

    // Update active highlight across cards
    document.querySelectorAll('.char-card').forEach(card => {
      card.classList.toggle('active', card.dataset.char === charId);
    });

    // Update existing animals to new character
    this.animals.forEach(a => a.charId = charId);
    this.renderLayerList();
    this.pushHistoryState(`Changed character to ${name}`);
  }

  // =========================================================================
  // BACKGROUND LOADING
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

    document.querySelectorAll('.bg-thumb-card').forEach(card => {
      card.classList.toggle('active', card.dataset.bg === presetId);
    });
  }

  resetBackgroundTransform() {
    this.bg.zoom = 1.0;
    this.bg.panX = 0;
    this.bg.panY = 0;
    document.getElementById('sliderBgZoom').value = 100;
    document.getElementById('inputBgZoom').value = 100;
    document.getElementById('bgZoomVal').textContent = '100%';
    document.getElementById('sliderBgPanX').value = 0;
    document.getElementById('inputBgPanX').value = 0;
    document.getElementById('bgPanXVal').textContent = '0px';
    document.getElementById('sliderBgPanY').value = 0;
    document.getElementById('inputBgPanY').value = 0;
    document.getElementById('bgPanYVal').textContent = '0px';
  }

  // =========================================================================
  // MULTI-ANIMAL SMART DEPTH SCATTER
  // =========================================================================

  generateAnimals(count, smartDepth = true) {
    this.animalCount = count;
    this.animals = [];

    for (let i = 0; i < count; i++) {
      let nx, ny, scale;
      if (smartDepth) {
        const tier = Math.random();
        if (tier < 0.25) {
          // Foreground
          nx = 0.12 + Math.random() * 0.76;
          ny = 0.65 + Math.random() * 0.24;
          scale = 1.25 + Math.random() * 0.55;
        } else if (tier < 0.65) {
          // Midground
          nx = 0.10 + Math.random() * 0.80;
          ny = 0.38 + Math.random() * 0.26;
          scale = 0.70 + Math.random() * 0.35;
        } else {
          // Background (Hidden)
          nx = 0.12 + Math.random() * 0.76;
          ny = 0.20 + Math.random() * 0.20;
          scale = 0.30 + Math.random() * 0.30;
        }
      } else {
        nx = 0.1 + Math.random() * 0.8;
        ny = 0.2 + Math.random() * 0.7;
        scale = 0.5 + Math.random() * 0.8;
      }

      this.animals.push({
        id: `animal_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
        index: i + 1,
        charId: this.activeCharType,
        nx: Math.max(0.06, Math.min(0.94, nx)),
        ny: Math.max(0.18, Math.min(0.92, ny)),
        scale: parseFloat(scale.toFixed(2)),
        rotation: Math.round((Math.random() - 0.5) * 16),
        flipX: Math.random() > 0.5,
        baseWidth: 100,
        baseHeight: 100
      });
    }

    this.sortAnimalsByDepth();
    this.updateTitleCount();
    this.renderLayerList();
  }

  sortAnimalsByDepth() {
    this.animals.sort((a, b) => a.ny - b.ny);
    this.animals.forEach((a, i) => a.index = i + 1);
  }

  updateTitleCount() {
    const count = this.animals.length;
    document.getElementById('countBadge').textContent = `${count} Animals`;
    document.getElementById('exactCountVal').textContent = count;
    document.getElementById('inputAnimalCount').value = count;
    document.getElementById('totalAnimalLayerCount').textContent = count;

    if (this.title.autoSyncCount) {
      let charName = 'Animals';
      if (this.activeCharType.includes('duck')) charName = 'Ducks';
      else if (this.activeCharType.includes('cat')) charName = 'Cats';
      else if (this.activeCharType.includes('capybara')) charName = 'Capybaras';
      else if (this.activeCharType.includes('dog')) charName = 'Dogs';
      else if (this.activeCharType.includes('penguin')) charName = 'Penguins';
      else if (this.activeCharType.includes('rabbit')) charName = 'Rabbits';
      else if (this.activeCharType.includes('hamster')) charName = 'Hamsters';

      this.title.text = `Find ${count} ${charName}`;
      document.getElementById('inputTitleText').value = this.title.text;
    }
  }

  randomizeSizes() {
    this.animals.forEach(a => {
      a.scale = parseFloat((0.3 + Math.random() * 1.3).toFixed(2));
    });
    this.renderLayerList();
    this.pushHistoryState('Randomize sizes');
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
    this.pushHistoryState('Reshuffle positions');
    this.showToast('🔀 Positions reshuffled!', 'info');
  }

  // FIXED: Adds animal at exact dead center (0.5, 0.5) without jumping page
  addSingleAnimal() {
    const newAnimal = {
      id: `animal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      index: this.animals.length + 1,
      charId: this.activeCharType,
      nx: 0.5,
      ny: 0.5,
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
    this.updateInspectorUI(newAnimal);
    this.pushHistoryState('Add animal');
    this.showToast('Added +1 Animal at Dead Center (0.5, 0.5)', 'success');
  }

  deleteAnimal(id) {
    this.animals = this.animals.filter(a => a.id !== id);
    if (this.selectedAnimalId === id) this.selectedAnimalId = null;
    this.sortAnimalsByDepth();
    this.updateTitleCount();
    this.renderLayerList();
    this.pushHistoryState('Delete animal');
  }

  duplicateAnimal(id) {
    const a = this.animals.find(item => item.id === id);
    if (!a) return;
    const copy = {
      ...a,
      id: `animal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      nx: Math.min(0.92, a.nx + 0.04),
      ny: Math.min(0.92, a.ny + 0.04)
    };
    this.animals.push(copy);
    this.selectedAnimalId = copy.id;
    this.sortAnimalsByDepth();
    this.updateTitleCount();
    this.renderLayerList();
    this.pushHistoryState('Duplicate animal');
    this.showToast('Animal duplicated', 'info');
  }

  // =========================================================================
  // VIEWPORT ZOOM (Does NOT affect video export resolution!)
  // =========================================================================

  setViewportZoom(zoomFactor) {
    this.viewportZoom = zoomFactor;
    const label = document.getElementById('viewportZoomLabel');
    if (zoomFactor === 1.0) {
      label.textContent = 'Fit';
      this.stageWrapper.style.transform = 'scale(1)';
    } else {
      label.textContent = `${Math.round(zoomFactor * 100)}%`;
      this.stageWrapper.style.transform = `scale(${zoomFactor})`;
    }
    this.showToast(`Viewport Zoom: ${label.textContent}`, 'info');
  }

  zoomInViewport() {
    const steps = [1.0, 1.25, 1.5, 2.0, 3.0];
    const next = steps.find(s => s > this.viewportZoom) || 3.0;
    this.setViewportZoom(next);
  }

  zoomOutViewport() {
    const steps = [3.0, 2.0, 1.5, 1.25, 1.0, 0.75, 0.5];
    const next = steps.find(s => s < this.viewportZoom) || 0.5;
    this.setViewportZoom(next);
  }

  // =========================================================================
  // ASPECT RATIOS & FIT
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

    document.querySelectorAll('.ratio-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ratio === ratio);
    });

    this.fitCanvasToScreen();
  }

  fitCanvasToScreen() {
    const maxW = this.stageMainContainer.clientWidth - 20;
    const maxH = this.stageMainContainer.clientHeight - 85;

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
  // 6 READY DEMO TEMPLATES
  // =========================================================================

  loadDemoTemplate(demoIndex) {
    if (demoIndex === 1) {
      // Demo 1: Find 15 Ducks in Harbor
      this.setAspectRatio('9:16');
      this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');
      this.setCharacterType('shuba_duck', 'Duck');
      this.generateAnimals(15, true);
      this.title.style = 'viral_bold';
      this.title.fontFamily = 'Outfit';
      this.title.fontSize = 64;
      this.title.subtitle = 'Can you spot all 15? 99% FAIL!';
      this.timer.enabled = true;
      this.timer.style = 'top_bar';
      this.videoDuration = 15;
      window.audioEngine.generatePresetBGM('quack_hop', 60);

    } else if (demoIndex === 2) {
      // Demo 2: Find 20 Cats in Vintage Attic
      this.setAspectRatio('9:16');
      this.loadBackground('assets/backgrounds/cozy_cat_room.jpg', 'cozy_cat_room');
      this.setCharacterType('cat_salsa', 'Cat');
      this.generateAnimals(20, true);
      this.title.style = 'neon_glow';
      this.title.fontFamily = 'Luckiest Guy';
      this.title.fontSize = 62;
      this.title.subtitle = 'Only 1% Can Spot Every Cat!';
      this.timer.enabled = true;
      this.timer.style = 'radial_ring';
      this.videoDuration = 15;
      window.audioEngine.generatePresetBGM('detective', 60);

    } else if (demoIndex === 3) {
      // Demo 3: Find 12 Animals in Tokyo Night
      this.setAspectRatio('9:16');
      this.loadBackground('assets/backgrounds/asian_street_market.jpg', 'asian_street_market');
      this.setCharacterType('dog_dance', 'Dog');
      this.generateAnimals(12, true);
      this.title.style = 'golden_arcade';
      this.title.fontFamily = 'Bangers';
      this.title.fontSize = 68;
      this.title.subtitle = 'Night Market Challenge! 12 Hidden Dogs';
      this.timer.enabled = true;
      this.timer.style = 'bottom_bar';
      this.videoDuration = 15;
      window.audioEngine.generatePresetBGM('arcade', 60);

    } else if (demoIndex === 4) {
      // Demo 4: Extreme 25 Tiny Hidden Ducks
      this.setAspectRatio('9:16');
      this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');
      this.setCharacterType('duck_dance', 'Duck');
      this.generateAnimals(25, true);
      // Make them even smaller
      this.animals.forEach(a => a.scale = parseFloat((a.scale * 0.7).toFixed(2)));
      this.title.style = 'danger_alert';
      this.title.fontFamily = 'Anton';
      this.title.fontSize = 72;
      this.title.subtitle = 'EXTREME EYE TEST! Find 25 Micro Ducks';
      this.timer.enabled = true;
      this.timer.style = 'digital_badge';
      this.videoDuration = 20;
      window.audioEngine.generatePresetBGM('tension', 60);

    } else if (demoIndex === 5) {
      // Demo 5: Speed Test (10 Animals in 10s)
      this.setAspectRatio('9:16');
      this.loadBackground('assets/backgrounds/cozy_cat_room.jpg', 'cozy_cat_room');
      this.setCharacterType('dog_happy', 'Dog');
      this.generateAnimals(10, true);
      this.title.style = 'emerald_game';
      this.title.fontFamily = 'Titan One';
      this.title.fontSize = 60;
      this.title.subtitle = '⚡ SPEED TEST: You have 10 seconds!';
      this.timer.enabled = true;
      this.timer.style = 'radial_ring';
      this.videoDuration = 10;
      window.audioEngine.generatePresetBGM('polka', 60);

    } else if (demoIndex === 6) {
      // Demo 6: Full Challenge + Answer Reveal Ending
      this.setAspectRatio('9:16');
      this.loadBackground('assets/backgrounds/asian_street_market.jpg', 'asian_street_market');
      this.setCharacterType('shuba_duck', 'Duck');
      this.generateAnimals(15, true);
      this.title.style = 'viral_bold';
      this.title.fontFamily = 'Outfit';
      this.title.fontSize = 64;
      this.title.subtitle = 'Answers revealed at the end! Pause to play';
      this.appendRevealEnding = true;
      document.getElementById('checkAppendReveal').checked = true;
      this.timer.enabled = true;
      this.timer.style = 'top_bar';
      this.videoDuration = 15;
      window.audioEngine.generatePresetBGM('quack_hop', 60);
    }

    // Sync UI elements
    document.getElementById('inputTitleText').value = this.title.text;
    document.getElementById('inputSubtitleText').value = this.title.subtitle;
    document.getElementById('sliderTitleSize').value = this.title.fontSize;
    document.getElementById('inputTitleSizeExact').value = this.title.fontSize;
    document.getElementById('titleSizeVal').textContent = `${this.title.fontSize}px`;
    document.getElementById('inputCustomDuration').value = this.videoDuration;
    document.getElementById('stageTimeScrubber').max = this.videoDuration;

    document.getElementById('demosModal').classList.remove('active');
    this.drawWaveform();
    this.pushHistoryState(`Loaded Demo ${demoIndex}`);
    this.showToast(`✨ Demo ${demoIndex} loaded successfully!`, 'success');
  }

  // =========================================================================
  // UNDO / REDO HISTORY STACK
  // =========================================================================

  pushHistoryState(actionName = '') {
    if (this.isApplyingHistory) return;
    const snapshot = {
      action: actionName,
      animals: JSON.parse(JSON.stringify(this.animals)),
      title: JSON.parse(JSON.stringify(this.title)),
      watermark: JSON.parse(JSON.stringify(this.watermark)),
      bg: { ...this.bg, img: null }, // omit image ref
      aspectRatio: this.aspectRatio,
      duration: this.videoDuration
    };

    this.historyStack.push(snapshot);
    if (this.historyStack.length > 30) this.historyStack.shift();
    this.redoStack = []; // clear redo on new action
  }

  undo() {
    if (this.historyStack.length <= 1) {
      this.showToast('Nothing to undo', 'info');
      return;
    }
    const current = this.historyStack.pop();
    this.redoStack.push(current);
    const prev = this.historyStack[this.historyStack.length - 1];
    this.applyHistorySnapshot(prev);
    this.showToast(`Undo: ${current.action || 'previous change'}`, 'info');
  }

  redo() {
    if (this.redoStack.length === 0) {
      this.showToast('Nothing to redo', 'info');
      return;
    }
    const next = this.redoStack.pop();
    this.historyStack.push(next);
    this.applyHistorySnapshot(next);
    this.showToast(`Redo: ${next.action || 'edit'}`, 'info');
  }

  applyHistorySnapshot(s) {
    if (!s) return;
    this.isApplyingHistory = true;

    this.animals = JSON.parse(JSON.stringify(s.animals));
    Object.assign(this.title, s.title);
    Object.assign(this.watermark, s.watermark);
    this.bg.zoom = s.bg.zoom;
    this.bg.panX = s.bg.panX;
    this.bg.panY = s.bg.panY;

    this.updateTitleCount();
    this.renderLayerList();
    this.isApplyingHistory = false;
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
        this.currentTime = 0;
      }
      this.updatePlayheadUI();
    }

    if (window.audioEngine && window.audioEngine.isPlaying) {
      this.drawWaveform();
    }

    this.drawFrame(this.ctx, this.canvasWidth, this.canvasHeight, this.currentTime * 1000, !this.creatorMode);
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  drawFrame(ctx, width, height, timeMs, cleanMode = false) {
    ctx.save();

    // 1. Background
    this.renderBackground(ctx, width, height);

    // 2. Animals (sorted by depth)
    this.renderAnimals(ctx, width, height, timeMs, cleanMode);

    // 3. Title & Subtitle
    this.renderTitle(ctx, width, height, cleanMode);

    // 4. Watermark / Branding (unrestricted position)
    if (this.watermark.enabled) {
      this.renderWatermark(ctx, width, height, cleanMode);
    }

    // 5. Countdown Timer
    if (this.timer.enabled && this.timer.style !== 'none') {
      this.renderTimer(ctx, width, height, timeMs);
    }

    // 6. Answer Reveal Rings
    if (this.answerRevealMode) {
      this.renderAnswerRevealRings(ctx, width, height, timeMs);
    }

    ctx.restore();
  }

  renderBackground(ctx, width, height) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    if (!this.bg.isLoaded || !this.bg.img.width) return;

    ctx.save();
    ctx.filter = `brightness(${this.bg.brightness}%) contrast(${this.bg.contrast}%) saturate(${this.bg.saturation}%)`;

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
    const drawX = (width - drawW) / 2 + (this.bg.panX * (width / 1080));
    const drawY = (height - drawH) / 2 + (this.bg.panY * (height / 1920));

    ctx.drawImage(this.bg.img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  renderAnimals(ctx, width, height, timeMs, cleanMode) {
    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      const gifData = this.loadedGifs.get(a.charId);
      const frameCanvas = gifData ? window.gifEngine.getFrame(gifData, timeMs) : null;

      const x = a.nx * width;
      const y = a.ny * height;

      const resScale = width / 1080;
      const baseW = (gifData ? gifData.width : 100) * 0.9 * resScale;
      const baseH = (gifData ? gifData.height : 100) * 0.9 * resScale;

      const drawW = baseW * a.scale;
      const drawH = baseH * a.scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((a.rotation * Math.PI) / 180);
      if (a.flipX) ctx.scale(-1, 1);

      if (frameCanvas) {
        ctx.drawImage(frameCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, drawW * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (!cleanMode && this.creatorMode) {
        this.renderAnimalGizmos(ctx, a, x, y, drawW, drawH);
      }
    }
  }

  renderAnimalGizmos(ctx, a, x, y, drawW, drawH) {
    const isSelected = a.id === this.selectedAnimalId;
    const resScale = this.canvasWidth / 1080;
    const boxHalfW = Math.max(36 * resScale, drawW / 2 + 12);
    const boxHalfH = Math.max(36 * resScale, drawH / 2 + 12);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((a.rotation * Math.PI) / 180);

    // Small Number Badge (Top-Right corner of bounding box in local space)
    const badgeR = Math.max(14, 12 * resScale);
    const badgeX = boxHalfW;
    const badgeY = -boxHalfH;

    ctx.fillStyle = isSelected ? '#fbbf24' : 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = isSelected ? '#000000' : '#fbbf24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
    ctx.font = `bold ${Math.round(11 * resScale) + 1}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${a.index}`, badgeX, badgeY);

    if (isSelected) {
      // Bounding box
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(-boxHalfW, -boxHalfH, boxHalfW * 2, boxHalfH * 2);
      ctx.setLineDash([]);

      // Corner Resize Handle (Bottom-Right)
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(boxHalfW, boxHalfH, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rotation Handle (Top-Center)
      ctx.strokeStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(0, -boxHalfH);
      ctx.lineTo(0, -boxHalfH - 24);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -boxHalfH - 24, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- Title & Subtitle Rendering (Supports 12+ Styles & Unlimited Font Size 5-500px) ---
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

    const style = this.title.style;

    if (style === 'viral_bold') {
      // 1. Classic Viral Reel 3D Bold
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 12 * scale;
      ctx.shadowOffsetY = 6 * scale;
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = this.title.strokeColor;
      ctx.strokeText(this.title.text, x, y);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = this.title.textColor;
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'neon_glow') {
      // 2. Cyber Neon
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 24 * scale;
      ctx.lineWidth = strokeWidth * 0.7;
      ctx.strokeStyle = '#0284c7';
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'golden_arcade') {
      // 3. Golden Arcade 3D
      for (let s = 6 * scale; s >= 1; s--) {
        ctx.fillStyle = '#78350f';
        ctx.fillText(this.title.text, x + s, y + s);
      }
      ctx.lineWidth = strokeWidth * 0.5;
      ctx.strokeStyle = '#b45309';
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'danger_alert') {
      // 4. Danger Alert
      const tm = ctx.measureText(this.title.text);
      const boxW = tm.width + 40 * scale;
      const boxH = fontSize * 1.35;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
      ctx.fillStyle = '#fef08a';
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'glass_pill') {
      // 5. Frosted Glass Pill
      const tm = ctx.measureText(this.title.text);
      const boxW = tm.width + 50 * scale;
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

    } else if (style === 'emerald_game') {
      // 6. Emerald Pop
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = '#064e3b';
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = '#10b981';
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'rainbow_candy') {
      // 7. Rainbow Candy
      ctx.lineWidth = strokeWidth * 1.2;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(this.title.text, x, y);
      const grad = ctx.createLinearGradient(x - 200 * scale, y, x + 200 * scale, y);
      grad.addColorStop(0, '#f43f5e');
      grad.addColorStop(0.5, '#fbbf24');
      grad.addColorStop(1, '#06b6d4');
      ctx.fillStyle = grad;
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'fire_flame') {
      // 8. Fire Flame
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 20 * scale;
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = '#7c2d12';
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = '#fde047';
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'retro_pixel') {
      // 9. Retro Pixel
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = '#a3e635';
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'bubble_pop') {
      // 10. Y2K Bubble
      ctx.lineWidth = strokeWidth * 1.4;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(this.title.text, x, y);
      ctx.fillStyle = '#c084fc';
      ctx.fillText(this.title.text, x, y);

    } else if (style === 'royal_gold') {
      // 11. Royal Gold
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = '#713f12';
      ctx.strokeText(this.title.text, x, y);
      const g = ctx.createLinearGradient(x, y - fontSize / 2, x, y + fontSize / 2);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(1, '#ca8a04');
      ctx.fillStyle = g;
      ctx.fillText(this.title.text, x, y);

    } else {
      // 12. Stealth Dark
      const tm = ctx.measureText(this.title.text);
      const boxW = tm.width + 40 * scale;
      const boxH = fontSize * 1.3;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2 * scale;
      ctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(this.title.text, x, y);
    }

    // Subtitle / Hook with full styling
    const gap = (this.title.gap !== undefined ? this.title.gap : 40) * scale;
    if (this.title.showSubtitle && this.title.subtitle.trim().length > 0) {
      const subFontSize = (this.title.subtitleFontSize || 28) * scale;
      const subY = y + (fontSize * 0.5) + gap + (subFontSize * 0.5);
      ctx.font = `800 ${subFontSize}px '${this.title.fontFamily}', sans-serif`;

      const subMetrics = ctx.measureText(this.title.subtitle);
      const pW = subMetrics.width + 24 * scale;
      const pH = subFontSize * 1.5;

      if (this.title.showSubtitlePill) {
        ctx.fillStyle = this.title.subtitlePillColor || 'rgba(0,0,0,0.8)';
        ctx.beginPath();
        ctx.roundRect(x - pW / 2, subY - pH / 2, pW, pH, 8 * scale);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1.5 * scale;
        ctx.stroke();
      }

      ctx.fillStyle = this.title.subtitleColor || '#fde047';
      ctx.fillText(this.title.subtitle, x, subY);
    }

    if (!cleanMode && this.creatorMode) {
      const metrics = ctx.measureText(this.title.text);
      const boxW = metrics.width + 40 * scale;
      const subH = this.title.showSubtitle ? (gap + (this.title.subtitleFontSize || 28) * scale * 1.5) : 0;
      const boxH = fontSize * 1.2 + subH;
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(x - boxW / 2, y - fontSize * 0.6, boxW, boxH);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  // --- Watermark Rendering (UNRESTRICTED POSITIONING 0% TO 100%) ---
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

    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 6 * scale;
    ctx.fillStyle = this.watermark.color;
    ctx.fillText(this.watermark.text, x, y);

    if (!cleanMode && this.creatorMode) {
      const metrics = ctx.measureText(this.watermark.text);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(x - metrics.width / 2 - 8, y - fontSize / 2 - 4, metrics.width + 16, fontSize + 8);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // --- Multiple Countdown Timer Styles ---
  renderTimer(ctx, width, height, timeMs) {
    const progress = Math.max(0, Math.min(1, (timeMs / 1000) / this.videoDuration));
    const remainingRatio = 1 - progress;
    const style = this.timer.style;

    ctx.save();
    if (style === 'top_bar') {
      const barH = 10 * (width / 1080);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, width, barH);
      const grad = ctx.createLinearGradient(0, 0, width * remainingRatio, 0);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.5, '#6366f1');
      grad.addColorStop(1, '#f43f5e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width * remainingRatio, barH);

    } else if (style === 'bottom_bar') {
      const barH = 10 * (width / 1080);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, height - barH, width, barH);
      const grad = ctx.createLinearGradient(0, 0, width * remainingRatio, 0);
      grad.addColorStop(0, '#10b981');
      grad.addColorStop(1, '#fbbf24');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - barH, width * remainingRatio, barH);

    } else if (style === 'digital_badge') {
      // Digital Clock Badge in top-right
      const secLeft = Math.ceil(this.videoDuration * remainingRatio);
      const text = `${secLeft}s`;
      const badgeX = width * 0.88;
      const badgeY = height * 0.05;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(badgeX - 45, badgeY - 22, 90, 44, 12);
      ctx.fill();
      ctx.strokeStyle = secLeft <= 3 ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = secLeft <= 3 ? '#f87171' : '#ffffff';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, badgeX, badgeY);

    } else if (style === 'radial_ring') {
      // Circular Radial Ring in top-right
      const ringX = width * 0.90;
      const ringY = height * 0.05;
      const r = 24 * (width / 1080);

      // Track
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 5 * (width / 1080);
      ctx.beginPath();
      ctx.arc(ringX, ringY, r, 0, Math.PI * 2);
      ctx.stroke();

      // Arc
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ringX, ringY, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainingRatio);
      ctx.stroke();

      const secLeft = Math.ceil(this.videoDuration * remainingRatio);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${14 * (width / 1080)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${secLeft}`, ringX, ringY);
    }

    ctx.restore();
  }

  // --- Answer Reveal Rings (Clean Toggle) ---
  renderAnswerRevealRings(ctx, width, height, timeMs) {
    const pulse = 1 + Math.sin(timeMs * 0.008) * 0.15;
    ctx.save();
    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      const x = a.nx * width;
      const y = a.ny * height;
      const resScale = width / 1080;
      const radius = 60 * a.scale * resScale * pulse;

      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4 * resScale;
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 15 * resScale;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.lineWidth = 2 * resScale;
      ctx.beginPath();
      ctx.moveTo(x - radius * 1.25, y);
      ctx.lineTo(x + radius * 1.25, y);
      ctx.moveTo(x, y - radius * 1.25);
      ctx.lineTo(x, y + radius * 1.25);
      ctx.stroke();

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
  // INTERACTIVE DRAG & DROP AND HANDLERS
  // =========================================================================

  setupEventListeners() {
    window.addEventListener('resize', () => this.fitCanvasToScreen());

    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    window.addEventListener('pointermove', this.onPointerMove.bind(this));
    window.addEventListener('pointerup', this.onPointerUp.bind(this));

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      this.bg.zoom = Math.max(0.5, Math.min(3.0, this.bg.zoom + delta));
      document.getElementById('sliderBgZoom').value = Math.round(this.bg.zoom * 100);
      document.getElementById('inputBgZoom').value = Math.round(this.bg.zoom * 100);
      document.getElementById('bgZoomVal').textContent = `${Math.round(this.bg.zoom * 100)}%`;
    }, { passive: false });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this.redo();
      } else if (e.code === 'Space') {
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
        if (e.code === 'ArrowLeft') a.nx = Math.max(0.01, a.nx - step);
        if (e.code === 'ArrowRight') a.nx = Math.min(0.99, a.nx + step);
        if (e.code === 'ArrowUp') a.ny = Math.max(0.01, a.ny - step);
        if (e.code === 'ArrowDown') a.ny = Math.min(0.99, a.ny + step);
        this.updateInspectorUI(a);
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

    // Character Category Sub-tabs (Ducks, Cats, Others, Uploads)
    document.querySelectorAll('.char-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.char-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.dataset.cat;
        document.getElementById('charGridDucks').style.display = cat === 'ducks' ? 'grid' : 'none';
        document.getElementById('charGridDogs').style.display = cat === 'dogs' ? 'grid' : 'none';
        document.getElementById('charGridCats').style.display = cat === 'cats' ? 'grid' : 'none';
        document.getElementById('charGridOthers').style.display = cat === 'others' ? 'grid' : 'none';
        document.getElementById('charGridCustom').style.display = cat === 'custom' ? 'grid' : 'none';
      });
    });

    // Character Cards Selection
    document.querySelectorAll('.char-card').forEach(card => {
      card.addEventListener('click', () => {
        const charId = card.dataset.char;
        const name = card.querySelector('span') ? card.querySelector('span').textContent : null;
        this.setCharacterType(charId, name);
      });
    });

    // Custom GIF Upload
    document.getElementById('customGifUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        this.showToast('Decoding animated GIF...', 'info');
        const customId = `custom_${Date.now()}`;
        const gifData = await window.gifEngine.loadFromFile(file, customId);
        this.loadedGifs.set(customId, gifData);
        this.setCharacterType(customId, file.name.replace('.gif', ''));

        // Save to IndexedDB
        if (window.storageManager) {
          await window.storageManager.saveItem('characters', {
            id: customId,
            name: file.name,
            date: new Date().toLocaleDateString(),
            data: gifData.originalBuffer
          });
          this.refreshSavedUploadsUI();
        }

        this.showToast(`Loaded "${file.name}"!`, 'success');
      } catch (err) {
        this.showToast(`Error decoding GIF: ${err.message}`, 'error');
      }
    });

    // Chroma-Key Modal Open & Logic
    document.getElementById('btnOpenChromaKeyModal').addEventListener('click', () => {
      this.openChromaKeyModal();
    });
    document.getElementById('btnCloseChromaModal').addEventListener('click', () => {
      document.getElementById('chromaKeyModal').classList.remove('active');
    });

    document.getElementById('sliderChromaTol').addEventListener('input', (e) => {
      document.getElementById('chromaTolVal').textContent = e.target.value;
      this.updateChromaPreview();
    });
    document.getElementById('inputChromaColor').addEventListener('input', () => {
      this.updateChromaPreview();
    });
    document.getElementById('btnAutoDetectBg').addEventListener('click', () => {
      if (this.activeChromaGif) {
        const bg = window.gifEngine.detectBackgroundColor(this.activeChromaGif);
        const hex = '#' + ((1 << 24) + (bg.r << 16) + (bg.g << 8) + bg.b).toString(16).slice(1);
        document.getElementById('inputChromaColor').value = hex;
        this.updateChromaPreview();
      }
    });
    this.chromaCanvas.addEventListener('click', (e) => {
      const rect = this.chromaCanvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) * (this.chromaCanvas.width / rect.width));
      const y = Math.floor((e.clientY - rect.top) * (this.chromaCanvas.height / rect.height));
      const pixel = this.chromaCtx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1);
      document.getElementById('inputChromaColor').value = hex;
      this.updateChromaPreview();
    });
    document.getElementById('btnApplyChromaKey').addEventListener('click', () => {
      this.applyChromaKeyToActive();
    });

    // Count Presets & Inputs
    document.querySelectorAll('.preset-chip[data-count]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip[data-count]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const count = parseInt(chip.dataset.count);
        this.generateAnimals(count, true);
        this.pushHistoryState(`Change count to ${count}`);
      });
    });

    document.getElementById('inputAnimalCount').addEventListener('change', (e) => {
      const val = Math.max(1, Math.min(100, parseInt(e.target.value) || 15));
      this.generateAnimals(val, true);
      this.pushHistoryState(`Set exact count to ${val}`);
    });

    document.getElementById('btnSmartScatter').addEventListener('click', () => {
      this.generateAnimals(this.animals.length, true);
      this.pushHistoryState('Smart Scatter');
      this.showToast('✨ Smart Depth Scatter applied!', 'success');
    });
    document.getElementById('btnRandomizeSizes').addEventListener('click', () => this.randomizeSizes());
    document.getElementById('btnReshufflePos').addEventListener('click', () => this.reshufflePositions());
    document.getElementById('btnStageReshuffle').addEventListener('click', () => this.reshufflePositions());
    document.getElementById('btnAddSingleAnimal').addEventListener('click', () => this.addSingleAnimal());

    // Highlight All / Answer Rings (FIXED: Clean Toggle with state feedback)
    const toggleReveal = () => {
      this.answerRevealMode = !this.answerRevealMode;
      const statusBadge = document.getElementById('revealStatusBadge');
      const btnText = document.getElementById('revealBtnText');
      const stageText = document.getElementById('stageRevealText');
      const dockText = document.getElementById('dockHighlightText');

      if (this.answerRevealMode) {
        statusBadge.textContent = 'ON';
        statusBadge.style.background = 'rgba(239, 68, 68, 0.2)';
        statusBadge.style.color = '#ef4444';
        btnText.textContent = 'Hide Answer Rings';
        stageText.textContent = 'Hide Rings';
        dockText.textContent = 'Hide';
        document.getElementById('btnStageRevealToggle').classList.add('btn-primary');
        document.getElementById('btnPingAllAnimals').classList.add('btn-primary');
        this.showToast('🎯 Highlight Rings: ON', 'info');
      } else {
        statusBadge.textContent = 'OFF';
        statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        statusBadge.style.color = '#10b981';
        btnText.textContent = 'Show Answer Rings';
        stageText.textContent = 'Highlight All';
        dockText.textContent = 'Highlight';
        document.getElementById('btnStageRevealToggle').classList.remove('btn-primary');
        document.getElementById('btnPingAllAnimals').classList.remove('btn-primary');
        this.showToast('Highlight Rings: OFF', 'info');
      }
    };

    document.getElementById('btnToggleAnswerReveal').addEventListener('click', toggleReveal);
    document.getElementById('btnStageRevealToggle').addEventListener('click', toggleReveal);
    document.getElementById('btnPingAllAnimals').addEventListener('click', toggleReveal);

    // Save Answer Key PNG
    document.getElementById('btnExportAnswerKeyPng').addEventListener('click', () => {
      const prev = this.answerRevealMode;
      this.answerRevealMode = true;
      this.drawFrame(this.ctx, this.canvasWidth, this.canvasHeight, this.currentTime * 1000, true);
      const url = this.canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `answer-key-${this.animals.length}-animals.png`;
      a.click();
      this.answerRevealMode = prev;
      this.showToast('Saved Answer Key PNG!', 'success');
    });

    // Save Current Frame as HD Thumbnail
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

    // Backdrop Presets
    document.querySelectorAll('.bg-thumb-card').forEach(card => {
      card.addEventListener('click', () => {
        const bgId = card.dataset.bg;
        this.loadBackground(`assets/backgrounds/${bgId}.jpg`, bgId);
        this.pushHistoryState(`Backdrop to ${bgId}`);
        this.showToast(`Backdrop changed to ${card.querySelector('.bg-label').textContent}`, 'info');
      });
    });

    // Custom Background Upload
    document.getElementById('customBgUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        this.loadBackground(evt.target.result, 'custom_bg');
        if (window.storageManager) {
          await window.storageManager.saveItem('backgrounds', {
            id: `bg_${Date.now()}`,
            name: file.name,
            date: new Date().toLocaleDateString(),
            dataUrl: evt.target.result
          });
          this.refreshSavedUploadsUI();
        }
        this.showToast(`Custom background loaded!`, 'success');
      };
      reader.readAsDataURL(file);
    });

    // Background Sliders + Numeric Inputs
    const syncBgZoom = (val) => {
      this.bg.zoom = val / 100;
      document.getElementById('sliderBgZoom').value = val;
      document.getElementById('inputBgZoom').value = val;
      document.getElementById('bgZoomVal').textContent = `${val}%`;
    };
    document.getElementById('sliderBgZoom').addEventListener('input', (e) => syncBgZoom(parseInt(e.target.value)));
    document.getElementById('inputBgZoom').addEventListener('input', (e) => syncBgZoom(parseInt(e.target.value) || 100));

    const syncBgPanX = (val) => {
      this.bg.panX = val;
      document.getElementById('sliderBgPanX').value = val;
      document.getElementById('inputBgPanX').value = val;
      document.getElementById('bgPanXVal').textContent = `${val}px`;
    };
    document.getElementById('sliderBgPanX').addEventListener('input', (e) => syncBgPanX(parseInt(e.target.value)));
    document.getElementById('inputBgPanX').addEventListener('input', (e) => syncBgPanX(parseInt(e.target.value) || 0));

    const syncBgPanY = (val) => {
      this.bg.panY = val;
      document.getElementById('sliderBgPanY').value = val;
      document.getElementById('inputBgPanY').value = val;
      document.getElementById('bgPanYVal').textContent = `${val}px`;
    };
    document.getElementById('sliderBgPanY').addEventListener('input', (e) => syncBgPanY(parseInt(e.target.value)));
    document.getElementById('inputBgPanY').addEventListener('input', (e) => syncBgPanY(parseInt(e.target.value) || 0));

    document.getElementById('btnResetBgTransform').addEventListener('click', () => this.resetBackgroundTransform());

    // Title Controls & 12+ Styles
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

    document.querySelectorAll('.title-style-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.title-style-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.title.style = card.dataset.style;
        this.pushHistoryState(`Title style: ${card.dataset.style}`);
      });
    });

    document.getElementById('selectFontFamily').addEventListener('change', (e) => {
      this.title.fontFamily = e.target.value;
    });

    // UNLIMITED FONT SIZE (5px to 500px)
    const syncTitleSize = (val) => {
      val = Math.max(5, Math.min(500, val));
      this.title.fontSize = val;
      document.getElementById('sliderTitleSize').value = Math.min(300, val);
      document.getElementById('inputTitleSizeExact').value = val;
      document.getElementById('titleSizeVal').textContent = `${val}px`;
    };
    document.getElementById('sliderTitleSize').addEventListener('input', (e) => syncTitleSize(parseInt(e.target.value)));
    document.getElementById('inputTitleSizeExact').addEventListener('input', (e) => syncTitleSize(parseInt(e.target.value) || 64));

    document.getElementById('inputTextColor').addEventListener('input', (e) => this.title.textColor = e.target.value);
    document.getElementById('inputStrokeColor').addEventListener('input', (e) => this.title.strokeColor = e.target.value);

    const syncStrokeWidth = (val) => {
      this.title.strokeWidth = val;
      document.getElementById('sliderStrokeWidth').value = val;
      document.getElementById('inputStrokeWidthExact').value = val;
      document.getElementById('strokeWidthVal').textContent = `${val}px`;
    };
    document.getElementById('sliderStrokeWidth').addEventListener('input', (e) => syncStrokeWidth(parseInt(e.target.value)));
    document.getElementById('inputStrokeWidthExact').addEventListener('input', (e) => syncStrokeWidth(parseInt(e.target.value) || 0));

    // Subtitle Styling
    const syncSubSize = (val) => {
      this.title.subtitleFontSize = val;
      document.getElementById('sliderSubtitleSize').value = val;
      document.getElementById('inputSubtitleSizeExact').value = val;
      document.getElementById('subtitleSizeVal').textContent = `${val}px`;
    };
    document.getElementById('sliderSubtitleSize').addEventListener('input', (e) => syncSubSize(parseInt(e.target.value)));
    document.getElementById('inputSubtitleSizeExact').addEventListener('input', (e) => syncSubSize(parseInt(e.target.value) || 28));

    document.getElementById('inputSubtitleColor').addEventListener('input', (e) => this.title.subtitleColor = e.target.value);
    document.getElementById('inputSubtitlePillColor').addEventListener('input', (e) => this.title.subtitlePillColor = e.target.value);
    document.getElementById('checkSubtitlePillEnable').addEventListener('change', (e) => this.title.showSubtitlePill = e.target.checked);

    // Title to Subtitle Spacing (Gap) Controls
    const syncTitleGap = (val) => {
      this.title.gap = val;
      document.getElementById('sliderTitleGap').value = val;
      document.getElementById('inputTitleGapExact').value = val;
      document.getElementById('titleGapVal').textContent = `${val}px`;
    };
    document.getElementById('sliderTitleGap').addEventListener('input', (e) => syncTitleGap(parseInt(e.target.value) || 0));
    document.getElementById('inputTitleGapExact').addEventListener('input', (e) => syncTitleGap(parseInt(e.target.value) || 0));

    // Audio Preset Switcher (6 Copyright-Free Tracks)
    document.getElementById('selectPresetTrack').addEventListener('change', async (e) => {
      const track = e.target.value;
      this.showToast(`Synthesizing "${track}" music...`, 'info');
      await window.audioEngine.generatePresetBGM(track, 60);
      document.getElementById('currentTrackBadge').textContent = track.replace('_', ' ').toUpperCase();
      this.drawWaveform();
      this.showToast('Music updated!', 'success');
    });

    // Custom Audio Upload (Supports Multiple Files & Saves to IndexedDB!)
    document.getElementById('customAudioUpload').addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      try {
        let firstLoaded = false;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const arrayBuffer = await file.arrayBuffer();
          const audioId = 'audio_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

          if (window.storageManager) {
            await window.storageManager.saveItem('audio', {
              id: audioId,
              name: file.name,
              data: arrayBuffer,
              size: file.size,
              timestamp: Date.now()
            });
          }

          if (!firstLoaded) {
            this.showToast(`Loading audio "${file.name}"...`, 'info');
            await window.audioEngine.loadFromArrayBuffer(arrayBuffer, file.name);
            document.getElementById('currentTrackBadge').textContent = file.name;
            firstLoaded = true;
          }
        }
        this.drawWaveform();
        await this.refreshSavedUploadsUI();
        this.showToast(`Saved ${files.length} audio file(s) to library!`, 'success');
      } catch (err) {
        this.showToast(`Audio load error: ${err.message}`, 'error');
      }
    });

    document.getElementById('btnDownloadWavTrack').addEventListener('click', () => {
      const blob = window.audioEngine.exportToWavBlob();
      if (!blob) {
        this.showToast('No active audio to export', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${window.audioEngine.currentTrackName}_CopyrightFree.wav`;
      a.click();
      this.showToast('Saved standalone WAV audio file!', 'success');
    });

    // Waveform Trimmer Controls & Drag Listeners
    document.getElementById('sliderTrimStart').addEventListener('input', (e) => this.setTrimStart(parseFloat(e.target.value)));
    document.getElementById('inputTrimStartExact').addEventListener('input', (e) => this.setTrimStart(parseFloat(e.target.value) || 0));
    document.getElementById('sliderTrimEnd').addEventListener('input', (e) => this.setTrimEnd(parseFloat(e.target.value)));
    document.getElementById('inputTrimEndExact').addEventListener('input', (e) => this.setTrimEnd(parseFloat(e.target.value) || 15));

    if (this.waveformCanvas) {
      this.waveformCanvas.addEventListener('pointerdown', (e) => this.onWaveformPointerDown(e));
      this.waveformCanvas.addEventListener('pointermove', (e) => this.onWaveformPointerMove(e));
      this.waveformCanvas.addEventListener('pointerup', (e) => this.onWaveformPointerUp(e));
      this.waveformCanvas.addEventListener('pointercancel', (e) => this.onWaveformPointerUp(e));
    }

    document.getElementById('sliderAudioVolume').addEventListener('input', (e) => {
      const vol = parseInt(e.target.value);
      window.audioEngine.setVolume(vol / 100);
      document.getElementById('audioVolumeVal').textContent = `${vol}%`;
    });
    document.getElementById('checkFadeIn').addEventListener('change', (e) => window.audioEngine.fadeIn = e.target.checked);
    document.getElementById('checkFadeOut').addEventListener('change', (e) => window.audioEngine.fadeOut = e.target.checked);
    document.getElementById('btnAudioPreviewToggle').addEventListener('click', () => {
      if (window.audioEngine.isPlaying) {
        window.audioEngine.stop();
        document.getElementById('btnAudioPreviewToggle').innerHTML = '<i class="fa-solid fa-play"></i> Preview Audio Track';
      } else {
        window.audioEngine.play(0);
        document.getElementById('btnAudioPreviewToggle').innerHTML = '<i class="fa-solid fa-stop"></i> Stop Audio';
      }
    });

    // Watermark (UNRESTRICTED POSITION 0% TO 100% WITH NO BOTTOM LIMITATION)
    document.getElementById('checkWatermarkEnable').addEventListener('change', (e) => this.watermark.enabled = e.target.checked);
    document.getElementById('inputWatermarkText').addEventListener('input', (e) => this.watermark.text = e.target.value);

    const syncWmX = (val) => {
      this.watermark.nx = val / 100;
      document.getElementById('sliderWatermarkX').value = val;
      document.getElementById('inputWatermarkXExact').value = val;
      document.getElementById('wmXVal').textContent = `${val}%`;
    };
    document.getElementById('sliderWatermarkX').addEventListener('input', (e) => syncWmX(parseInt(e.target.value)));
    document.getElementById('inputWatermarkXExact').addEventListener('input', (e) => syncWmX(parseInt(e.target.value) || 50));

    const syncWmY = (val) => {
      this.watermark.ny = val / 100;
      document.getElementById('sliderWatermarkY').value = val;
      document.getElementById('inputWatermarkYExact').value = val;
      document.getElementById('wmYVal').textContent = `${val}%`;
    };
    document.getElementById('sliderWatermarkY').addEventListener('input', (e) => syncWmY(parseInt(e.target.value)));
    document.getElementById('inputWatermarkYExact').addEventListener('input', (e) => syncWmY(parseInt(e.target.value) || 97));

    document.querySelectorAll('.preset-chip[data-snap]').forEach(chip => {
      chip.addEventListener('click', () => {
        const snap = chip.dataset.snap;
        if (snap === 'bottom_center') { syncWmX(50); syncWmY(97); }
        else if (snap === 'bottom_right') { syncWmX(86); syncWmY(97); }
        else if (snap === 'top_right') { syncWmX(86); syncWmY(4); }
        else if (snap === 'top_left') { syncWmX(14); syncWmY(4); }
      });
    });

    document.getElementById('sliderWatermarkOpacity').addEventListener('input', (e) => {
      this.watermark.opacity = parseInt(e.target.value) / 100;
      document.getElementById('watermarkOpacityVal').textContent = `${e.target.value}%`;
    });

    const syncWmSize = (val) => {
      this.watermark.fontSize = val;
      document.getElementById('sliderWatermarkSize').value = val;
      document.getElementById('inputWatermarkSizeExact').value = val;
      document.getElementById('watermarkSizeVal').textContent = `${val}px`;
    };
    document.getElementById('sliderWatermarkSize').addEventListener('input', (e) => syncWmSize(parseInt(e.target.value)));
    document.getElementById('inputWatermarkSizeExact').addEventListener('input', (e) => syncWmSize(parseInt(e.target.value) || 24));

    // Countdown Timer Settings
    document.getElementById('checkTimerBarEnable').addEventListener('change', (e) => this.timer.enabled = e.target.checked);
    document.getElementById('selectTimerStyle').addEventListener('change', (e) => this.timer.style = e.target.value);

    // Duration Chips
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

    const formatSelect = document.getElementById('selectExportFormat');
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => this.exportFormat = e.target.value);
    }
    document.getElementById('selectResolution').addEventListener('change', (e) => this.resolutionPreset = e.target.value);
    document.getElementById('selectFps').addEventListener('change', (e) => this.fps = parseInt(e.target.value));
    document.getElementById('selectBitrate').addEventListener('change', (e) => this.bitrate = parseInt(e.target.value) * 1000000);
    document.getElementById('checkAppendReveal').addEventListener('change', (e) => this.appendRevealEnding = e.target.checked);

    // Playback buttons
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

    // Viewport Zoom controls
    document.getElementById('btnZoomIn').addEventListener('click', () => this.zoomInViewport());
    document.getElementById('btnZoomOut').addEventListener('click', () => this.zoomOutViewport());
    document.getElementById('btnZoomFit').addEventListener('click', () => this.setViewportZoom(1.0));

    // History Undo / Redo / Reset
    document.getElementById('btnUndo').addEventListener('click', () => this.undo());
    document.getElementById('btnRedo').addEventListener('click', () => this.redo());
    document.getElementById('btnResetProject').addEventListener('click', () => {
      if (confirm('Reset entire project to default setup?')) {
        this.loadDemoTemplate(1);
      }
    });

    // 6 Demos Modal
    document.getElementById('btnOpenDemosModal').addEventListener('click', () => {
      document.getElementById('demosModal').classList.add('active');
    });
    document.getElementById('btnCloseDemosModal').addEventListener('click', () => {
      document.getElementById('demosModal').classList.remove('active');
    });
    document.querySelectorAll('.demo-card').forEach(card => {
      card.addEventListener('click', () => {
        const demoId = parseInt(card.dataset.demo);
        this.loadDemoTemplate(demoId);
      });
    });

    // Creator / Clean Audience View toggle
    document.getElementById('btnToggleMode').addEventListener('click', () => {
      this.creatorMode = !this.creatorMode;
      const label = document.getElementById('modeLabel');
      label.textContent = this.creatorMode ? 'Creator View' : 'Audience View';
      document.getElementById('btnToggleMode').classList.toggle('btn-primary', !this.creatorMode);
      this.showToast(`Switched to ${this.creatorMode ? 'Creator View (handles on)' : 'Clean Audience View'}`, 'info');
    });

    // Selected Animal Inspector Controls with Numeric Inputs
    const syncInspectScale = (val) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.scale = parseFloat((val / 100).toFixed(2));
      document.getElementById('sliderInspectScale').value = val;
      document.getElementById('inputInspectScaleExact').value = val;
      document.getElementById('inspectScaleVal').textContent = `${val}%`;
    };
    document.getElementById('sliderInspectScale').addEventListener('input', (e) => syncInspectScale(parseInt(e.target.value)));
    document.getElementById('inputInspectScaleExact').addEventListener('input', (e) => syncInspectScale(parseInt(e.target.value) || 100));

    const syncInspectRot = (val) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.rotation = val;
      document.getElementById('sliderInspectRot').value = val;
      document.getElementById('inputInspectRotExact').value = val;
      document.getElementById('inspectRotVal').textContent = `${val}°`;
    };
    document.getElementById('sliderInspectRot').addEventListener('input', (e) => syncInspectRot(parseInt(e.target.value)));
    document.getElementById('inputInspectRotExact').addEventListener('input', (e) => syncInspectRot(parseInt(e.target.value) || 0));

    document.getElementById('inputInspectXExact').addEventListener('input', (e) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.nx = Math.max(0, Math.min(1, (parseFloat(e.target.value) || 50) / 100));
    });
    document.getElementById('inputInspectYExact').addEventListener('input', (e) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.ny = Math.max(0, Math.min(1, (parseFloat(e.target.value) || 50) / 100));
    });

    document.getElementById('btnInspectFlipX').addEventListener('click', () => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.flipX = !a.flipX;
      this.pushHistoryState('Flip animal');
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
      const videoPlayer = document.getElementById('exportVideoPlayer');
      if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.src = '';
      }
      document.getElementById('exportModal').classList.remove('active');
    });

    window.addEventListener('resize', () => {
      this.fitCanvasToScreen();
      this.drawWaveform();
    });
  }

  // --- Pointer Down (Hit Detection) ---
  onPointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvasWidth / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const clientX = (e.clientX - rect.left) * scaleX;
    const clientY = (e.clientY - rect.top) * scaleY;

    this.interaction.startX = clientX;
    this.interaction.startY = clientY;

    if (e.spaceKey || this.interaction.spaceDown || e.button === 1) {
      this.interaction.isDragging = true;
      this.interaction.dragTarget = 'bg-pan';
      this.interaction.origItemX = this.bg.panX;
      this.interaction.origItemY = this.bg.panY;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (this.selectedAnimalId) {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (a) {
        const ax = a.nx * this.canvasWidth;
        const ay = a.ny * this.canvasHeight;
        const gifData = this.loadedGifs.get(a.charId);
        const resScale = this.canvasWidth / 1080;
        const drawW = (gifData ? gifData.width : 100) * 0.9 * resScale * a.scale;
        const drawH = (gifData ? gifData.height : 100) * 0.9 * resScale * a.scale;
        const boxHalfW = Math.max(36 * resScale, drawW / 2 + 12);
        const boxHalfH = Math.max(36 * resScale, drawH / 2 + 12);

        // Transform mouse point into animal's local space (accounting for a.rotation!)
        const dx = clientX - ax;
        const dy = clientY - ay;
        const rad = (-a.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        // Rotation Handle (Top-Center in local space: 0, -boxHalfH - 24)
        const rotDist = Math.hypot(localX, localY - (-boxHalfH - 24));
        if (rotDist < Math.max(26, 22 * resScale)) {
          this.interaction.isDragging = true;
          this.interaction.dragTarget = 'handle-rot';
          this.interaction.targetId = a.id;
          this.interaction.origRot = a.rotation;
          return;
        }

        // Corner Resize Handle (Bottom-Right in local space: boxHalfW, boxHalfH)
        const cornerDist = Math.hypot(localX - boxHalfW, localY - boxHalfH);
        if (cornerDist < Math.max(26, 22 * resScale)) {
          this.interaction.isDragging = true;
          this.interaction.dragTarget = 'handle-resize';
          this.interaction.targetId = a.id;
          this.interaction.origScale = a.scale;
          this.interaction.origDist = Math.hypot(clientX - ax, clientY - ay);
          return;
        }

        // Central body dragging for the selected animal
        if (Math.abs(localX) <= boxHalfW && Math.abs(localY) <= boxHalfH) {
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
    }

    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const ax = a.nx * this.canvasWidth;
      const ay = a.ny * this.canvasHeight;
      const gifData = this.loadedGifs.get(a.charId);
      const resScale = this.canvasWidth / 1080;
      const drawW = (gifData ? gifData.width : 100) * 0.9 * resScale * a.scale;
      const drawH = (gifData ? gifData.height : 100) * 0.9 * resScale * a.scale;
      const boxHalfW = Math.max(45 * resScale, drawW / 2 + 16);
      const boxHalfH = Math.max(45 * resScale, drawH / 2 + 16);

      // Transform mouse point into animal's local space
      const dx = clientX - ax;
      const dy = clientY - ay;
      const rad = (-a.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

      // Generous hit box: ensure minimum 45px hit area even for tiny animals!
      const hitBody = Math.abs(localX) <= boxHalfW && Math.abs(localY) <= boxHalfH;
      // Badge hit test in local space at (boxHalfW, -boxHalfH)
      const hitBadge = Math.hypot(localX - boxHalfW, localY - (-boxHalfH)) <= Math.max(26, 20 * resScale);

      if (hitBody || hitBadge) {
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

    const tx = this.title.nx * this.canvasWidth;
    const ty = this.title.ny * this.canvasHeight;
    const titleH = this.title.fontSize * (this.canvasWidth / 1080) * 2;
    if (Math.abs(clientX - tx) < 380 * (this.canvasWidth / 1080) && Math.abs(clientY - ty) < titleH / 2) {
      this.interaction.isDragging = true;
      this.interaction.dragTarget = 'title';
      this.interaction.origItemX = this.title.nx;
      this.interaction.origItemY = this.title.ny;
      return;
    }

    if (this.watermark.enabled) {
      const wx = this.watermark.nx * this.canvasWidth;
      const wy = this.watermark.ny * this.canvasHeight;
      if (Math.abs(clientX - wx) < 220 * (this.canvasWidth / 1080) && Math.abs(clientY - wy) < 40) {
        this.interaction.isDragging = true;
        this.interaction.dragTarget = 'watermark';
        this.interaction.origItemX = this.watermark.nx;
        this.interaction.origItemY = this.watermark.ny;
        return;
      }
    }

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
      a.nx = Math.max(0.01, Math.min(0.99, this.interaction.origItemX + dx / this.canvasWidth));
      a.ny = Math.max(0.01, Math.min(0.99, this.interaction.origItemY + dy / this.canvasHeight));
      this.updateInspectorUI(a);

    } else if (this.interaction.dragTarget === 'title') {
      this.title.nx = Math.max(0.02, Math.min(0.98, this.interaction.origItemX + dx / this.canvasWidth));
      this.title.ny = Math.max(0.02, Math.min(0.98, this.interaction.origItemY + dy / this.canvasHeight));

    } else if (this.interaction.dragTarget === 'watermark') {
      // UNRESTRICTED: Allows placing watermark all the way to 0% and 100%!
      this.watermark.nx = Math.max(0.0, Math.min(1.0, this.interaction.origItemX + dx / this.canvasWidth));
      this.watermark.ny = Math.max(0.0, Math.min(1.0, this.interaction.origItemY + dy / this.canvasHeight));
      document.getElementById('sliderWatermarkX').value = Math.round(this.watermark.nx * 100);
      document.getElementById('inputWatermarkXExact').value = Math.round(this.watermark.nx * 100);
      document.getElementById('sliderWatermarkY').value = Math.round(this.watermark.ny * 100);
      document.getElementById('inputWatermarkYExact').value = Math.round(this.watermark.ny * 100);

    } else if (this.interaction.dragTarget === 'handle-resize') {
      const a = this.animals.find(item => item.id === this.interaction.targetId);
      if (!a) return;
      const ax = a.nx * this.canvasWidth;
      const ay = a.ny * this.canvasHeight;
      const currentDist = Math.hypot(clientX - ax, clientY - ay);
      const ratio = currentDist / Math.max(10, this.interaction.origDist);
      a.scale = Math.max(0.1, Math.min(5.0, parseFloat((this.interaction.origScale * ratio).toFixed(2))));
      document.getElementById('sliderInspectScale').value = Math.round(a.scale * 100);
      document.getElementById('inputInspectScaleExact').value = Math.round(a.scale * 100);
      document.getElementById('inspectScaleVal').textContent = `${Math.round(a.scale * 100)}%`;

    } else if (this.interaction.dragTarget === 'handle-rot') {
      const a = this.animals.find(item => item.id === this.interaction.targetId);
      if (!a) return;
      const ax = a.nx * this.canvasWidth;
      const ay = a.ny * this.canvasHeight;
      const angle = Math.atan2(clientY - ay, clientX - ax) * (180 / Math.PI) + 90;
      a.rotation = Math.round(angle % 360);
      document.getElementById('sliderInspectRot').value = a.rotation;
      document.getElementById('inputInspectRotExact').value = a.rotation;
      document.getElementById('inspectRotVal').textContent = `${a.rotation}°`;

    } else if (this.interaction.dragTarget === 'bg-pan') {
      this.bg.panX = Math.round(this.interaction.origItemX + dx);
      this.bg.panY = Math.round(this.interaction.origItemY + dy);
      document.getElementById('sliderBgPanX').value = this.bg.panX;
      document.getElementById('inputBgPanX').value = this.bg.panX;
      document.getElementById('bgPanXVal').textContent = `${this.bg.panX}px`;
      document.getElementById('sliderBgPanY').value = this.bg.panY;
      document.getElementById('inputBgPanY').value = this.bg.panY;
      document.getElementById('bgPanYVal').textContent = `${this.bg.panY}px`;
    }
  }

  onPointerUp() {
    if (this.interaction.isDragging) {
      this.pushHistoryState('Move item');
    }
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

  setTrimStart(val) {
    const maxDur = Math.max(1, window.audioEngine.duration || 15);
    const clamped = Math.max(0, Math.min(val, (window.audioEngine.trimEnd || 15) - 0.5));
    window.audioEngine.trimStart = parseFloat(clamped.toFixed(1));
    const slider = document.getElementById('sliderTrimStart');
    const input = document.getElementById('inputTrimStartExact');
    const badge = document.getElementById('trimStartVal');
    if (slider) slider.value = window.audioEngine.trimStart;
    if (input) input.value = window.audioEngine.trimStart;
    if (badge) badge.textContent = `${window.audioEngine.trimStart.toFixed(1)}s`;
    this.drawWaveform();
  }

  setTrimEnd(val) {
    const maxDur = Math.max(1, window.audioEngine.duration || 15);
    const clamped = Math.min(maxDur, Math.max(val, (window.audioEngine.trimStart || 0) + 0.5));
    window.audioEngine.trimEnd = parseFloat(clamped.toFixed(1));
    const slider = document.getElementById('sliderTrimEnd');
    const input = document.getElementById('inputTrimEndExact');
    const badge = document.getElementById('trimEndVal');
    if (slider) slider.value = window.audioEngine.trimEnd;
    if (input) input.value = window.audioEngine.trimEnd;
    if (badge) badge.textContent = `${window.audioEngine.trimEnd.toFixed(1)}s`;
    this.drawWaveform();
  }

  onWaveformPointerDown(e) {
    if (!this.waveformCanvas) return;
    const rect = this.waveformCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = rect.width;
    const dur = Math.max(1, window.audioEngine.duration || 15);

    const startX = (window.audioEngine.trimStart / dur) * w;
    const endX = (window.audioEngine.trimEnd / dur) * w;

    if (Math.abs(x - startX) <= 14) {
      this.waveformDragTarget = 'start';
    } else if (Math.abs(x - endX) <= 14) {
      this.waveformDragTarget = 'end';
    } else if (x > startX && x < endX) {
      this.waveformDragTarget = 'window';
      this.waveformDragOffsetX = (x / w) * dur - window.audioEngine.trimStart;
      this.waveformDragLength = window.audioEngine.trimEnd - window.audioEngine.trimStart;
    } else {
      const clickTime = (x / w) * dur;
      if (Math.abs(clickTime - window.audioEngine.trimStart) < Math.abs(clickTime - window.audioEngine.trimEnd)) {
        this.waveformDragTarget = 'start';
        this.setTrimStart(clickTime);
      } else {
        this.waveformDragTarget = 'end';
        this.setTrimEnd(clickTime);
      }
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
  }

  onWaveformPointerMove(e) {
    if (!this.waveformCanvas) return;
    const rect = this.waveformCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const w = rect.width;
    const dur = Math.max(1, window.audioEngine.duration || 15);

    if (this.waveformDragTarget) {
      const time = (x / w) * dur;
      if (this.waveformDragTarget === 'start') {
        this.setTrimStart(time);
      } else if (this.waveformDragTarget === 'end') {
        this.setTrimEnd(time);
      } else if (this.waveformDragTarget === 'window') {
        let newStart = time - this.waveformDragOffsetX;
        let newEnd = newStart + this.waveformDragLength;
        if (newStart < 0) {
          newStart = 0;
          newEnd = this.waveformDragLength;
        } else if (newEnd > dur) {
          newEnd = dur;
          newStart = dur - this.waveformDragLength;
        }
        window.audioEngine.trimStart = parseFloat(Math.max(0, newStart).toFixed(1));
        window.audioEngine.trimEnd = parseFloat(Math.min(dur, newEnd).toFixed(1));
        const sliderS = document.getElementById('sliderTrimStart');
        const inputS = document.getElementById('inputTrimStartExact');
        const badgeS = document.getElementById('trimStartVal');
        if (sliderS) sliderS.value = window.audioEngine.trimStart;
        if (inputS) inputS.value = window.audioEngine.trimStart;
        if (badgeS) badgeS.textContent = `${window.audioEngine.trimStart.toFixed(1)}s`;

        const sliderE = document.getElementById('sliderTrimEnd');
        const inputE = document.getElementById('inputTrimEndExact');
        const badgeE = document.getElementById('trimEndVal');
        if (sliderE) sliderE.value = window.audioEngine.trimEnd;
        if (inputE) inputE.value = window.audioEngine.trimEnd;
        if (badgeE) badgeE.textContent = `${window.audioEngine.trimEnd.toFixed(1)}s`;

        this.drawWaveform();
      }
    } else {
      const startX = (window.audioEngine.trimStart / dur) * w;
      const endX = (window.audioEngine.trimEnd / dur) * w;
      if (Math.abs(x - startX) <= 14 || Math.abs(x - endX) <= 14) {
        this.waveformCanvas.style.cursor = 'ew-resize';
      } else if (x > startX && x < endX) {
        this.waveformCanvas.style.cursor = 'grab';
      } else {
        this.waveformCanvas.style.cursor = 'pointer';
      }
    }
  }

  onWaveformPointerUp(e) {
    if (this.waveformDragTarget) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
      this.waveformDragTarget = null;
      this.drawWaveform();
    }
  }

  drawWaveform() {
    if (!this.waveformCanvas) return;
    const w = this.waveformCanvas.clientWidth || 300;
    const h = 52;
    if (this.waveformCanvas.width !== w || this.waveformCanvas.height !== h) {
      this.waveformCanvas.width = w;
      this.waveformCanvas.height = h;
    }
    const ctx = this.waveformCtx;
    ctx.clearRect(0, 0, w, h);

    const dur = Math.max(1, window.audioEngine.duration || 15);
    const trimStart = window.audioEngine.trimStart || 0;
    const trimEnd = window.audioEngine.trimEnd || 15;
    const startX = (trimStart / dur) * w;
    const endX = (trimEnd / dur) * w;

    // 1. Sleek background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // 2. Active Trim Window Background Glow
    ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
    ctx.fillRect(startX, 0, endX - startX, h);

    // 3. Audio waveform bars
    const data = window.audioEngine.waveformData || [];
    if (data.length > 0) {
      const barW = Math.max(2, w / data.length);
      for (let i = 0; i < data.length; i++) {
        const barX = i * barW;
        const barVal = data[i];
        const barH = Math.max(4, barVal * (h - 14));
        const isInsideTrim = (barX + barW >= startX && barX <= endX);

        if (isInsideTrim) {
          const grad = ctx.createLinearGradient(0, (h - barH) / 2, 0, (h + barH) / 2);
          grad.addColorStop(0, '#38bdf8');
          grad.addColorStop(1, '#06b6d4');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        }

        ctx.beginPath();
        ctx.roundRect(barX, (h - barH) / 2, Math.max(1.5, barW - 1), barH, 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    }

    // 4. Dimmed overlays outside the trim window
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    if (startX > 0) ctx.fillRect(0, 0, startX, h);
    if (endX < w) ctx.fillRect(endX, 0, w - endX, h);

    // 5. Left Trim Pin (Start Handle)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(startX - 1.5, 0, 3, h);
    ctx.beginPath();
    ctx.roundRect(startX - 10, 2, 20, 16, 4);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('▶', startX, 10);

    // 6. Right Trim Pin (End Handle)
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(endX - 1.5, 0, 3, h);
    ctx.beginPath();
    ctx.roundRect(endX - 10, 2, 20, 16, 4);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◀', endX, 10);

    // 7. Time badges at bottom of handles
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(Math.max(2, startX - 18), h - 14, 36, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`${trimStart.toFixed(1)}s`, Math.max(20, startX), h - 8);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.beginPath();
    ctx.roundRect(Math.min(w - 38, endX - 18), h - 14, 36, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`${trimEnd.toFixed(1)}s`, Math.min(w - 20, endX), h - 8);

    // 8. Playhead Needle (If currently playing)
    if (window.audioEngine.isPlaying && window.audioEngine.ctx) {
      const elapsedSincePlay = window.audioEngine.ctx.currentTime - window.audioEngine.playbackStartTime;
      const playLen = Math.max(0.1, trimEnd - trimStart);
      const curPosSec = trimStart + (elapsedSincePlay % playLen);
      const needleX = (curPosSec / dur) * w;

      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(needleX - 1, 0, 2, h);
      ctx.beginPath();
      ctx.arc(needleX, 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // =========================================================================
  // CHROMA-KEY GIF BACKGROUND REMOVER
  // =========================================================================

  openChromaKeyModal() {
    const gifData = this.loadedGifs.get(this.activeCharType);
    if (!gifData) {
      this.showToast('Select or upload a character first', 'error');
      return;
    }
    this.activeChromaGif = gifData;
    this.chromaCanvas.width = gifData.width;
    this.chromaCanvas.height = gifData.height;

    // Auto-detect dominant bg
    const bg = window.gifEngine.detectBackgroundColor(gifData);
    const hex = '#' + ((1 << 24) + (bg.r << 16) + (bg.g << 8) + bg.b).toString(16).slice(1);
    document.getElementById('inputChromaColor').value = hex;

    this.updateChromaPreview();
    document.getElementById('chromaKeyModal').classList.add('active');
  }

  updateChromaPreview() {
    if (!this.activeChromaGif) return;
    const f0 = this.activeChromaGif.frames[0].canvas;
    this.chromaCtx.clearRect(0, 0, this.chromaCanvas.width, this.chromaCanvas.height);
    this.chromaCtx.drawImage(f0, 0, 0);
  }

  applyChromaKeyToActive() {
    if (!this.activeChromaGif) return;
    const hex = document.getElementById('inputChromaColor').value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const tol = parseInt(document.getElementById('sliderChromaTol').value) || 35;

    window.gifEngine.applyChromaKey(this.activeChromaGif, { r, g, b }, tol);
    document.getElementById('chromaKeyModal').classList.remove('active');
    this.showToast('✨ Background removed! Transparent character ready.', 'success');
  }

  // =========================================================================
  // INDEXEDDB UPLOAD GALLERIES
  // =========================================================================

  async refreshSavedUploadsUI() {
    if (!window.storageManager) return;

    // 1. Saved Characters
    const savedChars = await window.storageManager.getAllItems('characters');
    const charList = document.getElementById('customCharsList');
    if (savedChars.length > 0) {
      charList.innerHTML = '';
      for (const item of savedChars) {
        const div = document.createElement('div');
        div.className = 'uploaded-item-card';
        div.innerHTML = `
          <span>${item.name}</span>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-primary btn-sm" title="Use character">Use</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--accent-rose);" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
        div.querySelector('.btn-primary').addEventListener('click', async () => {
          let gifData = this.loadedGifs.get(item.id);
          if (!gifData) {
            gifData = window.gifEngine.decode(item.data, item.name);
            this.loadedGifs.set(item.id, gifData);
          }
          this.setCharacterType(item.id, item.name.replace('.gif', ''));
        });
        div.querySelector('.btn-secondary').addEventListener('click', async () => {
          await window.storageManager.deleteItem('characters', item.id);
          this.refreshSavedUploadsUI();
        });
        charList.appendChild(div);
      }
    }

    // 2. Saved Backdrops
    const savedBgs = await window.storageManager.getAllItems('backgrounds');
    const bgSection = document.getElementById('savedBackdropsSection');
    const bgList = document.getElementById('savedBackdropsList');
    if (savedBgs.length > 0) {
      bgSection.style.display = 'block';
      bgList.innerHTML = '';
      for (const item of savedBgs) {
        const thumb = document.createElement('div');
        thumb.className = 'bg-thumb-card';
        thumb.style.width = '70px';
        thumb.style.flexShrink = '0';
        thumb.innerHTML = `
          <img src="${item.dataUrl}">
          <button class="btn btn-secondary btn-sm" style="position:absolute; top:2px; right:2px; padding:2px; font-size:10px; color:var(--accent-rose);">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;
        thumb.querySelector('img').addEventListener('click', () => {
          this.loadBackground(item.dataUrl, item.id);
        });
        thumb.querySelector('button').addEventListener('click', async (e) => {
          e.stopPropagation();
          await window.storageManager.deleteItem('backgrounds', item.id);
          this.refreshSavedUploadsUI();
        });
        bgList.appendChild(thumb);
      }
    } else {
      bgSection.style.display = 'none';
    }

    // 3. Saved Audio
    const savedAudio = await window.storageManager.getAllItems('audio');
    const audioSection = document.getElementById('savedAudioSection');
    const audioList = document.getElementById('savedAudioList');
    if (savedAudio.length > 0) {
      audioSection.style.display = 'block';
      audioList.innerHTML = '';
      for (const item of savedAudio) {
        const row = document.createElement('div');
        row.className = 'uploaded-item-card';
        const sizeStr = item.size ? `(${Math.round(item.size / 1024)} KB)` : '';
        row.innerHTML = `
          <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;" title="${item.name}">
            <strong style="font-size:0.8rem;">${item.name}</strong> <span style="font-size:0.68rem; color:var(--text-muted);">${sizeStr}</span>
          </div>
          <div style="display:flex; gap:4px; align-items:center;">
            <button class="btn btn-secondary btn-sm btn-preview" title="Audition track"><i class="fa-solid fa-play"></i></button>
            <button class="btn btn-primary btn-sm btn-use" title="Use as soundtrack">Use</button>
            <button class="btn btn-secondary btn-sm btn-delete" style="color:var(--accent-rose);" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        `;
        const previewBtn = row.querySelector('.btn-preview');
        previewBtn.addEventListener('click', async () => {
          const isPlaying = await window.audioEngine.playPreview(item.data);
          previewBtn.innerHTML = isPlaying ? '<i class="fa-solid fa-stop"></i>' : '<i class="fa-solid fa-play"></i>';
        });
        row.querySelector('.btn-use').addEventListener('click', async () => {
          window.audioEngine.stopPreview();
          await window.audioEngine.loadFromArrayBuffer(item.data, item.name);
          document.getElementById('currentTrackBadge').textContent = item.name;
          this.drawWaveform();
          this.showToast(`Soundtrack loaded: "${item.name}"`, 'success');
        });
        row.querySelector('.btn-delete').addEventListener('click', async () => {
          window.audioEngine.stopPreview();
          await window.storageManager.deleteItem('audio', item.id);
          this.refreshSavedUploadsUI();
        });
        audioList.appendChild(row);
      }
    } else {
      audioSection.style.display = 'none';
    }
  }

  // =========================================================================
  // LAYER DOCK & INSPECTOR UI
  // =========================================================================

  renderLayerList() {
    const container = document.getElementById('layerListScroller');
    // Preserve scroll position to prevent jumping
    const scrollPos = container.scrollTop;
    container.innerHTML = '';

    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const isSelected = a.id === this.selectedAnimalId;

      const card = document.createElement('div');
      card.className = `layer-item-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="layer-info">
          <span class="layer-badge">${a.index}</span>
          <span class="layer-name">Animal #${a.index} (${Math.round(a.scale * 100)}%)</span>
        </div>
        <div class="layer-actions">
          <button class="btn btn-secondary btn-sm" title="Pinpoint" onclick="studio.locateAnimal('${a.id}')">
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
    container.scrollTop = scrollPos;
  }

  updateInspectorUI(animal) {
    if (!animal) return;
    document.getElementById('inspectAnimalTitle').textContent = `Selected: Animal #${animal.index}`;
    document.getElementById('sliderInspectScale').value = Math.round(animal.scale * 100);
    document.getElementById('inputInspectScaleExact').value = Math.round(animal.scale * 100);
    document.getElementById('inspectScaleVal').textContent = `${Math.round(animal.scale * 100)}%`;

    document.getElementById('sliderInspectRot').value = animal.rotation;
    document.getElementById('inputInspectRotExact').value = animal.rotation;
    document.getElementById('inspectRotVal').textContent = `${animal.rotation}°`;

    document.getElementById('inputInspectXExact').value = (animal.nx * 100).toFixed(1);
    document.getElementById('inputInspectYExact').value = (animal.ny * 100).toFixed(1);
  }

  locateAnimal(id) {
    this.selectedAnimalId = id;
    const a = this.animals.find(item => item.id === id);
    if (a) this.updateInspectorUI(a);
    this.renderLayerList();
    this.showToast(`Selected Animal #${a ? a.index : ''}`, 'info');
  }

  // =========================================================================
  // FLAWLESS REAL-TIME VIDEO EXPORT WITH EBML DURATION PATCHING
  // =========================================================================

  async startVideoExport() {
    if (this.isExporting) return;
    this.isExporting = true;
    if (this.isPlaying) {
      this.togglePlayback(); // ensure canvas preview is paused
    }

    // 1. Resume AudioContext within this user gesture with a timeout guard so it never blocks export
    let hasAudio = false;
    if (window.audioEngine) {
      window.audioEngine.ensureContext();
      if (window.audioEngine.ctx && window.audioEngine.ctx.state === 'suspended') {
        try {
          await Promise.race([
            window.audioEngine.ctx.resume(),
            new Promise(r => setTimeout(r, 200))
          ]);
        } catch (e) {
          console.warn('AudioContext resume warning:', e);
        }
      }
      if (window.audioEngine.ctx && window.audioEngine.ctx.state === 'running' && window.audioEngine.currentBuffer) {
        hasAudio = true;
      }
    }

    const modal = document.getElementById('exportModal');
    modal.classList.add('active');
    document.getElementById('exportModalActions').style.display = 'none';
    document.getElementById('btnCancelExport').style.display = 'block';
    document.getElementById('exportLiveCanvasContainer').style.display = 'flex';
    document.getElementById('exportPlaybackContainer').style.display = 'none';
    document.getElementById('exportModalTitle').textContent = 'Rendering & Recording High-Definition Video...';

    const bar = document.getElementById('exportProgressBar');
    const pct = document.getElementById('exportProgressPct');
    const framesLabel = document.getElementById('exportProgressFrames');
    const etaLabel = document.getElementById('exportEta');
    bar.style.width = '0%';
    pct.textContent = '0%';
    framesLabel.textContent = `0.0s / ${this.videoDuration}s`;
    etaLabel.textContent = 'Starting...';

    // Resolution computation
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

    // Mounted DOM Canvas: Ensures Chromium composites all 30/60 FPS frames without stalling!
    const exportCanvas = document.getElementById('exportLiveCanvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    const exportCtx = exportCanvas.getContext('2d', { alpha: false });

    // Pre-draw frame 0 so captureStream immediately receives a full-quality graphic
    this.drawFrame(exportCtx, exportW, exportH, 0, true);

    const totalSeconds = this.videoDuration + (this.appendRevealEnding ? 3 : 0);
    const targetDurationMs = totalSeconds * 1000;

    // Stream Setup
    const stream = exportCanvas.captureStream(this.fps);
    if (hasAudio) {
      const audioTrack = window.audioEngine.getAudioTrack();
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    }

    // Codec determination: MP4 (H.264 / AAC) is the universal default for all Windows & mobile players
    let mimeType = 'video/mp4';
    let fileExt = 'mp4';

    if (this.exportFormat === 'webm') {
      mimeType = hasAudio && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm');
      fileExt = 'webm';
    } else {
      // Universal MP4 (H.264 / AAC)
      if (hasAudio && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2')) {
        mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
        fileExt = 'mp4';
      } else if (!hasAudio && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
        mimeType = 'video/mp4;codecs=avc1';
        fileExt = 'mp4';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
        fileExt = 'mp4';
      } else {
        // Fallback to WebM only if the browser has no MP4 recording support
        mimeType = hasAudio && MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';
        fileExt = 'webm';
      }
    }

    this.exportChunks = [];
    try {
      this.exportMediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: this.bitrate
      });
    } catch (e) {
      console.warn('Fallback to standard MediaRecorder options:', e);
      this.exportMediaRecorder = new MediaRecorder(stream);
    }

    this.exportMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.exportChunks.push(e.data);
    };

    this.exportMediaRecorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      this.showToast('Recording error occurred during video capture', 'error');
    };

    // ON STOP: Fix EBML metadata using fix-webm-duration so it plays without freezing!
    this.exportMediaRecorder.onstop = () => {
      if (hasAudio) {
        window.audioEngine.stop();
      }
      const rawBlob = new Blob(this.exportChunks, { type: mimeType });

      if (rawBlob.size === 0) {
        this.showToast('Export failed: Empty recording. Please try again.', 'error');
        this.cancelVideoExport();
        return;
      }

      // If WebM, apply EBML Duration Fixer to guarantee flawless, seekable playback
      if (fileExt === 'webm' && typeof window.ysFixWebmDuration === 'function') {
        window.ysFixWebmDuration(rawBlob, targetDurationMs, (fixedBlob) => {
          this.finalizeExportDownload(fixedBlob, fileExt);
        });
      } else {
        this.finalizeExportDownload(rawBlob, fileExt);
      }
    };

    // START REAL-TIME WALL CLOCK RECORDING
    if (hasAudio) {
      window.audioEngine.play(0, true); // Synchronized looping audio playback
    }
    this.exportMediaRecorder.start(100); // 100ms timeslice sends continuous chunks

    const startTime = performance.now();
    const frameInterval = 1000 / this.fps; // ~33.3ms for 30fps
    let lastRenderTime = -frameInterval;

    const recordTick = () => {
      if (!this.isExporting) return;

      const elapsedMs = performance.now() - startTime;
      const progress = Math.min(1.0, elapsedMs / targetDurationMs);

      // Paced frame rendering: only redraw when at least frameInterval has passed
      if (elapsedMs - lastRenderTime >= frameInterval * 0.92 || elapsedMs >= targetDurationMs) {
        lastRenderTime = elapsedMs;

        const isRevealSection = this.appendRevealEnding && (elapsedMs >= this.videoDuration * 1000);
        const prevReveal = this.answerRevealMode;
        if (isRevealSection) this.answerRevealMode = true;

        this.drawFrame(exportCtx, exportW, exportH, elapsedMs, true);
        this.answerRevealMode = prevReveal;
      }

      // Update UI progress accurately
      bar.style.width = `${Math.round(progress * 100)}%`;
      pct.textContent = `${Math.round(progress * 100)}%`;
      framesLabel.textContent = `${(elapsedMs / 1000).toFixed(1)}s / ${totalSeconds.toFixed(1)}s`;

      const eta = progress > 0 ? Math.max(0, Math.round(((elapsedMs / progress) - elapsedMs) / 1000)) : 0;
      etaLabel.textContent = `ETA: ${eta}s`;

      if (elapsedMs < targetDurationMs) {
        requestAnimationFrame(recordTick);
      } else {
        // Complete recording at exact millisecond, flushing final chunks!
        if (this.exportMediaRecorder && this.exportMediaRecorder.state !== 'inactive') {
          try {
            this.exportMediaRecorder.requestData();
          } catch (e) {}
          setTimeout(() => {
            if (this.exportMediaRecorder && this.exportMediaRecorder.state !== 'inactive') {
              this.exportMediaRecorder.stop();
            }
          }, 150);
        }
      }
    };

    requestAnimationFrame(recordTick);
  }

  finalizeExportDownload(blob, fileExt = 'mp4') {
    const url = URL.createObjectURL(blob);
    const downloadBtn = document.getElementById('btnDownloadExportedVideo');
    downloadBtn.href = url;
    downloadBtn.download = `find-${this.animals.length}-animals_${this.resolutionPreset}_SmartBrain.${fileExt}`;
    const mbSize = (blob.size / (1024 * 1024)).toFixed(1);
    downloadBtn.innerHTML = `<i class="fa-solid fa-download"></i> Download Video (.${fileExt.toUpperCase()} - ${mbSize} MB)`;

    // Show live in-modal video player for instant playback verification
    document.getElementById('exportLiveCanvasContainer').style.display = 'none';
    const playbackContainer = document.getElementById('exportPlaybackContainer');
    playbackContainer.style.display = 'flex';
    const videoPlayer = document.getElementById('exportVideoPlayer');
    videoPlayer.src = url;
    videoPlayer.currentTime = 0;
    videoPlayer.play().catch(() => {});

    document.getElementById('exportModalTitle').textContent = '🎉 Video Export Complete & Ready!';
    document.getElementById('exportModalActions').style.display = 'flex';
    document.getElementById('btnCancelExport').style.display = 'none';
    this.isExporting = false;
    this.showToast(`🎉 Video Export Complete (${mbSize} MB)!`, 'success');

    // Automatically trigger instant browser download to user's device
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadBtn.download;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 100);
    } catch (e) {
      console.warn('Auto download error:', e);
    }
  }

  cancelVideoExport() {
    this.isExporting = false;
    if (this.exportMediaRecorder && this.exportMediaRecorder.state !== 'inactive') {
      this.exportMediaRecorder.stop();
    }
    window.audioEngine.stop();
    const videoPlayer = document.getElementById('exportVideoPlayer');
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.src = '';
    }
    document.getElementById('exportModal').classList.remove('active');
    this.showToast('Export cancelled', 'info');
  }

  // =========================================================================
  // PROJECT PRESETS JSON (SAVE & LOAD)
  // =========================================================================

  saveProjectJson() {
    const data = {
      version: 2,
      aspectRatio: this.aspectRatio,
      duration: this.videoDuration,
      bg: { ...this.bg, img: null },
      activeCharType: this.activeCharType,
      animals: this.animals,
      title: this.title,
      watermark: this.watermark,
      timer: this.timer
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
        if (data.timer) Object.assign(this.timer, data.timer);
        if (data.bg) Object.assign(this.bg, data.bg);
        if (data.activeCharType) this.setCharacterType(data.activeCharType);

        this.updateTitleCount();
        this.renderLayerList();
        this.pushHistoryState('Loaded project JSON');
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
