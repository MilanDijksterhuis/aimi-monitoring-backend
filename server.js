require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const db = require('./db/init');

const metricsRouter = require('./routes/metrics');
const logsRouter = require('./routes/logs');
const dailyCheckRouter = require('./routes/dailyCheck');

const app = express();

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://aimi-development.nl',
  methods: ['GET', 'POST'],
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/metrics', metricsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/daily-check', dailyCheckRouter);

// Dagelijkse cleanup om 03:00 — verwijdert rijen ouder dan 14 dagen
cron.schedule('0 3 * * *', () => {
  try {
    const m = db.prepare("DELETE FROM metrics WHERE created_at < datetime('now', '-14 days')").run();
    const l = db.prepare("DELETE FROM logs WHERE created_at < datetime('now', '-14 days')").run();
    console.log(`[cleanup] metrics: ${m.changes} rijen, logs: ${l.changes} rijen verwijderd`);
  } catch (err) {
    console.error('[cleanup] fout:', err);
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`aimi-monitoring luistert op port ${PORT}`);
  console.log(`Database: ${process.env.METRICS_DB_PATH || './data/metrics.db'}`);
});
