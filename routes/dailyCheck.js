const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireIngestKey, requireAdminKey } = require('../middleware/auth');

const insertDailyCheck = db.prepare(`
  INSERT INTO daily_checks (
    ssl_days_remaining, pending_updates, network_rx_total_mb, network_tx_total_mb
  ) VALUES (
    @ssl_days_remaining, @pending_updates, @network_rx_total_mb, @network_tx_total_mb
  )
`);

router.post('/', requireIngestKey, (req, res) => {
  try {
    const {
      ssl_days_remaining, pending_updates, network_rx_total_mb, network_tx_total_mb,
    } = req.body;

    insertDailyCheck.run({
      ssl_days_remaining: ssl_days_remaining ?? null,
      pending_updates: pending_updates ?? null,
      network_rx_total_mb: network_rx_total_mb ?? null,
      network_tx_total_mb: network_tx_total_mb ?? null,
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
