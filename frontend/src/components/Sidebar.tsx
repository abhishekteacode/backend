'use client';

import React, { useState } from 'react';
import { LocationRecord, TrackSession, DeviceInfo } from '@/types/location';
import { 
  Activity, 
  Battery, 
  BatteryCharging, 
  ShieldCheck, 
  ShieldAlert, 
  Flag, 
  AlertTriangle, 
  Search,
  Navigation,
  CheckSquare,
  Square,
  Route,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Smartphone,
  SlidersHorizontal
} from 'lucide-react';

interface SidebarProps {
  locations: LocationRecord[];
  sessions?: TrackSession[];
  selectedSessionId: string;
  onSelectSessionId: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  devices?: DeviceInfo[];
  selectedDeviceId?: string;
  onSelectDeviceId?: (deviceId: string) => void;
  onDeleteDeviceLocations?: (deviceId: string) => void;
  onDeleteRecord?: (recordId: string) => void;
  page: number;
  limit: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  showPath: boolean;
  onToggleShowPath: (value: boolean) => void;
  followLatest: boolean;
  onToggleFollowLatest: (value: boolean) => void;
  autoRefresh: boolean;
  onToggleAutoRefresh: (value: boolean) => void;
  onSelectLocation: (loc: LocationRecord) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  locations,
  sessions = [],
  selectedSessionId,
  onSelectSessionId,
  onDeleteSession,
  devices = [],
  selectedDeviceId = 'ALL',
  onSelectDeviceId,
  onDeleteDeviceLocations,
  onDeleteRecord,
  page,
  limit,
  totalPages,
  onPageChange,
  onLimitChange,
  showPath,
  onToggleShowPath,
  followLatest,
  onToggleFollowLatest,
  autoRefresh,
  onToggleAutoRefresh,
  onSelectLocation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const parseDate = (isoString?: string) => {
    if (!isoString) return new Date();
    const cleaned = typeof isoString === 'string' && isoString.endsWith('Z') ? isoString.slice(0, -1) : isoString;
    return new Date(cleaned);
  };

  const filteredLocations = locations.filter((loc) => {
    const locSessId = loc.session_id || loc.sessionId || loc.sessionID;
    const locDevId = loc.device_id || loc.deviceId || 'unknown';

    if (selectedSessionId && selectedSessionId !== 'ALL' && locSessId !== selectedSessionId) {
      return false;
    }

    if (selectedDeviceId && selectedDeviceId !== 'ALL' && locDevId !== selectedDeviceId) {
      return false;
    }

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const devId = locDevId.toLowerCase();
    const sessId = (locSessId || '').toLowerCase();
    const activity = (loc.activity?.type || '').toLowerCase();
    const event = (loc.event || '').toLowerCase();
    return devId.includes(q) || sessId.includes(q) || activity.includes(q) || event.includes(q);
  });

  return (
    <aside className="w-full md:w-[380px] bg-slate-900 border-l border-slate-800 flex flex-col h-full overflow-hidden shrink-0 shadow-lg">
      {/* Sidebar Header & Control Filters */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/95 backdrop-blur space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            Filters & Control Panel
          </h2>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            Page {page} of {Math.max(1, totalPages)}
          </span>
        </div>

        {/* Device & Session Filter Selectors */}
        <div className="space-y-2.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
          {/* Device Selector */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-300">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Smartphone className="w-3.5 h-3.5" /> Filter by Device:
              </span>
              {selectedDeviceId !== 'ALL' && onDeleteDeviceLocations && (
                <button
                  onClick={() => onDeleteDeviceLocations(selectedDeviceId)}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/20 transition cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" /> Delete Points
                </button>
              )}
            </div>
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                onSelectDeviceId?.(e.target.value);
                onPageChange(1);
              }}
              className="w-full bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition font-mono truncate"
            >
              <option value="ALL">📱 All Devices ({devices.length})</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id} ({d.totalPoints} pts {d.disconnected ? '🔴 Off' : '🟢 On'})
                </option>
              ))}
            </select>
          </div>

          {/* Session Selector */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-300">
              <span className="flex items-center gap-1.5 text-purple-400">
                <Route className="w-3.5 h-3.5" /> Filter by Session:
              </span>
              {selectedSessionId !== 'ALL' && onDeleteSession && (
                <button
                  onClick={() => onDeleteSession(selectedSessionId)}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/20 transition cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" /> Delete Session
                </button>
              )}
            </div>
            <select
              value={selectedSessionId}
              onChange={(e) => {
                onSelectSessionId(e.target.value);
                onPageChange(1);
              }}
              className="w-full bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition font-mono truncate"
            >
              <option value="ALL">🌐 All Sessions ({sessions.length})</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id} ({s.pointCount} pts {s.isOpen ? '🟢 Active' : '🔴 Closed'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Toggle Switches */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onToggleShowPath(!showPath)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
              showPath
                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                : 'bg-slate-800/50 border-slate-800 text-slate-400'
            }`}
          >
            {showPath ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            Path
          </button>

          <button
            type="button"
            onClick={() => onToggleFollowLatest(!followLatest)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
              followLatest
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800/50 border-slate-800 text-slate-400'
            }`}
          >
            {followLatest ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            Follow
          </button>

          <button
            type="button"
            onClick={() => onToggleAutoRefresh(!autoRefresh)}
            className={`px-2 py-1.5 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition ${
              autoRefresh
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-slate-800/50 border-slate-800 text-slate-400'
            }`}
          >
            {autoRefresh ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            Live 2s
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search feed logs by text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Location Cards List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-700">
        {filteredLocations.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500 text-xs leading-relaxed">
            No location logs received yet for this filter.<br />
            Send location updates from your app or curl script.
          </div>
        ) : (
          filteredLocations.map((loc, idx) => {
            const coords = loc.coords || loc;
            const lat = Number(coords.latitude ?? (loc as any).latitude);
            const lng = Number(coords.longitude ?? (loc as any).longitude);
            const devId = loc.device_id || loc.deviceId || 'unknown';
            const sessId = loc.session_id || loc.sessionId || loc.sessionID;
            const dateObj = parseDate(loc.timestamp);
            const timeStr = dateObj.toLocaleTimeString();

            const batt = loc.battery || {};
            const battLevel = batt.level != null ? `${Math.round(batt.level * 100)}%` : 'N/A';
            const isCharging = batt.is_charging ?? batt.isCharging ?? false;
            const isPowerSave = batt.is_power_save_mode ?? batt.isPowerSaveMode ?? false;

            const perm = loc.permission || {};
            const permStatus = perm.statusName || (perm.status !== undefined ? `Code ${perm.status}` : null);

            const gf = loc.geofence || (loc.extras && loc.extras.geofence);

            return (
              <div
                key={idx}
                onClick={() => onSelectLocation(loc)}
                className="bg-slate-950/80 hover:bg-slate-800/60 border border-slate-800 hover:border-sky-500/50 rounded-xl p-3 text-xs transition cursor-pointer group shadow-sm"
              >
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="bg-sky-600/90 text-white font-semibold px-2 py-0.5 rounded text-[11px] group-hover:bg-sky-500 transition">
                      {devId}
                    </span>
                    {sessId && (
                      <span className="bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30 px-1.5 py-0.5 rounded text-[10px]">
                        ID: {sessId}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {timeStr}
                    </span>
                    {onDeleteRecord && loc.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRecord(loc.id!);
                        }}
                        title="Delete this single location record"
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition cursor-pointer opacity-80 hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="font-mono font-semibold text-sky-400 text-[13px] mb-2 flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-sky-400 transform rotate-45" />
                  {isNaN(lat) ? 'N/A' : lat.toFixed(5)}, {isNaN(lng) ? 'N/A' : lng.toFixed(5)}
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300 text-[11px]">
                  <div>Acc: <strong className="text-slate-200">±{Math.round(coords.accuracy || 0)}m</strong></div>
                  <div>Speed: <strong className="text-slate-200">{(coords.speed || 0).toFixed(1)}m/s</strong></div>
                  <div>Activity: <strong className="text-slate-200">{loc.activity?.type || 'N/A'}</strong></div>
                  <div className="flex items-center gap-1">
                    {isCharging ? (
                      <BatteryCharging className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Battery className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{battLevel}</span>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 items-center text-[10px]">
                  {permStatus && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${
                        permStatus === 'Denied' || permStatus === 'Restricted'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      }`}
                    >
                      {permStatus === 'Denied' ? (
                        <ShieldAlert className="w-3 h-3" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      Perm: {permStatus}
                    </span>
                  )}

                  {isPowerSave && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Saver: ON 🪫
                    </span>
                  )}

                  {loc.event && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 w-full">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      Event: {loc.event}
                    </span>
                  )}

                  {gf && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 w-full">
                      <Flag className="w-3 h-3 text-purple-400" />
                      Fence: {gf.identifier} ({gf.status || gf.action || 'ACTIVE'})
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer Controls */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-slate-300 font-semibold px-1">
            {page} / {Math.max(1, totalPages)}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Limit Selector */}
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <span>Show:</span>
          <select
            value={limit}
            onChange={(e) => {
              onLimitChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-1.5 py-1 text-xs focus:outline-none"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
          </select>
        </div>
      </div>
    </aside>
  );
};
