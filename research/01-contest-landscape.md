# Contest landscape (public GitHub, 2026-11-06, ~198 repos created since 2026-09-25)

Method: gh search repos for gnani / prisma timbre / vachana / challenge name. Private repos and LinkedIn-only entries not visible.

## Crowded (skip)
- Customer-support voicebots (10+, many are a "VoiceOps 2026" capstone)
- Kirana/shop ledgers + orders (7): kirana-voice-orders, kirana-khata, ugharani, taulsaathi, ShopEase, bolo-bill, bharat-bazaar-voiceos
- Govt schemes / forms / civic (9): Bolo, Sureword, Kaagaz-Saathi, janvaani, siddha, kural, sarkari-saathi, gnani-voice-helpline, dhwani-desk
- Farmers (5): kisan_setu, Gnani-Agri-Voice, KIsan-Saathi, RYTHULEKA_AI, Kotha
- Health intake/triage/ASHA/EMR (9): AarogyaVoice, Dhanvantari, MediVoice, MediSaarthi, DiagnoAssist, SwasthyaGrid, AshaSathi, ashavoice-ai, AyuSwar (dev.to, OPD scribe Telugu)
- Post-discharge follow-up: DischargeSaathi (overlaps "voice prescription" idea)
- Scam shields (3): kavach, kavach-ai, scam-call-shield
- Tutors (4+): SpeakUp, akshara, reading-buddy, BhashaStudy

## Nearest to a doctor<->patient interpreter (none found doing it)
- maatu-gnani-ai: ride-app voice notes Kannada<->Telugu. Uses Sarvam Mayura for translation (competitor stack).
- intercom: same-language speech->text->speech for noisy sites, no translation.
- samvaad: deaf<->hearing bridge.

## Outside the contest (inspiration)
- No Barrier (US, medical speech-to-speech), Clinic Translator (flags low-confidence, asks to rephrase), Vocality Health (YC, EHR-integrated), Aida (iPad), Pocketalk/Google Translate conversation mode (split screen facing each other).
- India: Wockhardt (ElevenLabs, Hindi-English consult), Patient Square scribe (Sarvam), Vaani (offline translator, LinkedIn post), DataHealth AI (hackathon), eSanjeevani+Bhashini pilot.
- Evidence of risk: JAMA IM 2019 (UCSF) Google Translate discharge instructions, 2-8% potentially harmful errors, mostly from ambiguous source English ("hold the kidney medicine" -> "keep taking"). Preprint 2026: clinical error 33.3% AI vs 4.8% certified interpreter, worse for less common languages.

## Gnani feasibility for interpreter
- STT: Prisma v3.0 REST (<=30s clip, indic-auto language detect, codemix) per turn. Realtime WS needs server relay (browser WS cannot set X-API-Key-ID header; Vercel functions cannot hold WS).
- Translate: no Gnani translation API. Evon v3.3 open weights (HF gnani/gnani-evon-v3.3-30B-A3B, NOT gated, Apache-2.0, nemotron_h MoE ~60GB bf16) -> self-host on 1 GPU (vLLM). Fallback: hosted LLM.
- TTS: Timbre v3.0 REST/SSE, 13 voices x 10 langs, audio tags. Voice clone from <10s sample (doctor consents) -> patient hears doctor's own voice in Telugu.
