import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Users,
  ShieldAlert,
  LogOut,
  Maximize2,
  Minimize2,
  Radio,
  Disc3,
  Layers,
} from 'lucide-react';
import PlayerControls from './PlayerControls';
import MediaEngine from './MediaEngine';
import SpotifyEmbedPlayer from './SpotifyEmbedPlayer';
import QueueDrawer from './QueueDrawer';
import ChatDrawer from './ChatDrawer';
import AdminAuditModal from './AdminAuditModal';

export default function PlayerView({
  room,
  currentUser,
  socket,
  token,
  onLeaveRoom,
  onLogout,
}) {
  // Playback state
  const [currentTrack, setCurrentTrack] = useState(room.currentTrack);
  const [isPlaying, setIsPlaying] = useState(room.isPlaying);
  const [currentTime, setCurrentTime] = useState(room.currentTime || 0);
  const [duration, setDuration] = useState(room.currentTrack?.duration || 0);
  const [volume, setVolume] = useState(85);

  // Queue & Chat state
  const [queue, setQueue] = useState(room.queue || []);
  const [chatMessages, setChatMessages] = useState(room.chatMessages || []);
  const [activeUsers, setActiveUsers] = useState(room.activeUsers || []);

  // Drawer toggles
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAdminAuditOpen, setIsAdminAuditOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const playerContainerRef = useRef(null);

  const isAdmin = currentUser?.role === 'admin';

  // 1. Socket Listeners for Real-Time Sync
  useEffect(() => {
    if (!socket) return;

    // Room state update (users joined/left)
    const handleRoomState = (updatedState) => {
      if (updatedState.id !== room.id) return;
      if (updatedState.currentTrack !== undefined) setCurrentTrack(updatedState.currentTrack);
      setIsPlaying(updatedState.isPlaying);
      if (typeof updatedState.currentTime === 'number') setCurrentTime(updatedState.currentTime);
      if (updatedState.queue) setQueue(updatedState.queue);
      if (updatedState.activeUsers) setActiveUsers(updatedState.activeUsers);
    };

    // Playback sync from any user in room
    const handlePlaybackSync = (syncData) => {
      if (syncData.currentTrack !== undefined) {
        setCurrentTrack(syncData.currentTrack);
      }
      setIsPlaying(syncData.isPlaying);
      if (typeof syncData.currentTime === 'number') {
        setCurrentTime(syncData.currentTime);
      }
    };

    // Queue sync
    const handleQueueSync = ({ queue: updatedQueue, currentTrack: updatedTrack }) => {
      if (updatedQueue) setQueue(updatedQueue);
      if (updatedTrack !== undefined) setCurrentTrack(updatedTrack);
    };

    // Live chat message
    const handleNewChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatOpen) {
        setUnreadChatCount((prev) => prev + 1);
      }
    };

    socket.on('room_state_update', handleRoomState);
    socket.on('room_playback_sync', handlePlaybackSync);
    socket.on('room_queue_sync', handleQueueSync);
    socket.on('new_chat_message', handleNewChatMessage);

    return () => {
      socket.off('room_state_update', handleRoomState);
      socket.off('room_playback_sync', handlePlaybackSync);
      socket.off('room_queue_sync', handleQueueSync);
      socket.off('new_chat_message', handleNewChatMessage);
    };
  }, [socket, room.id, isChatOpen]);

  // Reset unread chat badge when chat drawer opens
  useEffect(() => {
    if (isChatOpen) {
      setUnreadChatCount(0);
    }
  }, [isChatOpen]);

  // 2. User Controls Play/Pause
  const handlePlayPause = () => {
    const nextPlayState = !isPlaying;
    setIsPlaying(nextPlayState);

    socket?.emit('playback_action', {
      roomId: room.id,
      action: nextPlayState ? 'PLAY' : 'PAUSE',
      currentTime,
      isPlaying: nextPlayState,
    });
  };

  // 3. User Controls Seek
  const handleSeek = (newTime) => {
    setCurrentTime(newTime);
    socket?.emit('playback_action', {
      roomId: room.id,
      action: 'SEEK',
      currentTime: newTime,
      isPlaying,
    });
  };

  // 4. User Controls Next Track
  const handleNextTrack = () => {
    socket?.emit('queue_next', { roomId: room.id });
  };

  // 5. User Controls Previous / Restart Track
  const handlePrevTrack = () => {
    if (currentTime > 3) {
      handleSeek(0);
    } else {
      socket?.emit('playback_action', {
        roomId: room.id,
        action: 'SEEK',
        currentTime: 0,
        isPlaying: true,
      });
    }
  };

  // 6. Add Media Link (YouTube, Spotify, Podcast)
  const handleAddMedia = async (url) => {
    const res = await fetch('/api/resolve-media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, roomId: room.id }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to resolve media URL');
    }

    socket?.emit('queue_add', {
      roomId: room.id,
      track: data.track,
    });
  };

  // 7. Remove track from queue
  const handleRemoveTrack = (trackId) => {
    socket?.emit('queue_remove', {
      roomId: room.id,
      trackId,
    });
  };

  // 8. Reorder queue
  const handleReorderQueue = (newQueue) => {
    setQueue(newQueue);
    socket?.emit('queue_reorder', {
      roomId: room.id,
      queue: newQueue,
    });
  };

  // 9. Play specific track immediately
  const handlePlayTrackNow = (track) => {
    socket?.emit('playback_action', {
      roomId: room.id,
      action: 'TRACK_CHANGE',
      track,
      currentTime: 0,
      isPlaying: true,
    });
  };

  // 10. Send Chat Message
  const handleSendMessage = (text) => {
    socket?.emit('send_chat', {
      roomId: room.id,
      text,
    });
  };

  // 11. Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const isVideoOrYouTube = currentTrack?.type === 'youtube' || !!currentTrack?.videoId;

  return (
    <div
      ref={playerContainerRef}
      className="relative w-full h-[100dvh] min-h-[100dvh] bg-[#121212] overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Dynamic Ambient Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#4a0d17] via-[#1c050a] to-[#121212] pointer-events-none transition-all duration-1000" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] md:w-[750px] h-[350px] sm:h-[600px] md:h-[750px] bg-[#80132b]/20 rounded-full blur-[100px] sm:blur-[140px] pointer-events-none" />

      {/* ================================================================ */}
      {/* TOP HEADER BAR (Mobile, Tablet & Laptop Optimized)              */}
      {/* ================================================================ */}
      <header className="relative z-20 w-full px-3 sm:px-6 md:px-8 pt-3 sm:pt-5 pb-2 flex items-center justify-between text-white safe-pt">
        {/* Back to Rooms */}
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-xs font-semibold backdrop-blur-md transition cursor-pointer active:scale-95 shrink-0"
          title="Return to Room List"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden xs:inline">All Rooms</span>
        </button>

        {/* Room Title & Online Member Names */}
        <div className="flex flex-col items-center max-w-[50%] sm:max-w-[60%] px-2 text-center">
          <div className="flex items-center gap-1.5 sm:gap-2 max-w-full">
            <span className="w-2 h-2 rounded-full bg-[#1DB954] shrink-0 animate-pulse" />
            <h1
              className="text-xs sm:text-base font-extrabold tracking-wide text-white drop-shadow-md truncate"
              title={room.name}
            >
              {room.name}
            </h1>
          </div>
          <div className="text-[10px] sm:text-[11px] text-neutral-300 font-medium flex items-center gap-1 mt-0.5 truncate max-w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] shrink-0" />
            <span className="truncate">
              {activeUsers.length > 0
                ? activeUsers.map((u) => u.displayName || u.username).join(', ')
                : `${activeUsers.length} in room`}
            </span>
          </div>
        </div>

        {/* Right Top Actions: User Info, Admin Logs & Logout */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="text-right hidden md:block">
            <div className="text-xs font-bold text-white leading-tight">
              {currentUser?.displayName || currentUser?.username}
            </div>
            <div className="text-[10px] text-neutral-400 capitalize">
              {currentUser?.role}
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsAdminAuditOpen(true)}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
              title="Admin Audit Logs"
            >
              <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Audit Logs</span>
            </button>
          )}

          <button
            onClick={onLogout}
            title="Log Out"
            className="p-1.5 sm:p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-neutral-400 hover:text-white transition cursor-pointer active:scale-95"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================================================================ */}
      {/* CENTERPIECE: DYNAMIC ARTWORK / VIDEO / EMPTY STATE              */}
      {/* ================================================================ */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-3 sm:px-6 py-2 max-w-4xl mx-auto w-full min-h-0 overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center w-full text-center my-auto">
          {/* Artwork Card with Ambient Glow */}
          <div className="relative group flex items-center justify-center w-full max-w-sm sm:max-w-md md:max-w-lg">
            {/* Ambient Background Glow matching artwork */}
            {currentTrack?.cover && (
              <div
                className="absolute -inset-2 sm:-inset-4 rounded-3xl opacity-35 blur-xl sm:blur-2xl -z-10 scale-95 transition-all duration-700 pointer-events-none"
                style={{
                  backgroundImage: `url(${currentTrack.cover})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
            )}

            {/* Container for Album Art / Spotify Player / Empty State */}
            <div
              className={`relative rounded-2xl overflow-hidden shadow-2xl shadow-black/90 border border-white/10 transition-transform duration-300 hover:scale-[1.01] bg-black/60 backdrop-blur-sm flex items-center justify-center w-full ${
                isVideoOrYouTube
                  ? 'aspect-video max-h-[34vh] sm:max-h-[42vh] md:max-h-[46vh]'
                  : 'aspect-square max-w-[240px] sm:max-w-[320px] md:max-w-[360px] max-h-[34vh] sm:max-h-[42vh]'
              }`}
            >
              {currentTrack?.type === 'spotify' ? (
                <div className="w-full h-full p-2 flex flex-col justify-center items-center bg-black/50">
                  <SpotifyEmbedPlayer
                    key={currentTrack.id}
                    track={currentTrack}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                    onDurationChange={(d) => setDuration(d)}
                    onPlaybackToggle={(playing, time) => {
                      setIsPlaying(playing);
                      socket?.emit('playback_action', {
                        roomId: room.id,
                        action: playing ? 'PLAY' : 'PAUSE',
                        currentTime: time,
                        isPlaying: playing,
                      });
                    }}
                    onSeekChange={(time) => {
                      setCurrentTime(time);
                      socket?.emit('playback_action', {
                        roomId: room.id,
                        action: 'SEEK',
                        currentTime: time,
                        isPlaying,
                      });
                    }}
                    onTrackEnded={handleNextTrack}
                  />
                </div>
              ) : currentTrack?.cover ? (
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <img
                    src={currentTrack.cover}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-30 group-hover:opacity-10 transition duration-300 pointer-events-none" />
                </div>
              ) : (
                <div
                  onClick={() => setIsQueueOpen(true)}
                  className="flex flex-col items-center justify-center text-center p-6 cursor-pointer group-hover:scale-105 transition"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 group-hover:border-[#1DB954] group-hover:bg-[#1DB954]/10 transition">
                    <Radio className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-400 group-hover:text-[#1DB954] transition" />
                  </div>
                  <span className="text-sm font-bold text-white mb-1">Queue is Empty</span>
                  <span className="text-xs text-neutral-400 max-w-xs">
                    Click here or open the Queue to paste a YouTube, Spotify, or Podcast link!
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Song Title and Artist (Clean 2-line clamp with responsive typography) */}
          <div className="mt-4 sm:mt-6 w-full px-2 max-w-xl">
            <h2
              className="text-base sm:text-xl md:text-2xl font-extrabold text-white tracking-tight line-clamp-2 drop-shadow-lg leading-snug"
              title={currentTrack?.title || 'Nothing Playing'}
            >
              {currentTrack?.title || 'Nothing Playing'}
            </h2>
            <p
              className="text-xs sm:text-sm text-neutral-400 font-medium mt-1 truncate"
              title={currentTrack?.artist}
            >
              {currentTrack?.artist || 'Add a track to the queue to begin listening together'}
            </p>
          </div>

          {/* Quick Info Bar on Mobile (<640px) */}
          <div className="sm:hidden flex items-center justify-center gap-2 mt-3 w-full">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-300 font-medium truncate max-w-[150px]">
              {currentTrack
                ? currentTrack.type === 'spotify'
                  ? 'Spotify Podcast'
                  : currentTrack.originalType === 'spotify'
                  ? 'Spotify Sync'
                  : currentTrack.type === 'audio'
                  ? 'Audio Stream'
                  : 'YouTube Sync'
                : 'No track'}
            </span>
            <button
              onClick={() => setIsQueueOpen(true)}
              className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#1DB954]/15 hover:bg-[#1DB954]/25 border border-[#1DB954]/30 text-[#1DB954] font-semibold transition cursor-pointer"
            >
              {queue.length > 0 ? `${queue.length} in queue` : '+ Add track'}
            </button>
          </div>

          {/* Media Details / Queue Quick Cards (sm+ devices: Tablets & Laptops) */}
          <div className="w-full max-w-md grid-cols-2 gap-3 mt-5 hidden sm:grid">
            <div
              onClick={() => setIsQueueOpen(true)}
              className="p-3 rounded-xl bg-black/40 border border-white/10 text-left hover:bg-black/60 transition cursor-pointer backdrop-blur-md"
            >
              <span className="text-xs font-bold text-white block">Media Source</span>
              <span className="text-[11px] text-neutral-400 mt-0.5 truncate block">
                {currentTrack
                  ? currentTrack.type === 'spotify'
                    ? currentTrack.spotifyType === 'show'
                      ? 'Spotify Podcast Show'
                      : 'Spotify Podcast Episode'
                    : currentTrack.originalType === 'spotify'
                    ? 'Spotify Sync'
                    : currentTrack.type === 'audio'
                    ? 'Direct Audio Stream'
                    : 'YouTube Sync'
                  : 'No link queued'}
              </span>
            </div>
            <div
              onClick={() => setIsQueueOpen(true)}
              className="p-3 rounded-xl bg-black/40 border border-white/10 text-left hover:bg-black/60 transition cursor-pointer backdrop-blur-md"
            >
              <span className="text-xs font-bold text-white block">Room Queue</span>
              <span className="text-[11px] text-neutral-400 mt-0.5 truncate block">
                {queue.length > 0 ? `${queue.length} track(s) waiting` : 'Empty (Click to add)'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Hidden Synchronized Media Engine (YouTube Iframe & Audio) */}
      <MediaEngine
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        currentTime={currentTime}
        volume={volume}
        onTimeUpdate={(t) => setCurrentTime(t)}
        onDurationChange={(d) => setDuration(d)}
        onTrackEnded={handleNextTrack}
      />

      {/* Sticky Bottom Player Controls Bar */}
      <footer className="relative z-30 w-full shrink-0">
        <PlayerControls
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          queueCount={queue.length}
          unreadChatCount={unreadChatCount}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onVolumeChange={setVolume}
          onNextTrack={handleNextTrack}
          onPrevTrack={handlePrevTrack}
          onToggleQueue={() => setIsQueueOpen(!isQueueOpen)}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </footer>

      {/* Slide-out Queue Drawer */}
      <QueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        currentTrack={currentTrack}
        queue={queue}
        onAddMedia={handleAddMedia}
        onRemoveTrack={handleRemoveTrack}
        onPlayTrackNow={handlePlayTrackNow}
        onReorderQueue={handleReorderQueue}
      />

      {/* Slide-out Chat Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        currentUser={currentUser}
      />

      {/* Admin Audit Modal (Rishi only) */}
      {isAdmin && (
        <AdminAuditModal
          isOpen={isAdminAuditOpen}
          onClose={() => setIsAdminAuditOpen(false)}
          socket={socket}
          token={token}
        />
      )}
    </div>
  );
}
