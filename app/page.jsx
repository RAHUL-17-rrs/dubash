import Link from 'next/link';
import HeroDevice from '@/components/HeroDevice';
import { DEMO } from '@/lib/demo';

const hold = DEMO.turns.find((t) => t.text.includes('Hold the metformin'));

export default function Home() {
  return (
    <main className="land">
      <header className="top">
        <Link href="/" className="mark">
          Dubash <span lang="te">దుబాసి</span>
        </Link>
        <nav aria-label="Main">
          <a href="#safety">Safety</a>
          <a href="#how">How it works</a>
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
        <h2 id="why-h">Doctors get posted far from home. Their patients don’t move.</h2>
        <p className="why-sub">
          A doctor from Kochi runs an OPD in Nalgonda. A resident from Patna covers night duty in Bengaluru. The consult happens anyway, through a
          relative, a ward boy, or guesswork.
        </p>
        <dl className="facts">
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
        <h2 id="hold-h">
          “Hold the metformin” means <em>stop</em>. Translated word for word, it can come out as <em className="red">keep</em>.
        </h2>
        <p className="why-sub">
          A 2019 JAMA Internal Medicine study of machine-translated discharge notes traced its harmful errors mostly to ambiguous English like
          this. Dubash fixes the English before it translates anything.
        </p>
        <ol className="hold-steps">
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

        <div className="guards">
          <article>
            <h3>Dose lock</h3>
            <p>
              Every number the doctor says must reach the patient unchanged: 500 mg, 1-0-1, 2 weeks. If one goes missing or appears from nowhere,
              Dubash retries once, then holds the turn for the doctor instead of speaking it.
            </p>
          </article>
          <article>
            <h3>Plain words first</h3>
            <p>Hold, BD, SOS, taper, continue. Shorthand becomes what to do and when, before translation, and the doctor sees the rewrite.</p>
          </article>
          <article>
            <h3>Back-translation</h3>
            <p>Under every instruction, the doctor reads in English exactly what the patient is about to hear.</p>
          </article>
          <article>
            <h3>Clashes stop the line</h3>
            <p>
              Lakshmi mentioned a rash after a penicillin injection. Ten minutes later the doctor prescribes amoxicillin. Dubash holds that turn
              unspoken and shows the doctor what she said. Garbled or guessed turns are held the same way.
            </p>
          </article>
          <article className="wide">
            <h3>Teach-back</h3>
            <p>
              Before the patient leaves, they say the plan back in their own words. Dubash marks every instruction understood, partly understood or
              missed, and re-explains the gaps in the doctor’s voice. In the demo consult, Lakshmi gets her tablets right and misses the kidney test,
              the vomiting rule and her return date. That is the normal case, and nobody would have known.
            </p>
          </article>
        </div>
      </section>

      <section className="how" id="how" aria-labelledby="how-h">
        <h2 id="how-h">One turn, one round trip</h2>
        <ol className="pipe">
          <li>
            <span className="n">1</span>
            <h3>Prisma v3.0 hears</h3>
            <p>
              Listens for English and the patient’s language only, so the detected language says who spoke. 172 Indian drug names and OPD terms are
              passed as keyterms, and spoken numbers come back as digits.
            </p>
          </li>
          <li>
            <span className="n">2</span>
            <h3>Interpret and check</h3>
            <p>
              Gnani’s open Evon v3.3 when self-hosted, Claude otherwise. Plain-language rewrite, translation, back-translation, red flags, then the
              dose lock in code.
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
              picture card for patients who cannot read, and a QR code the family scans to hear it again at home.
            </p>
          </li>
        </ol>
      </section>

      <section className="limits" aria-labelledby="lim-h">
        <h2 id="lim-h">Where Dubash should not work alone</h2>
        <p>
          Consent for surgery, bad news, mental-health crises and anything legal need a trained human interpreter. Dubash is for the everyday OPD
          consult that today gets no interpreter at all. The Telugu on this site is awaiting review by a native speaker.
        </p>
      </section>

      <footer className="foot">
        <span>Dubash, built for the Great Indian AI Internship Challenge by Gnani.ai.</span>
        <span>Synthetic data only. No real patients, numbers or recordings.</span>
      </footer>
    </main>
  );
}
