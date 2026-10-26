/**
 * components/orderBook.js — YES/NO bid depth.
 * Mirrors Kalshi's bids-only book (a YES bid at 40¢ ≡ a NO ask at 60¢).
 */
const OrderBook = (() => {
  function _rows(bids, side) {
    const maxQty = Math.max(...bids.map(b => b.qty), 1);
    return bids.map(bid => {
      const width = ((bid.qty / maxQty) * 100).toFixed(1);
      const cls   = side === 'yes' ? 'text-success' : 'text-danger';
      const bg    = side === 'yes' ? 'var(--fill-success)' : 'var(--fill-danger)';
      return `
        <div class="ob-row ${cls}">
          <span>${bid.price}¢</span>
          <span>${bid.qty.toLocaleString()}</span>
          <span>$${bid.total.toFixed(0)}</span>
          <div class="ob-bg" style="width:${width}%;background:${bg}"></div>
        </div>`;
    }).join('');
  }

  function render(book) {
    const spread = (book.bestBid != null && book.bestAsk != null) ? (book.bestAsk - book.bestBid) : null;
    return `
      <div class="orderbook-section">
        <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px">
          <span style="font-size:13px;font-weight:500">Order book</span>
          ${book.last != null ? `<span class="fs-12 text-muted">Mid <span class="fw-500" style="color:var(--text-primary)">${book.last}¢</span>${spread != null ? ` · Spread ${spread}¢` : ''}</span>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;font-size:11px;color:var(--text-muted);padding:0 4px;margin-bottom:4px">
          <span>Price</span><span>Contracts</span><span>Total ($)</span>
        </div>
        <div style="font-size:11px;color:var(--text-success);padding:0 4px;margin-bottom:4px;font-weight:500">YES bids</div>
        ${_rows(book.yes, 'yes')}
        <div class="divider"></div>
        <div style="font-size:11px;color:var(--text-danger);padding:0 4px;margin-bottom:4px;font-weight:500">NO bids</div>
        ${_rows(book.no, 'no')}
      </div>`;
  }

  return { render };
})();
