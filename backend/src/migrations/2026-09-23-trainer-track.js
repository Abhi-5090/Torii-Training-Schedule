/*
 * Sets track ('technical' | 'non-technical') on all existing trainers in MongoDB.
 *
 * Specific trainers to be moved to Non-Technical:
 *   - Prasanth K
 *   - Kiran Immandi (or Kiran)
 *   - Satish
 *   - Peter
 *   - Hemavathi (or Hema)
 *
 * All other trainers are set to Technical.
 *
 * Run with:
 *   node src/migrations/2026-09-23-trainer-track.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../db.js';
import Trainer from '../models/Trainer.js';

const NON_TECH_NAMES = [
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
  let techCount = 0;
  let nonTechCount = 0;

  for (const trainer of allTrainers) {
    const isNonTech = NON_TECH_NAMES.some(
      n => n.toLowerCase() === trainer.name.trim().toLowerCase()
    );
    const track = isNonTech ? 'non-technical' : 'technical';

    trainer.track = track;
    await trainer.save();

    if (isNonTech) {
      nonTechCount++;
      console.log(`  [Non-Tech]  ${trainer.name}`);
    } else {
      techCount++;
      console.log(`  [Tech]      ${trainer.name}`);
    }
  }

  console.log(`\n  Done: ${techCount} Technical trainers, ${nonTechCount} Non-Technical trainers updated.\n`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
