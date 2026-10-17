import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "config.json"
LEGACY_CONFIG = BASE_DIR.parent / "manga-recap-ai-studio" / "config.json"


class AppConfig(BaseModel):
    # API & Models
    gemini_api_key: str = ""
    gemini_model: str = "gemini-4-argon"
    elevenlabs_api_key: str = ""
    elevenlabs_model: str = "eleven_multilingual_v2"
    
    # Audio & Voice Defaults
    default_voice_provider: str = "edge_tts"  # 'edge_tts', 'gemini', 'elevenlabs'
    source_language: str = "auto"              # 'auto', 'en', 'hi', 'bn', 'ur', 'es', 'ja'
    target_language: str = "hi"                # 'same_rewrite', 'hi', 'en', 'bn', 'ur', 'es'
    rewrite_tone: str = "storyteller"          # 'storyteller', 'suspense', 'casual', 'fast_paced', 'cinematic'
    custom_instructions: str = (
        "Re-write the commentary completely in an engaging, narrative storytelling tone. "
        "Keep the exact scene progression, plot twists, and explanations, but use fresh phrasing, "
        "dramatic hooks, and conversational cadence. Skip channel self-promotions and ads."
    )
    
    # Edge-TTS Voice mappings
    edge_tts_voice_en: str = "en-US-ChristopherNeural"
    edge_tts_voice_hi: str = "hi-IN-MadhurNeural"
    edge_tts_voice_bn: str = "bn-BD-PradeepNeural"
    edge_tts_voice_ur: str = "ur-PK-AsadNeural"
    edge_tts_voice_es: str = "es-ES-AlvaroNeural"
    
    # Gemini Voice mapping
    gemini_voice: str = "Charon"  # Charon, Aoede, Fenrir, Kore, Puck
    
    # ElevenLabs voice clone / presets
    elevenlabs_voice_id: str = "pNInz6obpgDQGcFmaJgB"  # Adam
    
    # Anti-Copyright & Video Manipulation
    anti_copyright_mirror: bool = True
    anti_copyright_speed: float = 1.03
    anti_copyright_grain: bool = True
    anti_copyright_vignette: bool = True
    anti_copyright_color_grade: str = "cinematic_warm"  # 'none', 'cinematic_warm', 'teal_orange', 'noir', 'vibrant'
    anti_copyright_micro_crop: bool = True
    
    # Visual Framing & Canvas
    aspect_ratio: str = "16:9"             # '16:9', '9:16', '1:1'
    framing_style: str = "blur_background" # 'blur_background', 'full_fit', 'cinematic_bars'
    
    # Watermark Removal (Delogo)
    enable_watermark_removal: bool = False
    watermark_delogo_box: Dict[str, Any] = Field(
        default_factory=lambda: {"preset": "top_right", "x": 0.80, "y": 0.03, "w": 0.18, "h": 0.12}
    )
    
    # Custom Brand / Channel Watermark
    enable_custom_watermark: bool = False
    custom_watermark_text: str = "@MyRecapChannel"
    custom_watermark_position: str = "top_right"
    custom_watermark_opacity: float = 0.45
    custom_watermark_font_size: int = 32
    
    # Background Music
    bgm_preset: str = "suspense"  # 'suspense', 'action', 'lofi', 'ambient', 'none'
    bgm_volume_db: float = -26.0
    mute_original_audio: bool = True
    
    # Export Settings
    export_quality: str = "1080p"  # '480p', '720p', '1080p', '2k', '4k'
    export_fps: int = 30
    server_port: int = 5504

    @property
    def has_gemini_key(self) -> bool:
        if not self.gemini_api_key:
            return False
        k = self.gemini_api_key.strip().upper()
        return bool(len(k) > 8 and not k.startswith("DEMO") and k != "YOUR_GEMINI_API_KEY")

    @property
    def has_elevenlabs_key(self) -> bool:
        if not self.elevenlabs_api_key:
            return False
        k = self.elevenlabs_api_key.strip().upper()
        return bool(len(k) > 8 and not k.startswith("DEMO") and k != "YOUR_ELEVENLABS_API_KEY")

    @property
    def gemini_api_key_masked(self) -> str:
        if not self.gemini_api_key:
            return ""
        k = self.gemini_api_key.strip()
        if len(k) <= 8:
            return "****"
        return f"{k[:4]}...{k[-4:]}"

    @property
    def elevenlabs_api_key_masked(self) -> str:
        if not self.elevenlabs_api_key:
            return ""
        k = self.elevenlabs_api_key.strip()
        if len(k) <= 8:
            return "****"
        return f"{k[:4]}...{k[-4:]}"


def load_config() -> AppConfig:
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return AppConfig(**data)
        except Exception as e:
            print(f"[Config] Error reading {CONFIG_PATH}: {e}, falling back to defaults")

    cfg = AppConfig()
    # Check if legacy manga recap config exists to reuse the user's Gemini key automatically
    if LEGACY_CONFIG.exists():
        try:
            with open(LEGACY_CONFIG, "r", encoding="utf-8") as lf:
                legacy_data = json.load(lf)
                if legacy_data.get("gemini_api_key"):
                    cfg.gemini_api_key = legacy_data["gemini_api_key"]
                if legacy_data.get("gemini_model"):
                    cfg.gemini_model = legacy_data["gemini_model"]
                if legacy_data.get("elevenlabs_api_key"):
                    cfg.elevenlabs_api_key = legacy_data["elevenlabs_api_key"]
        except Exception:
            pass

    save_config(cfg)
    return cfg


def save_config(config: AppConfig) -> None:
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Config] Error saving config: {e}")
