// API Client for VideoRepurpose AI Studio

const API = {
  async getConfig() {
    const res = await fetch("/api/config");
    if (!res.ok) throw new Error("Failed to load configuration");
    return await res.json();
  },

  async updateConfig(payload) {
    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to save configuration");
    return await res.json();
  },

  async getLanguages() {
    const res = await fetch("/api/languages");
    if (!res.ok) throw new Error("Failed to fetch language list");
    return await res.json();
  },

  async testVoice(provider, voiceName, language) {
    const res = await fetch("/api/test-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: provider,
        voice_name: voiceName,
        language: language
      })
    });
    if (!res.ok) throw new Error("Voice sample failed");
    return await res.blob();
  },

  async listProjects() {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error("Failed to fetch projects");
    return await res.json();
  },

  async getProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}`);
    if (!res.ok) throw new Error("Failed to get project");
    return await res.json();
  },

  async updateProjectSettings(projectId, settings) {
    const res = await fetch(`/api/projects/${projectId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error("Failed to update project settings");
    return await res.json();
  },

  async uploadVideo(formData) {
    const res = await fetch("/api/projects/upload", {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Video upload failed");
    }
    return await res.json();
  },

  async transcribe(projectId) {
    const res = await fetch(`/api/projects/${projectId}/transcribe`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Transcription failed");
    }
    return await res.json();
  },

  async rewriteScript(projectId, options = {}) {
    const res = await fetch(`/api/projects/${projectId}/rewrite-script`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Script rewriting failed");
    }
    return await res.json();
  },

  async regenerateSegment(projectId, segmentId) {
    const res = await fetch(`/api/projects/${projectId}/segments/${segmentId}/regenerate`, { method: "POST" });
    if (!res.ok) throw new Error("Regenerate segment failed");
    return await res.json();
  },

  async updateFullScript(projectId, payload) {
    const body = (typeof payload === "string") ? { full_rewritten_text: payload } : payload;
    const res = await fetch(`/api/projects/${projectId}/full-script`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Failed to save full script");
    return await res.json();
  },

  async updateSegment(projectId, segmentId, payload) {
    const body = (typeof payload === "string") ? { rewritten_text: payload } : payload;
    const res = await fetch(`/api/projects/${projectId}/segments/${segmentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("Update segment failed");
    return await res.json();
  },

  async deleteSegment(projectId, segmentId) {
    const res = await fetch(`/api/projects/${projectId}/segments/${segmentId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete segment failed");
    return await res.json();
  },

  async addSegment(projectId, start, end, origText, rewrittenText) {
    const res = await fetch(`/api/projects/${projectId}/segments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end, original_text: origText, rewritten_text: rewrittenText })
    });
    if (!res.ok) throw new Error("Add segment failed");
    return await res.json();
  },

  async updateTimeline(projectId, slices, textOverlays) {
    const res = await fetch(`/api/projects/${projectId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slices, text_overlays: textOverlays })
    });
    if (!res.ok) throw new Error("Update timeline failed");
    return await res.json();
  },

  async previewFrame(projectId, options) {
    const res = await fetch(`/api/projects/${projectId}/preview-frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    if (!res.ok) throw new Error("Preview frame failed");
    return await res.blob();
  },

  async generateAudio(projectId, options = {}) {
    const res = await fetch(`/api/projects/${projectId}/generate-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Audio generation failed");
    }
    return await res.json();
  },

  async startRender(projectId, renderOptions) {
    const res = await fetch(`/api/projects/${projectId}/render-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(renderOptions)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to start render");
    }
    return await res.json();
  },

  async getRenderStatus(projectId) {
    const res = await fetch(`/api/projects/${projectId}/render-status`);
    if (!res.ok) throw new Error("Failed to check render status");
    return await res.json();
  },

  async getVoices(language, provider = "edge_tts") {
    const res = await fetch(`/api/voices?language=${encodeURIComponent(language || 'en')}&provider=${encodeURIComponent(provider || 'edge_tts')}`);
    if (!res.ok) throw new Error("Failed to load voices");
    return await res.json();
  },

  async testElevenLabs(apiKey = "") {
    const res = await fetch("/api/settings/test-elevenlabs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey })
    });
    if (!res.ok) throw new Error("ElevenLabs test request failed");
    return await res.json();
  },

  async testGemini(apiKey = "", model = "") {
    const res = await fetch("/api/settings/test-gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, model: model })
    });
    if (!res.ok) throw new Error("Gemini test request failed");
    return await res.json();
  },

  async uploadWatermarkImage(projectId, file) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/projects/${projectId}/watermark-image`, {
      method: "POST",
      body: fd
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to upload watermark image");
    }
    return await res.json();
  }
};
