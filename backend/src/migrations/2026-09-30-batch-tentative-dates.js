/*
 * Migration: 2026-09-30-batch-tentative-dates.js
 * Sets realistic tentative training dates (startDate and endDate) for existing
 * batches across September and October 2026.
 *
 * Run with:
 *   node src/migrations/2026-09-30-batch-tentative-dates.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import Batch from '../models/Batch.js';

const BATCH_DATES = {
  // Final Year
  'AI Ready 2027 · Batch-1': { startDate: '2026-09-01', endDate: '2026-10-31' }, // Sep - Oct
  'VLSI 2027':               { startDate: '2026-09-01', endDate: '2026-09-30' }, // Sep only

  // Third Year
  'AI Ready 2028 · Batch-1': { startDate: '2026-09-01', endDate: '2026-09-30' }, // Sep only
  'AI Ready 2028 · Batch-2': { startDate: '2026-10-01', endDate: '2026-10-31' }, // Oct only
  'VLSI 2028':               { startDate: '2026-10-01', endDate: '2026-10-31' }, // Oct only

  // Second Year
  'Industry Readiness Batch - 1': { startDate: '2026-09-01', endDate: '2026-10-31' }, // Sep - Oct
  'Industry Readiness Batch - 2': { startDate: '2026-09-01', endDate: '2026-10-31' }, // Sep - Oct
  'Industry Readiness Batch - 3': { startDate: '2026-09-01', endDate: '2026-09-30' }, // Sep only
  'Industry Readiness Batch - 4': { startDate: '2026-10-01', endDate: '2026-10-31' }, // Oct only
  '2nd Year Credit Course':       { startDate: '2026-09-01', endDate: '2026-10-31' }, // Sep - Oct
  'Placement Training (MCA)':     { startDate: '2026-10-01', endDate: '2026-10-31' }, // Oct only

  // First Year
  'C · Batch-1':      { startDate: '2026-09-01', endDate: '2026-09-30' }, // Sep only
  'C · Batch-2':      { startDate: '2026-09-01', endDate: '2026-09-30' }, // Sep only
  'C · Batch-3':      { startDate: '2026-10-01', endDate: '2026-10-31' }, // Oct only
  'C · Batch-4':      { startDate: '2026-10-01', endDate: '2026-10-31' }, // Oct only
  'Python · Batch-1': { startDate: '2026-10-01', endDate: '2026-10-31' }, // Oct only
  'Python · Batch-2': { startDate: '2026-10-01', endDate: '2026-10-31' }, // Oct only
};

async function run() {
  await connectDB();

  const batches = await Batch.find({});
  let updatedCount = 0;

  for (const b of batches) {
    const dates = BATCH_DATES[b.name.trim()] || { startDate: '2026-09-01', endDate: '2026-10-31' };
    b.startDate = dates.startDate;
    b.endDate = dates.endDate;
    await b.save();
    updatedCount++;
    console.log(`  Updated "${b.name}" -> ${dates.startDate} to ${dates.endDate}`);
  }

  console.log(`\n  Done: ${updatedCount} batches updated with tentative schedule dates.\n`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
