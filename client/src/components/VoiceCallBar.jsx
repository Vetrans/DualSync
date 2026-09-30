import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, PhoneCall, Radio, Users } from 'lucide-react';

export default function VoiceCallBar({
  isVoiceActive,
  isMicMuted,
  isDeafened,
  isSpeaking,
  participants,
  currentUser,
  onJoinVoice,
  onLeaveVoice,
  onToggleMute,
  onToggleDeafen,
}) {
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-2">
      <div className="glass-panel p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-3 shadow-xl border border-white/10">
        {/* Left: Status & Participant Avatars */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isVoiceActive
                ? isSpeaking
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/50 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400'
                : 'bg-white/5 text-neutral-400'
            }`}
          >
            {isVoiceActive ? <Radio className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </div>

          <div className="min-w-0">
            <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
              <span>{isVoiceActive ? 'WebRTC Voice Live' : 'Voice Chat Available'}</span>
              {isVoiceActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              )}
            </div>
            <div className="text-[10px] text-neutral-400 truncate">
              {isVoiceActive
                ? `${participants.length} connected in audio`
                : 'Talk while listening to music together'}
            </div>
          </div>
        </div>

        {/* Center: Avatars with speaking rings */}
        {isVoiceActive && (
          <div className="hidden sm:flex items-center -space-x-2">
            {participants.map((p) => {
              const speaking = p.isSpeaking;
              const muted = p.micMuted;

              return (
                <div
                  key={p.socketId || p.username}
                  className="relative group cursor-pointer"
                  title={`${p.displayName || p.username} ${muted ? '(Muted)' : speaking ? '(Speaking)' : ''}`}
                >
                  <img
                    src={p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                    alt={p.username}
                    className={`w-7 h-7 rounded-full object-cover border-2 transition-all ${
                      speaking
                        ? 'border-emerald-400 ring-2 ring-emerald-400/60 scale-110'
                        : 'border-[#181818]'
                    }`}
                  />
                  {muted && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border border-black flex items-center justify-center text-[7px] text-white">
                      ✕
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {isVoiceActive ? (
            <>
              {/* Mute Mic */}
              <button
                type="button"
                onClick={onToggleMute}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  isMicMuted
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
                }`}
                title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>

              {/* Deafen Remote Audio */}
              <button
                type="button"
                onClick={onToggleDeafen}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  isDeafened
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
                }`}
                title={isDeafened ? 'Undeafen' : 'Deafen (Mute Peers)'}
              >
                {isDeafened ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Disconnect Voice */}
              <button
                type="button"
                onClick={onLeaveVoice}
                className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Disconnect Voice"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Leave</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onJoinVoice}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Join Voice</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
