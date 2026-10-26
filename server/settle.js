/**
 * settle.js — auto-settlement from Kalshi.
 *
 * Periodically asks the proxy (which reads Kalshi) whether any market we hold
 * positions in has resolved. When Kalshi reports a market settled with a YES/NO
 * result, we pay it out: winners get $1.00 per contract, losers get nothing
 * (repo.resolveMarket). The market's real-world outcome — not an admin — decides.
 */
const { repo } = require('./db');

const PROXY_BASE = process.env.PROXY_BASE || 'http://127.0.0.1:7433';
const _resolved = new Set(); // tickers already settled this process (avoid re-querying)

async function checkSettlements() {
  const tickers = repo.distinctPositionTickers();
  for (const ticker of tickers) {
    if (_resolved.has(ticker)) continue;
    let s;
    try {
      const res = await fetch(`${PROXY_BASE}/settlement?ticker=${encodeURIComponent(ticker)}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      s = await res.json();
    } catch (e) { continue; } // proxy/Kalshi hiccup — try again next cycle

    const status = String(s.status || '').toLowerCase();
    const result = String(s.result || '').toLowerCase();
    if ((status === 'settled' || status === 'finalized') && (result === 'yes' || result === 'no')) {
      const n = repo.resolveMarket(ticker, result);
      _resolved.add(ticker);
      console.log(`[settle] ${ticker} resolved ${result.toUpperCase()} — paid out ${n} position(s)`);
    }
  }
}

function startSettlement(intervalMs) {
  const run = () => checkSettlements().catch(e => console.warn('[settle] run failed:', e.message));
  run();
  const t = setInterval(run, intervalMs || 120000);
  t.unref && t.unref();
  return t;
}

module.exports = { checkSettlements, startSettlement };
