/**
 * services/tradeService.js — order placement domain logic.
 *
 * The one place a trade is booked. Validates the order, merges it into an open
 * position (weighted-average price) or opens a new one, appends a fill to the
 * activity log, and adjusts cash + portfolio value — all against the Store,
 * which persists the result so trades survive a refresh. Returns a typed result
 * { ok, error?, fill? }; the UI decides how to surface it (toast, repaint).
 */
const TradeService = (() => {
  /**
   * Route an order through the order book. Matches against resting liquidity
   * (real fills at real levels — a large order walks the book), books the filled
   * quantity at the volume-weighted average fill price, and reports partial fills.
   *
   * @param {object} order { ticker, side:'YES'|'NO', type:'limit'|'market', price, qty }
   * @returns {{ok:boolean, error?:string, fill?:object, requestedQty?:number, filledQty?:number, avgPrice?:number}}
   */
  function placeOrder(order) {
    const market = MarketService.byTicker(order.ticker);
    if (!market) return { ok: false, error: 'Market not found.' };

    const side = order.side === 'NO' ? 'NO' : 'YES';
    const qty  = parseInt(order.qty, 10);
    if (!Number.isFinite(qty) || qty < 1) return { ok: false, error: 'Enter at least 1 contract.' };
    if (order.type !== 'market') {
      const p = Math.round(Number(order.price));
      if (!Number.isFinite(p) || p < 1 || p > 99) return { ok: false, error: 'Enter a valid price between 1–99¢.' };
    }

    // Dry-run against the book to check liquidity + cost before committing.
    const plan = OrderBookService.preview(order.ticker, side, order.type, order.price, qty);
    if (plan.filled === 0) {
      return { ok: false, error: order.type === 'market' ? 'No liquidity available right now.' : 'That limit price won’t fill right now. Buys fill at the ask (just above the market price) — raise your price, or switch to a market order.' };
    }
    if (plan.cost > Store.get().account.balance) {
      return { ok: false, error: 'Insufficient balance for this fill (' + Utils.money(plan.cost) + '). Deposit more funds.' };
    }

    // Execute for real — consumes liquidity, moves the price, replenishes the book.
    const exec = OrderBookService.execute(order.ticker, side, order.type, order.price, qty);
    const price = exec.avgPrice, filledQty = exec.filled, cost = exec.cost;
    const m2 = MarketService.byTicker(order.ticker);
    const curPrice = side === 'YES' ? m2.yes_price : m2.no_price;

    let fill;
    Store.update(s => {
      s.account.balance        = parseFloat((s.account.balance - cost).toFixed(2));
      s.account.portfolioValue = parseFloat((s.account.portfolioValue + cost).toFixed(2));

      const existing = s.positions.find(p => p.ticker === market.ticker && p.side === side);
      if (existing) {
        const total = existing.quantity + filledQty;
        existing.avg_price     = Math.round((existing.avg_price * existing.quantity + price * filledQty) / total);
        existing.quantity      = total;
        existing.current_price = curPrice;
      } else {
        s.positions.push({
          ticker: market.ticker, title: market.title, series: market.series_ticker,
          side, avg_price: price, current_price: curPrice, quantity: filledQty,
        });
      }

      fill = {
        action: 'Buy ' + side, title: market.title, ticker: market.ticker,
        price, qty: filledQty, cost, timestamp: new Date().toISOString(),
        pnl: 0, status: filledQty < qty ? 'partial' : 'filled',
      };
      s.activity.unshift(fill);
    });

    markToMarket();
    return { ok: true, fill, requestedQty: qty, filledQty, avgPrice: price };
  }

  /**
   * Re-price open positions against the latest market data. A position keeps its
   * booked avg_price (entry) and its current_price is refreshed from the newest
   * price read for that ticker, so P&L = latest price − booked price. Positions
   * whose market isn't in the current feed (e.g. seed-only tickers) keep their
   * last known price. Returns true if any price changed.
   */
  function markToMarket() {
    let changed = false;
    Store.update(s => {
      s.positions.forEach(p => {
        const m = MarketService.byTicker(p.ticker);
        if (!m) return;
        const latest = p.side === 'YES' ? m.yes_price : m.no_price;
        if (latest !== p.current_price) { p.current_price = latest; changed = true; }
      });
    });
    return changed;
  }

  /** Add funds to the account balance. */
  function deposit(amount) {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt < 1) return { ok: false, error: 'Please enter a valid deposit amount.' };
    Store.update(s => { s.account.balance = parseFloat((s.account.balance + amt).toFixed(2)); });
    return { ok: true, amount: amt };
  }

  return { placeOrder, deposit, markToMarket };
})();
