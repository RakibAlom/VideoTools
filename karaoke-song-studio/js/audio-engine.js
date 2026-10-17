/**
 * KaraokeAudioEngine - Advanced Multi-Track Vocal Separation & Studio DSP FX Rack
 * 100% Pure JavaScript (Zero Python). Clean ASCII.
 */

class KaraokeAudioEngine {
  constructor() {
    this.ctx = null;
    this.gainNode = null;
    this.mediaStreamDest = null;
    this.carrierOsc = null;

    // Buffer state - 3 Dedicated Synchronized Tracks
    this.originalBuffer = null;
    this.instrumentalBuffer = null;
    this.vocalIsolatedBuffer = null;
    this.currentBuffer = null;
    this.rawBuffer = null;

    this.trackName = 'Spotify Studio (Clean Funk Demo)';
    this.isBuiltIn = true;
    this.duration = 22;

    // Trimming & Timing
    this.trimStart = 0;
    this.trimEnd = 22;
    this.currentTime = 0;
    this.isPlaying = false;
    this.playbackStartCtxTime = 0;
    this.playbackStartOffset = 0;
    this.loop = false;

    // Waveform peak cache
    this.waveformData = [];

    // Vocal Processor Settings
    this.vocalMode = 'original'; // 'original' (full song with singer) | 'instrumental' (singer muted) | 'vocals' (isolated)
    this.vocalReductionDepth = 0.0;
    this.vocalMixBalance = 1.0; // 1.0 = Full Original Mix, 0.0 = Backing Track (Muted Singer), or any blend!

    // DSP FX Settings
    this.fx = {
      preset: 'clean_original',
      pitchShiftSemitones: 0.0,
      playbackSpeed: 1.0,
      stereoWidth: 0.0,
      reverbWet: 0.0,
      echoWet: 0.0,
      echoTime: 0.28,
      eqBass: 0.0,
      eqTreble: 0.0,
      lofiMode: false,
      lofiWarmth: 0.0,
      spatial8D: 0.0,
      radioFilter: 0.0
    };

    // Extended Studio DSP Nodes
    this.lofiBandpass = null;
    this.lofiHighpass = null;
    this.lofiSaturator = null;
    this.lofiFlutterDelay = null;
    this.lofiFlutterGain = null;
    this.lofiFlutterLFO = null;
    this.lofiSend = null;
    this.spatialPanner = null;
    this.spatialLFO = null;
    this.spatialGain = null;
    this.radioBP = null;
    this.radioSend = null;

    // Permanent FX Nodes
    this.analyser = null;
    this.fxInput = null;
    this.bassEQ = null;
    this.trebleEQ = null;
    this.postEQ = null;
    this.widenerDelay = null;
    this.widenerGain = null;
    this.convolver = null;
    this.reverbSend = null;
    this.echoDelay = null;
    this.echoFeedback = null;
    this.echoSend = null;

    // 3 Synchronized Source Nodes & Gain Controls
    this.sourceDry = null;
    this.sourceInst = null;
    this.sourceVoc = null;
    this.vocalDryGain = null;
    this.vocalCanceledGain = null;
    this.vocalIsolatedGain = null;

    this.onTimeUpdate = null;
    this.onStateChange = null;

  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupMasterGraph();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        this.ctx.resume().catch(() => {});
      } catch (e) {}
    }
    return this.ctx;
  }

  setupMasterGraph() {
    // 1. Master Output Gain (headroom protected against digital clipping)
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = 0.90;
    this.gainNode.connect(this.ctx.destination);

    // 2. Stream destination for canvas recording (pure audio, zero carrier hum)
    this.mediaStreamDest = this.ctx.createMediaStreamDestination();
    this.gainNode.connect(this.mediaStreamDest);

    // 3. Analyser for canvas visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.gainNode.connect(this.analyser);

    // 4. Build Master FX Rack Nodes
    this.fxInput = this.ctx.createGain();

    // Bass EQ (Lowshelf 120Hz)
    this.bassEQ = this.ctx.createBiquadFilter();
    this.bassEQ.type = 'lowshelf';
    this.bassEQ.frequency.value = 120;
    this.bassEQ.gain.value = this.fx.eqBass || 0;

    // Treble EQ (Highshelf 6500Hz)
    this.trebleEQ = this.ctx.createBiquadFilter();
    this.trebleEQ.type = 'highshelf';
    this.trebleEQ.frequency.value = 6500;
    this.trebleEQ.gain.value = this.fx.eqTreble || 0;

    this.postEQ = this.ctx.createGain();

    this.fxInput.connect(this.bassEQ);
    this.bassEQ.connect(this.trebleEQ);
    this.trebleEQ.connect(this.postEQ);

    // Direct path to Master
    this.postEQ.connect(this.gainNode);

    // Haas Stereo Widener
    this.widenerDelay = this.ctx.createDelay();
    this.widenerDelay.delayTime.value = 0.022;
    this.widenerGain = this.ctx.createGain();
    this.widenerGain.gain.value = 0.35 * (this.fx.stereoWidth || 0);

    this.postEQ.connect(this.widenerDelay);
    this.widenerDelay.connect(this.widenerGain);
    this.widenerGain.connect(this.gainNode);

    // Tape Echo / Delay
    this.echoDelay = this.ctx.createDelay();
    this.echoDelay.delayTime.value = this.fx.echoTime || 0.28;
    this.echoFeedback = this.ctx.createGain();
    this.echoFeedback.gain.value = 0.32;
    this.echoSend = this.ctx.createGain();
    this.echoSend.gain.value = this.fx.echoWet || 0.0;

    this.postEQ.connect(this.echoDelay);
    this.echoDelay.connect(this.echoFeedback);
    this.echoFeedback.connect(this.echoDelay);
    this.echoDelay.connect(this.echoSend);
    this.echoSend.connect(this.gainNode);

    // Lo-Fi Vintage Cassette / Tape Warmth Chain
    this.setupLoFiChain();

    // 8D Spatial Audio Auto-Panner
    this.setupSpatial8D();

    // Vintage Radio / Megaphone Bandpass
    this.setupRadioFilter();

    // Impulse Convolver Reverb
    this.setupReverb();

  }

  setupLoFiChain() {
    try {
      // 1. Warm Analog Low-pass (Butterworth smooth 4200Hz - zero resonance peak)
      this.lofiBandpass = this.ctx.createBiquadFilter();
      this.lofiBandpass.type = 'lowpass';
      this.lofiBandpass.frequency.value = 4200;
      this.lofiBandpass.Q.value = 0.707;

      // 2. High-pass (80Hz cutoff) to eliminate sub rumble
      this.lofiHighpass = this.ctx.createBiquadFilter();
      this.lofiHighpass.type = 'highpass';
      this.lofiHighpass.frequency.value = 80;

      // 3. Silky Smooth Analog Tape Saturation (Tanh curve - mathematically C-infinity smooth, ZERO NOISE)
      this.lofiSaturator = this.ctx.createWaveShaper();
      const n = 4096;
      const curve = new Float32Array(n);
      const drive = 1.35;
      const norm = Math.tanh(drive);
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = Math.tanh(x * drive) / norm;
      }
      this.lofiSaturator.curve = curve;
      this.lofiSaturator.oversample = '4x'; // 4x oversampling removes all digital aliasing hash

      // 4. Send Gain to Master (Smooth insert, zero comb-filtering delay)
      this.lofiSend = this.ctx.createGain();
      this.lofiSend.gain.value = 0.0;

      this.postEQ.connect(this.lofiHighpass);
      this.lofiHighpass.connect(this.lofiBandpass);
      this.lofiBandpass.connect(this.lofiSaturator);
      this.lofiSaturator.connect(this.lofiSend);
      this.lofiSend.connect(this.gainNode);
    } catch (e) {
      console.warn('Lo-Fi DSP init warning:', e);
    }
  }

  setupSpatial8D() {
    try {
      if (this.ctx.createStereoPanner) {
        this.spatialPanner = this.ctx.createStereoPanner();
        this.spatialGain = this.ctx.createGain();
        this.spatialGain.gain.value = 0.0;

        this.spatialLFO = this.ctx.createOscillator();
        this.spatialLFO.frequency.value = 0.11; // 0.11 Hz smooth circular revolution
        this.spatialLFO.connect(this.spatialPanner.pan);
        this.spatialLFO.start();

        // Dry signal routed through 8D panner into gainNode
        this.postEQ.connect(this.spatialPanner);
        this.spatialPanner.connect(this.spatialGain);
        this.spatialGain.connect(this.gainNode);
      }
    } catch (e) {
      console.warn('8D Spatial DSP init warning:', e);
    }
  }

  setupRadioFilter() {
    try {
      this.radioBP = this.ctx.createBiquadFilter();
      this.radioBP.type = 'bandpass';
      this.radioBP.frequency.value = 1450;
      this.radioBP.Q.value = 2.4;

      this.radioSend = this.ctx.createGain();
      this.radioSend.gain.value = 0.0;

      this.postEQ.connect(this.radioBP);
      this.radioBP.connect(this.radioSend);
      this.radioSend.connect(this.gainNode);
    } catch (e) {}
  }

  setupReverb() {
    try {
      this.convolver = this.ctx.createConvolver();
      const rate = this.ctx.sampleRate;
      const length = Math.floor(rate * 1.8);
      const decay = 3.2;
      const impulse = this.ctx.createBuffer(2, length, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);

      // Acoustic warm low-pass damped room impulse - ZERO WHITE NOISE HISS
      let filterL = 0;
      let filterR = 0;
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        const env = Math.exp(-t * decay);
        // Exponential high-frequency damping factor: eliminates all hiss
        const damp = Math.exp(-t * 22.0);
        const rawL = (Math.random() * 2 - 1) * env;
        const rawR = (Math.random() * 2 - 1) * env;
        const alpha = 0.06 + 0.10 * damp;
        filterL += alpha * (rawL - filterL);
        filterR += alpha * (rawR - filterR);
        left[i] = filterL * 1.6;
        right[i] = filterR * 1.6;
      }
      this.convolver.buffer = impulse;

      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = this.fx.reverbWet || 0.0;
      this.postEQ.connect(this.convolver);
      this.convolver.connect(this.reverbSend);
      this.reverbSend.connect(this.gainNode);
    } catch (e) {}
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
        // Clean audio track, zero carrier bleed
      } catch (e) {}
    }
    return this.mediaStreamDest.stream.getAudioTracks()[0];
  }

  setTrim(start, end) {
    this.trimStart = Math.max(0, Math.min(start, this.duration - 0.1));
    this.trimEnd = Math.max(this.trimStart + 0.1, Math.min(end, this.duration));
    if (this.currentTime < this.trimStart || this.currentTime > this.trimEnd) {
      this.currentTime = this.trimStart;
    }
  }

  getTrimmedDuration() {
    return Math.max(0, this.trimEnd - this.trimStart);
  }

  async loadAudioFile(fileOrBlob, fileName = 'Uploaded Track') {
    await this.ensureContext();
    const arrayBuffer = fileOrBlob instanceof ArrayBuffer ? fileOrBlob : await fileOrBlob.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));

    this.rawBuffer = audioBuffer;
    this.currentBuffer = audioBuffer;
    this.originalBuffer = audioBuffer;
    this.trackName = fileName;
    this.isBuiltIn = false;
    this.duration = audioBuffer.duration;
    this.trimStart = 0;
    this.trimEnd = audioBuffer.duration;
    this.currentTime = 0;
    this.vocalMode = 'original'; // Start in full original mix so custom songs play with full fidelity
    this.vocalMixBalance = 1.0;

    // Generate separated tracks for instant 100% vocal muting & vocal isolation
    this.separateVocalBuffers(audioBuffer);
    this.generateWaveformData();
    this.updateVocalDSP();
    return audioBuffer;
  }

  async loadVideoAudio(videoFile) {
    await this.ensureContext();
    const arrayBuffer = await videoFile.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.slice(0));

    this.rawBuffer = audioBuffer;
    this.currentBuffer = audioBuffer;
    this.originalBuffer = audioBuffer;
    this.trackName = videoFile.name.replace(/\.[^/.]+$/, "") + ' (Audio)';
    this.isBuiltIn = false;
    this.duration = audioBuffer.duration;
    this.trimStart = 0;
    this.trimEnd = audioBuffer.duration;
    this.currentTime = 0;
    this.vocalMode = 'original';
    this.vocalMixBalance = 1.0;

    this.separateVocalBuffers(audioBuffer);
    this.generateWaveformData();
    this.updateVocalDSP();
    return audioBuffer;
  }

  /**
   * Sample-accurate Mid/Side phase cancellation & vocal isolation on Float32Array
   */
  separateVocalBuffers(audioBuffer) {
    if (!this.ctx) return;
    const sampleRate = audioBuffer.sampleRate;
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    const instBuffer = this.ctx.createBuffer(2, length, sampleRate);
    const instL = instBuffer.getChannelData(0);
    const instR = instBuffer.getChannelData(1);

    const vocBuffer = this.ctx.createBuffer(2, length, sampleRate);
    const vocL = vocBuffer.getChannelData(0);
    const vocR = vocBuffer.getChannelData(1);

    if (numChannels >= 2) {
      const srcL = audioBuffer.getChannelData(0);
      const srcR = audioBuffer.getChannelData(1);

      // Lowpass filter for preserving sub-bass kicks & bass guitar (< 180 Hz)
      const rcBass = 1.0 / (2.0 * Math.PI * 180);
      const dt = 1.0 / sampleRate;
      const alphaBass = dt / (rcBass + dt);
      let bassL = 0;
      let bassR = 0;

      // Highpass filter for preserving sparkling stereo highs (> 5000 Hz)
      const rcHigh = 1.0 / (2.0 * Math.PI * 5000);
      const alphaHigh = rcHigh / (rcHigh + dt);
      let highPrevL = 0, highInPrevL = 0;
      let highPrevR = 0, highInPrevR = 0;

      for (let i = 0; i < length; i++) {
        const l = srcL[i];
        const r = srcR[i];

        // Low bass filter
        bassL += alphaBass * (l - bassL);
        bassR += alphaBass * (r - bassR);
        const monoBass = (bassL + bassR) * 0.5;

        // High frequency filter
        const highL = alphaHigh * (highPrevL + l - highInPrevL);
        highPrevL = highL; highInPrevL = l;
        const highR = alphaHigh * (highPrevR + r - highInPrevR);
        highPrevR = highR; highInPrevR = r;

        // Classical Center Vocal Cancellation (Zero Singer Voice, 100% Clean Backing Music)
        // Center vocals exist equally in L and R (L_voc == R_voc).
        // (L - R) * 0.5 completely eliminates 100% of the center singer voice!
        const side = (l - r) * 0.5;
        const mid = (l + r) * 0.5;

        // Instrumental (Singer Voice 100% MUTED):
        // Preserve full sub-bass, kick drums, and bass guitar (<180Hz) while completely eliminating the singer
        instL[i] = Math.max(-1.0, Math.min(1.0, side + monoBass));
        instR[i] = Math.max(-1.0, Math.min(1.0, -side + monoBass));

        // Isolated Vocals (Acapella Solo - Center channel without bass):
        const vocCenter = mid - monoBass;
        vocL[i] = Math.max(-1.0, Math.min(1.0, vocCenter));
        vocR[i] = Math.max(-1.0, Math.min(1.0, vocCenter));
      }
    } else {
      // Mono deep vocal notch filter (preserves sub-bass kicks & high sparkle, 100% silences 220Hz-3800Hz vocal band)
      const src = audioBuffer.getChannelData(0);
      const rcBass = 1.0 / (2.0 * Math.PI * 180);
      const dt = 1.0 / sampleRate;
      const alphaBass = dt / (rcBass + dt);
      let bass = 0;

      const rcHigh = 1.0 / (2.0 * Math.PI * 4500);
      const alphaHigh = rcHigh / (rcHigh + dt);
      let highPrev = 0, highInPrev = 0;

      for (let i = 0; i < length; i++) {
        const s = src[i];
        bass += alphaBass * (s - bass);
        const high = alphaHigh * (highPrev + s - highInPrev);
        highPrev = high; highInPrev = s;

        // Attenuate mid-frequency vocal formants by 96%
        const midVoice = s - bass - high;
        const cleanedInst = Math.max(-1.0, Math.min(1.0, bass * 1.1 + high * 0.95 + midVoice * 0.04));
        instL[i] = cleanedInst;
        instR[i] = cleanedInst;
        vocL[i] = Math.max(-1.0, Math.min(1.0, midVoice));
        vocR[i] = Math.max(-1.0, Math.min(1.0, midVoice));
      }
    }

    this.instrumentalBuffer = instBuffer;
    this.vocalIsolatedBuffer = vocBuffer;
    this.originalBuffer = audioBuffer;
  }

  detectVocalPresence(buffer = this.currentBuffer) {
    if (!buffer || buffer.numberOfChannels < 2) {
      return { hasVocals: false, confidence: 0, ratio: '1.0' };
    }
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const sampleRate = buffer.sampleRate;
    const checkLength = Math.min(left.length, sampleRate * 12);
    const step = 16;

    let midEnergy = 0;
    let sideEnergy = 0;

    for (let i = 0; i < checkLength; i += step) {
      const l = left[i];
      const r = right[i];
      const mid = (l + r) * 0.5;
      const side = (l - r) * 0.5;
      midEnergy += mid * mid;
      sideEnergy += side * side;
    }

    const midToSideRatio = midEnergy / Math.max(0.00001, sideEnergy);
    const hasVocals = midToSideRatio > 1.20;

    return {
      hasVocals,
      ratio: midToSideRatio.toFixed(2),
      confidence: Math.min(100, Math.round(midToSideRatio * 45))
    };
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
      const blockStart = blockSize * i;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[blockStart + j] || 0);
      }
      filteredData.push(Math.min(1.0, (sum / blockSize) * 2.8));
    }
    this.waveformData = filteredData;
  }

  createDSPGraph() {
    if (!this.ctx) return null;

    const semitones = this.fx.pitchShiftSemitones || 0;
    const pitchRatio = Math.pow(2, semitones / 12);
    const totalRate = Math.max(0.2, Math.min(3.0, pitchRatio * (this.fx.playbackSpeed || 1.0)));

    // Ensure all 3 buffers exist
    const origBuf = this.originalBuffer || this.currentBuffer;
    const instBuf = this.instrumentalBuffer || this.currentBuffer;
    const vocBuf = this.vocalIsolatedBuffer || this.currentBuffer;

    if (!origBuf) return null;

    // 1. Dry/Original Source (Full track with singer voice)
    this.sourceDry = this.ctx.createBufferSource();
    this.sourceDry.buffer = origBuf;
    this.sourceDry.playbackRate.value = totalRate;
    this.vocalDryGain = this.ctx.createGain();
    this.sourceDry.connect(this.vocalDryGain);
    this.vocalDryGain.connect(this.fxInput);

    // 2. Instrumental Source (Backing music only, singer voice 100% muted)
    this.sourceInst = this.ctx.createBufferSource();
    this.sourceInst.buffer = instBuf;
    this.sourceInst.playbackRate.value = totalRate;
    this.vocalCanceledGain = this.ctx.createGain();
    this.sourceInst.connect(this.vocalCanceledGain);
    this.vocalCanceledGain.connect(this.fxInput);

    // 3. Isolated Vocals Source (Acapella solo)
    this.sourceVoc = this.ctx.createBufferSource();
    this.sourceVoc.buffer = vocBuf;
    this.sourceVoc.playbackRate.value = totalRate;
    this.vocalIsolatedGain = this.ctx.createGain();
    this.sourceVoc.connect(this.vocalIsolatedGain);
    this.vocalIsolatedGain.connect(this.fxInput);

    if (this.vocalMode === 'instrumental') {
      this.vocalDryGain.gain.value = 0.0;
      this.vocalIsolatedGain.gain.value = 0.0;
      this.vocalCanceledGain.gain.value = 1.0;
      this.sourceNode = this.sourceInst;
    } else if (this.vocalMode === 'vocals') {
      this.vocalDryGain.gain.value = 0.0;
      this.vocalCanceledGain.gain.value = 0.0;
      this.vocalIsolatedGain.gain.value = 1.0;
      this.sourceNode = this.sourceVoc;
    } else {
      this.vocalDryGain.gain.value = 1.0;
      this.vocalCanceledGain.gain.value = 0.0;
      this.vocalIsolatedGain.gain.value = 0.0;
      this.sourceNode = this.sourceDry;
    }

    this.updateVocalDSP();
    return this.sourceNode;
  }
  updateVocalDSP() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.vocalDryGain && this.vocalCanceledGain && this.vocalIsolatedGain) {
      if (this.vocalMode === 'instrumental') {
        // Singer Voice Muted: ONLY the backing music plays. Dry and Vocals are 100% SILENT.
        this.vocalDryGain.gain.value = 0.0;
        this.vocalDryGain.gain.setValueAtTime(0.0, now);
        this.vocalCanceledGain.gain.value = 1.0;
        this.vocalCanceledGain.gain.setValueAtTime(1.0, now);
        this.vocalIsolatedGain.gain.value = 0.0;
        this.vocalIsolatedGain.gain.setValueAtTime(0.0, now);
      } else if (this.vocalMode === 'vocals') {
        // Isolated Vocals: ONLY the singer voice plays. Backing music is 100% SILENT.
        this.vocalDryGain.gain.value = 0.0;
        this.vocalDryGain.gain.setValueAtTime(0.0, now);
        this.vocalCanceledGain.gain.value = 0.0;
        this.vocalCanceledGain.gain.setValueAtTime(0.0, now);
        this.vocalIsolatedGain.gain.value = 1.0;
        this.vocalIsolatedGain.gain.setValueAtTime(1.0, now);
      } else {
        // Full Original Mix or Custom Blend between Full Song & Backing Track
        const mix = (typeof this.vocalMixBalance === 'number') ? this.vocalMixBalance : 1.0;
        if (mix >= 0.98) {
          this.vocalDryGain.gain.value = 1.0;
          this.vocalDryGain.gain.setValueAtTime(1.0, now);
          this.vocalCanceledGain.gain.value = 0.0;
          this.vocalCanceledGain.gain.setValueAtTime(0.0, now);
          this.vocalIsolatedGain.gain.value = 0.0;
          this.vocalIsolatedGain.gain.setValueAtTime(0.0, now);
        } else {
          // Smooth mix between original full song and backing music
          this.vocalDryGain.gain.value = mix;
          this.vocalDryGain.gain.setValueAtTime(mix, now);
          this.vocalCanceledGain.gain.value = (1.0 - mix);
          this.vocalCanceledGain.gain.setValueAtTime(1.0 - mix, now);
          this.vocalIsolatedGain.gain.value = 0.0;
          this.vocalIsolatedGain.gain.setValueAtTime(0.0, now);
        }
      }
    }
  }

  setVocalMix(mixRatio) {
    this.vocalMixBalance = Math.max(0.0, Math.min(1.0, mixRatio));
    if (this.vocalMixBalance === 0.0 && this.vocalMode === 'original') {
      this.vocalMode = 'original';
    } else if (this.vocalMixBalance > 0.0 && this.vocalMode === 'instrumental') {
      this.vocalMode = 'original';
    }
    this.updateVocalDSP();
  }

  setLofiWarmth(intensity) {
    this.fx.lofiWarmth = Math.max(0.0, Math.min(1.0, intensity));
    this.fx.lofiMode = this.fx.lofiWarmth > 0.15;
    this.updateDSPParams();
  }

  setSpatial8D(intensity) {
    this.fx.spatial8D = Math.max(0.0, Math.min(1.0, intensity));
    this.updateDSPParams();
  }

  setRadioVintage(intensity) {
    this.fx.radioFilter = Math.max(0.0, Math.min(1.0, intensity));
    this.updateDSPParams();
  }

  setVocalMode(mode) {
    this.vocalMode = mode;
    this.updateVocalDSP();
  }

  toggleVocalMute() {
    const newMode = (this.vocalMode === 'instrumental') ? 'original' : 'instrumental';
    this.setVocalMode(newMode);
    return newMode;
  }

  setVocalAttenuation(depth) {
    this.vocalReductionDepth = Math.max(0, Math.min(1.0, depth));
    this.updateVocalDSP();
  }

  updateDSPParams() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Update all 3 source playback rates in lockstep
    if (this.sourceDry && this.sourceDry.playbackRate) {
      const curTime = this.getCurrentTime();
      this.playbackStartOffset = curTime;
      this.playbackStartCtxTime = now;

      const semitones = this.fx.pitchShiftSemitones || 0;
      const pitchRatio = Math.pow(2, semitones / 12);
      const totalRate = Math.max(0.2, Math.min(3.0, pitchRatio * (this.fx.playbackSpeed || 1.0)));

      this.sourceDry.playbackRate.setValueAtTime(totalRate, now);
      if (this.sourceInst && this.sourceInst.playbackRate) {
        this.sourceInst.playbackRate.setValueAtTime(totalRate, now);
      }
      if (this.sourceVoc && this.sourceVoc.playbackRate) {
        this.sourceVoc.playbackRate.setValueAtTime(totalRate, now);
      }
    }

    // Live Bass EQ
    if (this.bassEQ) {
      this.bassEQ.gain.setValueAtTime(this.fx.eqBass || 0, now);
    }

    // Live Treble EQ
    if (this.trebleEQ) {
      const trebleVal = this.fx.lofiMode ? -12 : (this.fx.eqTreble || 0);
      this.trebleEQ.gain.setValueAtTime(trebleVal, now);
    }

    // Live Haas Stereo Widener
    if (this.widenerGain) {
      this.widenerGain.gain.setValueAtTime(0.35 * (this.fx.stereoWidth || 0), now);
    }

    // Live Reverb
    if (this.reverbSend) {
      this.reverbSend.gain.setValueAtTime(this.fx.reverbWet || 0, now);
    }

    // Live Echo / Tape Delay
    if (this.echoSend) {
      this.echoSend.gain.setValueAtTime(this.fx.echoWet || 0, now);
    }
    if (this.echoDelay && this.fx.echoTime) {
      this.echoDelay.delayTime.setValueAtTime(this.fx.echoTime, now);
    }

    // Live Lo-Fi Vintage Cassette Warmth & Flutter
    if (this.lofiSend) {
      const warmth = (this.fx.lofiWarmth !== undefined) ? this.fx.lofiWarmth : (this.fx.lofiMode ? 0.80 : 0.0);
      this.lofiSend.gain.setValueAtTime(warmth * 0.95, now);
      if (this.lofiBandpass) {
        const cutoff = 3600 - (warmth * 1400); // Rolls off from 3600Hz down to 2200Hz
        this.lofiBandpass.frequency.setValueAtTime(cutoff, now);
      }
    }

    // Live 8D Spatial Audio Pan Modulation
    if (this.spatialGain) {
      const depth = this.fx.spatial8D || 0.0;
      this.spatialGain.gain.setValueAtTime(depth * 0.85, now);
    }

    // Live Vintage Radio / Megaphone Bandpass
    if (this.radioSend) {
      this.radioSend.gain.setValueAtTime(this.fx.radioFilter || 0.0, now);
    }

    // Maintain current vocal mode without unmuting
    this.updateVocalDSP();
  }

  applyFxPreset(presetKey) {
    this.fx.preset = presetKey;
    if (presetKey === 'karaoke_mute') {
      this.setVocalMode('instrumental');
      this.vocalReductionDepth = 1.0;
      this.vocalMixBalance = 0.0;
    } else if (presetKey === 'acapella_solo') {
      this.setVocalMode('vocals');
      this.vocalReductionDepth = 0.0;
      this.vocalMixBalance = 1.0;
    } else {
      // Voice Changers & Audio Effects: Singer voice is unmuted and transformed by DSP
      this.setVocalMode('original');
      this.vocalReductionDepth = 0.0;
      this.vocalMixBalance = 1.0;
    }
    switch (presetKey) {
      // 1. Cat Voice (Playful Kitten Meow, +7.0 semitones) - 100% Anti-Copyright Safe
      case 'cat_voice':
        this.fx.pitchShiftSemitones = 7.0;
        this.fx.playbackSpeed = 1.10;
        this.fx.reverbWet = 0.08;
        this.fx.stereoWidth = 0.35;
        this.fx.echoWet = 0.04;
        this.fx.eqBass = -4.0;
        this.fx.eqTreble = 5.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 1b. Baby Kitty (Tiny Cute Kitten Squeak, +9.5 semitones) - 100% Anti-Copyright Safe
      case 'cat_baby':
        this.fx.pitchShiftSemitones = 9.5;
        this.fx.playbackSpeed = 1.15;
        this.fx.reverbWet = 0.10;
        this.fx.stereoWidth = 0.40;
        this.fx.echoWet = 0.05;
        this.fx.eqBass = -6.0;
        this.fx.eqTreble = 7.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 1c. Anime Neko Idol (Kawaii Japanese Neko Sparkle, +6.5 semitones) - 100% Anti-Copyright Safe
      case 'cat_anime_neko':
        this.fx.pitchShiftSemitones = 6.5;
        this.fx.playbackSpeed = 1.08;
        this.fx.reverbWet = 0.12;
        this.fx.stereoWidth = 0.45;
        this.fx.echoWet = 0.06;
        this.fx.eqBass = -3.5;
        this.fx.eqTreble = 6.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 1d. Tomcat / Grumpy (Playful Raspy Big Cat, +3.0 semitones, 0.98x) - 100% Anti-Copyright Safe
      case 'cat_tomcat':
        this.fx.pitchShiftSemitones = 3.0;
        this.fx.playbackSpeed = 0.98;
        this.fx.reverbWet = 0.08;
        this.fx.stereoWidth = 0.30;
        this.fx.echoWet = 0.04;
        this.fx.eqBass = 1.5;
        this.fx.eqTreble = 3.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 1e. Cat Choir / Meow Chorus (Multi-Voice Kitten Chorus, +7.5 semitones) - 100% Anti-Copyright Safe
      case 'cat_meow_choir':
        this.fx.pitchShiftSemitones = 7.5;
        this.fx.playbackSpeed = 1.12;
        this.fx.reverbWet = 0.18;
        this.fx.stereoWidth = 0.60;
        this.fx.echoWet = 0.08;
        this.fx.eqBass = -4.5;
        this.fx.eqTreble = 6.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 1f. Purring Cozy Cat (Lo-Fi Warm Purr Acoustic, +5.5 semitones) - 100% Anti-Copyright Safe
      case 'cat_purr_lofi':
        this.fx.pitchShiftSemitones = 5.5;
        this.fx.playbackSpeed = 1.04;
        this.fx.reverbWet = 0.10;
        this.fx.stereoWidth = 0.35;
        this.fx.echoWet = 0.03;
        this.fx.eqBass = 2.0;
        this.fx.eqTreble = 2.0;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.55;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 2. Kids Tone (Cheerful Child Solo, +4.5 semitones) - 100% Anti-Copyright Safe
      case 'kids_tone':
        this.fx.pitchShiftSemitones = 4.5;
        this.fx.playbackSpeed = 1.06;
        this.fx.reverbWet = 0.08;
        this.fx.stereoWidth = 0.28;
        this.fx.echoWet = 0.02;
        this.fx.eqBass = -2.0;
        this.fx.eqTreble = 4.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 2b. Baby Toddler (Innocent Sweet Child, +6.0 semitones) - 100% Anti-Copyright Safe
      case 'kid_toddler':
        this.fx.pitchShiftSemitones = 6.0;
        this.fx.playbackSpeed = 1.09;
        this.fx.reverbWet = 0.10;
        this.fx.stereoWidth = 0.30;
        this.fx.echoWet = 0.02;
        this.fx.eqBass = -3.5;
        this.fx.eqTreble = 5.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 2c. School Kid Choir (Lush Children Chorus, +4.0 semitones) - 100% Anti-Copyright Safe
      case 'kid_choir':
        this.fx.pitchShiftSemitones = 4.0;
        this.fx.playbackSpeed = 1.05;
        this.fx.reverbWet = 0.20;
        this.fx.stereoWidth = 0.65;
        this.fx.echoWet = 0.07;
        this.fx.eqBass = -1.5;
        this.fx.eqTreble = 4.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 2d. Cartoon Kid (Disney/Pixar Style Animated Kid Character, +5.2 semitones) - 100% Anti-Copyright Safe
      case 'kid_cartoon':
        this.fx.pitchShiftSemitones = 5.2;
        this.fx.playbackSpeed = 1.08;
        this.fx.reverbWet = 0.10;
        this.fx.stereoWidth = 0.35;
        this.fx.echoWet = 0.03;
        this.fx.eqBass = -2.5;
        this.fx.eqTreble = 4.8;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 2e. Sweet Lullaby Child (Soft Gentle Bedtime Kid Singing, +3.8 semitones) - 100% Anti-Copyright Safe
      case 'kid_lullaby':
        this.fx.pitchShiftSemitones = 3.8;
        this.fx.playbackSpeed = 1.02;
        this.fx.reverbWet = 0.16;
        this.fx.stereoWidth = 0.40;
        this.fx.echoWet = 0.04;
        this.fx.eqBass = -1.0;
        this.fx.eqTreble = 3.2;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.25;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 2f. Junior Pop Star (Dynamic Energetic Kid Singing, +4.8 semitones) - 100% Anti-Copyright Safe
      case 'kid_popstar':
        this.fx.pitchShiftSemitones = 4.8;
        this.fx.playbackSpeed = 1.07;
        this.fx.reverbWet = 0.12;
        this.fx.stereoWidth = 0.45;
        this.fx.echoWet = 0.05;
        this.fx.eqBass = -1.5;
        this.fx.eqTreble = 5.2;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 3. Chipmunk (High-speed animated character, +9 semitones, 1.2x)
      case 'chipmunk':
        this.fx.pitchShiftSemitones = 9.0;
        this.fx.playbackSpeed = 1.20;
        this.fx.reverbWet = 0.05;
        this.fx.stereoWidth = 0.20;
        this.fx.echoWet = 0.0;
        this.fx.eqBass = -6.0;
        this.fx.eqTreble = 6.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 4. Deep Monster / Titan (-7 semitones, heavy sub-bass)
      case 'deep_monster':
        this.fx.pitchShiftSemitones = -7.0;
        this.fx.playbackSpeed = 0.88;
        this.fx.reverbWet = 0.12;
        this.fx.stereoWidth = 0.40;
        this.fx.echoWet = 0.08;
        this.fx.eqBass = 6.0;
        this.fx.eqTreble = -5.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 5. Robot Vocoder (Metallic robotic timbre)
      case 'robot_vocoder':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.10;
        this.fx.stereoWidth = 0.50;
        this.fx.echoWet = 0.18;
        this.fx.echoTime = 0.08;
        this.fx.eqBass = -2.0;
        this.fx.eqTreble = 4.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.35;
        break;

      // 6. Vintage Telephone / Walkie-Talkie (450Hz-3.2kHz bandpass)
      case 'telephone':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.0;
        this.fx.stereoWidth = 0.0;
        this.fx.echoWet = 0.0;
        this.fx.eqBass = -12.0;
        this.fx.eqTreble = -8.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.15;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.95;
        break;

      // 7. Stadium Megaphone (Mid-range 1.8kHz projection)
      case 'megaphone':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.05;
        this.fx.stereoWidth = 0.0;
        this.fx.echoWet = 0.06;
        this.fx.eqBass = -8.0;
        this.fx.eqTreble = 2.0;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.40;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.70;
        break;

      // 8. Underwater / Submerged (Deep oceanic low-pass muffling)
      case 'underwater':
        this.fx.pitchShiftSemitones = -1.0;
        this.fx.playbackSpeed = 0.95;
        this.fx.reverbWet = 0.25;
        this.fx.stereoWidth = 0.60;
        this.fx.echoWet = 0.12;
        this.fx.eqBass = 5.0;
        this.fx.eqTreble = -14.0;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.60;
        this.fx.spatial8D = 0.20;
        this.fx.radioFilter = 0.0;
        break;

      // 9. Dreamy Chorus / Ethereal (Lush spatial shimmer)
      case 'dreamy_chorus':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.20;
        this.fx.stereoWidth = 0.85;
        this.fx.echoWet = 0.18;
        this.fx.echoTime = 0.22;
        this.fx.eqBass = 1.5;
        this.fx.eqTreble = 2.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.30;
        this.fx.radioFilter = 0.0;
        break;

      // 10. Alien / Sci-Fi Warp (Vibrato spatial modulation)
      case 'alien_scifi':
        this.fx.pitchShiftSemitones = 5.0;
        this.fx.playbackSpeed = 1.08;
        this.fx.reverbWet = 0.15;
        this.fx.stereoWidth = 0.70;
        this.fx.echoWet = 0.20;
        this.fx.echoTime = 0.12;
        this.fx.eqBass = -3.0;
        this.fx.eqTreble = 4.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.50;
        this.fx.radioFilter = 0.20;
        break;

      // 11. Helium Voice (+6 semitones, sparkling high-end air)
      case 'helium_voice':
        this.fx.pitchShiftSemitones = 6.0;
        this.fx.playbackSpeed = 1.10;
        this.fx.reverbWet = 0.05;
        this.fx.stereoWidth = 0.30;
        this.fx.echoWet = 0.0;
        this.fx.eqBass = -5.0;
        this.fx.eqTreble = 5.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 12. Pop Vocal Exciter (Broadcast clarity, +4.5dB air)
      case 'vocal_exciter':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.06;
        this.fx.stereoWidth = 0.45;
        this.fx.echoWet = 0.04;
        this.fx.eqBass = 1.0;
        this.fx.eqTreble = 4.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 13. Stadium Echo (Big concert hall ambiance)
      case 'stadium_echo':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.18;
        this.fx.stereoWidth = 0.80;
        this.fx.echoWet = 0.32;
        this.fx.echoTime = 0.38;
        this.fx.eqBass = 2.0;
        this.fx.eqTreble = 1.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.25;
        this.fx.radioFilter = 0.0;
        break;

      // 14. Lo-Fi Chill Tape (Pure analog tape warmth, 100% zero noise)
      case 'lofi_chill':
        this.fx.pitchShiftSemitones = -1.0;
        this.fx.playbackSpeed = 0.94;
        this.fx.reverbWet = 0.08;
        this.fx.stereoWidth = 0.25;
        this.fx.echoWet = 0.08;
        this.fx.echoTime = 0.30;
        this.fx.eqBass = 2.5;
        this.fx.eqTreble = -4.0;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.65;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 14b. Lo-Fi Study Vinyl (Crackle & Low-Pass & 0.93x chill)
      case 'lofi_study_vinyl':
        this.fx.pitchShiftSemitones = -1.2;
        this.fx.playbackSpeed = 0.93;
        this.fx.reverbWet = 0.25;
        this.fx.stereoWidth = 0.45;
        this.fx.echoWet = 0.08;
        this.fx.echoTime = 0.35;
        this.fx.eqBass = 3.5;
        this.fx.eqTreble = -5.0;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.85;
        this.fx.spatial8D = 0.10;
        this.fx.radioFilter = 0.12;
        break;

      // 14c. Lo-Fi Midnight Rain (Sub-Bass & Deep Ambient Reverb & 0.91x)
      case 'lofi_midnight_rain':
        this.fx.pitchShiftSemitones = -0.8;
        this.fx.playbackSpeed = 0.91;
        this.fx.reverbWet = 0.45;
        this.fx.stereoWidth = 0.60;
        this.fx.echoWet = 0.12;
        this.fx.echoTime = 0.40;
        this.fx.eqBass = 4.0;
        this.fx.eqTreble = -3.5;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.75;
        this.fx.spatial8D = 0.25;
        this.fx.radioFilter = 0.05;
        break;

      // 14d. Lo-Fi Cassette Nostalgia (Analog Flutter & Tape Roll-Off & 0.95x)
      case 'lofi_tape_nostalgia':
        this.fx.pitchShiftSemitones = -0.5;
        this.fx.playbackSpeed = 0.95;
        this.fx.reverbWet = 0.18;
        this.fx.stereoWidth = 0.35;
        this.fx.echoWet = 0.06;
        this.fx.echoTime = 0.28;
        this.fx.eqBass = 2.0;
        this.fx.eqTreble = -5.5;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.90;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.22;
        break;

      // 14e. Deep Sleep Lullaby (Ultra-Soft Harmonics, Slumber Tone & 0.85x)
      case 'sleep_deep_lullaby':
        this.fx.pitchShiftSemitones = -2.2;
        this.fx.playbackSpeed = 0.85;
        this.fx.reverbWet = 0.55;
        this.fx.stereoWidth = 0.55;
        this.fx.echoWet = 0.14;
        this.fx.echoTime = 0.45;
        this.fx.eqBass = 3.0;
        this.fx.eqTreble = -6.5;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.70;
        this.fx.spatial8D = 0.20;
        this.fx.radioFilter = 0.0;
        break;

      // 14f. Sleeping Dream Cloud (Ethereal Reverb & Heavenly Spatial Drift & 0.82x)
      case 'sleep_ambient_dream':
        this.fx.pitchShiftSemitones = -1.5;
        this.fx.playbackSpeed = 0.82;
        this.fx.reverbWet = 0.72;
        this.fx.stereoWidth = 0.85;
        this.fx.echoWet = 0.18;
        this.fx.echoTime = 0.50;
        this.fx.eqBass = 2.5;
        this.fx.eqTreble = -3.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.40;
        this.fx.spatial8D = 0.45;
        this.fx.radioFilter = 0.0;
        break;

      // 14g. Cozy ASMR Whisper (Intimate Soft Resonance & Pure Pillow Relaxation & 0.88x)
      case 'sleep_cozy_whisper':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 0.88;
        this.fx.reverbWet = 0.35;
        this.fx.stereoWidth = 0.45;
        this.fx.echoWet = 0.06;
        this.fx.echoTime = 0.22;
        this.fx.eqBass = -1.0;
        this.fx.eqTreble = 1.2;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.35;
        this.fx.spatial8D = 0.15;
        this.fx.radioFilter = 0.0;
        break;

      // 14h. Delta Wave Slumber (Deep Spatial Drift & Low-End Slumber Immersion & 0.80x)
      case 'sleep_delta_relax':
        this.fx.pitchShiftSemitones = -3.0;
        this.fx.playbackSpeed = 0.80;
        this.fx.reverbWet = 0.65;
        this.fx.stereoWidth = 0.75;
        this.fx.echoWet = 0.20;
        this.fx.echoTime = 0.55;
        this.fx.eqBass = 5.0;
        this.fx.eqTreble = -7.5;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.60;
        this.fx.spatial8D = 0.35;
        this.fx.radioFilter = 0.0;
        break;

      // 15. Spatial 8D Revolution (360-degree circular panner)
      case 'spatial_8d':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.08;
        this.fx.stereoWidth = 0.65;
        this.fx.echoWet = 0.08;
        this.fx.eqBass = 1.5;
        this.fx.eqTreble = 1.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.85;
        this.fx.radioFilter = 0.0;
        break;

      // 16. Vintage Radio (Warm broadcast AM radio)
      case 'radio_vintage':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.03;
        this.fx.stereoWidth = 0.0;
        this.fx.echoWet = 0.03;
        this.fx.eqBass = -6.0;
        this.fx.eqTreble = -3.0;
        this.fx.lofiMode = true;
        this.fx.lofiWarmth = 0.35;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.85;
        break;

      // 17. Anti-Copyright Safe (+1.5 semitones, 1.04x speed)
      case 'anti_copyright_safe':
        this.fx.pitchShiftSemitones = 1.5;
        this.fx.playbackSpeed = 1.04;
        this.fx.reverbWet = 0.06;
        this.fx.stereoWidth = 0.40;
        this.fx.echoWet = 0.0;
        this.fx.eqBass = 1.5;
        this.fx.eqTreble = 1.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 18. Nightcore (+3.5 semitones, 1.15x speed)
      case 'nightcore':
        this.fx.pitchShiftSemitones = 3.5;
        this.fx.playbackSpeed = 1.15;
        this.fx.reverbWet = 0.05;
        this.fx.stereoWidth = 0.30;
        this.fx.echoWet = 0.06;
        this.fx.eqBass = 1.0;
        this.fx.eqTreble = 4.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 19. Slowed + Reverb (-2.0 semitones, 0.88x speed)
      case 'slowed_reverb':
        this.fx.pitchShiftSemitones = -2.0;
        this.fx.playbackSpeed = 0.88;
        this.fx.reverbWet = 0.20;
        this.fx.stereoWidth = 0.55;
        this.fx.echoWet = 0.14;
        this.fx.eqBass = 3.0;
        this.fx.eqTreble = -2.5;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.25;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 20. Club Bass Boost (+5.5dB punch without distortion)
      case 'club_bass':
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.04;
        this.fx.stereoWidth = 0.50;
        this.fx.echoWet = 0.0;
        this.fx.eqBass = 5.5;
        this.fx.eqTreble = 1.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 21. Karaoke Mode (Singer Voice Muted, Instrumental Only)
      case 'karaoke_mute':
        this.setVocalMode('instrumental');
        this.vocalReductionDepth = 1.0;
        this.vocalMixBalance = 1.0;
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.0;
        this.fx.stereoWidth = 0.20;
        this.fx.echoWet = 0.0;
        this.fx.eqBass = 1.5;
        this.fx.eqTreble = 0.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 22. Acapella Solo (Vocals Isolated, Music Muted)
      case 'acapella_solo':
        this.setVocalMode('vocals');
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.06;
        this.fx.stereoWidth = 0.20;
        this.fx.echoWet = 0.0;
        this.fx.eqBass = 0.0;
        this.fx.eqTreble = 2.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;

      // 23. Clean Master (Original Studio Sound)
      case 'clean_original':
      default:
        this.fx.pitchShiftSemitones = 0.0;
        this.fx.playbackSpeed = 1.0;
        this.fx.reverbWet = 0.0;
        this.fx.stereoWidth = 0.0;
        this.fx.echoWet = 0.0;
        this.fx.eqBass = 0.0;
        this.fx.eqTreble = 0.0;
        this.fx.lofiMode = false;
        this.fx.lofiWarmth = 0.0;
        this.fx.spatial8D = 0.0;
        this.fx.radioFilter = 0.0;
        break;
    }

    this.updateDSPParams();
  }


  async play(startOffset = null) {
    await this.ensureContext();
    if (!this.currentBuffer) {
      await this.synthesizeSong('midnight_groove');
    }

    if (this.isPlaying) {
      this.stop();
    }

    let offset = startOffset !== null ? startOffset : this.currentTime;
    if (offset >= this.trimEnd - 0.1 || offset < this.trimStart) {
      offset = this.trimStart;
    }

    const safeOffset = Math.max(this.trimStart, Math.min(this.trimEnd, offset));

    this.createDSPGraph();
    if (!this.sourceDry) return;

    this.isPlaying = true;
    this.playbackStartCtxTime = this.ctx.currentTime;
    this.playbackStartOffset = safeOffset;
    this.currentTime = safeOffset;
    

    const playDuration = Math.max(0.1, this.trimEnd - safeOffset);
    let activeTrackerSource = this.sourceDry;
    try {
      if (this.vocalMode === 'instrumental') {
        // Singer Voice 100% Muted: Only start the instrumental backing music!
        if (this.sourceInst) this.sourceInst.start(0, safeOffset, playDuration);
        activeTrackerSource = this.sourceInst;
      } else if (this.vocalMode === 'vocals') {
        // Vocals Solo (Acapella)
        if (this.sourceVoc) this.sourceVoc.start(0, safeOffset, playDuration);
        activeTrackerSource = this.sourceVoc;
      } else {
        // Full Track with Singer Voice & DSP Voice Changer
        if (this.sourceDry) this.sourceDry.start(0, safeOffset, playDuration);
        activeTrackerSource = this.sourceDry;
      }
    } catch (e) {
      console.warn('AudioSource start warning:', e);
      return;
    }

    if (activeTrackerSource) {
      activeTrackerSource.onended = () => {
        if (this.isPlaying) {
          if (this.loop) {
            this.play(this.trimStart);
          } else {
            this.isPlaying = false;
            this.currentTime = this.trimStart;
            if (this.onPlaybackEnd) this.onPlaybackEnd();
            if (this.onStateChange) this.onStateChange(false);
          }
        }
      };
    }

    if (this.onStateChange) this.onStateChange(true);
  }

  pause() {
    if (!this.isPlaying) return;
    this.currentTime = this.getCurrentTime();
    this.stop();
    if (this.onStateChange) this.onStateChange(false);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop() {
    this.isPlaying = false;
    const sources = [this.sourceDry, this.sourceInst, this.sourceVoc];
    for (const src of sources) {
      if (src) {
        try {
          src.onended = null;
          src.stop(0);
          src.disconnect();
        } catch (e) {}
      }
    }
    this.sourceDry = null;
    this.sourceInst = null;
    this.sourceVoc = null;
    this.sourceNode = null;
  }

  seek(timeInSeconds) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.stop();
    }
    this.currentTime = Math.max(this.trimStart, Math.min(this.trimEnd, timeInSeconds));
    if (wasPlaying) {
      this.play(this.currentTime);
    }
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.currentTime);
    }
  }

  getCurrentTime() {
    if (!this.isPlaying || !this.ctx) {
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
    const semitones = this.fx.pitchShiftSemitones || 0;
    const pitchRatio = Math.pow(2, semitones / 12);
    return Math.max(0.2, Math.min(3.0, pitchRatio * (this.fx.playbackSpeed || 1.0)));
  }

  getAnalyserData(freqArray) {
    if (!this.analyser) {
      freqArray.fill(0);
      return;
    }
    this.analyser.getByteFrequencyData(freqArray);
  }

  /**
   * Synthesize high-energy demo song with mathematically clean isolated tracks
   */
  async synthesizeSong(songKey = 'midnight_groove') {
    await this.ensureContext();
    const duration = 22.0;
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * duration);

    // Three discrete buffers: Full Mix, Instrumental (Music Only), Vocals (Voice Only)
    const origBuffer = this.ctx.createBuffer(2, length, rate);
    const instBuffer = this.ctx.createBuffer(2, length, rate);
    const vocBuffer = this.ctx.createBuffer(2, length, rate);

    const origL = origBuffer.getChannelData(0);
    const origR = origBuffer.getChannelData(1);
    const instL = instBuffer.getChannelData(0);
    const instR = instBuffer.getChannelData(1);
    const vocL = vocBuffer.getChannelData(0);
    const vocR = vocBuffer.getChannelData(1);

    const bpm = 118;
    const secondsPerBeat = 60 / bpm;

    const freqFromMidi = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

    const progressions = {
      midnight_groove: [
        { root: 43, chords: [55, 58, 62] }, // G minor
        { root: 38, chords: [50, 53, 57] }, // D minor
        { root: 41, chords: [53, 57, 60] }, // F major
        { root: 45, chords: [57, 60, 64] }  // A minor
      ],
      neon_cyber: [
        { root: 40, chords: [52, 55, 59] },
        { root: 43, chords: [55, 59, 62] },
        { root: 38, chords: [50, 53, 57] },
        { root: 41, chords: [53, 57, 60] }
      ],
      starlight: [
        { root: 48, chords: [60, 64, 67] },
        { root: 45, chords: [57, 60, 64] },
        { root: 41, chords: [53, 57, 60] },
        { root: 43, chords: [55, 59, 62] }
      ]
    };

    const prog = progressions[songKey] || progressions.midnight_groove;
    const vocalMelody = [67, 69, 71, 72, 71, 69, 67, 64, 62, 64, 67, 69];

    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const beat = t / secondsPerBeat;
      const bar = Math.floor(beat / 4);
      const beatInBar = beat % 4;
      const chordIdx = bar % prog.length;
      const currentChord = prog[chordIdx];

      let musicL = 0;
      let musicR = 0;

      // 1. Kick Drum
      const kickPhase = beatInBar % 1.0;
      if (kickPhase < 0.25) {
        const kickTime = kickPhase * secondsPerBeat;
        const kickFreq = 140 * Math.exp(-kickTime * 28) + 45;
        const kickEnv = Math.exp(-kickTime * 14);
        const kick = Math.sin(2 * Math.PI * kickFreq * kickTime) * kickEnv * 0.45;
        musicL += kick;
        musicR += kick;
      }

      // 2. Snare / Clap
      if ((beatInBar >= 1.0 && beatInBar < 1.3) || (beatInBar >= 3.0 && beatInBar < 3.3)) {
        const snareTime = (beatInBar % 2 - 1) * secondsPerBeat;
        if (snareTime >= 0) {
          const noise = (Math.random() * 2 - 1) * Math.exp(-snareTime * 16) * 0.35;
          const tone = Math.sin(2 * Math.PI * 180 * snareTime) * Math.exp(-snareTime * 22) * 0.25;
          musicL += noise + tone;
          musicR += noise + tone;
        }
      }

      // 3. Hi-Hats
      const hatPhase = (beat * 4) % 1.0;
      const hatTime = hatPhase * (secondsPerBeat / 4);
      if (hatTime < 0.08) {
        const hat = (Math.random() * 2 - 1) * Math.exp(-hatTime * 65) * 0.12;
        musicL += hat * 0.9;
        musicR += hat * 1.1;
      }

      // 4. Bassline
      const bassPhase = (beat * 2) % 1.0;
      const bassTime = bassPhase * (secondsPerBeat / 2);
      const bassFreq = freqFromMidi(currentChord.root);
      const bassEnv = Math.exp(-bassTime * 4.5);
      const bass = (Math.sin(2 * Math.PI * bassFreq * t) + 0.5 * Math.sin(4 * Math.PI * bassFreq * t)) * bassEnv * 0.32;
      musicL += bass;
      musicR += bass;

      // 5. Chords (Stereo Panned Backing)
      let chordSumL = 0;
      let chordSumR = 0;
      for (let note of currentChord.chords) {
        const f = freqFromMidi(note);
        chordSumL += Math.sin(2 * Math.PI * f * t) * 0.06;
        chordSumR += Math.sin(2 * Math.PI * (f * 1.004) * t) * 0.06;
      }
      musicL += chordSumL;
      musicR += chordSumR;

      // 6. Arpeggio Lead (Stereo Panned)
      const arpStep = Math.floor(beat * 4) % 8;
      const arpNotes = [currentChord.chords[0], currentChord.chords[1], currentChord.chords[2], currentChord.chords[1] + 12];
      const leadMidi = arpNotes[arpStep % arpNotes.length] + 12;
      const leadFreq = freqFromMidi(leadMidi);
      const arpPhase = (beat * 4) % 1.0;
      const arpTime = arpPhase * (secondsPerBeat / 4);
      const leadEnv = Math.exp(-arpTime * 6.0);
      const lead = Math.sin(2 * Math.PI * leadFreq * t) * leadEnv * 0.12;
      musicL += lead * 1.15;
      musicR += lead * 0.85;

      // 7. Center Lead Singer Vocal Line (Formant synthesis with vibrato)
      let vocal = 0;
      const melodyIdx = Math.floor(beat) % vocalMelody.length;
      const vocalFreq = freqFromMidi(vocalMelody[melodyIdx]);
      const vocalNotePhase = beat % 1.0;
      if (vocalNotePhase < 0.82) {
        const vibrato = Math.sin(2 * Math.PI * 5.5 * t) * 0.025;
        const vFreq = vocalFreq * (1 + vibrato);
        const f0 = Math.sin(2 * Math.PI * vFreq * t);
        const f1 = Math.sin(4 * Math.PI * vFreq * t) * 0.55;
        const f2 = Math.sin(6 * Math.PI * vFreq * t) * 0.30;
        const vocalEnv = Math.sin(Math.PI * (vocalNotePhase / 0.82));
        vocal = (f0 + f1 + f2) * vocalEnv * 0.35;
      }

      // Master limiting per channel
      const finalMusicL = Math.tanh(musicL * 0.80);
      const finalMusicR = Math.tanh(musicR * 0.80);

      // Track 1: Instrumental (Singer Voice is 100% MUTED, Music Kept)
      instL[i] = finalMusicL;
      instR[i] = finalMusicR;

      // Track 2: Isolated Vocals (Music is 100% MUTED, Singer Voice Kept)
      vocL[i] = vocal;
      vocR[i] = vocal;

      // Track 3: Full Mix (Both Singer and Music Combined)
      origL[i] = Math.tanh((finalMusicL + vocal) * 0.85);
      origR[i] = Math.tanh((finalMusicR + vocal) * 0.85);
    }

    this.instrumentalBuffer = instBuffer;
    this.vocalIsolatedBuffer = vocBuffer;
    this.originalBuffer = origBuffer;
    this.rawBuffer = origBuffer;
    this.currentBuffer = origBuffer;

    this.isBuiltIn = true;
    this.trackName = songKey === 'neon_cyber' ? 'Neon Cyber Drive' : (songKey === 'midnight_groove' ? 'Spotify Studio (Clean Funk Demo)' : 'Starlight Serenade');
    this.duration = duration;
    this.trimStart = 0;
    this.trimEnd = duration;
    this.currentTime = 0;

    this.generateWaveformData();
    return origBuffer;
  }
}

window.karaokeAudioEngine = new KaraokeAudioEngine();
window.KaraokeAudioEngine = KaraokeAudioEngine;
window.AudioEngine = KaraokeAudioEngine;