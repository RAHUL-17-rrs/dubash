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

## Open (needs user)
- [x] Set GNANI_API_KEY and OPENAI_API_KEY in Vercel; real consult tested end to end on the live site
- [x] Baked demo audio with Gnani Timbre (14 files)
- [ ] Native Telugu speaker review of lib/demo.js lines
- [ ] Verify cited stats (Delhi 75.2%/1.8%, 2026 preprint 33% vs 5%, JAMA IM 2019) before the write-up
- [ ] Test Hinglish patients in hands-free mode (language-based speaker detection may mislabel them)
- [ ] Record demo video, write-up, social posts

## Review
- Comparison with ~15 GitHub interpreter repos: closest is mohanpaineti/vaidyavaani (not Gnani, not tagged for this contest).
  Took from it/others: picture card, allergy-clash hold, QR take-home, repeat button, dose words.
