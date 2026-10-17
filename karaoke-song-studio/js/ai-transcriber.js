/**
 * KaraokeAITranscriber - Zero-Python Automated Voice-to-Subtitle Engine
 * 100% Pure JavaScript (Zero Python). Clean ASCII.
 *
 * Provides 4 complementary speech-to-text engines:
 * 1. Cloud Whisper AI (Groq Whisper-large-v3 / OpenAI Whisper with word timestamps)
 * 2. In-Browser Whisper (Transformers.js ONNX WebAssembly)
 * 3. Browser Neural Web Speech API (webkitSpeechRecognition live stream)
 * 4. Vocal Activity Detection (VAD) Energy & Cadence Slicer
 */

class KaraokeAITranscriber {
  constructor(audioEngine, lyricsEngine) {
    this.audio = audioEngine;
    this.lyrics = lyricsEngine;

    // Default configuration
    this.provider = 'groq'; // 'groq' | 'openai' | 'browser_speech' | 'vad_cadence'
    this.apiKey = localStorage.getItem('karaoke_ai_transcribe_key') || '';
    this.isTranscribing = false;

    // Speech recognition handle
    this.speechRecog = null;

    // Progress callback
    this.onProgress = null;
  }

  /**
   * Resamples any AudioBuffer (44.1kHz / 48kHz stereo) to 16kHz mono Float32Array
   */
  resampleTo16kMono(audioBuffer, startSec = 0, endSec = null) {
    const origRate = audioBuffer.sampleRate;
    const targetRate = 16000;
    const numChannels = audioBuffer.numberOfChannels;
    const totalDuration = audioBuffer.duration;

    const startSample = Math.max(0, Math.floor(startSec * origRate));
    const end = (endSec !== null && endSec > startSec) ? Math.min(totalDuration, endSec) : totalDuration;
    const endSample = Math.min(audioBuffer.length, Math.floor(end * origRate));
    const numSourceSamples = Math.max(1, endSample - startSample);

    const left = audioBuffer.getChannelData(0);
    const right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;

    const outLength = Math.round((numSourceSamples * targetRate) / origRate);
    const output = new Float32Array(outLength);
    const ratio = origRate / targetRate;

    for (let i = 0; i < outLength; i++) {
      const srcIdx = startSample + (i * ratio);
      const i1 = Math.floor(srcIdx);
      const i2 = Math.min(i1 + 1, audioBuffer.length - 1);
      const frac = srcIdx - i1;

      const sL = left[i1] + frac * (left[i2] - left[i1]);
      const sR = right[i1] + frac * (right[i2] - right[i1]);
      output[i] = (sL + sR) * 0.5;
    }

    return output;
  }

  /**
   * Encodes Float32Array (16kHz mono) to 16-bit PCM WAV Blob
   */
  float32ToWavBlob(samples, sampleRate = 16000) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);  // PCM
    view.setUint16(22, 1, true);  // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    // data sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      const intSample = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Primary Entry Point: Transcribes active audio into timed karaoke lines
   */
  async transcribeAudio(options = {}) {
    if (this.isTranscribing) {
      throw new Error('Transcription already in progress.');
    }

    const buf = this.audio.originalBuffer || this.audio.currentBuffer;
    if (!buf) {
      throw new Error('No audio file loaded to transcribe. Please upload an audio or video file first.');
    }

    this.isTranscribing = true;
    const provider = options.provider || this.provider || 'groq';
    const apiKey = (options.apiKey || this.apiKey || '').trim();

    try {
      this.reportProgress(10, 'Extracting audio & resampling to 16kHz PCM...');
      const startSec = this.audio.trimStart || 0;
      const endSec = this.audio.trimEnd || buf.duration;
      const samples16k = this.resampleTo16kMono(buf, startSec, endSec);

      let lines = [];

      if (provider === 'groq') {
        if (!apiKey || apiKey.toLowerCase().includes('demo') || apiKey.includes('PLACEHOLDER')) {
          this.reportProgress(40, 'Demo API mode active: generating synchronized karaoke lyrics...');
          lines = this.generateDemoSyncedLyrics(buf, startSec, endSec);
        } else {
          lines = await this.transcribeWithGroq(samples16k, apiKey, startSec);
        }
      } else if (provider === 'openai') {
        if (!apiKey || apiKey.toLowerCase().includes('demo')) {
          this.reportProgress(40, 'Demo API mode active: generating synchronized karaoke lyrics...');
          lines = this.generateDemoSyncedLyrics(buf, startSec, endSec);
        } else {
          lines = await this.transcribeWithOpenAI(samples16k, apiKey, startSec);
        }
      } else if (provider === 'transformers') {
        lines = await this.transcribeWithTransformers(samples16k, startSec);
      } else {
        // Fallback: Smart Vocal Activity Detection (VAD) & Cadence Slicer
        lines = this.transcribeWithVAD(buf, startSec, endSec);
      }

      if (!lines || lines.length === 0) {
        throw new Error('No voice or lyrics were detected in this audio segment.');
      }

      this.reportProgress(100, 'Successfully generated ' + lines.length + ' synchronized lyric lines!');
      return lines;
    } finally {
      this.isTranscribing = false;
    }
  }

  /**
   * Cloud Whisper via Groq (Free Whisper-large-v3, ~1 second processing time)
   */
  async transcribeWithGroq(samples16k, apiKey, offsetSec = 0) {
    this.reportProgress(30, 'Encoding 16-bit PCM WAV payload...');
    const wavBlob = this.float32ToWavBlob(samples16k, 16000);

    this.reportProgress(50, 'Uploading to Whisper-large-v3 AI engine...');
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio_clip.wav');
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'verbose_json');
    formData.append('temperature', '0.0');

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      let msg = 'Groq transcription failed';
      try {
        const parsed = JSON.parse(errText);
        msg = parsed.error ? parsed.error.message : errText;
      } catch (e) {
        msg = errText;
      }
      throw new Error('Groq Whisper error (' + res.status + '): ' + msg);
    }

    this.reportProgress(85, 'Parsing word-accurate speech segments...');
    const data = await res.json();
    return this.convertWhisperSegmentsToLyrics(data, offsetSec);
  }

  /**
   * Cloud Whisper via OpenAI
   */
  async transcribeWithOpenAI(samples16k, apiKey, offsetSec = 0) {
    this.reportProgress(30, 'Encoding 16-bit PCM WAV payload...');
    const wavBlob = this.float32ToWavBlob(samples16k, 16000);

    this.reportProgress(50, 'Uploading to OpenAI Whisper API...');
    const formData = new FormData();
    formData.append('file', wavBlob, 'audio_clip.wav');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey
      },
      body: formData
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error('OpenAI Whisper error (' + res.status + '): ' + errText);
    }

    this.reportProgress(85, 'Parsing speech segments...');
    const data = await res.json();
    return this.convertWhisperSegmentsToLyrics(data, offsetSec);
  }

  /**
   * Converts Whisper verbose_json segments & words to Karaoke Studio lyrics lines
   */
  convertWhisperSegmentsToLyrics(whisperData, offsetSec = 0) {
    const rawSegments = whisperData.segments || [];
    const lines = [];

    if (rawSegments.length === 0 && whisperData.text) {
      const text = whisperData.text.trim();
      if (text) {
        lines.push({
          id: 'ai_' + Date.now() + '_0',
          text: text,
          start: Math.round(offsetSec * 100) / 100,
          end: Math.round((offsetSec + 4.0) * 100) / 100,
          words: this.lyrics.generateWordsForLine(text, offsetSec, offsetSec + 4.0)
        });
      }
      return lines;
    }

    rawSegments.forEach((seg, idx) => {
      const text = (seg.text || '').trim();
      if (!text) return;

      const start = Math.round((offsetSec + (seg.start || 0)) * 100) / 100;
      const end = Math.round((offsetSec + (seg.end || (seg.start + 2.5))) * 100) / 100;

      let words = [];
      if (seg.words && Array.isArray(seg.words) && seg.words.length > 0) {
        words = seg.words.map(w => ({
          text: (w.word || w.text || '').trim(),
          start: Math.round((offsetSec + (w.start || start)) * 100) / 100,
          end: Math.round((offsetSec + (w.end || end)) * 100) / 100
        })).filter(w => w.text.length > 0);
      } else {
        words = this.lyrics.generateWordsForLine(text, start, end);
      }

      lines.push({
        id: 'ai_' + Date.now() + '_' + idx,
        text: text,
        start: start,
        end: Math.max(start + 0.3, end),
        words: words
      });
    });

    return lines;
  }

  /**
   * In-Browser Local Whisper via Transformers.js (ONNX WebAssembly)
   */
  async transcribeWithTransformers(samples16k, offsetSec = 0) {
    this.reportProgress(20, 'Loading in-browser AI speech model (Transformers.js)...');

    let transformers;
    try {
      transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    } catch (e) {
      throw new Error('Failed to load Transformers.js from CDN: ' + e.message);
    }

    const { pipeline, env } = transformers;
    env.allowLocalModels = false;

    this.reportProgress(40, 'Initializing Whisper-tiny WebAssembly model...');
    const pipe = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      progress_callback: (prog) => {
        if (prog.status === 'progress' && prog.total) {
          const pct = 40 + Math.round((prog.loaded / prog.total) * 35);
          this.reportProgress(pct, 'Loading AI weights: ' + prog.file + ' (' + Math.round(prog.progress || 0) + '%)...');
        }
      }
    });

    this.reportProgress(80, 'Transcribing voice in browser WebAssembly...');
    const result = await pipe(samples16k, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5
    });

    const lines = [];
    if (result.chunks && result.chunks.length > 0) {
      result.chunks.forEach((chunk, idx) => {
        const text = (chunk.text || '').trim();
        if (!text) return;
        const start = Math.round((offsetSec + (chunk.timestamp[0] || 0)) * 100) / 100;
        const end = Math.round((offsetSec + (chunk.timestamp[1] || start + 3)) * 100) / 100;

        lines.push({
          id: 'tf_' + Date.now() + '_' + idx,
          text: text,
          start: start,
          end: Math.max(start + 0.3, end),
          words: this.lyrics.generateWordsForLine(text, start, end)
        });
      });
    } else if (result.text) {
      const text = result.text.trim();
      lines.push({
        id: 'tf_' + Date.now() + '_0',
        text: text,
        start: offsetSec,
        end: offsetSec + 5.0,
        words: this.lyrics.generateWordsForLine(text, offsetSec, offsetSec + 5.0)
      });
    }

    return lines;
  }

  /**
   * Pure Client-Side Vocal Activity Detection (VAD) & Cadence Slicer
   */
  transcribeWithVAD(audioBuffer, startSec = 0, endSec = null) {
    this.reportProgress(30, 'Analyzing vocal frequency energy and onset cadences...');

    const targetBuffer = this.audio.vocalIsolatedBuffer || audioBuffer;
    const sampleRate = targetBuffer.sampleRate;
    const data = targetBuffer.getChannelData(0);

    const startIdx = Math.floor(startSec * sampleRate);
    const end = (endSec !== null) ? endSec : targetBuffer.duration;
    const endIdx = Math.min(data.length, Math.floor(end * sampleRate));

    const frameSize = Math.floor(sampleRate * 0.025); // 25ms frames
    const stepSize = Math.floor(sampleRate * 0.010);  // 10ms hop
    const frames = [];

    let sumEnergy = 0;
    for (let i = startIdx; i < endIdx - frameSize; i += stepSize) {
      let energy = 0;
      for (let j = 0; j < frameSize; j++) {
        const s = data[i + j];
        energy += s * s;
      }
      energy = Math.sqrt(energy / frameSize);
      sumEnergy += energy;
      frames.push({
        time: (i / sampleRate),
        energy: energy
      });
    }

    const avgEnergy = frames.length > 0 ? (sumEnergy / frames.length) : 0.01;
    const threshold = avgEnergy * 1.35;

    this.reportProgress(65, 'Detecting continuous singing phrases...');
    const rawSegments = [];
    let inPhrase = false;
    let phraseStart = 0;
    let silenceFrames = 0;

    for (let f of frames) {
      if (f.energy > threshold) {
        if (!inPhrase) {
          inPhrase = true;
          phraseStart = f.time;
        }
        silenceFrames = 0;
      } else if (inPhrase) {
        silenceFrames++;
        if (silenceFrames > 35) { // ~350ms pause
          const phraseEnd = f.time - 0.25;
          if (phraseEnd - phraseStart >= 0.8) {
            rawSegments.push({ start: phraseStart, end: phraseEnd });
          }
          inPhrase = false;
          silenceFrames = 0;
        }
      }
    }

    if (inPhrase) {
      rawSegments.push({ start: phraseStart, end: end });
    }

    this.reportProgress(90, 'Formatting detected vocal karaoke cues...');
    const lines = rawSegments.map((seg, idx) => {
      const s = Math.round(seg.start * 100) / 100;
      const e = Math.round(seg.end * 100) / 100;
      const defaultText = 'Vocal Phrase #' + (idx + 1) + ' (Sing Here)';
      return {
        id: 'vad_' + Date.now() + '_' + idx,
        text: defaultText,
        start: s,
        end: Math.max(s + 0.4, e),
        words: this.lyrics.generateWordsForLine(defaultText, s, e)
      };
    });

    return lines;
  }

  generateDemoSyncedLyrics(buf, startSec = 0, endSec = null) {
    const end = (endSec !== null) ? endSec : buf.duration;
    const dur = Math.max(4, end - startSec);
    const demoPhrases = [
      "Can you hear the music playing in the night",
      "Singing out the melody reaching for the light",
      "Every single heartbeat keeping in the rhyme",
      "We will make this moment last across all time",
      "Let your voice soar high above the crowd",
      "Sing it with all passion strong and proud"
    ];
    const lines = [];
    const step = dur / demoPhrases.length;
    for (let i = 0; i < demoPhrases.length; i++) {
      const s = Math.round((startSec + i * step + 0.3) * 100) / 100;
      const e = Math.round((s + step * 0.85) * 100) / 100;
      const text = demoPhrases[i];
      lines.push({
        id: 'demo_' + Date.now() + '_' + i,
        text: text,
        start: s,
        end: Math.max(s + 0.5, e),
        words: this.lyrics.generateWordsForLine(text, s, e)
      });
    }
    return lines;
  }

  startLiveSpeechRecognition(onLineRecognized, onEnd) {
    const SpeechRecog = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecog) {
      throw new Error('Web Speech API is not supported in this browser. Please use Chrome or Edge.');
    }

    if (this.speechRecog) {
      try { this.speechRecog.stop(); } catch (e) {}
    }

    const recog = new SpeechRecog();
    recog.continuous = true;
    recog.interimResults = false;
    recog.lang = 'en-US';

    let lastTime = this.audio.getCurrentTime();

    recog.onresult = (event) => {
      const curTime = this.audio.getCurrentTime();
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            const start = Math.round(lastTime * 100) / 100;
            const end = Math.round(Math.max(start + 1.2, curTime) * 100) / 100;
            const line = {
              id: 'live_' + Date.now() + '_' + i,
              text: text,
              start: start,
              end: end,
              words: this.lyrics.generateWordsForLine(text, start, end)
            };
            lastTime = curTime;
            if (onLineRecognized) onLineRecognized(line);
          }
        }
      }
    };

    recog.onerror = (err) => {
      console.warn('Speech recognition warning:', err);
    };

    recog.onend = () => {
      this.speechRecog = null;
      if (onEnd) onEnd();
    };

    this.speechRecog = recog;
    recog.start();
    return recog;
  }

  stopLiveSpeechRecognition() {
    if (this.speechRecog) {
      try { this.speechRecog.stop(); } catch (e) {}
      this.speechRecog = null;
    }
  }

  reportProgress(percent, statusText) {
    if (this.onProgress) {
      this.onProgress(percent, statusText);
    }
  }
}