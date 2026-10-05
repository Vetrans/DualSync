// Custom Web Audio API Chime Synthesizer
// Clean, elegant, and completely distinct from Discord's bloop.

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a loud, crystal-clear notification chime for mentions.
 * Designed with high-frequency harmonics and audio compression to cut cleanly through loud music.
 */
export function playMentionSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Master Compressor + Limiter to avoid distortion while maximizing punch
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, now);
    compressor.knee.setValueAtTime(8, now);
    compressor.ratio.setValueAtTime(12, now);
    compressor.attack.setValueAtTime(0.001, now);
    compressor.release.setValueAtTime(0.08, now);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.88, now);

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    // 1. High-frequency punch attack (2093 Hz / C7) - cuts through heavy bass in music
    const oscPunch = ctx.createOscillator();
    const gainPunch = ctx.createGain();
    oscPunch.type = 'triangle';
    oscPunch.frequency.setValueAtTime(2093, now);
    gainPunch.gain.setValueAtTime(0.7, now);
    gainPunch.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    oscPunch.connect(gainPunch);
    gainPunch.connect(masterGain);
    oscPunch.start(now);
    oscPunch.stop(now + 0.09);

    // 2. Main melodic tone: A5 (880 Hz) gliding up to E6 (1318.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.12);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.85, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // 3. Shimmer Harmonic: C#7 (2217.4 Hz) for bright sparkle
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2217.4, now + 0.07);

    gain2.gain.setValueAtTime(0.001, now + 0.07);
    gain2.gain.linearRampToValueAtTime(0.65, now + 0.09);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.46);
  } catch (err) {
    console.warn('[SoundEffects] Could not play mention chime:', err);
  }
}

/**
 * Requests notification permission if not yet granted
 */
export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
}

/**
 * Shows a browser notification for a chat mention
 */
export function showMentionNotification(sender, text) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(`DualSync Mention: @${sender}`, {
        body: text || 'You were mentioned in the room chat',
        icon: '/manifest.json',
      });
    } catch (e) {}
  }
}
