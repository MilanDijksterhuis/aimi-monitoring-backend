const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireAdminKey } = require('../middleware/auth');

router.get('/', requireAdminKey, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const { resolved } = req.query;

  let rows;
  if (resolved === 'true' || resolved === 'false') {
    const resolvedValue = resolved === 'true' ? 1 : 0;
    rows = db.prepare('SELECT * FROM alerts WHERE resolved = ? ORDER BY id DESC LIMIT ?')
      .all(resolvedValue, limit);
  } else {
    rows = db.prepare('SELECT * FROM alerts ORDER BY id DESC LIMIT ?').all(limit);
  }

  res.json(rows);
});

router.post('/:id/resolve', requireAdminKey, (req, res) => {
  const result = db.prepare('UPDATE alerts SET resolved = 1 WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json({ ok: true });
});

module.exports = router;
