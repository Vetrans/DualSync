import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  Users,
  ShieldAlert,
  LogOut,
  Maximize2,
  Minimize2,
  Radio,
} from 'lucide-react';
import PlayerControls from './PlayerControls';
import MediaEngine from './MediaEngine';
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
      console.log('[Socket] Playback sync received:', syncData.action, syncData);
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

  // 8. Play specific track immediately
  const handlePlayTrackNow = (track) => {
    socket?.emit('playback_action', {
      roomId: room.id,
      action: 'TRACK_CHANGE',
      track,
      currentTime: 0,
      isPlaying: true,
    });
  };

  // 9. Send Chat Message
  const handleSendMessage = (text) => {
    socket?.emit('send_chat', {
      roomId: room.id,
      text,
    });
  };

  // 10. Fullscreen Toggle
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

  return (
    <div
      ref={playerContainerRef}
      className="relative w-full h-screen bg-[#121212] overflow-hidden flex flex-col justify-between select-none"
    >
      {/* Dynamic Spotify Ambient Glow based on reference image */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#5c0d1d] via-[#24060c] to-[#121212] pointer-events-none transition-all duration-1000" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#80132b]/25 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-20 w-full px-4 sm:px-8 pt-4 sm:pt-6 flex items-center justify-between text-white">
        {/* Back to Rooms */}
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-xs font-semibold backdrop-blur-md transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>All Rooms</span>
        </button>

        {/* Room Title & Online Avatars */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-ping" />
            <h1 className="text-sm sm:text-base font-extrabold tracking-wide text-white drop-shadow-md">
              {room.name}
            </h1>
          </div>
          <div className="text-[11px] text-neutral-300 font-medium flex items-center gap-1.5 mt-0.5">
            <Users className="w-3.5 h-3.5 text-neutral-400" />
            <span>{activeUsers.length} in room</span>
          </div>
        </div>

        {/* Right Top Actions: Admin Logs & Logout */}
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setIsAdminAuditOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Admin Audit Logs"
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">Audit Logs</span>
            </button>
          )}

          <button
            onClick={onLogout}
            title="Log Out"
            className="p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Centerpiece: Fullscreen Artwork (Directly matched to user's uploaded reference image!) */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 max-w-5xl mx-auto w-full my-auto">
        <div className="flex flex-col items-center max-w-md sm:max-w-lg w-full text-center">
          {/* Centered Album Cover / Dynamic Empty State */}
          <div className="relative group w-64 h-64 sm:w-96 sm:h-96 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-white/10 transition-transform duration-500 hover:scale-[1.02] bg-neutral-900 flex items-center justify-center">
            {currentTrack?.cover ? (
              <>
                <img
                  src={currentTrack.cover}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40 group-hover:opacity-20 transition" />
              </>
            ) : (
              <div
                onClick={() => setIsQueueOpen(true)}
                className="flex flex-col items-center justify-center text-center p-6 cursor-pointer group-hover:scale-105 transition"
              >
                <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:border-[#1DB954] group-hover:bg-[#1DB954]/10 transition">
                  <Radio className="w-10 h-10 text-neutral-400 group-hover:text-[#1DB954] transition" />
                </div>
                <span className="text-sm font-bold text-white mb-1">Queue is Empty</span>
                <span className="text-xs text-neutral-400 max-w-xs">
                  Click here or open the Queue to paste a YouTube, Spotify, or Podcast link!
                </span>
              </div>
            )}
          </div>

          {/* Song Title and Artist */}
          <div className="mt-6 sm:mt-8 w-full px-4">
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight truncate drop-shadow-lg">
              {currentTrack?.title || 'Nothing Playing'}
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 font-medium mt-1 truncate">
              {currentTrack?.artist || 'Add a track to the queue to begin listening together'}
            </p>
          </div>

          {/* Media Details / Queue Quick Cards */}
          <div className="w-full grid grid-cols-2 gap-3 mt-6 sm:mt-8 hidden sm:grid">
            <div
              onClick={() => setIsQueueOpen(true)}
              className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-left hover:bg-black/60 transition cursor-pointer"
            >
              <span className="text-xs font-bold text-white block">Media Source</span>
              <span className="text-[11px] text-neutral-400 mt-0.5 truncate block">
                {currentTrack ? (currentTrack.originalType === 'spotify' ? 'Spotify Sync' : 'YouTube Sync') : 'No link queued'}
              </span>
            </div>
            <div
              onClick={() => setIsQueueOpen(true)}
              className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-left hover:bg-black/60 transition cursor-pointer"
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

      {/* Bottom Sticky Player Controls Bar */}
      <footer className="relative z-30 w-full">
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
