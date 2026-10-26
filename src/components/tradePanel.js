/**
 * components/tradePanel.js — buy YES/NO ticket (amount-based).
 *
 * The user names an amount to spend. Commission (the user's per-account rate) is
 * taken from it; the remainder buys whole contracts at the exact Kalshi price.
 * All booking is server-side (Api.orders.place); this only gathers input, previews
 * the result, and shows the fill.
 */
const TradePanel = (() => {
  let market = null;
  let side = 'YES';

  function _rate() { const s = Store.get().session; return Number(s && s.commission_rate) || 0; }

  function render(m) {
    market = m; side = 'YES';
    const rate = _rate();
    return `
      <div class="trade-panel" id="trade-panel">
        <div class="tab-group" id="side-tabs" style="margin-bottom:16px">
          <button class="tab-item active" id="tab-yes" onclick="TradePanel.setSide('YES')">Buy YES</button>
          <button class="tab-item" id="tab-no" onclick="TradePanel.setSide('NO')">Buy NO</button>
        </div>

        <div class="trade-outcome-row" id="trade-outcome-row">
          <i class="ti ti-circle-check" style="color:var(--text-success);flex-shrink:0"></i>
          <span id="outcome-text" class="fs-12 text-secondary">Pays $1.00 per contract if outcome is <strong>YES</strong></span>
        </div>

        <div style="margin-bottom:14px">
          <label class="form-label">Amount to spend ($)</label>
          <div class="price-quick-btns">
            <button class="price-quick-btn" onclick="TradePanel.setAmount(10)">$10</button>
            <button class="price-quick-btn" onclick="TradePanel.setAmount(25)">$25</button>
            <button class="price-quick-btn" onclick="TradePanel.setAmount(50)">$50</button>
            <button class="price-quick-btn" onclick="TradePanel.setAmount(100)">$100</button>
          </div>
          <input class="form-input" type="number" id="amount-input" min="1" step="1" value="25"
            oninput="TradePanel.updateSummary()" aria-label="Amount to spend in dollars" />
        </div>

        <div class="trade-summary-box" id="trade-summary"></div>

        <div class="trade-balance-row" id="trade-balance-row">
          <span class="text-secondary fs-12">Available</span>
          <span class="fs-12 fw-500">${Utils.money(Store.get().account.balance)}</span>
        </div>

        <button class="btn-success" id="trade-submit-btn" onclick="TradePanel.submit()">
          <i class="ti ti-check" aria-hidden="true"></i> Buy YES
        </button>
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted);text-align:center">
          Fills at the market price${rate ? ` · ${rate}% commission` : ' · no commission'}
        </div>
      </div>`;
  }

  function init(m) { market = m; side = 'YES'; _syncSide(); setTimeout(updateSummary, 0); }
  function setSide(s) { side = s; _syncSide(); updateSummary(); }
  function setAmount(a) { const i = document.getElementById('amount-input'); if (i) { i.value = a; updateSummary(); } }

  function _preview() {
    const amount = parseFloat(document.getElementById('amount-input')?.value) || 0;
    const mid = Utils.clamp(side === 'YES' ? market.yes_price : market.no_price, 1, 99);
    const rate = _rate();
    const commission = +(amount * rate / 100).toFixed(2);
    const buyingPower = +(amount - commission).toFixed(2);
    const qty = Math.floor(buyingPower * 100 / mid);
    const cost = +(qty * mid / 100).toFixed(2);
    return { amount, mid, rate, commission, qty, cost, maxPayout: qty, maxProfit: +(qty - cost).toFixed(2) };
  }

  function updateSummary() {
    const box = document.getElementById('trade-summary');
    if (!box || !market) return;
    const p = _preview();
    box.innerHTML = `
      <div class="trade-summary-row"><span class="text-secondary">Contracts</span><span class="fw-500">${p.qty} @ ${p.mid}¢</span></div>
      <div class="trade-summary-row"><span class="text-secondary">Commission${p.rate ? ' (' + p.rate + '%)' : ''}</span><span>${Utils.money(p.commission)}</span></div>
      <div class="trade-summary-row"><span class="text-secondary">Contract cost</span><span>${Utils.money(p.cost)}</span></div>
      <div class="trade-summary-row"><span class="text-secondary">Max payout</span><span>${Utils.money(p.maxPayout)}</span></div>
      <div class="trade-summary-row"><span class="text-secondary">Max profit</span><span class="text-success fw-500">+${Utils.money(p.maxProfit)}</span></div>`;
  }

  async function submit() {
    if (!market) return;
    const amount = parseFloat(document.getElementById('amount-input')?.value);
    if (!Number.isFinite(amount) || amount <= 0) { Toast.show('Enter an amount to spend.', 'error'); return; }
    const btn = document.getElementById('trade-submit-btn');
    let prev;
    if (btn) { prev = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> Placing order…'; }
    try {
      const res = await Api.orders.place({ ticker: market.ticker, side, amount });
      Navbar.patchBalance();
      if (typeof DetailView !== 'undefined' && DetailView.afterTrade) DetailView.afterTrade();
      Toast.show(`✓ Bought ${res.filledQty} ${side} @ ${res.avgPrice}¢ — spent ${Utils.money(res.spent)}${res.commission ? ` (incl. ${Utils.money(res.commission)} commission)` : ''}`, 'success');
      updateSummary();
    } catch (e) {
      // Market rotated out of the live set between load and order → refresh + guide home.
      if (e && (e.status === 404 || /market not found/i.test(e.message || ''))) {
        Toast.show('This market is no longer available — refreshing the list.', 'default');
        try { await Api.markets.refresh(); } catch (_) {}
        Router.navigate('home');
      } else {
        Toast.show(e.message, 'error');
      }
    } finally {
      if (btn) { btn.disabled = false; if (prev != null) btn.innerHTML = prev; }
    }
  }

  function _syncSide() {
    const yesTab = document.getElementById('tab-yes'), noTab = document.getElementById('tab-no');
    const btn = document.getElementById('trade-submit-btn'), out = document.getElementById('outcome-text');
    if (!yesTab) return;
    const isYes = side === 'YES';
    yesTab.classList.toggle('active', isYes);
    noTab.classList.toggle('active', !isYes);
    if (btn) { btn.className = isYes ? 'btn-success' : 'btn-danger'; btn.innerHTML = `<i class="ti ti-check"></i> Buy ${side}`; }
    if (out) out.innerHTML = `Pays $1.00 per contract if outcome is <strong>${side}</strong>`;
  }

  return { render, init, setSide, setAmount, updateSummary, submit };
})();
