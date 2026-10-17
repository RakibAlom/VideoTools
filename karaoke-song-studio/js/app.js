/**
 * Karaoke Video Studio 2.0 - Master Application Coordinator
 * Features:
 * 1. Independent Canvas Drag & Drop for Main Title and Sub-Title with 10 Presets
 * 2. Visual Video Crop & Framing with Interactive Canvas Handles, Pan & Wheel Zoom
 * 3. Bulletproof Play / Pause Engine with Synchronized Overlays & Spacebar Shortcut
 * 4. Multi-Format Subtitle Import (SRT, VTT, YouTube SBV, YouTube Transcript, LRC, TXT)
 * 5. Procedural Dynamic Backgrounds, Vocal Backing Track Processor & Anti-Copyright DSP
 * 6. High-Performance 60fps WebM/MP4 Canvas Recording
 * 100% Clean ASCII - Zero Python
 */

class KaraokeApp {
  constructor() {
    this.canvas = document.getElementById('previewCanvas') || document.getElementById('karaokeCanvas');
    this.audio = typeof AudioEngine !== 'undefined' ? new AudioEngine() : (typeof KaraokeAudioEngine !== 'undefined' ? new KaraokeAudioEngine() : null);
    this.lyrics = typeof LyricsEngine !== 'undefined' ? new LyricsEngine() : (typeof KaraokeLyricsEngine !== 'undefined' ? new KaraokeLyricsEngine() : null);
    this.renderer = new KaraokeRenderer(this.canvas);

    // Canvas Pointer Interaction State
    this.isDraggingTitle = false;
    this.isDraggingSubtitle = false;
    this.isDraggingCrop = false;
    this.activeCropHandle = null;

    this.dragStartPos = { x: 0, y: 0 };
    this.dragStartTitle = { nx: 0.5, ny: 0.12 };
    this.dragStartSubtitle = { nx: 0.5, ny: 0.19 };
    this.cropDragStart = { x: 0, y: 0, panX: 0, panY: 0, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 };

    this.isScrubbing = false;

    // Undo / Redo History Stack
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 20;

    // Export Pipeline State
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isExporting = false;
    this.exportBlob = null;

    // Local Storage & IndexedDB Manager
    this.storage = typeof KaraokeStorageManager !== 'undefined' ? new KaraokeStorageManager() : null;
    this.transcriber = typeof KaraokeAITranscriber !== 'undefined' ? new KaraokeAITranscriber(this.audio, this.lyrics) : null;
  }

  async init() {
    this.initElements();
    this.setupCanvasInteractions();
    this.setupEventListeners();

    // Listen to Lyrics Engine updates
    this.lyrics.onChange = () => {
      this.renderLyricsList();
    };

    // Listen to Audio state changes for Play/Pause buttons and Video sync
    this.audio.onStateChange = (isPlaying) => {
      this.updatePlayButtonState(isPlaying);
      if (this.renderer.bgVideo) {
        if (isPlaying) {
          this.renderer.bgVideo.play().catch(() => {});
        } else {
          this.renderer.bgVideo.pause();
        }
      }
    };

    // Initialize IndexedDB Storage
    if (this.storage) {
      try {
        await this.storage.init();
      } catch (err) {
        console.warn('Storage init warning:', err);
      }
    }

    // 1. Restore saved studio settings from localStorage
    const hasSavedSettings = this.restoreSettingsFromLocalStorage();

    // 2. Restore saved custom background media from IndexedDB
    await this.restoreCustomBgMedia();

    // 3. Restore saved custom audio from IndexedDB
    const restoredAudio = await this.restoreCustomAudio();

    // 4. Restore saved custom lyrics / subtitles
    const restoredLyrics = await this.restoreSavedLyrics();

    // If no custom audio was restored, load studio demo track
    if (!restoredAudio) {
      await this.loadDemoPreset(this.renderer.theme || 'spotify_clean', hasSavedSettings);
    }

    // If no custom lyrics were restored, populate default studio lyrics
    if (!restoredLyrics && this.lyrics.getLines().length === 0) {
      this.lyrics.setLines([
        { id: 'sp_1', text: "Step on the floor and feel the bass", start: 0.8, end: 4.6 },
        { id: 'sp_2', text: "A funky smile upon your face", start: 5.0, end: 9.0 },
        { id: 'sp_3', text: "Sing every word into the mic tonight", start: 9.4, end: 14.0 },
        { id: 'sp_4', text: "Everything is gonna feel so bright", start: 14.4, end: 19.5 }
      ]);
    }

    this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
    this.renderLyricsList();
    this.drawWaveform();
    this.adjustStageZoom();

    // Start 60fps render loop
    this.startRenderLoop();

    // Check local server & FFmpeg status
    this.checkServerStatus();

    console.log('Karaoke Song Studio 2.0 initialized successfully!');
  }

  initElements() {
    // Playback Transport
    this.btnPlay = document.getElementById('btnPlay');
    this.btnRestart = document.getElementById('btnRestart');
    this.btnLoop = document.getElementById('btnLoop');
    this.timelineSlider = document.getElementById('timelineSlider');
    this.timeCurrentEl = document.getElementById('timeCurrent');
    this.timeTotalEl = document.getElementById('timeTotal');
    this.canvasOverlayPlay = document.getElementById('canvasOverlayPlay');

    // Title UI
    this.checkShowTitle = document.getElementById('checkShowTitle');
    this.inputTitleText = document.getElementById('inputTitleText');
    this.titleStyleSelect = document.getElementById('titleStyleSelect');
    this.titleFontSizeSlider = document.getElementById('titleFontSizeSlider');
    this.titleRotationSlider = document.getElementById('titleRotationSlider');
    this.titleXSlider = document.getElementById('titleXSlider');
    this.titleYSlider = document.getElementById('titleYSlider');
    this.titleColorInput = document.getElementById('titleColorInput');
    this.titleGlowInput = document.getElementById('titleGlowInput');
    this.btnCenterTitle = document.getElementById('btnCenterTitle');

    // Subtitle UI
    this.checkShowSubtitle = document.getElementById('checkShowSubtitle');
    this.inputSubtitleText = document.getElementById('inputSubtitleText');
    this.checkSubPillBg = document.getElementById('checkSubPillBg');
    this.subFontSizeSlider = document.getElementById('subFontSizeSlider');
    this.subColorInput = document.getElementById('subColorInput');
    this.subXSlider = document.getElementById('subXSlider');
    this.subYSlider = document.getElementById('subYSlider');
    this.btnCenterSubtitle = document.getElementById('btnCenterSubtitle');

    // Visual Crop UI
    this.btnToggleCrop = document.getElementById('btnToggleCrop');
    this.btnToggleCropInline = document.getElementById('btnToggleCropInline');
    this.cropScaleSlider = document.getElementById('cropScaleSlider');
    this.cropScaleVal = document.getElementById('cropScaleVal');
    this.cropPanXSlider = document.getElementById('cropPanXSlider');
    this.cropPanYSlider = document.getElementById('cropPanYSlider');
    this.cropLeftSlider = document.getElementById('cropLeftSlider');
    this.cropRightSlider = document.getElementById('cropRightSlider');
    this.cropTopSlider = document.getElementById('cropTopSlider');
    this.cropBottomSlider = document.getElementById('cropBottomSlider');

    // Audio & Waveform
    this.trimStartInput = document.getElementById('trimStart');
    this.trimEndInput = document.getElementById('trimEnd');
    this.trimDurationEl = document.getElementById('trimDuration');
    this.waveformCanvas = document.getElementById('waveformCanvas');
    this.checkAutoCropLyrics = document.getElementById('checkAutoCropLyrics');
    this.btnToggleMuteSinger = document.getElementById('btnToggleMuteSinger');
    this.btnToggleMuteSingerText = document.getElementById('btnToggleMuteSingerText');
    this.vocalDetectBadge = document.getElementById('vocalDetectBadge');
    this.vocalStatusIndicator = document.getElementById('vocalStatusIndicator');
    this.vocalAttenuationSlider = document.getElementById('vocalAttenuationSlider');
    this.vocalAttenVal = document.getElementById('vocalAttenVal');

    // Studio Audio FX Rack Elements
    this.pitchSlider = document.getElementById('pitchSlider');
    this.pitchVal = document.getElementById('pitchVal');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedVal = document.getElementById('speedVal');
    this.bassBoostSlider = document.getElementById('bassBoostSlider');
    this.bassBoostVal = document.getElementById('bassBoostVal');
    this.trebleSlider = document.getElementById('trebleSlider');
    this.trebleVal = document.getElementById('trebleVal');
    this.echoWetSlider = document.getElementById('echoWetSlider');
    this.echoWetVal = document.getElementById('echoWetVal');
    this.stereoWidthSlider = document.getElementById('stereoWidthSlider');
    this.stereoWidthVal = document.getElementById('stereoWidthVal');
    this.reverbWetSlider = document.getElementById('reverbWetSlider');
    this.reverbWetVal = document.getElementById('reverbWetVal');
    this.btnResetFX = document.getElementById('btnResetFX');

    // Extended Font & Mix Selectors
    this.titleFontFamilySelect = document.getElementById('titleFontFamilySelect');
    this.subFontFamilySelect = document.getElementById('subFontFamilySelect');
    this.vocalMixSlider = document.getElementById('vocalMixSlider');
    this.vocalMixVal = document.getElementById('vocalMixVal');
    this.lofiWarmthSlider = document.getElementById('lofiWarmthSlider');
    this.lofiWarmthVal = document.getElementById('lofiWarmthVal');
    this.spatial8DSlider = document.getElementById('spatial8DSlider');
    this.spatial8DVal = document.getElementById('spatial8DVal');
    this.radioFilterSlider = document.getElementById('radioFilterSlider');
    this.radioFilterVal = document.getElementById('radioFilterVal');
    this.btnAlignLyricsStart = document.getElementById('btnAlignLyricsStart');
    this.btnFitLyricsDuration = document.getElementById('btnFitLyricsDuration');
    this.checkImportAutoAlign = document.getElementById('checkImportAutoAlign');
    this.checkImportFitDuration = document.getElementById('checkImportFitDuration');

    // Lyrics UI
    this.lyricsListEl = document.getElementById('lyricsList');
    this.lyricsCountEl = document.getElementById('lyricsCount');

    // Export UI
    this.exportProgressFill = document.getElementById('exportProgressFill');
    this.exportStatusText = document.getElementById('exportStatusText');
    this.exportVideoPlayer = document.getElementById('exportVideoPlayer');
    this.btnDownloadVideo = document.getElementById('btnDownloadVideo');
  }

  startRenderLoop() {
    const loop = () => {
      const currentTime = this.audio.getCurrentTime();

      this.updatePlaybackUI(currentTime);
      this.renderer.render(currentTime, this.lyrics.getLines(), this.audio.analyser);

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updatePlaybackUI(curTime) {
    if (this.timelineSlider && !this.isScrubbing) {
      const start = this.audio.trimStart;
      const end = this.audio.trimEnd;
      const duration = Math.max(0.1, end - start);
      const progress = Math.max(0, Math.min(1.0, (curTime - start) / duration));
      this.timelineSlider.value = (progress * 1000).toFixed(0);
    }

    const formatTime = (s) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      const ms = Math.floor((s % 1) * 10);
      return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`;
    };

    if (this.timeCurrentEl) this.timeCurrentEl.textContent = formatTime(curTime);
    if (this.timeTotalEl) this.timeTotalEl.textContent = formatTime(this.audio.trimEnd);

    // Sync background video if present
    if (this.renderer.bgVideo && !this.isScrubbing && this.renderer.bgVideo.duration) {
      const vidCur = curTime % this.renderer.bgVideo.duration;
      if (Math.abs(this.renderer.bgVideo.currentTime - vidCur) > 0.35) {
        this.renderer.bgVideo.currentTime = vidCur;
      }
    }
  }

  updatePlayButtonState(isPlaying) {
    if (this.btnPlay) {
      if (isPlaying) {
        this.btnPlay.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> <span>Pause</span>';
        this.btnPlay.classList.add('playing');
      } else {
        this.btnPlay.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="8 5 19 12 8 19 8 5"/></svg> <span>Play</span>';
        this.btnPlay.classList.remove('playing');
      }
    }

    if (this.canvasOverlayPlay) {
      this.canvasOverlayPlay.classList.toggle('playing', isPlaying);
    }
  }

  /**
   * Interactive Canvas Pointer Interactions:
   * 1. Draggable Main Title
   * 2. Draggable Sub-Title
   * 3. Draggable Crop Gizmo (Resize Edges/Corners, Pan, Wheel Zoom)
   * 4. Click Preview to Play / Pause
   */
  setupCanvasInteractions() {
    if (!this.canvas) return;

    const getCanvasCoords = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    let pointerDownTime = 0;
    let pointerDownPos = { x: 0, y: 0 };
    let didDrag = false;

    // POINTER MOVE
    const onPointerMove = (e) => {
      const pos = getCanvasCoords(e);

      if (Math.hypot(pos.x - pointerDownPos.x, pos.y - pointerDownPos.y) > 6) {
        didDrag = true;
      }

      // 1. If dragging Crop
      if (this.isDraggingCrop && this.activeCropHandle) {
        const dxPercent = ((pos.x - this.cropDragStart.x) / this.canvas.width) * 100;
        const dyPercent = ((pos.y - this.cropDragStart.y) / this.canvas.height) * 100;

        switch (this.activeCropHandle) {
          case 'inside':
            this.renderer.crop.panX = Math.max(-50, Math.min(50, Math.round(this.cropDragStart.panX + dxPercent)));
            this.renderer.crop.panY = Math.max(-50, Math.min(50, Math.round(this.cropDragStart.panY + dyPercent)));
            break;
          case 'top-left':
            this.renderer.crop.cropLeft = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropLeft + dxPercent)));
            this.renderer.crop.cropTop = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropTop + dyPercent)));
            break;
          case 'top-right':
            this.renderer.crop.cropRight = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropRight - dxPercent)));
            this.renderer.crop.cropTop = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropTop + dyPercent)));
            break;
          case 'bottom-left':
            this.renderer.crop.cropLeft = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropLeft + dxPercent)));
            this.renderer.crop.cropBottom = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropBottom - dyPercent)));
            break;
          case 'bottom-right':
            this.renderer.crop.cropRight = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropRight - dxPercent)));
            this.renderer.crop.cropBottom = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropBottom - dyPercent)));
            break;
          case 'left':
            this.renderer.crop.cropLeft = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropLeft + dxPercent)));
            break;
          case 'right':
            this.renderer.crop.cropRight = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropRight - dxPercent)));
            break;
          case 'top':
            this.renderer.crop.cropTop = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropTop + dyPercent)));
            break;
          case 'bottom':
            this.renderer.crop.cropBottom = Math.max(0, Math.min(45, Math.round(this.cropDragStart.cropBottom - dyPercent)));
            break;
        }
        this.updateCropUIFromState();
        return;
      }

      // 2. If dragging Title
      if (this.isDraggingTitle) {
        const dx = (pos.x - this.dragStartPos.x) / this.canvas.width;
        const dy = (pos.y - this.dragStartPos.y) / this.canvas.height;
        this.renderer.title.nx = Math.max(0.08, Math.min(0.92, this.dragStartTitle.nx + dx));
        this.renderer.title.ny = Math.max(0.04, Math.min(0.96, this.dragStartTitle.ny + dy));

        if (this.titleXSlider) this.titleXSlider.value = Math.round(this.renderer.title.nx * 100);
        if (this.titleYSlider) this.titleYSlider.value = Math.round(this.renderer.title.ny * 100);
        return;
      }

      // 3. If dragging Subtitle
      if (this.isDraggingSubtitle) {
        const dx = (pos.x - this.dragStartPos.x) / this.canvas.width;
        const dy = (pos.y - this.dragStartPos.y) / this.canvas.height;
        this.renderer.subtitle.nx = Math.max(0.08, Math.min(0.92, this.dragStartSubtitle.nx + dx));
        this.renderer.subtitle.ny = Math.max(0.04, Math.min(0.96, this.dragStartSubtitle.ny + dy));

        if (this.subXSlider) this.subXSlider.value = Math.round(this.renderer.subtitle.nx * 100);
        if (this.subYSlider) this.subYSlider.value = Math.round(this.renderer.subtitle.ny * 100);
        return;
      }

      // 4. Hover cursor updates
      if (this.renderer.cropModeActive) {
        const handle = this.renderer.hitTestCropHandle(pos.x, pos.y);
        if (handle === 'top-left' || handle === 'bottom-right') {
          this.canvas.style.cursor = 'nwse-resize';
        } else if (handle === 'top-right' || handle === 'bottom-left') {
          this.canvas.style.cursor = 'nesw-resize';
        } else if (handle === 'top' || handle === 'bottom') {
          this.canvas.style.cursor = 'ns-resize';
        } else if (handle === 'left' || handle === 'right') {
          this.canvas.style.cursor = 'ew-resize';
        } else if (handle === 'inside') {
          this.canvas.style.cursor = 'move';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
        return;
      }

      if (this.renderer.hitTestSubtitle(pos.x, pos.y)) {
        this.canvas.style.cursor = 'grab';
      } else if (this.renderer.hitTestTitle(pos.x, pos.y)) {
        this.canvas.style.cursor = 'grab';
      } else {
        this.canvas.style.cursor = 'default';
      }
    };

    // POINTER DOWN
    const onPointerDown = (e) => {
      const pos = getCanvasCoords(e);
      pointerDownTime = performance.now();
      pointerDownPos = pos;
      didDrag = false;

      // In Crop Mode
      if (this.renderer.cropModeActive) {
        const handle = this.renderer.hitTestCropHandle(pos.x, pos.y);
        if (handle) {
          this.isDraggingCrop = true;
          this.activeCropHandle = handle;
          this.cropDragStart = {
            x: pos.x,
            y: pos.y,
            panX: this.renderer.crop.panX,
            panY: this.renderer.crop.panY,
            cropLeft: this.renderer.crop.cropLeft,
            cropRight: this.renderer.crop.cropRight,
            cropTop: this.renderer.crop.cropTop,
            cropBottom: this.renderer.crop.cropBottom
          };
          this.canvas.style.cursor = (handle === 'inside') ? 'grabbing' : 'pointer';
        }
        return;
      }

      // Check Subtitle Hit First
      if (this.renderer.hitTestSubtitle(pos.x, pos.y)) {
        this.isDraggingSubtitle = true;
        this.renderer.isSubtitleSelected = true;
        this.renderer.isTitleSelected = false;
        this.dragStartPos = pos;
        this.dragStartSubtitle = {
          nx: this.renderer.subtitle.nx,
          ny: this.renderer.subtitle.ny
        };
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      // Check Title Hit
      if (this.renderer.hitTestTitle(pos.x, pos.y)) {
        this.isDraggingTitle = true;
        this.renderer.isTitleSelected = true;
        this.renderer.isSubtitleSelected = false;
        this.dragStartPos = pos;
        this.dragStartTitle = {
          nx: this.renderer.title.nx,
          ny: this.renderer.title.ny
        };
        this.canvas.style.cursor = 'grabbing';
        return;
      }

      // Empty space
      this.renderer.isTitleSelected = false;
      this.renderer.isSubtitleSelected = false;
    };

    // POINTER UP
    const onPointerUp = () => {
      const elapsed = performance.now() - pointerDownTime;

      if (this.isDraggingCrop) {
        this.isDraggingCrop = false;
        this.activeCropHandle = null;
        this.saveHistoryState();
      } else if (this.isDraggingTitle) {
        this.isDraggingTitle = false;
        this.canvas.style.cursor = 'grab';
        this.saveHistoryState();
      } else if (this.isDraggingSubtitle) {
        this.isDraggingSubtitle = false;
        this.canvas.style.cursor = 'grab';
        this.saveHistoryState();
      } else if (!didDrag && elapsed < 350 && !this.renderer.cropModeActive) {
        // Clean single click on video preview -> Toggle Play / Pause!
        this.audio.togglePlay();
      }
    };

    // Mouse wheel over canvas in crop mode to zoom
    this.canvas.addEventListener('wheel', (e) => {
      if (this.renderer.cropModeActive) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        this.renderer.crop.scale = Math.max(0.5, Math.min(3.0, Math.round((this.renderer.crop.scale + delta) * 100) / 100));
        this.updateCropUIFromState();
      }
    }, { passive: false });

    this.canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    // Overlay play click
    if (this.canvasOverlayPlay) {
      this.canvasOverlayPlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.audio.togglePlay();
      });
    }
  }

  drawWaveform() {
    if (!this.waveformCanvas) return;
    const canvas = this.waveformCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.offsetWidth || 300;
    const h = canvas.height = canvas.offsetHeight || 55;

    ctx.clearRect(0, 0, w, h);
    const data = this.audio.waveformData;
    if (!data || data.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, h / 2 - 1, w, 2);
      return;
    }

    const barW = w / data.length;
    const trimStartRatio = this.audio.trimStart / Math.max(0.1, this.audio.duration);
    const trimEndRatio = this.audio.trimEnd / Math.max(0.1, this.audio.duration);

    // Background unselected
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, 0, w, h);

    // Highlight selected trim range
    const selX1 = trimStartRatio * w;
    const selX2 = trimEndRatio * w;
    ctx.fillStyle = 'rgba(0, 242, 254, 0.18)';
    ctx.fillRect(selX1, 0, selX2 - selX1, h);

    // Draw audio peaks
    for (let i = 0; i < data.length; i++) {
      const x = i * barW;
      const peak = data[i] * (h / 2);
      const isSelected = (i / data.length) >= trimStartRatio && (i / data.length) <= trimEndRatio;

      ctx.fillStyle = isSelected ? '#00f2fe' : 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(x, h / 2 - peak, Math.max(1, barW - 1), peak * 2);
    }
  }

  renderLyricsList() {
    if (!this.lyricsListEl) return;
    const lines = this.lyrics.getLines();
    if (this.lyricsCountEl) this.lyricsCountEl.textContent = lines.length;

    this.lyricsListEl.innerHTML = '';
    lines.forEach((line, index) => {
      const card = document.createElement('div');
      card.className = 'lyric-card';
      card.dataset.lineId = line.id;

      card.innerHTML = `
        <div class="lyric-card-header">
          <span class="lyric-index">#${index + 1}</span>
          <div class="lyric-time-inputs">
            <input type="number" class="num-input line-start" step="0.1" min="0" value="${line.start.toFixed(1)}" title="Start time (s)">
            <span>to</span>
            <input type="number" class="num-input line-end" step="0.1" min="0" value="${line.end.toFixed(1)}" title="End time (s)">
          </div>
          <div class="lyric-actions">
            <button class="btn-line-action btn-play-line" title="Preview this line"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="8 5 19 12 8 19 8 5"/></svg></button>
            <button class="btn-line-action btn-split-line" title="Split line in half"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg></button>
            <button class="btn-line-action btn-merge-line" title="Merge with next line"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg></button>
            <button class="btn-line-action btn-del-line" title="Delete line"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        </div>
        <input type="text" class="lyric-card-text text-input" value="${line.text.replace(/"/g, '&quot;')}" placeholder="Lyric text...">
      `;

      // Event listeners for card controls
      const textInput = card.querySelector('.lyric-card-text');
      textInput.addEventListener('input', (e) => {
        line.text = e.target.value;
        line.words = this.lyrics.generateWordsForLine(line.text, line.start, line.end);
      });

      const startInput = card.querySelector('.line-start');
      startInput.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value) || 0;
        this.lyrics.updateLineTiming(line.id, val, line.end);
      });

      const endInput = card.querySelector('.line-end');
      endInput.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value) || line.start + 1;
        this.lyrics.updateLineTiming(line.id, line.start, val);
      });

      card.querySelector('.btn-play-line').addEventListener('click', () => {
        this.audio.seek(line.start);
        this.audio.play();
      });

      card.querySelector('.btn-split-line').addEventListener('click', () => {
        this.saveHistoryState();
        this.lyrics.splitLine(line.id);
        this.showToast('Line split into two parts'); this.saveLyricsToStorage();
      });

      card.querySelector('.btn-merge-line').addEventListener('click', () => {
        this.saveHistoryState();
        if (this.lyrics.mergeWithNext(line.id)) {
          this.showToast('Merged line with next'); this.saveLyricsToStorage();
        }
      });

      card.querySelector('.btn-del-line').addEventListener('click', () => {
        this.saveHistoryState();
        this.lyrics.deleteLine(line.id);
        this.showToast('Line removed'); this.saveLyricsToStorage();
      });

      this.lyricsListEl.appendChild(card);
    });
  }

  async loadDemoPreset(demoKey, preserveSettings = false) {
    let savedSettings = null;
    if (preserveSettings) {
      try {
        savedSettings = JSON.parse(localStorage.getItem('karaoke_studio_settings_v2') || 'null');
      } catch (e) {}
    }

    switch (demoKey) {
      case 'spotify_clean':
        this.renderer.applyTheme('spotify_clean');
        this.renderer.setAspectRatio('9:16');
        this.renderer.wipeStyle = 'gradient_wipe';
        this.renderer.fontFamily = 'Montserrat';
        this.renderer.fontSize = 56;
        this.renderer.lyricYPercent = 50;

        this.renderer.title.enabled = false;
        this.renderer.title.text = 'SPOTIFY STUDIO KARAOKE';
        this.renderer.title.style = 'clean_modern';
        this.renderer.title.fontSize = 50;
        this.renderer.title.color = '#ffffff';
        this.renderer.title.glowColor = '#1ed760';
        this.renderer.title.nx = 0.5;
        this.renderer.title.ny = 0.12;

        this.renderer.subtitle.enabled = false;
        this.renderer.subtitle.text = 'VERIFIED ARTIST KARAOKE TRACK';
        this.renderer.subtitle.fontSize = 24;
        this.renderer.subtitle.color = '#1ed760';
        this.renderer.subtitle.nx = 0.5;
        this.renderer.subtitle.ny = 0.19;

        await this.audio.synthesizeSong('midnight_groove');
        this.audio.setVocalMode('instrumental');
        this.updateVocalUI('instrumental');
        this.audio.applyFxPreset('clean_original');

        this.lyrics.setLines([
          { id: 'sp_1', text: "Step on the floor and feel the bass", start: 0.8, end: 4.6 },
          { id: 'sp_2', text: "A funky smile upon your face", start: 5.0, end: 9.0 },
          { id: 'sp_3', text: "Sing every word into the mic tonight", start: 9.4, end: 14.0 },
          { id: 'sp_4', text: "Everything is gonna feel so bright", start: 14.4, end: 19.5 }
        ]);
        break;

      case 'apple_sing':
        this.renderer.applyTheme('apple_sing');
        this.renderer.setAspectRatio('9:16');
        this.renderer.wipeStyle = 'karaoke_gold';
        this.renderer.fontFamily = 'Outfit';
        this.renderer.fontSize = 58;
        this.renderer.lyricYPercent = 50;

        this.renderer.title.enabled = false;
        this.renderer.title.text = 'APPLE MUSIC SING';
        this.renderer.title.style = 'golden_3d';
        this.renderer.title.fontSize = 50;
        this.renderer.title.color = '#ffffff';
        this.renderer.title.glowColor = '#ff3b30';
        this.renderer.title.nx = 0.5;
        this.renderer.title.ny = 0.12;

        this.renderer.subtitle.enabled = false;
        this.renderer.subtitle.text = 'IMMERSIVE VOCAL EXPERIENCE';
        this.renderer.subtitle.fontSize = 24;
        this.renderer.subtitle.color = '#ff9f0a';
        this.renderer.subtitle.nx = 0.5;
        this.renderer.subtitle.ny = 0.19;

        await this.audio.synthesizeSong('starlight');
        this.audio.applyFxPreset('subtle_clean');

        this.lyrics.setLines([
          { id: 'as_1', text: "Underneath the quiet starry sky", start: 0.8, end: 4.5 },
          { id: 'as_2', text: "Watching golden clouds drift by", start: 5.0, end: 9.0 },
          { id: 'as_3', text: "Sing along with every gentle dream", start: 9.6, end: 13.8 },
          { id: 'as_4', text: "Life is sweeter than it seems", start: 14.2, end: 18.8 }
        ]);
        break;
      case 'neon_cyber':
        this.renderer.setAspectRatio('9:16');
        this.renderer.proceduralStyle = 'cyber_grid';
        this.renderer.bgType = 'procedural';
        this.renderer.sungColor = '#00f2fe';
        this.renderer.sungSecondaryColor = '#4facfe';
        this.renderer.glowColor = '#00f2fe';
        this.renderer.wipeStyle = 'gradient_wipe';
        this.renderer.fontFamily = 'Montserrat';
        this.renderer.fontSize = 58;
        this.renderer.lyricYPercent = 52;

        this.renderer.title.enabled = false;
        this.renderer.title.text = 'NEON CYBER DRIVE';
        this.renderer.title.style = 'cyber_neon';
        this.renderer.title.fontSize = 54;
        this.renderer.title.color = '#ffffff';
        this.renderer.title.glowColor = '#00f2fe';
        this.renderer.title.nx = 0.5;
        this.renderer.title.ny = 0.12;

        this.renderer.subtitle.enabled = false;
        this.renderer.subtitle.text = 'CAN YOU SING THIS? DUET CHALLENGE';
        this.renderer.subtitle.fontSize = 24;
        this.renderer.subtitle.color = '#00f2fe';
        this.renderer.subtitle.nx = 0.5;
        this.renderer.subtitle.ny = 0.19;

        await this.audio.synthesizeSong('neon_cyber');
        this.audio.applyFxPreset('subtle_clean');

        this.lyrics.setLines([
          { id: 'nc_1', text: "Driving through the neon city lights", start: 0.5, end: 4.8 },
          { id: 'nc_2', text: "Racing fast into electric nights", start: 5.2, end: 9.6 },
          { id: 'nc_3', text: "Feel the synthwave rhythm in your soul", start: 10.0, end: 14.5 },
          { id: 'nc_4', text: "Music takes complete and full control", start: 15.0, end: 20.2 }
        ]);
        break;

      case 'midnight_groove':
        this.renderer.setAspectRatio('16:9');
        this.renderer.proceduralStyle = 'audio_spectrum';
        this.renderer.bgType = 'procedural';
        this.renderer.sungColor = '#ffd000';
        this.renderer.sungSecondaryColor = '#ff8800';
        this.renderer.glowColor = '#ffd000';
        this.renderer.wipeStyle = 'bouncing_ball';
        this.renderer.fontFamily = 'Outfit';
        this.renderer.fontSize = 64;
        this.renderer.lyricYPercent = 60;

        this.renderer.title.enabled = false;
        this.renderer.title.text = 'MIDNIGHT FUNK GROOVE';
        this.renderer.title.style = 'viral_reel';
        this.renderer.title.fontSize = 56;
        this.renderer.title.color = '#ffd000';
        this.renderer.title.nx = 0.5;
        this.renderer.title.ny = 0.14;

        this.renderer.subtitle.enabled = false;
        this.renderer.subtitle.text = 'SING ALONG WITH THE FUNK';
        this.renderer.subtitle.fontSize = 26;
        this.renderer.subtitle.color = '#ffffff';
        this.renderer.subtitle.nx = 0.5;
        this.renderer.subtitle.ny = 0.23;

        await this.audio.synthesizeSong('midnight_groove');
        this.audio.setVocalMode('instrumental');
        this.updateVocalUI('instrumental');
        this.audio.applyFxPreset('subtle_clean');

        this.lyrics.setLines([
          { id: 'mg_1', text: "Step on the floor and feel the bass", start: 0.6, end: 4.2 },
          { id: 'mg_2', text: "A funky smile upon your face", start: 4.6, end: 8.8 },
          { id: 'mg_3', text: "Everybody dance until the morning light", start: 9.2, end: 13.5 },
          { id: 'mg_4', text: "Everything is gonna be alright", start: 14.0, end: 19.0 }
        ]);
        break;

      case 'starlight':
        this.renderer.setAspectRatio('1:1');
        this.renderer.proceduralStyle = 'starfield';
        this.renderer.bgType = 'procedural';
        this.renderer.sungColor = '#ffd000';
        this.renderer.sungSecondaryColor = '#ff6a00';
        this.renderer.glowColor = '#ffd000';
        this.renderer.wipeStyle = 'karaoke_gold';
        this.renderer.fontFamily = 'Montserrat';
        this.renderer.fontSize = 52;
        this.renderer.lyricYPercent = 55;

        this.renderer.title.enabled = false;
        this.renderer.title.text = 'STARLIGHT SERENADE';
        this.renderer.title.style = 'golden_3d';
        this.renderer.title.fontSize = 50;
        this.renderer.title.nx = 0.5;
        this.renderer.title.ny = 0.13;

        this.renderer.subtitle.enabled = false;
        this.renderer.subtitle.text = 'LO-FI CHILL VOCAL EXPERIENCE';
        this.renderer.subtitle.fontSize = 22;
        this.renderer.subtitle.color = '#ffe066';
        this.renderer.subtitle.nx = 0.5;
        this.renderer.subtitle.ny = 0.21;

        await this.audio.synthesizeSong('starlight');
        this.audio.applyFxPreset('slowed_reverb');

        this.lyrics.setLines([
          { id: 'sl_1', text: "Underneath the quiet starry sky", start: 0.8, end: 4.5 },
          { id: 'sl_2', text: "Watching golden clouds drift by", start: 5.0, end: 9.0 },
          { id: 'sl_3', text: "Sing along with every gentle dream", start: 9.6, end: 13.8 },
          { id: 'sl_4', text: "Life is sweeter than it seems", start: 14.2, end: 18.8 }
        ]);
        break;

      case 'viral_hook':
        this.renderer.setAspectRatio('9:16');
        this.renderer.proceduralStyle = 'sunset_waves';
        this.renderer.bgType = 'procedural';
        this.renderer.sungColor = '#fe0979';
        this.renderer.sungSecondaryColor = '#ff5e62';
        this.renderer.glowColor = '#fe0979';
        this.renderer.wipeStyle = 'word_pop';
        this.renderer.fontFamily = 'Luckiest Guy';
        this.renderer.fontSize = 62;
        this.renderer.lyricYPercent = 52;

        this.renderer.title.enabled = false;
        this.renderer.title.text = '15s VOCAL CHALLENGE';
        this.renderer.title.style = 'danger_alert';
        this.renderer.title.fontSize = 52;
        this.renderer.title.nx = 0.5;
        this.renderer.title.ny = 0.12;

        this.renderer.subtitle.enabled = false;
        this.renderer.subtitle.text = '99% FAIL TO HIT THIS NOTE';
        this.renderer.subtitle.fontSize = 26;
        this.renderer.subtitle.color = '#ffffff';
        this.renderer.subtitle.nx = 0.5;
        this.renderer.subtitle.ny = 0.20;

        await this.audio.synthesizeSong('neon_cyber');
        this.audio.setTrim(0, 15);
        this.audio.applyFxPreset('nightcore');

        this.lyrics.setLines([
          { id: 'vh_1', text: "Can you hit this viral note", start: 0.5, end: 3.5 },
          { id: 'vh_2', text: "Sing it right from your throat", start: 3.8, end: 7.2 },
          { id: 'vh_3', text: "Drop a duet show your skill", start: 7.6, end: 11.0 },
          { id: 'vh_4', text: "Send this video for the thrill", start: 11.4, end: 14.8 }
        ]);
        break;
    }

    const demosModal = document.getElementById('demosModal');
    if (demosModal) demosModal.classList.remove('open');
    this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
    this.renderLyricsList();
    this.drawWaveform();
    this.adjustStageZoom();
    if (preserveSettings && savedSettings) {
      this.restoreSettingsFromLocalStorage();
    }
    if (!preserveSettings) {
      this.saveSettingsToLocalStorage();
      this.showToast('Loaded demo: ' + demoKey);
    }
  }

  updateControlsFromState() {
    // Title Controls
    if (this.checkShowTitle) this.checkShowTitle.checked = this.renderer.title.enabled;
    if (this.inputTitleText) this.inputTitleText.value = this.renderer.title.text;
    if (this.titleStyleSelect) this.titleStyleSelect.value = this.renderer.title.style || 'cyber_neon';
    if (this.titleFontFamilySelect) this.titleFontFamilySelect.value = this.renderer.title.fontFamily || 'Montserrat';
    if (this.titleFontSizeSlider) this.titleFontSizeSlider.value = this.renderer.title.fontSize;
    if (this.titleRotationSlider) this.titleRotationSlider.value = this.renderer.title.rotation || 0;
    if (this.titleXSlider) this.titleXSlider.value = Math.round(this.renderer.title.nx * 100);
    if (this.titleYSlider) this.titleYSlider.value = Math.round(this.renderer.title.ny * 100);
    if (this.titleColorInput) this.titleColorInput.value = this.renderer.title.color || '#ffffff';
    if (this.titleGlowInput) this.titleGlowInput.value = this.renderer.title.glowColor || '#00f2fe';

    // Subtitle Controls
    if (this.checkShowSubtitle) this.checkShowSubtitle.checked = this.renderer.subtitle.enabled;
    if (this.inputSubtitleText) this.inputSubtitleText.value = this.renderer.subtitle.text;
    if (this.checkSubPillBg) this.checkSubPillBg.checked = this.renderer.subtitle.showBg;
    if (this.subFontFamilySelect) this.subFontFamilySelect.value = this.renderer.subtitle.fontFamily || 'Montserrat';
    if (this.subFontSizeSlider) this.subFontSizeSlider.value = this.renderer.subtitle.fontSize;
    if (this.subColorInput) this.subColorInput.value = this.renderer.subtitle.color || '#00f2fe';
    if (this.subXSlider) this.subXSlider.value = Math.round(this.renderer.subtitle.nx * 100);
    if (this.subYSlider) this.subYSlider.value = Math.round(this.renderer.subtitle.ny * 100);

    // Visual Crop Controls
    this.updateCropUIFromState();

    // Trimmer
    if (this.trimStartInput) this.trimStartInput.value = this.audio.trimStart.toFixed(1);
    if (this.trimEndInput) this.trimEndInput.value = this.audio.trimEnd.toFixed(1);
    if (this.trimDurationEl) this.trimDurationEl.textContent = this.audio.getTrimmedDuration().toFixed(1) + 's';

    // Aspect buttons
    document.querySelectorAll('.btn-aspect').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.aspect === this.renderer.aspectRatio);
    });

    // Wipe Style cards
    document.querySelectorAll('.style-card').forEach(card => {
      card.classList.toggle('active', card.dataset.wipe === this.renderer.wipeStyle);
    });

    // Typography
    const fontSelect = document.getElementById('fontFamilySelect');
    if (fontSelect) fontSelect.value = this.renderer.fontFamily;
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    if (fontSizeSlider) fontSizeSlider.value = this.renderer.fontSize;
    const fontSizeNum = document.getElementById('fontSizeNum');
    if (fontSizeNum) fontSizeNum.value = this.renderer.fontSize;
    const lyricYSlider = document.getElementById('lyricYSlider');
    if (lyricYSlider) lyricYSlider.value = this.renderer.lyricYPercent;

    // Colors & Overlays
    const sungColorInput = document.getElementById('sungColorInput');
    if (sungColorInput) sungColorInput.value = this.renderer.sungColor;
    const glowColorInput = document.getElementById('glowColorInput');
    if (glowColorInput) glowColorInput.value = this.renderer.glowColor;

    const bgOverlayOpacitySlider = document.getElementById('bgOverlayOpacitySlider');
    const bgOverlayOpacityVal = document.getElementById('bgOverlayOpacityVal');
    if (bgOverlayOpacitySlider) {
      const opPct = Math.round((this.renderer.bgOverlayOpacity !== undefined ? this.renderer.bgOverlayOpacity : 0.45) * 100);
      bgOverlayOpacitySlider.value = opPct;
      if (bgOverlayOpacityVal) bgOverlayOpacityVal.textContent = opPct + '%';
    }
    const bgOverlayColorInput = document.getElementById('bgOverlayColorInput');
    if (bgOverlayColorInput && this.renderer.bgOverlayColor) {
      bgOverlayColorInput.value = this.renderer.bgOverlayColor;
    }

    const unsungOpacitySlider = document.getElementById('unsungOpacitySlider');
    const unsungOpacityVal = document.getElementById('unsungOpacityVal');
    if (unsungOpacitySlider) {
      const unsungPct = Math.round((this.renderer.unsungOpacity !== undefined ? this.renderer.unsungOpacity : 0.82) * 100);
      unsungOpacitySlider.value = unsungPct;
      if (unsungOpacityVal) unsungOpacityVal.textContent = unsungPct + '%';
    }

    const bgPresetSelectEl = document.getElementById('bgPresetSelect');
    if (bgPresetSelectEl && this.renderer.proceduralStyle) {
      bgPresetSelectEl.value = this.renderer.proceduralStyle;
    }
    if (this.syncAllOverlayUI) this.syncAllOverlayUI();
    if (this.syncAllOverlayUI) this.syncAllOverlayUI();
    if (this.syncUnsungOpacityUI) this.syncUnsungOpacityUI();

    if (this.updateFxActiveDisplay && this.audio.fx) {
      this.updateFxActiveDisplay(this.audio.fx.preset || 'clean_original');
    }

    // Visual Theme Cards active state
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.theme === this.renderer.theme);
    });

    // Background Video Audio Mute & Volume Sync
    const checkMuteBgVideo = document.getElementById('checkMuteBgVideo');
    if (checkMuteBgVideo) checkMuteBgVideo.checked = this.renderer.bgVideoMuted;

    const btnToggleMuteVideo = document.getElementById('btnToggleMuteVideo');
    if (btnToggleMuteVideo) {
      btnToggleMuteVideo.textContent = this.renderer.bgVideoMuted ? 'Muted' : 'Unmuted';
      btnToggleMuteVideo.classList.toggle('active', this.renderer.bgVideoMuted);
    }

    const bgVideoVolSlider = document.getElementById('bgVideoVolSlider');
    if (bgVideoVolSlider) bgVideoVolSlider.value = Math.round(this.renderer.bgVideoVolume * 100);

    const bgVideoVolVal = document.getElementById('bgVideoVolVal');
    if (bgVideoVolVal) bgVideoVolVal.textContent = Math.round(this.renderer.bgVideoVolume * 100) + '%';

    // Vocal & Audio FX Sync
    this.updateVocalUI();
    this.syncFXControlsFromEngine();
  }

  updateVocalUI(mode = this.audio.vocalMode) {
    if (!mode) mode = 'original';

    // 1. Update primary button text & visual style
    if (this.btnToggleMuteSinger) {
      if (mode === 'instrumental') {
        this.btnToggleMuteSinger.classList.add('is-muted');
        if (this.btnToggleMuteSingerText) {
          this.btnToggleMuteSingerText.textContent = 'Singer Muted (Click to Unmute)';
        }
      } else if (mode === 'vocals') {
        this.btnToggleMuteSinger.classList.remove('is-muted');
        if (this.btnToggleMuteSingerText) {
          this.btnToggleMuteSingerText.textContent = 'Acapella Vocals (Click for Music)';
        }
      } else {
        this.btnToggleMuteSinger.classList.remove('is-muted');
        if (this.btnToggleMuteSingerText) {
          this.btnToggleMuteSingerText.textContent = 'Mute Singer Voice (Music Only)';
        }
      }
    }

    // 2. Update detection / mix badge
    if (this.vocalDetectBadge) {
      if (mode === 'instrumental') {
        this.vocalDetectBadge.innerHTML = 'Active: <strong style="color: #00f2fe;">Singer Voice Muted</strong> &bull; Backing Music Playing';
        this.vocalDetectBadge.style.borderColor = 'rgba(0, 242, 254, 0.4)';
        this.vocalDetectBadge.style.background = 'rgba(0, 242, 254, 0.12)';
      } else if (mode === 'vocals') {
        this.vocalDetectBadge.innerHTML = 'Active: <strong style="color: #fe0979;">Isolated Singer Vocals</strong> &bull; Acapella Solo';
        this.vocalDetectBadge.style.borderColor = 'rgba(254, 9, 121, 0.4)';
        this.vocalDetectBadge.style.background = 'rgba(254, 9, 121, 0.12)';
      } else {
        const mixRatio = (this.audio.vocalMixBalance !== undefined) ? this.audio.vocalMixBalance : 1.0;
        const mixPct = Math.round(mixRatio * 100);
        if (mixPct === 100) {
          this.vocalDetectBadge.innerHTML = 'Active: <strong style="color: #1ed760;">Full Song Playing</strong> &bull; Music & Vocals Synchronized';
        } else {
          this.vocalDetectBadge.innerHTML = 'Active: <strong style="color: #00f2fe;">Custom Studio Mix</strong> &bull; ' + mixPct + '% Song / ' + (100 - mixPct) + '% Backing';
        }
        this.vocalDetectBadge.style.borderColor = 'var(--border-subtle)';
        this.vocalDetectBadge.style.background = 'rgba(255, 255, 255, 0.05)';
      }
    }

    // 3. Update header status indicator
    if (this.vocalStatusIndicator) {
      this.vocalStatusIndicator.textContent = mode === 'instrumental' ? 'Muted' : (mode === 'vocals' ? 'Acapella' : 'Full Mix');
      this.vocalStatusIndicator.style.color = mode === 'instrumental' ? '#00f2fe' : (mode === 'vocals' ? '#fe0979' : 'var(--text-muted)');
    }

    // 4. Update mode pills
    document.querySelectorAll('.btn-vocal-mode').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // 5. Update cancellation slider
    if (this.vocalAttenuationSlider) {
      const depthVal = Math.round((this.audio.vocalReductionDepth || 0.95) * 100);
      this.vocalAttenuationSlider.value = depthVal;
      if (this.vocalAttenVal) this.vocalAttenVal.textContent = depthVal + '%';
    }
  }

  syncFXControlsFromEngine() {
    const fx = this.audio.fx || {};

    const audioFxSelect = document.getElementById('audioFxSelect');
    if (audioFxSelect && fx.preset) {
      audioFxSelect.value = fx.preset;
    }

    // Pitch
    if (this.pitchSlider) {
      this.pitchSlider.value = (fx.pitchShiftSemitones || 0.0);
      if (this.pitchVal) {
        const p = fx.pitchShiftSemitones || 0.0;
        this.pitchVal.textContent = (p >= 0 ? '+' : '') + p.toFixed(1) + ' st';
      }
    }

    // Speed
    if (this.speedSlider) {
      this.speedSlider.value = (fx.playbackSpeed || 1.0);
      if (this.speedVal) {
        this.speedVal.textContent = (fx.playbackSpeed || 1.0).toFixed(2) + 'x';
      }
    }

    // Bass Boost
    if (this.bassBoostSlider) {
      this.bassBoostSlider.value = Math.round(fx.eqBass || 0);
      if (this.bassBoostVal) {
        const b = Math.round(fx.eqBass || 0);
        this.bassBoostVal.textContent = (b >= 0 ? '+' : '') + b + ' dB';
      }
    }

    // Treble
    if (this.trebleSlider) {
      this.trebleSlider.value = Math.round(fx.eqTreble || 0);
      if (this.trebleVal) {
        const tr = Math.round(fx.eqTreble || 0);
        this.trebleVal.textContent = (tr >= 0 ? '+' : '') + tr + ' dB';
      }
    }

    // Echo Wet
    if (this.echoWetSlider) {
      const eWet = Math.round((fx.echoWet || 0) * 100);
      this.echoWetSlider.value = eWet;
      if (this.echoWetVal) this.echoWetVal.textContent = eWet + '%';
    }

    // Stereo Width
    if (this.stereoWidthSlider) {
      const sWidth = Math.round((fx.stereoWidth || 0) * 100);
      this.stereoWidthSlider.value = sWidth;
      if (this.stereoWidthVal) this.stereoWidthVal.textContent = sWidth + '%';
    }

    // Reverb Wet
    if (this.reverbWetSlider) {
      const rWet = Math.round((fx.reverbWet || 0) * 100);
      this.reverbWetSlider.value = rWet;
      if (this.reverbWetVal) this.reverbWetVal.textContent = rWet + '%';
    }

    // Vocal & Music Mix Blend
    if (this.vocalMixSlider) {
      const mixRatio = (this.audio.vocalMixBalance !== undefined) ? this.audio.vocalMixBalance : 1.0;
      const mixPct = Math.round(mixRatio * 100);
      this.vocalMixSlider.value = mixPct;
      if (this.vocalMixVal) {
        this.vocalMixVal.textContent = mixPct === 100 ? '100% Full Song' : (mixPct === 0 ? 'Backing Track Only' : mixPct + '% Mixed');
      }
    }

    // Lo-Fi Warmth
    if (this.lofiWarmthSlider) {
      const lofiPct = Math.round(((fx.lofiWarmth !== undefined) ? fx.lofiWarmth : (fx.lofiMode ? 0.8 : 0)) * 100);
      this.lofiWarmthSlider.value = lofiPct;
      if (this.lofiWarmthVal) this.lofiWarmthVal.textContent = lofiPct + '%';
    }

    // 8D Spatial Audio
    if (this.spatial8DSlider) {
      const spatPct = Math.round((fx.spatial8D || 0) * 100);
      this.spatial8DSlider.value = spatPct;
      if (this.spatial8DVal) this.spatial8DVal.textContent = spatPct + '%';
    }

    // Vintage Radio Filter
    if (this.radioFilterSlider) {
      const radPct = Math.round((fx.radioFilter || 0) * 100);
      this.radioFilterSlider.value = radPct;
      if (this.radioFilterVal) this.radioFilterVal.textContent = radPct + '%';
    }

    // Active preset pill
    const curPreset = fx.preset || 'clean_original';


    document.querySelectorAll('.fx-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === curPreset);
    });

    this.updateVocalUI();
  }

  updateCropUIFromState() {
    if (this.cropScaleSlider) this.cropScaleSlider.value = this.renderer.crop.scale || 1.0;
    if (this.cropScaleVal) this.cropScaleVal.textContent = (this.renderer.crop.scale || 1.0).toFixed(2) + 'x';
    if (this.cropPanXSlider) this.cropPanXSlider.value = this.renderer.crop.panX || 0;
    if (this.cropPanYSlider) this.cropPanYSlider.value = this.renderer.crop.panY || 0;
    if (this.cropLeftSlider) this.cropLeftSlider.value = this.renderer.crop.cropLeft || 0;
    if (this.cropRightSlider) this.cropRightSlider.value = this.renderer.crop.cropRight || 0;
    if (this.cropTopSlider) this.cropTopSlider.value = this.renderer.crop.cropTop || 0;
    if (this.cropBottomSlider) this.cropBottomSlider.value = this.renderer.crop.cropBottom || 0;
  }

  adjustStageZoom() {
    const stage = document.getElementById('stageWrapper');
    const viewport = document.getElementById('canvasViewport');
    if (!stage || !viewport || !this.canvas) return;

    const availW = Math.max(220, stage.clientWidth - 40);
    const availH = Math.max(220, stage.clientHeight - 40);
    const canvasW = this.canvas.width || 1080;
    const canvasH = this.canvas.height || 1920;

    const scale = Math.min(availW / canvasW, availH / canvasH);
    const finalW = Math.round(canvasW * scale);
    const finalH = Math.round(canvasH * scale);

    viewport.style.width = `${finalW}px`;
    viewport.style.height = `${finalH}px`;
  }

  setupEventListeners() {
    // 1. Play / Pause / Restart / Loop Transport
    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', () => {
        this.audio.togglePlay();
      });
    }

    if (this.btnRestart) {
      this.btnRestart.addEventListener('click', () => {
        this.audio.seek(this.audio.trimStart);
        this.audio.play();
      });
    }

    if (this.btnLoop) {
      this.btnLoop.addEventListener('click', () => {
        this.audio.loop = !this.audio.loop;
        this.btnLoop.classList.toggle('active', this.audio.loop);
        this.showToast(this.audio.loop ? 'Looping enabled' : 'Looping disabled');
      });
    }

    // Spacebar to toggle Play/Pause
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        this.audio.togglePlay();
      }
    });

    // 2. Timeline Scrubber (Smooth seek without audio glitching)
    if (this.timelineSlider) {
      this.timelineSlider.addEventListener('mousedown', () => { this.isScrubbing = true; });
      this.timelineSlider.addEventListener('touchstart', () => { this.isScrubbing = true; });

      const onScrub = (e) => {
        const ratio = parseFloat(e.target.value) / 1000;
        const dur = this.audio.trimEnd - this.audio.trimStart;
        const targetTime = this.audio.trimStart + ratio * dur;
        this.audio.seek(targetTime, false);
      };

      this.timelineSlider.addEventListener('input', onScrub);

      const endScrub = () => {
        if (!this.isScrubbing) return;
        this.isScrubbing = false;
        const ratio = parseFloat(this.timelineSlider.value) / 1000;
        const dur = this.audio.trimEnd - this.audio.trimStart;
        const targetTime = this.audio.trimStart + ratio * dur;
        this.audio.seek(targetTime, true);
      };

      this.timelineSlider.addEventListener('mouseup', endScrub);
      this.timelineSlider.addEventListener('touchend', endScrub);
      this.timelineSlider.addEventListener('change', endScrub);
    }

    // 3. Title Controls
    if (this.checkShowTitle) {
      this.checkShowTitle.addEventListener('change', (e) => {
        this.renderer.title.enabled = e.target.checked;
      });
    }
    if (this.inputTitleText) {
      this.inputTitleText.addEventListener('input', (e) => {
        this.renderer.title.text = e.target.value;
      });
    }
    if (this.titleStyleSelect) {
      this.titleStyleSelect.addEventListener('change', (e) => {
        this.renderer.title.style = e.target.value;
      });
    }
    if (this.titleFontSizeSlider) {
      this.titleFontSizeSlider.addEventListener('input', (e) => {
        this.renderer.title.fontSize = parseInt(e.target.value, 10);
      });
    }
    if (this.titleRotationSlider) {
      this.titleRotationSlider.addEventListener('input', (e) => {
        this.renderer.title.rotation = parseInt(e.target.value, 10);
      });
    }
    if (this.titleXSlider) {
      this.titleXSlider.addEventListener('input', (e) => {
        this.renderer.title.nx = parseInt(e.target.value, 10) / 100;
      });
    }
    if (this.titleYSlider) {
      this.titleYSlider.addEventListener('input', (e) => {
        this.renderer.title.ny = parseInt(e.target.value, 10) / 100;
      });
    }
    if (this.titleColorInput) {
      this.titleColorInput.addEventListener('input', (e) => {
        this.renderer.title.color = e.target.value;
      });
    }
    if (this.titleGlowInput) {
      this.titleGlowInput.addEventListener('input', (e) => {
        this.renderer.title.glowColor = e.target.value;
      });
    }
    if (this.btnCenterTitle) {
      this.btnCenterTitle.addEventListener('click', () => {
        this.renderer.title.nx = 0.5;
        if (this.titleXSlider) this.titleXSlider.value = 50;
      });
    }

    // 4. Subtitle Controls
    if (this.checkShowSubtitle) {
      this.checkShowSubtitle.addEventListener('change', (e) => {
        this.renderer.subtitle.enabled = e.target.checked;
      });
    }
    if (this.inputSubtitleText) {
      this.inputSubtitleText.addEventListener('input', (e) => {
        this.renderer.subtitle.text = e.target.value;
      });
    }
    if (this.checkSubPillBg) {
      this.checkSubPillBg.addEventListener('change', (e) => {
        this.renderer.subtitle.showBg = e.target.checked;
      });
    }
    if (this.subFontSizeSlider) {
      this.subFontSizeSlider.addEventListener('input', (e) => {
        this.renderer.subtitle.fontSize = parseInt(e.target.value, 10);
      });
    }
    if (this.subColorInput) {
      this.subColorInput.addEventListener('input', (e) => {
        this.renderer.subtitle.color = e.target.value;
      });
    }
    if (this.subXSlider) {
      this.subXSlider.addEventListener('input', (e) => {
        this.renderer.subtitle.nx = parseInt(e.target.value, 10) / 100;
      });
    }
    if (this.subYSlider) {
      this.subYSlider.addEventListener('input', (e) => {
        this.renderer.subtitle.ny = parseInt(e.target.value, 10) / 100;
      });
    }
    if (this.btnCenterSubtitle) {
      this.btnCenterSubtitle.addEventListener('click', () => {
        this.renderer.subtitle.nx = 0.5;
        if (this.subXSlider) this.subXSlider.value = 50;
      });
    }

    // 5. Visual Crop Controls
    const toggleCropHandler = () => {
      this.renderer.cropModeActive = !this.renderer.cropModeActive;
      if (this.btnToggleCrop) this.btnToggleCrop.classList.toggle('active', this.renderer.cropModeActive);
      if (this.btnToggleCropInline) this.btnToggleCropInline.classList.toggle('active', this.renderer.cropModeActive);
      this.showToast(this.renderer.cropModeActive ? 'Visual Crop Mode Active (Handles on Canvas)' : 'Crop Mode Closed');
    };

    if (this.btnToggleCrop) this.btnToggleCrop.addEventListener('click', toggleCropHandler);
    if (this.btnToggleCropInline) this.btnToggleCropInline.addEventListener('click', toggleCropHandler);

    if (this.cropScaleSlider) {
      this.cropScaleSlider.addEventListener('input', (e) => {
        this.renderer.crop.scale = parseFloat(e.target.value);
        if (this.cropScaleVal) this.cropScaleVal.textContent = this.renderer.crop.scale.toFixed(2) + 'x';
      });
    }
    if (this.cropPanXSlider) {
      this.cropPanXSlider.addEventListener('input', (e) => {
        this.renderer.crop.panX = parseFloat(e.target.value);
      });
    }
    if (this.cropPanYSlider) {
      this.cropPanYSlider.addEventListener('input', (e) => {
        this.renderer.crop.panY = parseFloat(e.target.value);
      });
    }
    if (this.cropLeftSlider) {
      this.cropLeftSlider.addEventListener('input', (e) => {
        this.renderer.crop.cropLeft = parseFloat(e.target.value);
      });
    }
    if (this.cropRightSlider) {
      this.cropRightSlider.addEventListener('input', (e) => {
        this.renderer.crop.cropRight = parseFloat(e.target.value);
      });
    }
    if (this.cropTopSlider) {
      this.cropTopSlider.addEventListener('input', (e) => {
        this.renderer.crop.cropTop = parseFloat(e.target.value);
      });
    }
    if (this.cropBottomSlider) {
      this.cropBottomSlider.addEventListener('input', (e) => {
        this.renderer.crop.cropBottom = parseFloat(e.target.value);
      });
    }

    // Quick Crop Preset Buttons
    const btnCrop916 = document.getElementById('btnCropAspect916');
    if (btnCrop916) {
      btnCrop916.addEventListener('click', () => {
        this.renderer.crop.cropLeft = 14;
        this.renderer.crop.cropRight = 14;
        this.renderer.crop.cropTop = 0;
        this.renderer.crop.cropBottom = 0;
        this.updateCropUIFromState();
        this.showToast('9:16 Crop Applied');
      });
    }

    const btnCrop11 = document.getElementById('btnCropAspect11');
    if (btnCrop11) {
      btnCrop11.addEventListener('click', () => {
        this.renderer.crop.cropLeft = 8;
        this.renderer.crop.cropRight = 8;
        this.renderer.crop.cropTop = 8;
        this.renderer.crop.cropBottom = 8;
        this.updateCropUIFromState();
        this.showToast('1:1 Square Crop Applied');
      });
    }

    const btnCrop169 = document.getElementById('btnCropAspect169');
    if (btnCrop169) {
      btnCrop169.addEventListener('click', () => {
        this.renderer.crop.cropLeft = 0;
        this.renderer.crop.cropRight = 0;
        this.renderer.crop.cropTop = 15;
        this.renderer.crop.cropBottom = 15;
        this.updateCropUIFromState();
        this.showToast('16:9 Wide Crop Applied');
      });
    }

    const btnCropReset = document.getElementById('btnCropReset');
    if (btnCropReset) {
      btnCropReset.addEventListener('click', () => {
        this.renderer.crop = { scale: 1.0, panX: 0, panY: 0, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 };
        this.updateCropUIFromState();
        this.showToast('Crop Insets & Pan Reset');
      });
    }

    // 6. Safe Zones Toggle
    const btnSafeZones = document.getElementById('btnSafeZones');
    if (btnSafeZones) {
      btnSafeZones.addEventListener('click', () => {
        this.renderer.showSafeZones = !this.renderer.showSafeZones;
        btnSafeZones.classList.toggle('active', this.renderer.showSafeZones);
        this.showToast(this.renderer.showSafeZones ? 'Safe Zones visible' : 'Safe Zones hidden');
      });
    }

        // 6.9 AI Voice-to-Subtitle Auto Transcriber
    const btnOpenAutoTranscribeModal = document.getElementById('btnOpenAutoTranscribeModal');
    const transcribeModal = document.getElementById('transcribeModal');
    const transcribeEngineSelect = document.getElementById('transcribeEngineSelect');
    const transcribeKeyBox = document.getElementById('transcribeKeyBox');
    const apiKeyHelperLink = document.getElementById('apiKeyHelperLink');
    const inputTranscribeApiKey = document.getElementById('inputTranscribeApiKey');
    const btnStartAutoTranscribe = document.getElementById('btnStartAutoTranscribe');

    if (btnOpenAutoTranscribeModal && transcribeModal) {
      btnOpenAutoTranscribeModal.addEventListener('click', () => {
        if (inputTranscribeApiKey && !inputTranscribeApiKey.value) {
          inputTranscribeApiKey.value = localStorage.getItem('karaoke_ai_transcribe_key') || '';
        }
        transcribeModal.classList.add('open');
      });
    }

    if (transcribeEngineSelect && transcribeKeyBox) {
      transcribeEngineSelect.addEventListener('change', () => {
        const val = transcribeEngineSelect.value;
        if (val === 'groq') {
          transcribeKeyBox.style.display = 'block';
          if (apiKeyHelperLink) {
            apiKeyHelperLink.href = 'https://console.groq.com/keys';
            apiKeyHelperLink.textContent = 'Get Free Groq Key (100% Free, Zero Wait)';
          }
        } else if (val === 'openai') {
          transcribeKeyBox.style.display = 'block';
          if (apiKeyHelperLink) {
            apiKeyHelperLink.href = 'https://platform.openai.com/api-keys';
            apiKeyHelperLink.textContent = 'Get OpenAI Key';
          }
        } else {
          transcribeKeyBox.style.display = 'none';
        }
      });
    }

    if (inputTranscribeApiKey) {
      inputTranscribeApiKey.addEventListener('input', (e) => {
        localStorage.setItem('karaoke_ai_transcribe_key', e.target.value.trim());
      });
    }

    if (btnStartAutoTranscribe) {
      btnStartAutoTranscribe.addEventListener('click', () => {
        this.handleAutoTranscribe();
      });
    }

    // 7. Universal Subtitle / YouTube Transcript Import
    const btnOpenImportModal = document.getElementById('btnOpenImportModal');
    const lyricsModal = document.getElementById('lyricsModal');
    if (btnOpenImportModal && lyricsModal) {
      btnOpenImportModal.addEventListener('click', () => {
        lyricsModal.classList.add('open');
      });
    }

    const subtitleFileInput = document.getElementById('subtitleFileInput');
    if (subtitleFileInput) {
      subtitleFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          this.saveHistoryState();
          const autoAlign = this.checkImportAutoAlign ? this.checkImportAutoAlign.checked : true;
          const autoScale = this.checkImportFitDuration ? this.checkImportFitDuration.checked : false;
          this.lyrics.importAnySubtitleText(re.target.result, this.audio.duration, this.audio.trimStart, autoAlign, autoScale);
          this.renderLyricsList();
          this.showToast(`Imported subtitles from ${file.name}!`);
        };
        reader.readAsText(file);
      });
    }

    const importTextArea = document.getElementById('importTextArea');
    const importDetectedInfo = document.getElementById('importDetectedInfo');
    if (importTextArea && importDetectedInfo) {
      importTextArea.addEventListener('input', () => {
        const t = importTextArea.value.trim();
        if (!t) {
          importDetectedInfo.textContent = 'Paste subtitles or lyrics to detect format.';
          return;
        }
        if (/\d+:\d{2}:\d{2}\.\d{3},\d+:\d{2}:\d{2}\.\d{3}/.test(t)) {
          importDetectedInfo.textContent = 'Format Detected: YouTube SubViewer (.sbv)';
        } else if (t.includes('-->')) {
          importDetectedInfo.textContent = 'Format Detected: SRT / WebVTT Timed Subtitles';
        } else if (/\[\d{2}:\d{2}/.test(t)) {
          importDetectedInfo.textContent = 'Format Detected: LRC Synced Lyrics';
        } else if (/(?:\d{1,2}:\d{2})/.test(t)) {
          importDetectedInfo.textContent = 'Format Detected: YouTube Video Transcript (0:05 text)';
        } else {
          importDetectedInfo.textContent = 'Format Detected: Plain Lyrics Lines (Will auto-distribute across audio)';
        }
      });
    }

    const btnApplyImport = document.getElementById('btnApplyImport');
    if (btnApplyImport && importTextArea) {
      btnApplyImport.addEventListener('click', () => {
        const text = importTextArea.value.trim();
        if (!text) return;
        this.saveHistoryState();
        const autoAlign = this.checkImportAutoAlign ? this.checkImportAutoAlign.checked : true;
        const autoScale = this.checkImportFitDuration ? this.checkImportFitDuration.checked : false;
        this.lyrics.importAnySubtitleText(text, this.audio.duration, this.audio.trimStart, autoAlign, autoScale);
        this.renderLyricsList();
        this.debouncedSaveSettings();
        if (lyricsModal) lyricsModal.classList.remove('open');
        this.showToast('Imported & synchronized subtitles successfully!');
      });
    }

    // 8. Trimmer & Random Hook Slice
    const btnRandomHook = document.getElementById('btnRandomHook');
    if (btnRandomHook) {
      btnRandomHook.addEventListener('click', () => {
        this.saveHistoryState();
        const dur = this.audio.duration;
        const sliceDur = Math.min(15.0, dur);
        const maxStart = Math.max(0, dur - sliceDur);
        const rndStart = Math.round((Math.random() * maxStart) * 10) / 10;
        const rndEnd = Math.round((rndStart + sliceDur) * 10) / 10;

        this.audio.setTrim(rndStart, rndEnd);
        this.lyrics.cropToTrim(rndStart, rndEnd, false);
        this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
        this.drawWaveform();
        this.showToast(`Selected exciting 15s slice: ${rndStart}s - ${rndEnd}s`);
      });
    }

    const btnCropLyrics = document.getElementById('btnCropLyrics');
    if (btnCropLyrics) {
      btnCropLyrics.addEventListener('click', () => {
        this.saveHistoryState();
        this.lyrics.cropToTrim(this.audio.trimStart, this.audio.trimEnd, false);
        this.renderLyricsList();
        this.showToast('Cropped lyrics to match current audio trim!');
      });
    }

    if (this.trimStartInput) {
      this.trimStartInput.addEventListener('change', (e) => {
        this.audio.setTrim(parseFloat(e.target.value) || 0, this.audio.trimEnd);
        if (!this.checkAutoCropLyrics || this.checkAutoCropLyrics.checked) {
          this.lyrics.cropToTrim(this.audio.trimStart, this.audio.trimEnd, false);
          this.renderLyricsList();
        }
        this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
        this.drawWaveform();
      });
    }
    if (this.trimEndInput) {
      this.trimEndInput.addEventListener('change', (e) => {
        this.audio.setTrim(this.audio.trimStart, parseFloat(e.target.value) || this.audio.duration);
        if (!this.checkAutoCropLyrics || this.checkAutoCropLyrics.checked) {
          this.lyrics.cropToTrim(this.audio.trimStart, this.audio.trimEnd, false);
          this.renderLyricsList();
        }
        this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
        this.drawWaveform();
      });
    }

    // 9. Add Line & Shift All
    const btnAddLine = document.getElementById('btnAddLine');
    if (btnAddLine) {
      btnAddLine.addEventListener('click', () => {
        this.saveHistoryState();
        const cur = this.audio.getCurrentTime();
        this.lyrics.addLine('New lyric line', cur, 3.0);
        this.showToast('Added lyric line at current time');
      });
    }

    const btnShiftBack = document.getElementById('btnShiftBack');
    if (btnShiftBack) {
      btnShiftBack.addEventListener('click', () => {
        this.saveHistoryState();
        this.lyrics.shiftAll(-0.5);
        this.showToast('Shifted lyrics -0.5s');
      });
    }

    const btnShiftForward = document.getElementById('btnShiftForward');
    if (btnShiftForward) {
      btnShiftForward.addEventListener('click', () => {
        this.saveHistoryState();
        this.lyrics.shiftAll(0.5);
        this.showToast('Shifted lyrics +0.5s');
      });
    }

    // 10. Aspect Ratio Buttons
    document.querySelectorAll('.btn-aspect').forEach(btn => {
      btn.addEventListener('click', () => {
        this.saveHistoryState();
        const aspect = btn.dataset.aspect;
        this.renderer.setAspectRatio(aspect);
        this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
        this.adjustStageZoom();
        this.saveSettingsToLocalStorage();
        this.showToast('Canvas switched to ' + aspect);
      });
    });

    const tabVisualsEl = document.getElementById('tabVisuals');
    if (tabVisualsEl) {
      tabVisualsEl.addEventListener('input', () => this.debouncedSaveSettings());
      tabVisualsEl.addEventListener('change', () => this.debouncedSaveSettings());
    }
    const sidebarLeftEl = document.querySelector('.sidebar.panel-left');
    if (sidebarLeftEl) {
      sidebarLeftEl.addEventListener('input', () => this.debouncedSaveSettings());
      sidebarLeftEl.addEventListener('change', () => this.debouncedSaveSettings());
    };

    // 11. 12 Karaoke Animation Style Cards
    document.querySelectorAll('.style-card').forEach(card => {
      card.addEventListener('click', () => {
        this.saveHistoryState();
        const wipe = card.dataset.wipe;
        this.renderer.wipeStyle = wipe;
        this.saveSettingsToLocalStorage();
        document.querySelectorAll('.style-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const titleText = card.querySelector('.style-card-title')?.textContent || wipe;
        this.showToast(`Lyric Animation: ${titleText}`);
      });
    });

    // 12. Procedural Background Select
    const bgPresetSelect = document.getElementById('bgPresetSelect');
    if (bgPresetSelect) {
      bgPresetSelect.addEventListener('change', (e) => {
        this.renderer.bgType = 'procedural';
        this.renderer.proceduralStyle = e.target.value;
        const btnRemoveBgMedia = document.getElementById('btnRemoveBgMedia');
        if (btnRemoveBgMedia) btnRemoveBgMedia.style.display = 'none';
        this.debouncedSaveSettings();
      });
    }

    // Helper to apply background image
    this.applyBackgroundImage = (img) => {
      this.renderer.bgImage = img;
      this.renderer.bgType = 'image';
      // Ensure overlay is at least 40% if currently 0 so lyrics are 100% visible
      if (this.renderer.bgOverlayOpacity <= 0.05) {
        this.renderer.setBgOverlay(undefined, 0.45);
      }
      this.syncAllOverlayUI();
      const btnRemoveBgMedia = document.getElementById('btnRemoveBgMedia');
      if (btnRemoveBgMedia) btnRemoveBgMedia.style.display = 'flex';
      this.saveSettingsToLocalStorage();
      this.showToast(`Background image applied! Overlay opacity: ${Math.round(this.renderer.bgOverlayOpacity * 100)}%`);
    };

    // Helper to apply background video
    this.applyBackgroundVideo = async (videoUrl) => {
      const bgVideoEl = document.createElement('video');
      bgVideoEl.src = videoUrl;
      bgVideoEl.muted = this.renderer.bgVideoMuted;
      bgVideoEl.volume = this.renderer.bgVideoVolume;
      bgVideoEl.loop = true;
      bgVideoEl.playsInline = true;
      await bgVideoEl.play().catch(() => {});
      this.renderer.bgVideo = bgVideoEl;
      this.renderer.bgType = 'video';
      if (this.renderer.bgOverlayOpacity <= 0.05) {
        this.renderer.setBgOverlay(undefined, 0.45);
      }
      this.syncAllOverlayUI();
      const btnRemoveBgMedia = document.getElementById('btnRemoveBgMedia');
      if (btnRemoveBgMedia) btnRemoveBgMedia.style.display = 'flex';
      this.saveSettingsToLocalStorage();
      this.showToast('Background video applied!');
    };

    const bgMediaInput = document.getElementById('bgMediaInput');
    if (bgMediaInput) {
      bgMediaInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type.startsWith('video/')) {
          this.applyBackgroundVideo(URL.createObjectURL(file));
        } else if (file.type.startsWith('image/')) {
          const img = new Image();
          img.onload = () => this.applyBackgroundImage(img);
          img.src = URL.createObjectURL(file);
        }
      });
    }

    const btnRemoveBgMedia = document.getElementById('btnRemoveBgMedia');
    if (btnRemoveBgMedia) {
      btnRemoveBgMedia.addEventListener('click', () => this.removeCustomBgMedia());
    }

    // Direct Drag & Drop onto Canvas Viewport
    const canvasViewport = document.getElementById('canvasViewport');
    if (canvasViewport) {
      canvasViewport.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvasViewport.classList.add('drag-over-canvas');
      });
      canvasViewport.addEventListener('dragleave', () => {
        canvasViewport.classList.remove('drag-over-canvas');
      });
      canvasViewport.addEventListener('drop', (e) => {
        e.preventDefault();
        canvasViewport.classList.remove('drag-over-canvas');
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (file.type.startsWith('image/')) {
          const img = new Image();
          img.onload = () => this.applyBackgroundImage(img);
          img.src = URL.createObjectURL(file);
        } else if (file.type.startsWith('video/')) {
          this.applyBackgroundVideo(URL.createObjectURL(file));
        } else {
          this.loadUserMediaFile(file);
        }
      });
    }

    // 13. Background Media Overlay & Transparency Controls (Both Panels Synchronized)
    this.syncAllOverlayUI = () => {
      const opPct = Math.round((this.renderer.bgOverlayOpacity !== undefined ? this.renderer.bgOverlayOpacity : 0.45) * 100);
      const col = this.renderer.bgOverlayColor || '#000000';

      document.querySelectorAll('#bgOverlayOpacitySlider, #bgOverlayOpacitySliderLeft').forEach(sl => {
        if (sl) sl.value = opPct;
      });
      document.querySelectorAll('#bgOverlayOpacityVal, #bgOverlayOpacityValLeft').forEach(lbl => {
        if (lbl) lbl.textContent = opPct + '%';
      });
      document.querySelectorAll('#bgOverlayColorInput, #bgOverlayColorInputLeft').forEach(ci => {
        if (ci) ci.value = col;
      });
      document.querySelectorAll('.overlay-chip[data-overlay-op]').forEach(ch => {
        ch.classList.toggle('active', parseInt(ch.dataset.overlayOp, 10) === opPct);
      });
    };

    // Attach input & change listeners to all overlay opacity sliders
    document.querySelectorAll('#bgOverlayOpacitySlider, #bgOverlayOpacitySliderLeft').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.renderer.setBgOverlay(undefined, val / 100);
        this.syncAllOverlayUI();
        this.debouncedSaveSettings();
      });
      slider.addEventListener('change', () => this.debouncedSaveSettings());
    });

    // Attach input & change listeners to all overlay color pickers
    document.querySelectorAll('#bgOverlayColorInput, #bgOverlayColorInputLeft').forEach(colorIn => {
      colorIn.addEventListener('input', (e) => {
        this.renderer.setBgOverlay(e.target.value, undefined);
        this.syncAllOverlayUI();
        this.debouncedSaveSettings();
      });
      colorIn.addEventListener('change', () => this.debouncedSaveSettings());
    });

    // Attach click listeners to all density chips
    document.querySelectorAll('.overlay-chip[data-overlay-op]').forEach(chip => {
      chip.addEventListener('click', () => {
        const op = parseInt(chip.dataset.overlayOp, 10);
        this.renderer.setBgOverlay(undefined, op / 100);
        this.syncAllOverlayUI();
        this.debouncedSaveSettings();
      });
    });

    // Attach click listeners to all tint color chips
    document.querySelectorAll('.overlay-chip[data-tint]').forEach(chip => {
      chip.addEventListener('click', () => {
        const tint = chip.dataset.tint;
        this.renderer.setBgOverlay(tint, undefined);
        this.syncAllOverlayUI();
        this.debouncedSaveSettings();
      });
    });

    // Quick jump button from tabLyrics to tabVisuals
    const btnGoToVisualStyling = document.getElementById('btnGoToVisualStyling');
    if (btnGoToVisualStyling) {
      btnGoToVisualStyling.addEventListener('click', () => {
        const visualTabBtn = document.querySelector('button[data-tab="tabVisuals"]');
        if (visualTabBtn) visualTabBtn.click();
        const rightSidebar = document.querySelector('.right-sidebar') || document.querySelector('.panel-right');
        if (rightSidebar) rightSidebar.scrollTop = 700;
      });
    }

    // Inactive Lyrics Visibility Synchronization (Both tabVisuals and tabLyrics)
    this.syncUnsungOpacityUI = () => {
      const opPct = Math.round((this.renderer.unsungOpacity !== undefined ? this.renderer.unsungOpacity : 0.82) * 100);
      document.querySelectorAll('#unsungOpacitySlider, #unsungOpacitySliderLyrics').forEach(sl => {
        if (sl) sl.value = opPct;
      });
      document.querySelectorAll('#unsungOpacityVal, #unsungOpacityValLyrics').forEach(lbl => {
        if (lbl) lbl.textContent = opPct + '%';
      });
      document.querySelectorAll('.unsung-chip').forEach(ch => {
        ch.classList.toggle('active', parseInt(ch.dataset.unsungOp, 10) === opPct);
      });
    };

    document.querySelectorAll('#unsungOpacitySlider, #unsungOpacitySliderLyrics').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.renderer.setUnsungOpacity(val / 100);
        this.syncUnsungOpacityUI();
        this.debouncedSaveSettings();
      });
      slider.addEventListener('change', () => this.debouncedSaveSettings());
    });

    document.querySelectorAll('.unsung-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.dataset.unsungOp, 10);
        this.renderer.setUnsungOpacity(val / 100);
        this.syncUnsungOpacityUI();
        this.debouncedSaveSettings();
      });
    });

    // Voice FX Category Filter Chips
    document.querySelectorAll('.voice-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const filter = chip.dataset.filter;
        document.querySelectorAll('.voice-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        const fxSelect = document.getElementById('audioFxSelect');
        if (fxSelect) {
          const optgroups = fxSelect.querySelectorAll('optgroup');
          optgroups.forEach(og => {
            const label = (og.label || '').toLowerCase();
            if (filter === 'all') {
              og.style.display = '';
            } else if (filter === 'lofi_sleep') {
              og.style.display = (label.includes('lo-fi') || label.includes('sleep') || label.includes('chill') || label.includes('slumber')) ? '' : 'none';
            } else if (filter === 'cats') {
              og.style.display = label.includes('cat') ? '' : 'none';
            } else if (filter === 'kids') {
              og.style.display = label.includes('kid') ? '' : 'none';
            } else if (filter === 'characters') {
              og.style.display = (label.includes('popular') || label.includes('character')) ? '' : 'none';
            } else if (filter === 'mastering') {
              og.style.display = (label.includes('karaoke') || label.includes('mastering') || label.includes('creative')) ? '' : 'none';
            }
          });
        }
      });
    });

    // Theme Card Presets Click Handling
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        const theme = card.dataset.theme;
        if (!theme) return;
        this.renderer.applyTheme(theme);
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
        this.showToast('Applied theme: ' + theme); this.saveSettingsToLocalStorage();
      });
    });

    // Background Video Audio Controls
    const checkMuteBgVideo = document.getElementById('checkMuteBgVideo');
    const btnToggleMuteVideo = document.getElementById('btnToggleMuteVideo');
    const bgVideoVolSlider = document.getElementById('bgVideoVolSlider');
    const bgVideoVolVal = document.getElementById('bgVideoVolVal');

    const updateBgVideoAudio = (muted, vol) => {
      this.renderer.bgVideoMuted = muted;
      this.renderer.bgVideoVolume = vol;
      if (this.renderer.bgVideo) {
        this.renderer.bgVideo.muted = muted;
        this.renderer.bgVideo.volume = vol;
      }
      if (checkMuteBgVideo) checkMuteBgVideo.checked = muted;
      if (btnToggleMuteVideo) {
        btnToggleMuteVideo.textContent = muted ? 'Muted' : 'Unmuted';
        btnToggleMuteVideo.classList.toggle('active', muted);
      }
      if (bgVideoVolSlider) bgVideoVolSlider.value = Math.round(vol * 100);
      if (bgVideoVolVal) bgVideoVolVal.textContent = Math.round(vol * 100) + '%';
    };

    if (checkMuteBgVideo) {
      checkMuteBgVideo.addEventListener('change', (e) => {
        const isMuted = e.target.checked;
        const currentVol = isMuted ? 0 : (this.renderer.bgVideoVolume > 0 ? this.renderer.bgVideoVolume : 0.8);
        updateBgVideoAudio(isMuted, currentVol);
        this.showToast(isMuted ? 'Background video audio muted' : 'Background video audio unmuted');
      });
    }

    if (btnToggleMuteVideo) {
      btnToggleMuteVideo.addEventListener('click', () => {
        const newMuted = !this.renderer.bgVideoMuted;
        const newVol = newMuted ? 0 : (this.renderer.bgVideoVolume > 0 ? this.renderer.bgVideoVolume : 0.8);
        updateBgVideoAudio(newMuted, newVol);
        this.showToast(newMuted ? 'Background video audio muted' : 'Background video audio unmuted');
      });
    }

    if (bgVideoVolSlider) {
      bgVideoVolSlider.addEventListener('input', (e) => {
        const vol = parseInt(e.target.value, 10) / 100;
        const isMuted = (vol === 0);
        updateBgVideoAudio(isMuted, vol);
      });
    }

    // 13. Audio File Dropzone & Input
    const audioDropzone = document.getElementById('audioDropzone');
    const audioFileInput = document.getElementById('audioFileInput');
    if (audioDropzone && audioFileInput) {
      audioDropzone.addEventListener('click', () => audioFileInput.click());
      audioDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        audioDropzone.classList.add('drag-over');
      });
      audioDropzone.addEventListener('dragleave', () => audioDropzone.classList.remove('drag-over'));
      audioDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        audioDropzone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (file.type.startsWith('image/')) {
          const img = new Image();
          img.onload = () => this.applyBackgroundImage(img);
          img.src = URL.createObjectURL(file);
        } else {
          this.loadUserMediaFile(file);
        }
      });
      audioFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) this.loadUserMediaFile(e.target.files[0]);
      });
    }

        // 14. Vocal Processor & Singer Mute Controls
    if (this.btnToggleMuteSinger) {
      this.btnToggleMuteSinger.addEventListener('click', () => {
        const newMode = this.audio.toggleVocalMute();
        this.updateVocalUI(newMode);
        this.debouncedSaveSettings();
        if (newMode === 'instrumental') {
          this.showToast('Singer voice muted - Backing music only!');
        } else {
          this.showToast('Singer voice unmuted - Original mix');
        }
      });
    }

    document.querySelectorAll('.btn-vocal-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        this.audio.setVocalMode(mode);
        this.updateVocalUI(mode);
        this.debouncedSaveSettings();
        this.showToast('Vocal mode: ' + btn.textContent);
      });
    });

    if (this.vocalAttenuationSlider) {
      this.vocalAttenuationSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.setVocalAttenuation(val / 100);
        if (this.vocalAttenVal) this.vocalAttenVal.textContent = val + '%';
        this.debouncedSaveSettings();
      });
    }

    // 15. Studio Audio FX & Mastering Rack Controls
    if (this.pitchSlider) {
      this.pitchSlider.addEventListener('input', (e) => {
        this.audio.fx.pitchShiftSemitones = parseFloat(e.target.value);
        if (this.pitchVal) {
          const val = this.audio.fx.pitchShiftSemitones;
          this.pitchVal.textContent = (val >= 0 ? '+' : '') + val.toFixed(1) + ' st';
        }
        this.audio.updateDSPParams();
        this.debouncedSaveSettings();
      });
    }

    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', (e) => {
        this.audio.fx.playbackSpeed = parseFloat(e.target.value);
        if (this.speedVal) this.speedVal.textContent = this.audio.fx.playbackSpeed.toFixed(2) + 'x';
        this.audio.updateDSPParams();
        this.debouncedSaveSettings();
      });
    }

    if (this.bassBoostSlider) {
      this.bassBoostSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.fx.eqBass = val;
        if (this.bassBoostVal) this.bassBoostVal.textContent = (val >= 0 ? '+' : '') + val + ' dB';
        this.audio.updateDSPParams();
        this.debouncedSaveSettings();
      });
    }

    if (this.trebleSlider) {
      this.trebleSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.fx.eqTreble = val;
        if (this.trebleVal) this.trebleVal.textContent = (val >= 0 ? '+' : '') + val + ' dB';
        this.audio.updateDSPParams();
        this.debouncedSaveSettings();
      });
    }

    if (this.echoWetSlider) {
      this.echoWetSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.fx.echoWet = val / 100;
        if (this.echoWetVal) this.echoWetVal.textContent = val + '%';
        this.audio.updateDSPParams();
        this.debouncedSaveSettings();
      });
    }

    if (this.stereoWidthSlider) {
      this.stereoWidthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.fx.stereoWidth = val / 100;
        if (this.stereoWidthVal) this.stereoWidthVal.textContent = val + '%';
        this.audio.updateDSPParams();
        this.debouncedSaveSettings();
      });
    }

    if (this.reverbWetSlider) {
      this.reverbWetSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.fx.reverbWet = val / 100;
        if (this.reverbWetVal) this.reverbWetVal.textContent = val + '%';
        this.audio.updateDSPParams();
        this.debouncedSaveSettings();
      });
    }

    if (this.vocalMixSlider) {
      this.vocalMixSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        const ratio = val / 100;
        this.audio.setVocalMix(ratio);
        if (this.vocalMixVal) {
          this.vocalMixVal.textContent = val === 100 ? '100% Full Song' : (val === 0 ? 'Backing Track Only' : val + '% Mixed');
        }
        this.updateVocalUI();
        this.debouncedSaveSettings();
      });
    }

    if (this.lofiWarmthSlider) {
      this.lofiWarmthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.setLofiWarmth(val / 100);
        if (this.lofiWarmthVal) this.lofiWarmthVal.textContent = val + '%';
        this.debouncedSaveSettings();
      });
    }

    if (this.spatial8DSlider) {
      this.spatial8DSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.setSpatial8D(val / 100);
        if (this.spatial8DVal) this.spatial8DVal.textContent = val + '%';
        this.debouncedSaveSettings();
      });
    }

    if (this.radioFilterSlider) {
      this.radioFilterSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.audio.setRadioVintage(val / 100);
        if (this.radioFilterVal) this.radioFilterVal.textContent = val + '%';
        this.debouncedSaveSettings();
      });
    }

    if (this.titleFontFamilySelect) {
      this.titleFontFamilySelect.addEventListener('change', (e) => {
        this.renderer.title.fontFamily = e.target.value;
        this.debouncedSaveSettings();
      });
    }

    if (this.subFontFamilySelect) {
      this.subFontFamilySelect.addEventListener('change', (e) => {
        this.renderer.subtitle.fontFamily = e.target.value;
        this.debouncedSaveSettings();
      });
    }

    if (this.btnAlignLyricsStart) {
      this.btnAlignLyricsStart.addEventListener('click', () => {
        this.saveHistoryState();
        this.lyrics.alignToStart(0.5);
        this.renderLyricsList();
        this.debouncedSaveSettings();
        this.showToast('Aligned 1st lyric to audio start (0.5s)!');
      });
    }

    if (this.btnFitLyricsDuration) {
      this.btnFitLyricsDuration.addEventListener('click', () => {
        this.saveHistoryState();
        this.lyrics.fitToDuration(this.audio.duration, 0.5, 1.0);
        this.renderLyricsList();
        this.debouncedSaveSettings();
        this.showToast('Fitted all lyrics across ' + this.audio.duration.toFixed(1) + 's song length!');
      });
    }

    // 20+ Popular Audio Effects & Voice Changers Dropdown
    const audioFxSelect = document.getElementById('audioFxSelect');
    if (audioFxSelect) {
      audioFxSelect.addEventListener('change', (e) => {
        const presetKey = e.target.value;
        this.audio.applyFxPreset(presetKey);
        this.syncFXControlsFromEngine();
        this.debouncedSaveSettings();
        const selectedLabel = audioFxSelect.options[audioFxSelect.selectedIndex]?.text || presetKey;
        if (this.updateFxActiveDisplay) this.updateFxActiveDisplay(presetKey);
        if (this.updateFxActiveDisplay) this.updateFxActiveDisplay(presetKey);
        this.showToast('Audio Effect: ' + selectedLabel + ' active!');
      });
    }

    // 1-Click Creative FX Presets


    document.querySelectorAll('.fx-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        this.audio.applyFxPreset(presetKey);
        this.syncFXControlsFromEngine();
        this.saveSettingsToLocalStorage();
        this.showToast('Audio FX: ' + btn.textContent + ' Applied!');
      });
    });

    if (this.btnResetFX) {
      this.btnResetFX.addEventListener('click', () => {
        this.audio.applyFxPreset('clean_original');
        this.syncFXControlsFromEngine();
        this.saveSettingsToLocalStorage();
        this.showToast('Audio FX Reset to Clean Original');
      });
    }

    // 16. Typography Styling
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    if (fontFamilySelect) {
      fontFamilySelect.addEventListener('change', (e) => {
        this.renderer.fontFamily = e.target.value;
      });
    }

    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeNum = document.getElementById('fontSizeNum');
    if (fontSizeSlider && fontSizeNum) {
      fontSizeSlider.addEventListener('input', (e) => {
        this.renderer.fontSize = parseInt(e.target.value, 10);
        fontSizeNum.value = this.renderer.fontSize;
      });
      fontSizeNum.addEventListener('input', (e) => {
        this.renderer.fontSize = parseInt(e.target.value, 10) || 58;
        fontSizeSlider.value = this.renderer.fontSize;
      });
    }

    const lyricYSlider = document.getElementById('lyricYSlider');
    if (lyricYSlider) {
      lyricYSlider.addEventListener('input', (e) => {
        this.renderer.lyricYPercent = parseInt(e.target.value, 10);
      });
    }

    const sungColorInput = document.getElementById('sungColorInput');
    if (sungColorInput) {
      sungColorInput.addEventListener('input', (e) => {
        this.renderer.sungColor = e.target.value;
      });
    }

    const glowColorInput = document.getElementById('glowColorInput');
    if (glowColorInput) {
      glowColorInput.addEventListener('input', (e) => {
        this.renderer.glowColor = e.target.value;
      });
    }

    // 17. Demo Songs Modal & Pills
    const btnOpenDemos = document.getElementById('btnOpenDemos');
    const demosModal = document.getElementById('demosModal');
    if (btnOpenDemos && demosModal) {
      btnOpenDemos.addEventListener('click', () => demosModal.classList.add('open'));
    }

    document.querySelectorAll('.btn-load-demo, .demo-card').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.dataset.demo;
        if (key) this.loadDemoPreset(key);
      });
    });

    // 18. Guide Modal
    const btnOpenGuide = document.getElementById('btnOpenGuide');
    const guideModal = document.getElementById('guideModal');
    if (btnOpenGuide && guideModal) {
      btnOpenGuide.addEventListener('click', () => guideModal.classList.add('open'));
    }

    // 19. Export Modal & Pipeline
    const btnOpenExport = document.getElementById('btnOpenExport');
    const exportModal = document.getElementById('exportModal');
    if (btnOpenExport && exportModal) {
      btnOpenExport.addEventListener('click', () => {
        exportModal.classList.add('open');
        this.updateExportModalLabels();
      });
    }

    // Resolution Card Selection
    document.querySelectorAll('.export-res-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.export-res-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const res = card.dataset.res || '1080p';
        const sel = document.getElementById('exportQualitySelect');
        if (sel) sel.value = res;
      });
    });

    // FPS Pills Selection
    document.querySelectorAll('.export-fps-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.export-fps-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const fps = pill.dataset.fps || '60';
        const sel = document.getElementById('exportFpsSelect');
        if (sel) sel.value = fps;
      });
    });

    // Smart Duration Snapping
    const btnSnapLyrics = document.getElementById('btnSnapLyricsEnd');
    if (btnSnapLyrics) {
      btnSnapLyrics.addEventListener('click', () => {
        const lines = this.lyrics ? this.lyrics.getLines() : [];
        const lyricsEnd = lines.length > 0 ? Math.max(...lines.map(l => l.end || 0)) : 0;
        const durInput = document.getElementById('exportDurationInput');
        if (durInput && lyricsEnd > 0) {
          durInput.value = (lyricsEnd + 0.8).toFixed(1);
          this.showToast('Snapped duration to lyrics end (' + durInput.value + 's)');
        }
      });
    }

    const btnSnapAudio = document.getElementById('btnSnapAudioEnd');
    if (btnSnapAudio) {
      btnSnapAudio.addEventListener('click', () => {
        const audioDur = this.audio ? this.audio.getTrimmedDuration() : 22.0;
        const durInput = document.getElementById('exportDurationInput');
        if (durInput && audioDur > 0) {
          durInput.value = audioDur.toFixed(1);
          this.showToast('Snapped duration to audio length (' + durInput.value + 's)');
        }
      });
    }

    // Subtitle / Lyrics Visibility Switch (Disable for clean video + audio FX export)
    const toggleShowLyrics = document.getElementById('toggleShowLyrics');
    if (toggleShowLyrics) {
      toggleShowLyrics.checked = this.renderer.showLyrics !== false;
      toggleShowLyrics.addEventListener('change', (e) => {
        this.renderer.showLyrics = e.target.checked;
        this.drawFrame();
        this.showToast(e.target.checked ? 'Lyrics & Subtitles enabled' : 'Subtitles disabled (Clean video + Audio FX mode)');
        this.saveSettingsToLocalStorage();
      });
    }

    const btnStartExport = document.getElementById('btnStartExport');
    if (btnStartExport) {
      btnStartExport.addEventListener('click', () => this.startExportVideo());
    }

    if (this.btnDownloadVideo) {
      this.btnDownloadVideo.addEventListener('click', () => this.downloadExportedVideo());
    }

    // Modal Close buttons
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-backdrop');
        if (modal) {
          if (modal.id === 'exportModal') {
            this.cancelExportVideo();
          } else {
            modal.classList.remove('open');
          }
        }
      });
    });

    const btnCloseExport = document.getElementById('btnCloseExport');
    if (btnCloseExport) {
      btnCloseExport.addEventListener('click', () => this.cancelExportVideo());
    }

    const btnCloseExportX = document.getElementById('btnCloseExportX');
    if (btnCloseExportX) {
      btnCloseExportX.addEventListener('click', () => this.cancelExportVideo());
    }

    const exportModalEl = document.getElementById('exportModal');
    if (exportModalEl) {
      exportModalEl.addEventListener('click', (e) => {
        if (e.target === exportModalEl) {
          this.cancelExportVideo();
        }
      });
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const m = document.getElementById('exportModal');
        if (m && m.classList.contains('open')) {
          this.cancelExportVideo();
        }
      }
    });

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
      });
    });

    // Undo / Redo
        // Removal & Reset Action Buttons
    const btnRemoveAudio = document.getElementById('btnRemoveAudio');
    if (btnRemoveAudio) {
      btnRemoveAudio.addEventListener('click', () => this.removeCustomAudio());
    }

    const btnClearLyrics = document.getElementById('btnClearLyrics');
    if (btnClearLyrics) {
      btnClearLyrics.addEventListener('click', () => this.clearAllLyrics());
    }


    const btnResetSettings = document.getElementById('btnResetSettings');
    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => this.resetAllSettings());
    }

    const btnUndo = document.getElementById('btnUndo');
    if (btnUndo) btnUndo.addEventListener('click', () => this.undo());
    const btnRedo = document.getElementById('btnRedo');
    if (btnRedo) btnRedo.addEventListener('click', () => this.redo());

    window.addEventListener('resize', () => {
      this.adjustStageZoom();
      this.drawWaveform();
    });
  }

  async loadUserMediaFile(file) {
    this.showToast('Decoding media file with Web Audio...');
    try {
      if (file.type.startsWith('video/')) {
        await this.audio.loadVideoAudio(file);
        const videoUrl = URL.createObjectURL(file);
        const v = document.createElement('video');
        v.src = videoUrl;
        v.muted = this.renderer.bgVideoMuted;
        v.volume = this.renderer.bgVideoVolume;
        v.loop = true;
        v.playsInline = true;
        if (this.audio.isPlaying) {
          await v.play().catch(() => {});
        } else {
          v.pause();
        }
        this.renderer.bgVideo = v;
        this.renderer.bgType = 'video';
      } else {
        await this.audio.loadAudioFile(file, file.name);
      }

      if (this.storage) {
        try {
          await this.storage.saveItem('audio', {
            id: 'current_audio',
            name: file.name,
            type: file.type,
            blob: file,
            timestamp: Date.now()
          });
        } catch (err) {
          console.warn('Failed to save audio to IndexedDB:', err);
        }
      }

      const trackNameDisplay = document.getElementById('trackNameDisplay');
      if (trackNameDisplay) trackNameDisplay.textContent = file.name;
      const trackSourceBadge = document.getElementById('trackSourceBadge');
      if (trackSourceBadge) {
        trackSourceBadge.textContent = 'Saved in Storage';
        trackSourceBadge.style.background = '#1ed760';
        trackSourceBadge.style.color = '#000';
      }

      const btnRemoveAudio = document.getElementById('btnRemoveAudio');
      if (btnRemoveAudio) btnRemoveAudio.style.display = 'flex';

      this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
      this.drawWaveform();
      this.showToast('Media decoded & saved to local storage!');
    } catch (e) {
      console.error(e);
      this.showToast('Failed to decode file: ' + e.message);
    }
  }

  saveHistoryState() {
    const state = {
      lines: JSON.parse(JSON.stringify(this.lyrics.getLines())),
      title: JSON.parse(JSON.stringify(this.renderer.title)),
      subtitle: JSON.parse(JSON.stringify(this.renderer.subtitle)),
      crop: JSON.parse(JSON.stringify(this.renderer.crop)),
      trimStart: this.audio.trimStart,
      trimEnd: this.audio.trimEnd
    };

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(state);
    if (this.history.length > this.maxHistory) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.applyHistoryState(this.history[this.historyIndex]);
    this.showToast('Undo');
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.applyHistoryState(this.history[this.historyIndex]);
    this.showToast('Redo');
  }

  applyHistoryState(state) {
    if (!state) return;
    this.lyrics.setLines(state.lines);
    this.renderer.title = { ...state.title };
    this.renderer.subtitle = { ...state.subtitle };
    this.renderer.crop = { ...state.crop };
    this.audio.setTrim(state.trimStart, state.trimEnd);
    this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
    this.renderLyricsList();
    this.drawWaveform();
  }

  debouncedSaveSettings() {
    clearTimeout(this.saveSettingsTimer);
    this.saveSettingsTimer = setTimeout(() => {
      this.saveSettingsToLocalStorage();
    }, 150);
  }

  saveSettingsToLocalStorage() {
    try {
      const settings = {
        aspectRatio: this.renderer.aspectRatio,
        theme: this.renderer.theme,
        wipeStyle: this.renderer.wipeStyle,
        fontFamily: this.renderer.fontFamily,
        fontSize: this.renderer.fontSize,
        lyricYPercent: this.renderer.lyricYPercent,
        sungColor: this.renderer.sungColor,
        sungSecondaryColor: this.renderer.sungSecondaryColor,
        glowColor: this.renderer.glowColor,
        glowBlur: this.renderer.glowBlur,
        unsungColor: this.renderer.unsungColor,
        unsungOpacity: this.renderer.unsungOpacity,
        strokeColor: this.renderer.strokeColor,
        strokeWidth: this.renderer.strokeWidth,
        bgType: this.renderer.bgType,
        proceduralStyle: this.renderer.proceduralStyle,
        bgOverlayColor: this.renderer.bgOverlayColor,
        bgOverlayOpacity: this.renderer.bgOverlayOpacity,
        bgOverlayColor: this.renderer.bgOverlayColor,
        bgOverlayOpacity: this.renderer.bgOverlayOpacity,
        title: {
          enabled: this.renderer.title.enabled,
          text: this.renderer.title.text,
          style: this.renderer.title.style,
          fontSize: this.renderer.title.fontSize,
          rotation: this.renderer.title.rotation,
          nx: this.renderer.title.nx,
          ny: this.renderer.title.ny,
          color: this.renderer.title.color,
          glowColor: this.renderer.title.glowColor,
          fontFamily: this.renderer.title.fontFamily
        },
        showLyrics: this.renderer.showLyrics,
        subtitle: {
          enabled: this.renderer.subtitle.enabled,
          text: this.renderer.subtitle.text,
          fontSize: this.renderer.subtitle.fontSize,
          nx: this.renderer.subtitle.nx,
          ny: this.renderer.subtitle.ny,
          color: this.renderer.subtitle.color,
          showBg: this.renderer.subtitle.showBg,
          fontFamily: this.renderer.subtitle.fontFamily
        },
        crop: { ...this.renderer.crop },
        audioTrim: {
          start: this.audio.trimStart,
          end: this.audio.trimEnd
        },
        audioFx: {
          preset: this.audio.fx.preset,
          pitchShiftSemitones: this.audio.fx.pitchShiftSemitones,
          playbackSpeed: this.audio.fx.playbackSpeed,
          stereoWidth: this.audio.fx.stereoWidth,
          reverbWet: this.audio.fx.reverbWet,
          echoWet: this.audio.fx.echoWet,
          eqBass: this.audio.fx.eqBass,
          eqTreble: this.audio.fx.eqTreble,
          lofiWarmth: this.audio.fx.lofiWarmth,
          spatial8D: this.audio.fx.spatial8D,
          radioFilter: this.audio.fx.radioFilter,
          vocalMixBalance: this.audio.vocalMixBalance,
          vocalAttenuation: this.audio.vocalReductionDepth,
          vocalMode: this.audio.vocalMode
        },
        bgVideoAudio: {
          muted: this.renderer.bgVideoMuted,
          volume: this.renderer.bgVideoVolume
        }
      };
      localStorage.setItem('karaoke_studio_settings_v2', JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  restoreSettingsFromLocalStorage() {
    try {
      const raw = localStorage.getItem('karaoke_studio_settings_v2');
      if (!raw) return false;
      const s = JSON.parse(raw);

      if (s.aspectRatio) this.renderer.setAspectRatio(s.aspectRatio);
      if (s.theme) this.renderer.theme = s.theme;
      if (s.wipeStyle) this.renderer.wipeStyle = s.wipeStyle;
      if (s.fontFamily) this.renderer.fontFamily = s.fontFamily;
      if (typeof s.fontSize === 'number') this.renderer.fontSize = s.fontSize;
      if (typeof s.lyricYPercent === 'number') this.renderer.lyricYPercent = s.lyricYPercent;
      if (s.sungColor) this.renderer.sungColor = s.sungColor;
      if (s.sungSecondaryColor) this.renderer.sungSecondaryColor = s.sungSecondaryColor;
      if (s.glowColor) this.renderer.glowColor = s.glowColor;
      if (typeof s.glowBlur === 'number') this.renderer.glowBlur = s.glowBlur;
      if (s.unsungColor) this.renderer.unsungColor = s.unsungColor;
      if (typeof s.unsungOpacity === 'number') this.renderer.unsungOpacity = s.unsungOpacity;
      if (s.strokeColor) this.renderer.strokeColor = s.strokeColor;
      if (typeof s.strokeWidth === 'number') this.renderer.strokeWidth = s.strokeWidth;
      if (s.proceduralStyle) this.renderer.proceduralStyle = s.proceduralStyle;
      if (s.bgType) this.renderer.bgType = s.bgType;
      if (s.bgOverlayColor) this.renderer.bgOverlayColor = s.bgOverlayColor;
      if (typeof s.bgOverlayOpacity === 'number') this.renderer.bgOverlayOpacity = s.bgOverlayOpacity;
      if (s.bgOverlayColor) this.renderer.bgOverlayColor = s.bgOverlayColor;
      if (typeof s.bgOverlayOpacity === 'number') this.renderer.bgOverlayOpacity = s.bgOverlayOpacity;

      if (typeof s.showLyrics === 'boolean') {
        this.renderer.showLyrics = s.showLyrics;
        const toggle = document.getElementById('toggleShowLyrics');
        if (toggle) toggle.checked = s.showLyrics;
      }
      if (s.title) Object.assign(this.renderer.title, s.title);
      if (s.subtitle) Object.assign(this.renderer.subtitle, s.subtitle);
      if (s.crop) Object.assign(this.renderer.crop, s.crop);
      if (s.audioTrim) this.audio.setTrim(s.audioTrim.start, s.audioTrim.end);
      if (s.audioFx) {
        if (typeof s.audioFx.vocalMixBalance === 'number') this.audio.setVocalMix(s.audioFx.vocalMixBalance);
        Object.assign(this.audio.fx, s.audioFx);
        if (typeof s.audioFx.vocalAttenuation === 'number') this.audio.setVocalAttenuation(s.audioFx.vocalAttenuation);
        if (s.audioFx.vocalMode) this.audio.setVocalMode(s.audioFx.vocalMode);
        this.audio.updateDSPParams();
        this.syncFXControlsFromEngine();
      }
      if (s.bgVideoAudio) {
        this.renderer.bgVideoMuted = s.bgVideoAudio.muted;
        this.renderer.bgVideoVolume = s.bgVideoAudio.volume;
        if (this.renderer.bgVideo) {
          this.renderer.bgVideo.muted = s.bgVideoAudio.muted;
          this.renderer.bgVideo.volume = s.bgVideoAudio.volume;
        }
      }
      return true;
    } catch (e) {
      console.warn('Failed to restore settings:', e);
      return false;
    }
  }

  saveLyricsToStorage() {
    try {
      const lines = this.lyrics.getLines();
      localStorage.setItem('karaoke_studio_lyrics_v2', JSON.stringify(lines));
      if (this.storage) {
        this.storage.saveItem('lyrics', { id: 'current_lyrics', lines: lines, timestamp: Date.now() }).catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to save lyrics:', e);
    }
  }

  async restoreSavedLyrics() {
    try {
      const raw = localStorage.getItem('karaoke_studio_lyrics_v2');
      if (raw) {
        const lines = JSON.parse(raw);
        if (Array.isArray(lines) && lines.length > 0) {
          this.lyrics.setLines(lines, false);
          return true;
        }
      }
      if (this.storage) {
        const item = await this.storage.getItem('lyrics', 'current_lyrics');
        if (item && Array.isArray(item.lines) && item.lines.length > 0) {
          this.lyrics.setLines(item.lines, false);
          return true;
        }
      }
    } catch (e) {
      console.warn('Failed to restore lyrics:', e);
    }
    return false;
  }

  async restoreCustomAudio() {
    if (!this.storage) return false;
    try {
      const item = await this.storage.getItem('audio', 'current_audio');
      if (item && item.blob) {
        if (item.type && item.type.startsWith('video/')) {
          await this.audio.loadVideoAudio(item.blob);
          const videoUrl = URL.createObjectURL(item.blob);
          const v = document.createElement('video');
          v.src = videoUrl;
          v.muted = this.renderer.bgVideoMuted;
          v.volume = this.renderer.bgVideoVolume;
          v.loop = true;
          v.playsInline = true;
          await v.play().catch(() => {});
          this.renderer.bgVideo = v;
          this.renderer.bgType = 'video';
        } else {
          await this.audio.loadAudioFile(item.blob, item.name || 'Saved Audio');
        }

        const trackNameDisplay = document.getElementById('trackNameDisplay');
        if (trackNameDisplay) trackNameDisplay.textContent = item.name || 'Saved Audio';
        const trackSourceBadge = document.getElementById('trackSourceBadge');
        if (trackSourceBadge) {
          trackSourceBadge.textContent = 'Saved in Storage';
          trackSourceBadge.style.background = '#1ed760';
          trackSourceBadge.style.color = '#000';
        }

        const btnRemoveAudio = document.getElementById('btnRemoveAudio');
        if (btnRemoveAudio) btnRemoveAudio.style.display = 'flex';

        return true;
      }
    } catch (e) {
      console.warn('Failed to restore custom audio:', e);
    }
    return false;
  }

  async restoreCustomBgMedia() {
    if (!this.storage) return false;
    try {
      const item = await this.storage.getItem('backgrounds', 'current_bg');
      if (item && item.blob) {
        if (item.type && item.type.startsWith('video/')) {
          const videoUrl = URL.createObjectURL(item.blob);
          const v = document.createElement('video');
          v.src = videoUrl;
          v.muted = this.renderer.bgVideoMuted;
          v.volume = this.renderer.bgVideoVolume;
          v.loop = true;
          v.playsInline = true;
          await v.play().catch(() => {});
          this.renderer.bgVideo = v;
          this.renderer.bgType = 'video';
        } else {
          const imgUrl = URL.createObjectURL(item.blob);
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = imgUrl;
          });
          this.renderer.bgImage = img;
          this.renderer.bgType = 'image';
        }

        const btnRemoveBgMedia = document.getElementById('btnRemoveBgMedia');
        if (btnRemoveBgMedia) btnRemoveBgMedia.style.display = 'flex';
        return true;
      }
    } catch (e) {
      console.warn('Failed to restore custom background:', e);
    }
    return false;
  }

  async removeCustomAudio() {
    this.audio.pause();
    if (this.storage) {
      await this.storage.deleteItem('audio', 'current_audio');
    }
    localStorage.removeItem('karaoke_studio_custom_audio_meta');
    await this.audio.synthesizeSong('midnight_groove');
        this.audio.setVocalMode('instrumental');
        this.updateVocalUI('instrumental');

    const trackNameDisplay = document.getElementById('trackNameDisplay');
    if (trackNameDisplay) trackNameDisplay.textContent = 'Spotify Studio (Clean Funk Demo)';
    const trackSourceBadge = document.getElementById('trackSourceBadge');
    if (trackSourceBadge) {
      trackSourceBadge.textContent = 'Built-In DSP';
      trackSourceBadge.style.background = '';
      trackSourceBadge.style.color = '';
    }

    const btnRemoveAudio = document.getElementById('btnRemoveAudio');
    if (btnRemoveAudio) btnRemoveAudio.style.display = 'none';

    this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
    this.drawWaveform();
    this.showToast('Custom audio removed from local storage');
  }

  async clearAllLyrics() {
    this.saveHistoryState();
    this.lyrics.setLines([]);
    localStorage.removeItem('karaoke_studio_lyrics_v2');
    if (this.storage) {
      await this.storage.deleteItem('lyrics', 'current_lyrics');
    }
    this.renderLyricsList();
    this.showToast('Lyrics cleared & removed from local storage');
  }

  async removeCustomBgMedia() {
    if (this.storage) {
      await this.storage.deleteItem('backgrounds', 'current_bg');
    }
    this.renderer.bgVideo = null;
    this.renderer.bgImage = null;
    this.renderer.bgType = 'procedural';

    const bgMediaInput = document.getElementById('bgMediaInput');
    if (bgMediaInput) bgMediaInput.value = '';

    const btnRemoveBgMedia = document.getElementById('btnRemoveBgMedia');
    if (btnRemoveBgMedia) btnRemoveBgMedia.style.display = 'none';

    this.saveSettingsToLocalStorage();
    this.showToast('Custom background removed from local storage');
  }

  updateExportModalLabels() {
    const audioDur = this.audio ? this.audio.getTrimmedDuration() : 22.0;
    const lines = this.lyrics ? this.lyrics.getLines() : [];
    const lyricsEnd = lines.length > 0 ? Math.max(...lines.map(l => l.end || 0)) : 0;

    const audioLengthLabel = document.getElementById('exportAudioLengthLabel');
    if (audioLengthLabel) audioLengthLabel.textContent = audioDur.toFixed(1) + 's';

    const lyricsEndLabel = document.getElementById('exportLyricsEndLabel');
    if (lyricsEndLabel) lyricsEndLabel.textContent = lyricsEnd > 0 ? (lyricsEnd.toFixed(1) + 's') : 'None';

    const durInput = document.getElementById('exportDurationInput');
    if (durInput) {
      // Smart duration: If lyrics exist and end before audio, stop at lyrics outro (+0.8s)
      const smartDur = (lyricsEnd > 0 && lyricsEnd < audioDur) ? Math.min(audioDur, lyricsEnd + 0.8) : audioDur;
      durInput.value = smartDur.toFixed(1);
    }
  }

  async resetAllSettings() {
    localStorage.removeItem('karaoke_studio_settings_v2');
    this.renderer.applyTheme('spotify_clean');
    this.renderer.setAspectRatio('9:16');
    this.renderer.fontSize = 56;
    this.renderer.lyricYPercent = 50;
    this.renderer.title.enabled = false;
    this.renderer.subtitle.enabled = false;
    this.renderer.crop = { scale: 1.0, panX: 0, panY: 0, cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0 };
    this.audio.setTrim(0, this.audio.duration || 22.0);
    this.audio.applyFxPreset('clean_original');
    this.audio.setVocalMode('instrumental');
    this.updateVocalUI('instrumental');
    this.updateControlsFromState();
    this.adjustStageZoom();
    this.saveSettingsToLocalStorage();
    this.showToast('Studio settings reset to clean default');
  }

  cancelExportVideo() {
    const wasExporting = this.isExporting;
    this.isExporting = false;

    // 1. Immediately pause and stop audio playback
    if (this.audio) {
      this.audio.onPlaybackEnd = null;
      try {
        this.audio.pause();
      } catch (e) {}
    }

    // 2. Safely stop and discard MediaRecorder without triggering completion
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
      try {
        if (this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (e) {}
      this.mediaRecorder = null;
    }
    this.recordedChunks = [];

    // 3. Restore canvas resolution to previous preview aspect ratio
    if (this.exportOriginalRatio) {
      this.renderer.setAspectRatio(this.exportOriginalRatio);
    }
    this.adjustStageZoom();

    // 4. Reset Export UI elements
    const btnStart = document.getElementById('btnStartExport');
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.textContent = 'Start Smooth Export';
    }
    const btnCloseExport = document.getElementById('btnCloseExport');
    if (btnCloseExport) {
      btnCloseExport.textContent = 'Cancel';
    }
    const statusText = document.getElementById('exportStatusText');
    if (statusText) {
      statusText.textContent = wasExporting ? 'Export cancelled. Ready to render universal MP4...' : 'Ready to render universal MP4...';
    }
    const progressFill = document.getElementById('exportProgressFill');
    if (progressFill) progressFill.style.width = '0%';
    const frameCounter = document.getElementById('exportFrameCounter');
    if (frameCounter) frameCounter.textContent = '';

    // 5. Close export modal
    const modal = document.getElementById('exportModal');
    if (modal) modal.classList.remove('open');

    if (wasExporting) {
      this.showToast('Video export cancelled');
    }
  }

  async startExportVideo() {
    if (this.isExporting) return;
    this.isExporting = true;

    const btnStart = document.getElementById('btnStartExport');
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.textContent = 'Exporting Video...';
    }
    const btnCloseExport = document.getElementById('btnCloseExport');
    if (btnCloseExport) {
      btnCloseExport.textContent = 'Cancel Export';
    }

    // Read selected resolution from active card or select
    const activeResCard = document.querySelector('.export-res-card.active');
    const qualitySelect = document.getElementById('exportQualitySelect');
    const quality = activeResCard ? activeResCard.dataset.res : (qualitySelect ? qualitySelect.value : '1080p');

    // Read selected FPS from active pill or select
    const activeFpsPill = document.querySelector('.export-fps-pill.active');
    const fpsSelect = document.getElementById('exportFpsSelect');
    const fps = activeFpsPill ? parseInt(activeFpsPill.dataset.fps, 10) : (fpsSelect ? parseInt(fpsSelect.value, 10) : 60);

    const statusText = document.getElementById('exportStatusText');
    const progressFill = document.getElementById('exportProgressFill');
    const frameCounter = document.getElementById('exportFrameCounter');
    const videoResult = document.getElementById('exportVideoResult');

    if (videoResult) videoResult.style.display = 'none';
    if (statusText) statusText.textContent = 'Configuring ' + quality.toUpperCase() + ' ' + fps + 'FPS video pipeline...';
    if (progressFill) progressFill.style.width = '3%';
    if (frameCounter) frameCounter.textContent = '0 / 0';

    // 1. Save original preview dimensions
    const originalRatio = this.renderer.aspectRatio || '9:16';
    this.exportOriginalRatio = originalRatio;

    // 2. Configure canvas resolution for chosen export quality (720p, 1080p, 2K, 4K)
    const exportDims = this.renderer.setResolution(quality);
    this.adjustStageZoom();

    // 3. Pause and seek audio to trim start
    this.audio.pause();
    this.audio.seek(this.audio.trimStart);

    // 4. Capture high-FPS canvas stream with pure audio track
    const canvasStream = this.canvas.captureStream(fps);
    const audioTrack = this.audio.getAudioTrack();
    if (audioTrack) {
      canvasStream.addTrack(audioTrack instanceof MediaStreamTrack ? audioTrack : (audioTrack[0] || audioTrack));
    }

    // 5. Select universal video container and calculate optimal bitrate
    let mime = 'video/mp4;codecs=avc1.4d402a,mp4a.40.2';
    if (!MediaRecorder.isTypeSupported(mime)) {
      mime = 'video/mp4';
      if (!MediaRecorder.isTypeSupported(mime)) {
        mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
          ? 'video/webm;codecs=vp9,opus'
          : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
      }
    }

    // Bitrate scaling based on export resolution
    let targetBitrate = 14000000; // 14 Mbps for 1080p
    if (quality === '720p') targetBitrate = 6000000;
    else if (quality === '2k') targetBitrate = 26000000;
    else if (quality === '4k') targetBitrate = 48000000;

    this.recordedChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: targetBitrate
      });
    } catch (e) {
      this.mediaRecorder = new MediaRecorder(canvasStream, { videoBitsPerSecond: targetBitrate });
    }

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
    };

    // Calculate exact export duration - ZERO trailing empty frames
    const checkAutoStop = document.getElementById('checkAutoStopExport');
    const shouldAutoStop = checkAutoStop ? checkAutoStop.checked : true;
    const durInput = document.getElementById('exportDurationInput');
    const customDuration = durInput ? parseFloat(durInput.value) : 0;

    const audioTrimmedDur = this.audio.getTrimmedDuration();
    const lines = this.lyrics ? this.lyrics.getLines() : [];
    const lastLyricEnd = lines.length > 0 ? Math.max(...lines.map(l => l.end || 0)) : 0;

    let exportDuration = (customDuration > 0.5) ? customDuration : audioTrimmedDur;
    if (shouldAutoStop && lastLyricEnd > 0 && (lastLyricEnd + 1.2) < exportDuration) {
      exportDuration = Math.min(exportDuration, lastLyricEnd + 0.8);
    }
    exportDuration = Math.max(1.0, exportDuration);
    const totalFrames = Math.round(exportDuration * fps);
    const startTime = performance.now();

    let hasStopped = false;
    const stopRecordingNow = () => {
      if (hasStopped) return;
      hasStopped = true;
      this.audio.pause();
      try {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      } catch (e) {}
    };

    // Callback when audio playback finishes
    this.audio.onPlaybackEnd = () => {
      if (this.isExporting && shouldAutoStop) {
        stopRecordingNow();
      }
    };

    this.mediaRecorder.onstop = async () => {
      this.audio.onPlaybackEnd = null;
      if (statusText) statusText.textContent = 'Optimizing Universal FastStart MP4 for global playback...';
      if (progressFill) progressFill.style.width = '94%';

      let rawBlob = new Blob(this.recordedChunks, { type: mime || 'video/mp4' });

      // 6. Universal MP4 Server Optimization via FFmpeg FastStart (H.264 / AAC)
      let finalBlob = rawBlob;
      try {
        const remuxUrl = '/api/remux-mp4?filename=karaoke_' + quality + '_' + Date.now() + '.mp4';
        const remuxResp = await fetch(remuxUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: rawBlob
        });
        if (remuxResp.ok) {
          finalBlob = await remuxResp.blob();
        }
      } catch (err) {
        // Fallback: fix webm duration in browser if offline
        try {
          if (window.fixWebmDuration) {
            finalBlob = await window.fixWebmDuration(rawBlob, exportDuration * 1000);
          }
        } catch (e) {}
      }

      this.exportBlob = finalBlob;
      this.exportQuality = quality;
      const exportUrl = URL.createObjectURL(finalBlob);

      if (this.exportVideoPlayer) {
        this.exportVideoPlayer.src = exportUrl;
        if (videoResult) videoResult.style.display = 'block';
      }

      // 7. Restore preview dimensions on canvas
      this.renderer.setAspectRatio(originalRatio);
      this.adjustStageZoom();

      if (statusText) statusText.textContent = 'Rendering 100% complete! Universal MP4 ready for download.';
      if (progressFill) progressFill.style.width = '100%';
      if (frameCounter) frameCounter.textContent = totalFrames + ' / ' + totalFrames + ' (100%)';
      if (btnStart) { btnStart.disabled = false; btnStart.textContent = 'Start Smooth Export'; }
      if (btnCloseExport) btnCloseExport.textContent = 'Close';
      this.isExporting = false;
      this.showToast('Universal ' + quality.toUpperCase() + ' MP4 video export finished!');
    };

    // 8. Start recording and audio playback in sync
    this.mediaRecorder.start(200);
    this.audio.play(this.audio.trimStart);

    // 9. Smooth frame-by-frame progress tracking with auto-stop
    const updateProgress = () => {
      if (!this.isExporting) return;
      const elapsed = (performance.now() - startTime) / 1000;
      const pct = Math.min(92, Math.round((elapsed / exportDuration) * 92));
      const currentFrame = Math.min(totalFrames, Math.round(elapsed * fps));

      if (progressFill) progressFill.style.width = pct + '%';
      if (statusText) statusText.textContent = 'Rendering ' + quality.toUpperCase() + ' video: ' + pct + '%';
      if (frameCounter) frameCounter.textContent = 'Frame ' + currentFrame + ' / ' + totalFrames;

      if (elapsed >= exportDuration || (shouldAutoStop && !this.audio.isPlaying && elapsed > 1.0)) {
        stopRecordingNow();
      } else {
        requestAnimationFrame(updateProgress);
      }
    };
    requestAnimationFrame(updateProgress);
  }

  downloadExportedVideo() {
    if (!this.exportBlob) return;
    const quality = this.exportQuality || '1080p';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(this.exportBlob);
    a.download = 'karaoke_studio_' + quality + '_' + Date.now() + '.mp4';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast('Downloaded Universal ' + quality.toUpperCase() + ' MP4 video successfully!');
  }
  async checkServerStatus() {
    try {
      const resp = await fetch('/api/status');
      if (resp.ok) {
        const data = await resp.json();
        const serverBadge = document.getElementById('serverStatusBadge');
        if (serverBadge) {
          serverBadge.innerHTML = `Server Active (Port ${data.port}) ${data.ffmpeg ? '[OK] FFmpeg Ready' : ''}`;
          serverBadge.classList.add('active');
        }
      }
    } catch (e) {}
  }

    async handleAutoTranscribe() {
    if (!this.transcriber) {
      this.transcriber = new KaraokeAITranscriber(this.audio, this.lyrics);
    }

    const engineSelect = document.getElementById('transcribeEngineSelect');
    const keyInput = document.getElementById('inputTranscribeApiKey');
    const progBox = document.getElementById('transcribeProgressContainer');
    const progBar = document.getElementById('transcribeProgressBar');
    const progPct = document.getElementById('transcribeProgressPct');
    const statusLabel = document.getElementById('transcribeStatusLabel');
    const btnStart = document.getElementById('btnStartAutoTranscribe');
    const modal = document.getElementById('transcribeModal');
    const checkReplace = document.getElementById('checkTranscribeReplace');

    const provider = engineSelect ? engineSelect.value : 'groq';
    const apiKey = keyInput ? keyInput.value.trim() : '';

    if (provider === 'browser_speech') {
      if (modal) modal.classList.remove('open');
      this.showToast('Starting playback and live browser speech recognition...');
      this.audio.seek(this.audio.trimStart);
      this.audio.play();

      if (checkReplace && checkReplace.checked) {
        this.lyrics.setLines([]);
        this.renderLyricsList();
      }

      this.transcriber.startLiveSpeechRecognition((line) => {
        const lines = this.lyrics.getLines();
        lines.push(line);
        this.lyrics.setLines(lines);
        this.renderLyricsList();
        this.showToast('Recognized: "' + line.text + '"');
      }, () => {
        this.showToast('Live voice recognition ended.');
      });
      return;
    }

    if (progBox) progBox.style.display = 'block';
    if (btnStart) btnStart.disabled = true;

    this.transcriber.onProgress = (pct, label) => {
      if (progBar) progBar.style.width = pct + '%';
      if (progPct) progPct.textContent = pct + '%';
      if (statusLabel) statusLabel.textContent = label;
    };

    try {
      this.saveHistoryState();
      const lines = await this.transcriber.transcribeAudio({
        provider: provider,
        apiKey: apiKey
      });

      if (checkReplace && checkReplace.checked) {
        this.lyrics.setLines(lines);
      } else {
        const existing = this.lyrics.getLines();
        this.lyrics.setLines(existing.concat(lines));
      }

      this.renderLyricsList();
      this.debouncedSaveSettings();

      if (modal) modal.classList.remove('open');
      this.showToast('Auto-transcribed ' + lines.length + ' lyric lines from audio!');
    } catch (err) {
      console.error('Transcription error:', err);
      this.showToast(err.message);
      if (statusLabel) statusLabel.textContent = 'Error: ' + err.message;
    } finally {
      if (btnStart) btnStart.disabled = false;
    }
  }


  showToast(msg) {
    const toast = document.getElementById('studioToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }
}

// Bootstrap Studio on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  window.studioApp = new KaraokeApp();
  window.app = window.studioApp;
  window.studioApp.init();
});
