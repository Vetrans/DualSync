import { auditLogger } from './auditLogger.js';
import { USERS } from './auth.js';

class RoomsManager {
  constructor() {
    this.rooms = new Map();
    this.initRooms();
  }

  initRooms() {
    const roomConfigs = [
      {
        id: 'room_rishi_shweta',
        name: "Velvet Studio (VIP)",
        description: "Private sanctuary for high-fidelity co-listening and conversation",
        allowedUsers: ['Rishi', 'Shweta'],
      },
      {
        id: 'room_rishi_kavita',
        name: "Emerald Loft (VIP)",
        description: "Private sanctuary for high-fidelity co-listening and conversation",
        allowedUsers: ['Rishi', 'Kavita'],
      },
      {
        id: 'room_rishi_archit',
        name: "Obsidian Suite (VIP)",
        description: "Private sanctuary for high-fidelity co-listening and conversation",
        allowedUsers: ['Rishi', 'Archit'],
      },
      {
        id: 'room_guest_jam',
        name: "Guest Jam Lounge",
        description: "Open community lounge for guest visitors & members to co-listen, chat, and test real-time features",
        allowedUsers: ['*'],
      },
    ];

    for (const conf of roomConfigs) {
      this.rooms.set(conf.id, {
        ...conf,
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        lastSyncTimestamp: Date.now(),
        playbackRate: 1,
        queue: [],
        chatMessages: [],
        activeUsers: new Map(), // socketId -> { username, displayName, avatar, joinedAt }
        voiceParticipants: new Map(), // socketId -> { username, displayName, isSpeaking, micMuted }
      });
    }
  }

  isUserAllowed(roomId, username, role) {
    if (roomId === 'room_guest_jam') return true;
    if (role === 'guest') return false; // Guests cannot enter VIP rooms!

    const room = this.rooms.get(roomId);
    if (!room) return false;
    const cleanUser = (username || '').trim().toLowerCase();
    if (cleanUser === 'rishi' || role === 'admin') return true;
    return room.allowedUsers.some((u) => u.toLowerCase() === cleanUser);
  }

  getRoomsForUser(username, role) {
    const cleanUser = (username || '').trim().toLowerCase();

    // Guests ONLY see the public Guest Jam Lounge
    if (role === 'guest') {
      const guestRoom = this.rooms.get('room_guest_jam');
      if (!guestRoom) return [];
      return [{
        id: guestRoom.id,
        name: guestRoom.name,
        description: guestRoom.description,
        allowedUsers: ['Community'],
        currentTrack: guestRoom.currentTrack,
        isPlaying: guestRoom.isPlaying,
        activeCount: guestRoom.activeUsers.size,
        voiceCount: guestRoom.voiceParticipants.size,
      }];
    }

    const available = [];
    for (const room of this.rooms.values()) {
      if (
        room.id === 'room_guest_jam' ||
        cleanUser === 'rishi' ||
        role === 'admin' ||
        room.allowedUsers.some((u) => u.toLowerCase() === cleanUser)
      ) {
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
      chatMessages: room.chatMessages.slice(-150),
      activeUsers: Array.from(room.activeUsers.values()),
      voiceParticipants: Array.from(room.voiceParticipants.values()),
    };
  }

  userJoinRoom(roomId, username, socketId, userObj = {}) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const profile = USERS[username] || {
      username,
      displayName: userObj.displayName || username,
      avatar: userObj.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    };

    room.activeUsers.set(socketId, {
      socketId,
      username: profile.username,
      displayName: userObj.displayName || profile.displayName || username,
      avatar: userObj.avatar || profile.avatar,
      joinedAt: Date.now(),
    });

    auditLogger.log('ROOM_JOINED', userObj.displayName || profile.displayName || username, { roomId, roomName: room.name });
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

  addToQueue(roomId, trackOrTracks, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const tracksToAdd = Array.isArray(trackOrTracks)
      ? trackOrTracks
      : trackOrTracks?.isPlaylist && Array.isArray(trackOrTracks.tracks)
      ? trackOrTracks.tracks
      : trackOrTracks
      ? [trackOrTracks]
      : [];

    if (tracksToAdd.length === 0) return this.getRoomState(roomId);

    let startIndex = 0;
    // If no track is currently set, make the first track the current track immediately
    if (!room.currentTrack) {
      const firstTrack = tracksToAdd[0];
      room.currentTrack = firstTrack;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastSyncTimestamp = Date.now();
      auditLogger.log('PLAYBACK_PLAY', username, { roomId, trackTitle: firstTrack.title });
      startIndex = 1;
    }

    // Append remaining tracks to queue
    for (let i = startIndex; i < tracksToAdd.length; i++) {
      room.queue.push(tracksToAdd[i]);
    }

    if (tracksToAdd.length > 1) {
      auditLogger.log('QUEUE_ADD_BATCH', username, {
        roomId,
        count: tracksToAdd.length,
        playlistTitle: trackOrTracks.title || 'Playlist',
      });
    } else if (startIndex === 0 && tracksToAdd.length === 1) {
      auditLogger.log('QUEUE_ADD', username, { roomId, trackTitle: tracksToAdd[0].title, url: tracksToAdd[0].url });
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

  reorderQueue(roomId, newQueue, username) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    if (Array.isArray(newQueue)) {
      room.queue = newQueue;
      auditLogger.log('QUEUE_REORDER', username, { roomId, queueLength: newQueue.length });
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

  addChatMessage(roomId, { sender, text, avatar, replyTo, file, mentions }) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      sender: sender || 'Anonymous',
      avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
      text: (text || '').trim().substring(0, 2000),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replyTo: replyTo && replyTo.id ? {
        id: replyTo.id,
        sender: replyTo.sender,
        text: (replyTo.text || '').substring(0, 150),
      } : null,
      file: file && file.url ? {
        url: file.url,
        name: file.name || 'attachment',
        type: file.type || 'application/octet-stream',
        size: file.size || 0,
      } : null,
      mentions: Array.isArray(mentions) ? mentions : [],
      reactions: {}, // emoji -> [username1, username2]
    };

    room.chatMessages.push(msg);
    if (room.chatMessages.length > 200) {
      room.chatMessages.shift();
    }

    return msg;
  }

  toggleChatMessageReaction(roomId, messageId, emoji, username) {
    const room = this.rooms.get(roomId);
    if (!room || !messageId || !emoji || !username) return null;

    const msg = room.chatMessages.find((m) => m.id === messageId);
    if (!msg) return null;

    if (!msg.reactions || typeof msg.reactions !== 'object') {
      msg.reactions = {};
    }

    const currentUsers = Array.isArray(msg.reactions[emoji]) ? [...msg.reactions[emoji]] : [];
    const index = currentUsers.indexOf(username);
    if (index > -1) {
      currentUsers.splice(index, 1);
      if (currentUsers.length === 0) {
        delete msg.reactions[emoji];
      } else {
        msg.reactions[emoji] = currentUsers;
      }
    } else {
      currentUsers.push(username);
      msg.reactions[emoji] = currentUsers;
    }

    return { messageId, reactions: msg.reactions };
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
