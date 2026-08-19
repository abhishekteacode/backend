const fs = require('fs');
const path = require('path');
const { connectDB } = require('../db');
const Location = require('../models/Location');
const Session = require('../models/Session');
const Device = require('../models/Device');

async function migrate() {
  console.log('🚀 Starting JSON -> MongoDB Data Migration...');
  await connectDB();

  // 1. Migrate Devices
  const devicesFile = path.join(__dirname, '..', 'devices_db.json');
  if (fs.existsSync(devicesFile)) {
    try {
      const raw = fs.readFileSync(devicesFile, 'utf8');
      const devicesMap = JSON.parse(raw || '{}');
      const devices = Object.values(devicesMap);
      if (devices.length > 0) {
        console.log(`📱 Migrating ${devices.length} device(s)...`);
        for (const dev of devices) {
          await Device.updateOne(
            { id: dev.id },
            { $set: dev },
            { upsert: true }
          );
        }
        console.log('✅ Devices migration finished.');
      }
    } catch (e) {
      console.error('Error migrating devices:', e.message);
    }
  }

  // 2. Migrate Sessions
  const sessionsFile = path.join(__dirname, '..', 'sessions_db.json');
  if (fs.existsSync(sessionsFile)) {
    try {
      const raw = fs.readFileSync(sessionsFile, 'utf8');
      const sessionsMap = JSON.parse(raw || '{}');
      const sessions = Object.values(sessionsMap);
      if (sessions.length > 0) {
        console.log(`⏱️ Migrating ${sessions.length} session(s)...`);
        for (const sess of sessions) {
          await Session.updateOne(
            { id: sess.id },
            { $set: sess },
            { upsert: true }
          );
        }
        console.log('✅ Sessions migration finished.');
      }
    } catch (e) {
      console.error('Error migrating sessions:', e.message);
    }
  }

  // 3. Migrate Locations
  let locationsFile = path.join(__dirname, '..', 'locations_db.json');
  if (!fs.existsSync(locationsFile) || fs.statSync(locationsFile).size < 10) {
    const bakFile = path.join(__dirname, '..', 'locations_db.json.bak');
    if (fs.existsSync(bakFile)) {
      locationsFile = bakFile;
    }
  }

  if (fs.existsSync(locationsFile)) {
    try {
      console.log(`📍 Reading locations from ${path.basename(locationsFile)}...`);
      const raw = fs.readFileSync(locationsFile, 'utf8');
      const parsed = JSON.parse(raw || '[]');
      if (parsed.length > 0) {
        console.log(`⏳ Migrating ${parsed.length} location records to MongoDB...`);
        const BATCH_SIZE = 2000;
        let processed = 0;

        for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
          const batch = parsed.slice(i, i + BATCH_SIZE).map((loc) => {
            const lat = loc.coords?.latitude ?? loc.latitude ?? 0;
            const lng = loc.coords?.longitude ?? loc.longitude ?? 0;
            const devId = loc.device_id || loc.deviceId || 'default-device';
            const timestamp = loc.timestamp ? new Date(loc.timestamp) : new Date();

            return {
              id: loc.id || `loc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              device_id: devId,
              uuid: loc.uuid || '',
              timestamp,
              coords: {
                latitude: lat,
                longitude: lng,
                accuracy: loc.coords?.accuracy || 0,
                altitude: loc.coords?.altitude || 0,
                altitudeAccuracy: loc.coords?.altitudeAccuracy || 0,
                speed: loc.coords?.speed || 0,
                speedAccuracy: loc.coords?.speedAccuracy || 0,
                heading: loc.coords?.heading || 0,
                headingAccuracy: loc.coords?.headingAccuracy || 0
              },
              location: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              is_moving: !!loc.is_moving,
              odometer: loc.odometer || 0,
              activity: loc.activity || { type: 'unknown', confidence: 0 },
              battery: loc.battery || { level: 1, is_charging: false },
              permission: loc.permission || {}
            };
          });

          const ops = batch.map(doc => ({
            updateOne: {
              filter: { uuid: doc.uuid || doc.id, timestamp: doc.timestamp },
              update: { $set: doc },
              upsert: true
            }
          }));

          await Location.bulkWrite(ops);
          processed += batch.length;
          console.log(`   Migrated ${processed} / ${parsed.length} locations...`);
        }
        console.log('✅ Location records migration finished.');
      }
    } catch (e) {
      console.error('Error migrating locations:', e.message);
    }
  }

  console.log('🎉 Migration completed successfully!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
