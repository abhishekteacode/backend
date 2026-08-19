const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    device_id: { type: String, required: true, index: true },
    tag: { type: String, default: '' },
    startTimeMs: { type: Number, default: Date.now },
    endTimeMs: { type: Number, default: Date.now },
    isOpen: { type: Boolean, default: true },
    pointCount: { type: Number, default: 0 },
    distanceMeters: { type: Number, default: 0 },
    points: { type: Array, default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
