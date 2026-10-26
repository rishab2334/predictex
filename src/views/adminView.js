/**
 * views/adminView.js — System Admin console: clients, users, withdrawals, reports.
 * Standalone layout. Fetches per-tab and re-renders #dash-body after each action.
 */
const AdminView = (() => {
  const esc = Utils.escapeHtml, money = Utils.money;
  const ALL_CATEGORIES = ['Politics', 'Economics', 'Sports', 'Crypto', 'Weather', 'Technology', 'Entertainment'];
  let _tab = 'clients';
  let _clients = [];

  function render(state) {
    const u = state.session || {};
    return `
      <div class="dash">
        <div class="dash-top">
          <div class="navbar-logo" style="cursor:default">◈ Predictex <span class="dash-role">Admin</span></div>
          <div class="dash-top-right"><span class="dash-who">${esc(u.name || '')}</span>
            <button class="btn btn-sm" onclick="App.logout()"><i class="ti ti-logout"></i> Sign out</button></div>
        </div>
        <div class="dash-tabs tab-group">
          ${['clients', 'users', 'withdrawals', 'reports'].map(t =>
            `<button class="tab-item ${_tab === t ? 'active' : ''}" onclick="AdminView.tab('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
        </div>
        <div class="dash-body" id="dash-body"><div class="dash-empty"><span class="spinner"></span></div></div>
      </div>`;
  }
  function mount() { _load(); }
  function tab(t) { _tab = t; document.querySelectorAll('.dash-tabs .tab-item').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === t)); _load(); }
  function _body() { return document.getElementById('dash-body'); }
  function _spin() { const b = _body(); if (b) b.innerHTML = '<div class="dash-empty"><span class="spinner"></span></div>'; }

  async function _load() {
    _spin();
    try {
      if (_tab === 'clients') { _clients = await Api.admin.clients(); _renderClients(); }
      else if (_tab === 'users') { _clients = await Api.admin.clients(); _renderUsers(await Api.admin.users()); }
      else if (_tab === 'withdrawals') _renderWithdrawals(await Api.admin.withdrawals());
      else if (_tab === 'reports') _renderReports(await Api.admin.reports());
    } catch (e) { const b = _body(); if (b) b.innerHTML = `<div class="dash-empty">${esc(e.message)}</div>`; }
  }

  function _renderClients() {
    _body().innerHTML = `
      <div class="dash-section-title">Create client</div>
      <div class="inline-form">
        <div class="fld"><label>User ID</label><input id="c-user" placeholder="client id"></div>
        <div class="fld"><label>Name</label><input id="c-name" placeholder="display name"></div>
        <div class="fld"><label>Password</label><input id="c-pass" type="password" placeholder="min 6"></div>
        <button class="btn btn-primary" onclick="AdminView.createClient()">Create client</button>
      </div>
      <div class="dash-section-title">Clients (${_clients.length})</div>
      ${_clients.length ? `<table class="dash-tbl"><thead><tr><th>User ID</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${_clients.map(c => `<tr><td><b>${esc(c.username)}</b></td><td>${esc(c.name)}</td>
          <td><span class="st st-${c.status}">${c.status}</span></td>
          <td class="row-actions">
            <button onclick="AdminView.toggleClient('${c.id}','${c.status}')">${c.status === 'active' ? 'Suspend' : 'Activate'}</button>
            <button onclick="AdminView.resetClientPw('${c.id}')">Reset pw</button>
          </td></tr>`).join('')}
      </tbody></table>` : '<div class="dash-empty">No clients yet.</div>'}`;
  }

  function _renderUsers(users) {
    const opts = _clients.map(c => `<option value="${c.id}">${esc(c.username)}</option>`).join('');
    _body().innerHTML = `
      <div class="dash-section-title">Create user</div>
      <div class="inline-form">
        <div class="fld"><label>Client</label><select id="u-client">${opts}</select></div>
        <div class="fld"><label>User ID</label><input id="u-user" placeholder="user id"></div>
        <div class="fld"><label>Password</label><input id="u-pass" type="password" placeholder="min 6"></div>
        <div class="fld sm"><label>Deposit $</label><input id="u-dep" type="number" value="0" min="0"></div>
        <div class="fld xs"><label>Comm %</label><input id="u-comm" type="number" value="0" min="0" max="100"></div>
      </div>
      <div class="category-access">
        <label class="category-access-label">Category access</label>
        <div class="category-checks">
          <label class="cat-check"><input type="checkbox" id="cat-all" checked onchange="AdminView.toggleAllCats(this.checked)"> <span>All categories</span></label>
          ${ALL_CATEGORIES.map(c => `<label class="cat-check"><input type="checkbox" class="cat-box" value="${c}" checked disabled> <span>${c}</span></label>`).join('')}
        </div>
      </div>
      <div style="margin-top:8px"><button class="btn btn-primary" onclick="AdminView.createUser()">Create user</button></div>
      ${_usersTable(users, true)}`;
  }

  function _catsLabel(u) {
    if (!u.allowed_categories) return '<span class="text-muted">All</span>';
    const cats = u.allowed_categories;
    return cats.map(c => `<span class="cat-tag">${esc(c)}</span>`).join(' ');
  }
  function _usersTable(users, withClient) {
    const cmap = {}; _clients.forEach(c => cmap[c.id] = c.username);
    return `<div class="dash-section-title">Users (${users.length})</div>
      ${users.length ? `<table class="dash-tbl"><thead><tr><th>User ID</th>${withClient ? '<th>Client</th>' : ''}<th>Balance</th><th>Comm</th><th>Categories</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${users.map(u => `<tr><td><b>${esc(u.username)}</b></td>${withClient ? `<td>${esc(cmap[u.client_id] || '—')}</td>` : ''}
          <td class="tabular">${money(u.balance || 0)}</td><td>${u.commission_rate}%</td>
          <td>${_catsLabel(u)}</td>
          <td><span class="st st-${u.status}">${u.status}</span></td>
          <td class="row-actions">
            <button onclick="AdminView.credit('${u.id}')">Credit</button>
            <button class="danger" onclick="AdminView.debit('${u.id}')">Debit</button>
            <button onclick="AdminView.setComm('${u.id}',${u.commission_rate})">Comm</button>
            <button onclick="AdminView.editCats('${u.id}')">Cats</button>
            <button onclick="AdminView.toggleUser('${u.id}','${u.status}')">${u.status === 'active' ? 'Suspend' : 'Activate'}</button>
          </td></tr>`).join('')}
      </tbody></table>` : '<div class="dash-empty">No users yet.</div>'}`;
  }

  function _renderWithdrawals(ws) {
    _body().innerHTML = `<div class="dash-section-title">Withdrawal requests (${ws.length})</div>
      ${ws.length ? `<table class="dash-tbl"><thead><tr><th>User</th><th>Amount</th><th>Status</th><th>When</th><th>Actions</th></tr></thead><tbody>
        ${ws.map(w => `<tr><td><b>${esc(w.user)}</b></td><td class="tabular">${money(w.amount)}</td>
          <td><span class="st st-${w.status}">${w.status}</span></td><td>${Utils.timeAgo(new Date(w.createdAt).toISOString())}</td>
          <td class="row-actions">${w.status === 'pending' ? `<button onclick="AdminView.approve(${w.id})">Approve</button><button class="danger" onclick="AdminView.reject(${w.id})">Reject</button>` : '—'}</td></tr>`).join('')}
      </tbody></table>` : '<div class="dash-empty">No withdrawal requests.</div>'}`;
  }

  function _renderReports(r) {
    const s = r.summary || {};
    const card = (label, val, sub) => `<div class="metric-card"><div class="metric-label">${label}</div><div class="metric-value">${val}</div>${sub ? `<div class="metric-sub">${sub}</div>` : ''}</div>`;
    const rows = (r.clients || []).map(c => `<tr>
      <td><b>${esc(c.username)}</b>${c.status !== 'active' ? ` <span class="st st-${c.status}">${c.status}</span>` : ''}</td>
      <td>${c.activeUsers}/${c.users}</td>
      <td class="tabular">${money(c.balance)}</td>
      <td class="tabular">${money(c.credited)}</td>
      <td class="tabular">${money(c.withdrawn)}</td>
      <td class="tabular">${money(c.volume)}</td>
      <td class="tabular"><b style="color:var(--text-success)">${money(c.commission)}</b></td>
      <td>${c.pending || '—'}</td></tr>`).join('');
    _body().innerHTML = `
      <div class="report-cards">
        ${card('Clients', s.clients)}${card('Users', s.users, s.activeUsers + ' active')}
        ${card('Total wallets', money(s.totalBalance))}${card('Commission earned', money(s.totalCommission))}
        ${card('Credited in', money(s.totalCredited))}${card('Withdrawn out', money(s.totalWithdrawn))}
        ${card('Trade volume', money(s.totalVolume))}${card('Settlement payouts', money(s.totalPayout))}
        ${card('Pending withdrawals', s.pendingWithdrawals)}
      </div>
      <div class="dash-section-title" style="margin-top:26px">Per-client breakdown</div>
      ${(r.clients && r.clients.length) ? `<table class="dash-tbl"><thead><tr>
        <th>Client</th><th>Users</th><th>Wallets</th><th>Credited</th><th>Withdrawn</th><th>Volume</th><th>Commission</th><th>Pending</th></tr></thead>
        <tbody>${rows}</tbody></table>` : '<div class="dash-empty">No clients yet.</div>'}`;
  }

  // ── Actions ──
  const val = (id) => document.getElementById(id)?.value?.trim();
  async function _do(fn, okMsg) { try { await fn(); if (okMsg) Toast.show(okMsg, 'success'); _load(); } catch (e) { Toast.show(e.message, 'error'); } }

  function createClient() {
    const username = val('c-user'), password = val('c-pass');
    if (!username || !password) return Toast.show('User id and password required.', 'error');
    _do(() => Api.admin.createClient({ username, name: val('c-name'), password }), 'Client created.');
  }
  function toggleAllCats(checked) {
    document.querySelectorAll('.cat-box').forEach(cb => { cb.disabled = checked; cb.checked = checked; });
  }
  function _getSelectedCats() {
    const allChecked = document.getElementById('cat-all')?.checked;
    if (allChecked) return null;
    return [...document.querySelectorAll('.cat-box:checked')].map(cb => cb.value);
  }
  function createUser() {
    const username = val('u-user'), password = val('u-pass'), client_id = val('u-client');
    if (!client_id) return Toast.show('Select a client.', 'error');
    if (!username || !password) return Toast.show('User id and password required.', 'error');
    const cats = _getSelectedCats();
    if (cats && cats.length === 0) return Toast.show('Select at least one category.', 'error');
    _do(() => Api.admin.createUser({ client_id, username, password, deposit: +val('u-dep') || 0, commission_rate: +val('u-comm') || 0, allowed_categories: cats }), 'User created.');
  }
  function credit(id) {
    Modal.show('Credit user', '<div class="form-group"><label class="form-label">Amount ($)</label><input class="form-input" type="number" id="modal-input" min="0" step="0.01" placeholder="0.00"></div>', () => {
      const a = +val('modal-input'); if (!a || a <= 0) { Toast.show('Enter a valid amount.', 'error'); return false; }
      _do(() => Api.admin.credit(id, a), 'Credited.');
    });
    setTimeout(() => document.getElementById('modal-input')?.focus(), 60);
  }
  function debit(id) {
    Modal.show('Debit user', '<div class="form-group"><label class="form-label">Amount ($)</label><input class="form-input" type="number" id="modal-input" min="0" step="0.01" placeholder="0.00"></div>', () => {
      const a = +val('modal-input'); if (!a || a <= 0) { Toast.show('Enter a valid amount.', 'error'); return false; }
      _do(() => Api.admin.debit(id, a), 'Debited.');
    });
    setTimeout(() => document.getElementById('modal-input')?.focus(), 60);
  }
  function setComm(id, cur) {
    Modal.show('Set commission', `<div class="form-group"><label class="form-label">Commission rate (%)</label><input class="form-input" type="number" id="modal-input" min="0" max="100" step="0.1" value="${cur}"></div>`, () => {
      const r = val('modal-input'); if (r === '') { Toast.show('Enter a rate.', 'error'); return false; }
      _do(() => Api.admin.patchUser(id, { commission_rate: +r }), 'Commission updated.');
    });
    setTimeout(() => document.getElementById('modal-input')?.focus(), 60);
  }
  function toggleUser(id, st) { _do(() => Api.admin.patchUser(id, { status: st === 'active' ? 'suspended' : 'active' })); }
  function toggleClient(id, st) { _do(() => Api.admin.patchClient(id, { status: st === 'active' ? 'suspended' : 'active' })); }
  function resetClientPw(id) {
    Modal.show('Reset password', '<div class="form-group"><label class="form-label">New password (min 6)</label><input class="form-input" type="password" id="modal-input" placeholder="min 6 characters"></div>', () => {
      const p = val('modal-input'); if (!p || p.length < 6) { Toast.show('Password must be at least 6 characters.', 'error'); return false; }
      _do(() => Api.admin.patchClient(id, { password: p }), 'Password reset.');
    });
    setTimeout(() => document.getElementById('modal-input')?.focus(), 60);
  }
  function editCats(id) {
    Api.admin.users().then(users => {
      const u = users.find(x => x.id === id);
      if (!u) return;
      const current = u.allowed_categories || ALL_CATEGORIES;
      const html = ALL_CATEGORIES.map(c =>
        `<label style="display:block;margin:4px 0"><input type="checkbox" value="${c}" ${current.includes(c) ? 'checked' : ''}> ${c}</label>`
      ).join('');
      Modal.show('Category access — ' + esc(u.username), `
        <div id="edit-cats-form">${html}</div>
        <label style="display:block;margin:8px 0 0"><input type="checkbox" id="edit-cats-all" ${!u.allowed_categories ? 'checked' : ''} onchange="document.querySelectorAll('#edit-cats-form input').forEach(cb=>{cb.disabled=this.checked;cb.checked=this.checked})"> All categories</label>
      `, () => {
        const allChecked = document.getElementById('edit-cats-all')?.checked;
        const cats = allChecked ? null : [...document.querySelectorAll('#edit-cats-form input:checked')].map(cb => cb.value);
        if (!allChecked && (!cats || cats.length === 0)) { Toast.show('Select at least one category.', 'error'); return false; }
        _do(() => Api.admin.patchUser(id, { allowed_categories: cats }), 'Categories updated.');
      });
    });
  }
  function approve(id) { _do(() => Api.admin.approve(id), 'Approved.'); }
  function reject(id) { _do(() => Api.admin.reject(id), 'Rejected.'); }

  return { render, mount, tab, createClient, createUser, toggleAllCats, credit, debit, setComm, editCats, toggleUser, toggleClient, resetClientPw, approve, reject };
})();
