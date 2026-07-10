# aimi-monitoring

Lichtgewicht Express/SQLite API voor server monitoring. Ontvangt metrics en logs van een VPS cron script, slaat op in SQLite, en serveert ze naar het AIMI dashboard.

## Env vars

Kopieer `.env.example` naar `.env` en vul in:

| Var | Omschrijving |
|---|---|
| `PORT` | Poort waarop de app luistert (standaard 3002) |
| `METRICS_API_KEY` | Geheime sleutel voor het VPS cron script (POST endpoints) |
| `ADMIN_API_KEY` | Geheime sleutel voor het dashboard (GET endpoints) |
| `METRICS_DB_PATH` | Pad naar de SQLite database (standaard `./data/metrics.db`) |
| `ALLOWED_ORIGIN` | CORS-domein van je dashboard, bv. `https://aimi-development.nl` |

## Lokaal starten

```bash
npm install
cp .env.example .env
# vul .env in
npm start
```

De database en tabellen worden **automatisch aangemaakt** bij de eerste start. Geen handmatige migratie nodig.

## Endpoints

| Methode | Pad | Auth header | Omschrijving |
|---|---|---|---|
| POST | `/api/metrics` | `X-API-Key` | Sla een metriek-meting op |
| POST | `/api/logs` | `X-API-Key` | Sla een logbericht op |
| GET | `/api/metrics/latest` | `X-Admin-Key` | Laatste meting |
| GET | `/api/metrics/history?hours=24` | `X-Admin-Key` | Geschiedenis (max 168u) |
| GET | `/api/logs?limit=100&level=error` | `X-Admin-Key` | Logs met optioneel filter |
| GET | `/health` | — | Health check |

## Voorbeeldcommando's

**Metric insturen (VPS cron script):**
```bash
curl -X POST https://jouw-subdomein/api/metrics \
  -H "Content-Type: application/json" \
  -H "X-API-Key: jouw-metrics-api-key" \
  -d '{
    "cpu_percent": 12.5,
    "ram_percent": 45.2,
    "ram_used_mb": 1843,
    "ram_total_mb": 4096,
    "disk_percent": 38.0,
    "disk_used_gb": 19.0,
    "disk_total_gb": 50.0,
    "network_rx_mb": 0.4,
    "network_tx_mb": 0.2,
    "uptime_seconds": 86400,
    "load_avg_1m": 0.23
  }'
```

**Laatste meting ophalen (dashboard):**
```bash
curl https://jouw-subdomein/api/metrics/latest \
  -H "X-Admin-Key: jouw-admin-api-key"
```

## Deployment op VPS (via SSH)

1. Upload project naar de server (bijv. `/root/aimi-monitoring`)
2. `npm install --omit=dev`
3. Maak `.env` aan op basis van `.env.example`
4. Start via PM2: `pm2 start server.js --name aimi-monitoring`
5. Sla op: `pm2 save`
6. Nginx reverse proxy instellen op gewenst subpad/subdomein

## Cleanup

Elke nacht om 03:00 worden automatisch rijen ouder dan 14 dagen verwijderd uit beide tabellen.
