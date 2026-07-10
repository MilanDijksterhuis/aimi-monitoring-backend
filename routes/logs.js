const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireIngestKey, requireAdminKey } = require('../middleware/auth');

const insertLog = db.prepare(`
  INSERT INTO logs (source, level, message)
  VALUES (@source, @level, @message)
`);

router.post('/', requireIngestKey, (req, res) => {
  try {
    const { source, level, message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    insertLog.run({
      source: source ?? null,
      level: level ?? 'info',
      message,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', requireAdminKey, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
  const level = req.query.level;

  const rows = level
    ? db.prepare('SELECT * FROM logs WHERE level = ? ORDER BY id DESC LIMIT ?').all(level, limit)
    : db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(limit);

  res.json(rows);
});

module.exports = router;
