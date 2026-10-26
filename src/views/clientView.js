/**
 * views/clientView.js — Client dashboard: own users, withdrawals, reports.
 * Tenant-scoped by the backend; the client only ever sees its own users.
 */
const ClientView = (() => {
  const esc = Utils.escapeHtml, money = Utils.money;
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

  function _renderUsers(users) {
    _body().innerHTML = `
      <div class="dash-section-title">Create user</div>
      <div class="inline-form">
        <div class="fld"><label>User ID</label><input id="u-user" placeholder="user id"></div>
        <div class="fld"><label>Password</label><input id="u-pass" type="password" placeholder="min 6"></div>
        <div class="fld sm"><label>Deposit $</label><input id="u-dep" type="number" value="0" min="0"></div>
        <div class="fld xs"><label>Comm %</label><input id="u-comm" type="number" value="0" min="0" max="100"></div>
        <button class="btn btn-primary" onclick="ClientView.createUser()">Create user</button>
      </div>
      <div class="dash-section-title">My users (${users.length})</div>
      ${users.length ? `<table class="dash-tbl"><thead><tr><th>User ID</th><th>Balance</th><th>Comm</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        ${users.map(u => `<tr><td><b>${esc(u.username)}</b></td><td class="tabular">${money(u.balance || 0)}</td>
          <td>${u.commission_rate}%</td><td><span class="st st-${u.status}">${u.status}</span></td>
          <td class="row-actions">
            <button onclick="ClientView.credit('${u.id}')">Credit</button>
            <button class="danger" onclick="ClientView.debit('${u.id}')">Debit</button>
            <button onclick="ClientView.setComm('${u.id}',${u.commission_rate})">Comm</button>
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

  function createUser() {
    const username = val('u-user'), password = val('u-pass');
    if (!username || !password) return Toast.show('User id and password required.', 'error');
    _do(() => Api.client.createUser({ username, password, deposit: +val('u-dep') || 0, commission_rate: +val('u-comm') || 0 }), 'User created.');
  }
  function credit(id) { const a = prompt('Credit amount ($):'); if (a) _do(() => Api.client.credit(id, +a), 'Credited.'); }
  function debit(id) { const a = prompt('Debit amount ($):'); if (a) _do(() => Api.client.debit(id, +a), 'Debited.'); }
  function setComm(id, cur) { const r = prompt('Commission rate (%):', cur); if (r !== null) _do(() => Api.client.patchUser(id, { commission_rate: +r }), 'Commission updated.'); }
  function resetPw(id) { const p = prompt('New password (min 6):'); if (p) _do(() => Api.client.patchUser(id, { password: p }), 'Password reset.'); }
  function toggleUser(id, st) { _do(() => Api.client.patchUser(id, { status: st === 'active' ? 'suspended' : 'active' })); }
  function approve(id) { _do(() => Api.client.approve(id), 'Approved.'); }
  function reject(id) { _do(() => Api.client.reject(id), 'Rejected.'); }

  return { render, mount, tab, createUser, credit, debit, setComm, resetPw, toggleUser, approve, reject };
})();
