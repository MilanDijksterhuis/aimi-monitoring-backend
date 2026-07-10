const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.env.METRICS_DB_PATH || path.join(__dirname, '../data/metrics.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now')),
    cpu_percent REAL,
    ram_percent REAL,
    ram_used_mb REAL,
    ram_total_mb REAL,
    disk_percent REAL,
    disk_used_gb REAL,
    disk_total_gb REAL,
    network_rx_mb REAL,
    network_tx_mb REAL,
    uptime_seconds INTEGER,
    load_avg_1m REAL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now')),
    source TEXT,
    level TEXT,
    message TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at);
`);

module.exports = db;
