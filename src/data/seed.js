/**
 * data/seed.js — built-in demo data.
 *
 * SEED_MARKETS is the offline fallback shown when the Kalshi proxy is
 * unreachable. SEED_POSITIONS / SEED_ACTIVITY seed a returning demo account so
 * the Portfolio and Activity screens are never empty. The price-history and
 * order-book generators produce plausible chart/depth data on demand.
 *
 * Domain shapes (single source of truth for field names):
 *   Market   { ticker, series_ticker, category, title, subtitle, description,
 *              yes_price, no_price, volume, open_interest, close_time,
 *              status, change_24h, liquidity }
 *   Position { ticker, title, series, side, avg_price, current_price, quantity }
 *   Fill     { action, title, ticker, price, qty, cost, timestamp, pnl, status }
 */

const SEED_MARKETS = [
  // ── POLITICS ──────────────────────────────────────────────────────────────
  {
    id: 1,
    ticker: 'KXELEX-26NOV-DEM',
    series_ticker: 'KXELEX',
    event_ticker: 'KXELEX-26NOV',
    category: 'Politics',
    title: 'Will Democrats win the Senate majority in November 2026?',
    subtitle: '2026 US midterm elections',
    description: 'Resolves YES if the Democratic Party controls 50 or more seats in the US Senate following the November 2026 midterm elections. Resolves based on certified results from the Secretary of State in each state.',
    yes_price: 62,
    no_price: 38,
    volume: 892000,
    open_interest: 145000,
    close_time: '2026-11-03T23:59:00Z',
    status: 'open',
    change_24h: +3.2,
    liquidity: 'high',
  },
  {
    id: 6,
    ticker: 'KXWORLD-26UN-CEASEFIRE',
    series_ticker: 'KXWORLD',
    event_ticker: 'KXWORLD-26UN',
    category: 'Politics',
    title: 'Will the UN Security Council pass a ceasefire resolution in 2026?',
    subtitle: 'United Nations Security Council vote',
    description: 'Resolves YES if the United Nations Security Council passes a formal ceasefire resolution before December 31, 2026. A presidential statement does not count — a binding Chapter VII or Chapter VI resolution is required.',
    yes_price: 19,
    no_price: 81,
    volume: 310000,
    open_interest: 52000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: -4.2,
    liquidity: 'medium',
  },
  {
    id: 9,
    ticker: 'KXUKPM-26-CHANGE',
    series_ticker: 'KXUKPM',
    event_ticker: 'KXUKPM-26',
    category: 'Politics',
    title: 'Will there be a new UK Prime Minister before January 2027?',
    subtitle: 'UK political leadership',
    description: 'Resolves YES if a person other than the current Prime Minister is appointed to that office by the King before January 1, 2027. Resolves based on official UK government records.',
    yes_price: 31,
    no_price: 69,
    volume: 185000,
    open_interest: 28000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: +1.5,
    liquidity: 'medium',
  },
  {
    id: 10,
    ticker: 'KXEUAI-26-REG',
    series_ticker: 'KXEUAI',
    event_ticker: 'KXEUAI-26',
    category: 'Politics',
    title: 'Will the EU AI Act be fully in force across all member states by end of 2026?',
    subtitle: 'EU AI Act full implementation',
    description: 'Resolves YES if all provisions of the EU AI Act are in full legal force and binding across all EU member states before December 31, 2026. Based on the Official Journal of the EU.',
    yes_price: 74,
    no_price: 26,
    volume: 420000,
    open_interest: 67000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: +0.8,
    liquidity: 'medium',
  },

  // ── ECONOMICS ─────────────────────────────────────────────────────────────
  {
    id: 2,
    ticker: 'KXFED-26SEP-HOLD',
    series_ticker: 'KXFED',
    event_ticker: 'KXFED-26SEP',
    category: 'Economics',
    title: 'Will the Fed hold rates at the September 2026 FOMC meeting?',
    subtitle: 'Federal Reserve interest rate decision',
    description: 'Resolves YES if the Federal Open Market Committee votes to maintain the federal funds rate target range unchanged at the September 16–17, 2026 meeting. Resolves based on the official FOMC statement.',
    yes_price: 44,
    no_price: 56,
    volume: 1240000,
    open_interest: 320000,
    close_time: '2026-09-17T18:00:00Z',
    status: 'open',
    change_24h: -1.8,
    liquidity: 'high',
  },
  {
    id: 5,
    ticker: 'KXSPX-26DEC-5500',
    series_ticker: 'KXSPX',
    event_ticker: 'KXSPX-26DEC',
    category: 'Economics',
    title: 'Will the S&P 500 close above 5,500 on December 31, 2026?',
    subtitle: 'S&P 500 year-end price level',
    description: 'Resolves YES if the S&P 500 Index (SPX) closing price on December 31, 2026 is strictly greater than 5,500.00. Resolves based on the official closing price published by S&P Dow Jones Indices.',
    yes_price: 71,
    no_price: 29,
    volume: 2100000,
    open_interest: 480000,
    close_time: '2026-12-31T16:00:00Z',
    status: 'open',
    change_24h: +2.4,
    liquidity: 'high',
  },
  {
    id: 11,
    ticker: 'KXAAPL-26DEC-250',
    series_ticker: 'KXAAPL',
    event_ticker: 'KXAAPL-26DEC',
    category: 'Economics',
    title: 'Will Apple (AAPL) stock exceed $250 by December 31, 2026?',
    subtitle: 'Apple Inc. stock price target',
    description: 'Resolves YES if the closing price of Apple Inc. (AAPL) on any trading day on or before December 31, 2026 is strictly greater than $250.00. Resolves based on Nasdaq official closing prices.',
    yes_price: 58,
    no_price: 42,
    volume: 780000,
    open_interest: 125000,
    close_time: '2026-12-31T16:00:00Z',
    status: 'open',
    change_24h: +4.1,
    liquidity: 'high',
  },
  {
    id: 12,
    ticker: 'KXFED-26-FIRSTCUT',
    series_ticker: 'KXFED',
    event_ticker: 'KXFED-26-FIRSTCUT',
    category: 'Economics',
    title: 'Will the Fed cut interest rates before September 2026?',
    subtitle: 'Federal Reserve rate cut timeline',
    description: 'Resolves YES if the FOMC votes to lower the federal funds rate target range at any meeting before the September 2026 meeting (i.e., at January, March, May, or July 2026 meetings). Resolves based on official FOMC statements.',
    yes_price: 33,
    no_price: 67,
    volume: 960000,
    open_interest: 198000,
    close_time: '2026-09-01T00:00:00Z',
    status: 'open',
    change_24h: -2.3,
    liquidity: 'high',
  },
  {
    id: 13,
    ticker: 'KXUKREC-26Q3',
    series_ticker: 'KXUKREC',
    event_ticker: 'KXUKREC-26Q3',
    category: 'Economics',
    title: 'Will the UK economy record positive GDP growth in Q3 2026?',
    subtitle: 'UK quarterly GDP growth',
    description: 'Resolves YES if the UK Office for National Statistics (ONS) reports positive GDP growth (greater than 0.0%) for Q3 2026 (July–September) in its first estimate or later revision released by December 31, 2026.',
    yes_price: 67,
    no_price: 33,
    volume: 280000,
    open_interest: 41000,
    close_time: '2026-11-30T23:59:00Z',
    status: 'open',
    change_24h: +1.2,
    liquidity: 'medium',
  },
  {
    id: 20,
    ticker: 'KXELON-26-500B',
    series_ticker: 'KXELON',
    event_ticker: 'KXELON-26',
    category: 'Economics',
    title: "Will Elon Musk's net worth exceed $500 billion by end of 2026?",
    subtitle: 'Bloomberg Billionaires Index',
    description: "Resolves YES if the Bloomberg Billionaires Index lists Elon Musk's real-time net worth as greater than $500 billion on any day on or before December 31, 2026.",
    yes_price: 55,
    no_price: 45,
    volume: 680000,
    open_interest: 98000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: +3.5,
    liquidity: 'high',
  },

  // ── SPORTS ────────────────────────────────────────────────────────────────
  {
    id: 4,
    ticker: 'KXNFL-27SB-KC',
    series_ticker: 'KXNFL',
    event_ticker: 'KXNFL-27SB',
    category: 'Sports',
    title: 'Will the Kansas City Chiefs win Super Bowl LXI?',
    subtitle: '2027 NFL Championship',
    description: 'Resolves YES if the Kansas City Chiefs defeat their opponent in Super Bowl LXI, played on February 1, 2027. Resolves based on the official final score.',
    yes_price: 28,
    no_price: 72,
    volume: 520000,
    open_interest: 88000,
    close_time: '2027-02-01T23:59:00Z',
    status: 'open',
    change_24h: -0.5,
    liquidity: 'high',
  },
  {
    id: 8,
    ticker: 'KXNBA-26CHAMP-BOS',
    series_ticker: 'KXNBA',
    event_ticker: 'KXNBA-26CHAMP',
    category: 'Sports',
    title: 'Will the Boston Celtics win the 2026 NBA Championship?',
    subtitle: '2026 NBA Finals',
    description: 'Resolves YES if the Boston Celtics win the 2026 NBA Championship. Already settled.',
    yes_price: 34,
    no_price: 66,
    volume: 440000,
    open_interest: 72000,
    close_time: '2026-06-30T23:59:00Z',
    status: 'settled',
    change_24h: 0,
    liquidity: 'medium',
  },
  {
    id: 14,
    ticker: 'KXLBJ-26-RETIRE',
    series_ticker: 'KXLBJ',
    event_ticker: 'KXLBJ-26',
    category: 'Sports',
    title: 'Will LeBron James officially announce retirement in 2026?',
    subtitle: 'NBA retirement announcement',
    description: 'Resolves YES if LeBron James releases an official public statement announcing his retirement from professional basketball before January 1, 2027. Resolves based on official NBA or team announcements.',
    yes_price: 22,
    no_price: 78,
    volume: 340000,
    open_interest: 55000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: +0.4,
    liquidity: 'medium',
  },

  // ── CRYPTO ────────────────────────────────────────────────────────────────
  {
    id: 7,
    ticker: 'KXBTC-26DEC-100K',
    series_ticker: 'KXBTC',
    event_ticker: 'KXBTC-26DEC',
    category: 'Crypto',
    title: 'Will Bitcoin hit $100,000 before December 31, 2026?',
    subtitle: 'Bitcoin price milestone',
    description: 'Resolves YES if the Bitcoin (BTC) price on Coinbase Pro reaches or exceeds $100,000 USD at any point before December 31, 2026 at 23:59 UTC. Resolves based on Coinbase Pro spot price feed.',
    yes_price: 53,
    no_price: 47,
    volume: 1850000,
    open_interest: 290000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: +6.7,
    liquidity: 'high',
  },
  {
    id: 15,
    ticker: 'KXETH-26DEC-5K',
    series_ticker: 'KXETH',
    event_ticker: 'KXETH-26DEC',
    category: 'Crypto',
    title: 'Will Ethereum (ETH) reach $5,000 before December 31, 2026?',
    subtitle: 'Ethereum price milestone',
    description: 'Resolves YES if the Ethereum (ETH/USD) spot price on Coinbase Pro reaches or exceeds $5,000.00 at any point before December 31, 2026 at 23:59 UTC.',
    yes_price: 41,
    no_price: 59,
    volume: 920000,
    open_interest: 148000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: +3.8,
    liquidity: 'high',
  },

  // ── WEATHER ───────────────────────────────────────────────────────────────
  {
    id: 3,
    ticker: 'KXHIGHNY-26AUG27-T85',
    series_ticker: 'KXHIGHNY',
    event_ticker: 'KXHIGHNY-26AUG27',
    category: 'Weather',
    title: 'Will NYC reach 85°F or higher on August 27, 2026?',
    subtitle: 'New York City daily high temperature',
    description: 'Resolves YES if the official daily maximum temperature at Central Park (KNYC GHCN station) on August 27, 2026 is 85°F (29.4°C) or higher. Resolves based on NOAA/NWS data.',
    yes_price: 38,
    no_price: 62,
    volume: 48000,
    open_interest: 9200,
    close_time: '2026-08-27T23:59:00Z',
    status: 'open',
    change_24h: +5.1,
    liquidity: 'medium',
  },
  {
    id: 16,
    ticker: 'KXHURR-26-CAT5',
    series_ticker: 'KXHURR',
    event_ticker: 'KXHURR-26',
    category: 'Weather',
    title: 'Will a Category 5 hurricane make US landfall in 2026?',
    subtitle: 'Atlantic hurricane season',
    description: 'Resolves YES if the National Hurricane Center classifies any Atlantic storm as Category 5 (sustained winds ≥ 157 mph) at the time of US landfall during the 2026 hurricane season (June 1 – November 30, 2026).',
    yes_price: 27,
    no_price: 73,
    volume: 165000,
    open_interest: 22000,
    close_time: '2026-11-30T23:59:00Z',
    status: 'open',
    change_24h: +2.1,
    liquidity: 'low',
  },

  // ── TECHNOLOGY ────────────────────────────────────────────────────────────
  {
    id: 17,
    ticker: 'KXAGI-30',
    series_ticker: 'KXAGI',
    event_ticker: 'KXAGI-30',
    category: 'Technology',
    title: 'Will any AI system be recognized as AGI before 2030?',
    subtitle: 'Artificial General Intelligence milestone',
    description: 'Resolves YES if a majority of Metaculus superforecasters, or an official statement from one of (OpenAI, Anthropic, Google DeepMind), declares that a publicly available system has achieved Artificial General Intelligence before January 1, 2030.',
    yes_price: 35,
    no_price: 65,
    volume: 1650000,
    open_interest: 310000,
    close_time: '2029-12-31T23:59:00Z',
    status: 'open',
    change_24h: -1.0,
    liquidity: 'high',
  },
  {
    id: 18,
    ticker: 'KXSPACEX-26-STARSHIP',
    series_ticker: 'KXSPACEX',
    event_ticker: 'KXSPACEX-26',
    category: 'Technology',
    title: 'Will SpaceX Starship successfully reach orbit in 2026?',
    subtitle: 'SpaceX Starship orbital flight test',
    description: 'Resolves YES if SpaceX successfully demonstrates Starship completing at least one full orbit of Earth before December 31, 2026. Confirmed by SpaceX mission report and NASA or ESA tracking data.',
    yes_price: 82,
    no_price: 18,
    volume: 540000,
    open_interest: 87000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: +1.9,
    liquidity: 'medium',
  },

  // ── ENTERTAINMENT ─────────────────────────────────────────────────────────
  {
    id: 19,
    ticker: 'KXENTS-26-TAYLOR',
    series_ticker: 'KXENTS',
    event_ticker: 'KXENTS-26-TAYLOR',
    category: 'Entertainment',
    title: "Will Taylor Swift's Eras Tour concert film gross $1B worldwide?",
    subtitle: 'Box office milestone',
    description: "Resolves YES if the cumulative worldwide box office gross of Taylor Swift's Eras Tour film reaches or exceeds $1,000,000,000 USD by December 31, 2026. Resolves based on Box Office Mojo official data.",
    yes_price: 47,
    no_price: 53,
    volume: 420000,
    open_interest: 68000,
    close_time: '2026-12-31T23:59:00Z',
    status: 'open',
    change_24h: +2.7,
    liquidity: 'medium',
  },
];

function generatePriceHistory(currentPrice, points = 48, volatility = 2.5) {
  const data = [];
  let price = Math.max(5, Math.min(95, currentPrice - (Math.random() * 12 - 4)));
  for (let i = 0; i < points; i++) {
    price = Math.min(99, Math.max(1, price + (Math.random() - 0.46) * volatility));
    data.push(parseFloat(price.toFixed(1)));
  }
  data[points - 1] = currentPrice;
  return data;
}

/** Generate simulated order book for a given yes price */
function generateOrderBook(yesPrice, depth = 6) {
  const yesBids = [];
  const noBids  = [];
  for (let i = 0; i < depth; i++) {
    const yP = Math.max(1, yesPrice - i);
    const nP = Math.max(1, (100 - yesPrice) - i);
    const yQ = Math.floor(Math.random() * 900 + 100);
    const nQ = Math.floor(Math.random() * 900 + 100);
    yesBids.push({ price: yP, qty: yQ, total: parseFloat((yP * yQ / 100).toFixed(2)) });
    noBids.push({ price: nP, qty: nQ, total: parseFloat((nP * nQ / 100).toFixed(2)) });
  }
  return { yes: yesBids, no: noBids };
}

/** Seed positions for the demo account (normalized shape). */
const SEED_POSITIONS = [
  { ticker: 'KXFED-26SEP-HOLD',       title: 'Fed rate hold — Sep 2026',        series: 'KXFED',    side: 'YES', avg_price: 48, current_price: 44, quantity: 50  },
  { ticker: 'KXSPX-26DEC-5500',       title: 'S&P 500 above 5,500 (Dec 2026)',  series: 'KXSPX',    side: 'YES', avg_price: 65, current_price: 71, quantity: 100 },
  { ticker: 'KXHIGHNY-26AUG27-T85',   title: 'NYC temp ≥85°F Aug 27', series: 'KXHIGHNY', side: 'NO',  avg_price: 68, current_price: 62, quantity: 30  },
  { ticker: 'KXNFL-27SB-KC',          title: 'KC Chiefs win Super Bowl LXI',    series: 'KXNFL',    side: 'NO',  avg_price: 78, current_price: 72, quantity: 20  },
  { ticker: 'KXBTC-26DEC-100K',       title: 'Bitcoin hits $100K (2026)',       series: 'KXBTC',    side: 'YES', avg_price: 46, current_price: 53, quantity: 75  },
];

/** Seed activity/fills for the demo account (normalized shape). */
const SEED_ACTIVITY = [
  { action: 'Buy YES', title: 'S&P 500 above 5,500',        ticker: 'KXSPX-26DEC-5500',     price: 65, qty: 100, cost:  65.00, timestamp: new Date(Date.now() -  2 * 3600000).toISOString(), pnl:  +6.00, status: 'filled' },
  { action: 'Buy NO',  title: 'NYC temp ≥85°F Aug 27', ticker: 'KXHIGHNY-26AUG27-T85', price: 68, qty:  30, cost:  20.40, timestamp: new Date(Date.now() -  5 * 3600000).toISOString(), pnl:  +1.80, status: 'filled' },
  { action: 'Sell YES', title: 'Senate majority (Dem)',      ticker: 'KXELEX-26NOV-DEM',     price: 59, qty:  25, cost: -14.75, timestamp: new Date(Date.now() - 26 * 3600000).toISOString(), pnl: +12.50, status: 'filled' },
  { action: 'Buy NO',  title: 'KC Chiefs win Super Bowl LXI', ticker: 'KXNFL-27SB-KC',        price: 78, qty:  20, cost:  15.60, timestamp: new Date(Date.now() - 50 * 3600000).toISOString(), pnl:  +1.20, status: 'filled' },
  { action: 'Buy YES', title: 'Fed rate hold — Sep 2026',    ticker: 'KXFED-26SEP-HOLD',     price: 48, qty:  50, cost:  24.00, timestamp: new Date(Date.now() - 75 * 3600000).toISOString(), pnl:  -2.00, status: 'filled' },
  { action: 'Buy YES', title: 'Bitcoin hits $100K',          ticker: 'KXBTC-26DEC-100K',     price: 46, qty:  75, cost:  34.50, timestamp: new Date(Date.now() - 100 * 3600000).toISOString(), pnl: +5.25, status: 'filled' },
];

/** Seed account snapshot for a returning demo user. */
const SEED_ACCOUNT = { balance: 1247.50, portfolioValue: 3841.20, weekPnl: 241.20, allTimePnl: 1247.00, winRate: 64 };

/**
 * Unrealized P&L for a position, in dollars.
 * A position is worth its *current* price per contract and cost its *avg* price;
 * `side` only selects which market price we track as current/avg (YES→yes_price,
 * NO→no_price), so the formula is (current − avg) for both sides.
 */
function computePnl(pos) {
  const { avg_price, current_price, quantity } = pos;
  return (current_price - avg_price) * quantity / 100;
}
