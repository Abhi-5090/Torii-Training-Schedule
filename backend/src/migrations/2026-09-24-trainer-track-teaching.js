/*
 * Migrates track from ('technical' | 'non-technical') to ('teaching' | 'non-teaching')
 * for all existing trainers in MongoDB.
 *
 * Specific trainers to be in Non-Teaching:
 *   - Prasanth K
 *   - Kiran Immandi (or Kiran)
 *   - Satish
 *   - Peter
 *   - Hemavathi (or Hema)
 *
 * All other trainers are set to Teaching.
 *
 * Run with:
 *   node src/migrations/2026-09-24-trainer-track-teaching.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import Trainer from '../models/Trainer.js';

const NON_TEACHING_NAMES = [
  'Prasanth K',
  'Kiran Immandi',
  'Kiran',
  'Satish',
  'Peter',
  'Hemavathi',
  'Hema',
];

async function run() {
  await connectDB();

  const allTrainers = await Trainer.find({});
  let teachingCount = 0;
  let nonTeachingCount = 0;

  for (const trainer of allTrainers) {
    const isNonTeaching = trainer.track === 'non-technical' ||
      trainer.track === 'non-teaching' ||
      NON_TEACHING_NAMES.some(n => n.toLowerCase() === trainer.name.trim().toLowerCase());

    const track = isNonTeaching ? 'non-teaching' : 'teaching';

    trainer.track = track;
    await trainer.save();

    if (isNonTeaching) {
      nonTeachingCount++;
      console.log(`  [Non-Teaching]  ${trainer.name}`);
    } else {
      teachingCount++;
      console.log(`  [Teaching]      ${trainer.name}`);
    }
  }

  console.log(`\n  Done: ${teachingCount} Teaching trainers, ${nonTeachingCount} Non-Teaching trainers updated.\n`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
