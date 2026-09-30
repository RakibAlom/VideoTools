/**
 * GifEngine - Fast, robust pure JavaScript GIF frame decoder and animator
 * Built on Dean McNamee's omggif library
 */

class GifEngine {
  constructor() {
    this.cache = new Map(); // url/id -> { width, height, frames: [{ canvas, delay, time }], totalDuration }
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

    // Offscreen canvas for compositing frames
    const compCanvas = document.createElement('canvas');
    compCanvas.width = width;
    compCanvas.height = height;
    const compCtx = compCanvas.getContext('2d', { willReadFrequently: true });

    let previousImageData = null;

    for (let i = 0; i < numFrames; i++) {
      const frameInfo = reader.frameInfo(i);
      // frameInfo: { x, y, width, height, delay, disposal }
      // disposal: 
      // 0: no disposal specified
      // 1: do not dispose (keep current pixels)
      // 2: restore to background color (transparent)
      // 3: restore to previous content

      // Save previous state if disposal is 3
      if (frameInfo.disposal === 3) {
        previousImageData = compCtx.getImageData(0, 0, width, height);
      }

      // Allocate buffer for raw RGBA frame pixels
      const framePixels = new Uint8ClampedArray(frameInfo.width * frameInfo.height * 4);
      reader.decodeAndBlitFrameRGBA(i, framePixels);

      // Create temporary canvas for this frame's delta
      const patchCanvas = document.createElement('canvas');
      patchCanvas.width = frameInfo.width;
      patchCanvas.height = frameInfo.height;
      const patchCtx = patchCanvas.getContext('2d');
      const patchData = new ImageData(framePixels, frameInfo.width, frameInfo.height);
      patchCtx.putImageData(patchData, 0, 0);

      // Composite onto master canvas
      compCtx.drawImage(patchCanvas, frameInfo.x, frameInfo.y);

      // Copy composite to standalone frame canvas
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const fCtx = frameCanvas.getContext('2d');
      fCtx.drawImage(compCanvas, 0, 0);

      // Delay in ms (GIF delay is in 100ths of a sec, default to 10 = 100ms if 0)
      const rawDelay = frameInfo.delay || 10;
      const delayMs = Math.max(20, rawDelay * 10);

      frames.push({
        canvas: frameCanvas,
        delay: delayMs,
        startTime: cumulativeTime,
        endTime: cumulativeTime + delayMs
      });

      cumulativeTime += delayMs;

      // Handle disposal method for next frame
      if (frameInfo.disposal === 2) {
        // Restore to transparent inside frame rect
        compCtx.clearRect(frameInfo.x, frameInfo.y, frameInfo.width, frameInfo.height);
      } else if (frameInfo.disposal === 3 && previousImageData) {
        // Restore to previous frame state
        compCtx.putImageData(previousImageData, 0, 0);
      }
    }

    return {
      name,
      width,
      height,
      frames,
      totalDuration: cumulativeTime || 1000
    };
  }

  /**
   * Retrieves the frame canvas at a given timestamp in ms
   */
  getFrame(gifData, timestampMs) {
    if (!gifData || !gifData.frames || gifData.frames.length === 0) return null;
    if (gifData.frames.length === 1) return gifData.frames[0].canvas;

    const t = (timestampMs % gifData.totalDuration + gifData.totalDuration) % gifData.totalDuration;
    // Binary or linear search
    for (let i = 0; i < gifData.frames.length; i++) {
      const f = gifData.frames[i];
      if (t >= f.startTime && t < f.endTime) {
        return f.canvas;
      }
    }
    return gifData.frames[0].canvas;
  }
}

// Global instance
window.gifEngine = new GifEngine();
