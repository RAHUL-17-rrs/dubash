'use client';
// Take-home slip in the patient's language, with a picture card for anyone who cannot read it:
// sunrise / sun / moon columns, drawn tablets (halves too), an empty or full plate for before / after food,
// and one box per day for courses that end.
import { LANGUAGES, dispense } from '@/lib/medical';

export default function Slip({ takeHome: h, lang, onListen, qr }) {
  return (
    <article className="slip" lang={lang.slice(0, 2)}>
      <div className="slip-head">
        <span>Dubash</span>
        {onListen && (
          <button className="btn small" onClick={onListen}>
            ▶ {LANGUAGES[lang]?.listen}
          </button>
        )}
      </div>
      <p className="slip-hi">{h.greeting}</p>
      <ul className="slip-meds">
        {h.medicines.map((m) => (
          <li key={m.name}>
            <strong>{m.name}</strong>
            <span>{m.how}</span>
            {m.why && <small>{m.why}</small>}
          </li>
        ))}
      </ul>
      {h.tests.length > 0 && (
        <ul className="slip-list">
          {h.tests.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {h.come_back_if.length > 0 && (
        <ul className="slip-list warn-list">
          {h.come_back_if.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      <p className="slip-next">{h.next_visit}</p>

      {h.medicines.some((m) => m.morning !== undefined) && <PillCard meds={h.medicines} />}
      {h.medicines.some((m) => m.morning !== undefined) && <Chemist meds={h.medicines} />}

      {qr && (
        <div className="slip-qr">
          <img src={qr} width="132" height="132" alt="QR code that opens this slip, with audio, on another phone" />
          <span lang="en">Scan with any phone at home: hear this slip again, ask it a question, or check a medicine pack against it.</span>
        </div>
      )}
    </article>
  );
}

function PillCard({ meds }) {
  return (
    <table className="pills" aria-label="Picture card: when to take each medicine">
      <thead>
        <tr>
          <th />
          <th>
            <Sunrise />
          </th>
          <th>
            <Sun />
          </th>
          <th>
            <Moon />
          </th>
          <th>
            <Plate full label="food" />
          </th>
          <th>
            <Calendar />
          </th>
        </tr>
      </thead>
      <tbody>
        {meds.map((m) => (
          <tr key={m.name}>
            <th scope="row">{m.name.split(' ')[0]}</th>
            {[m.morning, m.noon, m.night].map((c, i) => (
              <td key={i}>
                <Pills count={c} />
              </td>
            ))}
            <td>{m.food === 'any' ? null : <Plate full={m.food === 'after'} label={m.food === 'after' ? 'after food' : 'before food'} />}</td>
            <td>{m.days ? <Days n={Number(m.days)} /> : <span className="ongoing" title="Keep taking" />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The same slip, read by the person behind the pharmacy counter: English, and the quantity worked out in code
// from the picture-card counts (tablets a day x days), so a 5-day course is not handed over as one strip of 10 or of 3.
function Chemist({ meds }) {
  return (
    <table className="chemist" lang="en">
      <caption>For the chemist</caption>
      <thead>
        <tr>
          <th scope="col">Medicine</th>
          <th scope="col">A day</th>
          <th scope="col">Days</th>
          <th scope="col">Give</th>
        </tr>
      </thead>
      <tbody>
        {meds.map((m) => {
          const d = dispense(m);
          return (
            <tr key={m.name}>
              <th scope="row">{m.name}</th>
              <td>{d.perDay || '—'}</td>
              <td>{d.days || 'ongoing'}</td>
              <td>{d.total ?? 'as advised'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Pills({ count }) {
  const n = count?.includes('/') ? count.split('/').reduce((a, b) => a / b) : Number(count) || 0;
  if (!n) return <span className="none" aria-label="none" />;
  const whole = Math.floor(n);
  return (
    <span className="pillset" aria-label={`${count} tablet`}>
      {Array.from({ length: whole }, (_, i) => (
        <Pill key={i} />
      ))}
      {n - whole >= 0.5 && <Pill half />}
    </span>
  );
}

// A capsule reads as "medicine" to everyone; half a capsule is half a dose.
const Pill = ({ half }) => (
  <svg viewBox="0 0 30 16" width={half ? 16 : 30} height="16" aria-hidden="true">
    <rect x="1" y="1" width="28" height="14" rx="7" fill="#fff" stroke="#3a33a3" strokeWidth="1.6" />
    <path d="M8 1h7v14H8a7 7 0 0 1 0-14z" fill="#3a33a3" />
  </svg>
);

const Sunrise = () => (
  <svg viewBox="0 0 28 20" width="28" height="20" aria-label="morning">
    <path d="M6 16a8 8 0 0 1 16 0" fill="#f2a516" />
    <path d="M2 16h24M14 2v3M5 6l2 2M23 6l-2 2" stroke="#1a1c2e" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const Sun = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-label="afternoon">
    <circle cx="12" cy="12" r="5" fill="#f2a516" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="#1a1c2e" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-label="night">
    <path d="M16 3a9 9 0 1 0 5 13A7 7 0 0 1 16 3z" fill="#3a33a3" />
  </svg>
);
// Empty plate: before food. Plate with rice: after food.
const Plate = ({ full, label = 'food' }) => (
  <svg viewBox="0 0 34 22" width="34" height="22" aria-label={label}>
    {full && <path d="M8 14c0-7 18-7 18 0z" fill="#f2a516" stroke="#1a1c2e" strokeWidth="1.2" />}
    <ellipse cx="17" cy="16" rx="15" ry="4.5" fill="#fff" stroke="#1a1c2e" strokeWidth="1.6" />
    <ellipse cx="17" cy="15.6" rx="8" ry="2" fill="none" stroke="#c9d1c1" strokeWidth="1.2" />
  </svg>
);
const Calendar = () => (
  <svg viewBox="0 0 22 22" width="22" height="22" aria-label="days">
    <rect x="2" y="4" width="18" height="16" rx="2.5" fill="#fff" stroke="#1a1c2e" strokeWidth="1.6" />
    <path d="M2 9h18M7 2v4M15 2v4" stroke="#1a1c2e" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
function Days({ n }) {
  const k = Math.min(n, 10);
  return (
    <svg viewBox={`0 0 ${k * 10} 14`} width={k * 10} height="14" aria-label={`${n} days`}>
      {Array.from({ length: k }, (_, i) => (
        <rect key={i} x={i * 10 + 1} y="1" width="8" height="12" rx="1.5" fill="#fff" stroke="#3a33a3" strokeWidth="1.5" />
      ))}
    </svg>
  );
}
