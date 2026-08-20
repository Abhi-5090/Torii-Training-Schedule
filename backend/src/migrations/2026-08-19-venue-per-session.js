/*
 * One-off: venue used to live on the batch (one hall for every session).
 * It now lives on each session, so a batch can meet in different halls on
 * different days. This carries every batch's existing hall down onto each
 * of its sessions that doesn't already have one, then drops the old field.
 *
 *   node src/migrations/2026-08-19-venue-per-session.js
 *
 * Safe to run more than once — a session that already has a venue is left
 * alone, and $unset on a field that's already gone is a no-op.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';

async function run() {
  await connectDB();
  const col = mongoose.connection.collection('batches');

  const batches = await col.find({}).toArray();
  let touched = 0, sessionsSet = 0;

  for (const b of batches) {
    const oldVenue = b.venue;
    if (!oldVenue) continue;

    const sessions = (b.sessions || []).map(s => {
      if (s.venue) return s;
      sessionsSet++;
      return { ...s, venue: oldVenue };
    });

    await col.updateOne({ _id: b._id }, { $set: { sessions }, $unset: { venue: '' } });
    touched++;
  }

  // batches with no top-level venue at all still get the field removed and
  // every session guaranteed a venue key, so the schema is uniform.
  await col.updateMany({ venue: { $exists: true } }, { $unset: { venue: '' } });
  await col.updateMany(
    { 'sessions.venue': { $exists: false } },
    { $set: { 'sessions.$[].venue': '' } },
  );

  console.log(`  migrated ${touched} batch(es), set venue on ${sessionsSet} session(s)`);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
