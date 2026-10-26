# Predictex — Prediction Markets Platform

A full-stack prediction markets platform inspired by Kalshi, built for learning purposes. Trade YES/NO contracts on real-world events across politics, economics, sports, crypto, weather, technology, and entertainment.

## Features

- **Real-time market data** — Prices sourced from Kalshi API via proxy
- **Buy YES/NO contracts** — Place trades at market price with instant fills
- **Portfolio tracking** — View open positions, P&L, allocation donut chart
- **Trade history** — Full activity log with filters (buys, sells, profitable)
- **Three-tier RBAC** — System Admin → Client → User hierarchy
  - **System Admin**: Create clients, manage all users, view platform-wide reports, approve withdrawals
  - **Client**: Create users under their tenant, set per-user commission rates, view client-level reports
  - **User**: Browse markets, trade, track portfolio and activity
- **Per-user commission** — Configurable percentage deducted on each trade
- **Tenant isolation** — Clients and their users are scoped to their own data
- **Auto-settlement** — Markets settle automatically based on Kalshi outcomes
- **Responsive design** — Works on desktop, tablet, and mobile
- **Live ticker** — Scrolling market prices on the landing page
- **Price charts** — 1D/1W/1M historical price visualization with Chart.js
- **Order book** — Visual bid/ask depth display
- **Watchlist** — Bookmark markets for quick access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JavaScript (no framework, no build step) |
| Backend | Node.js + Express |
| Database | SQLite with WAL mode (better-sqlite3) |
| Auth | JWT (JSON Web Tokens) |
| Charts | Chart.js 4.x |
| Icons | Tabler Icons |
| Fonts | Archivo (display) + Hanken Grotesk (body) via Google Fonts |
| Data Source | Kalshi API (via reverse proxy) |

## Architecture

```
Browser (:7432)  →  Python static server (frontend)
                →  Node/Express API (:7434) → SQLite DB
                →  Python proxy (:7433) → Kalshi API (optional)
```

- **Frontend** served as static files — vanilla JS SPA with hash-based routing
- **Backend** is a REST API with JWT auth, RBAC middleware, and transactional DB writes
- **Proxy** handles Kalshi API requests (optional — markets work with existing data)
- Market prices always come from Kalshi — user trades never move the price

## Getting Started

### Prerequisites

- Node.js (v18+)
- Python 3.x
- npm

### Installation

```bash
# Clone the repo
git clone https://github.com/rishab2334/predictex.git
cd predictex

# Install backend dependencies
cd server && npm install && cd ..
```

### Running

Start these in separate terminals:

```bash
# 1. Backend API (port 7434)
cd server && node server.js

# 2. Frontend static server (port 7432)
python3 -m http.server 7432

# 3. (Optional) Kalshi proxy (port 7433)
python3 proxy.py
```

Open **http://localhost:7432** in your browser.

### Default Accounts

| Role | Username | Password |
|------|----------|----------|
| System Admin | `admin` | `admin123` |
| Test User | `testui` | `test123` |

Admins can create client accounts, and clients can create user accounts from their respective dashboards.

## Project Structure

```
predictex/
├── index.html                  # Entry point — all script/style tags
├── proxy.py                    # Reverse proxy for Kalshi API
├── src/
│   ├── core/
│   │   ├── config.js           # API base URL, constants
│   │   ├── utils.js            # Formatting, helpers
│   │   ├── store.js            # Client-side state management
│   │   ├── api.js              # API gateway (fetch wrapper)
│   │   ├── router.js           # Hash-based SPA router
│   │   └── app.js              # App facade, polling, session
│   ├── services/
│   │   ├── marketService.js    # Market data logic
│   │   ├── orderBookService.js # Order book generation
│   │   ├── tradeService.js     # Trade execution logic
│   │   └── authService.js      # Auth state management
│   ├── components/
│   │   ├── navbar.js           # Top nav, search, balance, mobile drawer
│   │   ├── marketCard.js       # Market tile with YES/NO chips
│   │   ├── tradePanel.js       # Buy panel with amount input + summary
│   │   ├── orderBook.js        # Visual bid/ask depth
│   │   ├── priceChart.js       # Chart.js price history
│   │   ├── toast.js            # Notification toasts
│   │   └── modal.js            # Modal dialogs (withdraw, deposit)
│   ├── views/
│   │   ├── authView.js         # Login page
│   │   ├── homeView.js         # Markets grid with filters/sort/search
│   │   ├── detailView.js       # Market detail (chart, orderbook, rules, trade)
│   │   ├── portfolioView.js    # Holdings, P&L, allocation chart
│   │   ├── activityView.js     # Trade history with filters
│   │   ├── adminView.js        # System admin dashboard
│   │   └── clientView.js       # Client dashboard
│   ├── styles/
│   │   ├── reset.css           # CSS reset
│   │   ├── theme.css           # CSS custom properties (colors, spacing, fonts)
│   │   ├── components.css      # Component styles
│   │   └── layout.css          # Layout, navbar, pages, responsive breakpoints
│   ├── data/
│   │   └── seed.js             # Fallback market data
│   └── main.js                 # Bootstrap
└── server/
    ├── server.js               # Express app, routes, middleware
    ├── db.js                   # SQLite setup, schema, migrations
    ├── package.json
    └── data/                   # SQLite database files (gitignored)
```

## Design

- **Light theme only** — warm off-white surfaces (#f5f4f0)
- **Typography** — Archivo (heavy grotesque) for numbers/labels, Hanken Grotesk for body text
- **Colors** — Deep teal (#0c6e6b) for YES/success, burnt orange (#c2410c) for NO/danger
- **Square corners** — No border-radius anywhere
- **Hairline borders** — Minimal, editorial aesthetic
- **Responsive** — Full mobile support with hamburger menu and stacked layouts

## API Endpoints

### Auth
- `POST /api/auth/login` — Login, returns JWT

### Markets
- `GET /api/markets` — List all markets
- `GET /api/markets/:ticker` — Get market detail

### Trading
- `POST /api/trade` — Place a trade (requires auth)

### Portfolio
- `GET /api/portfolio` — Get user positions (requires auth)
- `GET /api/activity` — Get trade history (requires auth)

### Admin
- `GET /api/admin/clients` — List clients (admin only)
- `POST /api/admin/clients` — Create client (admin only)
- `GET /api/admin/users` — List all users (admin only)
- `POST /api/admin/users` — Create user (admin only)
- `GET /api/admin/withdrawals` — List withdrawal requests (admin only)
- `GET /api/admin/reports` — Platform reports (admin only)

### Client
- `GET /api/client/users` — List tenant users (client only)
- `POST /api/client/users` — Create user (client only)
- `GET /api/client/withdrawals` — Tenant withdrawals (client only)
- `GET /api/client/reports` — Tenant reports (client only)

## Disclaimer

This project is for **learning and educational purposes only**. It is not a real trading platform. No real money is involved. Market data is sourced from public APIs for demonstration purposes.

## License

MIT
