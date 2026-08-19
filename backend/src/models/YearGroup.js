import mongoose from 'mongoose';

/* A year band — "Final Year", "Third Year", "First Year".
   `pending` renders the "will be updated soon" card instead of batch cards. */
const yearGroupSchema = new mongoose.Schema({
  name:    { type: String, required: true, unique: true, trim: true },
  order:   { type: Number, default: 0 },
  pending: { type: Boolean, default: false },
  note:    { type: String, default: '' },
}, { timestamps: true });

export default mongoose.model('YearGroup', yearGroupSchema);
