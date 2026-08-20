import { Router } from 'express';
import mongoose from 'mongoose';
import Config from '../models/Config.js';
import YearGroup from '../models/YearGroup.js';
import Trainer from '../models/Trainer.js';
import Venue from '../models/Venue.js';
import Batch from '../models/Batch.js';
import { requireAdmin } from '../middleware/auth.js';
import { wrap } from '../middleware/asyncRoute.js';

const router = Router();
router.use(requireAdmin);          // nothing below this line is public

const str = v => String(v ?? '').trim();
const fail = (res, status, error) => res.status(status).json({ error });

/* ───────────────────────── config: the period grid ───────────────────────── */

router.get('/config', wrap(async (_req, res) => {
  res.json(await Config.findOne({ key: 'default' }).lean());
}));

router.put('/config', wrap(async (req, res) => {
  const slots = Array.isArray(req.body?.slots) ? req.body.slots.map(str).filter(Boolean) : null;
  const days = Array.isArray(req.body?.days) ? req.body.days.map(str).filter(Boolean) : null;
  const lunchIndex = Number(req.body?.lunchIndex);

  if (!slots?.length) return fail(res, 400, 'At least one time slot is required');
  if (!days?.length) return fail(res, 400, 'At least one teaching day is required');
  if (!Number.isInteger(lunchIndex) || lunchIndex < 0 || lunchIndex >= slots.length) {
    return fail(res, 400, 'Lunch slot must be one of the time slots');
  }

  /* Shrinking the grid would leave sessions pointing at periods or days that
     no longer exist, so refuse until those sessions are moved. */
  const orphans = [];
  for (const b of await Batch.find().lean()) {
    for (const s of b.sessions || []) {
      if (!days.includes(s.day)) orphans.push(`${b.name} — ${s.subject} on ${s.day}`);
      else if (s.slots.some(i => i >= slots.length)) orphans.push(`${b.name} — ${s.subject} (${s.day})`);
    }
  }
  if (orphans.length) {
    return fail(res, 409, `These sessions would fall outside the new grid: ${[...new Set(orphans)].join('; ')}`);
  }

  const config = await Config.findOneAndUpdate(
    { key: 'default' }, { slots, days, lunchIndex }, { new: true, upsert: true },
  ).lean();
  res.json(config);
}));

/* ───────────────────────── year groups ───────────────────────── */

router.get('/groups', wrap(async (_req, res) => {
  res.json(await YearGroup.find().sort({ order: 1 }).lean());
}));

router.post('/groups', wrap(async (req, res) => {
  const name = str(req.body?.name);
  if (!name) return fail(res, 400, 'Year group name is required');
  if (await YearGroup.findOne({ name })) return fail(res, 409, `"${name}" already exists`);

  const last = await YearGroup.findOne().sort({ order: -1 }).lean();
  res.status(201).json(await YearGroup.create({
    name,
    order: req.body?.order ?? ((last?.order ?? -1) + 1),
    pending: !!req.body?.pending,
    note: str(req.body?.note),
  }));
}));

router.put('/groups/:id', wrap(async (req, res) => {
  const group = await YearGroup.findById(req.params.id);
  if (!group) return fail(res, 404, 'Year group not found');

  const name = str(req.body?.name) || group.name;
  if (name !== group.name) {
    if (await YearGroup.findOne({ name })) return fail(res, 409, `"${name}" already exists`);
    /* batches reference the group by name, so carry them along */
    await Batch.updateMany({ group: group.name }, { group: name });
  }

  group.name = name;
  if (req.body?.order !== undefined) group.order = Number(req.body.order);
  if (req.body?.pending !== undefined) group.pending = !!req.body.pending;
  if (req.body?.note !== undefined) group.note = str(req.body.note);
  await group.save();
  res.json(group);
}));

router.delete('/groups/:id', wrap(async (req, res) => {
  const group = await YearGroup.findById(req.params.id);
  if (!group) return fail(res, 404, 'Year group not found');

  const used = await Batch.countDocuments({ group: group.name });
  if (used) return fail(res, 409, `${group.name} still has ${used} batch(es) — move or delete those first`);

  await group.deleteOne();
  res.json({ ok: true });
}));

/* ───────────────────────── trainers ───────────────────────── */

router.get('/trainers', wrap(async (_req, res) => {
  res.json(await Trainer.find().sort({ name: 1 }).lean());
}));

router.post('/trainers', wrap(async (req, res) => {
  const name = str(req.body?.name);
  if (!name) return fail(res, 400, 'Trainer name is required');
  if (await Trainer.findOne({ name })) return fail(res, 409, `${name} is already on the list`);

  res.status(201).json(await Trainer.create({
    name, email: str(req.body?.email), phone: str(req.body?.phone),
    active: req.body?.active !== false,
  }));
}));

router.put('/trainers/:id', wrap(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) return fail(res, 404, 'Trainer not found');

  const name = str(req.body?.name) || trainer.name;
  if (name !== trainer.name) {
    if (await Trainer.findOne({ name })) return fail(res, 409, `${name} is already on the list`);
    /* sessions hold trainer names, so a rename has to reach into them */
    await Batch.updateMany({ 'sessions.mainTrainers': trainer.name },
      { $set: { 'sessions.$[s].mainTrainers.$[t]': name } },
      { arrayFilters: [{ 's.mainTrainers': trainer.name }, { t: trainer.name }] });
    await Batch.updateMany({ 'sessions.supportTrainers': trainer.name },
      { $set: { 'sessions.$[s].supportTrainers.$[t]': name } },
      { arrayFilters: [{ 's.supportTrainers': trainer.name }, { t: trainer.name }] });
  }

  trainer.name = name;
  if (req.body?.email !== undefined) trainer.email = str(req.body.email);
  if (req.body?.phone !== undefined) trainer.phone = str(req.body.phone);
  if (req.body?.active !== undefined) trainer.active = !!req.body.active;
  await trainer.save();
  res.json(trainer);
}));

router.delete('/trainers/:id', wrap(async (req, res) => {
  const trainer = await Trainer.findById(req.params.id);
  if (!trainer) return fail(res, 404, 'Trainer not found');

  /* Pull them out of every session too, otherwise the derived grids would
     still show a trainer who no longer exists. */
  const pulled = await Batch.updateMany({}, {
    $pull: { 'sessions.$[].mainTrainers': trainer.name, 'sessions.$[].supportTrainers': trainer.name },
  });
  await trainer.deleteOne();
  res.json({ ok: true, sessionsTouched: pulled.modifiedCount });
}));

/* ───────────────────────── venues ───────────────────────── */

router.get('/venues', wrap(async (_req, res) => {
  res.json(await Venue.find().sort({ name: 1 }).lean());
}));

router.post('/venues', wrap(async (req, res) => {
  const name = str(req.body?.name);
  if (!name) return fail(res, 400, 'Hall name is required');
  if (await Venue.findOne({ name })) return fail(res, 409, `"${name}" already exists`);

  res.status(201).json(await Venue.create({
    name, capacity: Number(req.body?.capacity) || 0, active: req.body?.active !== false,
  }));
}));

router.put('/venues/:id', wrap(async (req, res) => {
  const venue = await Venue.findById(req.params.id);
  if (!venue) return fail(res, 404, 'Hall not found');

  const name = str(req.body?.name) || venue.name;
  if (name !== venue.name) {
    if (await Venue.findOne({ name })) return fail(res, 409, `"${name}" already exists`);
    /* venue lives on each session now, not on the batch, so the rename has to
       reach inside the sessions array */
    await Batch.updateMany(
      { 'sessions.venue': venue.name },
      { $set: { 'sessions.$[s].venue': name } },
      { arrayFilters: [{ 's.venue': venue.name }] },
    );
  }

  venue.name = name;
  if (req.body?.capacity !== undefined) venue.capacity = Number(req.body.capacity) || 0;
  if (req.body?.active !== undefined) venue.active = !!req.body.active;
  await venue.save();
  res.json(venue);
}));

router.delete('/venues/:id', wrap(async (req, res) => {
  const venue = await Venue.findById(req.params.id);
  if (!venue) return fail(res, 404, 'Hall not found');

  const freed = await Batch.updateMany(
    { 'sessions.venue': venue.name },
    { $set: { 'sessions.$[s].venue': '' } },
    { arrayFilters: [{ 's.venue': venue.name }] },
  );
  await venue.deleteOne();
  res.json({ ok: true, sessionsUnassigned: freed.modifiedCount });
}));

/* ───────────────────────── batches + their sessions ───────────────────────── */

async function validateSessions(raw, res) {
  const config = await Config.findOne({ key: 'default' }).lean();
  const venueNames = new Set((await Venue.find().lean()).map(v => v.name));
  const sessions = [];

  for (const s of Array.isArray(raw) ? raw : []) {
    const day = str(s?.day);
    if (!config.days.includes(day)) { fail(res, 400, `"${day || '(blank)'}" is not a teaching day`); return null; }

    const slots = [...new Set((Array.isArray(s?.slots) ? s.slots : []).map(Number))]
      .filter(i => Number.isInteger(i) && i >= 0 && i < config.slots.length)
      .sort((a, b) => a - b);
    if (!slots.length) { fail(res, 400, `Pick at least one period for the ${day} session`); return null; }

    const subject = str(s?.subject);
    if (!subject) { fail(res, 400, `The ${day} session needs a subject`); return null; }

    const venue = str(s?.venue);
    if (venue && !venueNames.has(venue)) { fail(res, 400, `"${venue}" is not a known hall`); return null; }

    const clean = list => [...new Set((Array.isArray(list) ? list : []).map(str).filter(Boolean))];
    const mainTrainers = clean(s?.mainTrainers);
    const supportTrainers = clean(s?.supportTrainers).filter(n => !mainTrainers.includes(n));

    sessions.push({ day, slots, subject, venue, mainTrainers, supportTrainers });
  }
  return sessions;
}

router.get('/batches', wrap(async (_req, res) => {
  res.json(await Batch.find().sort({ order: 1, name: 1 }).lean());
}));

router.get('/batches/:id', wrap(async (req, res) => {
  const batch = await Batch.findById(req.params.id).lean();
  if (!batch) return fail(res, 404, 'Batch not found');
  res.json(batch);
}));

router.post('/batches', wrap(async (req, res) => {
  const name = str(req.body?.name);
  const group = str(req.body?.group);
  if (!name) return fail(res, 400, 'Batch name is required');
  if (await Batch.findOne({ name })) return fail(res, 409, `"${name}" already exists`);
  if (!await YearGroup.findOne({ name: group })) return fail(res, 400, 'Pick an existing year group');

  const sessions = await validateSessions(req.body?.sessions, res);
  if (!sessions) return;

  const last = await Batch.findOne().sort({ order: -1 }).lean();
  res.status(201).json(await Batch.create({
    name, group,
    dept: str(req.body?.dept),
    count: Number(req.body?.count) || 0,
    order: req.body?.order ?? ((last?.order ?? -1) + 1),
    sessions,
  }));
}));

router.put('/batches/:id', wrap(async (req, res) => {
  const batch = await Batch.findById(req.params.id);
  if (!batch) return fail(res, 404, 'Batch not found');

  const name = str(req.body?.name) || batch.name;
  if (name !== batch.name && await Batch.findOne({ name })) return fail(res, 409, `"${name}" already exists`);

  if (req.body?.group !== undefined) {
    const group = str(req.body.group);
    if (!await YearGroup.findOne({ name: group })) return fail(res, 400, 'Pick an existing year group');
    batch.group = group;
  }
  if (req.body?.sessions !== undefined) {
    const sessions = await validateSessions(req.body.sessions, res);
    if (!sessions) return;
    batch.sessions = sessions;
  }

  batch.name = name;
  if (req.body?.dept !== undefined) batch.dept = str(req.body.dept);
  if (req.body?.count !== undefined) batch.count = Number(req.body.count) || 0;
  if (req.body?.order !== undefined) batch.order = Number(req.body.order);
  await batch.save();
  res.json(batch);
}));

router.delete('/batches/:id', wrap(async (req, res) => {
  const batch = await Batch.findByIdAndDelete(req.params.id);
  if (!batch) return fail(res, 404, 'Batch not found');
  res.json({ ok: true });
}));

/* ───────────────────────── availability lookup ─────────────────────────
   Answers "who and what is already taken at these times". One `when` per
   day+period set, e.g. ?when=Monday:0,1&when=Tuesday:2,3 — a single session
   sends one, the hall picker sends every session on the batch, because a hall
   has to be free at all of them to be worth assigning.

   `excludeBatch` leaves the batch being edited out, so its own sessions do
   not read as clashes with itself. */

router.get('/availability', wrap(async (req, res) => {
  const raw = req.query.when === undefined ? [] : [].concat(req.query.when);
  const when = [];

  for (const entry of raw) {
    const [dayPart, slotPart = ''] = str(entry).split(':');
    const day = dayPart.trim();
    const slots = [...new Set(slotPart.split(',').map(Number).filter(Number.isInteger))];
    if (day && slots.length) when.push({ day, slots });
  }

  if (!when.length) return fail(res, 400, 'At least one when=Day:slot,slot is required');

  const exclude = str(req.query.excludeBatch);
  const filter = exclude && mongoose.isValidObjectId(exclude) ? { _id: { $ne: exclude } } : {};
  const [batches, trainers, venues, config] = await Promise.all([
    Batch.find(filter).lean(),
    Trainer.find({ active: true }).sort({ name: 1 }).lean(),
    Venue.find({ active: true }).sort({ name: 1 }).lean(),
    Config.findOne({ key: 'default' }).lean(),
  ]);

  const slotName = i => config?.slots?.[i] || `slot ${i + 1}`;
  const trainerHits = new Map();      // name -> [{day, slot, batch}]
  const venueHits = new Map();
  const push = (map, key, hit) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(hit);
  };

  for (const b of batches) {
    for (const s of b.sessions || []) {
      for (const w of when) {
        if (s.day !== w.day) continue;
        const overlap = s.slots.filter(i => w.slots.includes(i));
        if (!overlap.length) continue;

        for (const i of overlap) {
          const hit = { day: s.day, slotIndex: i, slot: slotName(i), batch: b.name };
          for (const n of [...(s.mainTrainers || []), ...(s.supportTrainers || [])]) push(trainerHits, n, hit);
          if (b.venue) push(venueHits, b.venue, hit);
        }
      }
    }
  }

  /* One line the UI can show as-is: "Mon 9:00–9:50 · AI Ready 2028 · Batch-1". */
  const summarise = hits => {
    const seen = new Set();
    return hits.filter(h => {
      const k = `${h.day}|${h.slotIndex}|${h.batch}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const shape = (list, map) => list.map(x => {
    const conflicts = summarise(map.get(x.name) || []);
    return {
      name: x.name,
      free: conflicts.length === 0,
      busyWith: conflicts[0]?.batch || null,      // kept for the single-session picker
      conflicts,
    };
  });

  res.json({ when, trainers: shape(trainers, trainerHits), venues: shape(venues, venueHits) });
}));

export default router;
