const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireIngestKey, requireAdminKey } = require('../middleware/auth');

const insertDailyCheck = db.prepare(`
  INSERT INTO daily_checks (
    ssl_days_remaining, pending_updates, network_rx_total_mb, network_tx_total_mb,
    os_version, kernel_version, ip_address, hostname, timezone,
    server_created_at, datacenter_location
  ) VALUES (
    @ssl_days_remaining, @pending_updates, @network_rx_total_mb, @network_tx_total_mb,
    @os_version, @kernel_version, @ip_address, @hostname, @timezone,
    @server_created_at, @datacenter_location
  )
`);

const insertAlert = db.prepare(`
  INSERT INTO alerts (type, severity, message)
  VALUES (@type, @severity, @message)
`);

const findTodaysUnresolvedSslAlert = db.prepare(`
  SELECT id FROM alerts
  WHERE type = 'ssl' AND resolved = 0
    AND date(created_at) = date('now')
  LIMIT 1
`);

function maybeCreateSslAlert(ssl_days_remaining) {
  if (ssl_days_remaining == null || ssl_days_remaining >= 7) return;
  if (findTodaysUnresolvedSslAlert.get()) return;

  insertAlert.run({
    type: 'ssl',
    severity: 'critical',
    message: `SSL certificaat verloopt over ${ssl_days_remaining} dagen`,
  });
}

router.post('/', requireIngestKey, (req, res) => {
  try {
    const {
      ssl_days_remaining, pending_updates, network_rx_total_mb, network_tx_total_mb,
      os_version, kernel_version, ip_address, hostname, timezone,
      server_created_at, datacenter_location,
    } = req.body;

    maybeCreateSslAlert(ssl_days_remaining);

    insertDailyCheck.run({
      ssl_days_remaining: ssl_days_remaining ?? null,
      pending_updates: pending_updates ?? null,
      network_rx_total_mb: network_rx_total_mb ?? null,
      network_tx_total_mb: network_tx_total_mb ?? null,
      os_version: os_version ?? null,
      kernel_version: kernel_version ?? null,
      ip_address: ip_address ?? null,
      hostname: hostname ?? null,
      timezone: timezone ?? null,
      server_created_at: server_created_at ?? null,
      datacenter_location: datacenter_location ?? null,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/daily-check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/latest', requireAdminKey, (req, res) => {
  const row = db.prepare('SELECT * FROM daily_checks ORDER BY id DESC LIMIT 1').get();
  res.json(row ?? null);
});

module.exports = router;
