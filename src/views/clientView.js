/**
 * views/clientView.js — Client dashboard: own users, withdrawals, reports.
 * Tenant-scoped by the backend; the client only ever sees its own users.
 */
const ClientView = (() => {
  const esc = Utils.escapeHtml, money = Utils.money;
  const ALL_CATEGORIES = ['Politics', 'Economics', 'Sports', 'Crypto', 'Weather', 'Technology', 'Entertainment'];
  let _tab = 'users';

  function render(state) {
    const u = state.session || {};
    return `
      <div class="dash">
        <div class="dash-top">
          <div class="navbar-logo" style="cursor:default">◈ Predictex <span class="dash-role">Client</span></div>
          <div class="dash-top-right"><span class="dash-who">${esc(u.name || '')}</span>
            <button class="btn btn-sm" onclick="App.logout()"><i class="ti ti-logout"></i> Sign out</button></div>
        </div>
        <div class="dash-tabs tab-group">
          ${['users', 'withdrawals', 'reports'].map(t =>
            `<button class="tab-item ${_tab === t ? 'active' : ''}" onclick="ClientView.tab('${t}')">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
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
      if (_tab === 'users') _renderUsers(await Api.client.users());
      else if (_tab === 'withdrawals') _renderWithdrawals(await Api.client.withdrawals());
      else if (_tab === 'reports') _renderReports(await Api.client.reports());
    } catch (e) { const b = _body(); if (b) b.innerHTML = `<div class="dash-empty">${esc(e.message)}</div>`; }
  }

  function _catsLabel(u) {
    if (!u.allowed_categories) return '<span class="text-muted">All</span>';
    const cats = u.allowed_categories;
    return cats.map(c => `<span class="cat-tag">${esc(c)}</span>`).join(' ');
  }
  function _renderUsers(users) {
    _body().innerHTML = `
      <div class="dash-section-title">Create user</div>
      <div class="inline-form">
        <div class="fld"><label>User ID</label><input id="u-user" placeholder="user id"></div>
        <div class="fld"><label>Password</label><input id="u-pass" type="password" placeholder="min 6"></div>
        <div class="fld sm"><label>Deposit $</label><input id="u-dep" type="number" value="0" min="0"></div>
        <div class="fld xs"><label>Comm %</label><input id="u-comm" type="number" value="0" min="0" max="100"></div>
      </div>
      <div class="category-access">
        <label class="category-access-label">Category access</label>
        <div class="category-checks">
          <label class="cat-check"><input type="checkbox" id="cat-all" checked onchange="ClientView.toggleAllCats(this.checked)"> <span>All categories</span></label>
          ${ALL_CATEGORIES.map(c => `<label class="cat-check"><input type="checkbox" class="cat-box" value="${c}" checked disabled> <span>${c}</span></label>`).join('')}
        </div>
      </div>
      <div style="margin-top:8px"><button class="btn btn-primary" onclick="ClientView.createUser()">Create user</button></div>
      <div class="dash-section-title">My users (${users.length})</div>
      ${users.length ? `<table class="dash-tbl"><thead><tr><th>User ID</th><th>Balance</th><th>Comm</th><th>Categories</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${users.map(u => `<tr><td><b>${esc(u.username)}</b></td><td class="tabular">${money(u.balance || 0)}</td>
          <td>${u.commission_rate}%</td>
          <td>${_catsLabel(u)}</td>
          <td><span class="st st-${u.status}">${u.status}</span></td>
          <td class="row-actions">
            <button onclick="ClientView.viewPortfolio('${u.id}')">Portfolio</button>
            <button onclick="ClientView.credit('${u.id}')">Credit</button>
            <button class="danger" onclick="ClientView.debit('${u.id}')">Debit</button>
            <button onclick="ClientView.setComm('${u.id}',${u.commission_rate})">Comm</button>
            <button onclick="ClientView.editCats('${u.id}')">Cats</button>
            <button onclick="ClientView.resetPw('${u.id}')">Reset pw</button>
            <button onclick="ClientView.toggleUser('${u.id}','${u.status}')">${u.status === 'active' ? 'Suspend' : 'Activate'}</button>
          </td></tr>`).join('')}
      </tbody></table>` : '<div class="dash-empty">No users yet — create one above.</div>'}`;
  }

  function _renderWithdrawals(ws) {
    _body().innerHTML = `<div class="dash-section-title">Withdrawal requests (${ws.length})</div>
      ${ws.length ? `<table class="dash-tbl"><thead><tr><th>User</th><th>Amount</th><th>Status</th><th>When</th><th>Actions</th></tr></thead><tbody>
        ${ws.map(w => `<tr><td><b>${esc(w.user)}</b></td><td class="tabular">${money(w.amount)}</td>
          <td><span class="st st-${w.status}">${w.status}</span></td><td>${Utils.timeAgo(new Date(w.createdAt).toISOString())}</td>
          <td class="row-actions">${w.status === 'pending' ? `<button onclick="ClientView.approve(${w.id})">Approve</button><button class="danger" onclick="ClientView.reject(${w.id})">Reject</button>` : '—'}</td></tr>`).join('')}
      </tbody></table>` : '<div class="dash-empty">No withdrawal requests.</div>'}`;
  }

  function _renderReports(r) {
    const s = r.summary || {};
    const card = (label, val, sub) => `<div class="metric-card"><div class="metric-label">${label}</div><div class="metric-value">${val}</div>${sub ? `<div class="metric-sub">${sub}</div>` : ''}</div>`;
    const rows = (r.users || []).map(u => `<tr>
      <td><b>${esc(u.username)}</b>${u.status !== 'active' ? ` <span class="st st-${u.status}">${u.status}</span>` : ''}</td>
      <td class="tabular">${money(u.balance)}</td>
      <td class="tabular">${money(u.credited)}</td>
      <td class="tabular">${money(u.withdrawn)}</td>
      <td class="tabular">${money(u.volume)}</td>
      <td>${u.positions}</td>
      <td>${u.commission_rate}%</td>
      <td class="tabular"><b style="color:var(--text-success)">${money(u.commission)}</b></td></tr>`).join('');
    _body().innerHTML = `
      <div class="report-cards">
        ${card('My users', s.users, s.activeUsers + ' active')}${card('Users’ balance', money(s.totalBalance))}
        ${card('Commission earned', money(s.commission))}${card('Credited in', money(s.credited))}
        ${card('Withdrawn out', money(s.withdrawn))}${card('Trade volume', money(s.volume))}
        ${card('Pending withdrawals', s.pendingWithdrawals, s.pendingAmount ? money(s.pendingAmount) : '')}
      </div>
      <div class="dash-section-title" style="margin-top:26px">Per-user breakdown</div>
      ${(r.users && r.users.length) ? `<table class="dash-tbl"><thead><tr>
        <th>User</th><th>Balance</th><th>Credited</th><th>Withdrawn</th><th>Volume</th><th>Positions</th><th>Rate</th><th>Commission</th></tr></thead>
        <tbody>${rows}</tbody></table>` : '<div class="dash-empty">No users yet.</div>'}`;
  }

  // ── Actions ──
  const val = (id) => document.getElementById(id)?.value?.trim();
  async function _do(fn, okMsg) { try { await fn(); if (okMsg) Toast.show(okMsg, 'success'); _load(); } catch (e) { Toast.show(e.message, 'error'); } }

  function toggleAllCats(checked) {
    document.querySelectorAll('.cat-box').forEach(cb => { cb.disabled = checked; cb.checked = checked; });
  }
  function _getSelectedCats() {
    const allChecked = document.getElementById('cat-all')?.checked;
    if (allChecked) return null;
    return [...document.querySelectorAll('.cat-box:checked')].map(cb => cb.value);
  }
  function createUser() {
    const username = val('u-user'), password = val('u-pass');
    if (!username || !password) return Toast.show('User id and password required.', 'error');
    const cats = _getSelectedCats();
    if (cats && cats.length === 0) return Toast.show('Select at least one category.', 'error');
    _do(() => Api.client.createUser({ username, password, deposit: +val('u-dep') || 0, commission_rate: +val('u-comm') || 0, allowed_categories: cats }), 'User created.');
  }
  function editCats(id) {
    Api.client.users().then(users => {
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
        _do(() => Api.client.patchUser(id, { allowed_categories: cats }), 'Categories updated.');
      });
    });
  }
  function credit(id) {
    Modal.show('Credit user', '<div class="form-group"><label class="form-label">Amount ($)</label><input class="form-input" type="number" id="modal-input" min="0" step="0.01" placeholder="0.00"></div>', () => {
      const a = +val('modal-input'); if (!a || a <= 0) { Toast.show('Enter a valid amount.', 'error'); return false; }
      _do(() => Api.client.credit(id, a), 'Credited.');
    });
    setTimeout(() => document.getElementById('modal-input')?.focus(), 60);
  }
  function debit(id) {
    Modal.show('Debit user', '<div class="form-group"><label class="form-label">Amount ($)</label><input class="form-input" type="number" id="modal-input" min="0" step="0.01" placeholder="0.00"></div>', () => {
      const a = +val('modal-input'); if (!a || a <= 0) { Toast.show('Enter a valid amount.', 'error'); return false; }
      _do(() => Api.client.debit(id, a), 'Debited.');
    });
    setTimeout(() => document.getElementById('modal-input')?.focus(), 60);
  }
  function setComm(id, cur) {
    Modal.show('Set commission', `<div class="form-group"><label class="form-label">Commission rate (%)</label><input class="form-input" type="number" id="modal-input" min="0" max="100" step="0.1" value="${cur}"></div>`, () => {
      const r = val('modal-input'); if (r === '') { Toast.show('Enter a rate.', 'error'); return false; }
      _do(() => Api.client.patchUser(id, { commission_rate: +r }), 'Commission updated.');
    });
    setTimeout(() => document.getElementById('modal-input')?.focus(), 60);
  }
  function resetPw(id) {
    Modal.show('Reset password', '<div class="form-group"><label class="form-label">New password (min 6)</label><input class="form-input" type="password" id="modal-input" placeholder="min 6 characters"></div>', () => {
      const p = val('modal-input'); if (!p || p.length < 6) { Toast.show('Password must be at least 6 characters.', 'error'); return false; }
      _do(() => Api.client.patchUser(id, { password: p }), 'Password reset.');
    });
    setTimeout(() => document.getElementById('modal-input')?.focus(), 60);
  }
  async function viewPortfolio(id) {
    try {
      const data = await Api.client.portfolio(id);
      PortfolioModal.show(data);
    } catch (e) { Toast.show(e.message, 'error'); }
  }
  function toggleUser(id, st) { _do(() => Api.client.patchUser(id, { status: st === 'active' ? 'suspended' : 'active' })); }
  function approve(id) { _do(() => Api.client.approve(id), 'Approved.'); }
  function reject(id) { _do(() => Api.client.reject(id), 'Rejected.'); }

  return { render, mount, tab, createUser, toggleAllCats, viewPortfolio, editCats, credit, debit, setComm, resetPw, toggleUser, approve, reject };
})();
