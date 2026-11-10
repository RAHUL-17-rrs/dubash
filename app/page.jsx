import Link from 'next/link';
import HeroDevice from '@/components/HeroDevice';
import LockLine from '@/components/LockLine';
import Motion from '@/components/Motion';
import { DEMO } from '@/lib/demo';
import { LANGUAGES, dispense } from '@/lib/medical';

const hold = DEMO.turns.find((t) => t.text.includes('Hold the metformin'));
const natives = Object.entries(LANGUAGES).filter(([c]) => c !== 'en-IN');
const azithro = DEMO.note.take_home.medicines.find((m) => m.name.startsWith('Azithromycin'));

/* Motion map (transform and opacity only; all of it off under prefers-reduced-motion)
   hero     enter: copy rises in 4 staggered steps, table card settles from a slight tilt. Idle: phone replays the consult,
            language name rolls, HELD stamp thuds when the held turn comes round. Tap: hear the turn.
   why      scroll: heading, then the three facts, 90 ms apart.
   safety   scroll: the four "hold" steps draw down the rail one by one; lock line: draft row gets its stamp, then the
            good row's numbers light up. Guards rise in pairs. Hover: guard rule turns carbon.
   how      scroll: four steps left to right. Hover: step number fills.
   home     scroll: four slips drop in with alternating tilt. Hover: slip straightens.
   limits   scroll: one quiet rise. Nothing else moves; this is the section that should feel still. */

export default function Home() {
  return (
    <main className="land">
      <Motion />
      <header className="top">
        <Link href="/" className="mark">
          Dubash <span lang="te">దుబాసి</span>
        </Link>
        <nav aria-label="Main">
          <a href="#safety">Safety</a>
          <a href="#how">How it works</a>
          <a href="#home">After the visit</a>
          <Link href="/consult?demo=1" className="btn small">
            Watch a consult
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>
            <span className="h1-a">A medical interpreter</span> <span className="h1-b">for every OPD table</span>
          </h1>
          <p className="lede">
            Put one phone between doctor and patient. Dubash hears who is speaking, interprets both ways in ten Indian languages, and will not
            pass on a dose it cannot verify.
          </p>
          <p className="langroll" aria-label={`Patient languages: ${natives.map(([, l]) => l.name).join(', ')}`}>
            <span className="k">English ⇄</span>
            <span className="roll" aria-hidden="true">
              <span className="roll-in" style={{ '--n': natives.length }}>
                {[...natives, natives[0]].map(([code, l], n) => (
                  <span key={n} lang={code.slice(0, 2)}>
                    {l.native}
                  </span>
                ))}
              </span>
            </span>
          </p>
          <div className="cta">
            <Link className="btn" href="/consult?demo=1">
              Watch a consult
            </Link>
            <Link className="btn ghost" href="/consult">
              Start a live consult
            </Link>
          </div>
          <p className="fine">Gnani Prisma v3.0 hears. Timbre v3.0 speaks, in the doctor’s own voice if they choose. Every person and case on this site is synthetic.</p>
        </div>
        <HeroDevice />
      </section>

      <section className="why" aria-labelledby="why-h">
        <h2 id="why-h" data-reveal>
          Doctors get posted far from home. Their patients don’t move.
        </h2>
        <p className="why-sub" data-reveal>
          A doctor from Kochi runs an OPD in Nalgonda. A resident from Patna covers night duty in Bengaluru. The consult happens anyway, through a
          relative, a ward boy, or guesswork.
        </p>
        <dl className="facts" data-reveal="stagger">
          <div>
            <dt>75.2%</dt>
            <dd>of 500 outpatients surveyed in Delhi could not read the English on their own prescription.</dd>
          </div>
          <div>
            <dt>1.8%</dt>
            <dd>of the same patients fully knew which medicines they were taking and how.</dd>
          </div>
          <div>
            <dt>33% vs 5%</dt>
            <dd>clinical errors from AI interpreting against certified human interpreters, in a 2026 preprint. Speed is easy. Being right is the job.</dd>
          </div>
        </dl>
      </section>

      <section className="hold" id="safety" aria-labelledby="hold-h">
        <h2 id="hold-h" data-reveal>
          “Hold the metformin” means <em>stop</em>. Translated word for word, it can come out as <em className="red">keep</em>.
        </h2>
        <p className="why-sub" data-reveal>
          A 2019 JAMA Internal Medicine study of machine-translated discharge notes traced its harmful errors mostly to ambiguous English like
          this. Dubash fixes the English before it translates anything.
        </p>
        <ol className="hold-steps" data-reveal="stagger">
          <li>
            <span className="k">Doctor says</span>
            <p className="en">{hold.text}</p>
          </li>
          <li>
            <span className="k">A literal tool hears</span>
            <p className="en struck">Keep holding on to the metformin if you are vomiting.</p>
          </li>
          <li>
            <span className="k">Dubash rewrites, and shows the doctor</span>
            <p className="en">{hold.interp.plain_source}</p>
          </li>
          <li>
            <span className="k">Lakshmi hears, in Telugu</span>
            <p className="te" lang="te">
              {hold.interp.translation}
            </p>
            <p className="back">Back to English, word for word: {hold.interp.back_translation}</p>
          </li>
        </ol>

        <h3 className="sub-h" data-reveal>
          Words may change. Numbers may not.
        </h3>
        <LockLine />

        <div className="guards" data-reveal="stagger">
          <article>
            <h3>Dose lock</h3>
            <p>
              Every number the doctor says must reach the patient unchanged: 500 mg, 1-0-1, 2 weeks. If one goes missing or appears from nowhere,
              Dubash retries once, then holds the turn for the doctor instead of speaking it. Numbers written in Hindi, Bengali or any other
              Indian digits count as the same numbers.
            </p>
          </article>
          <article>
            <h3>Read-back</h3>
            <p>
              A prescription is not spoken until the doctor has seen it as Dubash heard it: drug, strength, how often, how long. One tap to
              confirm. A misheard “15” for “50” matches itself in every language, so only the person who said it can catch it.
            </p>
          </article>
          <article>
            <h3>Plain words first</h3>
            <p>Hold, BD, SOS, taper, continue. Shorthand becomes what to do and when, before translation, and the doctor sees the rewrite.</p>
          </article>
          <article>
            <h3>It asks instead of guessing</h3>
            <p>
              When an instruction could mean two things, the held turn comes back with a question and both readings. The doctor taps the one
              they meant, the way they would answer a human interpreter.
            </p>
          </article>
          <article>
            <h3>Clashes stop the line</h3>
            <p>
              Lakshmi mentioned a rash after a penicillin injection. Ten minutes later the doctor prescribes amoxicillin. Dubash holds that turn
              unspoken and shows the doctor what she said. Allergies, current medicines and conditions stay pinned above the transcript for the
              whole consult, however long it runs.
            </p>
          </article>
          <article>
            <h3>Held means held</h3>
            <p>
              A held turn is never spoken, never counted in teach-back and never written on the take-home slip, unless the doctor sends it.
              The patient’s screen keeps the last thing they actually heard.
            </p>
          </article>
          <article>
            <h3>The patient can say “I didn’t follow”</h3>
            <p>
              One button on their half, in their script. Dubash says the last instruction again in shorter, plainer sentences, slower, and the
              simpler wording passes the same dose lock before it is spoken.
            </p>
          </article>
          <article>
            <h3>The slip is checked too</h3>
            <p>
              Every dose, count and day on the clinical note and the slip must have been said in the turn it cites. If the slip says 2 times
              where the doctor said 3, the doctor sees it before printing.
            </p>
          </article>
          <article className="wide">
            <h3>Teach-back, until it sticks</h3>
            <p>
              Before the patient leaves, they say the plan back in their own words. Dubash marks every instruction understood, partly understood or
              missed, and re-explains the gaps in the doctor’s voice. In the demo consult, Lakshmi gets her tablets right and misses the kidney test,
              the vomiting rule and her return date. That is the normal case, and nobody would have known. Then Dubash asks again, only about what
              was missed, one short question at a time if that is easier, and the score goes on the clinical note.
            </p>
          </article>
        </div>
      </section>

      <section className="how" id="how" aria-labelledby="how-h">
        <h2 id="how-h" data-reveal>
          One turn, one round trip
        </h2>
        <ol className="pipe" data-reveal="stagger">
          <li>
            <span className="n">1</span>
            <h3>Prisma v3.0 hears</h3>
            <p>
              Listens for English and the patient’s language only, so the detected language says who spoke. 172 Indian drug names and OPD terms are
              passed as keyterms, and spoken numbers come back as digits. Not sure of the language? The patient says anything and Prisma names it.
            </p>
          </li>
          <li>
            <span className="n">2</span>
            <h3>Interpret and check</h3>
            <p>
              OpenAI GPT-4.1 here; Gnani’s open Evon v3.3 when self-hosted. Plain-language rewrite, translation, back-translation, red flags,
              then the dose lock in code. Six everyday questions skip the model entirely: fixed wording, one tap.
            </p>
          </li>
          <li>
            <span className="n">3</span>
            <h3>Timbre speaks</h3>
            <p>Timbre v3.0 voices speak all ten languages. With consent, a 10-second sample clones the doctor’s voice, so the patient hears their doctor.</p>
          </li>
          <li>
            <span className="n">4</span>
            <h3>Wrap-up</h3>
            <p>
              An English note where every line cites the turn it came from. A take-home slip in the patient’s language that reads itself aloud, a
              picture card for patients who cannot read, and a QR code the family scans at home.
            </p>
          </li>
        </ol>
      </section>

      <section className="home" id="home" aria-labelledby="home-h">
        <h2 id="home-h" data-reveal>
          The consult ends. The slip keeps working.
        </h2>
        <p className="why-sub" data-reveal>
          Most of what goes wrong with a prescription goes wrong at the chemist’s counter and at the kitchen table. The slip carries its own
          data inside the QR code, so it can help in both places without a patient record on any server.
        </p>
        <div className="slips" data-reveal="stagger">
          <article>
            <span className="tab">At home</span>
            <h3>Ask the slip</h3>
            <p>
              “Which one after food?” The family asks aloud in their own language and hears the answer. It comes only from the slip; if the
              answer is not printed there, or contains a number that is not, Dubash says “ask your doctor” and nothing else.
            </p>
            <p className="eg" lang="te">
              {azithro.name}: {azithro.how}
            </p>
          </article>
          <article>
            <span className="tab">At home</span>
            <h3>Check the strip</h3>
            <p>
              Photograph the pack. A vision model reads the print; code decides whether the name and strength match the slip. Metformin 850 in
              the hand when the slip says 500 is a red cross, not a guess.
            </p>
            <p className="eg">
              <span className="verdict no" aria-hidden>
                ✕
              </span>{' '}
              850 mg is not 500 mg
            </p>
          </article>
          <article>
            <span className="tab">At the chemist</span>
            <h3>A line for the counter</h3>
            <p>
              Under the patient’s language, the same medicines in English with the quantity worked out in code: tablets a day times days. A
              3-day course leaves the shop as 3 tablets.
            </p>
            <p className="eg">
              {azithro.name} · {dispense(azithro).perDay} a day × {dispense(azithro).days} days = give {dispense(azithro).total}
            </p>
          </article>
          <article>
            <span className="tab">Next visit</span>
            <h3>Scan it, and Dubash remembers</h3>
            <p>
              The next doctor scans the old slip. Last visit’s medicines and the penicillin allergy are pinned before the first word, and the
              clash check covers them. Continuity, with nothing stored.
            </p>
            <p className="eg">Allergy: Penicillin · last visit</p>
          </article>
        </div>
      </section>

      <section className="limits" aria-labelledby="lim-h">
        <h2 id="lim-h" data-reveal>
          Where Dubash should not work alone
        </h2>
        <p data-reveal>
          Consent for surgery, bad news, mental-health crises and anything legal need a trained human interpreter. Dubash is for the everyday OPD
          consult that today gets no interpreter at all. The Telugu on this site, and the fixed phrases in all nine languages, are awaiting review
          by native speakers.
        </p>
      </section>

      <footer className="foot">
        <span>Dubash, built for the Great Indian AI Internship Challenge by Gnani.ai.</span>
        <span>Synthetic data only. No real patients, numbers or recordings.</span>
      </footer>
    </main>
  );
}
