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
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
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
    this.bitrate = 8000000; // 8 Mbps social video optimized (crisp & compact)
    this.exportFormat = 'mp4'; // 'mp4' (universal default) or 'webm'
    this.currentTime = 0;
    this.isPlaying = false;
    this.lastFrameTime = 0;
    this.globalOpacity = 1.0;
    this.saveStateTimeout = null;

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

    // Countdown Timer (Disabled by default, customizable clock styles, bigger size & positionable)
    this.timer = {
      enabled: false,
      style: 'radial_ring', // 'radial_ring', 'analog_clock', 'digital_badge', 'top_bar', 'bottom_bar', 'none'
      size: 130,
      nx: 0.88,
      ny: 0.08,
      height: 10,
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
    this.syncTimerUI();

    // 1. Initialize IndexedDB and preload any custom characters in storage
    if (window.storageManager) {
      try {
        await window.storageManager.init();
        await this.loadAllCustomCharactersFromStorage();
        this.refreshSavedUploadsUI();
      } catch (e) {
        console.warn('StorageManager init warning:', e);
      }
    }

    // 2. Preload built-in characters so GIFs are immediately decoded and ready
    await this.preloadBuiltinCharacters();

    // 3. Restore LocalStorage or set defaults
    const restored = this.loadStateFromLocalStorage();
    if (!restored) {
      this.setAspectRatio('9:16');
      this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');
      this.generateAnimals(15, true);
    } else {
      this.showToast('✨ Restored your last session from local storage', 'info');
    }
    this.pushHistoryState('Initial setup');

    // 4. Start 60fps render loop immediately
    requestAnimationFrame(this.renderLoop.bind(this));

    // 5. Generate initial Quack Hop BGM (defaults to full track length and syncs duration only if not restored)
    window.audioEngine.generatePresetBGM('quack_hop', 15).then(() => {
      this.onAudioTrackLoaded('Quack Hop', window.audioEngine.duration, !restored, false);
    });

    this.showToast('🦆 Animal Dance Studio Ready!', 'success');
  }

  // =========================================================================
  // PRELOAD & RESTORE CHARACTERS
  // =========================================================================

  async loadAllCustomCharactersFromStorage() {
    if (!window.storageManager) return;
    try {
      const savedChars = await window.storageManager.getAllItems('characters');
      for (const item of savedChars) {
        if (item.data && !this.loadedGifs.has(item.id)) {
          const gifData = window.gifEngine.decode(item.data, item.name);
          this.loadedGifs.set(item.id, gifData);
        }
      }
    } catch (e) {
      console.warn('Error loading custom characters from storage:', e);
    }
  }

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

    await Promise.all(chars.map(c => this.loadCharacterGif(c.id, c.url)));
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

    // Update existing animals to new character - strictly same as GIF (flipX = false by default)
    this.animals.forEach(a => {
      a.charId = charId;
      a.flipX = false;
    });
    this.renderLayerList();
    if (this.selectedAnimalId) {
      const sel = this.animals.find(item => item.id === this.selectedAnimalId);
      if (sel) this.updateInspectorUI(sel);
    }
    this.pushHistoryState(`Changed character to ${name}`);
    this.debouncedSaveState();
  }

  // =========================================================================
  // BACKGROUND LOADING
  // =========================================================================

  loadBackground(src, presetId = null) {
    this.bg.isLoaded = false;
    this.bg.presetId = presetId;
    this.bg.src = src;
    if (presetId === 'custom_bg' || (src && src.startsWith('data:'))) {
      this.bg.customUrl = src;
    } else {
      this.bg.customUrl = null;
    }
    this.bg.img = new Image();
    this.bg.img.crossOrigin = 'anonymous';
    this.bg.img.onload = () => {
      this.bg.isLoaded = true;
    };
    this.bg.img.src = src;

    document.querySelectorAll('.bg-thumb-card').forEach(card => {
      card.classList.toggle('active', card.dataset.bg === presetId);
    });
    this.debouncedSaveState();
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

  // Calculates collision-free positions so animals are never stacked on top of each other
  findNonOverlappingPosition(existingAnimals, tier, scale, smartDepth, aspect, padding = 0.025) {
    if (!existingAnimals || existingAnimals.length === 0) {
      if (smartDepth) {
        if (tier === 'foreground') return { nx: 0.15 + Math.random() * 0.70, ny: 0.65 + Math.random() * 0.22 };
        if (tier === 'midground') return { nx: 0.12 + Math.random() * 0.76, ny: 0.40 + Math.random() * 0.22 };
        return { nx: 0.15 + Math.random() * 0.70, ny: 0.22 + Math.random() * 0.15 };
      }
      return { nx: 0.12 + Math.random() * 0.76, ny: 0.25 + Math.random() * 0.60 };
    }

    let bestPos = null;
    let bestMinDist = -1;

    for (let attempt = 0; attempt < 90; attempt++) {
      let nx, ny;
      if (smartDepth) {
        if (tier === 'foreground') {
          nx = 0.10 + Math.random() * 0.80;
          ny = 0.64 + Math.random() * 0.24;
        } else if (tier === 'midground') {
          nx = 0.08 + Math.random() * 0.84;
          ny = 0.38 + Math.random() * 0.25;
        } else {
          nx = 0.10 + Math.random() * 0.80;
          ny = 0.20 + Math.random() * 0.17;
        }
      } else {
        nx = 0.08 + Math.random() * 0.84;
        ny = 0.20 + Math.random() * 0.68;
      }

      let collides = false;
      let nearestDist = Infinity;

      for (let j = 0; j < existingAnimals.length; j++) {
        const other = existingAnimals[j];
        const dx = nx - other.nx;
        const dy = (ny - other.ny) * aspect;
        const dist = Math.hypot(dx, dy);

        // Required center-to-center distance based on sprite sizes so they never overlap
        const requiredDist = 0.045 * (scale + (other.scale || 0.7)) + padding;

        if (dist < requiredDist) {
          collides = true;
        }
        if (dist < nearestDist) {
          nearestDist = dist;
        }
      }

      // Found a candidate that doesn't overlap any existing animal
      if (!collides) {
        return { nx, ny };
      }

      // Track candidate with maximum separation
      if (nearestDist > bestMinDist) {
        bestMinDist = nearestDist;
        bestPos = { nx, ny };
      }
    }

    return bestPos || { nx: 0.15 + Math.random() * 0.70, ny: 0.30 + Math.random() * 0.50 };
  }

  generateAnimals(count, smartDepth = true) {
    this.animalCount = count;
    this.animals = [];
    const aspect = (this.canvasHeight || 1920) / (this.canvasWidth || 1080);
    const padding = Math.max(0.012, 0.032 - (count - 15) * 0.0008);

    for (let i = 0; i < count; i++) {
      let tier = 'midground';
      let scale = 0.65;
      if (smartDepth) {
        const r = Math.random();
        if (r < 0.25) {
          tier = 'foreground';
          scale = 0.72 + Math.random() * 0.20; // 0.72 - 0.92 (moderate, not too big)
        } else if (r < 0.65) {
          tier = 'midground';
          scale = 0.52 + Math.random() * 0.18; // 0.52 - 0.70
        } else {
          tier = 'background';
          scale = 0.38 + Math.random() * 0.14; // 0.38 - 0.52
        }
      } else {
        scale = 0.48 + Math.random() * 0.24; // 0.48 - 0.72
      }

      const pos = this.findNonOverlappingPosition(this.animals, tier, scale, smartDepth, aspect, padding);

      this.animals.push({
        id: `animal_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
        index: i + 1,
        charId: this.activeCharType,
        nx: Math.max(0.06, Math.min(0.94, parseFloat(pos.nx.toFixed(3)))),
        ny: Math.max(0.18, Math.min(0.92, parseFloat(pos.ny.toFixed(3)))),
        scale: parseFloat(scale.toFixed(2)),
        rotation: 0, // Clean 0° angle by default (user can change later)
        flipX: false, // Same as original GIF by default (no random flip)
        opacity: this.globalOpacity !== undefined ? this.globalOpacity : 1.0,
        baseWidth: 100,
        baseHeight: 100
      });
    }

    this.sortAnimalsByDepth();
    this.updateTitleCount();
    this.renderLayerList();
    this.debouncedSaveState();
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
      a.scale = parseFloat((0.40 + Math.random() * 0.40).toFixed(2)); // Compact 0.40 to 0.80 range
    });
    this.renderLayerList();
    this.pushHistoryState('Randomize sizes');
    this.showToast('🎲 Animal sizes randomized (compact & clear)!', 'info');
  }

  reshufflePositions() {
    const aspect = (this.canvasHeight || 1920) / (this.canvasWidth || 1080);
    const count = this.animals.length;
    const padding = Math.max(0.012, 0.032 - (count - 15) * 0.0008);
    const placed = [];

    this.animals.forEach(a => {
      let bestPos = { nx: a.nx, ny: a.ny };
      let bestMinDist = -1;

      for (let attempt = 0; attempt < 80; attempt++) {
        const nx = 0.08 + Math.random() * 0.84;
        const ny = 0.20 + Math.random() * 0.70;
        let collides = false;
        let nearestDist = Infinity;

        for (const other of placed) {
          const dist = Math.hypot(nx - other.nx, (ny - other.ny) * aspect);
          const req = 0.045 * (a.scale + other.scale) + padding;
          if (dist < req) collides = true;
          if (dist < nearestDist) nearestDist = dist;
        }

        if (!collides) {
          bestPos = { nx, ny };
          break;
        }
        if (nearestDist > bestMinDist) {
          bestMinDist = nearestDist;
          bestPos = { nx, ny };
        }
      }

      a.nx = Math.max(0.06, Math.min(0.94, parseFloat(bestPos.nx.toFixed(3))));
      a.ny = Math.max(0.18, Math.min(0.92, parseFloat(bestPos.ny.toFixed(3))));
      a.flipX = a.flipX || false; // Preserve existing orientation, no random flip
      placed.push({ nx: a.nx, ny: a.ny, scale: a.scale });
    });

    this.sortAnimalsByDepth();
    this.renderLayerList();
    this.pushHistoryState('Reshuffle positions');
    this.showToast('🔀 Positions reshuffled cleanly without overlap!', 'info');
  }

  // Adds single animal with automatic collision avoidance and 0° angle by default
  addSingleAnimal() {
    const scale = 0.72; // Moderate, not too big
    const aspect = (this.canvasHeight || 1920) / (this.canvasWidth || 1080);

    let nx = 0.5;
    let ny = 0.5;

    const isFree = (cx, cy) => {
      for (const a of this.animals) {
        const dist = Math.hypot(cx - a.nx, (cy - a.ny) * aspect);
        const req = 0.045 * (scale + a.scale) + 0.025;
        if (dist < req) return false;
      }
      return true;
    };

    if (!isFree(nx, ny)) {
      let found = false;
      for (let r = 0.07; r <= 0.42 && !found; r += 0.035) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
          const cx = Math.max(0.08, Math.min(0.92, 0.5 + Math.cos(angle) * r));
          const cy = Math.max(0.20, Math.min(0.88, 0.5 + (Math.sin(angle) * r) / aspect));
          if (isFree(cx, cy)) {
            nx = cx;
            ny = cy;
            found = true;
            break;
          }
        }
      }
    }

    const newAnimal = {
      id: `animal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      index: this.animals.length + 1,
      charId: this.activeCharType,
      nx: parseFloat(nx.toFixed(3)),
      ny: parseFloat(ny.toFixed(3)),
      scale: scale,
      rotation: 0, // 0 degree angle by default
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
    this.showToast('Added +1 Animal without overlap (0° angle)', 'success');
  }

  toggleFlipAnimal(id = null) {
    const targetId = id || this.selectedAnimalId;
    const a = this.animals.find(item => item.id === targetId);
    if (!a) return;
    a.flipX = !a.flipX;
    this.updateInspectorUI(a);
    this.renderLayerList();
    this.pushHistoryState(`Flip Animal #${a.index}`);
    this.showToast(`Animal #${a.index} ${a.flipX ? 'flipped horizontally (mirrored)' : 'restored to original GIF facing'}`, 'info');
  }

  resetAllFlips() {
    this.animals.forEach(a => a.flipX = false);
    if (this.selectedAnimalId) {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (a) this.updateInspectorUI(a);
    }
    this.renderLayerList();
    this.pushHistoryState('Reset all flips to original GIF');
    this.showToast('All animals restored to original GIF orientation!', 'success');
  }

  flipAllAnimals() {
    this.animals.forEach(a => a.flipX = !a.flipX);
    if (this.selectedAnimalId) {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (a) this.updateInspectorUI(a);
    }
    this.renderLayerList();
    this.pushHistoryState('Flip all animals');
    this.showToast('All animals flipped horizontally!', 'info');
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
    const aspect = (this.canvasHeight || 1920) / (this.canvasWidth || 1080);

    let newNx = a.nx + 0.06;
    let newNy = a.ny + 0.04;

    const isFree = (cx, cy) => {
      for (const other of this.animals) {
        const dist = Math.hypot(cx - other.nx, (cy - other.ny) * aspect);
        const req = 0.045 * (a.scale + other.scale) + 0.02;
        if (dist < req) return false;
      }
      return true;
    };

    if (!isFree(newNx, newNy)) {
      for (let r = 0.07; r <= 0.25; r += 0.035) {
        let placed = false;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
          const cx = Math.max(0.08, Math.min(0.92, a.nx + Math.cos(angle) * r));
          const cy = Math.max(0.20, Math.min(0.88, a.ny + (Math.sin(angle) * r) / aspect));
          if (isFree(cx, cy)) {
            newNx = cx;
            newNy = cy;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
    }

    const copy = {
      ...a,
      id: `animal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      nx: Math.max(0.06, Math.min(0.94, parseFloat(newNx.toFixed(3)))),
      ny: Math.max(0.18, Math.min(0.92, parseFloat(newNy.toFixed(3))))
    };
    this.animals.push(copy);
    this.selectedAnimalId = copy.id;
    this.sortAnimalsByDepth();
    this.updateTitleCount();
    this.renderLayerList();
    this.pushHistoryState('Duplicate animal');
    this.showToast('Animal duplicated without overlap', 'info');
  }

  // =========================================================================
  // VIEWPORT ZOOM (Does NOT affect video export resolution!)
  // =========================================================================

  setViewportZoom(zoomFactor) {
    this.viewportZoom = zoomFactor;
    const label = document.getElementById('viewportZoomLabel');
    // Always keep top edge anchored so zooming never overflows or covers top toolbar/menus!
    this.stageWrapper.style.transformOrigin = 'top center';

    if (zoomFactor === 1.0) {
      label.textContent = 'Fit';
      this.stageWrapper.style.transform = 'scale(1)';
      this.stageWrapper.style.marginBottom = '0px';
    } else {
      label.textContent = `${Math.round(zoomFactor * 100)}%`;
      this.stageWrapper.style.transform = `scale(${zoomFactor})`;
      // Create scrollable room downwards so the user can scroll down to view bottom content
      const baseHeight = this.canvas.clientHeight || 500;
      const extraBottom = Math.round((zoomFactor - 1.0) * baseHeight);
      this.stageWrapper.style.marginBottom = `${extraBottom}px`;
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
  // VIDEO DURATION & AUDIO AUTO-SYNC
  // =========================================================================

  setVideoDuration(val, notify = true) {
    const dur = Math.max(3, Math.min(300, Math.round(val) || 15));
    this.videoDuration = dur;

    // Update custom input in Export tab
    const customInput = document.getElementById('inputCustomDuration');
    if (customInput) customInput.value = dur;

    // Update scrubber on stage
    const scrubber = document.getElementById('stageTimeScrubber');
    if (scrubber) scrubber.max = dur;

    // Highlight matching chip if available, or clear active chips
    document.querySelectorAll('.preset-chip[data-dur]').forEach(c => {
      c.classList.toggle('active', parseInt(c.dataset.dur) === dur);
    });

    // Update playhead readout
    this.updatePlayheadUI();

    if (notify) {
      this.showToast(`Export length set to ${dur}s`, 'info');
    }
  }

  onAudioTrackLoaded(name, duration, updateVideoDuration = true, showToast = true) {
    const fullDur = parseFloat(duration.toFixed(1));
    // 1. By default select full length of audio
    window.audioEngine.trimStart = 0;
    window.audioEngine.trimEnd = fullDur;

    // 2. Update track badges across tabs
    const badge = document.getElementById('currentTrackBadge');
    if (badge) badge.textContent = name;

    const trimBadge = document.getElementById('audioTrimLenBadge');
    if (trimBadge) trimBadge.textContent = `${fullDur}s`;

    const exportBadge = document.getElementById('exportAudioLenBadge');
    if (exportBadge) exportBadge.textContent = `${Math.round(fullDur)}s`;

    // 3. Update trimmer inputs & sliders with new max duration
    const maxDur = Math.max(1, Math.ceil(fullDur));
    const sliderS = document.getElementById('sliderTrimStart');
    const inputS = document.getElementById('inputTrimStartExact');
    const sliderE = document.getElementById('sliderTrimEnd');
    const inputE = document.getElementById('inputTrimEndExact');
    const badgeS = document.getElementById('trimStartVal');
    const badgeE = document.getElementById('trimEndVal');

    if (sliderS) { sliderS.max = maxDur; sliderS.value = 0; }
    if (inputS) { inputS.max = maxDur; inputS.value = 0; }
    if (badgeS) badgeS.textContent = '0.0s';

    if (sliderE) { sliderE.max = maxDur; sliderE.value = fullDur; }
    if (inputE) { inputE.max = maxDur; inputE.value = fullDur; }
    if (badgeE) badgeE.textContent = `${fullDur}s`;

    // 4. Automatically set video duration in export settings to match audio length by default!
    if (updateVideoDuration) {
      this.setVideoDuration(Math.round(fullDur), false);
    }

    this.drawWaveform();

    if (showToast) {
      this.showToast(`🎵 Loaded "${name}" (${fullDur}s) — Video length set to ${this.videoDuration}s`, 'success');
    }
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
      this.timer.enabled = false; // Disabled by default
      this.timer.style = 'radial_ring';
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
    this.setVideoDuration(this.videoDuration, false);
    this.syncTimerUI();

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

    if (this.isExporting) {
      // Pause drawing background canvas during video export to maximize encoder performance and prevent stutter
      requestAnimationFrame(this.renderLoop.bind(this));
      return;
    }

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
      this.renderTimer(ctx, width, height, timeMs, cleanMode);
    }

    // 6. Answer Reveal Rings
    if (this.answerRevealMode) {
      this.renderAnswerRevealRings(ctx, width, height, timeMs);
    }

    ctx.restore();
  }

  renderBackground(ctx, width, height) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);
    if (!this.bg.isLoaded || !this.bg.img.width) return;

    ctx.save();
    const hasFilter = (this.bg.brightness !== 100 || this.bg.contrast !== 100 || this.bg.saturation !== 100);
    if (hasFilter) {
      ctx.filter = `brightness(${this.bg.brightness}%) contrast(${this.bg.contrast}%) saturate(${this.bg.saturation}%)`;
    }

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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const frameCache = new Map();

    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      const gifData = this.loadedGifs.get(a.charId);
      let frameCanvas = frameCache.get(a.charId);
      if (frameCanvas === undefined) {
        frameCanvas = gifData ? window.gifEngine.getFrame(gifData, timeMs) : null;
        frameCache.set(a.charId, frameCanvas);
      }

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
      ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 1.0;

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
    // For tiny animals (even 1%), guarantee minimum 48px box so handles never overlap the center
    const boxHalfW = Math.max(48 * resScale, drawW / 2 + 16);
    const boxHalfH = Math.max(48 * resScale, drawH / 2 + 16);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((a.rotation * Math.PI) / 180);

    // Number Badge (Placed Top-Left so all 4 corner resize handles remain unobstructed)
    const badgeR = Math.max(14, 12 * resScale);
    const badgeX = -boxHalfW + 16 * resScale;
    const badgeY = -boxHalfH - 14 * resScale;

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

    if (!isSelected && a.scale < 0.25) {
      // Subtle locator ring & center dot for tiny unselected animals so creators never lose track of them!
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(16 * resScale, drawW * 0.8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 0, 2.5 * resScale, 0, Math.PI * 2);
      ctx.fill();
    }

    if (isSelected) {
      // 0. High-Precision Center Position Pointer (Glowing Crosshair, Concentric Reticle & Focal Dot)
      const pointerR = Math.max(14 * resScale, 12);
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Crosshairs
      ctx.moveTo(-pointerR - 6 * resScale, 0);
      ctx.lineTo(pointerR + 6 * resScale, 0);
      ctx.moveTo(0, -pointerR - 6 * resScale);
      ctx.lineTo(0, pointerR + 6 * resScale);
      ctx.stroke();

      // Target ring
      ctx.beginPath();
      ctx.arc(0, 0, pointerR, 0, Math.PI * 2);
      ctx.stroke();

      // Center focal dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3 * resScale, 0, Math.PI * 2);
      ctx.fill();

      // Precision Floating Coordinates Tag (Shows exact position % live while dragging!)
      const coordText = `X:${(a.nx * 100).toFixed(1)}% Y:${(a.ny * 100).toFixed(1)}%`;
      ctx.font = `bold ${Math.round(10 * resScale) + 1}px monospace`;
      const textW = ctx.measureText(coordText).width + 12 * resScale;
      const tagY = -boxHalfH - 34 * resScale;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(-textW / 2, tagY - 9 * resScale, textW, 18 * resScale, 4 * resScale);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(coordText, 0, tagY);
      ctx.restore();

      // 1. High-Contrast Dashed Bounding Box
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 4]);
      ctx.strokeRect(-boxHalfW, -boxHalfH, boxHalfW * 2, boxHalfH * 2);
      ctx.setLineDash([]);

      // 2. All 4 Corner Resize Handles (Prominent, High-Contrast Dual Circles)
      const handleR = Math.max(13, 10 * resScale);
      const corners = [
        [-boxHalfW, -boxHalfH], // Top-Left
        [boxHalfW, -boxHalfH],  // Top-Right
        [-boxHalfW, boxHalfH],  // Bottom-Left
        [boxHalfW, boxHalfH]    // Bottom-Right
      ];

      for (let c = 0; c < corners.length; c++) {
        const [cx, cy] = corners[c];
        // Outer dark circle
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(cx, cy, handleR + 2, 0, Math.PI * 2);
        ctx.fill();

        // Main amber/gold circle
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx, cy, handleR, 0, Math.PI * 2);
        ctx.fill();

        // Inner white dot for precision center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, handleR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Rotation Handle (Top-Center with vibrant stem)
      const rotY = -boxHalfH - 30 * resScale;
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -boxHalfH);
      ctx.lineTo(0, rotY);
      ctx.stroke();

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(0, rotY, handleR + 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, rotY, handleR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, rotY, handleR * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // 4. On-Canvas Interactive Action & Scale Pill (Directly below bounding box in preview)
      const pillY = boxHalfH + 34 * resScale;
      const pillW = 250 * resScale;
      const pillH = 34 * resScale;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-pillW / 2, pillY - pillH / 2, pillW, pillH, 8 * resScale);
      ctx.fill();
      ctx.stroke();

      // Vertical section dividers
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-70 * resScale, pillY - pillH * 0.35);
      ctx.lineTo(-70 * resScale, pillY + pillH * 0.35);
      ctx.moveTo(-22 * resScale, pillY - pillH * 0.35);
      ctx.lineTo(-22 * resScale, pillY + pillH * 0.35);
      ctx.moveTo(26 * resScale, pillY - pillH * 0.35);
      ctx.lineTo(26 * resScale, pillY + pillH * 0.35);
      ctx.moveTo(76 * resScale, pillY - pillH * 0.35);
      ctx.lineTo(76 * resScale, pillY + pillH * 0.35);
      ctx.stroke();

      // Minus button [-]
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `bold ${Math.round(16 * resScale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('−', -92 * resScale, pillY);

      // Scale value text (e.g. 72%)
      ctx.fillStyle = '#fbbf24';
      ctx.font = `bold ${Math.round(12 * resScale)}px sans-serif`;
      ctx.fillText(`${Math.round(a.scale * 100)}%`, -46 * resScale, pillY);

      // Plus button [+]
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `bold ${Math.round(15 * resScale)}px monospace`;
      ctx.fillText('+', 2 * resScale, pillY);

      // Opacity quick toggle [💧 100%]
      const currentOpPct = Math.round((a.opacity !== undefined ? a.opacity : 1.0) * 100);
      ctx.fillStyle = currentOpPct < 100 ? '#38bdf8' : '#cbd5e1';
      ctx.font = `bold ${Math.round(11 * resScale)}px sans-serif`;
      ctx.fillText(`💧${currentOpPct}%`, 51 * resScale, pillY);

      // Flip button [↔]
      ctx.fillStyle = a.flipX ? '#38bdf8' : '#94a3b8';
      ctx.font = `bold ${Math.round(13 * resScale)}px sans-serif`;
      ctx.fillText('↔', 100 * resScale, pillY);
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

  // --- Multiple Countdown Timer & Clock Styles ---
  renderTimer(ctx, width, height, timeMs, cleanMode = false) {
    const progress = Math.max(0, Math.min(1, (timeMs / 1000) / this.videoDuration));
    const remainingRatio = 1 - progress;
    const style = this.timer.style;
    const resScale = width / 1080;
    const posX = (this.timer.nx ?? 0.88) * width;
    const posY = (this.timer.ny ?? 0.08) * height;
    const diameter = (this.timer.size || 130) * resScale;
    const r = diameter / 2;
    const secLeft = Math.ceil(this.videoDuration * remainingRatio);
    const accentColor = secLeft <= 3 ? '#ef4444' : (this.timer.color || '#38bdf8');

    ctx.save();

    if (style === 'top_bar') {
      const barH = (this.timer.height || 10) * resScale;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, width, barH);
      const grad = ctx.createLinearGradient(0, 0, width * remainingRatio, 0);
      grad.addColorStop(0, this.timer.color || '#38bdf8');
      grad.addColorStop(0.5, '#6366f1');
      grad.addColorStop(1, '#f43f5e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width * remainingRatio, barH);

    } else if (style === 'bottom_bar') {
      const barH = (this.timer.height || 10) * resScale;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, height - barH, width, barH);
      const grad = ctx.createLinearGradient(0, 0, width * remainingRatio, 0);
      grad.addColorStop(0, '#10b981');
      grad.addColorStop(1, '#fbbf24');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - barH, width * remainingRatio, barH);

    } else if (style === 'radial_ring') {
      // 1. Dark glass circular background with soft drop shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 14 * resScale;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.beginPath();
      ctx.arc(posX, posY, r + 4 * resScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Outer bezel ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2 * resScale;
      ctx.beginPath();
      ctx.arc(posX, posY, r + 4 * resScale, 0, Math.PI * 2);
      ctx.stroke();

      // Background ring track
      const trackWidth = Math.max(4 * resScale, 8 * (diameter / 130));
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = trackWidth;
      ctx.beginPath();
      ctx.arc(posX, posY, r - trackWidth / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Vibrant progress arc
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = trackWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(posX, posY, r - trackWidth / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remainingRatio);
      ctx.stroke();

      // Center countdown text
      ctx.fillStyle = secLeft <= 3 ? '#f87171' : '#ffffff';
      ctx.font = `900 ${Math.round(r * 0.72)}px 'Outfit', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${secLeft}`, posX, posY);

      // Micro-label under number when size is large enough
      if (diameter >= 90 * resScale) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = `700 ${Math.round(r * 0.22)}px 'Outfit', sans-serif`;
        ctx.fillText('SEC', posX, posY + r * 0.52);
      }

    } else if (style === 'analog_clock') {
      // 2. Analog Clock Face with Ticking Hand
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
      ctx.shadowBlur = 18 * resScale;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.arc(posX, posY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Clock Outer Bezel
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = Math.max(3 * resScale, 5 * (diameter / 130));
      ctx.beginPath();
      ctx.arc(posX, posY, r - 3 * resScale, 0, Math.PI * 2);
      ctx.stroke();

      // 12 Clock Tick Marks
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6;
        const isQuarter = (i % 3 === 0);
        const innerR = r - (isQuarter ? 14 : 9) * (diameter / 130);
        const outerR = r - 5 * (diameter / 130);

        ctx.strokeStyle = isQuarter ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = (isQuarter ? 3 : 1.5) * resScale;
        ctx.beginPath();
        ctx.moveTo(posX + Math.cos(angle) * innerR, posY + Math.sin(angle) * innerR);
        ctx.lineTo(posX + Math.cos(angle) * outerR, posY + Math.sin(angle) * outerR);
        ctx.stroke();
      }

      // Rotating Clock Hand (sweeps clockwise as time counts down)
      const handAngle = -Math.PI / 2 + (progress * Math.PI * 2);
      const handLen = r * 0.66;
      ctx.strokeStyle = secLeft <= 3 ? '#f87171' : '#fbbf24';
      ctx.lineWidth = Math.max(3 * resScale, 4.5 * (diameter / 130));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(posX, posY);
      ctx.lineTo(posX + Math.cos(handAngle) * handLen, posY + Math.sin(handAngle) * handLen);
      ctx.stroke();

      // Center pivot point
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(posX, posY, 4.5 * resScale, 0, Math.PI * 2);
      ctx.fill();

      // Seconds readout in lower half of dial
      ctx.fillStyle = secLeft <= 3 ? '#f87171' : '#ffffff';
      ctx.font = `900 ${Math.round(r * 0.32)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${secLeft}s`, posX, posY + r * 0.44);

    } else if (style === 'digital_badge') {
      // 3. Digital Stopwatch Badge
      const baseW = diameter * 1.35;
      const baseH = diameter * 0.62;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 14 * resScale;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(posX - baseW / 2, posY - baseH / 2, baseW, baseH, 12 * resScale);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = Math.max(2 * resScale, 3 * (diameter / 130));
      ctx.beginPath();
      ctx.roundRect(posX - baseW / 2, posY - baseH / 2, baseW, baseH, 12 * resScale);
      ctx.stroke();

      ctx.fillStyle = secLeft <= 3 ? '#f87171' : '#ffffff';
      ctx.font = `900 ${Math.round(baseH * 0.52)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⏱️ ${secLeft}s`, posX, posY);
    }

    // Creator Mode Draggable Gizmo outline
    if (!cleanMode && this.creatorMode && (style === 'radial_ring' || style === 'analog_clock' || style === 'digital_badge')) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      if (style === 'digital_badge') {
        const bw = diameter * 1.35;
        const bh = diameter * 0.62;
        ctx.strokeRect(posX - bw / 2 - 4, posY - bh / 2 - 4, bw + 8, bh + 8);
      } else {
        ctx.beginPath();
        ctx.arc(posX, posY, r + 6 * resScale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
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
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvasWidth / rect.width;
      const scaleY = this.canvasHeight / rect.height;
      const clientX = (e.clientX - rect.left) * scaleX;
      const clientY = (e.clientY - rect.top) * scaleY;

      // 1. If an animal is hovered or already selected, mouse wheel resizes the animal visually in preview!
      let targetAnimal = null;
      if (this.selectedAnimalId) {
        targetAnimal = this.animals.find(item => item.id === this.selectedAnimalId);
      }
      if (!targetAnimal) {
        for (let i = this.animals.length - 1; i >= 0; i--) {
          const a = this.animals[i];
          const ax = a.nx * this.canvasWidth;
          const ay = a.ny * this.canvasHeight;
          const dist = Math.hypot(clientX - ax, (clientY - ay) * (this.canvasWidth / this.canvasHeight));
          const hitRadius = Math.max(38 * (this.canvasWidth / 1080), 0.07 * this.canvasWidth * a.scale);
          if (dist < hitRadius) {
            targetAnimal = a;
            this.selectedAnimalId = a.id;
            this.updateInspectorUI(a);
            this.renderLayerList();
            break;
          }
        }
      }

      if (targetAnimal) {
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        targetAnimal.scale = Math.max(0.01, Math.min(5.0, parseFloat((targetAnimal.scale + delta).toFixed(2))));
        const pct = Math.max(1, Math.round(targetAnimal.scale * 100));
        document.getElementById('sliderInspectScale').value = pct;
        document.getElementById('inputInspectScaleExact').value = pct;
        document.getElementById('inspectScaleVal').textContent = `${pct}%`;
        this.showToast(`Animal #${targetAnimal.index} Size: ${pct}%`, 'info');
        return;
      }

      // 2. Otherwise zoom background
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
      } else if ((e.key === '+' || e.key === '=' || e.key === ']') && this.selectedAnimalId) {
        e.preventDefault();
        const a = this.animals.find(item => item.id === this.selectedAnimalId);
        if (a) {
          a.scale = Math.min(4.0, parseFloat((a.scale + 0.05).toFixed(2)));
          this.updateInspectorUI(a);
          this.showToast(`Animal #${a.index} Size: ${Math.round(a.scale * 100)}%`, 'info');
        }
      } else if ((e.key === '-' || e.key === '_' || e.key === '[') && this.selectedAnimalId) {
        e.preventDefault();
        const a = this.animals.find(item => item.id === this.selectedAnimalId);
        if (a) {
          a.scale = Math.max(0.01, parseFloat((a.scale - 0.05).toFixed(2)));
          this.updateInspectorUI(a);
          this.showToast(`Animal #${a.index} Size: ${Math.max(1, Math.round(a.scale * 100))}%`, 'info');
        }
      } else if ((e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'h') && this.selectedAnimalId) {
        e.preventDefault();
        this.toggleFlipAnimal(this.selectedAnimalId);
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
    const resetFlipsBtn = document.getElementById('btnResetAllFlips');
    if (resetFlipsBtn) resetFlipsBtn.addEventListener('click', () => this.resetAllFlips());
    const flipAllBtn = document.getElementById('btnFlipAllAnimals');
    if (flipAllBtn) flipAllBtn.addEventListener('click', () => this.flipAllAnimals());

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
      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = 'high';
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
      this.debouncedSaveState();
    });
    document.getElementById('checkAutoSyncCount').addEventListener('change', (e) => {
      this.title.autoSyncCount = e.target.checked;
      if (e.target.checked) this.updateTitleCount();
      this.debouncedSaveState();
    });
    document.getElementById('inputSubtitleText').addEventListener('input', (e) => {
      this.title.subtitle = e.target.value;
      this.debouncedSaveState();
    });
    document.getElementById('checkShowSubtitle').addEventListener('change', (e) => {
      this.title.showSubtitle = e.target.checked;
      this.debouncedSaveState();
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
      await window.audioEngine.generatePresetBGM(track, 30);
      this.onAudioTrackLoaded(track.replace('_', ' ').toUpperCase(), window.audioEngine.duration, true, true);
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
            this.showToast(`Decoding audio "${file.name}"...`, 'info');
            await window.audioEngine.loadFromArrayBuffer(arrayBuffer, file.name);
            this.onAudioTrackLoaded(file.name, window.audioEngine.duration, true, true);
            firstLoaded = true;
          }
        }
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

    // Countdown Timer & Clock Settings
    const chkTimer = document.getElementById('checkTimerBarEnable');
    if (chkTimer) {
      chkTimer.addEventListener('change', (e) => {
        this.timer.enabled = e.target.checked;
        this.syncTimerUI();
        this.pushHistoryState('Toggle Countdown Timer');
      });
    }

    const selTimerStyle = document.getElementById('selectTimerStyle');
    if (selTimerStyle) {
      selTimerStyle.addEventListener('change', (e) => {
        this.timer.style = e.target.value;
        if (e.target.value === 'none') {
          this.timer.enabled = false;
        } else if (!this.timer.enabled) {
          this.timer.enabled = true;
        }
        this.syncTimerUI();
        this.pushHistoryState('Change Timer Style');
      });
    }

    const syncTimerSize = (val) => {
      this.timer.size = Math.max(30, Math.min(400, val));
      const sl = document.getElementById('sliderTimerSize');
      const inExact = document.getElementById('inputTimerSizeExact');
      const badge = document.getElementById('timerSizeVal');
      if (sl) sl.value = this.timer.size;
      if (inExact) inExact.value = this.timer.size;
      if (badge) badge.textContent = `${this.timer.size}px`;
    };
    const slTimerSize = document.getElementById('sliderTimerSize');
    if (slTimerSize) slTimerSize.addEventListener('input', (e) => syncTimerSize(parseInt(e.target.value)));
    const inTimerSizeExact = document.getElementById('inputTimerSizeExact');
    if (inTimerSizeExact) inTimerSizeExact.addEventListener('input', (e) => syncTimerSize(parseInt(e.target.value) || 130));

    const syncTimerX = (val) => {
      this.timer.nx = Math.max(0, Math.min(100, val)) / 100;
      const sl = document.getElementById('sliderTimerX');
      const inExact = document.getElementById('inputTimerXExact');
      const badge = document.getElementById('timerXVal');
      if (sl) sl.value = Math.round(this.timer.nx * 100);
      if (inExact) inExact.value = Math.round(this.timer.nx * 100);
      if (badge) badge.textContent = `${Math.round(this.timer.nx * 100)}%`;
      this.updateTimerPresetChips();
    };
    const slTimerX = document.getElementById('sliderTimerX');
    if (slTimerX) slTimerX.addEventListener('input', (e) => syncTimerX(parseInt(e.target.value)));
    const inTimerXExact = document.getElementById('inputTimerXExact');
    if (inTimerXExact) inTimerXExact.addEventListener('input', (e) => syncTimerX(parseInt(e.target.value) || 50));

    const syncTimerY = (val) => {
      this.timer.ny = Math.max(0, Math.min(100, val)) / 100;
      const sl = document.getElementById('sliderTimerY');
      const inExact = document.getElementById('inputTimerYExact');
      const badge = document.getElementById('timerYVal');
      if (sl) sl.value = Math.round(this.timer.ny * 100);
      if (inExact) inExact.value = Math.round(this.timer.ny * 100);
      if (badge) badge.textContent = `${Math.round(this.timer.ny * 100)}%`;
      this.updateTimerPresetChips();
    };
    const slTimerY = document.getElementById('sliderTimerY');
    if (slTimerY) slTimerY.addEventListener('input', (e) => syncTimerY(parseInt(e.target.value)));
    const inTimerYExact = document.getElementById('inputTimerYExact');
    if (inTimerYExact) inTimerYExact.addEventListener('input', (e) => syncTimerY(parseInt(e.target.value) || 50));

    document.querySelectorAll('.timer-pos-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const x = parseInt(chip.dataset.x);
        const y = parseInt(chip.dataset.y);
        syncTimerX(x);
        syncTimerY(y);
        this.pushHistoryState('Set Timer Preset Position');
      });
    });

    const inTimerColor = document.getElementById('inputTimerColor');
    if (inTimerColor) {
      inTimerColor.addEventListener('input', (e) => {
        this.timer.color = e.target.value;
      });
    }

    // Duration Chips (Manual override)
    document.querySelectorAll('.preset-chip[data-dur]').forEach(chip => {
      chip.addEventListener('click', () => {
        this.setVideoDuration(parseInt(chip.dataset.dur));
      });
    });
    document.getElementById('inputCustomDuration').addEventListener('change', (e) => {
      this.setVideoDuration(parseInt(e.target.value) || 15);
    });

    // Sync Buttons: Match Video Length to Audio Length / Trim
    const syncAudioTrimBtn = document.getElementById('btnSyncDurationToAudio');
    if (syncAudioTrimBtn) {
      syncAudioTrimBtn.addEventListener('click', () => {
        const audioLen = Math.round(window.audioEngine.trimEnd - window.audioEngine.trimStart);
        this.setVideoDuration(audioLen);
      });
    }

    const exportMatchAudioBtn = document.getElementById('btnExportMatchAudio');
    if (exportMatchAudioBtn) {
      exportMatchAudioBtn.addEventListener('click', () => {
        const audioLen = Math.round(window.audioEngine.trimEnd - window.audioEngine.trimStart);
        this.setVideoDuration(audioLen);
      });
    }

    const formatSelect = document.getElementById('selectExportFormat');
    if (formatSelect) {
      formatSelect.addEventListener('change', (e) => this.exportFormat = e.target.value);
    }
    document.getElementById('selectResolution').addEventListener('change', (e) => {
      this.resolutionPreset = e.target.value;
      const bSelect = document.getElementById('selectBitrate');
      if (bSelect) {
        if (this.resolutionPreset === '4k') {
          bSelect.value = '18';
          this.bitrate = 18000000;
        } else if (this.resolutionPreset === '2k') {
          bSelect.value = '12';
          this.bitrate = 12000000;
        } else {
          bSelect.value = '8';
          this.bitrate = 8000000;
        }
        const bVal = document.getElementById('exportBitrateVal');
        if (bVal) bVal.textContent = `${bSelect.value} Mbps`;
      }
      this.debouncedSaveState();
    });
    document.getElementById('selectFps').addEventListener('change', (e) => {
      this.fps = parseInt(e.target.value) || 30;
      this.debouncedSaveState();
    });
    document.getElementById('selectBitrate').addEventListener('change', (e) => {
      this.bitrate = parseInt(e.target.value) * 1000000;
      const bVal = document.getElementById('exportBitrateVal');
      if (bVal) bVal.textContent = `${e.target.value} Mbps`;
      this.debouncedSaveState();
    });
    document.getElementById('checkAppendReveal').addEventListener('change', (e) => {
      this.appendRevealEnding = e.target.checked;
      this.debouncedSaveState();
    });

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

    // Global Character Opacity Controls (Tab 1: Animals)
    const syncGlobalOpacity = (val, pushHistory = false) => {
      const num = parseInt(val, 10);
      const clamped = Math.max(0, Math.min(100, isNaN(num) ? 100 : num));
      this.globalOpacity = clamped / 100;
      this.animals.forEach(a => a.opacity = this.globalOpacity);
      if (this.selectedAnimalId) {
        const sel = this.animals.find(item => item.id === this.selectedAnimalId);
        if (sel) this.updateInspectorUI(sel);
      }
      this.syncGlobalOpacityUI();
      if (pushHistory) {
        this.pushHistoryState(`Change opacity to ${clamped}%`);
      }
      this.debouncedSaveState();
    };

    const slGlobalOp = document.getElementById('sliderGlobalOpacity');
    if (slGlobalOp) slGlobalOp.addEventListener('input', (e) => syncGlobalOpacity(e.target.value));
    const inGlobalOp = document.getElementById('inputGlobalOpacityExact');
    if (inGlobalOp) inGlobalOp.addEventListener('input', (e) => syncGlobalOpacity(e.target.value));

    document.querySelectorAll('.opacity-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => syncGlobalOpacity(btn.dataset.opacity, true));
    });

    const btnApplyAll = document.getElementById('btnApplyOpacityAll');
    if (btnApplyAll) {
      btnApplyAll.addEventListener('click', () => {
        const pct = Math.round(this.globalOpacity * 100);
        this.animals.forEach(a => a.opacity = this.globalOpacity);
        if (this.selectedAnimalId) {
          const sel = this.animals.find(item => item.id === this.selectedAnimalId);
          if (sel) this.updateInspectorUI(sel);
        }
        this.pushHistoryState(`Batch opacity to ${pct}%`);
        this.debouncedSaveState();
        this.showToast(`Applied ${pct}% opacity to all ${this.animals.length} animals!`, 'success');
      });
    }

    // Selected Animal Inspector Controls with Numeric Inputs
    const syncInspectScale = (val) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      const num = parseInt(val, 10);
      const clamped = Math.max(1, Math.min(500, isNaN(num) ? 100 : num));
      a.scale = parseFloat((clamped / 100).toFixed(3));
      document.getElementById('sliderInspectScale').value = clamped;
      document.getElementById('inputInspectScaleExact').value = clamped;
      document.getElementById('inspectScaleVal').textContent = `${clamped}%`;
      this.debouncedSaveState();
    };
    document.getElementById('sliderInspectScale').addEventListener('input', (e) => syncInspectScale(e.target.value));
    document.getElementById('inputInspectScaleExact').addEventListener('input', (e) => syncInspectScale(e.target.value));

    // Opacity / Transparency Control for Selected Animal
    const syncInspectOpacity = (val) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      const num = parseInt(val, 10);
      const clamped = Math.max(0, Math.min(100, isNaN(num) ? 100 : num));
      a.opacity = clamped / 100;
      const slider = document.getElementById('sliderInspectOpacity');
      const inputExact = document.getElementById('inputInspectOpacityExact');
      const valLabel = document.getElementById('inspectOpacityVal');
      if (slider) slider.value = clamped;
      if (inputExact) inputExact.value = clamped;
      if (valLabel) valLabel.textContent = `${clamped}%`;
      this.debouncedSaveState();
    };
    const slOpacity = document.getElementById('sliderInspectOpacity');
    if (slOpacity) slOpacity.addEventListener('input', (e) => syncInspectOpacity(e.target.value));
    const inOpacity = document.getElementById('inputInspectOpacityExact');
    if (inOpacity) inOpacity.addEventListener('input', (e) => syncInspectOpacity(e.target.value));

    document.querySelectorAll('.inspect-op-chip').forEach(btn => {
      btn.addEventListener('click', () => syncInspectOpacity(btn.dataset.op));
    });

    const syncInspectRot = (val) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.rotation = val;
      document.getElementById('sliderInspectRot').value = val;
      document.getElementById('inputInspectRotExact').value = val;
      document.getElementById('inspectRotVal').textContent = `${val}°`;
      this.debouncedSaveState();
    };
    document.getElementById('sliderInspectRot').addEventListener('input', (e) => syncInspectRot(parseInt(e.target.value)));
    document.getElementById('inputInspectRotExact').addEventListener('input', (e) => syncInspectRot(parseInt(e.target.value) || 0));

    const inInspectX = document.getElementById('inputInspectXExact');
    const inInspectY = document.getElementById('inputInspectYExact');

    if (inInspectX) {
      inInspectX.addEventListener('input', (e) => {
        const a = this.animals.find(item => item.id === this.selectedAnimalId);
        if (!a) return;
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          a.nx = Math.max(0.005, Math.min(0.995, parseFloat((val / 100).toFixed(4))));
          this.debouncedSaveState();
        }
      });
    }

    if (inInspectY) {
      inInspectY.addEventListener('input', (e) => {
        const a = this.animals.find(item => item.id === this.selectedAnimalId);
        if (!a) return;
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
          a.ny = Math.max(0.005, Math.min(0.995, parseFloat((val / 100).toFixed(4))));
          this.debouncedSaveState();
        }
      });
    }

    const nudgeAnimal = (dxPct, dyPct) => {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (!a) return;
      a.nx = Math.max(0.005, Math.min(0.995, parseFloat((a.nx + dxPct / 100).toFixed(4))));
      a.ny = Math.max(0.005, Math.min(0.995, parseFloat((a.ny + dyPct / 100).toFixed(4))));
      if (inInspectX) inInspectX.value = (a.nx * 100).toFixed(1);
      if (inInspectY) inInspectY.value = (a.ny * 100).toFixed(1);
      this.debouncedSaveState();
    };

    const btnNudgeLeft = document.getElementById('btnNudgeLeft');
    if (btnNudgeLeft) btnNudgeLeft.addEventListener('click', () => nudgeAnimal(-0.1, 0));
    const btnNudgeRight = document.getElementById('btnNudgeRight');
    if (btnNudgeRight) btnNudgeRight.addEventListener('click', () => nudgeAnimal(0.1, 0));
    const btnNudgeUp = document.getElementById('btnNudgeUp');
    if (btnNudgeUp) btnNudgeUp.addEventListener('click', () => nudgeAnimal(0, -0.1));
    const btnNudgeDown = document.getElementById('btnNudgeDown');
    if (btnNudgeDown) btnNudgeDown.addEventListener('click', () => nudgeAnimal(0, 0.1));

    document.getElementById('btnInspectFlipX').addEventListener('click', () => {
      this.toggleFlipAnimal();
      this.debouncedSaveState();
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
        this.debouncedSaveState();
      }
    });
    document.getElementById('btnInspectSendBack').addEventListener('click', () => {
      const idx = this.animals.findIndex(item => item.id === this.selectedAnimalId);
      if (idx > 0) {
        const item = this.animals.splice(idx, 1)[0];
        this.animals.unshift(item);
        this.renderLayerList();
        this.debouncedSaveState();
      }
    });

    // Project Save / Load & Auto-Save Session
    document.getElementById('btnSaveProjectJson').addEventListener('click', () => this.saveProjectJson());
    document.getElementById('inputLoadProject').addEventListener('change', (e) => this.loadProjectJson(e.target.files[0]));

    const btnResetSettings = document.getElementById('btnResetSettingsOnly');
    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => {
        if (confirm('Reset workspace positions, styles, timer, and layout back to defaults?\n\n(Your active character and background image will be preserved!)')) {
          this.resetSettingsOnly();
        }
      });
    }

    const btnClearStorage = document.getElementById('btnClearAllStorage');
    if (btnClearStorage) {
      btnClearStorage.addEventListener('click', async () => {
        if (confirm('Are you sure you want to completely wipe all saved settings, custom uploaded GIFs, and background history?\n\nThis will reset the studio to a clean fresh install.')) {
          await this.clearAllStorage();
        }
      });
    }

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

    const resScale = this.canvasWidth / 1080;

    // 1. If an animal is currently selected, check its interactive handles FIRST
    if (this.selectedAnimalId && this.creatorMode) {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (a) {
        const ax = a.nx * this.canvasWidth;
        const ay = a.ny * this.canvasHeight;
        const gifData = this.loadedGifs.get(a.charId);
        const drawW = (gifData ? gifData.width : 100) * 0.9 * resScale * a.scale;
        const drawH = (gifData ? gifData.height : 100) * 0.9 * resScale * a.scale;
        const boxHalfW = Math.max(48 * resScale, drawW / 2 + 16);
        const boxHalfH = Math.max(48 * resScale, drawH / 2 + 16);

        // Transform mouse point into animal's local space
        const dx = clientX - ax;
        const dy = clientY - ay;
        const rad = (-a.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        // A. Floating Action Pill below bounding box
        const pillY = boxHalfH + 34 * resScale;
        const pillW = 250 * resScale;
        const pillH = 34 * resScale;
        if (Math.abs(localX) <= pillW / 2 + 8 * scaleX && Math.abs(localY - pillY) <= pillH / 2 + 8 * scaleX) {
          if (localX < -70 * resScale) {
            a.scale = Math.max(0.01, parseFloat((a.scale - 0.02).toFixed(3)));
            this.updateInspectorUI(a);
            this.pushHistoryState('Shrink animal size');
            this.debouncedSaveState();
            this.showToast(`Animal #${a.index} Size: ${Math.round(a.scale * 100)}%`, 'info');
            return;
          }
          if (localX >= -70 * resScale && localX < -22 * resScale) {
            if (a.scale < 0.65) a.scale = 0.72;
            else if (a.scale < 0.90) a.scale = 1.0;
            else if (a.scale < 1.20) a.scale = 1.35;
            else a.scale = 0.52;
            this.updateInspectorUI(a);
            this.pushHistoryState('Cycle animal size');
            this.debouncedSaveState();
            this.showToast(`Animal #${a.index} Size: ${Math.round(a.scale * 100)}%`, 'info');
            return;
          }
          if (localX >= -22 * resScale && localX < 26 * resScale) {
            a.scale = Math.min(4.0, parseFloat((a.scale + 0.05).toFixed(2)));
            this.updateInspectorUI(a);
            this.pushHistoryState('Grow animal size');
            this.debouncedSaveState();
            this.showToast(`Animal #${a.index} Size: ${Math.round(a.scale * 100)}%`, 'info');
            return;
          }
          if (localX >= 26 * resScale && localX < 76 * resScale) {
            const curOp = a.opacity !== undefined ? a.opacity : 1.0;
            const nextOp = curOp > 0.85 ? 0.75 : (curOp > 0.6 ? 0.50 : (curOp > 0.35 ? 0.25 : 1.0));
            a.opacity = nextOp;
            this.updateInspectorUI(a);
            this.pushHistoryState('Toggle animal opacity');
            this.debouncedSaveState();
            this.showToast(`Animal #${a.index} Opacity: ${Math.round(a.opacity * 100)}%`, 'info');
            return;
          }
          if (localX >= 76 * resScale) {
            this.toggleFlipAnimal(a.id);
            this.debouncedSaveState();
            return;
          }
        }

        // B. Rotation Handle (Top-Center)
        const rotY = -boxHalfH - 30 * resScale;
        const rotHitR = Math.max(18 * resScale, 16);
        if (Math.hypot(localX, localY - rotY) < rotHitR) {
          this.interaction.isDragging = true;
          this.interaction.dragTarget = 'handle-rot';
          this.interaction.targetId = a.id;
          this.interaction.origRot = a.rotation;
          try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
          return;
        }

        // C. Corner Resize Handles (All 4 Corners)
        const handleHitR = Math.max(16 * resScale, 14);
        const corners = [
          [-boxHalfW, -boxHalfH],
          [boxHalfW, -boxHalfH],
          [-boxHalfW, boxHalfH],
          [boxHalfW, boxHalfH]
        ];
        for (let c = 0; c < corners.length; c++) {
          const [cx, cy] = corners[c];
          if (Math.hypot(localX - cx, localY - cy) < handleHitR) {
            this.interaction.isDragging = true;
            this.interaction.dragTarget = 'handle-resize';
            this.interaction.targetId = a.id;
            this.interaction.origScale = a.scale;
            this.interaction.origDist = Math.max(15, Math.hypot(clientX - ax, clientY - ay));
            try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
            return;
          }
        }

        // D. Center Reticle Target / Pointer
        const centerGrabR = Math.max(22 * resScale, 18);
        if (Math.hypot(localX, localY) < centerGrabR) {
          this.interaction.isDragging = true;
          this.interaction.dragTarget = 'animal';
          this.interaction.targetId = a.id;
          this.interaction.origItemX = a.nx;
          this.interaction.origItemY = a.ny;
          this.updateInspectorUI(a);
          this.renderLayerList();
          try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
          return;
        }
      }
    }

    // 2. Natural Sprite Bounds Hit-Testing on ALL animals (From topmost layer down to 0)
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const ax = a.nx * this.canvasWidth;
      const ay = a.ny * this.canvasHeight;
      const gifData = this.loadedGifs.get(a.charId);
      const drawW = (gifData ? gifData.width : 100) * 0.9 * resScale * a.scale;
      const drawH = (gifData ? gifData.height : 100) * 0.9 * resScale * a.scale;

      // Tight, natural sprite bounds (with minimum 16px radius for micro 1% animals so fingers/mice hit reliably without overlapping other animals)
      const hitHalfW = Math.max(16 * resScale, drawW / 2 + 8 * resScale);
      const hitHalfH = Math.max(16 * resScale, drawH / 2 + 8 * resScale);

      const dx = clientX - ax;
      const dy = clientY - ay;
      const rad = (-a.rotation * Math.PI) / 180;
      const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

      const hitBody = Math.abs(localX) <= hitHalfW && Math.abs(localY) <= hitHalfH;
      const hitBadge = Math.hypot(localX - (-hitHalfW + 16 * resScale), localY - (-hitHalfH - 14 * resScale)) <= Math.max(20, 16 * resScale);

      if (hitBody || hitBadge) {
        this.selectedAnimalId = a.id;
        this.interaction.isDragging = true;
        this.interaction.dragTarget = 'animal';
        this.interaction.targetId = a.id;
        this.interaction.origItemX = a.nx;
        this.interaction.origItemY = a.ny;

        this.updateInspectorUI(a);
        this.renderLayerList();
        try { this.canvas.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
    }

    // 3. Title Hit-Testing
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

    // 4. Timer Hit-Testing
    if (this.timer.enabled && this.timer.style !== 'none' && this.timer.style !== 'top_bar' && this.timer.style !== 'bottom_bar') {
      const tmX = (this.timer.nx ?? 0.88) * this.canvasWidth;
      const tmY = (this.timer.ny ?? 0.08) * this.canvasHeight;
      const timerRadius = ((this.timer.size || 130) * (this.canvasWidth / 1080)) / 2 + 15;
      if (Math.hypot(clientX - tmX, clientY - tmY) < timerRadius) {
        this.interaction.isDragging = true;
        this.interaction.dragTarget = 'timer';
        this.interaction.origItemX = this.timer.nx ?? 0.88;
        this.interaction.origItemY = this.timer.ny ?? 0.08;
        return;
      }
    }

    // 5. Watermark Hit-Testing
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

    // 6. Click on empty background: deselect
    if (this.selectedAnimalId) {
      this.selectedAnimalId = null;
      this.renderLayerList();
    }
  }

  // --- Dynamic Hover Cursor for Precision Editing ---
  updateHoverCursor(e) {
    if (this.interaction.isDragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvasWidth / rect.width;
    const scaleY = this.canvasHeight / rect.height;
    const clientX = (e.clientX - rect.left) * scaleX;
    const clientY = (e.clientY - rect.top) * scaleY;
    const resScale = this.canvasWidth / 1080;
    const hitTolerance = Math.max(34 * resScale, 20 * scaleX);

    if (this.timer.enabled && this.timer.style !== 'none' && this.timer.style !== 'top_bar' && this.timer.style !== 'bottom_bar') {
      const tmX = (this.timer.nx ?? 0.88) * this.canvasWidth;
      const tmY = (this.timer.ny ?? 0.08) * this.canvasHeight;
      const timerRadius = ((this.timer.size || 130) * resScale) / 2 + 10;
      if (Math.hypot(clientX - tmX, clientY - tmY) < timerRadius) {
        this.canvas.style.cursor = 'move';
        return;
      }
    }

    if (this.selectedAnimalId) {
      const a = this.animals.find(item => item.id === this.selectedAnimalId);
      if (a) {
        const ax = a.nx * this.canvasWidth;
        const ay = a.ny * this.canvasHeight;
        const gifData = this.loadedGifs.get(a.charId);
        const drawW = (gifData ? gifData.width : 100) * 0.9 * resScale * a.scale;
        const drawH = (gifData ? gifData.height : 100) * 0.9 * resScale * a.scale;
        const boxHalfW = Math.max(48 * resScale, drawW / 2 + 16);
        const boxHalfH = Math.max(48 * resScale, drawH / 2 + 16);

        const dx = clientX - ax;
        const dy = clientY - ay;
        const rad = (-a.rotation * Math.PI) / 180;
        const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
        const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

        // Center Position Pointer Grab Zone (Always prioritizes moving animal)
        const centerGrabR = Math.max(26 * resScale, 20);
        if (Math.hypot(localX, localY) < centerGrabR) {
          this.canvas.style.cursor = 'move';
          return;
        }

        // Rotation Handle (Top-Center)
        const rotY = -boxHalfH - 30 * resScale;
        const rotHitR = Math.max(16 * resScale, 14);
        if (Math.hypot(localX, localY - rotY) < rotHitR) {
          this.canvas.style.cursor = 'grab';
          return;
        }

        // Corner Resize Handles (Accurate precision radius so handles don't crowd the center)
        const handleHitR = Math.max(16 * resScale, 14);
        const hitTL = Math.hypot(localX - (-boxHalfW), localY - (-boxHalfH)) < handleHitR;
        const hitBR = Math.hypot(localX - boxHalfW, localY - boxHalfH) < handleHitR;
        if (hitTL || hitBR) {
          this.canvas.style.cursor = 'nwse-resize';
          return;
        }

        const hitTR = Math.hypot(localX - boxHalfW, localY - (-boxHalfH)) < handleHitR;
        const hitBL = Math.hypot(localX - (-boxHalfW), localY - boxHalfH) < handleHitR;
        if (hitTR || hitBL) {
          this.canvas.style.cursor = 'nesw-resize';
          return;
        }

        // Floating Action Pill below box
        const pillY = boxHalfH + 34 * resScale;
        const pillW = 250 * resScale;
        const pillH = 34 * resScale;
        if (Math.abs(localX) <= pillW / 2 + 8 * scaleX && Math.abs(localY - pillY) <= pillH / 2 + 8 * scaleX) {
          this.canvas.style.cursor = 'pointer';
          return;
        }

        // Central body: move
        if (Math.abs(localX) <= boxHalfW && Math.abs(localY) <= boxHalfH) {
          this.canvas.style.cursor = 'move';
          return;
        }
      }
    }

    // Check if hovering over any other animal (minimum 38px radius so tiny 1% animals are easily clickable!)
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      const ax = a.nx * this.canvasWidth;
      const ay = a.ny * this.canvasHeight;
      const dist = Math.hypot(clientX - ax, (clientY - ay) * (this.canvasWidth / this.canvasHeight));
      const hitRadius = Math.max(38 * resScale, 0.06 * this.canvasWidth * a.scale);
      if (dist < hitRadius) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
    }

    this.canvas.style.cursor = 'default';
  }

  onPointerMove(e) {
    if (!this.interaction.isDragging) {
      this.updateHoverCursor(e);
      return;
    }

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

    } else if (this.interaction.dragTarget === 'timer') {
      this.timer.nx = Math.max(0.04, Math.min(0.96, this.interaction.origItemX + dx / this.canvasWidth));
      this.timer.ny = Math.max(0.04, Math.min(0.96, this.interaction.origItemY + dy / this.canvasHeight));
      const xPct = Math.round(this.timer.nx * 100);
      const yPct = Math.round(this.timer.ny * 100);
      const slX = document.getElementById('sliderTimerX');
      const inX = document.getElementById('inputTimerXExact');
      const valX = document.getElementById('timerXVal');
      const slY = document.getElementById('sliderTimerY');
      const inY = document.getElementById('inputTimerYExact');
      const valY = document.getElementById('timerYVal');
      if (slX) slX.value = xPct;
      if (inX) inX.value = xPct;
      if (valX) valX.textContent = `${xPct}%`;
      if (slY) slY.value = yPct;
      if (inY) inY.value = yPct;
      if (valY) valY.textContent = `${yPct}%`;
      this.updateTimerPresetChips();

    } else if (this.interaction.dragTarget === 'handle-resize') {
      const a = this.animals.find(item => item.id === this.interaction.targetId);
      if (!a) return;
      const ax = a.nx * this.canvasWidth;
      const ay = a.ny * this.canvasHeight;
      const currentDist = Math.hypot(clientX - ax, clientY - ay);
      const ratio = currentDist / Math.max(15, this.interaction.origDist);
      a.scale = Math.max(0.01, Math.min(5.0, parseFloat((this.interaction.origScale * ratio).toFixed(3))));
      const pct = Math.max(1, Math.round(a.scale * 100));
      document.getElementById('sliderInspectScale').value = pct;
      document.getElementById('inputInspectScaleExact').value = pct;
      document.getElementById('inspectScaleVal').textContent = `${pct}%`;

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

  onPointerUp(e) {
    if (this.interaction.isDragging) {
      if (this.interaction.dragTarget === 'handle-resize') {
        const a = this.animals.find(item => item.id === this.interaction.targetId);
        if (a) {
          this.renderLayerList();
          this.showToast(`Animal #${a.index} Size: ${Math.round(a.scale * 100)}%`, 'info');
        }
      }
      this.renderLayerList();
      this.pushHistoryState('Move/Resize item');
      this.debouncedSaveState();
    }
    this.interaction.isDragging = false;
    this.interaction.dragTarget = null;
    this.canvas.style.cursor = 'default';
    try {
      if (e && e.pointerId && this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(e.pointerId)) {
        this.canvas.releasePointerCapture(e.pointerId);
      }
    } catch (err) {}
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

    const trimLen = parseFloat((window.audioEngine.trimEnd - window.audioEngine.trimStart).toFixed(1));
    const trimBadge = document.getElementById('audioTrimLenBadge');
    if (trimBadge) trimBadge.textContent = `${trimLen}s`;
    const exportBadge = document.getElementById('exportAudioLenBadge');
    if (exportBadge) exportBadge.textContent = `${Math.round(trimLen)}s`;

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

    const trimLen = parseFloat((window.audioEngine.trimEnd - window.audioEngine.trimStart).toFixed(1));
    const trimBadge = document.getElementById('audioTrimLenBadge');
    if (trimBadge) trimBadge.textContent = `${trimLen}s`;
    const exportBadge = document.getElementById('exportAudioLenBadge');
    if (exportBadge) exportBadge.textContent = `${Math.round(trimLen)}s`;

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
          this.onAudioTrackLoaded(item.name, window.audioEngine.duration, true, true);
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
          <button class="btn btn-secondary btn-sm" title="${a.flipX ? 'Flipped Horizontally (Click to restore)' : 'Original Orientation (Click to flip)'}" style="${a.flipX ? 'color:#38bdf8; border-color:#38bdf8; background:rgba(56,189,248,0.18);' : ''}" onclick="studio.toggleFlipAnimal('${a.id}')">
            <i class="fa-solid fa-arrows-left-right"></i>
          </button>
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
    const scalePct = Math.max(1, Math.round(animal.scale * 100));
    document.getElementById('sliderInspectScale').value = scalePct;
    document.getElementById('inputInspectScaleExact').value = scalePct;
    document.getElementById('inspectScaleVal').textContent = `${scalePct}%`;

    const opPct = Math.round((animal.opacity !== undefined ? animal.opacity : 1.0) * 100);
    const slOp = document.getElementById('sliderInspectOpacity');
    const inOp = document.getElementById('inputInspectOpacityExact');
    const valOp = document.getElementById('inspectOpacityVal');
    if (slOp) slOp.value = opPct;
    if (inOp) inOp.value = opPct;
    if (valOp) valOp.textContent = `${opPct}%`;

    document.getElementById('sliderInspectRot').value = animal.rotation;
    document.getElementById('inputInspectRotExact').value = animal.rotation;
    document.getElementById('inspectRotVal').textContent = `${animal.rotation}°`;

    const inX = document.getElementById('inputInspectXExact');
    const inY = document.getElementById('inputInspectYExact');
    if (inX) inX.value = (animal.nx * 100).toFixed(1);
    if (inY) inY.value = (animal.ny * 100).toFixed(1);

    const flipBtn = document.getElementById('btnInspectFlipX');
    if (flipBtn) {
      flipBtn.classList.toggle('active', !!animal.flipX);
      flipBtn.style.color = animal.flipX ? '#38bdf8' : '';
      flipBtn.style.borderColor = animal.flipX ? '#38bdf8' : '';
      flipBtn.style.background = animal.flipX ? 'rgba(56, 189, 248, 0.22)' : '';
    }
  }

  locateAnimal(id) {
    this.selectedAnimalId = id;
    const a = this.animals.find(item => item.id === id);
    if (a) this.updateInspectorUI(a);
    this.renderLayerList();
    this.showToast(`Selected Animal #${a ? a.index : ''}`, 'info');
  }

  syncTimerUI() {
    const chk = document.getElementById('checkTimerBarEnable');
    if (chk) chk.checked = !!this.timer.enabled;

    const sel = document.getElementById('selectTimerStyle');
    if (sel) sel.value = this.timer.style;

    const slSize = document.getElementById('sliderTimerSize');
    const inSize = document.getElementById('inputTimerSizeExact');
    const valSize = document.getElementById('timerSizeVal');
    const curSize = this.timer.size || 130;
    if (slSize) slSize.value = curSize;
    if (inSize) inSize.value = curSize;
    if (valSize) valSize.textContent = `${curSize}px`;

    const xPct = Math.round((this.timer.nx ?? 0.88) * 100);
    const yPct = Math.round((this.timer.ny ?? 0.08) * 100);

    const slX = document.getElementById('sliderTimerX');
    const inX = document.getElementById('inputTimerXExact');
    const valX = document.getElementById('timerXVal');
    if (slX) slX.value = xPct;
    if (inX) inX.value = xPct;
    if (valX) valX.textContent = `${xPct}%`;

    const slY = document.getElementById('sliderTimerY');
    const inY = document.getElementById('inputTimerYExact');
    const valY = document.getElementById('timerYVal');
    if (slY) slY.value = yPct;
    if (inY) inY.value = yPct;
    if (valY) valY.textContent = `${yPct}%`;

    const inColor = document.getElementById('inputTimerColor');
    if (inColor) inColor.value = this.timer.color || '#38bdf8';

    // Show or hide position/size controls if bar vs clock
    const posCont = document.getElementById('timerPositionContainer');
    const sizeGrp = document.getElementById('timerSizeGroup');
    const isBar = this.timer.style === 'top_bar' || this.timer.style === 'bottom_bar';
    if (posCont) posCont.style.display = isBar ? 'none' : 'flex';
    if (sizeGrp) sizeGrp.style.display = isBar ? 'none' : 'block';

    this.updateTimerPresetChips();
  }

  updateTimerPresetChips() {
    const curX = Math.round((this.timer.nx ?? 0.88) * 100);
    const curY = Math.round((this.timer.ny ?? 0.08) * 100);
    document.querySelectorAll('.timer-pos-chip').forEach(chip => {
      const cx = parseInt(chip.dataset.x);
      const cy = parseInt(chip.dataset.y);
      chip.classList.toggle('active', Math.abs(cx - curX) <= 3 && Math.abs(cy - curY) <= 3);
    });
  }

  // =========================================================================
  // FLAWLESS REAL-TIME VIDEO EXPORT WITH EBML DURATION PATCHING
  // =========================================================================

  async startVideoExport() {
    if (this.isExporting) return;
    this.isExporting = true;
    this.exportChunks = [];
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

    // 0. Ensure export parameters are strictly synced with user's selected UI options
    const resSelect = document.getElementById('selectResolution');
    if (resSelect && resSelect.value) this.resolutionPreset = resSelect.value;

    const fpsSelect = document.getElementById('selectFps');
    if (fpsSelect && fpsSelect.value) this.fps = parseInt(fpsSelect.value) || 30;

    const bitrateSelect = document.getElementById('selectBitrate');
    if (bitrateSelect && bitrateSelect.value) this.bitrate = parseInt(bitrateSelect.value) * 1000000;

    const formatSelect = document.getElementById('selectExportFormat');
    if (formatSelect && formatSelect.value) this.exportFormat = formatSelect.value;

    const checkReveal = document.getElementById('checkAppendReveal');
    if (checkReveal) this.appendRevealEnding = checkReveal.checked;

    // 1. Precise Resolution computation for all aspect ratios & presets
    const resolutionMap = {
      '9:16': {
        '720p':  { w: 720,  h: 1280 },
        '1080p': { w: 1080, h: 1920 },
        '2k':    { w: 1440, h: 2560 },
        '4k':    { w: 2160, h: 3840 }
      },
      '16:9': {
        '720p':  { w: 1280, h: 720 },
        '1080p': { w: 1920, h: 1080 },
        '2k':    { w: 2560, h: 1440 },
        '4k':    { w: 3840, h: 2160 }
      },
      '1:1': {
        '720p':  { w: 720,  h: 720 },
        '1080p': { w: 1080, h: 1080 },
        '2k':    { w: 1440, h: 1440 },
        '4k':    { w: 2160, h: 2160 }
      },
      '4:5': {
        '720p':  { w: 720,  h: 900 },
        '1080p': { w: 1080, h: 1350 },
        '2k':    { w: 1440, h: 1800 },
        '4k':    { w: 2160, h: 2700 }
      }
    };
    const aspectMap = resolutionMap[this.aspectRatio] || resolutionMap['9:16'];
    const dims = aspectMap[this.resolutionPreset] || aspectMap['1080p'];
    const exportW = dims.w;
    const exportH = dims.h;

    // 2. Compute target bitrate: use user's selected bitrate or optimized default (8 Mbps)
    const targetBitrate = this.bitrate || 8000000;

    // 3. Mounted DOM Live Canvas: Crisp, distortion-free rendering
    const exportCanvas = document.getElementById('exportLiveCanvas');
    exportCanvas.width = exportW;
    exportCanvas.height = exportH;
    exportCanvas.style.aspectRatio = `${exportW} / ${exportH}`;
    const exportCtx = exportCanvas.getContext('2d', {
      alpha: false,
      desynchronized: false
    });
    exportCtx.imageSmoothingEnabled = true;
    exportCtx.imageSmoothingQuality = 'high';

    // Pre-draw frame 0 so captureStream immediately receives a full-quality graphic
    this.drawFrame(exportCtx, exportW, exportH, 0, true);

    const totalSeconds = this.videoDuration + (this.appendRevealEnding ? 3 : 0);
    const targetDurationMs = totalSeconds * 1000;

    // Stream Setup
    const stream = exportCanvas.captureStream(this.fps);
    const videoTrack = (stream && stream.getVideoTracks) ? stream.getVideoTracks()[0] : null;
    if (hasAudio) {
      const audioTrack = window.audioEngine.getAudioTrack();
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    }

    // 4. Codec determination: Prioritize highest quality codecs with lossless/high-bitrate support
    let mimeCandidates = [];
    if (this.exportFormat === 'webm') {
      mimeCandidates = [
        hasAudio ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9',
        hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8',
        'video/webm'
      ];
    } else {
      mimeCandidates = [
        hasAudio ? 'video/mp4;codecs=avc1.640028,mp4a.40.2' : 'video/mp4;codecs=avc1.640028',
        hasAudio ? 'video/mp4;codecs=avc1.4d401f,mp4a.40.2' : 'video/mp4;codecs=avc1.4d401f',
        hasAudio ? 'video/mp4;codecs=avc1,mp4a.40.2' : 'video/mp4;codecs=avc1',
        'video/mp4',
        hasAudio ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9',
        hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8',
        'video/webm'
      ];
    }

    let mimeType = 'video/mp4';
    let fileExt = 'mp4';
    this.exportMediaRecorder = null;

    for (const mime of mimeCandidates) {
      if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(mime)) {
        try {
          this.exportMediaRecorder = new MediaRecorder(stream, {
            mimeType: mime,
            videoBitsPerSecond: targetBitrate,
            audioBitsPerSecond: 192000
          });
          mimeType = mime;
          fileExt = mime.includes('mp4') ? 'mp4' : 'webm';
          break;
        } catch (e) {
          console.warn(`MediaRecorder init attempt failed with ${mime}:`, e);
        }
      }
    }

    if (!this.exportMediaRecorder) {
      try {
        this.exportMediaRecorder = new MediaRecorder(stream, {
          videoBitsPerSecond: targetBitrate,
          audioBitsPerSecond: 192000
        });
      } catch (e) {
        console.warn('Fallback to standard MediaRecorder options:', e);
        this.exportMediaRecorder = new MediaRecorder(stream);
      }
      mimeType = this.exportMediaRecorder.mimeType || 'video/mp4';
      fileExt = mimeType.includes('webm') ? 'webm' : 'mp4';
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

    const recordTick = () => {
      if (!this.isExporting) return;

      const elapsedMs = performance.now() - startTime;
      const progress = Math.min(1.0, elapsedMs / targetDurationMs);

      const isRevealSection = this.appendRevealEnding && (elapsedMs >= this.videoDuration * 1000);
      const prevReveal = this.answerRevealMode;
      if (isRevealSection) this.answerRevealMode = true;

      this.drawFrame(exportCtx, exportW, exportH, elapsedMs, true);
      this.answerRevealMode = prevReveal;

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
        this.syncTimerUI();

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
  // LOCAL STORAGE PERSISTENCE (AUTO-SAVE & RESTORE)
  // =========================================================================

  saveStateToLocalStorage() {
    try {
      const state = {
        version: 1,
        savedAt: Date.now(),
        aspectRatio: this.aspectRatio,
        resolutionPreset: this.resolutionPreset,
        bitrate: this.bitrate,
        fps: this.fps,
        videoDuration: this.videoDuration,
        activeCharType: this.activeCharType,
        animalCount: this.animals.length,
        globalOpacity: this.globalOpacity !== undefined ? this.globalOpacity : 1.0,
        animals: this.animals.map(a => ({
          id: a.id,
          index: a.index,
          charId: a.charId,
          nx: parseFloat(a.nx.toFixed(4)),
          ny: parseFloat(a.ny.toFixed(4)),
          scale: parseFloat(a.scale.toFixed(3)),
          rotation: Math.round(a.rotation || 0),
          flipX: !!a.flipX,
          opacity: a.opacity !== undefined ? parseFloat(a.opacity.toFixed(2)) : 1.0,
          baseWidth: a.baseWidth || 100,
          baseHeight: a.baseHeight || 100
        })),
        bg: {
          isLoaded: this.bg.isLoaded,
          presetId: this.bg.presetId,
          src: (this.bg.src && !this.bg.src.startsWith('data:')) ? this.bg.src : null,
          customUrl: (this.bg.customUrl && this.bg.customUrl.length < 2500000) ? this.bg.customUrl : null,
          zoom: this.bg.zoom,
          panX: this.bg.panX,
          panY: this.bg.panY,
          brightness: this.bg.brightness,
          contrast: this.bg.contrast,
          saturation: this.bg.saturation
        },
        title: {
          text: this.title.text,
          style: this.title.style,
          size: this.title.size,
          color: this.title.color,
          nx: this.title.nx,
          ny: this.title.ny,
          autoSyncCount: this.title.autoSyncCount
        },
        timer: {
          enabled: this.timer.enabled,
          style: this.timer.style,
          size: this.timer.size,
          nx: this.timer.nx,
          ny: this.timer.ny,
          duration: this.timer.duration
        },
        watermark: {
          enabled: this.watermark.enabled,
          text: this.watermark.text,
          nx: this.watermark.nx,
          ny: this.watermark.ny,
          opacity: this.watermark.opacity
        }
      };

      localStorage.setItem('find_animal_dance_studio_saved_state_v1', JSON.stringify(state));
      const badge = document.getElementById('autoSaveBadge');
      if (badge) {
        badge.textContent = 'Auto-Saved';
        badge.style.opacity = '1';
      }
    } catch (e) {
      console.warn('LocalStorage save error (likely quota exceeded):', e);
      try {
        const stripped = JSON.parse(localStorage.getItem('find_animal_dance_studio_saved_state_v1') || '{}');
        if (stripped.bg) delete stripped.bg.customUrl;
        localStorage.setItem('find_animal_dance_studio_saved_state_v1', JSON.stringify(stripped));
      } catch (err2) {}
    }
  }

  debouncedSaveState() {
    if (this.saveStateTimeout) clearTimeout(this.saveStateTimeout);
    this.saveStateTimeout = setTimeout(() => {
      this.saveStateToLocalStorage();
    }, 350);
  }

  loadStateFromLocalStorage() {
    try {
      const raw = localStorage.getItem('find_animal_dance_studio_saved_state_v1');
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || !s.animals || !Array.isArray(s.animals) || s.animals.length === 0) return false;

      // 1. Aspect Ratio & Resolution & Video Properties
      if (s.aspectRatio) {
        this.aspectRatio = s.aspectRatio;
        this.canvasWidth = s.aspectRatio === '16:9' ? 1920 : (s.aspectRatio === '1:1' ? 1080 : 1080);
        this.canvasHeight = s.aspectRatio === '16:9' ? 1080 : (s.aspectRatio === '1:1' ? 1080 : (s.aspectRatio === '4:5' ? 1350 : 1920));
        document.querySelectorAll('.ratio-pill-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.ratio === this.aspectRatio);
        });
      }
      if (s.resolutionPreset) {
        this.resolutionPreset = s.resolutionPreset;
        const resSelect = document.getElementById('selectResolution');
        if (resSelect) resSelect.value = this.resolutionPreset;
      }
      if (s.bitrate) {
        this.bitrate = s.bitrate;
        const bitSelect = document.getElementById('selectBitrate');
        if (bitSelect) bitSelect.value = String(Math.round(this.bitrate / 1000000));
        const bitVal = document.getElementById('exportBitrateVal');
        if (bitVal) bitVal.textContent = `${Math.round(this.bitrate / 1000000)} Mbps`;
      }
      if (s.fps) {
        this.fps = s.fps;
        const fpsSelect = document.getElementById('selectFps');
        if (fpsSelect) fpsSelect.value = String(this.fps);
      }
      if (s.videoDuration) {
        this.videoDuration = s.videoDuration;
        const durInput = document.getElementById('inputVideoDuration');
        if (durInput) durInput.value = this.videoDuration;
      }

      // 2. Character Type & Global Opacity
      if (s.activeCharType) {
        this.activeCharType = s.activeCharType;
        document.querySelectorAll('.char-card').forEach(c => {
          c.classList.toggle('active', c.dataset.char === this.activeCharType);
        });
      }
      this.globalOpacity = s.globalOpacity !== undefined ? s.globalOpacity : 1.0;
      this.syncGlobalOpacityUI();

      // 3. Animals with exact saved positions, scales, rotations, flips, opacity
      this.animals = s.animals.map((a, idx) => ({
        id: a.id || `animal_${Date.now()}_${idx}`,
        index: a.index || (idx + 1),
        charId: a.charId || this.activeCharType,
        nx: Math.max(0.005, Math.min(0.995, a.nx ?? 0.5)),
        ny: Math.max(0.005, Math.min(0.995, a.ny ?? 0.5)),
        scale: Math.max(0.01, a.scale ?? 0.65),
        rotation: a.rotation || 0,
        flipX: !!a.flipX,
        opacity: a.opacity !== undefined ? a.opacity : this.globalOpacity,
        baseWidth: a.baseWidth || 100,
        baseHeight: a.baseHeight || 100
      }));
      this.animalCount = this.animals.length;

      // 4. Background
      if (s.bg) {
        this.bg.zoom = s.bg.zoom ?? 1.0;
        this.bg.panX = s.bg.panX ?? 0;
        this.bg.panY = s.bg.panY ?? 0;
        this.bg.brightness = s.bg.brightness ?? 100;
        this.bg.contrast = s.bg.contrast ?? 100;
        this.bg.saturation = s.bg.saturation ?? 100;

        if (s.bg.customUrl) {
          this.loadBackground(s.bg.customUrl, 'custom_bg');
        } else if (s.bg.presetId) {
          this.loadBackground(`assets/backgrounds/${s.bg.presetId}.jpg`, s.bg.presetId);
        } else if (s.bg.src) {
          this.loadBackground(s.bg.src, null);
        }

        const slZoom = document.getElementById('sliderBgZoom');
        const inZoom = document.getElementById('inputBgZoom');
        const valZoom = document.getElementById('bgZoomVal');
        if (slZoom) slZoom.value = Math.round(this.bg.zoom * 100);
        if (inZoom) inZoom.value = Math.round(this.bg.zoom * 100);
        if (valZoom) valZoom.textContent = `${Math.round(this.bg.zoom * 100)}%`;

        const slPanX = document.getElementById('sliderBgPanX');
        const inPanX = document.getElementById('inputBgPanX');
        const valPanX = document.getElementById('bgPanXVal');
        if (slPanX) slPanX.value = this.bg.panX;
        if (inPanX) inPanX.value = this.bg.panX;
        if (valPanX) valPanX.textContent = `${this.bg.panX}px`;

        const slPanY = document.getElementById('sliderBgPanY');
        const inPanY = document.getElementById('inputBgPanY');
        const valPanY = document.getElementById('bgPanYVal');
        if (slPanY) slPanY.value = this.bg.panY;
        if (inPanY) inPanY.value = this.bg.panY;
        if (valPanY) valPanY.textContent = `${this.bg.panY}px`;
      }

      // 5. Title
      if (s.title) {
        this.title.text = s.title.text ?? this.title.text;
        this.title.style = s.title.style ?? this.title.style;
        this.title.size = s.title.size ?? this.title.size;
        this.title.color = s.title.color ?? this.title.color;
        this.title.nx = s.title.nx ?? this.title.nx;
        this.title.ny = s.title.ny ?? this.title.ny;
        this.title.autoSyncCount = !!s.title.autoSyncCount;

        const inTitle = document.getElementById('inputTitleText');
        if (inTitle) inTitle.value = this.title.text;
        const selTitleStyle = document.getElementById('selectTitleStyle');
        if (selTitleStyle) selTitleStyle.value = this.title.style;
        const slTitleSize = document.getElementById('sliderTitleSize');
        const inTitleSize = document.getElementById('inputTitleSizeExact');
        const valTitleSize = document.getElementById('titleSizeVal');
        if (slTitleSize) slTitleSize.value = this.title.size;
        if (inTitleSize) inTitleSize.value = this.title.size;
        if (valTitleSize) valTitleSize.textContent = `${this.title.size}px`;
        const chkAuto = document.getElementById('checkTitleAutoCount');
        if (chkAuto) chkAuto.checked = this.title.autoSyncCount;
      }

      // 6. Timer
      if (s.timer) {
        this.timer.enabled = !!s.timer.enabled;
        this.timer.style = s.timer.style ?? this.timer.style;
        this.timer.size = s.timer.size ?? this.timer.size;
        this.timer.nx = s.timer.nx ?? this.timer.nx;
        this.timer.ny = s.timer.ny ?? this.timer.ny;
        this.syncTimerUI();
      }

      // 7. Watermark
      if (s.watermark) {
        this.watermark.enabled = !!s.watermark.enabled;
        this.watermark.text = s.watermark.text ?? this.watermark.text;
        this.watermark.nx = s.watermark.nx ?? this.watermark.nx;
        this.watermark.ny = s.watermark.ny ?? this.watermark.ny;
        this.watermark.opacity = s.watermark.opacity ?? this.watermark.opacity;
        const inWm = document.getElementById('inputWatermarkText');
        if (inWm) inWm.value = this.watermark.text;
        const chkWm = document.getElementById('checkWatermarkEnable');
        if (chkWm) chkWm.checked = this.watermark.enabled;
      }

      if (s.title && s.title.text && !s.title.autoSyncCount) {
        this.title.text = s.title.text;
        const inTitle = document.getElementById('inputTitleText');
        if (inTitle) inTitle.value = this.title.text;
      } else {
        this.updateTitleCount();
      }
      this.renderLayerList();
      this.fitCanvasToScreen();
      return true;
    } catch (e) {
      console.warn('Failed to restore state from local storage:', e);
      return false;
    }
  }

  resetSettingsOnly() {
    // 1. Reset animal layout to clean default spread, 0.65 scale, 1.0 opacity, 0 rotation, flipX false
    // PRESERVE current active character!
    this.globalOpacity = 1.0;
    this.syncGlobalOpacityUI();
    const count = this.animals.length || 15;
    this.generateAnimals(count, true);

    // 2. Reset timer to disabled and default position & style
    this.timer.enabled = false;
    this.timer.style = 'circle_progress';
    this.timer.size = 130;
    this.timer.nx = 0.88;
    this.timer.ny = 0.08;
    this.syncTimerUI();

    // 3. Reset title styling & position
    this.title.style = 'pill_glow';
    this.title.size = 48;
    this.title.nx = 0.5;
    this.title.ny = 0.08;
    this.title.color = '#ffffff';
    this.title.autoSyncCount = true;
    this.updateTitleCount();

    // 4. Reset background zoom/pan/filters while keeping current image
    this.resetBackgroundTransform();

    // 5. Reset bitrate
    this.bitrate = 8000000;
    const bSel = document.getElementById('selectBitrate');
    if (bSel) bSel.value = '8';
    const bVal = document.getElementById('exportBitrateVal');
    if (bVal) bVal.textContent = '8 Mbps';

    this.saveStateToLocalStorage();
    this.pushHistoryState('Reset settings only');
    this.showToast('Workspace settings reset to defaults (characters & backdrop preserved)', 'info');
  }

  async clearAllStorage() {
    try {
      localStorage.removeItem('find_animal_dance_studio_saved_state_v1');
    } catch (e) {}

    if (window.storageManager) {
      try {
        await window.storageManager.clearAll();
      } catch (e) {
        console.warn('StorageManager clear error:', e);
      }
    }

    // Factory reset everything
    this.activeCharType = 'shuba_duck';
    this.setCharacterType('shuba_duck', 'Shuba Duck');
    this.setAspectRatio('9:16');
    this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');
    this.globalOpacity = 1.0;
    this.syncGlobalOpacityUI();
    this.generateAnimals(15, true);
    this.timer.enabled = false;
    this.timer.style = 'circle_progress';
    this.timer.size = 130;
    this.timer.nx = 0.88;
    this.timer.ny = 0.08;
    this.syncTimerUI();
    this.watermark.enabled = false;
    const chkWm = document.getElementById('checkWatermarkEnable');
    if (chkWm) chkWm.checked = false;
    this.bitrate = 8000000;
    const bSel = document.getElementById('selectBitrate');
    if (bSel) bSel.value = '8';
    const bVal = document.getElementById('exportBitrateVal');
    if (bVal) bVal.textContent = '8 Mbps';
    this.refreshSavedUploadsUI();
    this.pushHistoryState('Factory Reset');
    this.showToast('All browser storage, cache & custom assets cleared!', 'success');
  }

  syncGlobalOpacityUI() {
    const sl = document.getElementById('sliderGlobalOpacity');
    const inExact = document.getElementById('inputGlobalOpacityExact');
    const valText = document.getElementById('globalOpacityVal');
    const badge = document.getElementById('globalOpacityBadge');
    const pct = Math.round((this.globalOpacity !== undefined ? this.globalOpacity : 1.0) * 100);
    if (sl) sl.value = pct;
    if (inExact) inExact.value = pct;
    if (valText) valText.textContent = `${pct}%`;
    if (badge) badge.textContent = pct === 100 ? '100% Solid' : `${pct}% Ghost`;
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
