# Dubash: medical interpreter for Indian OPDs

One phone on the consultation table. Doctor speaks English/Hinglish, patient speaks one of 9 Indian languages.
Dubash hears who is speaking, interprets both ways, speaks to the patient in the doctor's own (cloned, consented) voice,
and checks every dose before it reaches the patient. Built on Gnani Prisma v3.0 (STT) + Timbre v3.0 / voice clone (TTS),
Evon v3.3 (self-hosted) or Claude for interpretation. Synthetic data only.

## Why (evidence: research/00-notes.md, research/01-contest-landscape.md)
- Staff/patient language mismatch: r/bangalore 1006-pt thread, r/hyderabad Telugu thread, PGI Punjabi classes.
- 75.2% of 500 Delhi patients could not read English; 1.8% fully knew their medicines.
- AI interpreting error risk: 33.3% clinical errors (AI) vs 4.8% (human) in 2026 preprint; JAMA 2019 "hold" mistranslation.
- No contest entry does doctor-patient interpreting (198 public repos checked).

## Features (priority order)
1. Live consult: split screen, patient half rotated 180deg. Hands-free VAD + push-to-talk per side.
2. Speaker by language: Prisma indic-auto; detected == patient language -> patient turn, else doctor.
3. Interpret: faithful, first person, spoken register, digits kept. Patient->doctor adds red flags.
4. Safety layer: dose lock (numbers in source must survive), plain-language rewrite of shorthand (hold, BD, SOS...),
   back-translation shown to doctor, low-confidence -> "please rephrase".
5. Doctor voice: 5-30 s consented sample -> Timbre voice-clone embedding -> doctor->patient audio in that voice.
6. Teach-back: patient retells plan in own language; per item understood/partial/missed + re-explain audio.
7. Wrap-up: English clinical note (each line cites source turn, code verifies), take-home parchi in patient language with audio.
8. Zero-key demo: scripted Telugu consult through same UI (+ baked audio when key exists).
9. Step latency chips (STT / interpret / voice).

## API routes (Next.js, Vercel, Node runtime)
- POST /api/turn   multipart: audio wav, patientLang, side?, context -> {speaker, lang, transcript, interp, checks, audio, ms}
- POST /api/speak  {text, lang, embedding?} -> audio
- POST /api/clone  multipart audio -> {embedding}
- POST /api/teachback {plan, audio|transcript, lang} -> {items, summary}
- POST /api/note   {turns, lang} -> {note, takeHome}
- GET  /api/status -> which providers are configured

## Env
GNANI_API_KEY, ANTHROPIC_API_KEY | (EVON_BASE_URL, EVON_API_KEY, EVON_MODEL), LLM_MODEL (optional)

## Out of scope (now)
Accounts, DB, telephony, streaming WS STT (needs non-Vercel relay), EHR/ABDM integration.
