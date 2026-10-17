import os
import sys
import uuid
import shutil
import asyncio
import requests
from pathlib import Path
from typing import Optional
from PIL import Image

# Gracefully silence Windows ProactorEventLoop WinError 10054 when browser seeks/cancels video streams
if sys.platform == "win32":
    try:
        from asyncio.proactor_events import _ProactorBasePipeTransport
        _orig_call_connection_lost = _ProactorBasePipeTransport._call_connection_lost

        def _silenced_call_connection_lost(self, exc):
            try:
                _orig_call_connection_lost(self, exc)
            except (ConnectionResetError, OSError):
                pass

        _ProactorBasePipeTransport._call_connection_lost = _silenced_call_connection_lost
    except Exception:
        pass

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import (
    BASE_DIR, UPLOADS_DIR, PROJECTS_DIR, EXPORTS_DIR, STATIC_DIR,
    AMBIENT_DIR, load_config, save_config
)
from app.project_manager import ProjectManager
from app.panel_extractor import process_and_extract_all_panels, sanitize_for_json
from app.script_generator import generate_script_with_gemini
from app.voice_engine import generate_segment_voice, process_manual_voice_file
from app.video_renderer import render_full_project_video
from app.thumbnail_generator import generate_high_ctr_thumbnail
from app.metadata_generator import generate_youtube_metadata
from app.languages import SUPPORTED_LANGUAGES, get_language_info, get_edge_voice_for_language

app = FastAPI(title="MangaRecap AI Studio API", version="2.0.0")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Server Error: {str(exc)}"}
    )

# Enable CORS for local cross-origin access and standalone browser tabs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pm = ProjectManager()

# Background rendering worker lock & tasks
rendering_tasks = {}

# Pydantic Schemas
class ConfigUpdateSchema(BaseModel):
    gemini_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    default_voice_provider: Optional[str] = None
    default_voice_en: Optional[str] = None
    default_voice_hi: Optional[str] = None
    custom_voice_id: Optional[str] = None
    enable_audio_mastering: Optional[bool] = None
    enable_ambient_bed: Optional[bool] = None
    internal_manga_ref: Optional[str] = None
    target_length: Optional[str] = None
    aspect_ratio: Optional[str] = None
    narrator: Optional[str] = None
    custom_instructions: Optional[str] = None
    max_pages: Optional[str] = None
    page_range: Optional[str] = None
    gemini_model: Optional[str] = None
    frame_style: Optional[str] = None
    motion_speed: Optional[str] = None
    export_quality: Optional[str] = None
    language: Optional[str] = None
    enable_watermark: Optional[bool] = None
    watermark_text: Optional[str] = None
    watermark_position: Optional[str] = None
    watermark_opacity: Optional[float] = None
    watermark_font_size: Optional[int] = None

class CreateProjectSchema(BaseModel):
    name: str = "New Manga Recap"
    internal_manga_ref: str = ""
    target_length: str = "20-Min Quick Recap"
    aspect_ratio: str = "16:9"
    narrator: str = "Charon"
    custom_voice_id: str = ""
    custom_instructions: str = ""
    frame_style: str = "dark_ambient"
    motion_speed: str = "smooth_slow"
    export_quality: str = "1080p"
    page_range: str = "15"
    language: str = "en"
    enable_watermark: bool = False
    watermark_text: str = "Manga Recap Studio"
    watermark_position: str = "top_right"
    watermark_opacity: float = 0.45
    watermark_font_size: int = 32

class RenderVideoRequestSchema(BaseModel):
    frame_style: Optional[str] = None
    motion_speed: Optional[str] = None
    export_quality: Optional[str] = None
    narrator: Optional[str] = None
    language: Optional[str] = None
    enable_watermark: Optional[bool] = None
    watermark_text: Optional[str] = None
    watermark_position: Optional[str] = None
    watermark_opacity: Optional[float] = None
    watermark_font_size: Optional[int] = None

class PreviewFrameSchema(BaseModel):
    segment_id: Optional[int] = 1
    frame_style: str = "dark_ambient"
    motion_speed: str = "smooth_slow"
    export_quality: str = "720p"
    aspect_ratio: str = "16:9"
    enable_watermark: Optional[bool] = False
    watermark_text: Optional[str] = None
    watermark_position: Optional[str] = None
    watermark_opacity: Optional[float] = None
    watermark_font_size: Optional[int] = None

class UpdatePanelsSchema(BaseModel):
    panels: list[dict]

class ReorderPanelsSchema(BaseModel):
    ordered_segment_ids: list[int]

class UpdateSegmentsSchema(BaseModel):
    segments: list[dict]

class GenerateThumbnailSchema(BaseModel):
    hook_text: str = "HE WAS BETRAYED!"
    climax_segment_id: Optional[int] = None
    theme: Optional[str] = "viral_yellow"
    font_size_preset: Optional[str] = "giant"

# ----------------- Static & App Routes -----------------

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")

# ----------------- Configuration Endpoints -----------------

@app.get("/api/config")
def get_configuration():
    cfg = load_config()
    safe_cfg = cfg.copy()
    gemini_key = cfg.get("gemini_api_key", "")
    eleven_key = cfg.get("elevenlabs_api_key", "")
    safe_cfg["gemini_api_key"] = gemini_key
    safe_cfg["elevenlabs_api_key"] = eleven_key
    safe_cfg["gemini_api_key_masked"] = f"{gemini_key[:4]}...{gemini_key[-4:]}" if len(gemini_key) > 8 else ("***" if gemini_key else "")
    safe_cfg["elevenlabs_api_key_masked"] = f"{eleven_key[:4]}...{eleven_key[-4:]}" if len(eleven_key) > 8 else ("***" if eleven_key else "")
    safe_cfg["has_gemini_key"] = bool(gemini_key)
    safe_cfg["has_elevenlabs_key"] = bool(eleven_key)
    return safe_cfg

@app.get("/api/languages")
def get_languages_catalog():
    """Returns the list of supported languages with metadata and voice suggestions."""
    return {"status": "ok", "languages": SUPPORTED_LANGUAGES}

@app.post("/api/config")
def update_configuration(update_data: ConfigUpdateSchema):
    current = load_config()
    data_dict = update_data.model_dump(exclude_unset=True)
    for k, v in data_dict.items():
        if v is not None:
            current[k] = v
    saved = save_config(current)
    return {"status": "ok", "message": "Settings saved successfully", "config": saved}

class TestConfigSchema(BaseModel):
    gemini_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None

@app.post("/api/config/test")
def test_configuration(payload: TestConfigSchema):
    cfg = load_config()
    gemini_key = (payload.gemini_api_key if payload.gemini_api_key is not None else cfg.get("gemini_api_key", "")).strip()
    eleven_key = (payload.elevenlabs_api_key if payload.elevenlabs_api_key is not None else cfg.get("elevenlabs_api_key", "")).strip()
    
    results = {}
    
    # Test Gemini
    if gemini_key:
        try:
            r = requests.get(
                f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}",
                timeout=12
            )
            if r.status_code == 200:
                results["gemini"] = {
                    "ok": True,
                    "message": "Connected! Google Gemini 2.5 Flash is active & ready."
                }
            else:
                err_msg = r.text[:150]
                try:
                    err_json = r.json()
                    err_msg = err_json.get("error", {}).get("message", err_msg)
                except Exception:
                    pass
                results["gemini"] = {
                    "ok": False,
                    "message": f"Gemini Error ({r.status_code}): {err_msg}"
                }
        except Exception as e:
            results["gemini"] = {"ok": False, "message": f"Connection error: {str(e)}"}
    else:
        results["gemini"] = {"ok": False, "message": "No Gemini API key configured."}
        
    # Test ElevenLabs (if provided)
    if eleven_key:
        try:
            r = requests.get(
                "https://api.elevenlabs.io/v1/user",
                headers={"xi-api-key": eleven_key},
                timeout=12
            )
            if r.status_code == 200:
                data = r.json()
                sub = data.get("subscription", {})
                char_count = sub.get("character_count", 0)
                char_limit = sub.get("character_limit", 0)
                results["elevenlabs"] = {
                    "ok": True,
                    "message": f"Connected! ({char_count}/{char_limit} characters used)"
                }
            else:
                results["elevenlabs"] = {
                    "ok": False,
                    "message": f"ElevenLabs Error ({r.status_code}): {r.text[:120]}"
                }
        except Exception as e:
            results["elevenlabs"] = {"ok": False, "message": f"Connection error: {str(e)}"}
    else:
        results["elevenlabs"] = {
            "ok": True,
            "message": "Using zero-cost Edge-TTS fallback (natural human storytellers active)."
        }
        
    return results

# ----------------- Project Management Endpoints -----------------

@app.get("/api/projects")
def list_all_projects():
    return pm.list_projects()

@app.post("/api/projects")
def create_new_project(req: CreateProjectSchema):
    # Auto-persist user's latest directives and choices to config.json
    try:
        current_cfg = load_config()
        if req.internal_manga_ref:
            current_cfg["internal_manga_ref"] = req.internal_manga_ref
        if req.target_length:
            current_cfg["target_length"] = req.target_length
        if req.aspect_ratio:
            current_cfg["aspect_ratio"] = req.aspect_ratio
        if req.narrator:
            current_cfg["narrator"] = req.narrator
        if req.custom_instructions:
            current_cfg["custom_instructions"] = req.custom_instructions
        if req.frame_style:
            current_cfg["frame_style"] = req.frame_style
        if req.motion_speed:
            current_cfg["motion_speed"] = req.motion_speed
        if req.export_quality:
            current_cfg["export_quality"] = req.export_quality
        if req.page_range:
            current_cfg["page_range"] = req.page_range
        if req.language:
            current_cfg["language"] = req.language
        save_config(current_cfg)
    except Exception:
        pass

    proj = pm.create_project(
        name=req.name,
        internal_manga_ref=req.internal_manga_ref,
        target_length=req.target_length,
        aspect_ratio=req.aspect_ratio,
        narrator=req.narrator,
        custom_voice_id=req.custom_voice_id,
        custom_instructions=req.custom_instructions,
        frame_style=req.frame_style,
        motion_speed=req.motion_speed,
        export_quality=req.export_quality,
        page_range=req.page_range,
        language=req.language or "en"
    )
    return proj

@app.get("/api/projects/{project_id}")
def get_project_details(project_id: str):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj

@app.delete("/api/projects/{project_id}")
def delete_project_by_id(project_id: str):
    ok = pm.delete_project(project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project not found or could not delete")
    return {"status": "ok"}

@app.post("/api/projects/demo")
def load_demo_project():
    demo = pm.create_builtin_demo_project()
    return demo

# ----------------- File Upload & Panel Extraction -----------------

@app.post("/api/projects/{project_id}/upload")
async def upload_and_extract(
    project_id: str,
    file: UploadFile = File(...),
    page_range: Optional[str] = Form(None),
    max_pages: Optional[str] = Form(None)
):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    pdir = pm.get_project_dir(project_id)
    upload_dest = pdir / file.filename
    with open(upload_dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    effective_range = page_range or max_pages or proj.get("page_range") or "15"
    proj["page_range"] = str(effective_range)
    proj["status"] = "extracting"
    proj["progress"] = {"current": 10, "total": 100, "message": f"Extracting panels from {effective_range}..."}
    pm.save_project(project_id, proj)

    try:
        cfg = load_config()
        reading_order = cfg.get("reading_order", "top_to_bottom")
        # Run CPU-bound extraction off the event loop
        extraction_res = await asyncio.to_thread(
            process_and_extract_all_panels,
            upload_dest,
            pdir,
            reading_order=reading_order,
            page_range=effective_range
        )
        
        panels_list = extraction_res["panels"] if isinstance(extraction_res, dict) else extraction_res
        clean_panels = sanitize_for_json(panels_list)
        page_cnt = extraction_res.get("page_count", len(clean_panels)) if isinstance(extraction_res, dict) else len(clean_panels)
        range_disp = extraction_res.get("page_range_display", f"{page_cnt} pages") if isinstance(extraction_res, dict) else f"{page_cnt} pages"

        proj["panels"] = clean_panels
        proj["all_extracted_panels"] = clean_panels
        proj["page_count"] = page_cnt
        proj["page_range_display"] = range_disp
        proj["status"] = "panels_ready"
        proj["progress"] = {
            "current": 100,
            "total": 100,
            "message": f"Extracted {len(clean_panels)} panels from {page_cnt} pages ({range_disp})!"
        }
        pm.save_project(project_id, proj)
        return {
            "status": "ok",
            "panel_count": len(clean_panels),
            "page_count": page_cnt,
            "page_range_display": range_disp,
            "panels": clean_panels
        }
    except Exception as e:
        proj["status"] = "error"
        proj["progress"] = {"current": 0, "total": 100, "message": f"Extraction failed: {str(e)}"}
        pm.save_project(project_id, proj)
        raise HTTPException(status_code=500, detail=f"Panel extraction failed: {str(e)}")

@app.get("/api/projects/{project_id}/panels/{filename}")
def serve_panel_image(project_id: str, filename: str):
    pfile = pm.get_project_dir(project_id) / "panels" / filename
    if not pfile.exists():
        raise HTTPException(status_code=404, detail="Panel image not found")
    return FileResponse(pfile)

@app.get("/api/projects/{project_id}/previews/{filename}")
def serve_preview_image(project_id: str, filename: str):
    pfile = pm.get_project_dir(project_id) / "previews" / filename
    if not pfile.exists():
        pfile = pm.get_project_dir(project_id) / "panels" / filename
    if not pfile.exists():
        raise HTTPException(status_code=404, detail="Preview image not found")
    return FileResponse(pfile)

# ----------------- Comic Panels Curation & Filtering -----------------

@app.put("/api/projects/{project_id}/panels")
def update_panels_endpoint(project_id: str, req: UpdatePanelsSchema):
    """
    Updates the list of active comic panels for the project.
    Re-indexes remaining panels sequentially (1..N) so the downstream script and video
    are generated exclusively from the curated panel set.
    """
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    updated_panels = []
    for idx, p in enumerate(req.panels, start=1):
        clean_p = dict(p)
        clean_p["segment_id"] = idx
        updated_panels.append(clean_p)

    proj["panels"] = updated_panels
    proj["panel_count"] = len(updated_panels)
    pm.save_project(project_id, proj)
    return {
        "status": "ok",
        "panel_count": len(updated_panels),
        "panels": updated_panels
    }

@app.delete("/api/projects/{project_id}/panels/{segment_id}")
def delete_single_panel_endpoint(project_id: str, segment_id: int):
    """
    Removes an unwanted panel (e.g. credit page, blank gutter, ad) from the project.
    Re-indexes the remaining panels sequentially (1..N).
    """
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    current_panels = proj.get("panels", [])
    filtered = [p for p in current_panels if p.get("segment_id") != segment_id]

    for idx, p in enumerate(filtered, start=1):
        p["segment_id"] = idx

    proj["panels"] = filtered
    proj["panel_count"] = len(filtered)
    pm.save_project(project_id, proj)
    return {
        "status": "ok",
        "panel_count": len(filtered),
        "panels": filtered
    }

@app.post("/api/projects/{project_id}/panels/restore-all")
def restore_all_panels_endpoint(project_id: str):
    """
    Restores all originally extracted panels from the PDF/source, undoing any manual removals.
    """
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    all_panels = proj.get("all_extracted_panels")
    if not all_panels:
        pdir = pm.get_project_dir(project_id)
        panels_dir = pdir / "panels"
        if panels_dir.exists():
            recovered = []
            for p in sorted(panels_dir.glob("panel_*.png")):
                try:
                    sid = int(p.stem.split("_")[1])
                except Exception:
                    continue
                thumb = f"thumb_{sid:03d}.jpg"
                recovered.append({
                    "segment_id": sid,
                    "panel_file": p.name,
                    "thumb_file": thumb if (pdir / "previews" / thumb).exists() else p.name,
                    "page_num": 1,
                    "width": 1280,
                    "height": 800,
                    "box": [0, 0, 1280, 800]
                })
            all_panels = recovered

    if not all_panels:
        raise HTTPException(status_code=400, detail="No original panels available to restore")

    restored = []
    for idx, p in enumerate(all_panels, start=1):
        cp = dict(p)
        cp["segment_id"] = idx
        restored.append(cp)

    proj["panels"] = restored
    proj["panel_count"] = len(restored)
    pm.save_project(project_id, proj)
    return {
        "status": "ok",
        "panel_count": len(restored),
        "panels": restored
    }

@app.post("/api/projects/{project_id}/panels/upload-custom")
async def upload_custom_panels_endpoint(
    project_id: str,
    files: list[UploadFile] = File(...)
):
    """
    Allows user to inject custom pages, action screenshots, or reaction panels
    into the curated Comic Panels Gallery to maximize viewer engagement.
    """
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    pdir = pm.get_project_dir(project_id)
    panels_dir = pdir / "panels"
    previews_dir = pdir / "previews"
    panels_dir.mkdir(parents=True, exist_ok=True)
    previews_dir.mkdir(parents=True, exist_ok=True)

    current_panels = proj.get("panels", [])
    next_id = max([p.get("segment_id", 0) for p in current_panels] + [0]) + 1
    added_panels = []

    for file in files:
        ext = Path(file.filename).suffix.lower() if file.filename else ".png"
        if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
            ext = ".png"
        
        panel_filename = f"custom_panel_{next_id:03d}_{uuid.uuid4().hex[:6]}{ext}"
        target_path = panels_dir / panel_filename

        with open(target_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # Measure dimensions and create preview thumbnail
        w, h = 1080, 1080
        thumb_name = f"thumb_custom_{next_id:03d}.jpg"
        thumb_path = previews_dir / thumb_name
        try:
            with Image.open(target_path) as im:
                w, h = im.size
                im_rgb = im.convert("RGB")
                im_rgb.thumbnail((360, 360))
                im_rgb.save(thumb_path, "JPEG", quality=85)
        except Exception:
            thumb_name = panel_filename

        new_panel = {
            "segment_id": next_id,
            "panel_file": panel_filename,
            "thumb_file": thumb_name if thumb_path.exists() else panel_filename,
            "width": w,
            "height": h,
            "aspect_ratio": round(w / max(1, h), 3),
            "is_custom": True,
            "is_climax_panel": False,
            "label": f"Custom Scene #{next_id}"
        }
        current_panels.append(new_panel)
        added_panels.append(new_panel)
        next_id += 1

    # Re-index all panels sequentially 1..N
    for idx, p in enumerate(current_panels, start=1):
        p["segment_id"] = idx

    proj["panels"] = current_panels
    proj["panel_count"] = len(current_panels)
    pm.save_project(project_id, proj)

    return {
        "status": "ok",
        "added_count": len(added_panels),
        "panel_count": len(current_panels),
        "panels": current_panels
    }

@app.post("/api/projects/{project_id}/panels/reorder")
def reorder_panels_endpoint(project_id: str, req: ReorderPanelsSchema):
    """
    Reorders comic panels based on drag-and-drop or move left/right actions.
    Re-indexes sequentially so script and video compilation follow the exact custom order.
    """
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    current_panels = proj.get("panels", [])
    panel_map = {p.get("segment_id"): p for p in current_panels}

    reordered = []
    seen = set()
    for sid in req.ordered_segment_ids:
        if sid in panel_map and sid not in seen:
            reordered.append(panel_map[sid])
            seen.add(sid)

    # Add any remaining panels not in ordered list
    for p in current_panels:
        if p.get("segment_id") not in seen:
            reordered.append(p)

    # Re-index sequentially 1..N
    for idx, p in enumerate(reordered, start=1):
        p["segment_id"] = idx

    proj["panels"] = reordered
    proj["panel_count"] = len(reordered)
    pm.save_project(project_id, proj)

    return {
        "status": "ok",
        "panel_count": len(reordered),
        "panels": reordered
    }

# ----------------- Gemini Vision Script Generation -----------------

@app.post("/api/projects/{project_id}/generate-script")
def generate_script(
    project_id: str,
    custom_instructions: Optional[str] = Form(None),
    internal_manga_ref: Optional[str] = Form(None),
    language: Optional[str] = Form(None)
):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if not proj.get("panels"):
        raise HTTPException(status_code=400, detail="No panels extracted yet")

    if custom_instructions is not None:
        proj["custom_instructions"] = custom_instructions
    if internal_manga_ref is not None:
        proj["internal_manga_ref"] = internal_manga_ref
    if language is not None and language.strip():
        proj["language"] = language.strip()

    cfg = load_config()
    api_key = cfg.get("gemini_api_key", "")
    model = cfg.get("gemini_model", "gemini-2.5-flash")
    effective_lang = proj.get("language", "en")

    proj["status"] = "scripting"
    proj["progress"] = {"current": 30, "total": 100, "message": f"Gemini analyzing panels & writing script in {effective_lang.upper()}..."}
    pm.save_project(project_id, proj)

    pdir = pm.get_project_dir(project_id)
    segments = generate_script_with_gemini(
        panels=proj["panels"],
        panels_dir=pdir / "panels",
        custom_instructions=proj.get("custom_instructions", ""),
        internal_manga_ref=proj.get("internal_manga_ref", ""),
        target_length=proj.get("target_length", "20-Min Quick Recap"),
        aspect_ratio=proj.get("aspect_ratio", "16:9"),
        api_key=api_key,
        model_name=model,
        language=effective_lang
    )

    proj["segments"] = segments
    proj["status"] = "scripted"
    proj["progress"] = {"current": 100, "total": 100, "message": f"Script generated ({len(segments)} segments)!"}
    pm.save_project(project_id, proj)
    return {"status": "ok", "segments": segments}

@app.put("/api/projects/{project_id}/segments")
def update_segments(project_id: str, req: UpdateSegmentsSchema):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    proj["segments"] = req.segments
    pm.save_project(project_id, proj)
    return {"status": "ok", "message": "Segments updated successfully"}

# ----------------- Voiceover Synthesis & Manual Voice -----------------

@app.post("/api/projects/{project_id}/synthesize-all")
async def synthesize_all_voices(project_id: str, background_tasks: BackgroundTasks):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if not proj.get("segments"):
        raise HTTPException(status_code=400, detail="No segments available to synthesize")

    def run_synthesis():
        p = pm.load_project(project_id)
        cfg = load_config()
        pdir = pm.get_project_dir(project_id)
        audio_dir = pdir / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)

        gemini_key = cfg.get("gemini_api_key", "")
        eleven_key = cfg.get("elevenlabs_api_key", "")
        narrator = p.get("narrator", "Charon")
        custom_voice = p.get("custom_voice_id", "")

        from app.voice_engine import GEMINI_VOICES, ELEVENLABS_VOICES, EDGE_TTS_VOICES
        provider = "gemini"
        if narrator in ELEVENLABS_VOICES:
            provider = "elevenlabs" if eleven_key else "gemini"
        elif narrator in EDGE_TTS_VOICES or narrator in ["Christopher", "Guy", "Andrew", "Ryan", "Madhur", "Swara", "Pradeep", "Nabanita", "Bashkar", "Tanishaa", "Asad", "Uzma", "Salman"]:
            provider = "edge_tts"
        elif narrator in GEMINI_VOICES:
            provider = "gemini"
        else:
            provider = "edge_tts" if not gemini_key else "gemini"

        segs = p["segments"]
        total = len(segs)
        p["status"] = "synthesizing"
        lang = p.get("language", "en")

        for i, seg in enumerate(segs):
            # If segment already has manual voice recording, skip overwriting
            if seg.get("voice_mode") == "manual" and seg.get("audio_file"):
                continue

            seg_id = seg["segment_id"]
            p["progress"] = {"current": i + 1, "total": total, "message": f"Synthesizing voice {i+1} of {total} ({narrator} [{lang.upper()}])..."}
            pm.save_project(project_id, p)

            text = seg.get("narration_text", "")
            out_file = audio_dir / f"voice_{seg_id:03d}.mp3"

            ok, duration = generate_segment_voice(
                text=text,
                output_path=out_file,
                voice_provider=provider,
                voice_name=narrator,
                gemini_api_key=gemini_key,
                elevenlabs_api_key=eleven_key,
                custom_voice_id=custom_voice,
                language=lang
            )
            seg["audio_file"] = out_file.name
            seg["audio_duration"] = round(duration, 3)

        p["status"] = "voices_ready"
        p["progress"] = {"current": total, "total": total, "message": "All narration audio generated and mastered!"}
        pm.save_project(project_id, p)

    background_tasks.add_task(run_synthesis)
    return {"status": "ok", "message": "Voice synthesis started in background"}

@app.post("/api/projects/{project_id}/segments/{segment_id}/synthesize")
def synthesize_single_segment(project_id: str, segment_id: int):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    seg = next((s for s in proj.get("segments", []) if s["segment_id"] == segment_id), None)
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")

    cfg = load_config()
    pdir = pm.get_project_dir(project_id)
    audio_dir = pdir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    gemini_key = cfg.get("gemini_api_key", "")
    eleven_key = cfg.get("elevenlabs_api_key", "")
    narrator = proj.get("narrator", "Charon")
    custom_voice = proj.get("custom_voice_id", "")
    lang = proj.get("language", "en")

    from app.voice_engine import GEMINI_VOICES, ELEVENLABS_VOICES, EDGE_TTS_VOICES
    provider = "gemini"
    if narrator in ELEVENLABS_VOICES:
        provider = "elevenlabs" if eleven_key else "gemini"
    elif narrator in EDGE_TTS_VOICES or narrator in ["Christopher", "Guy", "Andrew", "Ryan", "Madhur", "Swara", "Pradeep", "Nabanita", "Bashkar", "Tanishaa", "Asad", "Uzma", "Salman"]:
        provider = "edge_tts"
    elif narrator in GEMINI_VOICES:
        provider = "gemini"
    else:
        provider = "edge_tts" if not gemini_key else "gemini"

    out_file = audio_dir / f"voice_{segment_id:03d}.mp3"
    ok, duration = generate_segment_voice(
        text=seg.get("narration_text", ""),
        output_path=out_file,
        voice_provider=provider,
        voice_name=narrator,
        gemini_api_key=gemini_key,
        elevenlabs_api_key=eleven_key,
        custom_voice_id=custom_voice,
        language=lang
    )

    seg["audio_file"] = out_file.name
    seg["audio_duration"] = round(duration, 3)
    seg["voice_mode"] = "ai"
    pm.save_project(project_id, proj)
    return {"status": "ok", "audio_file": out_file.name, "duration": duration}

# ----------------- CRITICAL FEATURE: MANUAL VOICE UPLOAD / MIC RECORDING -----------------

@app.post("/api/projects/{project_id}/segments/{segment_id}/upload-voice")
async def upload_manual_voice(
    project_id: str,
    segment_id: int,
    file: UploadFile = File(...)
):
    """
    Accepts manual microphone recording or uploaded voiceover audio file for a segment.
    Masters audio through 80Hz highpass + soft compressor and updates timeline duration.
    """
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    seg = next((s for s in proj.get("segments", []) if s["segment_id"] == segment_id), None)
    if not seg:
        raise HTTPException(status_code=404, detail="Segment not found")

    pdir = pm.get_project_dir(project_id)
    audio_dir = pdir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix if file.filename else ".mp3"
    raw_tmp = audio_dir / f"temp_manual_{segment_id:03d}{ext}"
    with open(raw_tmp, "wb") as f:
        shutil.copyfileobj(file.file, f)

    mastered_file = audio_dir / f"manual_voice_{segment_id:03d}.mp3"
    ok, duration = process_manual_voice_file(raw_tmp, mastered_file)

    if raw_tmp.exists():
        try: os.remove(raw_tmp)
        except Exception: pass

    seg["audio_file"] = mastered_file.name
    seg["audio_duration"] = round(duration, 3)
    seg["voice_mode"] = "manual"
    pm.save_project(project_id, proj)

    return {
        "status": "ok",
        "audio_file": mastered_file.name,
        "duration": duration,
        "voice_mode": "manual",
        "message": "Manual voiceover successfully recorded and mastered!"
    }

@app.get("/api/projects/{project_id}/audio/{filename}")
def serve_audio_clip(project_id: str, filename: str):
    afile = pm.get_project_dir(project_id) / "audio" / filename
    if not afile.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(afile, media_type="audio/mpeg")

@app.get("/api/voice/sample")
def get_voice_sample(
    voice_name: str = "Charon",
    provider: Optional[str] = "gemini",
    language: Optional[str] = "en"
):
    cfg = load_config()
    lang = language or "en"
    samples_dir = STATIC_DIR / "assets" / "samples"
    samples_dir.mkdir(parents=True, exist_ok=True)
    sample_file = samples_dir / f"sample_{provider}_{voice_name}_{lang}.mp3"
    
    if not sample_file.exists():
        from app.voice_engine import generate_voice_sample
        gemini_key = cfg.get("gemini_api_key", "")
        eleven_key = cfg.get("elevenlabs_api_key", "")
        generate_voice_sample(
            voice_name,
            sample_file,
            gemini_api_key=gemini_key,
            elevenlabs_api_key=eleven_key,
            language=lang
        )
        
    if not sample_file.exists():
        raise HTTPException(status_code=500, detail="Could not generate sample")
        
    return FileResponse(sample_file, media_type="audio/mpeg")

@app.post("/api/projects/{project_id}/preview-frame")
def preview_frame_endpoint(project_id: str, req: PreviewFrameSchema):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    segments = proj.get("segments", [])
    panels = proj.get("panels", [])
    
    panel_file = None
    if segments:
        seg = next((s for s in segments if s["segment_id"] == req.segment_id), segments[0])
        panel_file = pm.get_project_dir(project_id) / "panels" / seg["panel_file"]
    elif panels:
        p = next((x for x in panels if x.get("segment_id") == req.segment_id), panels[0])
        panel_file = pm.get_project_dir(project_id) / "panels" / p["panel_file"]
        
    if not panel_file or not panel_file.exists():
        raise HTTPException(status_code=400, detail="No panel image available for preview")
        
    previews_dir = pm.get_project_dir(project_id) / "previews"
    previews_dir.mkdir(parents=True, exist_ok=True)
    preview_output = previews_dir / f"live_preview_{req.frame_style}_{req.aspect_ratio.replace(':','_')}.mp4"
    
    cfg = load_config()
    wm_enabled = req.enable_watermark if req.enable_watermark is not None else cfg.get("enable_watermark", False)
    wm_text = req.watermark_text or cfg.get("watermark_text", "Manga Recap Studio")
    wm_pos = req.watermark_position or cfg.get("watermark_position", "top_right")
    wm_opacity = req.watermark_opacity if req.watermark_opacity is not None else cfg.get("watermark_opacity", 0.45)
    wm_fs = req.watermark_font_size or cfg.get("watermark_font_size", 32)

    from app.video_renderer import render_preview_clip
    ok = render_preview_clip(
        panel_image=panel_file,
        output_mp4=preview_output,
        aspect_ratio=req.aspect_ratio,
        frame_style=req.frame_style,
        motion_speed=req.motion_speed,
        quality=req.export_quality,
        duration=3.0,
        watermark_enabled=wm_enabled,
        watermark_text=wm_text,
        watermark_position=wm_pos,
        watermark_opacity=wm_opacity,
        watermark_font_size=wm_fs
    )
    if not ok or not preview_output.exists():
        raise HTTPException(status_code=500, detail="Failed to render preview clip")
        
    return FileResponse(preview_output, media_type="video/mp4")

# ----------------- Video Compilation & Render -----------------

@app.post("/api/projects/{project_id}/render-video")
async def start_video_render(
    project_id: str,
    background_tasks: BackgroundTasks,
    req: Optional[RenderVideoRequestSchema] = None
):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if not proj.get("segments"):
        raise HTTPException(status_code=400, detail="No segments found to render")

    # Update preferences if supplied in render request
    if req:
        if req.frame_style: proj["frame_style"] = req.frame_style
        if req.motion_speed: proj["motion_speed"] = req.motion_speed
        if req.export_quality: proj["export_quality"] = req.export_quality
        if req.narrator: proj["narrator"] = req.narrator
        if req.language: proj["language"] = req.language
        if req.enable_watermark is not None: proj["enable_watermark"] = req.enable_watermark
        if req.watermark_text is not None: proj["watermark_text"] = req.watermark_text
        if req.watermark_position is not None: proj["watermark_position"] = req.watermark_position
        if req.watermark_opacity is not None: proj["watermark_opacity"] = req.watermark_opacity
        if req.watermark_font_size is not None: proj["watermark_font_size"] = req.watermark_font_size
        pm.save_project(project_id, proj)

    def render_worker():
        p = pm.load_project(project_id)
        pdir = pm.get_project_dir(project_id)
        aspect = p.get("aspect_ratio", "16:9")
        frame_style = p.get("frame_style", "dark_ambient")
        motion_speed = p.get("motion_speed", "smooth_slow")
        quality = p.get("export_quality", "1080p")
        narrator = p.get("narrator", "Charon")
        language = p.get("language", "en")
        
        cfg = load_config()
        gemini_key = cfg.get("gemini_api_key", "")
        eleven_key = cfg.get("elevenlabs_api_key", "")
        
        wm_enabled = p.get("enable_watermark", cfg.get("enable_watermark", False))
        wm_text = p.get("watermark_text", cfg.get("watermark_text", "Manga Recap Studio"))
        wm_pos = p.get("watermark_position", cfg.get("watermark_position", "top_right"))
        wm_opacity = p.get("watermark_opacity", cfg.get("watermark_opacity", 0.45))
        wm_fs = p.get("watermark_font_size", cfg.get("watermark_font_size", 32))

        from app.voice_engine import GEMINI_VOICES, ELEVENLABS_VOICES, EDGE_TTS_VOICES
        voice_provider = "gemini"
        if narrator in ELEVENLABS_VOICES:
            voice_provider = "elevenlabs" if eleven_key else "gemini"
        elif narrator in EDGE_TTS_VOICES or narrator in ["Christopher", "Guy", "Andrew", "Ryan", "Madhur", "Swara", "Pradeep", "Nabanita", "Bashkar", "Tanishaa", "Asad", "Uzma", "Salman"]:
            voice_provider = "edge_tts"
        elif narrator in GEMINI_VOICES:
            voice_provider = "gemini"
        else:
            voice_provider = "edge_tts" if not gemini_key else "gemini"

        p["status"] = "rendering"
        pm.save_project(project_id, p)

        ambient_file = AMBIENT_DIR / "cinematic_dark_drone.wav"
        if not ambient_file.exists():
            ambient_file = None

        def update_progress(curr, total, msg):
            curr_p = pm.load_project(project_id) or p
            curr_p["progress"] = {"current": curr, "total": total, "message": msg}
            pm.save_project(project_id, curr_p)

        from app.video_renderer import render_full_project_video
        out_video = render_full_project_video(
            project_dir=pdir,
            segments=p["segments"],
            aspect_ratio=aspect,
            ambient_audio_path=ambient_file,
            frame_style=frame_style,
            motion_speed=motion_speed,
            quality=quality,
            voice_provider=voice_provider,
            voice_name=narrator,
            gemini_api_key=gemini_key,
            elevenlabs_api_key=eleven_key,
            language=language,
            watermark_enabled=wm_enabled,
            watermark_text=wm_text,
            watermark_position=wm_pos,
            watermark_opacity=wm_opacity,
            watermark_font_size=wm_fs,
            progress_callback=update_progress
        )

        p = pm.load_project(project_id) or p
        if out_video and out_video.exists() and out_video.stat().st_size > 5000:
            safe_name = "".join(c for c in p.get('name', 'recap') if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
            global_export = EXPORTS_DIR / f"{safe_name}_{project_id}.mp4"
            try:
                shutil.copy2(out_video, global_export)
            except Exception:
                pass
            p["video_file"] = out_video.name
            p["status"] = "completed"
            p["progress"] = {"current": len(p["segments"]), "total": len(p["segments"]), "message": "Video compilation completed successfully!"}
        else:
            p["status"] = "error"
            p["progress"] = {"current": 0, "total": 100, "message": "Video compilation failed."}
            
        pm.save_project(project_id, p)

    background_tasks.add_task(render_worker)
    return {"status": "ok", "message": "Rendering started"}

@app.get("/api/projects/{project_id}/video")
def get_rendered_video(project_id: str):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    pdir = pm.get_project_dir(project_id)
    vpath = None
    if proj.get("video_file"):
        vpath = pdir / proj["video_file"]
        
    # Auto-detect completed video in project directory if reference was missed
    if not vpath or not vpath.exists():
        found = sorted(pdir.glob("recap_video_*.mp4"), key=lambda f: f.stat().st_mtime, reverse=True)
        if found and found[0].stat().st_size > 5000:
            vpath = found[0]
            proj["video_file"] = vpath.name
            proj["status"] = "completed"
            pm.save_project(project_id, proj)

    if not vpath or not vpath.exists():
        raise HTTPException(status_code=404, detail="Video not rendered yet")
        
    return FileResponse(vpath, media_type="video/mp4", filename=f"manga_recap_{project_id}.mp4")

@app.get("/api/projects/{project_id}/download-video")
def download_rendered_video(project_id: str):
    """
    Forces an instant clean browser download of the exported MP4 video file.
    """
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    pdir = pm.get_project_dir(project_id)
    vpath = None
    if proj.get("video_file"):
        vpath = pdir / proj["video_file"]

    if not vpath or not vpath.exists():
        found = sorted(pdir.glob("recap_video_*.mp4"), key=lambda f: f.stat().st_mtime, reverse=True)
        if found and found[0].stat().st_size > 5000:
            vpath = found[0]
            proj["video_file"] = vpath.name
            proj["status"] = "completed"
            pm.save_project(project_id, proj)

    if not vpath or not vpath.exists():
        raise HTTPException(status_code=404, detail="Video file not found or not rendered yet")

    safe_name = "".join(c for c in proj.get('name', 'recap') if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
    dl_filename = f"{safe_name}_{project_id}.mp4"
    return FileResponse(
        vpath,
        media_type="video/mp4",
        filename=dl_filename,
        headers={"Content-Disposition": f'attachment; filename="{dl_filename}"'}
    )

# ----------------- Thumbnail Generator & Publishing Kit -----------------

@app.post("/api/projects/{project_id}/generate-thumbnail")
def generate_thumbnail_endpoint(project_id: str, req: GenerateThumbnailSchema):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    pdir = pm.get_project_dir(project_id)
    panels_dir = pdir / "panels"

    # Find climax panel
    climax_seg = None
    if req.climax_segment_id:
        climax_seg = next((s for s in proj.get("segments", []) if s["segment_id"] == req.climax_segment_id), None)
    if not climax_seg:
        climax_seg = next((s for s in proj.get("segments", []) if s.get("is_climax_panel")), None)
    if not climax_seg and proj.get("segments"):
        climax_seg = proj["segments"][min(len(proj["segments"]) - 1, 2)]

    if not climax_seg:
        raise HTTPException(status_code=400, detail="No panel available for thumbnail")

    source_panel = panels_dir / climax_seg["panel_file"]
    out_thumb = pdir / "thumbnail.png"

    hook_text = req.hook_text or proj.get("thumbnail_hook") or "HE WAS BETRAYED!"
    theme = req.theme or proj.get("thumbnail_theme") or "viral_yellow"
    font_size_preset = req.font_size_preset or proj.get("thumbnail_font_size") or "giant"

    ok = generate_high_ctr_thumbnail(
        source_panel_path=source_panel,
        output_thumbnail_path=out_thumb,
        hook_text=hook_text,
        theme=theme,
        font_size_preset=font_size_preset
    )

    if ok:
        proj["thumbnail_file"] = "thumbnail.png"
        proj["thumbnail_hook"] = hook_text
        proj["thumbnail_theme"] = theme
        proj["thumbnail_font_size"] = font_size_preset
        pm.save_project(project_id, proj)
        return {
            "status": "ok",
            "thumbnail_file": "thumbnail.png",
            "hook_text": hook_text,
            "theme": theme,
            "font_size_preset": font_size_preset
        }
    else:
        raise HTTPException(status_code=500, detail="Thumbnail generation failed")

@app.get("/api/projects/{project_id}/thumbnail")
def get_project_thumbnail(project_id: str):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    pdir = pm.get_project_dir(project_id)
    thumb_name = proj.get("thumbnail_file") or "thumbnail.png"
    tpath = pdir / thumb_name

    # If file doesn't exist on disk, attempt dynamic creation
    if not tpath.exists():
        panels_dir = pdir / "panels"
        hook_text = proj.get("thumbnail_hook") or "HE WAS BETRAYED!"
        theme = proj.get("thumbnail_theme") or "viral_yellow"
        font_size_preset = proj.get("thumbnail_font_size") or "giant"
        if proj.get("metadata", {}).get("recommended_hook"):
            hook_text = proj["metadata"]["recommended_hook"]

        climax_seg = next((s for s in proj.get("segments", []) if s.get("is_climax_panel")), None)
        if not climax_seg and proj.get("segments"):
            climax_seg = proj["segments"][min(len(proj["segments"]) - 1, 2)]

        if climax_seg:
            src_panel = panels_dir / climax_seg["panel_file"]
            if src_panel.exists():
                try:
                    generate_high_ctr_thumbnail(
                        source_panel_path=src_panel,
                        output_thumbnail_path=tpath,
                        hook_text=hook_text,
                        theme=theme,
                        font_size_preset=font_size_preset
                    )
                    proj["thumbnail_file"] = "thumbnail.png"
                    proj["thumbnail_hook"] = hook_text
                    proj["thumbnail_theme"] = theme
                    proj["thumbnail_font_size"] = font_size_preset
                    pm.save_project(project_id, proj)
                except Exception:
                    pass

    if not tpath.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not generated yet")

    # Ensure thumbnail is tracked in project metadata
    if not proj.get("thumbnail_file"):
        proj["thumbnail_file"] = "thumbnail.png"
        pm.save_project(project_id, proj)

    return FileResponse(tpath, media_type="image/png", filename=f"thumbnail_{project_id}.png")

@app.post("/api/projects/{project_id}/generate-metadata")
def generate_metadata_endpoint(project_id: str):
    proj = pm.load_project(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    cfg = load_config()
    api_key = cfg.get("gemini_api_key", "")
    model = cfg.get("gemini_model", "gemini-2.5-flash")

    meta = generate_youtube_metadata(
        internal_manga_ref=proj.get("internal_manga_ref", ""),
        custom_instructions=proj.get("custom_instructions", ""),
        segments=proj.get("segments", []),
        api_key=api_key,
        model_name=model,
        language=proj.get("language", "en")
    )

    proj["metadata"] = meta
    # Also auto-generate thumbnail if not already generated
    if not proj.get("thumbnail_file") and meta.get("recommended_hook"):
        try:
            generate_thumbnail_endpoint(project_id, GenerateThumbnailSchema(
                hook_text=meta["recommended_hook"],
                theme=proj.get("thumbnail_theme", "viral_yellow"),
                font_size_preset=proj.get("thumbnail_font_size", "giant")
            ))
        except Exception:
            pass

    pm.save_project(project_id, proj)
    return {"status": "ok", "metadata": meta}

if __name__ == "__main__":
    import uvicorn
    cfg = load_config()
    port = cfg.get("server_port", 5503)
    print(f"Starting MangaRecap AI Studio on port {port}...")
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
