import os
import re
import time
import json
import uuid
import shutil
import asyncio
import threading
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Query, Body
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.config import load_config, save_config, AppConfig
from app.languages import get_all_languages_list, get_language_info
from app.audio_transcriber import (
    extract_audio_from_video,
    transcribe_audio_gemini,
    transcribe_audio_free_stt,
    get_media_duration
)
from app.script_rewriter import (
    rewrite_script_with_gemini,
    rewrite_single_segment,
    rewrite_full_continuous_script,
    build_teleprompter_script_from_segments
)
from app.tts_engine import (
    generate_segment_voice,
    generate_voice_sample,
    synthesize_continuous_story_audio,
    synthesize_time_synced_dubbing_audio,
    EDGE_TTS_VOICE_MAP,
    ELEVENLABS_VOICE_MAP
)
from app.bgm_manager import (
    generate_synthesized_bgm,
    mix_voice_and_bgm,
    build_atempo_filter,
    adjust_audio_speed
)
from app.video_transformer import (
    get_video_metadata,
    render_preview_frame,
    render_repurposed_video
)
from app.packaging_generator import (
    capture_dramatic_thumbnail_frame,
    generate_high_ctr_thumbnail,
    generate_youtube_packaging_metadata
)
from app.project_manager import ProjectManager

app = FastAPI(title="VideoRepurpose AI Studio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def setup_event_loop_exception_handler():
    try:
        loop = asyncio.get_running_loop()
        default_handler = loop.get_exception_handler()
        def custom_handler(loop, context):
            exc = context.get("exception")
            if isinstance(exc, ConnectionResetError) or (exc and "10054" in str(exc)):
                return
            if default_handler:
                default_handler(loop, context)
            else:
                loop.default_exception_handler(context)
        loop.set_exception_handler(custom_handler)
    except Exception as e:
        print(f"[Startup Exception Handler Warning] {e}")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
UPLOADS_DIR = BASE_DIR / "uploads"
PROJECTS_DIR = BASE_DIR / "projects"
EXPORTS_DIR = BASE_DIR / "exports"

for d in [STATIC_DIR, UPLOADS_DIR, PROJECTS_DIR, EXPORTS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/projects", StaticFiles(directory=str(PROJECTS_DIR)), name="projects")
app.mount("/exports", StaticFiles(directory=str(EXPORTS_DIR)), name="exports")

# In-memory render progress tracker
RENDER_TASKS: Dict[str, Dict[str, Any]] = {}


# --- Pydantic Schemas ---
class ConfigUpdateSchema(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    default_voice_provider: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    rewrite_tone: Optional[str] = None
    custom_instructions: Optional[str] = None
    edge_tts_voice_en: Optional[str] = None
    edge_tts_voice_hi: Optional[str] = None
    edge_tts_voice_bn: Optional[str] = None
    edge_tts_voice_ur: Optional[str] = None
    edge_tts_voice_es: Optional[str] = None
    anti_copyright_mirror: Optional[bool] = None
    anti_copyright_speed: Optional[float] = None
    anti_copyright_grain: Optional[bool] = None
    anti_copyright_vignette: Optional[bool] = None
    anti_copyright_color_grade: Optional[str] = None
    anti_copyright_micro_crop: Optional[bool] = None
    aspect_ratio: Optional[str] = None
    framing_style: Optional[str] = None
    enable_watermark_removal: Optional[bool] = None
    watermark_delogo_box: Optional[Dict[str, Any]] = None
    enable_custom_watermark: Optional[bool] = None
    custom_watermark_text: Optional[str] = None
    custom_watermark_position: Optional[str] = None
    custom_watermark_opacity: Optional[float] = None
    custom_watermark_font_size: Optional[int] = None
    bgm_preset: Optional[str] = None
    bgm_volume_db: Optional[float] = None
    export_quality: Optional[str] = None
    export_fps: Optional[int] = None


class TestVoiceRequest(BaseModel):
    provider: str = "edge_tts"
    voice_name: str = "Christopher"
    language: str = "en"


class ProjectSettingsUpdate(BaseModel):
    title: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    tone: Optional[str] = None
    custom_instructions: Optional[str] = None
    duration_shift: Optional[float] = None
    voice_provider: Optional[str] = None
    narrator_voice: Optional[str] = None


class RewriteScriptRequest(BaseModel):
    target_language: Optional[str] = None
    tone: Optional[str] = None
    custom_instructions: Optional[str] = None
    duration_shift: Optional[float] = None
    target_duration: Optional[float] = None


class UpdateFullScriptRequest(BaseModel):
    full_rewritten_text: Optional[str] = None
    full_original_text: Optional[str] = None
    script_mode: Optional[str] = None


class UpdateSegmentRequest(BaseModel):
    rewritten_text: Optional[str] = None
    original_text: Optional[str] = None


class AddSegmentRequest(BaseModel):
    start: float
    end: float
    original_text: str = ""
    rewritten_text: str = ""


class TimelineUpdateRequest(BaseModel):
    slices: List[Dict[str, float]] = []
    text_overlays: List[Dict[str, Any]] = []


class PreviewFrameRequest(BaseModel):
    time_sec: float = 2.0
    aspect_ratio: str = "16:9"
    quality: str = "720p"
    framing_style: str = "blur_background"
    mirror: bool = True
    grain: bool = True
    vignette: bool = True
    color_grade: str = "cinematic_warm"
    micro_crop: Optional[bool] = True
    delogo_box: Optional[Dict[str, Any]] = None
    custom_watermark: Optional[Dict[str, Any]] = None
    highlight_delogo: Optional[bool] = False


class GenerateAudioRequest(BaseModel):
    voice_provider: Optional[str] = "edge_tts"
    voice_name: Optional[str] = None
    bgm_preset: Optional[str] = None
    bgm_volume_db: Optional[float] = None
    voice_speed: Optional[float] = None
    sync_mode: Optional[str] = "fit_to_video"
    duration_shift: Optional[float] = None


class StartRenderRequest(BaseModel):
    aspect_ratio: str = "16:9"
    quality: str = "1080p"
    fps: int = 30
    framing_style: str = "blur_background"
    mirror: bool = True
    speed: float = 1.00
    grain: bool = True
    vignette: bool = True
    color_grade: str = "cinematic_warm"
    micro_crop: Optional[bool] = True
    delogo_box: Optional[Dict[str, Any]] = None
    custom_watermark: Optional[Dict[str, Any]] = None
    duration_shift: Optional[float] = None
    bgm_preset: str = "ambient"
    bgm_volume_db: float = -20.0
    voice_provider: Optional[str] = None
    narrator_voice: Optional[str] = None
    sync_mode: Optional[str] = None


class TestElevenLabsRequest(BaseModel):
    api_key: Optional[str] = None


class TestGeminiRequest(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = "gemini-4-argon"


# --- App Routes ---

@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    if not index_file.exists():
        return JSONResponse({"status": "VideoRepurpose AI Studio is running", "endpoints": "/api/config"})
    return FileResponse(index_file)


@app.get("/api/config")
def get_config_endpoint():
    cfg = load_config()
    d = cfg.model_dump()
    d["gemini_api_key_masked"] = cfg.gemini_api_key_masked
    d["elevenlabs_api_key_masked"] = cfg.elevenlabs_api_key_masked
    d["has_gemini_key"] = cfg.has_gemini_key
    d["has_elevenlabs_key"] = cfg.has_elevenlabs_key
    return d


@app.post("/api/config")
def update_config_endpoint(payload: ConfigUpdateSchema):
    cfg = load_config()
    for field, val in payload.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(cfg, field, val)
    save_config(cfg)
    return {"status": "success", "config": get_config_endpoint()}


@app.post("/api/settings/test-elevenlabs")
def test_elevenlabs_endpoint(req: TestElevenLabsRequest):
    cfg = load_config()
    key = (req.api_key or "").strip() or cfg.elevenlabs_api_key
    from app.tts_engine import test_elevenlabs_connection
    return test_elevenlabs_connection(key)


@app.post("/api/settings/test-gemini")
def test_gemini_endpoint(req: TestGeminiRequest):
    cfg = load_config()
    key = (req.api_key or "").strip() or cfg.gemini_api_key
    model = (req.model or "").strip() or cfg.gemini_model or "gemini-4-argon"
    from app.tts_engine import test_gemini_connection
    return test_gemini_connection(key, model)


@app.get("/api/languages")
def get_languages_endpoint():
    return {
        "languages": get_all_languages_list(),
        "edge_voices": EDGE_TTS_VOICE_MAP,
        "elevenlabs_voices": ELEVENLABS_VOICE_MAP
    }


@app.post("/api/test-voice")
def test_voice_endpoint(req: TestVoiceRequest):
    cfg = load_config()
    temp_dir = BASE_DIR / "assets" / "samples"
    temp_dir.mkdir(parents=True, exist_ok=True)
    out_file = temp_dir / f"test_{req.provider}_{req.voice_name}_{uuid.uuid4().hex[:6]}.mp3"

    try:
        generate_voice_sample(
            provider=req.provider,
            voice_name=req.voice_name,
            output_path=out_file,
            language=req.language,
            elevenlabs_api_key=cfg.elevenlabs_api_key
        )
        return FileResponse(out_file, media_type="audio/mpeg", filename="voice_sample.mp3")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice sample generation failed: {e}")


@app.get("/api/projects")
def list_projects_endpoint():
    return {"projects": ProjectManager.list_projects()}


@app.post("/api/projects/upload")
async def upload_video_project(
    video: UploadFile = File(...),
    title: Optional[str] = Form(None),
    source_language: str = Form("auto"),
    target_language: str = Form("en"),
    tone: str = Form("storyteller"),
    custom_instructions: str = Form("")
):
    safe_filename = video.filename.replace(" ", "_")
    project = ProjectManager.create_project(
        title=title or Path(safe_filename).stem,
        video_filename=safe_filename,
        source_lang=source_language,
        target_lang=target_language,
        tone=tone,
        custom_instructions=custom_instructions
    )
    p_id = project["id"]
    p_dir = ProjectManager.get_project_dir(p_id)

    # Save uploaded video (16MB chunk buffer for smooth high-speed transfer of up to 30GB master files)
    dest_video = p_dir / "source_video.mp4"
    with open(dest_video, "wb") as f:
        shutil.copyfileobj(video.file, f, length=16 * 1024 * 1024)

    # Inspect video metadata & compute anti-copyright target duration
    meta = get_video_metadata(dest_video)
    project["video_metadata"] = meta
    orig_dur = float(meta.get("duration", 0.0))
    project["source_duration"] = round(orig_dur, 2)
    project["duration_shift"] = -3.0
    project["target_video_duration"] = round(max(2.0, orig_dur - 3.0), 2)

    # Extract 16kHz audio track
    audio_path = p_dir / "extracted_audio.mp3"
    try:
        extract_audio_from_video(dest_video, audio_path)
        project["audio_extracted"] = True
    except Exception as e:
        print(f"[Upload] Audio extract error: {e}")
        project["audio_extracted"] = False

    ProjectManager.save_project(p_id, project)
    return project


@app.get("/api/projects/{project_id}")
def get_project_endpoint(project_id: str):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return p


@app.post("/api/projects/{project_id}/transcribe")
def transcribe_project_endpoint(project_id: str):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    p_dir = ProjectManager.get_project_dir(project_id)
    audio_path = p_dir / "extracted_audio.mp3"
    if not audio_path.exists():
        src_video = p_dir / "source_video.mp4"
        if src_video.exists():
            extract_audio_from_video(src_video, audio_path)
        else:
            raise HTTPException(status_code=400, detail="Audio track not found")

    cfg = load_config()
    source_hint = p.get("source_language", "auto")

    try:
        if cfg.has_gemini_key:
            res = transcribe_audio_gemini(
                audio_path=audio_path,
                api_key=cfg.gemini_api_key,
                model_name=cfg.gemini_model,
                source_language_hint=source_hint
            )
        else:
            res = transcribe_audio_free_stt(audio_path=audio_path, source_language_hint=source_hint)
    except Exception as e:
        print(f"[Transcribe] Gemini failed ({e}), using Google STT")
        res = transcribe_audio_free_stt(audio_path=audio_path, source_language_hint=source_hint)

    p["detected_language"] = res.get("detected_language", "en")
    p["detected_language_name"] = res.get("detected_language_name", "English")
    p["full_original_text"] = res.get("full_original_text", "")
    p["segments"] = res.get("segments", [])
    p["status"] = "transcribed"
    ProjectManager.save_project(project_id, p)
    return p


@app.patch("/api/projects/{project_id}/settings")
def update_project_settings_endpoint(project_id: str, req: ProjectSettingsUpdate):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    for k, v in req.model_dump(exclude_unset=True).items():
        if v is not None:
            p[k] = v
    if req.duration_shift is not None:
        p["duration_shift"] = float(req.duration_shift)
        src_d = float(p.get("source_duration") or 0.0)
        if src_d > 0:
            p["target_video_duration"] = round(max(2.0, src_d + p["duration_shift"]), 2)
    ProjectManager.save_project(project_id, p)
    return p


def _sync_segments_from_continuous_text(segments: List[Dict[str, Any]], full_text: str):
    """Distributes the continuous script across timeline segments respecting sentence and clause boundaries."""
    if not segments or not full_text:
        return

    # Split text into natural sentence or punctuation-delimited clauses
    raw_units = re.split(r'([।\.!\?\n]+)', full_text)
    units = []
    for i in range(0, len(raw_units) - 1, 2):
        chunk = (raw_units[i] + raw_units[i+1]).strip()
        if chunk:
            units.append(chunk)
    if len(raw_units) % 2 == 1 and raw_units[-1].strip():
        units.append(raw_units[-1].strip())

    if not units:
        units = [u.strip() for u in full_text.split() if u.strip()]

    durations = [max(0.5, float(s.get("end", 0)) - float(s.get("start", 0))) for s in segments]
    total_dur = sum(durations)
    if total_dur <= 0.1:
        total_dur = float(len(segments))
        durations = [1.0] * len(segments)

    unit_lengths = [max(1, len(u.split())) for u in units]
    total_units_len = sum(unit_lengths)

    unit_cursor = 0
    cumulative_dur = 0.0

    for idx, seg in enumerate(segments):
        cumulative_dur += durations[idx]
        if idx == len(segments) - 1:
            next_cursor = len(units)
        else:
            target_pct = cumulative_dur / total_dur
            target_words = target_pct * total_units_len
            
            acc_words = sum(unit_lengths[:unit_cursor])
            best_cursor = unit_cursor
            for u_i in range(unit_cursor, len(units)):
                acc_words += unit_lengths[u_i]
                best_cursor = u_i + 1
                if acc_words >= target_words:
                    break
            next_cursor = min(len(units), best_cursor)

        seg_units = units[unit_cursor:next_cursor]
        if seg_units:
            seg["rewritten_text"] = " ".join(seg_units).strip()
        else:
            seg["rewritten_text"] = ""
        unit_cursor = next_cursor


@app.post("/api/projects/{project_id}/rewrite-script")
def rewrite_script_endpoint(project_id: str, req: Optional[RewriteScriptRequest] = None):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    cfg = load_config()
    if req:
        if req.target_language:
            p["target_language"] = req.target_language
        if req.tone:
            p["tone"] = req.tone
        if req.custom_instructions is not None:
            p["custom_instructions"] = req.custom_instructions
        if req.duration_shift is not None:
            p["duration_shift"] = float(req.duration_shift)
            src_d = float(p.get("source_duration") or 0.0)
            if src_d > 0:
                p["target_video_duration"] = round(max(2.0, src_d + p["duration_shift"]), 2)
        elif req.target_duration is not None and req.target_duration > 0:
            p["target_video_duration"] = round(float(req.target_duration), 2)

    source_lang = p.get("detected_language") or p.get("source_language", "en")
    target_lang = p.get("target_language", "en")
    tone = p.get("tone", "storyteller")
    custom_inst = p.get("custom_instructions", "")

    # Calculate target duration for strict storytelling word count calibration
    src_dur = float(p.get("source_duration") or 0.0)
    dur_shift = float(p.get("duration_shift", -3.0))
    target_dur = float(p.get("target_video_duration") or (max(2.0, src_dur + dur_shift) if src_dur > 0 else 0.0))
    p["target_video_duration"] = round(target_dur, 2)
    p["duration_shift"] = dur_shift

    # 1. Rewrite the complete continuous story script with Gemini in natural teleprompter style
    orig_full = (p.get("full_original_text") or "").strip()
    if not orig_full:
        segs = p.get("segments", [])
        orig_full = " ".join(s.get("original_text", "") for s in segs if not s.get("original_text", "").startswith("[")).strip()
        p["full_original_text"] = orig_full

    full_rewritten = rewrite_full_continuous_script(
        full_text=orig_full,
        source_language=source_lang,
        target_language=target_lang,
        tone=tone,
        custom_instructions=custom_inst,
        target_duration=target_dur,
        api_key=cfg.gemini_api_key,
        model_name=cfg.gemini_model
    )
    p["full_rewritten_text"] = full_rewritten
    p["script_mode"] = "full_continuous"

    if p.get("segments") and full_rewritten:
        _sync_segments_from_continuous_text(p["segments"], full_rewritten)

    # Invalidate old audio so fresh voiceover is synthesized from the newly remastered script
    p_dir = ProjectManager.get_project_dir(project_id)
    for old_audio in ["full_narration.mp3", "master_audio.mp3", "speed_adjusted_narration.mp3", "master_audio_synced.mp3", "master_audio_padded.mp3", "bgm_raw.mp3"]:
        f_p = p_dir / old_audio
        if f_p.exists():
            try:
                f_p.unlink()
            except Exception:
                pass
    p["audio_generated"] = False
    p["status"] = "script_rewritten"
    ProjectManager.save_project(project_id, p)
    return p


@app.put("/api/projects/{project_id}/full-script")
def update_full_script_endpoint(project_id: str, req: UpdateFullScriptRequest):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    if req.full_original_text is not None:
        p["full_original_text"] = req.full_original_text.strip()

    if req.script_mode is not None:
        p["script_mode"] = req.script_mode

    if req.full_rewritten_text is not None:
        clean_text = req.full_rewritten_text.strip()
        p["full_rewritten_text"] = clean_text
        p["script_mode"] = "full_continuous"

        if p.get("segments") and clean_text:
            _sync_segments_from_continuous_text(p["segments"], clean_text)

        # Clear old audio files so that freshly edited commentary is synthesized immediately
        p_dir = ProjectManager.get_project_dir(project_id)
        for old_audio in ["full_narration.mp3", "master_audio.mp3", "speed_adjusted_narration.mp3", "master_audio_synced.mp3", "master_audio_padded.mp3", "bgm_raw.mp3"]:
            f_p = p_dir / old_audio
            if f_p.exists():
                try:
                    f_p.unlink()
                except Exception:
                    pass
        p["audio_generated"] = False

    ProjectManager.save_project(project_id, p)
    return p


@app.post("/api/projects/{project_id}/segments/{segment_id}/regenerate")
def regenerate_single_segment_endpoint(project_id: str, segment_id: int):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    target_seg = next((s for s in p.get("segments", []) if s.get("segment_id") == segment_id), None)
    if not target_seg:
        raise HTTPException(status_code=404, detail="Segment not found")

    cfg = load_config()
    new_text = rewrite_single_segment(
        segment=target_seg,
        source_language=p.get("detected_language") or p.get("source_language", "en"),
        target_language=p.get("target_language", "en"),
        tone=p.get("tone", "storyteller"),
        custom_instructions=p.get("custom_instructions", ""),
        api_key=cfg.gemini_api_key,
        model_name=cfg.gemini_model
    )

    target_seg["rewritten_text"] = new_text
    ProjectManager.save_project(project_id, p)
    return {"segment_id": segment_id, "rewritten_text": new_text}


@app.put("/api/projects/{project_id}/segments/{segment_id}")
def update_segment_endpoint(project_id: str, segment_id: int, req: UpdateSegmentRequest):
    updated = ProjectManager.update_segment_text(
        project_id,
        segment_id,
        rewritten_text=req.rewritten_text,
        original_text=req.original_text
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Segment or project not found")
    return {"status": "success", "segments": updated["segments"]}


@app.delete("/api/projects/{project_id}/segments/{segment_id}")
def delete_segment_endpoint(project_id: str, segment_id: int):
    updated = ProjectManager.delete_segment(project_id, segment_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Segment or project not found")
    return {"status": "success", "segments": updated["segments"]}


@app.post("/api/projects/{project_id}/segments")
def add_segment_endpoint(project_id: str, req: AddSegmentRequest):
    updated = ProjectManager.add_segment(project_id, req.start, req.end, req.original_text, req.rewritten_text)
    if not updated:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "success", "segments": updated["segments"]}


@app.post("/api/projects/{project_id}/timeline")
def update_timeline_endpoint(project_id: str, req: TimelineUpdateRequest):
    updated = ProjectManager.update_timeline_state(project_id, req.slices, req.text_overlays)
    if not updated:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"status": "success"}


@app.get("/api/voices")
def get_voices_endpoint(language: str = "en", provider: str = "edge_tts"):
    cfg = load_config()
    if provider == "elevenlabs":
        from app.tts_engine import get_elevenlabs_voices
        return {"voices": get_elevenlabs_voices(api_key=cfg.elevenlabs_api_key, language=language)}
    else:
        from app.tts_engine import get_voices_for_language
        return {"voices": get_voices_for_language(language)}


@app.get("/api/bgm-preview/{preset}")
def get_bgm_preview_endpoint(preset: str):
    from app.bgm_manager import get_bgm_preview
    sample = get_bgm_preview(preset)
    if not sample.exists():
        raise HTTPException(status_code=404, detail="BGM preset preview not found")
    return FileResponse(sample, media_type="audio/mpeg")


@app.post("/api/projects/{project_id}/watermark-image")
async def upload_watermark_image_endpoint(project_id: str, file: UploadFile = File(...)):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    p_dir = ProjectManager.get_project_dir(project_id)
    ext = Path(file.filename).suffix.lower() if file.filename else ".png"
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        ext = ".png"
    dest = p_dir / f"watermark_custom{ext}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    p["watermark_image_path"] = str(dest.resolve())
    ProjectManager.save_project(project_id, p)
    return {
        "status": "success",
        "image_path": str(dest.resolve()),
        "url": f"/projects/{project_id}/{dest.name}"
    }


@app.post("/api/projects/{project_id}/preview-frame")
def preview_frame_endpoint(project_id: str, req: PreviewFrameRequest):
    p_dir = ProjectManager.get_project_dir(project_id)
    src_video = p_dir / "source_video.mp4"
    if not src_video.exists():
        raise HTTPException(status_code=404, detail="Source video not found")

    out_frame = p_dir / "preview_frame.jpg"
    delogo = dict(req.delogo_box) if req.delogo_box else None
    if delogo and req.highlight_delogo:
        delogo["show_target_box"] = True

    wm = dict(req.custom_watermark) if req.custom_watermark else None
    if wm and wm.get("enabled"):
        if wm.get("type") == "image" and not wm.get("image_path"):
            p = ProjectManager.get_project(project_id)
            if p and p.get("watermark_image_path"):
                wm["image_path"] = p.get("watermark_image_path")

    try:
        render_preview_frame(
            video_path=src_video,
            output_image_path=out_frame,
            time_sec=req.time_sec,
            aspect_ratio=req.aspect_ratio,
            quality=req.quality,
            framing_style=req.framing_style,
            mirror=req.mirror,
            grain=req.grain,
            vignette=req.vignette,
            color_grade=req.color_grade,
            micro_crop=req.micro_crop if req.micro_crop is not None else True,
            delogo_box=delogo,
            custom_watermark=wm
        )
        return FileResponse(out_frame, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame preview failed: {e}")


@app.post("/api/projects/{project_id}/generate-audio")
def generate_audio_endpoint(project_id: str, req: Optional[GenerateAudioRequest] = None, progress_reporter: Optional[Any] = None):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    cfg = load_config()
    p_dir = ProjectManager.get_project_dir(project_id)

    target_lang = p.get("target_language", "en")
    if target_lang == "same_rewrite":
        target_lang = p.get("detected_language") or "en"

    # Select appropriate voice (respect user's choice)
    req_obj = req if isinstance(req, GenerateAudioRequest) else None
    voice_provider = (req_obj.voice_provider if req_obj and req_obj.voice_provider else None) or p.get("voice_provider") or cfg.default_voice_provider
    p["voice_provider"] = voice_provider
    voice_name = (req_obj.voice_name if req_obj and req_obj.voice_name else None) or p.get("narrator_voice")
    if not voice_name:
        if voice_provider == "elevenlabs":
            voice_name = "Prem" if target_lang == "hi" else "Adam"
        elif target_lang == "hi":
            voice_name = "Madhur"
        elif target_lang == "bn":
            voice_name = "Pradeep"
        elif target_lang == "ur":
            voice_name = "Asad"
        elif target_lang == "es":
            voice_name = "Alvaro"
        elif target_lang == "ja":
            voice_name = "Keita"
        else:
            voice_name = "Christopher"
    p["narrator_voice"] = voice_name

    full_narration = p_dir / "full_narration.mp3"
    src_video = p_dir / "source_video.mp4"
    vid_dur = get_media_duration(src_video) if src_video.exists() else 0.0

    sync_mode = (req_obj.sync_mode if req_obj and req_obj.sync_mode else None) or p.get("sync_mode") or "fit_to_video"
    p["sync_mode"] = sync_mode

    if sync_mode == "exact_timeline":
        segs = p.get("segments", [])
        if not segs:
            raise HTTPException(
                status_code=400,
                detail="Cannot synthesize time-synced dubbing: No speech segments found. Please transcribe the video first."
            )
        print(f"[AudioGen] Synthesizing 1:1 time-synced dubbing for {len(segs)} segments with {voice_provider} ({voice_name}) in {target_lang.upper()}...")
        if progress_reporter:
            progress_reporter(20, f"Synthesizing 1:1 scene-synchronized voiceover ({len(segs)} scenes, {target_lang.upper()})...")

        synthesize_time_synced_dubbing_audio(
            segments=segs,
            total_duration=vid_dur,
            output_path=full_narration,
            provider=voice_provider,
            voice_name=voice_name,
            language=target_lang,
            elevenlabs_api_key=cfg.elevenlabs_api_key,
            progress_reporter=progress_reporter
        )

        if not full_narration.exists() or full_narration.stat().st_size < 1000:
            raise HTTPException(status_code=500, detail="Time-synced dubbing synthesis failed to produce master audio track.")

        raw_voice_dur = get_media_duration(full_narration)
        target_voice_speed = 1.0
        active_voice_track = full_narration
        p["duration_shift"] = 0.0
    else:
        # 1. OBTAIN FULL CONTINUOUS STORY SCRIPT
        # The user creates or updates the Remastered & Translated Story Script in Step 2.
        # We voice this EXACT script from start to finish - NO timestamps, NO chopping, NO scene bounds!
        script_text = (p.get("full_rewritten_text") or "").strip()
        if not script_text:
            script_text = (p.get("full_original_text") or "").strip()
        if not script_text:
            segs = p.get("segments", [])
            script_text = " ".join(
                (s.get("rewritten_text") or s.get("original_text") or "")
                for s in segs
                if not s.get("original_text", "").startswith("[")
            ).strip()

        if not script_text:
            raise HTTPException(
                status_code=400,
                detail="Cannot synthesize audio: Full continuous story script is empty. Please enter or rewrite your script in Step 2."
            )

        print(f"[AudioGen] Synthesizing continuous story voice from full script ({len(script_text)} chars) with {voice_provider} ({voice_name}) in {target_lang.upper()}...")
        if progress_reporter:
            progress_reporter(20, f"Synthesizing complete voiceover from remastered story script ({target_lang.upper()})...")

        # 2. SYNTHESIZE FULL SCRIPT CONTINUOUSLY
        synthesize_continuous_story_audio(
            full_script_text=script_text,
            output_path=full_narration,
            provider=voice_provider,
            voice_name=voice_name,
            language=target_lang,
            elevenlabs_api_key=cfg.elevenlabs_api_key,
            progress_reporter=progress_reporter
        )

        if not full_narration.exists() or full_narration.stat().st_size < 1000:
            raise HTTPException(status_code=500, detail="Voice synthesis failed to produce master narration track.")

        raw_voice_dur = get_media_duration(full_narration)
        print(f"[AudioGen] Voice synthesized successfully. Duration: {raw_voice_dur:.2f}s, Source Video: {vid_dur:.2f}s")

        # Determine voice speed and timeline synchronization
        # The script word count has already been budgeted to the target duration (e.g. video - 3s).
        # Voice speed is strictly clamped to a natural, charismatic human storytelling pace (0.96x - 1.06x max).
        # NEVER rush or chipmunk the narrator's voice!
        dur_shift = float(req_obj.duration_shift if req_obj and req_obj.duration_shift is not None else p.get("duration_shift", -3.0))
        target_vid_dur = float(p.get("target_video_duration") or (max(2.0, vid_dur + dur_shift) if vid_dur > 0 else vid_dur))

        custom_voice_speed = req_obj.voice_speed if (req_obj and req_obj.voice_speed and req_obj.voice_speed > 0) else None

        if custom_voice_speed:
            target_voice_speed = round(custom_voice_speed, 3)
        elif sync_mode == "fit_to_video" and target_vid_dur > 2.0 and raw_voice_dur > 2.0:
            ratio = raw_voice_dur / target_vid_dur
            if abs(ratio - 1.0) > 0.01:
                target_voice_speed = max(0.90, min(1.18, round(ratio, 3)))
            else:
                target_voice_speed = 1.0
        else:
            target_voice_speed = 1.0

        active_voice_track = full_narration
        if abs(target_voice_speed - 1.0) > 0.02:
            if progress_reporter:
                progress_reporter(58, f"Syncing narration tempo ({target_voice_speed:.2f}x) at natural storytelling pace...")
            speed_adjusted_narration = p_dir / "speed_adjusted_narration.mp3"
            adjust_audio_speed(full_narration, speed_adjusted_narration, target_voice_speed)
            if speed_adjusted_narration.exists() and speed_adjusted_narration.stat().st_size > 5000:
                active_voice_track = speed_adjusted_narration

    if progress_reporter:
        progress_reporter(64, "Mixing atmospheric background bed with vocal ducking...")

    final_audio_dur = get_media_duration(active_voice_track)

    p["raw_voice_duration"] = round(raw_voice_dur, 2)
    p["voice_duration"] = round(final_audio_dur, 2)
    p["voice_speed"] = target_voice_speed
    p["source_duration"] = round(vid_dur, 2)
    p["auto_matched_video_speed"] = 1.0
    p["speed"] = 1.0
    p["sync_mode"] = sync_mode

    bgm_preset = (req_obj.bgm_preset if req_obj and req_obj.bgm_preset else None) or cfg.bgm_preset or "ambient"
    bgm_vol = (req_obj.bgm_volume_db if req_obj and req_obj.bgm_volume_db is not None else None) or cfg.bgm_volume_db or -20.0

    bgm_path = p_dir / "bgm_bed.mp3"
    generate_synthesized_bgm(bgm_preset, final_audio_dur, bgm_path)

    master_audio = p_dir / "master_audio.mp3"
    mix_voice_and_bgm(active_voice_track, bgm_path, master_audio, bgm_volume_db=bgm_vol)

    p["status"] = "audio_generated"
    p["audio_generated"] = True
    ProjectManager.save_project(project_id, p)
    return {
        "status": "success",
        "audio_file": master_audio.name,
        "voice_duration": p["voice_duration"],
        "raw_voice_duration": p["raw_voice_duration"],
        "voice_speed": target_voice_speed,
        "source_duration": p["source_duration"],
        "auto_matched_video_speed": 1.0,
        "sync_mode": sync_mode
    }


def _render_worker(project_id: str, req_data: Dict[str, Any]):
    def update_progress(pct: int, msg: str):
        RENDER_TASKS[project_id] = {"status": "rendering", "progress": pct, "message": msg}

    try:
        update_progress(10, "Initializing audio and visual remaster pipelines...")
        p = ProjectManager.get_project(project_id)
        p_dir = ProjectManager.get_project_dir(project_id)
        src_video = p_dir / "source_video.mp4"
        master_audio = p_dir / "master_audio.mp3"

        # Auto-recovery: If script is empty, transcribe dialog and rewrite story script automatically
        script_text = (p.get("full_rewritten_text") or p.get("full_original_text") or "").strip()
        if not script_text and not p.get("segments"):
            update_progress(12, "Extracting dialog audio & transcribing speech...")
            try:
                transcribe_project_endpoint(project_id)
                p = ProjectManager.get_project(project_id)
            except Exception as e:
                print(f"[Render Worker Auto-Transcribe Error] {e}")

        script_text = (p.get("full_rewritten_text") or "").strip()
        if not script_text:
            orig_text = (p.get("full_original_text") or "").strip()
            if not orig_text and p.get("segments"):
                orig_text = " ".join(s.get("original_text", "") for s in p["segments"] if not s.get("original_text", "").startswith("[")).strip()
            if orig_text:
                update_progress(16, "Synthesizing continuous story narration script with AI...")
                try:
                    target_lang = req_data.get("target_language") or p.get("target_language") or "en"
                    rewrite_script_endpoint(project_id, RewriteScriptRequest(
                        source_language=p.get("detected_language") or p.get("source_language", "en"),
                        target_language=target_lang,
                        tone=p.get("tone", "storyteller")
                    ))
                    p = ProjectManager.get_project(project_id)
                except Exception as e:
                    print(f"[Render Worker Auto-Rewrite Error] {e}")

        needs_synth = False
        if not master_audio.exists() or master_audio.stat().st_size < 10000:
            needs_synth = True
        elif get_media_duration(master_audio) < 2.0:
            needs_synth = True
        elif not p.get("audio_generated", False):
            needs_synth = True

        if needs_synth:
            update_progress(20, "Synthesizing voice narration & atmospheric bed...")
            audio_req = GenerateAudioRequest(
                voice_provider=req_data.get("voice_provider") or p.get("voice_provider") or "edge_tts",
                voice_name=req_data.get("narrator_voice") or p.get("narrator_voice"),
                bgm_preset=req_data.get("bgm_preset", "ambient"),
                bgm_volume_db=req_data.get("bgm_volume_db", -20.0),
                sync_mode=req_data.get("sync_mode") or p.get("sync_mode") or "fit_to_video",
                duration_shift=req_data.get("duration_shift") if req_data.get("duration_shift") is not None else float(p.get("duration_shift", 0.0))
            )
            synth_err = None
            try:
                generate_audio_endpoint(project_id, req=audio_req, progress_reporter=update_progress)
            except Exception as e:
                synth_err = str(e)
                print(f"[Render Worker Audio Gen Warning] {e}")
            master_audio = p_dir / "master_audio.mp3"
            p = ProjectManager.get_project(project_id)

        if not master_audio.exists() or master_audio.stat().st_size < 1000:
            err_msg = f"Master narration voiceover track could not be synthesized: {synth_err}" if synth_err else "Master narration voiceover track could not be synthesized. Please verify your story script in Step 2."
            raise RuntimeError(err_msg)

        def on_video_progress(render_pct: float, cur_sec: float, total_sec: float, speed_str: str):
            mapped_pct = 68 + int(0.24 * (render_pct / 100.0) * 100)
            m_cur, s_cur = divmod(int(cur_sec), 60)
            m_tot, s_tot = divmod(int(total_sec), 60)
            msg = f"Rendering 1080p video: {m_cur:02d}:{s_cur:02d} / {m_tot:02d}:{s_tot:02d} ({render_pct:.0f}%, speed: {speed_str})..."
            update_progress(mapped_pct, msg)

        update_progress(68, "Rendering video with anti-copyright filters, delogo, and color grade...")
        out_video = p_dir / f"repurposed_video_{project_id}.mp4"

        wm = dict(req_data.get("custom_watermark")) if req_data.get("custom_watermark") else None
        if wm and wm.get("enabled"):
            if wm.get("type") == "image" and not wm.get("image_path"):
                if p.get("watermark_image_path"):
                    wm["image_path"] = p.get("watermark_image_path")

        is_exact = (req_data.get("sync_mode") == "exact_timeline") or (p.get("sync_mode") == "exact_timeline")
        render_speed = req_data.get("speed")
        if render_speed is not None:
            try:
                render_speed = float(render_speed)
                if render_speed < 0.5 or render_speed > 2.5:
                    render_speed = 1.00 if is_exact else 1.04
            except (ValueError, TypeError):
                render_speed = 1.00 if is_exact else 1.04
        else:
            render_speed = 1.00 if is_exact else float(p.get("speed") or cfg.anti_copyright_speed or 1.04)

        duration_shift = req_data.get("duration_shift")
        if duration_shift is not None:
            try:
                duration_shift = float(duration_shift)
            except (ValueError, TypeError):
                duration_shift = 0.0 if is_exact else float(p.get("duration_shift", -3.0))
        else:
            duration_shift = 0.0 if is_exact else float(p.get("duration_shift", -3.0))

        render_repurposed_video(
            video_path=src_video,
            audio_track=master_audio,
            output_video_path=out_video,
            aspect_ratio=req_data.get("aspect_ratio", "16:9"),
            quality=req_data.get("quality", "1080p"),
            fps=req_data.get("fps", 30),
            framing_style=req_data.get("framing_style", "blur_background"),
            mirror=req_data.get("mirror", True),
            speed=render_speed,
            duration_shift=duration_shift,
            grain=req_data.get("grain", True),
            vignette=req_data.get("vignette", True),
            color_grade=req_data.get("color_grade", "cinematic_warm"),
            micro_crop=req_data.get("micro_crop", True),
            delogo_box=req_data.get("delogo_box"),
            custom_watermark=wm,
            text_overlays=p.get("text_overlays", []),
            progress_callback=on_video_progress
        )

        # Integrity check: Ensure output video contains valid audio stream
        try:
            probe_cmd = ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "json", str(out_video)]
            probe_res = subprocess.run(probe_cmd, capture_output=True, text=True)
            if '"audio"' not in probe_res.stdout:
                print("[Render Worker Warning] Output video has no audio stream! Muxing audio track directly...")
                fixed_video = p_dir / f"repurposed_video_fixed_{project_id}.mp4"
                mux_cmd = [
                    "ffmpeg", "-y",
                    "-i", str(out_video),
                    "-i", str(master_audio),
                    "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k",
                    str(fixed_video)
                ]
                subprocess.run(mux_cmd, capture_output=True)
                if fixed_video.exists() and fixed_video.stat().st_size > 10000:
                    shutil.move(fixed_video, out_video)
        except Exception as probe_err:
            print(f"[Render Worker Audio Verification Error] {probe_err}")

        # Update project status and finalize without thumbnail generation
        p["final_video_file"] = out_video.name
        p["status"] = "completed"
        p["progress_percent"] = 100
        ProjectManager.save_project(project_id, p)

        RENDER_TASKS[project_id] = {
            "status": "completed",
            "progress": 100,
            "message": "Render completed successfully!",
            "video_url": f"/api/projects/{project_id}/download-video"
        }
    except Exception as e:
        print(f"[Render Worker Error] {e}")
        RENDER_TASKS[project_id] = {"status": "error", "progress": 0, "message": str(e)}
        p = ProjectManager.get_project(project_id)
        if p:
            p["status"] = "error"
            ProjectManager.save_project(project_id, p)


@app.post("/api/projects/{project_id}/render-video")
def start_render_video_endpoint(project_id: str, req: StartRenderRequest, bg: BackgroundTasks):
    p = ProjectManager.get_project(project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    RENDER_TASKS[project_id] = {"status": "starting", "progress": 5, "message": "Initializing background render worker..."}
    thread = threading.Thread(target=_render_worker, args=(project_id, req.model_dump()))
    thread.daemon = True
    thread.start()

    return {"status": "rendering_started", "project_id": project_id}


@app.get("/api/projects/{project_id}/render-status")
def get_render_status_endpoint(project_id: str):
    if project_id in RENDER_TASKS:
        return RENDER_TASKS[project_id]
    p = ProjectManager.get_project(project_id)
    if p and p.get("final_video_file"):
        return {
            "status": "completed",
            "progress": 100,
            "message": "Render completed",
            "video_url": f"/api/projects/{project_id}/download-video",
            "thumbnail_url": f"/api/projects/{project_id}/download-thumbnail"
        }
    return {"status": "idle", "progress": 0, "message": "No active render"}


@app.get("/api/projects/{project_id}/video-stream")
def stream_video_endpoint(project_id: str, which: str = "source"):
    p_dir = ProjectManager.get_project_dir(project_id)
    v_file = p_dir / ("repurposed_video_" + project_id + ".mp4" if which == "final" else "source_video.mp4")
    if not v_file.exists():
        raise HTTPException(status_code=404, detail="Video file not found")
    return FileResponse(v_file, media_type="video/mp4")


@app.get("/api/projects/{project_id}/download-video")
def download_video_endpoint(project_id: str):
    p_dir = ProjectManager.get_project_dir(project_id)
    v_file = p_dir / f"repurposed_video_{project_id}.mp4"
    if not v_file.exists():
        # Fallback search
        matches = list(p_dir.glob("repurposed_video_*.mp4"))
        if matches:
            v_file = matches[0]
        else:
            raise HTTPException(status_code=404, detail="Rendered video not found")
    return FileResponse(
        v_file,
        media_type="video/mp4",
        filename=f"repurposed_video_{project_id}.mp4",
        headers={"Content-Disposition": f'attachment; filename="repurposed_video_{project_id}.mp4"'}
    )


@app.get("/api/projects/{project_id}/download-thumbnail")
def download_thumbnail_endpoint(project_id: str):
    p_dir = ProjectManager.get_project_dir(project_id)
    t_file = p_dir / "thumbnail_high_ctr.jpg"
    if not t_file.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    return FileResponse(
        t_file,
        media_type="image/jpeg",
        filename=f"thumbnail_{project_id}.jpg",
        headers={"Content-Disposition": f'attachment; filename="thumbnail_{project_id}.jpg"'}
    )
