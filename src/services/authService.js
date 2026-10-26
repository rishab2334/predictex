/**
 * services/authService.js — authentication + session lifecycle.
 *
 * Demo auth: any email/password is accepted. On a first sign-in with no saved
 * portfolio, the demo account (balance, positions, activity) is seeded so the
 * app isn't empty; a returning user whose trades were persisted keeps them.
 */
const AuthService = (() => {
  function isLoggedIn() { return !!Store.get().session; }
  function currentUser() { return Store.get().session; }

  function _login(email, name) {
    const session = {
      name:     name || Utils.nameFromEmail(email),
      email:    email,
      color:    Utils.hashColor(email),
      joinedAt: Date.now(),
    };

    Store.update(s => {
      s.session = session;
      // Seed the demo account only when there's nothing to preserve.
      const fresh = s.positions.length === 0 && s.activity.length === 0 && s.account.portfolioValue === 0;
      if (fresh) {
        s.account   = { ...SEED_ACCOUNT };
        s.positions = SEED_POSITIONS.map(p => ({ ...p }));
        s.activity  = SEED_ACTIVITY.map(a => ({ ...a }));
      }
    });
    return session;
  }

  function login(email, password) {
    if (!email)    return { ok: false, error: 'Please enter your email address.' };
    if (!password) return { ok: false, error: 'Please enter your password.' };
    return { ok: true, session: _login(email) };
  }

  function signup(name, email, password) {
    if (!name)                       return { ok: false, error: 'Please enter your name.' };
    if (!email)                      return { ok: false, error: 'Please enter your email address.' };
    if (!password || password.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' };
    return { ok: true, session: _login(email, name) };
  }

  function logout() { Store.reset(); }

  return { isLoggedIn, currentUser, login, signup, logout };
})();
