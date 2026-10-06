/**
 * KaraokeLyricsEngine - Advanced Lyrics Management, Parsing, Splitting, Merging, Auto-Timing & Hook Extraction
 * Supports word-level millisecond timing, LRC/SRT parsing, random hook extraction, and crop-to-trim.
 */

class KaraokeLyricsEngine {
  constructor() {
    this.lines = []; // Array of line objects
    this.activeLineIndex = -1;
    this.selectedLineId = null;
    this.onChangeCallback = null;
  }

  setLines(newLines) {
    this.lines = Array.isArray(newLines) ? newLines : [];
    this.sanitize();
    this.notifyChange();
  }

  getLines() {
    return this.lines;
  }

  notifyChange() {
    if (this.onChangeCallback) {
      this.onChangeCallback(this.lines);
    }
  }

  /**
   * Sanitizes and sorts lines by start time, ensures all lines have word timings
   */
  sanitize() {
    this.lines.sort((a, b) => a.start - b.start);
    this.lines.forEach((line, index) => {
      if (!line.id) line.id = 'line_' + Date.now() + '_' + index;
      line.start = Math.max(0, parseFloat(line.start) || 0);
      line.end = Math.max(line.start + 0.2, parseFloat(line.end) || (line.start + 2.5));

      if (!line.words || line.words.length === 0) {
        line.words = this.generateWordsForLine(line.text, line.start, line.end);
      } else {
        // Ensure word timestamps are within line bounds
        line.words.forEach((w, wIdx) => {
          w.start = parseFloat(w.start) || line.start;
          w.end = parseFloat(w.end) || line.end;
        });
      }
    });
  }

  /**
   * Splits line text into words and generates proportional timing based on character lengths
   */
  generateWordsForLine(text, lineStart, lineEnd) {
    if (!text || typeof text !== 'string') return [];
    const rawWords = text.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return [];

    const totalDuration = Math.max(0.2, lineEnd - lineStart);
    const totalChars = rawWords.reduce((acc, w) => acc + Math.max(1, w.length), 0);

    let curTime = lineStart;
    return rawWords.map((word, idx) => {
      const proportion = Math.max(1, word.length) / totalChars;
      const wordDur = totalDuration * proportion;
      const wStart = Math.round(curTime * 100) / 100;
      const wEnd = Math.round((curTime + wordDur) * 100) / 100;
      curTime += wordDur;
      return {
        text: word,
        start: wStart,
        end: Math.min(lineEnd, wEnd)
      };
    });
  }

  /**
   * Find current active line and next line for 2-line progressive karaoke display
   */
  getActiveLines(currentTime) {
    let activeIndex = -1;
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (currentTime >= line.start && currentTime <= line.end) {
        activeIndex = i;
        break;
      }
    }

    // If in between lines, find upcoming line
    if (activeIndex === -1) {
      for (let i = 0; i < this.lines.length; i++) {
        if (this.lines[i].start > currentTime) {
          activeIndex = i;
          break;
        }
      }
    }

    const currentLine = activeIndex >= 0 ? this.lines[activeIndex] : null;
    const nextLine = (activeIndex >= 0 && activeIndex + 1 < this.lines.length) ? this.lines[activeIndex + 1] : null;

    return {
      currentLine,
      nextLine,
      activeIndex
    };
  }

  /**
   * Edit line text and recalculate word distribution
   */
  updateLineText(lineId, newText) {
    const line = this.lines.find(l => l.id === lineId);
    if (!line) return;
    line.text = newText;
    line.words = this.generateWordsForLine(newText, line.start, line.end);
    this.notifyChange();
  }

  /**
   * Update start and end time of a line
   */
  updateLineTiming(lineId, start, end) {
    const line = this.lines.find(l => l.id === lineId);
    if (!line) return;
    line.start = Math.max(0, parseFloat(start) || 0);
    line.end = Math.max(line.start + 0.2, parseFloat(end) || (line.start + 1.0));
    line.words = this.generateWordsForLine(line.text, line.start, line.end);
    this.sanitize();
    this.notifyChange();
  }

  /**
   * Update a specific word inside a line
   */
  updateWord(lineId, wordIndex, newText, newStart, newEnd) {
    const line = this.lines.find(l => l.id === lineId);
    if (!line || !line.words || !line.words[wordIndex]) return;

    if (newText !== undefined) line.words[wordIndex].text = newText;
    if (newStart !== undefined) line.words[wordIndex].start = parseFloat(newStart);
    if (newEnd !== undefined) line.words[wordIndex].end = parseFloat(newEnd);

    line.text = line.words.map(w => w.text).join(' ');
    this.notifyChange();
  }

  /**
   * SPLIT LINE: Splits a line into two separate timed lines at a specific word index
   */
  splitLine(lineId, splitWordIndex) {
    const lineIndex = this.lines.findIndex(l => l.id === lineId);
    if (lineIndex === -1) return false;

    const originalLine = this.lines[lineIndex];
    if (!originalLine.words || originalLine.words.length <= 1) return false;

    const splitIdx = Math.max(1, Math.min(originalLine.words.length - 1, splitWordIndex));
    const words1 = originalLine.words.slice(0, splitIdx);
    const words2 = originalLine.words.slice(splitIdx);

    const line1End = words1[words1.length - 1].end;
    const line2Start = words2[0].start;

    const newLine1 = {
      id: 'line_' + Date.now() + '_a',
      text: words1.map(w => w.text).join(' '),
      start: originalLine.start,
      end: line1End,
      words: words1
    };

    const newLine2 = {
      id: 'line_' + Date.now() + '_b',
      text: words2.map(w => w.text).join(' '),
      start: line2Start,
      end: originalLine.end,
      words: words2
    };

    this.lines.splice(lineIndex, 1, newLine1, newLine2);
    this.sanitize();
    this.notifyChange();
    return true;
  }

  /**
   * MERGE LINES: Merges a line with the adjacent line following it
   */
  mergeWithNext(lineId) {
    const idx = this.lines.findIndex(l => l.id === lineId);
    if (idx === -1 || idx >= this.lines.length - 1) return false;

    const line1 = this.lines[idx];
    const line2 = this.lines[idx + 1];

    const combinedWords = [...(line1.words || []), ...(line2.words || [])];
    const mergedLine = {
      id: 'line_' + Date.now() + '_m',
      text: (line1.text.trim() + ' ' + line2.text.trim()).trim(),
      start: line1.start,
      end: Math.max(line1.end, line2.end),
      words: combinedWords
    };

    this.lines.splice(idx, 2, mergedLine);
    this.sanitize();
    this.notifyChange();
    return true;
  }

  /**
   * ADD NEW LINE: Inserts a new line at a specified timestamp
   */
  addLine(text = 'New karaoke lyric line', start = 0, duration = 3.0) {
    const newLine = {
      id: 'line_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      text: text,
      start: start,
      end: start + duration,
      words: []
    };
    newLine.words = this.generateWordsForLine(newLine.text, newLine.start, newLine.end);
    this.lines.push(newLine);
    this.sanitize();
    this.notifyChange();
    return newLine;
  }

  /**
   * DELETE LINE
   */
  deleteLine(lineId) {
    this.lines = this.lines.filter(l => l.id !== lineId);
    this.notifyChange();
  }

  /**
   * CUT / CROP LYRICS TO AUDIO/VIDEO TRIM RANGE
   * Keeps only lines that overlap with [trimStart, trimEnd].
   * If offsetToZero is true, offsets timestamps so trimStart becomes 0.0.
   */
  cropToTrim(trimStart, trimEnd, offsetToZero = false) {
    const filtered = this.lines.filter(line => {
      // Keep if line overlaps with the trim range
      return (line.end > trimStart && line.start < trimEnd);
    });

    const offset = offsetToZero ? trimStart : 0;

    this.lines = filtered.map(line => {
      const newStart = Math.max(0, line.start - offset);
      const newEnd = Math.max(newStart + 0.2, line.end - offset);
      const newWords = (line.words || []).map(w => ({
        text: w.text,
        start: Math.max(0, w.start - offset),
        end: Math.max(0, w.end - offset)
      }));

      return {
        ...line,
        start: Math.round(newStart * 100) / 100,
        end: Math.round(newEnd * 100) / 100,
        words: newWords
      };
    });

    this.sanitize();
    this.notifyChange();
    return this.lines;
  }

  /**
   * PICK RANDOM HOOK / SNIPPET ("i can took random")
   * Finds a contiguous group of lines matching targetDuration (e.g. 15s).
   */
  pickRandomHook(targetDuration = 15) {
    if (this.lines.length === 0) return null;

    if (this.lines.length <= 3) {
      return {
        lines: [...this.lines],
        start: this.lines[0].start,
        end: this.lines[this.lines.length - 1].end
      };
    }

    // Try multiple start candidates and pick one that best fills targetDuration
    const possibleStarts = Math.max(1, this.lines.length - 2);
    const randStartIdx = Math.floor(Math.random() * possibleStarts);

    let chosenLines = [];
    let startTime = this.lines[randStartIdx].start;
    let endTime = startTime;

    for (let i = randStartIdx; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (line.end - startTime > targetDuration + 3.0 && chosenLines.length >= 2) {
        break;
      }
      chosenLines.push(line);
      endTime = line.end;
      if (endTime - startTime >= targetDuration) {
        break;
      }
    }

    return {
      lines: chosenLines,
      start: Math.max(0, startTime - 0.5),
      end: endTime + 0.8
    };
  }

  /**
   * SHIFT ALL TIMESTAMPS (+/- seconds)
   */
  shiftAll(offsetSeconds) {
    this.lines.forEach(line => {
      line.start = Math.max(0, line.start + offsetSeconds);
      line.end = Math.max(line.start + 0.2, line.end + offsetSeconds);
      if (line.words) {
        line.words.forEach(w => {
          w.start = Math.max(0, w.start + offsetSeconds);
          w.end = Math.max(w.start + 0.1, w.end + offsetSeconds);
        });
      }
    });
    this.sanitize();
    this.notifyChange();
  }

  /**
   * AUTO-DISTRIBUTE: Takes plain text lines and distributes them evenly across duration
   */
  autoDistributePlainText(plainText, totalDuration = 20, startOffset = 0.5) {
    const rawLines = plainText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) return [];

    const availableTime = Math.max(2.0, totalDuration - startOffset - 0.5);
    const timePerLine = availableTime / rawLines.length;

    const newLines = rawLines.map((text, idx) => {
      const lineStart = Math.round((startOffset + idx * timePerLine) * 100) / 100;
      const lineEnd = Math.round((lineStart + timePerLine * 0.92) * 100) / 100;
      return {
        id: 'line_' + Date.now() + '_' + idx,
        text: text,
        start: lineStart,
        end: lineEnd,
        words: this.generateWordsForLine(text, lineStart, lineEnd)
      };
    });

    this.setLines(newLines);
    return newLines;
  }

  /**
   * PARSE LRC FORMAT: [00:12.34] Lyrics text
   */
  parseLRC(lrcContent, totalAudioDuration = 60) {
    const lines = lrcContent.split(/\r?\n/);
    const parsed = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (let rawLine of lines) {
      const matches = [...rawLine.matchAll(timeRegex)];
      if (matches.length > 0) {
        const text = rawLine.replace(timeRegex, '').trim();
        if (text) {
          for (let m of matches) {
            const min = parseInt(m[1], 10);
            const sec = parseInt(m[2], 10);
            const ms = m[3] ? (m[3].length === 2 ? parseInt(m[3], 10) * 10 : parseInt(m[3], 10)) : 0;
            const timestamp = min * 60 + sec + ms / 1000;
            parsed.push({
              time: timestamp,
              text: text
            });
          }
        }
      }
    }

    parsed.sort((a, b) => a.time - b.time);

    const result = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      const nextTime = (i + 1 < parsed.length) ? parsed[i + 1].time : (item.time + 4.0);
      const lineEnd = Math.min(item.time + 6.0, Math.max(item.time + 1.2, nextTime - 0.2));

      result.push({
        id: 'line_lrc_' + i,
        text: item.text,
        start: Math.round(item.time * 100) / 100,
        end: Math.round(lineEnd * 100) / 100,
        words: this.generateWordsForLine(item.text, item.time, lineEnd)
      });
    }

    this.setLines(result);
    return result;
  }

  /**
   * PARSE SRT / VTT FORMAT
   */
  parseSRT(srtContent) {
    const blocks = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n');
    const result = [];

    const timeRegex = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;

    let count = 0;
    for (let block of blocks) {
      const lines = block.split('\n').filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(timeRegex);
        if (m) {
          const startSec = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000;
          const endSec = parseInt(m[5]) * 3600 + parseInt(m[6]) * 60 + parseInt(m[7]) + parseInt(m[8]) / 1000;
          const textLines = lines.slice(i + 1).join(' ').trim();
          if (textLines) {
            result.push({
              id: 'line_srt_' + (count++),
              text: textLines,
              start: Math.round(startSec * 100) / 100,
              end: Math.round(endSec * 100) / 100,
              words: this.generateWordsForLine(textLines, startSec, endSec)
            });
          }
          break;
        }
      }
    }

    this.setLines(result);
    return result;
  }

  /**
   * EXPORT TO JSON
   */
  exportJSON() {
    return JSON.stringify(this.lines, null, 2);
  }

  /**
   * EXPORT TO LRC
   */
  exportLRC() {
    const pad = (n) => String(Math.floor(n)).padStart(2, '0');
    return this.lines.map(line => {
      const min = pad(line.start / 60);
      const sec = pad(line.start % 60);
      const ms = pad((line.start % 1) * 100);
      return `[${min}:${sec}.${ms}] ${line.text}`;
    }).join('\n');
  }
}

window.karaokeLyricsEngine = new KaraokeLyricsEngine();