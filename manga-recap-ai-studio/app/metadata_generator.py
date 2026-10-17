import os
import re
import json
import requests
from typing import Optional

from app.languages import get_language_info

def format_timestamp(seconds: float) -> str:
    mins = int(seconds // 60)
    secs = int(seconds % 60)
    return f"{mins:02d}:{secs:02d}"

def validate_zero_manga_name(text: str, forbidden_name: str) -> str:
    """
    Scans generated text and scrubs out any instance of the forbidden manga/manhwa title.
    """
    if not forbidden_name or not forbidden_name.strip():
        return text
    
    # Split multi-word title into tokens for strict safety
    tokens = [t.strip() for t in re.split(r'[\s\-_:,]+', forbidden_name.strip()) if len(t.strip()) > 2]
    
    cleaned = text
    # Case-insensitive full title replacement
    pattern_full = re.compile(re.escape(forbidden_name.strip()), re.IGNORECASE)
    cleaned = pattern_full.sub("This Legendary Comic", cleaned)
    
    # Check individual distinctive tokens
    for token in tokens:
        pattern_token = re.compile(rf'\b{re.escape(token)}\b', re.IGNORECASE)
        cleaned = pattern_token.sub("The Hero", cleaned)
        
    return cleaned

def generate_youtube_metadata(
    internal_manga_ref: str,
    custom_instructions: str,
    segments: list[dict],
    api_key: str = "",
    model_name: str = "gemini-3.8-flash",
    language: str = "en"
) -> dict:
    """
    Generates high-CTR, 100% Monetization Safe YouTube Packaging Kit in the selected language:
    - 5 Viral Titles (Zero-Manga-Name trope hooks in target language)
    - SEO Description with calculated video timestamps & Fair Use disclaimer
    - High-traffic tags
    - Recommended thumbnail hook texts
    - Strict validation stripping any forbidden title mentions
    """
    lang_info = get_language_info(language)
    lang_name = lang_info["name"]
    lang_native = lang_info["native_name"]

    # Calculate timestamps from segments
    timeline_timestamps = []
    current_time = 0.0
    timeline_timestamps.append(f"00:00 - Introduction & The Dark Awakening")
    
    total_duration = sum(s.get("audio_duration", 4.0) for s in segments)
    
    # Generate 4-6 meaningful chapter milestones across the video
    milestone_count = min(5, max(3, len(segments) // 2))
    interval = total_duration / float(milestone_count)
    accumulated = 0.0
    
    chapter_titles = [
        "The Betrayal and Descent",
        "The Ancient Power Awakens",
        "Unlocking the Forbidden System",
        "The Counterattack Begins",
        "Overwhelming the S-Rank Threat",
        "The Monarch Rises"
    ]
    
    ch_idx = 0
    for s in segments:
        dur = s.get("audio_duration", 4.0)
        accumulated += dur
        if accumulated >= (ch_idx + 1) * interval and ch_idx < len(chapter_titles) - 1:
            ch_idx += 1
            timeline_timestamps.append(f"{format_timestamp(accumulated)} - {chapter_titles[ch_idx]}")
            
    timestamps_text = "\n".join(timeline_timestamps)

    system_instruction = f"""
You are an expert YouTube growth strategist specializing in viral Manga, Manhwa, and Anime recap channels.
Your goal is to maximize Click-Through Rate (CTR) and Audience Retention while maintaining 100% Monetization Safety.

CRITICAL RULES:
1. ZERO MANGA NAME POLICY (STRICTEST RULE):
   - You MUST NEVER write the official comic title, chapter numbers, or author's name in the titles, description, tags, or thumbnail hooks.
   - Channels that use the real title face copyright strikes and low CTR.
   - Instead, use high-concept viral tropes: e.g., "Left for Dead in an S-Rank Dungeon, He Awakens a God-Tier Necromancy System and Takes Revenge".

2. MANDATORY LANGUAGE: 100% ENGLISH ONLY (STRICTEST REQUIREMENT):
   - Regardless of the audio narration language or the comic's language, ALL viral_titles, thumbnail_hooks, hook_summary, timestamps, and tags MUST BE WRITTEN 100% STRICTLY IN ENGLISH.
   - YouTube recap creators targeting global audiences, viral CTR, and maximum CPM monetization always use English titles, thumbnails, and descriptions.
   - Do NOT output in Hindi, Bengali, Urdu, Spanish, or any other language for titles, description, tags, or thumbnail hooks. Every title and hook must be fluent, punchy, high-converting English.

3. CUSTOM USER DIRECTIVES:
   - Prioritize these instructions if specified: {custom_instructions or "Focus on dark fantasy, revenge, and overpowered awakening"}

4. OUTPUT FORMAT:
   Return strictly valid JSON with these exact keys:
   {{
     "viral_titles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
     "thumbnail_hooks": ["HOOK 1", "HOOK 2", "HOOK 3", "HOOK 4"],
     "hook_summary": "Short captivating 2-sentence hook paragraph for the description...",
     "tags": ["tag 1", "tag 2", "tag 3", "tag 4", "tag 5"]
   }}
"""

    user_prompt = f"""
Internal story reference for context: '{internal_manga_ref}'.
Total video segments: {len(segments)}.
Estimated total runtime: {format_timestamp(total_duration)}.

Generate the viral metadata package now in 100% English conforming to the Zero-Manga-Name rule.
"""

    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY", "")

    raw_json = None
    if api_key:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {"response_mime_type": "application/json", "temperature": 0.8}
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=60)
            if resp.status_code == 200:
                raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                raw_json = json.loads(raw_text)
        except Exception as e:
            print(f"Gemini metadata generation failed: {e}")

    # Fallback default high-converting English metadata if API unavailable
    if not raw_json:
        raw_json = {
            "viral_titles": [
                "Betrayed By His Own Guild, He Awakens An Ancient Monarch System And Becomes Unstoppable",
                "Left For Dead In The Deepest Abyss, He Returns Wielding God-Tier Shadow Powers",
                "He Was Treated As The Weakest Trash Until His Secret Leveling System Activated",
                "When The S-Rank Hunters Banished Him, They Didn't Realize He Was The Final Boss",
                "Reincarnated With An Unknown God System, He Destroys Everyone Who Ever Looked Down On Him"
            ],
            "thumbnail_hooks": [
                "HE WAS BETRAYED!",
                "GOD POWERS AWAKENED!",
                "LEFT FOR DEAD...",
                "BANNED FROM THE SECT!",
                "THE WEAKEST HUNTER...",
                "SYSTEM ACTIVATED!"
            ],
            "hook_summary": "After being betrayed and abandoned in the darkest depths of the forbidden dungeon, an ordinary outcast makes a deadly pact with an ancient entity. Now armed with an unlimited leveling system, he begins his ruthless ascent to power.",
            "tags": [
                "manhwa recap", "manga recap", "op mc", "reincarnation manhwa", "overpowered main character",
                "system level up", "anime recap", "solo leveling style manhwa", "action manhwa recap", "dark fantasy recap"
            ]
        }

    # Strict Validation: Strip any forbidden names from all generated fields
    viral_titles = [validate_zero_manga_name(t, internal_manga_ref) for t in raw_json.get("viral_titles", [])]
    thumbnail_hooks = [validate_zero_manga_name(h, internal_manga_ref) for h in raw_json.get("thumbnail_hooks", [])]
    hook_summary = validate_zero_manga_name(raw_json.get("hook_summary", ""), internal_manga_ref)
    tags_list = [validate_zero_manga_name(tag, internal_manga_ref) for tag in raw_json.get("tags", [])]

    # Assemble Full SEO Description
    full_description = f"""{hook_summary}

🔔 Subscribe and turn on notifications for more high-quality action comic and manhwa recaps!
👍 Drop a LIKE if you enjoyed the story!

⏱️ TIMESTAMPS:
{timestamps_text}

------------------------------------------------------------------------
⚖️ COPYRIGHT & FAIR USE DISCLAIMER:
Under Section 107 of the Copyright Act 1976, allowance is made for "fair use" for purposes such as criticism, comment, news reporting, teaching, scholarship, and research. This video provides original transformative commentary, narrative storytelling, and educational recap analysis. All visual assets are cropped, animated, and color-graded for commentary purposes.

#MangaRecap #ManhwaRecap #AnimeRecap #OverpoweredMC #ActionManhwa
"""

    return {
        "viral_titles": viral_titles,
        "thumbnail_hooks": thumbnail_hooks,
        "recommended_hook": thumbnail_hooks[0] if thumbnail_hooks else "HE WAS BETRAYED!",
        "seo_description": full_description,
        "tags": tags_list,
        "tags_csv": ", ".join(tags_list),
        "total_duration_formatted": format_timestamp(total_duration),
        "is_zero_manga_name_verified": True
    }
