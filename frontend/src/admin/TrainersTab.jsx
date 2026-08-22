import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { announceChange } from './Console.jsx';
import { Modal, PageHead, Field, Notice, EmptyState, Spinner, confirmDelete } from './ui.jsx';
import { exportTrainerPDF, exportAllTrainersPDF } from '../lib/pdfExport.js';

const blank = { name: '', email: '', phone: '', active: true };

export default function TrainersTab() {
  const [rows, setRows] = useState(null);
  const [batches, setBatches] = useState([]);
  const [scheduleData, setScheduleData] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [exporting, setExporting] = useState(false);

  const reload = async () => {
    try {
      const [t, b, s] = await Promise.all([
        api.list('trainers'),
        api.list('batches'),
        api.schedule(),
      ]);
      setRows(t);
      setBatches(b);
      setScheduleData(s);
    } catch (e) { setError(e.message); setRows([]); }
  };
  useEffect(() => { reload(); }, []);

  const flash = msg => { setOk(msg); setError(''); setTimeout(() => setOk(''), 2600); };

  /* how many periods a week this trainer actually holds and what tasks they have */
  const load = name => {
    const derived = scheduleData?.trainers?.find(t => t.name === name);
    if (derived) {
      return {
        main: derived.mainCount || 0,
        support: derived.supportCount || 0,
        other: derived.otherCount || 0,
        activities: derived.activitiesBreakdown || {},
      };
    }
    let main = 0, support = 0;
    for (const b of batches || []) {
      for (const s of b.sessions || []) {
        if ((s.mainTrainers || []).includes(name)) main += (s.slots || []).length;
        else if ((s.supportTrainers || []).includes(name)) support += (s.slots || []).length;
      }
    }
    return { main, support, other: 0, activities: {} };
  };

  const handleExportAllPDF = async () => {
    setExporting(true); setError('');
    try {
      const schedule = await api.schedule();
      exportAllTrainersPDF(schedule);
      flash('Consolidated trainer schedules PDF downloaded');
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportTrainerPDF = async (trainerDoc) => {
    setError('');
    try {
      const schedule = await api.schedule();
      const trainerView = schedule.trainers.find(t => t.name === trainerDoc.name);
      if (!trainerView) throw new Error('Trainer schedule not found');
      exportTrainerPDF(trainerView, {
        slots: schedule.slots,
        days: schedule.days,
        lunchIndex: schedule.lunchIndex,
      });
      flash(`Timetable PDF for ${trainerDoc.name} downloaded`);
    } catch (e) {
      setError(e.message);
    }
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
    const { main, support, other } = load(t.name);
    const total = main + support + other;
    const extra = total
      ? `\n\n${t.name} is on ${total} period(s) a week. Deleting removes them from every session and assigned task.`
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
        blurb="The mentor roster. Each trainer's timetable on the board is built from the sessions that name them and their assigned activities."
      >
        <button
          type="button"
          className="btn-pdf"
          disabled={exporting || !(rows || []).length}
          onClick={handleExportAllPDF}
          title="Download the full consolidated trainer schedules and workloads as a PDF"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? 'Generating PDF…' : 'Download Trainer Schedules (PDF)'}
        </button>
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
                <tr><th>Name</th><th>Contact</th><th>Weekly load & assignments</th><th>Status</th><th className="act">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map(t => {
                  const { main, support, other, activities } = load(t.name);
                  const taskNames = Object.entries(activities).map(([k, v]) => `${k} (${v})`).join(', ');
                  return (
                    <tr key={t._id}>
                      <td className="nm">{t.name}</td>
                      <td className="muted" style={{ fontSize: 13 }}>
                        {t.email || t.phone
                          ? <>{t.email}{t.email && t.phone && <br />}{t.phone}</>
                          : '—'}
                      </td>
                      <td>
                        {main || support || other ? (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {!!main && <span className="pill-tag">{main} main</span>}
                            {!!support && <span className="pill-tag grey">{support} support</span>}
                            {!!other && (
                              <span className="pill-tag" style={{ background: 'var(--orange-tint)', color: 'var(--orange-deep)', borderColor: 'var(--orange-soft)' }} title={taskNames}>
                                {other} assigned
                              </span>
                            )}
                          </div>
                        ) : <span className="muted">unassigned</span>}
                      </td>
                      <td>{t.active ? <span className="pill-tag">active</span> : <span className="pill-tag grey">hidden</span>}</td>
                      <td className="act">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleExportTrainerPDF(t)}
                          title={`Export PDF timetable for ${t.name}`}
                        >
                          PDF
                        </button>
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
