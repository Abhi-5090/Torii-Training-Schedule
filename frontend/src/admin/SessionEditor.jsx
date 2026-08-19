import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Field } from './ui.jsx';

/*
 * Asks the API who is already busy at this day + period, so a clash shows up
 * while the session is being written rather than after it is saved.
 */
function useAvailability(day, slots, excludeBatch) {
  const [busy, setBusy] = useState({ trainers: {}, venues: {} });

  const key = `${day}|${[...slots].sort((a, b) => a - b).join(',')}`;
  useEffect(() => {
    if (!day || !slots.length) { setBusy({ trainers: {}, venues: {} }); return; }
    let live = true;
    const t = setTimeout(() => {
      api.availability([{ day, slots }], excludeBatch)
        .then(r => {
          if (!live) return;
          const map = list => Object.fromEntries(list.filter(x => x.busyWith).map(x => [x.name, x.busyWith]));
          setBusy({ trainers: map(r.trainers), venues: map(r.venues) });
        })
        .catch(() => {});
    }, 180);
    return () => { live = false; clearTimeout(t); };
  }, [key, excludeBatch]);            // eslint-disable-line react-hooks/exhaustive-deps

  return busy;
}

function MentorPicker({ label, help, all, chosen, exclude, busy, onToggle }) {
  return (
    <Field label={label} help={help}>
      <div className="picker">
        {all.length === 0 && <span className="muted" style={{ fontSize: 13, padding: 6 }}>No trainers yet.</span>}
        {all.map(t => {
          const disabled = exclude.includes(t.name);
          const taken = busy[t.name];
          return (
            <label key={t.name} className={taken ? 'taken' : ''} style={disabled ? { opacity: .4 } : undefined}>
              <input
                type="checkbox"
                checked={chosen.includes(t.name)}
                disabled={disabled}
                onChange={() => onToggle(t.name)}
              />
              {t.name}
              {taken && <span className="busy-note">busy · {taken}</span>}
            </label>
          );
        })}
      </div>
    </Field>
  );
}

export default function SessionEditor({ index, session, config, trainers, batchId, onChange, onRemove }) {
  const busy = useAvailability(session.day, session.slots, batchId);

  const set = patch => onChange({ ...session, ...patch });

  const toggleSlot = i => {
    const has = session.slots.includes(i);
    set({ slots: (has ? session.slots.filter(s => s !== i) : [...session.slots, i]).sort((a, b) => a - b) });
  };

  const toggleIn = (field, name) => {
    const list = session[field];
    set({ [field]: list.includes(name) ? list.filter(n => n !== name) : [...list, name] });
  };

  const label = session.slots.length
    ? `Slot ${session.slots.map(i => i + 1).join(', ')}`
    : 'No period picked';

  return (
    <div className="sess">
      <div className="sess-head">
        <span className="ttl">Session {index + 1} · {session.day || 'pick a day'} · {label}</span>
        <button type="button" className="btn btn-danger btn-sm" onClick={onRemove}>Remove</button>
      </div>

      <div className="sess-grid">
        <Field label="Day">
          <select value={session.day} onChange={e => set({ day: e.target.value })}>
            <option value="">Choose a day…</option>
            {config.days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>

        <Field label="Subject">
          <input
            value={session.subject}
            placeholder="e.g. C Programming"
            onChange={e => set({ subject: e.target.value })}
          />
        </Field>
      </div>

      <Field
        label="Periods"
        help={`Slots are numbered the way the college numbers them. Lunch (${config.slots[config.lunchIndex]}) is dashed — pick it only if this class genuinely runs through the break.`}
      >
        <div className="slotpick">
          {config.slots.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`${session.slots.includes(i) ? 'on' : ''} ${i === config.lunchIndex ? 'lunchy' : ''}`}
              onClick={() => toggleSlot(i)}
            >
              {i + 1}<span className="t">{s}</span>
            </button>
          ))}
        </div>
      </Field>

      <div className="sess-grid">
        <MentorPicker
          label="Main mentors"
          help="Delivers the class."
          all={trainers}
          chosen={session.mainTrainers}
          exclude={session.supportTrainers}
          busy={busy.trainers}
          onToggle={n => toggleIn('mainTrainers', n)}
        />
        <MentorPicker
          label="Support mentors"
          help="Assists. Someone already picked as main cannot also be support."
          all={trainers}
          chosen={session.supportTrainers}
          exclude={session.mainTrainers}
          busy={busy.trainers}
          onToggle={n => toggleIn('supportTrainers', n)}
        />
      </div>
    </div>
  );
}

export const blankSession = () => ({
  day: '', slots: [], subject: '', mainTrainers: [], supportTrainers: [],
});
