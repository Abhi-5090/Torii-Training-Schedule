import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { RM } from '../lib/theme.js';
import { reveal } from '../lib/reveal.js';

import Hero from '../components/Hero.jsx';
import Stats from '../components/Stats.jsx';
import Loading from '../components/Loading.jsx';
import BatchCard from '../components/BatchCard.jsx';
import SoonCard from '../components/SoonCard.jsx';
import PeriodGrid, { Counts, freeAllDay, dayShort } from '../components/PeriodGrid.jsx';
import ActivityModal from '../components/ActivityModal.jsx';
import { CalendarIcon, PersonIcon, BuildingIcon, SearchIcon } from '../components/Icons.jsx';

/* loading dwell, ms — the same beats the original board used */
const D_VIEW = 900, D_FILTER = 620, D_SEARCH = 460;

const VIEWS = {
  schedule: { msg: 'Loading class schedule', n: 3, label: 'Overall Schedule', Icon: CalendarIcon },
  trainer:  { msg: 'Loading trainer grids',  n: 2, label: 'Trainer Schedule', Icon: PersonIcon },
  venue:    { msg: 'Loading hall occupancy', n: 2, label: 'Venue Schedule',   Icon: BuildingIcon },
};

export default function Board({ admin }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  /* ?view=trainer deep-links straight to a view, so a particular grid can be
     shared rather than described. */
  const [view, setViewState] = useState(() => {
    const v = new URLSearchParams(location.search).get('view');
    return VIEWS[v] ? v : 'schedule';
  });
  const setView = v => {
    setViewState(v);
    const url = new URL(location.href);
    if (v === 'schedule') url.searchParams.delete('view');
    else url.searchParams.set('view', v);
    history.replaceState(null, '', url);
  };
  const [dayFilter, setDayFilter] = useState('All');
  const [query, setQuery] = useState('');

  /* `dwell` holds the skeleton up for a beat after every change, the way the
     original did — the board is meant to feel like it is fetching. */
  const [dwell, setDwell] = useState(true);
  const [dwellMsg, setDwellMsg] = useState(VIEWS.schedule.msg);

  const refresh = () => api.schedule().then(setData);
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);

  useEffect(() => { document.body.classList.add('boot'); }, []);

  /* The console and the login screen retitle the tab, so the board has to
     claim it back when you navigate here from either of them. */
  useEffect(() => { document.title = 'Torii · NCET Training Dashboard'; }, []);

  const hold = (msg, ms) => {
    setDwellMsg(msg);
    setDwell(true);
    if (RM) { setDwell(false); return () => {}; }
    const t = setTimeout(() => setDwell(false), ms);
    return () => clearTimeout(t);
  };

  /* view switch */
  useEffect(() => hold(VIEWS[view].msg, D_VIEW), [view]);

  /* day filter, schedule view only */
  const firstFilter = useRef(true);
  useEffect(() => {
    if (firstFilter.current) { firstFilter.current = false; return; }
    return hold(dayFilter === 'All' ? 'Loading all days' : `Loading ${dayFilter}`, D_FILTER);
  }, [dayFilter]);

  /* trainer search, debounced then held */
  const firstQuery = useRef(true);
  useEffect(() => {
    if (firstQuery.current) { firstQuery.current = false; return; }
    const debounce = setTimeout(() => {
      hold(query.trim() ? `Searching “${query.trim()}”` : 'Loading trainers', D_SEARCH);
    }, 240);
    return () => clearTimeout(debounce);
  }, [query]);

  if (error) {
    return (
      <div className="wrap">
        <Hero admin={admin} />
        <p className="empty">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="wrap">
        <Hero admin={admin} />
        <Loading msg="Loading schedule" n={3} />
      </div>
    );
  }

  const busy = dwell;

  return (
    <div className="wrap">
      <Hero admin={admin} />
      <Stats data={data} />

      <div className="control">
        <Segmented view={view} onChange={setView} />
        <div id="ctrlRight">
          {view === 'schedule' && (
            <div className="filters">
              {['All', ...data.days].map(d => (
                <button
                  key={d}
                  className={`chip ${d === dayFilter ? 'on' : ''} ${busy ? 'busy' : ''}`}
                  onClick={() => setDayFilter(d)}
                >
                  {d === 'All' ? 'All days' : dayShort(d)}
                </button>
              ))}
            </div>
          )}
          {view === 'trainer' && (
            <div className="search">
              <SearchIcon />
              <input
                placeholder="Search trainer…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {view === 'schedule' && (
        <section className="panel show">
          <div className="sec-head">
            <h2>Overall Class Schedule</h2>
            <span className="hint">
              {dayFilter === 'All' ? data.groups.map(g => g.group).join(', ') : `Highlighting ${dayFilter}`}
            </span>
          </div>
          {busy ? <Loading msg={dwellMsg} n={3} />
                : <ScheduleView data={data} dayFilter={dayFilter} />}
        </section>
      )}

      {view === 'trainer' && (
        <section className="panel show">
          <div className="sec-head">
            <h2>Trainer Schedule</h2>
            <span className="hint">
              Free vs occupied periods per trainer · lunch ({data.slots[data.lunchIndex]}) is a break for all.
            </span>
          </div>
          {busy ? <Loading msg={dwellMsg} n={2} />
                : <TrainerView data={data} query={query} admin={admin} refresh={refresh} />}
        </section>
      )}

      {view === 'venue' && (
        <section className="panel show">
          <div className="sec-head">
            <h2>Venue Schedule</h2>
            <span className="hint">
              Which hall is free when, and what class is running there · lunch ({data.slots[data.lunchIndex]}) is a break for all.
            </span>
          </div>
          {busy ? <Loading msg={dwellMsg} n={2} />
                : <VenueView data={data} />}
        </section>
      )}

      <footer>
        <span>
          Built from <b>Torii Schedule</b> · <span className="tag-orange">Torii — Step IN Stand OUT</span>
        </span>
        <span>{data.trainers.length} trainers · {data.batches.length} batches · {data.venues.length} halls</span>
      </footer>
    </div>
  );
}

/* ── the sliding pill has to be measured, so it lives in its own component ── */
function Segmented({ view, onChange }) {
  const segRef = useRef(null);
  const [pill, setPill] = useState({ width: 0, x: 0 });

  const position = () => {
    const on = segRef.current?.querySelector('button.on');
    if (on) setPill({ width: on.offsetWidth, x: on.offsetLeft - 5 });
  };

  useLayoutEffect(position, [view]);
  useEffect(() => {
    addEventListener('resize', position);
    addEventListener('load', position);
    /* webfonts land after first paint and change the button widths */
    document.fonts?.ready?.then(position);
    return () => { removeEventListener('resize', position); removeEventListener('load', position); };
  }, []);

  return (
    <div className="seg" ref={segRef} data-view={view}>
      <span className="pill" style={{ width: `${pill.width}px`, transform: `translateX(${pill.x}px)` }} />
      {Object.entries(VIEWS).map(([key, { label, Icon }]) => (
        <button
          key={key}
          className={key === view ? 'on' : ''}
          data-v={key}
          onClick={() => { if (key !== view) onChange(key); }}
        >
          <Icon />{label}
        </button>
      ))}
    </div>
  );
}

function ScheduleView({ data, dayFilter }) {
  const host = useRef(null);
  useEffect(() => reveal(host.current), [data, dayFilter]);

  const matches = day => dayFilter === 'All' || day.toLowerCase().includes(dayFilter.toLowerCase());

  return (
    <div ref={host}>
      {data.groups.map((g, i) => (
        <div className="group rv" key={g.group}>
          <div className="group-head">
            <span className={`yr ${i === 0 ? 'hl' : ''}`}>{g.group}</span>
            <span className="rule" />
            <span className="cnt">{g.batches.length} {g.batches.length > 1 ? 'batches' : 'batch'}</span>
          </div>
          <div className="grid-cards">
            {g.batches.map(b => <BatchCard key={b.id} batch={b} dimUnless={matches} />)}
          </div>
        </div>
      ))}

      {data.upcoming.map(u => (
        <div className="group rv" key={u.group}>
          <div className="group-head">
            <span className="yr soon">{u.group}</span>
            <span className="rule" />
            <span className="cnt">awaiting schedule</span>
          </div>
          <div className="grid-cards" style={{ gridTemplateColumns: '1fr' }}>
            <SoonCard group={u.group} note={u.note} />
          </div>
        </div>
      ))}
    </div>
  );
}

const LEGEND = (
  <div className="legend">
    <span><i className="m" />Main mentor — delivers the class</span>
    <span><i className="s" />Support mentor — assists</span>
    <span><i className="f" />Free</span>
    <span><i className="l" />Lunch break</span>
  </div>
);

const VENUE_LEGEND = (
  <div className="legend">
    <span><i className="m" />Class in session</span>
    <span><i className="f" />Hall free</span>
    <span><i className="l" />Lunch break</span>
  </div>
);

const initials = n => n.slice(0, 2).toUpperCase();

function TrainerView({ data, query, admin, refresh }) {
  const host = useRef(null);
  const q = query.trim().toLowerCase();
  const list = useMemo(
    () => data.trainers.filter(t => t.name.toLowerCase().includes(q)),
    [data, q],
  );

  /* the cell currently open in the activity editor, or null */
  const [editing, setEditing] = useState(null);

  useEffect(() => reveal(host.current), [list]);

  if (!list.length) return <p className="empty">No trainer matches that name.</p>;

  return (
    <div ref={host}>
      {LEGEND}
      {admin && (
        <p className="admin-hint">
          Signed in — click any free, lunch, or logged period on a grid below to record what that trainer is doing.
        </p>
      )}
      {list.map(t => {
        const free = freeAllDay(t, data.days, data.slots.length);
        const role = t.mainCount && t.supportCount ? 'Main + Support mentor'
          : t.mainCount ? 'Main mentor'
          : t.supportCount ? 'Support mentor' : 'Unassigned';
        return (
          <article className="tcard rv" key={t.id}>
            <div className="top">
              <div className="tname">
                <div className="avatar">{initials(t.name)}</div>
                <div><h3>{t.name}</h3><div className="role">{role}</div></div>
              </div>
              <Counts entity={t} />
            </div>
            <PeriodGrid
              entity={t} slots={data.slots} days={data.days} lunchIndex={data.lunchIndex}
              onEditCell={admin ? (day, slot, current) => setEditing({ trainerName: t.name, day, slot, current }) : undefined}
            />
            {!!free.length && <p className="free-note">● Free all day: {free.join(', ')}</p>}
          </article>
        );
      })}

      {editing && (
        <ActivityModal
          trainerName={editing.trainerName}
          day={editing.day}
          slot={editing.slot}
          slotLabel={data.slots[editing.slot]}
          current={editing.current}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

function VenueView({ data }) {
  const host = useRef(null);
  useEffect(() => reveal(host.current), [data]);

  return (
    <div ref={host}>
      {VENUE_LEGEND}
      {data.venues.map(v => {
        const free = freeAllDay(v, data.days, data.slots.length);
        return (
          <article className="tcard rv" key={v.id}>
            <div className="top">
              <div className="tname">
                <div className="avatar venue">
                  <svg viewBox="0 0 24 24"><path d="M4 21V8l8-5 8 5v13" /><path d="M9 21v-6h6v6" /></svg>
                </div>
                <div><h3>{v.name}</h3><div className="role">Training hall</div></div>
              </div>
              <Counts entity={v} />
            </div>
            <PeriodGrid entity={v} slots={data.slots} days={data.days} lunchIndex={data.lunchIndex} />
            {!!free.length && <p className="free-note">● Free all day: {free.join(', ')}</p>}
          </article>
        );
      })}
    </div>
  );
}
