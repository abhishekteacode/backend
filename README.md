# 📍 Background Geolocation Receiver & Dashboard (MongoDB Edition)

A high-performance Node.js + Express backend HTTP server and real-time Leaflet map dashboard designed to collect, process, and visualize background location updates from mobile devices (compatible with `react-native-background-geolocation`, Flutter, iOS, and Android background tracking SDKs).

---

## 🏗️ Architecture & Database Layer

The application features a **3-Tier Hybrid Auto-Detecting Database Architecture** powered by **MongoDB** and **Mongoose**:

```
                  ┌─────────────────────────────────────────┐
                  │      npm start / server.js boot         │
                  └────────────────────┬────────────────────┘
                                       │
            Is MONGODB_URI set in .env? (e.g. Mongo Atlas Cloud)
                               ┌───────┴───────┐
                              YES              NO
                               │               │
                 ┌─────────────┴──────┐   Is local MongoDB (port 27017) running?
                 │ Connects to CLOUD  │        ┌───────┴───────┐
                 │  MongoDB Atlas     │       YES              NO
                 └────────────────────┘        │               │
                                  ┌────────────┴─────┐  ┌──────┴────────────────────┐
                                  │ Connects to      │  │ Starts Embedded Auto      │
                                  │ LOCAL MongoDB    │  │ MongoDB (Zero Setup!)     │
                                  └──────────────────┘  └───────────────────────────┘
```

1. **Tier 1 (Cloud):** If a `MONGODB_URI` connection string is set in `.env` (e.g., MongoDB Atlas Cloud), the app connects to the cloud cluster.
2. **Tier 2 (Local MongoDB):** If a local MongoDB instance is running on `mongodb://127.0.0.1:27017`, the app connects to the local database server.
3. **Tier 3 (Zero-Setup Embedded MongoDB):** If no external/local MongoDB is detected, Node.js **automatically starts an in-memory embedded MongoDB server** in the background (`mongodb-memory-server`). Anyone can clone the repo and run `npm start` out-of-the-box with **zero database installation required**!

---

## 🛠️ Features

- **High-Capacity Location Receiver (`POST /locations`)**:
  - Supports payloads up to **10MB** for offline batch location syncs.
  - Compatible with single location updates (`batchSync: false`) and array batch updates (`batchSync: true`).
  - Stores location coordinates with **GeoJSON 2DSphere spatial indexing** for rapid map bounds and proximity queries.
  - Tracks device speed, activity recognition (walking, driving, still), battery state, and geofence events.
- **Session & Device Management**:
  - Automatically groups incoming location streams into continuous tracking sessions.
  - Computes route metrics (total distance in meters, duration, point count, max speed).
  - Admin endpoints to remotely disconnect/reconnect specific mobile devices or clear device routes.
- **Interactive Visual Dashboard (`GET /` or `GET /locations`)**:
  - Built with **Leaflet.js** on top of a premium **Dark Slate UI** (`#0f172a`).
  - Displays real-time device movement markers, polyline path trails, speed, activity state, and geofences.
  - Live auto-refresh feed with toggleable "Follow Device" map tracking.
- **Legacy JSON Migration Tool**:
  - Included migration script (`scripts/migrate_json_to_mongo.js`) to import legacy `.json` location history into MongoDB.

---

## 🚀 Getting Started

### 1. Installation

Clone the repository and install npm dependencies:

```bash
git clone <repository-url>
cd backend
npm install
```

### 2. Database Configuration (Optional)

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

#### Environment Variables in `.env`:

```env
PORT=3000

# Optional: MongoDB Connection String
# For MongoDB Atlas Cloud (Free Cluster):
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/location_tracker?retryWrites=true&w=majority

# For Local Standalone MongoDB:
# MONGODB_URI=mongodb://127.0.0.1:27017/location_tracker

# Note: If MONGODB_URI is omitted, the server automatically starts an Embedded MongoDB instance!
```

### 3. Migrating Legacy Data (If upgrading from JSON files)

Import your past `locations_db.json`, `sessions_db.json`, and `devices_db.json` history into MongoDB:

```bash
node scripts/migrate_json_to_mongo.js
```

### 4. Running the Server

- **Standard / Production Mode**:
  ```bash
  npm start
  ```

- **Development Mode (Auto-reload on code changes)**:
  ```bash
  npm run dev
  ```

The server listens on port `3000`:
- **Visual Map Dashboard**: [http://localhost:3000](http://localhost:3000)
- **API Base Endpoint**: `http://localhost:3000`

---

## 📁 Project Structure

```
backend/
├── db.js                         # 3-Tier Hybrid MongoDB Connection Connector
├── server.js                     # Express API Server & Endpoint Controllers
├── models/
│   ├── Location.js               # Mongoose Location Schema (GeoJSON 2dsphere index)
│   ├── Session.js                # Mongoose Session Schema & Distance Tracker
│   └── Device.js                 # Mongoose Device Metadata & Connection Status Schema
├── scripts/
│   └── migrate_json_to_mongo.js  # One-time JSON -> MongoDB Data Seeder
├── frontend/                     # Next.js / React Visual Map App
├── public/                       # Static Dashboard UI Assets
├── .env                          # Local Environment Configuration
├── .env.example                  # Environment Configuration Template
└── package.json                  # Dependencies & Execution Scripts
```

---

## 🧪 API Endpoints & `curl` Examples

### 1. Send Single Location (`POST /locations`)

```bash
curl -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ios-demo",
    "location": {
      "uuid": "E621E1F8-C36C-495A-93FC-0C247A3E6E5F",
      "timestamp": "2026-08-19T10:15:30Z",
      "coords": {
        "latitude": 23.1131,
        "longitude": 72.5383,
        "accuracy": 5.0,
        "speed": 1.2,
        "heading": 90.0
      },
      "is_moving": true,
      "activity": { "type": "walking", "confidence": 100 },
      "battery": { "level": 0.85, "is_charging": false }
    }
  }'
```

### 2. Send Batch Locations (`POST /locations` with `batchSync: true`)

```bash
curl -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "android-demo",
    "locations": [
      {
        "timestamp": "2026-08-19T10:15:30Z",
        "coords": { "latitude": 23.1131, "longitude": 72.5383, "accuracy": 4.2, "speed": 1.5 },
        "is_moving": true,
        "activity": { "type": "walking", "confidence": 95 }
      },
      {
        "timestamp": "2026-08-19T10:16:00Z",
        "coords": { "latitude": 23.1140, "longitude": 72.5390, "accuracy": 3.8, "speed": 2.1 },
        "is_moving": true,
        "activity": { "type": "walking", "confidence": 100 }
      }
    ]
  }'
```

### 3. Fetch Locations (`GET /locations`)

Returns paginated location points, map points, sessions, and device metadata:

```bash
curl -H "Accept: application/json" "http://localhost:3000/locations?page=1&limit=50"
```

Filter locations by `device_id` or `session_id`:

```bash
curl -H "Accept: application/json" "http://localhost:3000/locations?device_id=android-demo"
```

### 4. Devices Management

- **Get Registered Devices (`GET /devices`)**:
  ```bash
  curl http://localhost:3000/devices
  ```

- **Disconnect/Block a Device (`POST /devices/disconnect`)**:
  ```bash
  curl -X POST http://localhost:3000/devices/disconnect \
    -H "Content-Type: application/json" \
    -d '{ "device_id": "android-demo" }'
  ```

- **Reconnect a Device (`POST /devices/reconnect`)**:
  ```bash
  curl -X POST http://localhost:3000/devices/reconnect \
    -H "Content-Type: application/json" \
    -d '{ "device_id": "android-demo" }'
  ```

### 5. Tracking Sessions

- **List All Sessions (`GET /sessions`)**:
  ```bash
  curl http://localhost:3000/sessions
  ```

- **Start a New Session (`POST /sessions/start`)**:
  ```bash
  curl -X POST http://localhost:3000/sessions/start \
    -H "Content-Type: application/json" \
    -d '{ "device_id": "android-demo", "tag": "Morning Shift Delivery" }'
  ```

- **Stop a Session (`POST /sessions/stop`)**:
  ```bash
  curl -X POST http://localhost:3000/sessions/stop \
    -H "Content-Type: application/json" \
    -d '{ "session_id": "session_1787130794" }'
  ```

- **Delete a Specific Session (`DELETE /sessions/:id`)**:
  ```bash
  curl -X DELETE http://localhost:3000/sessions/session_1787130794
  ```

### 6. Clear Data

- **Delete Single Location Record (`DELETE /locations/record/:id`)**:
  ```bash
  curl -X DELETE http://localhost:3000/locations/record/loc_1787130804
  ```

- **Delete All Device Locations (`DELETE /devices/:id/locations`)**:
  ```bash
  curl -X DELETE http://localhost:3000/devices/android-demo/locations
  ```

- **Clear Entire Location & Session History (`DELETE /locations`)**:
  ```bash
  curl -X DELETE http://localhost:3000/locations
  ```

---

## 📱 React Native Background Geolocation Integration

Connect your mobile app using `react-native-background-geolocation`:

```javascript
import BackgroundGeolocation from "react-native-background-geolocation";

const initBackgroundGeolocation = async () => {
  // 1. Listen to location events
  BackgroundGeolocation.onLocation((location) => {
    console.log('[onLocation] Location updated:', location);
  }, (error) => {
    console.error('[onLocation] ERROR:', error);
  });

  // 2. Configure SDK
  const state = await BackgroundGeolocation.ready({
    // HTTP Receiver Config
    url: 'http://<YOUR_SERVER_IP>:3000/locations',
    autoSync: true,
    batchSync: false,
    maxBatchSize: 100,
    headers: {
      'Content-Type': 'application/json'
    },
    params: {
      device_id: 'react-native-device-01'
    },

    // Location Tracking Config
    desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
    distanceFilter: 10,
    stopTimeout: 5,
    debug: false,
    logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
    stopOnTerminate: false,
    startOnBoot: true,
  });

  // 3. Start tracking
  if (!state.enabled) {
    await BackgroundGeolocation.start();
  }
};
```

---

## 📄 License

MIT
