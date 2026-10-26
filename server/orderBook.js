/**
 * orderBook.js — server-side matching engine (the trusted authority for fills).
 *
 * Mirrors the client engine (src/services/orderBookService.js) but runs on the
 * server, so the client can never dictate its own fill price. Each market has an
 * in-memory book seeded with synthetic market-maker liquidity anchored to the
 * CURRENT KALSHI PRICE (from the DB markets table, kept fresh by the ingester).
 *
 * IMPORTANT — the market price is ALWAYS Kalshi's. An order (YES or NO), of any
 * size, fills against resting liquidity with realistic spread/slippage but NEVER
 * moves the market price. After a trade the book simply re-seeds around the
 * Kalshi anchor; when Kalshi's price moves, the book re-anchors to it. No user's
 * order is a price-discovery event.
 *
 * Everything is normalized to the YES contract: buy NO = sell YES at (100 − q).
 * Books are in-memory only — there are no resting user orders to persist (a
 * non-marketable limit is rejected), so a book is deterministically re-seedable
 * from the market's Kalshi price at any time.
 */
const LEVELS = 6;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const _books = new Map(); // ticker -> { bids, asks, seq, anchor }

function _size(level) { return Math.max(1, Math.round((80 + level * 45) * (0.6 + Math.random() * 0.9))); }

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
  book.bids.sort((a, b) => b.price - a.price || a.seq - b.seq);
  book.asks.sort((a, b) => a.price - b.price || a.seq - b.seq);
}

// Get (or lazily create) a book, always anchored to the current Kalshi price.
// Re-seeds only when the anchor actually changes, so display is stable between moves.
function _book(ticker, anchorPrice) {
  const anchor = clamp(Math.round(anchorPrice || 50), 2, 98);
  let book = _books.get(ticker);
  if (!book) {
    book = { bids: [], asks: [], seq: 1, anchor };
    _books.set(ticker, book);
    _seedMM(book, anchor);
  } else if (book.anchor !== anchor) {
    book.anchor = anchor;
    _seedMM(book, anchor); // Kalshi price moved → re-anchor liquidity
  }
  return book;
}

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

function _clone(book) { return { bids: book.bids.map(o => ({ ...o })), asks: book.asks.map(o => ({ ...o })), seq: book.seq, anchor: book.anchor }; }

function _yesLimit(side, type, price) {
  if (side === 'YES') return { isBuy: true,  limitYes: type === 'market' ? 99 : clamp(Math.round(price), 1, 99) };
  return { isBuy: false, limitYes: type === 'market' ? 1 : clamp(100 - Math.round(price), 1, 99) };
}

function _summarize(side, fills) {
  const uf = fills.map(f => ({ price: side === 'YES' ? f.price : 100 - f.price, qty: f.qty }));
  const filled = uf.reduce((s, f) => s + f.qty, 0);
  const notional = uf.reduce((s, f) => s + f.price * f.qty, 0);
  return { fills: uf, filled, cost: +(notional / 100).toFixed(2), avgPrice: filled ? Math.round(notional / filled) : 0 };
}

/** Dry-run: what would this order fill and cost? (no mutation) */
function preview(ticker, anchorPrice, side, type, price, qty) {
  const { isBuy, limitYes } = _yesLimit(side, type, price);
  const { fills } = _match(_clone(_book(ticker, anchorPrice)), isBuy, limitYes, qty);
  return _summarize(side, fills);
}

/** Execute for real: consume liquidity, then replenish MM around the KALSHI price
 *  (never around a "last trade" — orders don't move the price). */
function execute(ticker, anchorPrice, side, type, price, qty) {
  const book = _book(ticker, anchorPrice);
  const { isBuy, limitYes } = _yesLimit(side, type, price);
  const { fills, filled } = _match(book, isBuy, limitYes, qty);
  if (filled > 0) _seedMM(book, clamp(Math.round(anchorPrice || 50), 2, 98));
  return _summarize(side, fills);
}

/** Display snapshot: YES bids + NO bids, with the Kalshi price as the mid. */
function snapshot(ticker, anchorPrice) {
  const book = _book(ticker, anchorPrice);
  const agg = (orders) => { const m = {}; orders.forEach(o => { m[o.price] = (m[o.price] || 0) + o.qty; }); return Object.keys(m).map(p => ({ price: +p, qty: m[p] })); };
  const yes = agg(book.bids).sort((a, b) => b.price - a.price).slice(0, LEVELS).map(l => ({ price: l.price, qty: l.qty, total: +(l.price * l.qty / 100).toFixed(2) }));
  const no  = agg(book.asks).sort((a, b) => a.price - b.price).slice(0, LEVELS).map(l => ({ price: 100 - l.price, qty: l.qty, total: +((100 - l.price) * l.qty / 100).toFixed(2) }));
  return { yes, no, last: book.anchor, bestBid: book.bids[0] ? book.bids[0].price : null, bestAsk: book.asks[0] ? book.asks[0].price : null };
}

module.exports = { preview, execute, snapshot };
