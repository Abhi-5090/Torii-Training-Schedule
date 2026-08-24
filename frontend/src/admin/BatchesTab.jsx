import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { announceChange } from './Console.jsx';
import { Modal, PageHead, Field, Notice, EmptyState, Spinner, confirmDelete } from './ui.jsx';
import SessionEditor, { blankSession } from './SessionEditor.jsx';

import { exportBatchesPDF } from '../lib/pdfExport.js';

const emptyBatch = groups => ({
  name: '', group: groups[0]?.name || '', dept: '', count: 0, sessions: [blankSession()],
});

export default function BatchesTab() {
  const [batches, setBatches] = useState(null);
  const [groups, setGroups] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [venues, setVenues] = useState([]);
  const [config, setConfig] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [editing, setEditing] = useState(null);   // the draft being edited, or null
  const [arrangingGroup, setArrangingGroup] = useState(null); // active year group name in arrange modal or null
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [filter, setFilter] = useState('All');

  const handleExportPDF = async () => {
    setExporting(true); setError('');
    try {
      const schedule = await api.schedule();
      exportBatchesPDF(schedule);
      flash('Batches schedule PDF downloaded');
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  };

  const reload = async () => {
    try {
      const [b, g, t, v, c] = await Promise.all([
        api.list('batches'), api.list('groups'), api.list('trainers'), api.list('venues'), api.config(),
      ]);
      setBatches(b); setGroups(g); setTrainers(t); setVenues(v); setConfig(c);
    } catch (e) { setError(e.message); setBatches([]); }
  };
  useEffect(() => { reload(); }, []);

  const flash = msg => { setOk(msg); setError(''); setTimeout(() => setOk(''), 2600); };

  const sortedBatches = useMemo(() => {
    if (!batches) return [];
    const groupOrderMap = new Map((groups || []).map((g, idx) => [g.name, g.order ?? idx]));
    return [...batches].sort((a, b) => {
      const gA = groupOrderMap.has(a.group) ? groupOrderMap.get(a.group) : 999;
      const gB = groupOrderMap.has(b.group) ? groupOrderMap.get(b.group) : 999;
      if (gA !== gB) return gA - gB;
      return (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name);
    });
  }, [batches, groups]);

  const shown = useMemo(
    () => sortedBatches.filter(b => filter === 'All' || b.group === filter),
    [sortedBatches, filter],
  );

  async function save() {
    const draft = editing;
    setError('');
    try {
      const body = {
        name: draft.name, group: draft.group, dept: draft.dept,
        count: Number(draft.count) || 0, sessions: draft.sessions,
      };
      if (draft._id) await api.update('batches', draft._id, body);
      else await api.create('batches', body);

      setEditing(null);
      await reload();
      announceChange();
      flash(draft._id ? `Saved ${draft.name}` : `Created ${draft.name}`);
    } catch (e) { setError(e.message); }
  }

  async function remove(b) {
    if (!confirmDelete(`the batch "${b.name}" and its ${(b.sessions || []).length} session(s)`)) return;
    try {
      await api.remove('batches', b._id);
      await reload();
      announceChange();
      flash(`Deleted ${b.name}`);
    } catch (e) { setError(e.message); }
  }

  /* Moves a batch up/down within its own Year Group to determine its position in Overall Schedule */
  async function moveWithinGroup(b, dir) {
    const groupBatches = sortedBatches.filter(x => x.group === b.group);
    const i = groupBatches.findIndex(x => x._id === b._id);
    const j = i + dir;
    if (j < 0 || j >= groupBatches.length) return;

    const reordered = [...groupBatches];
    const [target] = reordered.splice(i, 1);
    reordered.splice(j, 0, target);

    const orderedIds = reordered.map(x => x._id);

    try {
      await api.reorderGroupBatches(b.group, orderedIds);
      await reload();
      announceChange();
      flash(`Updated order for ${b.group}`);
    } catch (e) { setError(e.message); }
  }

  /* Moves a batch to the extreme top or bottom of its group */
  async function moveBatchToEdge(groupName, bId, toTop) {
    const groupBatches = sortedBatches.filter(x => x.group === groupName);
    const i = groupBatches.findIndex(x => x._id === bId);
    if (i === -1) return;
    if (toTop && i === 0) return;
    if (!toTop && i === groupBatches.length - 1) return;

    const reordered = [...groupBatches];
    const [target] = reordered.splice(i, 1);
    if (toTop) reordered.unshift(target);
    else reordered.push(target);

    const orderedIds = reordered.map(x => x._id);

    try {
      await api.reorderGroupBatches(groupName, orderedIds);
      await reload();
      announceChange();
      flash(`Moved "${target.name}" to ${toTop ? 'top' : 'bottom'}`);
    } catch (e) { setError(e.message); }
  }

  if (!batches || !config) return <><PageHead title="Batches & Sessions" /><Spinner /></>;

  const currentArrangeGroup = arrangingGroup || (filter !== 'All' ? filter : groups[0]?.name || '');
  const arrangeBatchesList = sortedBatches.filter(b => b.group === currentArrangeGroup);

  return (
    <>
      <PageHead
        title="Batches & Sessions"
        blurb="This is the source of truth for the whole board. Enter each batch once with its weekly sessions — the trainer timetables, hall occupancy, and Overall Schedule are calculated from what you put here."
      >
        <button
          type="button"
          className="btn-arrange"
          disabled={!batches.length}
          onClick={() => setArrangingGroup(filter !== 'All' ? filter : groups[0]?.name || '')}
          title="Arrange how batches appear in the Overall Schedule"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          Arrange Batches
        </button>

        <button
          type="button"
          className="btn-pdf"
          disabled={exporting || !(batches || []).length}
          onClick={handleExportPDF}
          title="Download the full batches and sessions schedule as a PDF"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? 'Generating PDF…' : 'Download Schedule (PDF)'}
        </button>
        <button
          className="btn btn-primary"
          disabled={!groups.length}
          onClick={() => setEditing(emptyBatch(groups))}
        >
          + New batch
        </button>
      </PageHead>

      <Notice error={error} ok={ok} />

      {!groups.length && (
        <div className="conflict">
          <h3>Add a year group first</h3>
          <ul><li>Every batch belongs to a year group. Create one under <b>Year Groups</b>, then come back.</li></ul>
        </div>
      )}

      <div className="card">
        <div className="card-row" style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Field label="Filter by year">
            <select value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="All">All year groups</option>
              {groups.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
            </select>
          </Field>

          {groups.length > 0 && batches.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 13, alignSelf: 'flex-end', marginBottom: 2 }}
              onClick={() => setArrangingGroup(filter !== 'All' ? filter : groups[0]?.name || '')}
            >
              ↕ Reorder batches in schedule
            </button>
          )}
        </div>

        {!shown.length ? (
          <EmptyState
            title={batches.length ? 'No batches in this year group' : 'No batches yet'}
            action={groups.length && (
              <button className="btn btn-primary" onClick={() => setEditing(emptyBatch(groups))}>+ New batch</button>
            )}
          >
            {batches.length ? 'Pick another year, or add a batch here.' : 'Add your first batch to start building the board.'}
          </EmptyState>
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 95 }}>Order</th>
                  <th>Batch</th>
                  <th>Year</th>
                  <th>Sessions</th>
                  <th>Halls</th>
                  <th>Students</th>
                  <th className="act">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(b => {
                  const groupBatches = sortedBatches.filter(x => x.group === b.group);
                  const groupIndex = groupBatches.findIndex(x => x._id === b._id);
                  const sess = b.sessions || [];
                  const unstaffed = sess.filter(s => !(s.mainTrainers || []).length).length;
                  const noHall = sess.filter(s => !s.venue).length;
                  const halls = [...new Set(sess.map(s => s.venue).filter(Boolean))];
                  return (
                    <tr key={b._id}>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span className="pill-tag" style={{ minWidth: 26, textAlign: 'center', padding: '2px 6px', fontSize: 11, fontWeight: 700 }}>
                            #{groupIndex + 1}
                          </span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 6px', minHeight: 26, minWidth: 24, lineHeight: 1 }}
                            disabled={groupIndex === 0}
                            onClick={() => moveWithinGroup(b, -1)}
                            title="Move up in Overall Schedule"
                            aria-label="Move up"
                          >
                            ↑
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '4px 6px', minHeight: 26, minWidth: 24, lineHeight: 1 }}
                            disabled={groupIndex === groupBatches.length - 1}
                            onClick={() => moveWithinGroup(b, 1)}
                            title="Move down in Overall Schedule"
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td className="nm">
                        {b.name}
                        {b.dept && <div className="muted" style={{ fontWeight: 400, fontSize: 12, marginTop: 3 }}>{b.dept}</div>}
                      </td>
                      <td className="muted">{b.group}</td>
                      <td>
                        <span className="mono">{sess.length}</span>
                        {!!unstaffed && <span className="pill-tag warn" style={{ marginLeft: 8 }}>{unstaffed} unstaffed</span>}
                      </td>
                      <td className="muted" style={{ fontSize: 12.5 }}>
                        {halls.length ? halls.join(', ') : <span className="pill-tag warn">not set</span>}
                        {!!noHall && !!halls.length && <span className="pill-tag warn" style={{ marginLeft: 6 }}>{noHall} missing</span>}
                      </td>
                      <td className="mono">{b.count || '—'}</td>
                      <td className="act">
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(structuredClone(b))}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(b)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Arrange Batches Modal ── */}
      {arrangingGroup && (
        <Modal
          wide
          title="Arrange Batches in Overall Schedule"
          sub="Set the exact sequence in which batch cards appear on the board. Changes are applied live to the Overall Schedule."
          onClose={() => setArrangingGroup(null)}
          footer={
            <button className="btn btn-primary" onClick={() => setArrangingGroup(null)}>
              Done
            </button>
          }
        >
          <div className="arrange-container">
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Select Year Group:
              </label>
              <div className="arrange-group-tabs">
                {groups.map(g => (
                  <button
                    key={g._id}
                    type="button"
                    className={`arrange-group-tab ${g.name === currentArrangeGroup ? 'on' : ''}`}
                    onClick={() => setArrangingGroup(g.name)}
                  >
                    {g.name} ({sortedBatches.filter(b => b.group === g.name).length})
                  </button>
                ))}
              </div>
            </div>

            {!arrangeBatchesList.length ? (
              <EmptyState title={`No batches in ${currentArrangeGroup}`}>
                Add batches to this year group to arrange them.
              </EmptyState>
            ) : (
              <>
                <div className="arrange-list">
                  {arrangeBatchesList.map((b, idx) => (
                    <div className="arrange-row" key={b._id}>
                      <div className="arrange-row-left">
                        <div className="arrange-num">#{idx + 1}</div>
                        <div className="arrange-row-info">
                          <div className="arrange-row-title">{b.name}</div>
                          <div className="arrange-row-meta">
                            {b.dept && <span><b>Dept:</b> {b.dept}</span>}
                            <span><b>Sessions:</b> {(b.sessions || []).length}</span>
                            {b.count > 0 && <span><b>Students:</b> {b.count}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="arrange-row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm arrange-btn-action"
                          disabled={idx === 0}
                          onClick={() => moveBatchToEdge(currentArrangeGroup, b._id, true)}
                          title="Move to Top"
                        >
                          ⤒ Top
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm arrange-btn-action"
                          disabled={idx === 0}
                          onClick={() => moveWithinGroup(b, -1)}
                          title="Move Up"
                        >
                          ↑ Up
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm arrange-btn-action"
                          disabled={idx === arrangeBatchesList.length - 1}
                          onClick={() => moveWithinGroup(b, 1)}
                          title="Move Down"
                        >
                          ↓ Down
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm arrange-btn-action"
                          disabled={idx === arrangeBatchesList.length - 1}
                          onClick={() => moveBatchToEdge(currentArrangeGroup, b._id, false)}
                          title="Move to Bottom"
                        >
                          ⤓ Bottom
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="arrange-preview-box">
                  <div className="arrange-preview-head">
                    <span className="arrange-preview-title">Board Grid Preview: {currentArrangeGroup}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>Left-to-right order as rendered on the public board</span>
                  </div>
                  <div className="arrange-preview-grid">
                    {arrangeBatchesList.map((b, i) => (
                      <div className="arrange-preview-card" key={b._id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)' }}>#{i + 1}</span>
                          {b.dept && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{b.dept}</span>}
                        </div>
                        <strong>{b.name}</strong>
                        <span>{(b.sessions || []).length} sessions</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          wide
          title={editing._id ? `Edit ${editing.name}` : 'New batch'}
          sub="A session is one class on one day. Add as many as the batch has in a week."
          onClose={() => setEditing(null)}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setEditing({ ...editing, sessions: [...editing.sessions, blankSession()] })}
              >
                + Add session
              </button>
              <span className="spacer" />
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!editing.name.trim()}>
                {editing._id ? 'Save changes' : 'Create batch'}
              </button>
            </>
          }
        >
          <Notice error={error} />

          <div className="sess-grid" style={{ marginBottom: 14 }}>
            <Field label="Batch name" help="Shown as the card title on the board.">
              <input
                value={editing.name}
                placeholder="e.g. C · Batch-1"
                onChange={e => setEditing({ ...editing, name: e.target.value })}
              />
            </Field>

            <Field label="Year group">
              <select value={editing.group} onChange={e => setEditing({ ...editing, group: e.target.value })}>
                {groups.map(g => <option key={g._id} value={g.name}>{g.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="sess-grid" style={{ marginBottom: 14 }}>
            <Field label="Departments" help="Optional tag on the card. Leave blank to show nothing.">
              <input
                value={editing.dept}
                placeholder="e.g. AIML, DS, ISE"
                onChange={e => setEditing({ ...editing, dept: e.target.value })}
              />
            </Field>

            <Field label="Students" help="0 hides the count badge.">
              <input
                type="number" min="0"
                value={editing.count}
                onChange={e => setEditing({ ...editing, count: e.target.value })}
              />
            </Field>
          </div>

          <h2 style={{ fontSize: 16, margin: '26px 0 6px' }}>Weekly sessions</h2>
          <p className="sub" style={{ marginBottom: 16 }}>
            Each session picks its own hall — a batch can meet in a different room on a different day.
            Anyone or anywhere already booked at the chosen day and period is marked <b>busy</b> so you can see a clash before saving.
          </p>

          {!editing.sessions.length && (
            <EmptyState title="No sessions yet">Add one to put this batch on the board.</EmptyState>
          )}

          {editing.sessions.map((s, i) => (
            <SessionEditor
              key={i}
              index={i}
              session={s}
              config={config}
              trainers={trainers}
              venues={venues}
              batchId={editing._id}
              onChange={next => {
                const sessions = [...editing.sessions];
                sessions[i] = next;
                setEditing({ ...editing, sessions });
              }}
              onRemove={() => setEditing({ ...editing, sessions: editing.sessions.filter((_, j) => j !== i) })}
            />
          ))}
        </Modal>
      )}
    </>
  );
}
