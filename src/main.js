/**
 * main.js — bootstrap. Routes by role; only trading users load markets + live data.
 */
(function boot() {
  let _pollTimer = null;
  let _tickerSig = '';

  // Signature of the current market set (tickers only) — detects a rotation.
  function _sig(markets) { return markets.map(m => m.ticker).slice().sort().join(','); }

  function onLiveData(markets) {
    const route = Store.get().ui.route;
    OrderBookService.reconcile(markets);
    TradeService.markToMarket();

    // Kalshi's live set rotates (tickers come and go). If it changed, rebuild the
    // grid so on-screen cards can never point at a ticker the backend no longer has
    // (which would fail an order with "market not found"). Otherwise just patch prices.
    const changed = _sig(markets) !== _tickerSig;
    _tickerSig = _sig(markets);

    if (route === 'detail') {
      const t = Store.get().ui.params;
      if (t && !MarketService.byTicker(t)) {           // the viewed market rotated out
        Toast.show('This market just closed or rotated out of the live list.', 'default');
        return Router.navigate('home');
      }
    }
    if (changed && (route === 'home' || route === 'portfolio')) {
      Router.renderMain();                              // rebuild with the current tickers
    } else {
      markets.forEach(MarketCard.patch);
      if (route === 'portfolio') Router.renderMain();
    }
  }

  function startPolling() {
    if (_pollTimer) return;
    _pollTimer = setInterval(async () => {
      const wasOffline = Store.get().ui.offline;
      try {
        const { ok, markets } = await Api.markets.refresh();
        if (ok) { if (wasOffline) { Store.setUI({ offline: false }); Router.render(); } onLiveData(markets); }
      } catch (e) { if (!wasOffline) { Store.setUI({ offline: true }); Router.render(); } }
    }, Config.refreshMs);
  }

  // Load live markets + user data and start polling. Called both at boot (for a
  // persisted user session) AND right after an interactive login — so a user who
  // signs in fresh gets live markets, never the stale seed set. Exposed on App so
  // the auth flow can trigger it.
  async function enterUserSession() {
    Store.update(s => { s.markets = []; s.marketsLive = false; }); // drop seed → show skeleton, never stale tickers
    Store.setLoading('markets', true);
    Router.render();
    try {
      await Api.refreshSession();
      await Api.markets.loadLive();
      Store.setUI({ offline: false });
    } catch (e) {
      if (e && e.status === 401) { Store.reset(); Store.setLoading('markets', false); Router.navigate('auth'); return; }
      Store.setUI({ offline: true });
      MarketService.loadSeed(); // keep the grid alive while offline
    } finally { Store.setLoading('markets', false); }
    OrderBookService.reconcile(MarketService.all());
    TradeService.markToMarket();
    _tickerSig = _sig(MarketService.all());
    Router.render();
    startPolling();
  }
  App.enterUserSession = enterUserSession;

  async function start() {
    Store.hydrate();
    const session = Store.get().session;
    MarketService.loadSeed(); // offline fallback for the markets grid
    Store.setUI({ route: session ? Router.homeFor(session.role) : 'auth' });
    Router.render();
    if (session && session.role === 'user') await enterUserSession();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
