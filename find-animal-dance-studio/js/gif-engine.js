/**
 * GifEngine - Fast, robust pure JavaScript GIF frame decoder, animator & Chroma-Key Background Remover
 * Built on Dean McNamee's omggif library
 */

class GifEngine {
  constructor() {
    this.cache = new Map(); // id -> { width, height, frames: [{ canvas, delay, startTime, endTime }], totalDuration }
  }

  /**
   * Loads and decodes an animated GIF from a URL or data URL
   */
  async loadFromUrl(url, id = url) {
    if (this.cache.has(id)) {
      return this.cache.get(id);
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load GIF from ${url}: ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const gifData = this.decode(buffer, id);
    this.cache.set(id, gifData);
    return gifData;
  }

  /**
   * Loads and decodes an animated GIF from a File or Blob
   */
  async loadFromFile(file, id = file.name) {
    const buffer = await file.arrayBuffer();
    const gifData = this.decode(buffer, id);
    this.cache.set(id, gifData);
    return gifData;
  }

  /**
   * Decodes an ArrayBuffer using omggif GifReader with full disposal handling
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

      // decodeAndBlitFrameRGBA directly writes to fullPixels (size width*height*4) with exact stride!
      reader.decodeAndBlitFrameRGBA(i, fullPixels);

      // Create snapshot canvas for this frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const fCtx = frameCanvas.getContext('2d');
      const imgData = new ImageData(new Uint8ClampedArray(fullPixels), width, height);
      fCtx.putImageData(imgData, 0, 0);

      const rawDelay = frameInfo.delay || 10;
      const delayMs = Math.max(20, rawDelay * 10);

      frames.push({
        canvas: frameCanvas,
        delay: delayMs,
        startTime: cumulativeTime,
        endTime: cumulativeTime + delayMs
      });

      cumulativeTime += delayMs;

      // Handle disposal for subsequent frame
      if (frameInfo.disposal === 2) {
        // Clear the frame's bounding rectangle back to transparent
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
   * Retrieves the frame canvas at a given timestamp in ms
   */
  getFrame(gifData, timestampMs) {
    if (!gifData || !gifData.frames || gifData.frames.length === 0) return null;
    if (gifData.frames.length === 1) return gifData.frames[0].canvas;

    const t = (timestampMs % gifData.totalDuration + gifData.totalDuration) % gifData.totalDuration;
    for (let i = 0; i < gifData.frames.length; i++) {
      const f = gifData.frames[i];
      if (t >= f.startTime && t < f.endTime) {
        return f.canvas;
      }
    }
    return gifData.frames[0].canvas;
  }

  /**
   * Automatically samples the corner/edge pixels to detect dominant background color
   */
  detectBackgroundColor(gifData) {
    if (!gifData || !gifData.frames || gifData.frames.length === 0) return { r: 255, g: 255, b: 255 };
    const firstCanvas = gifData.frames[0].canvas;
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
   * Chroma-Key Algorithm: Removes a specific background color with adjustable tolerance
   * from ALL frames of the GIF, making it 100% transparent!
   */
  applyChromaKey(gifData, targetRGB, tolerance = 35) {
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

    return gifData;
  }
}

// Global instance
window.gifEngine = new GifEngine();
