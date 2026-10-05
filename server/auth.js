import crypto from 'crypto';
import { auditLogger } from './auditLogger.js';

// Secret salt for cryptographic scrypt password hashing
const AUTH_SALT = process.env.DUALSYNC_AUTH_SALT || 'dualsync_sec_salt_2026_9b8a7c6d5e4f3a2b1c';

/**
 * Predefined verified members with one-way salted scrypt hashes.
 * ZERO plaintext passwords exist in the source code or git history.
 */
export const USERS = {
  Rishi: {
    username: 'Rishi',
    passwordHash: '7de2412f7f3d0d9ec756b5e7c06142252c1b99205b10b0d104c40450d16d6c3a15a6b8e46b75841527e8b140e6ee7be429bbd1fe9b968bea63720095d0582d22',
    displayName: 'Rishi',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    allowedRooms: ['room_rishi_shweta', 'room_rishi_kavita', 'room_rishi_archit', 'room_guest_jam'],
  },
  Shweta: {
    username: 'Shweta',
    passwordHash: '62c612391cee7d131969e984fb01eec997592ea125337694015851e4b13d6794ef34897719da6cd52d39d98afbb65456ffb08983149255deb9e0e78b9dede03b',
    displayName: 'Shweta',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    allowedRooms: ['room_rishi_shweta', 'room_guest_jam'],
  },
  Kavita: {
    username: 'Kavita',
    passwordHash: '4fd29f8eb92357cda2f78a9903b6fe07d06d1dc82b9f4ce0b5a598ec79a8b17aeca0bce0d7f653c4078e030e2155a13d7719ee4bb12b0b956502f767a1cd460f',
    displayName: 'Kavita',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    allowedRooms: ['room_rishi_kavita', 'room_guest_jam'],
  },
  Archit: {
    username: 'Archit',
    passwordHash: '8cb3f8c16b3c6245b7c4411655f66d15cb2a3b90eb3ad7f3546b43d534d22caad460fff9a678bd43f44e21d5ee9229c38e371b863f758c15c07db82f0a964441',
    displayName: 'Archit',
    role: 'user',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    allowedRooms: ['room_rishi_archit', 'room_guest_jam'],
  },
};

// Timing-safe password verification
function verifyPassword(inputPassword, storedHash) {
  if (!inputPassword || !storedHash) return false;
  try {
    const inputHash = crypto.scryptSync(inputPassword, AUTH_SALT, 64).toString('hex');
    const inputBuf = Buffer.from(inputHash, 'utf8');
    const storedBuf = Buffer.from(storedHash, 'utf8');
    if (inputBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(inputBuf, storedBuf);
  } catch (err) {
    return false;
  }
}

// 2 Hours inactivity timeout for private members (7,200,000 ms)
export const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000;

// Maximum 5 simultaneous guests and 30-minute strict auto-expiry
export const MAX_GUESTS = 5;
export const GUEST_TIMEOUT_MS = 30 * 60 * 1000; // 30 mins (1,800,000 ms)

// Map of all active sessions: token -> sessionData
export const sessions = new Map();

// Map of active guest sessions: token -> { token, user, createdAt, expiresAt }
export const activeGuestSessions = new Map();

const GUEST_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
];

/**
 * Purges expired guest sessions and returns active count
 */
function cleanExpiredGuests() {
  const now = Date.now();
  for (const [token, guest] of activeGuestSessions.entries()) {
    if (now >= guest.expiresAt) {
      activeGuestSessions.delete(token);
      sessions.delete(token);
      auditLogger.log('GUEST_EXPIRED_CLEANUP', guest.user.displayName, { username: guest.user.username });
    }
  }
  return activeGuestSessions.size;
}

/**
 * Returns current guest capacity status and next slot wait time
 */
export function getGuestStatus() {
  cleanExpiredGuests();
  const count = activeGuestSessions.size;
  const isFull = count >= MAX_GUESTS;

  let waitMs = 0;
  if (isFull) {
    const expiries = Array.from(activeGuestSessions.values()).map((g) => g.expiresAt);
    const earliestExpiry = Math.min(...expiries);
    waitMs = Math.max(1000, earliestExpiry - Date.now());
  }

  return {
    activeGuests: count,
    maxGuests: MAX_GUESTS,
    isFull,
    waitMs,
    waitMinutes: Math.ceil(waitMs / 60000),
  };
}

/**
 * Member login using timing-safe scrypt hash verification
 */
export function login(rawUsername, password, ip = '127.0.0.1', userAgent = '') {
  const cleanUsername = (rawUsername || '').trim();
  const matchedKey = Object.keys(USERS).find(
    (k) => k.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (!matchedKey) {
    auditLogger.log('LOGIN_FAILED', cleanUsername, { reason: 'User not found', userAgent }, ip);
    return { success: false, message: 'Invalid username or password' };
  }

  const user = USERS[matchedKey];
  if (!verifyPassword(password, user.passwordHash)) {
    auditLogger.log('LOGIN_FAILED', user.username, { reason: 'Incorrect password', userAgent }, ip);
    return { success: false, message: 'Invalid username or password' };
  }

  const token = 'usr_' + crypto.randomBytes(32).toString('hex');
  const now = Date.now();

  const sessionData = {
    token,
    user: {
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      avatar: user.avatar,
      isGuest: false,
    },
    createdAt: now,
    lastActivity: now,
    isGuest: false,
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

/**
 * Guest login with max 5 capacity and 30-min strict session
 */
export function loginGuest(rawNickname, ip = '127.0.0.1', userAgent = '') {
  cleanExpiredGuests();

  // Validate nickname (clean alphanumeric, underscores, spaces, 2 to 24 chars)
  const cleanNickname = (rawNickname || '').trim().replace(/[<>/"'&]/g, '').substring(0, 24);
  if (!cleanNickname || cleanNickname.length < 2) {
    return { success: false, message: 'Please choose a nickname between 2 and 24 characters' };
  }

  // Check capacity: max 5 active guests
  if (activeGuestSessions.size >= MAX_GUESTS) {
    const expiries = Array.from(activeGuestSessions.values()).map((g) => g.expiresAt);
    const earliestExpiry = Math.min(...expiries);
    const waitMs = Math.max(1000, earliestExpiry - Date.now());
    const waitMins = Math.ceil(waitMs / 60000);

    return {
      success: false,
      inQueue: true,
      waitMs,
      waitMinutes: waitMins,
      message: `Guest capacity reached (5/5). You are in queue. Next slot available in approximately ${waitMins} minute(s).`,
    };
  }

  const token = 'gst_' + crypto.randomBytes(32).toString('hex');
  const guestId = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const username = `guest_${guestId}`;
  const now = Date.now();
  const expiresAt = now + GUEST_TIMEOUT_MS;

  const avatarIndex = Math.abs(cleanNickname.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % GUEST_AVATARS.length;
  const avatar = GUEST_AVATARS[avatarIndex];

  const user = {
    username,
    displayName: `${cleanNickname} (Guest)`,
    role: 'guest',
    avatar,
    isGuest: true,
    allowedRooms: ['room_guest_jam'],
  };

  const sessionData = {
    token,
    user,
    createdAt: now,
    expiresAt,
    lastActivity: now,
    isGuest: true,
    ip,
    userAgent,
  };

  sessions.set(token, sessionData);
  activeGuestSessions.set(token, sessionData);

  auditLogger.log('GUEST_LOGIN_SUCCESS', cleanNickname, { username, role: 'guest', expiresAt }, ip);

  return {
    success: true,
    token,
    user,
    expiresIn: GUEST_TIMEOUT_MS,
  };
}

/**
 * Logout handler
 */
export function logout(token, reason = 'manual') {
  if (!token) return false;
  const session = sessions.get(token);
  if (session) {
    const action = reason === 'inactivity'
      ? (session.isGuest ? 'GUEST_TIMEOUT_30MIN' : 'INACTIVITY_LOGOUT_2HR')
      : 'LOGOUT';
    auditLogger.log(action, session.user.displayName || session.user.username, { reason, ip: session.ip });
    sessions.delete(token);
    activeGuestSessions.delete(token);
    return true;
  }
  return false;
}

/**
 * Validate token session and update activity
 */
export function validateSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;

  const now = Date.now();

  // If guest, verify 30-min absolute duration
  if (session.isGuest) {
    if (now >= session.expiresAt) {
      logout(token, 'inactivity');
      return null;
    }
    session.lastActivity = now;
    return session;
  }

  // If regular user, verify 2-hour idle timeout
  if (now - session.lastActivity > INACTIVITY_TIMEOUT_MS) {
    logout(token, 'inactivity');
    return null;
  }

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

/**
 * Access control check for rooms
 */
export function canAccessRoom(username, roomId, role) {
  if (roomId === 'room_guest_jam') return true; // Community lounge accessible to all
  if (role === 'guest') return false; // Guests CANNOT access private rooms!

  const cleanUser = (username || '').trim().toLowerCase();
  if (cleanUser === 'rishi' || role === 'admin') return true;

  const matchedKey = Object.keys(USERS).find((k) => k.toLowerCase() === cleanUser);
  if (!matchedKey) return false;

  return USERS[matchedKey].allowedRooms.includes(roomId);
}

/**
 * Background monitor for 2-hour idle and 30-minute guest auto-logouts
 */
export function startSessionInactivityMonitor(onUserLogout, onGuestTimeout) {
  setInterval(() => {
    const now = Date.now();

    // 1. Check guest 30-min timeouts
    for (const [token, guest] of activeGuestSessions.entries()) {
      if (now >= guest.expiresAt) {
        console.log(`[AUTH] Guest session for ${guest.user.displayName} expired after 30 mins`);
        logout(token, 'inactivity');
        if (typeof onGuestTimeout === 'function') {
          onGuestTimeout(token, guest.user);
        }
      }
    }

    // 2. Check member 2-hour idle timeouts
    for (const [token, session] of sessions.entries()) {
      if (session.isGuest) continue;
      if (now - session.lastActivity > INACTIVITY_TIMEOUT_MS) {
        console.log(`[AUTH] Session for ${session.user.username} expired after 2h inactivity`);
        logout(token, 'inactivity');
        if (typeof onUserLogout === 'function') {
          onUserLogout(token, session.user.username);
        }
      }
    }
  }, 10000); // Check every 10 seconds
}
