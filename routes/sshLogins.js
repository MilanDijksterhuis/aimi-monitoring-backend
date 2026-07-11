const express = require('express');
const router = express.Router();
const db = require('../db/init');
const { requireIngestKey, requireAdminKey } = require('../middleware/auth');

const insertSshLogins = db.prepare(`
  INSERT INTO ssh_logins (successful_detail, failed_detail)
  VALUES (@successful_detail, @failed_detail)
`);

router.post('/', requireIngestKey, (req, res) => {
  try {
    const { successful, failed } = req.body;

    insertSshLogins.run({
      successful_detail: successful ? JSON.stringify(successful) : null,
      failed_detail: failed ? JSON.stringify(failed) : null,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/ssh-logins error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/latest', requireAdminKey, (req, res) => {
  const row = db.prepare('SELECT * FROM ssh_logins ORDER BY id DESC LIMIT 1').get();
  res.json(row ?? null);
});

module.exports = router;
