import { io } from 'socket.io-client';

let socket = null;

export function getSocket(token) {
  if (!socket && token) {
    socket = io(window.location.origin, {
      auth: { token },
      query: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to DualSync WebSocket server');
    });

    socket.on('disconnect', (reason) => {
      console.log('⚠️ Disconnected from WebSocket:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('❌ WebSocket connection error:', err.message);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
