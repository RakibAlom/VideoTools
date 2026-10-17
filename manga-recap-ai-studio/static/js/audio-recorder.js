// Browser Microphone Audio Recorder & Manual Voiceover Manager
class AudioRecorderManager {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingInterval = null;
    this.currentSegmentId = null;
    this.stream = null;
  }

  async startRecording(segmentId, onTick) {
    if (this.isRecording) {
      this.stopRecording();
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4'
      ];
      
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const options = selectedMime ? { mimeType: selectedMime } : {};
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.audioChunks = [];
      this.currentSegmentId = segmentId;
      this.isRecording = true;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(200); // 200ms chunk slices

      let elapsedSeconds = 0;
      if (onTick) onTick(0);
      this.recordingInterval = setInterval(() => {
        elapsedSeconds += 1;
        if (onTick) onTick(elapsedSeconds);
      }, 1000);

      return true;
    } catch (err) {
      console.error("Microphone access failed:", err);
      alert("Microphone access was denied or is unavailable. Please check browser permissions.");
      return false;
    }
  }

  async stopRecording() {
    return new Promise((resolve) => {
      if (!this.isRecording || !this.mediaRecorder) {
        resolve(null);
        return;
      }

      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
      this.isRecording = false;

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        
        // Stop audio tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        
        const previewUrl = URL.createObjectURL(blob);
        resolve({
          segmentId: this.currentSegmentId,
          blob: blob,
          previewUrl: previewUrl
        });
      };

      this.mediaRecorder.stop();
    });
  }

  async uploadVoiceBlob(projectId, segmentId, blob) {
    const formData = new FormData();
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
    formData.append('file', blob, `voice_mic_${segmentId}.${ext}`);

    const res = await fetch(`/api/projects/${projectId}/segments/${segmentId}/upload-voice`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Upload failed");
    }

    return await res.json();
  }

  async uploadCustomFile(projectId, segmentId, file) {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const res = await fetch(`/api/projects/${projectId}/segments/${segmentId}/upload-voice`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Upload failed");
    }

    return await res.json();
  }
}

window.audioRecorder = new AudioRecorderManager();
