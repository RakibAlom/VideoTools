import os
import re
import json
import requests
from pathlib import Path
from typing import Dict, Any, List, Optional
from PIL import Image, ImageEnhance, ImageDraw, ImageFont, ImageFilter

from app.audio_transcriber import get_media_duration


def capture_dramatic_thumbnail_frame(video_path: Path, output_frame: Path, at_sec: Optional[float] = None) -> Path:
    """Extracts a frame from video (defaulting to 35% through the video where climax/action happens)."""
    duration = get_media_duration(video_path)
    seek_time = at_sec if at_sec is not None else max(1.0, duration * 0.35)
    
    output_frame.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(seek_time),
        "-i", str(video_path),
        "-frames:v", "1",
        "-q:v", "2",
        str(output_frame)
    ]
    import subprocess
    subprocess.run(cmd, capture_output=True, check=True)
    return output_frame


def generate_high_ctr_thumbnail(
    base_frame_path: Path,
    hook_text: str,
    output_path: Path,
    width: int = 1280,
    height: int = 720
) -> Path:
    """
    Produces a click-tested, high-CTR YouTube recap thumbnail:
    - High contrast & vibrance boost
    - Dark edge vignette
    - Massive bold hook text with dark outline & drop shadow
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.open(base_frame_path).convert("RGBA")

    # Resize & crop to 16:9 1280x720
    img.thumbnail((width * 2, height * 2), Image.Resampling.LANCZOS)
    img_w, img_h = img.size
    
    # Center crop
    left = (img_w - width) / 2
    top = (img_h - height) / 2
    right = (img_w + width) / 2
    bottom = (img_h + height) / 2
    img = img.crop((left, top, right, bottom)).resize((width, height), Image.Resampling.LANCZOS)

    # Color treatment: +18% contrast, +28% saturation
    enh_contrast = ImageEnhance.Contrast(img.convert("RGB"))
    img_rgb = enh_contrast.enhance(1.18)
    enh_sat = ImageEnhance.Color(img_rgb)
    img_enhanced = enh_sat.enhance(1.28).convert("RGBA")

    # Radial Vignette Overlay
    vignette = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    v_draw = ImageDraw.Draw(vignette)
    for r in range(height // 2, int(height * 0.9), 10):
        alpha = int(140 * ((r - height // 2) / (height * 0.4)))
        alpha = min(200, max(0, alpha))
        v_draw.rectangle([0, 0, width, height], outline=(0, 0, 0, alpha), width=15)
    img_enhanced = Image.alpha_composite(img_enhanced, vignette)

    # Text Rendering
    draw = ImageDraw.Draw(img_enhanced)
    text = (hook_text or "HE WAS BETRAYED!").upper().strip()

    # Font selection
    font_path = "C:/Windows/Fonts/impact.ttf"
    if not os.path.exists(font_path):
        font_path = "C:/Windows/Fonts/arialbd.ttf"

    font_size = 92
    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        font = ImageFont.load_default()

    # Wrap text if long
    words = text.split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        if len(" ".join(curr)) > 15:
            lines.append(" ".join(curr))
            curr = []
    if curr:
        lines.append(" ".join(curr))

    y_pos = int(height * 0.68) - (len(lines) * 55)
    for line in lines:
        try:
            bbox = draw.textbbox((0, 0), line, font=font)
            line_w = bbox[2] - bbox[0]
        except Exception:
            line_w = len(line) * 45
        
        x_pos = (width - line_w) // 2

        # Thick black outline
        outline_width = 8
        for dx in range(-outline_width, outline_width + 1):
            for dy in range(-outline_width, outline_width + 1):
                if dx * dx + dy * dy <= outline_width * outline_width:
                    draw.text((x_pos + dx, y_pos + dy + 4), line, font=font, fill=(0, 0, 0, 255))

        # Main text fill: vibrant yellow/white
        draw.text((x_pos, y_pos), line, font=font, fill=(255, 235, 59, 255))
        y_pos += int(font_size * 1.1)

    img_final = img_enhanced.convert("RGB")
    img_final.save(output_path, "JPEG", quality=95)
    return output_path


def generate_youtube_packaging_metadata(
    transcript_summary: str,
    api_key: str,
    model_name: str = "gemini-3.8-flash",
    target_language: str = "en"
) -> Dict[str, Any]:
    """Generates viral titles, SEO description, and tags via Gemini."""
    if not api_key:
        return _fallback_metadata()

    sys_prompt = """
You are a top YouTube viral strategist and packaging expert for movie and anime recaps.
Create a complete publishing kit enforcing these strict rules:
1. ZERO ORIGINAL CHANNEL / CREATOR NAMES: Never mention the previous uploader or source blog.
2. 5 VIRAL TITLES: High-CTR, curiosity-driven titles (e.g. 'He Was Left For Dead, But Awakened As An Ancient God...').
3. HOOK THUMBNAIL TEXT: 3-5 words of punchy, curiosity-piquing hook text.
4. SEO DESCRIPTION: 300+ words engaging synopsis, fair use commentary notice, engagement call-to-action.
5. 25 VIRAL TAGS: High-volume search keywords comma-separated.

Output STRICTLY a JSON object matching this schema:
{
  "titles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
  "thumbnail_hook": "HE WAS BETRAYED!",
  "description": "...",
  "tags": ["recap", "explained", "anime recap", "movie summary", "..."]
}
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": sys_prompt}]},
        "contents": [{"parts": [{"text": f"Story recap context:\n{transcript_summary[:3000]}"}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.8
        }
    }

    try:
        resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=45)
        if resp.status_code == 200:
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
            cleaned = re.sub(r"\s*```$", "", cleaned.strip())
            return json.loads(cleaned)
    except Exception as e:
        print(f"[Packaging] Metadata generation error: {e}")

    return _fallback_metadata()


def _fallback_metadata() -> Dict[str, Any]:
    return {
        "titles": [
            "He Was Betrayed And Cast Aside, But Awakened God-Tier Powers",
            "The Forbidden Awakening That Changed Everything In The Realm",
            "Everyone Mocked Him Until He Unleashed His True Identity",
            "Left For Dead In The Abyss, He Returned As The Ultimate Ruler",
            "The Shocking Truth Behind The Ancient Legend Revealed"
        ],
        "thumbnail_hook": "HE WAS BETRAYED!",
        "description": (
            "Welcome back to another thrilling recap! In today's story, an underestimated protagonist "
            "faces impossible odds and uncovers a secret that turns the entire realm upside down.\n\n"
            "🔔 Don't forget to like, subscribe, and hit the notification bell for more daily recaps!\n\n"
            "⚠️ Copyright Disclaimer under Section 107 of the Copyright Act 1976: Allowance is made for 'fair use' "
            "for purposes such as criticism, commentary, news reporting, and research."
        ),
        "tags": [
            "movie recap", "anime recap", "story recap", "full story explained",
            "manhwa recap", "recap animation", "viral recap", "plot breakdown"
        ]
    }
