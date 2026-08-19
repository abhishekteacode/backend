const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    id: { type: String, index: true },
    device_id: { type: String, required: true, index: true },
    uuid: { type: String, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    coords: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      accuracy: { type: Number, default: 0 },
      altitude: { type: Number, default: 0 },
      altitudeAccuracy: { type: Number, default: 0 },
      speed: { type: Number, default: 0 },
      speedAccuracy: { type: Number, default: 0 },
      heading: { type: Number, default: 0 },
      headingAccuracy: { type: Number, default: 0 }
    },
    // GeoJSON for spatial queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    is_moving: { type: Boolean, default: false },
    odometer: { type: Number, default: 0 },
    activity: {
      type: { type: String, default: 'unknown' },
      confidence: { type: Number, default: 0 }
    },
    battery: {
      level: { type: Number, default: 1 },
      is_charging: { type: Boolean, default: false },
      is_power_save_mode: { type: Boolean, default: false },
      isPowerSaveMode: { type: Boolean, default: false }
    },
    permission: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    strict: false // Allow extra fields without breaking
  }
);

locationSchema.index({ location: '2dsphere' });
locationSchema.index({ device_id: 1, timestamp: -1 });

module.exports = mongoose.model('Location', locationSchema);
