import { PinIcon } from './Icons.jsx';

/* A day range reads better broken over two lines, the way it did originally. */
function DayLabel({ day }) {
  const parts = day.split(/ – | - /);
  return parts.length > 1
    ? <>{parts[0]}<br />–&nbsp;{parts.slice(1).join(' – ')}</>
    : <>{day}</>;
}

export default function BatchCard({ batch, dimUnless }) {
  return (
    <article className="bcard rv">
      <header>
        <div>
          <h3>{batch.name}</h3>
          <div className="meta">{batch.dept && <span className="tag dept">{batch.dept}</span>}</div>
        </div>
        {!!batch.count && <div className="cnt-b">{batch.count}<span>students</span></div>}
      </header>

      <div className="rows">
        {batch.rows.map((r, i) => (
          <div className={`srow ${dimUnless(r.day) ? '' : 'dim'}`} key={i}>
            <div className="day"><DayLabel day={r.day} /></div>
            <div>
              <div className="subj">{r.subject}</div>
              <div className="time">{r.time}{r.slot && <span className="slot">Slot {r.slot}</span>}</div>
              <div className="who">
                <div><span className="lbl m">Main</span><span className="m">{r.trainer}</span></div>
                {r.support && r.support !== '—' && (
                  <div><span className="lbl s">Support</span><span className="s">{r.support}</span></div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {batch.venue && batch.venue !== '—' && (
        <div className="venue-foot"><PinIcon />{batch.venue}</div>
      )}
    </article>
  );
}
