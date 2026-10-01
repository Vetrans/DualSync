import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  VolumeX,
  ListMusic,
  MessageSquare,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Radio,
} from 'lucide-react';
import { formatTime } from '../utils/formatTime';

export default function PlayerControls({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  queueCount,
  unreadChatCount,
  isVoiceActive,
  isMicMuted,
  isSpeaking,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onNextTrack,
  onPrevTrack,
  onToggleQueue,
  onToggleChat,
  onToggleVoice,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
}) {
  const [isSeekingLocally, setIsSeekingLocally] = useState(false);
  const [localSeekTime, setLocalSeekTime] = useState(0);

  const displayTime = isSeekingLocally ? localSeekTime : currentTime;
  const progressPercent = duration > 0 ? (displayTime / duration) * 100 : 0;

  const handleSeekStart = (e) => {
    setIsSeekingLocally(true);
    setLocalSeekTime(parseFloat(e.target.value));
  };

  const handleSeekChange = (e) => {
    setLocalSeekTime(parseFloat(e.target.value));
  };

  const handleSeekEnd = (e) => {
    setIsSeekingLocally(false);
    const newTime = parseFloat(e.target.value);
    onSeek(newTime);
  };

  return (
    <div className="w-full bg-[#181818]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 select-none z-30">
      {/* 1. Track Info (Left) */}
      <div className="flex items-center gap-3 w-full sm:w-1/4 min-w-0">
        <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-neutral-800 shadow-md flex items-center justify-center">
          {currentTrack?.cover ? (
            <img
              src={currentTrack.cover}
              alt="Track Artwork"
              className="w-full h-full object-cover"
            />
          ) : (
            <Radio className="w-5 h-5 text-neutral-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white truncate">
            {currentTrack?.title || 'Nothing playing'}
          </div>
          <div className="text-xs text-neutral-400 truncate flex items-center gap-1.5 mt-0.5">
            <span>{currentTrack?.artist || 'Queue is empty'}</span>
            {currentTrack?.originalType === 'spotify' && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1DB954]/20 text-[#1DB954] font-bold border border-[#1DB954]/30">
                Spotify Sync
              </span>
            )}
            {currentTrack?.type === 'youtube' && !currentTrack?.originalType && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                YouTube Sync
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Player Buttons & Progress Bar (Center) */}
      <div className="flex flex-col items-center w-full sm:w-2/4 max-w-xl">
        {/* Buttons Row */}
        <div className="flex items-center gap-5 sm:gap-6 mb-1.5">
          <button
            type="button"
            className="text-neutral-400 hover:text-white transition cursor-pointer p-1"
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onPrevTrack}
            className="text-neutral-300 hover:text-white transition cursor-pointer p-1"
            title="Previous / Restart"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Large circular white Play/Pause button */}
          <button
            type="button"
            onClick={onPlayPause}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition shadow-lg shadow-white/10 cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-black" />
            ) : (
              <Play className="w-5 h-5 fill-black ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={onNextTrack}
            className="text-neutral-300 hover:text-white transition cursor-pointer p-1"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            type="button"
            className="text-neutral-400 hover:text-white transition cursor-pointer p-1"
            title="Repeat"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar & Timestamps */}
        <div className="w-full flex items-center gap-2.5 text-xs text-neutral-400 font-medium">
          <span className="w-10 text-right tabular-nums text-[11px]">
            {formatTime(displayTime)}
          </span>

          <div className="relative flex-1 flex items-center group py-1">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={displayTime}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onChange={handleSeekChange}
              onMouseUp={handleSeekEnd}
              onTouchEnd={handleSeekEnd}
              className="w-full"
              style={{
                background: `linear-gradient(to right, #1DB954 ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%)`,
              }}
            />
          </div>

          <span className="w-10 text-left tabular-nums text-[11px]">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 3. Utility & Controls (Right) */}
      <div className="flex items-center justify-end gap-3 sm:gap-4 w-full sm:w-1/4">
        {/* Voice Call Mic Toggle */}
        <button
          type="button"
          onClick={onToggleVoice}
          className={`relative p-2 rounded-xl border transition flex items-center justify-center cursor-pointer ${
            isVoiceActive
              ? isSpeaking
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/40'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border-white/5'
          }`}
          title={isVoiceActive ? 'Voice Connected (Click to disconnect)' : 'Join WebRTC Voice Call'}
        >
          {isVoiceActive ? (
            isMicMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-emerald-400" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          {isVoiceActive && !isMicMuted && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          )}
        </button>

        {/* Queue Button */}
        <button
          type="button"
          onClick={onToggleQueue}
          className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/5 transition cursor-pointer"
          title="Queue / Playlist"
        >
          <ListMusic className="w-4 h-4" />
          {queueCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#1DB954] text-black font-extrabold text-[9px]">
              {queueCount}
            </span>
          )}
        </button>

        {/* Chat Button */}
        <button
          type="button"
          onClick={onToggleChat}
          className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border border-white/5 transition cursor-pointer"
          title="Room Chat"
        >
          <MessageSquare className="w-4 h-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-blue-500 text-white font-extrabold text-[9px] animate-pulse">
              {unreadChatCount}
            </span>
          )}
        </button>

        {/* Volume Slider */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => onVolumeChange(volume === 0 ? 80 : 0)}
            className="text-neutral-400 hover:text-white transition cursor-pointer"
          >
            {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolumeChange(parseInt(e.target.value, 10))}
            className="w-20"
            style={{
              background: `linear-gradient(to right, #ffffff ${volume}%, rgba(255, 255, 255, 0.2) ${volume}%)`,
            }}
          />
        </div>

        {/* Fullscreen Toggle */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="hidden sm:block p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border border-white/5 transition cursor-pointer"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
