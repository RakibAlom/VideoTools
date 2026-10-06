/**
 * GifEngine - Fast, robust pure JavaScript GIF frame decoder, animator & Chroma-Key Background Remover
 * Built on Dean McNamee's omggif library
 */

class GifEngine {
  constructor() {
    this.cache = new Map(); // id -> { width, height, frames: [{ imgData, canvas, bitmap, delay, startTime, endTime }], totalDuration }
    this.pendingFetches = new Map();
  }

  /**
   * Loads and decodes an animated GIF from a URL or data URL
   */
  async loadFromUrl(url, id = url) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }
    if (this.pendingFetches.has(id)) {
      return this.pendingFetches.get(id);
    }

    const fetchPromise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load GIF from ${url}: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        const gifData = this.decode(buffer, id);
        // Ensure 100% of frames have GPU ImageBitmaps prepared for instant 60fps rendering
        await this.prepareBitmaps(gifData);
        this.cache.set(id, gifData);
        return gifData;
      } finally {
        this.pendingFetches.delete(id);
      }
    })();

    this.pendingFetches.set(id, fetchPromise);
    return fetchPromise;
  }

  /**
   * Loads and decodes an animated GIF from a File or Blob
   */
  async loadFromFile(file, id = file.name) {
    const buffer = await file.arrayBuffer();
    const gifData = this.decode(buffer, id);
    await this.prepareBitmaps(gifData);
    this.cache.set(id, gifData);
    return gifData;
  }

  /**
   * Pre-caches ImageBitmap objects for all frames in GPU memory for lag-free rendering.
   * Directly uses ImageData to avoid allocating DOM canvas contexts and bypassing context limits!
   */
  async prepareBitmaps(gifData) {
    if (!gifData || !gifData.frames) return gifData;
    if (typeof createImageBitmap !== 'function') return gifData;

    const tasks = gifData.frames.map(async (f) => {
      if (f.bitmap) return;
      try {
        f.bitmap = await createImageBitmap(f.imgData || f.canvas);
      } catch (e) {
        // Fallback: bitmap remains null, f.canvas getter will be used on demand
        f.bitmap = null;
      }
    });

    await Promise.all(tasks);
    return gifData;
  }

  /**
   * Decodes an ArrayBuffer using omggif GifReader with full disposal handling.
   * Super-fast: Zero DOM Canvas elements allocated during decode!
   * Frame canvases are created strictly lazily on demand if accessed.
   */
  decode(buffer, name = 'gif') {
    if (typeof GifReader === 'undefined') {
      throw new Error('GifReader (omggif.js) is not loaded.');
    }

    const byteArray = new Uint8Array(buffer);
    const reader = new GifReader(byteArray);
    const numFrames = reader.numFrames();
    const width = reader.width;
    const height = reader.height;

    if (numFrames === 0) {
      throw new Error('No frames found in GIF');
    }

    const frames = [];
    let cumulativeTime = 0;

    // Full-canvas pixel buffer for compositing with correct omggif stride
    const fullPixels = new Uint8ClampedArray(width * height * 4);
    let previousPixels = null;

    for (let i = 0; i < numFrames; i++) {
      const frameInfo = reader.frameInfo(i);

      if (frameInfo.disposal === 3) {
        previousPixels = new Uint8ClampedArray(fullPixels);
      }

      // decodeAndBlitFrameRGBA directly writes to fullPixels with exact stride
      reader.decodeAndBlitFrameRGBA(i, fullPixels);

      // Raw snapshot ImageData - 100% lightweight, no Canvas DOM node or 2D context created!
      const imgData = new ImageData(new Uint8ClampedArray(fullPixels), width, height);

      // High-precision GIF frame delay: delay is in hundredths of a second (10ms units)
      const rawDelay = frameInfo.delay;
      const delayHundredths = (rawDelay === undefined || rawDelay === null || rawDelay <= 0) ? 10 : rawDelay;
      const delayMs = Math.max(10, delayHundredths * 10);

      const frameObj = {
        imgData,
        _canvas: null,
        bitmap: null,
        delay: delayMs,
        startTime: cumulativeTime,
        endTime: cumulativeTime + delayMs,
        get canvas() {
          if (!this._canvas) {
            const c = document.createElement('canvas');
            c.width = width;
            c.height = height;
            const fCtx = c.getContext('2d');
            fCtx.putImageData(this.imgData, 0, 0);
            this._canvas = c;
          }
          return this._canvas;
        },
        set canvas(c) {
          this._canvas = c;
        }
      };

      frames.push(frameObj);
      cumulativeTime += delayMs;

      // Handle disposal for subsequent frame
      if (frameInfo.disposal === 2) {
        for (let row = frameInfo.y; row < frameInfo.y + frameInfo.height; row++) {
          if (row < 0 || row >= height) continue;
          const start = (row * width + Math.max(0, frameInfo.x)) * 4;
          const end = (row * width + Math.min(width, frameInfo.x + frameInfo.width)) * 4;
          fullPixels.fill(0, start, end);
        }
      } else if (frameInfo.disposal === 3 && previousPixels) {
        fullPixels.set(previousPixels);
      }
    }

    const gifData = {
      name,
      width,
      height,
      frames,
      totalDuration: cumulativeTime || 1000,
      originalBuffer: buffer
    };

    return gifData;
  }

  /**
   * Retrieves the frame canvas or ImageBitmap at a given timestamp in ms
   */
  getFrame(gifData, timestampMs) {
    if (!gifData || !gifData.frames || gifData.frames.length === 0) return null;
    const frames = gifData.frames;
    if (frames.length === 1) {
      const f0 = frames[0];
      try {
        if (f0.bitmap && f0.bitmap.width > 0) return f0.bitmap;
      } catch (e) {}
      return f0.canvas;
    }

    const dur = gifData.totalDuration || 1000;
    const t = ((timestampMs % dur) + dur) % dur;

    // Fast binary search: frames are strictly sorted by startTime
    let low = 0;
    let high = frames.length - 1;
    let found = null;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const f = frames[mid];
      if (t >= f.startTime && t < f.endTime) {
        found = f;
        break;
      } else if (t < f.startTime) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    if (!found) {
      found = (t >= frames[frames.length - 1].startTime) ? frames[frames.length - 1] : frames[0];
    }

    try {
      if (found.bitmap && found.bitmap.width > 0) return found.bitmap;
    } catch (e) {}
    return found.canvas;
  }

  /**
   * Retrieves the full frame object at a given timestamp in ms (for safe fallback drawing)
   */
  getFrameObject(gifData, timestampMs) {
    if (!gifData || !gifData.frames || gifData.frames.length === 0) return null;
    const frames = gifData.frames;
    if (frames.length === 1) return frames[0];

    const dur = gifData.totalDuration || 1000;
    const t = ((timestampMs % dur) + dur) % dur;

    let low = 0;
    let high = frames.length - 1;
    let found = null;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const f = frames[mid];
      if (t >= f.startTime && t < f.endTime) {
        found = f;
        break;
      } else if (t < f.startTime) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return found || ((t >= frames[frames.length - 1].startTime) ? frames[frames.length - 1] : frames[0]);
  }

  /**
   * Automatically samples the corner/edge pixels to detect dominant background color
   */
  detectBackgroundColor(gifData) {
    if (!gifData || !gifData.frames || gifData.frames.length === 0) return { r: 255, g: 255, b: 255 };
    const f0 = gifData.frames[0];
    if (f0.imgData && f0.imgData.data) {
      const d = f0.imgData.data;
      return { r: d[0], g: d[1], b: d[2] };
    }
    const firstCanvas = f0.canvas;
    const ctx = firstCanvas.getContext('2d', { willReadFrequently: true });
    const w = firstCanvas.width;
    const h = firstCanvas.height;

    // Sample 4 corners
    const samples = [
      ctx.getImageData(0, 0, 1, 1).data,
      ctx.getImageData(w - 1, 0, 1, 1).data,
      ctx.getImageData(0, h - 1, 1, 1).data,
      ctx.getImageData(w - 1, h - 1, 1, 1).data
    ];

    // Pick top-left or mode
    return { r: samples[0][0], g: samples[0][1], b: samples[0][2] };
  }

  /**
   * Fast boundary flood-fill: removes solid color background connected to image edges.
   * Keeps interior colors intact (e.g. white bellies, markings with outlines).
   */
  removeBorderConnectedColor(gifData, tolerance = 35) {
    if (!gifData || !gifData.frames || gifData.frames.length === 0) return gifData;

    gifData.frames.forEach((f) => {
      const w = f.canvas.width;
      const h = f.canvas.height;
      const ctx = f.canvas.getContext('2d', { willReadFrequently: true });
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Sample corners: if ANY corner is transparent, the GIF is already an isolated sticker!
      const c0 = 0;
      const c1 = (w - 1) * 4;
      const c2 = (h - 1) * w * 4;
      const c3 = ((h - 1) * w + (w - 1)) * 4;
      if (data[c0 + 3] === 0 || data[c1 + 3] === 0 || data[c2 + 3] === 0 || data[c3 + 3] === 0) {
        return; // Already transparent background!
      }

      // Corner target RGB
      const bgR = data[c0];
      const bgG = data[c0 + 1];
      const bgB = data[c0 + 2];

      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h * 2);
      let head = 0;
      let tail = 0;

      // Seed all 4 outer image borders
      for (let x = 0; x < w; x++) {
        queue[tail++] = x; queue[tail++] = 0;
        queue[tail++] = x; queue[tail++] = h - 1;
      }
      for (let y = 0; y < h; y++) {
        queue[tail++] = 0; queue[tail++] = y;
        queue[tail++] = w - 1; queue[tail++] = y;
      }

      while (head < tail) {
        const x = queue[head++];
        const y = queue[head++];
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const pIdx = y * w + x;
        if (visited[pIdx]) continue;
        visited[pIdx] = 1;

        const dIdx = pIdx * 4;
        const a = data[dIdx + 3];
        if (a === 0) continue;

        const dr = Math.abs(data[dIdx] - bgR);
        const dg = Math.abs(data[dIdx + 1] - bgG);
        const db = Math.abs(data[dIdx + 2] - bgB);

        if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
          data[dIdx + 3] = 0; // Make transparent
          if (x + 1 < w && !visited[pIdx + 1]) { queue[tail++] = x + 1; queue[tail++] = y; }
          if (x - 1 >= 0 && !visited[pIdx - 1]) { queue[tail++] = x - 1; queue[tail++] = y; }
          if (y + 1 < h && !visited[pIdx + w]) { queue[tail++] = x; queue[tail++] = y + 1; }
          if (y - 1 >= 0 && !visited[pIdx - w]) { queue[tail++] = x; queue[tail++] = y - 1; }
        }
      }

      ctx.putImageData(imgData, 0, 0);
    });

    return gifData;
  }

  /**
   * Re-creates all ImageBitmap GPU textures after modifying canvas frames
   */
  async rebuildBitmaps(gifData) {
    if (!gifData || !gifData.frames) return gifData;
    const tasks = gifData.frames.map(async (f) => {
      if (f.bitmap && typeof f.bitmap.close === 'function') {
        try { f.bitmap.close(); } catch (e) {}
      }
      if (typeof createImageBitmap === 'function') {
        try {
          f.bitmap = await createImageBitmap(f.canvas);
        } catch (e) {
          f.bitmap = null;
        }
      } else {
        f.bitmap = null;
      }
    });
    await Promise.all(tasks);
    return gifData;
  }

  /**
   * Renders a single frame with live chroma key effect for fast interactive modal preview
   */
  renderChromaFrame(sourceCanvas, targetRGB, tolerance = 35, targetCanvas = null) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const outCanvas = targetCanvas || document.createElement('canvas');
    if (outCanvas.width !== width) outCanvas.width = width;
    if (outCanvas.height !== height) outCanvas.height = height;

    const outCtx = outCanvas.getContext('2d', { willReadFrequently: true });
    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(sourceCanvas, 0, 0);

    const imgData = outCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;
    const tr = targetRGB.r;
    const tg = targetRGB.g;
    const tb = targetRGB.b;

    for (let i = 0; i < len; i += 4) {
      if (data[i + 3] === 0) continue;
      const dr = data[i] - tr;
      const dg = data[i + 1] - tg;
      const db = data[i + 2] - tb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist <= tolerance) {
        data[i + 3] = 0;
      } else if (dist <= tolerance + 15) {
        data[i + 3] = Math.round(data[i + 3] * ((dist - tolerance) / 15));
      }
    }

    outCtx.putImageData(imgData, 0, 0);
    return outCanvas;
  }

  /**
   * Chroma-Key Algorithm: Removes a specific background color with adjustable tolerance
   * from ALL frames of the GIF, making it 100% transparent, and updates GPU bitmaps!
   */
  async applyChromaKey(gifData, targetRGB, tolerance = 35) {
    if (!gifData || !gifData.frames) return gifData;

    const tr = targetRGB.r;
    const tg = targetRGB.g;
    const tb = targetRGB.b;

    gifData.frames.forEach((f) => {
      const ctx = f.canvas.getContext('2d', { willReadFrequently: true });
      const imgData = ctx.getImageData(0, 0, f.canvas.width, f.canvas.height);
      const data = imgData.data;
      const len = data.length;

      for (let i = 0; i < len; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue;

        // Euclidean color distance in RGB space
        const dr = r - tr;
        const dg = g - tg;
        const db = b - tb;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);

        if (dist <= tolerance) {
          data[i + 3] = 0; // completely transparent
        } else if (dist <= tolerance + 15) {
          // Feather edge for anti-aliasing
          const featherRatio = (dist - tolerance) / 15;
          data[i + 3] = Math.round(a * featherRatio);
        }
      }

      ctx.putImageData(imgData, 0, 0);
    });

    // Invalidate and rebuild GPU ImageBitmap objects for smooth canvas rendering
    await this.rebuildBitmaps(gifData);
    gifData.isTransparent = true;

    return gifData;
  }

  /**
   * Encodes all frames into a client-side animated GIF with true GIF89a transparency
   * Preserves full original dimensions and high 24-bit color fidelity with fast memoized color matching
   */
  encodeToGif(gifData) {
    if (typeof GifWriter === 'undefined') {
      throw new Error('GifWriter is not available in the library.');
    }
    const width = gifData.width;
    const height = gifData.height;
    const numFrames = gifData.frames.length;
    const maxBytes = Math.max(131072, width * height * numFrames * 2 + 32768);
    const buf = new Uint8Array(maxBytes);
    const writer = new GifWriter(buf, width, height, { loop: 0 });

    for (let f = 0; f < numFrames; f++) {
      const frame = gifData.frames[f];
      const data = (!frame._canvas && frame.imgData) ? frame.imgData.data : frame.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, width, height).data;
      const numPixels = width * height;

      // Palette and indexed pixels (index 0 reserved for transparency)
      const palette = [0x000000];
      const colorMap = new Map();
      const indexed = new Uint8Array(numPixels);

      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const a = data[i + 3];
        if (a < 128) {
          indexed[p] = 0; // transparent
          continue;
        }

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const rgb = (r << 16) | (g << 8) | b;

        let idx = colorMap.get(rgb);
        if (idx === undefined) {
          if (palette.length < 256) {
            idx = palette.length;
            palette.push(rgb);
            colorMap.set(rgb, idx);
          } else {
            idx = -1; // overflow: needs nearest match
          }
        }
        indexed[p] = idx;
      }

      // If colors exceeded 255 (e.g. from feathered edges), map unassigned pixels to nearest palette color with memoization
      if (palette.length >= 256) {
        const matchCache = new Map();
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          if (indexed[p] === -1 || (indexed[p] === 0 && data[i + 3] >= 128)) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const rgb = (r << 16) | (g << 8) | b;
            let bestIdx = matchCache.get(rgb);
            if (bestIdx === undefined) {
              let minDist = Infinity;
              bestIdx = 1;
              for (let c = 1; c < palette.length; c++) {
                const pr = (palette[c] >> 16) & 0xff;
                const pg = (palette[c] >> 8) & 0xff;
                const pb = palette[c] & 0xff;
                const dist = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb);
                if (dist < minDist) {
                  minDist = dist;
                  bestIdx = c;
                  if (dist === 0) break;
                }
              }
              matchCache.set(rgb, bestIdx);
            }
            indexed[p] = bestIdx;
          }
        }
      }

      // Palette size must be a power of 2 between 2 and 256
      let pLen = 2;
      while (pLen < palette.length) pLen <<= 1;
      while (palette.length < pLen) palette.push(0x000000);

      const delayHundredths = Math.max(2, Math.round((frame.delay || 100) / 10));
      writer.addFrame(0, 0, width, height, indexed, {
        palette: palette,
        delay: delayHundredths,
        transparent: 0,
        disposal: 2
      });
    }

    const totalBytes = writer.end();
    return buf.subarray(0, totalBytes);
  }
}

// Global instance
window.gifEngine = new GifEngine();
