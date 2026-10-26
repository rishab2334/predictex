/**
 * core/store.js — single source of truth.
 *
 * Holds all application state. Nothing else owns state; every mutation goes
 * through here. A whitelist of keys is persisted to localStorage so a page
 * refresh keeps the user's session, balance, positions, activity and watchlist.
 *
 * The store is deliberately NOT wired to auto-render the whole app on every
 * change: live-price ticks mutate market prices several times a second, and a
 * full re-render would destroy the chart canvas and any half-typed trade input.
 * Views call Router.render() explicitly when they need to repaint; lightweight
 * changes (a ticking price, the nav balance) patch their own DOM node.
 */
const Store = (() => {
  const LS_KEY       = 'predictex:state:v1';
  const PERSIST_KEYS = ['session', 'account', 'watchlist', 'positions', 'activity'];

  const _defaults = () => ({
    session:  null,   // { name, email, color, joinedAt } | null
    account:  { balance: 1000, portfolioValue: 0, weekPnl: 0, allTimePnl: 0, winRate: 0 },
    markets:  [],     // domain markets (fetched/seeded; never persisted)
    marketsLive: false,
    watchlist: [],    // array of market tickers
    positions: [],    // [{ ticker, title, series, side, avg_price, current_price, quantity }]
    activity:  [],    // [{ action, title, ticker, price, qty, cost, timestamp, pnl, status }]
    ui: { route: 'auth', params: null, filter: 'all', sort: 'volume', search: '', authMode: 'login', loading: {}, offline: false },
  });

  let _state = _defaults();
  const _subs = new Set();

  function get() { return _state; }

  /** Shallow-merge a patch into state, then persist + notify. */
  function set(patch) {
    _state = { ..._state, ...patch };
    _persist();
    _emit();
  }

  /** Mutate state via a callback (for nested updates), then persist + notify. */
  function update(mutator) {
    mutator(_state);
    _persist();
    _emit();
  }

  /** Patch ui sub-state only (not persisted) and notify. */
  function setUI(patch) {
    _state.ui = { ..._state.ui, ...patch };
    _emit();
  }

  /** Toggle a named loading flag (e.g. 'markets') and notify. */
  function setLoading(key, val) {
    _state.ui.loading = { ..._state.ui.loading, [key]: !!val };
    _emit();
  }

  function subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); }

  function _emit() {
    _subs.forEach(fn => { try { fn(_state); } catch (e) { console.error('[Store] subscriber failed:', e); } });
  }

  function _persist() {
    try {
      const slice = {};
      PERSIST_KEYS.forEach(k => { slice[k] = _state[k]; });
      localStorage.setItem(LS_KEY, JSON.stringify(slice));
    } catch (e) { /* private mode / quota — non-fatal */ }
  }

  /** Load persisted slice over defaults. Called once at boot. */
  function hydrate() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const slice = JSON.parse(raw);
      PERSIST_KEYS.forEach(k => {
        if (slice[k] !== undefined && slice[k] !== null) _state[k] = slice[k];
      });
    } catch (e) { /* corrupt storage — ignore, start clean */ }
  }

  /** Wipe everything (sign-out). Keeps markets in memory. */
  function reset() {
    const markets = _state.markets, live = _state.marketsLive;
    _state = _defaults();
    _state.markets = markets;
    _state.marketsLive = live;
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    _emit();
  }

  return { get, set, update, setUI, setLoading, subscribe, hydrate, reset };
})();
