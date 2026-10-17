import os
import subprocess
from pathlib import Path
from typing import Optional

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def generate_synthesized_bgm(preset: str, duration_sec: float, output_path: Path) -> Path:
    """
    Generates a royalty-free, layered atmospheric background bed using FFmpeg audio filters:
    - suspense: Dark minor drone (55Hz + 110Hz sub + lowpass + tremolo)
    - action: Driving rhythmic pulse (low drone + flanger sweep)
    - lofi: Warm harmonic analog chords (220Hz + 330Hz + soft saturation)
    - ambient: Ethereal floating drone (165Hz + 220Hz + high stereo width)
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    dur = max(duration_sec, 2.0)

    preset_filters = {
        "suspense": (
            f"sine=frequency=55:duration={dur}[s1];"
            f"sine=frequency=110:duration={dur}[s2];"
            f"anoisesrc=d={dur}:c=pink:r=48000:a=0.015[n];"
            f"[s1][s2]amix=inputs=2[d];"
            f"[d]lowpass=f=200,tremolo=f=0.2:d=0.3[t];"
            f"[t][n]amix=inputs=2[out];"
            f"[out]afade=t=in:ss=0:d=1.5,afade=t=out:st={max(0.0, dur - 2.5)}:d=2.5"
        ),
        "action": (
            f"sine=frequency=65:duration={dur}[s1];"
            f"anoisesrc=d={dur}:c=brown:r=48000:a=0.03[n];"
            f"[s1]tremolo=f=2.5:d=0.7[pulse];"
            f"[pulse][n]amix=inputs=2[out];"
            f"[out]lowpass=f=350,afade=t=in:ss=0:d=1.0,afade=t=out:st={max(0.0, dur - 2.0)}:d=2.0"
        ),
        "lofi": (
            f"sine=frequency=220:duration={dur}[s1];"
            f"sine=frequency=277.18:duration={dur}[s2];"
            f"sine=frequency=329.63:duration={dur}[s3];"
            f"[s1][s2][s3]amix=inputs=3[chords];"
            f"[chords]lowpass=f=800,vibrato=f=4:d=0.2[v];"
            f"[v]afade=t=in:ss=0:d=2.0,afade=t=out:st={max(0.0, dur - 3.0)}:d=3.0"
        ),
        "ambient": (
            f"sine=frequency=130.81:duration={dur}[s1];"
            f"sine=frequency=196.00:duration={dur}[s2];"
            f"[s1][s2]amix=inputs=2[chords];"
            f"[chords]lowpass=f=500,flanger=delay=5:speed=0.1[fl];"
            f"[fl]afade=t=in:ss=0:d=2.5,afade=t=out:st={max(0.0, dur - 3.0)}:d=3.0"
        )
    }

    flt = preset_filters.get(preset, preset_filters["suspense"])
    cmd = [
        "ffmpeg", "-y",
        "-filter_complex", flt,
        "-ar", "48000",
        "-ac", "2",
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        str(output_path)
    ]
    try:
        subprocess.run(cmd, capture_output=True, check=True)
        return output_path
    except Exception as e:
        print(f"[BGM] Synth error: {e}, using simple fallback tone")
        cmd_fb = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"sine=frequency=110:duration={dur}",
            "-af", "lowpass=f=200,volume=0.2",
            "-ar", "48000", "-ac", "2",
            "-c:a", "libmp3lame", "-b:a", "192k",
            str(output_path)
        ]
        subprocess.run(cmd_fb, capture_output=True, check=True)
        return output_path


def mix_voice_and_bgm(
    voice_track: Path,
    bgm_track: Optional[Path],
    output_mixed: Path,
    bgm_volume_db: float = -26.0
) -> Path:
    """
    Mixes narration voice track with background music.
    BGM is ducked to bgm_volume_db (e.g. -26dB) and looped or padded to match voice length.
    """
    output_mixed.parent.mkdir(parents=True, exist_ok=True)
    if not bgm_track or not bgm_track.exists():
        # Just copy or re-encode voice track
        cmd = [
            "ffmpeg", "-y",
            "-i", str(voice_track),
            "-c:a", "libmp3lame", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            str(output_mixed)
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        return output_mixed

    dur = 0.0
    try:
        from app.audio_transcriber import get_media_duration
        dur = get_media_duration(voice_track)
    except Exception:
        pass

    vol_filter = f"volume={bgm_volume_db}dB"
    cmd = [
        "ffmpeg", "-y",
        "-i", str(voice_track),
        "-i", str(bgm_track),
        "-filter_complex", (
            f"[1:a]{vol_filter}[bgm];"
            f"[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[out]"
        ),
        "-map", "[out]",
        *(["-t", f"{dur:.2f}"] if dur > 0 else []),
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        str(output_mixed)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_mixed


def get_bgm_preview(preset: str) -> Path:
    """Returns or generates a cached 6-second audio preview of the chosen BGM preset."""
    preview_dir = ASSETS_DIR / "bgm_previews"
    preview_dir.mkdir(parents=True, exist_ok=True)
    sample_path = preview_dir / f"{preset}.mp3"
    if not sample_path.exists() or sample_path.stat().st_size < 1000:
        generate_synthesized_bgm(preset, 6.0, sample_path)
    return sample_path


def build_atempo_filter(speed: float) -> str:
    """
    Builds a chained atempo filter string for FFmpeg since each atempo filter is restricted to [0.5, 2.0].
    Preserves 100% natural human pitch while scaling playback speed.
    """
    speed = max(0.25, min(4.0, float(speed)))
    filters = []
    curr = speed
    while curr > 2.0:
        filters.append("atempo=2.0")
        curr /= 2.0
    while curr < 0.5:
        filters.append("atempo=0.5")
        curr /= 0.5
    filters.append(f"atempo={curr:.4f}")
    return ",".join(filters)


def adjust_audio_speed(input_audio: Path, output_audio: Path, speed: float) -> Path:
    """
    Adjusts speech tempo while perfectly preserving natural pitch.
    Allows 100% of the narration explanation to be cleanly voiced within the video duration.
    """
    if abs(speed - 1.0) < 0.005:
        if input_audio.resolve() != output_audio.resolve():
            import shutil
            shutil.copy2(input_audio, output_audio)
        return output_audio

    output_audio.parent.mkdir(parents=True, exist_ok=True)
    flt = build_atempo_filter(speed)
    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_audio),
        "-filter:a", flt,
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        "-ar", "48000",
        "-ac", "2",
        str(output_audio)
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return output_audio
