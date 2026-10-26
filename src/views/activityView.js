/**
 * views/activityView.js — trade history (fills) with summary + filter tabs.
 * The active filter lives in Store.ui so renderMain() preserves it.
 */
const ActivityView = (() => {
  const FILTERS = [
    { id: 'all',     label: 'All trades' },
    { id: 'buy',     label: 'Buys' },
    { id: 'sell',    label: 'Sells' },
    { id: 'winning', label: 'Profitable' },
  ];

  function render(state) {
    const activity = state.activity;
    const filter   = state.ui.activityFilter || 'all';
    const totalPnl  = activity.reduce((s, a) => s + a.pnl, 0);
    const totalCost = activity.reduce((s, a) => s + Math.abs(a.cost), 0);
    const wins      = activity.filter(a => a.pnl > 0).length;
    const winRate   = activity.length ? Math.round(wins / activity.length * 100) : 0;

    let items = activity;
    if (filter === 'buy')     items = activity.filter(a => a.action.startsWith('Buy'));
    if (filter === 'sell')    items = activity.filter(a => a.action.startsWith('Sell'));
    if (filter === 'winning') items = activity.filter(a => a.pnl > 0);

    return `
      <div class="page-body">
        <div style="margin-bottom:24px">
          <h1 style="font-size:20px;font-weight:500;margin-bottom:4px">Trade history</h1>
          <p class="text-secondary fs-13">Your recent executions and fills</p>
        </div>

        <div class="activity-summary">
          <div class="metric-card">
            <div class="metric-label">Total deployed</div>
            <div class="metric-value">${Utils.money(totalCost)}</div>
            <div class="metric-sub">${activity.length} trades</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Net P&amp;L</div>
            <div class="metric-value ${totalPnl >= 0 ? 'text-success' : 'text-danger'}">${totalPnl >= 0 ? '+' : ''}${Utils.money(Math.abs(totalPnl))}</div>
            <div class="metric-sub">${wins} winning trades</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Win rate</div>
            <div class="metric-value">${winRate}%</div>
            <div class="metric-sub">${wins} of ${activity.length} filled</div>
          </div>
        </div>

        <div class="tab-group activity-tabs" style="margin-bottom:20px;width:fit-content">
          ${FILTERS.map(f => `<button class="tab-item ${filter === f.id ? 'active' : ''}" onclick="ActivityView.setFilter('${f.id}')">${f.label}</button>`).join('')}
        </div>

        <div class="data-table">
          <div class="activity-row activity-header">
            <span>Action</span><span>Market</span><span>Price</span><span>Qty</span><span>Cost</span><span>Time</span><span>P&amp;L</span>
          </div>
          ${items.length === 0 ? `
            <div style="padding:32px;text-align:center;color:var(--text-muted)">No trades match this filter.</div>
          ` : items.map((item, i) => {
            const a = item.action || '';
            const color = (a === 'Buy YES' || a.startsWith('Won'))  ? 'var(--text-success)'
                        : (a === 'Buy NO'  || a.startsWith('Lost')) ? 'var(--text-danger)'
                        : 'var(--text-secondary)';
            const cls   = item.pnl >= 0 ? 'text-success' : 'text-danger';
            const pnl   = (item.pnl >= 0 ? '+$' : '-$') + Math.abs(item.pnl).toFixed(2);
            const cost  = item.cost < 0 ? '+$' + Math.abs(item.cost).toFixed(2) : '$' + item.cost.toFixed(2);
            const t     = Utils.escapeHtml(item.ticker);
            return `
              <div class="activity-row ${i === items.length - 1 ? 'activity-row-last' : ''}" style="cursor:pointer" onclick="App.navigate('detail','${t}')">
                <span style="font-weight:500;color:${color}">${Utils.escapeHtml(item.action)}</span>
                <span><div class="fw-500 fs-13">${Utils.escapeHtml(item.title)}</div><div class="fs-11 text-muted">${t}</div></span>
                <span>${item.price}¢</span>
                <span>${item.qty}</span>
                <span class="${item.cost < 0 ? 'text-success' : 'text-secondary'}">${cost}</span>
                <span class="text-muted fs-12">${Utils.timeAgo(item.timestamp)}</span>
                <span class="${cls} fw-500">${pnl}</span>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function setFilter(id) { Store.setUI({ activityFilter: id }); Router.renderMain(); }

  return { render, setFilter };
})();
