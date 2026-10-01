# DualSync - Synchronized Listening & WebRTC Voice Rooms

DualSync is a responsive, real-time synchronized music and podcast co-listening web application built with Node.js, Express, Socket.io, React, and WebRTC. Inspired by Spotify's fullscreen interface, it allows paired users to listen together in locked synchrony with custom player controls, talk via real-time WebRTC 1-on-1 voice calls, share a live queue, and chat in private sanctuary rooms.

---

## Features

- **Spotify Fullscreen UI**: Modeled after Spotify's desktop fullscreen mode with ambient dynamic background glows, centered large rounded artwork, and custom media controls.
- **Custom Player Controls**: Custom play, pause, scrubbable progress bar, volume slider, 10s rewind and fast-forward, previous, and next controls that operate synchronously for both users.
- **Smart Link Resolver**:
  - **YouTube**: Plays directly via YouTube API with native controls hidden.
  - **Spotify**: Resolves track and podcast metadata (title, artist, high-res artwork) via embed API and synchronizes high-fidelity streams under the hood without requiring Spotify Premium.
  - **Direct Audio / Podcast**: Plays direct `.mp3`, `.m4a`, or podcast audio streams.
- **WebRTC 1-on-1 Voice Calling**: Integrated voice channel with microphone mute/unmute, deafen remote audio, and animated speaking indicators.
- **Real-Time Shared Queue & Room Chat**: Add tracks from links, reorder/remove, and send live chat messages.
- **Strict User & Room Privacy**:
  - Exactly 4 predefined accounts.
  - Non-admin users can **only** access and view their private shared room with Rishi.
  - Admin Rishi can view and supervise all 3 rooms.
- **2-Hour Inactivity Auto-Logout**: Automatic idle detection (tracking mouse, keyboard, and touch events) that terminates sessions after 2 hours of inactivity with an audit log entry.
- **Admin Audit Logs**: Live audit stream for Admin Rishi tracking logins, 2-hr inactivity logouts, room entries/exits, and playback actions.
- **Mobile & Desktop Responsive**: Lightweight and fast on smartphones, tablets, and laptops.

---

## Predefined User Accounts

| Username | Password | Role | Room Access |
| :--- | :--- | :--- | :--- |
| **Rishi** | `Mrengineer@001` | **Admin** | **All 3 Rooms** + Admin Audit Logs Stream |
| **Shweta** | `Iamdayaan` | User | **Room 1: Rishi & Shweta's Room** only |
| **Kavita** | `Iamrude` | User | **Room 2: Rishi & Kavita's Room** only |
| **Archit** | `Iloverishi` | User | **Room 3: Rishi & Archit's Room** only |

---

## Getting Started Locally

### 1. Install Dependencies
```bash
npm install
npm --prefix client install
```

### 2. Build Frontend
```bash
npm run build
```

### 3. Start Server
```bash
npm start
```
The application will be live at `http://localhost:5000` (or `PORT` specified in environment).

---

## Deployment to Render

1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect your repository: `https://github.com/Vetrans/DualSync.git`.
3. Set the configuration:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Render will automatically set `process.env.PORT` and deploy the service.
