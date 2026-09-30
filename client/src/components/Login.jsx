import React, { useState } from 'react';
import { Music2, Shield, Lock, User, ArrowRight, Radio } from 'lucide-react';

const PRESET_ACCOUNTS = [
  { username: 'Rishi', pass: 'Mrengineer@001', role: 'Admin', desc: 'Full access to all 3 rooms & Audit Logs' },
  { username: 'Shweta', pass: 'Iamdayaan', role: 'User', desc: 'Access to Rishi & Shweta room' },
  { username: 'Kavita', pass: 'Iamrude', role: 'User', desc: 'Access to Rishi & Kavita room' },
  { username: 'Archit', pass: 'Iloverishi', role: 'User', desc: 'Access to Rishi & Archit room' },
];

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed');
      }

      // Store auth token in localStorage
      localStorage.setItem('dualsync_token', data.token);
      localStorage.setItem('dualsync_user', JSON.stringify(data.user));

      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Could not connect to DualSync server');
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (acc) => {
    setUsername(acc.username);
    setPassword(acc.pass);
    setError('');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#121212] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-[#6b0f24]/30 to-[#1DB954]/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="glass-panel p-8 rounded-2xl shadow-2xl border border-white/10">
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1DB954] to-[#128038] flex items-center justify-center shadow-lg shadow-[#1DB954]/25 mb-4">
              <Radio className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              DualSync
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              Synchronized Music & Podcast Rooms
            </p>
          </div>

          {/* Error notice */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2 animate-shake">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Rishi, Shweta, Kavita, Archit"
                  className="w-full pl-10 pr-4 py-3 bg-[#1e1e1e] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954] transition text-sm"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-3 bg-[#1e1e1e] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954] transition text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.99] font-bold text-black text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-[#1DB954]/20 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Enter DualSync</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Account Preset Switcher */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs font-medium text-neutral-400 mb-3 text-center">
              Quick Select Demo Accounts:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => selectPreset(acc)}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col cursor-pointer ${
                    username.toLowerCase() === acc.username.toLowerCase()
                      ? 'bg-[#1DB954]/15 border-[#1DB954] text-white'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-semibold text-xs text-white">{acc.username}</span>
                    {acc.role === 'Admin' ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        Admin
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-400">User</span>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-0.5 truncate">{acc.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-6 text-[11px] text-center text-neutral-500">
            Sessions auto-expire after 2 hours of inactivity.
          </p>
        </div>
      </div>
    </div>
  );
}
