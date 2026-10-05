# DualSync 🎧

> **Real-Time Synchronized Co-Listening & Low-Latency Voice Studio**  
> Experience music, podcasts, and video in real-time synchrony with friends across smartphones, tablets, and laptops.

🌐 **Live Web Application**: [https://dualsync-zcwq.onrender.com/](https://dualsync-zcwq.onrender.com/)

---

## 🌟 Overview

**DualSync** is a high-performance web platform designed for synchronized media streaming, low-latency WebRTC voice communication, and rich community chat. Inspired by modern minimalist audio players, DualSync delivers sub-100ms playback sync across web browsers without requiring external companion apps.

Visitors and open-source evaluators can immediately experience the platform using **Guest Jam Mode** on the live website.

---

## ✨ Features

### 🎵 Real-Time Media Synchronization
- **Sub-100ms Co-Listening Engine**: Synchronized Play/Pause, high-precision scrubbing, seek-offset calibration, and auto-track advancement.
- **Smart Link Resolver**:
  - **YouTube Streams**: Native playback and playlist queue support.
  - **Spotify Web Integration**: Resolves track and podcast metadata (artwork, artist, duration) and synchronizes audio without requiring Spotify Premium.
  - **Direct Podcast & Audio Streams**: Direct `.mp3`, `.m4a`, and RSS podcast episodes with live waveform visualization.
- **Background Playback & Wake Lock**: Keeps audio streams alive and prevents mobile screen sleep during long listening sessions.

### 🎙️ WebRTC Studio Voice Channel
- **Peer-to-Peer 1-on-1 Voice**: Low-latency voice channel with STUN/TURN fallback.
- **Mute / Deafen Toggles**: Granular hardware audio controls with dynamic speaking indicators.

### 💬 Discord-Inspired Rich Chat
- **@ Mentions & Autocomplete**: Tag room participants with real-time autocompletion dropdown.
- **Custom Sonic Alerts**: Clean two-tone Web Audio chimes and browser push notifications when tagged (distinct, zero external asset overhead).
- **Interactive Emoji Reactions**: Expressive reaction bar with live count pills and one-click toggle.
- **Direct Message Replies**: Threaded quoting banners with click-to-scroll navigation to original messages.
- **Safe File & Media Sharing**: Upload images, audio snippets, and documents (up to 5MB) with built-in MIME validation and full-screen lightbox preview.

### 🛡️ Enterprise-Grade Security & Privacy
- **Cryptographic Authentication**: Secure authentication backed by salted `scrypt` password hashing and constant-time comparison (`crypto.timingSafeEqual`).
- **Zero Client Credential Exposure**: Private member credentials are strictly kept off frontend bundles and public repositories.
- **Role-Based Room Isolation**: Strict room sandboxing ensuring private member rooms cannot be discovered or accessed by unauthorized users.
- **2-Hour Inactivity Auto-Logout**: Automatic idle session termination to prevent unauthorized access on shared devices.

### 👥 Guest Jam Mode & Smart Queue System
- **Instant Access**: Jump into DualSync without registration by choosing a guest nickname.
- **Guest Jam Lounge**: An open, shared lounge where guests can test synchronized playback and chat features.
- **5-Guest Capacity & Fair Queueing**: To protect server resources and maintain zero audio latency, a maximum of 5 simultaneous guest sessions are permitted. When full, incoming guests receive a live countdown indicating when the next slot will open.
- **30-Minute Auto-Expiry**: Automated session cleanup to ensure continuous availability.

---

## 🚀 Experience DualSync

To test the application live, visit the deployed platform:

👉 **[https://dualsync-zcwq.onrender.com/](https://dualsync-zcwq.onrender.com/)**

1. Click the **Enter as Guest** tab on the login screen.
2. Choose your preferred **Nickname** and click **Enter Guest Jam**.
3. Explore the **Guest Jam Lounge**:
   - Queue up your favorite YouTube or Spotify links.
   - Test synchronized playback and player controls.
   - Chat with @mentions, emoji reactions, message replies, and file attachments.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Web Audio API, Lucide Icons
- **Backend**: Node.js, Express, Socket.io (WebSocket), WebRTC Signaling
- **Security**: Salted `scrypt` hashing, token authentication, MIME validation, input sanitization
- **Hosting**: Render (Cloud Application Hosting)

---

## 📄 License

MIT © DualSync
