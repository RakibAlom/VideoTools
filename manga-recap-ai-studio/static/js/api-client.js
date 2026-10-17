// Robust API Client for MangaRecap AI Studio with Safe Error Handling
async function handleResponse(res, defaultErrMsg = "Request failed") {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    if (!res.ok) {
      throw new Error(`Server Error (${res.status}): ${text.slice(0, 200) || res.statusText || defaultErrMsg}`);
    }
    throw new Error(`Invalid server response: ${text.slice(0, 100)}`);
  }

  if (!res.ok) {
    const msg = data.detail || data.message || defaultErrMsg;
    throw new Error(msg);
  }

  return data;
}

const API = {
  async getConfig() {
    const res = await fetch('/api/config');
    return await handleResponse(res, "Failed to load configuration");
  },

  async saveConfig(config) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return await handleResponse(res, "Failed to save configuration");
  },

  async testConfig(keys = {}) {
    const res = await fetch('/api/config/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keys)
    });
    return await handleResponse(res, "Failed to test configuration");
  },

  async listProjects() {
    const res = await fetch('/api/projects');
    return await handleResponse(res, "Failed to fetch projects list");
  },

  async createProject(data) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await handleResponse(res, "Failed to create project");
  },

  async getProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}`);
    return await handleResponse(res, "Failed to get project details");
  },

  async deleteProject(projectId) {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    return await handleResponse(res, "Failed to delete project");
  },

  async loadDemoProject() {
    const res = await fetch('/api/projects/demo', { method: 'POST' });
    return await handleResponse(res, "Failed to load demo project");
  },

  async uploadFile(projectId, file, pageRange = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (pageRange !== null && pageRange !== undefined) {
      formData.append('page_range', String(pageRange));
      formData.append('max_pages', String(pageRange));
    }
    const res = await fetch(`/api/projects/${projectId}/upload`, {
      method: 'POST',
      body: formData
    });
    return await handleResponse(res, "Upload & panel extraction failed");
  },

  async updatePanels(projectId, panels) {
    const res = await fetch(`/api/projects/${projectId}/panels`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panels })
    });
    return await handleResponse(res, "Failed to update panels");
  },

  async deletePanel(projectId, segmentId) {
    const res = await fetch(`/api/projects/${projectId}/panels/${segmentId}`, {
      method: 'DELETE'
    });
    return await handleResponse(res, "Failed to remove panel");
  },

  async restoreAllPanels(projectId) {
    const res = await fetch(`/api/projects/${projectId}/panels/restore-all`, {
      method: 'POST'
    });
    return await handleResponse(res, "Failed to restore original panels");
  },

  async uploadCustomPanels(projectId, files) {
    const formData = new FormData();
    for (const f of files) {
      formData.append('files', f);
    }
    const res = await fetch(`/api/projects/${projectId}/panels/upload-custom`, {
      method: 'POST',
      body: formData
    });
    return await handleResponse(res, "Failed to upload custom panels");
  },

  async reorderPanels(projectId, orderedSegmentIds) {
    const res = await fetch(`/api/projects/${projectId}/panels/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_segment_ids: orderedSegmentIds })
    });
    return await handleResponse(res, "Failed to reorder panels");
  },

  async getLanguages() {
    const res = await fetch('/api/languages');
    return await handleResponse(res, "Failed to fetch supported languages");
  },

  getVoiceSampleUrl(voiceName = "Charon", provider = "gemini", language = "en") {
    return `/api/voice/sample?voice_name=${encodeURIComponent(voiceName)}&provider=${encodeURIComponent(provider)}&language=${encodeURIComponent(language)}`;
  },

  async previewFrame(projectId, options = {}) {
    const res = await fetch(`/api/projects/${projectId}/preview-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      try {
        const j = JSON.parse(text);
        msg = j.detail || j.message || text;
      } catch (e) {}
      throw new Error(`Frame Preview failed: ${msg}`);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  },

  async generateScript(projectId, customInstructions, internalMangaRef, language = "en") {
    const formData = new FormData();
    if (customInstructions !== undefined && customInstructions !== null) formData.append('custom_instructions', customInstructions);
    if (internalMangaRef !== undefined && internalMangaRef !== null) formData.append('internal_manga_ref', internalMangaRef);
    if (language !== undefined && language !== null) formData.append('language', language);
    const res = await fetch(`/api/projects/${projectId}/generate-script`, {
      method: 'POST',
      body: formData
    });
    return await handleResponse(res, "Script generation failed");
  },

  async updateSegments(projectId, segments) {
    const res = await fetch(`/api/projects/${projectId}/segments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments })
    });
    return await handleResponse(res, "Failed to update segments");
  },

  async synthesizeAll(projectId) {
    const res = await fetch(`/api/projects/${projectId}/synthesize-all`, { method: 'POST' });
    return await handleResponse(res, "Failed to start voice synthesis");
  },

  async synthesizeSegment(projectId, segmentId) {
    const res = await fetch(`/api/projects/${projectId}/segments/${segmentId}/synthesize`, { method: 'POST' });
    return await handleResponse(res, "Segment voice synthesis failed");
  },

  async startRender(projectId, options = {}) {
    const res = await fetch(`/api/projects/${projectId}/render-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });
    return await handleResponse(res, "Failed to start video rendering");
  },

  async generateThumbnail(projectId, hookText, climaxSegmentId = null, theme = "viral_yellow", fontSizePreset = "giant") {
    const res = await fetch(`/api/projects/${projectId}/generate-thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hook_text: hookText,
        climax_segment_id: climaxSegmentId,
        theme: theme,
        font_size_preset: fontSizePreset
      })
    });
    return await handleResponse(res, "Thumbnail generation failed");
  },

  async generateMetadata(projectId) {
    const res = await fetch(`/api/projects/${projectId}/generate-metadata`, { method: 'POST' });
    return await handleResponse(res, "Metadata generation failed");
  },

  pollStatus(projectId, onProgress, onFinish, onError, intervalMs = 1200) {
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      try {
        const proj = await this.getProject(projectId);
        if (onProgress) onProgress(proj);
        
        if (proj.status === 'completed' || proj.status === 'voices_ready') {
          stopped = true;
          if (onFinish) onFinish(proj);
          return;
        } else if (proj.status === 'error') {
          stopped = true;
          if (onError) onError(proj.progress ? proj.progress.message : 'Operation error');
          return;
        }
        setTimeout(check, intervalMs);
      } catch (e) {
        stopped = true;
        if (onError) onError(e.message);
      }
    };
    check();
    return () => { stopped = true; };
  }
};

window.API = API;
