/*
 * Everything the board renders is computed here from one source of truth:
 * the sessions stored on each batch. The admin never hand-edits a trainer
 * grid or a hall grid, so the three views cannot drift apart.
 */

/* The teaching day runs 9:00 AM → 4:10 PM, so an hour of 9–11 is morning,
   12 is noon, and 1–4 is afternoon. That covers every label on the grid. */
function meridiem(hhmm) {
  const hour = parseInt(hhmm.split(':')[0], 10);
  return hour === 12 || hour <= 8 ? 'PM' : 'AM';
}

function stamp(hhmm) {
  return `${hhmm} ${meridiem(hhmm)}`;
}

/* '9:00–9:50' + '9:50–10:50' -> '9:00 AM – 10:50 AM' */
export function timeLabel(slots, indexes) {
  const lo = Math.min(...indexes), hi = Math.max(...indexes);
  const start = String(slots[lo] || '').split(/[–-]/)[0].trim();
  const end = String(slots[hi] || '').split(/[–-]/).pop().trim();
  if (!start || !end) return '';
  return `${stamp(start)} – ${stamp(end)}`;
}

/* Slots are stored zero-based but everyone at the college counts from 1. */
export function slotLabel(indexes) {
  const sorted = [...indexes].sort((a, b) => a - b).map(i => i + 1);
  return sorted.length > 1
    ? `${sorted[0]}–${sorted[sorted.length - 1]}`
    : String(sorted[0]);
}

function emptyGrid(days, slotCount) {
  const g = {};
  for (const d of days) g[d] = Array(slotCount).fill('');
  return g;
}

/* Sessions that differ only by day are written as one row, the way the
   original board read "Monday – Wednesday" instead of three separate lines. */
function collapseRows(sessions, config) {
  const { slots, days } = config;
  const buckets = new Map();

  for (const s of sessions) {
    const slotList = [...s.slots].sort((a, b) => a - b);
    const key = JSON.stringify([
      slotList, s.subject, s.venue || '',
      [...(s.mainTrainers || [])], [...(s.supportTrainers || [])],
    ]);
    if (!buckets.has(key)) buckets.set(key, { session: s, slotList, dayIdx: [] });
    const idx = days.indexOf(s.day);
    if (idx !== -1) buckets.get(key).dayIdx.push(idx);
  }

  const rows = [];
  for (const { session, slotList, dayIdx } of buckets.values()) {
    const sorted = [...new Set(dayIdx)].sort((a, b) => a - b);

    /* walk the sorted day indexes, breaking into runs of consecutive days */
    let run = [sorted[0]];
    const runs = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1) run.push(sorted[i]);
      else { runs.push(run); run = [sorted[i]]; }
    }
    if (run.length) runs.push(run);

    for (const r of runs) {
      const main = session.mainTrainers || [];
      const support = session.supportTrainers || [];
      rows.push({
        day: r.length > 1 ? `${days[r[0]]} – ${days[r[r.length - 1]]}` : days[r[0]],
        dayIndexes: r,
        time: timeLabel(slots, slotList),
        slot: slotLabel(slotList),
        slots: slotList,
        subject: session.subject,
        venue: session.venue || '',
        trainer: main.length ? main.join(', ') : 'To be assigned',
        support: support.length ? support.join(', ') : '—',
        mainList: main,
        supportList: support,
      });
    }
  }

  const dayRank = r => Math.min(...r.dayIndexes);
  rows.sort((a, b) => dayRank(a) - dayRank(b) || a.slots[0] - b.slots[0]);
  return rows;
}

/*
 * Builds the whole payload the board consumes.
 * `config` is { slots, days, lunchIndex }.
 */
export function buildSchedule({ config, groups, trainers, venues, batches }) {
  const { slots, days, lunchIndex } = config;
  const slotCount = slots.length;

  /* ── batch cards, grouped by year ── */
  const batchCards = batches.map(b => {
    const rows = collapseRows(b.sessions || [], config);
    /* A batch can meet in different halls on different days now, so there is
       no single "the" venue any more — just the distinct set actually in use,
       read off the rows so it always agrees with what's displayed. */
    const venues = [...new Set(rows.map(r => r.venue).filter(Boolean))];
    return {
      id: String(b._id || b.id || b.name),
      name: b.name,
      group: b.group,
      dept: b.dept || '',
      venues,
      count: b.count || 0,
      rows,
    };
  });

  const ordered = [...groups].sort((a, b) => (a.order || 0) - (b.order || 0));
  const groupViews = ordered
    .filter(g => !g.pending)
    .map(g => ({
      group: g.name,
      batches: batchCards.filter(b => b.group === g.name),
    }))
    .filter(g => g.batches.length);

  const upcoming = ordered
    .filter(g => g.pending)
    .map(g => ({ group: g.name, note: g.note || '' }));

  /* ── trainer grids ── */
  const tGrid = {}, tRole = {};
  const ensureTrainer = name => {
    if (!tGrid[name]) { tGrid[name] = emptyGrid(days, slotCount); tRole[name] = emptyGrid(days, slotCount); }
  };
  for (const t of trainers) ensureTrainer(t.name);

  /* ── venue grids ── */
  const vGrid = {};
  for (const v of venues) vGrid[v.name] = emptyGrid(days, slotCount);

  /* One pass over every session fills both sets of grids and records any
     cell that two batches are fighting over. */
  const conflicts = [];
  const claim = (bucket, key, day, i, batchName, kind) => {
    const held = bucket[key][day][i];
    if (held && held !== batchName) {
      conflicts.push({ kind, subject: key, day, slot: slots[i], slotIndex: i, batches: [held, batchName] });
    }
    bucket[key][day][i] = batchName;
  };

  for (const b of batches) {
    for (const s of b.sessions || []) {
      if (!days.includes(s.day)) continue;
      const main = s.mainTrainers || [], support = s.supportTrainers || [];

      for (const name of main) {
        ensureTrainer(name);
        for (const i of s.slots) {
          if (i < 0 || i >= slotCount) continue;
          claim(tGrid, name, s.day, i, b.name, 'trainer');
          tRole[name][s.day][i] = 'main';
        }
      }
      for (const name of support) {
        ensureTrainer(name);
        for (const i of s.slots) {
          if (i < 0 || i >= slotCount) continue;
          claim(tGrid, name, s.day, i, b.name, 'trainer');
          tRole[name][s.day][i] = 'support';
        }
      }
      if (s.venue && vGrid[s.venue]) {
        for (const i of s.slots) {
          if (i < 0 || i >= slotCount) continue;
          claim(vGrid, s.venue, s.day, i, b.name, 'venue');
        }
      }
    }
  }

  /* Lunch is a break for everyone, so it is neither free nor occupied. It is
     stamped in only where no class was booked over it — First Year's slot 3–4
     sessions legitimately run through 11:50–12:50. */
  const summarise = (grid, withRoles) => {
    const free = {};
    let totalFree = 0, mainCount = 0, supportCount = 0, totalBusy = 0;

    for (const d of days) {
      free[d] = [];
      for (let i = 0; i < slotCount; i++) {
        const v = grid[d][i];
        if (i === lunchIndex && !v) { grid[d][i] = 'Lunch Break'; continue; }
        if (!v) { free[d].push(slots[i]); totalFree++; continue; }
        totalBusy++;
        if (withRoles) {
          if (withRoles[d][i] === 'support') supportCount++;
          else mainCount++;
        }
      }
    }
    return { free, totalFree, totalBusy, mainCount, supportCount };
  };

  const trainerViews = trainers.map(t => {
    const grid = tGrid[t.name], roles = tRole[t.name];
    const s = summarise(grid, roles);
    return {
      id: String(t._id || t.id || t.name),
      name: t.name, grid, roles,
      free: s.free, totalFree: s.totalFree,
      mainCount: s.mainCount, supportCount: s.supportCount,
    };
  });

  const venueViews = venues.map(v => {
    const grid = vGrid[v.name];
    const s = summarise(grid, null);
    return {
      id: String(v._id || v.id || v.name),
      name: v.name, grid,
      free: s.free, totalFree: s.totalFree, totalBusy: s.totalBusy,
    };
  });

  return {
    slots, days, lunchIndex,
    trainers: trainerViews,
    venues: venueViews,
    batches: batchCards,
    groups: groupViews,
    upcoming,
    conflicts,
  };
}
