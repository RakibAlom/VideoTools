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
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this._boundRenderLoop = this.renderLoop.bind(this);
    this.stageWrapper = document.getElementById('stageWrapper');
    this.stageMainContainer = document.getElementById('stageMainContainer');

    // Canvas & Aspect Ratio
    this.aspectRatio = '9:16';
    this.canvasWidth = 1080;
    this.canvasHeight = 1920;
    const isMobileDevice = (typeof window !== 'undefined') && (window.innerWidth <= 992 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    this.isMobile = isMobileDevice;
    this.resolutionPreset = '4k'; // Universal High-Definition master default (supports 4K, 2K, 1080p freely)

    // Viewport Zoom
    this.viewportZoom = 1.0; // 1.0 = fit

    // Video Properties
    this.videoDuration = 15; // seconds
    this.fps = 30;
    this.bitrate = 'auto'; // Smart Optimized dynamic VBR (crisp HD & lightweight)
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

    // Background State (Supports both HD Images and Full-Motion Videos)
    this.bg = {
      presetId: 'rustic_water_village',
      type: 'image', // 'image' or 'video'
      isVideo: false,
      img: new Image(),
      video: null,
      isLoaded: false,
      duration: 0,
      volume: 0,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      brightness: 100,
      contrast: 100,
      saturation: 100
    };

    // Characters & Animals
    this.activeCharType = 'shuba_duck';
    this.characterDanceSpeed = 1.25; // 1.25x lively viral tempo default for upbeat dancing animals
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

      // Main Title Background Box & Border
      bgEnabled: false,
      bgColor: '#0f172a',
      bgOpacity: 0.85,
      bgRadius: 16,
      bgPaddingX: 36,
      bgPaddingY: 16,
      bgBorderColor: '#6366f1',
      bgBorderWidth: 0,
      bgBorderOpacity: 1.0,

      // Main Title Advanced Effects
      shadowColor: '#000000',
      shadowBlur: 14,
      shadowOffsetY: 6,
      glowEnabled: false,
      glowColor: '#06b6d4',
      glowIntensity: 20,
      gradientEnabled: false,
      gradientColor1: '#ff7a00',
      gradientColor2: '#f43f5e',

      // Subtitle Typography & Colors
      subtitleFontFamily: 'inherit',
      subtitleFontSize: 28,
      subtitleColor: '#fde047',
      subtitleStrokeColor: '#000000',
      subtitleStrokeWidth: 4,
      subtitleAllCaps: false,
      subtitleGlowEnabled: false,
      subtitleGlowColor: '#fde047',
      subtitleShadowBlur: 6,
      subtitleShadowOffsetY: 3,

      // Subtitle Background Box / Pill
      subtitleStyle: 'pill_glass',
      subtitleBgEnabled: true,
      subtitlePillColor: '#000000', // legacy alias
      subtitleBgColor: '#000000',
      subtitleBgOpacity: 0.75,
      subtitleBgRadius: 10,
      subtitleBgPaddingX: 20,
      subtitleBgPaddingY: 8,
      subtitleBorderColor: '#ffffff',
      subtitleBorderWidth: 1.5,
      subtitleBorderOpacity: 0.3,
      showSubtitlePill: true, // legacy alias

      gap: 40 // Title to subtitle spacing margin (0-250px)
    };

    // Watermark (Unrestricted 0-100% with Full Branding Styles & Persistence)
    this.watermark = {
      enabled: true,
      text: 'SmartBrain Game',
      fontFamily: 'Outfit',
      fontSize: 24,
      color: '#ffffff',
      opacity: 0.65,
      style: 'clean_glow',
      pillColor: '#000000',
      nx: 0.5,
      ny: 0.97 // right against bottom edge
    };

    // Auto-restore permanent brand default if previously saved
    try {
      const savedBrand = localStorage.getItem('ads_watermark_brand_default_v1');
      if (savedBrand) {
        const parsed = JSON.parse(savedBrand);
        Object.assign(this.watermark, parsed);
      }
    } catch (e) {}

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

    // 1. Immediately restore saved state or set defaults (Synchronous & instant < 2ms!)
    const restored = this.loadStateFromLocalStorage();
    if (!restored) {
      this.setAspectRatio('9:16');
      this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');
      this.generateAnimals(15, true);
    }
    this.pushHistoryState('Initial setup');

    // 2. Size canvas to viewport and synchronize all UI modules immediately
    this.fitCanvasToScreen();
    this.syncTimerUI();
    this.syncTitleUI();
    this.syncBackgroundUI();
    this.syncWatermarkUI();

    // 3. START 60FPS RENDER LOOP IMMEDIATELY!
    // The canvas preview frame is now alive, rendering the backdrop, titles, HUD, and grid instantly!
    requestAnimationFrame(this._boundRenderLoop);

    // 4. Load ONLY the active character GIF with highest priority!
    const activeChar = this.activeCharType || (this.animals[0] && this.animals[0].charId) || 'shuba_duck';
    this.ensureCharacterLoaded(activeChar).then(() => {
      this.renderLayerList();
    });

    // 5. Initialize IndexedDB storage in background without blocking the UI or preview frame
    if (window.storageManager) {
      window.storageManager.init().then(async () => {
        await this.loadAllCustomCharactersFromStorage();
        this.refreshSavedUploadsUI();
      }).catch(e => console.warn('StorageManager init warning:', e));
    }

    // 6. Progressively lazy-load popular built-in characters during browser idle periods
    this.lazyPreloadSecondaryCharacters(activeChar);

    // 7. Background audio synthesis (non-blocking, only after canvas is already running)
    setTimeout(() => {
      window.audioEngine.generatePresetBGM('quack_hop', 15).then(() => {
        this.onAudioTrackLoaded('Quack Hop', window.audioEngine.duration, !restored, false);
      }).catch(() => {});
    }, 120);

    if (restored) {
      this.showToast('✨ Restored your last session', 'info');
    } else {
      this.showToast('🦆 Animal Dance Studio Ready!', 'success');
    }
  }

  // =========================================================================
  // HIGH-PERFORMANCE ON-DEMAND & LAZY CHARACTER LOADER
  // =========================================================================

  async ensureCharacterLoaded(charId) {
    if (!charId) return null;
    if (this.loadedGifs.has(charId)) {
      return this.loadedGifs.get(charId);
    }
    if (!this.loadingGifsPromises) this.loadingGifsPromises = new Map();
    if (this.loadingGifsPromises.has(charId)) {
      return this.loadingGifsPromises.get(charId);
    }

    const loadPromise = (async () => {
      // 1. Check if it's a custom uploaded character from IndexedDB
      if (charId.startsWith('custom_') && window.storageManager) {
        try {
          const item = await window.storageManager.getItem('characters', charId);
          if (item && item.data) {
            const gifData = window.gifEngine.decode(item.data, item.name || charId);
            this.loadedGifs.set(charId, gifData);
            return gifData;
          }
        } catch (e) {}
      }

      // 2. Built-in character GIF
      const url = `assets/animals/${charId}.gif`;
      try {
        const gifData = await window.gifEngine.loadFromUrl(url, charId);
        if (gifData) {
          this.loadedGifs.set(charId, gifData);
        }
        return gifData;
      } catch (err) {
        console.warn(`Could not load character GIF ${charId}:`, err);
        return null;
      } finally {
        this.loadingGifsPromises.delete(charId);
      }
    })();

    this.loadingGifsPromises.set(charId, loadPromise);
    return loadPromise;
  }

  lazyPreloadSecondaryCharacters(activeChar) {
    // On mobile devices, never preload unselected secondary characters:
    // preserves 100% of network bandwidth, CPU cores, and GPU VRAM for buttery smooth 60fps playback!
    if (this.isMobile) return;

    const popularBuiltins = [
      'duck_dance',
      'cat_salsa',
      'dog_happy',
      'cat_popcat',
      'dog_dance',
      'frog_dance',
      'capybara_walk',
      'duck_fomo',
      'cat_orange'
    ];

    let delay = 1200;
    for (const charId of popularBuiltins) {
      if (charId === activeChar) continue;
      setTimeout(() => {
        if (!this.loadedGifs.has(charId)) {
          this.ensureCharacterLoaded(charId);
        }
      }, delay);
      delay += 800; // gentle pacing on desktop so browser stays silky smooth
    }
  }

  async loadAllCustomCharactersFromStorage() {
    if (!window.storageManager) return;
    try {
      const savedChars = await window.storageManager.getAllItems('characters');
      for (const item of savedChars) {
        // Only decode immediately if it is actively used in the current scene
        const isActivelyUsed = this.activeCharType === item.id || this.animals.some(a => a.charId === item.id);
        if (isActivelyUsed && item.data && !this.loadedGifs.has(item.id)) {
          const gifData = window.gifEngine.decode(item.data, item.name);
          this.loadedGifs.set(item.id, gifData);
        }
      }
    } catch (e) {
      console.warn('Error loading custom characters from storage:', e);
    }
  }

  async preloadBuiltinCharacters() {
    // Kept for backward compatibility; now loads active character only
    const activeChar = this.activeCharType || 'shuba_duck';
    await this.ensureCharacterLoaded(activeChar);
  }

  async loadCharacterGif(charId, url) {
    return this.ensureCharacterLoaded(charId);
  }

  setCharacterType(charId, charDisplayName = null) {
    this.activeCharType = charId;
    // Load character immediately on demand if not yet cached
    this.ensureCharacterLoaded(charId);

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
    if (this.bg.video) {
      try {
        this.bg.video.pause();
        this.bg.video.src = '';
        this.bg.video.load();
      } catch (e) {}
      this.bg.video = null;
    }
    this.bg.isVideo = false;
    this.bg.type = 'image';
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
    this.updateVideoBgUI();
    this.debouncedSaveState();
  }

  async loadVideoBackground(fileOrBlobOrUrl, name = 'custom_video') {
    if (this.bg.video) {
      try {
        this.bg.video.pause();
        this.bg.video.src = '';
        this.bg.video.load();
      } catch (e) {}
      this.bg.video = null;
    }

    this.bg.isLoaded = false;
    this.bg.isVideo = true;
    this.bg.type = 'video';
    this.bg.presetId = 'custom_video';
    this.bg.name = name;

    const video = document.createElement('video');
    video.muted = true;
    video.volume = 0;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    let videoUrl = '';
    if (typeof fileOrBlobOrUrl === 'string') {
      videoUrl = fileOrBlobOrUrl;
      this.bg.src = videoUrl;
    } else {
      videoUrl = URL.createObjectURL(fileOrBlobOrUrl);
      this.bg.src = videoUrl;
      this.bg.blob = fileOrBlobOrUrl;
    }
    video.src = videoUrl;

    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
      video.onloadeddata = () => resolve();
      video.oncanplay = () => resolve();
      video.onerror = () => resolve();
      setTimeout(resolve, 3000); // 3s fallback guard
    });

    // Chromium Blob Duration Fix: Blob URLs for webm/mp4 often report Infinity until probed
    let detectedDuration = video.duration;
    if (!isFinite(detectedDuration) || isNaN(detectedDuration) || detectedDuration <= 0) {
      try {
        await new Promise((resolve) => {
          const onTime = () => {
            video.removeEventListener('timeupdate', onTime);
            resolve();
          };
          video.addEventListener('timeupdate', onTime);
          video.currentTime = 1e6; // seek to end to force container parser
          setTimeout(resolve, 500);
        });
        detectedDuration = video.duration;
        video.currentTime = 0;
      } catch (e) {}
    }

    const cleanDuration = (isFinite(detectedDuration) && detectedDuration > 0) ? detectedDuration : 10;
    this.bg.video = video;
    this.bg.isLoaded = true;
    this.bg.duration = cleanDuration;
    this.bg.exportFrameBitmap = null;

    // Deselect static preset cards
    document.querySelectorAll('.bg-thumb-card').forEach(card => card.classList.remove('active'));

    if (this.isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
      try {
        video.currentTime = (this.currentTime % cleanDuration);
      } catch (e) {}
    }

    this.updateVideoBgUI();
    this.debouncedSaveState();
  }

  seekVideoToTime(video, time) {
    return new Promise((resolve) => {
      if (!video || isNaN(time)) return resolve();
      if (Math.abs(video.currentTime - time) < 0.015) {
        return resolve();
      }

      let done = false;
      const onReady = () => {
        if (!done) {
          done = true;
          video.removeEventListener('seeked', onSeekedHandler);
          video.removeEventListener('error', onReady);
          resolve();
        }
      };

      const onSeekedHandler = () => {
        // In modern Chromium/Firefox, requestVideoFrameCallback guarantees the new frame is rendered on the GPU texture
        if (typeof video.requestVideoFrameCallback === 'function') {
          try {
            video.requestVideoFrameCallback(onReady);
            setTimeout(onReady, 60);
          } catch (e) {
            onReady();
          }
        } else {
          onReady();
        }
      };

      video.addEventListener('seeked', onSeekedHandler, { once: true });
      video.addEventListener('error', onReady, { once: true });

      // Generous fallback timeout to allow hardware decoder pipeline to complete
      setTimeout(onReady, 140);

      try {
        // Reset ended state if video reached stream end previously
        if (video.ended) {
          video.currentTime = 0;
        }
        video.currentTime = time;
      } catch (e) {
        onReady();
      }
    });
  }

  captureVideoThumbnail(video) {
    return new Promise((resolve) => {
      if (!video) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch (e) {
        resolve(null);
      }
    });
  }

  updateVideoBgUI() {
    const card = document.getElementById('videoBgControlsCard');
    const badge = document.getElementById('videoBgDurationBadge');
    const chkMute = document.getElementById('checkMuteVideoBg');
    const typeBadge = document.getElementById('bgTypeBadge');

    if (this.bg.isVideo && this.bg.video) {
      if (card) card.style.display = 'block';
      const dur = (this.bg.duration > 0 && isFinite(this.bg.duration)) ? this.bg.duration : ((this.bg.video && isFinite(this.bg.video.duration)) ? this.bg.video.duration : 10);
      if (badge) badge.textContent = `${dur.toFixed(1)}s`;
      if (chkMute) chkMute.checked = !!this.bg.video.muted;
      if (typeBadge) {
        typeBadge.textContent = '🎬 Video Active';
        typeBadge.style.color = '#38bdf8';
        typeBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      }
    } else {
      if (card) card.style.display = 'none';
      if (typeBadge) {
        typeBadge.textContent = 'Image Active';
        typeBadge.style.color = '';
        typeBadge.style.borderColor = '';
      }
    }
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
    const countEl = document.getElementById('totalAnimalLayerCount');
    if (countEl) countEl.textContent = count;
    const mobBadge = document.getElementById('mobileLayerCountBadge');
    if (mobBadge) mobBadge.textContent = count;
    const floatBadge = document.getElementById('floatLayerBadge');
    if (floatBadge) floatBadge.textContent = count;

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
    const isMobile = window.innerWidth <= 992;
    const padW = isMobile ? 16 : 20;

    let padH = 85;
    if (isMobile) {
      const tb = document.querySelector('.stage-floating-toolbar');
      const bd = document.querySelector('.stage-bottom-deck');
      const tbH = tb ? (tb.offsetHeight || 36) + 16 : 48;
      const bdH = bd ? (bd.offsetHeight || 42) + 16 : 52;
      const floatBarH = 64; // space for bottom floating pill bar + safe area
      padH = tbH + bdH + floatBarH;
    }

    const containerW = this.stageMainContainer ? this.stageMainContainer.clientWidth : window.innerWidth;
    const containerH = this.stageMainContainer ? this.stageMainContainer.clientHeight : window.innerHeight;

    const maxW = Math.max(100, containerW - padW);
    const maxH = Math.max(100, containerH - padH);

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
      this.title.subtitleStyle = 'pill_glass';
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
      this.title.subtitleStyle = 'cyber_neon';
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
      this.title.subtitleStyle = 'tiktok_yellow';
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
      this.title.subtitleStyle = 'danger_alert';
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
      this.title.subtitleStyle = 'arcade_pixel';
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
      this.title.subtitleStyle = 'clean_outline';
      this.appendRevealEnding = true;
      document.getElementById('checkAppendReveal').checked = true;
      this.timer.enabled = true;
      this.timer.style = 'top_bar';
      this.videoDuration = 15;
      window.audioEngine.generatePresetBGM('quack_hop', 60);
    }

    // Preserve saved watermark branding
    try {
      const savedBrand = localStorage.getItem('ads_watermark_brand_default_v1');
      if (savedBrand) {
        Object.assign(this.watermark, JSON.parse(savedBrand));
      }
    } catch (e) {}

    // Sync UI elements
    this.syncTitleUI();
    this.syncWatermarkUI();
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
      // Pause preview canvas loop during video export to give 100% GPU & CPU priority to the export encoder
      return;
    }

    if (this.isPlaying && !this.isExporting) {
      this.currentTime += delta;
      if (this.currentTime >= this.videoDuration) {
        this.currentTime = 0;
      }
      this.updatePlayheadUI();

      // Video background sync during playback
      if (this.bg.isVideo && this.bg.video && this.bg.video.readyState >= 2) {
        if (this.bg.video.paused) {
          this.bg.video.play().catch(() => {});
        }
        // Resync if drifted by more than 0.35s
        const vidDur = (this.bg.duration > 0 && isFinite(this.bg.duration)) ? this.bg.duration : ((this.bg.video && isFinite(this.bg.video.duration)) ? this.bg.video.duration : 10);
        const bgExpectedTime = this.currentTime % vidDur;
        if (Math.abs(this.bg.video.currentTime - bgExpectedTime) > 0.35) {
          try {
            this.bg.video.currentTime = bgExpectedTime;
          } catch (e) {}
        }
      }
    }

    if (window.audioEngine && window.audioEngine.isPlaying) {
      this.drawWaveform();
    }

    // When playing or scrubbing, animation tracks timeline currentTime strictly
    // When paused in studio, dancing animals animate continuously at original speed so creator can see them dancing alive!
    const animTimeMs = (this.isPlaying || this.isScrubbing) ? (this.currentTime * 1000) : (timestamp || performance.now());
    this.drawFrame(this.ctx, this.canvasWidth, this.canvasHeight, animTimeMs, !this.creatorMode);
    requestAnimationFrame(this._boundRenderLoop);
  }

  drawFrame(ctx, width, height, timeMs, cleanMode = false) {
    this.drawFrameWithCache(ctx, width, height, timeMs, cleanMode, null, null);
  }

  drawFrameWithCache(ctx, width, height, timeMs, cleanMode = false, bgBitmap = null, overlayBitmap = null) {
    ctx.save();

    // 1. Background (instant 1-blit from pre-rendered bitmap if available)
    if (bgBitmap) {
      ctx.drawImage(bgBitmap, 0, 0, width, height);
    } else {
      this.renderBackground(ctx, width, height);
    }

    // 2. Animals (sorted by depth, dynamic animated GIF frames via GPU ImageBitmaps)
    this.renderAnimals(ctx, width, height, timeMs, cleanMode);

    // 3. Title & Subtitle + Watermark (instant 1-blit from pre-rendered overlay if available)
    if (overlayBitmap) {
      ctx.drawImage(overlayBitmap, 0, 0, width, height);
    } else {
      this.renderTitle(ctx, width, height, cleanMode);
      if (this.watermark.enabled) {
        this.renderWatermark(ctx, width, height, cleanMode);
      }
    }

    // 5. Countdown Timer
    if (this.timer.enabled && this.timer.style !== 'none') {
      this.renderTimer(ctx, width, height, timeMs, cleanMode);
    }

    // 6. Answer Reveal Rings
    if (this.answerRevealMode) {
      this.renderAnswerRevealRings(ctx, width, height, timeMs);
    }

    // 7. Dynamic Center Alignment Guideline & Snap Indicator (Middle Line)
    if (!cleanMode && this.creatorMode && this.interaction && this.interaction.isDragging) {
      const isDraggingTitle = this.interaction.dragTarget === 'title';
      const isDraggingWm = this.interaction.dragTarget === 'watermark';
      if (isDraggingTitle || isDraggingWm) {
        const itemX = isDraggingTitle ? this.title.nx : this.watermark.nx;
        const isSnapped = Math.abs(itemX - 0.5) < 0.005;
        this.renderCenterGuideline(ctx, width, height, isSnapped, isDraggingTitle ? 'TITLE' : 'WATERMARK');
      }
    }

    ctx.restore();
  }

  // --- Dynamic Center Alignment Guideline (Full Frame Middle Line) ---
  renderCenterGuideline(ctx, width, height, isSnapped, label) {
    const cx = width * 0.5;
    const scale = width / 1080;
    ctx.save();

    // 1. Draw glowing vertical middle guideline across the full canvas height
    ctx.lineWidth = (isSnapped ? 3.5 : 2) * scale;
    if (isSnapped) {
      ctx.strokeStyle = '#00ffff';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 14 * scale;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.shadowColor = 'transparent';
      ctx.setLineDash([10 * scale, 6 * scale]);
    }

    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();

    // 2. Draw prominent alignment HUD badge at top center
    const badgeY = 56 * scale;
    const badgeText = isSnapped ? `🎯 ${label} SNAPPED TO CENTER (50%)` : `↔️ DRAG TO CENTER (50%)`;
    ctx.font = `800 ${Math.round(20 * scale)}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textMetrics = ctx.measureText(badgeText);
    const bw = textMetrics.width + 36 * scale;
    const bh = 36 * scale;

    ctx.fillStyle = isSnapped ? 'rgba(6, 182, 212, 0.95)' : 'rgba(15, 23, 42, 0.88)';
    ctx.shadowColor = isSnapped ? 'rgba(6, 182, 212, 0.6)' : 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 12 * scale;
    ctx.beginPath();
    ctx.roundRect(cx - bw / 2, badgeY - bh / 2, bw, bh, 18 * scale);
    ctx.fill();

    ctx.strokeStyle = isSnapped ? '#ffffff' : 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.5 * scale;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(badgeText, cx, badgeY);

    ctx.restore();
  }

  renderBackground(ctx, width, height) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = (width >= 2160 || height >= 2160) ? 'medium' : 'high';

    const isVid = this.bg.isVideo && this.bg.video && (this.bg.video.videoWidth > 0 || this.bg.video.readyState >= 2);
    const media = this.bg.exportFrameBitmap || (isVid ? this.bg.video : this.bg.img);
    const mediaW = media ? (media.width || media.videoWidth || 0) : 0;
    const mediaH = media ? (media.height || media.videoHeight || 0) : 0;

    if (!this.bg.isLoaded || !mediaW || !mediaH) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      return;
    }

    ctx.save();
    const hasFilter = (this.bg.brightness !== 100 || this.bg.contrast !== 100 || this.bg.saturation !== 100);
    if (hasFilter) {
      ctx.filter = `brightness(${this.bg.brightness}%) contrast(${this.bg.contrast}%) saturate(${this.bg.saturation}%)`;
    }

    const mediaRatio = mediaW / mediaH;
    const canvasRatio = width / height;

    let baseW, baseH;
    if (mediaRatio > canvasRatio) {
      baseH = height;
      baseW = height * mediaRatio;
    } else {
      baseW = width;
      baseH = width / mediaRatio;
    }

    const drawW = baseW * this.bg.zoom;
    const drawH = baseH * this.bg.zoom;
    const drawX = (width - drawW) / 2 + (this.bg.panX * (width / 1080));
    const drawY = (height - drawH) / 2 + (this.bg.panY * (height / 1920));

    // Fill background only if the media doesn't completely cover the canvas
    if (drawX > 0 || drawY > 0 || (drawX + drawW) < width || (drawY + drawH) < height) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(media, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  renderAnimals(ctx, width, height, timeMs, cleanMode) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = (width >= 1440 || height >= 1440 || this.isMobile) ? 'medium' : 'high';
    const frameCache = new Map();

    for (let i = 0; i < this.animals.length; i++) {
      const a = this.animals[i];
      let gifData = this.loadedGifs.get(a.charId);
      if (!gifData && !this.loadingGifsPromises?.has(a.charId)) {
        this.ensureCharacterLoaded(a.charId);
      }

      const speedMult = a.animSpeed || this.characterDanceSpeed || 1.25;
      const effectiveTimeMs = timeMs * speedMult;
      const cacheKey = `${a.charId}_${speedMult}`;
      let frameCanvas = frameCache.get(cacheKey);
      if (frameCanvas === undefined) {
        frameCanvas = gifData ? window.gifEngine.getFrame(gifData, effectiveTimeMs) : null;
        frameCache.set(cacheKey, frameCanvas);
      }

      const x = a.nx * width;
      const y = a.ny * height;

      if (gifData && gifData.width) {
        a.baseWidth = gifData.width;
        a.baseHeight = gifData.height;
      }

      const resScale = width / 1080;
      const baseW = (gifData ? gifData.width : (a.baseWidth || 200)) * 0.9 * resScale;
      const baseH = (gifData ? gifData.height : (a.baseHeight || 200)) * 0.9 * resScale;

      const drawW = baseW * a.scale;
      const drawH = baseH * a.scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((a.rotation * Math.PI) / 180);
      if (a.flipX) ctx.scale(-1, 1);
      ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 1.0;

      if (frameCanvas) {
        try {
          ctx.drawImage(frameCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
        } catch (err) {
          const curFrameObj = gifData?.frames ? (window.gifEngine?.getFrameObject ? window.gifEngine.getFrameObject(gifData, effectiveTimeMs) : null) : null;
          const fallbackCanvas = curFrameObj?.canvas || gifData?.frames?.[0]?.canvas;
          if (fallbackCanvas) {
            try { ctx.drawImage(fallbackCanvas, -drawW / 2, -drawH / 2, drawW, drawH); } catch (e) {}
          }
        }
      } else {
        // High-end smooth pulse placeholder for instant responsiveness
        ctx.save();
        ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8 * resScale;
        ctx.beginPath();
        ctx.arc(0, 0, drawW * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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

  // --- Title & Subtitle Rendering (Fully Customizable Background, Border, Opacity, Radius, Glow & Gradient) ---
  renderTitle(ctx, width, height, cleanMode) {
    const x = this.title.nx * width;
    const y = this.title.ny * height;
    const scale = width / 1080;
    const fontSize = (this.title.fontSize || 64) * scale;
    const strokeWidth = (this.title.strokeWidth !== undefined ? this.title.strokeWidth : 10) * scale;
    const font = this.title.fontFamily || 'Outfit';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px '${font}', sans-serif`;

    const titleText = this.title.text || '';
    const style = this.title.style || 'viral_bold';

    // Helper: convert hex or rgb string + opacity to valid rgba string
    const toRgba = (hexOrColor, alpha = 1) => {
      if (!hexOrColor) return `rgba(0,0,0,${alpha})`;
      if (hexOrColor.startsWith('rgba')) {
        return hexOrColor.replace(/[\d\.]+\)$/g, `${alpha})`);
      }
      if (hexOrColor.startsWith('rgb')) {
        return hexOrColor.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
      }
      let c = hexOrColor.replace('#', '');
      if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      const r = parseInt(c.substring(0, 2), 16) || 0;
      const g = parseInt(c.substring(2, 4), 16) || 0;
      const b = parseInt(c.substring(4, 6), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
    };

    // Helper: draw smooth rounded pill / rectangle with optional border
    const drawPillBox = (cx, cy, w, h, r, fillColor, borderColor, bWidth) => {
      ctx.save();
      ctx.beginPath();
      const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(cx - w / 2, cy - h / 2, w, h, radius);
      } else {
        const left = cx - w / 2, top = cy - h / 2;
        ctx.moveTo(left + radius, top);
        ctx.arcTo(left + w, top, left + w, top + h, radius);
        ctx.arcTo(left + w, top + h, left, top + h, radius);
        ctx.arcTo(left, top + h, left, top, radius);
        ctx.arcTo(left, top + left + w, top, radius);
        ctx.closePath();
      }
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      if (borderColor && bWidth > 0) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = bWidth;
        ctx.stroke();
      }
      ctx.restore();
    };

    // 1. Determine Title Background Box Settings
    const presetHasBg = (style === 'clean_pill' || style === 'glass_border' || style === 'glass_pill' || style === 'danger_alert' || style === 'stealth_dark');
    const isBgActive = this.title.bgEnabled || (this.title.bgEnabled !== false && presetHasBg);

    if (isBgActive && titleText.length > 0) {
      const tm = ctx.measureText(titleText);
      const padX = (this.title.bgPaddingX !== undefined ? this.title.bgPaddingX : 36) * scale;
      const padY = (this.title.bgPaddingY !== undefined ? this.title.bgPaddingY : 16) * scale;
      const boxW = tm.width + (padX * 2);
      const boxH = fontSize + (padY * 2);
      const radius = (this.title.bgRadius !== undefined ? this.title.bgRadius : 16) * scale;
      const bgOpacity = this.title.bgOpacity !== undefined ? this.title.bgOpacity : 0.85;

      let bgColor = this.title.bgColor || '#0f172a';
      if (!this.title.bgEnabled && presetHasBg) {
        if (style === 'clean_pill') bgColor = '#ffffff';
        else if (style === 'danger_alert') bgColor = '#dc2626';
        else if (style === 'glass_pill') bgColor = '#0f172a';
        else if (style === 'stealth_dark') bgColor = '#0f172a';
      }

      const fillColor = toRgba(bgColor, bgOpacity);
      let bWidth = (this.title.bgBorderWidth !== undefined ? this.title.bgBorderWidth : 0) * scale;
      let bColor = this.title.bgBorderColor || '#6366f1';
      let bOpacity = this.title.bgBorderOpacity !== undefined ? this.title.bgBorderOpacity : 1.0;

      // Handle preset border defaults if not custom enabled
      if (!this.title.bgEnabled && presetHasBg) {
        if (style === 'glass_border') { bWidth = 2.5 * scale; bColor = '#6366f1'; bOpacity = 1.0; }
        else if (style === 'glass_pill') { bWidth = 2 * scale; bColor = '#ffffff'; bOpacity = 0.35; }
        else if (style === 'stealth_dark') { bWidth = 2 * scale; bColor = '#334155'; bOpacity = 1.0; }
      }

      const borderColor = bWidth > 0 ? toRgba(bColor, bOpacity) : null;

      // Box shadow / ambient glow
      ctx.save();
      if ((this.title.shadowBlur || 0) > 0) {
        ctx.shadowColor = this.title.shadowColor || 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = (this.title.shadowBlur || 14) * scale;
        ctx.shadowOffsetY = (this.title.shadowOffsetY || 4) * scale;
      }
      drawPillBox(x, y, boxW, boxH, radius, fillColor, borderColor, bWidth);
      ctx.restore();
    }

    // 2. Setup Text Fill (Gradient, Preset, or Solid Color)
    let fillStyle = this.title.textColor || '#ffffff';
    if (this.title.gradientEnabled) {
      const g = ctx.createLinearGradient(x, y - fontSize / 2, x, y + fontSize / 2);
      g.addColorStop(0, this.title.gradientColor1 || '#ff7a00');
      g.addColorStop(1, this.title.gradientColor2 || '#f43f5e');
      fillStyle = g;
    } else if (style === 'gradient_sunset') {
      const g = ctx.createLinearGradient(x, y - fontSize / 2, x, y + fontSize / 2);
      g.addColorStop(0, '#ff7a00');
      g.addColorStop(1, '#f43f5e');
      fillStyle = g;
    } else if (style === 'cyan_ice') {
      const g = ctx.createLinearGradient(x, y - fontSize / 2, x, y + fontSize / 2);
      g.addColorStop(0, '#e0f2fe');
      g.addColorStop(1, '#38bdf8');
      fillStyle = g;
    } else if (style === 'royal_gold') {
      const g = ctx.createLinearGradient(x, y - fontSize / 2, x, y + fontSize / 2);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(1, '#ca8a04');
      fillStyle = g;
    } else if (style === 'rainbow_candy') {
      const g = ctx.createLinearGradient(x - 200 * scale, y, x + 200 * scale, y);
      g.addColorStop(0, '#f43f5e');
      g.addColorStop(0.5, '#fbbf24');
      g.addColorStop(1, '#06b6d4');
      fillStyle = g;
    } else if (style === 'clean_pill' && (!this.title.textColor || this.title.textColor === '#ffffff')) {
      fillStyle = '#0f172a';
    } else if (style === 'tiktok_yellow' && (!this.title.textColor || this.title.textColor === '#ffffff')) {
      fillStyle = '#facc15';
    } else if (style === 'lime_fresh' && (!this.title.textColor || this.title.textColor === '#ffffff')) {
      fillStyle = '#a3e635';
    }

    // 3. Shadow & Neon Halo Bloom Setup
    ctx.save();
    if (this.title.glowEnabled) {
      ctx.shadowColor = this.title.glowColor || '#06b6d4';
      ctx.shadowBlur = (this.title.glowIntensity || 20) * scale;
    } else if (style === 'neon_glow') {
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 24 * scale;
    } else if (style === 'fire_flame') {
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 20 * scale;
    } else if ((this.title.shadowBlur || 0) > 0 && !isBgActive) {
      ctx.shadowColor = this.title.shadowColor || 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = (this.title.shadowBlur || 12) * scale;
      ctx.shadowOffsetY = (this.title.shadowOffsetY || 6) * scale;
    }

    // 4. 3D Shadow extrusion for arcade/tiktok presets
    if (style === 'tiktok_yellow' || style === 'golden_arcade') {
      const shadowColor = style === 'golden_arcade' ? '#78350f' : '#000000';
      for (let s = Math.round(5 * scale); s >= 1; s--) {
        ctx.fillStyle = shadowColor;
        ctx.fillText(titleText, x + s, y + s);
      }
    }

    // 5. Outline / Stroke
    if (strokeWidth > 0) {
      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = this.title.strokeColor || '#000000';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(titleText, x, y);
    }

    // 6. Main Text Fill
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = fillStyle;
    ctx.fillText(titleText, x, y);
    ctx.restore();

    // 7. Subtitle / Hook Rendering
    const gap = (this.title.gap !== undefined ? this.title.gap : 40) * scale;
    if (this.title.showSubtitle && this.title.subtitle && this.title.subtitle.trim().length > 0) {
      const subFontSize = (this.title.subtitleFontSize || 28) * scale;
      const subY = y + (fontSize * 0.5) + gap + (subFontSize * 0.5);
      const subFont = (this.title.subtitleFontFamily && this.title.subtitleFontFamily !== 'inherit') 
        ? this.title.subtitleFontFamily 
        : font;
      
      ctx.font = `800 ${subFontSize}px '${subFont}', sans-serif`;
      
      let subText = this.title.subtitle;
      if (this.title.subtitleAllCaps) subText = subText.toUpperCase();

      const subMetrics = ctx.measureText(subText);
      const subPadX = (this.title.subtitleBgPaddingX !== undefined ? this.title.subtitleBgPaddingX : 20) * scale;
      const subPadY = (this.title.subtitleBgPaddingY !== undefined ? this.title.subtitleBgPaddingY : 8) * scale;
      const pW = subMetrics.width + (subPadX * 2);
      const pH = subFontSize + (subPadY * 2);
      const subRadius = (this.title.subtitleBgRadius !== undefined ? this.title.subtitleBgRadius : 10) * scale;

      const subBgActive = (this.title.subtitleBgEnabled !== false && this.title.showSubtitlePill !== false);

      // Subtitle Background Box / Pill
      if (subBgActive) {
        const subBgColor = this.title.subtitleBgColor || this.title.subtitlePillColor || '#000000';
        const subBgOpacity = this.title.subtitleBgOpacity !== undefined ? this.title.subtitleBgOpacity : 0.75;
        const subFill = toRgba(subBgColor, subBgOpacity);

        const subBWidth = (this.title.subtitleBorderWidth !== undefined ? this.title.subtitleBorderWidth : 1.5) * scale;
        const subBOpacity = this.title.subtitleBorderOpacity !== undefined ? this.title.subtitleBorderOpacity : 0.3;
        const subBorder = subBWidth > 0 ? toRgba(this.title.subtitleBorderColor || '#ffffff', subBOpacity) : null;

        ctx.save();
        if ((this.title.subtitleShadowBlur || 0) > 0) {
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = (this.title.subtitleShadowBlur || 6) * scale;
          ctx.shadowOffsetY = (this.title.subtitleShadowOffsetY || 2) * scale;
        }
        drawPillBox(x, subY, pW, pH, subRadius, subFill, subBorder, subBWidth);
        ctx.restore();
      }

      // Subtitle Text Stroke & Shadow
      ctx.save();
      if (this.title.subtitleGlowEnabled) {
        ctx.shadowColor = this.title.subtitleGlowColor || '#fde047';
        ctx.shadowBlur = 16 * scale;
      } else if ((this.title.subtitleShadowBlur || 0) > 0 && !subBgActive) {
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = (this.title.subtitleShadowBlur || 6) * scale;
        ctx.shadowOffsetY = (this.title.subtitleShadowOffsetY || 2) * scale;
      }

      const subStrokeW = (this.title.subtitleStrokeWidth !== undefined ? this.title.subtitleStrokeWidth : 4) * scale;
      if (subStrokeW > 0) {
        ctx.lineWidth = subStrokeW;
        ctx.strokeStyle = this.title.subtitleStrokeColor || '#000000';
        ctx.lineJoin = 'round';
        ctx.strokeText(subText, x, subY);
      }

      ctx.shadowColor = 'transparent';
      ctx.fillStyle = this.title.subtitleColor || '#fde047';
      ctx.fillText(subText, x, subY);
      ctx.restore();
    }

    // 8. Creator Mode Drag & Alignment Bounding Box
    if (!cleanMode && this.creatorMode) {
      const metrics = ctx.measureText(titleText);
      const padX = (this.title.bgPaddingX || 36) * scale;
      const boxW = Math.max(metrics.width + 40 * scale, isBgActive ? metrics.width + padX * 2 : 0);
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

  // --- Watermark Rendering (UNRESTRICTED POSITIONING 0% TO 100% WITH STYLES) ---
  renderWatermark(ctx, width, height, cleanMode) {
    const x = this.watermark.nx * width;
    const y = this.watermark.ny * height;
    const scale = width / 1080;
    const fontSize = (this.watermark.fontSize || 24) * scale;
    const font = this.watermark.fontFamily || 'Outfit';
    const style = this.watermark.style || 'clean_glow';

    ctx.save();
    ctx.globalAlpha = this.watermark.opacity !== undefined ? this.watermark.opacity : 0.65;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${fontSize}px '${font}', sans-serif`;

    const metrics = ctx.measureText(this.watermark.text);
    const pW = metrics.width + 24 * scale;
    const pH = fontSize * 1.5;

    if (style === 'frosted_pill') {
      // 1. Frosted Glass Pill Backplate
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(x - pW / 2, y - pH / 2, pW, pH, 8 * scale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
      ctx.fillStyle = this.watermark.color || '#38bdf8';
      ctx.fillText(this.watermark.text, x, y);

    } else if (style === 'shadow_stroke') {
      // 2. Solid 3D Stroke Outline
      ctx.lineWidth = 4 * scale;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(this.watermark.text, x, y);
      ctx.fillStyle = this.watermark.color || '#ffffff';
      ctx.fillText(this.watermark.text, x, y);

    } else if (style === 'neon_brand') {
      // 3. Cyber Neon Cyan Branding
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 12 * scale;
      ctx.lineWidth = 3 * scale;
      ctx.strokeStyle = '#083344';
      ctx.strokeText(this.watermark.text, x, y);
      ctx.fillStyle = this.watermark.color || '#22d3ee';
      ctx.fillText(this.watermark.text, x, y);

    } else if (style === 'gold_brand') {
      // 4. Royal Gold Branding
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 6 * scale;
      ctx.lineWidth = 3.5 * scale;
      ctx.strokeStyle = '#78350f';
      ctx.strokeText(this.watermark.text, x, y);
      ctx.fillStyle = this.watermark.color || '#fde047';
      ctx.fillText(this.watermark.text, x, y);

    } else if (style === 'dark_pill') {
      // 5. Solid Dark Pill
      ctx.fillStyle = this.watermark.pillColor || 'rgba(0, 0, 0, 0.9)';
      ctx.beginPath();
      ctx.roundRect(x - pW / 2, y - pH / 2, pW, pH, 6 * scale);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5 * scale;
      ctx.stroke();
      ctx.fillStyle = this.watermark.color || '#ffffff';
      ctx.fillText(this.watermark.text, x, y);

    } else {
      // 6. Subtle Drop Glow (Default)
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 6 * scale;
      ctx.fillStyle = this.watermark.color || '#ffffff';
      ctx.fillText(this.watermark.text, x, y);
    }

    if (!cleanMode && this.creatorMode) {
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

    // Custom GIF Upload (Supports Multiple Files & Auto-Saves to IndexedDB)
    document.getElementById('customGifUpload').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      try {
        this.showToast(`Loading & decoding ${files.length} custom GIF${files.length > 1 ? 's' : ''}...`, 'info');
        let lastId = null;
        let lastName = null;

        for (const file of files) {
          const customId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const cleanOriginalName = file.name.replace(/\.gif$/i, '');
          const gifData = await window.gifEngine.loadFromFile(file, cleanOriginalName);
          gifData.name = cleanOriginalName;
          gifData.originalName = cleanOriginalName;
          this.loadedGifs.set(customId, gifData);

          lastId = customId;
          lastName = cleanOriginalName;

          // Save to IndexedDB with frame count, dimensions, thumbnail and original name
          if (window.storageManager) {
            const thumbUrl = gifData.frames[0].canvas.toDataURL('image/png');
            await window.storageManager.saveItem('characters', {
              id: customId,
              name: cleanOriginalName,
              originalName: cleanOriginalName,
              filename: file.name,
              date: new Date().toLocaleDateString(),
              size: file.size,
              data: gifData.originalBuffer,
              thumbnail: thumbUrl,
              width: gifData.width,
              height: gifData.height,
              frameCount: gifData.frames.length,
              duration: gifData.totalDuration,
              isTransparent: !!gifData.isTransparent
            });
          }
        }

        // Switch to Uploads category tab so user immediately sees their uploaded GIFs
        document.querySelectorAll('.char-cat-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.cat === 'custom');
        });
        ['Ducks', 'Dogs', 'Cats', 'Others'].forEach(c => {
          const el = document.getElementById(`charGrid${c}`);
          if (el) el.style.display = 'none';
        });
        const customGrid = document.getElementById('charGridCustom');
        if (customGrid) customGrid.style.display = 'grid';

        if (lastId && lastName) {
          this.setCharacterType(lastId, lastName);
        }
        await this.refreshSavedUploadsUI();
        e.target.value = ''; // Reset so uploading same file works

        this.showToast(`🎉 Saved ${files.length} custom GIF${files.length > 1 ? 's' : ''} to library!`, 'success');
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
      this.isChromaAnimating = false;
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
    const btnChromaAnim = document.getElementById('btnChromaToggleAnimate');
    if (btnChromaAnim) {
      btnChromaAnim.addEventListener('click', () => {
        this.toggleChromaAnimation();
      });
    }
    document.getElementById('btnApplyChromaKey').addEventListener('click', () => {
      this.applyChromaKeyToActive();
    });
    const btnDownloadChroma = document.getElementById('btnDownloadTransparentGif');
    if (btnDownloadChroma) {
      btnDownloadChroma.addEventListener('click', () => {
        this.downloadTransparentGifFromModal();
      });
    }

    // GIF Preview Modal Events
    const btnClosePreview = document.getElementById('btnCloseGifPreviewModal');
    if (btnClosePreview) {
      btnClosePreview.addEventListener('click', () => this.closeGifPreviewModal());
    }
    const btnPlayPausePreview = document.getElementById('btnGifPreviewPlayPause');
    if (btnPlayPausePreview) {
      btnPlayPausePreview.addEventListener('click', () => {
        this.isPreviewModalPlaying = !this.isPreviewModalPlaying;
        btnPlayPausePreview.innerHTML = this.isPreviewModalPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
      });
    }
    document.querySelectorAll('.gif-speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gif-speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.previewModalSpeed = parseFloat(btn.dataset.speed) || 1.0;
      });
    });
    document.querySelectorAll('.gif-bg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.gif-bg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const wrapper = document.getElementById('gifPreviewStageWrapper');
        if (!wrapper) return;
        const bg = btn.dataset.bg;
        wrapper.className = '';
        wrapper.style.backgroundColor = '';
        if (bg === 'checker') {
          wrapper.className = 'checkerboard-bg';
        } else if (bg === 'dark') {
          wrapper.style.backgroundColor = '#0f172a';
        } else if (bg === 'light') {
          wrapper.style.backgroundColor = '#ffffff';
        } else if (bg === 'green') {
          wrapper.style.backgroundColor = '#00ff00';
        }
      });
    });
    const btnPreviewUse = document.getElementById('btnGifPreviewUse');
    if (btnPreviewUse) {
      btnPreviewUse.addEventListener('click', () => {
        if (this.previewModalGifId && this.previewModalGif) {
          const originalCleanName = this.previewModalGif.originalName || this.previewModalGif.name;
          this.setCharacterType(this.previewModalGifId, originalCleanName);
          this.closeGifPreviewModal();
        }
      });
    }
    const btnPreviewChroma = document.getElementById('btnGifPreviewChroma');
    if (btnPreviewChroma) {
      btnPreviewChroma.addEventListener('click', () => {
        const id = this.previewModalGifId;
        this.closeGifPreviewModal();
        if (id) this.openChromaKeyModal(id);
      });
    }
    const btnPreviewDownload = document.getElementById('btnGifPreviewDownload');
    if (btnPreviewDownload) {
      btnPreviewDownload.addEventListener('click', () => {
        if (this.previewModalGif) {
          const rawName = this.previewModalGif.originalName || this.previewModalGif.name || 'character';
          const cleanName = rawName
            .replace(/^custom_\d+_[a-z0-9]+_?/i, '')
            .replace(/\.gif$/i, '')
            .replace(/_transparent$/i, '');
          const filename = this.previewModalGif.isTransparent ? `${cleanName || 'character'}_transparent.gif` : `${cleanName || 'character'}.gif`;
          try {
            const gifBytes = window.gifEngine.encodeToGif(this.previewModalGif);
            const blob = new Blob([gifBytes], { type: 'image/gif' });
            this.downloadBlob(blob, filename);
            this.showToast(`💾 Downloaded "${filename}"!`, 'success');
          } catch (e) {
            if (this.previewModalGif.originalBuffer) {
              const blob = new Blob([this.previewModalGif.originalBuffer], { type: 'image/gif' });
              this.downloadBlob(blob, filename);
              this.showToast(`💾 Downloaded "${filename}"!`, 'success');
            }
          }
        }
      });
    }

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

    // Character Dance Pace & Speed Presets
    document.querySelectorAll('.preset-chip[data-speed]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.preset-chip[data-speed]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const speed = parseFloat(chip.dataset.speed) || 1.25;
        this.characterDanceSpeed = speed;
        const badge = document.getElementById('danceSpeedBadge');
        if (badge) {
          const labelMap = { 1.0: '1.0x Normal', 1.25: '1.25x Lively ⚡', 1.5: '1.5x Fast 🚀', 2.0: '2.0x Turbo 🔥' };
          badge.textContent = labelMap[speed] || `${speed}x`;
        }
        this.showToast(`Character Dance Tempo: ${speed}x`, 'info');
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

    // Custom Background Upload (Images & Full-Motion Videos)
    document.getElementById('customBgUpload').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const isVideoFile = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|mkv|ogv)$/i.test(file.name);

      if (isVideoFile) {
        this.showToast('Loading background video...', 'info');
        try {
          await this.loadVideoBackground(file, file.name);
          const thumbUrl = await this.captureVideoThumbnail(this.bg.video);

          // Automatically sync timeline duration with uploaded video length
          const vidDur = Math.max(3, Math.min(300, Math.round(this.bg.duration || 10)));
          this.setVideoDuration(vidDur, false);

          if (window.storageManager) {
            try {
              await window.storageManager.deleteItem('backgrounds', 'current_active_bg');
            } catch (err) {}
            await window.storageManager.saveItem('backgrounds', {
              id: 'bg_' + Date.now(),
              name: file.name,
              type: 'video',
              duration: this.bg.duration,
              date: new Date().toLocaleDateString(),
              blob: file,
              dataUrl: thumbUrl || ''
            });
            await this.refreshSavedUploadsUI();
          }
          this.pushHistoryState('Loaded video backdrop');
          this.debouncedSaveState();
          this.showToast(`🎬 Video backdrop loaded! Timeline set to ${vidDur}s`, 'success');
        } catch (err) {
          console.error(err);
          this.showToast('Failed to load video file.', 'error');
        }
        e.target.value = '';
        return;
      }

      // Otherwise it is an image
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const dataUrl = evt.target.result;
        this.loadBackground(dataUrl, 'custom_bg');
        if (window.storageManager) {
          try {
            await window.storageManager.deleteItem('backgrounds', 'current_active_bg');
          } catch (err) {}
          await window.storageManager.saveItem('backgrounds', {
            id: 'bg_' + Date.now(),
            name: file.name,
            type: 'image',
            date: new Date().toLocaleDateString(),
            dataUrl: dataUrl
          });
          await this.refreshSavedUploadsUI();
        }
        this.debouncedSaveState();
        this.showToast('Custom background loaded!', 'success');
        e.target.value = ''; // Reset input to allow re-uploading the same file
      };
      reader.readAsDataURL(file);
    });

    // Background Sliders + Numeric Inputs
    const syncBgZoom = (val) => {
      this.bg.zoom = val / 100;
      document.getElementById('sliderBgZoom').value = val;
      document.getElementById('inputBgZoom').value = val;
      document.getElementById('bgZoomVal').textContent = val + '%';
      this.debouncedSaveState();
    };
    document.getElementById('sliderBgZoom').addEventListener('input', (e) => syncBgZoom(parseInt(e.target.value)));
    document.getElementById('inputBgZoom').addEventListener('input', (e) => syncBgZoom(parseInt(e.target.value) || 100));

    const syncBgPanX = (val) => {
      this.bg.panX = val;
      document.getElementById('sliderBgPanX').value = val;
      document.getElementById('inputBgPanX').value = val;
      document.getElementById('bgPanXVal').textContent = val + 'px';
      this.debouncedSaveState();
    };
    document.getElementById('sliderBgPanX').addEventListener('input', (e) => syncBgPanX(parseInt(e.target.value)));
    document.getElementById('inputBgPanX').addEventListener('input', (e) => syncBgPanX(parseInt(e.target.value) || 0));

    const syncBgPanY = (val) => {
      this.bg.panY = val;
      document.getElementById('sliderBgPanY').value = val;
      document.getElementById('inputBgPanY').value = val;
      document.getElementById('bgPanYVal').textContent = val + 'px';
      this.debouncedSaveState();
    };
    document.getElementById('sliderBgPanY').addEventListener('input', (e) => syncBgPanY(parseInt(e.target.value)));
    document.getElementById('inputBgPanY').addEventListener('input', (e) => syncBgPanY(parseInt(e.target.value) || 0));

    document.getElementById('btnResetBgTransform').addEventListener('click', () => {
      this.resetBackgroundTransform();
      this.debouncedSaveState();
    });

    // Video Backdrop Mute & Duration Sync Controls
    document.getElementById('checkMuteVideoBg')?.addEventListener('change', (e) => {
      if (this.bg.video) {
        this.bg.video.muted = e.target.checked;
        this.bg.video.volume = e.target.checked ? 0 : 1;
      }
    });

    document.getElementById('btnSyncVideoDuration')?.addEventListener('click', () => {
      const dur = Math.max(3, Math.min(300, Math.round(this.bg.duration || (this.bg.video && this.bg.video.duration) || 10)));
      this.setVideoDuration(dur);
      this.showToast(`⏱️ Studio duration matched to video (${dur}s)`, 'success');
    });

    // Lighting & Atmosphere Sliders
    document.getElementById('sliderBgBrightness')?.addEventListener('input', (e) => {
      this.bg.brightness = parseInt(e.target.value) || 100;
      const v = document.getElementById('bgBrightnessVal');
      if (v) v.textContent = this.bg.brightness + '%';
      this.debouncedSaveState();
    });
    document.getElementById('sliderBgContrast')?.addEventListener('input', (e) => {
      this.bg.contrast = parseInt(e.target.value) || 100;
      const v = document.getElementById('bgContrastVal');
      if (v) v.textContent = this.bg.contrast + '%';
      this.debouncedSaveState();
    });
    document.getElementById('sliderBgSaturation')?.addEventListener('input', (e) => {
      this.bg.saturation = parseInt(e.target.value) || 100;
      const v = document.getElementById('bgSaturationVal');
      if (v) v.textContent = this.bg.saturation + '%';
      this.debouncedSaveState();
    });

    // Title Controls & 18+ Styles
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
        const st = card.dataset.style;
        this.title.style = st;

        // Apply curated style defaults while keeping custom overrides configurable
        if (st === 'viral_bold') {
          this.title.bgEnabled = false;
          this.title.textColor = '#ffffff';
          this.title.strokeColor = '#000000';
          this.title.strokeWidth = 10;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'clean_pill') {
          this.title.bgEnabled = true;
          this.title.bgColor = '#ffffff';
          this.title.bgOpacity = 0.95;
          this.title.bgRadius = 24;
          this.title.bgPaddingX = 36;
          this.title.bgPaddingY = 14;
          this.title.bgBorderWidth = 0;
          this.title.textColor = '#0f172a';
          this.title.strokeWidth = 0;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'tiktok_yellow') {
          this.title.bgEnabled = false;
          this.title.textColor = '#facc15';
          this.title.strokeColor = '#000000';
          this.title.strokeWidth = 10;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'gradient_sunset') {
          this.title.bgEnabled = false;
          this.title.gradientEnabled = true;
          this.title.gradientColor1 = '#ff7a00';
          this.title.gradientColor2 = '#f43f5e';
          this.title.textColor = '#ff7a00';
          this.title.strokeColor = '#991b1b';
          this.title.strokeWidth = 6;
          this.title.glowEnabled = true;
          this.title.glowColor = '#f43f5e';
          this.title.glowIntensity = 15;
        } else if (st === 'cyan_ice') {
          this.title.bgEnabled = false;
          this.title.gradientEnabled = true;
          this.title.gradientColor1 = '#e0f2fe';
          this.title.gradientColor2 = '#38bdf8';
          this.title.textColor = '#38bdf8';
          this.title.strokeColor = '#0369a1';
          this.title.strokeWidth = 8;
          this.title.glowEnabled = true;
          this.title.glowColor = '#0284c7';
          this.title.glowIntensity = 18;
        } else if (st === 'lime_fresh') {
          this.title.bgEnabled = false;
          this.title.textColor = '#a3e635';
          this.title.strokeColor = '#14532d';
          this.title.strokeWidth = 8;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'glass_border') {
          this.title.bgEnabled = true;
          this.title.bgColor = '#0f172a';
          this.title.bgOpacity = 0.85;
          this.title.bgRadius = 14;
          this.title.bgPaddingX = 32;
          this.title.bgPaddingY = 16;
          this.title.bgBorderColor = '#6366f1';
          this.title.bgBorderWidth = 2.5;
          this.title.bgBorderOpacity = 1.0;
          this.title.textColor = '#f8fafc';
          this.title.strokeWidth = 4;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'neon_glow') {
          this.title.bgEnabled = false;
          this.title.textColor = '#38bdf8';
          this.title.strokeColor = '#0369a1';
          this.title.strokeWidth = 4;
          this.title.glowEnabled = true;
          this.title.glowColor = '#38bdf8';
          this.title.glowIntensity = 24;
          this.title.gradientEnabled = false;
        } else if (st === 'golden_arcade') {
          this.title.bgEnabled = false;
          this.title.textColor = '#fbbf24';
          this.title.strokeColor = '#78350f';
          this.title.strokeWidth = 8;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'danger_alert') {
          this.title.bgEnabled = true;
          this.title.bgColor = '#dc2626';
          this.title.bgOpacity = 0.95;
          this.title.bgRadius = 8;
          this.title.bgPaddingX = 30;
          this.title.bgPaddingY = 14;
          this.title.bgBorderColor = '#fee2e2';
          this.title.bgBorderWidth = 1.5;
          this.title.bgBorderOpacity = 0.8;
          this.title.textColor = '#fef08a';
          this.title.strokeColor = '#7f1d1d';
          this.title.strokeWidth = 4;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'glass_pill') {
          this.title.bgEnabled = true;
          this.title.bgColor = '#0f172a';
          this.title.bgOpacity = 0.45;
          this.title.bgRadius = 30;
          this.title.bgPaddingX = 36;
          this.title.bgPaddingY = 16;
          this.title.bgBorderColor = '#ffffff';
          this.title.bgBorderWidth = 2;
          this.title.bgBorderOpacity = 0.4;
          this.title.textColor = '#ffffff';
          this.title.strokeWidth = 4;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'emerald_game') {
          this.title.bgEnabled = false;
          this.title.textColor = '#10b981';
          this.title.strokeColor = '#064e3b';
          this.title.strokeWidth = 8;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'rainbow_candy') {
          this.title.bgEnabled = false;
          this.title.gradientEnabled = true;
          this.title.gradientColor1 = '#f43f5e';
          this.title.gradientColor2 = '#06b6d4';
          this.title.textColor = '#f472b6';
          this.title.strokeColor = '#38bdf8';
          this.title.strokeWidth = 6;
          this.title.glowEnabled = false;
        } else if (st === 'fire_flame') {
          this.title.bgEnabled = false;
          this.title.textColor = '#fbbf24';
          this.title.strokeColor = '#991b1b';
          this.title.strokeWidth = 8;
          this.title.glowEnabled = true;
          this.title.glowColor = '#f97316';
          this.title.glowIntensity = 22;
          this.title.gradientEnabled = false;
        } else if (st === 'retro_pixel') {
          this.title.bgEnabled = false;
          this.title.fontFamily = 'Press Start 2P';
          this.title.textColor = '#a3e635';
          this.title.strokeColor = '#052e16';
          this.title.strokeWidth = 6;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'bubble_pop') {
          this.title.bgEnabled = false;
          this.title.textColor = '#c084fc';
          this.title.strokeColor = '#581c87';
          this.title.strokeWidth = 8;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        } else if (st === 'royal_gold') {
          this.title.bgEnabled = false;
          this.title.gradientEnabled = true;
          this.title.gradientColor1 = '#fef08a';
          this.title.gradientColor2 = '#ca8a04';
          this.title.textColor = '#fef08a';
          this.title.strokeColor = '#854d0e';
          this.title.strokeWidth = 8;
          this.title.glowEnabled = false;
        } else if (st === 'stealth_dark') {
          this.title.bgEnabled = true;
          this.title.bgColor = '#0f172a';
          this.title.bgOpacity = 0.95;
          this.title.bgRadius = 6;
          this.title.bgPaddingX = 28;
          this.title.bgPaddingY = 12;
          this.title.bgBorderColor = '#334155';
          this.title.bgBorderWidth = 2;
          this.title.bgBorderOpacity = 1.0;
          this.title.textColor = '#ffffff';
          this.title.strokeColor = '#000000';
          this.title.strokeWidth = 2;
          this.title.gradientEnabled = false;
          this.title.glowEnabled = false;
        }

        this.syncTitleUI();
        this.pushHistoryState('Title style: ' + st);
        this.debouncedSaveState();
      });
    });

    document.getElementById('selectFontFamily').addEventListener('change', (e) => {
      this.title.fontFamily = e.target.value;
      this.debouncedSaveState();
    });

    // UNLIMITED FONT SIZE (5px to 500px)
    const syncTitleSize = (val) => {
      val = Math.max(5, Math.min(500, val));
      this.title.fontSize = val;
      document.getElementById('sliderTitleSize').value = Math.min(300, val);
      document.getElementById('inputTitleSizeExact').value = val;
      document.getElementById('titleSizeVal').textContent = val + 'px';
      this.debouncedSaveState();
    };
    document.getElementById('sliderTitleSize').addEventListener('input', (e) => syncTitleSize(parseInt(e.target.value)));
    document.getElementById('inputTitleSizeExact').addEventListener('input', (e) => syncTitleSize(parseInt(e.target.value) || 64));

    document.getElementById('inputTextColor').addEventListener('input', (e) => {
      this.title.textColor = e.target.value;
      this.debouncedSaveState();
    });
    document.getElementById('inputStrokeColor').addEventListener('input', (e) => {
      this.title.strokeColor = e.target.value;
      this.debouncedSaveState();
    });

    const syncStrokeWidth = (val) => {
      this.title.strokeWidth = val;
      document.getElementById('sliderStrokeWidth').value = val;
      document.getElementById('inputStrokeWidthExact').value = val;
      document.getElementById('strokeWidthVal').textContent = val + 'px';
      this.debouncedSaveState();
    };
    document.getElementById('sliderStrokeWidth').addEventListener('input', (e) => syncStrokeWidth(parseInt(e.target.value)));
    document.getElementById('inputStrokeWidthExact').addEventListener('input', (e) => syncStrokeWidth(parseInt(e.target.value) || 0));

    // --- Main Title Background Box Controls ---
    const checkTitleBg = document.getElementById('checkTitleBgEnable');
    if (checkTitleBg) {
      checkTitleBg.addEventListener('change', (e) => {
        this.title.bgEnabled = e.target.checked;
        this.debouncedSaveState();
      });
    }

    const inTitleBgColor = document.getElementById('inputTitleBgColor');
    if (inTitleBgColor) {
      inTitleBgColor.addEventListener('input', (e) => {
        this.title.bgColor = e.target.value;
        this.debouncedSaveState();
      });
    }

    const slTitleBgOpacity = document.getElementById('sliderTitleBgOpacity');
    if (slTitleBgOpacity) {
      slTitleBgOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        this.title.bgOpacity = val / 100;
        const ind = document.getElementById('titleBgOpacityVal');
        if (ind) ind.textContent = val + '%';
        this.debouncedSaveState();
      });
    }

    const syncTitleBgRadius = (val) => {
      val = Math.max(0, Math.min(100, val));
      this.title.bgRadius = val;
      const sl = document.getElementById('sliderTitleBgRadius');
      const inp = document.getElementById('inputTitleBgRadiusExact');
      const ind = document.getElementById('titleBgRadiusVal');
      if (sl) sl.value = Math.min(60, val);
      if (inp) inp.value = val;
      if (ind) ind.textContent = val + 'px';
      this.debouncedSaveState();
    };
    const slTitleBgRadius = document.getElementById('sliderTitleBgRadius');
    if (slTitleBgRadius) slTitleBgRadius.addEventListener('input', (e) => syncTitleBgRadius(parseInt(e.target.value) || 0));
    const inTitleBgRadiusExact = document.getElementById('inputTitleBgRadiusExact');
    if (inTitleBgRadiusExact) inTitleBgRadiusExact.addEventListener('input', (e) => syncTitleBgRadius(parseInt(e.target.value) || 0));

    const slTitleBgPaddingX = document.getElementById('sliderTitleBgPaddingX');
    if (slTitleBgPaddingX) {
      slTitleBgPaddingX.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        this.title.bgPaddingX = val;
        const ind = document.getElementById('titleBgPaddingXVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    const slTitleBgPaddingY = document.getElementById('sliderTitleBgPaddingY');
    if (slTitleBgPaddingY) {
      slTitleBgPaddingY.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        this.title.bgPaddingY = val;
        const ind = document.getElementById('titleBgPaddingYVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    const inTitleBorderColor = document.getElementById('inputTitleBorderColor');
    if (inTitleBorderColor) {
      inTitleBorderColor.addEventListener('input', (e) => {
        this.title.bgBorderColor = e.target.value;
        this.debouncedSaveState();
      });
    }

    const slTitleBorderWidth = document.getElementById('sliderTitleBorderWidth');
    if (slTitleBorderWidth) {
      slTitleBorderWidth.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        this.title.bgBorderWidth = val;
        const ind = document.getElementById('titleBorderWidthVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    const slTitleBorderOpacity = document.getElementById('sliderTitleBorderOpacity');
    if (slTitleBorderOpacity) {
      slTitleBorderOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        this.title.bgBorderOpacity = val / 100;
        const ind = document.getElementById('titleBorderOpacityVal');
        if (ind) ind.textContent = val + '%';
        this.debouncedSaveState();
      });
    }

    // --- Main Title Advanced Effects (Gradient, Glow, Shadow) ---
    const checkTitleGrad = document.getElementById('checkTitleGradientEnable');
    if (checkTitleGrad) {
      checkTitleGrad.addEventListener('change', (e) => {
        this.title.gradientEnabled = e.target.checked;
        const grp = document.getElementById('titleGradientControls');
        if (grp) grp.style.display = e.target.checked ? 'grid' : 'none';
        this.debouncedSaveState();
      });
    }

    const inGrad1 = document.getElementById('inputTitleGradColor1');
    if (inGrad1) {
      inGrad1.addEventListener('input', (e) => {
        this.title.gradientColor1 = e.target.value;
        this.debouncedSaveState();
      });
    }

    const inGrad2 = document.getElementById('inputTitleGradColor2');
    if (inGrad2) {
      inGrad2.addEventListener('input', (e) => {
        this.title.gradientColor2 = e.target.value;
        this.debouncedSaveState();
      });
    }

    const checkTitleGlow = document.getElementById('checkTitleGlowEnable');
    if (checkTitleGlow) {
      checkTitleGlow.addEventListener('change', (e) => {
        this.title.glowEnabled = e.target.checked;
        const grp = document.getElementById('titleGlowControls');
        if (grp) grp.style.display = e.target.checked ? 'grid' : 'none';
        this.debouncedSaveState();
      });
    }

    const inTitleGlowColor = document.getElementById('inputTitleGlowColor');
    if (inTitleGlowColor) {
      inTitleGlowColor.addEventListener('input', (e) => {
        this.title.glowColor = e.target.value;
        this.debouncedSaveState();
      });
    }

    const slTitleGlowIntensity = document.getElementById('sliderTitleGlowIntensity');
    if (slTitleGlowIntensity) {
      slTitleGlowIntensity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 20;
        this.title.glowIntensity = val;
        const ind = document.getElementById('titleGlowIntensityVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    const inTitleShadowColor = document.getElementById('inputTitleShadowColor');
    if (inTitleShadowColor) {
      inTitleShadowColor.addEventListener('input', (e) => {
        this.title.shadowColor = e.target.value;
        this.debouncedSaveState();
      });
    }

    const slTitleShadowBlur = document.getElementById('sliderTitleShadowBlur');
    if (slTitleShadowBlur) {
      slTitleShadowBlur.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        this.title.shadowBlur = val;
        const ind = document.getElementById('titleShadowBlurVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    // --- Subtitle Styling Deck ---
    const selSubFont = document.getElementById('selectSubtitleFontFamily');
    if (selSubFont) {
      selSubFont.addEventListener('change', (e) => {
        this.title.subtitleFontFamily = e.target.value;
        this.debouncedSaveState();
      });
    }

    const syncSubSize = (val) => {
      this.title.subtitleFontSize = val;
      document.getElementById('sliderSubtitleSize').value = val;
      document.getElementById('inputSubtitleSizeExact').value = val;
      document.getElementById('subtitleSizeVal').textContent = val + 'px';
      this.debouncedSaveState();
    };
    document.getElementById('sliderSubtitleSize').addEventListener('input', (e) => syncSubSize(parseInt(e.target.value)));
    document.getElementById('inputSubtitleSizeExact').addEventListener('input', (e) => syncSubSize(parseInt(e.target.value) || 28));

    document.getElementById('inputSubtitleColor').addEventListener('input', (e) => {
      this.title.subtitleColor = e.target.value;
      this.debouncedSaveState();
    });

    const inSubStrokeColor = document.getElementById('inputSubtitleStrokeColor');
    if (inSubStrokeColor) {
      inSubStrokeColor.addEventListener('input', (e) => {
        this.title.subtitleStrokeColor = e.target.value;
        this.debouncedSaveState();
      });
    }

    const slSubStrokeW = document.getElementById('sliderSubtitleStrokeWidth');
    if (slSubStrokeW) {
      slSubStrokeW.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        this.title.subtitleStrokeWidth = val;
        const ind = document.getElementById('subStrokeWidthVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    const chkSubAllCaps = document.getElementById('checkSubtitleAllCaps');
    if (chkSubAllCaps) {
      chkSubAllCaps.addEventListener('change', (e) => {
        this.title.subtitleAllCaps = e.target.checked;
        this.debouncedSaveState();
      });
    }

    const chkSubGlow = document.getElementById('checkSubtitleGlowEnable');
    if (chkSubGlow) {
      chkSubGlow.addEventListener('change', (e) => {
        this.title.subtitleGlowEnabled = e.target.checked;
        const grp = document.getElementById('subGlowControls');
        if (grp) grp.style.display = e.target.checked ? 'block' : 'none';
        this.debouncedSaveState();
      });
    }

    const inSubGlowColor = document.getElementById('inputSubtitleGlowColor');
    if (inSubGlowColor) {
      inSubGlowColor.addEventListener('input', (e) => {
        this.title.subtitleGlowColor = e.target.value;
        this.debouncedSaveState();
      });
    }

    // Subtitle Background Box / Pill
    const chkSubBg = document.getElementById('checkSubtitleBgEnable') || document.getElementById('checkSubtitlePillEnable');
    if (chkSubBg) {
      chkSubBg.addEventListener('change', (e) => {
        this.title.subtitleBgEnabled = e.target.checked;
        this.title.showSubtitlePill = e.target.checked;
        this.debouncedSaveState();
      });
    }

    const inSubPill = document.getElementById('inputSubtitlePillColor');
    if (inSubPill) {
      inSubPill.addEventListener('input', (e) => {
        this.title.subtitleBgColor = e.target.value;
        this.title.subtitlePillColor = e.target.value;
        this.debouncedSaveState();
      });
    }

    const slSubBgOpacity = document.getElementById('sliderSubtitleBgOpacity');
    if (slSubBgOpacity) {
      slSubBgOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        this.title.subtitleBgOpacity = val / 100;
        const ind = document.getElementById('subBgOpacityVal');
        if (ind) ind.textContent = val + '%';
        this.debouncedSaveState();
      });
    }

    const syncSubBgRadius = (val) => {
      val = Math.max(0, Math.min(50, val));
      this.title.subtitleBgRadius = val;
      const sl = document.getElementById('sliderSubtitleBgRadius');
      const inp = document.getElementById('inputSubtitleBgRadiusExact');
      const ind = document.getElementById('subBgRadiusVal');
      if (sl) sl.value = Math.min(40, val);
      if (inp) inp.value = val;
      if (ind) ind.textContent = val + 'px';
      this.debouncedSaveState();
    };
    const slSubBgRadius = document.getElementById('sliderSubtitleBgRadius');
    if (slSubBgRadius) slSubBgRadius.addEventListener('input', (e) => syncSubBgRadius(parseInt(e.target.value) || 0));
    const inSubBgRadiusExact = document.getElementById('inputSubtitleBgRadiusExact');
    if (inSubBgRadiusExact) inSubBgRadiusExact.addEventListener('input', (e) => syncSubBgRadius(parseInt(e.target.value) || 0));

    const slSubBgPadX = document.getElementById('sliderSubtitleBgPaddingX');
    if (slSubBgPadX) {
      slSubBgPadX.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        this.title.subtitleBgPaddingX = val;
        const ind = document.getElementById('subBgPaddingXVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    const slSubBgPadY = document.getElementById('sliderSubtitleBgPaddingY');
    if (slSubBgPadY) {
      slSubBgPadY.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 0;
        this.title.subtitleBgPaddingY = val;
        const ind = document.getElementById('subBgPaddingYVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    const inSubBorderColor = document.getElementById('inputSubtitleBorderColor');
    if (inSubBorderColor) {
      inSubBorderColor.addEventListener('input', (e) => {
        this.title.subtitleBorderColor = e.target.value;
        this.debouncedSaveState();
      });
    }

    const slSubBorderW = document.getElementById('sliderSubtitleBorderWidth');
    if (slSubBorderW) {
      slSubBorderW.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        this.title.subtitleBorderWidth = val;
        const ind = document.getElementById('subBorderWidthVal');
        if (ind) ind.textContent = val + 'px';
        this.debouncedSaveState();
      });
    }

    const slSubBorderOpacity = document.getElementById('sliderSubtitleBorderOpacity');
    if (slSubBorderOpacity) {
      slSubBorderOpacity.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        this.title.subtitleBorderOpacity = val / 100;
        const ind = document.getElementById('subBorderOpacityVal');
        if (ind) ind.textContent = val + '%';
        this.debouncedSaveState();
      });
    }

    // Subtitle Style Preset Cards
    document.querySelectorAll('.subtitle-style-card').forEach(card => {
      card.addEventListener('click', () => {
        const subStyle = card.dataset.substyle;
        this.title.subtitleStyle = subStyle;
        document.querySelectorAll('.subtitle-style-card').forEach(c => c.classList.toggle('active', c === card));

        // Curated preset adjustments
        if (subStyle === 'pill_glass') {
          this.title.subtitleBgEnabled = true;
          this.title.showSubtitlePill = true;
          this.title.subtitleBgColor = '#000000';
          this.title.subtitlePillColor = '#000000';
          this.title.subtitleBgOpacity = 0.75;
          this.title.subtitleBgRadius = 12;
          this.title.subtitleBorderColor = '#ffffff';
          this.title.subtitleBorderWidth = 1.5;
          this.title.subtitleBorderOpacity = 0.3;
          this.title.subtitleColor = '#fde047';
          this.title.subtitleStrokeColor = '#000000';
          this.title.subtitleStrokeWidth = 4;
          this.title.subtitleGlowEnabled = false;
        } else if (subStyle === 'tiktok_yellow') {
          this.title.subtitleBgEnabled = false;
          this.title.showSubtitlePill = false;
          this.title.subtitleColor = '#facc15';
          this.title.subtitleStrokeColor = '#000000';
          this.title.subtitleStrokeWidth = 6;
          this.title.subtitleGlowEnabled = false;
        } else if (subStyle === 'cyber_neon') {
          this.title.subtitleBgEnabled = false;
          this.title.showSubtitlePill = false;
          this.title.subtitleColor = '#67e8f9';
          this.title.subtitleStrokeColor = '#083344';
          this.title.subtitleStrokeWidth = 4;
          this.title.subtitleGlowEnabled = true;
          this.title.subtitleGlowColor = '#06b6d4';
        } else if (subStyle === 'danger_alert') {
          this.title.subtitleBgEnabled = true;
          this.title.showSubtitlePill = true;
          this.title.subtitleBgColor = '#dc2626';
          this.title.subtitlePillColor = '#dc2626';
          this.title.subtitleBgOpacity = 0.95;
          this.title.subtitleBgRadius = 6;
          this.title.subtitleBorderColor = '#fee2e2';
          this.title.subtitleBorderWidth = 1.0;
          this.title.subtitleBorderOpacity = 0.7;
          this.title.subtitleColor = '#fef08a';
          this.title.subtitleStrokeColor = '#7f1d1d';
          this.title.subtitleStrokeWidth = 2;
          this.title.subtitleGlowEnabled = false;
        } else if (subStyle === 'clean_outline') {
          this.title.subtitleBgEnabled = false;
          this.title.showSubtitlePill = false;
          this.title.subtitleColor = '#ffffff';
          this.title.subtitleStrokeColor = '#000000';
          this.title.subtitleStrokeWidth = 5;
          this.title.subtitleGlowEnabled = false;
        } else if (subStyle === 'gold_ribbon') {
          this.title.subtitleBgEnabled = true;
          this.title.showSubtitlePill = true;
          this.title.subtitleBgColor = '#78350f';
          this.title.subtitlePillColor = '#78350f';
          this.title.subtitleBgOpacity = 0.85;
          this.title.subtitleBgRadius = 8;
          this.title.subtitleBorderColor = '#fde047';
          this.title.subtitleBorderWidth = 1.5;
          this.title.subtitleBorderOpacity = 0.6;
          this.title.subtitleColor = '#fef08a';
          this.title.subtitleStrokeColor = '#451a03';
          this.title.subtitleStrokeWidth = 3;
          this.title.subtitleGlowEnabled = false;
        } else if (subStyle === 'arcade_pixel') {
          this.title.subtitleBgEnabled = false;
          this.title.showSubtitlePill = false;
          this.title.subtitleFontFamily = 'Press Start 2P';
          this.title.subtitleColor = '#a3e635';
          this.title.subtitleStrokeColor = '#052e16';
          this.title.subtitleStrokeWidth = 4;
          this.title.subtitleGlowEnabled = false;
        } else if (subStyle === 'minimal_pill') {
          this.title.subtitleBgEnabled = true;
          this.title.showSubtitlePill = true;
          this.title.subtitleBgColor = '#1e293b';
          this.title.subtitlePillColor = '#1e293b';
          this.title.subtitleBgOpacity = 0.9;
          this.title.subtitleBgRadius = 8;
          this.title.subtitleBorderColor = '#475569';
          this.title.subtitleBorderWidth = 1.0;
          this.title.subtitleBorderOpacity = 0.8;
          this.title.subtitleColor = '#f8fafc';
          this.title.subtitleStrokeColor = '#0f172a';
          this.title.subtitleStrokeWidth = 2;
          this.title.subtitleGlowEnabled = false;
        }

        this.syncTitleUI();
        this.debouncedSaveState();
        this.pushHistoryState(`Subtitle style to ${subStyle}`);
      });
    });

    // Title to Subtitle Spacing (Gap) Controls
    const syncTitleGap = (val) => {
      this.title.gap = val;
      document.getElementById('sliderTitleGap').value = val;
      document.getElementById('inputTitleGapExact').value = val;
      document.getElementById('titleGapVal').textContent = val + 'px';
      this.debouncedSaveState();
    };
    document.getElementById('sliderTitleGap').addEventListener('input', (e) => syncTitleGap(parseInt(e.target.value) || 0));
    document.getElementById('inputTitleGapExact').addEventListener('input', (e) => syncTitleGap(parseInt(e.target.value) || 0));
    // Audio Preset Switcher (6 Copyright-Free Tracks)
    document.getElementById('selectPresetTrack').addEventListener('change', async (e) => {
      const track = e.target.value;
      this.showToast(`Synthesizing "${track}" music...`, 'info');
      await window.audioEngine.generatePresetBGM(track, 30);
      this.onAudioTrackLoaded(track.replace('_', ' ').toUpperCase(), window.audioEngine.duration, true, true);
      this.debouncedSaveState();
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

    // Watermark (UNRESTRICTED POSITION 0% TO 100% WITH FULL BRANDING STYLES & PERSISTENCE)
    document.getElementById('checkWatermarkEnable').addEventListener('change', (e) => {
      this.watermark.enabled = e.target.checked;
      this.saveWatermarkBranding(false);
      this.debouncedSaveState();
    });
    document.getElementById('inputWatermarkText').addEventListener('input', (e) => {
      this.watermark.text = e.target.value;
      this.saveWatermarkBranding(false);
      this.debouncedSaveState();
    });

    // Watermark Style Presets
    document.querySelectorAll('.watermark-style-card').forEach(card => {
      card.addEventListener('click', () => {
        const wmStyle = card.dataset.wmstyle;
        this.watermark.style = wmStyle;
        document.querySelectorAll('.watermark-style-card').forEach(c => c.classList.toggle('active', c === card));
        this.saveWatermarkBranding(false);
        this.debouncedSaveState();
        this.pushHistoryState(`Watermark style: ${wmStyle}`);
      });
    });

    // Watermark Font Family
    const selWmFont = document.getElementById('selectWatermarkFont');
    if (selWmFont) {
      selWmFont.addEventListener('change', (e) => {
        this.watermark.fontFamily = e.target.value;
        this.saveWatermarkBranding(false);
        this.debouncedSaveState();
      });
    }

    // Watermark Text & Pill Colors
    const inWmColor = document.getElementById('inputWatermarkColor');
    if (inWmColor) {
      inWmColor.addEventListener('input', (e) => {
        this.watermark.color = e.target.value;
        this.saveWatermarkBranding(false);
        this.debouncedSaveState();
      });
    }
    const inWmPill = document.getElementById('inputWatermarkPillColor');
    if (inWmPill) {
      inWmPill.addEventListener('input', (e) => {
        this.watermark.pillColor = e.target.value;
        this.saveWatermarkBranding(false);
        this.debouncedSaveState();
      });
    }

    // Save as Default Branding Button
    const btnSaveWm = document.getElementById('btnSaveWatermarkDefault');
    if (btnSaveWm) {
      btnSaveWm.addEventListener('click', () => {
        this.saveWatermarkBranding(true);
      });
    }

    const syncWmX = (val) => {
      this.watermark.nx = val / 100;
      document.getElementById('sliderWatermarkX').value = val;
      document.getElementById('inputWatermarkXExact').value = val;
      document.getElementById('wmXVal').textContent = `${val}%`;
      this.saveWatermarkBranding(false);
    };
    document.getElementById('sliderWatermarkX').addEventListener('input', (e) => syncWmX(parseInt(e.target.value)));
    document.getElementById('inputWatermarkXExact').addEventListener('input', (e) => syncWmX(parseInt(e.target.value) || 50));

    const syncWmY = (val) => {
      this.watermark.ny = val / 100;
      document.getElementById('sliderWatermarkY').value = val;
      document.getElementById('inputWatermarkYExact').value = val;
      document.getElementById('wmYVal').textContent = `${val}%`;
      this.saveWatermarkBranding(false);
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
      this.saveWatermarkBranding(false);
    });

    const syncWmSize = (val) => {
      this.watermark.fontSize = val;
      document.getElementById('sliderWatermarkSize').value = val;
      document.getElementById('inputWatermarkSizeExact').value = val;
      document.getElementById('watermarkSizeVal').textContent = `${val}px`;
      this.saveWatermarkBranding(false);
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
    const resSelect = document.getElementById('selectResolution');
    if (resSelect) {
      resSelect.value = this.resolutionPreset;
      resSelect.addEventListener('change', (e) => {
        this.resolutionPreset = e.target.value;
        const bSelect = document.getElementById('selectBitrate');
        const bVal = document.getElementById('exportBitrateVal');
        if (bSelect && bVal) {
          if (bSelect.value === 'auto') {
            bVal.textContent = 'Smart Auto';
          } else {
            const mbps = (parseInt(bSelect.value) / 1000000).toFixed(1).replace('.0', '');
            bVal.textContent = `${mbps} Mbps`;
          }
        }
        this.debouncedSaveState();
      });
    }
    document.getElementById('selectFps').addEventListener('change', (e) => {
      this.fps = parseInt(e.target.value) || 30;
      this.debouncedSaveState();
    });
    document.getElementById('selectBitrate').addEventListener('change', (e) => {
      const val = e.target.value;
      this.bitrate = val === 'auto' ? 'auto' : parseInt(val);
      const bVal = document.getElementById('exportBitrateVal');
      if (bVal) {
        if (val === 'auto') {
          bVal.textContent = 'Smart Auto';
        } else {
          const mbps = (parseInt(val) / 1000000).toFixed(1).replace('.0', '');
          bVal.textContent = `${mbps} Mbps`;
        }
      }
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
      if (this.bg.isVideo && this.bg.video) {
        try { this.bg.video.currentTime = 0; } catch (e) {}
      }
      this.updatePlayheadUI();
    });
    document.getElementById('stageTimeScrubber').addEventListener('input', (e) => {
      this.currentTime = parseFloat(e.target.value);
      if (this.isPlaying) window.audioEngine.play(this.currentTime);
      if (this.bg.isVideo && this.bg.video) {
        try {
          const vidDur = (this.bg.duration > 0 && isFinite(this.bg.duration)) ? this.bg.duration : 10;
          this.bg.video.currentTime = (this.currentTime % vidDur);
        } catch (e) {}
      }
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

    // Individual Animal Dance Speed Override chips
    document.querySelectorAll('.inspect-speed-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = this.animals.find(item => item.id === this.selectedAnimalId);
        if (!a) return;
        const sp = parseFloat(btn.dataset.speed) || 1.25;
        a.animSpeed = sp;
        document.querySelectorAll('.inspect-speed-chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const valLabel = document.getElementById('inspectSpeedVal');
        if (valLabel) valLabel.textContent = `${sp}x`;
        this.debouncedSaveState();
      });
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

    const closeExportModal = () => {
      const videoPlayer = document.getElementById('exportVideoPlayer');
      if (videoPlayer) {
        videoPlayer.pause();
        videoPlayer.src = '';
      }
      document.getElementById('exportModal').classList.remove('active');
    };
    document.getElementById('btnCloseExportModal').addEventListener('click', closeExportModal);
    const btnCloseExportHeader = document.getElementById('btnCloseExportModalHeader');
    if (btnCloseExportHeader) {
      btnCloseExportHeader.addEventListener('click', closeExportModal);
    }

    window.addEventListener('resize', () => {
      this.fitCanvasToScreen();
      this.drawWaveform();
    });

    // Initialize Mobile Responsive Drawer & Floating Action Bar System
    this.setupMobileDrawers();
  }

  // =========================================================================
  // MOBILE RESPONSIVE DRAWER & TOOLBAR SYSTEM (EasyPro Tools Suite)
  // =========================================================================

  setupMobileDrawers() {
    const leftDeck = document.querySelector('.left-control-deck');
    const rightDock = document.querySelector('.right-layer-dock');
    const backdrop = document.getElementById('mobileDrawerBackdrop');

    const btnToggleLeft = document.getElementById('btnToggleLeftDrawer');
    const btnToggleRight = document.getElementById('btnToggleRightDrawer');
    const btnCloseLeft = document.getElementById('btnCloseLeftDrawer');
    const btnCloseRight = document.getElementById('btnCloseRightDrawer');

    const btnFloatTools = document.getElementById('btnFloatTools');
    const btnFloatLayers = document.getElementById('btnFloatLayers');
    const btnFloatPlay = document.getElementById('btnFloatPlay');
    const btnFloatReshuffle = document.getElementById('btnFloatReshuffle');
    const btnFloatExport = document.getElementById('btnFloatExport');

    const btnQuickSettings = document.getElementById('btnToggleQuickSettings');
    const headerCenter = document.getElementById('headerCenterTools');

    const closeQuickSettings = () => {
      if (headerCenter) headerCenter.classList.remove('mobile-expanded');
      if (btnQuickSettings) btnQuickSettings.classList.remove('active');
    };

    const toggleQuickSettings = (e) => {
      if (e) e.stopPropagation();
      if (!headerCenter) return;
      const isExpanded = headerCenter.classList.toggle('mobile-expanded');
      if (btnQuickSettings) btnQuickSettings.classList.toggle('active', isExpanded);
    };

    if (btnQuickSettings) {
      btnQuickSettings.addEventListener('click', toggleQuickSettings);
    }

    // Close quick settings when clicking anywhere outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#headerCenterTools') && !e.target.closest('#btnToggleQuickSettings')) {
        closeQuickSettings();
      }
    });

    const openLeftDrawer = () => {
      closeQuickSettings();
      if (rightDock) rightDock.classList.remove('mobile-open');
      if (leftDeck) leftDeck.classList.add('mobile-open');
      if (backdrop) backdrop.classList.add('active');
      if (btnToggleLeft) btnToggleLeft.setAttribute('aria-expanded', 'true');
      if (btnToggleRight) btnToggleRight.setAttribute('aria-expanded', 'false');
    };

    const closeLeftDrawer = () => {
      if (leftDeck) leftDeck.classList.remove('mobile-open');
      if (btnToggleLeft) btnToggleLeft.setAttribute('aria-expanded', 'false');
      if (!rightDock || !rightDock.classList.contains('mobile-open')) {
        if (backdrop) backdrop.classList.remove('active');
      }
      this.fitCanvasToScreen();
    };

    const toggleLeftDrawer = () => {
      if (leftDeck && leftDeck.classList.contains('mobile-open')) {
        closeLeftDrawer();
      } else {
        openLeftDrawer();
      }
    };

    const openRightDrawer = () => {
      closeQuickSettings();
      if (leftDeck) leftDeck.classList.remove('mobile-open');
      if (rightDock) rightDock.classList.add('mobile-open');
      if (backdrop) backdrop.classList.add('active');
      if (btnToggleRight) btnToggleRight.setAttribute('aria-expanded', 'true');
      if (btnToggleLeft) btnToggleLeft.setAttribute('aria-expanded', 'false');
    };

    const closeRightDrawer = () => {
      if (rightDock) rightDock.classList.remove('mobile-open');
      if (btnToggleRight) btnToggleRight.setAttribute('aria-expanded', 'false');
      if (!leftDeck || !leftDeck.classList.contains('mobile-open')) {
        if (backdrop) backdrop.classList.remove('active');
      }
      this.fitCanvasToScreen();
    };

    const toggleRightDrawer = () => {
      if (rightDock && rightDock.classList.contains('mobile-open')) {
        closeRightDrawer();
      } else {
        openRightDrawer();
      }
    };

    const closeAllDrawers = () => {
      closeQuickSettings();
      if (leftDeck) leftDeck.classList.remove('mobile-open');
      if (rightDock) rightDock.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('active');
      if (btnToggleLeft) btnToggleLeft.setAttribute('aria-expanded', 'false');
      if (btnToggleRight) btnToggleRight.setAttribute('aria-expanded', 'false');
      this.fitCanvasToScreen();
    };

    // Left Drawer toggles
    if (btnToggleLeft) btnToggleLeft.addEventListener('click', toggleLeftDrawer);
    if (btnFloatTools) btnFloatTools.addEventListener('click', toggleLeftDrawer);
    if (btnCloseLeft) btnCloseLeft.addEventListener('click', closeLeftDrawer);

    // Right Drawer toggles
    if (btnToggleRight) btnToggleRight.addEventListener('click', toggleRightDrawer);
    if (btnFloatLayers) btnFloatLayers.addEventListener('click', toggleRightDrawer);
    if (btnCloseRight) btnCloseRight.addEventListener('click', closeRightDrawer);

    // Backdrop dismissal
    if (backdrop) backdrop.addEventListener('click', closeAllDrawers);

    // Floating toolbar actions
    if (btnFloatPlay) {
      btnFloatPlay.addEventListener('click', () => this.togglePlayback());
    }
    if (btnFloatReshuffle) {
      btnFloatReshuffle.addEventListener('click', () => this.reshufflePositions());
    }
    if (btnFloatExport) {
      btnFloatExport.addEventListener('click', () => {
        document.querySelectorAll('.deck-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const expTab = document.querySelector('.deck-tab-btn[data-tab="tab-export"]');
        if (expTab) expTab.classList.add('active');
        const expPane = document.getElementById('tab-export');
        if (expPane) expPane.classList.add('active');
        openLeftDrawer();
      });
    }

    // Escape key closes any active drawer or settings tray
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllDrawers();
      }
    });

    // Window resize & orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.fitCanvasToScreen(), 200);
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
      let targetNx = this.interaction.origItemX + dx / this.canvasWidth;
      // Magnetic Snap: automatically lock to exact 50% center when near middle
      if (Math.abs(targetNx - 0.5) < 0.025) {
        targetNx = 0.5;
      }
      this.title.nx = Math.max(0.02, Math.min(0.98, targetNx));
      this.title.ny = Math.max(0.02, Math.min(0.98, this.interaction.origItemY + dy / this.canvasHeight));

    } else if (this.interaction.dragTarget === 'watermark') {
      // UNRESTRICTED: Allows placing watermark all the way to 0% and 100%!
      let targetNx = this.interaction.origItemX + dx / this.canvasWidth;
      // Magnetic Snap to center
      if (Math.abs(targetNx - 0.5) < 0.025) {
        targetNx = 0.5;
      }
      this.watermark.nx = Math.max(0.0, Math.min(1.0, targetNx));
      this.watermark.ny = Math.max(0.0, Math.min(1.0, this.interaction.origItemY + dy / this.canvasHeight));
      const wmXPct = Math.round(this.watermark.nx * 100);
      const wmYPct = Math.round(this.watermark.ny * 100);
      document.getElementById('sliderWatermarkX').value = wmXPct;
      document.getElementById('inputWatermarkXExact').value = wmXPct;
      document.getElementById('wmXVal').textContent = `${wmXPct}%`;
      document.getElementById('sliderWatermarkY').value = wmYPct;
      document.getElementById('inputWatermarkYExact').value = wmYPct;
      document.getElementById('wmYVal').textContent = `${wmYPct}%`;

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

    const tbPlay = document.getElementById('btnToolbarPlay');
    if (tbPlay) tbPlay.innerHTML = `<i class="fa-solid fa-${playIcon}"></i> ${playText}`;
    const dkPlay = document.getElementById('btnDeckPlay');
    if (dkPlay) dkPlay.innerHTML = `<i class="fa-solid fa-${playIcon}"></i>`;
    const flPlay = document.getElementById('btnFloatPlay');
    if (flPlay) flPlay.innerHTML = `<i class="fa-solid fa-${playIcon}"></i>`;

    if (this.isPlaying) {
      window.audioEngine.play(this.currentTime);
      if (this.bg.isVideo && this.bg.video) {
        try {
          const vidDur = (this.bg.duration > 0 && isFinite(this.bg.duration)) ? this.bg.duration : 10;
          this.bg.video.currentTime = (this.currentTime % vidDur);
          this.bg.video.play().catch(() => {});
        } catch (e) {}
      }
    } else {
      window.audioEngine.stop();
      if (this.bg.isVideo && this.bg.video) {
        try {
          this.bg.video.pause();
        } catch (e) {}
      }
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

  // Helper to trigger clean client-side file downloads
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // =========================================================================
  // CHROMA-KEY GIF BACKGROUND REMOVER
  // =========================================================================

  openChromaKeyModal(targetCharId = null) {
    const charId = targetCharId || this.activeCharType;
    let gifData = this.loadedGifs.get(charId);
    if (!gifData) {
      this.showToast('Select or upload a character first', 'error');
      return;
    }
    this.activeChromaGif = gifData;
    this.activeChromaGifId = charId;
    this.chromaCanvas.width = gifData.width;
    this.chromaCanvas.height = gifData.height;

    const originalCleanName = (gifData.originalName || gifData.name || 'Character')
      .replace(/^custom_\d+_[a-z0-9]+_?/i, '')
      .replace(/\.gif$/i, '')
      .replace(/_transparent$/i, '');
    const modalTitle = document.getElementById('chromaModalCharName');
    if (modalTitle) modalTitle.textContent = `Remove BG: ${originalCleanName}`;

    // Auto-detect dominant bg
    const bg = window.gifEngine.detectBackgroundColor(gifData);
    const hex = '#' + ((1 << 24) + (bg.r << 16) + (bg.g << 8) + bg.b).toString(16).slice(1);
    document.getElementById('inputChromaColor').value = hex;

    // Reset animate state
    this.isChromaAnimating = false;
    const animBtn = document.getElementById('btnChromaToggleAnimate');
    if (animBtn) animBtn.innerHTML = '<i class="fa-solid fa-play"></i> Animate Preview';

    this.updateChromaPreview();
    document.getElementById('chromaKeyModal').classList.add('active');
  }

  updateChromaPreview() {
    if (!this.activeChromaGif || !this.activeChromaGif.frames.length) return;
    const f0 = this.activeChromaGif.frames[0].canvas;
    const hex = document.getElementById('inputChromaColor').value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const tol = parseInt(document.getElementById('sliderChromaTol').value) || 35;

    window.gifEngine.renderChromaFrame(f0, { r, g, b }, tol, this.chromaCanvas);
  }

  toggleChromaAnimation() {
    if (!this.activeChromaGif || !this.activeChromaGif.frames.length) return;
    this.isChromaAnimating = !this.isChromaAnimating;
    const animBtn = document.getElementById('btnChromaToggleAnimate');
    if (!this.isChromaAnimating) {
      if (animBtn) animBtn.innerHTML = '<i class="fa-solid fa-play"></i> Animate Preview';
      this.updateChromaPreview();
      return;
    }

    if (animBtn) animBtn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Preview';
    const startTime = performance.now();
    const animLoop = () => {
      if (!this.isChromaAnimating || !document.getElementById('chromaKeyModal').classList.contains('active')) {
        this.isChromaAnimating = false;
        if (animBtn) animBtn.innerHTML = '<i class="fa-solid fa-play"></i> Animate Preview';
        return;
      }
      const elapsed = performance.now() - startTime;
      const frameCanvas = window.gifEngine.getFrame(this.activeChromaGif, elapsed);
      if (frameCanvas) {
        const hex = document.getElementById('inputChromaColor').value;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const tol = parseInt(document.getElementById('sliderChromaTol').value) || 35;
        window.gifEngine.renderChromaFrame(frameCanvas, { r, g, b }, tol, this.chromaCanvas);
      }
      requestAnimationFrame(animLoop);
    };
    requestAnimationFrame(animLoop);
  }

  async applyChromaKeyToActive() {
    if (!this.activeChromaGif) return;
    this.showToast('Removing background...', 'info');

    try {
      const hex = document.getElementById('inputChromaColor').value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const tol = parseInt(document.getElementById('sliderChromaTol').value) || 35;

      // 1. Remove background across all frames & rebuild GPU ImageBitmap textures
      await window.gifEngine.applyChromaKey(this.activeChromaGif, { r, g, b }, tol);

      // 2. Set as active dancer & force immediate canvas redraw so user sees character right away
      const charId = this.activeChromaGifId || this.activeCharType;
      const originalCleanName = (this.activeChromaGif.originalName || this.activeChromaGif.name || 'custom_character')
        .replace(/^custom_\d+_[a-z0-9]+_?/i, '')
        .replace(/\.gif$/i, '')
        .replace(/_transparent$/i, '');
      this.setCharacterType(charId, originalCleanName);
      this.drawFrameWithCache(this.ctx, this.canvas.width, this.canvas.height, performance.now() - this.startTimeMs, false);

      // 3. Close Chroma modal
      document.getElementById('chromaKeyModal').classList.remove('active');
      this.isChromaAnimating = false;

      // 4. Update thumbnail and transparent status in IndexedDB
      if (window.storageManager && charId) {
        const thumbUrl = this.activeChromaGif.frames[0].canvas.toDataURL('image/png');
        let transparentBuffer = this.activeChromaGif.originalBuffer;
        try {
          const gifBytes = window.gifEngine.encodeToGif(this.activeChromaGif);
          if (gifBytes && gifBytes.length > 0) {
            transparentBuffer = gifBytes.buffer;
            this.activeChromaGif.originalBuffer = transparentBuffer;
          }
        } catch (encErr) {
          console.warn('Background encode notice:', encErr);
        }

        await window.storageManager.saveItem('characters', {
          id: charId,
          name: originalCleanName,
          originalName: originalCleanName,
          date: new Date().toLocaleDateString(),
          size: transparentBuffer ? transparentBuffer.byteLength : (this.activeChromaGif.originalBuffer ? this.activeChromaGif.originalBuffer.byteLength : 0),
          data: transparentBuffer,
          thumbnail: thumbUrl,
          width: this.activeChromaGif.width,
          height: this.activeChromaGif.height,
          frameCount: this.activeChromaGif.frames.length,
          duration: this.activeChromaGif.totalDuration,
          isTransparent: true
        });
        await this.refreshSavedUploadsUI();
      }

      this.showToast('✨ Background removed! Transparent character ready.', 'success');
    } catch (err) {
      console.error('Error applying chroma key:', err);
      this.showToast(`Error: ${err.message}`, 'error');
    }
  }

  downloadTransparentGifFromModal() {
    if (!this.activeChromaGif) return;
    try {
      this.showToast('Encoding transparent GIF for download...', 'info');
      const hex = document.getElementById('inputChromaColor').value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const tol = parseInt(document.getElementById('sliderChromaTol').value) || 35;

      if (!this.activeChromaGif.isTransparent) {
        window.gifEngine.applyChromaKey(this.activeChromaGif, { r, g, b }, tol);
      }

      const gifBytes = window.gifEngine.encodeToGif(this.activeChromaGif);
      const blob = new Blob([gifBytes], { type: 'image/gif' });
      const rawName = this.activeChromaGif.originalName || this.activeChromaGif.name || 'character';
      const cleanName = rawName
        .replace(/^custom_\d+_[a-z0-9]+_?/i, '')
        .replace(/\.gif$/i, '')
        .replace(/_transparent$/i, '');
      const finalName = `${cleanName || 'character'}_transparent.gif`;
      this.downloadBlob(blob, finalName);
      this.showToast(`💾 Downloaded "${finalName}"!`, 'success');
    } catch (err) {
      this.showToast(`Error downloading GIF: ${err.message}`, 'error');
    }
  }

  // =========================================================================
  // INTERACTIVE GIF PREVIEW MODAL
  // =========================================================================

  openGifPreviewModal(gifData, id, name) {
    if (!gifData || !gifData.frames.length) return;
    this.previewModalGif = gifData;
    this.previewModalGifId = id;
    this.previewModalSpeed = 1.0;
    this.isPreviewModalPlaying = true;

    const modal = document.getElementById('gifPreviewModal');
    const title = document.getElementById('gifPreviewModalTitle');
    const canvas = document.getElementById('gifPreviewStageCanvas');
    const dims = document.getElementById('gifPreviewDimensions');
    const frameInfo = document.getElementById('gifPreviewFrameInfo');
    const dur = document.getElementById('gifPreviewDuration');

    if (title) title.textContent = `Preview: ${name || gifData.name || 'Character'}`;
    canvas.width = gifData.width;
    canvas.height = gifData.height;
    if (dims) dims.textContent = `Resolution: ${gifData.width} × ${gifData.height} px`;
    if (frameInfo) frameInfo.textContent = `Frames: ${gifData.frames.length}`;
    if (dur) dur.textContent = `Duration: ${(gifData.totalDuration / 1000).toFixed(2)}s`;

    // Speed buttons reset
    document.querySelectorAll('.gif-speed-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.speed === '1.0');
    });

    // Backdrop reset
    const stageWrapper = document.getElementById('gifPreviewStageWrapper');
    stageWrapper.className = 'checkerboard-bg';
    stageWrapper.style.backgroundColor = '';
    document.querySelectorAll('.gif-bg-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bg === 'checker');
    });

    const playPauseBtn = document.getElementById('btnGifPreviewPlayPause');
    if (playPauseBtn) playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';

    modal.classList.add('active');

    // Run animation loop
    const ctx = canvas.getContext('2d');
    let startTime = performance.now();
    let currentAnimTime = 0;

    const renderPreview = (now) => {
      if (!modal.classList.contains('active')) return;
      if (this.isPreviewModalPlaying) {
        const delta = now - startTime;
        startTime = now;
        currentAnimTime += delta * this.previewModalSpeed;
      } else {
        startTime = now;
      }

      const frameCanvas = window.gifEngine.getFrame(gifData, currentAnimTime);
      if (frameCanvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frameCanvas, 0, 0);
      }
      this.gifPreviewAnimId = requestAnimationFrame(renderPreview);
    };
    if (this.gifPreviewAnimId) cancelAnimationFrame(this.gifPreviewAnimId);
    this.gifPreviewAnimId = requestAnimationFrame(renderPreview);
  }

  closeGifPreviewModal() {
    const modal = document.getElementById('gifPreviewModal');
    if (modal) modal.classList.remove('active');
    if (this.gifPreviewAnimId) {
      cancelAnimationFrame(this.gifPreviewAnimId);
      this.gifPreviewAnimId = null;
    }
    this.previewModalGif = null;
  }

  // =========================================================================
  // INDEXEDDB UPLOAD GALLERIES
  // =========================================================================

  async refreshSavedUploadsUI() {
    if (!window.storageManager) return;

    // 1. Saved Characters (Rich Cards with Thumbnails, Use, Preview, Remove BG & Download)
    const savedChars = await window.storageManager.getAllItems('characters');
    const charList = document.getElementById('customCharsList');
    if (charList) {
      charList.innerHTML = '';
      if (!savedChars || savedChars.length === 0) {
        charList.innerHTML = `
          <p style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:1.2rem 0; width:100%; grid-column:1/-1;">
            <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.5rem; display:block; margin-bottom:0.4rem; opacity:0.4;"></i>
            No custom characters uploaded yet.<br>Click below to upload GIFs from your PC!
          </p>
        `;
      } else {
        for (const item of savedChars) {
          const card = document.createElement('div');
          const isActive = this.activeCharType === item.id;
          card.className = `custom-char-card ${isActive ? 'active' : ''}`;
          card.dataset.charId = item.id;

          const sizeStr = item.size ? `${Math.round(item.size / 1024)} KB` : '';
          const frameStr = item.frameCount ? `${item.frameCount}f` : '';
          const transparentBadge = item.isTransparent ? `<span class="custom-char-transparent-badge">TRANSPARENT</span>` : '';

          card.innerHTML = `
            <div class="custom-char-thumb-box checkerboard-bg">
              <img src="${item.thumbnail || ''}" alt="${item.name}" style="max-width:100%; max-height:100%; object-fit:contain;">
              ${frameStr ? `<span class="custom-char-frames-badge">${frameStr}</span>` : ''}
              ${transparentBadge}
            </div>
            <div class="custom-char-info">
              <span class="custom-char-title" title="${item.name}">${item.name}</span>
              <span class="custom-char-meta">${item.width && item.height ? `${item.width}×${item.height} • ` : ''}${sizeStr}</span>
            </div>
            <div class="custom-char-actions">
              <button class="btn btn-primary btn-xs btn-use" title="Use as character">
                <i class="fa-solid fa-play"></i> Use
              </button>
              <button class="btn btn-secondary btn-xs btn-preview" title="Preview animation">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button class="btn btn-secondary btn-xs btn-chroma" title="Remove background (Chroma-Key)">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
              </button>
              <button class="btn btn-secondary btn-xs btn-download" title="Download GIF">
                <i class="fa-solid fa-download"></i>
              </button>
              <button class="btn btn-secondary btn-xs btn-delete" title="Delete from library" style="color:var(--accent-rose);">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          `;

          // Helper to get or decode GIF data
          const getOrDecodeGif = () => {
            let gifData = this.loadedGifs.get(item.id);
            if (!gifData && item.data) {
              const origName = item.originalName || item.name || 'custom_character';
              gifData = window.gifEngine.decode(item.data, origName);
              gifData.name = origName;
              gifData.originalName = origName;
              if (item.isTransparent) gifData.isTransparent = true;
              this.loadedGifs.set(item.id, gifData);
            } else if (gifData) {
              if (item.originalName) gifData.originalName = item.originalName;
              if (item.name) gifData.name = item.name;
              if (item.isTransparent) gifData.isTransparent = true;
            }
            return gifData;
          };

          // Use button
          card.querySelector('.btn-use').addEventListener('click', () => {
            getOrDecodeGif();
            this.setCharacterType(item.id, item.originalName || item.name);
            document.querySelectorAll('.custom-char-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
          });

          // Preview button
          card.querySelector('.btn-preview').addEventListener('click', () => {
            const gifData = getOrDecodeGif();
            if (gifData) {
              this.openGifPreviewModal(gifData, item.id, item.originalName || item.name);
            } else {
              this.showToast('Could not load GIF for preview', 'error');
            }
          });

          // Remove BG button
          card.querySelector('.btn-chroma').addEventListener('click', () => {
            const gifData = getOrDecodeGif();
            if (gifData) {
              this.openChromaKeyModal(item.id);
            }
          });

          // Download button
          card.querySelector('.btn-download').addEventListener('click', () => {
            const gifData = getOrDecodeGif();
            if (gifData) {
              const rawName = item.originalName || item.name || gifData.originalName || gifData.name || 'character';
              const cleanName = rawName
                .replace(/^custom_\d+_[a-z0-9]+_?/i, '')
                .replace(/\.gif$/i, '')
                .replace(/_transparent$/i, '');
              const filename = (item.isTransparent || gifData.isTransparent) ? `${cleanName || 'character'}_transparent.gif` : `${cleanName || 'character'}.gif`;
              try {
                const gifBytes = window.gifEngine.encodeToGif(gifData);
                const blob = new Blob([gifBytes], { type: 'image/gif' });
                this.downloadBlob(blob, filename);
                this.showToast(`💾 Downloaded "${filename}"!`, 'success');
              } catch (e) {
                if (item.data) {
                  const blob = new Blob([item.data], { type: 'image/gif' });
                  this.downloadBlob(blob, filename);
                  this.showToast(`💾 Downloaded "${filename}"!`, 'success');
                }
              }
            }
          });

          // Delete button
          card.querySelector('.btn-delete').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${item.name}" from your custom library?`)) {
              await window.storageManager.deleteItem('characters', item.id);
              this.loadedGifs.delete(item.id);
              await this.refreshSavedUploadsUI();
              this.showToast(`Deleted "${item.name}"`, 'info');
            }
          });

          charList.appendChild(card);
        }
      }
    }

    // 2. Saved Backdrops (Images and Videos)
    const allBgs = await window.storageManager.getAllItems('backgrounds');
    const savedBgs = allBgs.filter(item => item && item.id !== 'current_active_bg' && (item.dataUrl || item.blob));
    const bgSection = document.getElementById('savedBackdropsSection');
    const bgList = document.getElementById('savedBackdropsList');
    if (savedBgs.length > 0) {
      bgSection.style.display = 'block';
      bgList.innerHTML = '';
      for (const item of savedBgs) {
        const isVid = item.type === 'video' || !!item.blob;
        const thumb = document.createElement('div');
        thumb.className = 'bg-thumb-card';
        thumb.style.width = '70px';
        thumb.style.flexShrink = '0';
        thumb.style.position = 'relative';
        thumb.innerHTML = `
          <img src="${item.dataUrl || ''}" alt="${item.name || 'Backdrop'}" style="width:100%; height:100%; object-fit:cover;">
          ${isVid ? '<span style="position:absolute; bottom:2px; left:2px; font-size:9px; background:rgba(0,0,0,0.75); color:#38bdf8; padding:1px 4px; border-radius:3px; font-weight:700;"><i class="fa-solid fa-video"></i></span>' : ''}
          <button class="btn btn-secondary btn-sm" style="position:absolute; top:2px; right:2px; padding:2px; font-size:10px; color:var(--accent-rose);" title="Remove">
            <i class="fa-solid fa-xmark"></i>
          </button>
        `;
        thumb.querySelector('img').addEventListener('click', async () => {
          if (isVid && item.blob) {
            await this.loadVideoBackground(item.blob, item.name || 'custom_video');
            this.showToast('🎬 Switched to saved video backdrop', 'info');
          } else if (item.dataUrl) {
            this.loadBackground(item.dataUrl, 'custom_bg');
            this.showToast('Switched to saved image backdrop', 'info');
          }
          this.debouncedSaveState();
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
    // Update layer count indicators
    const count = this.animals.length;
    const countEl = document.getElementById('totalAnimalLayerCount');
    if (countEl) countEl.textContent = count;
    const mobBadge = document.getElementById('mobileLayerCountBadge');
    if (mobBadge) mobBadge.textContent = count;
    const floatBadge = document.getElementById('floatLayerBadge');
    if (floatBadge) floatBadge.textContent = count;

    // Preserve scroll position to prevent jumping
    const scrollPos = container ? container.scrollTop : 0;
    if (container) container.innerHTML = '';

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

    const curSpeed = animal.animSpeed || this.characterDanceSpeed || 1.25;
    const speedVal = document.getElementById('inspectSpeedVal');
    if (speedVal) speedVal.textContent = animal.animSpeed ? `${animal.animSpeed}x` : `Auto (${curSpeed}x)`;
    document.querySelectorAll('.inspect-speed-chip').forEach(btn => {
      const sp = parseFloat(btn.dataset.speed);
      btn.classList.toggle('active', sp === (animal.animSpeed || curSpeed));
    });
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

    // Ensure any leftover recording tracks are 100% terminated before starting
    if (this.currentExportCleanup) {
      try { this.currentExportCleanup(); } catch (e) {}
      this.currentExportCleanup = null;
    }
    if (this.activeExportStream) {
      try {
        this.activeExportStream.getTracks().forEach(t => t.stop());
      } catch (e) {}
      this.activeExportStream = null;
    }

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

    // Safety cleanup of any prior dangling export streams/recorders to prevent GPU encoder session leaks
    if (this.currentExportCleanup) {
      try { this.currentExportCleanup(); } catch (e) {}
    }
    if (this.exportMediaRecorder && this.exportMediaRecorder.state !== 'inactive') {
      try { this.exportMediaRecorder.stop(); } catch (e) {}
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
    if (bitrateSelect && bitrateSelect.value) {
      this.bitrate = bitrateSelect.value === 'auto' ? 'auto' : parseInt(bitrateSelect.value);
    }

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

    // 2. Compute target bitrate: smart dynamic scaling based on resolution
    let targetBitrate;
    if (this.bitrate && this.bitrate !== 'auto' && !isNaN(this.bitrate)) {
      targetBitrate = parseInt(this.bitrate);
    } else {
      // Smart Optimized Auto Bitrate: pristine sharpness at minimal file size
      if (this.resolutionPreset === '4k') {
        targetBitrate = 14000000; // 14.0 Mbps for 4K
      } else if (this.resolutionPreset === '2k') {
        targetBitrate = 7500000;  // 7.5 Mbps for 2K
      } else if (this.resolutionPreset === '720p') {
        targetBitrate = 2500000;  // 2.5 Mbps for 720p
      } else {
        targetBitrate = 4000000;  // 4.0 Mbps for 1080p Full HD
      }
    }


    // 3. Pre-load 100% of scene characters and prepare GPU bitmaps before export starts!
    // Guarantees all GIFs are rendered with true original size, complete frames, and butter-smooth animation
    if (this.animals && this.animals.length > 0) {
      etaLabel.textContent = 'Loading character frames...';
      const uniqueCharIds = Array.from(new Set(this.animals.map(a => a.charId)));
      await Promise.all(uniqueCharIds.map(async (charId) => {
        try {
          const g = await this.ensureCharacterLoaded(charId);
          if (g && window.gifEngine && typeof window.gifEngine.prepareBitmaps === 'function') {
            await window.gifEngine.prepareBitmaps(g);
          }
        } catch (e) {
          console.warn('Character preload notice:', e);
        }
      }));
    }

    const totalSeconds = this.videoDuration + (this.appendRevealEnding ? 3 : 0);
    const targetFps = this.fps || 30;

    // Check if deterministic WebCodecs + Mp4Muxer export engine is available
    if (this.exportFormat === 'mp4' && typeof VideoEncoder !== 'undefined' && typeof Mp4Muxer !== 'undefined') {
      try {
        await this.startWebCodecsExport({
          exportW,
          exportH,
          targetFps,
          totalSeconds,
          targetBitrate,
          hasAudio
        });
        return;
      } catch (wcErr) {
        if (!this.isExporting) return; // User cancelled, do not fall back
        console.warn('WebCodecs export notice, falling back to MediaRecorder:', wcErr);
      }
    }

    // 4. Dedicated DOM-Backed Recording Canvas: Active offscreen element ensures 100% GPU compositor execution
    let recW = exportW;
    let recH = exportH;
    // On mobile devices, real-time captureStream above 1080p will lag, drop frames and overheat
    if (this.isMobile && (recW > 1080 || recH > 1920)) {
      const recScale = Math.min(1080 / recW, 1920 / recH);
      recW = Math.round(recW * recScale);
      recH = Math.round(recH * recScale);
      if (recW % 2 !== 0) recW--;
      if (recH % 2 !== 0) recH--;
    }

    // Pre-render Static Background (Layer 1) at exact recW/recH for MediaRecorder fallback
    let staticBgBitmap = null;
    if (!this.bg.isVideo) {
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = recW;
      bgCanvas.height = recH;
      const bgCtx = bgCanvas.getContext('2d', { alpha: false });
      bgCtx.imageSmoothingEnabled = true;
      bgCtx.imageSmoothingQuality = (this.isMobile || recW >= 2160 || recH >= 2160) ? 'medium' : 'high';
      this.renderBackground(bgCtx, recW, recH);
      if (typeof createImageBitmap === 'function') {
        try { staticBgBitmap = await createImageBitmap(bgCanvas); } catch (e) {}
      }
      if (!staticBgBitmap) staticBgBitmap = bgCanvas;
    }

    // Pre-render Static Overlays (Title, Subtitle, Watermark - Layer 3) at exact recW/recH for MediaRecorder fallback
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = recW;
    overlayCanvas.height = recH;
    const overlayCtx = overlayCanvas.getContext('2d');
    overlayCtx.imageSmoothingEnabled = true;
    overlayCtx.imageSmoothingQuality = (recW >= 2160 || recH >= 2160) ? 'medium' : 'high';
    this.renderTitle(overlayCtx, recW, recH, true);
    if (this.watermark.enabled) {
      this.renderWatermark(overlayCtx, recW, recH, true);
    }
    let staticOverlayBitmap = null;
    if (typeof createImageBitmap === 'function') {
      try { staticOverlayBitmap = await createImageBitmap(overlayCanvas); } catch (e) {}
    }
    if (!staticOverlayBitmap) staticOverlayBitmap = overlayCanvas;


    let recordCanvas = document.getElementById('exportOffscreenCanvas');
    if (!recordCanvas) {
      recordCanvas = document.createElement('canvas');
      recordCanvas.id = 'exportOffscreenCanvas';
      document.body.appendChild(recordCanvas);
    }
    recordCanvas.style.cssText = `position:fixed; left:-9999px; top:-9999px; width:${recW}px; height:${recH}px; pointer-events:none; opacity:0.01; z-index:-9999;`;
    recordCanvas.width = recW;
    recordCanvas.height = recH;
    const recordCtx = recordCanvas.getContext('2d', {
      alpha: false
    });
    recordCtx.imageSmoothingEnabled = true;
    recordCtx.imageSmoothingQuality = (this.isMobile || this.resolutionPreset === '4k' || this.resolutionPreset === '2k') ? 'medium' : 'high';

    // Pre-draw frame 0 so captureStream immediately receives a pristine, full-quality graphic
    this.drawFrameWithCache(recordCtx, recW, recH, 0, true, staticBgBitmap, staticOverlayBitmap);

    // Setup lightweight DOM live preview canvas (e.g. max 480px) for smooth UI without freezing GPU
    const livePreviewCanvas = document.getElementById('exportLiveCanvas');
    const previewScale = Math.min(1, 480 / Math.max(recW, recH));
    livePreviewCanvas.width = Math.round(recW * previewScale);
    livePreviewCanvas.height = Math.round(recH * previewScale);
    livePreviewCanvas.style.aspectRatio = `${recW} / ${recH}`;
    const livePreviewCtx = livePreviewCanvas.getContext('2d', { alpha: false });
    livePreviewCtx.imageSmoothingEnabled = true;
    livePreviewCtx.imageSmoothingQuality = 'medium';
    livePreviewCtx.drawImage(recordCanvas, 0, 0, livePreviewCanvas.width, livePreviewCanvas.height);

    const targetDurationMs = totalSeconds * 1000;

    // Stream Setup from dedicated recording canvas with exact target framerate
    const frameIntervalMs = 1000 / targetFps;
    const stream = recordCanvas.captureStream(targetFps);
    const videoTrack = (stream && stream.getVideoTracks) ? stream.getVideoTracks()[0] : null;
    if (hasAudio) {
      const audioTrack = window.audioEngine.getAudioTrack();
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    }

    // 7. Codec determination: AVC Level 5.1/5.2 support 4K 2160p Master Quality without errors
    let mimeCandidates = [];
    if (this.exportFormat === 'webm') {
      mimeCandidates = [
        hasAudio ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9',
        hasAudio ? 'video/webm;codecs=vp8,opus' : 'video/webm;codecs=vp8',
        'video/webm'
      ];
    } else {
      mimeCandidates = [
        // Level 5.1 (0x33) and Level 5.2 (0x34) are required for 4K H.264
        hasAudio ? 'video/mp4;codecs=avc1.640033,mp4a.40.2' : 'video/mp4;codecs=avc1.640033',
        hasAudio ? 'video/mp4;codecs=avc1.640034,mp4a.40.2' : 'video/mp4;codecs=avc1.640034',
        // Generic AVC1 without profile/level constraint allows browser to auto-select 4K profile
        hasAudio ? 'video/mp4;codecs=avc1,mp4a.40.2' : 'video/mp4;codecs=avc1',
        hasAudio ? 'video/mp4;codecs=avc1.640028,mp4a.40.2' : 'video/mp4;codecs=avc1.640028',
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

    const cleanupExportResources = () => {
      if (this.bg.isVideo && this.bg.video) {
        try { this.bg.video.pause(); } catch (e) {}
      }
      if (staticBgBitmap && typeof staticBgBitmap.close === 'function') {
        try { staticBgBitmap.close(); } catch (e) {}
      }
      if (staticOverlayBitmap && typeof staticOverlayBitmap.close === 'function') {
        try { staticOverlayBitmap.close(); } catch (e) {}
      }
      staticBgBitmap = null;
      staticOverlayBitmap = null;

      // CRITICAL FIX: Stop all tracks on the capture stream so Chromium encoder frees GPU memory
      // and never throttles frame rate or decreases video file size on subsequent exports!
      if (this.activeExportStream) {
        try {
          this.activeExportStream.getTracks().forEach(track => {
            try { track.stop(); } catch (err) {}
          });
        } catch (e) {}
        this.activeExportStream = null;
      }
    };
    this.currentExportCleanup = cleanupExportResources;
    this.activeExportStream = stream;

    this.exportMediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.exportChunks.push(e.data);
    };

    this.exportMediaRecorder.onerror = (e) => {
      console.error('MediaRecorder error:', e);
      this.showToast('Recording error occurred during video capture', 'error');
    };

    // ON STOP: Fix metadata using server remux or client-side fixers for seamless playback!
    this.exportMediaRecorder.onstop = () => {
      cleanupExportResources();
      if (hasAudio) {
        window.audioEngine.stop();
      }
      const rawBlob = new Blob(this.exportChunks, { type: mimeType });

      if (rawBlob.size === 0) {
        this.showToast('Export failed: Empty recording. Please try again.', 'error');
        this.cancelVideoExport();
        return;
      }

      if (fileExt === 'mp4') {
        const desc = document.getElementById('exportModalDesc');
        const eta = document.getElementById('exportEta');
        if (desc) desc.textContent = 'Packaging universal FastStart MP4 for mobile, tablet & WhatsApp...';
        if (eta) eta.textContent = 'Optimizing for all devices...';

        const exportFilename = 'find-' + this.animals.length + '-animals_' + this.resolutionPreset + '_SmartBrain.mp4';
        
        // Relative API endpoints for both Apache rewrites, PHP hosting, and local server
        const baseUrl = window.location.pathname.replace(/\/[^/]*$/, '');
        const remuxUrl = baseUrl + '/api/remux-mp4?filename=' + encodeURIComponent(exportFilename);
        const phpRemuxUrl = baseUrl + '/api.php?action=remux-mp4&filename=' + encodeURIComponent(exportFilename);

        const tryServerRemux = (endpoint) => {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 8000);
          return fetch(endpoint, {
            method: 'POST',
            body: rawBlob,
            signal: controller.signal
          }).then(async (response) => {
            clearTimeout(tid);
            const remuxStatus = response.headers.get('X-Remux-Status');
            if (response.ok && (remuxStatus === 'faststart_progressive_mp4' || remuxStatus === 'ffmpeg_faststart')) {
              const remuxBlob = await response.blob();
              if (remuxBlob && remuxBlob.size > 1000) {
                return remuxBlob;
              }
            }
            throw new Error('Remux returned non-progressive status: ' + remuxStatus);
          });
        };

        // Try /api/remux-mp4 then api.php, then fall back immediately to in-browser normalizer
        tryServerRemux(remuxUrl)
          .catch(() => tryServerRemux(phpRemuxUrl))
          .then((remuxBlob) => {
            console.log('Universal FastStart MP4 optimized via server pipeline.');
            this.finalizeExportDownload(remuxBlob, fileExt);
          })
          .catch(() => {
            // Standalone in-browser universal MP4 metadata normalizer (Zero server required!)
            if (typeof window.ysFixMp4Duration === 'function') {
              window.ysFixMp4Duration(rawBlob, targetDurationMs, (fixedBlob) => {
                this.finalizeExportDownload(fixedBlob, fileExt);
              });
            } else {
              this.finalizeExportDownload(rawBlob, fileExt);
            }
          });
      } else if (fileExt === 'webm' && typeof window.ysFixWebmDuration === 'function') {
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
    if (this.bg.isVideo && this.bg.video) {
      try {
        this.bg.video.muted = true;
        this.bg.video.loop = true;
        this.bg.video.currentTime = 0;
        this.bg.video.play().catch(() => {});
      } catch (e) {}
    }
    this.exportMediaRecorder.start(100); // 100ms timeslice sends continuous chunks

    const startTime = performance.now();
    const totalFrames = Math.ceil(totalSeconds * targetFps);
    let renderedFrames = 0;
    let lastPreviewUpdate = -999;

    const recordTick = () => {
      if (!this.isExporting) {
        cleanupExportResources();
        return;
      }

      const elapsedMs = performance.now() - startTime;
      const progress = Math.min(1.0, elapsedMs / targetDurationMs);

      if (elapsedMs < targetDurationMs) {
        // Animation time STRICTLY tracks real wall-clock elapsed time so GIF NEVER plays in slow-motion!
        const frameTimeMs = elapsedMs;
        const isRevealSection = this.appendRevealEnding && (frameTimeMs >= this.videoDuration * 1000);
        const prevReveal = this.answerRevealMode;
        if (isRevealSection) this.answerRevealMode = true;

        // Ensure video element stays playing and smoothly loops without stutter
        if (this.bg.isVideo && this.bg.video) {
          if (this.bg.video.paused) {
            this.bg.video.play().catch(() => {});
          }
          const vidDur = (this.bg.duration > 0 && isFinite(this.bg.duration)) ? this.bg.duration : 10;
          const expectedTime = (frameTimeMs / 1000) % vidDur;
          const timeDiff = Math.abs(this.bg.video.currentTime - expectedTime);
          const effectiveDiff = Math.min(timeDiff, Math.abs(timeDiff - vidDur));
          if (effectiveDiff > 0.75) {
            try { this.bg.video.currentTime = expectedTime; } catch (e) {}
          }
        }

        try {
          this.drawFrameWithCache(recordCtx, recW, recH, frameTimeMs, true, staticBgBitmap, staticOverlayBitmap);
          if (videoTrack && typeof videoTrack.requestFrame === 'function') {
            try { videoTrack.requestFrame(); } catch (e) {}
          }
        } catch (err) {
          console.warn('Frame draw notice:', err);
        }
        this.answerRevealMode = prevReveal;

        renderedFrames++;
      }

      // Smooth, non-blocking live preview update without GPU pipeline stall (every 200ms)
      if (elapsedMs - lastPreviewUpdate >= 200) {
        lastPreviewUpdate = elapsedMs;
        try {
          livePreviewCtx.drawImage(recordCanvas, 0, 0, livePreviewCanvas.width, livePreviewCanvas.height);
        } catch (e) {}
      }

      // Update UI progress accurately based on real elapsed time
      bar.style.width = `${Math.round(progress * 100)}%`;
      pct.textContent = `${Math.round(progress * 100)}%`;
      framesLabel.textContent = `${(Math.min(totalSeconds, elapsedMs / 1000)).toFixed(1)}s / ${totalSeconds.toFixed(1)}s (${renderedFrames} frames)`;

      const eta = progress > 0 ? Math.max(0, Math.round(((elapsedMs / progress) - elapsedMs) / 1000)) : 0;
      etaLabel.textContent = `ETA: ${eta}s`;

      if (elapsedMs < targetDurationMs) {
        requestAnimationFrame(recordTick);
      } else {
        // Complete recording at exact final frame, flushing final chunks cleanly!
        if (this.exportMediaRecorder && this.exportMediaRecorder.state !== 'inactive') {
          try {
            this.exportMediaRecorder.requestData();
          } catch (e) {}
          setTimeout(() => {
            if (this.exportMediaRecorder && this.exportMediaRecorder.state !== 'inactive') {
              this.exportMediaRecorder.stop();
            }
          }, 120);
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
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.renderLoop.bind(this));
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

  async startWebCodecsExport(opts) {
    const { exportW, exportH, targetFps, totalSeconds, targetBitrate, hasAudio } = opts;
    const totalFrames = Math.ceil(totalSeconds * targetFps);
    const frameIntervalUs = Math.round(1000000 / targetFps);

    const bar = document.getElementById('exportProgressBar');
    const pct = document.getElementById('exportProgressPct');
    const framesLabel = document.getElementById('exportProgressFrames');
    const etaLabel = document.getElementById('exportEta');
    const desc = document.getElementById('exportModalDesc');
    if (desc) desc.textContent = 'Rendering 100% smooth frames via WebCodecs hardware engine...';

    // 1. Adaptive Resolution Cascade Negotiation:
    // Tries user's requested resolution first (e.g. 4K). If mobile phone hardware video encoder cannot
    // encode portrait 3840 height, it automatically matches the device's highest hardware tier (2K QHD or 1080p Full HD)
    // guaranteeing WebCodecs hardware encoding ALWAYS runs with ZERO dropped frames and 100% fluid GIF speed!
    const aspectTiers = {
      '9:16': [
        { name: '4K Ultra HD', w: 2160, h: 3840, bitrate: 14000000 },
        { name: '2K QHD', w: 1440, h: 2560, bitrate: 8000000 },
        { name: '1080p Studio HD', w: 1080, h: 1920, bitrate: 4500000 },
        { name: '720p HD', w: 720, h: 1280, bitrate: 2500000 }
      ],
      '16:9': [
        { name: '4K Ultra HD', w: 3840, h: 2160, bitrate: 14000000 },
        { name: '2K QHD', w: 2560, h: 1440, bitrate: 8000000 },
        { name: '1080p Studio HD', w: 1920, h: 1080, bitrate: 4500000 },
        { name: '720p HD', w: 1280, h: 720, bitrate: 2500000 }
      ],
      '1:1': [
        { name: '4K Ultra HD', w: 2160, h: 2160, bitrate: 12000000 },
        { name: '2K QHD', w: 1440, h: 1440, bitrate: 7000000 },
        { name: '1080p Studio HD', w: 1080, h: 1080, bitrate: 4000000 },
        { name: '720p HD', w: 720, h: 720, bitrate: 2200000 }
      ],
      '4:5': [
        { name: '4K Ultra HD', w: 2160, h: 2700, bitrate: 13000000 },
        { name: '2K QHD', w: 1440, h: 1800, bitrate: 7500000 },
        { name: '1080p Studio HD', w: 1080, h: 1350, bitrate: 4200000 },
        { name: '720p HD', w: 720, h: 900, bitrate: 2400000 }
      ]
    };
    const tiers = aspectTiers[this.aspectRatio] || aspectTiers['9:16'];
    const reqIdx = tiers.findIndex(t => t.w === exportW && t.h === exportH);
    const candidateTiers = reqIdx >= 0 ? tiers.slice(reqIdx) : tiers;

    const getCodecsForDim = (maxDim) => {
      if (maxDim >= 3840) {
        return ['avc1.640033', 'avc1.4d0033', 'avc1.420033', 'avc1.640034', 'avc1.4d0034', 'avc1.420034', 'avc1.640032', 'avc1.420028'];
      } else if (maxDim >= 2560) {
        return ['avc1.640032', 'avc1.4d0032', 'avc1.420032', 'avc1.640033', 'avc1.4d0033', 'avc1.640028', 'avc1.420028'];
      } else if (maxDim >= 1920) {
        return ['avc1.640028', 'avc1.4d002a', 'avc1.420028', 'avc1.64002a', 'avc1.4d0028', 'avc1.42001f'];
      } else {
        return ['avc1.42001f', 'avc1.4d001f', 'avc1.64001f', 'avc1.420028'];
      }
    };

    let chosenTier = null;
    let chosenConfig = null;
    let chosenCodecs = [];

    for (const tier of candidateTiers) {
      const curW = (tier.w % 2 === 0) ? tier.w : tier.w - 1;
      const curH = (tier.h % 2 === 0) ? tier.h : tier.h - 1;
      const tierMaxDim = Math.max(curW, curH);
      const codecs = getCodecsForDim(tierMaxDim);
      const tierBitrate = (this.bitrate && this.bitrate !== 'auto' && !isNaN(this.bitrate)) ? parseInt(this.bitrate) : tier.bitrate;

      let tierPassed = false;
      for (const codec of codecs) {
        const stdConfig = {
          codec,
          width: curW,
          height: curH,
          bitrate: tierBitrate,
          framerate: targetFps
        };

        if (typeof VideoEncoder.isConfigSupported === 'function') {
          try {
            const sup = await VideoEncoder.isConfigSupported(stdConfig);
            if (!sup || !sup.supported) continue;
            chosenTier = { ...tier, w: curW, h: curH, bitrate: tierBitrate };
            chosenConfig = stdConfig;
            chosenCodecs = codecs;
            tierPassed = true;
            break;
          } catch (e) {
            continue;
          }
        } else {
          chosenTier = { ...tier, w: curW, h: curH, bitrate: tierBitrate };
          chosenConfig = stdConfig;
          chosenCodecs = codecs;
          tierPassed = true;
          break;
        }
      }

      if (tierPassed) break;
    }

    if (!chosenTier) {
      chosenTier = candidateTiers[candidateTiers.length - 1];
      chosenTier.w = (chosenTier.w % 2 === 0) ? chosenTier.w : chosenTier.w - 1;
      chosenTier.h = (chosenTier.h % 2 === 0) ? chosenTier.h : chosenTier.h - 1;
      chosenCodecs = ['avc1.420028', 'avc1.42001f'];
      chosenConfig = {
        codec: 'avc1.420028',
        width: chosenTier.w,
        height: chosenTier.h,
        bitrate: chosenTier.bitrate,
        framerate: targetFps
      };
    }

    const safeW = chosenTier.w;
    const safeH = chosenTier.h;
    const safeMaxDim = Math.max(safeW, safeH);

    if (chosenTier.w !== exportW || chosenTier.h !== exportH) {
      if (desc) desc.textContent = `Optimized for your device: Rendering ${chosenTier.name} (${safeW}x${safeH}) at buttery smooth 60fps...`;
    }

    // Pre-render Static Background (Layer 1) at exact negotiated resolution
    let staticBgBitmap = null;
    if (!this.bg.isVideo) {
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = safeW;
      bgCanvas.height = safeH;
      const bgCtx = bgCanvas.getContext('2d', { alpha: false });
      bgCtx.imageSmoothingEnabled = true;
      bgCtx.imageSmoothingQuality = (this.isMobile || safeW >= 2160 || safeH >= 2160) ? 'medium' : 'high';
      this.renderBackground(bgCtx, safeW, safeH);
      if (typeof createImageBitmap === 'function') {
        try { staticBgBitmap = await createImageBitmap(bgCanvas); } catch (e) {}
      }
      if (!staticBgBitmap) staticBgBitmap = bgCanvas;
    }

    // Pre-render Static Overlays (Title, Subtitle, Watermark - Layer 3) at exact negotiated resolution
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = safeW;
    overlayCanvas.height = safeH;
    const overlayCtx = overlayCanvas.getContext('2d');
    overlayCtx.imageSmoothingEnabled = true;
    overlayCtx.imageSmoothingQuality = (safeW >= 2160 || safeH >= 2160) ? 'medium' : 'high';
    this.renderTitle(overlayCtx, safeW, safeH, true);
    if (this.watermark.enabled) {
      this.renderWatermark(overlayCtx, safeW, safeH, true);
    }
    let staticOverlayBitmap = null;
    if (typeof createImageBitmap === 'function') {
      try { staticOverlayBitmap = await createImageBitmap(overlayCanvas); } catch (e) {}
    }
    if (!staticOverlayBitmap) staticOverlayBitmap = overlayCanvas;

    // Canvas for rendering individual frames
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = safeW;
    frameCanvas.height = safeH;
    const frameCtx = frameCanvas.getContext('2d', { alpha: false });
    frameCtx.imageSmoothingEnabled = true;
    frameCtx.imageSmoothingQuality = (safeW >= 1440 || safeH >= 1440 || this.isMobile) ? 'medium' : 'high';

    // Live preview canvas inside the modal
    const livePreviewCanvas = document.getElementById('exportLiveCanvas');
    const previewScale = Math.min(1, 480 / Math.max(safeW, safeH));
    livePreviewCanvas.width = Math.round(safeW * previewScale);
    livePreviewCanvas.height = Math.round(safeH * previewScale);
    livePreviewCanvas.style.aspectRatio = `${safeW} / ${safeH}`;
    const livePreviewCtx = livePreviewCanvas.getContext('2d', { alpha: false });
    livePreviewCtx.imageSmoothingEnabled = true;
    livePreviewCtx.imageSmoothingQuality = 'low'; // Fast GPU bilinear downscaling for fluid preview

    // Micro-yield helper using MessageChannel for zero-latency DOM compositor painting without setTimeout clamp
    const yieldToUI = () => new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve();
      channel.port2.postMessage(null);
    });

    // Audio setup
    const audioBuf = (hasAudio && window.audioEngine && window.audioEngine.currentBuffer) ? window.audioEngine.currentBuffer : null;
    const sampleRate = audioBuf ? audioBuf.sampleRate : 44100;
    const channels = audioBuf ? Math.min(2, audioBuf.numberOfChannels) : 2;

    // Audio setup & encoder initialization (guard against ReferenceError on iOS Safari where AudioEncoder is undefined)
    let audioEncoder = null;
    let audioEncoderError = null;
    let totalAudioSamples = 0;
    const frameChunkSize = 1024;
    let samplePos = 0;
    let audioTsUs = 0;
    let ch0 = null;
    let ch1 = null;
    let startSample = 0;
    let loopLen = 1;

    const canEncodeAudio = hasAudio && audioBuf && (typeof AudioEncoder !== 'undefined');
    let muxerAudioConfig = null;

    if (canEncodeAudio) {
      try {
        const audioConfig = {
          codec: 'mp4a.40.2',
          sampleRate: sampleRate,
          numberOfChannels: channels,
          bitrate: 128000
        };
        let isAudioSupported = true;
        if (typeof AudioEncoder.isConfigSupported === 'function') {
          const aSup = await AudioEncoder.isConfigSupported(audioConfig);
          isAudioSupported = aSup && aSup.supported;
        }
        if (isAudioSupported) {
          muxerAudioConfig = {
            codec: 'aac',
            numberOfChannels: channels,
            sampleRate: sampleRate
          };
          totalAudioSamples = Math.round(sampleRate * totalSeconds);
          const trimStart = (window.audioEngine && typeof window.audioEngine.trimStart === 'number') ? window.audioEngine.trimStart : 0;
          const trimEnd = (window.audioEngine && typeof window.audioEngine.trimEnd === 'number' && window.audioEngine.trimEnd > trimStart) ? window.audioEngine.trimEnd : audioBuf.duration;

          startSample = Math.max(0, Math.round(trimStart * sampleRate));
          const endSample = Math.min(audioBuf.length, Math.round(trimEnd * sampleRate));
          loopLen = Math.max(1, endSample - startSample);

          ch0 = audioBuf.getChannelData(0);
          ch1 = (channels > 1 && audioBuf.numberOfChannels > 1) ? audioBuf.getChannelData(1) : ch0;
        }
      } catch (aeErr) {
        console.warn('AudioEncoder probe notice:', aeErr);
      }
    }

    const muxerOpts = {
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: safeW,
        height: safeH
      },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset'
    };

    if (muxerAudioConfig) {
      muxerOpts.audio = muxerAudioConfig;
    }

    const muxer = new Mp4Muxer.Muxer(muxerOpts);

    if (muxerAudioConfig) {
      try {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: (e) => {
            console.error('AudioEncoder error:', e);
            audioEncoderError = e;
          }
        });
        audioEncoder.configure({
          codec: 'mp4a.40.2',
          sampleRate: sampleRate,
          numberOfChannels: channels,
          bitrate: 128000
        });
        this.activeAudioEncoder = audioEncoder;
      } catch (e) {
        console.warn('AudioEncoder init fallback:', e);
        audioEncoder = null;
      }
    }

    let videoEncoderError = null;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        console.error('VideoEncoder error:', e);
        videoEncoderError = e;
      }
    });
    this.activeVideoEncoder = videoEncoder;

    try {
      videoEncoder.configure(chosenConfig);
    } catch (confErr) {
      console.warn('Initial VideoEncoder config threw, trying candidateCodecs fallback:', confErr);
      let configured = false;
      for (const c of chosenCodecs) {
        try {
          videoEncoder.configure({ codec: c, width: safeW, height: safeH, bitrate: chosenTier.bitrate, framerate: targetFps });
          configured = true;
          break;
        } catch (e) {}
      }
      if (!configured) throw confErr;
    }

    const t0 = performance.now();
    // 1.0-second GOP (e.g. 30 frames at 30fps) - strictly required by Instagram Reels, Shorts, and mobile video decoders
    const keyFrameInterval = Math.max(1, targetFps);

    // Helper to feed audio chunks interleaved with video frames to prevent streaming buffer starvation
    // WebCodecs AAC strictly requires 1024 samples per AudioData chunk.
    const feedAudioUpTo = (targetSampleLimit) => {
      if (!audioEncoder || samplePos >= totalAudioSamples) return;
      const limit = Math.min(totalAudioSamples, targetSampleLimit);
      while (samplePos + frameChunkSize <= limit) {
        if (!this.isExporting) return;
        const planar = new Float32Array(channels * frameChunkSize);
        for (let i = 0; i < frameChunkSize; i++) {
          const offsetInLoop = (samplePos + i) % loopLen;
          const srcIdx = startSample + offsetInLoop;
          planar[i] = ch0[srcIdx] || 0;
          if (channels > 1) {
            planar[frameChunkSize + i] = ch1[srcIdx] || 0;
          }
        }

        const aData = new AudioData({
          format: 'f32-planar',
          sampleRate: sampleRate,
          numberOfFrames: frameChunkSize,
          numberOfChannels: channels,
          timestamp: audioTsUs,
          data: planar
        });
        audioEncoder.encode(aData);
        aData.close();

        audioTsUs += Math.round((frameChunkSize / sampleRate) * 1000000);
        samplePos += frameChunkSize;
      }
    };

    // PREPARE SMOOTH HARDWARE PLAYBACK:
    // Real-time sequential playback eliminates 100% of seek latency, decoder freezing, and frame stalls!
    const prevBgMuted = (this.bg.video && typeof this.bg.video.muted === 'boolean') ? this.bg.video.muted : true;
    if (this.bg.isVideo && this.bg.video) {
      this.bg.video.muted = true; // silent during export recording
      this.bg.video.loop = true;  // hardware-accelerated seamless looping
      this.bg.video.currentTime = 0;
      try {
        await this.bg.video.play();
      } catch (e) {
        console.warn('Video background auto-play in export notice:', e);
      }
    }

    if (this.bg.isVideo) {
      // =======================================================================
      // REAL-TIME SYNCHRONIZED PLAYBACK LOOP (100% BUTTER-SMOOTH FOR VIDEO BG)
      // =======================================================================
      let f = 0;
      const tStart = performance.now();
      const frameIntervalMs = 1000 / targetFps;

      await new Promise((resolve, reject) => {
        const encodeTick = async () => {
          if (!this.isExporting) {
            try { videoEncoder.close(); } catch (e) {}
            if (audioEncoder) { try { audioEncoder.close(); } catch (e) {} }
            this.activeVideoEncoder = null;
            this.activeAudioEncoder = null;
            if (staticBgBitmap && typeof staticBgBitmap.close === 'function') {
              try { staticBgBitmap.close(); } catch (e) {}
            }
            if (staticOverlayBitmap && typeof staticOverlayBitmap.close === 'function') {
              try { staticOverlayBitmap.close(); } catch (e) {}
            }
            if (this.bg.isVideo && this.bg.video) {
              try {
                this.bg.video.pause();
                this.bg.video.muted = prevBgMuted;
              } catch (e) {}
            }
            return reject(new Error('Export cancelled'));
          }
          if (videoEncoderError) return reject(videoEncoderError);
          if (audioEncoderError) return reject(audioEncoderError);

          const elapsedMs = performance.now() - tStart;

          // Render strictly paced frames matching the playback clock
          while (f < totalFrames && (f === 0 || elapsedMs >= (f * frameIntervalMs) - 3)) {
            // Guard against encoder queue buildup on mobile
            if (videoEncoder.encodeQueueSize > 3) {
              break;
            }

            const frameTimeMs = (f / targetFps) * 1000;
            const isRevealSection = this.appendRevealEnding && (frameTimeMs >= this.videoDuration * 1000);
            const prevReveal = this.answerRevealMode;
            if (isRevealSection) this.answerRevealMode = true;

            // Ensure video element stays playing and softly resync only if heavily drifted (>0.75s)
            if (this.bg.video) {
              if (this.bg.video.paused) {
                this.bg.video.play().catch(() => {});
              }
              const vidDur = (this.bg.duration > 0 && isFinite(this.bg.duration)) ? this.bg.duration : 10;
              const expectedTime = (frameTimeMs / 1000) % vidDur;
              const timeDiff = Math.abs(this.bg.video.currentTime - expectedTime);
              const effectiveDiff = Math.min(timeDiff, Math.abs(timeDiff - vidDur));
              if (effectiveDiff > 0.75) {
                try { this.bg.video.currentTime = expectedTime; } catch (e) {}
              }
            }

            this.drawFrameWithCache(frameCtx, safeW, safeH, frameTimeMs, true, staticBgBitmap, staticOverlayBitmap);
            this.answerRevealMode = prevReveal;

            const timestampUs = f * frameIntervalUs;
            const vFrame = new VideoFrame(frameCanvas, {
              timestamp: timestampUs,
              duration: frameIntervalUs
            });

            videoEncoder.encode(vFrame, { keyFrame: (f % keyFrameInterval === 0) });
            vFrame.close();

            // Interleave audio in lockstep with video progress
            if (audioEncoder) {
              const nextVideoTimeSec = (f + 1) / targetFps;
              feedAudioUpTo(Math.round(nextVideoTimeSec * sampleRate));
            }

            f++;
          }

          // Live preview and progress UI update
          const progress = Math.min(1.0, f / totalFrames);
          bar.style.width = `${Math.round(progress * 100)}%`;
          pct.textContent = `${Math.round(progress * 100)}%`;
          framesLabel.textContent = `${((f) / targetFps).toFixed(1)}s / ${totalSeconds.toFixed(1)}s (${f}/${totalFrames} frames)`;
          const eta = progress > 0 ? Math.max(0, Math.round(((elapsedMs / progress) - elapsedMs) / 1000)) : 0;
          etaLabel.textContent = `ETA: ${eta}s`;
          const previewInterval = this.isMobile ? 4 : 3;
          if (f % previewInterval === 0 || f >= totalFrames) {
            livePreviewCtx.drawImage(frameCanvas, 0, 0, livePreviewCanvas.width, livePreviewCanvas.height);
          }

          if (f < totalFrames) {
            requestAnimationFrame(encodeTick);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(encodeTick);
      });
    } else {
      // =======================================================================
      // FAST DETERMINISTIC LOOP (FOR STATIC IMAGE BACKDROPS - FINISHES IN 2s)
      // =======================================================================
      for (let f = 0; f < totalFrames; f++) {
        if (!this.isExporting) {
          try { videoEncoder.close(); } catch (e) {}
          if (audioEncoder) { try { audioEncoder.close(); } catch (e) {} }
          this.activeVideoEncoder = null;
          this.activeAudioEncoder = null;
          if (staticBgBitmap && typeof staticBgBitmap.close === 'function') {
            try { staticBgBitmap.close(); } catch (e) {}
          }
          if (staticOverlayBitmap && typeof staticOverlayBitmap.close === 'function') {
            try { staticOverlayBitmap.close(); } catch (e) {}
          }
          return;
        }
        if (videoEncoderError) throw videoEncoderError;
        if (audioEncoderError) throw audioEncoderError;

        // CRITICAL MOBILE & 4K/2K STABILITY: Strict Backpressure Queue Throttling
        // At 4K, 1 uncompressed RGBA frame = 33MB. Limiting queue to <= 1 frame prevents memory buildup
        // 100% eliminates thermal overheating, mobile freeze, and phone reboot!
        const maxQueue = (safeMaxDim >= 2560 || this.isMobile) ? 1 : 2;
        while (videoEncoder.encodeQueueSize > maxQueue) {
          if (!this.isExporting) return;
          await new Promise(resolve => {
            let done = false;
            const finish = () => {
              if (!done) {
                done = true;
                resolve();
              }
            };
            try {
              videoEncoder.ondequeue = finish;
            } catch (e) {}
            setTimeout(finish, 16);
          });
        }

        const frameTimeMs = (f / targetFps) * 1000;
        const isRevealSection = this.appendRevealEnding && (frameTimeMs >= this.videoDuration * 1000);
        const prevReveal = this.answerRevealMode;
        if (isRevealSection) this.answerRevealMode = true;

        this.drawFrameWithCache(frameCtx, safeW, safeH, frameTimeMs, true, staticBgBitmap, staticOverlayBitmap);
        this.answerRevealMode = prevReveal;

        const timestampUs = f * frameIntervalUs;
        const vFrame = new VideoFrame(frameCanvas, {
          timestamp: timestampUs,
          duration: frameIntervalUs
        });

        videoEncoder.encode(vFrame, { keyFrame: (f % keyFrameInterval === 0) });
        vFrame.close();

        if (audioEncoder) {
          const nextVideoTimeSec = (f + 1) / targetFps;
          feedAudioUpTo(Math.round(nextVideoTimeSec * sampleRate));
        }


        const previewFreq = (safeMaxDim >= 2560 || this.isMobile) ? 6 : 3;
        const shouldUpdatePreview = (f % previewFreq === 0) || (f === totalFrames - 1);
        if (shouldUpdatePreview) {
          livePreviewCtx.drawImage(frameCanvas, 0, 0, livePreviewCanvas.width, livePreviewCanvas.height);
          const progress = (f + 1) / totalFrames;
          const now = performance.now();
          const elapsedMs = now - t0;
          const eta = progress > 0 ? Math.max(0, Math.round(((elapsedMs / progress) - elapsedMs) / 1000)) : 0;
          bar.style.width = `${Math.round(progress * 100)}%`;
          pct.textContent = `${Math.round(progress * 100)}%`;
          framesLabel.textContent = `${((f + 1) / targetFps).toFixed(1)}s / ${totalSeconds.toFixed(1)}s (${f + 1}/${totalFrames} frames)`;
          etaLabel.textContent = `ETA: ${eta}s`;
          await yieldToUI();
        }
      }
    }

    // Drain any remaining audio samples up to total duration
    // Pad final chunk with silence up to 1024 samples so AAC encoder flush never fails
    if (audioEncoder && samplePos < totalAudioSamples) {
      feedAudioUpTo(totalAudioSamples);
      if (samplePos < totalAudioSamples) {
        const planar = new Float32Array(channels * frameChunkSize);
        for (let i = 0; i < frameChunkSize; i++) {
          const sIdx = samplePos + i;
          if (sIdx < totalAudioSamples) {
            const offsetInLoop = sIdx % loopLen;
            const srcIdx = startSample + offsetInLoop;
            planar[i] = ch0[srcIdx] || 0;
            if (channels > 1) {
              planar[frameChunkSize + i] = ch1[srcIdx] || 0;
            }
          } else {
            planar[i] = 0;
            if (channels > 1) planar[frameChunkSize + i] = 0;
          }
        }

        const aData = new AudioData({
          format: 'f32-planar',
          sampleRate: sampleRate,
          numberOfFrames: frameChunkSize,
          numberOfChannels: channels,
          timestamp: audioTsUs,
          data: planar
        });
        audioEncoder.encode(aData);
        aData.close();

        audioTsUs += Math.round((frameChunkSize / sampleRate) * 1000000);
        samplePos += frameChunkSize;
      }
    }

    etaLabel.textContent = 'Finalizing encoded streams...';
    const flushPromises = [videoEncoder.flush()];
    if (audioEncoder) flushPromises.push(audioEncoder.flush());
    await Promise.all(flushPromises);

    videoEncoder.close();
    this.activeVideoEncoder = null;
    if (audioEncoder) {
      try { audioEncoder.close(); } catch (e) {}
      this.activeAudioEncoder = null;
    }

    if (this.bg.isVideo && this.bg.video) {
      try {
        this.bg.video.pause();
        this.bg.video.muted = prevBgMuted;
      } catch (e) {}
    }

    etaLabel.textContent = 'Muxing FastStart MP4...';
    muxer.finalize();

    // Clean up cached bitmaps
    this.bg.exportFrameBitmap = null;

    if (staticBgBitmap && typeof staticBgBitmap.close === 'function') {
      try { staticBgBitmap.close(); } catch (e) {}
    }
    if (staticOverlayBitmap && typeof staticOverlayBitmap.close === 'function') {
      try { staticOverlayBitmap.close(); } catch (e) {}
    }

    const rawBlob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
    this.finalizeExportDownload(rawBlob, 'mp4');
  }

  cancelVideoExport() {
    this.isExporting = false;
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.renderLoop.bind(this));
    if (this.activeVideoEncoder) {
      try { this.activeVideoEncoder.close(); } catch (e) {}
      this.activeVideoEncoder = null;
    }
    if (this.activeAudioEncoder) {
      try { this.activeAudioEncoder.close(); } catch (e) {}
      this.activeAudioEncoder = null;
    }
    if (this.currentExportCleanup) {
      try { this.currentExportCleanup(); } catch (e) {}
      this.currentExportCleanup = null;
    }
    if (this.exportMediaRecorder && this.exportMediaRecorder.state !== 'inactive') {
      try { this.exportMediaRecorder.stop(); } catch (e) {}
    }
    if (this.bg.isVideo && this.bg.video) {
      try { this.bg.video.pause(); } catch (e) {}
    }
    this.bg.exportFrameBitmap = null;
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
        this.syncTitleUI();
        this.syncBackgroundUI();
        this.syncWatermarkUI();

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

  // =========================================================================
  // UI SYNCHRONIZATION HELPERS
  // =========================================================================

  syncTitleUI() {
    const inTitle = document.getElementById('inputTitleText');
    if (inTitle) inTitle.value = this.title.text || '';

    const chkAuto = document.getElementById('checkAutoSyncCount');
    if (chkAuto) chkAuto.checked = !!this.title.autoSyncCount;

    const inSub = document.getElementById('inputSubtitleText');
    if (inSub) inSub.value = this.title.subtitle || '';

    const chkSub = document.getElementById('checkShowSubtitle');
    if (chkSub) chkSub.checked = !!this.title.showSubtitle;

    // Highlight selected style card
    document.querySelectorAll('.title-style-card').forEach(card => {
      card.classList.toggle('active', card.dataset.style === this.title.style);
    });

    // Font Family dropdown
    const selFont = document.getElementById('selectFontFamily');
    if (selFont && this.title.fontFamily) selFont.value = this.title.fontFamily;

    // Font Size
    const curSize = this.title.fontSize || 64;
    const slSize = document.getElementById('sliderTitleSize');
    const inSizeExact = document.getElementById('inputTitleSizeExact');
    const valSize = document.getElementById('titleSizeVal');
    if (slSize) slSize.value = Math.min(300, curSize);
    if (inSizeExact) inSizeExact.value = curSize;
    if (valSize) valSize.textContent = `${curSize}px`;

    // Text & Outline Colors
    const inColor = document.getElementById('inputTextColor');
    if (inColor && this.title.textColor) inColor.value = this.title.textColor;

    const inStroke = document.getElementById('inputStrokeColor');
    if (inStroke && this.title.strokeColor) inStroke.value = this.title.strokeColor;

    const curStrokeW = this.title.strokeWidth !== undefined ? this.title.strokeWidth : 10;
    const slStroke = document.getElementById('sliderStrokeWidth');
    const inStrokeExact = document.getElementById('inputStrokeWidthExact');
    const valStroke = document.getElementById('strokeWidthVal');
    if (slStroke) slStroke.value = curStrokeW;
    if (inStrokeExact) inStrokeExact.value = curStrokeW;
    if (valStroke) valStroke.textContent = `${curStrokeW}px`;

    // Main Title Background Box Controls
    const chkTitleBg = document.getElementById('checkTitleBgEnable');
    if (chkTitleBg) chkTitleBg.checked = !!this.title.bgEnabled;

    const inTitleBgCol = document.getElementById('inputTitleBgColor');
    if (inTitleBgCol) inTitleBgCol.value = this.title.bgColor || '#0f172a';

    const curTitleBgOp = Math.round((this.title.bgOpacity !== undefined ? this.title.bgOpacity : 0.85) * 100);
    const slTitleBgOp = document.getElementById('sliderTitleBgOpacity');
    const valTitleBgOp = document.getElementById('titleBgOpacityVal');
    if (slTitleBgOp) slTitleBgOp.value = curTitleBgOp;
    if (valTitleBgOp) valTitleBgOp.textContent = `${curTitleBgOp}%`;

    const curTitleRadius = this.title.bgRadius !== undefined ? this.title.bgRadius : 16;
    const slTitleRadius = document.getElementById('sliderTitleBgRadius');
    const inTitleRadiusExact = document.getElementById('inputTitleBgRadiusExact');
    const valTitleRadius = document.getElementById('titleBgRadiusVal');
    if (slTitleRadius) slTitleRadius.value = Math.min(60, curTitleRadius);
    if (inTitleRadiusExact) inTitleRadiusExact.value = curTitleRadius;
    if (valTitleRadius) valTitleRadius.textContent = `${curTitleRadius}px`;

    const curPadX = this.title.bgPaddingX !== undefined ? this.title.bgPaddingX : 36;
    const slPadX = document.getElementById('sliderTitleBgPaddingX');
    const valPadX = document.getElementById('titleBgPaddingXVal');
    if (slPadX) slPadX.value = curPadX;
    if (valPadX) valPadX.textContent = `${curPadX}px`;

    const curPadY = this.title.bgPaddingY !== undefined ? this.title.bgPaddingY : 16;
    const slPadY = document.getElementById('sliderTitleBgPaddingY');
    const valPadY = document.getElementById('titleBgPaddingYVal');
    if (slPadY) slPadY.value = curPadY;
    if (valPadY) valPadY.textContent = `${curPadY}px`;

    const inBorderCol = document.getElementById('inputTitleBorderColor');
    if (inBorderCol) inBorderCol.value = this.title.bgBorderColor || '#6366f1';

    const curBorderW = this.title.bgBorderWidth !== undefined ? this.title.bgBorderWidth : 0;
    const slBorderW = document.getElementById('sliderTitleBorderWidth');
    const valBorderW = document.getElementById('titleBorderWidthVal');
    if (slBorderW) slBorderW.value = curBorderW;
    if (valBorderW) valBorderW.textContent = `${curBorderW}px`;

    const curBorderOp = Math.round((this.title.bgBorderOpacity !== undefined ? this.title.bgBorderOpacity : 1.0) * 100);
    const slBorderOp = document.getElementById('sliderTitleBorderOpacity');
    const valBorderOp = document.getElementById('titleBorderOpacityVal');
    if (slBorderOp) slBorderOp.value = curBorderOp;
    if (valBorderOp) valBorderOp.textContent = `${curBorderOp}%`;

    // Main Title Advanced Effects (Gradient, Glow, Shadow)
    const chkGrad = document.getElementById('checkTitleGradientEnable');
    const grpGrad = document.getElementById('titleGradientControls');
    if (chkGrad) chkGrad.checked = !!this.title.gradientEnabled;
    if (grpGrad) grpGrad.style.display = this.title.gradientEnabled ? 'grid' : 'none';

    const inGrad1 = document.getElementById('inputTitleGradColor1');
    if (inGrad1) inGrad1.value = this.title.gradientColor1 || '#ff7a00';
    const inGrad2 = document.getElementById('inputTitleGradColor2');
    if (inGrad2) inGrad2.value = this.title.gradientColor2 || '#f43f5e';

    const chkGlow = document.getElementById('checkTitleGlowEnable');
    const grpGlow = document.getElementById('titleGlowControls');
    if (chkGlow) chkGlow.checked = !!this.title.glowEnabled;
    if (grpGlow) grpGlow.style.display = this.title.glowEnabled ? 'grid' : 'none';

    const inGlowCol = document.getElementById('inputTitleGlowColor');
    if (inGlowCol) inGlowCol.value = this.title.glowColor || '#06b6d4';

    const curGlowInt = this.title.glowIntensity !== undefined ? this.title.glowIntensity : 20;
    const slGlowInt = document.getElementById('sliderTitleGlowIntensity');
    const valGlowInt = document.getElementById('titleGlowIntensityVal');
    if (slGlowInt) slGlowInt.value = curGlowInt;
    if (valGlowInt) valGlowInt.textContent = `${curGlowInt}px`;

    const inShadowCol = document.getElementById('inputTitleShadowColor');
    if (inShadowCol) inShadowCol.value = this.title.shadowColor || '#000000';

    const curShadowB = this.title.shadowBlur !== undefined ? this.title.shadowBlur : 14;
    const slShadowB = document.getElementById('sliderTitleShadowBlur');
    const valShadowB = document.getElementById('titleShadowBlurVal');
    if (slShadowB) slShadowB.value = curShadowB;
    if (valShadowB) valShadowB.textContent = `${curShadowB}px`;

    // Subtitle Typography & Controls
    const selSubFont = document.getElementById('selectSubtitleFontFamily');
    if (selSubFont) selSubFont.value = this.title.subtitleFontFamily || 'inherit';

    const curSubSize = this.title.subtitleFontSize || 28;
    const slSubSize = document.getElementById('sliderSubtitleSize');
    const inSubSizeExact = document.getElementById('inputSubtitleSizeExact');
    const valSubSize = document.getElementById('subtitleSizeVal');
    if (slSubSize) slSubSize.value = curSubSize;
    if (inSubSizeExact) inSubSizeExact.value = curSubSize;
    if (valSubSize) valSubSize.textContent = `${curSubSize}px`;

    const inSubColor = document.getElementById('inputSubtitleColor');
    if (inSubColor && this.title.subtitleColor) inSubColor.value = this.title.subtitleColor;

    const inSubStroke = document.getElementById('inputSubtitleStrokeColor');
    if (inSubStroke) inSubStroke.value = this.title.subtitleStrokeColor || '#000000';

    const curSubStrokeW = this.title.subtitleStrokeWidth !== undefined ? this.title.subtitleStrokeWidth : 4;
    const slSubStrokeW = document.getElementById('sliderSubtitleStrokeWidth');
    const valSubStrokeW = document.getElementById('subStrokeWidthVal');
    if (slSubStrokeW) slSubStrokeW.value = curSubStrokeW;
    if (valSubStrokeW) valSubStrokeW.textContent = `${curSubStrokeW}px`;

    const chkSubCaps = document.getElementById('checkSubtitleAllCaps');
    if (chkSubCaps) chkSubCaps.checked = !!this.title.subtitleAllCaps;

    const chkSubGlow = document.getElementById('checkSubtitleGlowEnable');
    const grpSubGlow = document.getElementById('subGlowControls');
    if (chkSubGlow) chkSubGlow.checked = !!this.title.subtitleGlowEnabled;
    if (grpSubGlow) grpSubGlow.style.display = this.title.subtitleGlowEnabled ? 'block' : 'none';

    const inSubGlowCol = document.getElementById('inputSubtitleGlowColor');
    if (inSubGlowCol) inSubGlowCol.value = this.title.subtitleGlowColor || '#fde047';

    // Subtitle Background Box / Pill Controls
    const chkSubBg = document.getElementById('checkSubtitleBgEnable');
    if (chkSubBg) chkSubBg.checked = (this.title.subtitleBgEnabled !== false && this.title.showSubtitlePill !== false);

    const inSubPill = document.getElementById('inputSubtitlePillColor');
    if (inSubPill) inSubPill.value = this.title.subtitleBgColor || this.title.subtitlePillColor || '#000000';

    const curSubBgOp = Math.round((this.title.subtitleBgOpacity !== undefined ? this.title.subtitleBgOpacity : 0.75) * 100);
    const slSubBgOp = document.getElementById('sliderSubtitleBgOpacity');
    const valSubBgOp = document.getElementById('subBgOpacityVal');
    if (slSubBgOp) slSubBgOp.value = curSubBgOp;
    if (valSubBgOp) valSubBgOp.textContent = `${curSubBgOp}%`;

    const curSubRadius = this.title.subtitleBgRadius !== undefined ? this.title.subtitleBgRadius : 10;
    const slSubRadius = document.getElementById('sliderSubtitleBgRadius');
    const inSubRadiusExact = document.getElementById('inputSubtitleBgRadiusExact');
    const valSubRadius = document.getElementById('subBgRadiusVal');
    if (slSubRadius) slSubRadius.value = Math.min(40, curSubRadius);
    if (inSubRadiusExact) inSubRadiusExact.value = curSubRadius;
    if (valSubRadius) valSubRadius.textContent = `${curSubRadius}px`;

    const curSubPadX = this.title.subtitleBgPaddingX !== undefined ? this.title.subtitleBgPaddingX : 20;
    const slSubPadX = document.getElementById('sliderSubtitleBgPaddingX');
    const valSubPadX = document.getElementById('subBgPaddingXVal');
    if (slSubPadX) slSubPadX.value = curSubPadX;
    if (valSubPadX) valSubPadX.textContent = `${curSubPadX}px`;

    const curSubPadY = this.title.subtitleBgPaddingY !== undefined ? this.title.subtitleBgPaddingY : 8;
    const slSubPadY = document.getElementById('sliderSubtitleBgPaddingY');
    const valSubPadY = document.getElementById('subBgPaddingYVal');
    if (slSubPadY) slSubPadY.value = curSubPadY;
    if (valSubPadY) valSubPadY.textContent = `${curSubPadY}px`;

    const inSubBorderCol = document.getElementById('inputSubtitleBorderColor');
    if (inSubBorderCol) inSubBorderCol.value = this.title.subtitleBorderColor || '#ffffff';

    const curSubBorderW = this.title.subtitleBorderWidth !== undefined ? this.title.subtitleBorderWidth : 1.5;
    const slSubBorderW = document.getElementById('sliderSubtitleBorderWidth');
    const valSubBorderW = document.getElementById('subBorderWidthVal');
    if (slSubBorderW) slSubBorderW.value = curSubBorderW;
    if (valSubBorderW) valSubBorderW.textContent = `${curSubBorderW}px`;

    const curSubBorderOp = Math.round((this.title.subtitleBorderOpacity !== undefined ? this.title.subtitleBorderOpacity : 0.3) * 100);
    const slSubBorderOp = document.getElementById('sliderSubtitleBorderOpacity');
    const valSubBorderOp = document.getElementById('subBorderOpacityVal');
    if (slSubBorderOp) slSubBorderOp.value = curSubBorderOp;
    if (valSubBorderOp) valSubBorderOp.textContent = `${curSubBorderOp}%`;

    // Highlight selected subtitle style card
    const curSubStyle = this.title.subtitleStyle || 'pill_glass';
    document.querySelectorAll('.subtitle-style-card').forEach(card => {
      card.classList.toggle('active', card.dataset.substyle === curSubStyle);
    });

    // Title to Subtitle Spacing (Gap)
    const curGap = this.title.gap !== undefined ? this.title.gap : 40;
    const slGap = document.getElementById('sliderTitleGap');
    const inGapExact = document.getElementById('inputTitleGapExact');
    const valGap = document.getElementById('titleGapVal');
    if (slGap) slGap.value = curGap;
    if (inGapExact) inGapExact.value = curGap;
    if (valGap) valGap.textContent = `${curGap}px`;
  }

  syncBackgroundUI() {
    // Zoom
    const zoomPct = Math.round((this.bg.zoom ?? 1.0) * 100);
    const slZoom = document.getElementById('sliderBgZoom');
    const inZoom = document.getElementById('inputBgZoom');
    const valZoom = document.getElementById('bgZoomVal');
    if (slZoom) slZoom.value = zoomPct;
    if (inZoom) inZoom.value = zoomPct;
    if (valZoom) valZoom.textContent = `${zoomPct}%`;

    // Pan X
    const slPanX = document.getElementById('sliderBgPanX');
    const inPanX = document.getElementById('inputBgPanX');
    const valPanX = document.getElementById('bgPanXVal');
    if (slPanX) slPanX.value = this.bg.panX ?? 0;
    if (inPanX) inPanX.value = this.bg.panX ?? 0;
    if (valPanX) valPanX.textContent = `${this.bg.panX ?? 0}px`;

    // Pan Y
    const slPanY = document.getElementById('sliderBgPanY');
    const inPanY = document.getElementById('inputBgPanY');
    const valPanY = document.getElementById('bgPanYVal');
    if (slPanY) slPanY.value = this.bg.panY ?? 0;
    if (inPanY) inPanY.value = this.bg.panY ?? 0;
    if (valPanY) valPanY.textContent = `${this.bg.panY ?? 0}px`;

    // Atmosphere
    const slBr = document.getElementById('sliderBgBrightness');
    const valBr = document.getElementById('bgBrightnessVal');
    if (slBr) slBr.value = this.bg.brightness ?? 100;
    if (valBr) valBr.textContent = `${this.bg.brightness ?? 100}%`;

    const slCt = document.getElementById('sliderBgContrast');
    const valCt = document.getElementById('bgContrastVal');
    if (slCt) slCt.value = this.bg.contrast ?? 100;
    if (valCt) valCt.textContent = `${this.bg.contrast ?? 100}%`;

    const slSt = document.getElementById('sliderBgSaturation');
    const valSt = document.getElementById('bgSaturationVal');
    if (slSt) slSt.value = this.bg.saturation ?? 100;
    if (valSt) valSt.textContent = `${this.bg.saturation ?? 100}%`;

    // Active preset card
    document.querySelectorAll('.bg-thumb-card').forEach(card => {
      card.classList.toggle('active', card.dataset.bg === this.bg.presetId);
    });

    this.updateVideoBgUI();
  }

  syncWatermarkUI() {
    const chkWm = document.getElementById('checkWatermarkEnable');
    if (chkWm) chkWm.checked = !!this.watermark.enabled;

    const inWm = document.getElementById('inputWatermarkText');
    if (inWm) inWm.value = this.watermark.text || '';

    // Style presets cards
    const curWmStyle = this.watermark.style || 'clean_glow';
    document.querySelectorAll('.watermark-style-card').forEach(card => {
      card.classList.toggle('active', card.dataset.wmstyle === curWmStyle);
    });

    // Font family
    const selFont = document.getElementById('selectWatermarkFont');
    if (selFont && this.watermark.fontFamily) selFont.value = this.watermark.fontFamily;

    // Text & Pill Colors
    const inColor = document.getElementById('inputWatermarkColor');
    if (inColor && this.watermark.color) inColor.value = this.watermark.color;

    const inPill = document.getElementById('inputWatermarkPillColor');
    if (inPill && this.watermark.pillColor) inPill.value = this.watermark.pillColor;

    // Font size
    const curSize = this.watermark.fontSize || 24;
    const slSize = document.getElementById('sliderWatermarkSize');
    const inSize = document.getElementById('inputWatermarkSizeExact');
    const valSize = document.getElementById('watermarkSizeVal');
    if (slSize) slSize.value = curSize;
    if (inSize) inSize.value = curSize;
    if (valSize) valSize.textContent = `${curSize}px`;

    // Position X
    const xPct = Math.round((this.watermark.nx ?? 0.5) * 100);
    const slX = document.getElementById('sliderWatermarkX');
    const inX = document.getElementById('inputWatermarkXExact');
    const valX = document.getElementById('wmXVal');
    if (slX) slX.value = xPct;
    if (inX) inX.value = xPct;
    if (valX) valX.textContent = `${xPct}%`;

    // Position Y
    const yPct = Math.round((this.watermark.ny ?? 0.95) * 100);
    const slY = document.getElementById('sliderWatermarkY');
    const inY = document.getElementById('inputWatermarkYExact');
    const valY = document.getElementById('wmYVal');
    if (slY) slY.value = yPct;
    if (inY) inY.value = yPct;
    if (valY) valY.textContent = `${yPct}%`;

    // Opacity
    const opPct = Math.round((this.watermark.opacity ?? 0.6) * 100);
    const slOp = document.getElementById('sliderWatermarkOpacity');
    const valOp = document.getElementById('watermarkOpacityVal');
    if (slOp) slOp.value = opPct;
    if (valOp) valOp.textContent = `${opPct}%`;
  }

  saveWatermarkBranding(showToast = false) {
    try {
      localStorage.setItem('ads_watermark_brand_default_v1', JSON.stringify({
        enabled: this.watermark.enabled,
        text: this.watermark.text,
        fontFamily: this.watermark.fontFamily || 'Outfit',
        fontSize: this.watermark.fontSize || 24,
        color: this.watermark.color || '#ffffff',
        opacity: this.watermark.opacity !== undefined ? this.watermark.opacity : 0.65,
        style: this.watermark.style || 'clean_glow',
        pillColor: this.watermark.pillColor || '#000000',
        nx: this.watermark.nx ?? 0.5,
        ny: this.watermark.ny ?? 0.97
      }));
      if (showToast) {
        this.showToast('✨ Channel watermark saved as permanent default!', 'success');
      }
    } catch (e) {
      console.warn('Failed to save default watermark branding:', e);
    }
  }

  async restoreCustomBackgroundFromStorage() {
    try {
      if (window.storageManager) {
        const allBgs = await window.storageManager.getAllItems('backgrounds');
        const activeBg = allBgs.find(b => b.id === 'current_active_bg') || allBgs[allBgs.length - 1];
        if (activeBg) {
          if (activeBg.type === 'video' || activeBg.blob) {
            await this.loadVideoBackground(activeBg.blob, activeBg.name || 'custom_video');
            return;
          } else if (activeBg.dataUrl) {
            this.loadBackground(activeBg.dataUrl, 'custom_bg');
            return;
          }
        }
      }
    } catch (e) {
      console.warn('Error restoring custom backdrop:', e);
    }
    // Safe fallback if not found
    this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');
  }

  // =========================================================================
  // LOCAL STORAGE PERSISTENCE (AUTO-SAVE & RESTORE)
  // =========================================================================

  saveStateToLocalStorage() {
    try {
      const state = {
        version: 2,
        savedAt: Date.now(),
        aspectRatio: this.aspectRatio,
        resolutionPreset: this.resolutionPreset,
        bitrate: this.bitrate,
        fps: this.fps,
        videoDuration: this.videoDuration,
        appendRevealEnding: !!this.appendRevealEnding,
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
          isLoaded: !!this.bg.isLoaded,
          presetId: this.bg.presetId,
          type: this.bg.type || 'image',
          isVideo: !!this.bg.isVideo,
          hasCustomBg: this.bg.presetId === 'custom_bg' || this.bg.presetId === 'custom_video',
          zoom: this.bg.zoom ?? 1.0,
          panX: this.bg.panX ?? 0,
          panY: this.bg.panY ?? 0,
          brightness: this.bg.brightness ?? 100,
          contrast: this.bg.contrast ?? 100,
          saturation: this.bg.saturation ?? 100
        },
        title: {
          text: this.title.text,
          autoSyncCount: !!this.title.autoSyncCount,
          subtitle: this.title.subtitle,
          showSubtitle: !!this.title.showSubtitle,
          style: this.title.style || 'viral_bold',
          fontFamily: this.title.fontFamily || 'Outfit',
          fontSize: this.title.fontSize || 64,
          textColor: this.title.textColor || '#ffffff',
          strokeColor: this.title.strokeColor || '#000000',
          strokeWidth: this.title.strokeWidth !== undefined ? this.title.strokeWidth : 10,

          // Main Title Background Box
          bgEnabled: !!this.title.bgEnabled,
          bgColor: this.title.bgColor || '#0f172a',
          bgOpacity: this.title.bgOpacity !== undefined ? this.title.bgOpacity : 0.85,
          bgRadius: this.title.bgRadius !== undefined ? this.title.bgRadius : 16,
          bgPaddingX: this.title.bgPaddingX !== undefined ? this.title.bgPaddingX : 36,
          bgPaddingY: this.title.bgPaddingY !== undefined ? this.title.bgPaddingY : 16,
          bgBorderColor: this.title.bgBorderColor || '#6366f1',
          bgBorderWidth: this.title.bgBorderWidth !== undefined ? this.title.bgBorderWidth : 0,
          bgBorderOpacity: this.title.bgBorderOpacity !== undefined ? this.title.bgBorderOpacity : 1.0,

          // Main Title Advanced Effects
          gradientEnabled: !!this.title.gradientEnabled,
          gradientColor1: this.title.gradientColor1 || '#ff7a00',
          gradientColor2: this.title.gradientColor2 || '#f43f5e',
          glowEnabled: !!this.title.glowEnabled,
          glowColor: this.title.glowColor || '#06b6d4',
          glowIntensity: this.title.glowIntensity !== undefined ? this.title.glowIntensity : 20,
          shadowColor: this.title.shadowColor || '#000000',
          shadowBlur: this.title.shadowBlur !== undefined ? this.title.shadowBlur : 14,
          shadowOffsetY: this.title.shadowOffsetY !== undefined ? this.title.shadowOffsetY : 6,

          // Subtitle Typography & Effects
          subtitleFontFamily: this.title.subtitleFontFamily || 'inherit',
          subtitleFontSize: this.title.subtitleFontSize || 28,
          subtitleColor: this.title.subtitleColor || '#fde047',
          subtitleStrokeColor: this.title.subtitleStrokeColor || '#000000',
          subtitleStrokeWidth: this.title.subtitleStrokeWidth !== undefined ? this.title.subtitleStrokeWidth : 4,
          subtitleAllCaps: !!this.title.subtitleAllCaps,
          subtitleGlowEnabled: !!this.title.subtitleGlowEnabled,
          subtitleGlowColor: this.title.subtitleGlowColor || '#fde047',
          subtitleShadowBlur: this.title.subtitleShadowBlur !== undefined ? this.title.subtitleShadowBlur : 6,
          subtitleShadowOffsetY: this.title.subtitleShadowOffsetY !== undefined ? this.title.subtitleShadowOffsetY : 3,

          // Subtitle Background Box / Pill
          subtitleStyle: this.title.subtitleStyle || 'pill_glass',
          subtitleBgEnabled: this.title.subtitleBgEnabled !== false,
          subtitlePillColor: this.title.subtitlePillColor || '#000000',
          subtitleBgColor: this.title.subtitleBgColor || '#000000',
          subtitleBgOpacity: this.title.subtitleBgOpacity !== undefined ? this.title.subtitleBgOpacity : 0.75,
          subtitleBgRadius: this.title.subtitleBgRadius !== undefined ? this.title.subtitleBgRadius : 10,
          subtitleBgPaddingX: this.title.subtitleBgPaddingX !== undefined ? this.title.subtitleBgPaddingX : 20,
          subtitleBgPaddingY: this.title.subtitleBgPaddingY !== undefined ? this.title.subtitleBgPaddingY : 8,
          subtitleBorderColor: this.title.subtitleBorderColor || '#ffffff',
          subtitleBorderWidth: this.title.subtitleBorderWidth !== undefined ? this.title.subtitleBorderWidth : 1.5,
          subtitleBorderOpacity: this.title.subtitleBorderOpacity !== undefined ? this.title.subtitleBorderOpacity : 0.3,
          showSubtitlePill: this.title.showSubtitlePill !== false,

          gap: this.title.gap !== undefined ? this.title.gap : 40,
          nx: this.title.nx ?? 0.5,
          ny: this.title.ny ?? 0.11
        },
        timer: {
          enabled: !!this.timer.enabled,
          style: this.timer.style,
          size: this.timer.size,
          nx: this.timer.nx,
          ny: this.timer.ny,
          duration: this.timer.duration
        },
        watermark: {
          enabled: !!this.watermark.enabled,
          text: this.watermark.text,
          fontFamily: this.watermark.fontFamily || 'Outfit',
          fontSize: this.watermark.fontSize || 24,
          color: this.watermark.color || '#ffffff',
          opacity: this.watermark.opacity !== undefined ? this.watermark.opacity : 0.65,
          style: this.watermark.style || 'clean_glow',
          pillColor: this.watermark.pillColor || '#000000',
          nx: this.watermark.nx ?? 0.5,
          ny: this.watermark.ny ?? 0.97
        },
        audio: {
          presetTrack: document.getElementById('selectPresetTrack')?.value || 'quack_hop'
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
        if (stripped.bg) {
          delete stripped.bg.customUrl;
          delete stripped.bg.src;
        }
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
        if (s.bitrate === 'auto' || isNaN(s.bitrate) || Number(s.bitrate) <= 100) {
          this.bitrate = 'auto';
        } else {
          this.bitrate = parseInt(s.bitrate);
        }
        const bitSelect = document.getElementById('selectBitrate');
        if (bitSelect) {
          if (this.bitrate === 'auto') {
            bitSelect.value = 'auto';
          } else {
            bitSelect.value = String(this.bitrate);
          }
        }
        const bitVal = document.getElementById('exportBitrateVal');
        if (bitVal) {
          if (this.bitrate === 'auto') {
            bitVal.textContent = 'Smart Auto';
          } else {
            const mbps = (parseInt(this.bitrate) / 1000000).toFixed(1).replace('.0', '');
            bitVal.textContent = `${mbps} Mbps`;
          }
        }
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
      if (s.appendRevealEnding !== undefined) {
        this.appendRevealEnding = !!s.appendRevealEnding;
        const chkReveal = document.getElementById('checkAppendReveal');
        if (chkReveal) chkReveal.checked = this.appendRevealEnding;
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

      const slCount = document.getElementById('sliderAnimalCount');
      const inCount = document.getElementById('inputAnimalCountExact');
      const valCount = document.getElementById('animalCountVal');
      if (slCount) slCount.value = this.animals.length;
      if (inCount) inCount.value = this.animals.length;
      if (valCount) valCount.textContent = this.animals.length;

      // 4. Background
      if (s.bg) {
        this.bg.zoom = s.bg.zoom ?? 1.0;
        this.bg.panX = s.bg.panX ?? 0;
        this.bg.panY = s.bg.panY ?? 0;
        this.bg.brightness = s.bg.brightness ?? 100;
        this.bg.contrast = s.bg.contrast ?? 100;
        this.bg.saturation = s.bg.saturation ?? 100;

        if (s.bg.isVideo || s.bg.presetId === 'custom_video') {
          this.restoreCustomBackgroundFromStorage();
        } else if (s.bg.presetId === 'custom_bg' || s.bg.hasCustomBg || s.bg.customUrl) {
          if (s.bg.customUrl && s.bg.customUrl.startsWith('data:')) {
            this.loadBackground(s.bg.customUrl, 'custom_bg');
          } else {
            this.restoreCustomBackgroundFromStorage();
          }
        } else if (s.bg.presetId && s.bg.presetId !== 'custom_bg' && s.bg.presetId !== 'custom_video') {
          this.loadBackground(`assets/backgrounds/${s.bg.presetId}.jpg`, s.bg.presetId);
        } else if (s.bg.src && !s.bg.src.startsWith('data:') && !s.bg.src.includes('custom_bg')) {
          this.loadBackground(s.bg.src, null);
        } else {
          this.loadBackground('assets/backgrounds/rustic_water_village.jpg', 'rustic_water_village');
        }

        this.syncBackgroundUI();
      }

      // 5. Title
      if (s.title) {
        this.title.text = s.title.text ?? this.title.text;
        this.title.autoSyncCount = s.title.autoSyncCount !== undefined ? !!s.title.autoSyncCount : this.title.autoSyncCount;
        this.title.subtitle = s.title.subtitle ?? this.title.subtitle;
        this.title.showSubtitle = s.title.showSubtitle !== undefined ? !!s.title.showSubtitle : this.title.showSubtitle;
        this.title.style = s.title.style ?? this.title.style;
        this.title.fontFamily = s.title.fontFamily ?? this.title.fontFamily;
        this.title.fontSize = s.title.fontSize ?? (s.title.size ?? this.title.fontSize);
        this.title.textColor = s.title.textColor ?? (s.title.color ?? this.title.textColor);
        this.title.strokeColor = s.title.strokeColor ?? this.title.strokeColor;
        this.title.strokeWidth = s.title.strokeWidth !== undefined ? s.title.strokeWidth : this.title.strokeWidth;

        // Main Title Background Box
        this.title.bgEnabled = s.title.bgEnabled !== undefined ? !!s.title.bgEnabled : this.title.bgEnabled;
        this.title.bgColor = s.title.bgColor ?? this.title.bgColor;
        this.title.bgOpacity = s.title.bgOpacity !== undefined ? s.title.bgOpacity : this.title.bgOpacity;
        this.title.bgRadius = s.title.bgRadius !== undefined ? s.title.bgRadius : this.title.bgRadius;
        this.title.bgPaddingX = s.title.bgPaddingX !== undefined ? s.title.bgPaddingX : this.title.bgPaddingX;
        this.title.bgPaddingY = s.title.bgPaddingY !== undefined ? s.title.bgPaddingY : this.title.bgPaddingY;
        this.title.bgBorderColor = s.title.bgBorderColor ?? this.title.bgBorderColor;
        this.title.bgBorderWidth = s.title.bgBorderWidth !== undefined ? s.title.bgBorderWidth : this.title.bgBorderWidth;
        this.title.bgBorderOpacity = s.title.bgBorderOpacity !== undefined ? s.title.bgBorderOpacity : this.title.bgBorderOpacity;

        // Main Title Advanced Effects
        this.title.gradientEnabled = s.title.gradientEnabled !== undefined ? !!s.title.gradientEnabled : this.title.gradientEnabled;
        this.title.gradientColor1 = s.title.gradientColor1 ?? this.title.gradientColor1;
        this.title.gradientColor2 = s.title.gradientColor2 ?? this.title.gradientColor2;
        this.title.glowEnabled = s.title.glowEnabled !== undefined ? !!s.title.glowEnabled : this.title.glowEnabled;
        this.title.glowColor = s.title.glowColor ?? this.title.glowColor;
        this.title.glowIntensity = s.title.glowIntensity !== undefined ? s.title.glowIntensity : this.title.glowIntensity;
        this.title.shadowColor = s.title.shadowColor ?? this.title.shadowColor;
        this.title.shadowBlur = s.title.shadowBlur !== undefined ? s.title.shadowBlur : this.title.shadowBlur;
        this.title.shadowOffsetY = s.title.shadowOffsetY !== undefined ? s.title.shadowOffsetY : this.title.shadowOffsetY;

        // Subtitle Typography & Effects
        this.title.subtitleFontFamily = s.title.subtitleFontFamily ?? this.title.subtitleFontFamily;
        this.title.subtitleFontSize = s.title.subtitleFontSize ?? this.title.subtitleFontSize;
        this.title.subtitleColor = s.title.subtitleColor ?? this.title.subtitleColor;
        this.title.subtitleStrokeColor = s.title.subtitleStrokeColor ?? this.title.subtitleStrokeColor;
        this.title.subtitleStrokeWidth = s.title.subtitleStrokeWidth !== undefined ? s.title.subtitleStrokeWidth : this.title.subtitleStrokeWidth;
        this.title.subtitleAllCaps = s.title.subtitleAllCaps !== undefined ? !!s.title.subtitleAllCaps : this.title.subtitleAllCaps;
        this.title.subtitleGlowEnabled = s.title.subtitleGlowEnabled !== undefined ? !!s.title.subtitleGlowEnabled : this.title.subtitleGlowEnabled;
        this.title.subtitleGlowColor = s.title.subtitleGlowColor ?? this.title.subtitleGlowColor;
        this.title.subtitleShadowBlur = s.title.subtitleShadowBlur !== undefined ? s.title.subtitleShadowBlur : this.title.subtitleShadowBlur;
        this.title.subtitleShadowOffsetY = s.title.subtitleShadowOffsetY !== undefined ? s.title.subtitleShadowOffsetY : this.title.subtitleShadowOffsetY;

        // Subtitle Background Box / Pill
        this.title.subtitleStyle = s.title.subtitleStyle || this.title.subtitleStyle || 'pill_glass';
        this.title.subtitleBgEnabled = s.title.subtitleBgEnabled !== undefined ? !!s.title.subtitleBgEnabled : this.title.subtitleBgEnabled;
        this.title.subtitlePillColor = s.title.subtitlePillColor ?? this.title.subtitlePillColor;
        this.title.subtitleBgColor = s.title.subtitleBgColor ?? (s.title.subtitlePillColor ?? this.title.subtitleBgColor);
        this.title.subtitleBgOpacity = s.title.subtitleBgOpacity !== undefined ? s.title.subtitleBgOpacity : this.title.subtitleBgOpacity;
        this.title.subtitleBgRadius = s.title.subtitleBgRadius !== undefined ? s.title.subtitleBgRadius : this.title.subtitleBgRadius;
        this.title.subtitleBgPaddingX = s.title.subtitleBgPaddingX !== undefined ? s.title.subtitleBgPaddingX : this.title.subtitleBgPaddingX;
        this.title.subtitleBgPaddingY = s.title.subtitleBgPaddingY !== undefined ? s.title.subtitleBgPaddingY : this.title.subtitleBgPaddingY;
        this.title.subtitleBorderColor = s.title.subtitleBorderColor ?? this.title.subtitleBorderColor;
        this.title.subtitleBorderWidth = s.title.subtitleBorderWidth !== undefined ? s.title.subtitleBorderWidth : this.title.subtitleBorderWidth;
        this.title.subtitleBorderOpacity = s.title.subtitleBorderOpacity !== undefined ? s.title.subtitleBorderOpacity : this.title.subtitleBorderOpacity;
        this.title.showSubtitlePill = s.title.showSubtitlePill !== undefined ? !!s.title.showSubtitlePill : this.title.showSubtitlePill;

        this.title.gap = s.title.gap ?? this.title.gap;
        this.title.nx = s.title.nx ?? this.title.nx;
        this.title.ny = s.title.ny ?? this.title.ny;

        if (this.title.autoSyncCount) {
          this.updateTitleCount();
        }

        this.syncTitleUI();
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
        this.watermark.fontFamily = s.watermark.fontFamily ?? this.watermark.fontFamily;
        this.watermark.fontSize = s.watermark.fontSize ?? this.watermark.fontSize;
        this.watermark.color = s.watermark.color ?? this.watermark.color;
        this.watermark.opacity = s.watermark.opacity !== undefined ? s.watermark.opacity : this.watermark.opacity;
        this.watermark.style = s.watermark.style ?? this.watermark.style;
        this.watermark.pillColor = s.watermark.pillColor ?? this.watermark.pillColor;
        this.watermark.nx = s.watermark.nx ?? this.watermark.nx;
        this.watermark.ny = s.watermark.ny ?? this.watermark.ny;
      }
      try {
        const savedBrand = localStorage.getItem('ads_watermark_brand_default_v1');
        if (savedBrand) {
          const parsed = JSON.parse(savedBrand);
          if (!s.watermark) {
            Object.assign(this.watermark, parsed);
          }
        }
      } catch (err) {}
      this.syncWatermarkUI();

      // 8. Audio
      if (s.audio && s.audio.presetTrack) {
        const selAudio = document.getElementById('selectPresetTrack');
        if (selAudio) {
          selAudio.value = s.audio.presetTrack;
          const badge = document.getElementById('currentTrackBadge');
          if (badge) badge.textContent = s.audio.presetTrack.replace('_', ' ').toUpperCase();
        }
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
    this.bitrate = 'auto';
    const bSel = document.getElementById('selectBitrate');
    if (bSel) bSel.value = 'auto';
    const bVal = document.getElementById('exportBitrateVal');
    if (bVal) bVal.textContent = 'Smart Auto';

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
    this.bitrate = 'auto';
    const bSel = document.getElementById('selectBitrate');
    if (bSel) bSel.value = 'auto';
    const bVal = document.getElementById('exportBitrateVal');
    if (bVal) bVal.textContent = 'Smart Auto';
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
function initStudio() {
  if (!window.studio) {
    window.studio = new AnimalDanceStudio();
  }
}
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initStudio);
} else {
  initStudio();
}
