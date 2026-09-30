import { auditLogger } from './auditLogger.js';
import { USERS } from './auth.js';

// Pre-configured starter track matching user's reference image!
const DEFAULT_STARTER_TRACK = {
  id: 'starter_downers_at_dusk',
  type: 'youtube',
  videoId: '7eou_bV6_Qo', // Talha Anjum - Downers at Dusk
  url: 'https://www.youtube.com/watch?v=7eou_bV6_Qo',
  title: 'Downers at Dusk',
  artist: 'Talha Anjum, Umair',
  cover: 'https://i.scdn.co/image/ab67616d0000b273b5f39e31dcfdc602521c7a2d',
  duration: 256,
  addedBy: 'System',
  addedAt: Date.now(),
};

class RoomsManager {
  constructor() {
    this.rooms = new Map();
    this.initRooms();
  }

  initRooms() {
    const roomConfigs = [
      {
        id: 'room_rishi_shweta',
        name: "Rishi & Shweta's Room",
        description: "Shared sanctuary for Rishi & Shweta to listen to music & podcasts",
        allowedUsers: ['Rishi', 'Shweta'],
      },
      {
        id: 'room_rishi_kavita',
        name: "Rishi & Kavita's Room",
        description: "Shared sanctuary for Rishi & Kavita to listen to music & podcasts",
        allowedUsers: ['Rishi', 'Kavita'],
      },
      {
        id: 'room_rishi_archit',
        name: "Rishi & Archit's Room",
        description: "Shared sanctuary for Rishi & Archit to listen to music & podcasts",
        allowedUsers: ['Rishi', 'Archit'],
      },
    ];

    for (const conf of roomConfigs) {
      this.rooms.set(conf.id, {
        ...conf,
        currentTrack: { ...DEFAULT_STARTER_TRACK },
        isPlaying: false,
        currentTime: 0,
        lastSyncTimestamp: Date.now(),
        playbackRate: 1,
        queue: [
          {
            id: 'sample_podcast',
            type: 'youtube',
            videoId: 'dQw4w9WgXcQ',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: 'Lofi Chill Beats & Podcast Room',
            artist: 'DualSync Radio',
            cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=80',
            duration: 212,
            addedBy: 'Rishi',
            addedAt: Date.now() + 1000,
          },
        ],
        chatMessages: [
          {
            id: 'welcome_1',
            sender: 'DualSync Bot',
            avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80',
            text: `Welcome to ${conf.name}! Paste a YouTube or Spotify link to listen together. Click the microphone to start real-time voice call.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: true,
          }
        ],
        activeUsers: new Map(), // socketId -> { username, avatar, joinedAt }
        voiceParticipants: new Map(), // socketId -> { username, isSpeaking, micMuted }
      });
    }
  }

  isUserAllowed(roomId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const cleanUser = (username || '').trim();
    // Admin Rishi can access any room; non-admin can only access their allowed room
    if (cleanUser.toLowerCase() === 'rishi') return true;
    return room.allowedUsers.some((u) => u.toLowerCase() === cleanUser.toLowerCase());
  }

  getRoomsForUser(username) {
    const cleanUser = (username || '').trim().toLowerCase();
    const available = [];
    for (const room of this.rooms.values()) {
      if (cleanUser === 'rishi' || room.allowedUsers.some((u) => u.toLowerCase() === cleanUser)) {
        available.push({
          id: room.id,
          name: room.name,
          description: room.description,
          allowedUsers: room.allowedUsers,
          currentTrack: room.currentTrack,
          isPlaying: room.isPlaying,
          activeCount: room.activeUsers.size,
          voiceCount: room.voiceParticipants.size,
        });
      }
    }
    return available;
  }

  getRoomState(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Calculate current live playhead if playing
    let liveCurrentTime = room.currentTime;
    if (room.isPlaying && room.lastSyncTimestamp) {
      const elapsedSeconds = (Date.now() - room.lastSyncTimestamp) / 1000;
      liveCurrentTime = room.currentTime + elapsedSeconds;
    }

    return {
      id: room.id,
      name: room.name,
      description: room.description,
      allowedUsers: room.allowedUsers,
      currentTrack: room.currentTrack,
      isPlaying: room.isPlaying,
      currentTime: liveCurrentTime,
      lastSyncTimestamp: room.lastSyncTimestamp,
      queue: room.queue,
      chatMessages: room.chatMessages.slice(-100), // last 100 messages
      activeUsers: Array.from(room.activeUsers.values()),
      voiceParticipants: Array.from(room.voiceParticipants.values()),
    };
  }

  userJoinRoom(roomId, username, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const userObj = USERS[username] || {
      username,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    };

    room.activeUsers.set(socketId, {
      socketId,
      username: userObj.username,
      displayName: userObj.displayName || username,
      avatar: userObj.avatar,
      joinedAt: Date.now(),
    });

    auditLogger.log('ROOM_JOINED', username, { roomId, roomName: room.name });
    return this.getRoomState(roomId);
  }

  userLeaveRoom(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const user = room.activeUsers.get(socketId);
    if (user) {
      auditLogger.log('ROOM_LEFT', user.username, { roomId, roomName: room.name });
      room.activeUsers.delete(socketId);
    }
    room.voiceParticipants.delete(socketId);
    return this.getRoomState(roomId);
  }

  handleSocketDisconnect(socketId) {
    const affectedRooms = [];
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.activeUsers.has(socketId)) {
        const user = room.activeUsers.get(socketId);
        auditLogger.log('ROOM_LEFT', user.username, { roomId, reason: 'socket_disconnect' });
        room.activeUsers.delete(socketId);
        room.voiceParticipants.delete(socketId);
        affectedRooms.push(roomId);
      }
    }
    return affectedRooms;
  }

  updatePlayback(roomId, { action, currentTime, isPlaying, track }, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const now = Date.now();

    if (track) {
      room.currentTrack = track;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastSyncTimestamp = now;
      auditLogger.log('PLAYBACK_TRACK_CHANGE', username, {
        roomId,
        trackTitle: track.title,
        artist: track.artist,
      });
    } else {
      if (typeof isPlaying === 'boolean') {
        room.isPlaying = isPlaying;
      }
      if (typeof currentTime === 'number') {
        room.currentTime = Math.max(0, currentTime);
      }
      room.lastSyncTimestamp = now;

      if (action === 'PLAY') {
        auditLogger.log('PLAYBACK_PLAY', username, {
          roomId,
          trackTitle: room.currentTrack?.title,
          currentTime: room.currentTime,
        });
      } else if (action === 'PAUSE') {
        auditLogger.log('PLAYBACK_PAUSE', username, {
          roomId,
          trackTitle: room.currentTrack?.title,
          currentTime: room.currentTime,
        });
      } else if (action === 'SEEK') {
        auditLogger.log('PLAYBACK_SEEK', username, {
          roomId,
          trackTitle: room.currentTrack?.title,
          seekTo: room.currentTime,
        });
      }
    }

    return this.getRoomState(roomId);
  }

  addToQueue(roomId, track, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // If no track is currently set, make this the current track immediately
    if (!room.currentTrack) {
      room.currentTrack = track;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastSyncTimestamp = Date.now();
      auditLogger.log('PLAYBACK_PLAY', username, { roomId, trackTitle: track.title });
    } else {
      room.queue.push(track);
      auditLogger.log('QUEUE_ADD', username, { roomId, trackTitle: track.title, url: track.url });
    }

    return this.getRoomState(roomId);
  }

  removeFromQueue(roomId, trackId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const removed = room.queue.find((t) => t.id === trackId);
    room.queue = room.queue.filter((t) => t.id !== trackId);

    if (removed) {
      auditLogger.log('QUEUE_REMOVE', username, { roomId, trackTitle: removed.title });
    }

    return this.getRoomState(roomId);
  }

  playNext(roomId, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (room.queue.length > 0) {
      const nextTrack = room.queue.shift();
      room.currentTrack = nextTrack;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastSyncTimestamp = Date.now();
      auditLogger.log('QUEUE_AUTO_NEXT', username || 'System', {
        roomId,
        trackTitle: nextTrack.title,
      });
    } else {
      room.isPlaying = false;
      room.currentTime = 0;
    }

    return this.getRoomState(roomId);
  }

  addChatMessage(roomId, { sender, text, avatar }) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      sender: sender || 'Anonymous',
      avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      text: (text || '').trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    room.chatMessages.push(msg);
    if (room.chatMessages.length > 150) {
      room.chatMessages.shift();
    }

    return msg;
  }

  joinVoice(roomId, socketId, user) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.voiceParticipants.set(socketId, {
      socketId,
      username: user.username,
      displayName: user.displayName || user.username,
      avatar: user.avatar,
      isSpeaking: false,
      micMuted: false,
    });

    auditLogger.log('WEBRTC_VOICE_JOIN', user.username, { roomId });
    return Array.from(room.voiceParticipants.values());
  }

  leaveVoice(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const participant = room.voiceParticipants.get(socketId);
    if (participant) {
      auditLogger.log('WEBRTC_VOICE_LEAVE', participant.username, { roomId });
      room.voiceParticipants.delete(socketId);
    }
    return Array.from(room.voiceParticipants.values());
  }

  updateVoiceStatus(roomId, socketId, { isSpeaking, micMuted }) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const participant = room.voiceParticipants.get(socketId);
    if (participant) {
      if (typeof isSpeaking === 'boolean') participant.isSpeaking = isSpeaking;
      if (typeof micMuted === 'boolean') participant.micMuted = micMuted;
    }
    return Array.from(room.voiceParticipants.values());
  }
}

export const roomsManager = new RoomsManager();
