import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  login,
  loginGuest,
  getGuestStatus,
  logout,
  validateSession,
  touchSession,
  canAccessRoom,
  startSessionInactivityMonitor,
  sessions,
} from './auth.js';
import { roomsManager } from './roomsManager.js';
import { auditLogger } from './auditLogger.js';
import { resolveMediaUrl, searchYouTubeVideo } from './mediaResolver.js';
import { setupWebRTCSignaling } from './webrtcSignaling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Ensure public uploads directory exists
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Enable CORS, cookie-parser, & 10MB JSON parsing for media attachments
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve uploaded chat attachments safely
app.use('/uploads', express.static(uploadsDir));

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 15000,
});

// Setup WebRTC signaling
setupWebRTCSignaling(io);

// Track user socket mappings: token -> Set<socketId>
const userSockets = new Map();

// Helper: extract session from Request header
function getSessionFromReq(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    return validateSession(token);
  }
  return null;
}

// ----------------------------------------------------
// REST API ENDPOINTS
// ----------------------------------------------------

// 1. Member Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';

  const result = login(username, password, ip, userAgent);
  if (!result.success) {
    return res.status(401).json(result);
  }

  res.json(result);
});

// 1b. Guest Login (30-min auto-logout, max 5 capacity queue)
app.post('/api/guest-login', (req, res) => {
  const { nickname } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || '';

  const result = loginGuest(nickname, ip, userAgent);
  if (!result.success) {
    if (result.inQueue) {
      return res.status(429).json(result);
    }
    return res.status(400).json(result);
  }

  res.json(result);
});

// 1c. Guest Capacity Status & Queue Wait Info
app.get('/api/guest-status', (req, res) => {
  res.json(getGuestStatus());
});

// 2. User Logout
app.post('/api/logout', (req, res) => {
  const session = getSessionFromReq(req);
  if (session) {
    logout(session.token, 'manual');
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// 3. Current User Status (Resets inactivity counter)
app.get('/api/me', (req, res) => {
  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
  res.json({
    user: session.user,
    lastActivity: session.lastActivity,
    isGuest: !!session.isGuest,
    expiresAt: session.expiresAt,
  });
});

// 4. Inactivity Heartbeat
app.post('/api/activity', (req, res) => {
  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ error: 'Session expired' });
  }
  touchSession(session.token);
  res.json({ success: true, lastActivity: session.lastActivity });
});

// 5. Get accessible rooms
app.get('/api/rooms', (req, res) => {
  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const rooms = roomsManager.getRoomsForUser(session.user.username, session.user.role);
  res.json({ rooms });
});

// 6. Get single room state
app.get('/api/rooms/:id', (req, res) => {
  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const roomId = req.params.id;
  if (!canAccessRoom(session.user.username, roomId, session.user.role)) {
    auditLogger.log('UNAUTHORIZED_ACCESS_ATTEMPT', session.user.username, { roomId });
    return res.status(403).json({ error: 'You do not have permission to access this room' });
  }

  const room = roomsManager.getRoomState(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({ room });
});

// 7. Resolve Media Link (YouTube, Spotify, Direct Audio)
app.post('/api/resolve-media', async (req, res) => {
  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, roomId } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Please provide a valid media URL' });
  }

  try {
    const track = await resolveMediaUrl(url, session.user.username);
    res.json({ success: true, track });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Chat File / Media Attachment Upload
app.post('/api/chat/upload', (req, res) => {
  const session = getSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { filename, filetype, base64Data, roomId } = req.body;
  if (!filename || !base64Data || !roomId) {
    return res.status(400).json({ error: 'Missing file data or roomId' });
  }

  if (!canAccessRoom(session.user.username, roomId, session.user.role)) {
    return res.status(403).json({ error: 'Access denied to this room' });
  }

  // Validate allowed MIME types
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/m4a',
    'application/pdf', 'text/plain',
  ];
  if (!allowedMimes.includes(filetype)) {
    return res.status(400).json({ error: 'Unsupported file type. Only images, audio, and documents allowed.' });
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    // Limit to 5MB
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum limit of 5MB' });
    }

    const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const safeBase = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const fileId = Date.now().toString(36) + '_' + crypto.randomBytes(4).toString('hex');
    const finalFilename = `${fileId}_${safeBase}.${ext}`;
    const filePath = path.join(uploadsDir, finalFilename);

    fs.writeFileSync(filePath, buffer);

    auditLogger.log('CHAT_FILE_UPLOADED', session.user.displayName || session.user.username, {
      roomId,
      filename: finalFilename,
      size: buffer.length,
      type: filetype,
    });

    res.json({
      success: true,
      file: {
        url: `/uploads/${finalFilename}`,
        name: `${safeBase}.${ext}`,
        type: filetype,
        size: buffer.length,
      },
    });
  } catch (err) {
    console.error('[ChatUpload] Error saving file:', err);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

// 9. Admin Audit Logs (Strictly Rishi)
app.get('/api/admin/audit-logs', (req, res) => {
  const session = getSessionFromReq(req);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  res.json({
    logs: auditLogger.getLogs(200),
  });
});

// 10. Admin Clear Logs
app.post('/api/admin/clear-logs', (req, res) => {
  const session = getSessionFromReq(req);
  if (!session || session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  auditLogger.clearLogs();
  auditLogger.log('LOGS_CLEARED', session.user.username, {});
  res.json({ success: true, message: 'Audit logs cleared' });
});

// ----------------------------------------------------
// REAL-TIME SOCKET.IO LOGIC
// ----------------------------------------------------

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error('Authentication token required'));
  }

  const session = validateSession(token);
  if (!session) {
    return next(new Error('Session invalid or expired'));
  }

  socket.user = session.user;
  socket.token = token;
  next();
});

io.on('connection', (socket) => {
  const { user, token } = socket;

  // Track socket per session
  if (!userSockets.has(token)) {
    userSockets.set(token, new Set());
  }
  userSockets.get(token).add(socket.id);

  // Keep session alive on any socket event (for members)
  socket.use((packet, next) => {
    touchSession(token);
    next();
  });

  // Admin Audit Log Subscription
  if (user.role === 'admin') {
    const unsubscribe = auditLogger.subscribe((logEntry) => {
      socket.emit('admin_new_audit_log', logEntry);
    });
    socket.on('disconnect', unsubscribe);
  }

  // Join a Room
  socket.on('join_room', ({ roomId }) => {
    if (!canAccessRoom(user.username, roomId, user.role)) {
      socket.emit('error_message', 'You do not have access to this room');
      return;
    }

    socket.join(roomId);
    socket.currentRoomId = roomId;

    const roomState = roomsManager.userJoinRoom(roomId, user.username, socket.id, user);
    io.to(roomId).emit('room_state_update', roomState);
  });

  // Leave a Room
  socket.on('leave_room', ({ roomId }) => {
    if (socket.currentRoomId === roomId) {
      socket.leave(roomId);
      socket.currentRoomId = null;
      const roomState = roomsManager.userLeaveRoom(roomId, socket.id);
      if (roomState) {
        io.to(roomId).emit('room_state_update', roomState);
      }
    }
  });

  // Playback Control (Play / Pause / Seek / Change Track)
  socket.on('playback_action', async ({ roomId, action, currentTime, isPlaying, track }) => {
    if (!canAccessRoom(user.username, roomId, user.role)) return;

    if (track && !track.videoId && track.title) {
      try {
        const query = `${track.title} ${track.artist || ''}`.trim();
        const ytMatch = await searchYouTubeVideo(query);
        if (ytMatch && ytMatch.videoId) {
          track.videoId = ytMatch.videoId;
          if (!track.duration && ytMatch.duration) {
            track.duration = ytMatch.duration;
          }
        }
      } catch (e) {}
    }

    const updatedState = roomsManager.updatePlayback(
      roomId,
      { action, currentTime, isPlaying, track },
      user.username
    );

    if (updatedState) {
      io.to(roomId).emit('room_playback_sync', {
        action,
        currentTrack: updatedState.currentTrack,
        isPlaying: updatedState.isPlaying,
        currentTime: updatedState.currentTime,
        lastSyncTimestamp: updatedState.lastSyncTimestamp,
        updatedBy: user.displayName || user.username,
      });
    }
  });

  // Queue Operations
  socket.on('queue_add', ({ roomId, track }) => {
    if (!canAccessRoom(user.username, roomId, user.role)) return;
    const previousState = roomsManager.getRoomState(roomId);
    const updatedState = roomsManager.addToQueue(roomId, track, user.displayName || user.username);
    if (updatedState) {
      io.to(roomId).emit('room_queue_sync', {
        queue: updatedState.queue,
        currentTrack: updatedState.currentTrack,
      });

      if (!previousState?.currentTrack && updatedState.currentTrack) {
        io.to(roomId).emit('room_playback_sync', {
          action: 'TRACK_CHANGE',
          currentTrack: updatedState.currentTrack,
          isPlaying: updatedState.isPlaying,
          currentTime: updatedState.currentTime,
          lastSyncTimestamp: updatedState.lastSyncTimestamp,
          updatedBy: user.displayName || user.username,
        });
      }
    }
  });

  socket.on('queue_remove', ({ roomId, trackId }) => {
    if (!canAccessRoom(user.username, roomId, user.role)) return;
    const updatedState = roomsManager.removeFromQueue(roomId, trackId, user.displayName || user.username);
    if (updatedState) {
      io.to(roomId).emit('room_queue_sync', {
        queue: updatedState.queue,
      });
    }
  });

  socket.on('queue_reorder', ({ roomId, queue }) => {
    if (!canAccessRoom(user.username, roomId, user.role)) return;
    const updatedState = roomsManager.reorderQueue(roomId, queue, user.displayName || user.username);
    if (updatedState) {
      io.to(roomId).emit('room_queue_sync', {
        queue: updatedState.queue,
        currentTrack: updatedState.currentTrack,
      });
    }
  });

  socket.on('queue_next', async ({ roomId }) => {
    if (!canAccessRoom(user.username, roomId, user.role)) return;

    const roomState = roomsManager.getRoomState(roomId);
    if (roomState && roomState.queue && roomState.queue.length > 0) {
      const nextInQueue = roomState.queue[0];
      if (nextInQueue && !nextInQueue.videoId && nextInQueue.title) {
        try {
          const query = `${nextInQueue.title} ${nextInQueue.artist || ''}`.trim();
          const ytMatch = await searchYouTubeVideo(query);
          if (ytMatch && ytMatch.videoId) {
            nextInQueue.videoId = ytMatch.videoId;
            if (!nextInQueue.duration && ytMatch.duration) {
              nextInQueue.duration = ytMatch.duration;
            }
          }
        } catch (e) {}
      }
    }

    const updatedState = roomsManager.playNext(roomId, user.displayName || user.username);
    if (updatedState) {
      io.to(roomId).emit('room_playback_sync', {
        action: 'TRACK_CHANGE',
        currentTrack: updatedState.currentTrack,
        isPlaying: updatedState.isPlaying,
        currentTime: updatedState.currentTime,
        lastSyncTimestamp: updatedState.lastSyncTimestamp,
        updatedBy: user.displayName || user.username,
      });
      io.to(roomId).emit('room_queue_sync', {
        queue: updatedState.queue,
        currentTrack: updatedState.currentTrack,
      });
    }
  });

  // Chat Message (with rich mentions, replies, and attachments)
  socket.on('send_chat', ({ roomId, text, replyTo, file, mentions }) => {
    if (!canAccessRoom(user.username, roomId, user.role)) return;
    if ((!text || !text.trim()) && !file) return;

    const message = roomsManager.addChatMessage(roomId, {
      sender: user.displayName || user.username,
      avatar: user.avatar,
      text,
      replyTo,
      file,
      mentions,
    });

    if (message) {
      io.to(roomId).emit('new_chat_message', message);
    }
  });

  // Chat Reaction (Emoji reactions)
  socket.on('chat_reaction', ({ roomId, messageId, emoji }) => {
    if (!canAccessRoom(user.username, roomId, user.role)) return;
    if (!messageId || !emoji) return;

    const updated = roomsManager.toggleChatMessageReaction(
      roomId,
      messageId,
      emoji,
      user.displayName || user.username
    );

    if (updated) {
      io.to(roomId).emit('message_reaction_update', updated);
    }
  });

  // Disconnect handler
  socket.on('disconnect', () => {
    const socketSet = userSockets.get(token);
    if (socketSet) {
      socketSet.delete(socket.id);
      if (socketSet.size === 0) {
        userSockets.delete(token);
      }
    }

    const affectedRooms = roomsManager.handleSocketDisconnect(socket.id);
    for (const rId of affectedRooms) {
      const roomState = roomsManager.getRoomState(rId);
      if (roomState) {
        io.to(rId).emit('room_state_update', roomState);
      }
    }
  });
});

// Start Inactivity Monitor (2 hours member inactivity & 30 min guest expiry)
startSessionInactivityMonitor(
  (token, username) => {
    const socketSet = userSockets.get(token);
    if (socketSet) {
      for (const socketId of socketSet) {
        const sock = io.sockets.sockets.get(socketId);
        if (sock) {
          sock.emit('session_inactivity_logout', {
            reason: 'You have been logged out due to 2 hours of inactivity.',
          });
          sock.disconnect(true);
        }
      }
      userSockets.delete(token);
    }
  },
  (token, guestUser) => {
    const socketSet = userSockets.get(token);
    if (socketSet) {
      for (const socketId of socketSet) {
        const sock = io.sockets.sockets.get(socketId);
        if (sock) {
          sock.emit('session_guest_timeout', {
            reason: 'Your 30-minute guest session has completed. Thank you for exploring DualSync!',
          });
          sock.disconnect(true);
        }
      }
      userSockets.delete(token);
    }
  }
);

// ----------------------------------------------------
// PRODUCTION STATIC SERVING
// ----------------------------------------------------
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('DualSync Backend API is running! Frontend is running on Vite dev port or needs to be built.');
  });
}

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`DualSync Server running on port ${PORT}`);
  console.log(`2-Hour Inactivity Monitor: ACTIVE`);
  console.log(`30-Minute Guest Session Monitor: ACTIVE (Max 5)`);
  console.log(`===============================================`);
});
