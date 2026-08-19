const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    disconnected: { type: Boolean, default: false },
    firstSeenMs: { type: Number, default: Date.now },
    lastSeenMs: { type: Number, default: Date.now },
    totalPoints: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Device', deviceSchema);
