'use client';

import React, { useState } from 'react';
import { MapPin, RefreshCw, Trash2, Smartphone, Layers, Route, Power, CheckCircle, XCircle, X, List } from 'lucide-react';
import { TrackSession, DeviceInfo } from '@/types/location';

interface HeaderProps {
  totalCount: number;
  deviceCount: number;
  sessions: TrackSession[];
  selectedSessionId: string;
  onSelectSessionId: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  devices: DeviceInfo[];
  selectedDeviceId: string;
  onSelectDeviceId: (deviceId: string) => void;
  onDisconnectDevice: (deviceId: string) => void;
  onReconnectDevice: (deviceId: string) => void;
  onDeleteDeviceLocations?: (deviceId: string) => void;
  isRefreshing: boolean;
  onRefresh: () => void;
  onClear: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalCount,
  deviceCount,
  sessions = [],
  onDeleteSession,
  devices = [],
  onDisconnectDevice,
  onReconnectDevice,
  onDeleteDeviceLocations,
  isRefreshing,
  onRefresh,
  onClear,
}) => {
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center z-[1000] shadow-md gap-4">
      {/* Brand Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="bg-sky-500/10 p-2 rounded-xl text-sky-400 border border-sky-500/20 shadow-inner">
          <MapPin className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            TrackIt <span className="text-sky-400 font-semibold">Location Dashboard</span>
          </h1>
        </div>
      </div>

      {/* Top Header Actions & Status Badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-sky-400" />
          <span>Updates:</span>
          <strong className="text-sky-400 font-bold font-mono">{totalCount}</strong>
        </div>

        {/* Devices Modal Button */}
        <button
          onClick={() => setShowDevicesModal(true)}
          className="bg-slate-950 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-emerald-500/40 text-xs font-medium text-slate-300 flex items-center gap-2 transition cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Devices:</span>
          <strong className="text-emerald-400 font-bold font-mono">{deviceCount}</strong>
        </button>

        {/* Sessions Modal Button */}
        <button
          onClick={() => setShowSessionsModal(true)}
          className="bg-slate-950 hover:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-800 hover:border-purple-500/40 text-xs font-medium text-slate-300 flex items-center gap-2 transition cursor-pointer"
        >
          <Route className="w-3.5 h-3.5 text-purple-400" />
          <span>Sessions:</span>
          <strong className="text-purple-400 font-bold font-mono">{sessions.length}</strong>
        </button>

        <div className="h-4 w-px bg-slate-800 hidden sm:block mx-1" />

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <button
          onClick={onClear}
          className="bg-rose-600/90 hover:bg-rose-600 active:bg-rose-700 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear History
        </button>
      </div>

      {/* Sessions Manager Modal Overlay */}
      {showSessionsModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 w-full max-w-lg text-xs relative">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Route className="w-4 h-4 text-purple-400" />
                TrackIt Mobile Sessions ({sessions.length})
              </h3>
              <button
                onClick={() => setShowSessionsModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 text-[11px] mb-3 leading-relaxed">
              Mobile sessions are automatically created when incoming locations arrive with a session ID. You can delete any session and its location fixes below.
            </p>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {sessions.length === 0 ? (
                <div className="text-slate-500 text-center py-8 text-xs">
                  No active or past sessions found.<br />
                  Send locations from your mobile device to create sessions.
                </div>
              ) : (
                sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="font-mono font-bold text-purple-300 text-xs flex items-center gap-2">
                        {sess.id}
                        {sess.isOpen ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-sans font-semibold">
                            🟢 Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded font-sans font-semibold">
                            🔴 Closed
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-sans mt-1 flex items-center gap-3">
                        <span>Device: <strong className="text-slate-300">{sess.device_id}</strong></span>
                        <span>Points: <strong className="text-sky-400">{sess.pointCount}</strong></span>
                        <span>Distance: <strong className="text-purple-400">{(sess.distanceMeters / 1000).toFixed(2)} km</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onDeleteSession(sess.id);
                      }}
                      className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Devices Manager Modal Overlay */}
      {showDevicesModal && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 w-full max-w-md text-xs relative">
            <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Device Connection Manager ({devices.length})
              </h3>
              <button
                onClick={() => setShowDevicesModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-400 text-[11px] mb-3 leading-relaxed">
              Disconnecting a device blocks its background location updates from being accepted by the server. You can also clear all location points for a specific device.
            </p>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {devices.length === 0 ? (
                <p className="text-slate-500 text-center py-6 text-xs">No registered devices found.</p>
              ) : (
                devices.map((dev) => (
                  <div
                    key={dev.id}
                    className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="font-mono font-bold text-slate-200 text-xs flex items-center gap-2">
                        {dev.id}
                        {dev.disconnected ? (
                          <span className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded font-sans font-semibold flex items-center gap-1">
                            <XCircle className="w-3 h-3 text-rose-400" /> Disconnected
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-sans font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-400" /> Connected
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-sans mt-1">
                        Total Fixes: <strong className="text-slate-300">{dev.totalPoints}</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onDeleteDeviceLocations && (
                        <button
                          onClick={() => onDeleteDeviceLocations(dev.id)}
                          title="Delete all location points for this device"
                          className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 p-1.5 rounded-lg text-xs transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {dev.disconnected ? (
                        <button
                          onClick={() => onReconnectDevice(dev.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Power className="w-3.5 h-3.5" /> Reconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => onDisconnectDevice(dev.id)}
                          className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Power className="w-3.5 h-3.5" /> Disconnect
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
