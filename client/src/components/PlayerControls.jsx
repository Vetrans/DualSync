import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  ListMusic,
  MessageSquare,
  Maximize2,
  Minimize2,
  Radio,
} from 'lucide-react';
import { formatTime } from '../utils/formatTime';

// 10s Rewind Icon with embedded '10'
function Rewind10Icon({ className = 'w-5 h-5' }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <RotateCcw className="w-full h-full stroke-[1.8]" />
      <span className="absolute text-[8px] font-black tracking-tighter select-none -mt-0.5">10</span>
    </div>
  );
}

// 10s Fast-Forward Icon with embedded '10'
function Forward10Icon({ className = 'w-5 h-5' }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
      <RotateCw className="w-full h-full stroke-[1.8]" />
      <span className="absolute text-[8px] font-black tracking-tighter select-none -mt-0.5">10</span>
    </div>
  );
}

export default function PlayerControls({
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  volume,
  queueCount,
  unreadChatCount,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onNextTrack,
  onPrevTrack,
  onToggleQueue,
  onToggleChat,
  isFullscreen,
  onToggleFullscreen,
}) {
  const [isSeekingLocally, setIsSeekingLocally] = useState(false);
  const [localSeekTime, setLocalSeekTime] = useState(0);

  // Hover timestamp preview
  const [isHoveringBar, setIsHoveringBar] = useState(false);
  const [hoverPositionPercent, setHoverPositionPercent] = useState(0);
  const [hoverTime, setHoverTime] = useState(0);

  const displayTime = isSeekingLocally ? localSeekTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  // Jump forward or backward by seconds (e.g. +10s or -10s)
  const handleSeekBy = (offset) => {
    const base = isSeekingLocally ? localSeekTime : currentTime;
    const target = Math.max(0, Math.min(duration || 999999, base + offset));
    setLocalSeekTime(target);
    onSeek(target);
  };

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

  const handleBarMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setHoverPositionPercent(percent);
    setHoverTime((percent / 100) * (duration || 0));
  };

  // Keyboard Shortcuts: Left Arrow (-10s), Right Arrow (+10s), Space (Play/Pause)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSeekBy(-10);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSeekBy(10);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        onPlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, isPlaying, isSeekingLocally, localSeekTime]);

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
            {currentTrack?.type === 'spotify' && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1DB954]/20 text-[#1DB954] font-bold border border-[#1DB954]/30">
                {currentTrack.spotifyType === 'show'
                  ? 'Spotify Podcast Show'
                  : currentTrack.spotifyType === 'episode'
                  ? 'Spotify Podcast Episode'
                  : 'Spotify Sync'}
              </span>
            )}
            {currentTrack?.originalType === 'spotify' && currentTrack?.type !== 'spotify' && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#1DB954]/20 text-[#1DB954] font-bold border border-[#1DB954]/30">
                Spotify Sync
              </span>
            )}
            {currentTrack?.type === 'youtube' && !currentTrack?.originalType && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                YouTube Sync
              </span>
            )}
            {currentTrack?.type === 'audio' && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                Direct Audio
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Player Buttons & Timeline Progress Bar (Center) */}
      <div className="flex flex-col items-center w-full sm:w-2/4 max-w-xl">
        {/* Buttons Row: [Previous] [-10s] [Play/Pause] [+10s] [Next] */}
        <div className="flex items-center gap-3 sm:gap-5 mb-1.5">
          {/* Previous Track / Restart */}
          <button
            type="button"
            onClick={onPrevTrack}
            className="text-neutral-400 hover:text-white transition cursor-pointer p-1.5 hover:bg-white/5 rounded-full active:scale-95"
            title="Previous Track / Restart"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* 10s Backward / Rewind */}
          <button
            type="button"
            onClick={() => handleSeekBy(-10)}
            className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition cursor-pointer active:scale-90 flex items-center justify-center group"
            title="Rewind 10 Seconds (Left Arrow)"
          >
            <Rewind10Icon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
          </button>

          {/* Large circular white Play/Pause button */}
          <button
            type="button"
            onClick={onPlayPause}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition shadow-lg shadow-white/10 cursor-pointer mx-1"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-black" />
            ) : (
              <Play className="w-5 h-5 fill-black ml-0.5" />
            )}
          </button>

          {/* 10s Forward / Fast-Forward */}
          <button
            type="button"
            onClick={() => handleSeekBy(10)}
            className="p-2 rounded-full text-neutral-300 hover:text-white hover:bg-white/10 transition cursor-pointer active:scale-90 flex items-center justify-center group"
            title="Forward 10 Seconds (Right Arrow)"
          >
            <Forward10Icon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          </button>

          {/* Next Track */}
          <button
            type="button"
            onClick={onNextTrack}
            className="text-neutral-400 hover:text-white transition cursor-pointer p-1.5 hover:bg-white/5 rounded-full active:scale-95"
            title="Next Track"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Timeline Progress Bar & Timestamps */}
        <div className="w-full flex items-center gap-3 text-xs text-neutral-400 font-medium">
          {/* Current Elapsed Time */}
          <span className="w-11 text-right tabular-nums text-[11px] font-semibold text-neutral-300">
            {formatTime(displayTime)}
          </span>

          {/* Timeline Bar with Hover Tooltip */}
          <div
            className="relative flex-1 flex items-center group py-2 cursor-pointer"
            onMouseEnter={() => setIsHoveringBar(true)}
            onMouseLeave={() => setIsHoveringBar(false)}
            onMouseMove={handleBarMouseMove}
          >
            {/* Timestamp Tooltip on Hover */}
            {isHoveringBar && duration > 0 && (
              <div
                className="absolute -top-7 -translate-x-1/2 px-1.5 py-0.5 rounded bg-neutral-900 border border-white/20 text-[10px] font-bold text-white shadow-xl pointer-events-none whitespace-nowrap z-40 transition-opacity"
                style={{ left: `${hoverPositionPercent}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}

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
              aria-label="Timeline position"
            />
          </div>

          {/* Total Duration */}
          <span className="w-11 text-left tabular-nums text-[11px] font-semibold text-neutral-400">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 3. Utility & Controls (Right) */}
      <div className="flex items-center justify-end gap-3 sm:gap-4 w-full sm:w-1/4">
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
            title={volume === 0 ? 'Unmute' : 'Mute'}
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
            aria-label="Volume"
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
