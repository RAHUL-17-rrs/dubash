# Dubash — a medical interpreter for Indian OPDs

> *Dubash* (दुभाषिया): the interpreter who stands between two people who don't share a language.

**Live demo:** https://dubash-seven.vercel.app · Built for the **Gnani Great Indian AI Internship Challenge** · #GnaniAI #GreatIndianAIInternshipChallenge

One phone lies on the consultation table. The doctor speaks English or Hinglish; the patient speaks Telugu, Tamil,
Kannada, Hindi, Bengali, Malayalam, Marathi, Gujarati or Punjabi. Dubash listens, works out **who** spoke, interprets
both ways, says the doctor's words to the patient **in the doctor's own (cloned, consented) voice**, and **checks every
dose before it reaches the patient**. At the end it writes a cited clinical note and a take-home prescription slip
(a *parchi*) in the patient's language, with audio and a QR code.

---

## Contents
- [Why this exists](#why-this-exists)
- [What it does](#what-it-does)
- [How a turn works](#how-a-turn-works)
- [Safety layer](#safety-layer)
- [Models used](#models-used)
- [Tech stack and project layout](#tech-stack-and-project-layout)
- [Running locally](#running-locally)
- [Deploying to Vercel](#deploying-to-vercel)
- [API reference](#api-reference)
- [Testing](#testing)
- [Limitations and out of scope](#limitations-and-out-of-scope)

---

## Why this exists

- In Indian outpatient departments the doctor and patient often don't share a language: a Delhi-trained doctor in a
  Hyderabad OPD, or a Telugu-speaking patient in Bengaluru. Family members or ward staff end up interpreting, often badly.
- In one survey of 500 Delhi patients, **75.2% could not read English** (the language prescriptions are written in) and
  only **1.8% fully understood their medicines**.
- Machine interpretation in medicine fails in the worst places: numbers and shorthand. The classic example is *"hold
  the medicine"* (meaning *stop*) being read as *keep taking it*. A 2026 preprint found that general-purpose AI interpreting
  made clinically significant errors about **33%** of the time, compared with about **5%** for human interpreters.

Dubash is built around that failure mode. It doesn't just translate; it refuses to pass a turn on when the numbers don't survive.

## What it does

| # | Feature | What happens |
|---|---|---|
| 1 | **Live consult screen** | Split screen. The patient's half is rotated 180°, so each person reads their own side across the table. Hands-free voice detection, or tap-to-talk on each side. |
| 2 | **Speaker by language** | Prisma v3.0 is given both languages (e.g. `en-IN,te-IN`) and reports which one it heard. The patient's language means the patient spoke; anything else is the doctor. No speaker-ID model needed. |
| 3 | **Faithful interpretation** | First person, spoken register, digits kept. Patient → doctor turns also surface **red flags** (chest pain, bleeding, pregnancy…). |
| 4 | **Safety layer** | Dose lock, plain-language rewrite of shorthand, back-translation, holds on low confidence or clashes with what the patient said earlier. [Details below.](#safety-layer) |
| 5 | **Doctor's own voice** | The doctor records 5–30 s of consented speech. Gnani's voice-clone endpoint turns it into a speaker embedding, and every doctor → patient line is spoken in that voice, in the patient's language. |
| 6 | **Teach-back** | The patient retells the plan in their own words. Each plan item is marked understood / partial / missed / wrong, and the missed parts are re-explained with audio. |
| 7 | **Wrap-up** | An English clinical note where **every line cites the turn it came from** (and code verifies the citations exist), plus a take-home slip in the patient's language (every number on both is checked against what was actually said): medicines, how to take them, tests, warning signs, next visit. It comes with audio, a picture card and a QR code that opens the slip on the patient's phone. |
| 8 | **Zero-key demo** | A scripted 12-turn Telugu consultation runs through the exact same UI, with pre-baked Gnani voices, so anyone can try it without a microphone or keys. |
| 9 | **Latency chips** | Each turn shows how long STT, interpretation and voice took. |
| 10 | **Medicines so far** | A running list of every medicine the doctor has prescribed, from released turns only, so a held prescription never shows up as given. |
| 11 | **Try again** | A turn that fails (network, provider busy) keeps its audio; one tap re-sends it instead of making the doctor repeat themselves. |

## How a turn works

```
 mic (VAD or tap)                                                            speaker
      │                                                                         ▲
      ▼                                                                         │
 ┌──────────────┐   transcript +    ┌──────────────────────┐   checked     ┌──────────────┐
 │ Gnani Prisma │ ─ detected lang ─▶│  Interpreter LLM     │ ─ translation▶│ Gnani Timbre │
 │   v3.0 STT   │                   │  (strict JSON schema)│               │  v3.0 / voice│
 │ keyterms,    │                   └──────────┬───────────┘               │  clone TTS   │
 │ topic, prev. │                              │                           └──────────────┘
 └──────────────┘                              ▼
                                     ┌──────────────────────┐
                                     │ Dose lock (code)     │── numbers drifted? ── retry once ── still wrong? ──▶ HOLD
                                     │ confidence / clashes │                                                     (doctor confirms)
                                     └──────────────────────┘
```

All of this happens in **one request** to `POST /api/turn`:

1. **STT**: audio goes to Prisma v3.0 with up to two language codes, ~200 medical **keyterms** (drug names, `BD`, `1-0-1`,
   `HbA1c`…), a topic hint and the previous utterance for context. `format=transcribe` makes spoken numbers come back as
   digits ("one tablet" → "1 tablet"), which the dose lock relies on. If v3.0 is busy (HTTP 429+), single-language turns fall back to Prisma v2.5.
2. **Speaker**: detected language == patient language → patient, otherwise doctor.
3. **Interpret**: the LLM returns structured JSON with the translation, a plain-language rewrite of the doctor's
   shorthand, a back-translation, red flags, confidence, and conflicts with earlier turns.
4. **Check**: the dose lock compares numbers and dose words between source and translation (see below).
5. **Voice**: if the turn isn't held, Timbre speaks it in the doctor's cloned voice (patient side) or a stock English voice
   (doctor side). If Timbre v3.0 is busy, it falls back to a per-language v2.5 voice.

## Safety layer

| Check | Rule | On failure |
|---|---|---|
| **Dose lock** | Every number and dose word in the source (`650`, `twice`, `1-0-1`, `5 days`) must appear in the translation, and nothing new may be invented. | One corrective retry that tells the model exactly what went missing or was invented. If it's still wrong, the turn is **held**. |
| **Shorthand rewrite** | `hold`, `BD`, `TDS`, `OD`, `SOS`, `PRN`, `stat`, `NPO`, `taper`, `HS`… are expanded into plain words *before* translation. | The doctor sees the plain version and can correct it. |
| **Back-translation** | The translation is translated back to English and shown to the doctor. | The doctor spots meaning drift at a glance. |
| **Low confidence** | The model reports `confidence: low` on garbled or ambiguous input. | Held, with a "please rephrase" prompt. |
| **Clash** | The doctor's instruction contradicts something the patient said earlier (e.g. prescribing amoxicillin after a penicillin allergy). | Held until the doctor decides. |

| **Wrap-up grounding** | Every number the model writes into the clinical note or the take-home slip (doses, counts, days, review dates) must appear in the turns that line cites. Slip lines are checked against the note line for the same drug. Done in code (`lib/verify.js`), not by a second model call. | Flagged in red to the doctor ("Check before printing"), naming the number and the turn. |

A held turn is **never spoken to the patient**, never counted in teach-back and never written into the note or slip until the doctor explicitly releases it (the patient's screen keeps the last thing they actually heard), and nothing the model invents at wrap-up reaches the printed slip unflagged.

## Models used

| Purpose | Model | Provider |
|---|---|---|
| Speech-to-text | **Prisma v3.0** (fallback **Prisma v2.5**) | Gnani Vachana API |
| Text-to-speech | **Timbre v3.0** (fallback **Timbre v2.5**) | Gnani Vachana API |
| Doctor's voice | **Vachana voice clone** (`vachana-vc-v1` + embeddings endpoint) | Gnani Vachana API |
| Interpretation, teach-back, clinical note | **OpenAI GPT** (`gpt-4.1` by default); also supports **Gnani Evon v3.3** self-hosted, or **Claude** | OpenAI / self-hosted / Anthropic |

The LLM is chosen by environment variables, in this priority: `EVON_BASE_URL` → `OPENAI_API_KEY` → `ANTHROPIC_API_KEY`.
Every call uses strict JSON-schema output, so the code never parses free text.

## Tech stack and project layout

- **Next.js 15** (App Router) + **React 19**, plain CSS, no UI framework
- Node runtime API routes on **Vercel**
- No database: consult state lives in the browser, and the take-home slip is encoded in the URL fragment (it never touches the server)

```
app/
  page.jsx               landing page
  consult/page.jsx       live consult screen
  slip/page.jsx          take-home slip (opened from the QR code)
  api/
    turn/route.js        one consult turn: STT -> interpret + dose lock -> TTS
    speak/route.js       text -> audio (repeat button, re-explain)
    clone/route.js       doctor's voice sample -> speaker embedding
    teachback/route.js   patient's retelling -> per-item understanding
    note/route.js        whole consult -> cited clinical note + take-home slip
    status/route.js      which providers are configured (booleans only, never keys)
components/
  Consult.jsx            the split-screen consult UI
  useMic.js              mic capture, voice activity detection, WAV encoding
  Slip.jsx, SlipPage.jsx take-home slip, picture card, QR
  HeroDevice.jsx         landing-page illustration
lib/
  gnani.js               Vachana API client (Prisma, Timbre, voice clone) with fallbacks
  llm.js                 provider-agnostic structured-output call (Evon / OpenAI / Claude)
  prompts.js             prompts + JSON schemas for interpret, teach-back, note
  turn.js                interpret + dose lock + retry + hold decision
  medical.js             languages, voices, medical keyterms, shorthand, dose lock
  demo.js                scripted Telugu consult for the zero-key demo
  slip.js                slip <-> URL fragment encoding
  verify.js              wrap-up grounding: numbers on note/slip must have been said in the cited turns
  *.test.mjs             unit tests (node --test)
scripts/
  bake-demo.mjs          generates the demo's audio with Gnani Timbre
  shots.mjs              Playwright screenshots
public/demo/             baked demo audio
docs/spec.md             product spec
```

## Running locally

**Requirements:** Node.js 20+ and a Gnani Vachana API key. An LLM key (OpenAI, Anthropic, or a self-hosted Evon endpoint) is needed for live mode; the scripted demo works without any keys.

```bash
git clone https://github.com/RAHUL-17-rrs/dubash.git
cd dubash
npm install
cp .env.example .env.local    # then fill in the keys
npm run dev                   # http://localhost:3000
```

`.env.local`:

```ini
GNANI_API_KEY=vach_...           # required for live mode (STT, TTS, voice clone)

# Interpreter model: set one
OPENAI_API_KEY=sk-...
OPENAI_MODEL=                    # optional, default gpt-4.1
ANTHROPIC_API_KEY=
LLM_MODEL=                       # optional Claude model override
EVON_BASE_URL=                   # self-hosted Gnani Evon (OpenAI-compatible vLLM); takes priority when set
EVON_API_KEY=
EVON_MODEL=
```

Open `/consult`, pick the patient's language, allow the microphone, and talk. `GET /api/status` tells you which providers the server can see.

Regenerate the demo audio after changing `lib/demo.js`:

```bash
GNANI_API_KEY=vach_... node scripts/bake-demo.mjs
```

## Deploying to Vercel

```bash
npx vercel link
npx vercel env add GNANI_API_KEY production
npx vercel env add OPENAI_API_KEY production
npx vercel --prod
```

The microphone needs HTTPS, which Vercel provides. `/api/turn` sets `maxDuration = 60`.

## API reference

| Method & path | Body | Returns |
|---|---|---|
| `POST /api/turn` | multipart: `audio` (wav) or `text`, `patientLang`, `side` (`auto`/`doctor`/`patient`), `history` (JSON), `embedding` (JSON, optional), `voice` (`off` to skip TTS) | `{ speaker, lang, text, sttModel, interp, lock, hold, ms: {stt, interpret, voice}, audio }` |
| `POST /api/speak` | `{ text, lang, embedding?, voice? }` | `audio/mpeg` |
| `POST /api/clone` | multipart: `audio` (5–30 s), `consent=yes` | `{ embedding: { embedding, shape, dtype } }` (kept in the browser, never stored) |
| `POST /api/teachback` | multipart: `instructions` (JSON), `audio` or `retelling`, `patientLang` | `{ retelling, items: [{ status: understood/partial/missed/wrong, re_explain, … }], summary_for_doctor }` |
| `POST /api/note` | `{ turns, patientLang, teachback? }` | `{ note, take_home, issues }`; citations to turns that don't exist are dropped, and each medicine/plan line carries `unsaid` (numbers not found in its cited turns) |
| `GET /api/status` | — | `{ gnani: boolean, llm: { name, model } \| null }` |

## Testing

```bash
node --test lib/*.test.mjs   # dose lock, wrap-up grounding, slip encoding
npm run build                # production build
npm run shots                # Playwright screenshots of every screen (needs a running server)
```

## Limitations and out of scope

- **Not a medical device.** This is a challenge prototype built and tested on **synthetic data only**. It is not for real patients without clinical validation.
- Language-based speaker detection can mislabel a patient who speaks Hinglish/English; tap-to-talk per side avoids this.
- The Telugu demo script would benefit from review by a native speaker.
- Out of scope for now: accounts, a database, telephony, streaming (WebSocket) STT, EHR/ABDM integration.
