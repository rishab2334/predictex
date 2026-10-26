/**
 * components/navbar.js — top navigation for authenticated pages.
 * Tabs + search + balance + account menu + mobile drawer.
 */
const Navbar = (() => {
  const TABS = [
    { id: 'home',      label: 'Markets',   icon: 'ti-chart-bar' },
    { id: 'portfolio', label: 'Portfolio', icon: 'ti-wallet'    },
    { id: 'activity',  label: 'Activity',  icon: 'ti-history'   },
  ];
  let _searchTimer = null;

  function render() {
    const s        = Store.get();
    const user     = s.session;
    const current  = s.ui.route;
    const initials = user ? user.name.slice(0, 2).toUpperCase() : 'TR';
    const color    = user ? user.color : '#00b17a';
    const balance  = Utils.money(s.account.balance);
    const query    = s.ui.search || '';

    return `
      <nav class="navbar">
        <div class="navbar-logo" onclick="App.navigate('home')" role="button" tabindex="0">◈ Predictex</div>

        <div class="navbar-nav" id="navbar-tabs">
          ${TABS.map(t => `
            <button class="tab-item ${t.id === current ? 'active' : ''}" onclick="App.navigate('${t.id}')" data-page="${t.id}">
              <i class="ti ${t.icon}" aria-hidden="true"></i> ${t.label}
            </button>`).join('')}
        </div>

        <div class="navbar-search" id="navbar-search-wrap">
          <i class="ti ti-search navbar-search-icon" aria-hidden="true"></i>
          <input class="navbar-search-input" type="search" placeholder="Search markets…" id="navbar-search-input"
            value="${Utils.escapeHtml(query)}" autocomplete="off"
            oninput="Navbar._onSearchInput(this.value)"
            onkeydown="if(event.key==='Enter')App.search(this.value.trim())" aria-label="Search markets" />
        </div>

        <div class="navbar-right">
          <div class="navbar-balance">
            <span class="navbar-balance-label">Balance</span>
            <span id="navbar-balance-value">${balance}</span>
          </div>

          <button class="btn btn-sm" onclick="App.requestWithdrawal()"><i class="ti ti-arrow-down" aria-hidden="true"></i> Withdraw</button>

          <div style="position:relative">
            <button class="avatar-btn" id="avatar-btn" onclick="Navbar.toggleUserMenu(event)" aria-label="Account menu" aria-haspopup="true">
              <div class="avatar" style="background:${color}">${Utils.escapeHtml(initials)}</div>
            </button>
            <div class="user-dropdown" id="user-dropdown" style="display:none" role="menu">
              <div class="user-dropdown-header">
                <div class="avatar avatar-lg" style="background:${color}">${Utils.escapeHtml(initials)}</div>
                <div>
                  <div class="user-dropdown-name">${Utils.escapeHtml(user ? user.name : '')}</div>
                  <div class="user-dropdown-email">${Utils.escapeHtml(user ? user.email : '')}</div>
                </div>
              </div>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item" onclick="App.navigate('portfolio');Navbar.closeAll()"><i class="ti ti-wallet"></i> Portfolio</button>
              <button class="dropdown-item" onclick="App.navigate('activity');Navbar.closeAll()"><i class="ti ti-history"></i> Trade history</button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item dropdown-item-danger" onclick="App.logout()"><i class="ti ti-logout"></i> Sign out</button>
            </div>
          </div>

          <button class="hamburger-btn" id="hamburger-btn" onclick="Navbar.toggleMobileMenu(event)" aria-label="Open menu">
            <i class="ti ti-menu-2"></i>
          </button>
        </div>
      </nav>

      <div class="mobile-drawer" id="mobile-drawer">
        <div class="mobile-drawer-inner">
          <div class="mobile-drawer-header">
            <div class="navbar-logo" style="font-size:16px">◈ Predictex</div>
            <button class="icon-btn" onclick="Navbar.closeMobileMenu()" aria-label="Close menu"><i class="ti ti-x"></i></button>
          </div>
          <div class="mobile-user-info">
            <div class="avatar" style="background:${color};width:40px;height:40px;font-size:14px">${Utils.escapeHtml(initials)}</div>
            <div>
              <div style="font-weight:500;font-size:13px">${Utils.escapeHtml(user ? user.name : '')}</div>
              <div style="font-size:12px;color:var(--text-muted)">${balance}</div>
            </div>
          </div>
          <div class="mobile-nav-list">
            ${TABS.map(t => `
              <button class="mobile-nav-item ${t.id === current ? 'active' : ''}" onclick="App.navigate('${t.id}');Navbar.closeMobileMenu()">
                <i class="ti ${t.icon}"></i> ${t.label}
              </button>`).join('')}
          </div>
          <div class="mobile-drawer-actions">
            <button class="btn btn-primary" style="width:100%" onclick="App.requestWithdrawal();Navbar.closeMobileMenu()"><i class="ti ti-arrow-down"></i> Withdraw</button>
            <button class="btn btn-ghost" style="width:100%;color:var(--text-danger)" onclick="App.logout()"><i class="ti ti-logout"></i> Sign out</button>
          </div>
        </div>
      </div>`;
  }

  /** Repaint just the balance figure after a trade/deposit (no re-render). */
  function patchBalance() {
    const el = document.getElementById('navbar-balance-value');
    if (el) el.textContent = Utils.money(Store.get().account.balance);
  }

  function _onSearchInput(value) {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => App.search(value.trim()), 280);
  }

  function toggleUserMenu(e) {
    e.stopPropagation();
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
  }
  function toggleMobileMenu(e) { e.stopPropagation(); document.getElementById('mobile-drawer')?.classList.toggle('open'); }
  function closeMobileMenu()   { document.getElementById('mobile-drawer')?.classList.remove('open'); }
  function closeAll()          { const dd = document.getElementById('user-dropdown'); if (dd) dd.style.display = 'none'; closeMobileMenu(); }

  return { render, patchBalance, _onSearchInput, toggleUserMenu, toggleMobileMenu, closeMobileMenu, closeAll };
})();
