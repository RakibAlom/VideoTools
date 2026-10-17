// MangaRecap AI Studio - Client Application Controller
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Lucide icons
  if (window.lucide) lucide.createIcons();

  // App State
  const state = {
    currentStep: 1,
    currentProject: null,
    selectedFile: null,
    activeAuditionId: null,
    recordingSegmentId: null
  };

  // DOM Elements
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const selectedFileBadge = document.getElementById('selected-file-badge');
  const selectedFileName = document.getElementById('selected-filename');

  const inputMangaRef = document.getElementById('input-manga-ref');
  const selectTargetLength = document.getElementById('select-target-length');
  const selectAspectRatio = document.getElementById('select-aspect-ratio');
  const selectMaxPages = document.getElementById('select-max-pages');
  const inputPageRange = document.getElementById('input-page-range');
  const selectLanguage = document.getElementById('select-language');
  const languageBadge = document.getElementById('language-badge');
  const selectNarrator = document.getElementById('select-narrator');
  const btnPlayVoiceSample = document.getElementById('btn-play-voice-sample');
  const voiceSampleBtnLabel = document.getElementById('voice-sample-btn-label');
  const selectMotionSpeed = document.getElementById('select-motion-speed');
  const selectFrameStyle = document.getElementById('select-frame-style');
  const selectExportQuality = document.getElementById('select-export-quality');
  const customVoiceContainer = document.getElementById('custom-voice-container');
  const inputCustomVoiceId = document.getElementById('input-custom-voice-id');
  const textareaCustomInstructions = document.getElementById('textarea-custom-instructions');

  const btnExtractPanels = document.getElementById('btn-extract-panels');
  const btnGenerateScript = document.getElementById('btn-generate-script');
  const btnSynthesizeAll = document.getElementById('btn-synthesize-all');
  const btnProceedToRender = document.getElementById('btn-proceed-to-render');
  const btnPreviewFrame = document.getElementById('btn-preview-frame');
  const btnStartRender = document.getElementById('btn-start-render');

  const panelsGrid = document.getElementById('panels-grid');
  const panelCountBadge = document.getElementById('panel-count-badge');
  const segmentsContainer = document.getElementById('segments-container');

  const renderProgressBar = document.getElementById('render-progress-bar');
  const renderPercentage = document.getElementById('render-percentage');
  const renderMessage = document.getElementById('render-message');
  const renderStatusTitle = document.getElementById('render-status-title');

  const finalVideoPlayer = document.getElementById('final-video-player');
  const btnDownloadVideo = document.getElementById('btn-download-video');
  const thumbnailImgPreview = document.getElementById('thumbnail-img-preview');
  const btnDownloadThumbnail = document.getElementById('btn-download-thumbnail');
  const inputThumbnailHook = document.getElementById('input-thumbnail-hook');
  const btnUpdateThumbnail = document.getElementById('btn-update-thumbnail');
  const selectThumbnailTheme = document.getElementById('select-thumbnail-theme');
  const selectThumbnailFontSize = document.getElementById('select-thumbnail-font-size');
  const thumbnailLoadingOverlay = document.getElementById('thumbnail-loading-overlay');
  const thumbnailHookChips = document.getElementById('thumbnail-hook-chips');
  const viralTitlesList = document.getElementById('viral-titles-list');
  const textareaDescription = document.getElementById('textarea-description');
  const tagsContainer = document.getElementById('tags-container');

  const btnLoadDemo = document.getElementById('btn-load-demo');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnNewProject = document.getElementById('btn-new-project');
  const settingsModal = document.getElementById('settings-modal');
  const selectGeminiModel = document.getElementById('select-gemini-model');

  // Preview Modal Elements
  const previewFrameModal = document.getElementById('preview-frame-modal');
  const btnClosePreviewModal = document.getElementById('btn-close-preview-modal');
  const btnRefreshPreview = document.getElementById('btn-refresh-preview');
  const previewFrameVideo = document.getElementById('preview-frame-video');
  const previewLoadingSpinner = document.getElementById('preview-loading-spinner');
  const modalPreviewFrameStyle = document.getElementById('modal-preview-frame-style');
  const modalPreviewMotionSpeed = document.getElementById('modal-preview-motion-speed');

  // Step 2 Panel Curation & Lightbox Elements
  const checkboxSelectAllPanels = document.getElementById('checkbox-select-all-panels');
  const btnAddCustomPanel = document.getElementById('btn-add-custom-panel');
  const inputCustomPanelFiles = document.getElementById('input-custom-panel-files');
  const btnDeleteSelectedPanels = document.getElementById('btn-delete-selected-panels');
  const deleteSelectedText = document.getElementById('delete-selected-text');
  const btnRestoreAllPanels = document.getElementById('btn-restore-all-panels');
  const restorePanelsText = document.getElementById('restore-panels-text');
  const panelRemovalBanner = document.getElementById('panel-removal-banner');
  const panelRemovalMsg = document.getElementById('panel-removal-msg');
  const btnUndoPanelRemoval = document.getElementById('btn-undo-panel-removal');

  // Step 4 Watermark Elements
  const checkboxEnableWatermark = document.getElementById('checkbox-enable-watermark');
  const watermarkOptionsContainer = document.getElementById('watermark-options-container');
  const inputWatermarkText = document.getElementById('input-watermark-text');
  const selectWatermarkPos = document.getElementById('select-watermark-pos');
  const selectWatermarkOpacity = document.getElementById('select-watermark-opacity');
  const selectWatermarkSize = document.getElementById('select-watermark-size');

  const panelLightboxModal = document.getElementById('panel-lightbox-modal');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');
  const lightboxBtnRemove = document.getElementById('lightbox-btn-remove');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxPanelBadge = document.getElementById('lightbox-panel-badge');
  const lightboxPanelTitle = document.getElementById('lightbox-panel-title');
  const lightboxPanelMeta = document.getElementById('lightbox-panel-meta');

  const auditionPlayer = document.getElementById('global-audition-player');

  // Stepper Navigation
  function goToStep(step) {
    state.currentStep = step;
    for (let i = 1; i <= 5; i++) {
      const section = document.getElementById(`section-step-${i}`);
      const navItem = document.getElementById(`step-nav-${i}`);
      if (section) section.classList.toggle('hidden', i !== step);
      if (navItem) {
        navItem.classList.toggle('active', i === step);
        if (i < step) {
          navItem.classList.add('completed');
        } else {
          navItem.classList.remove('completed');
        }
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.lucide) lucide.createIcons();
  }

  // Bind Stepper Click
  for (let i = 1; i <= 5; i++) {
    const navItem = document.getElementById(`step-nav-${i}`);
    if (navItem) {
      navItem.addEventListener('click', () => {
        if (state.currentProject || i === 1) {
          goToStep(i);
        }
      });
    }
  }

  // Supported Language Names and Voice Catalogs
  const LANGUAGE_NAMES = {
    en: "English (US / Global)",
    hi: "Hindi (हिन्दी)",
    ur: "Urdu (اردو)",
    bn: "Bangla (বাংলা)",
    es: "Spanish (Español)",
    ja: "Japanese (日本語)",
    ko: "Korean (한국어)",
    id: "Indonesian (Bahasa)",
    pt: "Portuguese (Português)",
    fr: "French (Français)",
    de: "German (Deutsch)",
    ar: "Arabic (العربية)"
  };

  const LANGUAGE_VOICES = {
    en: {
      defaultVoice: "Charon",
      groups: [
        {
          label: "Google Gemini Studio Voices (Default & High Retention)",
          options: [
            { value: "Charon", text: "Charon (Deep Recapper - Recommended)" },
            { value: "Puck", text: "Puck (Energetic Storyteller)" },
            { value: "Kore", text: "Kore (Clear Narrative Female)" },
            { value: "Fenrir", text: "Fenrir (Intense Suspense)" },
            { value: "Aoede", text: "Aoede (Dramatic Female)" }
          ]
        },
        {
          label: "Zero-Cost Natural Edge-TTS (No Key Needed)",
          options: [
            { value: "Christopher", text: "Christopher (Deep Natural)" },
            { value: "Guy", text: "Guy (Engaging Storyteller)" },
            { value: "Andrew", text: "Andrew (Natural Male)" },
            { value: "Brian", text: "Brian (Natural British)" }
          ]
        },
        {
          label: "ElevenLabs High-Retention Narrators",
          options: [
            { value: "Adam", text: "Adam (Deep Authority)" },
            { value: "George", text: "George (Warm Storyteller)" },
            { value: "Marcus", text: "Marcus (Resonant Epic)" },
            { value: "Daniel", text: "Daniel (British Suspense)" },
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    bn: {
      defaultVoice: "Pradeep",
      groups: [
        {
          label: "Zero-Cost Bangla Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Pradeep", text: "Pradeep (Bengali Bangladesh Male - Deep Recapper - Recommended)" },
            { value: "Nabanita", text: "Nabanita (Bengali Bangladesh Female - Emotional Narrator)" },
            { value: "Bashkar", text: "Bashkar (Bengali India Male - Clear Storyteller)" },
            { value: "Tanishaa", text: "Tanishaa (Bengali India Female - Expressive)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices (Speaks Bengali)",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual Recapper)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female Recapper)" },
            { value: "Fenrir", text: "Fenrir (Gemini Intense Suspense)" },
            { value: "Aoede", text: "Aoede (Gemini Dramatic)" }
          ]
        },
        {
          label: "ElevenLabs Multilingual v2 / Custom",
          options: [
            { value: "Adam", text: "Adam (ElevenLabs Multilingual)" },
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    hi: {
      defaultVoice: "Madhur",
      groups: [
        {
          label: "Zero-Cost Hindi Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Madhur", text: "Madhur (Hindi Male Storyteller - Recommended)" },
            { value: "Swara", text: "Swara (Hindi Female Narrator)" }
          ]
        },
        {
          label: "ElevenLabs Native Hindi Storytellers",
          options: [
            { value: "Prem", text: "Prem (Native Hindi High-Retention - Recommended)" },
            { value: "Kabir", text: "Kabir (Deep Hindi Dramatic)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices (Speaks Hindi)",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual Recapper)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female Recapper)" },
            { value: "Fenrir", text: "Fenrir (Gemini Intense Suspense)" },
            { value: "Aoede", text: "Aoede (Gemini Dramatic)" },
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    ur: {
      defaultVoice: "Asad",
      groups: [
        {
          label: "Zero-Cost Urdu Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Asad", text: "Asad (Urdu Pakistan Male - Deep Dastan/Recapper - Recommended)" },
            { value: "Uzma", text: "Uzma (Urdu Pakistan Female - Expressive Narrator)" },
            { value: "Salman", text: "Salman (Urdu Pakistan Male - Clear Recapper)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices (Speaks Urdu)",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual Recapper)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female Recapper)" },
            { value: "Fenrir", text: "Fenrir (Gemini Intense Suspense)" },
            { value: "Aoede", text: "Aoede (Gemini Dramatic)" }
          ]
        },
        {
          label: "ElevenLabs Multilingual v2 / Custom",
          options: [
            { value: "Adam", text: "Adam (ElevenLabs Multilingual)" },
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    es: {
      defaultVoice: "Alvaro",
      groups: [
        {
          label: "Zero-Cost Spanish Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Alvaro", text: "Alvaro (Spanish Spain Male - Recommended)" },
            { value: "Elvira", text: "Elvira (Spanish Spain Female)" },
            { value: "Jorge", text: "Jorge (Spanish Mexico Male)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female)" }
          ]
        },
        {
          label: "ElevenLabs / Custom",
          options: [
            { value: "Adam", text: "Adam (Multilingual)" },
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    ja: {
      defaultVoice: "Keita",
      groups: [
        {
          label: "Zero-Cost Japanese Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Keita", text: "Keita (Japanese Male - Recommended)" },
            { value: "Nanami", text: "Nanami (Japanese Female)" },
            { value: "Naoki", text: "Naoki (Japanese Male)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female)" }
          ]
        },
        {
          label: "ElevenLabs / Custom",
          options: [
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    ko: {
      defaultVoice: "InJoon",
      groups: [
        {
          label: "Zero-Cost Korean Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "InJoon", text: "InJoon (Korean Male - Recommended)" },
            { value: "SunHi", text: "SunHi (Korean Female)" },
            { value: "Hyunsu", text: "Hyunsu (Korean Male)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female)" }
          ]
        },
        {
          label: "ElevenLabs / Custom",
          options: [
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    id: {
      defaultVoice: "Ardi",
      groups: [
        {
          label: "Zero-Cost Indonesian Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Ardi", text: "Ardi (Indonesian Male - Recommended)" },
            { value: "Gadis", text: "Gadis (Indonesian Female)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female)" }
          ]
        },
        {
          label: "ElevenLabs / Custom",
          options: [
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    pt: {
      defaultVoice: "Antonio",
      groups: [
        {
          label: "Zero-Cost Portuguese Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Antonio", text: "Antonio (Portuguese Portugal Male - Recommended)" },
            { value: "Francisca", text: "Francisca (Portuguese Portugal Female)" },
            { value: "Duarte", text: "Duarte (Portuguese Portugal Male)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female)" }
          ]
        },
        {
          label: "ElevenLabs / Custom",
          options: [
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    fr: {
      defaultVoice: "Henri",
      groups: [
        {
          label: "Zero-Cost French Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Henri", text: "Henri (French Male - Recommended)" },
            { value: "Denise", text: "Denise (French Female)" },
            { value: "Alain", text: "Alain (French Male)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female)" }
          ]
        },
        {
          label: "ElevenLabs / Custom",
          options: [
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    de: {
      defaultVoice: "Conrad",
      groups: [
        {
          label: "Zero-Cost German Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Conrad", text: "Conrad (German Male - Recommended)" },
            { value: "Katja", text: "Katja (German Female)" },
            { value: "Killian", text: "Killian (German Male)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female)" }
          ]
        },
        {
          label: "ElevenLabs / Custom",
          options: [
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    },
    ar: {
      defaultVoice: "Shakir",
      groups: [
        {
          label: "Zero-Cost Arabic Neural Voices (Edge-TTS • Free)",
          options: [
            { value: "Shakir", text: "Shakir (Arabic Male - Recommended)" },
            { value: "Amina", text: "Amina (Arabic Female)" },
            { value: "Hamed", text: "Hamed (Arabic Male)" }
          ]
        },
        {
          label: "Google Gemini Multilingual Voices",
          options: [
            { value: "Charon", text: "Charon (Gemini Multilingual)" },
            { value: "Puck", text: "Puck (Gemini Energetic)" },
            { value: "Kore", text: "Kore (Gemini Female)" }
          ]
        },
        {
          label: "ElevenLabs / Custom",
          options: [
            { value: "custom", text: "Custom Voice ID" }
          ]
        }
      ]
    }
  };

  // Helper to re-populate Narrator dropdown dynamically based on selected language
  function updateNarratorOptionsForLanguage(langCode, preserveVoice = null) {
    if (!selectNarrator) return;
    const langData = LANGUAGE_VOICES[langCode] || LANGUAGE_VOICES['en'];
    const currentVal = preserveVoice || selectNarrator.value;
    
    selectNarrator.innerHTML = '';
    let foundCurrent = false;

    langData.groups.forEach(grp => {
      const optGroup = document.createElement('optgroup');
      optGroup.label = grp.label;
      grp.options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if (opt.value === currentVal) {
          option.selected = true;
          foundCurrent = true;
        }
        optGroup.appendChild(option);
      });
      selectNarrator.appendChild(optGroup);
    });

    if (!foundCurrent) {
      selectNarrator.value = langData.defaultVoice;
    }

    if (languageBadge) {
      languageBadge.textContent = LANGUAGE_NAMES[langCode] || langCode.toUpperCase();
    }

    if (selectNarrator.value === 'custom') {
      if (customVoiceContainer) customVoiceContainer.classList.remove('hidden');
    } else {
      if (customVoiceContainer) customVoiceContainer.classList.add('hidden');
    }
  }

  // Language Change Listener
  if (selectLanguage) {
    selectLanguage.addEventListener('change', () => {
      const chosenLang = selectLanguage.value;
      updateNarratorOptionsForLanguage(chosenLang);
      persistStep1Inputs();
    });
  }

  // Narrator select toggle for custom voice
  if (selectNarrator) {
    selectNarrator.addEventListener('change', () => {
      if (selectNarrator.value === 'custom') {
        customVoiceContainer.classList.remove('hidden');
      } else {
        customVoiceContainer.classList.add('hidden');
      }
      persistStep1Inputs();
    });
  }

  // Voice Sample Audition (Language-Aware)
  let voiceSampleAudio = null;
  if (btnPlayVoiceSample) {
    btnPlayVoiceSample.addEventListener('click', async (e) => {
      e.stopPropagation();
      const voice = selectNarrator ? selectNarrator.value : 'Charon';
      const lang = selectLanguage ? selectLanguage.value : 'en';

      if (voice === 'custom') {
        alert("Enter custom ElevenLabs voice ID or select a preset studio voice to preview.");
        return;
      }

      if (voiceSampleAudio && !voiceSampleAudio.paused) {
        voiceSampleAudio.pause();
        voiceSampleAudio.currentTime = 0;
        if (voiceSampleBtnLabel) voiceSampleBtnLabel.textContent = "Play Sample";
        btnPlayVoiceSample.classList.remove('text-amber-300');
        return;
      }

      const geminiVoices = ['Charon', 'Puck', 'Kore', 'Fenrir', 'Aoede'];
      const elevenVoices = ['Adam', 'George', 'Marcus', 'Daniel', 'Prem', 'Kabir'];
      let provider = 'gemini';
      if (elevenVoices.includes(voice)) provider = 'elevenlabs';
      else if (geminiVoices.includes(voice)) provider = 'gemini';
      else provider = 'edge_tts';

      if (voiceSampleBtnLabel) voiceSampleBtnLabel.textContent = "Generating...";
      btnPlayVoiceSample.disabled = true;

      try {
        const sampleUrl = API.getVoiceSampleUrl(voice, provider, lang);
        if (!voiceSampleAudio) {
          voiceSampleAudio = new Audio();
          voiceSampleAudio.addEventListener('ended', () => {
            if (voiceSampleBtnLabel) voiceSampleBtnLabel.textContent = "Play Sample";
            btnPlayVoiceSample.classList.remove('text-amber-300');
          });
          voiceSampleAudio.addEventListener('pause', () => {
            if (voiceSampleBtnLabel) voiceSampleBtnLabel.textContent = "Play Sample";
            btnPlayVoiceSample.classList.remove('text-amber-300');
          });
        }
        voiceSampleAudio.src = sampleUrl;
        await voiceSampleAudio.play();
        if (voiceSampleBtnLabel) voiceSampleBtnLabel.textContent = "Playing ⏸";
        btnPlayVoiceSample.classList.add('text-amber-300');
      } catch (err) {
        console.error("Voice sample error:", err);
        alert("Voice preview error: " + err.message);
        if (voiceSampleBtnLabel) voiceSampleBtnLabel.textContent = "Play Sample";
      } finally {
        btnPlayVoiceSample.disabled = false;
      }
    });
  }

  // Two-way synchronization between Page Range select and manual text input
  if (selectMaxPages && inputPageRange) {
    selectMaxPages.addEventListener('change', () => {
      const val = selectMaxPages.value;
      if (val === 'custom') {
        inputPageRange.focus();
      } else if (val === 'all') {
        inputPageRange.value = 'all';
      } else {
        inputPageRange.value = `1-${val}`;
      }
      persistStep1Inputs();
    });

    inputPageRange.addEventListener('input', () => {
      const val = inputPageRange.value.trim().toLowerCase();
      if (val === '1-10' || val === '10') selectMaxPages.value = '10';
      else if (val === '1-15' || val === '15') selectMaxPages.value = '15';
      else if (val === '1-30' || val === '30') selectMaxPages.value = '30';
      else if (val === '1-50' || val === '50') selectMaxPages.value = '50';
      else if (val === '1-100' || val === '100') selectMaxPages.value = '100';
      else if (val === 'all') selectMaxPages.value = 'all';
      else selectMaxPages.value = 'custom';
      persistStep1Inputs();
    });
  }

  // Live Frame & Motion Preview Modal
  async function loadFramePreview() {
    if (!state.currentProject) {
      alert("No active project. Extract panels or load demo project first!");
      return;
    }
    if (previewLoadingSpinner) previewLoadingSpinner.classList.remove('hidden');
    try {
      const options = {
        aspect_ratio: selectAspectRatio ? selectAspectRatio.value : '16:9',
        frame_style: modalPreviewFrameStyle ? modalPreviewFrameStyle.value : (selectFrameStyle ? selectFrameStyle.value : 'dark_ambient'),
        motion_speed: modalPreviewMotionSpeed ? modalPreviewMotionSpeed.value : (selectMotionSpeed ? selectMotionSpeed.value : 'smooth_slow'),
        export_quality: '480p',
        enable_watermark: checkboxEnableWatermark ? checkboxEnableWatermark.checked : false,
        watermark_text: inputWatermarkText ? inputWatermarkText.value.trim() : '@MangaRecapStudio',
        watermark_position: selectWatermarkPos ? selectWatermarkPos.value : 'top_right',
        watermark_opacity: selectWatermarkOpacity ? parseFloat(selectWatermarkOpacity.value) : 0.45,
        watermark_font_size: selectWatermarkSize ? parseInt(selectWatermarkSize.value) : 32
      };
      const previewUrl = await API.previewFrame(state.currentProject.id, options);
      if (previewFrameVideo) {
        previewFrameVideo.src = previewUrl;
        previewFrameVideo.load();
        previewFrameVideo.play().catch(() => {});
      }
    } catch (err) {
      alert("Frame preview error: " + err.message);
    } finally {
      if (previewLoadingSpinner) previewLoadingSpinner.classList.add('hidden');
    }
  }

  if (btnPreviewFrame) {
    btnPreviewFrame.addEventListener('click', () => {
      if (!state.currentProject) {
        alert("Please extract panels or load demo project first to preview frame motion.");
        return;
      }
      if (modalPreviewFrameStyle && selectFrameStyle) {
        modalPreviewFrameStyle.value = selectFrameStyle.value;
      }
      if (modalPreviewMotionSpeed && selectMotionSpeed) {
        modalPreviewMotionSpeed.value = selectMotionSpeed.value;
      }
      if (previewFrameModal) previewFrameModal.classList.remove('hidden');
      loadFramePreview();
    });
  }

  if (btnClosePreviewModal && previewFrameModal) {
    btnClosePreviewModal.addEventListener('click', () => {
      previewFrameModal.classList.add('hidden');
      if (previewFrameVideo) previewFrameVideo.pause();
    });
  }

  if (btnRefreshPreview) {
    btnRefreshPreview.addEventListener('click', () => {
      if (selectFrameStyle && modalPreviewFrameStyle) selectFrameStyle.value = modalPreviewFrameStyle.value;
      if (selectMotionSpeed && modalPreviewMotionSpeed) selectMotionSpeed.value = modalPreviewMotionSpeed.value;
      persistStep1Inputs();
      loadFramePreview();
    });
  }

  // Dropzone handling
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-yellow-400');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-yellow-400'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-yellow-400');
    if (e.dataTransfer.files.length > 0) {
      handleSelectedFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleSelectedFile(fileInput.files[0]);
    }
  });

  function handleSelectedFile(file) {
    state.selectedFile = file;
    selectedFileName.textContent = `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
    selectedFileBadge.classList.remove('hidden');
  }

  // ==================== STEP 1: EXTRACT PANELS ====================
  btnExtractPanels.addEventListener('click', async () => {
    persistStep1Inputs();
    if (!state.selectedFile && !state.currentProject) {
      alert("Please upload a Manga PDF, ZIP archive, or image first.");
      return;
    }

    try {
      btnExtractPanels.disabled = true;
      btnExtractPanels.innerHTML = `<span class="animate-spin mr-2">⏳</span> Slicing Panels with OpenCV...`;

      const pageRangeVal = (inputPageRange && inputPageRange.value.trim()) || (selectMaxPages ? selectMaxPages.value : "15");

      // 1. Create project with full configuration
      const projData = {
        name: state.selectedFile ? state.selectedFile.name.replace(/\.[^/.]+$/, "") : "Manga Recap",
        internal_manga_ref: inputMangaRef.value.trim(),
        target_length: selectTargetLength.value,
        aspect_ratio: selectAspectRatio.value,
        narrator: selectNarrator.value,
        custom_voice_id: inputCustomVoiceId.value.trim(),
        custom_instructions: textareaCustomInstructions.value.trim(),
        frame_style: selectFrameStyle ? selectFrameStyle.value : "dark_ambient",
        motion_speed: selectMotionSpeed ? selectMotionSpeed.value : "smooth_slow",
        export_quality: selectExportQuality ? selectExportQuality.value : "1080p",
        page_range: pageRangeVal,
        language: selectLanguage ? selectLanguage.value : "en"
      };

      const proj = await API.createProject(projData);
      state.currentProject = proj;

      // 2. Upload file & slice panels
      if (state.selectedFile) {
        const uploadRes = await API.uploadFile(proj.id, state.selectedFile, pageRangeVal);
        proj.panels = uploadRes.panels;
        proj.page_count = uploadRes.page_count;
        proj.page_range_display = uploadRes.page_range_display;
      }

      renderPanelsGallery(proj.panels, proj.page_count, proj.page_range_display);
      goToStep(2);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      btnExtractPanels.disabled = false;
      btnExtractPanels.innerHTML = `<i data-lucide="layers" class="w-5 h-5"></i><span>Extract Panels & Begin Production</span>`;
      if (window.lucide) lucide.createIcons();
    }
  });

  // ==================== STEP 2: PANELS GALLERY & CURATION ====================
  const selectedPanelIds = new Set();
  let lastRemovedPanels = [];
  let activeLightboxPanel = null;

  function showPanelRemovalBanner(msg) {
    if (!panelRemovalBanner || !panelRemovalMsg) return;
    panelRemovalMsg.textContent = msg;
    panelRemovalBanner.classList.remove('hidden');
  }

  function hidePanelRemovalBanner() {
    if (panelRemovalBanner) panelRemovalBanner.classList.add('hidden');
  }

  function updateBatchControls() {
    const panels = (state.currentProject && state.currentProject.panels) || [];
    if (btnDeleteSelectedPanels) {
      if (selectedPanelIds.size > 0) {
        btnDeleteSelectedPanels.classList.remove('hidden');
        btnDeleteSelectedPanels.classList.add('inline-flex');
        if (deleteSelectedText) deleteSelectedText.textContent = `Remove Selected (${selectedPanelIds.size})`;
      } else {
        btnDeleteSelectedPanels.classList.add('hidden');
        btnDeleteSelectedPanels.classList.remove('inline-flex');
      }
    }

    if (checkboxSelectAllPanels) {
      checkboxSelectAllPanels.checked = panels.length > 0 && selectedPanelIds.size === panels.length;
      checkboxSelectAllPanels.indeterminate = selectedPanelIds.size > 0 && selectedPanelIds.size < panels.length;
    }
  }

  function renderPanelsGallery(panels, pageCount = null, pageRangeDisplay = null) {
    panelsGrid.innerHTML = '';
    const totalOrig = (state.currentProject && state.currentProject.all_extracted_panels) ? state.currentProject.all_extracted_panels.length : panels.length;
    const removedCount = Math.max(0, totalOrig - panels.length);
    const pagesInfo = pageRangeDisplay ? ` from ${pageCount || '?'} Pages (${pageRangeDisplay})` : '';

    if (panelCountBadge) {
      panelCountBadge.textContent = `${panels.length} Active Panels${removedCount > 0 ? ` (${removedCount} removed)` : ''}${pagesInfo}`;
    }

    if (btnRestoreAllPanels) {
      if (removedCount > 0) {
        btnRestoreAllPanels.classList.remove('hidden');
        btnRestoreAllPanels.classList.add('inline-flex');
        if (restorePanelsText) restorePanelsText.textContent = `Restore All (${removedCount} Removed)`;
      } else {
        btnRestoreAllPanels.classList.add('hidden');
        btnRestoreAllPanels.classList.remove('inline-flex');
      }
    }

    updateBatchControls();

    if (panels.length === 0) {
      panelsGrid.innerHTML = `
        <div class="col-span-full p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
          <i data-lucide="alert-circle" class="w-8 h-8 text-yellow-400 mx-auto"></i>
          <p class="text-sm font-bold text-white">All panels have been removed!</p>
          <p class="text-xs text-slate-400">Click "Restore Removed Panels" to bring them back, or upload another chapter.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    panels.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = "glass-panel p-2 flex flex-col space-y-2 relative group hover:border-yellow-400/50 transition cursor-grab active:cursor-grabbing";
      card.id = `panel-card-${p.segment_id}`;
      card.draggable = true;
      card.dataset.index = idx;
      card.dataset.segId = p.segment_id;

      const thumbUrl = `/api/projects/${state.currentProject.id}/previews/${p.thumb_file}`;
      const isSelected = selectedPanelIds.has(p.segment_id);

      card.innerHTML = `
        <div class="aspect-[3/4] bg-slate-900 rounded-lg overflow-hidden border border-slate-800 relative cursor-pointer panel-thumb-container group/img" data-id="${p.segment_id}" title="Click to inspect full panel">
          <img src="${thumbUrl}" alt="Panel ${p.segment_id}" class="w-full h-full object-contain group-hover/img:scale-105 transition duration-200">
          
          <!-- Bulk Checkbox -->
          <label class="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/80 hover:bg-black cursor-pointer z-10 flex items-center transition" onclick="event.stopPropagation();" title="Select for batch removal">
            <input type="checkbox" class="panel-card-checkbox w-3.5 h-3.5 rounded accent-yellow-400 cursor-pointer" data-id="${p.segment_id}" ${isSelected ? 'checked' : ''}>
          </label>

          <!-- Segment Number Badge & Custom Badge -->
          <div class="absolute top-1.5 left-8 flex items-center space-x-1 pointer-events-none">
            <span class="px-2 py-0.5 rounded bg-black/80 text-[10px] font-black text-yellow-300">
              #${p.segment_id}
            </span>
            ${p.is_custom ? `<span class="px-1.5 py-0.5 rounded bg-blue-500/90 text-[9px] font-bold text-white shadow">Custom</span>` : ''}
          </div>

          <!-- Individual Delete/Remove Button -->
          <button type="button" class="btn-remove-single-panel absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white shadow-md transition z-10 hover:scale-110" data-id="${p.segment_id}" title="Remove this panel from recap" onclick="event.stopPropagation();">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>

          <!-- Inspect Hover Overlay -->
          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center pointer-events-none">
            <span class="text-[10px] font-bold text-white bg-slate-950/90 border border-slate-700 px-2.5 py-1 rounded-lg flex items-center space-x-1 shadow-lg">
              <i data-lucide="zoom-in" class="w-3 h-3 text-yellow-400"></i>
              <span>Inspect</span>
            </span>
          </div>
        </div>

        <!-- Reorder and Page Details Bar -->
        <div class="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-0.5">
          <button type="button" class="btn-move-panel-left p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-yellow-300 transition ${idx === 0 ? 'opacity-30 cursor-not-allowed' : ''}" title="Move Scene Left (Earlier)" onclick="event.stopPropagation();" ${idx === 0 ? 'disabled' : ''}>
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
          </button>
          
          <span class="text-[10px] text-slate-400 truncate max-w-[80px]" title="${p.is_custom ? 'Custom Uploaded Scene' : `Page ${p.page_num || 1}`}">
            ${p.is_custom ? 'Custom' : `Pg ${p.page_num || 1}`}
          </span>
          
          <button type="button" class="btn-move-panel-right p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-yellow-300 transition ${idx === panels.length - 1 ? 'opacity-30 cursor-not-allowed' : ''}" title="Move Scene Right (Later)" onclick="event.stopPropagation();" ${idx === panels.length - 1 ? 'disabled' : ''}>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;

      // Click card to open Lightbox
      const thumbContainer = card.querySelector('.panel-thumb-container');
      if (thumbContainer) {
        thumbContainer.addEventListener('click', () => openPanelLightbox(p));
      }

      // Checkbox change handler
      const checkbox = card.querySelector('.panel-card-checkbox');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          const segId = parseInt(checkbox.dataset.id);
          if (checkbox.checked) {
            selectedPanelIds.add(segId);
          } else {
            selectedPanelIds.delete(segId);
          }
          updateBatchControls();
        });
      }

      // Single Remove Button handler
      const btnRemove = card.querySelector('.btn-remove-single-panel');
      if (btnRemove) {
        btnRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          const segId = parseInt(btnRemove.dataset.id);
          removeSinglePanel(segId);
        });
      }

      // Move Left handler
      const btnLeft = card.querySelector('.btn-move-panel-left');
      if (btnLeft && idx > 0) {
        btnLeft.addEventListener('click', (e) => {
          e.stopPropagation();
          movePanelByOffset(idx, -1);
        });
      }

      // Move Right handler
      const btnRight = card.querySelector('.btn-move-panel-right');
      if (btnRight && idx < panels.length - 1) {
        btnRight.addEventListener('click', (e) => {
          e.stopPropagation();
          movePanelByOffset(idx, 1);
        });
      }

      // Drag and Drop handlers
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(idx));
        card.classList.add('opacity-40');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('opacity-40');
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('border-yellow-400');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('border-yellow-400');
      });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('border-yellow-400');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        if (!isNaN(fromIdx) && fromIdx !== idx) {
          reorderPanelsByIndex(fromIdx, idx);
        }
      });

      panelsGrid.appendChild(card);
    });

    if (window.lucide) lucide.createIcons();
  }

  // Move panel position by relative offset (-1 left, +1 right)
  async function movePanelByOffset(currIndex, offset) {
    if (!state.currentProject || !state.currentProject.panels) return;
    const panels = state.currentProject.panels;
    const targetIndex = currIndex + offset;
    if (targetIndex < 0 || targetIndex >= panels.length) return;

    const item = panels.splice(currIndex, 1)[0];
    panels.splice(targetIndex, 0, item);

    // Re-index segment_ids sequentially 1..N
    panels.forEach((p, i) => { p.segment_id = i + 1; });
    state.currentProject.panels = panels;

    renderPanelsGallery(panels, state.currentProject.page_count, state.currentProject.page_range_display);

    try {
      await API.reorderPanels(state.currentProject.id, panels.map(p => p.segment_id));
    } catch (e) {
      console.warn("Failed to persist panel reordering:", e);
    }
  }

  // Drag and Drop reordering handler
  async function reorderPanelsByIndex(fromIndex, toIndex) {
    if (!state.currentProject || !state.currentProject.panels) return;
    const panels = state.currentProject.panels;
    if (fromIndex < 0 || fromIndex >= panels.length || toIndex < 0 || toIndex >= panels.length) return;

    const item = panels.splice(fromIndex, 1)[0];
    panels.splice(toIndex, 0, item);

    panels.forEach((p, i) => { p.segment_id = i + 1; });
    state.currentProject.panels = panels;

    renderPanelsGallery(panels, state.currentProject.page_count, state.currentProject.page_range_display);

    try {
      await API.reorderPanels(state.currentProject.id, panels.map(p => p.segment_id));
    } catch (e) {
      console.warn("Failed to persist panel reordering:", e);
    }
  }

  // Custom Image/Panel Upload Listener
  if (btnAddCustomPanel && inputCustomPanelFiles) {
    btnAddCustomPanel.addEventListener('click', () => {
      inputCustomPanelFiles.click();
    });

    inputCustomPanelFiles.addEventListener('change', async () => {
      const files = Array.from(inputCustomPanelFiles.files || []);
      if (!files.length || !state.currentProject) return;

      btnAddCustomPanel.disabled = true;
      btnAddCustomPanel.innerHTML = `<span class="animate-spin mr-1">⏳</span> Uploading...`;

      try {
        const res = await API.uploadCustomPanels(state.currentProject.id, files);
        state.currentProject.panels = res.panels;
        state.currentProject.panel_count = res.panel_count;
        renderPanelsGallery(res.panels, state.currentProject.page_count, state.currentProject.page_range_display);
        showPanelRemovalBanner(`Successfully added ${res.added_count} custom image(s) to panels gallery!`);
      } catch (e) {
        alert("Failed to upload custom panels: " + e.message);
      } finally {
        btnAddCustomPanel.disabled = false;
        btnAddCustomPanel.innerHTML = `<i data-lucide="plus-circle" class="w-3.5 h-3.5"></i><span>➕ Add Custom Image</span>`;
        inputCustomPanelFiles.value = '';
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // Remove a single panel
  async function removeSinglePanel(segmentId) {
    if (!state.currentProject || !state.currentProject.panels) return;
    const current = state.currentProject.panels;
    const targetIdx = current.findIndex(p => p.segment_id === segmentId);
    if (targetIdx === -1) return;

    const removed = current[targetIdx];
    lastRemovedPanels = [removed];
    current.splice(targetIdx, 1);
    selectedPanelIds.delete(segmentId);

    // Re-index remaining panels sequentially 1..N
    current.forEach((p, idx) => {
      p.segment_id = idx + 1;
    });

    renderPanelsGallery(current, state.currentProject.page_count, state.currentProject.page_range_display);
    showPanelRemovalBanner(`Removed panel #${segmentId}. ${current.length} panels remaining for AI script.`);

    try {
      await API.updatePanels(state.currentProject.id, current);
    } catch (err) {
      console.warn("Could not sync panel removal:", err);
    }
  }

  // Batch remove selected panels
  async function removeSelectedPanels() {
    if (!state.currentProject || !state.currentProject.panels || selectedPanelIds.size === 0) return;
    const count = selectedPanelIds.size;
    const current = state.currentProject.panels;
    const toRemove = current.filter(p => selectedPanelIds.has(p.segment_id));
    const remaining = current.filter(p => !selectedPanelIds.has(p.segment_id));

    lastRemovedPanels = toRemove;
    selectedPanelIds.clear();

    // Re-index remaining panels 1..N
    remaining.forEach((p, idx) => {
      p.segment_id = idx + 1;
    });

    state.currentProject.panels = remaining;
    renderPanelsGallery(remaining, state.currentProject.page_count, state.currentProject.page_range_display);
    showPanelRemovalBanner(`Removed ${count} panel(s). ${remaining.length} panels remaining for AI script.`);

    try {
      await API.updatePanels(state.currentProject.id, remaining);
    } catch (err) {
      console.warn("Could not sync panels removal:", err);
    }
  }

  // Undo last panel removal
  async function undoPanelRemoval() {
    if (!lastRemovedPanels || lastRemovedPanels.length === 0 || !state.currentProject) return;
    const current = state.currentProject.panels || [];
    current.push(...lastRemovedPanels);
    lastRemovedPanels = [];

    // Re-sort and re-index 1..N
    current.forEach((p, idx) => {
      p.segment_id = idx + 1;
    });

    state.currentProject.panels = current;
    hidePanelRemovalBanner();
    renderPanelsGallery(current, state.currentProject.page_count, state.currentProject.page_range_display);

    try {
      await API.updatePanels(state.currentProject.id, current);
    } catch (err) {
      console.warn("Could not sync undo to server:", err);
    }
  }

  // Restore all originally extracted panels
  async function restoreAllPanelsAction() {
    if (!state.currentProject) return;
    try {
      const res = await API.restoreAllPanels(state.currentProject.id);
      state.currentProject.panels = res.panels;
      selectedPanelIds.clear();
      lastRemovedPanels = [];
      hidePanelRemovalBanner();
      renderPanelsGallery(res.panels, state.currentProject.page_count, state.currentProject.page_range_display);
      alert(`Restored all ${res.panels.length} original comic panels!`);
    } catch (err) {
      alert("Failed to restore all panels: " + err.message);
    }
  }

  // Lightbox Modal Controls
  function openPanelLightbox(panel) {
    if (!panelLightboxModal || !panel) return;
    activeLightboxPanel = panel;
    if (lightboxImg) {
      lightboxImg.src = `/api/projects/${state.currentProject.id}/panels/${panel.panel_file}`;
    }
    if (lightboxPanelBadge) {
      lightboxPanelBadge.textContent = `#${panel.segment_id}`;
    }
    if (lightboxPanelTitle) {
      lightboxPanelTitle.textContent = `Panel #${panel.segment_id} • Page ${panel.page_num || 1}`;
    }
    if (lightboxPanelMeta) {
      lightboxPanelMeta.textContent = `Resolution: ${panel.width}x${panel.height} • File: ${panel.panel_file}`;
    }
    panelLightboxModal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  function closePanelLightbox() {
    if (panelLightboxModal) panelLightboxModal.classList.add('hidden');
    activeLightboxPanel = null;
  }

  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closePanelLightbox);
  if (panelLightboxModal) {
    panelLightboxModal.addEventListener('click', (e) => {
      if (e.target === panelLightboxModal) closePanelLightbox();
    });
  }

  if (lightboxBtnRemove) {
    lightboxBtnRemove.addEventListener('click', () => {
      if (activeLightboxPanel) {
        const segId = activeLightboxPanel.segment_id;
        closePanelLightbox();
        removeSinglePanel(segId);
      }
    });
  }

  // Bind Select All Checkbox
  if (checkboxSelectAllPanels) {
    checkboxSelectAllPanels.addEventListener('change', () => {
      const panels = (state.currentProject && state.currentProject.panels) || [];
      if (checkboxSelectAllPanels.checked) {
        panels.forEach(p => selectedPanelIds.add(p.segment_id));
      } else {
        selectedPanelIds.clear();
      }
      renderPanelsGallery(panels, state.currentProject.page_count, state.currentProject.page_range_display);
    });
  }

  // Bind Batch Delete Button
  if (btnDeleteSelectedPanels) {
    btnDeleteSelectedPanels.addEventListener('click', removeSelectedPanels);
  }

  // Bind Restore All Button
  if (btnRestoreAllPanels) {
    btnRestoreAllPanels.addEventListener('click', restoreAllPanelsAction);
  }

  // Bind Undo Button
  if (btnUndoPanelRemoval) {
    btnUndoPanelRemoval.addEventListener('click', undoPanelRemoval);
  }

  // ==================== STEP 3: SCRIPT GENERATION ====================
  btnGenerateScript.addEventListener('click', async () => {
    if (!state.currentProject) return;
    try {
      btnGenerateScript.disabled = true;
      btnGenerateScript.innerHTML = `<span class="animate-spin mr-2">⏳</span> Gemini Writing Recap Script...`;

      const chosenLanguage = selectLanguage ? selectLanguage.value : (state.currentProject.language || "en");
      const res = await API.generateScript(
        state.currentProject.id,
        textareaCustomInstructions.value.trim(),
        inputMangaRef.value.trim(),
        chosenLanguage
      );

      state.currentProject.segments = res.segments;
      renderScriptSegments(res.segments);
      goToStep(3);
    } catch (err) {
      alert("Script generation error: " + err.message);
    } finally {
      btnGenerateScript.disabled = false;
      btnGenerateScript.innerHTML = `<i data-lucide="wand-2" class="w-4 h-4"></i><span>Generate AI Script with Gemini</span>`;
      if (window.lucide) lucide.createIcons();
    }
  });

  function renderScriptSegments(segments) {
    segmentsContainer.innerHTML = '';

    segments.forEach((seg, idx) => {
      const card = document.createElement('div');
      card.className = "glass-panel p-4 flex flex-col md:flex-row items-start gap-4 transition hover:border-slate-700";
      card.id = `segment-card-${seg.segment_id}`;

      const thumbUrl = `/api/projects/${state.currentProject.id}/previews/${seg.thumb_file}`;
      const isManual = seg.voice_mode === 'manual';
      const hasAudio = !!seg.audio_file;

      card.innerHTML = `
        <!-- Left: Panel Thumbnail & Motion Tag -->
        <div class="w-full md:w-44 flex-shrink-0 flex flex-col space-y-2">
          <div class="aspect-video md:aspect-[4/3] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 relative">
            <img src="${thumbUrl}" alt="Segment ${seg.segment_id}" class="w-full h-full object-contain">
            <span class="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/80 text-[10px] font-black text-yellow-300">
              #${seg.segment_id}
            </span>
            ${seg.is_climax_panel ? '<span class="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-red-600/90 text-[10px] font-black text-white">CLIMAX</span>' : ''}
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span>Camera:</span>
            <select class="cam-motion-select bg-slate-900 text-xs text-yellow-300 border border-slate-800 rounded px-1.5 py-0.5" data-id="${seg.segment_id}">
              <option value="slow_zoom_in" ${seg.camera_motion === 'slow_zoom_in' ? 'selected' : ''}>Zoom In</option>
              <option value="slow_zoom_out" ${seg.camera_motion === 'slow_zoom_out' ? 'selected' : ''}>Zoom Out</option>
              <option value="pan_up" ${seg.camera_motion === 'pan_up' ? 'selected' : ''}>Pan Up</option>
              <option value="pan_down" ${seg.camera_motion === 'pan_down' ? 'selected' : ''}>Pan Down</option>
              <option value="static" ${seg.camera_motion === 'static' ? 'selected' : ''}>Static</option>
            </select>
          </div>
        </div>

        <!-- Center: Narration Textarea with breathing cadence -->
        <div class="flex-1 w-full space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <span>Third-Person Recap Line</span>
              <span class="text-[10px] font-normal text-slate-500">(Includes natural breathing pauses "...", "—")</span>
            </span>
            <div class="flex items-center space-x-2">
              <label class="text-[11px] text-slate-400 flex items-center space-x-1 cursor-pointer">
                <input type="checkbox" class="climax-toggle accent-yellow-400" data-id="${seg.segment_id}" ${seg.is_climax_panel ? 'checked' : ''}>
                <span>Climax Panel</span>
              </label>
            </div>
          </div>
          <textarea rows="3" class="narration-textarea w-full bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-white leading-relaxed resize-y focus:border-yellow-400 transition"
            data-id="${seg.segment_id}">${seg.narration_text}</textarea>
        </div>

        <!-- Right: Audio & Voiceover Controls (AI + MANUAL VOICE!) -->
        <div class="w-full md:w-56 flex-shrink-0 flex flex-col space-y-2.5 pt-1">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-400">Voice Track:</span>
            <span class="voice-badge text-[10px] font-bold px-2 py-0.5 rounded ${isManual ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'}">
              ${isManual ? '🎙️ Manual Voice' : 'AI Synthesized'}
            </span>
          </div>

          <div class="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Duration:</span>
            <span class="duration-tag font-mono text-yellow-300 font-bold">${seg.audio_duration ? seg.audio_duration.toFixed(2) + 's' : 'Not generated'}</span>
          </div>

          <!-- Audition Play Button -->
          <button class="btn-audition w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg ${hasAudio ? 'bg-slate-800 hover:bg-slate-700 text-yellow-300 border border-slate-700' : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'} text-xs font-semibold transition"
            data-id="${seg.segment_id}" ${!hasAudio ? 'disabled' : ''}>
            <i data-lucide="play" class="w-3.5 h-3.5"></i>
            <span>Audition Audio</span>
          </button>

          <!-- Action Buttons: Manual Mic Record OR AI Re-synthesize -->
          <div class="grid grid-cols-2 gap-1.5">
            <button class="btn-record-mic flex items-center justify-center space-x-1 px-2 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[11px] font-bold transition"
              data-id="${seg.segment_id}">
              <i data-lucide="mic" class="w-3.5 h-3.5"></i>
              <span>Record Mic</span>
            </button>

            <button class="btn-resynth flex items-center justify-center space-x-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium transition"
              data-id="${seg.segment_id}">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              <span>AI Voice</span>
            </button>
          </div>

          <!-- Upload Audio File Input -->
          <label class="w-full flex items-center justify-center space-x-1 px-2 py-1 rounded bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80 text-[10px] font-medium cursor-pointer transition">
            <i data-lucide="upload" class="w-3 h-3"></i>
            <span>Upload Voice Clip</span>
            <input type="file" accept="audio/*" class="custom-audio-file-input hidden" data-id="${seg.segment_id}">
          </label>
        </div>
      `;

      segmentsContainer.appendChild(card);
    });

    bindSegmentEvents();
    if (window.lucide) lucide.createIcons();
  }

  function bindSegmentEvents() {
    // 1. Narration Textarea change
    document.querySelectorAll('.narration-textarea').forEach(el => {
      el.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id);
        const seg = state.currentProject.segments.find(s => s.segment_id === id);
        if (seg) {
          seg.narration_text = e.target.value.trim();
          API.updateSegments(state.currentProject.id, state.currentProject.segments);
        }
      });
    });

    // 2. Camera Motion Select
    document.querySelectorAll('.cam-motion-select').forEach(el => {
      el.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id);
        const seg = state.currentProject.segments.find(s => s.segment_id === id);
        if (seg) {
          seg.camera_motion = e.target.value;
          API.updateSegments(state.currentProject.id, state.currentProject.segments);
        }
      });
    });

    // 3. Climax Toggle
    document.querySelectorAll('.climax-toggle').forEach(el => {
      el.addEventListener('change', (e) => {
        const id = parseInt(e.target.dataset.id);
        state.currentProject.segments.forEach(s => s.is_climax_panel = (s.segment_id === id && e.target.checked));
        renderScriptSegments(state.currentProject.segments);
        API.updateSegments(state.currentProject.id, state.currentProject.segments);
      });
    });

    // 4. Audition Play
    document.querySelectorAll('.btn-audition').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        const seg = state.currentProject.segments.find(s => s.segment_id === id);
        if (seg && seg.audio_file) {
          auditionPlayer.src = `/api/projects/${state.currentProject.id}/audio/${seg.audio_file}`;
          auditionPlayer.play();
        }
      });
    });

    // 5. AI Re-synthesize Single Line
    document.querySelectorAll('.btn-resynth').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);
        btn.disabled = true;
        btn.innerHTML = `<span class="animate-spin">⏳</span>`;
        try {
          const res = await API.synthesizeSegment(state.currentProject.id, id);
          const seg = state.currentProject.segments.find(s => s.segment_id === id);
          if (seg) {
            seg.audio_file = res.audio_file;
            seg.audio_duration = res.duration;
            seg.voice_mode = 'ai';
          }
          renderScriptSegments(state.currentProject.segments);
        } catch (err) {
          alert("Synthesis error: " + err.message);
        }
      });
    });

    // 6. Manual Microphone Recording!
    document.querySelectorAll('.btn-record-mic').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.id);

        if (window.audioRecorder.isRecording) {
          // STOP RECORDING
          btn.innerHTML = `<span class="animate-spin">⏳</span> Mastering Voice...`;
          const result = await window.audioRecorder.stopRecording();
          if (result && result.blob) {
            try {
              const res = await window.audioRecorder.uploadVoiceBlob(state.currentProject.id, id, result.blob);
              const seg = state.currentProject.segments.find(s => s.segment_id === id);
              if (seg) {
                seg.audio_file = res.audio_file;
                seg.audio_duration = res.duration;
                seg.voice_mode = 'manual';
              }
              renderScriptSegments(state.currentProject.segments);
            } catch (err) {
              alert("Voice upload error: " + err.message);
            }
          }
        } else {
          // START RECORDING
          const started = await window.audioRecorder.startRecording(id, (secs) => {
            btn.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-400 recording-dot mr-1"></span> 00:${secs < 10 ? '0' : ''}${secs} (Stop)`;
          });
          if (started) {
            btn.classList.add('bg-red-600', 'text-white');
          }
        }
      });
    });

    // 7. Upload Custom Audio File
    document.querySelectorAll('.custom-audio-file-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const id = parseInt(input.dataset.id);
        if (input.files.length > 0) {
          const file = input.files[0];
          try {
            const res = await window.audioRecorder.uploadCustomFile(state.currentProject.id, id, file);
            const seg = state.currentProject.segments.find(s => s.segment_id === id);
            if (seg) {
              seg.audio_file = res.audio_file;
              seg.audio_duration = res.duration;
              seg.voice_mode = 'manual';
            }
            renderScriptSegments(state.currentProject.segments);
          } catch (err) {
            alert("Audio upload failed: " + err.message);
          }
        }
      });
    });
  }

  // Synthesize All Voices Batch
  btnSynthesizeAll.addEventListener('click', async () => {
    if (!state.currentProject) return;
    try {
      btnSynthesizeAll.disabled = true;
      btnSynthesizeAll.innerHTML = `<span class="animate-spin mr-2">⏳</span> Synthesizing Voices...`;

      await API.synthesizeAll(state.currentProject.id);

      API.pollStatus(
        state.currentProject.id,
        (proj) => {
          if (proj.progress) {
            btnSynthesizeAll.innerHTML = `<span class="animate-spin mr-2">⏳</span> ${proj.progress.message}`;
          }
        },
        (proj) => {
          state.currentProject = proj;
          renderScriptSegments(proj.segments);
          btnSynthesizeAll.disabled = false;
          btnSynthesizeAll.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i><span>⚡ Synthesize All AI Voices</span>`;
          if (window.lucide) lucide.createIcons();
          alert("All voiceover narration tracks successfully synthesized and mastered!");
        },
        (err) => {
          alert("Synthesis error: " + err);
          btnSynthesizeAll.disabled = false;
          btnSynthesizeAll.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i><span>⚡ Synthesize All AI Voices</span>`;
        }
      );
    } catch (err) {
      alert("Error: " + err.message);
      btnSynthesizeAll.disabled = false;
    }
  });

  btnProceedToRender.addEventListener('click', () => {
    goToStep(4);
  });

  // ==================== STEP 4: VIDEO COMPILATION ====================
  btnStartRender.addEventListener('click', async () => {
    if (!state.currentProject) return;
    try {
      btnStartRender.disabled = true;
      btnStartRender.innerHTML = `<span class="animate-spin mr-2">⏳</span> Rendering Chunks with Ken Burns Motion...`;

      const renderOptions = {
        frame_style: selectFrameStyle ? selectFrameStyle.value : 'dark_ambient',
        motion_speed: selectMotionSpeed ? selectMotionSpeed.value : 'smooth_slow',
        export_quality: selectExportQuality ? selectExportQuality.value : '1080p',
        narrator: selectNarrator ? selectNarrator.value : 'Charon',
        language: selectLanguage ? selectLanguage.value : (state.currentProject.language || 'en'),
        enable_watermark: checkboxEnableWatermark ? checkboxEnableWatermark.checked : false,
        watermark_text: inputWatermarkText ? inputWatermarkText.value.trim() : '@MangaRecapStudio',
        watermark_position: selectWatermarkPos ? selectWatermarkPos.value : 'top_right',
        watermark_opacity: selectWatermarkOpacity ? parseFloat(selectWatermarkOpacity.value) : 0.45,
        watermark_font_size: selectWatermarkSize ? parseInt(selectWatermarkSize.value) : 32
      };

      await API.startRender(state.currentProject.id, renderOptions);

      API.pollStatus(
        state.currentProject.id,
        (proj) => {
          if (proj.progress) {
            const pct = Math.round((proj.progress.current / Math.max(1, proj.progress.total)) * 100);
            renderProgressBar.style.width = `${pct}%`;
            renderPercentage.textContent = `${pct}%`;
            renderMessage.textContent = proj.progress.message;
            renderStatusTitle.textContent = `Rendering In Progress (${pct}%)`;
          }
        },
        async (proj) => {
          state.currentProject = proj;
          renderProgressBar.style.width = `100%`;
          renderPercentage.textContent = `100%`;
          renderStatusTitle.textContent = `Compilation Finished!`;
          renderMessage.textContent = `Video compilation completed. Generating YouTube metadata & high-CTR thumbnail...`;

          // Generate packaging kit
          try {
            const metaRes = await API.generateMetadata(proj.id);
            state.currentProject.metadata = metaRes.metadata;
          } catch (e) {
            console.error("Metadata generation error:", e);
          }

          loadPublishingKit(state.currentProject);
          goToStep(5);
          btnStartRender.disabled = false;
          btnStartRender.innerHTML = `<i data-lucide="play" class="w-5 h-5"></i><span>🚀 Render Full Recap Video (FastStart MP4)</span>`;
          if (window.lucide) lucide.createIcons();
        },
        (err) => {
          alert("Render error: " + err);
          btnStartRender.disabled = false;
          btnStartRender.innerHTML = `<i data-lucide="play" class="w-5 h-5"></i><span>🚀 Render Full Recap Video (FastStart MP4)</span>`;
        }
      );
    } catch (err) {
      alert("Rendering error: " + err.message);
      btnStartRender.disabled = false;
    }
  });

  // ==================== STEP 5: PUBLISHING KIT ====================
  function loadPublishingKit(proj) {
    const videoUrl = `/api/projects/${proj.id}/video?t=${Date.now()}`;
    finalVideoPlayer.src = videoUrl;
    btnDownloadVideo.href = `/api/projects/${proj.id}/download-video`;
    btnDownloadVideo.onclick = () => {
      const orig = btnDownloadVideo.innerHTML;
      btnDownloadVideo.innerHTML = `<span class="animate-spin mr-1">⏳</span> Starting Download...`;
      setTimeout(() => { btnDownloadVideo.innerHTML = orig; if (window.lucide) lucide.createIcons(); }, 3000);
    };

    const thumbUrl = `/api/projects/${proj.id}/thumbnail?t=${Date.now()}`;
    thumbnailImgPreview.src = thumbUrl;
    btnDownloadThumbnail.href = thumbUrl;

    if (proj.thumbnail_hook) {
      inputThumbnailHook.value = proj.thumbnail_hook;
    }
    if (proj.thumbnail_theme && selectThumbnailTheme) {
      selectThumbnailTheme.value = proj.thumbnail_theme;
    }
    if (proj.thumbnail_font_size && selectThumbnailFontSize) {
      selectThumbnailFontSize.value = proj.thumbnail_font_size;
    }

    const meta = proj.metadata || {};

    // Dynamically inject recommended thumbnail hooks from AI into presets
    if (meta.thumbnail_hooks && meta.thumbnail_hooks.length > 0 && thumbnailHookChips) {
      const existingHooks = new Set();
      document.querySelectorAll('.btn-hook-chip').forEach(b => existingHooks.add(b.dataset.hook));
      meta.thumbnail_hooks.forEach(hook => {
        if (!existingHooks.has(hook)) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'btn-hook-chip text-[10px] font-bold px-2.5 py-1 rounded-lg bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 transition';
          chip.dataset.hook = hook;
          chip.textContent = hook;
          thumbnailHookChips.appendChild(chip);
        }
      });
      bindHookChips();
    }

    // 5 Viral Titles (Strictly 100% English Global CPM)
    viralTitlesList.innerHTML = '';
    const titles = meta.viral_titles || [
      "Betrayed By His Clan, He Awakens An Ancient Dragon System And Becomes Unstoppable",
      "Left For Dead In The Abyss, He Returns Wielding God Powers",
      "He Was The Weakest Outcast Until His Secret System Activated",
      "Banned From The Hunter Guild, He Becomes The Final Boss",
      "Reincarnated With Unlimited Powers, He Takes Total Revenge"
    ];

    titles.forEach((title, idx) => {
      const row = document.createElement('div');
      row.className = "flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-yellow-400/30 transition";
      row.innerHTML = `
        <span class="text-xs font-semibold text-slate-200 mr-2">#${idx + 1}. ${title}</span>
        <button class="btn-copy-title flex-shrink-0 flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-yellow-300 text-[11px] font-bold transition"
          data-title="${encodeURIComponent(title)}">
          <i data-lucide="copy" class="w-3 h-3"></i>
          <span>Copy</span>
        </button>
      `;
      viralTitlesList.appendChild(row);
    });

    document.querySelectorAll('.btn-copy-title').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = decodeURIComponent(btn.dataset.title);
        navigator.clipboard.writeText(t);
        btn.innerHTML = `<span>✓ Copied</span>`;
        setTimeout(() => {
          btn.innerHTML = `<i data-lucide="copy" class="w-3 h-3"></i><span>Copy</span>`;
          if (window.lucide) lucide.createIcons();
        }, 1500);
      });
    });

    // Description & Tags (Strictly 100% English)
    textareaDescription.value = meta.seo_description || "High-retention transformative manga recap video summary...";
    tagsContainer.textContent = meta.tags_csv || "manhwa recap, manga recap, op mc, solo leveling, anime recap";

    if (window.lucide) lucide.createIcons();
  }

  // High-CTR Rich Thumbnail Generation Controller
  async function triggerThumbnailUpdate(customHook = null) {
    if (!state.currentProject) return;
    const hook = (customHook !== null ? customHook : inputThumbnailHook.value).trim();
    const theme = selectThumbnailTheme ? selectThumbnailTheme.value : 'viral_yellow';
    const fontSize = selectThumbnailFontSize ? selectThumbnailFontSize.value : 'giant';

    if (thumbnailLoadingOverlay) {
      thumbnailLoadingOverlay.classList.remove('hidden');
      thumbnailLoadingOverlay.classList.add('flex');
    }
    btnUpdateThumbnail.disabled = true;

    try {
      await API.generateThumbnail(state.currentProject.id, hook, null, theme, fontSize);
      state.currentProject.thumbnail_hook = hook;
      state.currentProject.thumbnail_theme = theme;
      state.currentProject.thumbnail_font_size = fontSize;

      const newThumbUrl = `/api/projects/${state.currentProject.id}/thumbnail?t=${Date.now()}`;
      thumbnailImgPreview.src = newThumbUrl;
      btnDownloadThumbnail.href = newThumbUrl;
    } catch (e) {
      alert("Thumbnail generation error: " + e.message);
    } finally {
      if (thumbnailLoadingOverlay) {
        thumbnailLoadingOverlay.classList.add('hidden');
        thumbnailLoadingOverlay.classList.remove('flex');
      }
      btnUpdateThumbnail.disabled = false;
    }
  }

  // Update Thumbnail Event Listeners
  if (btnUpdateThumbnail) {
    btnUpdateThumbnail.addEventListener('click', () => triggerThumbnailUpdate());
  }

  if (selectThumbnailTheme) {
    selectThumbnailTheme.addEventListener('change', () => triggerThumbnailUpdate());
  }

  if (selectThumbnailFontSize) {
    selectThumbnailFontSize.addEventListener('change', () => triggerThumbnailUpdate());
  }

  function bindHookChips() {
    document.querySelectorAll('.btn-hook-chip').forEach(chip => {
      chip.onclick = () => {
        const hook = chip.dataset.hook;
        if (hook) {
          inputThumbnailHook.value = hook;
          triggerThumbnailUpdate(hook);
        }
      };
    });
  }
  bindHookChips();

  // Copy Buttons
  document.getElementById('btn-copy-description').addEventListener('click', () => {
    navigator.clipboard.writeText(textareaDescription.value);
    alert("Description copied to clipboard!");
  });

  document.getElementById('btn-copy-tags').addEventListener('click', () => {
    navigator.clipboard.writeText(tagsContainer.textContent);
    alert("Tags copied to clipboard!");
  });

  // ==================== LOAD DEMO PROJECT (1-CLICK) ====================
  btnLoadDemo.addEventListener('click', async () => {
    try {
      btnLoadDemo.disabled = true;
      btnLoadDemo.innerHTML = `<span class="animate-spin mr-1">⏳</span> Loading Demo...`;

      const demo = await API.loadDemoProject();
      state.currentProject = demo;

      inputMangaRef.value = demo.internal_manga_ref;
      textareaCustomInstructions.value = demo.custom_instructions;
      selectTargetLength.value = demo.target_length;
      selectAspectRatio.value = demo.aspect_ratio;

      renderPanelsGallery(demo.panels);
      renderScriptSegments(demo.segments);

      goToStep(3); // Navigate directly to Script & Voiceover Studio
    } catch (err) {
      alert("Failed to load demo: " + err.message);
    } finally {
      btnLoadDemo.disabled = false;
      btnLoadDemo.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4"></i><span>🌟 Load Demo Project</span>`;
      if (window.lucide) lucide.createIcons();
    }
  });

  // ==================== NEW PROJECT RESET ====================
  btnNewProject.addEventListener('click', () => {
    if (confirm("Reset current project and start a new recap?")) {
      state.currentProject = null;
      state.selectedFile = null;
      fileInput.value = '';
      selectedFileBadge.classList.add('hidden');
      goToStep(1);
    }
  });

  // ==================== AUTO-PERSISTENCE & SETTINGS ====================
  let cachedConfig = null;

  async function loadAndSyncSettings() {
    try {
      cachedConfig = await API.getConfig();
    } catch (e) {
      console.warn("Could not fetch remote config:", e);
      cachedConfig = {};
    }

    // Restore Step 1 Directives and Preferences from localStorage (or fallback to backend config)
    const savedMangaRef = localStorage.getItem('mr_manga_ref') || cachedConfig.internal_manga_ref;
    if (savedMangaRef && inputMangaRef) inputMangaRef.value = savedMangaRef;

    const savedTargetLength = localStorage.getItem('mr_target_length') || cachedConfig.target_length;
    if (savedTargetLength && selectTargetLength) selectTargetLength.value = savedTargetLength;

    const savedAspectRatio = localStorage.getItem('mr_aspect_ratio') || cachedConfig.aspect_ratio;
    if (savedAspectRatio && selectAspectRatio) selectAspectRatio.value = savedAspectRatio;

    const savedMaxPages = localStorage.getItem('mr_max_pages') || cachedConfig.max_pages;
    if (savedMaxPages && selectMaxPages) selectMaxPages.value = savedMaxPages;

    const savedPageRange = localStorage.getItem('mr_page_range') || cachedConfig.page_range;
    if (savedPageRange && inputPageRange) {
      inputPageRange.value = savedPageRange;
    } else if (savedMaxPages && inputPageRange) {
      inputPageRange.value = savedMaxPages === 'all' ? 'all' : `1-${savedMaxPages}`;
    }

    const savedLanguage = localStorage.getItem('mr_language') || cachedConfig.language || 'en';
    if (savedLanguage && selectLanguage) {
      selectLanguage.value = savedLanguage;
    }

    const savedNarrator = localStorage.getItem('mr_narrator') || cachedConfig.narrator;
    updateNarratorOptionsForLanguage(savedLanguage, savedNarrator);

    const savedMotionSpeed = localStorage.getItem('mr_motion_speed') || cachedConfig.motion_speed;
    if (savedMotionSpeed && selectMotionSpeed) selectMotionSpeed.value = savedMotionSpeed;

    const savedFrameStyle = localStorage.getItem('mr_frame_style') || cachedConfig.frame_style;
    if (savedFrameStyle && selectFrameStyle) selectFrameStyle.value = savedFrameStyle;

    const savedQuality = localStorage.getItem('mr_export_quality') || cachedConfig.export_quality;
    if (savedQuality && selectExportQuality) selectExportQuality.value = savedQuality;

    const savedCustomVoice = localStorage.getItem('mr_custom_voice_id') || cachedConfig.custom_voice_id;
    if (savedCustomVoice && inputCustomVoiceId) inputCustomVoiceId.value = savedCustomVoice;

    const savedInstructions = localStorage.getItem('mr_custom_instructions') || cachedConfig.custom_instructions;
    if (savedInstructions && textareaCustomInstructions) textareaCustomInstructions.value = savedInstructions;

    // Synchronize API keys in localStorage if present on backend
    if (cachedConfig.gemini_api_key && !localStorage.getItem('mr_gemini_key')) {
      localStorage.setItem('mr_gemini_key', cachedConfig.gemini_api_key);
    }
    if (cachedConfig.elevenlabs_api_key && !localStorage.getItem('mr_eleven_key')) {
      localStorage.setItem('mr_eleven_key', cachedConfig.elevenlabs_api_key);
    }

    // Watermark preferences (Default: Disabled)
    if (checkboxEnableWatermark) {
      const savedWm = localStorage.getItem('mr_enable_watermark');
      if (savedWm !== null) {
        checkboxEnableWatermark.checked = (savedWm === '1');
      } else {
        checkboxEnableWatermark.checked = Boolean(cachedConfig.enable_watermark);
      }
      if (watermarkOptionsContainer) {
        watermarkOptionsContainer.classList.toggle('hidden', !checkboxEnableWatermark.checked);
      }
      checkboxEnableWatermark.addEventListener('change', () => {
        if (watermarkOptionsContainer) {
          watermarkOptionsContainer.classList.toggle('hidden', !checkboxEnableWatermark.checked);
        }
        localStorage.setItem('mr_enable_watermark', checkboxEnableWatermark.checked ? '1' : '0');
      });
    }

    if (inputWatermarkText) {
      const savedWmText = localStorage.getItem('mr_watermark_text') || cachedConfig.watermark_text;
      if (savedWmText) inputWatermarkText.value = savedWmText;
      inputWatermarkText.addEventListener('input', () => {
        localStorage.setItem('mr_watermark_text', inputWatermarkText.value);
      });
    }

    if (selectWatermarkPos) {
      const savedWmPos = localStorage.getItem('mr_watermark_pos') || cachedConfig.watermark_position;
      if (savedWmPos) selectWatermarkPos.value = savedWmPos;
      selectWatermarkPos.addEventListener('change', () => {
        localStorage.setItem('mr_watermark_pos', selectWatermarkPos.value);
      });
    }

    if (selectWatermarkOpacity) {
      const savedWmOp = localStorage.getItem('mr_watermark_opacity') || cachedConfig.watermark_opacity;
      if (savedWmOp) selectWatermarkOpacity.value = String(savedWmOp);
      selectWatermarkOpacity.addEventListener('change', () => {
        localStorage.setItem('mr_watermark_opacity', selectWatermarkOpacity.value);
      });
    }

    if (selectWatermarkSize) {
      const savedWmSz = localStorage.getItem('mr_watermark_size') || cachedConfig.watermark_font_size;
      if (savedWmSz) selectWatermarkSize.value = String(savedWmSz);
      selectWatermarkSize.addEventListener('change', () => {
        localStorage.setItem('mr_watermark_size', selectWatermarkSize.value);
      });
    }

    updateHeaderBadges();
  }

  function updateHeaderBadges() {
    const hasGemini = Boolean(
      (cachedConfig && cachedConfig.has_gemini_key) ||
      (cachedConfig && cachedConfig.gemini_api_key) ||
      localStorage.getItem('mr_gemini_key')
    );
    const geminiBadge = document.getElementById('header-gemini-status');
    const geminiText = document.getElementById('gemini-status-text');
    if (geminiBadge && geminiText) {
      if (hasGemini) {
        geminiBadge.className = "flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 cursor-pointer hover:bg-emerald-500/20 transition";
        geminiText.textContent = "Gemini AI: Connected";
      } else {
        geminiBadge.className = "flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 cursor-pointer hover:bg-amber-500/20 transition";
        geminiText.textContent = "Gemini Key: Needed";
      }
    }

    const hasEleven = Boolean(
      (cachedConfig && cachedConfig.has_elevenlabs_key) ||
      (cachedConfig && cachedConfig.elevenlabs_api_key) ||
      localStorage.getItem('mr_eleven_key')
    );
    const voiceText = document.getElementById('voice-status-text');
    if (voiceText) {
      if (hasEleven) {
        voiceText.textContent = "Voice: ElevenLabs Pro";
      } else {
        voiceText.textContent = "Voice: Gemini Studio / Edge-TTS";
      }
    }
  }

  // Auto-persist Step 1 inputs on change or input
  let autoSaveTimeout = null;
  function persistStep1Inputs() {
    if (inputMangaRef) localStorage.setItem('mr_manga_ref', inputMangaRef.value.trim());
    if (selectLanguage) localStorage.setItem('mr_language', selectLanguage.value);
    if (selectTargetLength) localStorage.setItem('mr_target_length', selectTargetLength.value);
    if (selectAspectRatio) localStorage.setItem('mr_aspect_ratio', selectAspectRatio.value);
    if (selectMaxPages) localStorage.setItem('mr_max_pages', selectMaxPages.value);
    if (inputPageRange) localStorage.setItem('mr_page_range', inputPageRange.value.trim());
    if (selectNarrator) localStorage.setItem('mr_narrator', selectNarrator.value);
    if (selectMotionSpeed) localStorage.setItem('mr_motion_speed', selectMotionSpeed.value);
    if (selectFrameStyle) localStorage.setItem('mr_frame_style', selectFrameStyle.value);
    if (selectExportQuality) localStorage.setItem('mr_export_quality', selectExportQuality.value);
    if (inputCustomVoiceId) localStorage.setItem('mr_custom_voice_id', inputCustomVoiceId.value.trim());
    if (textareaCustomInstructions) localStorage.setItem('mr_custom_instructions', textareaCustomInstructions.value.trim());

    // Flash auto-saved indicator
    const badgeText = document.getElementById('directives-autosave-text');
    if (badgeText) {
      badgeText.textContent = "Saving...";
      clearTimeout(autoSaveTimeout);
      autoSaveTimeout = setTimeout(() => {
        badgeText.textContent = "Auto-Saved";
      }, 400);
    }
  }

  [
    inputMangaRef, selectLanguage, selectTargetLength, selectAspectRatio, selectMaxPages,
    inputPageRange, selectNarrator, selectMotionSpeed, selectFrameStyle,
    selectExportQuality, inputCustomVoiceId, textareaCustomInstructions
  ].forEach(el => {
    if (el) {
      el.addEventListener('input', persistStep1Inputs);
      el.addEventListener('change', persistStep1Inputs);
    }
  });

  // ==================== SETTINGS MODAL ====================
  async function openSettingsModal() {
    try {
      cachedConfig = await API.getConfig();
    } catch (e) {
      console.warn(e);
    }
    const cfg = cachedConfig || {};
    const effectiveGemini = cfg.gemini_api_key || localStorage.getItem('mr_gemini_key') || '';
    const effectiveEleven = cfg.elevenlabs_api_key || localStorage.getItem('mr_eleven_key') || '';
    const effectiveModel = cfg.gemini_model || localStorage.getItem('mr_gemini_model') || 'gemini-3.8-flash';

    const inputGemini = document.getElementById('input-gemini-key');
    const inputEleven = document.getElementById('input-elevenlabs-key');
    const geminiNote = document.getElementById('gemini-status-note');
    const elevenNote = document.getElementById('eleven-status-note');
    const alertBox = document.getElementById('settings-status-alert');

    if (alertBox) alertBox.classList.add('hidden');

    if (selectGeminiModel) {
      selectGeminiModel.value = effectiveModel;
    }

    if (inputGemini) {
      inputGemini.value = effectiveGemini;
      if (effectiveGemini) {
        inputGemini.placeholder = `Active (${effectiveGemini.slice(0, 4)}...${effectiveGemini.slice(-4)})`;
        geminiNote.innerHTML = `<span class="text-emerald-400 flex items-center space-x-1 font-semibold"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i><span>✓ Active & saved in config.json (${effectiveGemini.length} chars)</span></span>`;
      } else {
        inputGemini.placeholder = "AIzaSy... or paste Gemini API key";
        geminiNote.innerHTML = `<span class="text-slate-400">Enter your Gemini API key from Google AI Studio.</span>`;
      }
    }

    if (inputEleven) {
      inputEleven.value = effectiveEleven;
      if (effectiveEleven) {
        inputEleven.placeholder = `Active (${effectiveEleven.slice(0, 4)}...${effectiveEleven.slice(-4)})`;
        elevenNote.innerHTML = `<span class="text-emerald-400 flex items-center space-x-1 font-semibold"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i><span>✓ ElevenLabs Pro key saved</span></span>`;
      } else {
        inputEleven.placeholder = "sk_... (leave empty for free Edge-TTS)";
        elevenNote.innerHTML = `<span class="text-slate-400">Zero-cost Edge-TTS studio voices active if empty. No key required.</span>`;
      }
    }

    const checkMastering = document.getElementById('checkbox-mastering');
    if (checkMastering) checkMastering.checked = cfg.enable_audio_mastering !== false;

    const checkAmbient = document.getElementById('checkbox-ambient');
    if (checkAmbient) checkAmbient.checked = cfg.enable_ambient_bed !== false;

    settingsModal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  btnOpenSettings.addEventListener('click', openSettingsModal);
  const headerGeminiBtn = document.getElementById('header-gemini-status');
  if (headerGeminiBtn) headerGeminiBtn.addEventListener('click', openSettingsModal);

  const btnCloseSettings2 = document.getElementById('btn-close-settings-2');
  if (btnCloseSettings2) btnCloseSettings2.addEventListener('click', () => settingsModal.classList.add('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));

  // Eye Toggle Buttons
  const btnToggleGeminiEye = document.getElementById('btn-toggle-gemini-eye');
  if (btnToggleGeminiEye) {
    btnToggleGeminiEye.addEventListener('click', () => {
      const input = document.getElementById('input-gemini-key');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btnToggleGeminiEye.innerHTML = isPassword ? `<i data-lucide="eye-off" class="w-4 h-4 text-yellow-400"></i>` : `<i data-lucide="eye" class="w-4 h-4 text-slate-400"></i>`;
      if (window.lucide) lucide.createIcons();
    });
  }

  const btnToggleElevenEye = document.getElementById('btn-toggle-eleven-eye');
  if (btnToggleElevenEye) {
    btnToggleElevenEye.addEventListener('click', () => {
      const input = document.getElementById('input-elevenlabs-key');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btnToggleElevenEye.innerHTML = isPassword ? `<i data-lucide="eye-off" class="w-4 h-4 text-yellow-400"></i>` : `<i data-lucide="eye" class="w-4 h-4 text-slate-400"></i>`;
      if (window.lucide) lucide.createIcons();
    });
  }

  // Test Gemini Key Connection
  const btnTestGemini = document.getElementById('btn-test-gemini');
  if (btnTestGemini) {
    btnTestGemini.addEventListener('click', async () => {
      const key = document.getElementById('input-gemini-key').value.trim();
      const alertBox = document.getElementById('settings-status-alert');
      btnTestGemini.disabled = true;
      btnTestGemini.innerHTML = `<span class="animate-spin mr-1">⏳</span> Testing...`;
      try {
        const res = await API.testConfig({ gemini_api_key: key });
        const gRes = res.gemini;
        alertBox.classList.remove('hidden');
        if (gRes && gRes.ok) {
          alertBox.className = "p-3 rounded-xl text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300";
          alertBox.innerHTML = `✓ ${gRes.message}`;
        } else {
          alertBox.className = "p-3 rounded-xl text-xs font-semibold bg-red-500/20 border border-red-500/30 text-red-300";
          alertBox.innerHTML = `⚠ ${gRes ? gRes.message : 'Connection test failed'}`;
        }
      } catch (e) {
        alertBox.className = "p-3 rounded-xl text-xs font-semibold bg-red-500/20 border border-red-500/30 text-red-300";
        alertBox.innerHTML = `⚠ Test Error: ${e.message}`;
        alertBox.classList.remove('hidden');
      } finally {
        btnTestGemini.disabled = false;
        btnTestGemini.innerHTML = `<i data-lucide="zap" class="w-3 h-3"></i><span>Test Connection</span>`;
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // Test ElevenLabs Key Connection
  const btnTestEleven = document.getElementById('btn-test-eleven');
  if (btnTestEleven) {
    btnTestEleven.addEventListener('click', async () => {
      const key = document.getElementById('input-elevenlabs-key').value.trim();
      const alertBox = document.getElementById('settings-status-alert');
      btnTestEleven.disabled = true;
      btnTestEleven.innerHTML = `<span class="animate-spin mr-1">⏳</span> Testing...`;
      try {
        const res = await API.testConfig({ elevenlabs_api_key: key });
        const eRes = res.elevenlabs;
        alertBox.classList.remove('hidden');
        if (eRes && eRes.ok) {
          alertBox.className = "p-3 rounded-xl text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300";
          alertBox.innerHTML = `✓ ${eRes.message}`;
        } else {
          alertBox.className = "p-3 rounded-xl text-xs font-semibold bg-red-500/20 border border-red-500/30 text-red-300";
          alertBox.innerHTML = `⚠ ${eRes ? eRes.message : 'Connection test failed'}`;
        }
      } catch (e) {
        alertBox.className = "p-3 rounded-xl text-xs font-semibold bg-red-500/20 border border-red-500/30 text-red-300";
        alertBox.innerHTML = `⚠ Test Error: ${e.message}`;
        alertBox.classList.remove('hidden');
      } finally {
        btnTestEleven.disabled = false;
        btnTestEleven.innerHTML = `<i data-lucide="zap" class="w-3 h-3"></i><span>Test Voice</span>`;
        if (window.lucide) lucide.createIcons();
      }
    });
  }

  // Save Settings
  btnSaveSettings.addEventListener('click', async () => {
    const geminiKey = document.getElementById('input-gemini-key').value.trim();
    const elevenKey = document.getElementById('input-elevenlabs-key').value.trim();
    const modelChosen = selectGeminiModel ? selectGeminiModel.value : 'gemini-3.8-flash';
    const alertBox = document.getElementById('settings-status-alert');

    btnSaveSettings.disabled = true;
    btnSaveSettings.innerHTML = `<span class="animate-spin mr-1">⏳</span> Saving...`;

    const update = {
      gemini_api_key: geminiKey,
      elevenlabs_api_key: elevenKey,
      gemini_model: modelChosen,
      enable_audio_mastering: document.getElementById('checkbox-mastering').checked,
      enable_ambient_bed: document.getElementById('checkbox-ambient').checked
    };

    try {
      const res = await API.saveConfig(update);
      cachedConfig = res.config;

      // Always save to browser localStorage as double guarantee
      if (geminiKey) {
        localStorage.setItem('mr_gemini_key', geminiKey);
      } else {
        localStorage.removeItem('mr_gemini_key');
      }

      if (elevenKey) {
        localStorage.setItem('mr_eleven_key', elevenKey);
      } else {
        localStorage.removeItem('mr_eleven_key');
      }

      if (modelChosen) {
        localStorage.setItem('mr_gemini_model', modelChosen);
      }

      updateHeaderBadges();

      alertBox.className = "p-3 rounded-xl text-xs font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300";
      alertBox.innerHTML = `✓ Settings & API Keys saved permanently to disk (config.json) and browser memory!`;
      alertBox.classList.remove('hidden');

      setTimeout(() => {
        settingsModal.classList.add('hidden');
      }, 900);
    } catch (e) {
      alertBox.className = "p-3 rounded-xl text-xs font-semibold bg-red-500/20 border border-red-500/30 text-red-300";
      alertBox.innerHTML = `⚠ Save Error: ${e.message}`;
      alertBox.classList.remove('hidden');
    } finally {
      btnSaveSettings.disabled = false;
      btnSaveSettings.innerHTML = `Save Settings & Keys`;
      if (window.lucide) lucide.createIcons();
    }
  });

  // Initial load and sync
  await loadAndSyncSettings();
  goToStep(1);
});
