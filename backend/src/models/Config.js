import mongoose from 'mongoose';

/* One document, always. Holds the period grid every other view is drawn on. */
const configSchema = new mongoose.Schema({
  key:        { type: String, default: 'default', unique: true },
  slots:      { type: [String], required: true },
  days:       { type: [String], required: true },
  lunchIndex: { type: Number, default: 3 },
}, { timestamps: true });

export default mongoose.model('Config', configSchema);
