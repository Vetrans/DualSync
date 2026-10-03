const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Optimizes WebRTC Opus SDP for studio-grade audio:
 * - stereo=1 & sprop-stereo=1 for full 2-channel audio
 * - maxaveragebitrate=128000 for crystal-clear 128kbps audio shipping
 * - usedtx=1 for network efficiency (silence suppression saves data & battery)
 * - useinbandfec=1 for forward error correction against packet loss
 */
function optimizeOpusSdp(sdp) {
  if (!sdp) return sdp;
  return sdp.replace(/a=fmtp:(\d+) (.*)/g, (line, pt, params) => {
    if (params.includes('minptime') || params.includes('useinbandfec')) {
      return `a=fmtp:${pt} ${params};stereo=1;sprop-stereo=1;maxaveragebitrate=128000;usedtx=1;useinbandfec=1`;
    }
    return line;
  });
}

export class WebRTCVoiceManager {
  constructor(socket, { onRemoteStream, onSpeakingChange, onError }) {
    this.socket = socket;
    this.onRemoteStream = onRemoteStream;
    this.onSpeakingChange = onSpeakingChange;
    this.onError = onError;

    this.localStream = null;
    this.peerConnection = null;
    this.audioContext = null;
    this.analyser = null;
    this.speakingInterval = null;
    this.isMuted = false;
    this.isDeafened = false;
    this.remoteAudio = new Audio();
    this.remoteAudio.autoplay = true;

    this.currentRoomId = null;
    this.currentUser = null;
  }

  async joinVoice(roomId, user) {
    this.currentRoomId = roomId;
    this.currentUser = user;

    try {
      // 1. High-fidelity audio constraints: 48kHz, stereo-capable, ultra-low latency
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16,
          latency: 0.01,
        },
        video: false,
      });

      // 2. Setup audio analyser for speaking indicator
      this.setupSpeakingDetector();

      // 3. Setup Socket signaling listeners
      this.bindSocketListeners();

      // 4. Notify server we joined voice
      this.socket.emit('webrtc_join_voice', { roomId, user });

      return true;
    } catch (err) {
      console.error('[WebRTC] Microphone access denied or failed:', err);
      if (typeof this.onError === 'function') {
        this.onError(err.message || 'Microphone access denied');
      }
      return false;
    }
  }

  createPeerConnection(targetSocketId) {
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    this.peerConnection = pc;

    // Add local audio tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, this.localStream);
        // Optimize sender encoding parameters if supported
        try {
          const params = sender.getParameters();
          if (params && params.encodings && params.encodings[0]) {
            params.encodings[0].maxBitrate = 128000;
            params.encodings[0].priority = 'high';
            params.encodings[0].networkPriority = 'high';
            sender.setParameters(params).catch(() => {});
          }
        } catch (e) {}
      });
    }

    // Remote track arrived
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote audio track');
      const remoteStream = event.streams[0];
      this.remoteAudio.srcObject = remoteStream;
      this.remoteAudio.play().catch(() => {});
      if (typeof this.onRemoteStream === 'function') {
        this.onRemoteStream(remoteStream);
      }
    };

    // Send ICE candidates to remote peer via socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('webrtc_ice_candidate', {
          toSocketId: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Auto-restart ICE on disconnection or packet loss
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.warn('[WebRTC] ICE connection failed, restarting ICE...');
        try {
          pc.restartIce();
        } catch (e) {}
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
    };

    return pc;
  }

  bindSocketListeners() {
    // When a peer joins voice, initiating offer
    this.socket.on('webrtc_peer_joined', async ({ socketId }) => {
      console.log('[WebRTC] Peer joined voice:', socketId);
      const pc = this.createPeerConnection(socketId);
      try {
        const offer = await pc.createOffer();
        const optimizedSdp = optimizeOpusSdp(offer.sdp);
        const finalOffer = new RTCSessionDescription({ type: offer.type, sdp: optimizedSdp });
        await pc.setLocalDescription(finalOffer);
        this.socket.emit('webrtc_offer', {
          toSocketId: socketId,
          offer: finalOffer,
          fromUser: this.currentUser,
        });
      } catch (err) {
        console.error('[WebRTC] Error creating offer:', err);
      }
    });

    // When an offer is received from a peer
    this.socket.on('webrtc_offer', async ({ fromSocketId, offer }) => {
      console.log('[WebRTC] Received offer from:', fromSocketId);
      const pc = this.createPeerConnection(fromSocketId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        const optimizedSdp = optimizeOpusSdp(answer.sdp);
        const finalAnswer = new RTCSessionDescription({ type: answer.type, sdp: optimizedSdp });
        await pc.setLocalDescription(finalAnswer);
        this.socket.emit('webrtc_answer', {
          toSocketId: fromSocketId,
          answer: finalAnswer,
        });
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    });

    // When an answer is received
    this.socket.on('webrtc_answer', async ({ answer }) => {
      console.log('[WebRTC] Received answer');
      if (this.peerConnection) {
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error('[WebRTC] Error setting remote description:', err);
        }
      }
    });

    // When ICE candidate is received
    this.socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (this.peerConnection && candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate:', err);
        }
      }
    });

    // When peer leaves voice
    this.socket.on('webrtc_peer_left', () => {
      console.log('[WebRTC] Peer left voice call');
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      this.remoteAudio.srcObject = null;
      if (typeof this.onRemoteStream === 'function') {
        this.onRemoteStream(null);
      }
    });
  }

  setupSpeakingDetector() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let wasSpeaking = false;

      this.speakingInterval = setInterval(() => {
        if (!this.analyser || this.isMuted) {
          if (wasSpeaking) {
            wasSpeaking = false;
            this.broadcastSpeakingStatus(false);
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const isSpeaking = average > 18; // Voice threshold

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.broadcastSpeakingStatus(isSpeaking);
        }
      }, 150);
    } catch (e) {
      console.warn('[WebRTC] AudioContext speaking detector unsupported:', e.message);
    }
  }

  broadcastSpeakingStatus(isSpeaking) {
    if (typeof this.onSpeakingChange === 'function') {
      this.onSpeakingChange(isSpeaking);
    }
    if (this.socket && this.currentRoomId) {
      this.socket.emit('webrtc_voice_status', {
        roomId: this.currentRoomId,
        isSpeaking,
        micMuted: this.isMuted,
      });
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    if (this.socket && this.currentRoomId) {
      this.socket.emit('webrtc_voice_status', {
        roomId: this.currentRoomId,
        isSpeaking: false,
        micMuted: this.isMuted,
      });
    }
    return this.isMuted;
  }

  toggleDeafen() {
    this.isDeafened = !this.isDeafened;
    this.remoteAudio.muted = this.isDeafened;
    return this.isDeafened;
  }

  leaveVoice() {
    if (this.speakingInterval) {
      clearInterval(this.speakingInterval);
      this.speakingInterval = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteAudio.srcObject = null;

    if (this.socket && this.currentRoomId) {
      this.socket.emit('webrtc_leave_voice', { roomId: this.currentRoomId });
      this.socket.off('webrtc_peer_joined');
      this.socket.off('webrtc_offer');
      this.socket.off('webrtc_answer');
      this.socket.off('webrtc_ice_candidate');
      this.socket.off('webrtc_peer_left');
    }

    this.currentRoomId = null;
  }
}
