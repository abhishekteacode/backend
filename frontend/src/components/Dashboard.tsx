'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { LocationRecord, LocationResponse, TrackSession, DeviceInfo } from '@/types/location';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Route, Clock, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

const MapComponent = dynamic(
  () => import('./Map').then((mod) => mod.Map),
  { ssr: false }
);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '/api-proxy';

export const Dashboard: React.FC = () => {
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [mapPoints, setMapPoints] = useState<LocationRecord[]>([]);
  const [sessions, setSessions] = useState<TrackSession[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('ALL');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('ALL');
  
  // Pagination State
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPath, setShowPath] = useState(true);
  const [followLatest, setFollowLatest] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<LocationRecord | null>(null);

  const fetchLocations = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const queryParams = new URLSearchParams({
        format: 'json',
        page: String(page),
        limit: String(limit),
        session_id: selectedSessionId,
        device_id: selectedDeviceId,
        t: String(Date.now()),
      });

      const res = await fetch(`${BACKEND_URL}/locations?${queryParams.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      }).catch(() => null);

      if (res && res.ok) {
        const data: LocationResponse = await res.json();
        setLocations(data.locations || []);
        setMapPoints(data.mapPoints || data.locations || []);
        setTotalCount(data.total || 0);
        setTotalPages(data.totalPages || 1);
        setSessions(data.sessions || []);
        setDevices(data.devices || []);
      }
    } catch (err) {
      // Swallowed silently so transient server restarts don't interrupt dev server
    } finally {
      setIsRefreshing(false);
    }
  }, [page, limit, selectedSessionId, selectedDeviceId]);

  const handleDisconnectDevice = async (deviceId: string) => {
    if (!window.confirm(`Disconnect device [${deviceId}] from streaming locations?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/devices/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        fetchLocations();
      }
    } catch (err) {
      alert('Failed to disconnect device');
    }
  };

  const handleReconnectDevice = async (deviceId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/devices/reconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
      });
      if (res.ok) {
        fetchLocations();
      }
    } catch (err) {
      alert('Failed to reconnect device');
    }
  };

  const handleDeleteSingleRecord = async (recordId: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/locations/record/${encodeURIComponent(recordId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchLocations();
      }
    } catch (err) {
      alert('Failed to delete single location record');
    }
  };

  const handleDeleteDeviceLocations = async (deviceId: string) => {
    if (!window.confirm(`Are you sure you want to delete all location points for device [${deviceId}]?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/devices/${encodeURIComponent(deviceId)}/locations`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedDeviceId === deviceId) {
          setSelectedDeviceId('ALL');
        }
        fetchLocations();
      }
    } catch (err) {
      alert('Failed to delete device location records');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm(`Are you sure you want to delete session [${sessionId}] and all its location fixes?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSelectedSessionId('ALL');
        setSelectedLocation(null);
        setPage(1);
        fetchLocations();
      }
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  const handleClearLocations = async () => {
    if (!window.confirm('Are you sure you want to clear all stored location records and tracking sessions? (Registered devices will remain saved)')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/locations`, { method: 'DELETE' });
      if (res.ok) {
        setLocations([]);
        setMapPoints([]);
        setSessions([]);
        setSelectedLocation(null);
        setSelectedSessionId('ALL');
        setSelectedDeviceId('ALL');
        setTotalCount(0);
        setTotalPages(1);
        setPage(1);
        fetchLocations();
      }
    } catch (err) {
      alert('Failed to clear location history');
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchLocations, 2000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLocations]);

  const uniqueDevices = new Set(locations.map((l) => l.device_id || l.deviceId || 'unknown'));
  const selectedSessionData = sessions.find(s => s.id === selectedSessionId);

  // Calculate session duration string
  const getSessionDurationStr = (session: TrackSession) => {
    if (!session.startTimeMs) return 'N/A';
    const end = session.endTimeMs || Date.now();
    const diffMs = Math.max(0, end - session.startTimeMs);
    const secs = Math.floor(diffMs / 1000) % 60;
    const mins = Math.floor(diffMs / (1000 * 60)) % 60;
    const hrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Header
        totalCount={totalCount}
        deviceCount={devices.length || uniqueDevices.size}
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSessionId={(id) => {
          setSelectedSessionId(id);
          setPage(1);
        }}
        onDeleteSession={handleDeleteSession}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDeviceId={(id) => {
          setSelectedDeviceId(id);
          setPage(1);
        }}
        onDisconnectDevice={handleDisconnectDevice}
        onReconnectDevice={handleReconnectDevice}
        onDeleteDeviceLocations={handleDeleteDeviceLocations}
        isRefreshing={isRefreshing}
        onRefresh={fetchLocations}
        onClear={handleClearLocations}
      />

      <main className="flex flex-1 relative overflow-hidden min-h-0 flex-col md:flex-row">
        <div className="flex-1 h-full min-h-[50vh] relative">
          {/* Active Session Info Banner Overlay */}
          {selectedSessionData && (
            <div className="absolute top-4 left-4 z-[400] bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-3.5 shadow-xl text-xs flex flex-wrap items-center gap-4 max-w-[90%]">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-purple-400" />
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-1.5 font-mono">
                    {selectedSessionData.id}
                    {selectedSessionData.isOpen ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-sans">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.2 rounded font-sans">
                        <XCircle className="w-3 h-3" /> Closed
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-sans">
                    Device: <strong className="text-slate-300">{selectedSessionData.device_id}</strong>
                  </div>
                </div>
              </div>

              <div className="h-6 w-px bg-slate-800 hidden sm:block" />

              <div className="flex items-center gap-4 text-slate-300">
                <div>
                  <span className="text-slate-400 text-[10px] block">Distance</span>
                  <strong className="text-purple-400 text-sm font-semibold">
                    {(selectedSessionData.distanceMeters / 1000).toFixed(2)} km
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block">Points</span>
                  <strong className="text-sky-400 text-sm font-semibold">
                    {selectedSessionData.pointCount}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Duration
                  </span>
                  <strong className="text-amber-400 text-xs font-semibold">
                    {getSessionDurationStr(selectedSessionData)}
                  </strong>
                </div>

                <button
                  onClick={() => handleDeleteSession(selectedSessionData.id)}
                  title="Delete this session"
                  className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 p-1.5 rounded-lg transition ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <MapComponent
            locations={mapPoints}
            showPath={showPath}
            followLatest={followLatest}
            selectedLocation={selectedLocation}
          />
        </div>

        <Sidebar
          locations={locations}
          sessions={sessions}
          devices={devices}
          selectedSessionId={selectedSessionId}
          onSelectSessionId={(id) => {
            setSelectedSessionId(id);
            setPage(1);
          }}
          onDeleteSession={handleDeleteSession}
          selectedDeviceId={selectedDeviceId}
          onSelectDeviceId={(id) => {
            setSelectedDeviceId(id);
            setPage(1);
          }}
          onDeleteDeviceLocations={handleDeleteDeviceLocations}
          onDeleteRecord={handleDeleteSingleRecord}
          page={page}
          limit={limit}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={setLimit}
          showPath={showPath}
          onToggleShowPath={setShowPath}
          followLatest={followLatest}
          onToggleFollowLatest={setFollowLatest}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={setAutoRefresh}
          onSelectLocation={(loc) => setSelectedLocation(loc)}
        />
      </main>
    </div>
  );
};
