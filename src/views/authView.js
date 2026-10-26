/**
 * views/authView.js — single sign-in screen for all roles (username + password).
 * No self-registration; accounts are created by an admin/client. After login the
 * router sends the user to the dashboard for their role.
 */
const AuthView = (() => {
  function render() {
    return `
      <div class="auth-page"><div class="auth-card">
        <div class="auth-brand"><span class="auth-logo">◈ Predictex</span><span class="auth-tagline">Prediction markets</span></div>
        <h1 class="auth-title">Sign in</h1>
        <p class="auth-subtitle">Enter the credentials you were given.</p>
        <div class="form-group">
          <label class="form-label" for="login-user">User ID</label>
          <input class="form-input" type="text" id="login-user" placeholder="your id" autocomplete="username" autocapitalize="none" />
        </div>
        <div class="form-group">
          <label class="form-label" for="login-pass">Password</label>
          <input class="form-input" type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password"
            onkeydown="if(event.key==='Enter')AuthView.submit()" />
        </div>
        <button class="btn btn-primary auth-submit" onclick="AuthView.submit()">Sign in</button>
      </div></div>`;
  }

  function mount() { setTimeout(() => document.getElementById('login-user')?.focus(), 50); }

  async function submit() {
    const username = document.getElementById('login-user')?.value?.trim();
    const password = document.getElementById('login-pass')?.value;
    const btn = document.querySelector('.auth-submit');
    if (!username || !password) { Toast.show('Enter your user id and password.', 'error'); return; }
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner spinner-sm"></span> Signing in…'; }
    try {
      const { user } = await Api.auth.login(username, password);
      Router.routeForRole(user.role);
      if (user.role === 'user' && App.enterUserSession) App.enterUserSession(); // load live markets + polling
      Toast.show('Welcome, ' + user.name.split(' ')[0] + '!', 'success');
    } catch (e) {
      Toast.show(e.message, 'error');
      if (btn) { btn.disabled = false; btn.innerHTML = 'Sign in'; }
    }
  }

  return { render, mount, submit };
})();
