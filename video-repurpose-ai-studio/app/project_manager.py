import os
import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

PROJECTS_DIR = Path(__file__).resolve().parent.parent / "projects"
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


class ProjectManager:
    @staticmethod
    def get_project_dir(project_id: str) -> Path:
        p_dir = PROJECTS_DIR / project_id
        p_dir.mkdir(parents=True, exist_ok=True)
        return p_dir

    @staticmethod
    def create_project(
        title: str,
        video_filename: str,
        source_lang: str = "auto",
        target_lang: str = "en",
        tone: str = "storyteller",
        custom_instructions: str = ""
    ) -> Dict[str, Any]:
        project_id = uuid.uuid4().hex[:8]
        p_dir = ProjectManager.get_project_dir(project_id)
        (p_dir / "audio_clips").mkdir(exist_ok=True)

        project_data = {
            "id": project_id,
            "title": title or f"Repurpose_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "created_at": datetime.now().isoformat(),
            "status": "created",
            "progress_percent": 0,
            "progress_message": "Project initialized",
            "video_filename": video_filename,
            "source_language": source_lang,
            "target_language": target_lang,
            "tone": tone,
            "custom_instructions": custom_instructions,
            "detected_language": None,
            "detected_language_name": None,
            "segments": [],
            "timeline_slices": [],
            "text_overlays": [],
            "video_metadata": {},
            "render_settings": {},
            "final_video_file": None,
            "thumbnail_file": None,
            "metadata_package": None
        }

        ProjectManager.save_project(project_id, project_data)
        return project_data

    @staticmethod
    def get_project(project_id: str) -> Optional[Dict[str, Any]]:
        p_file = ProjectManager.get_project_dir(project_id) / "project.json"
        if not p_file.exists():
            return None
        try:
            with open(p_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[ProjectManager] Error reading project {project_id}: {e}")
            return None

    @staticmethod
    def save_project(project_id: str, data: Dict[str, Any]) -> None:
        p_file = ProjectManager.get_project_dir(project_id) / "project.json"
        with open(p_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    @staticmethod
    def list_projects() -> List[Dict[str, Any]]:
        projects = []
        for p_dir in PROJECTS_DIR.iterdir():
            if p_dir.is_dir():
                p_file = p_dir / "project.json"
                if p_file.exists():
                    try:
                        with open(p_file, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            projects.append({
                                "id": data.get("id"),
                                "title": data.get("title"),
                                "created_at": data.get("created_at"),
                                "status": data.get("status"),
                                "source_language": data.get("source_language"),
                                "target_language": data.get("target_language"),
                                "segments_count": len(data.get("segments", [])),
                                "has_video": bool(data.get("final_video_file"))
                            })
                    except Exception:
                        pass
        projects.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return projects

    @staticmethod
    def update_segment_text(
        project_id: str,
        segment_id: int,
        rewritten_text: Optional[str] = None,
        original_text: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        proj = ProjectManager.get_project(project_id)
        if not proj:
            return None
        for seg in proj.get("segments", []):
            if seg.get("segment_id") == segment_id:
                if rewritten_text is not None:
                    seg["rewritten_text"] = rewritten_text
                if original_text is not None:
                    seg["original_text"] = original_text
                break
        ProjectManager.save_project(project_id, proj)
        return proj

    @staticmethod
    def delete_segment(project_id: str, segment_id: int) -> Optional[Dict[str, Any]]:
        proj = ProjectManager.get_project(project_id)
        if not proj:
            return None
        proj["segments"] = [s for s in proj.get("segments", []) if s.get("segment_id") != segment_id]
        # Re-index
        for idx, s in enumerate(proj["segments"], start=1):
            s["segment_id"] = idx
        ProjectManager.save_project(project_id, proj)
        return proj

    @staticmethod
    def add_segment(
        project_id: str,
        start: float,
        end: float,
        original_text: str = "",
        rewritten_text: str = ""
    ) -> Optional[Dict[str, Any]]:
        proj = ProjectManager.get_project(project_id)
        if not proj:
            return None
        segments = proj.get("segments", [])
        new_id = len(segments) + 1
        segments.append({
            "segment_id": new_id,
            "start": round(start, 2),
            "end": round(end, 2),
            "original_text": original_text,
            "rewritten_text": rewritten_text or original_text,
            "tone_note": "Manual entry"
        })
        segments.sort(key=lambda x: x.get("start", 0))
        for idx, s in enumerate(segments, start=1):
            s["segment_id"] = idx
        proj["segments"] = segments
        ProjectManager.save_project(project_id, proj)
        return proj

    @staticmethod
    def update_timeline_state(
        project_id: str,
        slices: List[Dict[str, float]],
        text_overlays: List[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        proj = ProjectManager.get_project(project_id)
        if not proj:
            return None
        proj["timeline_slices"] = slices
        proj["text_overlays"] = text_overlays
        ProjectManager.save_project(project_id, proj)
        return proj
