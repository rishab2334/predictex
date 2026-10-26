/**
 * ingest.js — server-side Kalshi market ingester.
 *
 * Periodically pulls live markets from the Kalshi proxy (proxy.py, which handles
 * the TLS impersonation Kalshi requires) and refreshes the `markets` table, so
 * remote-mode clients get live prices from the DB instead of static seed data.
 *
 * Resilient by design: if the proxy is down or returns too few markets, the
 * existing data is kept untouched — it never wipes good data or invents prices.
 */
const { repo } = require('./db');

// Use 127.0.0.1 (not 'localhost'): Node 18 fetch resolves localhost to IPv6 ::1
// first, but proxy.py binds IPv4 only, so 'localhost' would fail to connect.
const PROXY_URL   = process.env.PROXY_URL || 'http://127.0.0.1:7433/markets';
const MIN_MARKETS = 10;      // below this we assume a bad/partial fetch and skip
const FETCH_TIMEOUT_MS = 90000; // proxy can take ~90s on a cold refresh

// Map a proxy market to the DB column shape (fills gaps the proxy omits).
function mapProxyMarket(m) {
  const yes = Number(m.yes_price);
  const yesP = Number.isFinite(yes) ? Math.min(99, Math.max(1, Math.round(yes))) : 50;
  return {
    ticker:        m.ticker,
    series_ticker: m.series_ticker || String(m.ticker || '').split('-')[0],
    category:      m.category || 'Politics',
    title:         m.title || m.ticker || 'Untitled market',
    subtitle:      m.subtitle || '',
    description:   m.description || 'Official resolution criteria not yet published.',
    yes_price:     yesP,
    no_price:      100 - yesP,
    volume:        Number(m.volume) || 0,
    open_interest: Number(m.open_interest) || Math.round((Number(m.volume) || 0) * 0.15),
    close_time:    m.close_time || '',
    status:        m.status || 'open',
    change_24h:    Number(m.change_24h) || 0,
    liquidity:     m.liquidity || 'medium',
  };
}

async function ingestOnce() {
  let res;
  try {
    res = await fetch(PROXY_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    console.warn('[ingest] proxy unreachable — keeping existing markets (' + e.message + ')');
    return { ok: false };
  }
  if (!res.ok) { console.warn('[ingest] proxy HTTP ' + res.status + ' — keeping existing markets'); return { ok: false }; }

  const data = await res.json().catch(() => ({}));
  const raw = (data.markets || []).filter(m => m && m.ticker);
  if (raw.length < MIN_MARKETS) {
    console.warn('[ingest] only ' + raw.length + ' markets returned — keeping existing');
    return { ok: false };
  }

  const n = repo.replaceMarkets(raw.map(mapProxyMarket));
  console.log('[ingest] refreshed ' + n + ' live markets from Kalshi');
  return { ok: true, count: n };
}

/** Start the ingest loop. Kicks off immediately (cold proxy may take ~90s). */
function startIngest(intervalMs) {
  ingestOnce().catch(e => console.warn('[ingest] initial run failed:', e.message));
  const timer = setInterval(() => ingestOnce().catch(e => console.warn('[ingest] run failed:', e.message)), intervalMs || 60000);
  timer.unref && timer.unref(); // don't keep the process alive just for polling
  return timer;
}

module.exports = { ingestOnce, startIngest, mapProxyMarket };
