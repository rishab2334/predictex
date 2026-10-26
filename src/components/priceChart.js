/**
 * components/priceChart.js — interactive price history (Chart.js).
 * render(market) emits the chart shell; init(market) draws into the canvas.
 */
const PriceChart = (() => {
  let chart = null;
  let range = '1D';
  let market = null;
  const RANGE_POINTS = { '1D': 48, '1W': 84, '1M': 120 };

  function render(m) {
    market = m; range = '1D';
    return `
      <div class="chart-box">
        <div class="chart-header">
          <div>
            <div class="chart-price" id="chart-price">${m.yes_price}¢</div>
            <div style="font-size:13px;margin-top:2px" id="chart-change"
              class="${m.change_24h >= 0 ? 'text-success' : 'text-danger'}">
              ${m.change_24h >= 0 ? '+' : ''}${m.change_24h}% today
            </div>
          </div>
          <div style="display:flex;gap:4px">
            ${['1D','1W','1M'].map(r => `
              <button class="btn btn-ghost btn-sm ${r === range ? 'active' : ''}" id="range-${r}"
                onclick="PriceChart.setRange('${r}')"
                style="${r === range ? 'background:var(--surface-1);color:var(--text-primary)' : ''}">${r}</button>
            `).join('')}
          </div>
        </div>
        <div class="chart-canvas-wrap"><canvas id="market-price-chart"></canvas></div>
      </div>`;
  }

  function init(m) { market = m; _draw(); }

  function setRange(r) {
    range = r;
    ['1D','1W','1M'].forEach(x => {
      const btn = document.getElementById('range-' + x);
      if (!btn) return;
      btn.style.background = x === r ? 'var(--surface-1)' : '';
      btn.style.color      = x === r ? 'var(--text-primary)' : '';
    });
    _draw();
  }

  function _draw() {
    const canvas = document.getElementById('market-price-chart');
    if (!canvas || !market || typeof Chart === 'undefined') return;
    if (chart) { chart.destroy(); chart = null; }

    const pts    = RANGE_POINTS[range] || 48;
    const price  = market.yes_price;
    const data   = generatePriceHistory(price, pts, range === '1D' ? 2.5 : 4);
    const labels = _labels(pts, range);
    const isUp   = data[data.length - 1] >= data[0];

    chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: [{
        data,
        borderColor: isUp ? '#00b877' : '#ef4d55',
        borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, fill: true,
        backgroundColor: isUp ? 'rgba(0,184,119,0.09)' : 'rgba(239,77,85,0.09)',
        tension: 0.35,
      }]},
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y.toFixed(1)}¢  (${ctx.parsed.y.toFixed(0)}% implied)` } },
        },
        scales: {
          x: { display: true, grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 11 }, color: '#8b95a1' } },
          y: {
            display: true, min: Math.max(1, price - 22), max: Math.min(99, price + 22),
            ticks: { callback: v => v + '¢', font: { size: 11 }, color: '#8b95a1', maxTicksLimit: 5 },
            grid: { color: 'rgba(128,128,128,0.10)' },
          },
        },
      },
    });
  }

  function _labels(pts, r) {
    const now = Date.now();
    return Array.from({ length: pts }, (_, i) => {
      let ms;
      if (r === '1D')      ms = now - (pts - 1 - i) * 30 * 60 * 1000;
      else if (r === '1W') ms = now - (pts - 1 - i) * 2 * 3600 * 1000;
      else                 ms = now - (pts - 1 - i) * 6 * 3600 * 1000;
      const d = new Date(ms);
      if (r === '1D') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
  }

  return { render, init, setRange };
})();
