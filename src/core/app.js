/**
 * core/app.js — command facade for inline handlers. Backend-driven; reads the
 * Store for session/state and dispatches actions through the Router / Api.
 */
const App = (() => {
  function navigate(route, params) { Router.navigate(route, params); }

  function setFilter(cat) { Store.setUI({ filter: cat }); Router.renderMain(); }
  function setSort(sort)  { Store.setUI({ sort }); Router.renderMain(); }
  function search(query) {
    Store.setUI({ search: query });
    if (Store.get().ui.route !== 'home') { Store.setUI({ route: 'home', params: null }); Router.render(); }
    else Router.renderMain();
  }

  function isWatched(ticker) { return Store.get().watchlist.includes(ticker); }
  function toggleWatch(ticker) {
    let added;
    Store.update(s => { const i = s.watchlist.indexOf(ticker); if (i === -1) { s.watchlist.push(ticker); added = true; } else { s.watchlist.splice(i, 1); added = false; } });
    Toast.show(added ? 'Added to watchlist' : 'Removed from watchlist', 'default');
    return added;
  }

  /** Users can't deposit — they request a withdrawal their client approves. */
  async function requestWithdrawal() {
    const bal = Store.get().account.balance || 0;
    const a = prompt('Request a withdrawal ($). Available: $' + bal.toFixed(2));
    if (a == null || a === '') return;
    try { await Api.withdrawals.create(+a); Navbar.patchBalance(); Toast.show('Withdrawal request submitted for approval.', 'success'); }
    catch (e) { Toast.show(e.message, 'error'); }
  }

  async function logout() { try { await Api.auth.logout(); } catch (e) {} Toast.show('Signed out.', 'default'); Router.navigate('auth'); }
  function currentUser() { return Store.get().session; }
  function isLoggedIn()  { return !!Store.get().session; }

  return { navigate, setFilter, setSort, search, isWatched, toggleWatch, requestWithdrawal, logout, currentUser, isLoggedIn };
})();
