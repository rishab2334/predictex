/**
 * services/orderBookService.js — an in-browser limit order book + matching engine.
 *
 * Each market gets its own book, created lazily and seeded with synthetic
 * market-maker (MM) liquidity anchored to the market's current price. Orders
 * match against resting liquidity by PRICE-TIME PRIORITY, producing real fills
 * with price impact; the last trade price becomes the market's price (discovery).
 *
 * Everything is normalized to the YES contract:
 *   - Buy YES @ p   → a bid at p on the YES book (or a market order lifting asks)
 *   - Buy NO  @ q   → sell YES @ (100−q) → an ask on the YES book (or a market
 *                     order hitting bids). YES+NO always sum to 100.
 * The display converts the ask side back to "NO bids" (NO price = 100 − ask).
 *
 * The market price is ALWAYS Kalshi's — a book order (YES or NO) fills against
 * resting liquidity but never moves the displayed price. The book stays anchored
 * to the current Kalshi price: it re-seeds around it after each trade and on
 * every live refresh (see reconcile()). Fills still carry realistic spread and
 * within-order slippage; the reference price just doesn't drift.
 */
const OrderBookService = (() => {
  const LEVELS = 6; // MM depth per side

  const _books = {}; // ticker -> { bids, asks, last, seq, traded }

  // ── Market-maker seeding ──────────────────────────────────────────────────
  function _size(level) {
    return Math.max(1, Math.round((80 + level * 45) * (0.6 + Math.random() * 0.9)));
  }

  function _seedMM(book, anchor) {
    book.bids = book.bids.filter(o => o.maker !== 'mm');
    book.asks = book.asks.filter(o => o.maker !== 'mm');
    for (let i = 1; i <= LEVELS; i++) {
      const bid = anchor - i, ask = anchor + i;
      if (bid >= 1)  book.bids.push({ price: bid, qty: _size(i), maker: 'mm', seq: book.seq++ });
      if (ask <= 99) book.asks.push({ price: ask, qty: _size(i), maker: 'mm', seq: book.seq++ });
    }
    _sort(book);
  }

  function _sort(book) {
    book.bids.sort((a, b) => b.price - a.price || a.seq - b.seq); // best (highest) bid first
    book.asks.sort((a, b) => a.price - b.price || a.seq - b.seq); // best (lowest) ask first
  }

  function get(ticker) {
    if (!_books[ticker]) {
      const m = MarketService.byTicker(ticker);
      const anchor = Utils.clamp(m ? m.yes_price : 50, 2, 98);
      const book = { bids: [], asks: [], last: anchor, seq: 1 };
      _seedMM(book, anchor);
      _books[ticker] = book;
    }
    return _books[ticker];
  }

  function has(ticker) { return !!_books[ticker]; }

  // ── Display snapshot (YES bids + NO bids, aggregated by price) ─────────────
  function snapshot(ticker) {
    const book = get(ticker);
    const agg = (orders) => {
      const map = {};
      orders.forEach(o => { map[o.price] = (map[o.price] || 0) + o.qty; });
      return Object.keys(map).map(p => ({ price: +p, qty: map[p] }));
    };
    const yes = agg(book.bids).sort((a, b) => b.price - a.price).slice(0, LEVELS)
      .map(l => ({ price: l.price, qty: l.qty, total: +(l.price * l.qty / 100).toFixed(2) }));
    const no = agg(book.asks).sort((a, b) => a.price - b.price).slice(0, LEVELS)
      .map(l => ({ price: 100 - l.price, qty: l.qty, total: +((100 - l.price) * l.qty / 100).toFixed(2) }));
    return {
      yes, no, last: book.last,
      bestBid: book.bids[0] ? book.bids[0].price : null,
      bestAsk: book.asks[0] ? book.asks[0].price : null,
    };
  }

  // ── Matching core (mutates the given book) ────────────────────────────────
  // isBuy true = buy YES (consume asks); false = sell YES (consume bids).
  function _match(book, isBuy, limitYes, qty) {
    const fills = [];
    let remaining = qty;
    const levels = isBuy ? book.asks : book.bids;
    while (remaining > 0 && levels.length) {
      const lvl = levels[0];
      const crosses = isBuy ? lvl.price <= limitYes : lvl.price >= limitYes;
      if (!crosses) break;
      const take = Math.min(remaining, lvl.qty);
      fills.push({ price: lvl.price, qty: take });
      lvl.qty -= take;
      remaining -= take;
      if (lvl.qty <= 0) levels.shift();
    }
    return { fills, filled: qty - remaining };
  }

  function _clone(book) {
    return { bids: book.bids.map(o => ({ ...o })), asks: book.asks.map(o => ({ ...o })), last: book.last, seq: book.seq };
  }

  // Translate a user's order into YES-book terms.
  function _yesLimit(side, type, price) {
    if (side === 'YES') return { isBuy: true,  limitYes: type === 'market' ? 99 : Utils.clamp(Math.round(price), 1, 99) };
    return { isBuy: false, limitYes: type === 'market' ? 1 : Utils.clamp(100 - Math.round(price), 1, 99) };
  }

  // Convert YES-price fills back to the price of the side the user traded.
  function _summarize(side, fills) {
    const userFills = fills.map(f => ({ price: side === 'YES' ? f.price : 100 - f.price, qty: f.qty }));
    const filled = userFills.reduce((s, f) => s + f.qty, 0);
    const notional = userFills.reduce((s, f) => s + f.price * f.qty, 0);
    return { fills: userFills, filled, cost: +(notional / 100).toFixed(2), avgPrice: filled ? Math.round(notional / filled) : 0 };
  }

  /** Dry-run: what would this order fill and cost? (no mutation) */
  function preview(ticker, side, type, price, qty) {
    const { isBuy, limitYes } = _yesLimit(side, type, price);
    const { fills } = _match(_clone(get(ticker)), isBuy, limitYes, qty);
    return _summarize(side, fills);
  }

  /**
   * Execute for real: consume liquidity and produce fills (with realistic
   * spread/slippage within the order), then replenish the book around the
   * CURRENT KALSHI PRICE. The market price is always Kalshi's — a book trade
   * never moves it.
   */
  function execute(ticker, side, type, price, qty) {
    const book = get(ticker);
    const { isBuy, limitYes } = _yesLimit(side, type, price);
    const { fills, filled } = _match(book, isBuy, limitYes, qty);
    if (filled > 0) {
      const m = MarketService.byTicker(ticker);
      const anchor = Utils.clamp(m ? m.yes_price : book.last, 2, 98);
      book.last = anchor;      // reference = Kalshi price, not last trade
      _seedMM(book, anchor);   // replenish depth around the Kalshi price
    }
    return _summarize(side, fills);
  }

  /** On a live Kalshi refresh: re-anchor every book's MM to the fresh Kalshi
   *  price. The market price itself comes straight from Kalshi (not touched here). */
  function reconcile(markets) {
    markets.forEach(m => {
      const b = _books[m.ticker];
      if (!b) return;
      b.last = Utils.clamp(m.yes_price, 2, 98);
      _seedMM(b, b.last);
    });
  }

  return { get, has, snapshot, preview, execute, reconcile };
})();
