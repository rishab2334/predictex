/**
 * core/router.js — render pipeline with role-based routing.
 *
 * Admin and Client dashboards render standalone (their own header); the trading
 * pages (user) use the shared Navbar. Every route with a `role` is guarded — a
 * session of the wrong role is bounced to its own home.
 */
const Router = (() => {
  const ROUTES = {
    auth:      { view: () => AuthView,      chrome: false, role: null },
    admin:     { view: () => AdminView,     chrome: false, role: 'system_admin' },
    client:    { view: () => ClientView,    chrome: false, role: 'client' },
    home:      { view: () => HomeView,      chrome: true,  role: 'user' },
    detail:    { view: () => DetailView,    chrome: true,  role: 'user' },
    portfolio: { view: () => PortfolioView, chrome: true,  role: 'user' },
    activity:  { view: () => ActivityView,  chrome: true,  role: 'user' },
  };

  function homeFor(role) { return role === 'system_admin' ? 'admin' : role === 'client' ? 'client' : 'home'; }
  function routeForRole(role) { Store.setUI({ route: homeFor(role), params: null }); render(); window.scrollTo({ top: 0 }); }

  function navigate(name, params) {
    const session = Store.get().session;
    let route = ROUTES[name];
    if (!route) name = session ? homeFor(session.role) : 'auth', route = ROUTES[name];
    if (name !== 'auth' && !session) { name = 'auth'; route = ROUTES.auth; }
    if (route.role && (!session || session.role !== route.role)) { name = session ? homeFor(session.role) : 'auth'; }
    Store.setUI({ route: name, params: params || null });
    if (name !== 'home') Store.setUI({ search: '' });
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function render() {
    const app = document.getElementById('app');
    if (!app) return;
    const { route, params } = Store.get().ui;
    const def = ROUTES[route] || ROUTES.auth;
    const View = def.view();
    const nav = def.chrome ? Navbar.render() : '';
    let body = '';
    try { body = View.render(Store.get(), params); }
    catch (e) { console.error('[Router] render failed:', e); body = _errorView(); }
    const banner = Store.get().ui.offline ? _offlineBanner() : '';
    app.innerHTML = banner + nav + '<main id="main-content" class="page active">' + body + '</main>';
    try { if (View.mount) View.mount(Store.get(), params); }
    catch (e) { console.error('[Router] mount failed:', e); }
    _bindOutsideClick();
  }

  function renderMain() {
    const main = document.getElementById('main-content');
    if (!main) return render();
    const { route, params } = Store.get().ui;
    const View = (ROUTES[route] || ROUTES.auth).view();
    try { main.innerHTML = View.render(Store.get(), params); } catch (e) { main.innerHTML = _errorView(); }
    try { if (View.mount) View.mount(Store.get(), params); } catch (e) {}
  }

  function _offlineBanner() {
    return `<div class="offline-banner" role="status"><span><i class="ti ti-cloud-off"></i> Offline — the server is unreachable.</span><button class="offline-retry" onclick="location.reload()">Retry</button></div>`;
  }
  function _errorView() {
    return `<div class="page-body" style="text-align:center;padding:64px 24px"><div style="font-size:32px;margin-bottom:12px">⚠️</div><h2 style="font-size:18px;font-weight:600;margin-bottom:8px">Something went wrong</h2><p class="text-secondary fs-13" style="margin-bottom:20px">This page hit an unexpected error.</p><button class="btn btn-primary" onclick="App.navigate('home')">Reload</button></div>`;
  }

  let _bound = false;
  function _bindOutsideClick() {
    if (_bound) return; _bound = true;
    document.addEventListener('click', (e) => {
      const dd = document.getElementById('user-dropdown'), av = document.getElementById('avatar-btn');
      const dr = document.getElementById('mobile-drawer'), hb = document.getElementById('hamburger-btn');
      if (dd && !dd.contains(e.target) && !av?.contains(e.target)) dd.style.display = 'none';
      if (dr && dr.classList.contains('open') && !dr.contains(e.target) && !hb?.contains(e.target)) dr.classList.remove('open');
    });
  }

  return { navigate, render, renderMain, routeForRole, homeFor };
})();
