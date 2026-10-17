import os
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

UPLOADS_DIR = BASE_DIR / "uploads"
PROJECTS_DIR = BASE_DIR / "projects"
EXPORTS_DIR = BASE_DIR / "exports"
STATIC_DIR = BASE_DIR / "static"
FONTS_DIR = STATIC_DIR / "fonts"
AMBIENT_DIR = STATIC_DIR / "assets" / "ambient"
DEMO_DIR = STATIC_DIR / "assets" / "demo"

# Create directories if they do not exist
for folder in [UPLOADS_DIR, PROJECTS_DIR, EXPORTS_DIR, STATIC_DIR, FONTS_DIR, AMBIENT_DIR, DEMO_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

CONFIG_FILE = BASE_DIR / "config.json"

DEFAULT_CONFIG = {
    "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
    "gemini_model": "gemini-3.8-flash",
    "elevenlabs_api_key": os.getenv("ELEVENLABS_API_KEY", ""),
    "elevenlabs_model": "eleven_multilingual_v2",
    "default_voice_provider": "gemini",
    "default_voice": "Charon",
    "default_voice_en": "Charon",
    "default_voice_hi": "Prem",
    "custom_voice_id": "",
    "edge_tts_voice_en": "en-US-ChristopherNeural",
    "edge_tts_voice_hi": "hi-IN-MadhurNeural",
    "language": "en",
    "frame_style": "dark_ambient",
    "motion_speed": "smooth_slow",
    "export_quality": "1080p",
    "page_range": "15",
    "enable_audio_mastering": True,
    "enable_ambient_bed": True,
    "ambient_volume_db": -28.0,
    "enable_color_grade": True,
    "enable_noise_overlay": True,
    "enable_watermark": False,
    "watermark_text": "Manga Recap Studio",
    "watermark_position": "top_right",
    "watermark_opacity": 0.45,
    "watermark_font_size": 32,
    "reading_order": "top_to_bottom",
    "server_port": 5503
}

def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                merged = {**DEFAULT_CONFIG, **data}
                return merged
        except Exception:
            pass
    return DEFAULT_CONFIG.copy()

def save_config(new_config: dict) -> dict:
    current = load_config()
    current.update(new_config)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    return current
