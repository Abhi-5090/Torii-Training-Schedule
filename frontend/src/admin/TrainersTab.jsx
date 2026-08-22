import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { announceChange } from './Console.jsx';
import { Modal, PageHead, Field, Notice, EmptyState, Spinner, confirmDelete } from './ui.jsx';

const blank = { name: '', email: '', phone: '', active: true };

export default function TrainersTab() {
  const [rows, setRows] = useState(null);
  const [batches, setBatches] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const reload = async () => {
    try {
      const [t, b] = await Promise.all([api.list('trainers'), api.list('batches')]);
      setRows(t); setBatches(b);
    } catch (e) { setError(e.message); setRows([]); }
  };
  useEffect(() => { reload(); }, []);

  const flash = msg => { setOk(msg); setError(''); setTimeout(() => setOk(''), 2600); };

  /* how many periods a week this trainer actually holds */
  const load = name => {
    let main = 0, support = 0;
    for (const b of batches || []) {
      for (const s of b.sessions || []) {
        if ((s.mainTrainers || []).includes(name)) main += (s.slots || []).length;
        else if ((s.supportTrainers || []).includes(name)) support += (s.slots || []).length;
      }
    }
    return { main, support };
  };

  async function save() {
    setError('');
    try {
      const body = { name: editing.name, email: editing.email, phone: editing.phone, active: editing.active };
      if (editing._id) await api.update('trainers', editing._id, body);
      else await api.create('trainers', body);
      setEditing(null);
      await reload();
      announceChange();
      flash(editing._id ? `Saved ${editing.name}` : `Added ${editing.name}`);
    } catch (e) { setError(e.message); }
  }

  async function remove(t) {
    const { main, support } = load(t.name);
    const extra = main + support
      ? `\n\n${t.name} is on ${main + support} period(s) a week. Deleting removes them from every session.`
      : '';
    if (!window.confirm(`Delete ${t.name}?${extra}\n\nThis cannot be undone.`)) return;
    try {
      await api.remove('trainers', t._id);
      await reload();
      announceChange();
      flash(`Deleted ${t.name}`);
    } catch (e) { setError(e.message); }
  }

  if (!rows) return <><PageHead title="Trainers" /><Spinner /></>;

  return (
    <>
      <PageHead
        title="Trainers"
        blurb="The mentor roster. Each trainer's timetable on the board is built from the sessions that name them, so there is nothing to fill in here beyond who they are."
      >
        <button className="btn btn-primary" onClick={() => setEditing({ ...blank })}>+ New trainer</button>
      </PageHead>

      <Notice error={error} ok={ok} />

      <div className="card">
        {!rows.length ? (
          <EmptyState
            title="No trainers yet"
            action={<button className="btn btn-primary" onClick={() => setEditing({ ...blank })}>+ New trainer</button>}
          >
            Add the mentors first, then assign them to batch sessions.
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Name</th><th>Contact</th><th>Weekly load</th><th>Status</th><th className="act">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map(t => {
                  const { main, support } = load(t.name);
                  return (
                    <tr key={t._id}>
                      <td className="nm">{t.name}</td>
                      <td className="muted" style={{ fontSize: 13 }}>
                        {t.email || t.phone
                          ? <>{t.email}{t.email && t.phone && <br />}{t.phone}</>
                          : '—'}
                      </td>
                      <td>
                        {main || support ? (
                          <>
                            {!!main && <span className="pill-tag">{main} main</span>}
                            {!!support && <span className="pill-tag grey" style={{ marginLeft: 6 }}>{support} support</span>}
                          </>
                        ) : <span className="muted">unassigned</span>}
                      </td>
                      <td>{t.active ? <span className="pill-tag">active</span> : <span className="pill-tag grey">hidden</span>}</td>
                      <td className="act">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ ...t })}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(t)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editing._id ? `Edit ${editing.name}` : 'New trainer'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!editing.name.trim()}>
                {editing._id ? 'Save changes' : 'Add trainer'}
              </button>
            </>
          }
        >
          <Notice error={error} />

          <Field label="Name" help="Renaming carries through every session they are on.">
            <input autoFocus value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} />
          </Field>

          <div className="sess-grid">
            <Field label="Email">
              <input type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <input value={editing.phone} onChange={e => setEditing({ ...editing, phone: e.target.value })} />
            </Field>
          </div>

          <Field help="Hidden trainers stay in the database but drop off the public board.">
            <label className="check">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={e => setEditing({ ...editing, active: e.target.checked })}
              />
              Show on the board
            </label>
          </Field>
        </Modal>
      )}
    </>
  );
}
