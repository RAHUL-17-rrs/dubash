# Dubash: doctor-patient interpreter (Gnani Great Indian AI Internship Challenge, due 2026-11-10 23:59 IST)

Live: https://dubash-seven.vercel.app (auto-deploys from GitHub main)

## Constraints
- Gnani API platform only (Inya Agent Builder out of scope). Synthetic data only. Evon not on API (self-host).
- Submission: demo video + write-up + models used + LinkedIn/X posts with #GnaniAI #GreatIndianAIInternshipChallenge.

## Done
- [x] Core libs: Gnani client (Prisma v3 STT w/ 2-language detection + keyterms, Timbre v3 TTS, voice clone), LLM (Evon or Claude), prompts
- [x] Dose lock (digits + English dose words) with retry-then-hold; tests in lib/medical.test.mjs
- [x] Holds: numbers drift, low confidence, clash with what the patient said earlier (allergy etc.)
- [x] Consult screen: split/rotated patient half, hands-free VAD + tap-to-talk, repeat button, red flags, back-translation
- [x] Teach-back, wrap-up note with turn citations, take-home slip + picture card + QR (/slip, data in URL fragment)
- [x] Zero-key scripted demo (12 turns), landing page, Playwright shots (scripts/shots.mjs), deployed

- [x] Branch `feat/features-motion` (not merged, not deployed): read-back, clarify-instead-of-guess, pinned patient facts,
      family turns, quick phrases, "didn't understand", speak-to-start, teach-back rounds, chemist line, ask-the-slip,
      strip check, returning-patient slip scan, Indic-digit dose lock; landing/consult motion per docs/research.md;
      README rewrite; docs/pitch.md

## Open (needs user)
- [ ] Run the new routes against real keys before merging: /api/detect, /api/simplify, /api/ask, /api/strip, and the new
      `facts` / `clarify` interpreter fields (exercised so far by the scripted demo, unit tests, and scripts/e2e-mock.mjs
      with stand-in providers; never with real Prisma / Timbre / LLM output)
- [ ] Native-speaker review of lib/phrases.js (fixed phrases in 9 languages)
- [ ] Rate-limit the API routes (Vercel firewall rule) before wider sharing
- [x] Set GNANI_API_KEY and OPENAI_API_KEY in Vercel; real consult tested end to end on the live site
- [x] Baked demo audio with Gnani Timbre (14 files)
- [ ] Native Telugu speaker review of lib/demo.js lines
- [ ] Verify cited stats (Delhi 75.2%/1.8%, 2026 preprint 33% vs 5%, JAMA IM 2019) before the write-up
- [ ] Test Hinglish patients in hands-free mode (language-based speaker detection may mislabel them)
- [ ] Record demo video, write-up, social posts

## Review
- Comparison with ~15 GitHub interpreter repos: closest is mohanpaineti/vaidyavaani (not Gnani, not tagged for this contest).
  Took from it/others: picture card, allergy-clash hold, QR take-home, repeat button, dose words.
