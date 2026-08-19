import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAdmin } from '../lib/useAdmin.js';
import { PageHead, Field, Notice } from './ui.jsx';

export default function SettingsTab() {
  const { admin, clear } = useAdmin();
  const navigate = useNavigate();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (next !== again) { setError('The two new passwords do not match'); return; }
    if (next.length < 8) { setError('New password must be at least 8 characters'); return; }

    setBusy(true);
    try {
      await api.changePassword(current, next);
      /* the server drops the session on purpose, so send them back to sign in */
      clear();
      navigate('/admin/login', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Settings"
        blurb="The admin account that controls the board."
      />

      <div className="card" style={{ maxWidth: 560 }}>
        <h2>Signed in as</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          <b className="mono">{admin?.email}</b><br />
          This is the only account with access. It was created from the backend
          <span className="mono"> .env</span> file on first boot.
        </p>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h2>Change password</h2>
        <p className="sub">
          Changing it signs out every open session, including this one, so you will sign in again straight after.
        </p>

        <Notice error={error} />

        <form onSubmit={submit}>
          <Field label="Current password">
            <input
              type="password" autoComplete="current-password" required
              value={current} onChange={e => setCurrent(e.target.value)}
            />
          </Field>

          <Field label="New password" help="At least 8 characters.">
            <input
              type="password" autoComplete="new-password" required
              value={next} onChange={e => setNext(e.target.value)}
            />
          </Field>

          <Field label="New password again">
            <input
              type="password" autoComplete="new-password" required
              value={again} onChange={e => setAgain(e.target.value)}
            />
          </Field>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <h2>How the board is built</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          Batch sessions are the only thing stored. Each trainer's timetable and each
          hall's occupancy are calculated from them every time the board loads, which is
          why the three views can never disagree — and why a double-booking shows up on
          the dashboard as soon as it is created.
        </p>
      </div>
    </>
  );
}
