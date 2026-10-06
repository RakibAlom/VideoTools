/**
 * KaraokeAudioEngine - Web Audio API Synthesis, Vocal Reduction/Extraction, Anti-Copyright FX Rack & Recording Mixer
 * Zero external dependencies. 100% pure JavaScript and Web Audio API.
 */

class KaraokeAudioEngine {
  constructor() {
    this.ctx = null;
    this.gainNode = null;
    this.mediaStreamDest = null;
    this.carrierOsc = null;
    this.sourceNode = null;

    // Buffer state
    this.currentBuffer = null;
    this.rawBuffer = null; // Unmodified decoded buffer
    this.trackName = 'Neon Cyber Drive';
    this.isBuiltIn = true;
    this.duration = 20;

    // Trimming & Timing
    this.trimStart = 0;
    this.trimEnd = 20;
    this.currentTime = 0;
    this.isPlaying = false;
    this.playbackStartCtxTime = 0;
    this.playbackStartOffset = 0;
    this.loop = false;

    // Waveform peak cache
    this.waveformData = [];

    // Vocal Processor Settings
    this.vocalMode = 'instrumental'; // 'original' | 'instrumental' | 'vocals'
    this.vocalReductionDepth = 0.85; // 0.0 to 1.0 (phase inversion depth)
    this.bassPreserveFreq = 160;     // Preserve bass below 160Hz from cancellation
    this.treblePreserveFreq = 9000;  // Preserve air above 9kHz

    // Anti-Copyright & Audio Transformation FX Rack
    this.fx = {
      preset: 'anti_copyright_safe',
      pitchShiftSemitones: 1.5,      // -12 to +12 semitones
      playbackSpeed: 1.04,           // 0.75x to 1.35x
      reverbWet: 0.25,               // 0.0 to 1.0
      stereoWidth: 0.35,             // 0.0 to 1.0 (anti-Content-ID phase decorrelation)
      eqBass: 2.0,                   // dB (-12 to +12)
      eqTreble: 1.5,                 // dB (-12 to +12)
      lofiMode: false
    };

    // Web Audio DSP Nodes
    this.splitter = null;
    this.merger = null;
    this.leftGain = null;
    this.rightGain = null;
    this.invertGain = null;
    this.bassFilter = null;
    this.convolver = null;
    this.reverbGain = null;
    this.dryGain = null;
    this.bassEQ = null;
    this.trebleEQ = null;
    this.widenerDelay = null;
    this.widenerGain = null;
    this.analyser = null;

    // Listeners
    this.onTimeUpdate = null;
    this.onEnded = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupMasterGraph();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setupMasterGraph() {
    // Master Gain
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.9;
    this.gainNode.connect(this.ctx.destination);

    // Live Stream Destination for Video Recording (Canvas + Audio Sync)
    this.mediaStreamDest = this.ctx.createMediaStreamDestination();
    this.gainNode.connect(this.mediaStreamDest);

    // Inaudible carrier oscillator (prevents Chromium MediaRecorder from dropping audio track)
    try {
      this.carrierOsc = this.ctx.createOscillator();
      const carrierGain = this.ctx.createGain();
      carrierGain.gain.value = 0.00002;
      this.carrierOsc.frequency.value = 60;
      this.carrierOsc.connect(carrierGain);
      carrierGain.connect(this.mediaStreamDest);
      this.carrierOsc.start();
    } catch (e) {}

    // Master FFT Analyser for visualizer & audio spectrum
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.gainNode.connect(this.analyser);

    // Build Reverb Impulse
    this.setupReverb();
  }

  setupReverb() {
    try {
      this.convolver = this.ctx.createConvolver();
      // Generate synthetic stereo room impulse response
      const rate = this.ctx.sampleRate;
      const length = rate * 2.2;
      const decay = 2.0;
      const impulse = this.ctx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      for (let i = 0; i < length; i++) {
        const t = i / rate;
        const env = Math.exp(-t * decay);
        left[i] = (Math.random() * 2 - 1) * env;
        right[i] = (Math.random() * 2 - 1) * env;
      }
      this.convolver.buffer = impulse;
    } catch (e) {
      console.warn('Reverb setup error:', e);
    }
  }

  getAudioTrack() {
    this.ensureContext();
    const tracks = (this.mediaStreamDest && this.mediaStreamDest.stream) ? this.mediaStreamDest.stream.getAudioTracks() : [];
    if (!this.mediaStreamDest || tracks.length === 0 || tracks[0].readyState === 'ended') {
      try {
        this.mediaStreamDest = this.ctx.createMediaStreamDestination();
        if (this.gainNode) {
          try { this.gainNode.connect(this.mediaStreamDest); } catch (e) {}
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
      } catch (e) {}
    }
    return this.mediaStreamDest.stream.getAudioTracks()[0];
  }

  /**
   * Decodes an ArrayBuffer or Blob into an AudioBuffer
   */
  async loadAudioFile(fileOrBlob, fileName = 'Uploaded Track') {
    this.ensureContext();
    const arrayBuffer = fileOrBlob instanceof ArrayBuffer ? fileOrBlob : await fileOrBlob.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.rawBuffer = audioBuffer;
    this.currentBuffer = audioBuffer;
    this.trackName = fileName;
    this.isBuiltIn = false;
    this.duration = audioBuffer.duration;
    this.trimStart = 0;
    this.trimEnd = audioBuffer.duration;
    this.generateWaveformData();
    return audioBuffer;
  }

  /**
   * Extracts audio from an uploaded video file (MP4, WebM)
   */
  async loadVideoAudio(videoFile) {
    this.ensureContext();
    const arrayBuffer = await videoFile.arrayBuffer();
    try {
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
      this.rawBuffer = audioBuffer;
      this.currentBuffer = audioBuffer;
      this.trackName = videoFile.name.replace(/\.[^/.]+$/, "") + ' (Audio)';
      this.duration = audioBuffer.duration;
      this.trimStart = 0;
      this.trimEnd = audioBuffer.duration;
      this.generateWaveformData();
      return audioBuffer;
    } catch (err) {
      console.warn('Direct decodeAudioData from video failed, using fallback reader:', err);
      throw new Error('Could not extract audio track from video file.');
    }
  }

  generateWaveformData(samples = 120) {
    if (!this.currentBuffer) {
      this.waveformData = new Array(samples).fill(0.3);
      return;
    }
    const rawData = this.currentBuffer.getChannelData(0);
    const blockSize = Math.floor(rawData.length / samples);
    const filteredData = [];
    for (let i = 0; i < samples; i++) {
      let blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      filteredData.push(Math.min(1.0, (sum / blockSize) * 2.8));
    }
    this.waveformData = filteredData;
  }

  /**
   * Builds the real-time DSP routing graph:
   * Source -> Vocal Splitter/Canceller -> Anti-Copyright Pitch/Speed -> EQ -> Reverb/Chorus -> Analyser -> Output
   */
  createDSPGraph() {
    this.ensureContext();
    if (!this.currentBuffer) return null;

    const source = this.ctx.createBufferSource();
    source.buffer = this.currentBuffer;

    // Apply Pitch & Playback Speed calculation
    // Speed factor: pitch shift ratio * speed multiplier
    const semitones = this.fx.pitchShiftSemitones;
    const pitchRatio = Math.pow(2, semitones / 12);
    const totalRate = Math.max(0.5, Math.min(2.0, pitchRatio * this.fx.playbackSpeed));
    source.playbackRate.value = totalRate;

    // DSP Junction Output
    const dspOut = this.ctx.createGain();

    if (this.currentBuffer.numberOfChannels >= 2 && this.vocalMode !== 'original') {
      // 1. Center-Channel Vocal Reduction / Isolation Routing
      const splitter = this.ctx.createChannelSplitter(2);
      const merger = this.ctx.createChannelMerger(2);

      source.connect(splitter);

      if (this.vocalMode === 'instrumental') {
        // Instrumental: L - R cancellation to remove center vocal
        const leftDirect = this.ctx.createGain();
        const rightDirect = this.ctx.createGain();
        const rightInvert = this.ctx.createGain();
        const leftInvert = this.ctx.createGain();

        // Cancellation depth control (0.0 = untouched stereo, 1.0 = full phase cancellation)
        const depth = this.vocalReductionDepth;
        rightInvert.gain.value = -depth;
        leftInvert.gain.value = -depth;

        // Bandpass filter on cancellation signal to protect deep sub-bass (< 160Hz) and high sizzle (> 9kHz)
        const vocalBandFilter = this.ctx.createBiquadFilter();
        vocalBandFilter.type = 'bandpass';
        vocalBandFilter.frequency.value = 1400;
        vocalBandFilter.Q.value = 0.5;

        // L channel: Left - (Right * depth)
        splitter.connect(leftDirect, 0);
        splitter.connect(vocalBandFilter, 1);
        vocalBandFilter.connect(rightInvert);

        leftDirect.connect(merger, 0, 0);
        rightInvert.connect(merger, 0, 0);

        // R channel: Right - (Left * depth)
        splitter.connect(rightDirect, 1);
        const vocalBandFilter2 = this.ctx.createBiquadFilter();
        vocalBandFilter2.type = 'bandpass';
        vocalBandFilter2.frequency.value = 1400;
        vocalBandFilter2.Q.value = 0.5;
        splitter.connect(vocalBandFilter2, 0);
        vocalBandFilter2.connect(leftInvert);

        rightDirect.connect(merger, 0, 1);
        leftInvert.connect(merger, 0, 1);

        merger.connect(dspOut);
      } else if (this.vocalMode === 'vocals') {
        // Isolated Vocals: Center sum (L + R) bandpassed around vocal frequency range
        const sumGainL = this.ctx.createGain();
        const sumGainR = this.ctx.createGain();
        sumGainL.gain.value = 0.7;
        sumGainR.gain.value = 0.7;

        const vocalFilter = this.ctx.createBiquadFilter();
        vocalFilter.type = 'bandpass';
        vocalFilter.frequency.value = 1500;
        vocalFilter.Q.value = 0.8;

        splitter.connect(sumGainL, 0);
        splitter.connect(sumGainR, 1);
        sumGainL.connect(vocalFilter);
        sumGainR.connect(vocalFilter);

        vocalFilter.connect(dspOut);
      }
    } else {
      // Original mix bypass
      source.connect(dspOut);
    }

    // 2. Anti-Copyright FX Chain (EQ, Reverb, Stereo Widening)
    const fxInput = this.ctx.createGain();
    dspOut.connect(fxInput);

    // EQ - Low Shelf (Bass Boost / Cut)
    const bassEQ = this.ctx.createBiquadFilter();
    bassEQ.type = 'lowshelf';
    bassEQ.frequency.value = 120;
    bassEQ.gain.value = this.fx.eqBass;

    // EQ - High Shelf (Treble Sparkle / Lo-Fi damping)
    const trebleEQ = this.ctx.createBiquadFilter();
    trebleEQ.type = 'highshelf';
    trebleEQ.frequency.value = 6500;
    trebleEQ.gain.value = this.fx.lofiMode ? -14 : this.fx.eqTreble;

    fxInput.connect(bassEQ);
    bassEQ.connect(trebleEQ);

    // Stereo Decorrelator / Widener (Anti-Content-ID phase shift)
    const postEQ = this.ctx.createGain();
    trebleEQ.connect(postEQ);

    let finalMix = postEQ;
    if (this.fx.stereoWidth > 0.05) {
      const widenerDelay = this.ctx.createDelay();
      widenerDelay.delayTime.value = 0.022 * this.fx.stereoWidth; // 15-25ms Haas effect
      const widenerGain = this.ctx.createGain();
      widenerGain.gain.value = 0.35 * this.fx.stereoWidth;

      postEQ.connect(widenerDelay);
      widenerDelay.connect(widenerGain);
      widenerGain.connect(this.gainNode);
    }

    // Reverb Send / Return
    if (this.fx.reverbWet > 0.02 && this.convolver) {
      const reverbSend = this.ctx.createGain();
      reverbSend.gain.value = this.fx.reverbWet;
      postEQ.connect(this.convolver);
      this.convolver.connect(reverbSend);
      reverbSend.connect(this.gainNode);
    }

    // Dry connection to master
    postEQ.connect(this.gainNode);

    return source;
  }

  play(startOffset = null) {
    this.ensureContext();
    if (!this.currentBuffer) return;

    if (this.isPlaying) {
      this.stop();
    }

    const offset = startOffset !== null ? startOffset : Math.max(this.trimStart, this.currentTime);
    const safeOffset = Math.min(Math.max(0, offset), this.trimEnd);

    this.sourceNode = this.createDSPGraph();
    if (!this.sourceNode) return;

    this.isPlaying = true;
    this.playbackStartCtxTime = this.ctx.currentTime;
    this.playbackStartOffset = safeOffset;
    this.currentTime = safeOffset;

    const playDuration = Math.max(0.1, this.trimEnd - safeOffset);
    this.sourceNode.start(0, safeOffset, playDuration);

    this.sourceNode.onended = () => {
      if (this.isPlaying) {
        if (this.loop) {
          this.play(this.trimStart);
        } else {
          this.isPlaying = false;
          this.currentTime = this.trimEnd;
          if (this.onEnded) this.onEnded();
        }
      }
    };
  }

  pause() {
    if (!this.isPlaying) return;
    this.currentTime = this.getCurrentTime();
    this.stop();
  }

  stop() {
    this.isPlaying = false;
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop(0);
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
  }

  seek(timeInSeconds) {
    const clamped = Math.max(this.trimStart, Math.min(this.trimEnd, timeInSeconds));
    this.currentTime = clamped;
    if (this.isPlaying) {
      this.play(clamped);
    }
  }

  getCurrentTime() {
    if (!this.isPlaying) {
      return this.currentTime;
    }
    const elapsed = (this.ctx.currentTime - this.playbackStartCtxTime) * this.getPlaybackSpeed();
    const cur = this.playbackStartOffset + elapsed;
    if (cur >= this.trimEnd) {
      return this.trimEnd;
    }
    return cur;
  }

  getPlaybackSpeed() {
    const semitones = this.fx.pitchShiftSemitones;
    const pitchRatio = Math.pow(2, semitones / 12);
    return Math.max(0.5, Math.min(2.0, pitchRatio * this.fx.playbackSpeed));
  }

  getTrimmedDuration() {
    return Math.max(0.1, this.trimEnd - this.trimStart);
  }

  setTrim(start, end) {
    this.trimStart = Math.max(0, Math.min(start, this.duration - 0.5));
    this.trimEnd = Math.max(this.trimStart + 0.5, Math.min(end, this.duration));
    if (this.currentTime < this.trimStart || this.currentTime > this.trimEnd) {
      this.seek(this.trimStart);
    }
  }

  /**
   * Automatically picks a random energetic slice (e.g., 15s or 30s)
   */
  pickRandomSlice(sliceDuration = 15) {
    if (this.duration <= sliceDuration) {
      this.setTrim(0, this.duration);
      return { start: 0, end: this.duration };
    }
    const maxStart = this.duration - sliceDuration;
    // Bias towards middle 60% of song where choruses / hooks usually live
    const minStart = Math.min(maxStart, this.duration * 0.15);
    const effectiveMax = Math.max(minStart, this.duration * 0.85 - sliceDuration);
    const randomStart = minStart + Math.random() * (effectiveMax - minStart);
    const roundedStart = Math.round(randomStart * 10) / 10;
    const roundedEnd = Math.round((roundedStart + sliceDuration) * 10) / 10;
    this.setTrim(roundedStart, roundedEnd);
    return { start: roundedStart, end: roundedEnd };
  }

  /**
   * Applies Anti-Copyright Preset
   */
  applyFxPreset(presetKey) {
    this.fx.preset = presetKey;
    switch (presetKey) {
      case 'anti_copyright_safe':
        // Modified acoustic fingerprint: altered pitch, speed & spatial phase
        this.fx.pitchShiftSemitones = 1.5;
        this.fx.playbackSpeed = 1.04;
        this.fx.reverbWet = 0.22;
        this.fx.stereoWidth = 0.40;
        this.fx.eqBass = 2.0;
        this.fx.eqTreble = 1.5;
        this.fx.lofiMode = false;
        break;

      case 'nightcore':
        // High-energy fast anime/TikTok nightcore style
        this.fx.pitchShiftSemitones = 3.5;
        this.fx.playbackSpeed = 1.15;
        this.fx.reverbWet = 0.15;
        this.fx.stereoWidth = 0.25;
        this.fx.eqBass = 1.0;
        this.fx.eqTreble = 4.0;
        this.fx.lofiMode = false;
        break;

      case 'slowed_reverb':
        // Viral slowed + reverb aesthetic
        this.fx.pitchShiftSemitones = -2.5;
        this.fx.playbackSpeed = 0.86;
        this.fx.reverbWet = 0.55;
        this.fx.stereoWidth = 0.50;
        this.fx.eqBass = 4.0;
        this.fx.eqTreble = -3.0;
        this.fx.lofiMode = false;
        break;

      case 'lofi_dream':
        // Vintage warmth & vinyl softness
        this.fx.pitchShiftSemitones = -1.0;
        this.fx.playbackSpeed = 0.93;
        this.fx.reverbWet = 0.35;
        this.fx.stereoWidth = 0.30;
        this.fx.eqBass = 3.0;
        this.fx.eqTreble = -8.0;
        this.fx.lofiMode = true;
        break;

      case 'clean_original':
      default:
        this.fx.pitchShiftSemitones = 0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.0;
        this.fx.stereoWidth = 0.0;
        this.fx.eqBass = 0;
        this.fx.eqTreble = 0;
        this.fx.lofiMode = false;
        break;
    }

    if (this.isPlaying) {
      const cur = this.getCurrentTime();
      this.play(cur);
    }
  }

  /**
   * Synthesize Royalty-Free Procedural Songs (100% Copyright-Free)
   */
  async synthesizeSong(songKey = 'neon_cyber') {
    this.ensureContext();
    const rate = this.ctx.sampleRate;
    const duration = 22; // 22 seconds high-energy hook
    const length = rate * duration;
    const buffer = this.ctx.createBuffer(2, length, rate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    const bpm = songKey === 'neon_cyber' ? 128 : (songKey === 'midnight_groove' ? 116 : (songKey === 'starlight' ? 88 : 132));
    const secondsPerBeat = 60 / bpm;

    // Helper synth notes
    const freqFromMidi = (m) => 440 * Math.pow(2, (m - 69) / 12);

    // Chords and bassline progression
    // Progression: vi - IV - I - V (classic viral pop/synthwave progression)
    const progressions = {
      neon_cyber: [
        { root: 45, chords: [57, 60, 64], name: 'Am' },
        { root: 41, chords: [53, 57, 60], name: 'F' },
        { root: 48, chords: [60, 64, 67], name: 'C' },
        { root: 43, chords: [55, 59, 62], name: 'G' }
      ],
      midnight_groove: [
        { root: 43, chords: [55, 59, 62], name: 'G' },
        { root: 47, chords: [59, 62, 66], name: 'Bm' },
        { root: 48, chords: [60, 64, 67], name: 'C' },
        { root: 41, chords: [53, 57, 60], name: 'F' }
      ],
      starlight: [
        { root: 48, chords: [60, 64, 67], name: 'Cmaj7' },
        { root: 45, chords: [57, 60, 64], name: 'Am7' },
        { root: 41, chords: [53, 57, 60], name: 'Fmaj7' },
        { root: 43, chords: [55, 59, 62], name: 'G7' }
      ]
    };

    const prog = progressions[songKey] || progressions.neon_cyber;

    // Synthesize Drums, Bass, Chords & Arpeggio Leads
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const beat = t / secondsPerBeat;
      const bar = Math.floor(beat / 4);
      const beatInBar = beat % 4;
      const chordIdx = bar % prog.length;
      const currentChord = prog[chordIdx];

      let sampleL = 0;
      let sampleR = 0;

      // 1. Kick Drum (on beats 0, 1, 2, 3 or four-on-the-floor)
      const kickPhase = beatInBar % 1.0;
      if (kickPhase < 0.25) {
        const kickTime = kickPhase * secondsPerBeat;
        const kickFreq = 140 * Math.exp(-kickTime * 28) + 45;
        const kickEnv = Math.exp(-kickTime * 14);
        const kick = Math.sin(2 * Math.PI * kickFreq * kickTime) * kickEnv * 0.45;
        sampleL += kick;
        sampleR += kick;
      }

      // 2. Snare / Clap (on beats 1 and 3)
      if ((beatInBar >= 1.0 && beatInBar < 1.3) || (beatInBar >= 3.0 && beatInBar < 3.3)) {
        const snareTime = (beatInBar % 2 - 1) * secondsPerBeat;
        if (snareTime >= 0) {
          const noise = (Math.random() * 2 - 1) * Math.exp(-snareTime * 16) * 0.35;
          const tone = Math.sin(2 * Math.PI * 180 * snareTime) * Math.exp(-snareTime * 22) * 0.25;
          sampleL += noise + tone;
          sampleR += noise + tone;
        }
      }

      // 3. Hi-Hats (every 16th note)
      const hatPhase = (beat * 4) % 1.0;
      const hatTime = hatPhase * (secondsPerBeat / 4);
      if (hatTime < 0.08) {
        const hat = (Math.random() * 2 - 1) * Math.exp(-hatTime * 65) * 0.12;
        sampleL += hat * 0.9;
        sampleR += hat * 1.1; // Stereo hi-hat
      }

      // 4. Bassline (8th notes driving bass)
      const bassPhase = (beat * 2) % 1.0;
      const bassTime = bassPhase * (secondsPerBeat / 2);
      const bassFreq = freqFromMidi(currentChord.root);
      const bassEnv = Math.exp(-bassTime * 4.5);
      // Sawtooth-like waveform + sub-bass
      const bass = (Math.sin(2 * Math.PI * bassFreq * t) + 0.5 * Math.sin(4 * Math.PI * bassFreq * t)) * bassEnv * 0.32;
      sampleL += bass;
      sampleR += bass;

      // 5. Synth Chords (Supersaw / Warm Pad)
      let chordSumL = 0;
      let chordSumR = 0;
      for (let note of currentChord.chords) {
        const f = freqFromMidi(note);
        chordSumL += Math.sin(2 * Math.PI * f * t) * 0.06;
        chordSumR += Math.sin(2 * Math.PI * (f * 1.004) * t) * 0.06; // Detuned stereo chorus
      }
      sampleL += chordSumL;
      sampleR += chordSumR;

      // 6. Arpeggio / Melodic Hook
      const arpStep = Math.floor(beat * 4) % 8;
      const arpNotes = [currentChord.chords[0], currentChord.chords[1], currentChord.chords[2], currentChord.chords[1] + 12];
      const leadMidi = arpNotes[arpStep % arpNotes.length] + 12;
      const leadFreq = freqFromMidi(leadMidi);
      const arpPhase = (beat * 4) % 1.0;
      const arpTime = arpPhase * (secondsPerBeat / 4);
      const leadEnv = Math.exp(-arpTime * 6.0);
      const lead = Math.sin(2 * Math.PI * leadFreq * t) * leadEnv * 0.15;
      sampleL += lead * 1.1;
      sampleR += lead * 0.9;

      // Soft Limiter / Saturation
      left[i] = Math.tanh(sampleL * 0.85);
      right[i] = Math.tanh(sampleR * 0.85);
    }

    this.rawBuffer = buffer;
    this.currentBuffer = buffer;
    this.isBuiltIn = true;
    this.trackName = songKey === 'neon_cyber' ? 'Neon Cyber Drive' : (songKey === 'midnight_groove' ? 'Midnight Groove' : 'Starlight Serenade');
    this.duration = duration;
    this.trimStart = 0;
    this.trimEnd = duration;
    this.generateWaveformData();
    return buffer;
  }
}

window.karaokeAudioEngine = new KaraokeAudioEngine();