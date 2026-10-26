const PortfolioModal = (() => {
  const esc = Utils.escapeHtml, money = Utils.money;

  function show(data) {
    const u = data.user || {};
    const acct = data.account || {};
    const positions = data.positions || [];
    const activity = data.activity || [];
    const recent = activity.slice(0, 10);

    const posRows = positions.length ? positions.map(p => {
      const cost = (p.avg_price * p.quantity / 100).toFixed(2);
      const val = (p.current_price * p.quantity / 100).toFixed(2);
      const pnl = (val - cost).toFixed(2);
      const pnlClass = pnl > 0 ? 'text-success' : pnl < 0 ? 'text-danger' : '';
      return `<tr>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.title)}">${esc(p.title)}</td>
        <td>${p.side}</td><td>${p.quantity}</td>
        <td class="tabular">${p.avg_price}¢</td><td class="tabular">${p.current_price}¢</td>
        <td class="tabular ${pnlClass}">${pnl >= 0 ? '+' : ''}$${pnl}</td></tr>`;
    }).join('') : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No open positions</td></tr>';

    const actRows = recent.length ? recent.map(f => `<tr>
      <td>${esc(f.action)}</td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.title)}">${esc(f.title)}</td>
      <td class="tabular">${f.qty}</td><td class="tabular">${f.price}¢</td>
      <td class="tabular">${money(f.cost)}</td>
      <td>${Utils.timeAgo(f.timestamp)}</td></tr>`).join('')
      : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No activity yet</td></tr>';

    Modal.show('Portfolio — ' + esc(u.username || u.name), `
      <div class="portfolio-modal">
        <div class="portfolio-summary">
          <div class="portfolio-stat"><span class="portfolio-stat-label">Balance</span><span class="portfolio-stat-value">${money(acct.balance || 0)}</span></div>
          <div class="portfolio-stat"><span class="portfolio-stat-label">Portfolio</span><span class="portfolio-stat-value">${money(acct.portfolioValue || 0)}</span></div>
          <div class="portfolio-stat"><span class="portfolio-stat-label">All-time P&L</span><span class="portfolio-stat-value">${money(acct.allTimePnl || 0)}</span></div>
          <div class="portfolio-stat"><span class="portfolio-stat-label">Win rate</span><span class="portfolio-stat-value">${acct.winRate || 0}%</span></div>
        </div>
        <div class="portfolio-section-title">Open positions (${positions.length})</div>
        <div class="portfolio-table-wrap">
          <table class="dash-tbl"><thead><tr><th>Market</th><th>Side</th><th>Qty</th><th>Avg</th><th>Current</th><th>P&L</th></tr></thead>
          <tbody>${posRows}</tbody></table>
        </div>
        <div class="portfolio-section-title">Recent activity${activity.length > 10 ? ' (last 10)' : ''}</div>
        <div class="portfolio-table-wrap">
          <table class="dash-tbl"><thead><tr><th>Action</th><th>Market</th><th>Qty</th><th>Price</th><th>Cost</th><th>When</th></tr></thead>
          <tbody>${actRows}</tbody></table>
        </div>
      </div>
    `, () => {}, 'Close');
  }

  return { show };
})();
