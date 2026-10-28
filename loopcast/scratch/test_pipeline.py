import subprocess
import time

# Step 1: Generate a 3-second sample WebM exactly like MediaRecorder produces
print("Generating sample WebM...")
cmd_gen = [
    "ffmpeg", "-y",
    "-f", "lavfi", "-i", "testsrc=size=1080x1350:rate=30",
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-t", "3",
    "-c:v", "libvpx", "-b:v", "4000k",
    "-c:a", "libopus", "-b:a", "128k",
    "-f", "webm",
    "sample.webm"
]
subprocess.run(cmd_gen, check=True)

with open("sample.webm", "rb") as f:
    webm_bytes = f.read()

print(f"Generated sample.webm: {len(webm_bytes)} bytes")

# Step 2: Test piping into FFmpeg with the bridge args (using a local flv file as output)
width = 1080
height = 1350
fps = 30
bitrate = 4500
h264_level = "4.1"
scale_filter = f"setpts=PTS-STARTPTS,scale={width}:{height}:force_original_aspect_ratio=increase:flags=lanczos,crop={width}:{height},setsar=1"

args = [
    "ffmpeg",
    "-y",
    "-f", "webm",
    "-i", "pipe:0",
    "-vf", scale_filter,
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-profile:v", "high",
    "-level", h264_level,
    "-b:v", f"{bitrate}k",
    "-maxrate", f"{bitrate}k",
    "-bufsize", f"{bitrate * 2}k",
    "-pix_fmt", "yuv420p",
    "-r", str(fps),
    "-fps_mode", "cfr",
    "-g", str(fps * 2),
    "-keyint_min", str(fps * 2),
    "-sc_threshold", "0",
    "-x264-params", "repeat-headers=1:nal-hrd=cbr:force-cfr=1",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "48000",
    "-ac", "2",
    "-af", "asetpts=PTS-STARTPTS,aresample=async=1:min_hard_comp=0.100:first_pts=0",
    "-flvflags", "no_duration_filesize",
    "-flags", "+global_header",
    "-f", "flv",
    "out_test.flv"
]

print("Launching FFmpeg with bridge args...")
proc = subprocess.Popen(args, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
stdout, stderr = proc.communicate(input=webm_bytes)
print(f"FFmpeg exit code: {proc.returncode}")
print("FFmpeg stderr (last 300 chars):")
print(stderr.decode('utf-8', errors='ignore')[-300:])
