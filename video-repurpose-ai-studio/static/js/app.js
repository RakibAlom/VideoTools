// Main Application Controller for VideoRepurpose AI Studio

const App = {
  currentStep: 1,
  activeProjectId: null,
  activeProject: null,
  config: null,
  languagesCatalog: null,
  selectedVideoFile: null,
  pollInterval: null,
  delogoCoords: { x: 0.80, y: 0.03, w: 0.18, h: 0.12 },
  watermarkImagePath: null,
  textOverlays: [],
  sceneCuts: [],
  pendingCutIn: null,

  async init() {
    this.bindEvents();
    await this.loadConfig();
    await this.loadLanguages();
    await this.updateNarratorVoiceList();
    this.updateTargetLanguageLabel();
    await this.loadRecentProjects();
  },

  bindEvents() {
    // Project selector
    document.getElementById("select-recent-projects")?.addEventListener("change", (e) => {
      if (e.target.value) {
        this.loadProject(e.target.value);
      }
    });

    // Stepper navigation buttons
    document.querySelectorAll(".step-pill[data-step]").forEach(pill => {
      pill.addEventListener("click", () => {
        const step = parseInt(pill.getAttribute("data-step"));
        this.goToStep(step);
      });
    });

    // Video Upload Dropzone
    const dropzone = document.getElementById("dropzone-video");
    const fileInput = document.getElementById("input-video-file");

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", () => fileInput.click());
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleVideoFileSelected(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleVideoFileSelected(e.target.files[0]);
        }
      });
    }

    // Step 1: Upload button & language changes
    document.getElementById("btn-start-upload-process")?.addEventListener("click", () => this.startUploadAndProcess());
    
    document.getElementById("select-target-lang")?.addEventListener("change", async (e) => {
      const step2Select = document.getElementById("select-step2-target-lang");
      if (step2Select) step2Select.value = e.target.value;
      if (this.activeProject) this.activeProject.target_language = e.target.value;
      await this.updateNarratorVoiceList();
      this.updateTargetLanguageLabel();
    });

    const step2Select = document.getElementById("select-step2-target-lang");
    if (step2Select) {
      step2Select.addEventListener("change", async (e) => {
        const step1Select = document.getElementById("select-target-lang");
        if (step1Select) step1Select.value = e.target.value;
        if (this.activeProject) this.activeProject.target_language = e.target.value;
        await this.updateNarratorVoiceList();
        this.updateTargetLanguageLabel();
        this.updateDurationShiftUI();
      });
    }

    // Step 2 & 4: Anti-Copyright Duration Shift Listeners (Synchronized)
    const onDurationShiftChange = (e) => {
      const val = parseFloat(e.target.value);
      this.updateDurationShiftUI(val);
      if (this.activeProjectId) {
        API.updateProjectSettings(this.activeProjectId, { duration_shift: val }).catch(() => {});
      }
    };
    document.getElementById("select-step2-duration-shift")?.addEventListener("change", onDurationShiftChange);
    document.getElementById("select-duration-shift")?.addEventListener("change", onDurationShiftChange);

    // Step 2: Transcript actions
    document.getElementById("btn-transcribe-audio")?.addEventListener("click", () => this.transcribeAudio());
    document.getElementById("btn-rewrite-all")?.addEventListener("click", () => this.rewriteAllCommentary());
    document.getElementById("btn-add-segment-modal")?.addEventListener("click", () => this.openAddSegmentModal());
    document.getElementById("btn-save-new-segment")?.addEventListener("click", () => this.saveNewSegment());
    document.getElementById("tab-btn-full-script")?.addEventListener("click", () => this.switchScriptViewMode("full"));
    document.getElementById("tab-btn-segments-view")?.addEventListener("click", () => this.switchScriptViewMode("segments"));
    document.getElementById("btn-save-full-script")?.addEventListener("click", () => this.saveFullScript());
    document.getElementById("btn-save-full-original")?.addEventListener("click", () => this.saveFullOriginalScript());

    // Step 3: Voice & Audio actions
    document.getElementById("select-voice-provider")?.addEventListener("change", async (e) => {
      const prov = e.target.value;
      if (this.activeProjectId) {
        try {
          await API.updateProjectSettings(this.activeProjectId, { voice_provider: prov });
        } catch (_) {}
      }
      await this.updateNarratorVoiceList();
    });
    document.getElementById("select-narrator-voice")?.addEventListener("change", async (e) => {
      const v = e.target.value;
      if (this.activeProjectId && v) {
        try {
          await API.updateProjectSettings(this.activeProjectId, { narrator_voice: v });
        } catch (_) {}
      }
    });
    document.getElementById("btn-test-voice-sample")?.addEventListener("click", () => this.testVoiceSample());
    document.getElementById("btn-play-bgm-demo")?.addEventListener("click", () => this.playBgmDemo());
    document.getElementById("range-bgm-volume")?.addEventListener("input", (e) => {
      document.getElementById("lbl-bgm-volume").textContent = `${e.target.value} dB`;
    });
    document.getElementById("btn-generate-full-audio")?.addEventListener("click", () => this.generateFullAudio());

    document.querySelectorAll('input[name="audio-sync-mode"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        // Only updates audio sync mode without altering user's visual settings
        if (this.activeProject) this.activeProject.sync_mode = e.target.value;
      });
    });

    // Intelligent Video-Voice Speed Override Slider
    const rangeSync = document.getElementById("range-sync-speed-override");
    if (rangeSync) {
      rangeSync.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        const lbl = document.getElementById("lbl-sync-speed-override-val");
        const badge = document.getElementById("badge-sync-speed");
        const step4Lbl = document.getElementById("lbl-step4-speed-display");
        if (lbl) lbl.textContent = `${val.toFixed(2)}x`;
        if (badge) badge.textContent = `${val.toFixed(2)}x Custom`;
        if (step4Lbl) step4Lbl.textContent = `${val.toFixed(2)}x`;
        if (this.activeProject) this.activeProject.speed = val;
      });
    }

    // Step 4: Visuals, Delogo Sliders & Watermark Branding
    this.bindDelogoSliders();
    this.bindWatermarkControls();
    
    // Live frame preview seeker & buttons
    const previewSeek = document.getElementById("range-preview-seek");
    if (previewSeek) {
      previewSeek.addEventListener("input", (e) => {
        const sec = parseFloat(e.target.value) || 0;
        document.getElementById("lbl-preview-seek-time").textContent = this.formatTime(sec);
      });
    }
    document.getElementById("btn-live-preview-frame")?.addEventListener("click", () => this.renderLivePreviewFrame());
    document.getElementById("btn-live-preview-frame-refresh")?.addEventListener("click", () => this.renderLivePreviewFrame());

    // Auto-refresh frame preview when aspect ratio or visual filter styling changes
    const autoPreviewIds = [
      "select-aspect-ratio",
      "select-framing-style",
      "select-color-grade",
      "chk-mirror",
      "chk-micro-crop",
      "chk-grain",
      "chk-vignette",
      "chk-highlight-delogo"
    ];
    autoPreviewIds.forEach(id => {
      document.getElementById(id)?.addEventListener("change", () => {
        const img = document.getElementById("img-preview-frame");
        if (this.activeProjectId && img && img.style.display !== "none") {
          this.renderLivePreviewFrame();
        }
      });
    });

    const speedSlider = document.getElementById("range-speed-factor");
    if (speedSlider) {
      speedSlider.addEventListener("input", (e) => {
        this.setSpeedFactor(parseFloat(e.target.value));
      });
    }

    const chkSpeed = document.getElementById("chk-speed");
    if (chkSpeed) {
      chkSpeed.addEventListener("change", (e) => {
        const box = document.getElementById("box-speed-control");
        if (box) box.style.opacity = e.target.checked ? "1" : "0.4";
        const lbl = document.getElementById("lbl-step4-speed-display");
        if (lbl) lbl.textContent = e.target.checked ? `${this.getSelectedRenderSpeed().toFixed(2)}x` : "1.00x";
      });
    }

    // Step 5: Timeline & Video player
    const video = document.getElementById("video-player-main");
    if (video) {
      video.addEventListener("timeupdate", () => {
        this.handleVideoTimeUpdate(video.currentTime, video.duration);
      });
      video.addEventListener("loadedmetadata", () => {
        const previewSeekEl = document.getElementById("range-preview-seek");
        if (previewSeekEl && video.duration) {
          previewSeekEl.max = Math.floor(video.duration);
        }
      });
    }
    document.getElementById("btn-add-text-overlay")?.addEventListener("click", () => this.openAddCalloutModal());

    // Step 6: Final Render
    document.getElementById("btn-start-final-render")?.addEventListener("click", () => this.startFinalRender());

    // Settings Modal
    document.getElementById("btn-open-settings")?.addEventListener("click", () => this.openSettingsModal());
    document.getElementById("btn-save-settings")?.addEventListener("click", () => this.saveSettings());
    document.getElementById("btn-new-project")?.addEventListener("click", () => this.resetNewProject());
    document.getElementById("btn-toggle-gemini-key")?.addEventListener("click", () => this.toggleKeyVisibility("cfg-gemini-key", "btn-toggle-gemini-key"));
    document.getElementById("btn-toggle-elevenlabs-key")?.addEventListener("click", () => this.toggleKeyVisibility("cfg-elevenlabs-key", "btn-toggle-elevenlabs-key"));
    document.getElementById("btn-test-gemini-key")?.addEventListener("click", () => this.testGeminiConnection());
    document.getElementById("btn-test-elevenlabs-key")?.addEventListener("click", () => this.testElevenLabsConnection());
  },

  bindDelogoSliders() {
    const rangeX = document.getElementById("range-delogo-x");
    const rangeY = document.getElementById("range-delogo-y");
    const rangeW = document.getElementById("range-delogo-w");
    const rangeH = document.getElementById("range-delogo-h");
    const chkDelogo = document.getElementById("chk-enable-delogo");

    const updateCoordsFromSliders = () => {
      const x = parseInt(rangeX?.value || 80);
      const y = parseInt(rangeY?.value || 3);
      const w = parseInt(rangeW?.value || 18);
      const h = parseInt(rangeH?.value || 12);

      const lblX = document.getElementById("lbl-val-delogo-x");
      const lblY = document.getElementById("lbl-val-delogo-y");
      const lblW = document.getElementById("lbl-val-delogo-w");
      const lblH = document.getElementById("lbl-val-delogo-h");
      if (lblX) lblX.textContent = `${x}%`;
      if (lblY) lblY.textContent = `${y}%`;
      if (lblW) lblW.textContent = `${w}%`;
      if (lblH) lblH.textContent = `${h}%`;

      this.delogoCoords = {
        x: x / 100,
        y: y / 100,
        w: w / 100,
        h: h / 100
      };

      const coordsLbl = document.getElementById("lbl-delogo-coords");
      if (coordsLbl) coordsLbl.textContent = `x=${x}%, y=${y}%, w=${w}%, h=${h}%`;
      if (chkDelogo) chkDelogo.checked = true;
    };

    [rangeX, rangeY, rangeW, rangeH].forEach(slider => {
      if (slider) {
        slider.addEventListener("input", updateCoordsFromSliders);
      }
    });
  },

  bindWatermarkControls() {
    document.getElementById("chk-enable-watermark")?.addEventListener("change", (e) => {
      const box = document.getElementById("box-watermark-options");
      if (box) box.style.display = e.target.checked ? "block" : "none";
      const pin = document.getElementById("wm-interactive-pin");
      if (pin) pin.style.display = e.target.checked ? "block" : "none";
      const hint = document.getElementById("lbl-preview-drag-hint");
      if (hint) hint.style.display = e.target.checked ? "block" : "none";
    });

    document.querySelectorAll('input[name="wm-type-radio"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        const isImage = e.target.value === "image";
        const fieldImg = document.getElementById("wm-field-image");
        const fieldTxt = document.getElementById("wm-field-text");
        const scaleBox = document.getElementById("box-wm-image-scale");
        const fontBox = document.getElementById("box-wm-font-size");
        const colorBox = document.getElementById("box-wm-text-color");

        if (fieldImg) fieldImg.style.display = isImage ? "block" : "none";
        if (scaleBox) scaleBox.style.display = isImage ? "block" : "none";

        if (fieldTxt) fieldTxt.style.display = isImage ? "none" : "block";
        if (fontBox) fontBox.style.display = isImage ? "none" : "block";
        if (colorBox) colorBox.style.display = isImage ? "none" : "block";
      });
    });

    const imgInput = document.getElementById("input-watermark-image-file");
    if (imgInput) {
      imgInput.addEventListener("change", async (e) => {
        if (!e.target.files || e.target.files.length === 0) return;
        if (!this.activeProjectId) {
          alert("Please upload a video in Step 1 first.");
          return;
        }
        const file = e.target.files[0];
        const lbl = document.getElementById("lbl-uploaded-logo-name");
        if (lbl) lbl.textContent = `Uploading ${file.name}...`;

        // Measure natural aspect ratio for pixel-perfect bounding box alignment
        const imgObj = new Image();
        imgObj.onload = () => {
          if (imgObj.naturalWidth > 0) {
            this.watermarkAspectRatio = imgObj.naturalHeight / imgObj.naturalWidth;
            const x = parseInt(document.getElementById("range-watermark-x")?.value || 92);
            const y = parseInt(document.getElementById("range-watermark-y")?.value || 4);
            this.updateWatermarkPin(x, y);
          }
        };
        imgObj.src = URL.createObjectURL(file);

        try {
          const res = await API.uploadWatermarkImage(this.activeProjectId, file);
          this.watermarkImagePath = res.image_path;
          if (lbl) lbl.textContent = `✅ Ready: ${file.name}`;
          alert("Watermark logo uploaded successfully!");
          this.renderLivePreviewFrame();
        } catch (err) {
          if (lbl) lbl.textContent = `❌ Upload failed`;
          alert("Failed to upload watermark image: " + err.message);
        }
      });
    }

    const rangeX = document.getElementById("range-watermark-x");
    const rangeY = document.getElementById("range-watermark-y");
    const numX = document.getElementById("num-watermark-x");
    const numY = document.getElementById("num-watermark-y");

    const updateCoords = () => {
      const x = parseInt(rangeX?.value || 92);
      const y = parseInt(rangeY?.value || 4);
      if (numX) numX.value = x;
      if (numY) numY.value = y;
      const lblX = document.getElementById("lbl-val-wm-x");
      const lblY = document.getElementById("lbl-val-wm-y");
      const coordsLbl = document.getElementById("lbl-wm-coords-display");
      if (lblX) lblX.textContent = `${x}%`;
      if (lblY) lblY.textContent = `${y}%`;
      if (coordsLbl) coordsLbl.textContent = `Position: X=${x}%, Y=${y}%`;
      this.updateWatermarkPin(x, y);
    };

    [rangeX, rangeY].forEach(el => {
      el?.addEventListener("input", updateCoords);
    });

    numX?.addEventListener("input", (e) => {
      const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
      if (rangeX) rangeX.value = val;
      updateCoords();
    });

    numY?.addEventListener("input", (e) => {
      const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
      if (rangeY) rangeY.value = val;
      updateCoords();
    });

    document.querySelectorAll('input[name="wm-timing-radio"]').forEach(radio => {
      radio.addEventListener("change", (e) => {
        const box = document.getElementById("box-wm-timing-custom");
        if (box) box.style.display = e.target.value === "custom" ? "block" : "none";
      });
    });

    const opacRange = document.getElementById("range-watermark-opacity");
    if (opacRange) {
      opacRange.addEventListener("input", (e) => {
        const lbl = document.getElementById("lbl-val-wm-opacity");
        if (lbl) lbl.textContent = `${e.target.value}%`;
      });
    }

    const sizeRange = document.getElementById("range-watermark-size");
    if (sizeRange) {
      sizeRange.addEventListener("input", (e) => {
        const lbl = document.getElementById("lbl-val-wm-size");
        if (lbl) lbl.textContent = `${e.target.value}%`;
      });
    }

    const fontRange = document.getElementById("range-watermark-font-size");
    if (fontRange) {
      fontRange.addEventListener("input", (e) => {
        const lbl = document.getElementById("lbl-val-wm-font-size");
        if (lbl) lbl.textContent = `${e.target.value}px`;
      });
    }

    this.bindPreviewClickPositioning();
  },

  setWatermarkPreset(preset) {
    const posMap = {
      top_right: { x: 92, y: 4 },
      top_left: { x: 4, y: 4 },
      bottom_right: { x: 92, y: 92 },
      bottom_left: { x: 4, y: 92 },
      center: { x: 50, y: 50 }
    };
    const coords = posMap[preset] || posMap.top_right;
    const rangeX = document.getElementById("range-watermark-x");
    const rangeY = document.getElementById("range-watermark-y");
    const numX = document.getElementById("num-watermark-x");
    const numY = document.getElementById("num-watermark-y");
    if (rangeX) rangeX.value = coords.x;
    if (rangeY) rangeY.value = coords.y;
    if (numX) numX.value = coords.x;
    if (numY) numY.value = coords.y;
    const lblX = document.getElementById("lbl-val-wm-x");
    const lblY = document.getElementById("lbl-val-wm-y");
    const coordsLbl = document.getElementById("lbl-wm-coords-display");
    if (lblX) lblX.textContent = `${coords.x}%`;
    if (lblY) lblY.textContent = `${coords.y}%`;
    if (coordsLbl) coordsLbl.textContent = `Position: X=${coords.x}%, Y=${coords.y}%`;

    const chk = document.getElementById("chk-enable-watermark");
    if (chk) {
      chk.checked = true;
      const box = document.getElementById("box-watermark-options");
      if (box) box.style.display = "block";
    }
    this.updateWatermarkPin(coords.x, coords.y);
  },

  updateWatermarkVisualAppearance() {
    const x = parseInt(document.getElementById("range-watermark-x")?.value || 92);
    const y = parseInt(document.getElementById("range-watermark-y")?.value || 4);
    this.updateWatermarkPin(x, y);
  },

  updateWatermarkPin(xPct, yPct) {
    const overlay = document.getElementById("wm-interactive-overlay");
    const img = document.getElementById("img-preview-frame");
    if (!overlay || !img || img.style.display === "none") return;

    const rect = img.getBoundingClientRect();
    if (rect.width <= 0) return;

    const isImage = document.getElementById("wm-type-image")?.checked || false;
    const sizeScale = parseInt(document.getElementById("range-watermark-size")?.value || 18);
    // Box width matches FFmpeg wm_scale ratio exactly:
    const boxW = Math.max(32, Math.round(rect.width * (sizeScale / 100)));
    const aspect = (isImage && this.watermarkAspectRatio) ? this.watermarkAspectRatio : 0.52;
    const boxH = Math.max(22, Math.round(boxW * aspect));

    overlay.style.width = `${boxW}px`;
    overlay.style.height = `${boxH}px`;
    overlay.style.transform = "none";

    const maxLeft = Math.max(0, rect.width - boxW);
    const maxTop = Math.max(0, rect.height - boxH);

    const leftPx = Math.round(maxLeft * (xPct / 100));
    const topPx = Math.round(maxTop * (yPct / 100));

    overlay.style.left = `${leftPx}px`;
    overlay.style.top = `${topPx}px`;
    overlay.style.display = "block";

    const badge = document.getElementById("wm-overlay-badge");
    if (badge) {
      badge.textContent = `🏷️ Watermark Box (${xPct}%, ${yPct}%)`;
    }
  },

  bindPreviewClickPositioning() {
    const wrapper = document.getElementById("preview-image-wrapper");
    const overlay = document.getElementById("wm-interactive-overlay");
    const img = document.getElementById("img-preview-frame");
    if (!wrapper || !img) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    const syncCoords = (pctX, pctY) => {
      pctX = Math.max(0, Math.min(100, Math.round(pctX)));
      pctY = Math.max(0, Math.min(100, Math.round(pctY)));

      const rangeX = document.getElementById("range-watermark-x");
      const rangeY = document.getElementById("range-watermark-y");
      const numX = document.getElementById("num-watermark-x");
      const numY = document.getElementById("num-watermark-y");
      if (rangeX) rangeX.value = pctX;
      if (rangeY) rangeY.value = pctY;
      if (numX) numX.value = pctX;
      if (numY) numY.value = pctY;

      const lblX = document.getElementById("lbl-val-wm-x");
      const lblY = document.getElementById("lbl-val-wm-y");
      const coordsLbl = document.getElementById("lbl-wm-coords-display");
      if (lblX) lblX.textContent = `${pctX}%`;
      if (lblY) lblY.textContent = `${pctY}%`;
      if (coordsLbl) coordsLbl.textContent = `Position: X=${pctX}%, Y=${pctY}%`;

      const chk = document.getElementById("chk-enable-watermark");
      if (chk) {
        chk.checked = true;
        const box = document.getElementById("box-watermark-options");
        if (box) box.style.display = "block";
      }
    };

    // Smooth dragging on the overlay bounding box directly
    if (overlay) {
      overlay.addEventListener("pointerdown", (e) => {
        isDragging = true;
        overlay.style.cursor = "grabbing";
        overlay.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startY = e.clientY;
        startLeft = parseFloat(overlay.style.left) || 0;
        startTop = parseFloat(overlay.style.top) || 0;
        e.stopPropagation();
      });

      overlay.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        const rect = img.getBoundingClientRect();
        const boxW = overlay.offsetWidth || 32;
        const boxH = overlay.offsetHeight || 22;
        const maxLeft = Math.max(0, rect.width - boxW);
        const maxTop = Math.max(0, rect.height - boxH);

        const curLeft = Math.max(0, Math.min(maxLeft, startLeft + (e.clientX - startX)));
        const curTop = Math.max(0, Math.min(maxTop, startTop + (e.clientY - startY)));

        overlay.style.left = `${curLeft}px`;
        overlay.style.top = `${curTop}px`;

        const pctX = maxLeft > 0 ? (curLeft / maxLeft) * 100 : 0;
        const pctY = maxTop > 0 ? (curTop / maxTop) * 100 : 0;

        syncCoords(pctX, pctY);
        const badge = document.getElementById("wm-overlay-badge");
        if (badge) badge.textContent = `🏷️ Watermark Box (${Math.round(pctX)}%, ${Math.round(pctY)}%)`;
        e.stopPropagation();
      });

      const stopDrag = (e) => {
        if (isDragging) {
          isDragging = false;
          overlay.style.cursor = "grab";
          try { overlay.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };

      overlay.addEventListener("pointerup", stopDrag);
      overlay.addEventListener("pointercancel", stopDrag);
    }

    // Clicking anywhere on the preview frame repositions watermark there immediately
    wrapper.addEventListener("pointerdown", (e) => {
      if (img.style.display === "none") return;
      if (e.target === overlay || overlay?.contains(e.target)) return;
      const rect = img.getBoundingClientRect();
      const boxW = overlay.offsetWidth || 32;
      const boxH = overlay.offsetHeight || 22;
      const maxLeft = Math.max(0, rect.width - boxW);
      const maxTop = Math.max(0, rect.height - boxH);

      const clickLeft = e.clientX - rect.left - (boxW / 2);
      const clickTop = e.clientY - rect.top - (boxH / 2);
      const curLeft = Math.max(0, Math.min(maxLeft, clickLeft));
      const curTop = Math.max(0, Math.min(maxTop, clickTop));

      const pctX = maxLeft > 0 ? (curLeft / maxLeft) * 100 : 0;
      const pctY = maxTop > 0 ? (curTop / maxTop) * 100 : 0;

      syncCoords(pctX, pctY);
      this.updateWatermarkPin(Math.round(pctX), Math.round(pctY));
    });

    // Live update listeners for watermark styling inputs
    const textInput = document.getElementById("input-watermark-text");
    const colorSelect = document.getElementById("select-watermark-color");
    const opacInput = document.getElementById("range-watermark-opacity");
    const fontInput = document.getElementById("range-watermark-font-size");
    const sizeInput = document.getElementById("range-watermark-size");
    const chkEnable = document.getElementById("chk-enable-watermark");

    [textInput, colorSelect, opacInput, fontInput, sizeInput].forEach(el => {
      el?.addEventListener("input", () => this.updateWatermarkVisualAppearance());
      el?.addEventListener("change", () => this.updateWatermarkVisualAppearance());
    });

    chkEnable?.addEventListener("change", (e) => {
      if (overlay) overlay.style.display = e.target.checked ? "block" : "none";
    });
  },

  getCustomWatermarkSettings() {
    const enabled = document.getElementById("chk-enable-watermark")?.checked || false;
    const wmType = document.querySelector('input[name="wm-type-radio"]:checked')?.value || "text";
    const x = parseInt(document.getElementById("range-watermark-x")?.value ?? 92);
    const y = parseInt(document.getElementById("range-watermark-y")?.value ?? 4);
    const opacity = (parseInt(document.getElementById("range-watermark-opacity")?.value ?? 70)) / 100.0;
    const imgScale = (parseInt(document.getElementById("range-watermark-size")?.value ?? 18)) / 100.0;
    const fontSize = parseInt(document.getElementById("range-watermark-font-size")?.value ?? 34);
    const fontColor = document.getElementById("select-watermark-color")?.value || "white";
    const text = document.getElementById("input-watermark-text")?.value || "@MyRecapChannel";
    const timingMode = document.querySelector('input[name="wm-timing-radio"]:checked')?.value || "full";
    const startSec = parseFloat(document.getElementById("input-wm-start-sec")?.value || 0.0);
    const endSec = parseFloat(document.getElementById("input-wm-end-sec")?.value || 0.0);

    return {
      enabled: enabled,
      type: wmType,
      text: text,
      position: "custom",
      x: x / 100.0,
      y: y / 100.0,
      opacity: opacity,
      scale: imgScale,
      font_size: fontSize,
      color: fontColor,
      timing_mode: timingMode,
      start_sec: startSec,
      end_sec: endSec,
      image_path: this.watermarkImagePath || undefined
    };
  },

  updateTargetLanguageLabel() {
    const targetLang = document.getElementById("select-step2-target-lang")?.value || document.getElementById("select-target-lang")?.value || "en";
    const langNames = {
      en: "English (100% Paraphrased & Re-Voiced)",
      hi: "Hindi Re-Voice (हिन्दी)",
      bn: "Bengali Re-Voice (বাংলা)",
      ur: "Urdu Re-Voice (اردو)",
      es: "Spanish Re-Voice (Español)",
      ja: "Japanese Re-Voice (日本語)",
      same_rewrite: "Same Language (Paraphrase & Rewrite)"
    };
    const lbl = document.getElementById("lbl-target-rewrite-info");
    if (lbl) {
      lbl.textContent = `Target: ${langNames[targetLang] || "English Re-Voice"}`;
    }
    const step2Sel = document.getElementById("select-step2-target-lang");
    if (step2Sel && step2Sel.value !== targetLang) {
      step2Sel.value = targetLang;
    }
  },

  updateDurationShiftUI(shift) {
    let shiftVal = -3.0;
    if (shift !== undefined && shift !== null && !isNaN(parseFloat(shift))) {
      shiftVal = parseFloat(shift);
    } else if (this.activeProject && this.activeProject.duration_shift !== undefined && !isNaN(parseFloat(this.activeProject.duration_shift))) {
      shiftVal = parseFloat(this.activeProject.duration_shift);
    } else {
      const elVal = document.getElementById("select-step2-duration-shift")?.value || document.getElementById("select-duration-shift")?.value;
      if (elVal && !isNaN(parseFloat(elVal))) shiftVal = parseFloat(elVal);
    }

    if (this.activeProject) this.activeProject.duration_shift = shiftVal;

    const valStr = shiftVal.toFixed(1);
    const selStep2 = document.getElementById("select-step2-duration-shift");
    const selStep4 = document.getElementById("select-duration-shift");
    const displayStep4 = document.getElementById("lbl-step4-duration-shift-display");
    const targetStep4 = document.getElementById("lbl-val-duration-target");

    if (selStep2 && selStep2.value !== valStr) selStep2.value = valStr;
    if (selStep4 && selStep4.value !== valStr) selStep4.value = valStr;
    if (displayStep4) {
      displayStep4.textContent = Math.abs(shiftVal) < 0.05 ? "0.0s (Exact)" : `${shiftVal > 0 ? '+' : ''}${shiftVal.toFixed(1)}s`;
    }

    const srcDur = parseFloat(this.activeProject?.source_duration) || parseFloat(this.activeProject?.video_metadata?.duration) || 0;
    const targetDur = Math.max(2.0, srcDur + shiftVal);
    if (this.activeProject) this.activeProject.target_video_duration = targetDur;

    const targetLang = document.getElementById("select-step2-target-lang")?.value || this.activeProject?.target_language || "en";
    const wps = ["bn", "hi", "ur"].includes(targetLang) ? 2.05 : 2.22;
    const targetWords = Math.round(targetDur * wps);

    const srcDurBadge = document.getElementById("lbl-step2-src-dur");
    const targetBadge = document.getElementById("lbl-step2-target-badge");

    if (srcDurBadge && srcDur > 0) {
      srcDurBadge.textContent = `⏱️ Source: ${this.formatTime(srcDur)}`;
    }
    if (targetBadge && srcDur > 0) {
      targetBadge.textContent = `🎯 Target Video: ${this.formatTime(targetDur)} (~${targetWords.toLocaleString()} words @ 1.0x)`;
    }
    if (targetStep4 && srcDur > 0) {
      targetStep4.textContent = `Target Video: ${this.formatTime(targetDur)} (${shiftVal > 0 ? '+' : ''}${shiftVal.toFixed(1)}s offset)`;
    }
  },

  async loadConfig() {
    try {
      this.config = await API.getConfig();
      if (this.config.custom_instructions) {
        const ta = document.getElementById("textarea-custom-instructions");
        if (ta) ta.value = this.config.custom_instructions;
      }
      if (this.config.gemini_api_key) {
        const gk = document.getElementById("cfg-gemini-key");
        if (gk) gk.value = this.config.gemini_api_key;
      }
      if (this.config.gemini_model) {
        const gm = document.getElementById("cfg-gemini-model");
        if (gm) gm.value = this.config.gemini_model;
      }
      if (this.config.elevenlabs_api_key) {
        const ek = document.getElementById("cfg-elevenlabs-key");
        if (ek) ek.value = this.config.elevenlabs_api_key;
      }
    } catch (e) {
      console.warn("Could not load backend config:", e);
    }
  },

  async loadLanguages() {
    try {
      this.languagesCatalog = await API.getLanguages();
    } catch (e) {
      console.warn("Languages catalog load error:", e);
    }
  },

  handleVideoFileSelected(file) {
    this.selectedVideoFile = file;
    const info = document.getElementById("upload-file-info");
    const bytes = file.size;
    let sizeStr = "";
    if (bytes >= 1024 * 1024 * 1024) {
      sizeStr = `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    } else {
      sizeStr = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    info.textContent = `Selected: ${file.name} (${sizeStr})`;
    info.style.display = "block";

    const titleInput = document.getElementById("input-project-title");
    if (!titleInput.value) {
      titleInput.value = file.name.replace(/\.[^/.]+$/, "");
    }
  },

  async loadRecentProjects() {
    try {
      const res = await API.listProjects();
      const select = document.getElementById("select-recent-projects");
      if (!select || !res.projects || res.projects.length === 0) return;
      select.innerHTML = `<option value="">📂 Switch Project (${res.projects.length})...</option>`;
      res.projects.forEach(p => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.title.length > 25 ? p.title.substring(0, 25) + '...' : p.title} (${p.segments_count} scenes)`;
        select.appendChild(opt);
      });
      select.style.display = "inline-block";

      // If no active project yet, auto-load the most recent project!
      if (!this.activeProjectId && res.projects.length > 0) {
        const latest = res.projects[0];
        select.value = latest.id;
        await this.loadProject(latest.id);
      }
    } catch (e) {
      console.warn("Could not load recent projects:", e);
    }
  },

  async loadProject(projectId) {
    try {
      const proj = await API.getProject(projectId);
      if (!proj) return;
      this.activeProjectId = proj.id;
      this.activeProject = proj;

      const badge = document.getElementById("badge-active-project");
      const titleLbl = document.getElementById("lbl-active-project-title");
      if (titleLbl) titleLbl.textContent = proj.title;
      if (badge) badge.style.display = "inline-flex";

      // Target language
      const step2Target = document.getElementById("select-step2-target-lang");
      if (step2Target && proj.target_language) {
        step2Target.value = proj.target_language;
      }
      if (proj.voice_provider) {
        const provSel = document.getElementById("select-voice-provider");
        if (provSel) provSel.value = proj.voice_provider;
      }
      this.updateTargetLanguageLabel();
      await this.updateNarratorVoiceList();

      if (proj.narrator_voice) {
        const vSel = document.getElementById("select-narrator-voice");
        if (vSel) {
          vSel.value = proj.narrator_voice;
          const exists = Array.from(vSel.options).some(o => o.value === proj.narrator_voice);
          if (!exists && proj.voice_provider === "elevenlabs") {
            const custInput = document.getElementById("input-elevenlabs-custom-voice-id");
            if (custInput) custInput.value = proj.narrator_voice;
          }
        }
      }

      // Load segments & script (Full continuous script is recommended default)
      this.currentScriptMode = "full";
      this.renderSegments(proj.segments);
      this.switchScriptViewMode("full");

      const detectedBadge = document.getElementById("badge-detected-lang");
      if (detectedBadge) {
        detectedBadge.textContent = `Auto Detected: ${proj.detected_language_name || proj.detected_language || 'English'}`;
      }
      const segCountLbl = document.getElementById("lbl-segments-count");
      if (segCountLbl) {
        segCountLbl.textContent = `${proj.segments ? proj.segments.length : 0} speech segments`;
      }

      // Video Player Setup
      const videoPlayer = document.getElementById("video-player-main");
      if (videoPlayer) {
        videoPlayer.src = `/api/projects/${proj.id}/video-stream?which=source`;
      }

      // Audio Master Player
      const audioPlayer = document.getElementById("audio-master-player");
      const audioStatusBox = document.getElementById("audio-gen-status-box");
      const audioStatusMsg = document.getElementById("audio-gen-status-msg");
      if (proj.status === "audio_generated" || proj.auto_matched_video_speed) {
        if (audioStatusBox) audioStatusBox.style.display = "flex";
        if (audioStatusMsg) audioStatusMsg.textContent = "✅ Master audio track loaded";
        if (audioPlayer) {
          audioPlayer.src = `/projects/${proj.id}/master_audio.mp3?t=${Date.now()}`;
        }
      }

      // Video-Voice Speed Sync UI
      if (proj.voice_duration || proj.auto_matched_video_speed) {
        this.updateSpeedSyncUI(
          proj.auto_matched_video_speed || 1.0,
          proj.source_duration,
          proj.voice_duration,
          proj.raw_voice_duration || proj.voice_duration,
          proj.voice_speed || 1.0,
          proj.sync_mode || "fit_to_video"
        );
      }

      this.updateDurationShiftUI(proj.duration_shift ?? -3.0);

      // If completed, set up final video player
      if (proj.final_video_file) {
        const finalVideo = document.getElementById("video-player-final");
        if (finalVideo) {
          finalVideo.src = `/api/projects/${proj.id}/video-stream?which=final&t=${Date.now()}`;
        }
      }
    } catch (e) {
      console.warn("Error loading project:", e);
    }
  },

  async updateNarratorVoiceList() {
    const targetLang = document.getElementById("select-step2-target-lang")?.value || document.getElementById("select-target-lang")?.value || "en";
    const selectVoice = document.getElementById("select-narrator-voice");
    const provider = document.getElementById("select-voice-provider")?.value || "edge_tts";
    const customVoiceBox = document.getElementById("elevenlabs-custom-voice-box");
    
    if (customVoiceBox) {
      customVoiceBox.style.display = provider === "elevenlabs" ? "block" : "none";
    }

    if (!selectVoice) return;

    selectVoice.innerHTML = `<option value="">Loading ${provider === 'elevenlabs' ? 'ElevenLabs' : 'Edge-TTS'} studio voices...</option>`;

    try {
      const data = await API.getVoices(targetLang === "same_rewrite" ? "en" : targetLang, provider);
      const voices = data.voices || [];
      selectVoice.innerHTML = "";
      if (voices.length === 0) {
        selectVoice.innerHTML = provider === "elevenlabs"
          ? '<option value="Adam">Adam • US Male [Deep Cinematic & Documentary]</option>'
          : '<option value="Christopher">Christopher • Male [Deep Storyteller]</option>';
        return;
      }
      voices.forEach(v => {
        const opt = document.createElement("option");
        opt.value = v.name || v.id;
        opt.textContent = v.label || `${v.name} • ${v.gender || ''}`;
        selectVoice.appendChild(opt);
      });
      if (this.activeProject?.narrator_voice) {
        const exists = Array.from(selectVoice.options).some(o => o.value === this.activeProject.narrator_voice);
        if (exists) selectVoice.value = this.activeProject.narrator_voice;
      }
    } catch (e) {
      console.warn("Voice list fetch error, using local catalog:", e);
      if (provider === "elevenlabs") {
        selectVoice.innerHTML = `
          <option value="Adam">Adam • US Male [Deep Cinematic & Documentary]</option>
          <option value="George">George • UK Male [Warm Storyteller & Recap]</option>
          <option value="Prem">Prem • IN Male [Hindi/English Storyteller]</option>
          <option value="Kabir">Kabir • IN Male [Deep Indian Commentary]</option>
          <option value="Aditi">Aditi • IN Female [Indian Expressive Narrative]</option>
          <option value="Rachel">Rachel • US Female [Calm & Engaging Narrative]</option>
        `;
      } else {
        selectVoice.innerHTML = `
          <option value="Christopher">Christopher • Male [Deep Storyteller]</option>
          <option value="Guy">Guy • Male [Conversational YouTube Recapper]</option>
          <option value="Madhur">Madhur • Male [Top Hindi Recapper]</option>
          <option value="Pradeep">Pradeep • Male [Bengali Recapper BD]</option>
        `;
      }
    }
  },

  playBgmDemo() {
    const preset = document.getElementById("select-bgm-preset")?.value || "suspense";
    const player = document.getElementById("audio-bgm-demo-player");
    if (!player) return;
    if (preset === "none") {
      alert("No background music is selected. Choose Suspense, Action, Lo-Fi, or Ambient to hear a demo.");
      return;
    }
    player.src = `/api/bgm-preview/${preset}?t=${Date.now()}`;
    player.style.display = "block";
    player.play().catch(e => console.log("Audio autoplay prevented", e));
  },

  goToStep(stepNumber) {
    if (stepNumber > 1 && !this.activeProjectId) {
      alert("Please upload and process a video in Step 1 first.");
      return;
    }

    // Auto-save edited story script when moving to voice studio or rendering
    if (this.currentStep === 2 && stepNumber >= 3 && this.activeProjectId) {
      const rewText = document.getElementById("textarea-full-rewritten-script")?.value?.trim();
      if (rewText) {
        API.updateFullScript(this.activeProjectId, { full_rewritten_text: rewText, script_mode: "full_continuous" }).catch(() => {});
      }
    }

    this.currentStep = stepNumber;
    document.querySelectorAll(".step-pane").forEach(pane => pane.classList.remove("active"));
    const targetPane = document.getElementById(`step-${stepNumber}`);
    if (targetPane) targetPane.classList.add("active");

    document.querySelectorAll(".step-pill[data-step]").forEach(pill => {
      const s = parseInt(pill.getAttribute("data-step"));
      pill.classList.toggle("active", s === stepNumber);
      if (s < stepNumber) pill.classList.add("completed");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  async startUploadAndProcess() {
    if (!this.selectedVideoFile) {
      alert("Please select or drop a video file first.");
      return;
    }

    const btn = document.getElementById("btn-start-upload-process");
    btn.disabled = true;
    btn.textContent = "⏳ Uploading & Extracting Audio...";

    const formData = new FormData();
    formData.append("video", this.selectedVideoFile);
    formData.append("title", document.getElementById("input-project-title").value);
    formData.append("source_language", document.getElementById("select-source-lang").value);
    formData.append("target_language", document.getElementById("select-target-lang").value);
    formData.append("tone", document.getElementById("select-tone").value);
    formData.append("custom_instructions", document.getElementById("textarea-custom-instructions").value);

    try {
      const project = await API.uploadVideo(formData);
      this.activeProjectId = project.id;
      this.activeProject = project;

      // Update badge & target label & duration shift
      document.getElementById("lbl-active-project-title").textContent = project.title;
      document.getElementById("badge-active-project").style.display = "inline-flex";
      this.updateTargetLanguageLabel();
      this.updateDurationShiftUI(project.duration_shift ?? -3.0);
      await this.updateNarratorVoiceList();

      // Setup video player in Step 5
      const videoPlayer = document.getElementById("video-player-main");
      videoPlayer.src = `/api/projects/${project.id}/video-stream?which=source`;

      btn.textContent = "Transcribing Speech (Google STT)...";
      await this.transcribeAudio();
      this.goToStep(2);
    } catch (e) {
      alert("Upload failed: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "⚡ Upload & Start Video Processing";
    }
  },

  async transcribeAudio() {
    if (!this.activeProjectId) return;
    const btn = document.getElementById("btn-transcribe-audio");
    btn.disabled = true;
    btn.textContent = "Transcribing Speech...";

    try {
      const proj = await API.transcribe(this.activeProjectId);
      this.activeProject = proj;
      this.renderSegments(proj.segments);
      this.updateDurationShiftUI(proj.duration_shift ?? -3.0);
      
      const badge = document.getElementById("badge-detected-lang");
      if (badge) badge.textContent = `Auto Detected: ${proj.detected_language_name || proj.detected_language || 'English'}`;
      const countLbl = document.getElementById("lbl-segments-count");
      if (countLbl) countLbl.textContent = `${(proj.segments && proj.segments.length) || 0} speech segments`;
      this.updateTargetLanguageLabel();
    } catch (e) {
      alert("Transcription failed: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "🔄 Re-Transcribe Audio";
    }
  },

  async rewriteAllCommentary() {
    if (!this.activeProjectId) return;
    const btn = document.getElementById("btn-rewrite-all");
    btn.disabled = true;
    btn.textContent = "Rewriting with AI...";

    try {
      const targetLang = document.getElementById("select-step2-target-lang")?.value || document.getElementById("select-target-lang")?.value || "en";
      const tone = document.getElementById("select-tone")?.value || "storyteller";
      const customInst = document.getElementById("textarea-custom-instructions")?.value || "";
      const durationShift = parseFloat(document.getElementById("select-step2-duration-shift")?.value || document.getElementById("select-duration-shift")?.value || -3.0);

      const proj = await API.rewriteScript(this.activeProjectId, {
        target_language: targetLang,
        tone: tone,
        custom_instructions: customInst,
        duration_shift: durationShift
      });
      this.activeProject = proj;
      this.updateDurationShiftUI(proj.duration_shift);
      this.renderSegments(proj.segments);
      this.updateTargetLanguageLabel();
      this.switchScriptViewMode("full");
      alert("Script successfully rewritten and adapted into target style!");
    } catch (e) {
      alert("Script rewrite failed: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "✨ Rewrite All Commentary";
    }
  },

  switchScriptViewMode(mode) {
    this.currentScriptMode = mode;
    const fullContainer = document.getElementById("full-script-container");
    const segsContainer = document.getElementById("segments-container");
    const tabFull = document.getElementById("tab-btn-full-script");
    const tabSegs = document.getElementById("tab-btn-segments-view");

    if (mode === "full") {
      if (fullContainer) fullContainer.style.display = "block";
      if (segsContainer) segsContainer.style.display = "none";
      if (tabFull) tabFull.className = "btn btn-primary btn-sm";
      if (tabSegs) tabSegs.className = "btn btn-secondary btn-sm";
    } else {
      if (fullContainer) fullContainer.style.display = "none";
      if (segsContainer) segsContainer.style.display = "block";
      if (tabFull) tabFull.className = "btn btn-secondary btn-sm";
      if (tabSegs) tabSegs.className = "btn btn-primary btn-sm";
    }

    if (this.activeProjectId) {
      API.updateFullScript(this.activeProjectId, { script_mode: mode === "full" ? "full_continuous" : "scene_breakdown" }).catch(() => {});
    }
  },

  async saveFullScript() {
    if (!this.activeProjectId) return;
    const btn = document.getElementById("btn-save-full-script");
    const text = document.getElementById("textarea-full-rewritten-script").value;
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const proj = await API.updateFullScript(this.activeProjectId, { full_rewritten_text: text, script_mode: "full_continuous" });
      this.activeProject = proj;
      this.renderSegments(proj.segments);
      this.switchScriptViewMode("full");
      alert("Full story script saved successfully! The voice synthesizer will use this exact script.");
    } catch (e) {
      alert("Failed to save full script: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "💾 Save Script";
    }
  },

  async saveFullOriginalScript() {
    if (!this.activeProjectId) return;
    const btn = document.getElementById("btn-save-full-original");
    const text = document.getElementById("textarea-full-original-script").value;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
    }

    try {
      const proj = await API.updateFullScript(this.activeProjectId, { full_original_text: text });
      this.activeProject = proj;
      this.renderSegments(proj.segments);
      this.switchScriptViewMode("full");
      alert("Full original audio text saved successfully!");
    } catch (e) {
      alert("Failed to save full original script: " + e.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "💾 Save Original";
      }
    }
  },

  renderSegments(segments) {
    // Synchronize Full Continuous Script textareas
    const origBox = document.getElementById("textarea-full-original-script");
    const rewBox = document.getElementById("textarea-full-rewritten-script");

    let fullOrig = this.activeProject?.full_original_text || "";
    let fullRew = this.activeProject?.full_rewritten_text || "";

    if (!fullOrig && segments && segments.length > 0) {
      fullOrig = segments.map(s => s.original_text).filter(t => t && !t.startsWith("[")).join(" ");
    }
    if (!fullRew && segments && segments.length > 0) {
      fullRew = segments.map(s => s.rewritten_text || s.original_text).filter(t => t && !t.startsWith("[")).join(" ");
    }

    if (origBox) origBox.value = fullOrig;
    if (rewBox) rewBox.value = fullRew;

    const container = document.getElementById("segments-container");
    if (!segments || segments.length === 0) {
      if (container) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 30px;">No speech segments found.</p>`;
      }
      if (this.currentScriptMode) this.switchScriptViewMode(this.currentScriptMode);
      return;
    }

    if (container) {
      container.innerHTML = "";
      segments.forEach(seg => {
        const card = document.createElement("div");
        card.className = "segment-card";
        card.id = `seg-card-${seg.segment_id}`;

        card.innerHTML = `
          <div class="segment-header">
            <div>
              <span class="segment-badge">#${seg.segment_id}</span>
              <span class="time-stamp" style="margin-left: 8px;">${seg.start.toFixed(1)}s ➔ ${seg.end.toFixed(1)}s (${(seg.end - seg.start).toFixed(1)}s)</span>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="App.regenerateSegment(${seg.segment_id})">🔄 Regenerate</button>
              <button class="btn btn-emerald btn-sm" onclick="App.saveSegment(${seg.segment_id})">💾 Save</button>
              <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="App.deleteSegment(${seg.segment_id})">🗑️</button>
            </div>
          </div>
          <div class="segment-grid">
            <div>
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px; font-weight: 600;">ORIGINAL SPOKEN SPEECH (EDITABLE):</div>
              <textarea id="seg-orig-${seg.segment_id}" class="form-textarea orig-text-box" rows="3" style="width: 100%; font-size: 13px; line-height: 1.5; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); resize: vertical;" placeholder="Original spoken speech (edit or add missed words here)...">${seg.original_text || ''}</textarea>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--accent-emerald); margin-bottom: 4px; font-weight: 600;">REWRITTEN / TRANSLATED COMMENTARY:</div>
              <textarea id="seg-input-${seg.segment_id}" class="form-textarea rewrite-text-box" rows="3">${seg.rewritten_text || ''}</textarea>
            </div>
          </div>
        `;
        container.appendChild(card);
      });
    }

    if (this.currentScriptMode) {
      this.switchScriptViewMode(this.currentScriptMode);
    }
  },

  async regenerateSegment(segmentId) {
    if (!this.activeProjectId) return;
    const origInput = document.getElementById(`seg-orig-${segmentId}`);
    const input = document.getElementById(`seg-input-${segmentId}`);
    
    // Save original text first if user edited it
    const origText = origInput ? origInput.value : "";
    if (origInput) {
      try {
        await API.updateSegment(this.activeProjectId, segmentId, { original_text: origText });
      } catch (err) {
        console.warn("Failed to auto-save original before regenerate:", err);
      }
    }

    input.disabled = true;
    try {
      const res = await API.regenerateSegment(this.activeProjectId, segmentId);
      input.value = res.rewritten_text;
    } catch (e) {
      alert("Regenerate failed: " + e.message);
    } finally {
      input.disabled = false;
    }
  },

  async saveSegment(segmentId) {
    if (!this.activeProjectId) return;
    const origInput = document.getElementById(`seg-orig-${segmentId}`);
    const input = document.getElementById(`seg-input-${segmentId}`);
    const origText = origInput ? origInput.value : "";
    const text = input ? input.value : "";
    try {
      await API.updateSegment(this.activeProjectId, segmentId, {
        original_text: origText,
        rewritten_text: text
      });
      alert(`Segment #${segmentId} saved!`);
    } catch (e) {
      alert("Failed to save segment: " + e.message);
    }
  },

  async deleteSegment(segmentId) {
    if (!this.activeProjectId) return;
    if (!confirm(`Delete segment #${segmentId}?`)) return;
    try {
      const res = await API.deleteSegment(this.activeProjectId, segmentId);
      this.renderSegments(res.segments);
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  },

  openAddSegmentModal() {
    document.getElementById("modal-add-segment").classList.add("open");
  },

  closeAddSegmentModal() {
    document.getElementById("modal-add-segment").classList.remove("open");
  },

  async saveNewSegment() {
    if (!this.activeProjectId) return;
    const st = parseFloat(document.getElementById("new-seg-start").value) || 0;
    const en = parseFloat(document.getElementById("new-seg-end").value) || 5;
    const orig = document.getElementById("new-seg-orig").value;
    const rew = document.getElementById("new-seg-rewritten").value;

    try {
      const res = await API.addSegment(this.activeProjectId, st, en, orig, rew);
      this.renderSegments(res.segments);
      this.closeAddSegmentModal();
    } catch (e) {
      alert("Add segment failed: " + e.message);
    }
  },

  async testVoiceSample() {
    const provider = document.getElementById("select-voice-provider")?.value || "edge_tts";
    const customVoice = document.getElementById("input-elevenlabs-custom-voice-id")?.value?.trim();
    const dropdownVoice = document.getElementById("select-narrator-voice")?.value || (provider === "elevenlabs" ? "Adam" : "Christopher");
    const voice = (provider === "elevenlabs" && customVoice) ? customVoice : dropdownVoice;
    const lang = document.getElementById("select-step2-target-lang")?.value || document.getElementById("select-target-lang")?.value || "en";
    const btn = document.getElementById("btn-test-voice-sample");
    const player = document.getElementById("audio-player-sample");

    btn.disabled = true;
    btn.textContent = `🔊 Testing ${provider === 'elevenlabs' ? 'ElevenLabs' : 'Edge-TTS'} Voice...`;

    try {
      const blob = await API.testVoice(provider, voice, lang === "same_rewrite" ? "en" : lang);
      const url = URL.createObjectURL(blob);
      player.src = url;
      player.style.display = "block";
      player.play();
    } catch (e) {
      alert("Voice test failed: " + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "🔊 Test Voice Sample";
    }
  },

  async generateFullAudio() {
    if (!this.activeProjectId) return;
    const btn = document.getElementById("btn-generate-full-audio");
    btn.disabled = true;
    btn.textContent = "Synthesizing Audio Bed...";

    const statusBox = document.getElementById("audio-gen-status-box");
    const statusMsg = document.getElementById("audio-gen-status-msg");
    statusBox.style.display = "flex";
    statusMsg.textContent = "Generating voice narration & mixing background music...";

    // Auto-save latest edited story script immediately so the voice engine uses it!
    const rewScript = document.getElementById("textarea-full-rewritten-script")?.value?.trim();
    if (rewScript) {
      try {
        await API.updateFullScript(this.activeProjectId, { full_rewritten_text: rewScript, script_mode: "full_continuous" });
      } catch (err) {
        console.warn("Auto-save script before generateAudio failed:", err);
      }
    }

    const provider = document.getElementById("select-voice-provider")?.value || "edge_tts";
    const customVoice = document.getElementById("input-elevenlabs-custom-voice-id")?.value?.trim();
    const dropdownVoice = document.getElementById("select-narrator-voice")?.value || (provider === "elevenlabs" ? "Adam" : "Christopher");
    const voice = (provider === "elevenlabs" && customVoice) ? customVoice : dropdownVoice;
    const bgmPreset = document.getElementById("select-bgm-preset")?.value || "suspense";
    const bgmVol = parseFloat(document.getElementById("range-bgm-volume")?.value || -26.0);
    const syncMode = document.querySelector('input[name="audio-sync-mode"]:checked')?.value || "fit_to_video";
    const customVoiceSpeed = parseFloat(document.getElementById("range-custom-voice-speed")?.value || 1.0);
    const durationShift = syncMode === "exact_timeline" ? 0.0 : parseFloat(document.getElementById("select-step2-duration-shift")?.value || document.getElementById("select-duration-shift")?.value || -3.0);

    try {
      const res = await API.generateAudio(this.activeProjectId, {
        voice_provider: provider,
        voice_name: voice,
        bgm_preset: bgmPreset,
        bgm_volume_db: bgmVol,
        sync_mode: syncMode,
        duration_shift: durationShift,
        voice_speed: syncMode === "custom" ? customVoiceSpeed : (syncMode === "exact_timeline" ? 1.0 : undefined)
      });
      statusMsg.textContent = `✅ Master audio generated successfully (${provider === 'elevenlabs' ? 'ElevenLabs' : 'Edge-TTS'})!`;
      const player = document.getElementById("audio-master-player");
      player.src = `/projects/${this.activeProjectId}/master_audio.mp3?t=${Date.now()}`;
      player.load();

      if (res.voice_duration) {
        this.updateSpeedSyncUI(
          res.auto_matched_video_speed || 1.0,
          res.source_duration,
          res.voice_duration,
          res.raw_voice_duration || res.voice_duration,
          res.voice_speed || 1.0,
          res.sync_mode || "fit_to_video"
        );
      }
    } catch (e) {
      statusMsg.textContent = "❌ Audio generation failed: " + e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "🎵 Synthesize All Voice & Music";
    }
  },

  updateSpeedSyncUI(speed, srcDur, voiceDur, rawVoiceDur, voiceSpeed, syncMode) {
    if (!this.activeProject) return;
    this.activeProject.auto_matched_video_speed = speed;
    this.activeProject.source_duration = srcDur;
    this.activeProject.voice_duration = voiceDur;
    this.activeProject.raw_voice_duration = rawVoiceDur || voiceDur;
    this.activeProject.voice_speed = voiceSpeed || 1.0;

    const box = document.getElementById("box-video-voice-sync");
    const badge = document.getElementById("badge-sync-speed");
    const details = document.getElementById("lbl-sync-details");
    const vidDurLbl = document.getElementById("lbl-sync-vid-dur");
    const voiceDurLbl = document.getElementById("lbl-sync-voice-dur");

    if (box) box.style.display = "block";
    if (vidDurLbl && srcDur) vidDurLbl.textContent = this.formatTime(srcDur);
    if (voiceDurLbl && voiceDur) voiceDurLbl.textContent = this.formatTime(voiceDur);

    if (voiceSpeed && Math.abs(voiceSpeed - 1.0) > 0.02) {
      if (badge) badge.textContent = `Auto-Fit: ${voiceSpeed.toFixed(2)}x Voice Speed`;
      if (details) {
        details.innerHTML = `✅ Narration tempo auto-scaled to <strong>${voiceSpeed.toFixed(2)}x</strong> so all <strong>${this.formatTime(rawVoiceDur)}</strong> of your explanation fits the <strong>${this.formatTime(srcDur)}</strong> video. <strong>100% complete story voiced with natural pitch (0% cutoff)!</strong>`;
      }
    } else {
      if (badge) badge.textContent = `100% Synced`;
      if (details) {
        details.textContent = `Voice narration duration (${this.formatTime(voiceDur)}) matches video duration (${this.formatTime(srcDur)}). Zero cutoff!`;
      }
    }
  },

  setSpeedFactor(val) {
    const slider = document.getElementById("range-speed-factor");
    const lblVal = document.getElementById("lbl-val-speed");
    const lblStep4 = document.getElementById("lbl-step4-speed-display");
    if (slider) slider.value = val;
    let labelText = `${val.toFixed(2)}x`;
    if (Math.abs(val - 1.04) < 0.005) labelText += " (Recap Standard)";
    else if (Math.abs(val - 1.00) < 0.005) labelText += " (Original Time)";
    else if (Math.abs(val - 1.03) < 0.005) labelText += " (Subtle Shift)";
    else if (Math.abs(val - 1.06) < 0.005) labelText += " (Fast Pacing)";
    else if (Math.abs(val - 1.08) < 0.005) labelText += " (Quick Recap)";
    if (lblVal) lblVal.textContent = labelText;
    if (lblStep4) lblStep4.textContent = `${val.toFixed(2)}x`;
    if (this.activeProject) this.activeProject.speed = val;
  },

  getSelectedRenderSpeed() {
    const chk = document.getElementById("chk-speed");
    if (chk && !chk.checked) return 1.0;
    const slider = document.getElementById("range-speed-factor");
    if (slider && slider.value) {
      const val = parseFloat(slider.value);
      if (val >= 0.50 && val <= 2.0) return val;
    }
    return this.activeProject?.speed || 1.04;
  },

  applyExactOriginalPreset() {
    const frameSel = document.getElementById("select-framing-style");
    if (frameSel) frameSel.value = "original";

    const chkSpeed = document.getElementById("chk-speed");
    if (chkSpeed) {
      chkSpeed.checked = false;
      const box = document.getElementById("box-speed-control");
      if (box) box.style.opacity = "0.4";
    }
    this.setSpeedFactor(1.00);

    this.updateDurationShiftUI(0.0);

    const chkMirror = document.getElementById("chk-mirror");
    if (chkMirror) chkMirror.checked = false;
    const chkGrain = document.getElementById("chk-grain");
    if (chkGrain) chkGrain.checked = false;
    const chkVignette = document.getElementById("chk-vignette");
    if (chkVignette) chkVignette.checked = false;
    const chkMicroCrop = document.getElementById("chk-micro-crop");
    if (chkMicroCrop) chkMicroCrop.checked = false;
    const colorGrade = document.getElementById("select-color-grade");
    if (colorGrade) colorGrade.value = "none";

    const radioFit = document.getElementById("sync-mode-fit-voice");
    if (radioFit) radioFit.checked = true;

    const img = document.getElementById("img-preview-frame");
    if (this.activeProjectId && img && img.style.display !== "none") {
      this.renderLivePreviewFrame();
    }
  },

  applyAntiCopyrightPreset() {
    const frameSel = document.getElementById("select-framing-style");
    if (frameSel) frameSel.value = "blur_fit";

    const chkSpeed = document.getElementById("chk-speed");
    if (chkSpeed) {
      chkSpeed.checked = true;
      const box = document.getElementById("box-speed-control");
      if (box) box.style.opacity = "1";
    }
    this.setSpeedFactor(1.03);

    this.updateDurationShiftUI(-3.0);

    const chkMirror = document.getElementById("chk-mirror");
    if (chkMirror) chkMirror.checked = true;
    const chkGrain = document.getElementById("chk-grain");
    if (chkGrain) chkGrain.checked = true;
    const chkVignette = document.getElementById("chk-vignette");
    if (chkVignette) chkVignette.checked = true;
    const chkMicroCrop = document.getElementById("chk-micro-crop");
    if (chkMicroCrop) chkMicroCrop.checked = true;
    const colorGrade = document.getElementById("select-color-grade");
    if (colorGrade) colorGrade.value = "cinematic_warm";

    const img = document.getElementById("img-preview-frame");
    if (this.activeProjectId && img && img.style.display !== "none") {
      this.renderLivePreviewFrame();
    }
  },

  setDelogoPreset(preset) {
    const presets = {
      top_right: { x: 80, y: 3, w: 18, h: 12 },
      top_left: { x: 2, y: 3, w: 18, h: 12 },
      bottom_right: { x: 80, y: 85, w: 18, h: 12 },
      bottom_left: { x: 2, y: 85, w: 18, h: 12 }
    };
    const p = presets[preset] || presets.top_right;
    const rangeX = document.getElementById("range-delogo-x");
    const rangeY = document.getElementById("range-delogo-y");
    const rangeW = document.getElementById("range-delogo-w");
    const rangeH = document.getElementById("range-delogo-h");

    if (rangeX) rangeX.value = p.x;
    if (rangeY) rangeY.value = p.y;
    if (rangeW) rangeW.value = p.w;
    if (rangeH) rangeH.value = p.h;

    const lblX = document.getElementById("lbl-val-delogo-x");
    const lblY = document.getElementById("lbl-val-delogo-y");
    const lblW = document.getElementById("lbl-val-delogo-w");
    const lblH = document.getElementById("lbl-val-delogo-h");
    if (lblX) lblX.textContent = `${p.x}%`;
    if (lblY) lblY.textContent = `${p.y}%`;
    if (lblW) lblW.textContent = `${p.w}%`;
    if (lblH) lblH.textContent = `${p.h}%`;

    this.delogoCoords = {
      x: p.x / 100,
      y: p.y / 100,
      w: p.w / 100,
      h: p.h / 100
    };
    const coordsLbl = document.getElementById("lbl-delogo-coords");
    if (coordsLbl) coordsLbl.textContent = `x=${p.x}%, y=${p.y}%, w=${p.w}%, h=${p.h}%`;
    const chk = document.getElementById("chk-enable-delogo");
    if (chk) chk.checked = true;
  },

  async renderLivePreviewFrame() {
    if (!this.activeProjectId) {
      alert("Please upload and process a video in Step 1 first.");
      return;
    }
    const btn = document.getElementById("btn-live-preview-frame");
    const btnRef = document.getElementById("btn-live-preview-frame-refresh");
    if (btn) { btn.disabled = true; btn.textContent = "Rendering Frame..."; }
    if (btnRef) { btnRef.disabled = true; btnRef.textContent = "Rendering..."; }

    const enableDelogo = document.getElementById("chk-enable-delogo")?.checked || false;
    const highlightDelogo = document.getElementById("chk-highlight-delogo")?.checked || false;
    const enableWatermark = document.getElementById("chk-enable-watermark")?.checked || false;
    const wmType = document.querySelector('input[name="wm-type-radio"]:checked')?.value || "text";
    const seekSec = parseFloat(document.getElementById("range-preview-seek")?.value || 5.0);

    const payload = {
      time_sec: seekSec,
      aspect_ratio: document.getElementById("select-aspect-ratio").value,
      quality: "720p",
      framing_style: document.getElementById("select-framing-style").value,
      mirror: document.getElementById("chk-mirror").checked,
      grain: document.getElementById("chk-grain").checked,
      vignette: document.getElementById("chk-vignette").checked,
      color_grade: document.getElementById("select-color-grade").value,
      micro_crop: document.getElementById("chk-micro-crop")?.checked ?? true,
      highlight_delogo: highlightDelogo,
      delogo_box: {
        enabled: enableDelogo,
        x: 1920 * this.delogoCoords.x,
        y: 1080 * this.delogoCoords.y,
        w: 1920 * this.delogoCoords.w,
        h: 1080 * this.delogoCoords.h
      },
      custom_watermark: this.getCustomWatermarkSettings()
    };

    try {
      const blob = await API.previewFrame(this.activeProjectId, payload);
      const url = URL.createObjectURL(blob);
      const img = document.getElementById("img-preview-frame");
      const emptyLbl = document.getElementById("lbl-preview-empty");
      img.onload = () => {
        const wmSettings = this.getCustomWatermarkSettings();
        if (wmSettings.enabled) {
          this.updateWatermarkPin(Math.round(wmSettings.x * 100), Math.round(wmSettings.y * 100));
        }
      };
      img.src = url;
      img.style.display = "block";
      if (emptyLbl) emptyLbl.style.display = "none";

      const wmSettings = this.getCustomWatermarkSettings();
      const hint = document.getElementById("lbl-preview-drag-hint");
      if (hint) hint.style.display = wmSettings.enabled ? "block" : "none";
      if (wmSettings.enabled) {
        this.updateWatermarkPin(Math.round(wmSettings.x * 100), Math.round(wmSettings.y * 100));
      }

      document.getElementById("preview-frame-container").style.display = "block";
      img.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) {
      alert("Frame preview failed: " + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "👁️ Live Frame Preview"; }
      if (btnRef) { btnRef.disabled = false; btnRef.textContent = "⚡ Refresh Preview Frame"; }
    }
  },

  formatTime(sec) {
    if (!sec || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  },

  handleVideoTimeUpdate(currentTime, duration) {
    const lbl = document.getElementById("lbl-video-current-time");
    if (lbl) {
      lbl.textContent = `${this.formatTime(currentTime)} / ${this.formatTime(duration)}`;
    }

    // Live callout overlay on video player
    const activeCallout = this.textOverlays.find(c => c.start <= currentTime && currentTime <= c.end);
    const box = document.getElementById("video-live-overlay-box");
    const txt = document.getElementById("video-live-overlay-text");
    if (activeCallout && box && txt) {
      txt.textContent = activeCallout.text;
      txt.style.color = activeCallout.color || "#facc15";
      txt.style.fontSize = `${activeCallout.font_size || 22}px`;
      if (activeCallout.position === "top") {
        box.style.bottom = "auto";
        box.style.top = "20px";
      } else if (activeCallout.position === "center") {
        box.style.bottom = "auto";
        box.style.top = "42%";
      } else {
        box.style.top = "auto";
        box.style.bottom = "38px";
      }
      box.style.display = "block";
    } else if (box) {
      box.style.display = "none";
    }
  },

  markCutIn() {
    const video = document.getElementById("video-player-main");
    this.pendingCutIn = video.currentTime;
    alert(`Marked Cut In-Point at ${video.currentTime.toFixed(1)}s. Now seek forward and click 'Cut End (Out)'.`);
  },

  markCutOut() {
    const video = document.getElementById("video-player-main");
    if (this.pendingCutIn === null) {
      alert("Please click 'Cut Start (In)' first before marking Cut End.");
      return;
    }
    const start = Math.min(this.pendingCutIn, video.currentTime);
    const end = Math.max(this.pendingCutIn, video.currentTime);
    this.sceneCuts.push({ start: parseFloat(start.toFixed(2)), end: parseFloat(end.toFixed(2)) });
    this.pendingCutIn = null;
    alert(`Added cut zone: ${start.toFixed(1)}s to ${end.toFixed(1)}s.`);
    this.renderTimelineTracks();
  },

  openAddCalloutModal() {
    const video = document.getElementById("video-player-main");
    const editIndexEl = document.getElementById("callout-edit-index");
    if (editIndexEl) editIndexEl.value = -1;
    const titleEl = document.getElementById("modal-callout-title");
    if (titleEl) titleEl.textContent = "➕ Add Styled Text Callout & Chapter";
    
    document.getElementById("callout-input-text").value = "";
    document.getElementById("callout-input-start").value = video.currentTime.toFixed(1);
    document.getElementById("callout-input-end").value = (video.currentTime + 4.5).toFixed(1);
    document.getElementById("callout-input-color").value = "yellow";
    document.getElementById("callout-input-size").value = "38";
    const posEl = document.getElementById("callout-input-pos");
    if (posEl) posEl.value = "bottom";

    const saveBtn = document.getElementById("btn-save-new-callout");
    if (saveBtn) saveBtn.textContent = "Add Callout";
    document.getElementById("modal-add-callout").classList.add("open");
  },

  editCallout(index) {
    const item = this.textOverlays[index];
    if (!item) return;

    const editIndexEl = document.getElementById("callout-edit-index");
    if (editIndexEl) editIndexEl.value = index;
    const titleEl = document.getElementById("modal-callout-title");
    if (titleEl) titleEl.textContent = `✏️ Edit Callout #${index + 1}`;

    document.getElementById("callout-input-text").value = item.text || "";
    document.getElementById("callout-input-start").value = item.start;
    document.getElementById("callout-input-end").value = item.end;
    document.getElementById("callout-input-color").value = item.color || "yellow";
    document.getElementById("callout-input-size").value = item.font_size || "38";
    const posEl = document.getElementById("callout-input-pos");
    if (posEl) posEl.value = item.position || "bottom";

    const saveBtn = document.getElementById("btn-save-new-callout");
    if (saveBtn) saveBtn.textContent = "Save Changes";
    document.getElementById("modal-add-callout").classList.add("open");
  },

  closeAddCalloutModal() {
    document.getElementById("modal-add-callout").classList.remove("open");
  },

  setCalloutCurrentTime() {
    const video = document.getElementById("video-player-main");
    document.getElementById("callout-input-start").value = video.currentTime.toFixed(1);
    document.getElementById("callout-input-end").value = (video.currentTime + 4.0).toFixed(1);
  },

  saveNewCallout() {
    const text = document.getElementById("callout-input-text").value.trim();
    if (!text) {
      alert("Please enter callout text.");
      return;
    }
    const editIdx = parseInt(document.getElementById("callout-edit-index")?.value ?? -1);
    const st = parseFloat(document.getElementById("callout-input-start").value) || 0;
    const en = parseFloat(document.getElementById("callout-input-end").value) || 5;
    const color = document.getElementById("callout-input-color").value;
    const fsize = parseInt(document.getElementById("callout-input-size").value) || 38;
    const pos = document.getElementById("callout-input-pos")?.value || "bottom";

    const calloutData = {
      text: text,
      start: st,
      end: en,
      color: color,
      font_size: fsize,
      position: pos
    };

    if (editIdx >= 0 && editIdx < this.textOverlays.length) {
      this.textOverlays[editIdx] = calloutData;
    } else {
      this.textOverlays.push(calloutData);
    }

    this.renderTextOverlaysList();
    this.renderTimelineTracks();
    this.closeAddCalloutModal();
    document.getElementById("callout-input-text").value = "";
  },

  renderTextOverlaysList() {
    const container = document.getElementById("text-overlays-list");
    if (!container) return;
    if (this.textOverlays.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">No text callouts added. Click '+ Add Text Callout' above.</p>`;
      return;
    }
    container.innerHTML = "";
    this.textOverlays.forEach((item, idx) => {
      const div = document.createElement("div");
      div.className = "switch-card";
      div.style.padding = "8px 12px";
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <div style="flex: 1;">
          <strong style="color: ${item.color || '#fff'}">${item.text}</strong>
          <div style="font-size: 11px; color: var(--accent-cyan); margin-top: 2px;">
            ⏱️ ${item.start.toFixed(1)}s - ${item.end.toFixed(1)}s • Pos: ${item.position || 'bottom'} • ${item.font_size || 38}px
          </div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="App.editCallout(${idx})">✏️ Edit</button>
          <button class="btn btn-secondary btn-sm" style="color: var(--accent-rose);" onclick="App.removeTextOverlay(${idx})">✕</button>
        </div>
      `;
      container.appendChild(div);
    });

    if (this.activeProjectId) {
      API.updateTimeline(this.activeProjectId, this.sceneCuts, this.textOverlays);
    }
  },

  renderTimelineTracks() {
    const video = document.getElementById("video-player-main");
    const dur = video.duration || 60;
    const calloutTrack = document.getElementById("timeline-callout-track");
    if (!calloutTrack) return;

    calloutTrack.innerHTML = `<div style="font-size: 11px; color: var(--accent-amber); padding: 4px 8px; font-weight: 600;">🏷️ Text Callouts Track</div>`;

    this.textOverlays.forEach(item => {
      const leftPct = Math.min(100, Math.max(0, (item.start / dur) * 100));
      const widthPct = Math.min(100 - leftPct, Math.max(4, ((item.end - item.start) / dur) * 100));

      const block = document.createElement("div");
      block.className = "timeline-clip-block";
      block.style.left = `${leftPct}%`;
      block.style.width = `${widthPct}%`;
      block.style.background = "linear-gradient(90deg, #f59e0b 0%, #ec4899 100%)";
      block.textContent = item.text;
      calloutTrack.appendChild(block);
    });
  },

  removeTextOverlay(index) {
    this.textOverlays.splice(index, 1);
    this.renderTextOverlaysList();
    this.renderTimelineTracks();
  },

  async startFinalRender() {
    if (!this.activeProjectId) return;
    const btn = document.getElementById("btn-start-final-render");
    btn.disabled = true;

    const enableDelogo = document.getElementById("chk-enable-delogo").checked;
    const enableWatermark = document.getElementById("chk-enable-watermark").checked;
    const wmType = document.querySelector('input[name="wm-type-radio"]:checked')?.value || "text";

    const syncMode = document.querySelector('input[name="audio-sync-mode"]:checked')?.value || "fit_to_video";
    const isExact = syncMode === "exact_timeline";

    const renderOptions = {
      aspect_ratio: document.getElementById("select-aspect-ratio").value,
      quality: document.getElementById("select-export-quality").value,
      fps: parseInt(document.getElementById("select-export-fps").value),
      framing_style: document.getElementById("select-framing-style").value,
      mirror: document.getElementById("chk-mirror").checked,
      speed: this.getSelectedRenderSpeed(),
      grain: document.getElementById("chk-grain").checked,
      vignette: document.getElementById("chk-vignette").checked,
      color_grade: document.getElementById("select-color-grade").value,
      micro_crop: document.getElementById("chk-micro-crop")?.checked ?? false,
      sync_mode: syncMode,
      delogo_box: {
        enabled: enableDelogo,
        x: 1920 * this.delogoCoords.x,
        y: 1080 * this.delogoCoords.y,
        w: 1920 * this.delogoCoords.w,
        h: 1080 * this.delogoCoords.h
      },
      custom_watermark: this.getCustomWatermarkSettings(),
      duration_shift: isExact ? 0.0 : parseFloat(document.getElementById("select-duration-shift")?.value || document.getElementById("select-step2-duration-shift")?.value || -3.0),
      bgm_preset: document.getElementById("select-bgm-preset")?.value || "suspense",
      bgm_volume_db: parseFloat(document.getElementById("range-bgm-volume")?.value || -26.0),
      voice_provider: document.getElementById("select-voice-provider")?.value || "edge_tts",
      narrator_voice: document.getElementById("select-narrator-voice")?.value
    };

    document.getElementById("render-progress-box").style.display = "block";
    document.getElementById("render-results-box").style.display = "none";
    document.getElementById("render-progress-fill").style.width = "5%";
    document.getElementById("render-status-pct").textContent = "5%";
    document.getElementById("render-status-log").textContent = "Initializing render pipeline...";

    try {
      await API.startRender(this.activeProjectId, renderOptions);
      this.startPollingRenderStatus();
    } catch (e) {
      alert("Failed to start render: " + e.message);
      btn.disabled = false;
    }
  },

  startPollingRenderStatus() {
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(async () => {
      try {
        const status = await API.getRenderStatus(this.activeProjectId);
        const fill = document.getElementById("render-progress-fill");
        const pctLbl = document.getElementById("render-status-pct");
        const msgLbl = document.getElementById("render-status-log");

        fill.style.width = `${status.progress}%`;
        pctLbl.textContent = `${status.progress}%`;
        msgLbl.textContent = status.message || "Rendering...";

        if (status.status === "completed") {
          clearInterval(this.pollInterval);
          this.handleRenderCompleted();
        } else if (status.status === "error") {
          clearInterval(this.pollInterval);
          alert("Render failed: " + status.message);
          document.getElementById("btn-start-final-render").disabled = false;
        }
      } catch (e) {
        console.warn("Polling error:", e);
      }
    }, 1500);
  },

  async handleRenderCompleted() {
    document.getElementById("btn-start-final-render").disabled = false;
    document.getElementById("render-progress-box").style.display = "none";
    document.getElementById("render-results-box").style.display = "block";

    // Setup direct download button
    const dlBtn = document.getElementById("btn-download-video-file");
    dlBtn.href = `/api/projects/${this.activeProjectId}/download-video`;

    // Fetch updated project metadata
    const proj = await API.getProject(this.activeProjectId);
    this.activeProject = proj;

    // Load In-Browser Master Video Player
    const masterVideo = document.getElementById("video-player-final");
    if (masterVideo) {
      masterVideo.src = `/api/projects/${this.activeProjectId}/video-stream?which=final&t=${Date.now()}`;
      masterVideo.load();
    }
  },

  copyText(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
      navigator.clipboard.writeText(el.value);
      alert("Copied to clipboard!");
    }
  },

  openSettingsModal() {
    const gemStatus = document.getElementById("gemini-test-status");
    const elStatus = document.getElementById("elevenlabs-test-status");
    if (gemStatus) gemStatus.textContent = "";
    if (elStatus) elStatus.textContent = "";
    document.getElementById("modal-settings").classList.add("open");
  },

  closeSettingsModal() {
    document.getElementById("modal-settings").classList.remove("open");
  },

  toggleKeyVisibility(inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      if (btn) btn.textContent = "🙈";
    } else {
      input.type = "password";
      if (btn) btn.textContent = "👁️";
    }
  },

  async testGeminiConnection() {
    const btn = document.getElementById("btn-test-gemini-key");
    const status = document.getElementById("gemini-test-status");
    const key = document.getElementById("cfg-gemini-key")?.value?.trim();
    const model = document.getElementById("cfg-gemini-model")?.value || "gemini-4-argon";

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Testing...";
    }
    if (status) {
      status.style.color = "var(--accent-cyan)";
      status.textContent = "Connecting to Gemini...";
    }

    try {
      const res = await API.testGemini(key, model);
      if (res.status === "success") {
        if (status) {
          status.style.color = "var(--accent-emerald)";
          status.textContent = "✅ " + res.message;
        }
      } else {
        if (status) {
          status.style.color = "#ef4444";
          status.textContent = "❌ " + (res.message || "Connection failed");
        }
      }
    } catch (e) {
      if (status) {
        status.style.color = "#ef4444";
        status.textContent = "❌ " + e.message;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🔌 Test Connection";
      }
    }
  },

  async testElevenLabsConnection() {
    const btn = document.getElementById("btn-test-elevenlabs-key");
    const status = document.getElementById("elevenlabs-test-status");
    const key = document.getElementById("cfg-elevenlabs-key")?.value?.trim();

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Testing...";
    }
    if (status) {
      status.style.color = "var(--accent-cyan)";
      status.textContent = "Connecting to ElevenLabs...";
    }

    try {
      const res = await API.testElevenLabs(key);
      if (res.status === "success") {
        if (status) {
          status.style.color = "var(--accent-emerald)";
          status.textContent = "✅ " + res.message;
        }
        const currentProvider = document.getElementById("select-voice-provider")?.value;
        if (currentProvider === "elevenlabs") {
          this.updateNarratorVoiceList();
        }
      } else {
        if (status) {
          status.style.color = "#ef4444";
          status.textContent = "❌ " + (res.message || "Connection failed");
        }
      }
    } catch (e) {
      if (status) {
        status.style.color = "#ef4444";
        status.textContent = "❌ " + e.message;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🔌 Test Connection";
      }
    }
  },

  async saveSettings() {
    const geminiKey = document.getElementById("cfg-gemini-key").value;
    const geminiModel = document.getElementById("cfg-gemini-model").value;
    const elevenlabsKey = document.getElementById("cfg-elevenlabs-key").value;

    try {
      await API.updateConfig({
        gemini_api_key: geminiKey,
        gemini_model: geminiModel,
        elevenlabs_api_key: elevenlabsKey
      });
      alert("Settings saved successfully!");
      this.closeSettingsModal();
    } catch (e) {
      alert("Failed to save settings: " + e.message);
    }
  },

  resetNewProject() {
    if (confirm("Start a new project? Any unsaved state on current project will remain in database.")) {
      window.location.reload();
    }
  }
};

window.addEventListener("DOMContentLoaded", () => {
  App.init();
});
