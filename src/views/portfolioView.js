/**
 * views/portfolioView.js — holdings summary, category allocation donut, and the
 * open-positions table. Reads positions + account from the Store.
 */
const PortfolioView = (() => {
  const PALETTE = ['#00b17a', '#378add', '#e24b4a', '#ba7517', '#9b59b6', '#1abc9c'];

  function render(state) {
    const positions = state.positions;
    const acct      = state.account;
    const totalPnl  = positions.reduce((s, p) => s + computePnl(p), 0);
    const pnlClass  = totalPnl >= 0 ? 'text-success' : 'text-danger';
    const pnlSign   = totalPnl >= 0 ? '+' : '';

    return `
      <div class="page-body">
        <div style="margin-bottom:24px">
          <h1 style="font-size:20px;font-weight:500;margin-bottom:4px">Your portfolio</h1>
          <p class="text-secondary fs-13">Active positions and performance overview</p>
        </div>

        <div class="portfolio-cards">
          <div class="metric-card">
            <div class="metric-label">Portfolio value</div>
            <div class="metric-value">${Utils.money(acct.portfolioValue)}</div>
            <div class="metric-sub text-success">+${Utils.money(acct.weekPnl)} this week</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Cash balance</div>
            <div class="metric-value">${Utils.money(acct.balance)}</div>
            <div class="metric-sub"><button class="link-btn fs-12" onclick="App.requestWithdrawal()"><i class="ti ti-arrow-down" style="font-size:11px"></i> Request withdrawal</button></div>
          </div>
          <div class="metric-card">
            <div class="metric-label">All-time P&amp;L</div>
            <div class="metric-value text-success">+${Utils.money(acct.allTimePnl)}</div>
            <div class="metric-sub">Win rate: ${acct.winRate}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Open positions P&amp;L</div>
            <div class="metric-value ${pnlClass}">${pnlSign}${Utils.money(Math.abs(totalPnl))}</div>
            <div class="metric-sub">${positions.length} active position${positions.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <div class="portfolio-layout">
          <div class="allocation-card">
            <div class="section-title" style="margin-bottom:16px">Allocation</div>
            <div class="donut-wrap">
              <canvas id="alloc-chart" width="160" height="160"></canvas>
              <div class="donut-center">
                <div class="donut-total">$${Math.round(acct.portfolioValue).toLocaleString()}</div>
                <div class="donut-label">Total</div>
              </div>
            </div>
            <div class="alloc-legend" id="alloc-legend"></div>
          </div>

          <div style="flex:1;min-width:0">
            <div class="section-title" style="margin-bottom:12px">Open positions</div>
            ${positions.length === 0 ? `
              <div class="empty-state">
                <i class="ti ti-inbox" style="font-size:32px;color:var(--text-muted);margin-bottom:12px"></i>
                <div style="font-weight:500;margin-bottom:6px">No open positions</div>
                <div class="text-secondary fs-13">Place a trade to see it here.</div>
                <button class="btn btn-sm" style="margin-top:12px" onclick="App.navigate('home')">Browse markets</button>
              </div>` : `
              <div class="data-table">
                <div class="data-table-header" style="grid-template-columns:3fr 80px 80px 80px 80px 60px">
                  <span>Market</span><span>Side</span><span>Avg</span><span>Current</span><span>P&amp;L</span><span>Qty</span>
                </div>
                ${positions.map(pos => {
                  const pnl = computePnl(pos);
                  const pnlStr = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
                  const cls = pnl >= 0 ? 'text-success' : 'text-danger';
                  const pct = pos.avg_price > 0
                    ? ((pos.current_price - pos.avg_price) / pos.avg_price * 100 * (pos.side === 'NO' ? -1 : 1)).toFixed(1) : '0.0';
                  const t = Utils.escapeHtml(pos.ticker);
                  return `
                    <div class="data-table-row" style="grid-template-columns:3fr 80px 80px 80px 80px 60px;cursor:pointer" onclick="App.navigate('detail','${t}')">
                      <div><div class="fw-500 fs-13">${Utils.escapeHtml(pos.title)}</div><div class="fs-11 text-muted">${t}</div></div>
                      <div><span class="badge ${pos.side === 'YES' ? 'badge-success' : 'badge-danger'}">${pos.side}</span></div>
                      <div>${pos.avg_price}¢</div>
                      <div>${pos.current_price}¢</div>
                      <div><div class="${cls} fw-500">${pnlStr}</div><div class="${cls} fs-11">${pnl >= 0 ? '+' : ''}${pct}%</div></div>
                      <div class="text-secondary">${pos.quantity}</div>
                    </div>`;
                }).join('')}
              </div>`}
          </div>
        </div>
      </div>`;
  }

  function mount(state) {
    const canvas = document.getElementById('alloc-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const byCat = {};
    state.positions.forEach(pos => {
      const mkt = MarketService.byTicker(pos.ticker);
      const cat = mkt ? mkt.category : (pos.series || 'Other');
      byCat[cat] = (byCat[cat] || 0) + pos.current_price * pos.quantity / 100;
    });
    const labels = Object.keys(byCat);
    const values = Object.values(byCat);
    if (!labels.length) return;

    if (window._allocChart) { window._allocChart.destroy(); }
    window._allocChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: PALETTE.slice(0, labels.length), borderWidth: 0 }] },
      options: {
        cutout: '70%', responsive: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: $${ctx.raw.toFixed(2)} (${((ctx.raw / values.reduce((a, b) => a + b, 0)) * 100).toFixed(0)}%)` } },
        },
      },
    });

    const legend = document.getElementById('alloc-legend');
    if (legend) {
      legend.innerHTML = labels.map((l, i) => `
        <div class="alloc-legend-item">
          <div class="alloc-legend-dot" style="background:${PALETTE[i % PALETTE.length]}"></div>
          <span class="fs-12">${Utils.escapeHtml(l)}</span>
          <span class="fs-12 text-secondary" style="margin-left:auto">$${values[i].toFixed(0)}</span>
        </div>`).join('');
    }
  }

  return { render, mount };
})();
