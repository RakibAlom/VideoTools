import os
import json
import random
import base64
import asyncio
import subprocess
import requests
from pathlib import Path
import edge_tts

# Pre-configured Google Gemini Prebuilt Voices
GEMINI_VOICES = {
    "Charon": "Charon",   # Deep, cinematic, suspenseful male narrator (Ideal for dark fantasy, Death Note, Solo Leveling)
    "Puck": "Puck",       # Vibrant, energetic male recapper
    "Kore": "Kore",       # Clear, soothing, emotional female storyteller
    "Fenrir": "Fenrir",   # Deep, intense warrior / battle narrator
    "Aoede": "Aoede"      # Warm, expressive dramatic female narrator
}

from app.languages import (
    SUPPORTED_LANGUAGES,
    get_language_info,
    get_sample_text,
    get_edge_voice_for_language
)

# Pre-configured ElevenLabs Voice IDs
ELEVENLABS_VOICES = {
    "Adam": "pNInz6obpgDQGcFmaJgB",       # Deep, authoritative narrator
    "George": "JBFqnCBsd6RMkjVDRZzb",     # Warm storyteller
    "Marcus": "Id6i74XpY042K7R9yU2U",     # Resonant epic narrator
    "Daniel": "onwK4e9ZLuTAKqWW03F9",     # British suspenseful narrator
    "Prem": "TxGEqnHWrfWFTfGW9XjX",       # Expressive Hindi / Multilingual voice
    "Kabir": "ErXwobaYiN019PkySvjV",      # Deep Hindi / Multilingual voice
    "Aditi": "21m00Tcm4TlvDq8ikWAM"       # Expressive female narrator
}

# Pre-configured Zero-Cost Edge-TTS Voices across supported languages
EDGE_TTS_VOICES = {
    # English
    "Christopher": "en-US-ChristopherNeural",
    "Guy": "en-US-GuyNeural",
    "Andrew": "en-US-AndrewNeural",
    "Ryan": "en-GB-RyanNeural",
    # Hindi
    "Madhur": "hi-IN-MadhurNeural",
    "Swara": "hi-IN-SwaraNeural",
    # Urdu
    "Asad": "ur-PK-AsadNeural",
    "Uzma": "ur-PK-UzmaNeural",
    # Bangla
    "Pradeep": "bn-BD-PradeepNeural",
    "Nabanita": "bn-BD-NabanitaNeural",
    "Bashkar": "bn-IN-BashkarNeural",
    "Tanishaa": "bn-IN-TanishaaNeural",
    # Spanish
    "Alvaro": "es-ES-AlvaroNeural",
    "Elvira": "es-ES-ElviraNeural",
    # Japanese
    "Keita": "ja-JP-KeitaNeural",
    "Nanami": "ja-JP-NanamiNeural",
    # Korean
    "InJoon": "ko-KR-InJoonNeural",
    "SunHi": "ko-KR-SunHiNeural",
    # Indonesian
    "Ardi": "id-ID-ArdiNeural",
    "Gadis": "id-ID-GadisNeural",
    # Portuguese
    "Antonio": "pt-BR-AntonioNeural",
    "Francisca": "pt-BR-FranciscaNeural",
    # French
    "Denise": "fr-FR-DeniseNeural",
    "Henri": "fr-FR-HenriNeural",
    # German
    "Amala": "de-DE-AmalaNeural",
    "Conrad": "de-DE-ConradNeural",
    # Arabic
    "Hamed": "ar-SA-HamedNeural",
    "Zariyah": "ar-SA-ZariyahNeural"
}

def probe_audio_duration(audio_path: Path) -> float:
    """
    Probes the exact duration of an audio file in seconds using ffprobe/ffmpeg.
    """
    if not audio_path.exists():
        return 0.0
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(audio_path)
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        duration = float(res.stdout.strip())
        return max(1.0, duration)
    except Exception:
        try:
            cmd = ["ffmpeg", "-i", str(audio_path)]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for line in res.stderr.splitlines():
                if "Duration:" in line:
                    time_str = line.split("Duration:")[1].split(",")[0].strip()
                    parts = time_str.split(":")
                    return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        except Exception:
            pass
    return 4.0

def master_audio_file(input_path: Path, output_path: Path, enable_compressor: bool = True) -> bool:
    """
    Passes generated or recorded voice clips through an FFmpeg studio audio mastering filter:
    - Highpass filter at 80Hz: Removes low-end digital/mic rumble.
    - Soft Vocal Compressor: Levels peaks for crisp broadcast presence.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    if enable_compressor:
        af_filter = "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=10:release=100,volume=1.05"
    else:
        af_filter = "highpass=f=80"
        
    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-af", af_filter,
        "-ar", "48000",
        "-b:a", "192k",
        str(output_path)
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return res.returncode == 0 and output_path.exists()
    except Exception as e:
        print(f"Audio mastering error: {e}")
        return False

def synthesize_gemini_tts(
    text: str,
    output_file: Path,
    api_key: str,
    voice_name: str = "Charon",
    model_name: str = "gemini-2.5-flash-preview-tts"
) -> bool:
    """
    Generates human narrator voice directly using Google Gemini's native Audio TTS API.
    Converts 24kHz raw PCM into broadcast 48kHz mastered MP3.
    """
    clean_key = (api_key or "").strip()
    if not clean_key or clean_key.upper().startswith("DEMO") or clean_key == "YOUR_GEMINI_API_KEY":
        return False
        
    v_name = GEMINI_VOICES.get(voice_name, voice_name)
    if v_name not in GEMINI_VOICES.values():
        v_name = "Charon"
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": v_name
                    }
                }
            }
        }
    }
    
    try:
        res = requests.post(url, json=payload, timeout=45)
        if res.status_code == 200:
            data = res.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return False
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts or "inlineData" not in parts[0]:
                return False
                
            b64_audio = parts[0]["inlineData"]["data"]
            pcm_bytes = base64.b64decode(b64_audio)
            
            raw_pcm = output_file.with_suffix(".gemini.pcm")
            with open(raw_pcm, "wb") as f:
                f.write(pcm_bytes)
                
            # Convert raw 16-bit 24kHz PCM to mastered 48kHz MP3 via FFmpeg
            cmd = [
                "ffmpeg", "-y",
                "-f", "s16le",
                "-ar", "24000",
                "-ac", "1",
                "-i", str(raw_pcm),
                "-af", "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=10:release=100,volume=1.05",
                "-ar", "48000",
                "-b:a", "192k",
                str(output_file)
            ]
            sub = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if raw_pcm.exists():
                try: os.remove(raw_pcm)
                except Exception: pass
            return sub.returncode == 0 and output_file.exists()
        else:
            print(f"Gemini TTS error ({res.status_code}): {res.text[:120]}")
            return False
    except Exception as e:
        print(f"Gemini TTS exception: {e}")
        return False

def synthesize_elevenlabs(
    text: str,
    output_file: Path,
    api_key: str,
    voice_name_or_id: str = "Adam",
    model_id: str = "eleven_multilingual_v2"
) -> bool:
    """
    Generates human narrator voice using ElevenLabs API with human breathing settings.
    """
    clean_key = (api_key or "").strip()
    if not clean_key or clean_key.upper().startswith("DEMO") or clean_key == "YOUR_ELEVENLABS_API_KEY":
        return False
        
    voice_id = ELEVENLABS_VOICES.get(voice_name_or_id, voice_name_or_id)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
    
    payload = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.48,           # Natural emotional range & human inflection
            "similarity_boost": 0.78,    # Eliminates digital artifacts
            "style": 0.15,
            "use_speaker_boost": True
        }
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        if response.status_code == 200:
            raw_tmp = output_file.with_suffix(".raw.mp3")
            with open(raw_tmp, "wb") as f:
                f.write(response.content)
            mastered = master_audio_file(raw_tmp, output_file)
            if raw_tmp.exists():
                try: os.remove(raw_tmp)
                except Exception: pass
            return mastered or output_file.exists()
        else:
            print(f"ElevenLabs error ({response.status_code}): {response.text[:120]}")
            return False
    except Exception as e:
        print(f"ElevenLabs synthesis exception: {e}")
        return False

async def _synthesize_edge_tts_async(text: str, output_file: Path, voice: str, rate_variation: str = "+0%") -> bool:
    communicate = edge_tts.Communicate(text, voice, rate=rate_variation)
    raw_tmp = output_file.with_suffix(".raw.mp3")
    await communicate.save(str(raw_tmp))
    mastered = master_audio_file(raw_tmp, output_file)
    if raw_tmp.exists():
        try: os.remove(raw_tmp)
        except Exception: pass
    return mastered or output_file.exists()

def synthesize_edge_tts(text: str, output_file: Path, voice_name: str = "Christopher") -> bool:
    """
    Fallback edge-tts voice synthesis with random cadence variation (±3%) to prevent monotone playback.
    """
    voice = EDGE_TTS_VOICES.get(voice_name, voice_name)
    if not voice.endswith("Neural"):
        voice = "en-US-ChristopherNeural"
        
    delta = random.choice([-3, -2, -1, 0, 1, 2, 3])
    sign = "+" if delta >= 0 else ""
    rate_str = f"{sign}{delta}%"
    
    try:
        asyncio.run(_synthesize_edge_tts_async(text, output_file, voice, rate_str))
        return output_file.exists()
    except Exception as e:
        print(f"Edge-TTS synthesis error: {e}")
        return False

def generate_segment_voice(
    text: str,
    output_path: Path,
    voice_provider: str = "gemini",
    voice_name: str = "Charon",
    gemini_api_key: str = "",
    elevenlabs_api_key: str = "",
    custom_voice_id: str = "",
    language: str = "en"
) -> tuple[bool, float]:
    """
    Orchestrates voice generation for a single segment with intelligent cascading fallback:
    1. Gemini AI Voice (Default when Gemini key present, speaks all languages)
    2. ElevenLabs API (If requested & key present, Multilingual v2)
    3. Zero-Cost Edge-TTS (Studio native voices for English, Hindi, Urdu, Bangla, Spanish, etc.)
    Returns (success, duration_in_seconds).
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    success = False
    
    chosen_voice = custom_voice_id if custom_voice_id else voice_name

    # 1. ElevenLabs priority if explicitly chosen and key exists
    if voice_provider == "elevenlabs" and elevenlabs_api_key:
        success = synthesize_elevenlabs(text, output_path, elevenlabs_api_key, chosen_voice)

    # 2. Google Gemini TTS priority if selected or if ElevenLabs was unavailable
    if not success and (voice_provider == "gemini" or chosen_voice in GEMINI_VOICES) and gemini_api_key:
        gemini_v = chosen_voice if chosen_voice in GEMINI_VOICES else "Charon"
        success = synthesize_gemini_tts(text, output_path, gemini_api_key, gemini_v)

    # 3. Guaranteed High-Quality Native Edge-TTS Fallback
    if not success:
        if chosen_voice in EDGE_TTS_VOICES:
            edge_voice = EDGE_TTS_VOICES[chosen_voice]
        elif chosen_voice.endswith("Neural"):
            edge_voice = chosen_voice
        else:
            edge_voice = get_edge_voice_for_language(language, chosen_voice)
            
        success = synthesize_edge_tts(text, output_path, edge_voice)
        
    duration = probe_audio_duration(output_path) if success else 4.0
    return success, duration

def generate_voice_sample(
    voice_name: str,
    output_path: Path,
    gemini_api_key: str = "",
    elevenlabs_api_key: str = "",
    language: str = "en"
) -> bool:
    """
    Generates a short, engaging 3-second sample auditioning the voice in the requested language.
    """
    sample_text = get_sample_text(language)
    
    # Determine provider from voice name
    if voice_name in GEMINI_VOICES:
        if gemini_api_key:
            ok = synthesize_gemini_tts(sample_text, output_path, gemini_api_key, voice_name)
            if ok: return True
        # Fallback to Edge-TTS equivalent for instant audition in this language
        edge_v = get_edge_voice_for_language(language, voice_name)
        return synthesize_edge_tts(sample_text, output_path, edge_v)
        
    elif voice_name in ELEVENLABS_VOICES or len(voice_name) > 15:
        if elevenlabs_api_key:
            ok = synthesize_elevenlabs(sample_text, output_path, elevenlabs_api_key, voice_name)
            if ok: return True
        edge_v = get_edge_voice_for_language(language, voice_name)
        return synthesize_edge_tts(sample_text, output_path, edge_v)
        
    else:
        # Edge-TTS: either raw voice name or friendly name
        edge_v = EDGE_TTS_VOICES.get(voice_name, get_edge_voice_for_language(language, voice_name))
        return synthesize_edge_tts(sample_text, output_path, edge_v)

def process_manual_voice_file(uploaded_audio_path: Path, output_path: Path) -> tuple[bool, float]:
    """
    Processes a manually uploaded or browser-recorded audio voiceover file:
    Applies studio audio mastering (highpass + compressor) and normalizes to 48kHz.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    success = master_audio_file(uploaded_audio_path, output_path)
    if not success and uploaded_audio_path.exists():
        import shutil
        shutil.copy2(uploaded_audio_path, output_path)
        success = True
        
    duration = probe_audio_duration(output_path)
    return success, duration
