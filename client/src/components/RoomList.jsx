import React from 'react';
import { Radio, Users, Music, Play, ShieldAlert, LogOut, ArrowRight, Disc3 } from 'lucide-react';

export default function RoomList({ rooms, currentUser, onSelectRoom, onOpenAuditLogs, onLogout }) {
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="min-h-screen w-full bg-[#121212] text-white p-4 sm:p-8 flex flex-col items-center relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-gradient-to-b from-[#5a0d1d]/30 via-transparent to-transparent pointer-events-none blur-3xl" />

      {/* Top Navigation Header */}
      <header className="w-full max-w-5xl flex items-center justify-between pb-6 mb-8 border-b border-white/10 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1DB954] flex items-center justify-center shadow-lg shadow-[#1DB954]/20">
            <Radio className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              DualSync
            </h1>
            <p className="text-xs text-neutral-400">
              {isAdmin ? 'Admin Dashboard - All Shared Rooms' : 'Your Synchronized Sanctuary'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={onOpenAuditLogs}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Audit Logs</span>
            </button>
          )}

          <div className="flex items-center gap-3 pl-3 border-l border-white/10">
            <div className="text-left">
              <div className="text-sm font-bold leading-none text-white">{currentUser?.displayName || currentUser?.username}</div>
              <div className="text-[10px] text-neutral-400 mt-1 capitalize font-medium">{currentUser?.role}</div>
            </div>
            <button
              onClick={onLogout}
              title="Log Out"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition ml-1 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl z-10">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {isAdmin ? 'Active Co-Listening Rooms' : 'Your Shared Listening Room'}
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            {isAdmin
              ? 'Select any room to supervise, listen, or chat with participants.'
              : 'Listen to music, watch podcasts, talk on voice, and chat together in real time.'}
          </p>
        </div>

        {/* Room Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => {
            const hasPlayingTrack = room.currentTrack && room.isPlaying;

            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className="group relative rounded-2xl p-6 bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 hover:border-white/25 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
              >
                {/* Active Indicator & Participants Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${room.activeCount > 0 ? 'bg-[#1DB954] animate-pulse' : 'bg-neutral-600'}`} />
                    <span className="text-xs font-medium text-neutral-300">
                      {room.activeCount} online
                    </span>
                  </div>
                </div>

                {/* Room Info */}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-white group-hover:text-[#1DB954] transition mb-1 flex items-center gap-2">
                    {room.name}
                  </h3>
                  <p className="text-xs text-neutral-400 line-clamp-2">
                    {room.description}
                  </p>
                </div>

                {/* Now Playing Widget Preview */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 mb-6 flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-800 flex items-center justify-center">
                    {room.currentTrack?.cover ? (
                      <>
                        <img
                          src={room.currentTrack.cover}
                          alt="Cover"
                          className={`w-full h-full object-cover ${hasPlayingTrack ? 'scale-105' : ''}`}
                        />
                        {hasPlayingTrack && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Disc3 className="w-5 h-5 text-[#1DB954] animate-spin-slow" />
                          </div>
                        )}
                      </>
                    ) : (
                      <Radio className="w-5 h-5 text-neutral-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold">
                      {room.currentTrack ? (room.isPlaying ? 'Now Playing' : 'Paused') : 'Room Ready'}
                    </div>
                    <div className="text-xs font-semibold text-white truncate">
                      {room.currentTrack?.title || 'No track playing'}
                    </div>
                    <div className="text-[11px] text-neutral-400 truncate">
                      {room.currentTrack?.artist || 'Queue is empty'}
                    </div>
                  </div>
                </div>

                {/* Enter Button */}
                <div className="pt-2 flex items-center justify-between border-t border-white/5">
                  <span className="text-xs font-semibold text-neutral-400 group-hover:text-white transition">
                    Enter Sanctuary
                  </span>
                  <div className="w-8 h-8 rounded-full bg-white/10 group-hover:bg-[#1DB954] group-hover:text-black text-white flex items-center justify-center transition">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {rooms.length === 0 && (
          <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
            <Radio className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No Accessible Rooms</h3>
            <p className="text-sm text-neutral-400 mt-1">
              You do not have permission to view any room. Please contact Admin Rishi.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
