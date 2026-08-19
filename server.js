const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'locations_db.json');
const SESSIONS_DB_FILE = path.join(__dirname, 'sessions_db.json');
const DEVICES_DB_FILE = path.join(__dirname, 'devices_db.json');

// Enable CORS for cross-origin client requests
app.use(cors());

// Parse incoming JSON requests (up to 10MB to support large batch sync payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware to strip '/api-proxy' prefix if frontend calls /api-proxy/*
app.use((req, res, next) => {
  if (req.url.startsWith('/api-proxy/')) {
    req.url = req.url.replace('/api-proxy', '');
  } else if (req.url === '/api-proxy') {
    req.url = '/';
  }
  next();
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

// Helper to load flat locations database
function loadLocations() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data || '[]');
      let updated = false;
      parsed.forEach((loc) => {
        if (!loc.id) {
          loc.id = `loc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          updated = true;
        }
      });
      if (updated) {
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
      }
      return parsed;
    }
  } catch (err) {
    console.error('⚠️ Error reading location database file:', err.message);
  }
  return [];
}

// Helper to save flat locations database
function saveLocations(locations) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(locations, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ Error saving location database file:', err.message);
  }
}

// Helper to load sessions database
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_DB_FILE)) {
      const data = fs.readFileSync(SESSIONS_DB_FILE, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {
    console.error('⚠️ Error reading sessions database file:', err.message);
  }
  return {};
}

// Helper to save sessions database
function saveSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_DB_FILE, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ Error saving sessions database file:', err.message);
  }
}

// Helper to load devices database
function loadDevices() {
  try {
    if (fs.existsSync(DEVICES_DB_FILE)) {
      const data = fs.readFileSync(DEVICES_DB_FILE, 'utf8');
      return JSON.parse(data || '{}');
    }
  } catch (err) {
    console.error('⚠️ Error reading devices database file:', err.message);
  }
  return {};
}

// Helper to save devices database
function saveDevices(devices) {
  try {
    fs.writeFileSync(DEVICES_DB_FILE, JSON.stringify(devices, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ Error saving devices database file:', err.message);
  }
}

// In-memory data stores synchronized with disk
const locationDatabase = loadLocations();
const sessionsDatabase = loadSessions();
const devicesDatabase = loadDevices();

// Populate devices database from existing locations if empty
locationDatabase.forEach((loc) => {
  const devId = loc.device_id || loc.deviceId || 'unknown';
  if (!devicesDatabase[devId]) {
    devicesDatabase[devId] = {
      id: devId,
      disconnected: false,
      firstSeenMs: new Date(loc.timestamp || Date.now()).getTime(),
      lastSeenMs: new Date(loc.timestamp || Date.now()).getTime(),
      totalPoints: 0
    };
  }
  devicesDatabase[devId].totalPoints++;
  const t = new Date(loc.timestamp || Date.now()).getTime();
  if (t > devicesDatabase[devId].lastSeenMs) devicesDatabase[devId].lastSeenMs = t;
});
saveDevices(devicesDatabase);

// Seed initial session migration from location database if sessions database is empty
if (Object.keys(sessionsDatabase).length === 0 && locationDatabase.length > 0) {
  console.log('🔄 Migrating legacy location records into session database...');
  locationDatabase.forEach((loc) => {
    const devId = loc.device_id || loc.deviceId || 'default-device';
    const sessId = loc.session_id || loc.sessionId || loc.sessionID || `session_${devId}`;
    if (!sessionsDatabase[sessId]) {
      sessionsDatabase[sessId] = {
        id: sessId,
        device_id: devId,
        tag: `Session (${devId})`,
        startTimeMs: new Date(loc.timestamp || Date.now()).getTime(),
        endTimeMs: new Date(loc.timestamp || Date.now()).getTime(),
        isOpen: true,
        pointCount: 0,
        distanceMeters: 0,
        points: []
      };
    }
    const sess = sessionsDatabase[sessId];
    loc.session_id = sessId;
    
    if (sess.points.length > 0) {
      const prev = sess.points[sess.points.length - 1];
      const prevCoords = prev.coords || prev;
      const currCoords = loc.coords || loc;
      const d = calculateDistanceMeters(prevCoords.latitude, prevCoords.longitude, currCoords.latitude, currCoords.longitude);
      sess.distanceMeters += Math.round(d * 10) / 10;
    }
    sess.points.push(loc);
    sess.pointCount = sess.points.length;
    sess.endTimeMs = new Date(loc.timestamp || Date.now()).getTime();
  });
  saveSessions(sessionsDatabase);
  console.log(`✅ Session migration completed. Total sessions: ${Object.keys(sessionsDatabase).length}`);
}

console.log(`📦 Loaded ${locationDatabase.length} location fix(es), ${Object.keys(sessionsDatabase).length} tracking session(s), & ${Object.keys(devicesDatabase).length} registered device(s).`);

/**
 * GET /devices
 * Returns list of registered devices with connection status
 */
app.get('/devices', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.json({
    total: Object.keys(devicesDatabase).length,
    devices: Object.values(devicesDatabase)
  });
});

/**
 * POST /devices/disconnect
 * Disconnect/block a specific mobile device from streaming location updates
 */
app.post('/devices/disconnect', (req, res) => {
  const body = req.body || {};
  const device_id = body.device_id || body.deviceId || req.query.device_id;

  if (!device_id) {
    return res.status(400).json({ status: 'error', message: 'device_id is required' });
  }

  if (!devicesDatabase[device_id]) {
    devicesDatabase[device_id] = {
      id: device_id,
      disconnected: true,
      firstSeenMs: Date.now(),
      lastSeenMs: Date.now(),
      totalPoints: 0
    };
  } else {
    devicesDatabase[device_id].disconnected = true;
  }

  saveDevices(devicesDatabase);
  console.log(`🔌 Disconnected device [${device_id}] by server administration.`);

  return res.json({
    status: 'ok',
    message: `Device [${device_id}] disconnected successfully`,
    device: devicesDatabase[device_id]
  });
});

/**
 * POST /devices/reconnect
 * Restore connection status for a disconnected mobile device
 */
app.post('/devices/reconnect', (req, res) => {
  const body = req.body || {};
  const device_id = body.device_id || body.deviceId || req.query.device_id;

  if (!device_id || !devicesDatabase[device_id]) {
    return res.status(404).json({ status: 'error', message: 'Device not found' });
  }

  devicesDatabase[device_id].disconnected = false;
  saveDevices(devicesDatabase);
  console.log(`⚡ Reconnected device [${device_id}].`);

  return res.json({
    status: 'ok',
    message: `Device [${device_id}] reconnected successfully`,
    device: devicesDatabase[device_id]
  });
});

/**
 * POST /sessions/start
 * Explicit endpoint to open a new tracking session
 */
app.post('/sessions/start', (req, res) => {
  const body = req.body || {};
  const device_id = body.device_id || body.deviceId || req.query.device_id || 'unknown';
  const tag = body.tag || `Tracking Session ${new Date().toLocaleTimeString()}`;
  const session_id = body.session_id || body.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newSession = {
    id: session_id,
    device_id,
    tag,
    startTimeMs: Date.now(),
    endTimeMs: Date.now(),
    isOpen: true,
    pointCount: 0,
    distanceMeters: 0,
    points: []
  };

  sessionsDatabase[session_id] = newSession;
  saveSessions(sessionsDatabase);

  console.log(`🚀 Started new tracking session [ID: ${session_id}] for device [${device_id}]`);

  return res.status(200).json({
    status: 'ok',
    session_id,
    session: newSession
  });
});

/**
 * POST /sessions/stop
 * Explicit endpoint to close an active tracking session
 */
app.post('/sessions/stop', (req, res) => {
  const body = req.body || {};
  const session_id = body.session_id || body.sessionId || req.query.session_id;

  if (!session_id || !sessionsDatabase[session_id]) {
    return res.status(404).json({ status: 'error', message: 'Session ID not found' });
  }

  const session = sessionsDatabase[session_id];
  session.isOpen = false;
  session.endTimeMs = Date.now();

  saveSessions(sessionsDatabase);

  console.log(`🏁 Closed tracking session [ID: ${session_id}] (Total Points: ${session.pointCount}, Distance: ${session.distanceMeters.toFixed(1)}m)`);

  return res.status(200).json({
    status: 'ok',
    session
  });
});

/**
 * GET /sessions
 * Returns all tracking sessions metadata summary
 */
app.get('/sessions', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const sessionList = Object.values(sessionsDatabase).map(s => ({
    id: s.id,
    device_id: s.device_id,
    tag: s.tag,
    startTimeMs: s.startTimeMs,
    endTimeMs: s.endTimeMs,
    isOpen: s.isOpen,
    pointCount: s.pointCount,
    distanceMeters: s.distanceMeters
  }));

  return res.json({
    total: sessionList.length,
    sessions: sessionList
  });
});

/**
 * GET /sessions/:id
 * Fetch single session details with full point list
 */
app.get('/sessions/:id', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const sessionId = req.params.id;
  const session = sessionsDatabase[sessionId];

  if (!session) {
    return res.status(404).json({ status: 'error', message: 'Session not found' });
  }

  return res.json({
    status: 'ok',
    session
  });
});

/**
 * DELETE /sessions/:id
 * Delete a specific session and all its associated location points.
 */
app.delete('/sessions/:id', (req, res) => {
  const sessionId = req.params.id;

  if (!sessionId || !sessionsDatabase[sessionId]) {
    return res.status(404).json({ status: 'error', message: 'Session not found' });
  }

  delete sessionsDatabase[sessionId];

  let deletedPointsCount = 0;
  for (let i = locationDatabase.length - 1; i >= 0; i--) {
    const loc = locationDatabase[i];
    const locSessId = loc.session_id || loc.sessionId || loc.sessionID;
    if (locSessId === sessionId) {
      locationDatabase.splice(i, 1);
      deletedPointsCount++;
    }
  }

  saveLocations(locationDatabase);
  saveSessions(sessionsDatabase);

  console.log(`\n🗑️ Deleted session [${sessionId}] and ${deletedPointsCount} associated location point(s).`);

  return res.json({
    status: 'ok',
    message: `Deleted session ${sessionId}`,
    deletedSessionId: sessionId,
    deletedPoints: deletedPointsCount
  });
});

/**
 * POST /locations
 * Receiver endpoint for incoming location updates from TrackIt / background geolocation.
 * Rejects payloads if the device is disconnected.
 */
app.post('/locations', (req, res) => {
  const body = req.body || {};
  const topDeviceId = req.query.device_id || req.query.deviceId || body.device_id || body.deviceId || 'unknown';

  // Check if device is disconnected
  if (devicesDatabase[topDeviceId] && devicesDatabase[topDeviceId].disconnected) {
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

  const processedRecords = [];

  rawItems.forEach((item) => {
    if (!item) return;

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
      const record = {
        id: recordId,
        device_id,
        session_id,
        ...locObj
      };

      if (!record.coords) {
        record.coords = {
          latitude: coords?.latitude ?? 0,
          longitude: coords?.longitude ?? 0,
          accuracy: coords?.accuracy || 0,
          speed: coords?.speed || 0,
          heading: coords?.heading || 0
        };
      }

      processedRecords.push(record);
      locationDatabase.push(record);

      // Track device in devicesDatabase
      if (!devicesDatabase[device_id]) {
        devicesDatabase[device_id] = {
          id: device_id,
          disconnected: false,
          firstSeenMs: Date.now(),
          lastSeenMs: Date.now(),
          totalPoints: 0
        };
      }
      devicesDatabase[device_id].lastSeenMs = Date.now();
      devicesDatabase[device_id].totalPoints++;

      // Associate record with Session in sessionsDatabase
      if (!sessionsDatabase[session_id]) {
        sessionsDatabase[session_id] = {
          id: session_id,
          device_id,
          tag: `Session (${device_id})`,
          startTimeMs: Date.now(),
          endTimeMs: Date.now(),
          isOpen: true,
          pointCount: 0,
          distanceMeters: 0,
          points: []
        };
      }

      const sess = sessionsDatabase[session_id];
      
      if (sess.points.length > 0) {
        const prev = sess.points[sess.points.length - 1];
        const prevCoords = prev.coords || prev;
        const currCoords = record.coords || record;
        const d = calculateDistanceMeters(prevCoords.latitude, prevCoords.longitude, currCoords.latitude, currCoords.longitude);
        sess.distanceMeters += Math.round(d * 10) / 10;
      }

      sess.points.push(record);
      sess.pointCount = sess.points.length;
      sess.endTimeMs = new Date(record.timestamp || Date.now()).getTime();
    }
  });

  saveLocations(locationDatabase);
  saveSessions(sessionsDatabase);
  saveDevices(devicesDatabase);

  return res.status(200).json({
    status: 'ok',
    received: processedRecords.length,
    count: processedRecords.length
  });
});

/**
 * GET /locations
 * View all logged locations (filtered by session_id and/or device_id) with pagination
 */
app.get('/locations', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const session_id = req.query.session_id || req.query.sessionId;
  const device_id = req.query.device_id || req.query.deviceId;
  let filtered = locationDatabase;

  if (session_id && session_id !== 'ALL') {
    filtered = filtered.filter(l => l.session_id === session_id || l.sessionId === session_id);
  }

  if (device_id && device_id !== 'ALL') {
    filtered = filtered.filter(l => (l.device_id || l.deviceId || 'unknown') === device_id);
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 50));
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;

  const reversed = [...filtered].reverse();
  const startIndex = (page - 1) * limit;
  const paginatedLocations = reversed.slice(startIndex, startIndex + limit);

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
    mapPoints: filtered.length > 500 ? filtered.slice(filtered.length - 500) : filtered,
    sessions: Object.values(sessionsDatabase).map(s => ({
      id: s.id,
      device_id: s.device_id,
      tag: s.tag,
      pointCount: s.pointCount,
      distanceMeters: s.distanceMeters,
      isOpen: s.isOpen
    })),
    devices: Object.values(devicesDatabase)
  });
});

/**
 * DELETE /locations/record/:id
 * Delete a single location fix record by its unique ID
 */
app.delete('/locations/record/:id', (req, res) => {
  const recordId = req.params.id;
  const index = locationDatabase.findIndex(l => l.id === recordId);

  if (index === -1) {
    return res.status(404).json({ status: 'error', message: 'Location record not found' });
  }

  const [removedRecord] = locationDatabase.splice(index, 1);
  const devId = removedRecord.device_id || removedRecord.deviceId;
  const sessId = removedRecord.session_id || removedRecord.sessionId || removedRecord.sessionID;

  // Decrement total points in devices database if device exists
  if (devId && devicesDatabase[devId] && devicesDatabase[devId].totalPoints > 0) {
    devicesDatabase[devId].totalPoints--;
  }

  // Update session points array and pointCount
  if (sessId && sessionsDatabase[sessId]) {
    const sess = sessionsDatabase[sessId];
    sess.points = sess.points.filter(p => p.id !== recordId);
    sess.pointCount = sess.points.length;
  }

  saveLocations(locationDatabase);
  saveSessions(sessionsDatabase);
  saveDevices(devicesDatabase);

  console.log(`\n🗑️ Deleted single location record [${recordId}] (Device: ${devId}).`);

  return res.json({
    status: 'ok',
    message: `Deleted record ${recordId}`,
    deletedRecordId: recordId
  });
});

/**
 * DELETE /devices/:id/locations
 * Delete all location points associated with a specific device ID
 */
app.delete('/devices/:id/locations', (req, res) => {
  const deviceId = req.params.id;

  let deletedCount = 0;
  for (let i = locationDatabase.length - 1; i >= 0; i--) {
    const loc = locationDatabase[i];
    const devId = loc.device_id || loc.deviceId || 'unknown';
    if (devId === deviceId) {
      locationDatabase.splice(i, 1);
      deletedCount++;
    }
  }

  // Clean up sessions for this device
  Object.values(sessionsDatabase).forEach(sess => {
    if (sess.device_id === deviceId) {
      sess.points = sess.points.filter(p => (p.device_id || p.deviceId || 'unknown') !== deviceId);
      sess.pointCount = sess.points.length;
    }
  });

  if (devicesDatabase[deviceId]) {
    devicesDatabase[deviceId].totalPoints = 0;
  }

  saveLocations(locationDatabase);
  saveSessions(sessionsDatabase);
  saveDevices(devicesDatabase);

  console.log(`\n🗑️ Deleted ${deletedCount} location record(s) for device [${deviceId}].`);

  return res.json({
    status: 'ok',
    message: `Deleted location records for device ${deviceId}`,
    deviceId,
    deletedCount
  });
});

/**
 * DELETE /locations
 * Clear location records & sessions database while PRESERVING registered devices and their connection status.
 */
app.delete('/locations', (req, res) => {
  const previousCount = locationDatabase.length;

  locationDatabase.length = 0;
  Object.keys(sessionsDatabase).forEach(k => delete sessionsDatabase[k]);

  // Reset total points counter per device, but PRESERVE device registration & disconnected status!
  Object.values(devicesDatabase).forEach(dev => {
    dev.totalPoints = 0;
  });

  saveLocations(locationDatabase);
  saveSessions(sessionsDatabase);
  saveDevices(devicesDatabase);

  console.log(`\n🧹 Cleared location records & sessions (Preserved ${Object.keys(devicesDatabase).length} registered devices).`);
  return res.json({
    status: 'ok',
    message: 'Cleared location history and sessions (preserved device connection status)',
    cleared: previousCount,
    devices: Object.values(devicesDatabase)
  });
});

/**
 * GET /
 * Serve visual map interface
 */
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start HTTP Server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(`🚀 TrackIt Location Receiver Server running on http://localhost:${PORT}`);
  console.log(`🗺️  Visual Map UI available at: http://localhost:${PORT}`);
  console.log(`=============================================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️ Port ${PORT} is already in use by another process.`);
  }
});
