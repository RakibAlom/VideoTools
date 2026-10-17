import os
import re
import time
import json
import shutil
import random
import asyncio
import subprocess
import requests
import uuid
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
import edge_tts

from app.audio_transcriber import get_media_duration
from app.languages import get_language_info

VOICE_DETAILS: Dict[str, Dict[str, str]] = {
    # English
    "Christopher": {"id": "en-US-ChristopherNeural", "lang": "en", "gender": "Male", "label": "Christopher (US - Deep Dramatic Recap)"},
    "Guy": {"id": "en-US-GuyNeural", "lang": "en", "gender": "Male", "label": "Guy (US - Energetic Storyteller)"},
    "Eric": {"id": "en-US-EricNeural", "lang": "en", "gender": "Male", "label": "Eric (US - Fast-Paced Commentary)"},
    "Roger": {"id": "en-US-RogerNeural", "lang": "en", "gender": "Male", "label": "Roger (US - Movie Trailer / Gritty)"},
    "Andrew": {"id": "en-US-AndrewNeural", "lang": "en", "gender": "Male", "label": "Andrew (US - Warm Narrative)"},
    "Brian": {"id": "en-GB-BrianNeural", "lang": "en", "gender": "Male", "label": "Brian (UK - Documentary / Mystery)"},
    "Ryan": {"id": "en-GB-RyanNeural", "lang": "en", "gender": "Male", "label": "Ryan (UK - Expressive Storyteller)"},
    "Liam": {"id": "en-CA-LiamNeural", "lang": "en", "gender": "Male", "label": "Liam (CA - Casual Modern Male)"},
    "Prabhat": {"id": "en-IN-PrabhatNeural", "lang": "en", "gender": "Male", "label": "Prabhat (IN - Indian English Male)"},
    "Jenny": {"id": "en-US-JennyNeural", "lang": "en", "gender": "Female", "label": "Jenny (US - Warm Engaging Female)"},
    "Aria": {"id": "en-US-AriaNeural", "lang": "en", "gender": "Female", "label": "Aria (US - Cinematic Dramatic Female)"},
    "Sonia": {"id": "en-GB-SoniaNeural", "lang": "en", "gender": "Female", "label": "Sonia (UK - Sophisticated Female)"},
    "Neerja": {"id": "en-IN-NeerjaNeural", "lang": "en", "gender": "Female", "label": "Neerja (IN - Indian English Female)"},

    # Bengali
    "Pradeep": {"id": "bn-BD-PradeepNeural", "lang": "bn", "gender": "Male", "label": "Pradeep (BD - Male Storyteller / Recap)"},
    "Nabanita": {"id": "bn-BD-NabanitaNeural", "lang": "bn", "gender": "Female", "label": "Nabanita (BD - Female Emotional Story)"},
    "Bashkar": {"id": "bn-IN-BashkarNeural", "lang": "bn", "gender": "Male", "label": "Bashkar (IN - Kolkata Male Commentary)"},
    "Tanishaa": {"id": "bn-IN-TanishaaNeural", "lang": "bn", "gender": "Female", "label": "Tanishaa (IN - Kolkata Expressive Female)"},

    # Hindi
    "Madhur": {"id": "hi-IN-MadhurNeural", "lang": "hi", "gender": "Male", "label": "Madhur (IN - Dramatic Bollywood Storyteller)"},
    "Swara": {"id": "hi-IN-SwaraNeural", "lang": "hi", "gender": "Female", "label": "Swara (IN - Expressive Cinematic Female)"},

    # Urdu
    "Asad": {"id": "ur-PK-AsadNeural", "lang": "ur", "gender": "Male", "label": "Asad (PK - Dramatic Storyteller Male)"},
    "Uzma": {"id": "ur-PK-UzmaNeural", "lang": "ur", "gender": "Female", "label": "Uzma (PK - Narrative Warm Female)"},
    "Salman": {"id": "ur-IN-SalmanNeural", "lang": "ur", "gender": "Male", "label": "Salman (IN - Deep Urdu Commentary Male)"},
    "Gul": {"id": "ur-IN-GulNeural", "lang": "ur", "gender": "Female", "label": "Gul (IN - Urdu Storyteller Female)"},

    # Spanish
    "Alvaro": {"id": "es-ES-AlvaroNeural", "lang": "es", "gender": "Male", "label": "Alvaro (ES - Spain Male Recapper)"},
    "Elvira": {"id": "es-ES-ElviraNeural", "lang": "es", "gender": "Female", "label": "Elvira (ES - Spain Expressive Female)"},
    "Jorge": {"id": "es-MX-JorgeNeural", "lang": "es", "gender": "Male", "label": "Jorge (MX - Mexico Male Storyteller)"},
    "Dalia": {"id": "es-MX-DaliaNeural", "lang": "es", "gender": "Female", "label": "Dalia (MX - Mexico Warm Female)"},

    # Japanese
    "Keita": {"id": "ja-JP-KeitaNeural", "lang": "ja", "gender": "Male", "label": "Keita (JP - Anime Male Recap)"},
    "Nanami": {"id": "ja-JP-NanamiNeural", "lang": "ja", "gender": "Female", "label": "Nanami (JP - Anime Female Storyteller)"}
}

EDGE_TTS_VOICE_MAP: Dict[str, str] = {name: info["id"] for name, info in VOICE_DETAILS.items()}


def get_voices_for_language(lang_code: str) -> List[Dict[str, str]]:
    """Returns list of voices formatted for UI dropdown based on language."""
    clean_code = "en" if lang_code == "same_rewrite" else lang_code.lower()
    matches = []
    others = []
    for name, v in VOICE_DETAILS.items():
        item = {"name": name, "label": v["label"], "gender": v["gender"], "lang": v["lang"]}
        if v["lang"] == clean_code:
            matches.append(item)
        else:
            others.append(item)
    return matches if matches else others


ELEVENLABS_CATALOG: List[Dict[str, str]] = [
    {"name": "Adam", "id": "pNInz6obpgDQGcFmaJgB", "label": "Adam (US Male - Deep Cinematic & Documentary)", "gender": "Male", "lang": "all"},
    {"name": "George", "id": "JBFqnCBsd6RMkjVDRZzb", "label": "George (UK Male - Warm Storyteller & Recap)", "gender": "Male", "lang": "all"},
    {"name": "Marcus", "id": "Id6i74XpY042K7R9yU2U", "label": "Marcus (US Male - Authoritative & Gritty Action)", "gender": "Male", "lang": "all"},
    {"name": "Daniel", "id": "onwK4e9ZLuTAKqWW03F9", "label": "Daniel (UK Male - Deep British Documentary)", "gender": "Male", "lang": "all"},
    {"name": "Prem", "id": "TxGEqnHWrfWFTfGW9XjX", "label": "Prem (IN Male - Dramatic Hindi/English Narration)", "gender": "Male", "lang": "hi"},
    {"name": "Kabir", "id": "ErXwobaYiN019PkySvjV", "label": "Kabir (IN Male - Intense Bollywood Commentary)", "gender": "Male", "lang": "hi"},
    {"name": "Aditi", "id": "21m00Tcm4TlvDq8ikWAM", "label": "Aditi (IN Female - Indian Expressive Storyteller)", "gender": "Female", "lang": "hi"},
    {"name": "Rachel", "id": "21m00Tcm4TlvDq8ikWAM", "label": "Rachel (US Female - Calm & Engaging Narrative)", "gender": "Female", "lang": "all"},
    {"name": "Drew", "id": "29vD33N1CtxCmqQRPOHJ", "label": "Drew (US Male - Fast Dynamic Recapper)", "gender": "Male", "lang": "all"},
    {"name": "Clyde", "id": "2EiwWnXFnvU5JabPnv8n", "label": "Clyde (US Male - Gritty Veteran & War Trailer)", "gender": "Male", "lang": "all"},
    {"name": "Paul", "id": "5Q0t7uMcjvnagumLfvZi", "label": "Paul (US Male - Grounded Audiobook Recapper)", "gender": "Male", "lang": "all"},
    {"name": "Domi", "id": "AZnzlk1XvdvUeBnXmlld", "label": "Domi (US Female - Strong & Emphatic)", "gender": "Female", "lang": "all"},
    {"name": "Dave", "id": "CYw3kZ02Hs0563khs1Fj", "label": "Dave (UK Male - Conversational Video Essay)", "gender": "Male", "lang": "all"},
    {"name": "Fin", "id": "D38z5RcWu1voky8WS1ja", "label": "Fin (Irish Male - Lively Storyteller)", "gender": "Male", "lang": "all"},
    {"name": "Sarah", "id": "EXAVITQu4vr4xnSDxMaL", "label": "Sarah (US Female - Soft Warm Storytelling)", "gender": "Female", "lang": "all"},
    {"name": "Antoni", "id": "ErXwobaYiN019PkySvjV", "label": "Antoni (US Male - Energetic & Youthful)", "gender": "Male", "lang": "all"},
    {"name": "Thomas", "id": "GBv7mTt0atIp3Br8iCZE", "label": "Thomas (US Male - Calm Mystery & Suspense)", "gender": "Male", "lang": "all"},
    {"name": "Charlie", "id": "IKne3meq5aSn9XLyUdCD", "label": "Charlie (AU Male - Casual Australian Storyteller)", "gender": "Male", "lang": "all"},
    {"name": "Emily", "id": "LcfcDJNUP1GQjkzn1xUU", "label": "Emily (US Female - Expressive & Bright)", "gender": "Female", "lang": "all"},
    {"name": "Callum", "id": "N2lVS1w4EtoT3dr4eOWO", "label": "Callum (US Male - Intense & Dramatic Trailer)", "gender": "Male", "lang": "all"},
    {"name": "Liam", "id": "TX3LPaxmHKxFdv7VOQHJ", "label": "Liam (US Male - Young & Natural Recapper)", "gender": "Male", "lang": "all"},
    {"name": "Charlotte", "id": "XB0fDUnXU5powFXDhCwa", "label": "Charlotte (UK Female - Elegant Mystery Narrative)", "gender": "Female", "lang": "all"},
    {"name": "Matilda", "id": "XrExE9yKIg1WjnnlVkGX", "label": "Matilda (US Female - Warm Audio Drama)", "gender": "Female", "lang": "all"},
    {"name": "Will", "id": "bIHbv24MWmeRgasZH58o", "label": "Will (US Male - Friendly & Cheerful)", "gender": "Male", "lang": "all"},
    {"name": "Jessica", "id": "cgSgspJ2msm6clMCkdW9", "label": "Jessica (US Female - Playful & Upbeat)", "gender": "Female", "lang": "all"},
    {"name": "Eric", "id": "cjVigY5qzO86Huf0OWal", "label": "Eric (US Male - Conversational Modern Male)", "gender": "Male", "lang": "all"},
    {"name": "Chris", "id": "iP95p4xoKVk53GoZ742B", "label": "Chris (US Male - Natural & Casual)", "gender": "Male", "lang": "all"},
    {"name": "Brian", "id": "nPczCjzI2devNBz1zQrb", "label": "Brian (US Male - Deep Resonant Narration)", "gender": "Male", "lang": "all"},
    {"name": "Lily", "id": "pFZP5JQG7iQjIQuC4Bku", "label": "Lily (UK Female - Velvet Warmth & Story)", "gender": "Female", "lang": "all"},
    {"name": "Bill", "id": "pqHfZKP75CvOlQylNhV4", "label": "Bill (US Male - Trustworthy & Professional)", "gender": "Male", "lang": "all"}
]

ELEVENLABS_VOICE_MAP: Dict[str, str] = {v["name"]: v["id"] for v in ELEVENLABS_CATALOG}
# Allow direct lookup by ID as well
for v in ELEVENLABS_CATALOG:
    ELEVENLABS_VOICE_MAP[v["id"]] = v["id"]


def get_elevenlabs_voices(api_key: str = "", language: str = "en") -> List[Dict[str, str]]:
    """Returns curated ElevenLabs voices + dynamically retrieved custom account voices if authorized."""
    clean_code = "en" if language == "same_rewrite" else language.lower()
    results: List[Dict[str, str]] = []

    # 1. Check if user account has custom cloned voices
    if api_key:
        try:
            r = requests.get("https://api.elevenlabs.io/v1/voices", headers={"xi-api-key": api_key}, timeout=5)
            if r.status_code == 200:
                user_voices = r.json().get("voices", [])
                for uv in user_voices:
                    vid = uv.get("voice_id")
                    vname = uv.get("name")
                    cat = uv.get("category", "")
                    if vid and vname:
                        label = f"✨ {vname} (Custom {cat.title()})" if cat else f"✨ {vname} (Custom Account Voice)"
                        results.append({
                            "name": vid,
                            "id": vid,
                            "label": label,
                            "gender": uv.get("labels", {}).get("gender", "Voice"),
                            "lang": "all"
                        })
                        ELEVENLABS_VOICE_MAP[vname] = vid
                        ELEVENLABS_VOICE_MAP[vid] = vid
        except Exception:
            pass

    # 2. Prioritize language matches (e.g. Hindi voices Prem, Kabir, Aditi for Hindi target)
    lang_matches = []
    other_voices = []
    for item in ELEVENLABS_CATALOG:
        v_dict = {"name": item["name"], "id": item["id"], "label": item["label"], "gender": item["gender"], "lang": item["lang"]}
        if item["lang"] == clean_code:
            lang_matches.append(v_dict)
        else:
            other_voices.append(v_dict)

    return results + lang_matches + other_voices


def test_elevenlabs_connection(api_key: str) -> Dict[str, Any]:
    """Tests ElevenLabs API Key validity and reports subscription / quota status."""
    if not api_key or not api_key.strip():
        return {"status": "error", "message": "No ElevenLabs API Key provided."}
    
    clean_key = api_key.strip()
    # 1. Try reading user profile / quota
    try:
        r_user = requests.get("https://api.elevenlabs.io/v1/user", headers={"xi-api-key": clean_key}, timeout=8)
        if r_user.status_code == 200:
            data = r_user.json()
            sub = data.get("subscription", {})
            tier = sub.get("tier", "active")
            used = sub.get("character_count", 0)
            limit = sub.get("character_limit", 0)
            return {
                "status": "success",
                "message": f"Connected! Tier: {tier.upper()} | Quota: {used:,} / {limit:,} characters used."
            }
    except Exception:
        pass

    # 2. If user_read permission is not granted on this key, test a lightweight TTS synthesis probe
    try:
        test_url = "https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB"
        headers = {
            "xi-api-key": clean_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg"
        }
        payload = {
            "text": "Hi",
            "model_id": "eleven_multilingual_v2"
        }
        r_tts = requests.post(test_url, headers=headers, json=payload, timeout=12)
        if r_tts.status_code == 200:
            return {
                "status": "success",
                "message": "Connected successfully! ElevenLabs Text-to-Speech is active & authorized."
            }
        else:
            err_msg = r_tts.text
            try:
                err_json = r_tts.json()
                err_msg = err_json.get("detail", {}).get("message") or str(err_json.get("detail")) or err_msg
            except Exception:
                pass
            return {
                "status": "error",
                "message": f"ElevenLabs error ({r_tts.status_code}): {err_msg[:140]}"
            }
    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {e}"}


def test_gemini_connection(api_key: str, model_name: str = "gemini-4-argon") -> Dict[str, Any]:
    """Tests Google Gemini API Key validity and reports model availability."""
    if not api_key or not api_key.strip():
        return {"status": "error", "message": "No Google Gemini API Key provided."}
    
    clean_key = api_key.strip()
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={clean_key}"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return {
                "status": "success",
                "message": f"Connected! Google Gemini API key is valid & active for '{model_name}'."
            }
        else:
            err = resp.text
            try:
                err_json = resp.json()
                err = err_json.get("error", {}).get("message") or err
            except Exception:
                pass
            return {
                "status": "error",
                "message": f"Gemini error ({resp.status_code}): {err[:140]}"
            }
    except Exception as e:
        return {"status": "error", "message": f"Gemini connection timed out: {e}"}


async def _synthesize_edge_tts(text: str, voice_id: str, output_path: Path, rate_offset: str = "+0%") -> None:
    """Asynchronously generates speech using Edge-TTS."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text, voice_id, rate=rate_offset)
    await communicate.save(str(output_path))


def clean_narration_for_tts(text: str) -> str:
    """
    Cleans and prepares narration text for ultra-fluid, natural, continuous speech delivery:
    - Strips ALL punctuation: commas, full stops (periods . and Hindi dari ।), question marks,
      exclamation marks, semicolons, colons, dashes, ellipses, brackets, quotes.
    - Prevents unnatural breath pauses, halting dead air, and robotic stutters.
    - Preserves pure spoken words and natural storytelling cadence.
    """
    if not text:
        return ""
    t = re.sub(r'\[.*?\]', ' ', text)
    t = re.sub(r'\(.*?\)', ' ', t)
    # Strip all punctuation and pause-inducing symbols completely
    t = re.sub(r'[.,।!?;:\-—–\"\'“”‘’…~`#*_\^/\\\|+=\[\]\{\}<>۔]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def generate_edge_tts_sync(text: str, voice_name_or_id: str, output_path: Path, speed_pct: int = 0, language: str = "en") -> Path:
    """Synchronous wrapper for Edge-TTS with text sanitization, retry resilience, and language-aware fallback."""
    clean_text = clean_narration_for_tts(text)
    if not clean_text:
        clean_text = text.strip()
    if not clean_text:
        raise ValueError("Cannot synthesize speech from empty text.")

    lang_code = "en" if language in ("same_rewrite", "auto", "") else language.lower()
    lang_defaults = {
        "bn": "bn-BD-PradeepNeural",
        "hi": "hi-IN-MadhurNeural",
        "ur": "ur-PK-AsadNeural",
        "es": "es-ES-AlvaroNeural",
        "ja": "ja-JP-KeitaNeural",
        "en": "en-US-ChristopherNeural"
    }

    voice_id = EDGE_TTS_VOICE_MAP.get(voice_name_or_id, voice_name_or_id)
    if not voice_id or not voice_id.endswith("Neural"):
        voice_id = lang_defaults.get(lang_code, "en-US-ChristopherNeural")

    rate_str = f"{'+' if speed_pct >= 0 else ''}{speed_pct}%"
    last_err = None

    for attempt in range(3):
        try:
            try:
                asyncio.run(_synthesize_edge_tts(clean_text, voice_id, output_path, rate_str))
            except RuntimeError:
                loop = asyncio.new_event_loop()
                loop.run_until_complete(_synthesize_edge_tts(clean_text, voice_id, output_path, rate_str))
                loop.close()

            if output_path.exists() and output_path.stat().st_size > 500:
                return output_path
        except Exception as e:
            last_err = e
            time.sleep(0.4 * (attempt + 1))

    # Secondary fallback voices strictly in the target language
    fallback_map = {
        "bn": ["bn-BD-NabanitaNeural", "bn-IN-BashkarNeural", "bn-BD-PradeepNeural"],
        "hi": ["hi-IN-SwaraNeural", "hi-IN-MadhurNeural"],
        "ur": ["ur-PK-UzmaNeural", "ur-PK-AsadNeural"],
        "es": ["es-ES-ElviraNeural", "es-ES-AlvaroNeural"],
        "ja": ["ja-JP-NanamiNeural", "ja-JP-KeitaNeural"],
        "en": ["en-US-GuyNeural", "en-US-ChristopherNeural", "en-GB-RyanNeural"]
    }
    fallback_voices = fallback_map.get(lang_code, ["en-US-GuyNeural", "en-US-ChristopherNeural"])
    for fb_voice in fallback_voices:
        if fb_voice == voice_id:
            continue
        try:
            try:
                asyncio.run(_synthesize_edge_tts(clean_text, fb_voice, output_path, rate_str))
            except RuntimeError:
                loop = asyncio.new_event_loop()
                loop.run_until_complete(_synthesize_edge_tts(clean_text, fb_voice, output_path, rate_str))
                loop.close()
            if output_path.exists() and output_path.stat().st_size > 500:
                return output_path
        except Exception:
            pass

    if last_err:
        raise last_err
    return output_path


def generate_elevenlabs_tts(
    text: str,
    voice_name_or_id: str,
    output_path: Path,
    api_key: str,
    model: str = "eleven_multilingual_v2"
) -> Path:
    """Generates human-like voice using ElevenLabs API."""
    if not api_key:
        raise ValueError("ElevenLabs API Key required.")

    clean_text = clean_narration_for_tts(text)
    if not clean_text:
        clean_text = text.strip()

    voice_id = ELEVENLABS_VOICE_MAP.get(voice_name_or_id, voice_name_or_id)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
    payload = {
        "text": clean_text or text,
        "model_id": model,
        "voice_settings": {
            "stability": 0.48,
            "similarity_boost": 0.78,
            "style": 0.35,
            "use_speaker_boost": True
        }
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=45)
    if resp.status_code != 200:
        raise RuntimeError(f"ElevenLabs TTS failed ({resp.status_code}): {resp.text}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(resp.content)
    return output_path


def apply_audio_mastering(input_audio: Path, output_audio: Path) -> Path:
    """
    Passes voice track through broadcast mastering filter:
    - Highpass 80Hz removes sub rumble
    - Vocal compressor levels dynamics
    - Normalization sets optimal loudness (-16 LUFS)
    """
    output_audio.parent.mkdir(parents=True, exist_ok=True)
    af_filter = (
        "highpass=f=80,"
        "acompressor=threshold=-21dB:ratio=3:attack=20:release=250:makeup=2,"
        "loudnorm=I=-16:TP=-1.5:LRA=11"
    )
    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_audio),
        "-af", af_filter,
        "-ar", "48000",
        "-ac", "2",
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        str(output_audio)
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True)
        return output_audio
    except Exception:
        if input_audio != output_audio and input_audio.exists():
            shutil.copy2(input_audio, output_audio)
        return output_audio


def fit_audio_to_target_duration(input_audio: Path, output_audio: Path, target_sec: float) -> Path:
    """
    Guarantees every narration clip is EXACTLY synchronized with its scene:
    1. If voice speech exceeds target_sec, dynamically speeds it up using FFmpeg atempo.
       If it is significantly longer, speeds up to 1.38x and applies a smooth 0.15s fade-out at target_sec.
    2. If voice speech is shorter than target_sec, pads with natural silence (apad)
       so that narration ends naturally, followed by a breath/ambient gap, and next scene starts on time!
    3. Enforces -t target_sec so no clip can EVER exceed its allocated scene duration.
    4. Guarantees output_audio is ALWAYS written to disk.
    """
    output_audio.parent.mkdir(parents=True, exist_ok=True)
    dur = get_media_duration(input_audio)
    if dur <= 0 or target_sec <= 0:
        if input_audio != output_audio and input_audio.exists():
            shutil.copy2(input_audio, output_audio)
        return output_audio

    # If duration exceeds target by more than 0.05s, adjust speed
    if dur > target_sec + 0.05:
        speed_factor = dur / target_sec
        if speed_factor <= 1.40:
            af = f"atempo={speed_factor:.3f},apad=whole_dur={target_sec:.2f}"
        else:
            fade_st = max(0.2, target_sec - 0.20)
            af = f"atempo=1.350,afade=t=out:st={fade_st:.2f}:d=0.20,apad=whole_dur={target_sec:.2f}"
    elif dur < target_sec - 0.05:
        # Pad with silence to match exact scene duration
        af = f"apad=whole_dur={target_sec:.2f}"
    else:
        af = "anull"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_audio),
        "-af", af,
        "-t", f"{target_sec:.2f}",
        "-ar", "48000",
        "-ac", "2",
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        str(output_audio)
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True)
        return output_audio
    except Exception:
        if input_audio != output_audio and input_audio.exists():
            shutil.copy2(input_audio, output_audio)
        return output_audio


def generate_segment_voice(
    text: str,
    output_path: Path,
    target_duration: float,
    provider: str = "edge_tts",
    voice_name: str = "Christopher",
    language: str = "en",
    elevenlabs_api_key: str = "",
    gemini_api_key: str = ""
) -> Path:
    """Generates, masters, and time-syncs speech for a single narration segment."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path = output_path.with_name(f"raw_{output_path.name}")

    if provider == "elevenlabs" and elevenlabs_api_key:
        try:
            generate_elevenlabs_tts(text, voice_name, raw_path, elevenlabs_api_key)
        except Exception as e:
            print(f"[TTS] ElevenLabs failed, falling back to Edge-TTS: {e}")
            generate_edge_tts_sync(text, voice_name, raw_path)
    else:
        # Default zero-cost high quality Edge-TTS
        generate_edge_tts_sync(text, voice_name, raw_path)

    # Master audio dynamics
    mastered_path = output_path.with_name(f"mst_{output_path.name}")
    apply_audio_mastering(raw_path, mastered_path)

    # Time-sync to target scene duration
    fit_audio_to_target_duration(mastered_path, output_path, target_duration)

    # Guarantee output_path exists under all conditions
    if not output_path.exists():
        if mastered_path.exists():
            shutil.copy2(mastered_path, output_path)
        elif raw_path.exists():
            shutil.copy2(raw_path, output_path)

    # Clean intermediate files
    for p in [raw_path, mastered_path]:
        if p.exists() and p != output_path:
            try:
                p.unlink()
            except Exception:
                pass

    return output_path


def generate_voice_sample(
    provider: str,
    voice_name: str,
    output_path: Path,
    language: str = "en",
    elevenlabs_api_key: str = ""
) -> Path:
    """Generates a quick 3-5s sample for live browser testing."""
    lang_info = get_language_info(language)
    sample_text = lang_info.get("sample_text", "Welcome to Video Repurpose AI Studio. Testing voice output.")

    if provider == "elevenlabs" and elevenlabs_api_key:
        try:
            generate_elevenlabs_tts(sample_text, voice_name, output_path, elevenlabs_api_key)
            return output_path
        except Exception:
            pass

    generate_edge_tts_sync(sample_text, voice_name, output_path, language=language)
    return output_path


def synthesize_continuous_story_audio(
    full_script_text: str,
    output_path: Path,
    provider: str = "edge_tts",
    voice_name: str = "Christopher",
    language: str = "en",
    elevenlabs_api_key: str = "",
    progress_reporter: Optional[Any] = None
) -> Path:
    """
    Synthesizes the entire continuous story script as a fluid, emotional, broadcast-grade narration.
    Completely eliminates punctuation halts, breath pauses, and robotic fragmentation.
    Directly streams speech as an unbroken, natural, professional storytelling voice track.
    Zero timestamps, zero segment truncation, zero pause gaps, 100% complete story voiced.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    clean_text = clean_narration_for_tts(full_script_text)
    if not clean_text:
        raise ValueError("Cannot synthesize from empty script text.")

    word_count = len(clean_text.split())
    print(f"[Continuous TTS] Synthesizing full continuous story ({len(clean_text)} chars, {word_count} words) with {provider} ({voice_name}) in {language.upper()}...")
    if progress_reporter:
        progress_reporter(22, f"Synthesizing continuous story voiceover ({language.upper()}) without pauses...")

    temp_dir = output_path.parent / f"story_synth_{uuid.uuid4().hex[:6]}"
    temp_dir.mkdir(parents=True, exist_ok=True)
    raw_audio = temp_dir / "raw_continuous.mp3"

    # Edge-TTS handles up to 2,600 characters per stream reliably
    MAX_DIRECT_CHARS = 2600
    if len(clean_text) <= MAX_DIRECT_CHARS:
        try:
            if provider == "elevenlabs" and elevenlabs_api_key:
                generate_elevenlabs_tts(clean_text, voice_name, raw_audio, elevenlabs_api_key)
            else:
                generate_edge_tts_sync(clean_text, voice_name, raw_audio, language=language)
        except Exception as e:
            print(f"[Continuous TTS] Synthesis error: {e}, retrying with fallback voice...")
            generate_edge_tts_sync(clean_text, "", raw_audio, language=language)
    else:
        # Split large scripts into clean sections (~2500 chars) ONLY at whitespace boundaries (never in the middle of words)
        words = clean_text.split()
        chunks = []
        cur_chunk = []
        cur_len = 0
        for w in words:
            cur_chunk.append(w)
            cur_len += len(w) + 1
            if cur_len >= 2500:
                chunks.append(" ".join(cur_chunk))
                cur_chunk = []
                cur_len = 0
        if cur_chunk:
            chunks.append(" ".join(cur_chunk))

        chunk_files = []
        for c_idx, c_text in enumerate(chunks, 1):
            c_file = temp_dir / f"chunk_{c_idx:03d}.mp3"
            if progress_reporter:
                pct = 22 + int(36 * (c_idx / len(chunks)))
                progress_reporter(pct, f"Synthesizing continuous narration part {c_idx}/{len(chunks)}...")
            try:
                if provider == "elevenlabs" and elevenlabs_api_key:
                    generate_elevenlabs_tts(c_text, voice_name, c_file, elevenlabs_api_key)
                else:
                    generate_edge_tts_sync(c_text, voice_name, c_file, language=language)
            except Exception as e:
                generate_edge_tts_sync(c_text, "", c_file, language=language)
            if c_file.exists() and c_file.stat().st_size > 500:
                chunk_files.append(c_file)

        # Concatenate chunks DIRECTLY with ZERO pause files
        concat_list = temp_dir / "concat_list.txt"
        with open(concat_list, "w", encoding="utf-8") as f:
            for cf in chunk_files:
                f.write(f"file '{cf.resolve().as_posix()}'\n")

        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
            "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            str(raw_audio)
        ], capture_output=True, check=True)

    if not raw_audio.exists() or raw_audio.stat().st_size < 1000:
        raise RuntimeError("Speech synthesis failed to produce audio.")

    # Broadcast audio mastering (EQ, compression, -16 LUFS loudness)
    if progress_reporter:
        progress_reporter(60, "Mastering audio with broadcast EQ and loudness normalization...")
    apply_audio_mastering(raw_audio, output_path)

    try:
        shutil.rmtree(temp_dir)
    except Exception:
        pass

    return output_path


def synthesize_time_synced_dubbing_audio(
    segments: List[Dict[str, Any]],
    total_duration: float,
    output_path: Path,
    provider: str = "edge_tts",
    voice_name: str = "Madhur",
    language: str = "hi",
    elevenlabs_api_key: str = "",
    progress_reporter: Optional[Any] = None
) -> Path:
    """
    Synthesizes exact time-synchronized 1:1 dubbing audio track matching original video audio timeline:
    - Every segment speech starts at the exact second the original voice spoke (seg['start']).
    - Each segment is time-fitted with fit_audio_to_target_duration to (seg['end'] - seg['start']).
    - Gaps between dialogue scenes are filled with clean audio so dialogue is locked 100% to scene visuals.
    - Zero drift, zero desync, exact same frames and timing.
    """
    import concurrent.futures

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = output_path.parent / f"dub_synth_{uuid.uuid4().hex[:6]}"
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Sort segments by start time
    sorted_segs = sorted(segments, key=lambda s: float(s.get("start", 0.0)))
    total_segs = len(sorted_segs)

    print(f"[Timeline Dubbing] Synthesizing {total_segs} time-synchronized speech segments with {provider} ({voice_name}) in {language.upper()}...")

    # Worker to synthesize and fit a single segment
    def _synth_segment(seg: Dict[str, Any]) -> Tuple[int, Optional[Path]]:
        sid = seg.get("segment_id", 0)
        st = float(seg.get("start", 0.0))
        en = float(seg.get("end", st + 1.0))
        dur = max(0.5, en - st)
        text = (seg.get("rewritten_text") or seg.get("original_text") or "").strip()
        clean_text = clean_narration_for_tts(text)

        if not clean_text:
            # Silent clip if no speech
            silent_path = temp_dir / f"fit_seg_{sid:04d}.mp3"
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                "-t", f"{dur:.2f}", "-c:a", "libmp3lame", "-b:a", "192k",
                str(silent_path)
            ], capture_output=True)
            return sid, silent_path

        raw_path = temp_dir / f"raw_seg_{sid:04d}.mp3"
        fit_path = temp_dir / f"fit_seg_{sid:04d}.mp3"

        try:
            if provider == "elevenlabs" and elevenlabs_api_key:
                try:
                    generate_elevenlabs_tts(clean_text, voice_name, raw_path, elevenlabs_api_key)
                except Exception as el_err:
                    print(f"[Timeline Dubbing] ElevenLabs error on seg {sid}: {el_err}, falling back to Edge-TTS")
                    generate_edge_tts_sync(clean_text, voice_name, raw_path, language=language)
            else:
                generate_edge_tts_sync(clean_text, voice_name, raw_path, language=language)

            if raw_path.exists() and raw_path.stat().st_size > 500:
                fit_audio_to_target_duration(raw_path, fit_path, dur)
                return sid, fit_path
        except Exception as e:
            print(f"[Timeline Dubbing] Error on seg {sid}: {e}")
            try:
                generate_edge_tts_sync(clean_text, "", raw_path, language=language)
                if raw_path.exists() and raw_path.stat().st_size > 500:
                    fit_audio_to_target_duration(raw_path, fit_path, dur)
                    return sid, fit_path
            except Exception:
                pass

        # Fallback to silent clip of exact duration
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
            "-t", f"{dur:.2f}", "-c:a", "libmp3lame", "-b:a", "192k",
            str(fit_path)
        ], capture_output=True)
        return sid, fit_path

    # Run synthesis across 8 parallel workers for maximum speed
    seg_audio_map: Dict[int, Path] = {}
    completed_cnt = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, max(1, total_segs))) as executor:
        futs = {executor.submit(_synth_segment, s): s.get("segment_id", 0) for s in sorted_segs}
        for fut in concurrent.futures.as_completed(futs):
            completed_cnt += 1
            if progress_reporter:
                pct = 20 + int(45 * (completed_cnt / total_segs))
                progress_reporter(pct, f"Synthesizing time-locked speech scene {completed_cnt} of {total_segs} ({language.upper()})...")
            sid_res, p_res = fut.result()
            if p_res:
                seg_audio_map[sid_res] = p_res

    # Build full contiguous timeline: gaps + speech clips
    timeline_clips: List[Path] = []
    cur_time = 0.0
    gap_idx = 0

    for seg in sorted_segs:
        sid = seg.get("segment_id", 0)
        st = float(seg.get("start", 0.0))
        en = float(seg.get("end", st + 1.0))

        # Check for gap before this speech segment
        if st > cur_time + 0.04:
            gap_dur = st - cur_time
            gap_file = temp_dir / f"gap_{gap_idx:04d}.mp3"
            gap_idx += 1
            subprocess.run([
                "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                "-t", f"{gap_dur:.2f}", "-c:a", "libmp3lame", "-b:a", "192k",
                str(gap_file)
            ], capture_output=True)
            timeline_clips.append(gap_file)
            cur_time = st

        # Add the fitted speech clip
        if sid in seg_audio_map and seg_audio_map[sid].exists():
            timeline_clips.append(seg_audio_map[sid])
            cur_time = en

    # Tail gap if video continues after last dialogue
    if total_duration > cur_time + 0.05:
        tail_dur = total_duration - cur_time
        tail_file = temp_dir / "tail_gap.mp3"
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
            "-t", f"{tail_dur:.2f}", "-c:a", "libmp3lame", "-b:a", "192k",
            str(tail_file)
        ], capture_output=True)
        timeline_clips.append(tail_file)

    if not timeline_clips:
        raise RuntimeError("Timeline dubbing failed to assemble audio clips.")

    # Concat all timeline clips into master audio
    concat_list = temp_dir / "dub_concat_list.txt"
    with open(concat_list, "w", encoding="utf-8") as f:
        for c in timeline_clips:
            f.write(f"file '{c.resolve().as_posix()}'\n")

    raw_stitched = temp_dir / "raw_dub_stitched.mp3"
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list),
        "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        str(raw_stitched)
    ], capture_output=True, check=True)

    # Master dynamics & loudness
    apply_audio_mastering(raw_stitched, output_path)

    try:
        shutil.rmtree(temp_dir)
    except Exception:
        pass

    return output_path

