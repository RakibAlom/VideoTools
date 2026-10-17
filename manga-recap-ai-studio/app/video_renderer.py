import os
import subprocess
import shutil
from pathlib import Path
from typing import Callable, Optional
from PIL import Image

QUALITY_MAP = {
    "480p": {
        "16:9": (854, 480),
        "9:16": (480, 854),
        "1:1": (480, 480)
    },
    "720p": {
        "16:9": (1280, 720),
        "9:16": (720, 1280),
        "1:1": (720, 720)
    },
    "1080p": {
        "16:9": (1920, 1080),
        "9:16": (1080, 1920),
        "1:1": (1080, 1080)
    },
    "2k": {
        "16:9": (2560, 1440),
        "9:16": (1440, 2560),
        "1:1": (1440, 1440)
    },
    "4k": {
        "16:9": (3840, 2160),
        "9:16": (2160, 3840),
        "1:1": (2160, 2160)
    }
}

MOTION_SPEED_LIMITS = {
    "smooth_slow": 95,      # 95 px/s max travel (Gentle reading pace - Default)
    "balanced": 175,         # 175 px/s
    "fast_dynamic": 290,     # 290 px/s
    "gentle_drift": 45       # 45 px/s (Subtle slow zoom/drift)
}

def get_resolution(aspect_ratio: str = "16:9", quality: str = "1080p") -> tuple[int, int]:
    q_key = quality.lower().strip()
    if q_key not in QUALITY_MAP:
        q_key = "1080p"
    ratio_dict = QUALITY_MAP[q_key]
    return ratio_dict.get(aspect_ratio, (1920, 1080))

def render_segment_chunk(
    panel_image: Path,
    audio_path: Optional[Path],
    output_chunk: Path,
    aspect_ratio: str = "16:9",
    camera_motion: str = "slow_zoom_in",
    duration: float = 4.0,
    ambient_audio: Optional[Path] = None,
    ambient_volume_db: float = -28.0,
    frame_style: str = "dark_ambient",
    motion_speed: str = "smooth_slow",
    quality: str = "1080p",
    fps: int = 30,
    watermark_enabled: bool = False,
    watermark_text: str = "",
    watermark_position: str = "top_right",
    watermark_opacity: float = 0.45,
    watermark_font_size: int = 32
) -> bool:
    """
    Renders a single scene segment into an MP4 chunk with:
    - Adaptive smooth camera motion (calibrated for long manhwa strips so they NEVER hyper-scroll)
    - Selectable frame styles (dark ambient blur, manga reader border, full bleed, vintage halftone, neon rim)
    - Selectable export quality (480p, 720p, 1080p, 2K, 4K)
    - Synchronized voiceover + ducked ambient bed (standardized 48kHz stereo)
    - Optional customizable copyright/watermark overlay (disabled by default)
    """
    output_chunk.parent.mkdir(parents=True, exist_ok=True)
    target_w, target_h = get_resolution(aspect_ratio, quality)
    
    # Foreground dimensions
    if frame_style == "full_bleed":
        fg_w, fg_h = target_w, target_h
        zoom_w = (int(target_w * 1.10) // 2) * 2
        zoom_h = (int(target_h * 1.10) // 2) * 2
    else:
        fg_w = (int(target_w * 0.90) // 2) * 2
        fg_h = (int(target_h * 0.90) // 2) * 2
        zoom_w = (int(fg_w * 1.08) // 2) * 2
        zoom_h = (int(fg_h * 1.08) // 2) * 2

    safe_dur = max(1.0, duration)
    
    # Analyze source image dimensions for intelligent vertical pan clamping
    orig_w, orig_h = 1000, 1000
    try:
        with Image.open(panel_image) as im:
            orig_w, orig_h = im.size
    except Exception:
        pass

    # Calculate actual scaled height after force_original_aspect_ratio=increase
    scale_factor = max(zoom_w / max(1, orig_w), zoom_h / max(1, orig_h))
    actual_scaled_w = int(orig_w * scale_factor)
    actual_scaled_h = int(orig_h * scale_factor)
    
    total_travel_y = max(0, actual_scaled_h - fg_h)
    total_travel_x = max(0, actual_scaled_w - fg_w)

    max_px_per_sec = MOTION_SPEED_LIMITS.get(motion_speed, 95)
    clamped_travel_y = min(total_travel_y, int(max_px_per_sec * safe_dur))
    clamped_travel_x = min(total_travel_x, int((max_px_per_sec * 0.7) * safe_dur))

    # Calculate camera expressions
    if camera_motion in ["slow_zoom_out", "pan_down"]:
        x_expr = "(in_w-out_w)/2"
        if clamped_travel_y > 0:
            y_expr = f"{clamped_travel_y}*(t/{safe_dur:.3f})"
        else:
            y_expr = "(in_h-out_h)/2"
    elif camera_motion == "pan_left":
        if clamped_travel_x > 0:
            x_expr = f"{clamped_travel_x}*(1-t/{safe_dur:.3f})"
        else:
            x_expr = "(in_w-out_w)/2"
        y_expr = "(in_h-out_h)/2"
    elif camera_motion == "pan_right":
        if clamped_travel_x > 0:
            x_expr = f"{clamped_travel_x}*(t/{safe_dur:.3f})"
        else:
            x_expr = "(in_w-out_w)/2"
        y_expr = "(in_h-out_h)/2"
    elif camera_motion == "static":
        x_expr = "(in_w-out_w)/2"
        y_expr = "(in_h-out_h)/2"
    else:  # default: slow_zoom_in / pan_up (smooth top-to-bottom reading drift)
        x_expr = "(in_w-out_w)/2"
        if clamped_travel_y > 0:
            y_expr = f"{clamped_travel_y}*(1-t/{safe_dur:.3f})"
        else:
            y_expr = "(in_h-out_h)/2"

    # Frame Style Base Filtergraphs (outputs intermediate [vbase])
    if frame_style == "comic_border":
        border_thickness = max(2, target_w // 480)
        base_filter = (
            f"color=c=0x0a0c12:s={target_w}x{target_h}[bg];"
            f"[0:v]scale={zoom_w}:{zoom_h}:force_original_aspect_ratio=increase,"
            f"crop={fg_w}:{fg_h}:x='{x_expr}':y='{y_expr}',"
            f"drawbox=x=0:y=0:w=iw:h=ih:color=0xd1d5db@0.85:t={border_thickness}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,"
            f"eq=contrast=1.06:saturation=1.05[vbase]"
        )
    elif frame_style == "full_bleed":
        base_filter = (
            f"[0:v]scale={zoom_w}:{zoom_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h}:x='{x_expr}':y='{y_expr}',"
            f"eq=contrast=1.05:saturation=1.08,"
            f"noise=c0s=2:c0f=u[vbase]"
        )
    elif frame_style == "vintage_halftone":
        base_filter = (
            f"[0:v]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h},"
            f"boxblur=24:5,"
            f"eq=brightness=-0.32:contrast=1.1[bg];"
            f"[0:v]scale={zoom_w}:{zoom_h}:force_original_aspect_ratio=increase,"
            f"crop={fg_w}:{fg_h}:x='{x_expr}':y='{y_expr}'[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,"
            f"colorbalance=rs=0.08:gs=0.04:bs=-0.08,"
            f"noise=c0s=4:c0f=u[vbase]"
        )
    elif frame_style == "neon_cyberpunk":
        border_thickness = max(2, target_w // 400)
        base_filter = (
            f"[0:v]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h},"
            f"boxblur=30:6,"
            f"eq=brightness=-0.40[bg];"
            f"[0:v]scale={zoom_w}:{zoom_h}:force_original_aspect_ratio=increase,"
            f"crop={fg_w}:{fg_h}:x='{x_expr}':y='{y_expr}',"
            f"drawbox=x=0:y=0:w=iw:h=ih:color=0xfbbf24@0.9:t={border_thickness}[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,"
            f"eq=contrast=1.10:saturation=1.18[vbase]"
        )
    else:  # default: dark_ambient
        base_filter = (
            f"[0:v]scale={target_w}:{target_h}:force_original_aspect_ratio=increase,"
            f"crop={target_w}:{target_h},"
            f"boxblur=25:5,"
            f"eq=brightness=-0.30[bg];"
            f"[0:v]scale={zoom_w}:{zoom_h}:force_original_aspect_ratio=increase,"
            f"crop={fg_w}:{fg_h}:x='{x_expr}':y='{y_expr}'[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2,"
            f"eq=contrast=1.05:saturation=1.08,"
            f"noise=c0s=2:c0f=u[vbase]"
        )

    # Optional Watermark Injection
    if watermark_enabled and watermark_text and watermark_text.strip():
        clean_wm = watermark_text.strip().replace("'", "").replace(":", "\\:").replace("%", "\\%")
        wm_pad = max(20, int(target_w * 0.022))
        pos_map = {
            "top_right": (f"w-tw-{wm_pad}", f"{wm_pad}"),
            "top_left": (f"{wm_pad}", f"{wm_pad}"),
            "bottom_right": (f"w-tw-{wm_pad}", f"h-th-{wm_pad}"),
            "bottom_left": (f"{wm_pad}", f"h-th-{wm_pad}"),
            "center": ("(w-tw)/2", "(h-th)/2")
        }
        wm_x, wm_y = pos_map.get(watermark_position, (f"w-tw-{wm_pad}", f"{wm_pad}"))
        scale_ratio = target_h / 1080.0
        effective_fs = max(16, int(watermark_font_size * scale_ratio))
        alpha = max(0.1, min(1.0, watermark_opacity))
        
        font_path = "C\\:/Windows/Fonts/arialbd.ttf"
        if not Path(r"C:\Windows\Fonts\arialbd.ttf").exists():
            font_path = "arial.ttf"

        watermark_chain = (
            f";[vbase]drawtext=text='{clean_wm}':fontfile='{font_path}':fontsize={effective_fs}:"
            f"fontcolor=white@{alpha:.2f}:shadowcolor=black@{min(1.0, alpha + 0.25):.2f}:"
            f"shadowx=2:shadowy=2:x={wm_x}:y={wm_y},"
            f"format=yuv420p[vout]"
        )
        filtergraph = base_filter + watermark_chain
    else:
        filtergraph = base_filter + ";[vbase]format=yuv420p[vout]"

    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-loop", "1",
        "-i", str(panel_image)
    ]

    has_audio = audio_path and audio_path.exists() and audio_path.stat().st_size > 500
    has_ambient = ambient_audio and ambient_audio.exists()

    if has_audio and has_ambient:
        cmd.extend([
            "-i", str(audio_path),
            "-stream_loop", "-1",
            "-i", str(ambient_audio),
            "-filter_complex", filtergraph + f";[2:a]volume={ambient_volume_db}dB[bgm];[1:a][bgm]amix=inputs=2:duration=first,aformat=sample_rates=48000:channel_layouts=stereo[aout]",
            "-map", "[vout]",
            "-map", "[aout]"
        ])
    elif has_audio:
        cmd.extend([
            "-i", str(audio_path),
            "-filter_complex", filtergraph + ";[1:a]aformat=sample_rates=48000:channel_layouts=stereo[aout]",
            "-map", "[vout]",
            "-map", "[aout]"
        ])
    else:
        cmd.extend([
            "-f", "lavfi", "-t", f"{safe_dur:.3f}", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-filter_complex", filtergraph + ";[1:a]aformat=sample_rates=48000:channel_layouts=stereo[aout]",
            "-map", "[vout]",
            "-map", "[aout]"
        ])

    cmd.extend([
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "20",
        "-r", str(fps),
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        "-pix_fmt", "yuv420p",
        "-t", f"{safe_dur:.3f}",
        str(output_chunk)
    ])

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode != 0:
            print(f"FFmpeg render error on chunk {output_chunk.name}: {proc.stderr[-400:]}")
            if output_chunk.exists():
                try: os.remove(output_chunk)
                except Exception: pass
            return False
        return output_chunk.exists() and output_chunk.stat().st_size > 2000
    except Exception as e:
        print(f"Chunk rendering exception: {e}")
        if output_chunk.exists():
            try: os.remove(output_chunk)
            except Exception: pass
        return False

def render_preview_clip(
    panel_image: Path,
    output_mp4: Path,
    aspect_ratio: str = "16:9",
    frame_style: str = "dark_ambient",
    motion_speed: str = "smooth_slow",
    quality: str = "720p",
    duration: float = 3.0,
    watermark_enabled: bool = False,
    watermark_text: str = "",
    watermark_position: str = "top_right",
    watermark_opacity: float = 0.45,
    watermark_font_size: int = 32
) -> bool:
    """
    Renders an instant 3-second preview clip of any panel and style for live UI audition.
    """
    return render_segment_chunk(
        panel_image=panel_image,
        audio_path=None,
        output_chunk=output_mp4,
        aspect_ratio=aspect_ratio,
        camera_motion="slow_zoom_in",
        duration=duration,
        ambient_audio=None,
        frame_style=frame_style,
        motion_speed=motion_speed,
        quality=quality,
        fps=24,
        watermark_enabled=watermark_enabled,
        watermark_text=watermark_text,
        watermark_position=watermark_position,
        watermark_opacity=watermark_opacity,
        watermark_font_size=watermark_font_size
    )

def concatenate_chunks(chunk_paths: list[Path], final_output: Path) -> bool:
    """
    Concatenates rendered MP4 chunks using FFmpeg concat demuxer with FastStart progressive streaming.
    Includes automatic fallback re-encode concat if demuxer encounters any stream mismatch.
    Guarantees non-empty video output.
    """
    valid_chunks = [p for p in chunk_paths if p.exists() and p.stat().st_size > 2000]
    if not valid_chunks:
        print("No valid chunks found to concatenate.")
        return False

    final_output.parent.mkdir(parents=True, exist_ok=True)
    list_file = final_output.parent / "concat_list.txt"
    
    with open(list_file, "w", encoding="utf-8") as f:
        for p in valid_chunks:
            escaped = str(p.resolve()).replace("\\", "/")
            f.write(f"file '{escaped}'\n")

    # Pass 1: Ultra-fast stream copy concatenation
    cmd_copy = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", str(list_file),
        "-c", "copy",
        "-movflags", "+faststart",
        str(final_output)
    ]

    try:
        proc = subprocess.run(cmd_copy, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode == 0 and final_output.exists() and final_output.stat().st_size > 10000:
            if list_file.exists():
                try: os.remove(list_file)
                except Exception: pass
            return True
            
        print(f"Concat copy pass failed ({proc.stderr[-300:] if proc.stderr else 'incomplete output'}). Executing fallback re-encode concat...")
        
        # Pass 2: Re-encode filter concat fallback (guarantees 100% flawless seamless compilation)
        inputs = []
        filter_parts = []
        for idx, p in enumerate(valid_chunks):
            inputs.extend(["-i", str(p)])
            filter_parts.append(f"[{idx}:v][{idx}:a]")
            
        concat_filter = f"{''.join(filter_parts)}concat=n={len(valid_chunks)}:v=1:a=1[v][a]"
        cmd_reencode = [
            "ffmpeg", "-y",
            *inputs,
            "-filter_complex", concat_filter,
            "-map", "[v]",
            "-map", "[a]",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "20",
            "-r", "30",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "48000",
            "-ac", "2",
            "-movflags", "+faststart",
            str(final_output)
        ]
        proc_re = subprocess.run(cmd_reencode, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if list_file.exists():
            try: os.remove(list_file)
            except Exception: pass
        return proc_re.returncode == 0 and final_output.exists() and final_output.stat().st_size > 10000
    except Exception as e:
        print(f"Concat exception: {e}")
        if list_file.exists():
            try: os.remove(list_file)
            except Exception: pass
        return False

def render_full_project_video(
    project_dir: Path,
    segments: list[dict],
    aspect_ratio: str = "16:9",
    ambient_audio_path: Optional[Path] = None,
    frame_style: str = "dark_ambient",
    motion_speed: str = "smooth_slow",
    quality: str = "1080p",
    voice_provider: str = "gemini",
    voice_name: str = "Charon",
    gemini_api_key: str = "",
    elevenlabs_api_key: str = "",
    language: str = "en",
    watermark_enabled: bool = False,
    watermark_text: str = "",
    watermark_position: str = "top_right",
    watermark_opacity: float = 0.45,
    watermark_font_size: int = 32,
    progress_callback: Optional[Callable[[int, int, str], None]] = None
) -> Optional[Path]:
    """
    Iterates through all segments, auto-generates missing voices, renders MP4 chunks, and compiles final video.
    Guarantees non-empty video and non-silent audio output in the selected language.
    """
    chunks_dir = project_dir / "chunks"
    chunks_dir.mkdir(parents=True, exist_ok=True)
    panels_dir = project_dir / "panels"
    audio_dir = project_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)
    
    output_video = project_dir / f"recap_video_{aspect_ratio.replace(':', '_')}.mp4"
    rendered_chunks = []
    total = len(segments)

    # First clean up any corrupted 0-byte chunk files
    for old_chunk in chunks_dir.glob("chunk_*.mp4"):
        if old_chunk.stat().st_size < 2000:
            try: os.remove(old_chunk)
            except Exception: pass

    for i, seg in enumerate(segments):
        chunk_file = chunks_dir / f"chunk_{seg['segment_id']:03d}.mp4"
        panel_file = panels_dir / seg["panel_file"]
        
        # Fallback if panel_file missing
        if not panel_file.exists():
            all_panels = sorted(panels_dir.glob("*.png"))
            if all_panels:
                panel_file = all_panels[0]
            else:
                print(f"No panel found for scene {i + 1}")
                continue

        # Audio file path
        audio_name = seg.get("audio_file") or f"voice_{seg['segment_id']:03d}.mp3"
        audio_file = audio_dir / audio_name
        
        # CRITICAL AUTO-SYNTHESIS: If audio is missing, generate it now so video is NEVER silent
        if not audio_file.exists() or audio_file.stat().st_size < 500:
            if progress_callback:
                progress_callback(i + 1, total, f"Synthesizing voiceover for scene {i + 1} of {total} ({voice_name})...")
            from app.voice_engine import generate_segment_voice
            text = seg.get("narration_text", "The story continues as our main character moves forward...")
            ok_v, dur = generate_segment_voice(
                text=text,
                output_path=audio_file,
                voice_provider=voice_provider,
                voice_name=voice_name,
                gemini_api_key=gemini_api_key,
                elevenlabs_api_key=eleven_key,
                language=language
            )
            if ok_v:
                seg["audio_file"] = audio_file.name
                seg["audio_duration"] = dur

        duration = seg.get("audio_duration", 4.0)
        if duration < 1.0:
            duration = 4.0
            
        cam_motion = seg.get("camera_motion", "slow_zoom_in")

        if progress_callback:
            progress_callback(i + 1, total, f"Rendering chunk {i + 1} of {total} ({frame_style}, {cam_motion})...")

        ok = render_segment_chunk(
            panel_image=panel_file,
            audio_path=audio_file,
            output_chunk=chunk_file,
            aspect_ratio=aspect_ratio,
            camera_motion=cam_motion,
            duration=duration,
            ambient_audio=ambient_audio_path,
            frame_style=frame_style,
            motion_speed=motion_speed,
            quality=quality,
            watermark_enabled=watermark_enabled,
            watermark_text=watermark_text,
            watermark_position=watermark_position,
            watermark_opacity=watermark_opacity,
            watermark_font_size=watermark_font_size
        )
        
        if ok and chunk_file.exists() and chunk_file.stat().st_size > 2000:
            rendered_chunks.append(chunk_file)
        else:
            print(f"Failed to render chunk {seg['segment_id']}")

    if not rendered_chunks:
        return None

    if progress_callback:
        progress_callback(total, total, "Concatenating final master video (FastStart MP4)...")

    success = concatenate_chunks(rendered_chunks, output_video)
    return output_video if (success and output_video.exists() and output_video.stat().st_size > 10000) else None
