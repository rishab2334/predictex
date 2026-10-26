/**
 * services/marketService.js — market data domain logic.
 *
 * Owns everything about markets: loading them (live from the Kalshi proxy, or
 * the offline seed), normalizing the Kalshi payload into our domain shape,
 * looking one up by ticker, and driving the live-price simulation. Writes
 * markets into the Store; does not touch the DOM (the caller supplies a tick
 * callback so the UI layer decides how to paint changing prices).
 */
const MarketService = (() => {
  const PROXY_URL = 'http://localhost:7433/markets';

  /** Seed the store with offline data immediately (so first paint is instant). */
  function loadSeed() {
    Store.update(s => { s.markets = SEED_MARKETS.slice(); s.marketsLive = false; });
  }

  /** Map one proxy/Kalshi market to our domain shape, with safe defaults. */
  function _map(m) {
    const yes = Number(m.yes_price);
    const yesPrice = Number.isFinite(yes) ? Utils.clamp(Math.round(yes), 1, 99) : 50;
    return {
      ticker:        m.ticker || m.id || '',
      series_ticker: m.series_ticker || String(m.ticker || '').split('-')[0],
      category:      m.category || 'Politics',
      title:         m.title || m.ticker || 'Untitled market',
      subtitle:      m.subtitle || '',
      description:   m.description || 'Official resolution criteria not yet published.',
      yes_price:     yesPrice,
      no_price:      100 - yesPrice,
      volume:        Number(m.volume) || 0,
      open_interest: Number(m.open_interest) || Math.round((Number(m.volume) || 0) * 0.15),
      close_time:    m.close_time || '',
      status:        m.status || 'open',
      change_24h:    Number(m.change_24h) || 0,
      liquidity:     m.liquidity || 'medium',
    };
  }

  /**
   * Try to load live markets from the proxy. Resolves true on success (store
   * updated with live data), false if the proxy is unreachable or empty — in
   * which case the already-loaded seed remains.
   */
  async function loadLive(attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(PROXY_URL, { signal: AbortSignal.timeout(90000) });
        if (!res.ok) { await _sleep(3000); continue; }
        const data = await res.json();
        const raw  = data.markets || [];
        if (raw.length === 0) { await _sleep(5000); continue; }
        Store.update(s => { s.markets = raw.map(_map); s.marketsLive = true; });
        console.log('[Predictex] Loaded', raw.length, 'live markets from Kalshi proxy');
        return true;
      } catch (e) {
        if (e.name === 'TypeError') break; // connection refused — proxy not running
        console.log('[Predictex] Proxy attempt', i + 1, 'failed:', e.message);
        if (i < attempts - 1) await _sleep(4000);
      }
    }
    console.log('[Predictex] Using built-in market data');
    return false;
  }

  function all()          { return Store.get().markets; }
  function open()         { return all().filter(m => m.status === 'open'); }
  function byTicker(t)    { return all().find(m => m.ticker === t) || null; }
  function settled()      { return all().filter(m => m.status === 'settled'); }
  function related(mkt)   { return open().filter(m => m.ticker !== mkt.ticker && m.category === mkt.category).slice(0, 3); }

  /**
   * Re-read markets from the proxy once (single attempt, short timeout). On
   * success the store's markets are replaced with fresh live prices from Kalshi
   * and true is returned; on failure the existing data is kept untouched — no
   * synthetic movement is ever invented.
   */
  async function refresh() {
    try {
      const res = await fetch(PROXY_URL, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return false;
      const data = await res.json();
      const raw  = data.markets || [];
      if (!raw.length) return false;
      Store.update(s => { s.markets = raw.map(_map); s.marketsLive = true; });
      return true;
    } catch (e) { return false; }
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { loadSeed, loadLive, refresh, all, open, byTicker, settled, related };
})();
