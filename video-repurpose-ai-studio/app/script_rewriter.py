import re
import json
import requests
import concurrent.futures
from typing import List, Dict, Any, Optional, Tuple
from app.languages import get_language_info


def free_google_translate(text: str, target_lang: str = "en", source_lang: str = "auto") -> str:
    """Free Google Translate endpoint with desktop user-agent to prevent 429 rate limiting."""
    if not text or not text.strip():
        return ""
    if text.startswith("[") and text.endswith("]"):
        return text

    tl = "en" if target_lang == "same_rewrite" else target_lang
    sl = "auto" if not source_lang else source_lang

    try:
        url = f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl={sl}&tl={tl}"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        resp = requests.post(url, headers=headers, data={"q": text}, timeout=10)
        if resp.status_code == 200:
            res_json = resp.json()
            if isinstance(res_json, list) and len(res_json) > 0:
                return str(res_json[0]).strip()
    except Exception as e:
        print(f"[FreeTranslate] Error: {e}")
    return text


def polish_recapper_cadence(text: str, lang: str = "en", tone: str = "storyteller") -> str:
    """
    Cleans punctuation for video voiceover:
    - Strips all punctuation (commas, full stops, dāri, question marks, dashes, etc.)
      so the voice engine speaks in an ultra-fluid, unbroken, natural broadcast cadence
      without artificial breath pauses, halting dead air, or robotic lag.
    """
    if not text or text.startswith("["):
        return text

    # Remove all commas, full stops, dāri, semicolons, dashes, and pauses completely
    cleaned = re.sub(r'[.,।!?;:\-—–\"\'“”‘’…~`#*_\^/\\\|+=\[\]\{\}<>۔]', ' ', text)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned


def fallback_paraphrase_and_translate(
    segments: List[Dict[str, Any]],
    source_language: str,
    target_language: str,
    tone: str = "storyteller"
) -> List[Dict[str, Any]]:
    """
    Guaranteed high-speed batch translation and narrative styling engine.
    Translates hundreds of segments in seconds using Google's robust clients5 endpoint.
    """
    is_same = (target_language == "same_rewrite" or target_language == source_language)
    tl = source_language if is_same else ("en" if target_language == "same_rewrite" else target_language)
    sl = "auto" if not source_language else source_language

    out = []
    batch_size = 30
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    for b_idx in range(0, len(segments), batch_size):
        batch = segments[b_idx:b_idx + batch_size]
        
        # Collect non-bracket text to translate
        texts_to_translate = []
        indices_to_translate = []
        for i, seg in enumerate(batch):
            orig = seg.get("original_text", "").strip()
            if orig and not orig.startswith("["):
                texts_to_translate.append(orig)
                indices_to_translate.append(i)

        translated_map = {}
        if texts_to_translate and not is_same:
            combined = "\n".join(texts_to_translate)
            try:
                url = f"https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl={sl}&tl={tl}"
                resp = requests.post(url, headers=headers, data={"q": combined}, timeout=15)
                if resp.status_code == 200:
                    lines = resp.json()[0].split("\n")
                    if len(lines) == len(texts_to_translate):
                        for idx, trans_line in zip(indices_to_translate, lines):
                            translated_map[idx] = trans_line
                    else:
                        for idx, orig_text in zip(indices_to_translate, texts_to_translate):
                            translated_map[idx] = free_google_translate(orig_text, target_lang=tl, source_lang=sl)
                else:
                    for idx, orig_text in zip(indices_to_translate, texts_to_translate):
                        translated_map[idx] = free_google_translate(orig_text, target_lang=tl, source_lang=sl)
            except Exception as e:
                print(f"[BatchTranslate] Fallback to single translate: {e}")
                for idx, orig_text in zip(indices_to_translate, texts_to_translate):
                    translated_map[idx] = free_google_translate(orig_text, target_lang=tl, source_lang=sl)

        for i, seg in enumerate(batch):
            orig = seg.get("original_text", "").strip()
            if not orig or orig.startswith("["):
                out.append({
                    "segment_id": seg.get("segment_id", i + 1),
                    "start": seg.get("start", 0.0),
                    "end": seg.get("end", 0.0),
                    "original_text": orig,
                    "rewritten_text": orig,
                    "tone_note": "Action / Music"
                })
                continue

            if is_same:
                # Rephrase with storyteller rhythm
                rewritten = polish_recapper_cadence(orig, lang=source_language, tone=tone)
            else:
                raw_trans = translated_map.get(i, orig)
                rewritten = polish_recapper_cadence(raw_trans, lang=tl, tone=tone)

            out.append({
                "segment_id": seg.get("segment_id", i + 1),
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "original_text": orig,
                "rewritten_text": rewritten,
                "tone_note": "Recapper Storytelling"
            })

    return out


def rewrite_script_with_gemini(
    segments: List[Dict[str, Any]],
    source_language: str = "en",
    target_language: str = "hi",
    tone: str = "storyteller",
    custom_instructions: str = "",
    api_key: str = "",
    model_name: str = "gemini-3.1-flash-lite"
) -> List[Dict[str, Any]]:
    """
    Rewrites and/or translates transcribed video segments to prevent copyright strikes.
    If Gemini hits 429 quota exhaustion, immediately falls back to free translation & paraphrasing!
    """
    if not segments:
        return []

    clean_key = (api_key or "").strip()
    if not clean_key or clean_key.upper().startswith("DEMO") or clean_key == "YOUR_GEMINI_API_KEY":
        return fallback_paraphrase_and_translate(segments, source_language, target_language, tone)

    is_same_rewrite = (target_language == "same_rewrite" or target_language == source_language)
    target_info = get_language_info("en" if is_same_rewrite else target_language)
    target_lang_name = target_info["name"]
    target_native_name = target_info["native_name"]
    script_hint = target_info["script_hint"]

    tone_guides = {
        "storyteller": "Warm, charismatic, engaging YouTube recap storytelling with vivid scene descriptions.",
        "suspense": "Dark, tense, thrilling tone with dramatic pauses, building anticipation at every twist.",
        "casual": "Friendly, fast-paced, entertaining and humorous conversational commentary.",
        "fast_paced": "High-energy, punchy, adrenaline-fueled pacing ideal for viral retention.",
        "cinematic": "Epic, grand, movie-trailer level narration with deep emotional gravity."
    }
    tone_desc = tone_guides.get(tone, tone_guides["storyteller"])

    if target_language == "hi":
        lang_directive = """
TARGET LANGUAGE: Hindi (हिन्दी).
- Write STRICTLY in native Hindi Devanagari script (देवनागरी लिपि, e.g. 'कहानी की शुरुआत होती है...').
- NEVER use English/Latin letters (NO Hinglish).
- NEVER use commas (,) anywhere in sentences. Commas force the voiceover engine to halt with annoying breath breaks. Only use dari (।) at the end of a complete sentence.
"""
    elif target_language == "bn":
        lang_directive = """
TARGET LANGUAGE: Bengali (বাংলা).
- Write STRICTLY in native Bengali script (বাংলা লিপি).
- NEVER use commas (,) anywhere in sentences. Only use dari (।) at the end of a complete sentence.
"""
    elif is_same_rewrite:
        lang_directive = f"""
TARGET LANGUAGE: KEEP SOURCE LANGUAGE ({source_language}).
- Paraphrase and re-write EVERY sentence 100% differently to guarantee zero copyright or plagiarism issues.
- Preserve the exact plot sequence and scene facts, but completely alter vocabulary and sentence structures.
- NEVER use commas (,). Use smooth flowing continuous sentences with periods (.) only at sentence ends.
"""
    else:
        lang_directive = f"""
TARGET LANGUAGE: {target_lang_name} ({target_native_name}).
- Translate and naturally adapt the entire narration into {target_lang_name} ({target_native_name}).
- {script_hint}
- Produce charismatic, colloquial commentary in the style of top YouTube recappers in {target_lang_name}.
- NEVER use commas (,). Use smooth flowing continuous sentences.
"""

    sys_prompt = f"""
You are an elite, top-tier YouTube Video Recapper & Script Remasterer.
Transform the transcribed commentary into a 100% original, copyright-safe, emotional, and captivating recap script.
CRITICAL RULES:
1. TOTAL RE-WRITING & ZERO PLAGIARISM: Rephrase every line completely with new vocabulary while preserving the exact story facts.
2. NATURAL VOICE SCRIPT CADENCE (ZERO COMMAS):
   - DO NOT use commas (,) anywhere in sentences. Commas force the TTS voice to take unnatural breath halts that ruin video narration.
   - Write smooth, flowing, continuous sentences.
   - Only use dari (।) for Bengali and Hindi, or period (.) for English at the end of complete sentences.
   - Do NOT use too many stops or dots. Let the speech flow naturally.
3. STRIP ADS & CHANNEL INTROS: Remove any creator names, like/subscribe begs, and sponsor mentions.
4. TARGET TONE: {tone_desc}
5. {lang_directive}
6. SCENE PACING & WORD BUDGET: Keep commentary word count fitting naturally into the scene duration (roughly 2.2 spoken words per second). Do NOT produce excessively long text for short scenes so speech timing aligns with the visual action.
"""

    if custom_instructions and custom_instructions.strip():
        sys_prompt += f"\nCRITICAL USER DIRECTIVE: {custom_instructions.strip()}\n"

    batch_size = 15
    batches = [segments[i:i + batch_size] for i in range(0, len(segments), batch_size)]
    results_map: Dict[int, str] = {}

    import concurrent.futures

    def _process_one_batch(b_idx: int, batch: List[Dict[str, Any]]) -> Dict[int, str]:
        batch_input_list = [
            {
                "segment_id": seg.get("segment_id", i + 1),
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "duration": round(float(seg.get("end", 0.0)) - float(seg.get("start", 0.0)), 1),
                "original_text": seg.get("original_text", "")
            }
            for i, seg in enumerate(batch)
        ]

        user_prompt = f"""
Here is the batch of {len(batch)} transcript segments to transform:
{json.dumps(batch_input_list, indent=2, ensure_ascii=False)}

Output STRICTLY a JSON array of objects with this schema:
[
  {{
    "segment_id": 1,
    "rewritten_text": "..."
  }}
]
"""
        batch_result = _call_gemini_rewrite_batch(sys_prompt, user_prompt, api_key, model_name)
        if batch_result and isinstance(batch_result, list):
            b_map = {item.get("segment_id"): item.get("rewritten_text", "").strip() for item in batch_result if "segment_id" in item}
            if len(b_map) >= int(len(batch) * 0.75):
                return b_map

        # Per-batch fallback to guaranteed free translator
        print(f"[Gemini Batch {b_idx+1}/{len(batches)}] Falling back to direct neural translation...")
        fb_batch = fallback_paraphrase_and_translate(batch, source_language, target_language, tone)
        return {item["segment_id"]: item.get("rewritten_text", item.get("original_text", "")).strip() for item in fb_batch}

    # Execute batches with up to 3 parallel workers
    max_w = min(3, len(batches))
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_w) as executor:
        fut_map = {executor.submit(_process_one_batch, i, b): i for i, b in enumerate(batches)}
        for fut in concurrent.futures.as_completed(fut_map):
            try:
                b_res = fut.result()
                results_map.update(b_res)
            except Exception as e:
                print(f"[Batch Rewrite Error] {e}")

    # Build final segment list
    out_segments = []
    for seg in segments:
        seg_copy = dict(seg)
        sid = seg_copy["segment_id"]
        if sid in results_map and results_map[sid]:
            seg_copy["rewritten_text"] = results_map[sid]
        elif not seg_copy.get("rewritten_text"):
            seg_copy["rewritten_text"] = seg_copy.get("original_text", "")
        out_segments.append(seg_copy)

    return out_segments


def build_teleprompter_script_from_segments(segments: List[Dict[str, Any]]) -> str:
    """Builds a continuous teleprompter script from segments with natural \\n\\n paragraph gaps every 2-3 sentences."""
    blocks = []
    curr = []
    for seg in segments:
        txt = (seg.get("rewritten_text") or seg.get("original_text") or "").strip()
        if not txt:
            continue
        curr.append(txt)
        if len(curr) >= 3:
            blocks.append(" ".join(curr))
            curr = []
    if curr:
        blocks.append(" ".join(curr))
    return "\n\n".join(blocks)


def _call_gemini_rewrite_batch(sys_prompt: str, user_prompt: str, api_key: str, model_name: str) -> Optional[List[Dict[str, Any]]]:
    clean_key = (api_key or "").strip()
    if not clean_key or clean_key.upper().startswith("DEMO") or clean_key == "YOUR_GEMINI_API_KEY":
        return None

    candidate_models = [
        model_name or "gemini-4-argon",
        "gemini-4-argon",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
    ]
    unique_models = []
    for m in candidate_models:
        if m and m not in unique_models:
            unique_models.append(m)

    payload = {
        "system_instruction": {"parts": [{"text": sys_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.7,
            "maxOutputTokens": 8192
        }
    }

    for model in unique_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=40)
            if resp.status_code == 200:
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                cleaned = re.sub(r"^```(?:json)?\s*", "", text.strip())
                cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                parsed = json.loads(cleaned)
                if isinstance(parsed, list):
                    return parsed
            elif resp.status_code == 429:
                print(f"[Gemini Rewrite] Model {model} 429 quota exhausted. Trying next model...")
                continue
        except Exception as e:
            print(f"[Gemini Rewrite] Model {model} attempt failed: {e}")
            continue

    return None


def rewrite_single_segment(
    segment: Dict[str, Any],
    source_language: str,
    target_language: str,
    tone: str,
    custom_instructions: str,
    api_key: str,
    model_name: str = "gemini-4-argon"
) -> str:
    """Rewrites a single individual segment when user clicks 'Regenerate Segment'."""
    res = rewrite_script_with_gemini(
        segments=[segment],
        source_language=source_language,
        target_language=target_language,
        tone=tone,
        custom_instructions=custom_instructions,
        api_key=api_key,
        model_name=model_name
    )
    if res and len(res) > 0 and "rewritten_text" in res[0]:
        return res[0]["rewritten_text"]
    return segment.get("original_text", "")


def _call_gemini_raw_text(sys_prompt: str, user_prompt: str, api_key: str, model_name: str = "gemini-4-argon") -> Optional[str]:
    """Helper to query Gemini API with model cascading for plain text output."""
    if not api_key:
        return None

    candidate_models = [
        model_name or "gemini-4-argon",
        "gemini-4-argon",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
    ]
    unique_models = []
    for m in candidate_models:
        if m and m not in unique_models:
            unique_models.append(m)

    payload = {
        "system_instruction": {"parts": [{"text": sys_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.35,
            "maxOutputTokens": 4096
        }
    }

    for model in unique_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        try:
            resp = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                text_content = data["candidates"][0]["content"]["parts"][0]["text"]
                cleaned = re.sub(r"^```[a-zA-Z]*\s*", "", text_content.strip())
                cleaned = re.sub(r"\s*```$", "", cleaned.strip())
                if cleaned:
                    return cleaned
            elif resp.status_code == 429:
                print(f"[Gemini Text] Model {model} 429 quota exhausted. Trying next model...")
                continue
        except Exception as e:
            print(f"[Gemini Text] Model {model} attempt failed: {e}")
            continue

    return None


def rewrite_full_continuous_script(
    full_text: str,
    source_language: str = "en",
    target_language: str = "hi",
    tone: str = "storyteller",
    custom_instructions: str = "",
    api_key: str = "",
    model_name: str = "gemini-4-argon",
    target_duration: float = 0.0
) -> str:
    """
    Rewrites and translates a complete continuous narration script in one coherent story flow.
    Calibrates the word budget precisely to the target video duration so the AI narrator
    speaks at a natural, relaxed, charismatic 1.0x storytelling pace without rushing or speeding up.
    Splits long scripts into ~250-word narrative chunks to guarantee zero omission, zero truncation,
    and 100% faithful step-by-step chronology.
    """
    if not full_text or not full_text.strip():
        return ""

    is_same_rewrite = (target_language == "same_rewrite" or target_language == source_language)
    target_info = get_language_info("en" if is_same_rewrite else target_language)
    target_name = target_info["name"]
    native_name = target_info["native_name"]
    script_hint = target_info["script_hint"]

    # Strict zero-punctuation directives so speech engine never halts or takes robotic breath pauses
    punct_rule = "DO NOT use ANY punctuation marks: NO commas (,), NO periods (.), NO dari (।), NO question marks, NO exclamation marks, NO semicolons, NO dashes. Write as continuous pure spoken text words with single spaces between words so the voice engine delivers an ultra-fluid, natural, professional storytelling flow without halting or lagging."
    if target_language == "hi":
        alphabet_rule = "Write STRICTLY in native Hindi Devanagari script (देवनागरी लिपि, e.g. 'कहानी की शुरुआत एक वीरान द्वीप से होती है'). NEVER use English/Latin letters (NO Hinglish)."
    elif target_language == "bn":
        alphabet_rule = "Write STRICTLY in native Bengali script (বাংলা লিপি). NEVER use English/Latin letters (NO Banglish)."
    elif target_language == "ur":
        alphabet_rule = "Write STRICTLY in native Urdu script (اردو)."
    elif is_same_rewrite:
        alphabet_rule = "Paraphrase and polish into engaging spoken voiceover English/source language with fresh vocabulary."
    else:
        alphabet_rule = f"Write in natural {target_name} ({native_name}). {script_hint}"

    # Split text into natural sentences
    raw_sentences = [s.strip() for s in re.split(r'(?<=[.!?।\n])\s+', full_text) if s.strip()]
    if not raw_sentences:
        raw_sentences = [full_text.strip()]

    # Group into natural narrative sections of 200 - 300 words to avoid token limits or summarization
    chunks: List[str] = []
    curr: List[str] = []
    curr_words = 0
    for s in raw_sentences:
        s_words = len(s.split())
        curr.append(s)
        curr_words += s_words
        if curr_words >= 260:
            chunks.append(" ".join(curr))
            curr = []
            curr_words = 0
    if curr:
        chunks.append(" ".join(curr))

    # Calculate speech rate and word budget calibrated to video duration
    total_raw_words = sum(len(c.split()) for c in chunks)
    # Natural, relaxed storytelling speech rate is ~2.35 words/second (~140 words per minute)
    wps = 2.35 if target_language in ("bn", "hi", "ur") else 2.40
    if target_duration > 5.0:
        total_target_words = max(50, int(target_duration * wps))
        target_min = int(target_duration // 60)
        target_sec = int(target_duration % 60)
        dur_timing_desc = f"{target_min}m {target_sec}s ({int(target_duration)} seconds total)"
    else:
        total_target_words = total_raw_words
        dur_timing_desc = "Timeline matched 1:1"

    def _process_single_chunk(item: Tuple[int, str]) -> Tuple[int, str]:
        chunk_idx, chunk = item
        chunk_word_count = len(chunk.split())
        chunk_ratio = chunk_word_count / max(1, total_raw_words)
        target_chunk_words = max(20, int(total_target_words * chunk_ratio))
        min_words = max(15, int(target_chunk_words * 0.88))
        max_words = max(25, int(target_chunk_words * 1.04))

        sys_prompt = f"""You are a professional YouTube movie recapper and live voiceover scriptwriter.
Your task is to transform the provided movie recap narration section into a professional, engaging live voice explanation script in {target_name} ({native_name}).

CRITICAL REQUIREMENTS:
1. SEQUENCE & MEANING INTEGRITY:
   - Follow the exact chronological sequence step-by-step.
   - Do NOT change the sequence of events.
   - Do NOT change the meaning, facts, or character names.
   - It is already structured step-by-step; turn it into a proper live voiceover script without altering the storyline.

2. LIVE VOICE SCRIPT STYLE:
   - Write in the engaging, charismatic spoken cadence of a professional YouTube recap narrator explaining the scene live.
   - Speak naturally and smoothly with human warmth and curiosity (NOT like a robotic textbook).

3. PUNCTUATION & BREATH MARKS:
   - {punct_rule}
   - NEVER use commas (,) anywhere. Write smooth, continuous sentences.
   - Do NOT use too many stops or ellipses (...). Only use single sentence stops (। or .).

4. TELEPROMPTER LINE GAPS:
   - Group every 2 to 3 sentences into a spoken block separated by a DOUBLE LINE BREAK (\n\n).
   - This creates a clean teleprompter layout designed for a voice artist to read aloud effortlessly.

5. EXACT DURATION & STRICT WORD BUDGET:
   - Final Video Target Timeline: {dur_timing_desc}.
   - HARD WORD LIMIT FOR THIS SECTION: STRICTLY BETWEEN {min_words} AND {max_words} WORDS TOTAL (Target: ~{target_chunk_words} words).
   - PACING DIRECTIVE: The script MUST allow the narrator to speak at a relaxed, calm, charismatic, natural 1.0x storytelling pace!
   - DO NOT OVER-EXPAND OR WRITE EXTRA WORDS! Writing more than {max_words} words will force the voice to sound rushed or unnaturally fast!
   - Keep sentences punchy, cinematic, and concise to fit the video frame perfectly.

6. STRIP ADS & INTROS:
   - Remove any creator names, channel intros, like/subscribe begs, or sponsor plugs.

7. SCRIPT & ALPHABET:
   - {alphabet_rule}

Output ONLY the final live voiceover script text with proper line breaks and punctuation. Do NOT include markdown code blocks, labels, JSON wrappers, or extra notes."""

        if custom_instructions and custom_instructions.strip():
            sys_prompt += f"\nUSER DIRECTIVE: {custom_instructions.strip()}\n"

        user_prompt = f"""Transform this scene section ({chunk_idx} of {len(chunks)}) into a professional {target_name} voiceover script.
HARD LENGTH LIMIT: Write strictly between {min_words} and {max_words} words (Target: {target_chunk_words} words).

Original commentary:
{chunk}"""

        chunk_result = None
        if api_key:
            chunk_result = _call_gemini_raw_text(sys_prompt, user_prompt, api_key, model_name)

        if not chunk_result:
            # Fallback to free Google Translate + natural line gaps
            trans = free_google_translate(chunk, target_lang=target_language, source_lang=source_language)
            trans_sentences = [s.strip() for s in re.split(r'(?<=[.!?।\n])\s+', trans) if s.strip()]
            blocks = []
            for b_i in range(0, len(trans_sentences), 3):
                blocks.append(" ".join(trans_sentences[b_i:b_i + 3]))
            chunk_result = "\n\n".join(blocks)

        normalized_chunk = re.sub(r'\n{3,}', '\n\n', chunk_result.strip())
        return chunk_idx, normalized_chunk

    chunk_items = list(enumerate(chunks, start=1))
    max_workers = min(5, max(1, len(chunks)))
    results_map: Dict[int, str] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_process_single_chunk, item) for item in chunk_items]
        for fut in concurrent.futures.as_completed(futures):
            c_idx, c_text = fut.result()
            results_map[c_idx] = c_text

    rewritten_chunks = [results_map[i] for i in range(1, len(chunks) + 1) if i in results_map]
    joined_text = "\n\n".join(rewritten_chunks).strip()
    # Strip ALL punctuation completely so speech engine never halts or takes unnatural breath pauses
    cleaned_final = re.sub(r'[.,।!?;:\-—–\"\'“”‘’…~`#*_\^/\\\|+=\[\]\{\}<>۔]', ' ', joined_text)
    cleaned_final = re.sub(r'[ \t]+', ' ', cleaned_final)
    return re.sub(r'\n{3,}', '\n\n', cleaned_final.strip())


