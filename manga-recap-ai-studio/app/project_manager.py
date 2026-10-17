import os
import json
import time
import uuid
import shutil
from pathlib import Path
from typing import Optional
from PIL import Image, ImageDraw, ImageFont
import numpy as np

from app.config import PROJECTS_DIR, DEMO_DIR, AMBIENT_DIR
from app.panel_extractor import sanitize_for_json

class ProjectManager:
    def __init__(self, base_dir: Path = PROJECTS_DIR):
        self.base_dir = base_dir
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def create_project(
        self,
        name: str = "Untitled Project",
        internal_manga_ref: str = "",
        target_length: str = "20-Min Quick Recap",
        aspect_ratio: str = "16:9",
        narrator: str = "Charon",
        custom_voice_id: str = "",
        custom_instructions: str = "",
        frame_style: str = "dark_ambient",
        motion_speed: str = "smooth_slow",
        export_quality: str = "1080p",
        page_range: str = "15",
        language: str = "en"
    ) -> dict:
        project_id = str(uuid.uuid4())[:8]
        proj_dir = self.base_dir / project_id
        proj_dir.mkdir(parents=True, exist_ok=True)

        # Subfolders
        (proj_dir / "pages").mkdir(exist_ok=True)
        (proj_dir / "panels").mkdir(exist_ok=True)
        (proj_dir / "previews").mkdir(exist_ok=True)
        (proj_dir / "audio").mkdir(exist_ok=True)
        (proj_dir / "chunks").mkdir(exist_ok=True)

        data = {
            "id": project_id,
            "name": name,
            "internal_manga_ref": internal_manga_ref,
            "target_length": target_length,
            "aspect_ratio": aspect_ratio,
            "language": language or "en",
            "narrator": narrator,
            "custom_voice_id": custom_voice_id,
            "custom_instructions": custom_instructions,
            "frame_style": frame_style,
            "motion_speed": motion_speed,
            "export_quality": export_quality,
            "page_range": page_range,
            "page_count": 0,
            "page_range_display": "",
            "panels": [],
            "segments": [],
            "status": "created",
            "progress": {"current": 0, "total": 0, "message": "Project initialized"},
            "video_file": None,
            "thumbnail_file": None,
            "thumbnail_hook": "HE WAS BETRAYED!",
            "metadata": None,
            "created_at": time.time(),
            "updated_at": time.time()
        }

        self.save_project(project_id, data)
        return data

    def get_project_dir(self, project_id: str) -> Path:
        return self.base_dir / project_id

    def load_project(self, project_id: str) -> Optional[dict]:
        pdir = self.get_project_dir(project_id)
        pfile = pdir / "project.json"
        
        # 1. Normal read
        if pfile.exists():
            try:
                with open(pfile, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                    return sanitize_for_json(raw)
            except Exception as e:
                print(f"Warning: Corrupted project.json for {project_id}: {e}. Attempting self-healing recovery...")

        # 2. Self-healing recovery: reconstruct project if panels exist
        panels_dir = pdir / "panels"
        if panels_dir.exists():
            try:
                recovered_panels = []
                for p in sorted(panels_dir.glob("panel_*.png")):
                    seg_id = int(p.stem.split("_")[1])
                    thumb_name = f"thumb_{seg_id:03d}.jpg"
                    recovered_panels.append({
                        "segment_id": int(seg_id),
                        "panel_file": str(p.name),
                        "thumb_file": str(thumb_name if (pdir / "previews" / thumb_name).exists() else p.name),
                        "page_num": 1,
                        "width": 1280,
                        "height": 800,
                        "box": [0, 0, 1280, 800]
                    })
                
                recovered_data = {
                    "id": project_id,
                    "name": "Recovered Project",
                    "internal_manga_ref": "Manga Recap",
                    "target_length": "20-Min Quick Recap",
                    "aspect_ratio": "16:9",
                    "narrator": "Adam",
                    "custom_voice_id": "",
                    "custom_instructions": "",
                    "panels": recovered_panels,
                    "segments": [],
                    "status": "panels_ready",
                    "progress": {"current": len(recovered_panels), "total": len(recovered_panels), "message": "Project recovered"},
                    "video_file": None,
                    "thumbnail_file": None,
                    "thumbnail_hook": "HE WAS BETRAYED!",
                    "metadata": None,
                    "created_at": time.time(),
                    "updated_at": time.time()
                }
                clean_rec = sanitize_for_json(recovered_data)
                self.save_project(project_id, clean_rec)
                return clean_rec
            except Exception as rec_err:
                print(f"Self-healing failed for {project_id}: {rec_err}")

        return None

    def save_project(self, project_id: str, data: dict) -> bool:
        """
        Atomic save: writes to a temporary file and atomically replaces project.json,
        preventing any corruption from process interruptions.
        """
        pdir = self.get_project_dir(project_id)
        pdir.mkdir(parents=True, exist_ok=True)
        pfile = pdir / "project.json"
        tmp_file = pdir / f"project.json.tmp.{os.getpid()}"
        
        clean_data = sanitize_for_json(data)
        clean_data["updated_at"] = time.time()
        
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(clean_data, f, indent=2)
            # Atomic file replacement
            tmp_file.replace(pfile)
            return True
        except Exception as e:
            if tmp_file.exists():
                try: tmp_file.unlink()
                except Exception: pass
            print(f"Atomic save error for {project_id}: {e}")
            return False

    def list_projects(self) -> list[dict]:
        results = []
        if not self.base_dir.exists():
            return results
        for d in self.base_dir.iterdir():
            if d.is_dir():
                try:
                    proj = self.load_project(d.name)
                    if proj and isinstance(proj, dict):
                        results.append({
                            "id": proj.get("id", d.name),
                            "name": proj.get("name", "Untitled"),
                            "aspect_ratio": proj.get("aspect_ratio", "16:9"),
                            "status": proj.get("status", "unknown"),
                            "segment_count": len(proj.get("segments", [])),
                            "created_at": proj.get("created_at", 0)
                        })
                except Exception:
                    pass
        results.sort(key=lambda x: x.get("created_at", 0), reverse=True)
        return results

    def delete_project(self, project_id: str) -> bool:
        pdir = self.get_project_dir(project_id)
        if pdir.exists():
            try:
                shutil.rmtree(pdir)
                return True
            except Exception:
                pass
        return False

    def create_builtin_demo_project(self) -> dict:
        """
        Generates a rich 6-panel demo project with ready artwork, narration, and metadata
        so users can audition the studio with 1 click!
        """
        proj = self.create_project(
            name="Shadow Monarch Awakening (Demo)",
            internal_manga_ref="Solo Leveling",
            target_length="20-Min Quick Recap",
            aspect_ratio="16:9",
            narrator="Charon",
            custom_instructions="Emphasize the sudden awakening of dark powers; keep narrator tone deep, suspenseful and cinematic; refer to the hero as The Shadow Monarch.",
            frame_style="dark_ambient",
            motion_speed="smooth_slow",
            export_quality="1080p",
            page_range="1-15"
        )
        
        proj_id = proj["id"]
        pdir = self.get_project_dir(proj_id)
        panels_dir = pdir / "panels"
        previews_dir = pdir / "previews"

        demo_panels_data = [
            {
                "title": "The Silent Gate",
                "bg_color": (15, 23, 42),
                "accent": (59, 130, 246),
                "text": "Jinwoo stood alone before the towering dungeon gates... sensing a terrifying, ancient presence inside.",
                "cam": "slow_zoom_in",
                "climax": False
            },
            {
                "title": "Ambush in the Dark",
                "bg_color": (30, 10, 45),
                "accent": (236, 72, 153),
                "text": "Without warning—the stone statues turned their glowing red eyes toward him... sealing every exit.",
                "cam": "slow_zoom_out",
                "climax": False
            },
            {
                "title": "The Desperate Struggle",
                "bg_color": (50, 15, 15),
                "accent": (239, 68, 68),
                "text": "Blood stained the altar as his broken blade shattered into pieces... left for dead by his own guild members.",
                "cam": "pan_up",
                "climax": False
            },
            {
                "title": "The System Materializes",
                "bg_color": (10, 30, 60),
                "accent": (14, 165, 233),
                "text": "In his final dying breath—a radiant golden interface flashed before his eyes: [You have qualified to become a Player].",
                "cam": "slow_zoom_in",
                "climax": True # Climax panel!
            },
            {
                "title": "Monarch of Shadows",
                "bg_color": (10, 10, 25),
                "accent": (168, 85, 247),
                "text": "Dark energy erupted from the floor like black lightning—as the dead soldiers bowed down to their new master.",
                "cam": "slow_zoom_in",
                "climax": False
            },
            {
                "title": "The King's Return",
                "bg_color": (20, 25, 40),
                "accent": (234, 179, 8),
                "text": "He stepped back into the human realm—no longer the weakest hunter... but the unstoppable Shadow King.",
                "cam": "pan_down",
                "climax": False
            }
        ]

        panels = []
        segments = []

        for idx, item in enumerate(demo_panels_data):
            pnum = idx + 1
            pfilename = f"panel_{pnum:03d}.png"
            tfilename = f"thumb_{pnum:03d}.jpg"
            
            panel_path = panels_dir / pfilename
            thumb_path = previews_dir / tfilename

            # Synthesize clean high-res dynamic comic art panels
            w, h = 1280, 800
            img = Image.new("RGB", (w, h), item["bg_color"])
            draw = ImageDraw.Draw(img)

            # Draw stylized manga action lines and glowing energy aura
            for radius in range(500, 50, -40):
                alpha_rect = [w//2 - radius, h//2 - radius//2, w//2 + radius, h//2 + radius//2]
                draw.ellipse(alpha_rect, outline=item["accent"], width=3)

            # Comic panel inner border
            draw.rectangle([20, 20, w - 20, h - 20], outline=(255, 255, 255), width=8)

            # Title & Dramatic chapter label
            font_path = Path(r"C:\Windows\Fonts\arialbd.ttf")
            font = ImageFont.truetype(str(font_path), 54) if font_path.exists() else ImageFont.load_default()
            sub_font = ImageFont.truetype(str(font_path), 32) if font_path.exists() else ImageFont.load_default()
            
            draw.text((60, 60), f"SCENE {pnum}: {item['title'].upper()}", fill=(255, 255, 255), font=font)
            draw.text((60, 130), "[ HIGH-RETENTION ACTION PANEL ]", fill=item["accent"], font=sub_font)
            
            # Action silhouette / energy burst
            center_x, center_y = w // 2, h // 2 + 50
            draw.polygon([
                (center_x, center_y - 180),
                (center_x + 120, center_y + 120),
                (center_x - 120, center_y + 120)
            ], fill=item["accent"])
            
            # Save panel & thumb
            img.save(str(panel_path), "PNG")
            
            thumb_w = 320
            thumb_h = int(h * (thumb_w / float(w)))
            thumb_img = img.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
            thumb_img.save(str(thumb_path), "JPEG", quality=85)

            panel_obj = {
                "segment_id": pnum,
                "panel_file": pfilename,
                "thumb_file": tfilename,
                "page_num": 1,
                "width": w,
                "height": h,
                "box": [0, 0, w, h]
            }
            panels.append(panel_obj)

            segment_obj = {
                "segment_id": pnum,
                "panel_file": pfilename,
                "thumb_file": tfilename,
                "narration_text": item["text"],
                "camera_motion": item["cam"],
                "pacing": "action" if item["climax"] else "tense",
                "is_climax_panel": item["climax"],
                "voice_mode": "ai",
                "audio_file": f"voice_{pnum:03d}.mp3",
                "audio_duration": 4.5
            }
            segments.append(segment_obj)

        proj["panels"] = panels
        proj["all_extracted_panels"] = list(panels)
        proj["segments"] = segments
        proj["status"] = "scripted"
        proj["thumbnail_hook"] = "HE WAS BETRAYED!"
        self.save_project(proj_id, proj)
        return proj
