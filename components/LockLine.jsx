// The dose lock, shown rather than described: one doctor sentence from the demo consult, the draft that lost a
// number, and the version that was allowed out. Numbers are boxed so the eye can follow each one down the page.
// Server component: the motion is CSS, started by the scroll reveal on the wrapper.
import { DEMO } from '@/lib/demo';
import { numberTokens } from '@/lib/medical';

const turn = DEMO.turns.find((t) => t.caught);
// The first sentence only: one instruction is enough to make the point.
const first = (s) => s.split(/(?<=\.)\s/)[0];
const source = first(turn.interp.plain_source);
const sent = first(turn.interp.translation);
// What the first draft did (see lib/demo.js): wrote the count as a word, so the digit vanished.
const draft = sent.replace('2 సార్లు', 'రెండు సార్లు');

function Line({ text, lang }) {
  return (
    <p lang={lang}>
      {text.split(/(\d+(?:[.\/-]\d+)*)/).map((part, n) =>
        n % 2 ? (
          <b key={n} className="num">
            {part}
          </b>
        ) : (
          part
        )
      )}
    </p>
  );
}

export default function LockLine() {
  const want = numberTokens(source);
  return (
    <figure className="lockline" data-reveal>
      <div className="ll-row">
        <span className="k">Doctor said</span>
        <Line text={source} lang="en" />
        <span className="ll-count">{want.length} numbers to carry</span>
      </div>
      <div className="ll-row bad">
        <span className="k">First draft</span>
        <Line text={draft} lang="te" />
        <span className="stamp">Lost a 2</span>
      </div>
      <div className="ll-row good">
        <span className="k">What Lakshmi heard</span>
        <Line text={sent} lang="te" />
        <span className="ll-count ok">{want.join(' · ')} all present</span>
      </div>
      <figcaption>
        The draft wrote “twice” as a Telugu word. To a reader that is fine; to a checker the digit is gone, so Dubash asked again before a single
        word was spoken. This is turn 12 of the scripted demo consult.
      </figcaption>
    </figure>
  );
}
