import mongoose from 'mongoose';

/* Just an identity. Every trainer's timetable is derived from the sessions
   that name them, so there is no grid stored here. */
const trainerSchema = new mongoose.Schema({
  name:   { type: String, required: true, unique: true, trim: true },
  email:  { type: String, default: '', trim: true },
  phone:  { type: String, default: '', trim: true },
  track:  { type: String, enum: ['teaching', 'non-teaching', 'technical', 'non-technical'], default: 'teaching' },
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Trainer', trainerSchema);
