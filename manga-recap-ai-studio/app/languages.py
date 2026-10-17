# Central Multilingual Configuration & Voice Mapping for MangaRecap AI Studio

SUPPORTED_LANGUAGES = {
    "en": {
        "code": "en",
        "name": "English",
        "native_name": "English",
        "flag": "🇺🇸",
        "default_voice": "Charon",
        "script_hint": "Write in natural, engaging conversational English. Use natural pauses with ellipses (...) and em dashes (—).",
        "sample_text": "Welcome to Manga Recap Studio. I will be narrating your recap today with crisp cinematic presence.",
        "edge_voices": {
            "Christopher": "en-US-ChristopherNeural",
            "Guy": "en-US-GuyNeural",
            "Andrew": "en-US-AndrewNeural",
            "Ryan": "en-GB-RyanNeural"
        },
        "elevenlabs_voices": {
            "Adam": "pNInz6obpgDQGcFmaJgB",
            "George": "JBFqnCBsd6RMkjVDRZzb",
            "Marcus": "Id6i74XpY042K7R9yU2U",
            "Daniel": "onwK4e9ZLuTAKqWW03F9"
        }
    },
    "hi": {
        "code": "hi",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "flag": "🇮🇳",
        "default_voice": "Madhur",
        "script_hint": "Write in natural, spoken conversational Hindi (Devanagari script: हिन्दी). Use the tone of popular Hindi YouTube anime/manga recappers (e.g., 'यहाँ हम अपने मुख्य किरदार को देखते हैं...', 'लेकिन तभी कुछ ऐसा हुआ जिसने सबके होश उड़ा दिए...'). Do NOT use overly formal bookish Hindi.",
        "sample_text": "नमस्ते! मांगा रीकैप एआई स्टूडियो में आपका स्वागत है। मैं आपकी कहानी का रोमांचक रीकैप सुनाने के लिए तैयार हूँ।",
        "edge_voices": {
            "Madhur": "hi-IN-MadhurNeural",
            "Swara": "hi-IN-SwaraNeural"
        },
        "elevenlabs_voices": {
            "Prem": "TxGEqnHWrfWFTfGW9XjX",
            "Kabir": "ErXwobaYiN019PkySvjV",
            "Aditi": "21m00Tcm4TlvDq8ikWAM"
        }
    },
    "ur": {
        "code": "ur",
        "name": "Urdu",
        "native_name": "اردو",
        "flag": "🇵🇰",
        "default_voice": "Asad",
        "script_hint": "Write in natural, engaging Urdu (Urdu Nastaliq script: اردو). Use the expressive tone of YouTube storytellers (e.g., 'یہاں ہم دیکھتے ہیں کہ ہمارے مرکزی کردار کو...', 'لیکن تبھی اچانک ایک حیران کن موڑ آتا ہے...').",
        "sample_text": "خوش آمدید! مانگا ریکَیپ سٹوڈیو میں آپ کا خیرمقدم ہے۔ میں آپ کو اس کہانی کی سنسنی خیز داستان سناؤں گا۔",
        "edge_voices": {
            "Asad": "ur-PK-AsadNeural",
            "Uzma": "ur-PK-UzmaNeural"
        },
        "elevenlabs_voices": {
            "Kabir": "ErXwobaYiN019PkySvjV",
            "Prem": "TxGEqnHWrfWFTfGW9XjX"
        }
    },
    "bn": {
        "code": "bn",
        "name": "Bangla",
        "native_name": "বাংলা",
        "flag": "🇧🇩",
        "default_voice": "Pradeep",
        "script_hint": "Write in natural, expressive conversational Bangla (Bengali script: বাংলা). Use the captivating tone of popular Bengali storytellers and anime recappers (e.g., 'এখানে আমরা দেখতে পাচ্ছি আমাদের প্রধান চরিত্র...', 'কিন্তু তখনই ঘটল এমন এক অপ্রত্যাশিত ঘটনা যা সবকিছু পাল্টে দিল...'). Use clear Bengali spelling so speech synthesis is 100% natural.",
        "sample_text": "স্বাগতম! মাঙ্গা রিক্যাপ স্টুডিওতে আপনাকে স্বাগতম। এই রোমাঞ্চকর গল্পের প্রতিটি অধ্যায় আমি আপনাদের সামনে তুলে ধরব।",
        "edge_voices": {
            "Pradeep": "bn-BD-PradeepNeural",
            "Nabanita": "bn-BD-NabanitaNeural",
            "Bashkar": "bn-IN-BashkarNeural",
            "Tanishaa": "bn-IN-TanishaaNeural"
        },
        "elevenlabs_voices": {
            "Prem": "TxGEqnHWrfWFTfGW9XjX",
            "George": "JBFqnCBsd6RMkjVDRZzb"
        }
    },
    "es": {
        "code": "es",
        "name": "Spanish",
        "native_name": "Español",
        "flag": "🇪🇸",
        "default_voice": "Alvaro",
        "script_hint": "Write in engaging, dynamic Spanish (Español). Use the storytelling tone of Latin American & Spanish anime recappers (e.g., 'Aquí vemos a nuestro protagonista...', 'Pero en ese momento ocurre un giro inesperado...').",
        "sample_text": "¡Bienvenidos a Manga Recap Studio! Te narraré esta emocionante historia con todo el suspenso y acción.",
        "edge_voices": {
            "Alvaro": "es-ES-AlvaroNeural",
            "Elvira": "es-ES-ElviraNeural"
        },
        "elevenlabs_voices": {
            "Adam": "pNInz6obpgDQGcFmaJgB",
            "George": "JBFqnCBsd6RMkjVDRZzb"
        }
    },
    "ja": {
        "code": "ja",
        "name": "Japanese",
        "native_name": "日本語",
        "flag": "🇯🇵",
        "default_voice": "Keita",
        "script_hint": "Write in captivating, dramatic Japanese (Kanji/Kana: 日本語). Use standard manga recap narration phrasing (e.g., 'ここで主人公は...', 'しかしその瞬間、誰も予想しなかった衝撃の事実が明らかになる...').",
        "sample_text": "マンガ要約スタジオへようこそ！この物語の熱い展開と緊迫感を迫力ある声でお届けします。",
        "edge_voices": {
            "Keita": "ja-JP-KeitaNeural",
            "Nanami": "ja-JP-NanamiNeural"
        },
        "elevenlabs_voices": {
            "George": "JBFqnCBsd6RMkjVDRZzb",
            "Adam": "pNInz6obpgDQGcFmaJgB"
        }
    },
    "ko": {
        "code": "ko",
        "name": "Korean",
        "native_name": "한국어",
        "flag": "🇰🇷",
        "default_voice": "InJoon",
        "script_hint": "Write in exciting, high-tension Korean (Hangul: 한국어). Use manhwa recap YouTube storytelling style (e.g., '여기서 주인공은 심상치 않은 기운을 감지하는데요...', '하지만 그 순간, 믿을 수 없는 비밀이 밝혀집니다...').",
        "sample_text": "만화 리캡 스튜디오에 오신 것을 환영합니다! 긴장감 넘치는 스토리를 생생하게 전달해 드리겠습니다.",
        "edge_voices": {
            "InJoon": "ko-KR-InJoonNeural",
            "SunHi": "ko-KR-SunHiNeural"
        },
        "elevenlabs_voices": {
            "George": "JBFqnCBsd6RMkjVDRZzb",
            "Adam": "pNInz6obpgDQGcFmaJgB"
        }
    },
    "id": {
        "code": "id",
        "name": "Indonesian",
        "native_name": "Bahasa Indonesia",
        "flag": "🇮🇩",
        "default_voice": "Ardi",
        "script_hint": "Write in natural, engaging Bahasa Indonesia (e.g., 'Di sini kita melihat sang karakter utama...', 'Namun tiba-tiba terjadi sesuatu yang sangat mengejutkan...').",
        "sample_text": "Selamat datang di Manga Recap Studio! Saya akan menceritakan kisah epik ini dengan penuh ketegangan.",
        "edge_voices": {
            "Ardi": "id-ID-ArdiNeural",
            "Gadis": "id-ID-GadisNeural"
        },
        "elevenlabs_voices": {
            "Adam": "pNInz6obpgDQGcFmaJgB",
            "George": "JBFqnCBsd6RMkjVDRZzb"
        }
    },
    "pt": {
        "code": "pt",
        "name": "Portuguese",
        "native_name": "Português",
        "flag": "🇧🇷",
        "default_voice": "Antonio",
        "script_hint": "Write in natural, immersive Portuguese (Português) with great narrative flow.",
        "sample_text": "Bem-vindos ao Manga Recap Studio! Vou narrar esta história incrível com todo o ritmo e suspense.",
        "edge_voices": {
            "Antonio": "pt-BR-AntonioNeural",
            "Francisca": "pt-BR-FranciscaNeural"
        },
        "elevenlabs_voices": {
            "Adam": "pNInz6obpgDQGcFmaJgB",
            "George": "JBFqnCBsd6RMkjVDRZzb"
        }
    },
    "fr": {
        "code": "fr",
        "name": "French",
        "native_name": "Français",
        "flag": "🇫🇷",
        "default_voice": "Denise",
        "script_hint": "Write in stylish, cinematic French (Français) with natural third-person recapper commentary.",
        "sample_text": "Bienvenue sur Manga Recap Studio ! Je vais vous raconter cette histoire captivante avec tout le suspense nécessaire.",
        "edge_voices": {
            "Denise": "fr-FR-DeniseNeural"
        },
        "elevenlabs_voices": {
            "Adam": "pNInz6obpgDQGcFmaJgB",
            "George": "JBFqnCBsd6RMkjVDRZzb"
        }
    },
    "de": {
        "code": "de",
        "name": "German",
        "native_name": "Deutsch",
        "flag": "🇩🇪",
        "default_voice": "Amala",
        "script_hint": "Write in suspenseful, engaging German (Deutsch) suitable for anime/manga recap videos.",
        "sample_text": "Willkommen bei Manga Recap Studio! Ich werde diese packende Geschichte mit tiefer Spannung für euch erzählen.",
        "edge_voices": {
            "Amala": "de-DE-AmalaNeural"
        },
        "elevenlabs_voices": {
            "Adam": "pNInz6obpgDQGcFmaJgB",
            "George": "JBFqnCBsd6RMkjVDRZzb"
        }
    },
    "ar": {
        "code": "ar",
        "name": "Arabic",
        "native_name": "العربية",
        "flag": "🇸🇦",
        "default_voice": "Hamed",
        "script_hint": "Write in modern expressive Arabic (العربية) with gripping storytelling pacing.",
        "sample_text": "أهلاً بكم في استودیو تلخيص المانجا! سأروي لكم هذه القصة المشوقة بكل حماس وإثارة.",
        "edge_voices": {
            "Hamed": "ar-SA-HamedNeural",
            "Zariyah": "ar-SA-ZariyahNeural"
        },
        "elevenlabs_voices": {
            "George": "JBFqnCBsd6RMkjVDRZzb",
            "Adam": "pNInz6obpgDQGcFmaJgB"
        }
    }
}

# Standard Google Gemini Studio voices (support all languages natively)
GEMINI_MULTILINGUAL_VOICES = {
    "Charon": "Charon (Deep Recapper - Recommended)",
    "Puck": "Puck (Energetic Storyteller)",
    "Kore": "Kore (Clear Narrative Female)",
    "Fenrir": "Fenrir (Intense Suspense)",
    "Aoede": "Aoede (Dramatic Female)"
}

def get_language_info(lang_code: str) -> dict:
    code = (lang_code or "en").lower().strip()
    return SUPPORTED_LANGUAGES.get(code, SUPPORTED_LANGUAGES["en"])

def get_sample_text(lang_code: str) -> str:
    info = get_language_info(lang_code)
    return info.get("sample_text", SUPPORTED_LANGUAGES["en"]["sample_text"])

def get_edge_voice_for_language(lang_code: str, voice_name: str = "") -> str:
    info = get_language_info(lang_code)
    edge_map = info.get("edge_voices", {})
    if voice_name in edge_map:
        return edge_map[voice_name]
    # Return first available edge voice for that language
    if edge_map:
        return next(iter(edge_map.values()))
    return "en-US-ChristopherNeural"
