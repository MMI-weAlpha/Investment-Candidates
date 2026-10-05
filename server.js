const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const YahooFinance = require('yahoo-finance2').default;
const { regionFor } = require('./regions');

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const app = express();
app.use(express.json({ limit: '200kb' }));

const ACCESS_CODE = process.env.ACCESS_CODE || '';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS candidates (
      id SERIAL PRIMARY KEY,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      price NUMERIC,
      currency TEXT,
      sector TEXT,
      country TEXT,
      region TEXT,
      notes TEXT,
      links JSONB NOT NULL DEFAULT '[]',
      price_updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Erfassungskurs: wird beim Anlegen einmal gespeichert und nie mehr überschrieben.
  await pool.query('ALTER TABLE candidates ADD COLUMN IF NOT EXISTS entry_price NUMERIC');
  await pool.query('UPDATE candidates SET entry_price = price WHERE entry_price IS NULL');
}

function out(r) {
  return {
    ...r,
    price: r.price === null ? null : Number(r.price),
    entry_price: r.entry_price === null ? null : Number(r.entry_price)
  };
}

// Einfacher Zugriffsschutz (optional): nur aktiv, wenn ACCESS_CODE gesetzt ist.
app.use('/api', (req, res, next) => {
  if (!ACCESS_CODE) return next();
  if (req.get('x-access-code') === ACCESS_CODE) return next();
  res.status(401).json({ error: 'Zugangscode falsch oder fehlt' });
});

const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Serverfehler' });
  });

// --- Suche nach Name oder Ticker ---
app.get('/api/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 1) return res.json([]);
  const r = await yahooFinance.search(q, { quotesCount: 8, newsCount: 0 });
  const out = (r.quotes || [])
    .filter((x) => x.symbol && (x.quoteType === 'EQUITY' || x.quoteType === 'ETF'))
    .map((x) => ({
      symbol: x.symbol,
      name: x.longname || x.shortname || x.symbol,
      exchange: x.exchDisp || x.exchange || '',
      type: x.quoteType
    }));
  res.json(out);
}));

// --- Details zu einem Ticker: Preis, Sektor, Land, Region ---
async function lookup(symbol) {
  const s = await yahooFinance.quoteSummary(symbol, { modules: ['price', 'assetProfile'] });
  const p = s.price || {};
  const a = s.assetProfile || {};
  const country = a.country || null;
  return {
    symbol: p.symbol || symbol,
    name: p.longName || p.shortName || symbol,
    price: p.regularMarketPrice ?? null,
    currency: p.currency || null,
    sector: a.sector || (p.quoteType === 'ETF' ? 'ETF' : null),
    country,
    region: regionFor(country)
  };
}

app.get('/api/lookup', wrap(async (req, res) => {
  const symbol = String(req.query.symbol || '').trim();
  if (!symbol) return res.status(400).json({ error: 'symbol fehlt' });
  res.json(await lookup(symbol));
}));

// --- Kandidaten ---
function cleanLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .map((l) => ({ url: String(l.url || '').trim(), title: String(l.title || '').trim() }))
    .filter((l) => /^https?:\/\//i.test(l.url));
}

app.get('/api/candidates', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM candidates ORDER BY created_at DESC');
  res.json(rows.map(out));
}));

app.post('/api/candidates', wrap(async (req, res) => {
  const b = req.body || {};
  if (!b.symbol || !b.name) return res.status(400).json({ error: 'Name und Ticker erforderlich' });
  const { rows } = await pool.query(
    `INSERT INTO candidates (symbol, name, price, entry_price, currency, sector, country, region, notes, links, price_updated_at)
     VALUES ($1,$2,$3,$3,$4,$5,$6,$7,$8,$9, CASE WHEN $3::numeric IS NULL THEN NULL ELSE now() END)
     RETURNING *`,
    [b.symbol, b.name, b.price ?? null, b.currency || null, b.sector || null, b.country || null,
     b.region || regionFor(b.country), b.notes || '', JSON.stringify(cleanLinks(b.links))]
  );
  res.status(201).json(out(rows[0]));
}));

app.put('/api/candidates/:id', wrap(async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query(
    `UPDATE candidates SET name=$2, sector=$3, country=$4, region=$5, notes=$6, links=$7
     WHERE id=$1 RETURNING *`,
    [req.params.id, b.name, b.sector || null, b.country || null,
     b.region || regionFor(b.country), b.notes || '', JSON.stringify(cleanLinks(b.links))]
  );
  if (!rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json(out(rows[0]));
}));

app.delete('/api/candidates/:id', wrap(async (req, res) => {
  await pool.query('DELETE FROM candidates WHERE id=$1', [req.params.id]);
  res.status(204).end();
}));

// --- Kurse aller Kandidaten aktualisieren ---
app.post('/api/refresh', wrap(async (_req, res) => {
  const { rows } = await pool.query('SELECT id, symbol FROM candidates');
  let updated = 0;
  for (const r of rows) {
    try {
      const q = await yahooFinance.quote(r.symbol);
      if (q && q.regularMarketPrice != null) {
        await pool.query(
          'UPDATE candidates SET price=$2, currency=COALESCE($3,currency), price_updated_at=now() WHERE id=$1',
          [r.id, q.regularMarketPrice, q.currency || null]
        );
        updated++;
      }
    } catch (e) {
      console.error('Kurs fehlgeschlagen für', r.symbol, e.message);
    }
  }
  res.json({ updated, total: rows.length });
}));

// Seite ausliefern: normalerweise aus dem Ordner "public". Falls die Dateien
// beim Hochladen auf GitHub flach (ohne Ordner) gelandet sind, werden sie
// einzeln aus dem Hauptverzeichnis ausgeliefert.
const fs = require('fs');
const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(path.join(publicDir, 'index.html'))) {
  app.use(express.static(publicDir));
} else {
  const FILES = ['index.html', 'app.js', 'manifest.json', 'sw.js', 'icon.svg', 'apple-touch-icon.png'];
  console.log('Ordner public nicht gefunden, liefere Dateien aus dem Hauptverzeichnis aus.');
  app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));
  for (const f of FILES) {
    app.get('/' + f, (_req, res) => res.sendFile(path.join(__dirname, f)));
  }
}

const PORT = process.env.PORT || 3000;
initDb()
  .then(() => app.listen(PORT, () => console.log('Kandidaten läuft auf Port ' + PORT)))
  .catch((e) => {
    console.error('DB-Init fehlgeschlagen:', e.message);
    process.exit(1);
  });
