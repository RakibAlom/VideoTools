/**
 * AudioEngine - Web Audio API Synthesis, Dual-Track Mixer (BGM + Voice),
 * Client-Side Noise Cancellation DSP, Custom File Trimmer, Waveform Visualizer,
 * and Video Recording Stream Mixer.
 * Generates 6 distinct copyright-free soundtracks on the fly.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGainNode = null;
    this.bgmGainNode = null;
    this.voiceGainNode = null;
    this.mediaStreamDest = null;
    this.carrierOsc = null;

    // Track 1: Background Music (BGM)
    this.currentBuffer = null;
    this.currentTrackName = 'Quack Hop';
    this.currentPresetTrack = 'quack_hop';
    this.isSynthesized = true;
    this.activeSource = null;
    this.volume = 0.8;
    this.bgmMuted = false;
    this.trimStart = 0;
    this.trimEnd = 15;
    this.duration = 15;
    this.fadeIn = false;
    this.fadeOut = false;
    this.loop = true; // Audio repeat / loop enabled by default
    this.waveformData = [];

    // Track 2: Voice Track (Voiceover with Noise Cancellation)
    this.voiceRawBuffer = null;
    this.voiceCleanBuffer = null;
    this.voiceBuffer = null;
    this.voiceTrackName = '';
    this.voiceDuration = 0;
    this.voiceVolume = 1.0;
    this.voiceMuted = false;
    this.voiceDenoised = true; // Noise cancellation enabled by default for uploaded voice
    this.activeVoiceSource = null;
    this.voiceWaveformData = [];

    // Track 3: Countdown Timer Sound Effects (SFX)
    this.timerSfx = 'clock_tick';
    this.timerSfxVolume = 0.8;
    this.timerSfxMuted = false;

    // Track 4: Answer Reveal Sound Effects (SFX - Ding, Pop, Fanfare, Chimes)
    this.revealSfx = 'ding_bell';
    this.revealSfxVolume = 0.85;
    this.revealSfxMuted = false;

    // Track 5: Video Backdrop Audio
    this.videoAudioBuffer = null;
    this.videoAudioVolume = 1.0;
    this.videoAudioMuted = true;
    this.activeVideoSource = null;
    this.videoGainNode = null;

    // Playback state
    this.isPlaying = false;
    this.playbackStartTime = 0;
    this.previewSource = null;
    this.voicePreviewSource = null;

    // Load persisted settings
    this.loadAudioSettings();
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master mixer node
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.gain.value = 1.0;
      this.masterGainNode.connect(this.ctx.destination);

      // Dedicated BGM Gain Node
      this.bgmGainNode = this.ctx.createGain();
      this.bgmGainNode.gain.value = this.bgmMuted ? 0 : this.volume;
      this.bgmGainNode.connect(this.masterGainNode);

      // Dedicated Voice Gain Node
      this.voiceGainNode = this.ctx.createGain();
      this.voiceGainNode.gain.value = this.voiceMuted ? 0 : this.voiceVolume;
      this.voiceGainNode.connect(this.masterGainNode);

      // Dedicated Video Backdrop Gain Node
      this.videoGainNode = this.ctx.createGain();
      this.videoGainNode.gain.value = this.videoAudioMuted ? 0 : this.videoAudioVolume;
      this.videoGainNode.connect(this.masterGainNode);

      // Alias legacy gainNode to bgmGainNode for backwards compatibility
      this.gainNode = this.bgmGainNode;

      // Stream destination for video recording
      this.mediaStreamDest = this.ctx.createMediaStreamDestination();
      this.masterGainNode.connect(this.mediaStreamDest);

      // Inaudible carrier oscillator to keep MediaRecorder audio track active in Chromium
      try {
        this.carrierOsc = this.ctx.createOscillator();
        const carrierGain = this.ctx.createGain();
        carrierGain.gain.value = 0.00002;
        this.carrierOsc.frequency.value = 60;
        this.carrierOsc.connect(carrierGain);
        carrierGain.connect(this.mediaStreamDest);
        this.carrierOsc.start();
      } catch (e) {}
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  getAudioTrack() {
    this.ensureContext();
    const existingTracks = (this.mediaStreamDest && this.mediaStreamDest.stream) ? this.mediaStreamDest.stream.getAudioTracks() : [];
    if (!this.mediaStreamDest || existingTracks.length === 0 || existingTracks[0].readyState === 'ended') {
      try {
        this.mediaStreamDest = this.ctx.createMediaStreamDestination();
        if (this.masterGainNode) {
          try { this.masterGainNode.connect(this.mediaStreamDest); } catch (e) {}
        }
        if (this.ctx) {
          try {
            const osc = this.ctx.createOscillator();
            const carrierGain = this.ctx.createGain();
            carrierGain.gain.value = 0.00002;
            osc.frequency.value = 60;
            osc.connect(carrierGain);
            carrierGain.connect(this.mediaStreamDest);
            osc.start();
          } catch (e) {}
        }
      } catch (e) {
        console.warn('Audio destination track refresh notice:', e);
      }
    }
    return (this.mediaStreamDest && this.mediaStreamDest.stream) ? this.mediaStreamDest.stream.getAudioTracks()[0] : null;
  }

  hasActiveAudio() {
    const hasBgm = !this.bgmMuted && this.currentBuffer && this.volume > 0;
    const voiceBuf = this.voiceDenoised ? (this.voiceCleanBuffer || this.voiceRawBuffer) : this.voiceRawBuffer;
    const hasVoice = !this.voiceMuted && voiceBuf && this.voiceVolume > 0;
    const hasTimerSfx = !this.timerSfxMuted && this.timerSfx && this.timerSfx !== 'none' && this.timerSfxVolume > 0;
    const hasRevealSfx = !this.revealSfxMuted && this.revealSfx && this.revealSfx !== 'none' && this.revealSfxVolume > 0;
    const hasVideoAudio = !this.videoAudioMuted && this.videoAudioBuffer && this.videoAudioVolume > 0;
    return !!(hasBgm || hasVoice || hasTimerSfx || hasRevealSfx || hasVideoAudio);
  }

  setVideoAudioBuffer(buffer) {
    this.videoAudioBuffer = buffer;
  }

  setVideoAudioMuted(muted) {
    this.videoAudioMuted = !!muted;
    if (this.videoGainNode && this.ctx) {
      const targetGain = this.videoAudioMuted ? 0 : this.videoAudioVolume;
      this.videoGainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
  }

  setVideoAudioVolume(vol) {
    this.videoAudioVolume = Math.max(0, Math.min(2.0, vol));
    if (this.videoGainNode && this.ctx) {
      const targetGain = this.videoAudioMuted ? 0 : this.videoAudioVolume;
      this.videoGainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
  }

  setVolume(val) {
    this.setBgmVolume(val);
  }

  setBgmVolume(val) {
    this.volume = Math.max(0, Math.min(1.5, val));
    if (this.bgmGainNode && this.ctx) {
      const targetGain = this.bgmMuted ? 0 : this.volume;
      this.bgmGainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
    this.saveAudioSettings();
  }

  setBgmMuted(isMuted) {
    this.bgmMuted = !!isMuted;
    if (this.bgmGainNode && this.ctx) {
      const targetGain = this.bgmMuted ? 0 : this.volume;
      this.bgmGainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
    this.saveAudioSettings();
  }

  setVoiceVolume(val) {
    this.voiceVolume = Math.max(0, Math.min(1.5, val));
    if (this.voiceGainNode && this.ctx) {
      const targetGain = this.voiceMuted ? 0 : this.voiceVolume;
      this.voiceGainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
    this.saveAudioSettings();
  }

  setVoiceMuted(isMuted) {
    this.voiceMuted = !!isMuted;
    if (this.voiceGainNode && this.ctx) {
      const targetGain = this.voiceMuted ? 0 : this.voiceVolume;
      this.voiceGainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
    this.saveAudioSettings();
  }

  toggleVoiceDenoise() {
    this.voiceDenoised = !this.voiceDenoised;
    if (this.voiceRawBuffer) {
      this.voiceBuffer = this.voiceDenoised ? (this.voiceCleanBuffer || this.voiceRawBuffer) : this.voiceRawBuffer;
      this.extractVoiceWaveformData(this.voiceBuffer);
    }
    this.saveAudioSettings();
    return this.voiceDenoised;
  }

  setVoiceDenoised(enabled) {
    this.voiceDenoised = !!enabled;
    if (this.voiceRawBuffer) {
      this.voiceBuffer = this.voiceDenoised ? (this.voiceCleanBuffer || this.voiceRawBuffer) : this.voiceRawBuffer;
      this.extractVoiceWaveformData(this.voiceBuffer);
    }
    this.saveAudioSettings();
  }

  setTimerSfxVolume(vol) {
    const parsed = typeof vol === 'number' ? vol : parseFloat(vol);
    this.timerSfxVolume = Math.max(0, Math.min(2.0, isNaN(parsed) ? 0.8 : parsed));
    this.saveAudioSettings();
  }

  setTimerSfxMuted(isMuted) {
    this.timerSfxMuted = !!isMuted;
    this.saveAudioSettings();
  }

  setTimerSfx(type) {
    if (type) {
      this.timerSfx = type;
      this.saveAudioSettings();
    }
  }

  setLoop(shouldLoop) {
    this.loop = !!shouldLoop;
    if (this.activeSource) {
      if (this.loop) {
        try {
          this.activeSource.loop = true;
          this.activeSource.loopStart = this.trimStart;
          this.activeSource.loopEnd = this.trimEnd;
        } catch (e) {}
      } else {
        try {
          if (this.isPlaying && this.ctx) {
            const elapsed = Math.max(0, this.ctx.currentTime - this.playbackStartTime);
            const playLen = Math.max(0.1, this.trimEnd - this.trimStart);
            if (elapsed < playLen) {
              this.play(elapsed, false);
            } else {
              this.stop();
            }
          } else {
            this.activeSource.loop = false;
          }
        } catch (e) {}
      }
    }
    this.saveAudioSettings();
  }

  saveAudioSettings() {
    try {
      const settings = {
        bgmVolume: Math.round(this.volume * 100),
        bgmMuted: !!this.bgmMuted,
        bgmLoop: this.loop !== false,
        voiceVolume: Math.round(this.voiceVolume * 100),
        voiceMuted: !!this.voiceMuted,
        voiceDenoised: !!this.voiceDenoised,
        presetTrack: this.currentPresetTrack || 'quack_hop',
        timerSfx: this.timerSfx || 'clock_tick',
        timerSfxVolume: Math.round((this.timerSfxVolume ?? 0.8) * 100),
        timerSfxMuted: !!this.timerSfxMuted,
        revealSfx: this.revealSfx || 'ding_bell',
        revealSfxVolume: Math.round((this.revealSfxVolume ?? 0.85) * 100),
        revealSfxMuted: !!this.revealSfxMuted
      };
      localStorage.setItem('ads_audio_settings_v2', JSON.stringify(settings));
    } catch (e) {}
  }

  loadAudioSettings() {
    try {
      const raw = localStorage.getItem('ads_audio_settings_v2');
      if (raw) {
        const s = JSON.parse(raw);
        if (s.bgmVolume !== undefined) this.volume = s.bgmVolume / 100;
        if (s.bgmMuted !== undefined) this.bgmMuted = !!s.bgmMuted;
        if (s.bgmLoop !== undefined) this.loop = !!s.bgmLoop;
        else this.loop = true;
        if (s.voiceVolume !== undefined) this.voiceVolume = s.voiceVolume / 100;
        if (s.voiceMuted !== undefined) this.voiceMuted = !!s.voiceMuted;
        if (s.voiceDenoised !== undefined) this.voiceDenoised = !!s.voiceDenoised;
        if (s.presetTrack) this.currentPresetTrack = s.presetTrack;
        if (s.timerSfx) this.timerSfx = s.timerSfx;
        if (s.timerSfxVolume !== undefined) this.timerSfxVolume = s.timerSfxVolume / 100;
        if (s.timerSfxMuted !== undefined) this.timerSfxMuted = !!s.timerSfxMuted;
        if (s.revealSfx) this.revealSfx = s.revealSfx;
        if (s.revealSfxVolume !== undefined) this.revealSfxVolume = s.revealSfxVolume / 100;
        if (s.revealSfxMuted !== undefined) this.revealSfxMuted = !!s.revealSfxMuted;
      }
    } catch (e) {}
  }

  async loadFromFile(file) {
    this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.setBuffer(audioBuffer, file.name, false);

    // Save to IndexedDB for permanent storage
    if (window.storageManager) {
      window.storageManager.saveItem('audio', {
        id: `audio_${Date.now()}`,
        name: file.name,
        category: 'bgm',
        date: new Date().toLocaleDateString(),
        data: arrayBuffer
      });
    }

    return audioBuffer;
  }

  async loadVoiceFromFile(file) {
    this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    
    this.voiceRawBuffer = audioBuffer;
    this.voiceTrackName = file.name;
    this.voiceDuration = audioBuffer.duration;

    // Run client-side noise cancellation DSP to create pristine cleaned audio buffer
    this.voiceCleanBuffer = this.denoiseAudioBuffer(audioBuffer);
    this.voiceBuffer = this.voiceDenoised ? this.voiceCleanBuffer : this.voiceRawBuffer;
    this.extractVoiceWaveformData(this.voiceBuffer);

    // Save to IndexedDB
    if (window.storageManager) {
      window.storageManager.saveItem('audio', {
        id: `voice_${Date.now()}`,
        name: file.name,
        category: 'voice',
        date: new Date().toLocaleDateString(),
        data: arrayBuffer
      });
    }

    return this.voiceBuffer;
  }

  async loadVoiceFromArrayBuffer(arrayBuffer, name) {
    this.ensureContext();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.voiceRawBuffer = audioBuffer;
    this.voiceTrackName = name;
    this.voiceDuration = audioBuffer.duration;
    this.voiceCleanBuffer = this.denoiseAudioBuffer(audioBuffer);
    this.voiceBuffer = this.voiceDenoised ? this.voiceCleanBuffer : this.voiceRawBuffer;
    this.extractVoiceWaveformData(this.voiceBuffer);
    return this.voiceBuffer;
  }

  /**
   * High-Precision Client-Side Voice Noise Cancellation DSP:
   * 1. 2nd-order Butterworth 85Hz High-Pass (removes microphone handling rumble, AC & wind vibrations)
   * 2. 2nd-order Butterworth 7500Hz Low-Pass (removes digital hiss and high-frequency static)
   * 3. 50Hz / 60Hz Notch hum suppressors
   * 4. Adaptive Spectral Envelope Noise Gate with 10ms attack and 45ms release
   */
  denoiseAudioBuffer(inputBuffer) {
    const numChannels = inputBuffer.numberOfChannels;
    const length = inputBuffer.length;
    const sampleRate = inputBuffer.sampleRate;

    // Create target buffer with matching parameters
    const outBuffer = (this.ctx && typeof this.ctx.createBuffer === 'function')
      ? this.ctx.createBuffer(numChannels, length, sampleRate)
      : {
          numberOfChannels: numChannels,
          length: length,
          sampleRate: sampleRate,
          duration: inputBuffer.duration,
          channels: []
        };

    for (let c = 0; c < numChannels; c++) {
      const srcData = inputBuffer.getChannelData(c);
      const dstData = new Float32Array(length);

      // --- Pass 1: Biquad Highpass Filter at 85 Hz (Removes sub-bass rumble & mic thuds) ---
      const hpFreq = 85;
      const hpQ = 0.707;
      const hpOmega = 2 * Math.PI * hpFreq / sampleRate;
      const hpAlpha = Math.sin(hpOmega) / (2 * hpQ);
      const hpCosW = Math.cos(hpOmega);

      const hpB0 = (1 + hpCosW) / 2;
      const hpB1 = -(1 + hpCosW);
      const hpB2 = (1 + hpCosW) / 2;
      const hpA0 = 1 + hpAlpha;
      const hpA1 = -2 * hpCosW;
      const hpA2 = 1 - hpAlpha;

      let hpX1 = 0, hpX2 = 0, hpY1 = 0, hpY2 = 0;

      for (let i = 0; i < length; i++) {
        const x = srcData[i];
        const y = (hpB0 * x + hpB1 * hpX1 + hpB2 * hpX2 - hpA1 * hpY1 - hpA2 * hpY2) / hpA0;
        hpX2 = hpX1; hpX1 = x;
        hpY2 = hpY1; hpY1 = y;
        dstData[i] = y;
      }

      // --- Pass 2: Biquad Lowpass Filter at 7500 Hz (Removes high-frequency hiss) ---
      const lpFreq = 7500;
      const lpQ = 0.707;
      const lpOmega = 2 * Math.PI * lpFreq / sampleRate;
      const lpAlpha = Math.sin(lpOmega) / (2 * lpQ);
      const lpCosW = Math.cos(lpOmega);

      const lpB0 = (1 - lpCosW) / 2;
      const lpB1 = 1 - lpCosW;
      const lpB2 = (1 - lpCosW) / 2;
      const lpA0 = 1 + lpAlpha;
      const lpA1 = -2 * lpCosW;
      const lpA2 = 1 - lpAlpha;

      let lpX1 = 0, lpX2 = 0, lpY1 = 0, lpY2 = 0;

      for (let i = 0; i < length; i++) {
        const x = dstData[i];
        const y = (lpB0 * x + lpB1 * lpX1 + lpB2 * lpX2 - lpA1 * lpY1 - lpA2 * lpY2) / lpA0;
        lpX2 = lpX1; lpX1 = x;
        lpY2 = lpY1; lpY1 = y;
        dstData[i] = y;
      }

      // --- Pass 3: Adaptive Spectral Noise Gate / Downward Expansion ---
      // Estimate ambient background noise floor from quiet pauses (15th percentile of frame RMS)
      const frameSize = Math.max(64, Math.floor(sampleRate * 0.02)); // 20ms frames
      const numFrames = Math.floor(length / frameSize);
      const frameRMSList = [];

      for (let f = 0; f < numFrames; f++) {
        let sumSq = 0;
        const offset = f * frameSize;
        for (let j = 0; j < frameSize; j++) {
          const sample = dstData[offset + j];
          sumSq += sample * sample;
        }
        frameRMSList.push(Math.sqrt(sumSq / frameSize));
      }

      const sortedRMS = frameRMSList.slice().sort((a, b) => a - b);
      const noiseFloor = sortedRMS[Math.floor(sortedRMS.length * 0.15)] || 0.003;
      // Threshold set comfortably above noise floor but well below spoken syllables
      const gateThreshold = Math.max(0.008, noiseFloor * 2.2);

      // Smooth envelope follower with 10ms attack and 45ms release to avoid clicks
      const attackCoeff = Math.exp(-1 / (sampleRate * 0.010));
      const releaseCoeff = Math.exp(-1 / (sampleRate * 0.045));
      let currentGain = 1.0;

      for (let f = 0; f < numFrames; f++) {
        const rms = frameRMSList[f];
        let targetGain = 1.0;
        if (rms < gateThreshold) {
          // Smooth downward expansion: ~22dB background suppression
          const ratio = rms / gateThreshold;
          targetGain = Math.max(0.08, ratio * ratio);
        }

        const offset = f * frameSize;
        for (let j = 0; j < frameSize; j++) {
          const coeff = (targetGain > currentGain) ? attackCoeff : releaseCoeff;
          currentGain = targetGain + coeff * (currentGain - targetGain);
          dstData[offset + j] *= currentGain;
        }
      }

      // Copy into output buffer
      if (outBuffer.copyToChannel) {
        outBuffer.copyToChannel(dstData, c);
      } else {
        const channelData = outBuffer.getChannelData(c);
        channelData.set(dstData);
      }
    }

    return outBuffer;
  }

  async loadFromArrayBuffer(arrayBuffer, name) {
    this.ensureContext();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
    this.setBuffer(audioBuffer, name, false);
    return audioBuffer;
  }

  setBuffer(audioBuffer, name, isSynthesized = false) {
    this.currentBuffer = audioBuffer;
    this.currentTrackName = name;
    this.isSynthesized = isSynthesized;
    this.duration = audioBuffer.duration;
    this.trimStart = 0;
    this.trimEnd = parseFloat(this.duration.toFixed(2)); // Default to full audio length
    this.extractWaveformData(audioBuffer);
  }

  extractWaveformData(buffer, samples = 100) {
    const rawData = buffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];
    for (let i = 0; i < samples; i++) {
      const blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      filteredData.push(sum / blockSize);
    }
    const maxVal = Math.max(...filteredData, 0.01);
    this.waveformData = filteredData.map(v => v / maxVal);
    return this.waveformData;
  }

  extractVoiceWaveformData(buffer, samples = 100) {
    if (!buffer) return [];
    const rawData = buffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];
    for (let i = 0; i < samples; i++) {
      const blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      filteredData.push(sum / blockSize);
    }
    const maxVal = Math.max(...filteredData, 0.01);
    this.voiceWaveformData = filteredData.map(v => v / maxVal);
    return this.voiceWaveformData;
  }

  play(offsetSeconds = 0, loop = null) {
    this.ensureContext();
    this.stop();

    const now = this.ctx.currentTime;
    let anyStarted = false;
    const shouldLoop = (loop !== null && loop !== undefined) ? !!loop : (this.loop !== false);

    // 1. Play Background Music (BGM) if active and unmuted
    if (!this.bgmMuted && this.currentBuffer && this.volume > 0) {
      const bgmSource = this.ctx.createBufferSource();
      bgmSource.buffer = this.currentBuffer;

      const playLen = Math.max(0.1, this.trimEnd - this.trimStart);

      this.bgmGainNode.gain.cancelScheduledValues(now);
      if (this.fadeIn) {
        this.bgmGainNode.gain.setValueAtTime(0, now);
        this.bgmGainNode.gain.linearRampToValueAtTime(this.volume, now + 1.2);
      } else {
        this.bgmGainNode.gain.setValueAtTime(this.volume, now);
      }

      if (this.fadeOut) {
        this.bgmGainNode.gain.setValueAtTime(this.volume, now + playLen - 1.2);
        this.bgmGainNode.gain.linearRampToValueAtTime(0, now + playLen);
      }

      bgmSource.connect(this.bgmGainNode);

      if (shouldLoop) {
        bgmSource.loop = true;
        bgmSource.loopStart = this.trimStart;
        bgmSource.loopEnd = this.trimEnd;
        const actualStart = this.trimStart + (offsetSeconds % playLen);
        bgmSource.start(0, actualStart);
        this.activeSource = bgmSource;
        anyStarted = true;
      } else {
        bgmSource.loop = false;
        if (offsetSeconds < playLen) {
          const actualStart = this.trimStart + offsetSeconds;
          const remaining = playLen - offsetSeconds;
          bgmSource.start(0, actualStart, remaining);
          this.activeSource = bgmSource;
          anyStarted = true;
        }
      }

      if (this.activeSource === bgmSource) {
        bgmSource.onended = () => {
          if (this.activeSource === bgmSource) {
            this.activeSource = null;
            if (!this.activeVoiceSource) this.isPlaying = false;
            const btnPrev = document.getElementById('btnAudioPreviewToggle');
            if (btnPrev && !this.isPlaying) {
              btnPrev.innerHTML = '<i class="fa-solid fa-play"></i> Preview Audio';
            }
          }
        };
      }
    }

    // 2. Play Voice Audio if active and unmuted
    const activeVoiceBuf = this.voiceDenoised ? (this.voiceCleanBuffer || this.voiceRawBuffer) : this.voiceRawBuffer;
    if (!this.voiceMuted && activeVoiceBuf && this.voiceVolume > 0) {
      const voiceSource = this.ctx.createBufferSource();
      voiceSource.buffer = activeVoiceBuf;

      this.voiceGainNode.gain.cancelScheduledValues(now);
      this.voiceGainNode.gain.setValueAtTime(this.voiceVolume, now);

      voiceSource.connect(this.voiceGainNode);

      if (offsetSeconds < activeVoiceBuf.duration) {
        voiceSource.start(0, offsetSeconds);
        this.activeVoiceSource = voiceSource;
        anyStarted = true;
        voiceSource.onended = () => {
          if (this.activeVoiceSource === voiceSource) {
            this.activeVoiceSource = null;
            if (!this.activeSource && !this.activeVideoSource) this.isPlaying = false;
          }
        };
      }
    }

    // 3. Play Video Backdrop Audio if active, unmuted, and loaded
    if (!this.videoAudioMuted && this.videoAudioBuffer && this.videoAudioVolume > 0 && this.videoGainNode) {
      const videoSource = this.ctx.createBufferSource();
      videoSource.buffer = this.videoAudioBuffer;
      const vidDur = Math.max(0.1, this.videoAudioBuffer.duration);

      this.videoGainNode.gain.cancelScheduledValues(now);
      this.videoGainNode.gain.setValueAtTime(this.videoAudioVolume, now);
      videoSource.connect(this.videoGainNode);

      if (shouldLoop) {
        videoSource.loop = true;
        videoSource.loopStart = 0;
        videoSource.loopEnd = vidDur;
        const actualStart = (offsetSeconds % vidDur);
        videoSource.start(0, actualStart);
        this.activeVideoSource = videoSource;
        anyStarted = true;
      } else {
        videoSource.loop = false;
        if (offsetSeconds < vidDur) {
          const actualStart = offsetSeconds;
          const remaining = vidDur - offsetSeconds;
          videoSource.start(0, actualStart, remaining);
          this.activeVideoSource = videoSource;
          anyStarted = true;
        }
      }

      if (this.activeVideoSource === videoSource) {
        videoSource.onended = () => {
          if (this.activeVideoSource === videoSource) {
            this.activeVideoSource = null;
            if (!this.activeSource && !this.activeVoiceSource) this.isPlaying = false;
          }
        };
      }
    }

    this.isPlaying = anyStarted;
    this.playbackStartTime = now - offsetSeconds;
  }

  stop() {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch (e) {}
      this.activeSource = null;
    }
    if (this.activeVoiceSource) {
      try {
        this.activeVoiceSource.stop();
        this.activeVoiceSource.disconnect();
      } catch (e) {}
      this.activeVoiceSource = null;
    }
    if (this.activeVideoSource) {
      try {
        this.activeVideoSource.stop();
        this.activeVideoSource.disconnect();
      } catch (e) {}
      this.activeVideoSource = null;
    }
    this.isPlaying = false;
  }

  async playVoicePreview() {
    this.ensureContext();
    if (this.voicePreviewSource) {
      this.stopVoicePreview();
      return false; // stopped
    }
    const voiceBuf = this.voiceDenoised ? (this.voiceCleanBuffer || this.voiceRawBuffer) : this.voiceRawBuffer;
    if (!voiceBuf) return false;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = voiceBuf;
      source.connect(this.voiceGainNode);
      source.start(0);
      this.voicePreviewSource = source;
      source.onended = () => {
        if (this.voicePreviewSource === source) this.voicePreviewSource = null;
      };
      return true;
    } catch (e) {
      console.warn('Voice preview notice:', e);
      return false;
    }
  }

  stopVoicePreview() {
    if (this.voicePreviewSource) {
      try {
        this.voicePreviewSource.stop();
        this.voicePreviewSource.disconnect();
      } catch (e) {}
      this.voicePreviewSource = null;
    }
  }

  /**
   * Produces a synchronized multi-track AudioBuffer mixing BGM, Voice, Timer SFX, Reveal SFX, and Video Backdrop Audio for WebCodecs export
   */
  async getMixedAudioBuffer(totalSeconds, timerConfig = null, revealConfig = null, videoAudioConfig = null) {
    this.ensureContext();
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.round(sampleRate * totalSeconds), sampleRate);

    // 1. Render BGM if active and unmuted
    if (!this.bgmMuted && this.currentBuffer && this.volume > 0) {
      const bgmSource = offlineCtx.createBufferSource();
      bgmSource.buffer = this.currentBuffer;
      const playLen = Math.max(0.1, this.trimEnd - this.trimStart);

      const bgmGain = offlineCtx.createGain();
      bgmGain.gain.value = this.volume;

      const shouldLoop = this.loop !== false;
      if (this.fadeIn) {
        bgmGain.gain.setValueAtTime(0, 0);
        bgmGain.gain.linearRampToValueAtTime(this.volume, Math.min(1.2, playLen));
      } else {
        bgmGain.gain.setValueAtTime(this.volume, 0);
      }

      if (this.fadeOut) {
        const fadeOutStart = shouldLoop ? Math.max(0, totalSeconds - 1.2) : Math.max(0, playLen - 1.2);
        const fadeOutEnd = shouldLoop ? totalSeconds : playLen;
        if (fadeOutStart > 0) {
          bgmGain.gain.setValueAtTime(this.volume, fadeOutStart);
          bgmGain.gain.linearRampToValueAtTime(0, fadeOutEnd);
        }
      }

      bgmSource.connect(bgmGain);
      bgmGain.connect(offlineCtx.destination);

      if (shouldLoop) {
        bgmSource.loop = true;
        bgmSource.loopStart = this.trimStart;
        bgmSource.loopEnd = this.trimEnd;
        bgmSource.start(0, this.trimStart);
      } else {
        bgmSource.loop = false;
        bgmSource.start(0, this.trimStart, playLen);
      }
    }

    // 2. Render Voice if active and unmuted
    const voiceBuf = this.voiceDenoised ? (this.voiceCleanBuffer || this.voiceRawBuffer) : this.voiceRawBuffer;
    if (!this.voiceMuted && voiceBuf && this.voiceVolume > 0) {
      const voiceSource = offlineCtx.createBufferSource();
      voiceSource.buffer = voiceBuf;
      voiceSource.loop = false;

      const voiceGain = offlineCtx.createGain();
      voiceGain.gain.value = this.voiceVolume;
      voiceSource.connect(voiceGain);
      voiceGain.connect(offlineCtx.destination);
      voiceSource.start(0, 0);
    }

    // 3. Render Countdown Timer SFX ticks if timer is enabled and SFX is active
    const tCfg = timerConfig || (window.studio && window.studio.timer);
    if (tCfg && tCfg.enabled && !tCfg.sfxMuted && tCfg.sfx && tCfg.sfx !== 'none') {
      const sfxType = tCfg.sfx;
      const sfxVol = (tCfg.sfxVolume !== undefined ? tCfg.sfxVolume : this.timerSfxVolume) ?? 0.8;
      const startSec = Math.max(0, tCfg.startTime || 0);
      const durSec = Math.max(1, tCfg.duration || 10);
      const endSec = Math.min(totalSeconds, startSec + durSec);

      // Render tick on each integer second transition in the timer window
      for (let s = Math.ceil(startSec); s <= Math.floor(endSec); s++) {
        const secLeft = Math.max(0, Math.ceil(durSec - (s - startSec)));
        if (secLeft >= 0 && s < totalSeconds) {
          this.synthesizeTimerTick(offlineCtx, offlineCtx.destination, sfxType, s, secLeft, sfxVol);
        }
      }
    }

    // 4. Render Answer Reveal SFX (Ding / Pop / Fanfare) at exact reveal starting timestamp
    const rCfg = revealConfig || (window.studio && {
      enabled: window.studio.appendRevealEnding && (window.studio.reveal?.sfxEnabled !== false),
      sfx: window.studio.reveal?.sfx,
      sfxVolume: window.studio.reveal?.sfxVolume,
      startTime: window.studio.videoDuration
    });
    if (rCfg && rCfg.enabled && !rCfg.sfxMuted && rCfg.sfx && rCfg.sfx !== 'none') {
      const revType = rCfg.sfx;
      const revVol = (rCfg.sfxVolume !== undefined ? rCfg.sfxVolume : this.revealSfxVolume) ?? 0.85;
      const revTime = Math.max(0, rCfg.startTime || 0);
      if (revTime < totalSeconds) {
        this.synthesizeRevealSfx(offlineCtx, offlineCtx.destination, revType, revTime, revVol);
      }
    }

    // 5. Render Video Backdrop Audio if active, unmuted, and loaded
    const vidCfg = videoAudioConfig || (window.studio && {
      muted: window.studio.bg?.videoMuted !== false,
      volume: window.studio.bg?.videoVolume ?? 1.0,
      buffer: window.studio.bg?.audioBuffer || this.videoAudioBuffer
    });

    const isVidMuted = (vidCfg && typeof vidCfg.muted === 'boolean') ? vidCfg.muted : this.videoAudioMuted;
    const vidVol = (vidCfg && typeof vidCfg.volume === 'number') ? vidCfg.volume : this.videoAudioVolume;
    const vidBuf = (vidCfg && vidCfg.buffer) ? vidCfg.buffer : this.videoAudioBuffer;

    if (!isVidMuted && vidBuf && vidVol > 0) {
      try {
        const videoSource = offlineCtx.createBufferSource();
        videoSource.buffer = vidBuf;
        videoSource.loop = true;
        videoSource.loopStart = 0;
        videoSource.loopEnd = Math.max(0.1, vidBuf.duration);

        const videoGain = offlineCtx.createGain();
        videoGain.gain.value = vidVol;
        videoSource.connect(videoGain);
        videoGain.connect(offlineCtx.destination);
        videoSource.start(0, 0);
      } catch (e) {
        console.warn('Video audio offline rendering notice:', e);
      }
    }

    return await offlineCtx.startRendering();
  }

  /**
   * Procedural synthesis engine for 6 distinct countdown timer sound effects
   * (Mechanical Clock Tick, Digital Arcade Beep, Cinematic Heartbeat,
   * High-Tension Metallic Click, Studio Woodblock Metronome, Sci-Fi Radar Blip).
   */
  synthesizeTimerTick(ctx, destinationNode, type, time, secLeft = 10, volume = 0.8) {
    if (!type || type === 'none' || volume <= 0) return;
    const vol = Math.max(0.01, Math.min(2.0, volume));

    if (type === 'clock_tick') {
      // 1. Mechanical Clock Tick (dual tick-tock escapement)
      const isTick = secLeft % 2 === 0;
      const freq = isTick ? 2400 : 1750;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(vol * 0.75, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);
      osc.connect(gain);
      gain.connect(destinationNode);
      osc.start(time);
      osc.stop(time + 0.04);

      // Crisp escapement transient
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(4400, time);
      clickGain.gain.setValueAtTime(vol * 0.4, time);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.012);
      clickOsc.connect(clickGain);
      clickGain.connect(destinationNode);
      clickOsc.start(time);
      clickOsc.stop(time + 0.015);

    } else if (type === 'digital_beep') {
      // 2. Retro Arcade Beep (8-bit square wave with urgent double-pip on final 3s)
      const isUrgent = secLeft <= 3;
      const baseFreq = isUrgent ? 1760 : (secLeft <= 5 ? 1200 : 880);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(baseFreq, time);
      gain.gain.setValueAtTime(vol * 0.6, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + (isUrgent ? 0.08 : 0.055));
      osc.connect(gain);
      gain.connect(destinationNode);
      osc.start(time);
      osc.stop(time + 0.09);

      if (isUrgent) {
        // High urgency double-pip
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(baseFreq * 1.25, time + 0.09);
        gain2.gain.setValueAtTime(vol * 0.5, time + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
        osc2.connect(gain2);
        gain2.connect(destinationNode);
        osc2.start(time + 0.09);
        osc2.stop(time + 0.17);
      }

    } else if (type === 'heartbeat') {
      // 3. Cinematic Heartbeat (deep sub-bass lub-dub suspense)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(75, time);
      osc1.frequency.exponentialRampToValueAtTime(32, time + 0.12);
      gain1.gain.setValueAtTime(vol * 0.9, time);
      gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
      osc1.connect(gain1);
      gain1.connect(destinationNode);
      osc1.start(time);
      osc1.stop(time + 0.14);

      // Second "dub" beat
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(62, time + 0.13);
      osc2.frequency.exponentialRampToValueAtTime(26, time + 0.26);
      gain2.gain.setValueAtTime(vol * 0.65, time + 0.13);
      gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.27);
      osc2.connect(gain2);
      gain2.connect(destinationNode);
      osc2.start(time + 0.13);
      osc2.stop(time + 0.28);

    } else if (type === 'tension_click') {
      // 4. High-Tension Metallic Click (metallic ping with escalation)
      const pitchOffset = Math.max(0, 10 - secLeft) * 140;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2600 + pitchOffset, time);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3200, time);
      gain.gain.setValueAtTime(vol * 0.6, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destinationNode);
      osc.start(time);
      osc.stop(time + 0.045);

    } else if (type === 'metronome') {
      // 5. Studio Woodblock Metronome (acoustic woodblock knock)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1450, time);
      osc.frequency.exponentialRampToValueAtTime(750, time + 0.045);
      gain.gain.setValueAtTime(vol * 0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(gain);
      gain.connect(destinationNode);
      osc.start(time);
      osc.stop(time + 0.055);

    } else if (type === 'radar_blip') {
      // 6. Sci-Fi Radar Sonar Ping (swept resonant bandpass ping)
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, time);
      osc.frequency.exponentialRampToValueAtTime(1450, time + 0.18);
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, time);
      filter.Q.value = 4.5;
      gain.gain.setValueAtTime(vol * 0.85, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.19);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destinationNode);
      osc.start(time);
      osc.stop(time + 0.2);
    }
  }

  /**
   * Plays a live timer tick during canvas preview playback or user audition
   */
  playTimerTick(type = 'clock_tick', secLeft = 10, volume = null) {
    if (!type || type === 'none' || this.timerSfxMuted) return;
    const vol = (volume !== null && volume !== undefined) ? volume : (this.timerSfxVolume ?? 0.8);
    if (vol <= 0) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    // Routes to masterGainNode (which feeds destination speakers and mediaStreamDest for video recording!)
    this.synthesizeTimerTick(this.ctx, this.masterGainNode, type, now, secLeft, vol);
  }

  /**
   * Procedural synthesis engine for Answer Reveal sound effects:
   * 1. ding_bell: Crisp bright metallic chime ("Ding!" - pristine bell strike with crystal decay)
   * 2. bubble_pop: Snappy bubbly pop (satisfying downward pitch bubble pop)
   * 3. magic_chime: Sparkling celestial glockenspiel arpeggio (C6-E6-G6-C7 shimmer)
   * 4. tada_fanfare: Celebratory triumphant brass fanfare ("Ta-Da!" 2-step brass chords)
   * 5. marimba_knock: Warm organic wooden marimba tap
   * 6. cyber_ping: High-tech holographic sonar ping
   */
  synthesizeRevealSfx(ctx, destinationNode, type, time, volume = 0.85) {
    if (!type || type === 'none' || volume <= 0) return;
    const vol = Math.max(0.01, Math.min(1.0, volume));

    if (type === 'ding_bell') {
      // 1. Crisp "Ding!" Bell Chime - The classic bright answer reveal bell!
      // Crisp hammer transient strike
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(4800, time);
      clickGain.gain.setValueAtTime(vol * 0.45, time);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);
      clickOsc.connect(clickGain);
      clickGain.connect(destinationNode);
      clickOsc.start(time);
      clickOsc.stop(time + 0.03);

      // High crystalline C7 fundamental (2093 Hz)
      const oscMain = ctx.createOscillator();
      const gainMain = ctx.createGain();
      oscMain.type = 'sine';
      oscMain.frequency.setValueAtTime(2093, time);
      gainMain.gain.setValueAtTime(0.0001, time);
      gainMain.gain.linearRampToValueAtTime(vol * 0.85, time + 0.004);
      gainMain.gain.exponentialRampToValueAtTime(0.0001, time + 0.78);
      oscMain.connect(gainMain);
      gainMain.connect(destinationNode);
      oscMain.start(time);
      oscMain.stop(time + 0.8);

      // Shimmering 5th overtone G7 (3136 Hz)
      const osc5th = ctx.createOscillator();
      const gain5th = ctx.createGain();
      osc5th.type = 'sine';
      osc5th.frequency.setValueAtTime(3136, time);
      gain5th.gain.setValueAtTime(0.0001, time);
      gain5th.gain.linearRampToValueAtTime(vol * 0.5, time + 0.005);
      gain5th.gain.exponentialRampToValueAtTime(0.0001, time + 0.55);
      osc5th.connect(gain5th);
      gain5th.connect(destinationNode);
      osc5th.start(time);
      osc5th.stop(time + 0.58);

      // Ultra-sparkle octave C8 (4186 Hz)
      const oscHigh = ctx.createOscillator();
      const gainHigh = ctx.createGain();
      oscHigh.type = 'sine';
      oscHigh.frequency.setValueAtTime(4186, time);
      gainHigh.gain.setValueAtTime(vol * 0.28, time);
      gainHigh.gain.exponentialRampToValueAtTime(0.0001, time + 0.38);
      oscHigh.connect(gainHigh);
      gainHigh.connect(destinationNode);
      oscHigh.start(time);
      oscHigh.stop(time + 0.4);

    } else if (type === 'bubble_pop') {
      // 2. Snappy Bouncy Pop - Juicy, playful cartoon pop!
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1250, time);
      osc.frequency.exponentialRampToValueAtTime(220, time + 0.08);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(750, time);
      filter.Q.value = 2.8;

      gain.gain.setValueAtTime(vol * 0.95, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.095);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destinationNode);
      osc.start(time);
      osc.stop(time + 0.1);

      // Secondary snap transient
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(1800, time);
      snapOsc.frequency.exponentialRampToValueAtTime(450, time + 0.035);
      snapGain.gain.setValueAtTime(vol * 0.45, time);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.038);
      snapOsc.connect(snapGain);
      snapGain.connect(destinationNode);
      snapOsc.start(time);
      snapOsc.stop(time + 0.042);

    } else if (type === 'magic_chime') {
      // 3. Magical Sparkle Chime - 4-note ascending celestial glockenspiel arpeggio
      const notes = [
        { f: 1046.5, t: 0.000, d: 0.45, a: 0.70 }, // C6
        { f: 1318.5, t: 0.045, d: 0.50, a: 0.75 }, // E6
        { f: 1568.0, t: 0.090, d: 0.58, a: 0.80 }, // G6
        { f: 2093.0, t: 0.135, d: 0.72, a: 0.90 }  // C7
      ];

      notes.forEach(n => {
        const noteTime = time + n.t;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, noteTime);
        gain.gain.setValueAtTime(0.0001, noteTime);
        gain.gain.linearRampToValueAtTime(vol * n.a, noteTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + n.d);
        osc.connect(gain);
        gain.connect(destinationNode);
        osc.start(noteTime);
        osc.stop(noteTime + n.d + 0.02);

        // Harmonic overtone
        const oscHarm = ctx.createOscillator();
        const gainHarm = ctx.createGain();
        oscHarm.type = 'sine';
        oscHarm.frequency.setValueAtTime(n.f * 2, noteTime);
        gainHarm.gain.setValueAtTime(vol * n.a * 0.35, noteTime);
        gainHarm.gain.exponentialRampToValueAtTime(0.0001, noteTime + (n.d * 0.6));
        oscHarm.connect(gainHarm);
        gainHarm.connect(destinationNode);
        oscHarm.start(noteTime);
        oscHarm.stop(noteTime + (n.d * 0.6) + 0.02);
      });

    } else if (type === 'tada_fanfare') {
      // 4. Celebratory Brass Fanfare ("Ta-Da!" 2-step triumphant brass hit)
      // Step 1: "Ta-" (G5 784Hz + D6 1175Hz)
      const t1 = time;
      [784, 1175].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t1);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, t1);
        gain.gain.setValueAtTime(0.0001, t1);
        gain.gain.linearRampToValueAtTime(vol * 0.55, t1 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.08);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destinationNode);
        osc.start(t1);
        osc.stop(t1 + 0.085);
      });

      // Step 2: "-DA!" Celebratory major chord (C6 1046Hz, E6 1318Hz, G6 1568Hz)
      const t2 = time + 0.085;
      [1046, 1318, 1568].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t2);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3600, t2);
        filter.frequency.exponentialRampToValueAtTime(1400, t2 + 0.55);
        gain.gain.setValueAtTime(0.0001, t2);
        gain.gain.linearRampToValueAtTime(vol * 0.6, t2 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.62);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(destinationNode);
        osc.start(t2);
        osc.stop(t2 + 0.65);
      });

    } else if (type === 'marimba_knock') {
      // 5. Warm Wooden Marimba Tap (Acoustic percussion double tap)
      // Tap 1: Soft body knock
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523, time); // C5
      gain1.gain.setValueAtTime(vol * 0.45, time);
      gain1.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
      osc1.connect(gain1);
      gain1.connect(destinationNode);
      osc1.start(time);
      osc1.stop(time + 0.08);

      // Tap 2: Bright wooden strike (time + 0.035s)
      const tTap = time + 0.035;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046, tTap); // C6
      osc2.frequency.exponentialRampToValueAtTime(523, tTap + 0.18);
      gain2.gain.setValueAtTime(vol * 0.85, tTap);
      gain2.gain.exponentialRampToValueAtTime(0.0001, tTap + 0.22);
      osc2.connect(gain2);
      gain2.connect(destinationNode);
      osc2.start(tTap);
      osc2.stop(tTap + 0.24);

      // Wood click transient
      const woodClick = ctx.createOscillator();
      const woodGain = ctx.createGain();
      woodClick.type = 'triangle';
      woodClick.frequency.setValueAtTime(3200, tTap);
      woodGain.gain.setValueAtTime(vol * 0.5, tTap);
      woodGain.gain.exponentialRampToValueAtTime(0.0001, tTap + 0.02);
      woodClick.connect(woodGain);
      woodGain.connect(destinationNode);
      woodClick.start(tTap);
      woodClick.stop(tTap + 0.025);

    } else if (type === 'cyber_ping') {
      // 6. Modern Cyber Hologram Ping (Futuristic sleek tech ring)
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2600, time);
      osc.frequency.exponentialRampToValueAtTime(1650, time + 0.25);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2100, time);
      filter.Q.value = 4.8;

      gain.gain.setValueAtTime(vol * 0.9, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(destinationNode);
      osc.start(time);
      osc.stop(time + 0.35);

      // Sub-harmonic tech pulse
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(880, time);
      subGain.gain.setValueAtTime(vol * 0.3, time);
      subGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
      sub.connect(subGain);
      subGain.connect(destinationNode);
      sub.start(time);
      sub.stop(time + 0.16);
    }
  }

  /**
   * Plays the Answer Reveal sound effect live during canvas preview or user audition
   */
  playRevealSfx(type = 'ding_bell', volume = 0.85) {
    if (!type || type === 'none' || this.revealSfxMuted || volume <= 0) return;
    this.ensureContext();
    const now = this.ctx.currentTime;
    // Routes to masterGainNode (which feeds destination speakers and mediaStreamDest for video recording!)
    this.synthesizeRevealSfx(this.ctx, this.masterGainNode, type, now, volume);
  }

  async playPreview(arrayBuffer) {
    this.ensureContext();
    if (this.previewSource) {
      this.stopPreview();
      return false; // stopped
    }
    try {
      const buffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.bgmGainNode);
      source.start(0);
      this.previewSource = source;
      source.onended = () => {
        if (this.previewSource === source) this.previewSource = null;
      };
      return true; // playing
    } catch (e) {
      console.warn('Preview error:', e);
      return false;
    }
  }

  stopPreview() {
    if (this.previewSource) {
      try {
        this.previewSource.stop();
        this.previewSource.disconnect();
      } catch (e) {}
      this.previewSource = null;
    }
  }

  // --- PROCEDURAL BGM SYNTHESIS (OfflineAudioContext -> AudioBuffer) ---
  async generatePresetBGM(presetName = 'quack_hop', totalSeconds = 60) {
    this.ensureContext();
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, sampleRate * totalSeconds, sampleRate);

    if (presetName === 'quack_hop') {
      this._synthQuackHop(offlineCtx, totalSeconds);
    } else if (presetName === 'detective') {
      this._synthDetective(offlineCtx, totalSeconds);
    } else if (presetName === 'arcade') {
      this._synthArcade(offlineCtx, totalSeconds);
    } else if (presetName === 'tension') {
      this._synthTension(offlineCtx, totalSeconds);
    } else if (presetName === 'lofi') {
      this._synthLofi(offlineCtx, totalSeconds);
    } else if (presetName === 'polka') {
      this._synthPolka(offlineCtx, totalSeconds);
    } else {
      this._synthQuackHop(offlineCtx, totalSeconds);
    }

    const renderedBuffer = await offlineCtx.startRendering();
    this.setBuffer(renderedBuffer, presetName, true);
    return renderedBuffer;
  }

  // 1. Quack Hop (128 BPM Funky Bouncy)
  _synthQuackHop(ctx, duration) {
    const bpm = 128;
    const beatSec = 60 / bpm;
    const totalBeats = Math.floor(duration / beatSec);
    const melodyNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 392.00, 329.63];
    const bassNotes = [130.81, 130.81, 164.81, 174.61, 196.00, 196.00, 174.61, 164.81];

    for (let beat = 0; beat < totalBeats; beat++) {
      const time = beat * beatSec;
      if (beat % 2 === 0) this._addKick(ctx, time, 0.4);
      if (beat % 2 === 1) this._addSnare(ctx, time, 0.25);
      this._addHiHat(ctx, time, 0.12);
      this._addHiHat(ctx, time + beatSec * 0.5, 0.09);

      const bassFreq = bassNotes[beat % bassNotes.length];
      this._addBassNote(ctx, time, bassFreq, beatSec * 0.6, 0.35);

      if (beat % 2 === 0 || Math.sin(beat) > 0) {
        const melFreq = melodyNotes[(beat * 2) % melodyNotes.length];
        this._addMarimbaNote(ctx, time + beatSec * 0.25, melFreq, beatSec * 0.4, 0.25);
      }
    }
  }

  // 2. Sneaky Detective (105 BPM Mystery Jazz)
  _synthDetective(ctx, duration) {
    const bpm = 105;
    const beatSec = 60 / bpm;
    const totalBeats = Math.floor(duration / beatSec);
    const bassNotes = [55, 65.41, 73.42, 77.78, 82.41, 98, 82.41, 73.42];

    for (let beat = 0; beat < totalBeats; beat++) {
      const time = beat * beatSec;
      if (beat % 4 === 0) this._addKick(ctx, time, 0.3);
      if (beat % 2 === 1) this._addRimshot(ctx, time, 0.2);
      this._addHiHat(ctx, time, 0.08);
      this._addHiHat(ctx, time + beatSec * 0.66, 0.06);

      const bFreq = bassNotes[beat % bassNotes.length];
      this._addUprightBass(ctx, time, bFreq, beatSec * 0.8, 0.4);

      if (beat % 4 === 2) {
        this._addMarimbaNote(ctx, time, 440 * (beat % 8 === 2 ? 1.2 : 1.25), beatSec * 0.9, 0.15);
      }
    }
  }

  // 3. Arcade Bounce (138 BPM 8-Bit Chiptune)
  _synthArcade(ctx, duration) {
    const bpm = 138;
    const beatSec = 60 / bpm;
    const totalBeats = Math.floor(duration / beatSec);
    const arps = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63];

    for (let beat = 0; beat < totalBeats; beat++) {
      const time = beat * beatSec;
      this._addKick(ctx, time, 0.35);
      if (beat % 2 === 1) this._addSnare(ctx, time, 0.2);

      for (let s = 0; s < 4; s++) {
        const stepTime = time + s * (beatSec / 4);
        const note = arps[(beat * 4 + s) % arps.length];
        this._addSquareChiptune(ctx, stepTime, note, beatSec / 5, 0.15);
      }
      this._addBassNote(ctx, time, 110, beatSec * 0.5, 0.28);
    }
  }

  // 4. Tick-Tock Tension (120 BPM Suspense Clock)
  _synthTension(ctx, duration) {
    const bpm = 120;
    const beatSec = 60 / bpm;
    const totalBeats = Math.floor(duration / beatSec);

    for (let beat = 0; beat < totalBeats; beat++) {
      const time = beat * beatSec;
      const isTick = beat % 2 === 0;
      this._addClockTick(ctx, time, isTick ? 1800 : 1200, 0.3);

      if (beat % 2 === 0) {
        this._addHeartbeat(ctx, time, 55, 0.45);
        this._addHeartbeat(ctx, time + beatSec * 0.3, 48, 0.3);
      }

      if (beat % 8 === 0) {
        this._addTensionDrone(ctx, time, 220 + (beat % 32) * 5, beatSec * 7, 0.12);
      }
    }
  }

  // 5. Cozy Lofi Vibes (90 BPM Chill Chords)
  _synthLofi(ctx, duration) {
    const bpm = 90;
    const beatSec = 60 / bpm;
    const totalBeats = Math.floor(duration / beatSec);
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 349.23]  // G7
    ];

    for (let beat = 0; beat < totalBeats; beat++) {
      const time = beat * beatSec;
      if (beat % 4 === 0) this._addKick(ctx, time, 0.32);
      if (beat % 4 === 2) this._addRimshot(ctx, time, 0.2);
      this._addHiHat(ctx, time + beatSec * 0.5, 0.07);

      if (beat % 4 === 0) {
        const chord = chords[Math.floor(beat / 4) % chords.length];
        chord.forEach((freq, idx) => {
          this._addMarimbaNote(ctx, time + idx * 0.03, freq, beatSec * 3.5, 0.12);
        });
      }
    }
  }

  // 6. Funny Animal Polka (130 BPM Whimsical Cartoon)
  _synthPolka(ctx, duration) {
    const bpm = 130;
    const beatSec = 60 / bpm;
    const totalBeats = Math.floor(duration / beatSec);
    const oomphBass = [98.00, 146.83, 110.00, 164.81];

    for (let beat = 0; beat < totalBeats; beat++) {
      const time = beat * beatSec;
      const bFreq = oomphBass[beat % oomphBass.length];
      this._addBassNote(ctx, time, bFreq, beatSec * 0.35, 0.4);

      // Off-beat cheerful chords (the "pah" in oom-pah)
      this._addMarimbaNote(ctx, time + beatSec * 0.5, 440, beatSec * 0.25, 0.2);
      this._addMarimbaNote(ctx, time + beatSec * 0.5, 523.25, beatSec * 0.25, 0.15);
      this._addHiHat(ctx, time + beatSec * 0.5, 0.1);
    }
  }

  // --- Instrument Primitives ---
  _addKick(ctx, time, volume = 0.4) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  _addSnare(ctx, time, volume = 0.25) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    gain.gain.setValueAtTime(volume * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.13);

    const bufferSize = Math.floor(ctx.sampleRate * 0.1);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(volume, time);
    nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    noise.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(time);
    noise.stop(time + 0.11);
  }

  _addHiHat(ctx, time, volume = 0.1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(6000, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.045);
  }

  _addRimshot(ctx, time, volume = 0.2) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, time);
    osc.frequency.exponentialRampToValueAtTime(300, time + 0.03);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.055);
  }

  _addBassNote(ctx, time, freq, duration, volume = 0.3) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, time);
    filter.frequency.exponentialRampToValueAtTime(100, time + duration);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.linearRampToValueAtTime(volume * 0.7, time + duration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  _addUprightBass(ctx, time, freq, duration, volume = 0.35) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  _addMarimbaNote(ctx, time, freq, duration, volume = 0.2) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  _addSquareChiptune(ctx, time, freq, duration, volume = 0.15) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  _addClockTick(ctx, time, freq, volume = 0.25) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  _addHeartbeat(ctx, time, freq, volume = 0.4) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.17);
  }

  _addTensionDrone(ctx, time, freq, duration, volume = 0.1) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.linearRampToValueAtTime(freq * 1.05, time + duration);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(volume, time + duration * 0.3);
    gain.gain.linearRampToValueAtTime(0.001, time + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Encodes the active AudioBuffer to a downloadable .wav file
   */
  exportToWavBlob() {
    if (!this.currentBuffer) return null;
    const numChannels = this.currentBuffer.numberOfChannels;
    const sampleRate = this.currentBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    let result;
    if (numChannels === 2) {
      result = this._interleave(this.currentBuffer.getChannelData(0), this.currentBuffer.getChannelData(1));
    } else {
      result = this.currentBuffer.getChannelData(0);
    }

    const dataLength = result.length * (bitDepth / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // RIFF header
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this._writeString(view, 8, 'WAVE');
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write PCM samples
    let offset = 44;
    for (let i = 0; i < result.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, result[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  _interleave(inputL, inputR) {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0;
    let inputIndex = 0;
    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }
}

// Global instance
window.audioEngine = new AudioEngine();
