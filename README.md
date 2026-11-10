# Dubash — a medical interpreter for Indian OPDs

> *Dubash* (दुभाषिया): the interpreter who stands between two people who don't share a language.

**Live demo:** https://dubash-seven.vercel.app · Built for the **Gnani Great Indian AI Internship Challenge** · #GnaniAI #GreatIndianAIInternshipChallenge
**One-page pitch:** [docs/pitch.md](docs/pitch.md) · **Design research:** [docs/research.md](docs/research.md)

One phone lies on the consultation table. The doctor speaks English or Hinglish; the patient speaks Telugu, Tamil,
Kannada, Hindi, Bengali, Malayalam, Marathi, Gujarati or Punjabi. Dubash listens, works out **who** spoke, interprets
both ways, says the doctor's words to the patient **in the doctor's own (cloned, consented) voice**, and **checks every
dose before it reaches the patient**. At the end it writes a cited clinical note and a take-home prescription slip
(a *parchi*) in the patient's language. The slip then keeps working after the visit: at home it answers the family's
questions and checks medicine packs against itself, and at the next visit it hands the doctor last time's medicines
and allergies.

**Try it in two minutes, no keys or microphone needed:** open the [live demo](https://dubash-seven.vercel.app), press
**Watch a consult**, then **Play all**. Watch for turn 9 (a prescription waits for read-back), turn 10 (held: penicillin
allergy), turn 12 (the dose lock catches a lost "2"), then teach-back (4 of 7, then 7 of 7 after "Ask again") and the
wrap-up slip.

---

## Contents
- [Why this exists](#why-this-exists)
- [What it does](#what-it-does)
- [How a turn works](#how-a-turn-works)
- [Safety layer](#safety-layer)
- [After the visit](#after-the-visit)
- [Models used](#models-used)
- [Tech stack and project layout](#tech-stack-and-project-layout)
- [Running locally](#running-locally)
- [Deploying to Vercel](#deploying-to-vercel)
- [API reference](#api-reference)
- [Testing](#testing)
- [What has and has not been verified](#what-has-and-has-not-been-verified)
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

(These figures are quoted from the sources listed in `research/`; re-checking each against its original is still an open
item in `tasks/todo.md`.)

## What it does

### In the room

| # | Feature | What happens |
|---|---|---|
| 1 | **Live consult screen** | Split screen: a green patient half (labelled in the patient's own script) and a blue doctor half. On a phone the patient half is rotated 180° so each person reads their own side across the table. Tap-to-talk on each side sends by itself when the speaker pauses; tapping a mic also cuts off Dubash if it is still talking. Hands-free mode detects voice automatically. |
| 2 | **Speaker by language** | Prisma v3.0 is given both languages (e.g. `en-IN,te-IN`) and reports which one it heard. The patient's language means the patient spoke; anything else is the doctor. No speaker-ID model needed. |
| 3 | **Speak to start** | Not sure which language the patient speaks? They say anything, Prisma (`indic-auto`) names the language, and the consult is set up in it. |
| 4 | **Faithful interpretation** | First person, spoken register, digits kept. Patient → doctor turns also surface **red flags** (chest pain, bleeding, pregnancy…). |
| 5 | **Safety layer** | Dose lock, read-back, plain-language rewrite of shorthand, back-translation, holds on low confidence or clashes with what the patient said earlier. [Details below.](#safety-layer) |
| 6 | **Read-back** | A turn that prescribes something is not spoken until the doctor has seen the drug, strength, frequency and duration as Dubash heard them, and tapped once. |
| 7 | **It asks instead of guessing** | When an instruction could mean two things, the held turn comes back with a question and both readings as buttons. The doctor taps the one they meant. |
| 8 | **Pinned patient facts** | Allergies, current medicines, conditions and pregnancy are pulled from what the patient says and stay pinned above the transcript ("Keep in mind"). The clash check reads this list, so it still works in a long consult after the allergy has scrolled out of the model's recent history. |
| 9 | **Family turns** | A son or daughter often speaks for the patient. One toggle on the patient's half marks the next turns as "Family", so they are interpreted as spoken ("my mother has…") and the note records who said what. |
| 10 | **Quick phrases** | Six everyday questions (since when, where does it hurt, fever, allergy, current medicines, say that again). Fixed wording in all nine languages: no model call, so nothing to mistranslate and nothing to wait for. |
| 11 | **"I didn't understand"** | A button on the patient's half, in their script. Dubash says the last instruction again in shorter, plainer sentences, slower. The simpler wording goes through the same dose lock; if a number moved, the original wording is replayed slowly instead. |
| 12 | **Doctor's own voice** | The doctor records 5–30 s of consented speech. Gnani's voice-clone endpoint turns it into a speaker embedding, and every doctor → patient line is spoken in that voice, in the patient's language. |
| 13 | **Teach-back, in rounds** | The patient retells the plan in their own words. Each plan item is marked understood / partial / missed / wrong and the gaps are re-explained with audio. Then **Ask again** re-checks only the missed items, or **Ask just this** has Dubash put one short question to the patient about one item. The score ("7 of 7 understood, round 2") goes on the clinical note. |
| 14 | **Wrap-up** | An English clinical note where **every line cites the turn it came from** (and code verifies the citations exist), plus a take-home slip in the patient's language (every number on both is checked against what was actually said): medicines, how to take them, tests, warning signs, next visit. It comes with audio, a picture card, a line for the chemist and a QR code. |
| 15 | **Zero-key demo** | A scripted 12-turn Telugu consultation runs through the exact same UI, with pre-baked Gnani voices, so anyone can try it without a microphone or keys. |
| 16 | **Latency chips, medicines so far, try again** | Each turn shows how long STT, interpretation and voice took. A running list shows every medicine prescribed so far, from released turns only. A failed turn keeps its audio; one tap re-sends it. |

### After the visit

| # | Feature | What happens |
|---|---|---|
| 17 | **Ask the slip** | The QR opens the slip on the family's phone. They can tap a medicine to hear its line, or ask a question by voice in their own language. The answer comes only from the slip; see [After the visit](#after-the-visit). |
| 18 | **Check the strip** | Photograph a medicine pack. A vision model reads the print; code decides whether the name and strength match the slip. |
| 19 | **A line for the chemist** | Under the patient's language, the same medicines in English with the quantity worked out in code (tablets a day × days), so a 3-day course leaves the shop as 3 tablets. |
| 20 | **Returning patient** | At the next visit the doctor scans (or pastes) the old slip. Last visit's medicines and the patient's allergies are pinned before the first word and feed the clash check. Nothing is stored anywhere: the data was in the QR all along. |

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
 └──────────────┘                              ▼                                  ▲
                                     ┌──────────────────────┐                     │
                                     │ Dose lock (code)     │── numbers drifted? ── retry once ── still wrong? ──▶ HOLD
                                     │ confidence / clashes │                     │                         (doctor decides)
                                     └──────────┬───────────┘                     │
                                                ▼                                 │
                                     prescribes a medicine? ── yes ──▶ READ-BACK ─┘ (doctor confirms, then it is spoken)
```

All of this happens in **one request** to `POST /api/turn`:

1. **STT**: audio goes to Prisma v3.0 with up to two language codes, ~170 medical **keyterms** (drug names, `BD`, `1-0-1`,
   `HbA1c`…), a topic hint and the previous utterance for context. `format=transcribe` makes spoken numbers come back as
   digits ("one tablet" → "1 tablet"), which the dose lock relies on. If v3.0 is busy (HTTP 429+), single-language turns fall back to Prisma v2.5.
2. **Speaker**: detected language == patient language → patient, otherwise doctor. Tap-to-talk fixes the side (doctor, patient or family).
3. **Interpret**: the LLM returns structured JSON with the translation, a plain-language rewrite of the doctor's
   shorthand, a back-translation, red flags, confidence, conflicts with earlier turns and with the pinned patient facts,
   any new patient facts, and (when unsure) a clarifying question with two readings.
4. **Check**: the dose lock compares numbers and dose words between source and translation (see below).
5. **Voice**: if the turn isn't held and doesn't need read-back, Timbre speaks it in the doctor's cloned voice (patient side)
   or a stock English voice (doctor side). If Timbre v3.0 is busy, it falls back to a per-language v2.5 voice.

## Safety layer

| Check | Rule | On failure |
|---|---|---|
| **Dose lock** | Every number and dose word in the source (`650`, `twice`, `1-0-1`, `5 days`) must appear in the translation, and nothing new may be invented. Native digits (`५००`, `৫০০`) are folded to ASCII first, so a correct Hindi or Bengali translation is not held by mistake. | One corrective retry that tells the model exactly what went missing or was invented. If it's still wrong, the turn is **held**. |
| **Read-back** | A doctor turn that names a medicine with a dose or frequency is shown back as a small table before it is spoken. The dose lock compares translation with transcript, so it cannot see a number the microphone misheard; the doctor can. | Not spoken until the doctor taps "Yes, say it". "No" discards it. |
| **Shorthand rewrite** | `hold`, `BD`, `TDS`, `OD`, `SOS`, `PRN`, `stat`, `NPO`, `taper`, `HS`… are expanded into plain words *before* translation. | The doctor sees the plain version and can correct it. |
| **Back-translation** | The translation is translated back to English and shown to the doctor. | The doctor spots meaning drift at a glance. |
| **Low confidence** | The model reports `confidence: low` on garbled or ambiguous input. | Held. Where the model can name the two readings, the doctor gets them as buttons instead of a bare "please rephrase". |
| **Clash** | The doctor's instruction contradicts something the patient said earlier, or a fact pinned from this or the last visit (e.g. prescribing amoxicillin after a penicillin allergy). | Held until the doctor decides. |
| **Simpler wording** | "I didn't understand" produces a simpler version of an instruction the patient already heard. | Dose-locked like any other translation; on failure the original audio is replayed slowly. |
| **Wrap-up grounding** | Every number the model writes into the clinical note or the take-home slip (doses, counts, days, review dates) must appear in the turns that line cites. Slip lines are checked against the note line for the same drug. Done in code (`lib/verify.js`), not by a second model call. | Flagged in red to the doctor ("Check before printing"), naming the number and the turn. |

A held turn is **never spoken to the patient**, never counted in teach-back and never written into the note or slip until the doctor explicitly releases it (the patient's screen keeps the last thing they actually heard), and nothing the model invents at wrap-up reaches the printed slip unflagged.

## After the visit

The slip is encoded in the URL fragment of its QR code, so opening it sends nothing to a server. The features on the
slip page send the slip along with each request and nothing is kept.

| Feature | How it stays safe |
|---|---|
| **Tap a medicine** | Reads that medicine's own line from the slip. No model is involved. |
| **Ask the slip** (`POST /api/ask`) | The model is told to answer only from the slip and to say when it cannot. Code then checks two things: the model said it found the answer, and every number in the answer is printed on the slip. If either fails, the family hears one fixed sentence in their language: "That is not on this slip. Please ask your doctor." |
| **Check the strip** (`POST /api/strip`) | The vision model only reads what is printed on the pack (brand, generic name, strength). `lib/slip.js` decides: match, same drug but different strength, not on the slip, or unreadable. The photo is not stored. |
| **Line for the chemist** | Computed from the picture-card counts in code (`dispense()` in `lib/medical.js`), never written by a model. Courses with no end date show "ongoing / as advised" rather than an invented total. |
| **Returning patient** | The slip's QR also carries the patient's allergies, conditions and pregnancy status as short English phrases. Scanning it at the next visit pins them, with last visit's medicines, and passes them to the clash check. |

## Models used

| Purpose | Model | Provider |
|---|---|---|
| Speech-to-text, language detection | **Prisma v3.0** (fallback **Prisma v2.5**) | Gnani Vachana API |
| Text-to-speech | **Timbre v3.0** (fallback **Timbre v2.5**) | Gnani Vachana API |
| Doctor's voice | **Vachana voice clone** (`vachana-vc-v1` + embeddings endpoint) | Gnani Vachana API |
| Interpretation, teach-back, clinical note, simpler wording, ask-the-slip | **OpenAI GPT** (`gpt-4.1` by default); also supports **Gnani Evon v3.3** self-hosted, or **Claude** | OpenAI / self-hosted / Anthropic |
| Reading a medicine pack | The same model with an image (OpenAI or Claude; a text-only self-hosted Evon returns 501 for this one route) | OpenAI / Anthropic |

The LLM is chosen by environment variables, in this priority: `EVON_BASE_URL` → `OPENAI_API_KEY` → `ANTHROPIC_API_KEY`.
Every call uses strict JSON-schema output, so the code never parses free text.

## Tech stack and project layout

- **Next.js 15** (App Router) + **React 19**, plain CSS, no UI framework, no animation library
- Node runtime API routes on **Vercel**
- No database: consult state lives in the browser, and the take-home slip is encoded in the URL fragment (it never touches the server)
- Motion is CSS plus one small IntersectionObserver component; only `transform` and `opacity` animate, and all of it is off under `prefers-reduced-motion`

```
app/
  page.jsx               landing page
  consult/page.jsx       live consult screen
  slip/page.jsx          take-home slip (opened from the QR code)
  api/
    turn/route.js        one consult turn: STT -> interpret + dose lock -> read-back or TTS
    speak/route.js       text -> audio (repeat button, re-explain, read-back confirm, quick phrases)
    clone/route.js       doctor's voice sample -> speaker embedding
    detect/route.js      "speak to start": which language is the patient speaking?
    simplify/route.js    "I didn't understand": simpler wording, dose-locked
    teachback/route.js   patient's retelling -> per-item understanding (first round, or only the missed items)
    note/route.js        whole consult -> cited clinical note + take-home slip
    ask/route.js         a question at home -> answer grounded in the slip, or "ask your doctor"
    strip/route.js       photo of a medicine pack -> match against the slip
    status/route.js      which providers are configured (booleans only, never keys)
components/
  Consult.jsx            the split-screen consult UI, setup screen, read-back, teach-back, wrap-up
  useMic.js              mic capture, voice activity detection, WAV encoding
  Slip.jsx, SlipPage.jsx take-home slip, picture card, chemist line, QR; ask-the-slip and strip check
  HeroDevice.jsx         landing-page phone that replays (and plays) the demo consult
  LockLine.jsx           landing-page illustration of the dose lock catching a lost number
  Motion.jsx             scroll reveals for the landing page
lib/
  gnani.js               Vachana API client (Prisma, Timbre, voice clone) with fallbacks
  llm.js                 provider-agnostic structured-output call (Evon / OpenAI / Claude), optional image
  prompts.js             prompts + JSON schemas: interpret, teach-back, note, simplify, ask, strip
  turn.js                interpret + dose lock + retry + hold / read-back decision
  medical.js             languages, voices, medical keyterms, shorthand, dose lock, chemist quantities
  phrases.js             fixed phrases in nine languages (quick phrases, button labels, "ask your doctor")
  demo.js                scripted Telugu consult for the zero-key demo
  slip.js                slip <-> URL fragment encoding, ask-the-slip grounding, strip matching
  verify.js              wrap-up grounding: numbers on note/slip must have been said in the cited turns
  *.test.mjs             unit tests (node --test)
scripts/
  bake-demo.mjs          generates the demo's audio with Gnani Timbre
  e2e-mock.mjs           every route, end to end, against local stand-ins for Gnani and the model
  shots.mjs              Playwright screenshots
public/demo/             baked demo audio
docs/                    spec, design research (with reference screenshots), one-page pitch
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

Open `/consult`, pick the patient's language (or let the patient speak), allow the microphone, and talk. `GET /api/status` tells you which providers the server can see.

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

The microphone and the camera need HTTPS, which Vercel provides. Every model-backed route sets `maxDuration = 60`.

## API reference

| Method & path | Body | Returns |
|---|---|---|
| `POST /api/turn` | multipart: `audio` (wav) or `text`, `patientLang`, `side` (`auto`/`doctor`/`patient`/`family`), `history` (JSON), `facts` (JSON array of pinned patient facts), `embedding` (JSON, optional), `voice` (`off` to skip TTS) | `{ speaker, lang, text, sttModel, interp, lock, hold, readback, ms: {stt, interpret, voice}, audio }`. `interp` now also carries `facts` and `clarify: { question, options }`. `audio` is null when the turn is held or awaits read-back. |
| `POST /api/speak` | `{ text, lang, embedding?, voice? }` | `audio/mpeg` |
| `POST /api/clone` | multipart: `audio` (5–30 s), `consent=yes` | `{ embedding: { embedding, shape, dtype } }` (kept in the browser, never stored) |
| `POST /api/detect` | multipart: `audio` | `{ text, lang, name }`; `lang` is null if the language is not one Dubash interprets |
| `POST /api/simplify` | `{ source, translation, patientLang }` | `{ translation, back_translation, simpler }`; `simpler: false` means the dose lock rejected the rewrite and the original is returned |
| `POST /api/teachback` | multipart: `instructions` (JSON), `audio` or `retelling`, `patientLang`, `items` (JSON, optional: only these items, for a later round) | `{ retelling, items: [{ status: understood/partial/missed/wrong, re_explain, ask, … }], summary_for_doctor }` |
| `POST /api/note` | `{ turns, patientLang, teachback? }` | `{ note, take_home, issues }`; citations to turns that don't exist are dropped, and each medicine/plan line carries `unsaid` (numbers not found in its cited turns) |
| `POST /api/ask` | multipart: `slip` (JSON), `lang`, `audio` or `question` | `{ question, found, answer, audio }`; when `found` is false, `answer` is the fixed "ask your doctor" sentence |
| `POST /api/strip` | multipart: `photo` (JPEG/PNG/WebP, 4 MB max), `medicines` (JSON) | `{ status: match/wrong_strength/not_on_slip/unreadable, med?, read? }` |
| `GET /api/status` | — | `{ gnani: boolean, llm: { name, model } \| null }` |

## Testing

```bash
node --test lib/*.test.mjs   # dose lock (incl. native digits), wrap-up grounding, slip encoding, chemist quantities,
                             # ask-the-slip grounding, strip matching, phrase coverage for all nine languages, prompts
npm run build                # production build
npm run shots                # Playwright screenshots of every screen (needs a running server)
```

End-to-end, every route, against local stand-ins for Gnani and the interpreter model (no keys, no network):

```bash
node scripts/e2e-mock.mjs serve      # terminal 1: stand-in Prisma, Timbre and chat-completions on :4010
GNANI_API_KEY=mock GNANI_BASE_URL=http://localhost:4010 OPENAI_API_KEY=mock OPENAI_BASE_URL=http://localhost:4010   npx next dev -p 3123               # terminal 2: the app, pointed at the stand-ins
BASE=http://localhost:3123 node scripts/e2e-mock.mjs   # terminal 3: the checks
```

It asserts, through the real routes: a plain turn is spoken at once; a prescription waits for read-back with no audio;
numbers lost twice hold the turn; an unsure turn comes back with two readings; a fact carried over from the last visit
stops a clashing prescription; family and hands-free turns are labelled; language detection; a simpler rewrite that
moves a number is discarded; teach-back round 2 checks only the missed items; ask-the-slip refuses an invented number;
a strip of the wrong strength is caught; bad uploads are rejected. `GNANI_BASE_URL` and `OPENAI_BASE_URL` exist only
for this; leave them unset in production.

## What has and has not been verified

Stated plainly, because this is a safety tool:

- **Verified in a browser (desktop 1440 px and phone 390 px), on the scripted demo:** read-back on prescribing turns, the
  penicillin hold, pinned patient facts, the dose-lock catch, teach-back round 1 and round 2, the wrap-up note and slip,
  the chemist line, the QR carrying the allergy, the slip page, tapping a medicine, the "ask your doctor" fallback, loading a
  returning patient's slip, quick phrases, no horizontal overflow on a phone, and that reduced-motion leaves nothing hidden.
- **Verified by unit tests:** every code-side check listed under [Testing](#testing).
- **Verified end to end against stand-in providers** (`scripts/e2e-mock.mjs`, routes and UI): read-back confirm and
  discard, clarify buttons, a clash with a fact from the last visit's slip, "I didn't understand", family turns, language
  detection, teach-back round 2, ask-the-slip (answered, refused, invented number replaced), and the strip check. This
  proves the wiring, the schemas and every decision made in code.
- **Not yet run against real models:** what Prisma, Timbre and the interpreter actually return for the newest routes
  (`/api/detect`, `/api/simplify`, `/api/ask`, `/api/strip`) and for the new `facts` and `clarify` fields. The stand-ins
  answer the way the prompts ask; real models may not, so run one session with real Gnani and LLM keys before relying on them.
- **Awaiting native-speaker review:** the Telugu demo script and the fixed phrases in all nine languages (`lib/phrases.js`).

## Limitations and out of scope

- **Not a medical device.** This is a challenge prototype built and tested on **synthetic data only**. It is not for real patients without clinical validation.
- Read-back, the dose lock and the pinned facts reduce errors; they do not make the doctor's judgement optional.
- Language-based speaker detection can mislabel a patient who speaks Hinglish/English; tap-to-talk per side avoids this.
- The API routes have no authentication or rate limiting yet. Before any wider use, put a rate limit in front of them (a Vercel firewall rule is enough).
- QR scanning on the setup screen uses the browser's `BarcodeDetector` (Android Chrome and others); elsewhere the doctor pastes the slip link.
- Strip checking results and their explanations are shown in English, with a tick or a cross.
- Out of scope for now: accounts, a database, telephony, streaming (WebSocket) STT, EHR/ABDM integration.
