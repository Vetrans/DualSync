import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, 'audit_logs.json');

class AuditLogger {
  constructor() {
    this.logs = [];
    this.subscribers = new Set();
    this.loadLogs();
  }

  loadLogs() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        const raw = fs.readFileSync(LOG_FILE, 'utf-8');
        this.logs = JSON.parse(raw);
        if (!Array.isArray(this.logs)) this.logs = [];
      }
    } catch (e) {
      console.warn('[AuditLogger] Could not load saved logs, initializing fresh:', e.message);
      this.logs = [];
    }
  }

  saveLogs() {
    try {
      // Keep last 1,000 logs in storage
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-1000);
      }
      fs.writeFileSync(LOG_FILE, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[AuditLogger] Error writing logs to file:', e.message);
    }
  }

  log(action, username, details = {}, ip = '127.0.0.1') {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      username: username || 'Anonymous',
      details,
      ip: ip.replace('::ffff:', ''),
    };

    this.logs.unshift(entry);
    this.saveLogs();

    // Broadcast to live admin listeners
    for (const sendFn of this.subscribers) {
      try {
        sendFn(entry);
      } catch (err) {
        // subscriber disconnected
      }
    }

    console.log(`[AUDIT] [${entry.timestamp}] [${entry.action}] User: ${entry.username} - ${JSON.stringify(details)}`);
    return entry;
  }

  subscribe(sendFn) {
    this.subscribers.add(sendFn);
    return () => {
      this.subscribers.delete(sendFn);
    };
  }

  getLogs(limit = 150) {
    return this.logs.slice(0, limit);
  }

  clearLogs() {
    this.logs = [];
    this.saveLogs();
  }
}

export const auditLogger = new AuditLogger();
