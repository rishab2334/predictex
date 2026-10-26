/**
 * views/detailView.js — single market: chart / order book / rules tabs plus the
 * trade ticket and related markets. Routed by ticker (stable across data reloads).
 */
const DetailView = (() => {
  let _ticker = null;

  function render(state, ticker) {
    _ticker = ticker;
    const market = MarketService.byTicker(ticker);
    if (!market) {
      return `<div class="page-body" style="padding:48px 24px;text-align:center">
        <p class="text-secondary">Market not found.</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="App.navigate('home')">Back to markets</button>
      </div>`;
    }

    const isSettled = market.status === 'settled';

    return `
      <div class="page-body">
        <div class="breadcrumb">
          <button class="back-btn" onclick="App.navigate('home')"><i class="ti ti-arrow-left"></i> Markets</button>
          <span class="breadcrumb-sep">/</span>
          <span class="text-secondary fs-13">${Utils.escapeHtml(market.category)}</span>
          <span class="breadcrumb-sep">/</span>
          <span class="text-secondary fs-13">${Utils.escapeHtml(market.series_ticker)}</span>
        </div>

        <div class="market-detail-layout">
          <div>
            <div class="market-detail-category-row">
              <span class="badge badge-neutral">${Utils.escapeHtml(market.category)}</span>
              <span class="badge badge-neutral">${Utils.escapeHtml(market.series_ticker)}</span>
              ${!isSettled ? '<span class="badge badge-danger"><i class="ti ti-radio"></i> Live</span>' : '<span class="badge badge-neutral">Settled</span>'}
              ${market.liquidity === 'high' ? '<span class="badge badge-accent"><i class="ti ti-flame"></i> Hot</span>' : ''}
            </div>

            <h1 class="market-detail-title">${Utils.escapeHtml(market.title)}</h1>

            <div class="market-detail-meta">
              <span><i class="ti ti-calendar" aria-hidden="true"></i> Closes ${Utils.closeDate(market.close_time)}</span>
              <span><i class="ti ti-clock" aria-hidden="true"></i> ${Utils.daysUntil(market.close_time)}</span>
              <span><i class="ti ti-chart-bar" aria-hidden="true"></i> ${Utils.volume(market.volume)} volume</span>
              <span class="text-muted">OI: ${(market.open_interest / 1000).toFixed(0)}K</span>
              <span class="${market.change_24h >= 0 ? 'text-success' : 'text-danger'}">${market.change_24h >= 0 ? '+' : ''}${market.change_24h}% today</span>
            </div>

            <div class="detail-tabs" id="detail-tabs">
              <button class="detail-tab active" id="dtab-chart" onclick="DetailView.switchTab('chart')"><i class="ti ti-chart-line"></i> Chart</button>
              <button class="detail-tab" id="dtab-orderbook" onclick="DetailView.switchTab('orderbook')"><i class="ti ti-list-numbers"></i> Order book</button>
              <button class="detail-tab" id="dtab-rules" onclick="DetailView.switchTab('rules')"><i class="ti ti-file-text"></i> Rules</button>
            </div>

            <div id="detail-panel-chart">${PriceChart.render(market)}</div>
            <div id="detail-panel-orderbook" style="display:none">
              <div class="orderbook-section" style="text-align:center;padding:28px"><span class="spinner"></span></div>
            </div>
            <div id="detail-panel-rules" style="display:none">
              <div class="rules-box">
                <h3 class="rules-title">Resolution criteria</h3>
                <p class="rules-text">${Utils.escapeHtml(market.description)}</p>
                <div class="rules-divider"></div>
                <h3 class="rules-title">Contract specs</h3>
                <div class="rules-specs">
                  <div class="spec-row"><span class="spec-label">Contract type</span><span>Binary (YES / NO)</span></div>
                  <div class="spec-row"><span class="spec-label">Payout per contract</span><span>$1.00 if correct, $0.00 if incorrect</span></div>
                  <div class="spec-row"><span class="spec-label">Minimum order</span><span>1 contract</span></div>
                  <div class="spec-row"><span class="spec-label">Settlement</span><span>Automated within 24h of resolution event</span></div>
                  <div class="spec-row"><span class="spec-label">Close time</span><span>${Utils.closeDate(market.close_time)}</span></div>
                  <div class="spec-row"><span class="spec-label">Market status</span><span class="text-success">${market.status.charAt(0).toUpperCase() + market.status.slice(1)}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div>
            ${isSettled
              ? `<div class="settled-notice">
                  <i class="ti ti-circle-check" style="font-size:24px;color:var(--text-success);margin-bottom:8px"></i>
                  <div style="font-weight:500;margin-bottom:4px">Market settled</div>
                  <div class="text-secondary fs-13">This market has already resolved. View your activity for settlement details.</div>
                  <button class="btn btn-sm" style="margin-top:12px" onclick="App.navigate('activity')">View activity</button>
                </div>`
              : TradePanel.render(market)}
          </div>
        </div>

        ${_related(market)}
      </div>`;
  }

  function mount() {
    const market = MarketService.byTicker(_ticker);
    if (!market) return;
    PriceChart.init(market);
    if (market.status !== 'settled') TradePanel.init(market);
    _loadBook();
  }

  /** Load the live order book (server book in remote mode, local book otherwise). */
  async function _loadBook() {
    const panel = document.getElementById('detail-panel-orderbook');
    if (!panel || !_ticker) return;
    try {
      const book = await Api.markets.book(_ticker);
      if (document.getElementById('detail-panel-orderbook') === panel) panel.innerHTML = OrderBook.render(book);
    } catch (e) {
      panel.innerHTML = '<div class="orderbook-section" style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">Order book unavailable.</div>';
    }
  }

  /** After a trade on this page: refresh the live book, the price header, and any card. */
  function afterTrade() {
    const m = MarketService.byTicker(_ticker);
    if (!m) return;
    _loadBook();                       // liquidity was consumed + replenished — refresh the book
    const cp = document.getElementById('chart-price');
    if (cp) cp.textContent = m.yes_price + '¢'; // price unchanged (Kalshi-owned), but keep in sync
    MarketCard.patch(m);
  }

  function switchTab(tab) {
    const panels = { chart: 'detail-panel-chart', orderbook: 'detail-panel-orderbook', rules: 'detail-panel-rules' };
    const tabs   = { chart: 'dtab-chart', orderbook: 'dtab-orderbook', rules: 'dtab-rules' };
    Object.entries(panels).forEach(([k, id]) => { const el = document.getElementById(id); if (el) el.style.display = k === tab ? '' : 'none'; });
    Object.entries(tabs).forEach(([k, id]) => { const el = document.getElementById(id); if (el) el.classList.toggle('active', k === tab); });
    if (tab === 'chart') { const m = MarketService.byTicker(_ticker); if (m) PriceChart.init(m); }
  }

  function _related(current) {
    const related = MarketService.related(current);
    if (!related.length) return '';
    return `
      <div style="margin-top:32px;padding:0 var(--pad-lg) var(--pad-lg)">
        <div class="section-header" style="margin-bottom:14px">
          <div class="section-title">Related markets</div>
          <button class="btn btn-ghost btn-sm" onclick="App.setFilter('${current.category.toLowerCase()}');App.navigate('home')">View all ${Utils.escapeHtml(current.category)} →</button>
        </div>
        <div class="market-cards-grid" style="grid-template-columns:repeat(3,1fr)">${related.map(m => MarketCard.render(m)).join('')}</div>
      </div>`;
  }

  return { render, mount, switchTab, afterTrade };
})();
