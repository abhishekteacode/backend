export interface Coords {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

export interface Battery {
  level?: number;
  is_charging?: boolean;
  isCharging?: boolean;
  is_power_save_mode?: boolean;
  isPowerSaveMode?: boolean;
}

export interface Activity {
  type?: string;
  confidence?: number;
}

export interface Permission {
  status?: number;
  statusName?: string;
  hasFinePermission?: boolean;
  hasCoarsePermission?: boolean;
  hasBackgroundPermission?: boolean;
  hasAlwaysPermission?: boolean;
  hasWhenInUsePermission?: boolean;
}

export interface Geofence {
  identifier: string;
  key?: string;
  status?: string;
  action?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface LocationRecord {
  id?: string;
  device_id?: string;
  deviceId?: string;
  session_id?: string;
  sessionId?: string;
  sessionID?: string;
  timestamp?: string;
  coords: Coords;
  is_moving?: boolean;
  isMoving?: boolean;
  activity?: Activity;
  battery?: Battery;
  permission?: Permission;
  event?: string;
  geofence?: Geofence;
  extras?: {
    geofence?: Geofence;
  };
}

export interface TrackSession {
  id: string;
  device_id: string;
  tag?: string;
  startTimeMs: number;
  endTimeMs?: number;
  isOpen: boolean;
  pointCount: number;
  distanceMeters: number;
  points?: LocationRecord[];
}

export interface DeviceInfo {
  id: string;
  disconnected: boolean;
  firstSeenMs: number;
  lastSeenMs: number;
  totalPoints: number;
}

export interface LocationResponse {
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  locations: LocationRecord[];
  mapPoints?: LocationRecord[];
  sessions?: TrackSession[];
  devices?: DeviceInfo[];
}
