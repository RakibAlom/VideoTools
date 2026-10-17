import os
import json
import base64
import requests
from pathlib import Path
from typing import Optional

from app.languages import get_language_info

def encode_image_base64(image_path: Path) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")

def generate_script_with_gemini(
    panels: list[dict],
    panels_dir: Path,
    custom_instructions: str = "",
    internal_manga_ref: str = "",
    target_length: str = "20-Min Quick Recap",
    aspect_ratio: str = "16:9",
    api_key: str = "",
    model_name: str = "gemini-3.8-flash",
    language: str = "en"
) -> list[dict]:
    """
    Calls Google Gemini Vision API to craft a charismatic, natural YouTube recapper commentary script
    that explains the story and matches the visual panels accurately in the chosen language.
    """
    total_panels = len(panels)
    if not api_key:
        api_key = os.getenv("GEMINI_API_KEY", "")
        
    lang_info = get_language_info(language)
    lang_name = lang_info["name"]
    lang_native = lang_info["native_name"]
    lang_hint = lang_info["script_hint"]

    if not api_key:
        return generate_fallback_script(panels, custom_instructions, internal_manga_ref, language=language)

    # Master YouTube Manga Recapper System Prompt
    system_instruction = f"""
You are an elite, top-tier YouTube Manga & Anime Recap Creator (similar to AniRecap, ManhwaRecaps, Plot Armor).
Your channel is famous for engaging, entertaining storytelling where you explain the story clearly and smoothly to the viewer, panel by panel.

YOUR STORYTELLING STYLE:
1. NATURAL, CONVERSATIONAL EXPLANATION:
   - Talk directly to the audience in a warm, charismatic, and natural voice.
   - Explain the story as it unfolds: describe what the characters are doing, their expressions, their inner thoughts, and the shocking twists.
   - Use engaging recapper phrasing naturally to draw the audience in.
   - NEVER read dialogue or speech bubbles verbatim—explain the scene in entertaining third-person summary.
   - Keep narration lines punchy and conversational: ~18 to 35 words per panel segment.

2. AUTHENTIC CADENCE & PAUSES:
   - Insert strategic commas, ellipses (`...`), and em dashes (`—`) to give the voice narrator natural human pauses and breathing room.

3. CAMERA & PACING:
   - Camera motion choices: 'slow_zoom_in', 'slow_zoom_out', 'pan_down', 'pan_up', or 'static'.
   - Pick 1 or 2 true turning point climax panels and mark `is_climax_panel: true`.

4. ZERO-MANGA-NAME RULE:
   - Do NOT mention the official title of the comic in the narration. The reference '{internal_manga_ref}' is strictly for your context understanding.

======================================================================
CRITICAL MANDATORY LANGUAGE REQUIREMENT:
TARGET LANGUAGE: {lang_name} ({lang_native})
- Write ALL narration lines, dialogue summaries, and recapper commentary STRICTLY in {lang_name} ({lang_native}).
- {lang_hint}
- Do NOT output in English unless the selected language is English.
- Use natural punctuation and cadence so text-to-speech voices pronounce every word accurately and naturally.
======================================================================
"""

    if custom_instructions and custom_instructions.strip():
        system_instruction += f"""
======================================================================
CRITICAL USER DIRECTIVES (PRIORITIZE THESE):
{custom_instructions.strip()}
======================================================================
"""

    # Model Fallback Cascade: Try chosen model first, then auto-fallback if busy
    candidate_models = [model_name, "gemini-3-flash-preview", "gemini-flash-latest", "gemini-3.8-flash", "gemini-2.5-flash", "gemini-pro-latest"]
    unique_models = []
    for m in candidate_models:
        if m and m not in unique_models:
            unique_models.append(m)

    # We batch panels into chunks of up to 14 panels so Gemini gets high-res images for all of them
    batch_size = 14
    all_segments = []

    for batch_start in range(0, total_panels, batch_size):
        batch_panels = panels[batch_start:batch_start + batch_size]
        batch_seg_start = batch_start + 1
        
        user_prompt = f"""
Analyze the {len(batch_panels)} sequential comic panels provided (Segments #{batch_seg_start} to #{batch_seg_start + len(batch_panels) - 1}).
Target Pacing: {target_length}.
Manga Lore Reference: {internal_manga_ref}.

Explain what is happening in each panel clearly and engagingly in sequential order.
Conform STRICTLY to this JSON format:
[
  {{
    "segment_id": {batch_seg_start},
    "panel_file": "{batch_panels[0]['panel_file']}",
    "narration_text": "Here we see him carefully examining the page... noticing a dark detail that completely shifts his perspective.",
    "camera_motion": "slow_zoom_in",
    "pacing": "tense",
    "is_climax_panel": false
  }}
]
"""
        parts = [{"text": user_prompt}]
        for p in batch_panels:
            img_p = panels_dir / p["panel_file"]
            if img_p.exists():
                try:
                    b64_data = encode_image_base64(img_p)
                    mime = "image/png" if img_p.suffix.lower() == ".png" else "image/jpeg"
                    parts.append({
                        "inline_data": {
                            "mime_type": mime,
                            "data": b64_data
                        }
                    })
                except Exception:
                    pass

        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"parts": parts}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.7,
                "maxOutputTokens": 8192
            }
        }

        batch_parsed = None
        for try_model in unique_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{try_model}:generateContent?key={api_key}"
            try:
                res = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=60)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        raw = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                        if raw.startswith("```json"): raw = raw[7:]
                        if raw.startswith("```"): raw = raw[3:]
                        if raw.endswith("```"): raw = raw[:-3]
                        batch_parsed = json.loads(raw.strip())
                        break
            except Exception as e:
                print(f"Error querying {try_model}: {e}")
                continue

        # If API batch generation succeeded, append items
        if batch_parsed and isinstance(batch_parsed, list):
            for idx_in_batch, p in enumerate(batch_panels):
                global_seg_id = batch_start + idx_in_batch + 1
                matched = next((item for item in batch_parsed if item.get("segment_id") == global_seg_id), None)
                if not matched and idx_in_batch < len(batch_parsed):
                    matched = batch_parsed[idx_in_batch]
                    
                narr = matched.get("narration_text", "") if matched else ""
                if not narr:
                    narr = f"Looking closer at this scene... our protagonist realizes the true gravity of what he is up against."
                    
                cam = matched.get("camera_motion", "slow_zoom_in") if matched else "slow_zoom_in"
                pac = matched.get("pacing", "tense") if matched else "tense"
                is_clx = matched.get("is_climax_panel", False) if matched else False
                
                all_segments.append({
                    "segment_id": global_seg_id,
                    "panel_file": p["panel_file"],
                    "thumb_file": p.get("thumb_file", p["panel_file"]),
                    "narration_text": narr,
                    "camera_motion": cam,
                    "pacing": pac,
                    "is_climax_panel": bool(is_clx),
                    "voice_mode": "ai",
                    "audio_file": None,
                    "audio_duration": 0.0
                })
        else:
            # Fallback for this batch
            sub_fallback = generate_fallback_script(batch_panels, custom_instructions, internal_manga_ref, start_id=batch_seg_start, language=language)
            all_segments.extend(sub_fallback)

    # Ensure at least 1 climax panel
    if not any(s["is_climax_panel"] for s in all_segments) and all_segments:
        climax_idx = min(len(all_segments) - 1, int(len(all_segments) * 0.75))
        all_segments[climax_idx]["is_climax_panel"] = True

    return all_segments

def generate_fallback_script(
    panels: list[dict],
    custom_instructions: str = "",
    internal_manga_ref: str = "",
    start_id: int = 1,
    language: str = "en"
) -> list[dict]:
    """
    Intelligent lore-aware offline narrative generator providing engaging YouTube recapper commentary
    in the requested language.
    """
    lang = (language or "en").lower().strip()
    ref_lower = (internal_manga_ref or "").lower()

    if lang == "bn":
        narratives = [
            "শুরুতেই আমরা দেখতে পাচ্ছি আমাদের প্রধান চরিত্র গভীর চিন্তায় মগ্ন... চারপাশের এই কঠোর বাস্তবতায় সে যেন একেবারেই ক্লান্ত।",
            "ঠিক তখনই তার নজরে আসে এক রহস্যময় দৃশ্য... যা এক পলকেই তার দৃষ্টি আকর্ষণ করে।",
            "কৌতূহল সংবরণ করতে না পেরে সে সামনে এগিয়ে যায়... এবং বুঝতে পারে এখানে কোনো সাধারণ ঘটনা ঘটছে না।",
            "প্রথমে সে বিষয়টিকে স্বাভাবিক বলে উড়িয়ে দিতে চেয়েছিল... কিন্তু পরিস্থিতি দ্রুত গম্ভীর রূপ নিতে শুরু করে।",
            "অদৃষ্টের অদ্ভুত খেলায় সে এক ভয়ংকর চ্যালেঞ্জের মুখোমুখি হয়... যেখানে প্রতি সেকেন্ডেই লুকিয়ে আছে নতুন বিপদ।",
            "খেয়াল করুন চরিত্রের মুখের অভিব্যক্তি... এই কঠিন মুহূর্তেও সে নিজের আত্মবিশ্বাস হারায়নি।",
            "হঠাৎ করেই এক অবিশ্বাস্য ক্ষমতার বহিঃপ্রকাশ ঘটে... যা সবাইকে হতবাক করে দেয়।",
            "একটি অপ্রতিরোধ্য অন্ধকার শক্তির প্রাচীর ভেঙে বেরিয়ে আসে... জানান দেয় এক নতুন অধিনায়কের উত্থান।",
            "যাকে একসময় সবাই তুচ্ছ ভেবেছিল... আজ সে-ই হয়ে উঠেছে অপরাজেয় কিংবদন্তি।",
            "আর এভাবেই শুরু হলো প্রতিশোধ এবং বিজয়ের এক অবিস্মরণীয় মহাকাব্য।"
        ]
    elif lang == "hi":
        narratives = [
            "शुरुआत में ही हम अपने मुख्य किरदार को गहरी सोच में डूबा हुआ देखते हैं... जहाँ वह इस क्रूर दुनिया से तंग आ चुका है।",
            "तभी उसकी नज़र एक ऐसी अनोखी चीज़ पर पड़ती है... जो उसकी पूरी ज़िंदगी को हमेशा के लिए बदलने वाली है।",
            "जिज्ञासा के चलते वह करीब जाता है... और एक ऐसा रहस्यमयी सच उसके सामने आता है जिसकी किसी ने कल्पना भी नहीं की थी।",
            "पहले तो उसे लगा कि यह सिर्फ एक भ्रम है... लेकिन धीरे-धीरे तनाव हवा में भारी होने लगता है।",
            "हर गुज़रते सेकंड के साथ खतरा बढ़ता जा रहा है... और उसे अपनी जान बचाने के लिए एक बड़ा फैसला लेना पड़ता है।",
            "देखिए उसके चेहरे का यह दृढ़ संकल्प... वह हार मानने वालों में से बिल्कुल नहीं है।",
            "अचानक एक गुप्त शक्ति उसके अंदर जाग उठती है... जिसकी ऊर्जा से पूरा मैदान थर्राने लगता है।",
            "जिन्हें कल तक कमज़ोर समझा गया था... आज वही अंधेरे का सबसे खतरनाक राजा बनकर सामने आया है।",
            "एक ज़बरदस्त पलटवार के साथ उसने अपने सभी दुश्मनों को स्तब्ध कर दिया है।",
            "और यहीं से शुरू होती है ताकत और बदले की एक नई और रोमांचक कहानी।"
        ]
    elif lang == "ur":
        narratives = [
            "شروع ہی میں ہم دیکھتے ہیں کہ ہمارا مرکزی کردار گہری سوچ میں گم ہے... اور حالات اس کے قابو سے باہر ہوتے جا رہے ہیں۔",
            "تبھی اچانک اس کی نظر ایک عجیب و غریب منظر پر پڑتی ہے... جو اس کی تقدیر بدلنے والا ہے۔",
            "تجسس کے ہاتھوں مجبور ہو کر وہ آگے بڑھتا ہے... اور ایک نیا راز اس کے سامنے کھلتا ہے۔",
            "پہلے تو اسے یہ محض ایک اتفاق لگا... لیکن خطرہ پل بہ پل بڑھتا چلا گیا۔",
            "دیکھیے اس کے چہرے کا خوف اور ساتھ ہی وہ خاموش عزم... وہ کسی بھی قیمت پر رکنے والا نہیں۔",
            "اور پھر اچانک ایک پراسرار طاقت بیدار ہوتی ہے... جو سارے کھیل کا رخ موڑ دیتی ہے۔",
            "جسے سب نے کمزور سمجھا تھا، آج وہی سب سے طاقتور بن کر ابھرا ہے۔",
            "اس حیران کن موڑ نے ہر دیکھنے والے کو ششدر کر دیا۔",
            "اور اس طرح کہانی ایک نئے اور خطرناک دور میں داخل ہو جاتی ہے۔"
        ]
    elif lang == "es":
        narratives = [
            "Comenzamos viendo a nuestro protagonista sumido en sus pensamientos... sintiéndose atrapado en un mundo lleno de injusticias.",
            "En ese instante, algo insólito capta su atención... un objeto misterioso que cambiará su destino para siempre.",
            "Llevado por la curiosidad, decide investigar más de cerca... descubriendo una verdad que le hiela la sangre.",
            "Al principio intenta tomárselo como una broma... pero la tensión en el ambiente comienza a subir rápidamente.",
            "Cada segundo cuenta mientras la presión aumenta... y se ve obligado a tomar una decisión trascendental.",
            "Observen su mirada de pura determinación... ya no está dispuesto a ser pisoteado por nadie.",
            "De repente, un poder abrumador despierta en su interior... desatando una energía jamás antes vista.",
            "Aquel que todos consideraban el más débil... ahora se alza como el soberano definitivo.",
            "Y es aquí donde comienza su imparable camino hacia la cima."
        ]
    else:
        # Default English
        if any(k in ref_lower for k in ["death note", "light", "detective", "investigation", "mystery", "psychological"]):
            narratives = [
                "Right from the start, we see our brilliant protagonist lost in thought... feeling completely bored with the corrupted world around him.",
                "That's when something impossible catches his eye out in the courtyard... an ominous black notebook lying alone on the grass.",
                "Curiosity getting the better of him, he picks it up... and upon opening the first page, he discovers a set of chilling instructions.",
                "At first, he laughs it off as a sick psychological prank... believing no human could possess the power to take a life just with a name.",
                "However, his mind won't let it go... and as he sits alone in his room, he decides to test the rules on a vicious criminal held hostage on the news.",
                "The tension builds with every passing second... staring intensely at the ticking clock as forty seconds slowly wind down.",
                "Suddenly, the news anchor announces the horrifying truth... the criminal collapsed without warning, confirming the notebook's lethal reality.",
                "A chilling realization washes over his face... this isn't just an illusion—he now holds absolute divine judgment in his hands.",
                "Notice his cold determination here... as he begins planning to cleanse the world and establish himself as the god of a new era.",
                "Meanwhile, far away in the shadows... the global police authorities realize an invisible mastermind has begun a reign of terror."
            ]
        elif any(k in ref_lower for k in ["solo leveling", "hunter", "dungeon", "monarch", "shadow", "system", "magic", "gate"]):
            narratives = [
                "We open on our protagonist standing before the gateway... known as the weakest ranker, barely surviving each dungeon raid.",
                "As the party delves deeper into the cavern... the atmosphere shifts, revealing a hidden double-lair that wasn't on the guild map.",
                "The massive stone doors slam shut behind them... trapping the entire team inside with colossal statues radiating terrifying mana.",
                "Notice the sheer panic spreading across their faces... as the giant statues begin moving, obliterating anyone who steps out of line.",
                "While the others freeze in terror, he stays sharp... analyzing the ancient stone commandments to find a hidden way out.",
                "Even when pushed to the absolute brink of death... an unbelievable system interface appears before him, offering a secret second chance.",
                "Accepting the mysterious trial, his hidden awakening begins... power surging through his veins like an erupting volcano.",
                "With unmatched speed and precision... he strikes back against the threat, shocking everyone who once looked down on him.",
                "A dark shadowy aura begins swirling around him... signaling the rise of an unstoppable conqueror.",
                "From an outcast left for dead to a legend in the making... his journey to the top has officially begun."
            ]
        else:
            narratives = [
                "Here we see our main character taking in the tense situation... realizing that normal life is about to change forever.",
                "Notice how the atmosphere shifts on this page... as an unexpected revelation catches everyone off guard.",
                "He tries to stay composed under the mounting pressure... but every clue points to a much deeper conspiracy.",
                "As we follow his perspective closely... he makes a daring move, testing the waters before committing to his plan.",
                "Look at the dramatic reaction here... what seemed like an ordinary encounter quickly turns into a high-stakes standoff.",
                "He pieces together the hidden truth... recognizing that whoever is behind this has been watching him all along.",
                "With time running out fast... he steps forward with quiet confidence, ready to turn the tables on his opposition.",
                "The confrontation reaches a boiling point... as the true motives of the characters are finally brought to light.",
                "In this pivotal turning point... our protagonist makes a decisive choice that will determine the fate of everything.",
                "As the chapter draws to a close... the stage is set for an epic clash that no one could have anticipated."
            ]

    climax_index = max(0, int(len(panels) * 0.75))
    segments = []
    
    for i, p in enumerate(panels):
        seg_id = start_id + i
        tmpl = narratives[i % len(narratives)]
        is_climax = (i == climax_index)
        
        if i % 3 == 0:
            cam = "slow_zoom_in"
        elif i % 3 == 1:
            cam = "pan_down"
        else:
            cam = "slow_zoom_out"
            
        segments.append({
            "segment_id": seg_id,
            "panel_file": p["panel_file"],
            "thumb_file": p.get("thumb_file", p["panel_file"]),
            "narration_text": tmpl,
            "camera_motion": cam,
            "pacing": "tense" if not is_climax else "action",
            "is_climax_panel": is_climax,
            "voice_mode": "ai",
            "audio_file": None,
            "audio_duration": 0.0
        })
        
    return segments
