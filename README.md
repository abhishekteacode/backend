# 📍 Background Geolocation Receiver & Dashboard

A lightweight Node.js + Express backend HTTP server and real-time Leaflet map dashboard designed to collect and visualize background location updates from mobile devices (specifically compatible with `react-native-background-geolocation` by Transistor Software).

---

## 🛠️ Features

- **High-Capacity Data Receiver (`POST /locations`)**:
  - Supports payload sizes up to **10MB** for large offline batch syncs.
  - Compatible with **Single Location Mode** (`batchSync: false`) & **Batch Location Mode** (`batchSync: true`).
  - Gracefully parses root-level location arrays and direct `coords` objects.
  - Logs formatted coordinate fixes, accuracy, speed, activity recognition, battery levels, and geofence events to stdout console.
  - Returns `{ "status": "ok", "received": N, "count": N }` to prompt mobile SDKs to flush local SQLite upload queues.
- **Disk Persistence**:
  - Automatically loads and persists location updates to `locations_db.json`.
- **Interactive Visual Dashboard (`GET /locations` or `GET /`)**:
  - Built with **Leaflet.js** on top of a premium **Dark Slate UI** (`#0f172a`).
  - Displays real-time device movement markers, polyline path trails, speed, activity state, and geofences.
  - Live auto-refresh feed (2-second polling) with toggleable "Follow Device" map tracking.
- **Clear History Endpoint (`DELETE /locations`)**:
  - Instantly wipes in-memory records and resets `locations_db.json`.

---

## 🚀 Getting Started

### 1. Installation

```bash
npm install
```

### 2. Running the Server

- **Production / Standard Mode**:
  ```bash
  npm start
  ```

- **Development Mode (Auto-reload on file changes)**:
  ```bash
  npm run dev
  ```

The server listens on `0.0.0.0:${PORT || 3000}`:
- **Visual Dashboard**: Open [http://localhost:3000](http://localhost:3000) in your browser.
- **Location Endpoint**: `http://<YOUR_LOCAL_IP>:3000/locations`

---

## 🧪 Testing with `curl`

### Single Location Mode (`batchSync: false`)

```bash
curl -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ios-demo",
    "location": {
      "uuid": "E621E1F8-C36C-495A-93FC-0C247A3E6E5F",
      "timestamp": "2026-07-28T10:15:30Z",
      "coords": {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "accuracy": 5.0,
        "speed": 1.2,
        "heading": 90.0
      },
      "isMoving": true,
      "activity": { "type": "walking", "confidence": 100 },
      "battery": { "level": 0.85, "is_charging": false }
    }
  }'
```

### Batch Location Mode (`batchSync: true`)

```bash
curl -X POST http://localhost:3000/locations \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ios-demo",
    "location": [
      {
        "timestamp": "2026-07-28T10:15:30Z",
        "coords": { "latitude": 37.7749, "longitude": -122.4194, "accuracy": 4.2, "speed": 1.5 },
        "isMoving": true,
        "activity": { "type": "walking", "confidence": 95 }
      },
      {
        "timestamp": "2026-07-28T10:16:00Z",
        "coords": { "latitude": 37.7758, "longitude": -122.4182, "accuracy": 3.8, "speed": 2.1 },
        "isMoving": true,
        "activity": { "type": "walking", "confidence": 100 }
      }
    ]
  }'
```

### Fetch Location Records (JSON API)

```bash
curl -H "Accept: application/json" http://localhost:3000/locations
```

### Clear All Location History

```bash
curl -X DELETE http://localhost:3000/locations
```

---

## 📱 React Native Background Geolocation Integration

To connect your React Native app using `react-native-background-geolocation`:

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
    url: 'http://<YOUR_LOCAL_IP>:3000/locations', // Replace with server local IP or domain
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
    debug: true, // Audio sounds & debug notifications (development only)
    logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
    stopOnTerminate: false,
    startOnBoot: true,
  });

  console.log('- BackgroundGeolocation is ready: ', state.enabled);

  // 3. Start tracking
  if (!state.enabled) {
    await BackgroundGeolocation.start();
  }
};
```

---

## 📄 License

MIT
