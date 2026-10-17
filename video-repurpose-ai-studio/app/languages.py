# Central Multilingual & Voice Directory for VideoRepurpose AI Studio

SUPPORTED_LANGUAGES = {
    "auto": {
        "code": "auto",
        "name": "Auto-Detect Language",
        "native_name": "Automatic AI Detection",
        "flag": "🌐",
        "default_voice": "Christopher",
        "script_hint": "Auto-detect the spoken language from audio waveform and transcribe verbatim.",
        "sample_text": "Language will be automatically detected from the uploaded video.",
        "edge_voices": {
            "Christopher": "en-US-ChristopherNeural"
        },
        "elevenlabs_voices": {}
    },
    "same_rewrite": {
        "code": "same_rewrite",
        "name": "Same Language (100% Paraphrase & Rewrite)",
        "native_name": "Keep Language • Rewrite Style",
        "flag": "🔄",
        "default_voice": "Auto",
        "script_hint": (
            "Keep the commentary in the exact same language as the original audio, but completely rephrase, "
            "re-write, and restructure every sentence with fresh vocabulary, engaging pacing, and modern storytelling cadence "
            "to ensure zero copyright or plagiarism issues while maintaining identical story events."
        ),
        "sample_text": "This will retain the source language but rewrite every single line in a unique storytelling style.",
        "edge_voices": {},
        "elevenlabs_voices": {}
    },
    "en": {
        "code": "en",
        "name": "English",
        "native_name": "English",
        "flag": "🇺🇸",
        "default_voice": "Christopher",
        "script_hint": "Write in natural, engaging conversational English. Use natural pauses with ellipses (...) and em dashes (—).",
        "sample_text": "Welcome to Video Repurpose Studio. Today we are transforming and remastering this video with complete copyright protection.",
        "edge_voices": {
            "Christopher (Deep/Narrator)": "en-US-ChristopherNeural",
            "Guy (Expressive)": "en-US-GuyNeural",
            "Andrew (Storyteller)": "en-US-AndrewNeural",
            "Sonia (Female Narrative)": "en-GB-SoniaNeural",
            "Ryan (British Documentary)": "en-GB-RyanNeural"
        },
        "elevenlabs_voices": {
            "Adam (Deep Narration)": "pNInz6obpgDQGcFmaJgB",
            "George (Storyteller)": "JBFqnCBsd6RMkjVDRZzb",
            "Marcus (Cinematic)": "Id6i74XpY042K7R9yU2U",
            "Daniel (Broadcast)": "onwK4e9ZLuTAKqWW03F9"
        }
    },
    "hi": {
        "code": "hi",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "flag": "🇮🇳",
        "default_voice": "Madhur",
        "script_hint": (
            "Write in natural, spoken conversational Hindi (Devanagari script: हिन्दी). "
            "Use the tone of popular Hindi YouTube anime/movie recappers (e.g., 'यहाँ हम अपने मुख्य किरदार को देखते हैं...', "
            "'लेकिन तभी कुछ ऐसा हुआ जिसने सबके होश उड़ा दिए...'). Do NOT use overly formal bookish Hindi."
        ),
        "sample_text": "नमस्ते! वीडियो रीपर्पज स्टूडियो में आपका स्वागत है। मैं इस वीडियो को नए अंदाज़ और पूरी कॉपीराइट सुरक्षा के साथ रीकैप करूँगा।",
        "edge_voices": {
            "Madhur (Storyteller Male)": "hi-IN-MadhurNeural",
            "Swara (Expressive Female)": "hi-IN-SwaraNeural"
        },
        "elevenlabs_voices": {
            "Prem (Narrator)": "TxGEqnHWrfWFTfGW9XjX",
            "Kabir (Deep Storyteller)": "ErXwobaYiN019PkySvjV",
            "Aditi (Conversational)": "21m00Tcm4TlvDq8ikWAM"
        }
    },
    "ur": {
        "code": "ur",
        "name": "Urdu",
        "native_name": "اردو",
        "flag": "🇵🇰",
        "default_voice": "Asad",
        "script_hint": (
            "Write in natural, engaging Urdu (Urdu Nastaliq script: اردو). "
            "Use the expressive tone of YouTube storytellers (e.g., 'یہاں ہم دیکھتے ہیں کہ ہمارے مرکزی کردار کو...', "
            "'لیکن تبھی اچانک ایک حیران کن موڑ آتا ہے...')."
        ),
        "sample_text": "خوش آمدید! ویڈیو ریپَرپز اسٹوڈیو میں آپ کا خیرمقدم ہے۔ میں آپ کو ایک نئے اور شاندار انداز میں یہ کہانی سناؤں گا۔",
        "edge_voices": {
            "Asad (Deep Storyteller)": "ur-PK-AsadNeural",
            "Uzma (Expressive Female)": "ur-PK-UzmaNeural"
        },
        "elevenlabs_voices": {
            "Kabir (Narrator)": "ErXwobaYiN019PkySvjV",
            "Prem (Storyteller)": "TxGEqnHWrfWFTfGW9XjX"
        }
    },
    "bn": {
        "code": "bn",
        "name": "Bengali",
        "native_name": "বাংলা",
        "flag": "🇧🇩",
        "default_voice": "Pradeep",
        "script_hint": (
            "Write in natural, conversational Bengali (Bengali script: বাংলা). "
            "Use an engaging, storytelling YouTube tone (e.g., 'এখানে আমরা দেখতে পাচ্ছি আমাদের প্রধান চরিত্র...', "
            "'কিন্তু তখনই ঘটল এমন এক নাটকীয় ঘটনা যা সবকিছু বদলে দিল...')."
        ),
        "sample_text": "স্বাগতম! ভিডিও রিপারপাস এআই স্টুডিওতে আপনার স্বাগতম। এই ভিডিওটি সম্পূর্ণ নতুন কণ্ঠে এবং কপিরাইট-মুক্তভাবে তৈরি করা হচ্ছে।",
        "edge_voices": {
            "Pradeep (Male Recapper BD)": "bn-BD-PradeepNeural",
            "Nabanita (Female Recapper BD)": "bn-BD-NabanitaNeural",
            "Bashkar (Male Storyteller IN)": "bn-IN-BashkarNeural",
            "Tanishaa (Female Storyteller IN)": "bn-IN-TanishaaNeural"
        },
        "elevenlabs_voices": {
            "Kabir (Universal)": "ErXwobaYiN019PkySvjV"
        }
    },
    "es": {
        "code": "es",
        "name": "Spanish",
        "native_name": "Español",
        "flag": "🇪🇸",
        "default_voice": "Alvaro",
        "script_hint": "Write in natural, engaging conversational Spanish (Resumen / Recap YouTube tone).",
        "sample_text": "Hola a todos y bienvenidos a Video Repurpose Studio. Hoy vamos a transformar este video con narración cinematográfica.",
        "edge_voices": {
            "Alvaro (Narrator ES)": "es-ES-AlvaroNeural",
            "Elvira (Female ES)": "es-ES-ElviraNeural",
            "Jorge (Narrator MX)": "es-MX-JorgeNeural"
        },
        "elevenlabs_voices": {
            "Adam": "pNInz6obpgDQGcFmaJgB"
        }
    },
    "ja": {
        "code": "ja",
        "name": "Japanese",
        "native_name": "日本語",
        "flag": "🇯🇵",
        "default_voice": "Keita",
        "script_hint": "Write in natural, engaging conversational Japanese (アニメ解説・映画解説の語り口調).",
        "sample_text": "ようこそ！動画リパーパスAIスタジオへ。本日は完全著作権セーフなリメイク動画をお届けします。",
        "edge_voices": {
            "Keita (Male)": "ja-JP-KeitaNeural",
            "Nanami (Female)": "ja-JP-NanamiNeural"
        },
        "elevenlabs_voices": {}
    }
}


def get_language_info(lang_code: str) -> dict:
    if not lang_code:
        return SUPPORTED_LANGUAGES["en"]
    normalized = lang_code.lower().strip()
    return SUPPORTED_LANGUAGES.get(normalized, SUPPORTED_LANGUAGES["en"])


def get_all_languages_list() -> list[dict]:
    return [
        {
            "code": code,
            "name": data["name"],
            "native_name": data["native_name"],
            "flag": data["flag"],
            "default_voice": data["default_voice"]
        }
        for code, data in SUPPORTED_LANGUAGES.items()
    ]
