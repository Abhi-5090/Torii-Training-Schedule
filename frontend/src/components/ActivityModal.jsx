import { useState } from 'react';
import { Modal } from '../admin/ui.jsx';
import { api } from '../lib/api.js';

/*
 * Opened by clicking a non-class cell on a trainer's own grid (admin only —
 * the caller decides that; this just renders the editor). Picks between
 * logging a lunch taken outside the standard break, or free text for
 * anything else, and saves straight to that one cell.
 */
export default function ActivityModal({ trainerName, day, slot, slotLabel, current, onClose, onSaved }) {
  const [kind, setKind] = useState(current?.kind || 'other');
  const [label, setLabel] = useState(current?.kind === 'other' ? current.label : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (kind === 'other' && !label.trim()) { setError("Say what they're doing."); return; }
    setBusy(true); setError('');
    try {
      await api.setActivity(trainerName, day, slot, kind, label.trim());
      await onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function clear() {
    setBusy(true); setError('');
    try {
      await api.clearActivity(trainerName, day, slot);
      await onSaved();
      onClose();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      title={trainerName}
      sub={`${day} · ${slotLabel}`}
      onClose={onClose}
      footer={
        <>
          {current && (
            <button className="btn btn-danger" onClick={clear} disabled={busy}>Clear — mark free</button>
          )}
          <span className="spacer" />
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}

      <p className="sub" style={{ marginTop: -6 }}>
        Assign an activity or custom lunch break for <b>{trainerName}</b> during this slot.
      </p>

      <div className="activity-picks">
        <button
          type="button"
          className={kind === 'lunch' ? 'on lunch' : ''}
          onClick={() => setKind('lunch')}
        >
          Lunch
        </button>
        <button
          type="button"
          className={kind === 'other' ? 'on' : ''}
          onClick={() => setKind('other')}
        >
          Other
        </button>
      </div>

      {kind === 'lunch' && (
        <p className="help" style={{ marginTop: -8, marginBottom: 14 }}>
          This period will be marked as <b>Lunch</b> for this trainer.
        </p>
      )}

      {kind === 'other' && (
        <div className="field">
          <label>Work assignment / Description</label>
          <textarea
            autoFocus
            rows={3}
            value={label}
            placeholder="e.g. Designing work, social media handling, requirements gathering, curriculum review…"
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save();
            }}
          />
          <div className="help">Press ⌘+Enter (Ctrl+Enter) or click Save.</div>
        </div>
      )}
    </Modal>
  );
}
