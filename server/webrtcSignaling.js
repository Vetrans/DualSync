import { roomsManager } from './roomsManager.js';

export function setupWebRTCSignaling(io) {
  io.on('connection', (socket) => {
    // 1. Join Voice Call Channel in Room
    socket.on('webrtc_join_voice', ({ roomId, user }) => {
      if (!roomId || !user) return;
      socket.join(`${roomId}_voice`);

      const participants = roomsManager.joinVoice(roomId, socket.id, user);

      // Notify all other members in room that a peer joined voice
      socket.to(`${roomId}_voice`).emit('webrtc_peer_joined', {
        socketId: socket.id,
        user,
      });

      // Send the current list of voice participants back to the joiner
      socket.emit('webrtc_voice_participants', {
        participants,
      });

      // Also broadcast updated room voice participants list to room
      io.to(roomId).emit('room_voice_update', {
        roomId,
        participants,
      });
    });

    // 2. Relay SDP Offer
    socket.on('webrtc_offer', ({ toSocketId, offer, fromUser }) => {
      io.to(toSocketId).emit('webrtc_offer', {
        fromSocketId: socket.id,
        offer,
        fromUser,
      });
    });

    // 3. Relay SDP Answer
    socket.on('webrtc_answer', ({ toSocketId, answer }) => {
      io.to(toSocketId).emit('webrtc_answer', {
        fromSocketId: socket.id,
        answer,
      });
    });

    // 4. Relay ICE Candidate
    socket.on('webrtc_ice_candidate', ({ toSocketId, candidate }) => {
      io.to(toSocketId).emit('webrtc_ice_candidate', {
        fromSocketId: socket.id,
        candidate,
      });
    });

    // 5. Update Voice Status (Mic muted, Speaking indicator)
    socket.on('webrtc_voice_status', ({ roomId, isSpeaking, micMuted }) => {
      if (!roomId) return;
      const participants = roomsManager.updateVoiceStatus(roomId, socket.id, { isSpeaking, micMuted });
      io.to(roomId).emit('room_voice_update', {
        roomId,
        participants,
      });
    });

    // 6. Leave Voice Call
    socket.on('webrtc_leave_voice', ({ roomId }) => {
      if (!roomId) return;
      socket.leave(`${roomId}_voice`);
      const participants = roomsManager.leaveVoice(roomId, socket.id);

      socket.to(`${roomId}_voice`).emit('webrtc_peer_left', {
        socketId: socket.id,
      });

      io.to(roomId).emit('room_voice_update', {
        roomId,
        participants,
      });
    });
  });
}
