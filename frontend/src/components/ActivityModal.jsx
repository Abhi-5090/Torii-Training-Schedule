import { useState } from 'react';
import { Modal, Field } from '../admin/ui.jsx';
import { api } from '../lib/api.js';

const QUICK_TAGS = [
  'Digital Marketing',
  'Designing Work',
  'Curriculum Design',
  'Project Review',
  'Lab Maintenance',
  'Exam Duty',
  'Meeting / Coordination',
  'Social Media Handling',
];

export default function ActivityModal({
  trainerName,
  day,
  slot,
  slotLabel,
  days = [],
  slots = [],
  lunchIndex = 3,
  current,
  onClose,
  onSaved,
}) {
  const [selectedDay, setSelectedDay] = useState(day);
  const [selectedSlots, setSelectedSlots] = useState([slot]);
  const [fromSlot, setFromSlot] = useState(slot);
  const [toSlot, setToSlot] = useState(slot);

  const [kind, setKind] = useState(current?.kind || 'other');
  const [label, setLabel] = useState(current?.kind === 'other' ? current.label : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleRangeChange = (newFrom, newTo) => {
    setFromSlot(newFrom);
    setToSlot(newTo);
    const min = Math.min(newFrom, newTo);
    const max = Math.max(newFrom, newTo);
    const range = [];
    for (let i = min; i <= max; i++) range.push(i);
    setSelectedSlots(range);
  };

  const toggleSlot = i => {
    const next = selectedSlots.includes(i)
      ? selectedSlots.filter(s => s !== i)
      : [...selectedSlots, i].sort((a, b) => a - b);
    setSelectedSlots(next);
    if (next.length) {
      setFromSlot(next[0]);
      setToSlot(next[next.length - 1]);
    }
  };

  const selectPreset = (type) => {
    if (type === 'all') {
      const all = slots.map((_, i) => i);
      setSelectedSlots(all);
      setFromSlot(0);
      setToSlot(slots.length - 1);
    } else if (type === 'morning') {
      const morn = slots.map((_, i) => i).filter(i => i < lunchIndex);
      setSelectedSlots(morn);
      if (morn.length) {
        setFromSlot(morn[0]);
        setToSlot(morn[morn.length - 1]);
      }
    } else if (type === 'afternoon') {
      const aft = slots.map((_, i) => i).filter(i => i > lunchIndex);
      setSelectedSlots(aft);
      if (aft.length) {
        setFromSlot(aft[0]);
        setToSlot(aft[aft.length - 1]);
      }
    }
  };

  async function save() {
    if (!selectedSlots.length) { setError('Select at least one period/slot.'); return; }
    if (kind === 'other' && !label.trim()) { setError("Say what work is assigned."); return; }
    setBusy(true); setError('');
    try {
      await api.setActivity({
        trainer: trainerName,
        day: selectedDay,
        slots: selectedSlots,
        kind,
        label: kind === 'lunch' ? '' : label.trim(),
      });
      await onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function clear() {
    if (!selectedSlots.length) return;
    setBusy(true); setError('');
    try {
      await api.clearActivity({
        trainer: trainerName,
        day: selectedDay,
        slots: selectedSlots,
      });
      await onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  const slotNumbersText = selectedSlots.length
    ? `Slot ${selectedSlots.map(s => s + 1).join(', ')}`
    : 'No slots picked';

  return (
    <Modal
      wide
      title={`Assign Work / Activity · ${trainerName}`}
      sub={`${selectedDay} · ${slotNumbersText} (${selectedSlots.length} period${selectedSlots.length > 1 ? 's' : ''})`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger" onClick={clear} disabled={busy || !selectedSlots.length}>
            Clear Selected — Mark Free
          </button>
          <span className="spacer" />
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !selectedSlots.length}>
            {busy ? 'Saving…' : `Save for ${selectedSlots.length} slot${selectedSlots.length > 1 ? 's' : ''}`}
          </button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}

      <div className="sess-grid" style={{ marginBottom: 14 }}>
        <Field label="Teaching Day">
          <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
            {(days.length ? days : [day]).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label="Quick Period Range (From → To)">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={fromSlot}
              onChange={e => handleRangeChange(Number(e.target.value), toSlot)}
              style={{ flex: 1 }}
            >
              {slots.map((s, i) => (
                <option key={i} value={i}>Slot {i + 1} ({s})</option>
              ))}
            </select>
            <span style={{ color: 'var(--muted)', fontWeight: 600 }}>to</span>
            <select
              value={toSlot}
              onChange={e => handleRangeChange(fromSlot, Number(e.target.value))}
              style={{ flex: 1 }}
            >
              {slots.map((s, i) => (
                <option key={i} value={i}>Slot {i + 1} ({s})</option>
              ))}
            </select>
          </div>
        </Field>
      </div>

      <Field
        label="Select Periods / Time Slots"
        help="Toggle individual periods or use the range selector above. Lunch slot is marked with dashed border."
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectPreset('morning')}>
            Morning (Slots 1–{lunchIndex})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectPreset('afternoon')}>
            Afternoon (Slots {lunchIndex + 2}–{slots.length})
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => selectPreset('all')}>
            All Day (Slots 1–{slots.length})
          </button>
        </div>

        <div className="slotpick" style={{ marginBottom: 14 }}>
          {slots.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`${selectedSlots.includes(i) ? 'on' : ''} ${i === lunchIndex ? 'lunchy' : ''}`}
              onClick={() => toggleSlot(i)}
            >
              {i + 1}<span className="t">{s}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Assignment Type">
        <div className="activity-picks" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className={kind === 'lunch' ? 'on lunch' : ''}
            onClick={() => setKind('lunch')}
          >
            Lunch Break
          </button>
          <button
            type="button"
            className={kind === 'other' ? 'on' : ''}
            onClick={() => setKind('other')}
          >
            Other Work Assignment
          </button>
        </div>
      </Field>

      {kind === 'lunch' && (
        <p className="sub" style={{ background: 'var(--lunch-bg)', color: 'var(--lunch-tx)', padding: '12px 16px', borderRadius: 12, marginTop: -4 }}>
          The selected <b>{selectedSlots.length}</b> slot(s) will be marked as <b>Lunch Break</b> for {trainerName}.
        </p>
      )}

      {kind === 'other' && (
        <div className="field">
          <label>Work assignment / Description (e.g. Digital Marketing, Designing...)</label>
          <textarea
            autoFocus
            rows={3}
            value={label}
            placeholder="e.g. Digital Marketing, Designing work, Curriculum preparation, Project Review, Lab Coordination…"
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save();
            }}
          />
          <div className="help" style={{ marginBottom: 8 }}>
            Press ⌘+Enter (Ctrl+Enter) or click Save. This workload label will appear on the trainer's grid and workload summary.
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Quick suggestions:</span>
            {QUICK_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8 }}
                onClick={() => setLabel(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
