import os
import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image, ImageEnhance, ImageDraw, ImageFont, ImageFilter

from app.config import FONTS_DIR

DEFAULT_FONTS = [
    Path(r"C:\Windows\Fonts\impact.ttf"),
    Path(r"C:\Windows\Fonts\ariblk.ttf"),
    Path(r"C:\Windows\Fonts\arialbd.ttf"),
    FONTS_DIR / "impact.ttf",
    FONTS_DIR / "arialbd.ttf"
]

# High-CTR Viral YouTube Thumbnail Themes
THUMBNAIL_THEMES = {
    "viral_yellow": {
        "name": "Viral Electric Yellow (Highest CTR)",
        "line1_color": (255, 255, 255),       # Ultra White
        "line2_color": (255, 230, 0),         # Electric Viral Yellow #FFE600
        "rim_glow_bgr": (0, 180, 255),        # Amber Gold BGR
        "border_color_rgba": (255, 220, 0, 240),
        "backplate_bg_rgba": (8, 8, 14, 215)
    },
    "crimson_revenge": {
        "name": "Crimson Revenge (Dark Fantasy / Blood)",
        "line1_color": (255, 255, 255),       # Ultra White
        "line2_color": (255, 42, 42),         # Crimson Red #FF2A2A
        "rim_glow_bgr": (0, 30, 255),         # Fiery Crimson BGR
        "border_color_rgba": (255, 45, 45, 240),
        "backplate_bg_rgba": (16, 5, 8, 220)
    },
    "electric_cyan": {
        "name": "Electric Cyan (Solo Leveling / Frost)",
        "line1_color": (255, 255, 255),       # Ultra White
        "line2_color": (0, 245, 255),         # Neon Cyan #00F5FF
        "rim_glow_bgr": (255, 200, 0),        # Cyan Blue BGR
        "border_color_rgba": (0, 240, 255, 240),
        "backplate_bg_rgba": (5, 12, 20, 220)
    },
    "monarch_purple": {
        "name": "Shadow Monarch Purple (Overpowered MC)",
        "line1_color": (255, 255, 255),       # Ultra White
        "line2_color": (224, 64, 251),        # Amethyst Violet #E040FB
        "rim_glow_bgr": (255, 40, 180),       # Neon Violet BGR
        "border_color_rgba": (210, 50, 255, 240),
        "backplate_bg_rgba": (14, 6, 20, 220)
    },
    "toxic_green": {
        "name": "Toxic Acid Green (Poison / Necromancer)",
        "line1_color": (255, 255, 255),       # Ultra White
        "line2_color": (0, 255, 102),         # Acid Green #00FF66
        "rim_glow_bgr": (0, 255, 120),        # Toxic Green BGR
        "border_color_rgba": (0, 255, 100, 240),
        "backplate_bg_rgba": (5, 18, 10, 220)
    }
}

FONT_SIZE_PRESETS = {
    "giant": 135,
    "large": 110,
    "standard": 92
}

def apply_radial_vignette(image_np: np.ndarray, strength: float = 0.55) -> np.ndarray:
    """
    Applies a cinematic radial dark vignette to focus viewer attention on the center action.
    """
    h, w = image_np.shape[:2]
    x = np.linspace(-1, 1, w)
    y = np.linspace(-1, 1, h)
    xx, yy = np.meshgrid(x, y)
    radius = np.sqrt(xx**2 + yy**2)
    radius = np.clip(radius / np.sqrt(2), 0, 1)
    vignette = 1.0 - (radius**1.6) * strength
    vignette = np.clip(vignette, 0.25, 1.0)
    
    result = image_np.astype(np.float32)
    for c in range(3):
        result[:, :, c] = result[:, :, c] * vignette
    return np.clip(result, 0, 255).astype(np.uint8)

def apply_action_rim_glow(image_np: np.ndarray, glow_color_bgr: tuple = (0, 160, 255), thickness: int = 12) -> np.ndarray:
    """
    Adds a subtle, glowing energy rim border around the thumbnail matching the theme.
    """
    h, w = image_np.shape[:2]
    overlay = image_np.copy()
    cv2.rectangle(overlay, (0, 0), (w, h), glow_color_bgr, thickness=thickness * 2)
    blurred = cv2.GaussianBlur(overlay, (25, 25), 0)
    return cv2.addWeighted(image_np, 0.86, blurred, 0.14, 0)

def get_best_font(size: int = 120) -> ImageFont.FreeTypeFont:
    """
    Finds and loads the heaviest available bold font (Impact, Arial Black).
    """
    for font_path in DEFAULT_FONTS:
        if font_path.exists():
            try:
                return ImageFont.truetype(str(font_path), size)
            except Exception:
                pass
    return ImageFont.load_default()

def smart_split_hook_lines(text: str) -> list[str]:
    """
    Splits hook text into 1-2 punchy, stacked display lines for maximum font size.
    Examples:
      'HE WAS BETRAYED!' -> ['HE WAS', 'BETRAYED!']
      'GOD POWERS AWAKENED!' -> ['GOD POWERS', 'AWAKENED!']
      'BANNED FROM THE SECT!' -> ['BANNED FROM', 'THE SECT!']
      'LEFT FOR DEAD IN THE ABYSS' -> ['LEFT FOR DEAD', 'IN THE ABYSS']
      'SYSTEM ACTIVATED' -> ['SYSTEM', 'ACTIVATED']
    """
    cleaned = text.strip().upper()
    # If user already entered newlines, respect them
    if "\n" in cleaned:
        lines = [l.strip() for l in cleaned.split("\n") if l.strip()]
        return lines[:3]

    words = cleaned.split()
    if not words:
        return ["HE WAS", "BETRAYED!"]
    if len(words) == 1:
        return [words[0]]
    if len(words) == 2:
        return [words[0], words[1]]
    if len(words) == 3:
        # 3 words: Line 1 = 2 words, Line 2 = punchline
        return [f"{words[0]} {words[1]}", words[2]]
    if len(words) == 4:
        return [f"{words[0]} {words[1]}", f"{words[2]} {words[3]}"]
    if len(words) == 5:
        return [f"{words[0]} {words[1]} {words[2]}", f"{words[3]} {words[4]}"]
    
    # 6+ words: split in half
    mid = len(words) // 2
    return [" ".join(words[:mid]), " ".join(words[mid:])]

def generate_high_ctr_thumbnail(
    source_panel_path: Path,
    output_thumbnail_path: Path,
    hook_text: str = "HE WAS BETRAYED!",
    target_width: int = 1280,
    target_height: int = 720,
    theme: str = "viral_yellow",
    font_size_preset: str = "giant",
    custom_accent_color: Optional[Tuple[int, int, int]] = None
) -> bool:
    """
    Produces a world-class, high-CTR YouTube thumbnail:
    - 16:9 1280x720 cinematic framing with subject bias crop
    - Contrast boost (+30%) & Vibrance boost (+35%)
    - Unsharp mask for ultra-crisp manga inking lines
    - Deep radial corner vignette + Theme neon rim glow
    - GIANT two-tone stacked typography (Line 1: White, Line 2: Neon Accent)
    - Multi-pass 3D extruded drop shadow + 16px solid black outline
    - Translucent smoked-glass pill backplate with neon accent border
    - ZERO manga name, chapter, or author constraint
    """
    output_thumbnail_path.parent.mkdir(parents=True, exist_ok=True)
    
    img_bgr = cv2.imread(str(source_panel_path))
    if img_bgr is None:
        return False
        
    h_orig, w_orig = img_bgr.shape[:2]
    target_aspect = target_width / float(target_height)
    orig_aspect = w_orig / float(h_orig)
    
    # 1. Smart Subject-Focused Cropping
    if orig_aspect > target_aspect:
        # Image is wider: crop horizontal sides
        new_w = int(h_orig * target_aspect)
        start_x = (w_orig - new_w) // 2
        cropped = img_bgr[:, start_x:start_x + new_w]
    else:
        # Image is taller: crop vertical top/bottom with bias towards top 38% (faces/action)
        new_h = int(w_orig / target_aspect)
        start_y = max(0, int((h_orig - new_h) * 0.38))
        cropped = img_bgr[start_y:start_y + new_h, :]
        
    resized = cv2.resize(cropped, (target_width, target_height), interpolation=cv2.INTER_LANCZOS4)
    
    # Resolve Theme
    theme_cfg = THUMBNAIL_THEMES.get(theme, THUMBNAIL_THEMES["viral_yellow"])
    rim_color_bgr = theme_cfg["rim_glow_bgr"]
    line1_color = theme_cfg["line1_color"]
    line2_color = custom_accent_color or theme_cfg["line2_color"]
    border_color = theme_cfg["border_color_rgba"]
    backplate_bg = theme_cfg["backplate_bg_rgba"]

    # 2. Cinematic Vignette & Action Rim Glow
    vignetted = apply_radial_vignette(resized, strength=0.55)
    rimmed = apply_action_rim_glow(vignetted, glow_color_bgr=rim_color_bgr, thickness=12)
    
    # 3. Pillow Image Enhancements
    img_rgb = cv2.cvtColor(rimmed, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(img_rgb)
    
    # Contrast Enhancement (+30%)
    enhancer_con = ImageEnhance.Contrast(pil_img)
    pil_img = enhancer_con.enhance(1.30)
    
    # Saturation / Color Vibrance Enhancement (+35%)
    enhancer_sat = ImageEnhance.Color(pil_img)
    pil_img = enhancer_sat.enhance(1.35)
    
    # Sharpness / Unsharp Mask (gives comic inks razor-sharp definition)
    pil_img = pil_img.filter(ImageFilter.UnsharpMask(radius=2.2, percent=160, threshold=2))
    
    # 4. Giant Heavy Display Typography
    if hook_text and hook_text.strip():
        lines = smart_split_hook_lines(hook_text)
        draw_temp = ImageDraw.Draw(pil_img)
        
        # Base font size from preset
        base_size = FONT_SIZE_PRESETS.get(font_size_preset, 135)
        # If single line, make it even bigger
        if len(lines) == 1:
            base_size = int(base_size * 1.15)
            
        font_size = base_size
        font = get_best_font(font_size)
        
        # Max dimensions: 90% thumbnail width, 48% height
        max_allowed_w = int(target_width * 0.90)
        max_allowed_h = int(target_height * 0.48)
        
        # Measure and auto-scale down until it fits comfortably
        line_height_padding = 10
        while font_size > 55:
            font = get_best_font(font_size)
            max_line_w = 0
            total_h = 0
            for line in lines:
                bbox = draw_temp.textbbox((0, 0), line, font=font)
                lw = bbox[2] - bbox[0]
                lh = bbox[3] - bbox[1]
                max_line_w = max(max_line_w, lw)
                total_h += lh + line_height_padding
            
            if max_line_w <= max_allowed_w and total_h <= max_allowed_h:
                break
            font_size -= 5
            
        font = get_best_font(font_size)
        
        # Calculate line dimensions with final font
        line_boxes = []
        max_line_w = 0
        total_text_h = 0
        for line in lines:
            bbox = draw_temp.textbbox((0, 0), line, font=font)
            lw = bbox[2] - bbox[0]
            lh = bbox[3] - bbox[1]
            line_boxes.append((lw, lh))
            max_line_w = max(max_line_w, lw)
            total_text_h += lh + line_height_padding
            
        total_text_h -= line_height_padding # Remove trailing padding
        
        # Positioning: top banner zone (y ~ 50px to 80px), leaves bottom-right completely clear of YT timestamp
        start_y = int(target_height * 0.07)
        box_pad_x = 45
        box_pad_y = 22
        
        center_x = target_width // 2
        backplate_w = max_line_w + (box_pad_x * 2)
        backplate_h = total_text_h + (box_pad_y * 2)
        
        backplate_x0 = max(15, center_x - (backplate_w // 2))
        backplate_y0 = start_y - box_pad_y
        backplate_x1 = min(target_width - 15, backplate_x0 + backplate_w)
        backplate_y1 = backplate_y0 + backplate_h
        
        # 5. Render Smoked-Glass Gradient Backplate
        overlay = Image.new("RGBA", pil_img.size, (0, 0, 0, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        
        # Draw translucent rounded backplate
        overlay_draw.rounded_rectangle(
            [backplate_x0, backplate_y0, backplate_x1, backplate_y1],
            radius=20,
            fill=backplate_bg,
            outline=border_color,
            width=5
        )
        
        # Add subtle top neon glow accent line
        accent_y = backplate_y0 + 3
        overlay_draw.line(
            [(backplate_x0 + 25, accent_y), (backplate_x1 - 25, accent_y)],
            fill=border_color,
            width=4
        )
        
        # Composite backplate onto image
        pil_img = Image.alpha_composite(pil_img.convert("RGBA"), overlay).convert("RGB")
        draw = ImageDraw.Draw(pil_img)
        
        # 6. Render Giant 3D Extruded Text with Two-Tone Fill
        curr_y = start_y
        stroke_width = max(12, int(font_size * 0.12))
        
        # Multi-depth 3D shadow offsets
        shadow_steps = [(3, 4), (6, 8), (9, 12), (12, 16)]
        
        for idx, line in enumerate(lines):
            lw, lh = line_boxes[idx]
            line_x = (target_width - lw) // 2
            
            # Line 1 is Crisp White; Line 2 (Punchline) is Theme Accent Color
            line_color = line1_color if (idx == 0 and len(lines) > 1) else line2_color
            
            # Draw multi-step extruded 3D drop shadow (solid black)
            for sx, sy in shadow_steps:
                draw.text(
                    (line_x + sx, curr_y + sy),
                    line,
                    font=font,
                    fill=(0, 0, 0),
                    stroke_width=stroke_width,
                    stroke_fill=(0, 0, 0)
                )
                
            # Draw heavy black outline
            draw.text(
                (line_x, curr_y),
                line,
                font=font,
                fill=line_color,
                stroke_width=stroke_width,
                stroke_fill=(0, 0, 0)
            )
            
            curr_y += lh + line_height_padding

    # Save final high-CTR thumbnail in pristine PNG format
    pil_img.save(str(output_thumbnail_path), "PNG", quality=95)
    return output_thumbnail_path.exists()
