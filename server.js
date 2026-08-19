const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./db');
const Location = require('./models/Location');
const Session = require('./models/Session');
const Device = require('./models/Device');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for cross-origin client requests
app.use(cors());

// Parse incoming JSON requests (up to 10MB to support large batch sync payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware to strip '/api-proxy' prefix if frontend calls /api-proxy/*
app.use(async (req, res, next) => {
  if (req.url.startsWith('/api-proxy/')) {
    req.url = req.url.replace('/api-proxy', '');
  } else if (req.url === '/api-proxy') {
    req.url = '/';
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Database connection error: ' + err.message });
  }
});

// Serve static frontend files from exported Next.js app ('frontend/out') if available, otherwise 'public'
const frontendOutPath = path.join(__dirname, 'frontend', 'out');
if (fs.existsSync(frontendOutPath)) {
  app.use(express.static(frontendOutPath));
}
app.use(express.static(path.join(__dirname, 'public')));

// Calculate distance in meters between two lat/lng points (Haversine formula)
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /devices
 * Returns list of registered devices with connection status
 */
app.get('/devices', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const devices = await Device.find().lean();
    return res.json({
      total: devices.length,
      devices
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /devices/disconnect
 * Disconnect/block a specific mobile device from streaming location updates
 */
app.post('/devices/disconnect', async (req, res) => {
  const body = req.body || {};
  const device_id = body.device_id || body.deviceId || req.query.device_id;

  if (!device_id) {
    return res.status(400).json({ status: 'error', message: 'device_id is required' });
  }

  try {
    const device = await Device.findOneAndUpdate(
      { id: device_id },
      {
        $set: { disconnected: true },
        $setOnInsert: { id: device_id, firstSeenMs: Date.now(), lastSeenMs: Date.now(), totalPoints: 0 }
      },
      { upsert: true, new: true }
    ).lean();

    console.log(`🔌 Disconnected device [${device_id}] by server administration.`);

    return res.json({
      status: 'ok',
      message: `Device [${device_id}] disconnected successfully`,
      device
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /devices/reconnect
 * Restore connection status for a disconnected mobile device
 */
app.post('/devices/reconnect', async (req, res) => {
  const body = req.body || {};
  const device_id = body.device_id || body.deviceId || req.query.device_id;

  if (!device_id) {
    return res.status(400).json({ status: 'error', message: 'device_id is required' });
  }

  try {
    const device = await Device.findOneAndUpdate(
      { id: device_id },
      { $set: { disconnected: false } },
      { new: true }
    ).lean();

    if (!device) {
      return res.status(404).json({ status: 'error', message: 'Device not found' });
    }

    console.log(`⚡ Reconnected device [${device_id}].`);

    return res.json({
      status: 'ok',
      message: `Device [${device_id}] reconnected successfully`,
      device
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /sessions/start
 * Explicit endpoint to open a new tracking session
 */
app.post('/sessions/start', async (req, res) => {
  const body = req.body || {};
  const device_id = body.device_id || body.deviceId || req.query.device_id || 'unknown';
  const tag = body.tag || `Tracking Session ${new Date().toLocaleTimeString()}`;
  const session_id = body.session_id || body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const newSession = await Session.create({
      id: session_id,
      device_id,
      tag,
      startTimeMs: Date.now(),
      endTimeMs: Date.now(),
      isOpen: true,
      pointCount: 0,
      distanceMeters: 0,
      points: []
    });

    console.log(`🚀 Started new tracking session [ID: ${session_id}] for device [${device_id}]`);

    return res.status(200).json({
      status: 'ok',
      session_id,
      session: newSession
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /sessions/stop
 * Explicit endpoint to close an active tracking session
 */
app.post('/sessions/stop', async (req, res) => {
  const body = req.body || {};
  const session_id = body.session_id || body.sessionId || req.query.session_id;

  if (!session_id) {
    return res.status(400).json({ status: 'error', message: 'session_id is required' });
  }

  try {
    const session = await Session.findOneAndUpdate(
      { id: session_id },
      { $set: { isOpen: false, endTimeMs: Date.now() } },
      { new: true }
    ).lean();

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session ID not found' });
    }

    console.log(`🏁 Closed tracking session [ID: ${session_id}] (Total Points: ${session.pointCount}, Distance: ${(session.distanceMeters || 0).toFixed(1)}m)`);

    return res.status(200).json({
      status: 'ok',
      session
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /sessions
 * Returns all tracking sessions metadata summary
 */
app.get('/sessions', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const sessions = await Session.find({}, { points: 0 }).lean();
    return res.json({
      total: sessions.length,
      sessions
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /sessions/:id
 * Fetch single session details with full point list
 */
app.get('/sessions/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  try {
    const session = await Session.findOne({ id: req.params.id }).lean();
    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    return res.json({
      status: 'ok',
      session
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * DELETE /sessions/:id
 * Delete a specific session and all its associated location points.
 */
app.delete('/sessions/:id', async (req, res) => {
  const sessionId = req.params.id;

  try {
    const session = await Session.findOneAndDelete({ id: sessionId });
    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Session not found' });
    }

    const deleteRes = await Location.deleteMany({ session_id: sessionId });

    console.log(`\n🗑️ Deleted session [${sessionId}] and ${deleteRes.deletedCount} associated location point(s).`);

    return res.json({
      status: 'ok',
      message: `Deleted session ${sessionId}`,
      deletedSessionId: sessionId,
      deletedPoints: deleteRes.deletedCount
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * POST /locations
 * Receiver endpoint for incoming location updates from TrackIt / background geolocation.
 * Rejects payloads if the device is disconnected.
 */
app.post('/locations', async (req, res) => {
  const body = req.body || {};
  const topDeviceId = req.query.device_id || req.query.deviceId || body.device_id || body.deviceId || 'unknown';

  try {
    // Check if device is disconnected
    const targetDevice = await Device.findOne({ id: topDeviceId }).lean();
    if (targetDevice && targetDevice.disconnected) {
      console.log(`⛔ Rejected incoming location payload from DISCONNECTED device: [${topDeviceId}]`);
      return res.status(403).json({
        status: 'disconnected',
        message: `Device [${topDeviceId}] is disconnected by server administration`,
        disconnected: true
      });
    }

    const topSessionId = req.query.session_id || req.query.sessionId || body.session_id || body.sessionId || body.sessionID;
    let rawItems = [];

    if (Array.isArray(body)) {
      rawItems = body;
    } else if (Array.isArray(body.location)) {
      rawItems = body.location;
    } else if (Array.isArray(body.locations)) {
      rawItems = body.locations;
    } else if (Array.isArray(body[''])) {
      rawItems = body[''];
    } else if (body.location && typeof body.location === 'object') {
      rawItems = [body.location];
    } else if (body.locations && typeof body.locations === 'object') {
      rawItems = [body.locations];
    } else if (body.coords) {
      rawItems = [body];
    } else {
      rawItems = [body];
    }

    const processedDocs = [];
    const deviceUpdates = {};
    const sessionUpdates = {};

    for (const item of rawItems) {
      if (!item) continue;

      const locObj = item.location && typeof item.location === 'object' && !Array.isArray(item.location)
        ? item.location
        : item;

      const device_id = item.device_id || item.deviceId || locObj.device_id || locObj.deviceId || topDeviceId;
      const session_id = item.session_id || item.sessionId || item.sessionID || locObj.session_id || locObj.sessionId || locObj.sessionID || topSessionId || `session_${device_id}`;
      const coords = locObj.coords || locObj;

      const hasCoords = coords && coords.latitude !== undefined && coords.longitude !== undefined;
      const isEvent = locObj.event || locObj.permission || item.event || item.permission;

      if (hasCoords || isEvent) {
        const recordId = item.id || locObj.id || `loc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const lat = coords?.latitude ?? 0;
        const lng = coords?.longitude ?? 0;

        const doc = {
          id: recordId,
          device_id,
          session_id,
          uuid: item.uuid || locObj.uuid || recordId,
          timestamp: locObj.timestamp ? new Date(locObj.timestamp) : new Date(),
          coords: {
            latitude: lat,
            longitude: lng,
            accuracy: coords?.accuracy || 0,
            altitude: coords?.altitude || 0,
            altitudeAccuracy: coords?.altitudeAccuracy || 0,
            speed: coords?.speed || 0,
            speedAccuracy: coords?.speedAccuracy || 0,
            heading: coords?.heading || 0,
            headingAccuracy: coords?.headingAccuracy || 0
          },
          location: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          is_moving: !!locObj.is_moving,
          odometer: locObj.odometer || 0,
          activity: locObj.activity || { type: 'unknown', confidence: 0 },
          battery: locObj.battery || { level: 1, is_charging: false },
          permission: locObj.permission || {}
        };

        processedDocs.push(doc);

        // Track device counter
        if (!deviceUpdates[device_id]) {
          deviceUpdates[device_id] = 0;
        }
        deviceUpdates[device_id]++;

        // Track session points
        if (!sessionUpdates[session_id]) {
          sessionUpdates[session_id] = { device_id, points: [] };
        }
        sessionUpdates[session_id].points.push(doc);
      }
    }

    if (processedDocs.length > 0) {
      // 1. Bulk insert location records
      await Location.insertMany(processedDocs);

      // 2. Update Device counters
      for (const [devId, count] of Object.entries(deviceUpdates)) {
        await Device.findOneAndUpdate(
          { id: devId },
          {
            $inc: { totalPoints: count },
            $set: { lastSeenMs: Date.now() },
            $setOnInsert: { id: devId, disconnected: false, firstSeenMs: Date.now() }
          },
          { upsert: true }
        );
      }

      // 3. Update Sessions
      for (const [sessId, sessData] of Object.entries(sessionUpdates)) {
        let existingSess = await Session.findOne({ id: sessId });
        if (!existingSess) {
          existingSess = new Session({
            id: sessId,
            device_id: sessData.device_id,
            tag: `Session (${sessData.device_id})`,
            startTimeMs: Date.now(),
            endTimeMs: Date.now(),
            isOpen: true,
            pointCount: 0,
            distanceMeters: 0,
            points: []
          });
        }

        for (const newPt of sessData.points) {
          if (existingSess.points.length > 0) {
            const prev = existingSess.points[existingSess.points.length - 1];
            const prevCoords = prev.coords || prev;
            const currCoords = newPt.coords || newPt;
            const d = calculateDistanceMeters(prevCoords.latitude, prevCoords.longitude, currCoords.latitude, currCoords.longitude);
            existingSess.distanceMeters += Math.round(d * 10) / 10;
          }
          existingSess.points.push(newPt);
        }

        existingSess.pointCount = existingSess.points.length;
        existingSess.endTimeMs = Date.now();
        await existingSess.save();
      }
    }

    return res.status(200).json({
      status: 'ok',
      received: processedDocs.length,
      count: processedDocs.length
    });
  } catch (err) {
    console.error('Error saving locations:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /locations
 * View all logged locations (filtered by session_id and/or device_id) with pagination
 */
app.get('/locations', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const session_id = req.query.session_id || req.query.sessionId;
    const device_id = req.query.device_id || req.query.deviceId;

    const filter = {};
    if (session_id && session_id !== 'ALL') {
      filter.session_id = session_id;
    }
    if (device_id && device_id !== 'ALL') {
      filter.device_id = device_id;
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
    const total = await Location.countDocuments(filter);
    const totalPages = Math.ceil(total / limit) || 1;

    const paginatedLocations = await Location.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const mapPoints = await Location.find(filter)
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    const sessions = await Session.find({}, { points: 0 }).lean();
    const devices = await Device.find().lean();

    const wantsHtml = req.headers.accept?.includes('text/html') || req.query.format === 'html';

    if (wantsHtml && req.query.format !== 'json') {
      return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }

    return res.json({
      total,
      page,
      limit,
      totalPages,
      locations: paginatedLocations,
      mapPoints,
      sessions,
      devices
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * DELETE /locations/record/:id
 * Delete a single location fix record by its unique ID
 */
app.delete('/locations/record/:id', async (req, res) => {
  const recordId = req.params.id;

  try {
    const record = await Location.findOneAndDelete({ $or: [{ id: recordId }, { uuid: recordId }] }).lean();

    if (!record) {
      return res.status(404).json({ status: 'error', message: 'Location record not found' });
    }

    const devId = record.device_id;
    const sessId = record.session_id;

    if (devId) {
      await Device.updateOne({ id: devId, totalPoints: { $gt: 0 } }, { $inc: { totalPoints: -1 } });
    }

    if (sessId) {
      const sess = await Session.findOne({ id: sessId });
      if (sess) {
        sess.points = sess.points.filter(p => p.id !== recordId && p.uuid !== recordId);
        sess.pointCount = sess.points.length;
        await sess.save();
      }
    }

    console.log(`\n🗑️ Deleted single location record [${recordId}] (Device: ${devId}).`);

    return res.json({
      status: 'ok',
      message: `Deleted record ${recordId}`,
      deletedRecordId: recordId
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * DELETE /devices/:id/locations
 * Delete all location points associated with a specific device ID
 */
app.delete('/devices/:id/locations', async (req, res) => {
  const deviceId = req.params.id;

  try {
    const deleteRes = await Location.deleteMany({ device_id: deviceId });

    // Clean up points in sessions for this device
    const sessions = await Session.find({ device_id: deviceId });
    for (const sess of sessions) {
      sess.points = [];
      sess.pointCount = 0;
      sess.distanceMeters = 0;
      await sess.save();
    }

    await Device.updateOne({ id: deviceId }, { $set: { totalPoints: 0 } });

    console.log(`\n🗑️ Deleted ${deleteRes.deletedCount} location record(s) for device [${deviceId}].`);

    return res.json({
      status: 'ok',
      message: `Deleted location records for device ${deviceId}`,
      deviceId,
      deletedCount: deleteRes.deletedCount
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * DELETE /locations
 * Clear location records & sessions database while PRESERVING registered devices and their connection status.
 */
app.delete('/locations', async (req, res) => {
  try {
    const deleteRes = await Location.deleteMany({});
    await Session.deleteMany({});

    // Reset total points counter per device, PRESERVING device registration & disconnected status
    await Device.updateMany({}, { $set: { totalPoints: 0 } });

    const devices = await Device.find().lean();

    console.log(`\n🧹 Cleared location records & sessions (Preserved ${devices.length} registered devices).`);

    return res.json({
      status: 'ok',
      message: 'Cleared location history and sessions (preserved device connection status)',
      cleared: deleteRes.deletedCount,
      devices
    });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const nextIndexPath = path.join(__dirname, 'frontend', 'out', 'index.html');
  const publicIndexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(nextIndexPath)) {
    return res.sendFile(nextIndexPath);
  } else if (fs.existsSync(publicIndexPath)) {
    return res.sendFile(publicIndexPath);
  } else {
    return res.status(404).send('Frontend UI not found. Run npm run build:frontend first.');
  }
});

// Connect to MongoDB and start HTTP Server
async function startServer() {
  try {
    await connectDB();
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n=============================================================`);
      console.log(`🚀 TrackIt Location Receiver Server running on http://localhost:${PORT}`);
      console.log(`🗺️  Visual Map UI available at: http://localhost:${PORT}`);
      console.log(`🍃 Connected to MongoDB storage layer`);
      console.log(`=============================================================\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`⚠️ Port ${PORT} is already in use by another process.`);
      }
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB. Server not started.', err.message);
  }
}

startServer();

module.exports = app;
