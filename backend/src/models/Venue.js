import mongoose from 'mongoose';

const venueSchema = new mongoose.Schema({
  name:     { type: String, required: true, unique: true, trim: true },
  capacity: { type: Number, default: 0 },
  active:   { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model('Venue', venueSchema);
