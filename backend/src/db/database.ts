import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Determine database file path: use /data if writable, otherwise local ./data
function getDbPath(): string {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  const dockerDataDir = '/data';
  try {
    if (fs.existsSync(dockerDataDir)) {
      fs.accessSync(dockerDataDir, fs.constants.W_OK);
      return path.join(dockerDataDir, 'data.db');
    }
  } catch (err) {
    // not running in docker or not writable
  }
  const localDataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(localDataDir)) {
    fs.mkdirSync(localDataDir, { recursive: true });
  }
  return path.join(localDataDir, 'data.db');
}

const dbPath = getDbPath();
console.log(`[Database] Using SQLite at: ${dbPath}`);

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Initialize database schema
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS containers_meta (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_ignored INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      auto_update INTEGER DEFAULT 0,
      last_checked_at DATETIME,
      last_remote_digest TEXT,
      update_available INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS compose_projects (
      name TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      is_ignored INTEGER DEFAULT 0,
      auto_update INTEGER DEFAULT 0,
      last_checked_at DATETIME,
      update_available INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      config_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS update_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_name TEXT NOT NULL,
      from_digest TEXT,
      to_digest TEXT,
      status TEXT NOT NULL,
      log_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Default settings
  const defaultSettings: Record<string, string> = {
    registryMirrors: JSON.stringify([
      'https://docker.m.daocloud.io',
      'https://dockerproxy.com'
    ]),
    httpProxy: '',
    cronSchedule: '0 3 * * *',
    cronEnabled: '1',
    autoUpdateEnabled: '0',
    autoPruneImages: '1',
    composeScanPaths: JSON.stringify(['/vol1', '/volume1', '/data/compose', '/opt/docker']),
    passwordless: '0',
    initialized: '0'
  };

  const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertStmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = getStmt.get(key);
    if (!existing) {
      insertStmt.run(key, value);
    }
  }
}

export function getSetting<T = any>(key: string, defaultValue: T): T {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return defaultValue;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value as unknown as T;
  }
}

export function setSetting(key: string, value: any): void {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?').run(key, serialized, serialized);
}
