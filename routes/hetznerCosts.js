const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireIngestKey, requireAdminKey } = require('../middleware/auth');

const insertHetznerCost = db.prepare(`
  INSERT INTO hetzner_costs (month, total_eur, server_costs_eur, raw_response)
  VALUES (@month, @total_eur, @server_costs_eur, @raw_response)
`);

router.post('/', requireIngestKey, (req, res) => {
  try {
    const { month, total_eur, server_costs_eur, raw_response } = req.body;

    insertHetznerCost.run({
      month: month ?? null,
      total_eur: total_eur ?? null,
      server_costs_eur: server_costs_eur ?? null,
      raw_response: raw_response ?? null,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/hetzner-costs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/latest', requireAdminKey, (req, res) => {
  const row = db.prepare('SELECT * FROM hetzner_costs ORDER BY id DESC LIMIT 1').get();
  res.json(row ?? null);
});

router.get('/history', requireAdminKey, (req, res) => {
  const months = Math.min(parseInt(req.query.months) || 6, 60);
  const rows = db.prepare('SELECT * FROM hetzner_costs ORDER BY id DESC LIMIT ?').all(months);
  res.json(rows.reverse());
});

module.exports = router;
