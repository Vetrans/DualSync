const TWO_HOURS_MS = 2 * 60 * 60 * 1000; // 7,200,000 ms

export class InactivityTimer {
  constructor({ onTimeout, onActivity }) {
    this.onTimeout = onTimeout;
    this.onActivity = onActivity;
    this.timer = null;
    this.lastActivityTime = Date.now();
    this.lastHeartbeatTime = Date.now();
    this.throttledReset = this.throttle(this.resetTimer.bind(this), 1000);
    this.isActive = false;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.lastActivityTime = Date.now();

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((event) => {
      window.addEventListener(event, this.throttledReset, { passive: true });
    });

    this.scheduleTimeout();
    console.log('[InactivityTimer] Initialized 2-hour inactivity watcher');
  }

  stop() {
    this.isActive = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((event) => {
      window.removeEventListener(event, this.throttledReset);
    });
  }

  resetTimer() {
    if (!this.isActive) return;
    this.lastActivityTime = Date.now();

    // Trigger onActivity callback
    if (typeof this.onActivity === 'function') {
      this.onActivity();
    }

    // Heartbeat to server every 2 minutes
    const now = Date.now();
    if (now - this.lastHeartbeatTime > 2 * 60 * 1000) {
      this.lastHeartbeatTime = now;
      this.sendServerHeartbeat();
    }

    this.scheduleTimeout();
  }

  scheduleTimeout() {
    if (this.timer) clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      console.warn('[InactivityTimer] 2 hours of inactivity elapsed! Triggering logout.');
      if (typeof this.onTimeout === 'function') {
        this.onTimeout();
      }
    }, TWO_HOURS_MS);
  }

  async sendServerHeartbeat() {
    const token = localStorage.getItem('dualsync_token');
    if (!token) return;
    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (e) {
      // ignore
    }
  }

  throttle(fn, limit) {
    let inThrottle = false;
    return (...args) => {
      if (!inThrottle) {
        fn(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }
}
