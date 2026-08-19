import mongoose from 'mongoose';

/* Trainers and the venue are held by name rather than by ObjectId: the board
   is keyed on names everywhere, and a rename is a deliberate admin action that
   the rename cascade in routes/trainers.js and routes/venues.js keeps in step. */
const sessionSchema = new mongoose.Schema({
  day:             { type: String, required: true },
  slots:           { type: [Number], required: true },   // indexes into Config.slots
  subject:         { type: String, required: true, trim: true },
  mainTrainers:    { type: [String], default: [] },
  supportTrainers: { type: [String], default: [] },
}, { _id: true });

const batchSchema = new mongoose.Schema({
  name:     { type: String, required: true, unique: true, trim: true },
  group:    { type: String, required: true },            // YearGroup.name
  dept:     { type: String, default: '' },
  venue:    { type: String, default: '' },               // Venue.name, '' = unassigned
  count:    { type: Number, default: 0 },
  order:    { type: Number, default: 0 },
  sessions: { type: [sessionSchema], default: [] },
}, { timestamps: true });

export default mongoose.model('Batch', batchSchema);
