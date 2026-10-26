/**
 * core/api.js — data-access gateway (backend-required for RBAC).
 *
 * Auth is username-based and returns a role (system_admin | client | user). The
 * gateway hydrates the Store after auth (user data only for role 'user') and
 * exposes namespaced admin.* / client.* management calls plus the user-facing
 * markets/orders/portfolio/withdrawals. Market reads keep a local fallback so the
 * markets grid still renders if the backend is briefly unreachable.
 */
class ApiError extends Error { constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status || 0; } }

const Api = (() => {
  async function _req(method, path, body) {
    const token = Store.get().session && Store.get().session.token;
    let res;
    try {
      res = await fetch(Config.apiBaseUrl + '/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: body != null ? JSON.stringify(body) : undefined,
      });
    } catch (e) { throw new ApiError('Network error — could not reach the server.', 0); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || ('Request failed (' + res.status + ')'), res.status);
    return data;
  }

  async function _hydrateUserData() {
    const [pf, act] = await Promise.all([_req('GET', '/portfolio'), _req('GET', '/activity')]);
    Store.update(s => { s.account = pf.account; s.positions = pf.positions; s.activity = act; });
  }

  return {
    // ── Auth ──
    auth: {
      async login(username, password) {
        const { user, token } = await _req('POST', '/auth/login', { username, password });
        Store.update(s => { s.session = { ...user, token }; });
        if (user.role === 'user') { try { await _hydrateUserData(); } catch (e) {} }
        return { user: Store.get().session, token };
      },
      async logout() { try { await _req('POST', '/auth/logout'); } finally { Store.reset(); } },
    },
    async me() { return _req('GET', '/me'); },
    async refreshSession() { if (Store.get().session && Store.get().session.role === 'user') await _hydrateUserData(); },

    // ── Markets (public; local fallback keeps the grid alive offline) ──
    markets: {
      async loadLive() {
        // Retry a few times so a transient boot hiccup doesn't leave the app on
        // stale seed data (which would fail orders with "market not found").
        let last;
        for (let i = 0; i < 3; i++) {
          try { const m = await _req('GET', '/markets'); Store.update(s => { s.markets = m; s.marketsLive = true; }); return { ok: true, markets: m }; }
          catch (e) { last = e; await new Promise(r => setTimeout(r, 500)); }
        }
        throw last; // let the caller mark offline; the 60s poll then recovers
      },
      async refresh()  { const m = await _req('GET', '/markets'); Store.update(s => { s.markets = m; s.marketsLive = true; }); return { ok: true, markets: m }; },
      async get(t)     { return _req('GET', '/markets/' + encodeURIComponent(t)); },
      async book(t)    { return _req('GET', '/markets/' + encodeURIComponent(t) + '/book'); },
    },

    // ── User: trading, portfolio, withdrawals ──
    portfolio: { get: () => _req('GET', '/portfolio') },
    activity:  { list: () => _req('GET', '/activity') },
    orders: { async place(order) { const res = await _req('POST', '/orders', order); await _hydrateUserData(); return res; } },
    withdrawals: {
      async create(amount) { const r = await _req('POST', '/withdrawals', { amount }); await _hydrateUserData(); return r; },
      mine: () => _req('GET', '/withdrawals/me'),
    },
    account: { async updateProfile(patch) { const u = await _req('PATCH', '/account/profile', patch); Store.update(s => { if (s.session) Object.assign(s.session, u); }); return u; } },

    // ── System Admin ──
    admin: {
      clients:       () => _req('GET', '/admin/clients'),
      createClient:  (b) => _req('POST', '/admin/clients', b),
      patchClient:   (id, b) => _req('PATCH', '/admin/clients/' + id, b),
      users:         (clientId) => _req('GET', '/admin/users' + (clientId ? '?client_id=' + encodeURIComponent(clientId) : '')),
      createUser:    (b) => _req('POST', '/admin/users', b),
      credit:        (id, amount) => _req('POST', '/admin/users/' + id + '/credit', { amount }),
      debit:         (id, amount) => _req('POST', '/admin/users/' + id + '/debit', { amount }),
      patchUser:     (id, b) => _req('PATCH', '/admin/users/' + id, b),
      withdrawals:   () => _req('GET', '/admin/withdrawals'),
      approve:       (id) => _req('POST', '/admin/withdrawals/' + id + '/approve'),
      reject:        (id) => _req('POST', '/admin/withdrawals/' + id + '/reject'),
      reports:       () => _req('GET', '/admin/reports'),
    },

    // ── Client ──
    client: {
      users:        () => _req('GET', '/client/users'),
      createUser:   (b) => _req('POST', '/client/users', b),
      credit:       (id, amount) => _req('POST', '/client/users/' + id + '/credit', { amount }),
      debit:        (id, amount) => _req('POST', '/client/users/' + id + '/debit', { amount }),
      patchUser:    (id, b) => _req('PATCH', '/client/users/' + id, b),
      withdrawals:  () => _req('GET', '/client/withdrawals'),
      approve:      (id) => _req('POST', '/client/withdrawals/' + id + '/approve'),
      reject:       (id) => _req('POST', '/client/withdrawals/' + id + '/reject'),
      reports:      () => _req('GET', '/client/reports'),
    },
  };
})();
