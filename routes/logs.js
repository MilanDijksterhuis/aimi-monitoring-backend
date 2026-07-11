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
  const limit = Math.min(parseInt(req.query.limit) || 1000, 10000);
  const rows = db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT ?').all(limit);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="logs-export.csv"');
  res.send(toCsv(rows));
});

module.exports = router;
