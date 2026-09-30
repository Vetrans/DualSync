import React, { useState, useEffect, useRef } from 'react';
import Login from './components/Login';
import RoomList from './components/RoomList';
import PlayerView from './components/PlayerView';
import InactivityModal from './components/InactivityModal';
import AdminAuditModal from './components/AdminAuditModal';
import { getSocket, disconnectSocket } from './services/socket';
import { InactivityTimer } from './services/inactivityTimer';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('dualsync_token') || '');
  const [loading, setLoading] = useState(true);

  // Rooms and active room selection
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [activeRoomData, setActiveRoomData] = useState(null);

  // Inactivity & Admin modals
  const [isInactivityModalOpen, setIsInactivityModalOpen] = useState(false);
  const [isAdminAuditOpen, setIsAdminAuditOpen] = useState(false);

  const socketRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  // 1. Check existing session on boot
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('dualsync_token');
      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/me', {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        if (res.ok) {
          const data = await res.json();
          setCurrentUser(data.user);
          setToken(savedToken);
        } else {
          // Token expired or invalid
          handleLogout('session_invalid');
        }
      } catch (err) {
        console.warn('Session check failed:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 2. Fetch accessible rooms whenever authenticated
  const fetchRooms = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.warn('Error fetching rooms:', err);
    }
  };

  useEffect(() => {
    if (currentUser && token) {
      fetchRooms();
    }
  }, [currentUser, token]);

  // 3. Connect Socket and setup 2-Hour Inactivity Watcher
  useEffect(() => {
    if (currentUser && token) {
      // Connect WebSocket
      const socket = getSocket(token);
      socketRef.current = socket;

      // Server notifies if 2-hr idle logout triggered on server
      socket.on('session_inactivity_logout', () => {
        console.warn('Server triggered inactivity logout');
        handleInactivityTimeout();
      });

      // Client-side 2-hour inactivity watcher
      inactivityTimerRef.current = new InactivityTimer({
        onTimeout: () => {
          handleInactivityTimeout();
        },
      });
      inactivityTimerRef.current.start();

      return () => {
        inactivityTimerRef.current?.stop();
        socket.off('session_inactivity_logout');
      };
    } else {
      inactivityTimerRef.current?.stop();
      disconnectSocket();
    }
  }, [currentUser, token]);

  // 4. Handle Inactivity Timeout
  const handleInactivityTimeout = () => {
    setIsInactivityModalOpen(true);
    handleLogout('inactivity');
  };

  // 5. Handle Login Success
  const handleLoginSuccess = (user, newToken) => {
    setCurrentUser(user);
    setToken(newToken);
    setIsInactivityModalOpen(false);
  };

  // 6. Handle Logout
  const handleLogout = async (reason = 'manual') => {
    const curToken = token || localStorage.getItem('dualsync_token');
    if (curToken && reason !== 'inactivity') {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${curToken}` },
        });
      } catch (e) {}
    }

    localStorage.removeItem('dualsync_token');
    localStorage.removeItem('dualsync_user');
    setCurrentUser(null);
    setToken('');
    setActiveRoomId(null);
    setActiveRoomData(null);
    disconnectSocket();
    inactivityTimerRef.current?.stop();
  };

  // 7. Select and Join Room
  const handleSelectRoom = async (roomId) => {
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.room) {
        alert(data.error || 'Cannot enter this room');
        return;
      }

      setActiveRoomData(data.room);
      setActiveRoomId(roomId);

      // Join socket room
      socketRef.current?.emit('join_room', { roomId });
    } catch (err) {
      alert('Failed to connect to room');
    }
  };

  // 8. Leave Room and return to RoomList
  const handleLeaveRoom = () => {
    if (activeRoomId) {
      socketRef.current?.emit('leave_room', { roomId: activeRoomId });
    }
    setActiveRoomId(null);
    setActiveRoomData(null);
    fetchRooms();
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#121212] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#1DB954] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-neutral-400 font-semibold tracking-wider uppercase">
            Loading DualSync...
          </span>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!currentUser || !token) {
    return (
      <>
        <Login onLoginSuccess={handleLoginSuccess} />
        <InactivityModal
          isOpen={isInactivityModalOpen}
          onReLogin={() => setIsInactivityModalOpen(false)}
        />
      </>
    );
  }

  // Active in room
  if (activeRoomId && activeRoomData) {
    return (
      <>
        <PlayerView
          room={activeRoomData}
          currentUser={currentUser}
          socket={socketRef.current}
          token={token}
          onLeaveRoom={handleLeaveRoom}
          onLogout={() => handleLogout('manual')}
        />
        <InactivityModal
          isOpen={isInactivityModalOpen}
          onReLogin={() => setIsInactivityModalOpen(false)}
        />
      </>
    );
  }

  // Room Selection Dashboard
  return (
    <>
      <RoomList
        rooms={rooms}
        currentUser={currentUser}
        onSelectRoom={handleSelectRoom}
        onOpenAuditLogs={() => setIsAdminAuditOpen(true)}
        onLogout={() => handleLogout('manual')}
      />

      {currentUser?.role === 'admin' && (
        <AdminAuditModal
          isOpen={isAdminAuditOpen}
          onClose={() => setIsAdminAuditOpen(false)}
          socket={socketRef.current}
          token={token}
        />
      )}

      <InactivityModal
        isOpen={isInactivityModalOpen}
        onReLogin={() => setIsInactivityModalOpen(false)}
      />
    </>
  );
}
