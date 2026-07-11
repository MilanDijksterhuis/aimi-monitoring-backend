const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireIngestKey, requireAdminKey } = require('../middleware/auth');

const insertMetric = db.prepare(`
  INSERT INTO metrics (
    cpu_percent, ram_percent, ram_used_mb, ram_total_mb,
    disk_percent, disk_used_gb, disk_total_gb,
    network_rx_mb, network_tx_mb, uptime_seconds, load_avg_1m,
    load_avg_5m, load_avg_15m, ssh_users, fail2ban_banned,
    nginx_connections, network_connections,
    pm2_apps_online, pm2_apps_total, pm2_restart_count
  ) VALUES (
    @cpu_percent, @ram_percent, @ram_used_mb, @ram_total_mb,
    @disk_percent, @disk_used_gb, @disk_total_gb,
    @network_rx_mb, @network_tx_mb, @uptime_seconds, @load_avg_1m,
    @load_avg_5m, @load_avg_15m, @ssh_users, @fail2ban_banned,
    @nginx_connections, @network_connections,
    @pm2_apps_online, @pm2_apps_total, @pm2_restart_count
  )
`);

router.post('/', requireIngestKey, (req, res) => {
  try {
    const {
      cpu_percent, ram_percent, ram_used_mb, ram_total_mb,
      disk_percent, disk_used_gb, disk_total_gb,
      network_rx_mb, network_tx_mb, uptime_seconds, load_avg_1m,
      load_avg_5m, load_avg_15m, ssh_users, fail2ban_banned,
      nginx_connections, network_connections,
      pm2_apps_online, pm2_apps_total, pm2_restart_count,
    } = req.body;

    insertMetric.run({
      cpu_percent: cpu_percent ?? null,
      ram_percent: ram_percent ?? null,
      ram_used_mb: ram_used_mb ?? null,
      ram_total_mb: ram_total_mb ?? null,
      disk_percent: disk_percent ?? null,
      disk_used_gb: disk_used_gb ?? null,
      disk_total_gb: disk_total_gb ?? null,
      network_rx_mb: network_rx_mb ?? null,
      network_tx_mb: network_tx_mb ?? null,
      uptime_seconds: uptime_seconds ?? null,
      load_avg_1m: load_avg_1m ?? null,
      load_avg_5m: load_avg_5m ?? null,
      load_avg_15m: load_avg_15m ?? null,
      ssh_users: ssh_users ?? null,
      fail2ban_banned: fail2ban_banned ?? null,
      nginx_connections: nginx_connections ?? null,
      network_connections: network_connections ?? null,
      pm2_apps_online: pm2_apps_online ?? null,
      pm2_apps_total: pm2_apps_total ?? null,
      pm2_restart_count: pm2_restart_count ?? null,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/metrics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/latest', requireAdminKey, (req, res) => {
  const row = db.prepare('SELECT * FROM metrics ORDER BY id DESC LIMIT 1').get();
  res.json(row ?? null);
});

router.get('/history', requireAdminKey, (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 24, 168);
  const rows = db.prepare(`
    SELECT * FROM metrics
    WHERE created_at >= datetime('now', '-' || ? || ' hours')
    ORDER BY created_at ASC
  `).all(hours);
  res.json(rows);
});

module.exports = router;
