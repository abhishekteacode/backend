'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { LocationRecord, LocationResponse, TrackSession, DeviceInfo } from '@/types/location';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Route, Clock, Trash2, AlertTriangle, X, ShieldAlert } from 'lucide-react';

const MapComponent = dynamic(
  () => import('./Map').then((mod) => mod.Map),
  { ssr: false }
);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
}

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
  
  // Attractive Centered Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    onConfirm: () => {},
  });

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

  const handleDisconnectDevice = (deviceId: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Disconnect Device [${deviceId}]?`,
      message: `Disconnecting device [${deviceId}] will block all its incoming background location updates from being accepted by the server.`,
      confirmText: 'Yes, Disconnect Device',
      onConfirm: async () => {
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
          console.error('Failed to disconnect device', err);
        }
      },
    });
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
      console.error('Failed to reconnect device', err);
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
      console.error('Failed to delete location record', err);
    }
  };

  const handleDeleteDeviceLocations = (deviceId: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Device Locations [${deviceId}]?`,
      message: `Are you sure you want to delete all location points recorded for device [${deviceId}]? This action cannot be undone.`,
      confirmText: 'Yes, Delete Points',
      onConfirm: async () => {
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
          console.error('Failed to delete device location records', err);
        }
      },
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete Tracking Session [${sessionId}]?`,
      message: `Are you sure you want to delete session [${sessionId}] and all its recorded location points? This cannot be undone.`,
      confirmText: 'Yes, Delete Session',
      onConfirm: async () => {
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
          console.error('Failed to delete session', err);
        }
      },
    });
  };

  const handleClearLocations = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Full Database & History?',
      message: 'Are you sure you want to clear all stored location records and tracking sessions from MongoDB? On confirmation, full database location history will be permanently wiped.',
      confirmText: 'Yes, Clear Full Database',
      onConfirm: async () => {
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
          console.error('Failed to clear location history', err);
        }
      },
    });
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
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      <Header
        totalCount={totalCount}
        deviceCount={devices.length || uniqueDevices.size}
        sessions={sessions}
        selectedSessionId={selectedSessionId}
        onSelectSessionId={setSelectedSessionId}
        onDeleteSession={handleDeleteSession}
        devices={devices}
        selectedDeviceId={selectedDeviceId}
        onSelectDeviceId={setSelectedDeviceId}
        onDisconnectDevice={handleDisconnectDevice}
        onReconnectDevice={handleReconnectDevice}
        onDeleteDeviceLocations={handleDeleteDeviceLocations}
        isRefreshing={isRefreshing}
        onRefresh={fetchLocations}
        onClear={handleClearLocations}
      />

      <main className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative bg-slate-900">
          {/* Active Session Info Bar Overlay */}
          {selectedSessionData && (
            <div className="absolute top-4 left-4 z-[999] bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-lg text-xs max-w-sm">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono font-bold text-purple-400 flex items-center gap-1.5">
                  <Route className="w-3.5 h-3.5 text-purple-400" />
                  {selectedSessionData.id}
                </span>
                {selectedSessionData.isOpen ? (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-semibold">
                    🟢 Active
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded font-semibold">
                    🔴 Closed
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
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
                  className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 p-1.5 rounded-lg transition ml-2 cursor-pointer"
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

      {/* 🌟 ATTRACTIVE CENTERED CONFIRMATION DIALOG 🌟 */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800/80 rounded-3xl shadow-2xl shadow-rose-950/40 p-6 w-full max-w-md text-center relative overflow-hidden transform transition-all scale-100">
            {/* Top Glowing Ambient Accent */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-20 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Close Cross Button */}
            <button
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800/80 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Pulsing Icon */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-b from-rose-500/20 to-rose-500/5 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400 shadow-inner">
              <ShieldAlert className="w-7 h-7 animate-pulse" />
            </div>

            {/* Title & Message */}
            <h3 className="text-lg font-extrabold tracking-tight text-white mb-2">
              {confirmModal.title}
            </h3>

            <p className="text-slate-400 text-xs leading-relaxed mb-6 px-2">
              {confirmModal.message}
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 px-4 rounded-xl text-xs border border-slate-700/50 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
