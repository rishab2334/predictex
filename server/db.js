/**
 * db.js — SQLite database: schema, migration, and repository functions.
 *
 * Multi-tenant RBAC model: everyone is a row in `users` distinguished by `role`
 * (system_admin | client | user). A user belongs to one client (client_id).
 * Wallets (accounts) exist only for role 'user'. All writes are parameterized
 * and multi-step writes run in transactions.
 */
const path = require('path');
const Database = require('better-sqlite3');

const fs = require('fs');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'predictex.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema (fresh DBs) ───────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    username        TEXT,
    name            TEXT NOT NULL,
    email           TEXT,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'user',
    client_id       TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    commission_rate REAL NOT NULL DEFAULT 0,
    color           TEXT NOT NULL,
    created_at      INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS accounts (
    user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance         REAL NOT NULL DEFAULT 0,
    portfolio_value REAL NOT NULL DEFAULT 0,
    week_pnl        REAL NOT NULL DEFAULT 0,
    all_time_pnl    REAL NOT NULL DEFAULT 0,
    win_rate        INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS markets (
    ticker        TEXT PRIMARY KEY,
    series_ticker TEXT, category TEXT, title TEXT, subtitle TEXT, description TEXT,
    yes_price     INTEGER, no_price INTEGER, volume INTEGER, open_interest INTEGER,
    close_time    TEXT, status TEXT, change_24h REAL, liquidity TEXT, updated_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS positions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticker     TEXT NOT NULL, title TEXT, series TEXT, side TEXT NOT NULL,
    avg_price  INTEGER NOT NULL, current_price INTEGER NOT NULL, quantity INTEGER NOT NULL,
    UNIQUE(user_id, ticker, side)
  );
  CREATE TABLE IF NOT EXISTS fills (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action     TEXT, title TEXT, ticker TEXT, price INTEGER, qty INTEGER, cost REAL,
    pnl        REAL DEFAULT 0, status TEXT, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ledger (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          TEXT NOT NULL, amount REAL NOT NULL, balance_after REAL NOT NULL,
    ref           TEXT, actor_id TEXT, actor_role TEXT, created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id   TEXT,
    amount      REAL NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  INTEGER NOT NULL,
    resolved_at INTEGER,
    resolved_by TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);
  CREATE INDEX IF NOT EXISTS idx_fills_user     ON fills(user_id);
  CREATE INDEX IF NOT EXISTS idx_ledger_user    ON ledger(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_client   ON users(client_id);
  CREATE INDEX IF NOT EXISTS idx_wd_client      ON withdrawal_requests(client_id, status);
`);

// ── Migration (existing DBs get new columns) ─────────────────────────────────
function ensureColumns(table, cols) {
  const have = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  for (const [name, ddl] of cols) if (!have.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
ensureColumns('users', [
  ['username', 'username TEXT'],
  ['role', "role TEXT NOT NULL DEFAULT 'user'"],
  ['client_id', 'client_id TEXT'],
  ['status', "status TEXT NOT NULL DEFAULT 'active'"],
  ['commission_rate', 'commission_rate REAL NOT NULL DEFAULT 0'],
  ['allowed_categories', 'allowed_categories TEXT'],
]);
ensureColumns('ledger', [['actor_id', 'actor_id TEXT'], ['actor_role', 'actor_role TEXT']]);
db.exec(`UPDATE users SET username = COALESCE(username, email, id) WHERE username IS NULL`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

// ── Prepared statements ──────────────────────────────────────────────────────
const q = {
  insUser:      db.prepare(`INSERT INTO users (id,username,name,email,password_hash,role,client_id,status,commission_rate,color,allowed_categories,created_at)
                            VALUES (@id,@username,@name,@email,@password_hash,@role,@client_id,@status,@commission_rate,@color,@allowed_categories,@created_at)`),
  userById:     db.prepare(`SELECT * FROM users WHERE id = ?`),
  userByName:   db.prepare(`SELECT * FROM users WHERE username = ?`),
  clients:      db.prepare(`SELECT * FROM users WHERE role='client' ORDER BY created_at DESC`),
  usersAll:     db.prepare(`SELECT u.*, a.balance FROM users u LEFT JOIN accounts a ON a.user_id=u.id WHERE u.role='user' ORDER BY u.created_at DESC`),
  usersByClient:db.prepare(`SELECT u.*, a.balance FROM users u LEFT JOIN accounts a ON a.user_id=u.id WHERE u.role='user' AND u.client_id=? ORDER BY u.created_at DESC`),
  setStatus:    db.prepare(`UPDATE users SET status=@status WHERE id=@id`),
  setCommission:db.prepare(`UPDATE users SET commission_rate=@rate WHERE id=@id`),
  setPassword:  db.prepare(`UPDATE users SET password_hash=@hash WHERE id=@id`),
  setCategories:db.prepare(`UPDATE users SET allowed_categories=@cats WHERE id=@id`),
  updName:      db.prepare(`UPDATE users SET name=@name WHERE id=@id`),
  countRole:    db.prepare(`SELECT COUNT(*) AS n FROM users WHERE role=?`),

  insAccount:   db.prepare(`INSERT INTO accounts (user_id,balance,portfolio_value,week_pnl,all_time_pnl,win_rate) VALUES (@user_id,0,0,0,0,0)`),
  account:      db.prepare(`SELECT * FROM accounts WHERE user_id = ?`),
  setAccount:   db.prepare(`UPDATE accounts SET balance=@balance, portfolio_value=@portfolio_value WHERE user_id=@user_id`),
  setBalance:   db.prepare(`UPDATE accounts SET balance=@balance WHERE user_id=@user_id`),
  bumpPnl:      db.prepare(`UPDATE accounts SET all_time_pnl = round(all_time_pnl + ?, 2) WHERE user_id = ?`),

  marketCount:  db.prepare(`SELECT COUNT(*) AS n FROM markets`),
  upsMarket:    db.prepare(`INSERT INTO markets (ticker,series_ticker,category,title,subtitle,description,yes_price,no_price,volume,open_interest,close_time,status,change_24h,liquidity,updated_at)
                            VALUES (@ticker,@series_ticker,@category,@title,@subtitle,@description,@yes_price,@no_price,@volume,@open_interest,@close_time,@status,@change_24h,@liquidity,@updated_at)
                            ON CONFLICT(ticker) DO UPDATE SET yes_price=@yes_price,no_price=@no_price,change_24h=@change_24h,updated_at=@updated_at`),
  markets:      db.prepare(`SELECT * FROM markets WHERE status='open' ORDER BY volume DESC`),
  market:       db.prepare(`SELECT * FROM markets WHERE ticker = ?`),
  delMarkets:   db.prepare(`DELETE FROM markets`),
  setMarketStatus: db.prepare(`UPDATE markets SET status = ? WHERE ticker = ?`),

  posByUser:    db.prepare(`SELECT * FROM positions WHERE user_id = ? ORDER BY id`),
  posByTicker:  db.prepare(`SELECT * FROM positions WHERE ticker = ?`),
  posOne:       db.prepare(`SELECT * FROM positions WHERE user_id=? AND ticker=? AND side=?`),
  insPos:       db.prepare(`INSERT INTO positions (user_id,ticker,title,series,side,avg_price,current_price,quantity) VALUES (@user_id,@ticker,@title,@series,@side,@avg_price,@current_price,@quantity)`),
  updPos:       db.prepare(`UPDATE positions SET avg_price=@avg_price, current_price=@current_price, quantity=@quantity WHERE id=@id`),
  delPosById:   db.prepare(`DELETE FROM positions WHERE id = ?`),
  distinctPosTickers: db.prepare(`SELECT DISTINCT ticker FROM positions`),

  insFill:      db.prepare(`INSERT INTO fills (user_id,action,title,ticker,price,qty,cost,pnl,status,created_at) VALUES (@user_id,@action,@title,@ticker,@price,@qty,@cost,@pnl,@status,@created_at)`),
  fillsByUser:  db.prepare(`SELECT * FROM fills WHERE user_id = ? ORDER BY created_at DESC, id DESC`),
  insLedger:    db.prepare(`INSERT INTO ledger (user_id,type,amount,balance_after,ref,actor_id,actor_role,created_at) VALUES (@user_id,@type,@amount,@balance_after,@ref,@actor_id,@actor_role,@created_at)`),

  insWd:        db.prepare(`INSERT INTO withdrawal_requests (user_id,client_id,amount,status,created_at) VALUES (@user_id,@client_id,@amount,'pending',@created_at)`),
  wdById:       db.prepare(`SELECT * FROM withdrawal_requests WHERE id = ?`),
  wdByUser:     db.prepare(`SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC`),
  wdByClient:   db.prepare(`SELECT w.*, u.username AS user_username, u.name AS user_name FROM withdrawal_requests w JOIN users u ON u.id=w.user_id WHERE w.client_id=? ORDER BY (w.status='pending') DESC, w.created_at DESC`),
  wdAll:        db.prepare(`SELECT w.*, u.username AS user_username, u.name AS user_name FROM withdrawal_requests w JOIN users u ON u.id=w.user_id ORDER BY (w.status='pending') DESC, w.created_at DESC`),
  wdResolve:    db.prepare(`UPDATE withdrawal_requests SET status=@status, resolved_at=@resolved_at, resolved_by=@resolved_by WHERE id=@id`),
};

const round2 = (n) => +(Number(n)).toFixed(2);

// ── Repository ───────────────────────────────────────────────────────────────
const repo = {
  // ---- Identity ----
  hasSystemAdmin: () => q.countRole.get('system_admin').n > 0,
  userById:    (id) => q.userById.get(id),
  userByUsername: (username) => q.userByName.get(username),
  listClients: () => q.clients.all(),
  listUsers:   (clientId) => clientId ? q.usersByClient.all(clientId) : q.usersAll.all(),

  createClient({ id, username, name, password_hash, color }) {
    q.insUser.run({ id, username, name, email: null, password_hash, role: 'client', client_id: null, status: 'active', commission_rate: 0, color, allowed_categories: null, created_at: Date.now() });
    return q.userById.get(id);
  },
  createSystemAdmin({ id, username, name, password_hash, color }) {
    q.insUser.run({ id, username, name, email: null, password_hash, role: 'system_admin', client_id: null, status: 'active', commission_rate: 0, color, allowed_categories: null, created_at: Date.now() });
    return q.userById.get(id);
  },
  /** Create a trading user under a client, with an optional opening deposit. */
  createUser({ id, username, name, password_hash, color, client_id, commission_rate = 0, deposit = 0, allowed_categories = null, actorId, actorRole }) {
    const now = Date.now();
    const cats = Array.isArray(allowed_categories) && allowed_categories.length ? JSON.stringify(allowed_categories) : null;
    const tx = db.transaction(() => {
      q.insUser.run({ id, username, name, email: null, password_hash, role: 'user', client_id, status: 'active', commission_rate, color, allowed_categories: cats, created_at: now });
      q.insAccount.run({ user_id: id });
      if (deposit > 0) {
        q.setBalance.run({ user_id: id, balance: round2(deposit) });
        q.insLedger.run({ user_id: id, type: 'credit', amount: round2(deposit), balance_after: round2(deposit), ref: 'opening deposit', actor_id: actorId || null, actor_role: actorRole || null, created_at: now });
      }
    });
    tx();
    return q.userById.get(id);
  },
  setStatus:     (id, status) => { q.setStatus.run({ id, status }); return q.userById.get(id); },
  setCommission: (id, rate)   => { q.setCommission.run({ id, rate: Number(rate) || 0 }); return q.userById.get(id); },
  setPassword:   (id, hash)   => { q.setPassword.run({ id, hash }); return q.userById.get(id); },
  setCategories: (id, cats)   => { q.setCategories.run({ id, cats: Array.isArray(cats) && cats.length ? JSON.stringify(cats) : null }); return q.userById.get(id); },
  updateName:    (id, name)   => { q.updName.run({ id, name }); return q.userById.get(id); },

  // ---- Wallet (manual money by admin/client) ----
  account:   (userId) => q.account.get(userId),
  positions: (userId) => q.posByUser.all(userId),
  fills:     (userId) => q.fillsByUser.all(userId),

  /** Credit a user's wallet. Returns the new balance. */
  credit({ userId, amount, actorId, actorRole, note }) {
    const amt = round2(amount);
    const tx = db.transaction(() => {
      const acct = q.account.get(userId);
      const balance = round2(acct.balance + amt);
      q.setBalance.run({ user_id: userId, balance });
      q.insLedger.run({ user_id: userId, type: 'credit', amount: amt, balance_after: balance, ref: note || 'credit', actor_id: actorId, actor_role: actorRole, created_at: Date.now() });
      return balance;
    });
    return tx();
  },
  /** Debit a user's wallet directly (type 'debit') or via a withdrawal ('withdrawal'). */
  debit({ userId, amount, actorId, actorRole, type = 'debit', note }) {
    const amt = round2(amount);
    const tx = db.transaction(() => {
      const acct = q.account.get(userId);
      if (amt > acct.balance) throw new Error('INSUFFICIENT');
      const balance = round2(acct.balance - amt);
      q.setBalance.run({ user_id: userId, balance });
      q.insLedger.run({ user_id: userId, type, amount: -amt, balance_after: balance, ref: note || type, actor_id: actorId, actor_role: actorRole, created_at: Date.now() });
      return balance;
    });
    return tx();
  },

  // ---- Withdrawals (request → approve) ----
  createWithdrawal({ userId, clientId, amount }) {
    const amt = round2(amount);
    const acct = q.account.get(userId);
    if (amt <= 0) throw new Error('INVALID');
    if (amt > acct.balance) throw new Error('INSUFFICIENT');
    const info = q.insWd.run({ user_id: userId, client_id: clientId, amount: amt, created_at: Date.now() });
    return q.wdById.get(info.lastInsertRowid);
  },
  withdrawalsByUser:   (userId) => q.wdByUser.all(userId),
  withdrawalsByClient: (clientId) => q.wdByClient.all(clientId),
  withdrawalsAll:      () => q.wdAll.all(),
  getWithdrawal:       (id) => q.wdById.get(id),
  /** Approve (debit wallet) or reject a pending request. */
  resolveWithdrawal({ id, approve, resolverId, resolverRole }) {
    const now = Date.now();
    const tx = db.transaction(() => {
      const w = q.wdById.get(id);
      if (!w || w.status !== 'pending') throw new Error('NOT_PENDING');
      if (approve) {
        const acct = q.account.get(w.user_id);
        if (w.amount > acct.balance) throw new Error('INSUFFICIENT');
        const balance = round2(acct.balance - w.amount);
        q.setBalance.run({ user_id: w.user_id, balance });
        q.insLedger.run({ user_id: w.user_id, type: 'withdrawal', amount: -w.amount, balance_after: balance, ref: 'withdrawal#' + id, actor_id: resolverId, actor_role: resolverRole, created_at: now });
      }
      q.wdResolve.run({ id, status: approve ? 'approved' : 'rejected', resolved_at: now, resolved_by: resolverId });
      return q.wdById.get(id);
    });
    return tx();
  },

  // ---- Markets ----
  listMarkets: () => q.markets.all(),
  getMarket:   (ticker) => q.market.get(ticker),
  seedMarkets(markets) {
    if (q.marketCount.get().n > 0) return;
    const now = Date.now();
    db.transaction((rows) => rows.forEach(m => q.upsMarket.run({ ...m, updated_at: now })))(markets);
  },
  replaceMarkets(markets) {
    const now = Date.now();
    return db.transaction((rows) => { q.delMarkets.run(); rows.forEach(m => q.upsMarket.run({ ...m, updated_at: now })); return rows.length; })(markets);
  },
  marketCount: () => q.marketCount.get().n,
  distinctPositionTickers: () => q.distinctPosTickers.all().map(r => r.ticker),

  /**
   * Book a filled buy with commission taken from the spend. `cost` is what the
   * contracts cost (qty × mid); `commission` is skimmed to the owning client.
   * Wallet is debited cost + commission; position merges (weighted average).
   */
  bookOrder({ userId, market, side, price, qty, cost, commission = 0, clientId }) {
    const now = Date.now();
    const tx = db.transaction(() => {
      const acct = q.account.get(userId);
      const totalDebit = round2(cost + commission);
      const balance = round2(acct.balance - totalDebit);
      const portfolio_value = round2(acct.portfolio_value + cost);
      q.setAccount.run({ user_id: userId, balance, portfolio_value });

      const existing = q.posOne.get(userId, market.ticker, side);
      if (existing) {
        const total = existing.quantity + qty;
        const newAvg = Math.round((existing.avg_price * existing.quantity + price * qty) / total);
        q.updPos.run({ id: existing.id, avg_price: newAvg, current_price: price, quantity: total });
      } else {
        q.insPos.run({ user_id: userId, ticker: market.ticker, title: market.title, series: market.series_ticker, side, avg_price: price, current_price: price, quantity: qty });
      }

      const fill = { user_id: userId, action: 'Buy ' + side, title: market.title, ticker: market.ticker, price, qty, cost, pnl: 0, status: 'filled', created_at: now };
      q.insFill.run(fill);
      q.insLedger.run({ user_id: userId, type: 'trade', amount: -cost, balance_after: round2(balance + commission), ref: market.ticker, actor_id: userId, actor_role: 'user', created_at: now });
      if (commission > 0) {
        q.insLedger.run({ user_id: userId, type: 'commission', amount: -round2(commission), balance_after: balance, ref: market.ticker, actor_id: clientId || null, actor_role: 'client', created_at: now });
      }
      return { balance, fill };
    });
    return tx();
  },

  /** Settle a market: winners paid $1.00/contract, losers get nothing. */
  resolveMarket(ticker, outcome) {
    const side = String(outcome).toUpperCase() === 'YES' ? 'YES' : 'NO';
    const now = Date.now();
    return db.transaction(() => {
      const positions = q.posByTicker.all(ticker);
      for (const p of positions) {
        const won = p.side === side;
        const payout = won ? round2(p.quantity * 1) : 0;
        const costBasis = round2(p.avg_price * p.quantity / 100);
        const pnl = round2(payout - costBasis);
        const acct = q.account.get(p.user_id);
        const balance = round2(acct.balance + payout);
        const portfolio_value = +Math.max(0, acct.portfolio_value - costBasis).toFixed(2);
        q.setAccount.run({ user_id: p.user_id, balance, portfolio_value });
        q.bumpPnl.run(pnl, p.user_id);
        q.insLedger.run({ user_id: p.user_id, type: 'settlement', amount: payout, balance_after: balance, ref: ticker + ':' + side, actor_id: null, actor_role: 'system', created_at: now });
        q.insFill.run({ user_id: p.user_id, action: (won ? 'Won ' : 'Lost ') + p.side, title: p.title, ticker, price: won ? 100 : 0, qty: p.quantity, cost: -payout, pnl, status: 'settled', created_at: now });
        q.delPosById.run(p.id);
      }
      q.setMarketStatus.run('settled', ticker);
      return positions.length;
    })();
  },

  // ---- Reports ----
  // Ledger aggregate grouped by any key column ('u.client_id' or 'l.user_id'),
  // optionally filtered to one client. Returns credited / withdrawn / debited /
  // commission / volume / settled per group.
  _ledgerAgg(groupCol, clientId) {
    const where = clientId ? 'WHERE u.client_id = @cid' : '';
    return db.prepare(`
      SELECT ${groupCol} AS k,
        COALESCE(SUM(CASE WHEN l.type='credit'     THEN l.amount ELSE 0 END),0) AS credited,
        COALESCE(SUM(CASE WHEN l.type='withdrawal' THEN -l.amount ELSE 0 END),0) AS withdrawn,
        COALESCE(SUM(CASE WHEN l.type='debit'      THEN -l.amount ELSE 0 END),0) AS debited,
        COALESCE(SUM(CASE WHEN l.type='commission' THEN -l.amount ELSE 0 END),0) AS commission,
        COALESCE(SUM(CASE WHEN l.type='trade'      THEN -l.amount ELSE 0 END),0) AS volume,
        COALESCE(SUM(CASE WHEN l.type='settlement' THEN l.amount ELSE 0 END),0) AS settled
      FROM ledger l JOIN users u ON u.id = l.user_id ${where} GROUP BY ${groupCol}`).all(clientId ? { cid: clientId } : {});
  },

  clientReport(clientId) {
    const users = q.usersByClient.all(clientId);
    const bal = users.reduce((s, u) => s + (u.balance || 0), 0);
    const pnl = users.reduce((s, u) => s + 0, 0);
    const agg = (this._ledgerAgg('l.user_id', clientId)).reduce((a, r) => {
      a.commission += r.commission; a.credited += r.credited; a.withdrawn += r.withdrawn; a.debited += r.debited; a.volume += r.volume; a.settled += r.settled; return a;
    }, { commission: 0, credited: 0, withdrawn: 0, debited: 0, volume: 0, settled: 0 });
    const pend = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(amount),0) amt FROM withdrawal_requests WHERE client_id=? AND status='pending'`).get(clientId);
    return {
      summary: {
        users: users.length,
        activeUsers: users.filter(u => u.status === 'active').length,
        totalBalance: round2(bal),
        commission: round2(agg.commission),
        credited: round2(agg.credited),
        withdrawn: round2(agg.withdrawn + agg.debited),
        volume: round2(agg.volume),
        pendingWithdrawals: pend.n,
        pendingAmount: round2(pend.amt),
      },
      users: this.clientUserBreakdown(clientId),
    };
  },

  clientUserBreakdown(clientId) {
    const users = q.usersByClient.all(clientId);
    const m = {}; this._ledgerAgg('l.user_id', clientId).forEach(r => { m[r.k] = r; });
    const pos = {}; db.prepare(`SELECT p.user_id uid, COUNT(*) n FROM positions p JOIN users u ON u.id=p.user_id WHERE u.client_id=? GROUP BY p.user_id`).all(clientId).forEach(r => pos[r.uid] = r.n);
    return users.map(u => ({
      username: u.username, status: u.status, commission_rate: u.commission_rate,
      balance: round2(u.balance || 0),
      credited: round2(m[u.id]?.credited || 0),
      withdrawn: round2((m[u.id]?.withdrawn || 0) + (m[u.id]?.debited || 0)),
      commission: round2(m[u.id]?.commission || 0),
      volume: round2(m[u.id]?.volume || 0),
      positions: pos[u.id] || 0,
    }));
  },

  adminReport() {
    const one = (sql) => round2(db.prepare(sql).get().s);
    return {
      summary: {
        clients: q.countRole.get('client').n,
        users: q.countRole.get('user').n,
        activeUsers: db.prepare(`SELECT COUNT(*) s FROM users WHERE role='user' AND status='active'`).get().s,
        totalBalance: one(`SELECT COALESCE(SUM(balance),0) s FROM accounts`),
        totalCommission: one(`SELECT COALESCE(SUM(-amount),0) s FROM ledger WHERE type='commission'`),
        totalCredited: one(`SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE type='credit'`),
        totalWithdrawn: one(`SELECT COALESCE(SUM(-amount),0) s FROM ledger WHERE type IN ('withdrawal','debit')`),
        totalVolume: one(`SELECT COALESCE(SUM(-amount),0) s FROM ledger WHERE type='trade'`),
        totalPayout: one(`SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE type='settlement'`),
        pendingWithdrawals: db.prepare(`SELECT COUNT(*) n FROM withdrawal_requests WHERE status='pending'`).get().n,
      },
      clients: this.adminClientBreakdown(),
    };
  },

  adminClientBreakdown() {
    const clients = q.clients.all();
    const led = {}; this._ledgerAgg('u.client_id').forEach(r => { led[r.k] = r; });
    const cnt = {}; db.prepare(`SELECT client_id cid, COUNT(*) n, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) act FROM users WHERE role='user' GROUP BY client_id`).all().forEach(r => cnt[r.cid] = r);
    const bal = {}; db.prepare(`SELECT u.client_id cid, COALESCE(SUM(a.balance),0) b FROM users u JOIN accounts a ON a.user_id=u.id WHERE u.role='user' GROUP BY u.client_id`).all().forEach(r => bal[r.cid] = r.b);
    const pnd = {}; db.prepare(`SELECT client_id cid, COUNT(*) n FROM withdrawal_requests WHERE status='pending' GROUP BY client_id`).all().forEach(r => pnd[r.cid] = r.n);
    return clients.map(c => ({
      username: c.username, name: c.name, status: c.status,
      users: cnt[c.id]?.n || 0, activeUsers: cnt[c.id]?.act || 0,
      balance: round2(bal[c.id] || 0),
      credited: round2(led[c.id]?.credited || 0),
      withdrawn: round2((led[c.id]?.withdrawn || 0) + (led[c.id]?.debited || 0)),
      commission: round2(led[c.id]?.commission || 0),
      volume: round2(led[c.id]?.volume || 0),
      pending: pnd[c.id]?.n || 0,
    }));
  },
};

module.exports = { db, repo, DB_PATH, round2 };
