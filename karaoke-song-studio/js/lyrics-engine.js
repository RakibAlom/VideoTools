/**
 * KaraokeLyricsEngine - Advanced Lyrics Management, Parsing, Splitting, Merging, Auto-Timing & Subtitle Import
 * Supports SRT, WebVTT (with or without hours), YouTube SBV, YouTube Transcript copy-pastes, LRC, and plain text.
 * 100% Pure JavaScript (Zero Python). Clean ASCII.
 */

class KaraokeLyricsEngine {
  constructor() {
    this.lines = [];
    this.masterLines = [];
    this.activeLineIndex = -1;
    this.selectedLineId = null;
    this.onChangeCallback = null;
    this.onChange = null;
  }

  setLines(newLines, updateMaster = true) {
    this.lines = Array.isArray(newLines) ? newLines : [];
    this.sanitize();
    if (updateMaster) {
      this.masterLines = JSON.parse(JSON.stringify(this.lines));
    }
    this.notifyChange();
  }

  getLines() {
    return this.lines;
  }

  notifyChange() {
    if (this.onChangeCallback) {
      try { this.onChangeCallback(this.lines); } catch (e) {}
    }
    if (this.onChange) {
      try { this.onChange(this.lines); } catch (e) {}
    }
  }

  sanitize() {
    this.lines = this.lines.filter(l => l && typeof l.text === 'string' && l.text.trim().length > 0);
    this.lines.sort((a, b) => a.start - b.start);

    this.lines.forEach((line, index) => {
      if (!line.id) line.id = 'line_' + Date.now() + '_' + index;
      line.start = Math.max(0, parseFloat(line.start) || 0);
      line.end = Math.max(line.start + 0.3, parseFloat(line.end) || (line.start + 2.5));

      if (!line.words || line.words.length === 0) {
        line.words = this.generateWordsForLine(line.text, line.start, line.end);
      } else {
        line.words.forEach((w) => {
          w.start = parseFloat(w.start) || line.start;
          w.end = parseFloat(w.end) || line.end;
        });
      }
    });
  }

  generateWordsForLine(text, lineStart, lineEnd) {
    if (!text || typeof text !== 'string') return [];
    const rawWords = text.trim().split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return [];

    const duration = Math.max(0.3, lineEnd - lineStart);
    const perWord = duration / rawWords.length;

    return rawWords.map((word, idx) => ({
      text: word,
      start: Math.round((lineStart + idx * perWord) * 100) / 100,
      end: Math.round((lineStart + (idx + 1) * perWord) * 100) / 100
    }));
  }

  updateLineText(lineId, newText) {
    const line = this.lines.find(l => l.id === lineId);
    if (!line) return;
    line.text = newText;
    line.words = this.generateWordsForLine(newText, line.start, line.end);
    this.notifyChange();
  }

  updateLineTiming(lineId, start, end) {
    const line = this.lines.find(l => l.id === lineId);
    if (!line) return;
    line.start = Math.max(0, parseFloat(start) || 0);
    line.end = Math.max(line.start + 0.3, parseFloat(end) || (line.start + 1.0));
    line.words = this.generateWordsForLine(line.text, line.start, line.end);
    this.sanitize();
    this.notifyChange();
  }

  splitLine(lineId, splitWordIndex) {
    const lineIndex = this.lines.findIndex(l => l.id === lineId);
    if (lineIndex === -1) return false;

    const originalLine = this.lines[lineIndex];
    if (!originalLine.words || originalLine.words.length <= 1) return false;

    const splitIdx = (splitWordIndex !== undefined)
      ? Math.max(1, Math.min(originalLine.words.length - 1, splitWordIndex))
      : Math.floor(originalLine.words.length / 2);

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

  addLine(text = 'New lyric line', start = 0, duration = 3.0) {
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

  deleteLine(lineId) {
    this.lines = this.lines.filter(l => l.id !== lineId);
    this.notifyChange();
  }

  cropToTrim(trimStart, trimEnd, offsetToZero = false) {
    const source = (this.masterLines && this.masterLines.length > 0) ? this.masterLines : this.lines;
    const filtered = source.filter(line => {
      return (line.end > trimStart && line.start < trimEnd);
    });

    const offset = offsetToZero ? trimStart : 0;

    this.lines = filtered.map(line => {
      const newStart = Math.max(0, line.start - offset);
      const newEnd = Math.max(newStart + 0.3, line.end - offset);
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

  shiftAll(offsetSeconds) {
    this.lines.forEach(line => {
      line.start = Math.max(0, line.start + offsetSeconds);
      line.end = Math.max(line.start + 0.3, line.end + offsetSeconds);
      if (line.words) {
        line.words.forEach(w => {
          w.start = Math.max(0, w.start + offsetSeconds);
          w.end = Math.max(w.start + 0.1, w.end + offsetSeconds);
        });
      }
    });
    this.sanitize();
    this.notifyChange();
    return this.lines;
  }

  /**
   * Aligns the first lyric cue to begin at targetStart (default 0.5s),
   * shifting all subsequent lines proportionally. Eliminates dead delay before lyrics start!
   */
  alignToStart(targetStart = 0.5) {
    if (!this.lines || this.lines.length === 0) return this.lines;
    const minStart = Math.min(...this.lines.map(l => l.start));
    const offset = targetStart - minStart;
    return this.shiftAll(offset);
  }

  /**
   * Proportionally fits all subtitle cues across the target audio duration
   */
  fitToDuration(targetDuration, startOffset = 0.5, endPadding = 1.0) {
    if (!this.lines || this.lines.length === 0) return this.lines;
    const minStart = Math.min(...this.lines.map(l => l.start));
    const maxEnd = Math.max(...this.lines.map(l => l.end));
    const currentSpan = Math.max(0.5, maxEnd - minStart);
    const targetSpan = Math.max(2.0, targetDuration - startOffset - endPadding);
    const scaleFactor = targetSpan / currentSpan;

    this.lines.forEach(line => {
      const relStart = line.start - minStart;
      const relEnd = line.end - minStart;
      const newStart = Math.max(0, startOffset + relStart * scaleFactor);
      const newEnd = Math.max(newStart + 0.3, startOffset + relEnd * scaleFactor);
      line.start = Math.round(newStart * 100) / 100;
      line.end = Math.round(newEnd * 100) / 100;
      if (line.words) {
        line.words.forEach(w => {
          const wRelStart = w.start - minStart;
          const wRelEnd = w.end - minStart;
          w.start = Math.max(0, Math.round((startOffset + wRelStart * scaleFactor) * 100) / 100);
          w.end = Math.max(w.start + 0.1, Math.round((startOffset + wRelEnd * scaleFactor) * 100) / 100);
        });
      }
    });

    this.sanitize();
    this.notifyChange();
    return this.lines;
  }

  autoDistributePlainText(plainText, totalDuration = 20, startOffset = 0.5) {
    const rawLines = plainText.split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^\[.+\]$/.test(l)); // filter out [Chorus] etc.

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
   * UNIVERSAL SUBTITLE & LYRICS PARSER
   * Handles:
   * 1. SRT (SubRip)
   * 2. WebVTT (with or without hours)
   * 3. SBV (YouTube SubViewer)
   * 4. YouTube Transcript copy-pastes (0:05 text)
   * 5. LRC ([00:12.34] text)
   * 6. Plain lyrics text
   */
  importAnySubtitleText(rawContent, totalAudioDuration = 60, trimStart = 0, autoAlign = false, autoScale = false) {
    if (!rawContent || typeof rawContent !== 'string') return [];
    const text = rawContent.trim();
    let res = [];

    // 1. YouTube SBV (0:00:01.000,0:00:04.000)
    if (/\d+:\d{2}:\d{2}\.\d{3},\d+:\d{2}:\d{2}\.\d{3}/.test(text)) {
      res = this.parseSBV(text);
    } else if (text.includes('-->')) {
      // 2. SRT or WebVTT arrow (-->)
      res = this.parseSRTOrVTT(text);
    } else if (/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/.test(text)) {
      // 3. LRC ([00:12.34] or [01:23])
      res = this.parseLRC(text, totalAudioDuration);
    } else if (/(?:^|\n)\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+/.test(text) || /(?:^|\n)\s*(\d{1,2}:\d{2})\s*\n/.test(text)) {
      // 4. YouTube Transcript copy-paste (0:05 or 01:23 timestamps)
      res = this.parseYouTubeTranscript(text, totalAudioDuration);
    } else {
      // 5. Fallback: Plain text auto distribution
      res = this.autoDistributePlainText(text, totalAudioDuration, trimStart);
    }

    if (autoAlign && this.lines.length > 0) {
      this.alignToStart(0.5);
    }
    if (autoScale && this.lines.length > 0 && totalAudioDuration > 2.0) {
      this.fitToDuration(totalAudioDuration, 0.5, 1.0);
    }
    return this.lines;
  }

  parseSRTOrVTT(content) {
    const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const result = [];
    const timeRegex = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{2,3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[,.](\d{2,3})/;

    const toSec = (h, m, s, ms) => {
      const hours = h ? parseInt(h, 10) : 0;
      const mins = parseInt(m, 10);
      const secs = parseInt(s, 10);
      const millis = parseInt(ms.padEnd(3, '0').slice(0, 3), 10);
      return hours * 3600 + mins * 60 + secs + millis / 1000;
    };

    let currentItem = null;
    let count = 0;

    for (let line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentItem && currentItem.text.length > 0) {
          result.push({
            id: 'sub_' + (count++),
            text: currentItem.text.join(' ').replace(/<[^>]*>/g, '').trim(),
            start: Math.round(currentItem.start * 100) / 100,
            end: Math.round(currentItem.end * 100) / 100,
            words: []
          });
          currentItem = null;
        }
        continue;
      }

      // Check timestamp line
      const match = trimmed.match(timeRegex);
      if (match) {
        if (currentItem && currentItem.text.length > 0) {
          result.push({
            id: 'sub_' + (count++),
            text: currentItem.text.join(' ').replace(/<[^>]*>/g, '').trim(),
            start: Math.round(currentItem.start * 100) / 100,
            end: Math.round(currentItem.end * 100) / 100,
            words: []
          });
        }

        const startSec = toSec(match[1], match[2], match[3], match[4]);
        const endSec = toSec(match[5], match[6], match[7], match[8]);
        currentItem = {
          start: startSec,
          end: Math.max(startSec + 0.3, endSec),
          text: []
        };
        continue;
      }

      // Skip cue numbers, WEBVTT headers, or metadata lines
      if (/^\d+$/.test(trimmed) || trimmed.startsWith('WEBVTT') || trimmed.startsWith('NOTE') || trimmed.startsWith('STYLE')) {
        continue;
      }

      // Text line
      if (currentItem) {
        const cleanText = trimmed.replace(/<[^>]*>/g, '').trim();
        if (cleanText) {
          currentItem.text.push(cleanText);
        }
      }
    }

    // Flush last item
    if (currentItem && currentItem.text.length > 0) {
      result.push({
        id: 'sub_' + (count++),
        text: currentItem.text.join(' ').replace(/<[^>]*>/g, '').trim(),
        start: Math.round(currentItem.start * 100) / 100,
        end: Math.round(currentItem.end * 100) / 100,
        words: []
      });
    }

    // Clean, generate words, and deduplicate
    const finalResult = [];
    for (let item of result) {
      if (!item.text) continue;
      // Skip duplicate consecutive lines
      if (finalResult.length > 0 && finalResult[finalResult.length - 1].text.toLowerCase() === item.text.toLowerCase()) {
        finalResult[finalResult.length - 1].end = Math.max(finalResult[finalResult.length - 1].end, item.end);
        continue;
      }
      item.words = this.generateWordsForLine(item.text, item.start, item.end);
      finalResult.push(item);
    }

    if (finalResult.length > 0) {
      this.setLines(finalResult);
    }
    return finalResult;
  }

  parseSBV(content) {
    const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const result = [];
    const timeRegex = /(\d{1,2}):(\d{2}):(\d{2})\.(\d{3}),(\d{1,2}):(\d{2}):(\d{2})\.(\d{3})/;

    let currentItem = null;
    let count = 0;

    for (let line of rawLines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (currentItem && currentItem.text.length > 0) {
          result.push({
            id: 'sbv_' + (count++),
            text: currentItem.text.join(' ').replace(/<[^>]*>/g, '').trim(),
            start: currentItem.start,
            end: currentItem.end,
            words: []
          });
          currentItem = null;
        }
        continue;
      }

      const m = trimmed.match(timeRegex);
      if (m) {
        if (currentItem && currentItem.text.length > 0) {
          result.push({
            id: 'sbv_' + (count++),
            text: currentItem.text.join(' ').replace(/<[^>]*>/g, '').trim(),
            start: currentItem.start,
            end: currentItem.end,
            words: []
          });
        }
        const startSec = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10) + parseInt(m[4], 10) / 1000;
        const endSec = parseInt(m[5], 10) * 3600 + parseInt(m[6], 10) * 60 + parseInt(m[7], 10) + parseInt(m[8], 10) / 1000;
        currentItem = { start: startSec, end: endSec, text: [] };
        continue;
      }

      if (currentItem) {
        currentItem.text.push(trimmed);
      }
    }

    if (currentItem && currentItem.text.length > 0) {
      result.push({
        id: 'sbv_' + (count++),
        text: currentItem.text.join(' ').replace(/<[^>]*>/g, '').trim(),
        start: currentItem.start,
        end: currentItem.end,
        words: []
      });
    }

    result.forEach(r => {
      r.words = this.generateWordsForLine(r.text, r.start, r.end);
    });

    if (result.length > 0) {
      this.setLines(result);
    }
    return result;
  }

  parseYouTubeTranscript(content, totalDuration = 60) {
    const rawLines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = [];

    const parseTimestamp = (tStr) => {
      const parts = tStr.split(':').map(p => parseInt(p, 10));
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return 0;
    };

    let pendingTime = null;
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      // Format 1: "0:05 Hello world" on same line
      const inlineMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
      if (inlineMatch) {
        const sec = parseTimestamp(inlineMatch[1]);
        const clean = inlineMatch[2].replace(/<[^>]*>/g, '').trim();
        if (clean) parsed.push({ time: sec, text: clean });
        continue;
      }

      // Format 2: "0:05" on separate line followed by text on next line
      const timeOnlyMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)$/);
      if (timeOnlyMatch) {
        pendingTime = parseTimestamp(timeOnlyMatch[1]);
        continue;
      }

      if (pendingTime !== null) {
        const clean = line.replace(/<[^>]*>/g, '').trim();
        if (clean) parsed.push({ time: pendingTime, text: clean });
        pendingTime = null;
      }
    }

    parsed.sort((a, b) => a.time - b.time);

    const result = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      const nextTime = (i + 1 < parsed.length) ? parsed[i + 1].time : Math.min(totalDuration, item.time + 3.8);
      const lineEnd = Math.max(item.time + 1.0, nextTime - 0.2);

      result.push({
        id: 'yt_' + i,
        text: item.text,
        start: Math.round(item.time * 100) / 100,
        end: Math.round(lineEnd * 100) / 100,
        words: this.generateWordsForLine(item.text, item.time, lineEnd)
      });
    }

    if (result.length > 0) {
      this.setLines(result);
    }
    return result;
  }

  parseLRC(lrcContent, totalAudioDuration = 60) {
    const lines = lrcContent.split(/\r?\n/);
    const parsed = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (let rawLine of lines) {
      const matches = [...rawLine.matchAll(timeRegex)];
      if (matches.length > 0) {
        const text = rawLine.replace(timeRegex, '').replace(/<[^>]*>/g, '').trim();
        if (text) {
          for (let m of matches) {
            const min = parseInt(m[1], 10);
            const sec = parseInt(m[2], 10);
            const ms = m[3] ? (m[3].length === 2 ? parseInt(m[3], 10) * 10 : parseInt(m[3], 10)) : 0;
            const timestamp = min * 60 + sec + ms / 1000;
            parsed.push({ time: timestamp, text: text });
          }
        }
      }
    }

    parsed.sort((a, b) => a.time - b.time);

    const result = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i];
      const nextTime = (i + 1 < parsed.length) ? parsed[i + 1].time : Math.min(totalAudioDuration, item.time + 3.8);
      const lineEnd = Math.max(item.time + 1.2, nextTime - 0.2);

      result.push({
        id: 'line_lrc_' + i,
        text: item.text,
        start: Math.round(item.time * 100) / 100,
        end: Math.round(lineEnd * 100) / 100,
        words: this.generateWordsForLine(item.text, item.time, lineEnd)
      });
    }

    if (result.length > 0) {
      this.setLines(result);
    }
    return result;
  }
}

window.KaraokeLyricsEngine = KaraokeLyricsEngine;
window.LyricsEngine = KaraokeLyricsEngine;