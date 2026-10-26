/**
 * server.js — Predictex backend API (Express + SQLite), multi-tenant RBAC.
 *
 * Three roles: system_admin · client · user. A System Admin onboards Clients;
 * each Client manages its own isolated Users and their wallets; Users trade and
 * request withdrawals. Money is manual (no gateway). Per-User commission on each
 * trade accrues to the owning Client. Auth is username + bcrypt + JWT.
 *
 * Run: node server.js   (listens on :7434)
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const { repo, DB_PATH, round2 } = require('./db');
const { hashPassword, verifyPassword, signToken, requireAuth, requireRole } = require('./auth');
const { startIngest } = require('./ingest');
const { startSettlement } = require('./settle');
const orderBook = require('./orderBook');

const PORT = process.env.PORT || 7434;
const INGEST_MS = Number(process.env.INGEST_MS) || 60000;
const COLORS = ['#00b17a', '#378add', '#e24b4a', '#ba7517', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71'];
const genId = () => crypto.randomUUID();
const colorFor = (s) => COLORS[Math.abs([...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % COLORS.length];
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Seed markets on first boot; bootstrap a System Admin if none exists.
repo.seedMarkets(JSON.parse(fs.readFileSync(path.join(__dirname, 'markets-seed.json'), 'utf8')));
if (!repo.hasSystemAdmin()) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  repo.createSystemAdmin({ id: genId(), username, name: 'System Admin', password_hash: hashPassword(password), color: colorFor(username) });
  console.log(`[predictex-server] bootstrapped System Admin — username "${username}"` + (process.env.ADMIN_PASSWORD ? '' : ' / password "admin123" (set ADMIN_PASSWORD)'));
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ── Mappers ──────────────────────────────────────────────────────────────────
const sessionUser = (u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, client_id: u.client_id, status: u.status, commission_rate: u.commission_rate, color: u.color, joinedAt: u.created_at });
const managedUser = (u) => ({ ...sessionUser(u), balance: u.balance != null ? u.balance : undefined });
const publicAccount = (a) => ({ balance: a.balance, portfolioValue: a.portfolio_value, weekPnl: a.week_pnl, allTimePnl: a.all_time_pnl, winRate: a.win_rate });
const publicPosition = (p) => ({ ticker: p.ticker, title: p.title, series: p.series, side: p.side, avg_price: p.avg_price, current_price: p.current_price, quantity: p.quantity });
const publicFill = (f) => ({ action: f.action, title: f.title, ticker: f.ticker, price: f.price, qty: f.qty, cost: f.cost, timestamp: new Date(f.created_at).toISOString(), pnl: f.pnl, status: f.status });
const publicMarket = (m) => ({ ticker: m.ticker, series_ticker: m.series_ticker, category: m.category, title: m.title, subtitle: m.subtitle, description: m.description, yes_price: m.yes_price, no_price: m.no_price, volume: m.volume, open_interest: m.open_interest, close_time: m.close_time, status: m.status, change_24h: m.change_24h, liquidity: m.liquidity });
const publicWithdrawal = (w) => ({ id: w.id, user_id: w.user_id, user: w.user_username, userName: w.user_name, amount: w.amount, status: w.status, createdAt: w.created_at, resolvedAt: w.resolved_at });

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, db: path.basename(DB_PATH) }));

// ── Auth (username-based, no self-signup) ────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Please enter your user id.' });
  if (!password) return res.status(400).json({ error: 'Please enter your password.' });
  const user = repo.userByUsername(username);
  if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials.' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'This account is suspended. Contact your provider.' });
  res.json({ user: sessionUser(user), token: signToken(user) });
});
app.post('/api/auth/logout', (req, res) => res.json({ ok: true }));
app.get('/api/me', requireAuth, (req, res) => res.json(sessionUser(repo.userById(req.userId))));

// ── Helpers: create client / user, tenant guard ──────────────────────────────
function createClientRow(res, body) {
  const { username, name, password } = body || {};
  if (!username || !password) return res.status(400).json({ error: 'User id and password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (repo.userByUsername(username)) return res.status(409).json({ error: 'That user id is already taken.' });
  const u = repo.createClient({ id: genId(), username, name: name || username, password_hash: hashPassword(password), color: colorFor(username) });
  res.json(sessionUser(u));
}
function createUserRow(res, body, clientId, actor) {
  const { username, name, password } = body || {};
  const deposit = round2(body && body.deposit || 0);
  const commission_rate = Number(body && body.commission_rate) || 0;
  if (!username || !password) return res.status(400).json({ error: 'User id and password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (commission_rate < 0 || commission_rate > 100) return res.status(400).json({ error: 'Commission rate must be 0–100%.' });
  if (deposit < 0) return res.status(400).json({ error: 'Deposit cannot be negative.' });
  if (!clientId) return res.status(400).json({ error: 'A client must be specified.' });
  if (repo.userByUsername(username)) return res.status(409).json({ error: 'That user id is already taken.' });
  const u = repo.createUser({ id: genId(), username, name: name || username, password_hash: hashPassword(password), color: colorFor(username), client_id: clientId, commission_rate, deposit, actorId: actor.id, actorRole: actor.role });
  res.json(managedUser({ ...u, balance: deposit }));
}
// Loads req.params.id as a target USER and enforces tenant ownership for clients.
function loadTargetUser(req, res, next) {
  const t = repo.userById(req.params.id);
  if (!t || t.role !== 'user') return res.status(404).json({ error: 'User not found.' });
  if (req.role === 'client' && t.client_id !== req.userId) return res.status(403).json({ error: 'Forbidden.' });
  req.target = t;
  next();
}
function doCredit(req, res) {
  const amt = round2(req.body && req.body.amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });
  const balance = repo.credit({ userId: req.target.id, amount: amt, actorId: req.userId, actorRole: req.role });
  res.json({ balance });
}
function doDebit(req, res) {
  const amt = round2(req.body && req.body.amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });
  try { res.json({ balance: repo.debit({ userId: req.target.id, amount: amt, actorId: req.userId, actorRole: req.role }) }); }
  catch (e) { res.status(402).json({ error: 'Amount exceeds the user’s balance.' }); }
}
function doPatchUser(req, res) {
  const b = req.body || {};
  let u = req.target;
  if (b.status === 'active' || b.status === 'suspended') u = repo.setStatus(u.id, b.status);
  if (b.commission_rate != null) {
    const r = Number(b.commission_rate);
    if (r < 0 || r > 100) return res.status(400).json({ error: 'Commission rate must be 0–100%.' });
    u = repo.setCommission(u.id, r);
  }
  if (b.password) {
    if (String(b.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    u = repo.setPassword(u.id, hashPassword(b.password));
  }
  res.json(sessionUser(u));
}
function doResolveWithdrawal(req, res, approve) {
  const w = repo.getWithdrawal(Number(req.params.id));
  if (!w) return res.status(404).json({ error: 'Request not found.' });
  if (req.role === 'client' && w.client_id !== req.userId) return res.status(403).json({ error: 'Forbidden.' });
  try { res.json(publicWithdrawal(repo.resolveWithdrawal({ id: w.id, approve, resolverId: req.userId, resolverRole: req.role }))); }
  catch (e) { res.status(e.message === 'INSUFFICIENT' ? 402 : 409).json({ error: e.message === 'INSUFFICIENT' ? 'User balance no longer covers this withdrawal.' : 'Request already resolved.' }); }
}

// ── Admin routes ─────────────────────────────────────────────────────────────
app.post('/api/admin/clients', requireAuth, requireRole('system_admin'), (req, res) => createClientRow(res, req.body));
app.get('/api/admin/clients', requireAuth, requireRole('system_admin'), (req, res) => res.json(repo.listClients().map(sessionUser)));
app.patch('/api/admin/clients/:id', requireAuth, requireRole('system_admin'), (req, res) => {
  const c = repo.userById(req.params.id);
  if (!c || c.role !== 'client') return res.status(404).json({ error: 'Client not found.' });
  let out = c;
  if (req.body.status === 'active' || req.body.status === 'suspended') out = repo.setStatus(c.id, req.body.status);
  if (req.body.password) out = repo.setPassword(c.id, hashPassword(req.body.password));
  res.json(sessionUser(out));
});
app.get('/api/admin/users', requireAuth, requireRole('system_admin'), (req, res) => res.json(repo.listUsers(req.query.client_id).map(managedUser)));
app.post('/api/admin/users', requireAuth, requireRole('system_admin'), (req, res) => {
  const clientId = req.body && req.body.client_id;
  const c = clientId && repo.userById(clientId);
  if (!c || c.role !== 'client') return res.status(400).json({ error: 'Valid client_id required.' });
  createUserRow(res, req.body, clientId, { id: req.userId, role: 'system_admin' });
});
app.post('/api/admin/users/:id/credit', requireAuth, requireRole('system_admin'), loadTargetUser, doCredit);
app.post('/api/admin/users/:id/debit', requireAuth, requireRole('system_admin'), loadTargetUser, doDebit);
app.patch('/api/admin/users/:id', requireAuth, requireRole('system_admin'), loadTargetUser, doPatchUser);
app.get('/api/admin/withdrawals', requireAuth, requireRole('system_admin'), (req, res) => res.json(repo.withdrawalsAll().map(publicWithdrawal)));
app.post('/api/admin/withdrawals/:id/approve', requireAuth, requireRole('system_admin'), (req, res) => doResolveWithdrawal(req, res, true));
app.post('/api/admin/withdrawals/:id/reject', requireAuth, requireRole('system_admin'), (req, res) => doResolveWithdrawal(req, res, false));
app.get('/api/admin/reports', requireAuth, requireRole('system_admin'), (req, res) => res.json(repo.adminReport()));

// ── Client routes (tenant-scoped to req.userId) ──────────────────────────────
app.get('/api/client/users', requireAuth, requireRole('client'), (req, res) => res.json(repo.listUsers(req.userId).map(managedUser)));
app.post('/api/client/users', requireAuth, requireRole('client'), (req, res) => createUserRow(res, req.body, req.userId, { id: req.userId, role: 'client' }));
app.post('/api/client/users/:id/credit', requireAuth, requireRole('client'), loadTargetUser, doCredit);
app.post('/api/client/users/:id/debit', requireAuth, requireRole('client'), loadTargetUser, doDebit);
app.patch('/api/client/users/:id', requireAuth, requireRole('client'), loadTargetUser, doPatchUser);
app.get('/api/client/withdrawals', requireAuth, requireRole('client'), (req, res) => res.json(repo.withdrawalsByClient(req.userId).map(publicWithdrawal)));
app.post('/api/client/withdrawals/:id/approve', requireAuth, requireRole('client'), (req, res) => doResolveWithdrawal(req, res, true));
app.post('/api/client/withdrawals/:id/reject', requireAuth, requireRole('client'), (req, res) => doResolveWithdrawal(req, res, false));
app.get('/api/client/reports', requireAuth, requireRole('client'), (req, res) => res.json(repo.clientReport(req.userId)));

// ── Markets (public) ─────────────────────────────────────────────────────────
app.get('/api/markets', (req, res) => res.json(repo.listMarkets().map(publicMarket)));
app.get('/api/markets/:ticker', (req, res) => { const m = repo.getMarket(req.params.ticker); if (!m) return res.status(404).json({ error: 'Market not found.' }); res.json(publicMarket(m)); });
app.get('/api/markets/:ticker/book', (req, res) => { const m = repo.getMarket(req.params.ticker); if (!m) return res.status(404).json({ error: 'Market not found.' }); res.json(orderBook.snapshot(m.ticker, m.yes_price)); });

// ── User: portfolio, activity, orders, withdrawals ───────────────────────────
app.get('/api/portfolio', requireAuth, requireRole('user'), (req, res) => {
  const positions = repo.positions(req.userId).map(p => {
    const m = repo.getMarket(p.ticker);
    const current = m ? (p.side === 'YES' ? m.yes_price : m.no_price) : p.current_price;
    return publicPosition({ ...p, current_price: current });
  });
  res.json({ account: publicAccount(repo.account(req.userId)), positions });
});
app.get('/api/activity', requireAuth, requireRole('user'), (req, res) => res.json(repo.fills(req.userId).map(publicFill)));

/**
 * Place a buy. Amount-based: the User commits `amount` dollars. Commission
 * (rate% of the amount) is taken from it and accrues to the owning Client; the
 * remainder buys whole contracts at the exact Kalshi price (no spread).
 */
app.post('/api/orders', requireAuth, requireRole('user'), (req, res) => {
  const { ticker, side: rawSide } = req.body || {};
  const side = rawSide === 'NO' ? 'NO' : 'YES';
  const market = repo.getMarket(ticker);
  if (!market) return res.status(404).json({ error: 'Market not found.' });

  const mid = clamp(side === 'YES' ? market.yes_price : market.no_price, 1, 99);
  // Accept an explicit spend `amount`, or fall back to qty×mid for older callers.
  let gross = req.body && req.body.amount != null ? round2(req.body.amount)
            : req.body && req.body.qty != null ? round2(parseInt(req.body.qty, 10) * mid / 100) : NaN;
  if (!Number.isFinite(gross) || gross <= 0) return res.status(400).json({ error: 'Enter an amount to spend.' });

  const me = repo.userById(req.userId);
  const rate = Number(me.commission_rate) || 0;
  const commission = round2(gross * rate / 100);
  const buyingPower = round2(gross - commission);
  const qty = Math.floor(buyingPower * 100 / mid);
  if (qty < 1) return res.status(400).json({ error: `Amount too small — one contract costs ${mid}¢${rate ? ` (after ${rate}% commission)` : ''}.` });
  const cost = round2(qty * mid / 100);
  const totalDebit = round2(cost + commission);

  const acct = repo.account(req.userId);
  if (totalDebit > acct.balance) return res.status(402).json({ error: `Insufficient balance — this costs $${totalDebit.toFixed(2)} (incl. $${commission.toFixed(2)} commission).` });

  const { fill } = repo.bookOrder({ userId: req.userId, market, side, price: mid, qty, cost, commission, clientId: me.client_id });
  res.json({ fill: publicFill(fill), filledQty: qty, avgPrice: mid, commission, cost, spent: totalDebit });
});

app.post('/api/withdrawals', requireAuth, requireRole('user'), (req, res) => {
  const amt = round2(req.body && req.body.amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount.' });
  const me = repo.userById(req.userId);
  try { res.json(publicWithdrawal(repo.createWithdrawal({ userId: req.userId, clientId: me.client_id, amount: amt }))); }
  catch (e) { res.status(e.message === 'INSUFFICIENT' ? 402 : 400).json({ error: e.message === 'INSUFFICIENT' ? 'Amount exceeds your balance.' : 'Enter a valid amount.' }); }
});
app.get('/api/withdrawals/me', requireAuth, requireRole('user'), (req, res) => res.json(repo.withdrawalsByUser(req.userId).map(publicWithdrawal)));
app.patch('/api/account/profile', requireAuth, (req, res) => {
  const name = req.body && req.body.name;
  res.json(sessionUser(name ? repo.updateName(req.userId, name) : repo.userById(req.userId)));
});

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

app.listen(PORT, () => {
  console.log(`[predictex-server] listening on http://localhost:${PORT}`);
  console.log(`[predictex-server] database: ${DB_PATH}`);
  if (process.env.INGEST !== '0') { console.log(`[predictex-server] Kalshi ingester ON (${INGEST_MS / 1000}s)`); startIngest(INGEST_MS); }
  if (process.env.SETTLE !== '0') { const ms = Number(process.env.SETTLE_MS) || 120000; console.log(`[predictex-server] auto-settlement ON (${ms / 1000}s)`); startSettlement(ms); }
});
