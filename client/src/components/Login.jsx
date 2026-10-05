import React, { useState, useEffect } from 'react';
import { Lock, User, ArrowRight, Radio, Sparkles, Clock, Users, ShieldCheck } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState('member'); // 'member' | 'guest'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Queue state for guest capacity limits
  const [inQueue, setInQueue] = useState(false);
  const [queueWaitSecs, setQueueWaitSecs] = useState(0);

  // Live countdown timer for queue
  useEffect(() => {
    let timer = null;
    if (inQueue && queueWaitSecs > 0) {
      timer = setInterval(() => {
        setQueueWaitSecs((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setInQueue(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [inQueue, queueWaitSecs]);

  // Format seconds into "Xm Ys"
  const formatWaitTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  // Member Login
  const handleMemberLogin = async (e) => {
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
        throw new Error(data.message || 'Invalid username or password');
      }

      localStorage.setItem('dualsync_token', data.token);
      localStorage.setItem('dualsync_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Could not connect to DualSync server');
    } finally {
      setLoading(false);
    }
  };

  // Guest Login
  const handleGuestLogin = async (e) => {
    if (e) e.preventDefault();
    if (!nickname.trim()) {
      setError('Please choose a nickname to enter');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/guest-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      const data = await res.json();

      // Guest Capacity Full -> Enter Queue
      if (res.status === 429 || data.inQueue) {
        setInQueue(true);
        const waitSec = Math.max(1, Math.ceil((data.waitMs || 60000) / 1000));
        setQueueWaitSecs(waitSec);
        setError(data.message || 'Guest capacity reached (5/5). You are in queue.');
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Could not enter as guest');
      }

      localStorage.setItem('dualsync_token', data.token);
      localStorage.setItem('dualsync_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message || 'Could not connect to DualSync server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#121212] relative overflow-hidden safe-pb safe-pt">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[350px] sm:h-[600px] bg-gradient-to-tr from-[#6b0f24]/30 to-[#1DB954]/15 rounded-full blur-[90px] sm:blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md z-10">
        <div className="glass-panel p-6 sm:p-8 rounded-2xl shadow-2xl border border-white/10">
          {/* Logo & Header */}
          <div className="flex flex-col items-center mb-5 sm:mb-6 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#1DB954] to-[#128038] flex items-center justify-center shadow-lg shadow-[#1DB954]/25 mb-3 sm:mb-4">
              <Radio className="w-8 h-8 sm:w-9 sm:h-9 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              DualSync
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Synchronized Music, Podcasts & Real-Time Co-Listening
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 mb-5 rounded-xl bg-black/40 border border-white/10 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('member');
                setError('');
                setInQueue(false);
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMode === 'member'
                  ? 'bg-[#1DB954] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Member Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMode('guest');
                setError('');
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                authMode === 'guest'
                  ? 'bg-[#1DB954] text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Enter as Guest</span>
            </button>
          </div>

          {/* Queue Notice Banner for Guests */}
          {inQueue && queueWaitSecs > 0 && (
            <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2 animate-pulse">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-200">
                <Clock className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Guest Capacity Full (5/5) — You are in Queue</span>
              </div>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                DualSync maintains ultra-low latency audio sync by limiting guest capacity. The earliest slot frees up in:
              </p>
              <div className="py-2 px-3 rounded-lg bg-black/50 border border-amber-500/20 text-center font-mono font-extrabold text-base text-amber-400">
                {formatWaitTime(queueWaitSecs)}
              </div>
              <p className="text-[10px] text-neutral-400 text-center">
                Please stay on this page. Slot will unlock automatically!
              </p>
            </div>
          )}

          {/* Error Notice */}
          {error && !inQueue && (
            <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* MEMBER FORM */}
          {authMode === 'member' ? (
            <form onSubmit={handleMemberLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your member username"
                    className="w-full pl-10 pr-4 py-3 bg-[#1e1e1e] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954] transition text-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your secret password"
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
                    <span>Enter Sanctuary</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="mt-4 text-[11px] text-center text-neutral-500">
                VIP Member sessions auto-expire after 2 hours of inactivity.
              </p>
            </form>
          ) : (
            /* GUEST FORM */
            <form onSubmit={handleGuestLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="nickname"
                  className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5"
                >
                  Choose Your Guest Nickname
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    id="nickname"
                    name="nickname"
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="e.g. MusicVibe_42"
                    maxLength={24}
                    className="w-full pl-10 pr-4 py-3 bg-[#1e1e1e] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954] transition text-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-neutral-400 space-y-1">
                <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                  <Users className="w-3.5 h-3.5 text-[#1DB954]" />
                  <span>Public Jam Lounge Access</span>
                </div>
                <p>
                  Guests experience 30 minutes of synchronized playback, rich chat with reactions, and voice chat in the community lounge.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || (inQueue && queueWaitSecs > 0)}
                className="w-full py-3.5 mt-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] active:scale-[0.99] font-bold text-black text-sm tracking-wide transition flex items-center justify-center gap-2 shadow-lg shadow-[#1DB954]/20 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : inQueue && queueWaitSecs > 0 ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>In Queue ({formatWaitTime(queueWaitSecs)})</span>
                  </>
                ) : (
                  <>
                    <span>Enter Guest Jam Lounge</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <p className="mt-4 text-[11px] text-center text-neutral-500">
                Guest sessions strictly auto-expire after 30 minutes to manage website load.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
