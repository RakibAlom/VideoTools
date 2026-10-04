/**
 * AudioEngine - Web Audio API Synthesis, Custom File Trimmer, Waveform Visualizer, and Video Recording Stream Mixer
 * Generates 6 distinct copyright-free soundtracks on the fly.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.activeSource = null;
    this.gainNode = null;
    this.mediaStreamDest = null;
    this.carrierOsc = null;

    this.currentBuffer = null;
    this.currentTrackName = 'Quack Hop';
    this.isSynthesized = true;

    // Trimming & properties
    this.trimStart = 0;
    this.trimEnd = 15;
    this.duration = 15;
    this.volume = 0.8;
    this.fadeIn = false;
    this.fadeOut = false;
    this.isPlaying = false;
    this.playbackStartTime = 0;

    // Waveform data cache
    this.waveformData = [];
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.ctx.destination);

      // Create stream destination for video recording
      this.mediaStreamDest = this.ctx.createMediaStreamDestination();
      this.gainNode.connect(this.mediaStreamDest);

      // Inaudible carrier oscillator to keep MediaRecorder audio track active in Chromium
      this.carrierOsc = this.ctx.createOscillator();
      const carrierGain = this.ctx.createGain();
      carrierGain.gain.value = 0.00002;
      this.carrierOsc.frequency.value = 60;
      this.carrierOsc.connect(carrierGain);
      carrierGain.connect(this.mediaStreamDest);
      this.carrierOsc.start();
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
      } catch (e) {
        console.warn('Audio destination track refresh notice:', e);
      }
    }
    return (this.mediaStreamDest && this.mediaStreamDest.stream) ? this.mediaStreamDest.stream.getAudioTracks()[0] : null;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1.5, val));
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  async loadFromFile(file) {
    this.ensureContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
    this.setBuffer(audioBuffer, file.name, false);

    // Save to IndexedDB for permanent storage
    if (window.storageManager) {
      window.storageManager.saveItem('audio', {
        id: `audio_${Date.now()}`,
        name: file.name,
        date: new Date().toLocaleDateString(),
        data: arrayBuffer
      });
    }

    return audioBuffer;
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

  play(offsetSeconds = 0, loop = false) {
    this.ensureContext();
    this.stop();

    if (!this.currentBuffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.currentBuffer;

    const now = this.ctx.currentTime;
    const playLen = Math.max(0.1, this.trimEnd - this.trimStart);

    this.gainNode.gain.cancelScheduledValues(now);
    if (this.fadeIn) {
      this.gainNode.gain.setValueAtTime(0, now);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 1.2);
    } else {
      this.gainNode.gain.setValueAtTime(this.volume, now);
    }

    if (this.fadeOut) {
      this.gainNode.gain.setValueAtTime(this.volume, now + playLen - 1.2);
      this.gainNode.gain.linearRampToValueAtTime(0, now + playLen);
    }

    source.connect(this.gainNode);

    if (loop) {
      source.loop = true;
      source.loopStart = this.trimStart;
      source.loopEnd = this.trimEnd;
      const actualStart = this.trimStart + (offsetSeconds % playLen);
      source.start(0, actualStart);
    } else {
      const actualStart = this.trimStart + (offsetSeconds % playLen);
      const remaining = playLen - (offsetSeconds % playLen);
      source.start(0, actualStart, remaining);
    }
    this.activeSource = source;
    this.isPlaying = true;
    this.playbackStartTime = this.ctx.currentTime - (offsetSeconds % playLen);

    source.onended = () => {
      if (this.activeSource === source) {
        this.isPlaying = false;
        this.activeSource = null;
      }
    };
  }

  stop() {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch (e) {}
      this.activeSource = null;
    }
    this.isPlaying = false;
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
      source.connect(this.gainNode);
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
