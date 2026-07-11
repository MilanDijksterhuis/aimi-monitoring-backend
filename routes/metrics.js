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
    pm2_apps_online, pm2_apps_total, pm2_restart_count,
    fail2ban_detail, pm2_detail, network_detail
  ) VALUES (
    @cpu_percent, @ram_percent, @ram_used_mb, @ram_total_mb,
    @disk_percent, @disk_used_gb, @disk_total_gb,
    @network_rx_mb, @network_tx_mb, @uptime_seconds, @load_avg_1m,
    @load_avg_5m, @load_avg_15m, @ssh_users, @fail2ban_banned,
    @nginx_connections, @network_connections,
    @pm2_apps_online, @pm2_apps_total, @pm2_restart_count,
    @fail2ban_detail, @pm2_detail, @network_detail
  )
`);

const insertAlert = db.prepare(`
  INSERT INTO alerts (type, severity, message)
  VALUES (@type, @severity, @message)
`);

function extractBannedIps(fail2banDetailJson) {
  if (!fail2banDetailJson) return [];
  try {
    const parsed = JSON.parse(fail2banDetailJson);
    return Array.isArray(parsed?.banned_ips) ? parsed.banned_ips : [];
  } catch {
    return [];
  }
}

function detectNewFail2banBans(fail2ban_detail) {
  const previous = db.prepare(`
    SELECT fail2ban_detail FROM metrics ORDER BY id DESC LIMIT 1
  `).get();

  const previousIps = new Set(extractBannedIps(previous?.fail2ban_detail));
  const currentIps = extractBannedIps(fail2ban_detail);

  for (const ip of currentIps) {
    if (!previousIps.has(ip)) {
      insertAlert.run({
        type: 'fail2ban',
        severity: 'warning',
        message: `Nieuw IP geblokkeerd: ${ip}`,
      });
    }
  }
}

router.post('/', requireIngestKey, (req, res) => {
  try {
    const {
      cpu_percent, ram_percent, ram_used_mb, ram_total_mb,
      disk_percent, disk_used_gb, disk_total_gb,
      network_rx_mb, network_tx_mb, uptime_seconds, load_avg_1m,
      load_avg_5m, load_avg_15m, ssh_users, fail2ban_banned,
      nginx_connections, network_connections,
      pm2_apps_online, pm2_apps_total, pm2_restart_count,
      fail2ban_detail, pm2_detail, network_detail,
    } = req.body;

    detectNewFail2banBans(fail2ban_detail);

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
      fail2ban_detail: fail2ban_detail ?? null,
      pm2_detail: pm2_detail ?? null,
      network_detail: network_detail ?? null,
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

const weekAverages = db.prepare(`
  SELECT
    AVG(cpu_percent) AS cpu_percent,
    AVG(ram_percent) AS ram_percent,
    AVG(disk_percent) AS disk_percent,
    AVG(network_rx_mb) AS network_rx_mb,
    AVG(network_tx_mb) AS network_tx_mb
  FROM metrics
  WHERE created_at >= datetime('now', ? || ' days')
    AND created_at < datetime('now', ? || ' days')
`);

function percentDiff(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

router.get('/compare-weeks', requireAdminKey, (req, res) => {
  const currentWeek = weekAverages.get('-7', '0');
  const previousWeek = weekAverages.get('-14', '-7');

  const metrics = ['cpu_percent', 'ram_percent', 'disk_percent', 'network_rx_mb', 'network_tx_mb'];
  const comparison = {};
  for (const metric of metrics) {
    comparison[metric] = {
      current_week: currentWeek[metric],
      previous_week: previousWeek[metric],
      percent_diff: percentDiff(currentWeek[metric], previousWeek[metric]),
    };
  }

  res.json(comparison);
});

function toCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

router.get('/export.csv', requireAdminKey, (req, res) => {
  const hours = Math.min(parseInt(req.query.hours) || 168, 168 * 4);
  const rows = db.prepare(`
    SELECT * FROM metrics
    WHERE created_at >= datetime('now', '-' || ? || ' hours')
    ORDER BY created_at ASC
  `).all(hours);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="metrics-export.csv"');
  res.send(toCsv(rows));
});

module.exports = router;
