# Research — Dubash

Date: 2026-11-10. Method: one Playwright pass per site at 1440×900 (and 390×844 for the first batch), computed styles read
from the DOM, hero screenshots in `docs/refs/`. Scroll/hover motion was **not** traced; motion notes are limited to what the
tech fingerprint and the hero frame show. Rows marked † were not loaded here and come from a third-party article
(toimi.pro, "Top 10 Best Healthcare Website Designs 2026").

## Brief

| | |
|---|---|
| Business | Dubash: doctor-patient medical interpreter for Indian OPDs. Contest prototype (Gnani Great Indian AI Internship Challenge). |
| Offer | Nothing sold. One phone on the table, two-way interpreting in 10 languages, doctor's cloned voice, dose lock, teach-back, cited note + take-home slip. |
| Audience | Contest judges and LinkedIn/X viewers now; doctors posted outside their language region later. (inferred) |
| Adjectives | Careful, plain-spoken, grounded/local. (inferred from copy and CSS) |
| Primary CTA | "Watch a consult" → `/consult?demo=1`. Secondary: "Start a live consult". |
| Constraints | Deadline 2026-11-10 23:59 IST. `main` auto-deploys. Plain CSS, no animation libs, no CMS. 9 Indic scripts must render. Phone-first. Synthetic data only; claims must stay honest. |

## Where Dubash is today (`docs/refs/dubash-1440.png`)

- Split hero: 7/5, left copy, right tilted phone on a dark-green "table" card with a pink slip tucked under it.
- H1 89.6px Anek Latin, weight 700, tracking -1.79px, two lines in two widths of the same variable font
  (condensed ink line, expanded carbon-violet line). Body 20.8px.
- Page `#edf1e8` sage, ink `#1a1c2e`, button radius 8px.
- No motion, no canvas, no video. Page height 4365px, 4 `h2` sections.
- Weak points: the phone screen in the hero is empty (two blank halves), so the product's one idea is not visible above the
  fold; the lower sections are text-only cards; nothing moves, so the "turn" (hear → check → speak) is described, never shown.

## References

| Site | Why | Layout | Type | Colour | Motion / tech |
|---|---|---|---|---|---|
| **No Barrier** nobarrier.ai (direct competitor) | What the buyer expects from this category | Split hero, stock doctor-patient photo with floating chips ("English ⇄ 中文", "24/7 available"), logo strip directly under hero, 10 `h2`s, 6605px | Varela Round 60px/400, -1.6px; eyebrow in spaced caps | White, navy `#04289b`, pill buttons | Webflow, no GSAP, no canvas |
| **Pocketalk** pocketalk.com (competitor, hardware) | Category incumbent | Product-led hero, video, logo wall, press strip, 5594px | Whitney 56px/900 | White + cyan `#009de1` | WordPress, GSAP, 1 video |
| **Vocality Health** vocalityhealth.com (competitor) | Baseline "AI health SaaS" look to avoid | Centered hero, 4 sections, 2700px | Montserrat 60px/700 + Inter | White, blue `#155dfc`, 6px radius | Static |
| **Abridge** abridge.com (clinical AI, Pentagram identity†) | Best-in-class clinical AI brand | Full-bleed hero with white type over image, stat-led `h2`s ("100M+ Conversations"), list-left / evidence-card-right pattern, 9174px | Avantt 72px/500, -2.88px (4% tight); custom "Abridge Font" for display glyphs | Off-white `#f9f7f4`-ish cards, ink `#242220`, single red-orange accent on CTA and status dots | Webflow + GSAP + ScrollTrigger |
| **Gnani** gnani.ai (contest sponsor) | The judges' own taste | Full-viewport gradient light-burst hero that resolves into type, 12 `h2`s, 13272px | Gambarino serif 80px/400 display + Inter 14px body | `#f9fafb`, warm orange → violet → blue gradient | Webflow + GSAP + ScrollTrigger, 1 video |
| **Sarvam** sarvam.ai (India voice AI peer) | Indian-AI visual language that is not generic | Centered hero under an orange/blue glow, small kolam-style ornament above the eyebrow, logo marquee | Season Mix serif 64px/425, -1.6px + Matter sans + Matter Mono | White, saffron glow, ink `#1f1f1f`, full-pill buttons | Next-like build, 1 canvas, 3 videos |
| **Wispr Flow** wisprflow.ai (voice product, wildcard) | Shows speech as a visual object | Centered hero; a ribbon of live transcript text runs along a curved path through a waveform pill; boxed nav with segmented control | EB Garamond 96px/400, -2.88px, roman + italic on separate lines; Figtree 20px body; mono for labels | Cream `#ffffeb`, ink `#1a1a1a`, lilac `#f0d7ff` CTA with 1px ink border, deep green banner | Webflow + GSAP + ScrollTrigger, 1 canvas |
| **Granola** granola.ai (notes product, wildcard) | Product UI as the hero, paper feel | Split hero; real app window (notes being typed, "Transcribing" pill, call tiles) layered over collaged print-texture panels | Quadrant serif 86.4px/400, -1.73px; Melange sans 14px | White/warm grey, olive-green CTA | Next, 6 canvases, no GSAP |
| **Oscar** hioscar.com (health, editorial) | Warm, human healthcare at scale | Full-bleed family photo; giant wordmark set behind the serif H1; two pill CTAs | Custom serif 120px/400, -1.2px + grotesque sans | Cream `#f7f5eb`, brown-black `#1f0d05`, one electric blue | Next, no GSAP, no canvas |
| **Oura** ouraring.com (health, Awwwards HM†) | Calm, premium health | Split hero, object photo bleeding off the top edge, lots of empty cream | Editorial New 80px/300, -4px (5% tight) + Akkurat | Cream/peach, grey-brown ink, one blue pill CTA | Next, no GSAP |
| **Heureka Health** heureka.health (Awwwards nominee) | Doctor-facing B2B health | Long single column, 12 `h2`s, 13606px | Inter 40px/400 + Fragment Mono labels | White, navy `#133882` | Framer |
| **Neko Health**† nekohealth.com | CSSDA + FWA Site of the Day, Lovie Gold (per article) | Problem → scan → clinic → book | Restrained sans, generous leading | Teal `#009ec9` + coral `#f56151`, no gradients | WebGL particle overlays on video (did not load here: navigation timeout) |

Not captured: ektype.in (screenshot timed out waiting on fonts).

## Patterns to use

1. **Put the working product in the hero, mid-action** (Granola). Fill the empty phone with one real demo turn: doctor line
   in English on the violet half, Telugu on the green half, a dose chip, a red HELD stamp. Data already exists in `lib/demo.js`.
2. **Make speech a visible object** (Wispr Flow). One line travels: English in → numbers highlighted → Telugu out. This is
   the dose lock, shown rather than described. A CSS-only version is enough.
3. **Two-voice typography** (Wispr roman/italic; Dubash already does condensed/expanded). Keep it and extend it as a rule:
   condensed ink = doctor, expanded violet = product promise, Telugu green = patient. Use the same coding in every section.
4. **One accent, used only for meaning** (Abridge red dot, Oscar/Oura single blue). Stamp red appears only on held turns,
   never as decoration.
5. **Stat-led section headings** (Abridge "100M+ Conversations"). 75.2% / 1.8% / 33% vs 5% as display-size numerals with a
   one-line caption each, once the stats are verified.
6. **Tight display tracking at 4–5% of size** (Abridge -2.88/72, Oura -4/80, Wispr -2.88/96). Dubash is at 2%; the
   condensed line can go tighter.
7. **Mono labels for machine facts** (Sarvam, Heureka, Wispr). Latency chips, model names and turn numbers in a mono face
   separate "what the machine did" from "what people said".
8. **Local ornament, used once** (Sarvam's kolam mark). Dubash's equivalent already exists: the perforated pink slip.
   Use the perforation edge as the section divider.

## Patterns to avoid

- Stock doctor-patient photo with floating feature chips (No Barrier). Dubash is synthetic-data only; a photo of "real"
  patients also contradicts the footer.
- White + medical blue + Inter/Montserrat (Vocality, Heureka, No Barrier). Every competitor looks like this.
- Gradient light-burst hero (Gnani, Sarvam). It is the sponsor's and the peer's signature; copying it reads as imitation and
  adds a canvas/video cost for no message.
- Logo walls and "Trusted by" strips. Dubash has no customers; faking proof breaks the plain-spoken voice.
- Scroll-jacked or pinned long pages (Gnani 13k px, Heureka 13k px). Judges skim; current 4.3k px is an asset.
- Pill buttons with full radius. Every reference uses them; the 8px rubber-stamp rectangle is more distinctive.

## Opportunities (nobody in the set does this)

- **Show a refusal.** No competitor shows their product declining to speak. A HELD turn in the hero is the differentiator.
- **Scripts as equals.** No site sets an Indian script at display size beside Latin. The nav already has దుబాసి; a second
  H1 line or a rotating language word in Anek at full size would be unique in the category.
- **The page as a parchi.** Palette and slip metaphor already exist. Sections as stapled slips (perforation, carbon-copy
  violet, stamp) give a concept none of the references have.
- **Rotated half.** The 180° patient half is the product's most recognisable trait and is invisible on the landing page.
- **Sound.** A voice product with no audio on its landing page. One play button with the baked demo clip
  (`public/demo/t*.mp3`) beats any animation.
- **Honest limits section.** Already present ("Where Dubash should not work alone"); none of the competitors has one.

## Three directions

| | Concept | Hero | Cost |
|---|---|---|---|
| **A. The parchi** (recommended) | The whole page is an OPD slip: perforated dividers, carbon violet, rubber stamps | Phone filled with a live demo turn, HELD stamp lands once, play button for audio | Low: CSS only, existing tokens and demo data |
| B. The table | Top-down view of the consult table; phone in the middle, doctor copy reads upright, patient copy upside down | Page mirrors the rotated split screen | Medium: new layout, readability risk on the inverted half |
| C. The line | One sentence travels down the page through hear → check → speak, numbers locked in place while words change script | Typographic, no device | Medium-high: needs scroll-linked motion (GSAP ScrollTrigger) |

A keeps the existing concept and fixes its one real gap (empty hero phone, nothing shown working). B and C are stronger
portfolio pieces but are redesigns.

## Open questions

- Is the goal contest polish tonight or a post-contest redesign? Decides A versus B/C.
- Are the landing stats (75.2%, 1.8%, 33% vs 5%, JAMA 2019) verified? They are still open in `tasks/todo.md` and pattern 5
  makes them larger.
- Appetite for adding GSAP to a repo that is plain CSS today?
- Audio autoplay is blocked by browsers; is a tap-to-play clip in the hero acceptable?
- Native Telugu review of the demo lines before they become hero copy.
