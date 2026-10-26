# Predictex Backend (SQLite)

Real database + API server implementing the contract the frontend's Remote
adapter (`src/core/api.js`) calls.

## Stack
- **Express** — HTTP server + routing
- **better-sqlite3** — embedded SQL database (file: `server/data/predictex.db`)
- **bcryptjs** — password hashing
- **jsonwebtoken** — stateless auth tokens (Bearer)

## Run
```bash
cd server
npm install          # once
node server.js       # listens on http://localhost:7434
```
For **live prices in remote mode**, also run the Kalshi proxy (separate terminal,
from the project root) — the server's ingester reads from it:
```bash
python3 proxy.py     # localhost:7433
```
Set `JWT_SECRET` in the environment for anything beyond local dev:
```bash
JWT_SECRET="a-long-random-string" node server.js
```

### Env flags
- `JWT_SECRET` — token signing secret (required in production)
- `INGEST=0` — disable the Kalshi ingester (serves static seed markets only)
- `INGEST_MS` — ingest interval in ms (default 60000)
- `PROXY_URL` — override the proxy endpoint (default `http://127.0.0.1:7433/markets`)
- `PORT` / `DB_PATH` — server port / database file location

## Point the frontend at it
In `src/core/config.js` set:
```js
apiMode: 'remote',            // was 'local'
apiBaseUrl: 'http://localhost:7434',
```
Then reload the app (hard refresh). Leave `apiMode: 'local'` to run the app
standalone without the server.

## Schema (tables)
- `users` (id, name, email UNIQUE, password_hash, color, created_at)
- `accounts` (user_id, balance, portfolio_value, week_pnl, all_time_pnl, win_rate)
- `markets` (ticker PK + price/metadata, seeded from `markets-seed.json`)
- `positions` (user_id, ticker, side, avg_price, current_price, quantity) — UNIQUE(user,ticker,side)
- `fills` (trade history)
- `ledger` (double-entry cash record: grant / deposit / trade, with running balance)

## Endpoints (`/api`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /auth/signup | — | create user (+ $1000 demo grant), returns `{user, token}` |
| POST | /auth/login | — | verify password, returns `{user, token}` |
| POST | /auth/logout | — | no-op (stateless JWT) |
| GET | /markets | — | list open markets |
| GET | /markets/:ticker | — | one market |
| GET | /portfolio | ✓ | `{account, positions}` |
| GET | /activity | ✓ | fills |
| GET | /markets/:ticker/book | — | live order book (server matching engine) |
| POST | /orders | ✓ | match + book an order (server engine; atomic balance + position + fill + ledger) |
| POST | /account/deposit | ✓ | add funds |
| PATCH | /account/profile | ✓ | update name |

## Notes / next steps
- New accounts receive a **$1000 demo grant** (stand-in until a payment processor
  is wired to `/account/deposit`).
- **Order matching is server-side** (`orderBook.js`): a price-time-priority engine
  with synthetic market-maker liquidity anchored to the Kalshi price. Orders fill
  with real spread/slippage and partial fills, computed and recorded by the server
  (the client can't dictate its fill). **The market price is always Kalshi's — an
  order never moves it**; the book re-anchors to the Kalshi price after each trade
  and as the ingester updates it. `GET /api/markets/:ticker/book` serves the live
  book. Books are in-memory (no resting user orders yet, so nothing to persist);
  adding open/cancel limit orders would introduce an `orders` table.
- **Live prices (DONE):** `ingest.js` polls `proxy.py` every 60s and refreshes the
  `markets` table (`GET /api/markets` serves live Kalshi data in remote mode).
  Positions are marked to the live price in `GET /api/portfolio`, so P&L is
  current. Resilient: if the proxy is down or returns too few markets, existing
  data is kept (never wiped, never faked).
- **Auto-settlement from Kalshi (DONE):** `settle.js` polls, for each market with
  open positions, the proxy's `GET /settlement?ticker=…` (which reads Kalshi's
  real `status` + `result`). When Kalshi reports a market settled YES/NO, the
  outcome — not an admin — triggers `repo.resolveMarket()`: **winners are paid
  $1.00 per contract, losers get nothing**; realized P&L, a settlement ledger
  entry, and a "Won/Lost" activity row are written, positions removed, market
  marked settled — atomically. Env: `SETTLE=0` disables, `SETTLE_MS` interval.
- SQL is standard and portable — swapping SQLite for Postgres is a driver change
  in `db.js`, not a rewrite.
