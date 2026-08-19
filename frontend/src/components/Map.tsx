'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationRecord } from '@/types/location';

interface MapProps {
  locations: LocationRecord[];
  showPath: boolean;
  followLatest: boolean;
  selectedLocation: LocationRecord | null;
}

const MAX_MAP_MARKERS = 150;

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLon = (lon2 - lon1) * rad;
  const y = Math.sin(dLon) * Math.cos(lat2 * rad);
  const x =
    Math.cos(lat1 * rad) * Math.sin(lat2 * rad) -
    Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export const Map: React.FC<MapProps> = ({
  locations,
  showPath,
  followLatest,
  selectedLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.FeatureGroup | null>(null);
  const polylineGroupRef = useRef<L.FeatureGroup | null>(null);
  const geofencesGroupRef = useRef<L.FeatureGroup | null>(null);
  const lastPointCountRef = useRef<number>(-1);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current).setView([37.7749, -122.4194], 12);
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    markersGroupRef.current = L.featureGroup().addTo(map);
    polylineGroupRef.current = L.featureGroup().addTo(map);
    geofencesGroupRef.current = L.featureGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map contents when locations or props change
  useEffect(() => {
    const map = mapRef.current;
    const markersGroup = markersGroupRef.current;
    const polylineGroup = polylineGroupRef.current;
    const geofencesGroup = geofencesGroupRef.current;

    if (!map || !markersGroup || !polylineGroup || !geofencesGroup) return;

    markersGroup.clearLayers();
    polylineGroup.clearLayers();
    geofencesGroup.clearLayers();

    if (!locations || locations.length === 0) return;

    const devicePaths: Record<string, [number, number][]> = {};
    const boundsPoints: [number, number][] = [];

    // Chronological order for full polyline motion paths
    const chronologicalLocs = [...locations].sort((a, b) => {
      const tA = new Date(a.timestamp || 0).getTime();
      const tB = new Date(b.timestamp || 0).getTime();
      return tA - tB;
    });

    // Calculate heading/bearing for location points to align with path trajectory
    const headingsMap = new globalThis.Map<LocationRecord, number>();
    for (let i = 0; i < chronologicalLocs.length; i++) {
      const loc = chronologicalLocs[i];
      const coords = loc.coords || loc;
      const lat = Number(coords.latitude ?? (loc as any).latitude);
      const lng = Number(coords.longitude ?? (loc as any).longitude);
      const rawHeading = Number(coords.heading ?? (loc as any).heading);

      let heading = 0;
      let pathBearing: number | null = null;

      // Compute path trajectory bearing to next point
      if (i < chronologicalLocs.length - 1) {
        const nextCoords = chronologicalLocs[i + 1].coords || chronologicalLocs[i + 1];
        const nextLat = Number(nextCoords.latitude ?? (chronologicalLocs[i + 1] as any).latitude);
        const nextLng = Number(nextCoords.longitude ?? (chronologicalLocs[i + 1] as any).longitude);
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(nextLat) && !isNaN(nextLng) && (lat !== nextLat || lng !== nextLng)) {
          pathBearing = calculateBearing(lat, lng, nextLat, nextLng);
        }
      }

      // Or compute path trajectory bearing from previous point if last point
      if (pathBearing === null && i > 0) {
        const prevCoords = chronologicalLocs[i - 1].coords || chronologicalLocs[i - 1];
        const prevLat = Number(prevCoords.latitude ?? (chronologicalLocs[i - 1] as any).latitude);
        const prevLng = Number(prevCoords.longitude ?? (chronologicalLocs[i - 1] as any).longitude);
        if (!isNaN(lat) && !isNaN(lng) && !isNaN(prevLat) && !isNaN(prevLng) && (lat !== prevLat || lng !== prevLng)) {
          pathBearing = calculateBearing(prevLat, prevLng, lat, lng);
        }
      }

      if (pathBearing !== null) {
        heading = pathBearing;
      } else if (!isNaN(rawHeading) && rawHeading > 0) {
        heading = rawHeading;
      } else {
        heading = 0;
      }

      headingsMap.set(loc, heading);
    }

    chronologicalLocs.forEach((loc) => {
      const coords = loc.coords || loc;
      const lat = Number(coords.latitude ?? (loc as any).latitude);
      const lng = Number(coords.longitude ?? (loc as any).longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      const devId = loc.device_id || loc.deviceId || 'unknown';
      if (!devicePaths[devId]) devicePaths[devId] = [];
      devicePaths[devId].push([lat, lng]);
    });

    // Display locations (newest first)
    const displayLocations = [...locations].reverse();

    // Limit markers creation to latest MAX_MAP_MARKERS or event points for extreme performance
    const markersToRender = displayLocations.filter((loc, idx) => {
      const hasEvent = loc.event || loc.geofence || (loc.extras && loc.extras.geofence);
      return idx < MAX_MAP_MARKERS || hasEvent;
    });

    markersToRender.forEach((loc, index) => {
      const coords = loc.coords || loc;
      const lat = Number(coords.latitude ?? (loc as any).latitude);
      const lng = Number(coords.longitude ?? (loc as any).longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      boundsPoints.push([lat, lng]);

      const isLatest = index === 0;
      const heading = headingsMap.get(loc) ?? 0;

      const size = isLatest ? 28 : 20;
      const iconSize = isLatest ? 20 : 14;
      const fillColor = isLatest ? '#22c55e' : '#38bdf8';
      const strokeColor = isLatest ? '#15803d' : '#0284c7';
      const shadowColor = isLatest ? 'rgba(34, 197, 94, 0.4)' : 'rgba(0, 0, 0, 0.4)';

      const arrowIcon = L.divIcon({
        className: 'location-arrow-marker',
        html: `<div style="
          transform: rotate(${heading}deg);
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${isLatest ? 'rgba(34, 197, 94, 0.15)' : 'transparent'};
          border-radius: 50%;
          filter: drop-shadow(0 2px 4px ${shadowColor});
          transition: transform 0.2s ease;
        ">
          <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5">
            <polygon points="12 2 19 21 12 17 5 21 12 2"/>
          </svg>
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon: arrowIcon });

      const gf = loc.geofence || (loc.extras && loc.extras.geofence);
      const timeStr = loc.timestamp ? new Date(loc.timestamp).toLocaleTimeString() : 'N/A';
      const dateStr = loc.timestamp ? new Date(loc.timestamp).toLocaleDateString() : '';

      const batt = loc.battery || {};
      const battLevel = batt.level != null ? `${Math.round(batt.level * 100)}%` : 'N/A';
      const isCharging = batt.is_charging ?? batt.isCharging ?? false;
      const isPowerSave = batt.is_power_save_mode ?? batt.isPowerSaveMode ?? false;

      const perm = loc.permission || {};
      const permStatusName = perm.statusName || (perm.status !== undefined ? `Code ${perm.status}` : null);

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; font-size: 13px; color: #f8fafc;">
          <div style="font-weight: 700; color: #38bdf8; margin-bottom: 6px; font-size: 14px;">📱 Device: ${loc.device_id || loc.deviceId || 'unknown'}</div>
          <div>📍 <b>Lat/Lng:</b> ${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
          <div>🎯 <b>Accuracy:</b> ±${Math.round(coords.accuracy || 0)}m</div>
          <div>⚡ <b>Speed:</b> ${((coords.speed || 0) * 3.6).toFixed(1)} km/h (${(coords.speed || 0).toFixed(1)} m/s)</div>
          <div>🚶 <b>Moving:</b> ${loc.is_moving ?? loc.isMoving ?? 'N/A'}</div>
          <div>🏃 <b>Activity:</b> ${loc.activity?.type || 'unknown'} (${loc.activity?.confidence || 0}%)</div>
          <div>🔋 <b>Battery:</b> ${battLevel} ${isCharging ? '⚡ (Charging)' : ''} | <b>Power Saver:</b> ${isPowerSave ? '<span style="color:#f59e0b;font-weight:bold;">ON 🪫</span>' : '<span style="color:#10b981;">OFF</span>'}</div>
          ${permStatusName ? `<div>🛡️ <b>Permission:</b> <span style="color:${permStatusName === 'Denied' || permStatusName === 'Restricted' ? '#ef4444' : '#38bdf8'};font-weight:600;">${permStatusName}</span></div>` : ''}
          ${loc.event ? `<div style="color: #ef4444; margin-top: 4px; font-weight: bold;">⚠️ <b>Event:</b> ${loc.event}</div>` : ''}
          ${gf ? `<div style="color: #a78bfa; margin-top: 4px; font-weight: bold;">🚩 <b>Fence:</b> ${gf.identifier} (${gf.status || gf.action})</div>` : ''}
          <div style="color: #94a3b8; font-size: 11px; margin-top: 4px;">🕒 ${dateStr} ${timeStr}</div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markersGroup.addLayer(marker);
    });

    // Geofences
    const uniqueGeofences: Record<string, { gf: any; loc: LocationRecord }> = {};
    displayLocations.forEach((loc) => {
      const gf = loc.geofence || (loc.extras && loc.extras.geofence);
      if (gf && gf.identifier) {
        if (!uniqueGeofences[gf.identifier]) {
          uniqueGeofences[gf.identifier] = { gf, loc };
        }
      }
    });

    Object.values(uniqueGeofences).forEach(({ gf, loc }) => {
      const coords = loc.coords || loc;
      const lat = Number(coords.latitude ?? (loc as any).latitude);
      const lng = Number(coords.longitude ?? (loc as any).longitude);
      const gfLat = Number(gf.latitude ?? lat);
      const gfLng = Number(gf.longitude ?? lng);
      const status = gf.status || gf.action || 'ACTIVE';
      const radius = Number(gf.radius || 150);
      const color = status === 'ENTER' ? '#22c55e' : status === 'EXIT' ? '#ef4444' : '#8b5cf6';

      const fenceCircle = L.circle([gfLat, gfLng], {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2,
      });

      fenceCircle.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 13px; color: #f8fafc;">
          <div style="font-weight: 700; color: #a78bfa; margin-bottom: 6px;">🚩 Geofence: ${gf.identifier}</div>
          <div>🔑 <b>Key:</b> ${gf.key || gf.identifier}</div>
          <div>🎯 <b>Status:</b> ${status}</div>
          <div>📍 <b>Center:</b> ${gfLat.toFixed(6)}, ${gfLng.toFixed(6)}</div>
          <div>📏 <b>Radius:</b> ${radius}m</div>
        </div>
      `);
      geofencesGroup.addLayer(fenceCircle);
    });

    // Draw Polyline paths per device
    if (showPath) {
      Object.keys(devicePaths).forEach((devId) => {
        const path = devicePaths[devId];
        if (path.length > 1) {
          const polyline = L.polyline(path, {
            color: '#38bdf8',
            weight: 3,
            opacity: 0.8,
            dashArray: '6, 8',
          });
          polylineGroup.addLayer(polyline);

          // Add direction arrows along polyline segments
          for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            const bearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
            const midLat = (p1[0] + p2[0]) / 2;
            const midLng = (p1[1] + p2[1]) / 2;

            const arrowIcon = L.divIcon({
              className: 'track-direction-arrow',
              html: `<div style="transform: rotate(${bearing}deg); width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5">
                  <polygon points="12 2 19 21 12 17 5 21 12 2"/>
                </svg>
              </div>`,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            });

            const arrowMarker = L.marker([midLat, midLng], {
              icon: arrowIcon,
              interactive: false,
            });
            polylineGroup.addLayer(arrowMarker);
          }
        }
      });
    }

    // Auto pan/zoom behavior
    const isNewPointAdded = locations.length !== lastPointCountRef.current;
    lastPointCountRef.current = locations.length;

    if (boundsPoints.length > 0 && isNewPointAdded) {
      const latestPoint = boundsPoints[0];
      if (followLatest) {
        map.panTo(latestPoint, { animate: true });
      } else if (locations.length <= 1) {
        map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 16 });
      }
    }
  }, [locations, showPath, followLatest]);

  // Handle selected location focusing
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedLocation) return;
    const coords = selectedLocation.coords || selectedLocation;
    const lat = Number(coords.latitude ?? (selectedLocation as any).latitude);
    const lng = Number(coords.longitude ?? (selectedLocation as any).longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], 16, { animate: true });
    }
  }, [selectedLocation]);

  return <div ref={mapContainerRef} className="w-full h-full bg-slate-950" />;
};
