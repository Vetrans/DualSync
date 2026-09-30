import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, RefreshCw, Trash2, Filter, Clock, User, Globe, Activity } from 'lucide-react';

export default function AdminAuditModal({ isOpen, onClose, socket, token }) {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  // Listen for real-time live audit events emitted by server
  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (newEntry) => {
      setLogs((prev) => [newEntry, ...prev.slice(0, 199)]);
    };

    socket.on('admin_new_audit_log', handleNewLog);
    return () => {
      socket.off('admin_new_audit_log', handleNewLog);
    };
  }, [socket]);

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear all audit logs?')) return;
    try {
      await fetch('/api/admin/clear-logs', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs([]);
    } catch (err) {
      console.warn('Failed to clear logs:', err);
    }
  };

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    if (filter === 'AUTH') return log.action.includes('LOGIN') || log.action.includes('LOGOUT');
    if (filter === 'PLAYBACK') return log.action.includes('PLAYBACK') || log.action.includes('QUEUE');
    if (filter === 'ROOMS') return log.action.includes('ROOM');
    if (filter === 'VOICE') return log.action.includes('WEBRTC');
    return true;
  });

  const getActionBadgeColor = (action) => {
    if (action.includes('LOGIN_SUCCESS')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (action.includes('INACTIVITY')) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    if (action.includes('LOGOUT') || action.includes('FAILED')) return 'bg-red-500/20 text-red-300 border-red-500/30';
    if (action.includes('PLAY')) return 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/30';
    if (action.includes('ROOM')) return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    if (action.includes('WEBRTC')) return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    return 'bg-white/10 text-neutral-300 border-white/10';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#181818] border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>DualSync Admin Audit Stream</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </h2>
              <p className="text-xs text-neutral-400">
                Live monitoring logins, 2-hr inactivity logouts, room movements, and playback
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleClear}
              className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition cursor-pointer"
              title="Clear Logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="p-3 bg-white/[0.02] border-b border-white/5 flex flex-wrap gap-2 text-xs">
          {['ALL', 'AUTH', 'PLAYBACK', 'ROOMS', 'VOICE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                filter === cat
                  ? 'bg-white text-black'
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat === 'ALL' && 'All Activity'}
              {cat === 'AUTH' && 'Logins & Inactivity'}
              {cat === 'PLAYBACK' && 'Media & Queue'}
              {cat === 'ROOMS' && 'Room Joins/Leaves'}
              {cat === 'VOICE' && 'WebRTC Voice'}
            </button>
          ))}
          <div className="ml-auto text-xs text-neutral-400 flex items-center gap-1.5 self-center">
            <Activity className="w-3.5 h-3.5 text-[#1DB954]" />
            <span>{filteredLogs.length} events logged</span>
          </div>
        </div>

        {/* Log Stream List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 font-sans">
              No audit logs recorded for this filter yet.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] border tracking-wider shrink-0 ${getActionBadgeColor(
                      log.action
                    )}`}
                  >
                    {log.action}
                  </span>

                  <span className="font-bold text-white shrink-0">
                    @{log.username}
                  </span>

                  <span className="text-neutral-400 truncate">
                    {log.details ? JSON.stringify(log.details) : ''}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-neutral-400 text-[11px] shrink-0">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-neutral-400" />
                    {log.ip}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
