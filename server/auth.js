import crypto from 'crypto';
import { auditLogger } from './auditLogger.js';

// Predefined static users
export const USERS = {
  Rishi: {
    username: 'Rishi',
    password: 'Mrengineer@001',
    displayName: 'Rishi',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    allowedRooms: ['room_rishi_shweta', 'room_rishi_kavita', 'room_rishi_archit'],
  },
  Shweta: {
    username: 'Shweta',
    password: 'Iamdayaan',
    displayName: 'Shweta',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    allowedRooms: ['room_rishi_shweta'],
  },
  Kavita: {
    username: 'Kavita',
    password: 'Iamrude',
    displayName: 'Kavita',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    allowedRooms: ['room_rishi_kavita'],
  },
  Archit: {
    username: 'Archit',
    password: 'Iloverishi',
    displayName: 'Archit',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    allowedRooms: ['room_rishi_archit'],
  },
};

// 2 Hours of inactivity in milliseconds
export const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 7,200,000 ms

// Map of active sessions: token -> { user, createdAt, lastActivity, ip, userAgent }
export const sessions = new Map();

export function login(rawUsername, password, ip = '127.0.0.1', userAgent = '') {
  // Case-insensitive match on username for user convenience
  const matchedKey = Object.keys(USERS).find(
    (k) => k.toLowerCase() === (rawUsername || '').trim().toLowerCase()
  );

  if (!matchedKey) {
    auditLogger.log('LOGIN_FAILED', rawUsername, { reason: 'User not found', userAgent }, ip);
    return { success: false, message: 'Invalid username or password' };
  }

  const user = USERS[matchedKey];
  if (user.password !== password) {
    auditLogger.log('LOGIN_FAILED', user.username, { reason: 'Incorrect password', userAgent }, ip);
    return { success: false, message: 'Invalid username or password' };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  const sessionData = {
    token,
    user: {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      avatar: user.avatar,
    },
    createdAt: now,
    lastActivity: now,
    ip,
    userAgent,
  };

  sessions.set(token, sessionData);

  auditLogger.log('LOGIN_SUCCESS', user.username, { role: user.role, userAgent }, ip);

  return {
    success: true,
    token,
    user: sessionData.user,
    expiresIn: INACTIVITY_TIMEOUT_MS,
  };
}

export function logout(token, reason = 'manual') {
  if (!token) return false;
  const session = sessions.get(token);
  if (session) {
    const action = reason === 'inactivity' ? 'INACTIVITY_LOGOUT_2HR' : 'LOGOUT';
    auditLogger.log(action, session.user.username, { reason, ip: session.ip });
    sessions.delete(token);
    return true;
  }
  return false;
}

export function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  const now = Date.now();
  if (now - session.lastActivity > INACTIVITY_TIMEOUT_MS) {
    // Session expired due to 2 hours of inactivity
    logout(token, 'inactivity');
    return null;
  }

  // Update last activity timestamp
  session.lastActivity = now;
  return session;
}

export function touchSession(token) {
  const session = sessions.get(token);
  if (session) {
    session.lastActivity = Date.now();
    return true;
  }
  return false;
}

export function canAccessRoom(username, roomId) {
  const matchedKey = Object.keys(USERS).find(
    (k) => k.toLowerCase() === (username || '').trim().toLowerCase()
  );
  if (!matchedKey) return false;

  const user = USERS[matchedKey];
  if (user.role === 'admin') return true; // Admin can access all rooms
  return user.allowedRooms.includes(roomId);
}

// Background cleaner to purge sessions idle for >2 hours
export function startSessionInactivityMonitor(onSessionExpired) {
  setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions.entries()) {
      if (now - session.lastActivity > INACTIVITY_TIMEOUT_MS) {
        console.log(`[AUTH] Session for ${session.user.username} expired after 2h inactivity`);
        logout(token, 'inactivity');
        if (typeof onSessionExpired === 'function') {
          onSessionExpired(token, session.user.username);
        }
      }
    }
  }, 30 * 1000); // Check every 30 seconds
}
