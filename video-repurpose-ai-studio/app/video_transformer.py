import os
import re
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from app.audio_transcriber import get_media_duration
from app.bgm_manager import adjust_audio_speed

WINDOWS_FONT_PATH = "C\\:/Windows/Fonts/arialbd.ttf"
FALLBACK_FONT_PATH = "C\\:/Windows/Fonts/arial.ttf"


def get_video_metadata(video_path: Path) -> Dict[str, Any]:
    """Inspects video resolution, duration, FPS, and codecs using ffprobe."""
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,codec_name:format=duration,size,bit_rate",
        "-of", "json",
        str(video_path)
    ]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
        stream = data.get("streams", [{}])[0]
        fmt = data.get("format", {})

        width = int(stream.get("width", 1920))
        height = int(stream.get("height", 1080))
        duration = float(fmt.get("duration", 0.0))

        fps_str = stream.get("r_frame_rate", "30/1")
        fps = 30.0
        if "/" in fps_str:
            num, den = fps_str.split("/")
            fps = round(float(num) / max(float(den), 1.0), 2)
        else:
            fps = float(fps_str)

        return {
            "width": width,
            "height": height,
            "duration": round(duration, 2),
            "fps": fps,
            "codec": stream.get("codec_name", "h264"),
            "size_bytes": int(fmt.get("size", 0))
        }
    except Exception as e:
        print(f"[FFprobe] Video probe error: {e}")
        return {"width": 1920, "height": 1080, "duration": 0.0, "fps": 30.0, "codec": "h264", "size_bytes": 0}


def get_canvas_resolution(aspect_ratio: str, quality: str) -> Tuple[int, int]:
    """Calculates width and height for target aspect ratio and export resolution."""
    res_map = {
        "16:9": {
            "480p": (854, 480),
            "720p": (1280, 720),
            "1080p": (1920, 1080),
            "2k": (2560, 1440),
            "4k": (3840, 2160)
        },
        "9:16": {
            "480p": (480, 854),
            "720p": (720, 1280),
            "1080p": (1080, 1920),
            "2k": (1440, 2560),
            "4k": (2160, 3840)
        },
        "1:1": {
            "480p": (480, 480),
            "720p": (720, 720),
            "1080p": (1080, 1080),
            "2k": (1440, 1440),
            "4k": (2160, 2160)
        },
        "4:5": {
            "480p": (480, 600),
            "720p": (720, 900),
            "1080p": (1080, 1350),
            "2k": (1440, 1800),
            "4k": (2160, 2700)
        }
    }
    return res_map.get(aspect_ratio, res_map["16:9"]).get(quality, (1920, 1080))


def build_anti_copyright_filtergraph(
    in_w: int,
    in_h: int,
    out_w: int,
    out_h: int,
    framing_style: str = "blur_background",
    mirror: bool = True,
    speed: float = 1.03,
    grain: bool = True,
    vignette: bool = True,
    color_grade: str = "cinematic_warm",
    micro_crop: bool = False,
    delogo_box: Optional[Dict[str, Any]] = None,
    custom_watermark: Optional[Dict[str, Any]] = None,
    text_overlays: Optional[List[Dict[str, Any]]] = None,
    duration_pad: float = 0.0
) -> str:
    """
    Builds the full FFmpeg video filtergraph to defeat automated perceptual hashing,
    remove existing logos, resize/pad to canvas, and burn styled overlays.
    """
    filters = []

    # 0. Anti-Copyright Tail Extension
    if duration_pad > 0.05:
        filters.append(f"tpad=stop_mode=clone:stop_duration={duration_pad:.2f}")

    # 1. Delogo (Watermark Removal) on input stream
    if delogo_box and delogo_box.get("enabled", False):
        dx = int(delogo_box.get("x", in_w * 0.8))
        dy = int(delogo_box.get("y", in_h * 0.05))
        dw = int(delogo_box.get("w", in_w * 0.18))
        dh = int(delogo_box.get("h", in_h * 0.12))
        
        # Clamp bounds
        dx = max(0, min(dx, in_w - 20))
        dy = max(0, min(dy, in_h - 20))
        dw = max(16, min(dw, in_w - dx))
        dh = max(16, min(dh, in_h - dy))
        filters.append(f"delogo=x={dx}:y={dy}:w={dw}:h={dh}:show=0")

    # 2. Horizontal Flip (Mirroring)
    if mirror:
        filters.append("hflip")

    # 3. Micro-Crop (2% random zoom/crop to break spatial hashing)
    if micro_crop:
        crop_w = int(in_w * 0.97)
        crop_h = int(in_h * 0.97)
        crop_x = int(in_w * 0.015)
        crop_y = int(in_h * 0.015)
        filters.append(f"crop={crop_w}:{crop_h}:{crop_x}:{crop_y}")

    # 4. Color Grading Filter
    if color_grade == "cinematic_warm":
        filters.append("curves=r='0/0 0.5/0.53 1/1':b='0/0 0.5/0.47 1/1',eq=contrast=1.06:saturation=1.12:brightness=0.01")
    elif color_grade == "teal_orange":
        filters.append("curves=r='0/0 0.6/0.65 1/1':b='0/0 0.4/0.35 1/1',eq=contrast=1.08:saturation=1.15")
    elif color_grade == "vibrant":
        filters.append("eq=saturation=1.28:contrast=1.07:brightness=0.02")
    elif color_grade == "retro_film":
        filters.append("curves=r='0/0.05 0.5/0.52 1/0.95':g='0/0.02 0.5/0.5 1/0.96':b='0/0.08 0.5/0.48 1/0.92',eq=contrast=1.04:saturation=0.92")
    elif color_grade == "cyberpunk":
        filters.append("curves=r='0/0 0.5/0.45 1/1':b='0/0 0.5/0.60 1/1',eq=contrast=1.12:saturation=1.30")
    elif color_grade == "noir":
        filters.append("hue=s=0,eq=contrast=1.22:brightness=-0.02")

    # 5. Film Grain / Subtle Noise (Fast luma noise)
    if grain:
        filters.append("noise=c0s=4:c0f=u")

    # 6. Radial Vignette
    if vignette:
        filters.append("vignette=PI/4")

    # 7. Speed Alteration (setpts)
    if abs(speed - 1.0) > 0.005:
        filters.append(f"setpts=PTS/{speed:.3f}")

    pre_processed = ",".join(filters) if filters else "null"

    # 8. Framing & Canvas Scaling
    # Fast low-res blur (320x180) for silky smooth Gaussian background at 160+ FPS
    fast_blur_bg = "scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=5:1,scale={out_w}:{out_h},eq=brightness=-0.14:saturation=1.20".format(out_w=out_w, out_h=out_h)

    if framing_style == "blur_fit" or framing_style == "blur_background":
        # 100% full frame visible without cropping; empty padding filled with fast ambient blurred video
        fg_scale = f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"
        filtergraph = (
            f"[0:v]{pre_processed},split=2[raw_fg][raw_bg];"
            f"[raw_bg]{fast_blur_bg}[bg];"
            f"[raw_fg]{fg_scale}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2:eof_action=pass[framed]"
        )
        cur_pad = "[framed]"
    elif framing_style == "recap_ambient_glow":
        # 92% inset video centered on canvas with glowing ambient motion-blur border
        target_fg_w = int(out_w * 0.92) // 2 * 2
        target_fg_h = int(out_h * 0.92) // 2 * 2
        fg_scale = f"scale={target_fg_w}:{target_fg_h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"
        filtergraph = (
            f"[0:v]{pre_processed},split=2[raw_fg][raw_bg];"
            f"[raw_bg]{fast_blur_bg}[bg];"
            f"[raw_fg]{fg_scale}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2:eof_action=pass[framed]"
        )
        cur_pad = "[framed]"
    elif framing_style == "cinematic_bars":
        # 2.35:1 Anamorphic Hollywood widescreen letterbox (sleek dark bars top & bottom)
        cine_h = int(out_w / 2.35) // 2 * 2
        filtergraph = (
            f"[0:v]{pre_processed},scale={out_w}:{cine_h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,"
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:#08080a[framed]"
        )
        cur_pad = "[framed]"
    elif framing_style == "mirror_blur_wings":
        # Left and right side mirror wings + ambient blur frame
        fg_scale = f"scale={int(out_w*0.86)//2*2}:{int(out_h*0.86)//2*2}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"
        filtergraph = (
            f"[0:v]{pre_processed},split=2[raw_fg][raw_bg];"
            f"[raw_bg]{fast_blur_bg},hflip[bg];"
            f"[raw_fg]{fg_scale}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2:eof_action=pass[framed]"
        )
        cur_pad = "[framed]"
    elif framing_style == "full_screen_zoom":
        # Zooms in by 4-5% to fill screen edge-to-edge while cropping original borders
        filtergraph = (
            f"[0:v]{pre_processed},scale={out_w}:{out_h}:force_original_aspect_ratio=increase,"
            f"crop={out_w}:{out_h}[framed]"
        )
        cur_pad = "[framed]"
    elif framing_style == "gradient_ambient":
        target_fg_w = int(out_w * 0.93) // 2 * 2
        target_fg_h = int(out_h * 0.93) // 2 * 2
        fg_scale = f"scale={target_fg_w}:{target_fg_h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"
        bg_dark = f"scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=5:1,scale={out_w}:{out_h},eq=brightness=-0.28:saturation=1.1"
        filtergraph = (
            f"[0:v]{pre_processed},split=2[raw_fg][raw_bg];"
            f"[raw_bg]{bg_dark}[bg];"
            f"[raw_fg]{fg_scale}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2:eof_action=pass[framed]"
        )
        cur_pad = "[framed]"
    elif framing_style == "black_bars":
        # Centered video with clean black canvas border
        target_fg_w = int(out_w * 0.93) // 2 * 2
        target_fg_h = int(out_h * 0.93) // 2 * 2
        filtergraph = (
            f"[0:v]{pre_processed},scale={target_fg_w}:{target_fg_h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,"
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:black[framed]"
        )
        cur_pad = "[framed]"
    else:  # full_fit / fallback
        fg_scale = f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2"
        filtergraph = (
            f"[0:v]{pre_processed},{fg_scale},"
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:black[framed]"
        )
        cur_pad = "[framed]"

    # 9. Custom Watermark Overlay (Text or Uploaded Image)
    extra_filters = []
    if custom_watermark and custom_watermark.get("enabled", False):
        wm_type = custom_watermark.get("type", "text")
        wm_pos = custom_watermark.get("position", "top_right")
        wm_opacity = float(custom_watermark.get("opacity", 0.70))

        # Support direct custom coordinates (0.0 to 1.0 or 0 to 100)
        has_custom_coords = False
        wm_x = 0.92
        wm_y = 0.04

        if "x" in custom_watermark and custom_watermark["x"] is not None:
            raw_x = float(custom_watermark["x"])
            wm_x = raw_x / 100.0 if raw_x > 1.0 else raw_x
            has_custom_coords = True

        if "y" in custom_watermark and custom_watermark["y"] is not None:
            raw_y = float(custom_watermark["y"])
            wm_y = raw_y / 100.0 if raw_y > 1.0 else raw_y
            has_custom_coords = True

        if not has_custom_coords or wm_pos != "custom":
            pos_coords = {
                "top_right": (0.92, 0.04),
                "top_left": (0.04, 0.04),
                "bottom_right": (0.92, 0.92),
                "bottom_left": (0.04, 0.92),
                "center": (0.50, 0.50),
                "top_center": (0.50, 0.04),
                "bottom_center": (0.50, 0.92)
            }
            if wm_pos in pos_coords and not has_custom_coords:
                wm_x, wm_y = pos_coords[wm_pos]

        # Clamp between 0.0 and 1.0
        wm_x = max(0.0, min(1.0, wm_x))
        wm_y = max(0.0, min(1.0, wm_y))

        overlay_x_expr = f"(W-w)*{wm_x:.3f}"
        overlay_y_expr = f"(H-h)*{wm_y:.3f}"
        text_x_expr = f"(w-tw)*{wm_x:.3f}"
        text_y_expr = f"(h-th)*{wm_y:.3f}"

        # Watermark timing (Full video by default)
        wm_timing_mode = custom_watermark.get("timing_mode", "full")
        wm_start = float(custom_watermark.get("start_sec", 0.0) or 0.0)
        wm_end = float(custom_watermark.get("end_sec", 0.0) or 0.0)
        
        enable_expr = ""
        if wm_timing_mode == "custom" and (wm_start > 0 or wm_end > 0):
            if wm_end > wm_start:
                enable_expr = f":enable='between(t,{wm_start:.2f},{wm_end:.2f})'"
            else:
                enable_expr = f":enable='gte(t,{wm_start:.2f})'"

        if wm_type == "image":
            img_path = custom_watermark.get("image_path", "")
            if img_path and os.path.exists(img_path):
                clean_img_path = str(Path(img_path).resolve().as_posix()).replace(":", "\\:")
                wm_scale = float(custom_watermark.get("scale", 0.18))
                wm_w = max(32, int(out_w * wm_scale))
                wm_chain = (
                    f"movie='{clean_img_path}',"
                    f"scale={wm_w}:-1,"
                    f"format=rgba,"
                    f"colorchannelmixer=aa={wm_opacity:.2f}[wm_overlay];"
                    f"{cur_pad}[wm_overlay]overlay={overlay_x_expr}:{overlay_y_expr}{enable_expr}:eof_action=repeat[v_wm]"
                )
                filtergraph = f"{filtergraph};{wm_chain}"
                cur_pad = "[v_wm]"
        else:
            # Text watermark
            wm_text = custom_watermark.get("text", "@MyChannel")
            wm_font_size = int(custom_watermark.get("font_size", 34))
            wm_color = custom_watermark.get("color", "white")
            font_file = WINDOWS_FONT_PATH if os.path.exists("C:/Windows/Fonts/arialbd.ttf") else FALLBACK_FONT_PATH
            clean_text = wm_text.replace("'", "").replace(":", "\\:").replace("%", "\\%")
            
            enable_text = f":enable='between(t,{wm_start:.2f},{wm_end:.2f})'" if enable_expr else ""
            wm_filter = (
                f"drawtext=fontfile='{font_file}':text='{clean_text}':"
                f"fontsize={wm_font_size}:fontcolor={wm_color}@{wm_opacity:.2f}:"
                f"x={text_x_expr}:y={text_y_expr}:shadowcolor=black@0.75:shadowx=2:shadowy=2{enable_text}"
            )
            extra_filters.append(wm_filter)

    # 10. Delogo Box Target Visualizer (only enabled in preview mode when requested)
    if delogo_box and delogo_box.get("enabled", False) and delogo_box.get("show_target_box", False):
        dx = int(delogo_box.get("x", in_w * 0.8))
        dy = int(delogo_box.get("y", in_h * 0.05))
        dw = int(delogo_box.get("w", in_w * 0.18))
        dh = int(delogo_box.get("h", in_h * 0.12))
        extra_filters.append(f"drawbox=x={dx}:y={dy}:w={dw}:h={dh}:color=red@0.85:t=4")

    # 11. Timed Text Overlays (Chapter titles, commentary hooks)
    if text_overlays:
        font_file = WINDOWS_FONT_PATH if os.path.exists("C:/Windows/Fonts/arialbd.ttf") else FALLBACK_FONT_PATH
        for item in text_overlays:
            txt = item.get("text", "").strip()
            if not txt:
                continue
            st = float(item.get("start", 0.0))
            en = float(item.get("end", 5.0))
            fsize = int(item.get("font_size", 38))
            color = item.get("color", "yellow")
            clean_t = txt.replace("'", "").replace(":", "\\:").replace("%", "\\%")
            pos_y = "h-th-90"
            if item.get("position") == "top":
                pos_y = "60"
            elif item.get("position") == "center":
                pos_y = "(h-th)/2"
            
            overlay_f = (
                f"drawtext=fontfile='{font_file}':text='{clean_t}':"
                f"fontsize={fsize}:fontcolor={color}:"
                f"box=1:boxcolor=black@0.70:boxborderw=10:"
                f"x=(w-tw)/2:y={pos_y}:"
                f"enable='between(t,{st},{en})'"
            )
            extra_filters.append(overlay_f)

    if extra_filters:
        return f"{filtergraph};{cur_pad}{','.join(extra_filters)}[v_out]"
    else:
        return f"{filtergraph};{cur_pad}copy[v_out]"


def render_preview_frame(
    video_path: Path,
    output_image_path: Path,
    time_sec: float = 2.0,
    aspect_ratio: str = "16:9",
    quality: str = "720p",
    framing_style: str = "blur_background",
    mirror: bool = True,
    grain: bool = True,
    vignette: bool = True,
    color_grade: str = "cinematic_warm",
    micro_crop: bool = True,
    delogo_box: Optional[Dict[str, Any]] = None,
    custom_watermark: Optional[Dict[str, Any]] = None
) -> Path:
    """Renders a single high-definition preview frame to visually verify delogo, framing, and watermark."""
    meta = get_video_metadata(video_path)
    out_w, out_h = get_canvas_resolution(aspect_ratio, quality)

    fg = build_anti_copyright_filtergraph(
        in_w=meta["width"],
        in_h=meta["height"],
        out_w=out_w,
        out_h=out_h,
        framing_style=framing_style,
        mirror=mirror,
        speed=1.0,  # Single frame does not need speed shift
        grain=grain,
        vignette=vignette,
        color_grade=color_grade,
        micro_crop=micro_crop,
        delogo_box=delogo_box,
        custom_watermark=custom_watermark
    )

    output_image_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(time_sec),
        "-i", str(video_path),
        "-filter_complex", fg,
        "-map", "[v_out]",
        "-frames:v", "1",
        "-q:v", "2",
        str(output_image_path)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_image_path


def parse_time_to_seconds(time_str: str) -> float:
    """Parses FFmpeg time string HH:MM:SS.microsec to float seconds."""
    try:
        parts = time_str.strip().split(":")
        if len(parts) == 3:
            h, m, s = parts
            return float(h) * 3600.0 + float(m) * 60.0 + float(s)
        elif len(parts) == 2:
            m, s = parts
            return float(m) * 60.0 + float(s)
    except Exception:
        pass
    return 0.0


def get_best_video_encoder_args(quality: str = "1080p") -> Tuple[List[str], str]:
    """Detects if hardware AMD AMF encoding is functional, otherwise falls back to libx264 veryfast."""
    bitrate = "4500k"
    if "720" in quality:
        bitrate = "2800k"
    elif "480" in quality:
        bitrate = "1600k"
    elif "2k" in quality or "1440" in quality:
        bitrate = "7000k"
    elif "4k" in quality or "2160" in quality:
        bitrate = "12000k"

    try:
        test_cmd = ["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "nullsrc=duration=0.1", "-c:v", "h264_amf", "-f", "null", "-"]
        res = subprocess.run(test_cmd, capture_output=True, timeout=3)
        if res.returncode == 0:
            return ["-c:v", "h264_amf", "-b:v", bitrate, "-quality", "speed", "-rc", "cbr", "-threads", "0"], "h264_amf"
    except Exception:
        pass

    return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-threads", "0"], "libx264"


def render_repurposed_video(
    video_path: Path,
    audio_track: Path,
    output_video_path: Path,
    aspect_ratio: str = "16:9",
    quality: str = "1080p",
    fps: int = 30,
    framing_style: str = "blur_background",
    mirror: bool = True,
    speed: float = 1.00,
    grain: bool = True,
    vignette: bool = True,
    color_grade: str = "cinematic_warm",
    micro_crop: bool = True,
    delogo_box: Optional[Dict[str, Any]] = None,
    custom_watermark: Optional[Dict[str, Any]] = None,
    text_overlays: Optional[List[Dict[str, Any]]] = None,
    timeline_slices: Optional[List[Dict[str, float]]] = None,
    duration_shift: float = -3.0,
    progress_callback: Optional[Any] = None
) -> Path:
    """
    Renders the complete transformed video with audio sync, anti-copyright manipulation,
    duration offset (removes or expands 2-5s to break ContentID exact length match),
    watermark removal, and custom branding overlays.
    """
    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    meta = get_video_metadata(video_path)
    out_w, out_h = get_canvas_resolution(aspect_ratio, quality)

    vid_dur = meta.get("duration", 60.0)
    trim_start = 0.0
    shift_pad = 0.0
    shift_val = float(duration_shift) if duration_shift is not None else -3.0

    if shift_val < -0.1 and vid_dur > abs(shift_val) + 2.0:
        # Remove 2-5 seconds (e.g. -3.0s: trims 1.5s from start to skip intro logo, rest from end)
        shift_amt = abs(shift_val)
        trim_start = min(2.5, round(shift_amt / 2.0, 2))
        effective_vid_dur = max(2.0, (vid_dur - shift_amt) / max(0.01, speed))
    elif shift_val > 0.1:
        # Expand 2-5 seconds (pad outro with cloned tail frame)
        shift_pad = shift_val
        effective_vid_dur = (vid_dur + shift_pad) / max(0.01, speed)
    else:
        effective_vid_dur = vid_dur / max(0.01, speed)

    total_target_dur = effective_vid_dur

    fg = build_anti_copyright_filtergraph(
        in_w=meta["width"],
        in_h=meta["height"],
        out_w=out_w,
        out_h=out_h,
        framing_style=framing_style,
        mirror=mirror,
        speed=speed,
        grain=grain,
        vignette=vignette,
        color_grade=color_grade,
        micro_crop=micro_crop,
        delogo_box=delogo_box,
        custom_watermark=custom_watermark,
        text_overlays=text_overlays,
        duration_pad=shift_pad
    )

    encoder_args, enc_name = get_best_video_encoder_args(quality)
    print(f"[Render] Selected video encoder: {enc_name}, target duration: {total_target_dur:.2f}s (offset: {shift_val:+.1f}s)")

    actual_audio = audio_track
    if audio_track and audio_track.exists():
        aud_dur = get_media_duration(audio_track)
        if aud_dur > effective_vid_dur + 0.5:
            voice_scale = round(aud_dur / effective_vid_dur, 3)
            voice_scale = max(0.50, min(1.08, voice_scale))
            print(f"[Render] Audio ({aud_dur:.1f}s) slightly exceeds video ({effective_vid_dur:.1f}s). Auto-syncing audio tempo ({voice_scale:.2f}x)...")
            synced_aud = output_video_path.parent / f"render_synced_{output_video_path.stem}.mp3"
            adjust_audio_speed(audio_track, synced_aud, voice_scale)
            if synced_aud.exists() and synced_aud.stat().st_size > 5000:
                actual_audio = synced_aud
        elif aud_dur < effective_vid_dur - 0.5:
            padded_aud = output_video_path.parent / f"render_padded_{output_video_path.stem}.mp3"
            cmd_pad = [
                "ffmpeg", "-y",
                "-i", str(audio_track),
                "-af", f"apad=whole_dur={effective_vid_dur:.2f}",
                "-t", f"{effective_vid_dur:.2f}",
                "-c:a", "libmp3lame", "-b:a", "192k",
                str(padded_aud)
            ]
            subprocess.run(cmd_pad, capture_output=True)
            if padded_aud.exists() and padded_aud.stat().st_size > 5000:
                actual_audio = padded_aud

    video_input_args = ["-ss", f"{trim_start:.2f}", "-i", str(video_path)] if trim_start > 0.0 else ["-i", str(video_path)]
    cmd = [
        "ffmpeg", "-y",
        *video_input_args,
        "-i", str(actual_audio),
        "-filter_complex", fg,
        "-map", "[v_out]",
        "-map", "1:a",
        *encoder_args,
        "-r", str(fps),
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-t", f"{total_target_dur:.2f}",
        "-movflags", "+faststart",
        "-progress", "pipe:1",
        "-nostats",
        str(output_video_path)
    ]

    print(f"[Render] Executing FFmpeg command with progress pipe...")
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True
    )

    cur_speed = "1.0x"
    last_report_sec = -5.0
    output_tail: List[str] = []

    while True:
        line = proc.stdout.readline()
        if not line and proc.poll() is not None:
            break
        line = line.strip()
        if not line:
            continue

        output_tail.append(line)
        if len(output_tail) > 50:
            output_tail.pop(0)

        if line.startswith("speed="):
            cur_speed = line.split("=")[1].strip()
        elif line.startswith("out_time="):
            time_val = line.split("=")[1].strip()
            cur_sec = parse_time_to_seconds(time_val)
            if progress_callback and (cur_sec - last_report_sec >= 1.5 or cur_sec >= total_target_dur - 1.0):
                last_report_sec = cur_sec
                pct = min(99.0, max(1.0, (cur_sec / max(1.0, total_target_dur)) * 100.0))
                try:
                    progress_callback(pct, cur_sec, total_target_dur, cur_speed)
                except Exception as cb_err:
                    print(f"[Render Callback Error] {cb_err}")
        elif line == "progress=end":
            break

    proc.wait()
    error_summary = "\n".join(output_tail[-15:])

    if proc.returncode != 0:
        if enc_name != "libx264":
            print(f"[Render] Hardware encoder {enc_name} failed. Retrying with CPU libx264 fallback...")
            fallback_cmd = [
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-i", str(audio_track),
                "-filter_complex", fg,
                "-map", "[v_out]",
                "-map", "1:a",
                *audio_speed_args,
                "-c:v", "libx264",
                "-preset", "veryfast",
                "-crf", "21",
                "-r", str(fps),
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-ar", "48000",
                "-ac", "2",
                "-shortest",
                "-t", f"{total_target_dur:.2f}",
                "-movflags", "+faststart",
                str(output_video_path)
            ]
            fb_res = subprocess.run(fallback_cmd, capture_output=True, text=True)
            if fb_res.returncode != 0:
                raise RuntimeError(f"FFmpeg CPU fallback render failed: {fb_res.stderr[-500:]}")
        else:
            raise RuntimeError(f"FFmpeg render failed: {error_summary[-500:]}")

    if not output_video_path.exists() or output_video_path.stat().st_size < 10000:
        raise RuntimeError("Render produced an empty or invalid video file.")

    return output_video_path
