#!/usr/bin/env node
/**
 * Predictex proxy server — port 7433
 * Fetches live Kalshi market data, serves with CORS headers.
 * Node.js 18+ native fetch avoids Python TLS fingerprinting issues.
 */

const http  = require('http');
const https = require('https');
const zlib  = require('zlib');

const PORT       = 7433;
const KALSHI     = 'https://api.elections.kalshi.com/trade-api/v2';
const CACHE_TTL  = 300_000; // 5 min ms
const MAX_MKTS   = 60;

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept':          'application/json, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control':   'no-cache',
  'sec-ch-ua':       '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile':'?0',
  'sec-ch-ua-platform': '"macOS"',
  'Sec-Fetch-Dest':  'empty',
  'Sec-Fetch-Mode':  'cors',
  'Sec-Fetch-Site':  'cross-site',
};

const CAT_MAP = {
  Politics: 'Politics', Political: 'Politics', World: 'Politics', Government: 'Politics',
  Economics: 'Economics', Economy: 'Economics', Finance: 'Economics', Financial: 'Economics',
  Sports: 'Sports', Sport: 'Sports',
  Crypto: 'Crypto', Cryptocurrency: 'Crypto',
  Technology: 'Technology', Science: 'Technology',
  Entertainment: 'Entertainment', Media: 'Entertainment',
  Weather: 'Weather', Climate: 'Weather',
};

let _cache = { markets: null, ts: 0 };

// ── fetch helper ──────────────────────────────────────────────────────────────
function kalshiFetch(path, retries = 3) {
  return new Promise((resolve, reject) => {
    const url = KALSHI + path;
    const attempt = (n) => {
      const req = https.request(url, { headers: HEADERS, timeout: 15000 }, (res) => {
        const enc    = res.headers['content-encoding'] || '';
        const chunks = [];
        let stream   = res;
        if (enc.includes('br'))   { stream = zlib.createBrotliDecompress(); res.pipe(stream); }
        else if (enc.includes('gzip'))   { stream = zlib.createGunzip();       res.pipe(stream); }
        else if (enc.includes('deflate')){ stream = zlib.createInflate();      res.pipe(stream); }
        stream.on('data', c => chunks.push(c));
        stream.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(body));
          } catch (e) { reject(new Error(`JSON parse failed (${enc}): ${e.message}`)); }
        });
        stream.on('error', reject);
      });
      req.on('timeout', () => { req.destroy(); if (n < retries) attempt(n + 1); else reject(new Error('timeout')); });
      req.on('error', (e) => {
        console.log(`[proxy] attempt ${n} error: ${e.message}`);
        if (n < retries) {
          setTimeout(() => attempt(n + 1), 1500 * n);
        } else {
          reject(e);
        }
      });
      req.end();
    };
    attempt(1);
  });
}

// ── market fetching ────────────────────────────────────────────────────────────
function mapMarket(m, eventMeta, idx) {
  const ya  = m.yes_ask  ?? m.last_price ?? m.yes_bid ?? 50;
  const na  = m.no_ask   ?? (100 - ya);
  const vol = m.volume   || m.volume_24h || 0;
  const chg = parseFloat(((m.last_price ?? ya) - ya).toFixed(1));
  const cat = CAT_MAP[eventMeta?.category || m.category] || 'Politics';
  return {
    id:            idx + 1,
    ticker:        m.ticker || '',
    series_ticker: m.series_ticker || (m.ticker || '').split('-')[0],
    title:         eventMeta?.title || m.title || m.event_ticker || m.ticker,
    subtitle:      m.subtitle || '',
    category:      cat,
    yes_price:     ya,
    no_price:      na,
    volume:        vol,
    change_24h:    chg,
    close_time:    m.close_time || eventMeta?.close_time || '',
    status:        'open',
    liquidity:     vol > 50000 ? 'high' : vol > 5000 ? 'medium' : 'low',
    source:        'kalshi',
  };
}

async function fetchBinaryMarkets() {
  const results = [];
  let cursor = null;
  let page   = 0;

  while (results.length < MAX_MKTS && page < 15) {
    const qs  = cursor ? `?status=open&limit=200&cursor=${encodeURIComponent(cursor)}` : '?status=open&limit=200';
    const data = await kalshiFetch('/markets' + qs);
    if (!data || !Array.isArray(data.markets)) break;
    cursor = data.cursor || null;
    page++;

    for (const m of data.markets) {
      if (m.yes_ask == null) continue;            // skip multivariate (null price)
      if (m.mve_collection_ticker) continue;      // skip combo markets
      results.push(mapMarket(m, null, results.length));
      if (results.length >= MAX_MKTS) break;
    }

    console.log(`[proxy] page ${page}: ${results.length} binary markets, cursor=${!!cursor}`);
    if (!cursor) break;
  }

  return results;
}

async function fetchViaEvents() {
  console.log('[proxy] Trying events endpoint…');
  const evData = await kalshiFetch('/events?status=open&limit=100');
  if (!evData?.events) return [];

  const results = [];
  for (const ev of evData.events.slice(0, 25)) {
    if (results.length >= MAX_MKTS) break;
    const mData = await kalshiFetch(`/markets?event_ticker=${ev.event_ticker}&status=open&limit=10`);
    if (!mData?.markets) continue;
    for (const m of mData.markets) {
      if (m.yes_ask == null)       continue;
      if (m.mve_collection_ticker) continue;
      results.push(mapMarket(m, ev, results.length));
      if (results.length >= MAX_MKTS) break;
    }
  }
  return results;
}

async function getMarkets() {
  const now = Date.now();
  if (_cache.markets && now - _cache.ts < CACHE_TTL) return _cache.markets;

  console.log('[proxy] Refreshing cache…');
  const t0 = Date.now();
  let markets = [];

  try {
    markets = await fetchBinaryMarkets();
  } catch (e) {
    console.log('[proxy] /markets pagination failed:', e.message);
  }

  if (markets.length === 0) {
    try {
      markets = await fetchViaEvents();
    } catch (e) {
      console.log('[proxy] events fallback failed:', e.message);
    }
  }

  console.log(`[proxy] Done: ${markets.length} markets in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (markets.length > 0) {
    _cache = { markets, ts: Date.now() };
  }
  return _cache.markets || [];
}

// ── HTTP server ────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function sendJSON(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': body.length, ...CORS });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const path = req.url.split('?')[0];

  if (req.method === 'OPTIONS') {
    res.writeHead(200, CORS);
    return res.end();
  }

  if (path === '/health') {
    return sendJSON(res, 200, { ok: true, cached: !!_cache.markets, age_s: Math.floor((Date.now() - _cache.ts) / 1000) });
  }

  if (path === '/markets') {
    try {
      const markets = await getMarkets();
      return sendJSON(res, 200, { markets, count: markets.length, source: 'kalshi' });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  sendJSON(res, 404, { error: 'not_found' });
});

server.listen(PORT, 'localhost', () => {
  console.log(`[proxy] Running on http://localhost:${PORT}`);
  console.log(`[proxy]   GET /markets  — live Kalshi markets (CORS enabled)`);
  console.log(`[proxy]   GET /health   — liveness check`);
  // Pre-warm cache
  getMarkets().catch(e => console.log('[proxy] prewarm error:', e.message));
});
