/**
 * components/modal.js — overlay dialogs (login, signup, deposit).
 *
 * Auth here reuses the same input IDs as the AuthView so one set of submit
 * handlers serves both the full-screen auth page and these modals.
 */
const Modal = (() => {
  function _open(content) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;
    overlay.innerHTML = `
      <div class="modal-backdrop" onclick="Modal.close()"></div>
      <div class="modal-box" role="dialog" aria-modal="true">${content}</div>`;
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function close() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) { overlay.style.display = 'none'; overlay.innerHTML = ''; }
    document.body.style.overflow = '';
  }

  function showLogin() {
    _open(`
      <div class="modal-header">
        <div class="modal-logo">◈ Predictex</div>
        <button class="modal-close-btn" onclick="Modal.close()" aria-label="Close"><i class="ti ti-x"></i></button>
      </div>
      <h2 class="modal-title">Welcome back</h2>
      <p class="modal-subtitle">Sign in to your account to continue trading.</p>
      <div class="form-group">
        <label class="form-label">Email address</label>
        <input class="form-input" type="email" id="login-email" placeholder="you@example.com" autocomplete="email" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" type="password" id="login-pass" placeholder="••••••••" autocomplete="current-password"
          onkeydown="if(event.key==='Enter')Modal.submitLogin()" />
      </div>
      <button class="btn btn-primary modal-submit-btn" onclick="Modal.submitLogin()">Sign in</button>
      <div class="modal-switch">Don't have an account?
        <button class="link-btn" onclick="Modal.showSignup()">Sign up free →</button></div>
      <div class="modal-demo-hint"><i class="ti ti-info-circle"></i> Demo mode — any email + password works</div>`);
    setTimeout(() => document.getElementById('login-email')?.focus(), 60);
  }

  function showSignup() {
    _open(`
      <div class="modal-header">
        <div class="modal-logo">◈ Predictex</div>
        <button class="modal-close-btn" onclick="Modal.close()" aria-label="Close"><i class="ti ti-x"></i></button>
      </div>
      <h2 class="modal-title">Create your account</h2>
      <p class="modal-subtitle">It only takes a minute.</p>
      <div class="form-group">
        <label class="form-label">Full name</label>
        <input class="form-input" type="text" id="signup-name" placeholder="Jane Smith" autocomplete="name" />
      </div>
      <div class="form-group">
        <label class="form-label">Email address</label>
        <input class="form-input" type="email" id="signup-email" placeholder="you@example.com" autocomplete="email" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" type="password" id="signup-pass" placeholder="Min 8 characters" autocomplete="new-password"
          onkeydown="if(event.key==='Enter')Modal.submitSignup()" />
      </div>
      <button class="btn btn-primary modal-submit-btn" onclick="Modal.submitSignup()">Create account — it's free</button>
      <div class="modal-switch">Already have an account?
        <button class="link-btn" onclick="Modal.showLogin()">Sign in →</button></div>`);
    setTimeout(() => document.getElementById('signup-name')?.focus(), 60);
  }

  function showDeposit() {
    _open(`
      <div class="modal-header">
        <h3 class="modal-header-title">Add funds</h3>
        <button class="modal-close-btn" onclick="Modal.close()" aria-label="Close"><i class="ti ti-x"></i></button>
      </div>
      <p class="modal-subtitle">Choose an amount or enter a custom value.</p>
      <div class="deposit-amounts">
        ${[50, 100, 250, 500, 1000].map(amt =>
          `<button class="deposit-amount-btn" onclick="Modal.selectDeposit(${amt}, this)">$${amt}</button>`).join('')}
      </div>
      <div class="form-group" style="margin-top:18px">
        <label class="form-label">Custom amount ($)</label>
        <div style="position:relative">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-secondary);font-size:14px">$</span>
          <input class="form-input" type="number" id="deposit-amount" placeholder="0.00" style="padding-left:26px" min="1" max="100000" />
        </div>
      </div>
      <div class="deposit-security-note">
        <i class="ti ti-shield-check" style="color:var(--text-success)"></i>
        Funds secured by 256-bit encryption. ACH and card deposits available.
      </div>
      <button class="btn btn-primary modal-submit-btn" onclick="Modal.submitDeposit()"><i class="ti ti-wallet"></i> Deposit funds</button>`);
  }

  function selectDeposit(amount, btn) {
    document.querySelectorAll('.deposit-amount-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const input = document.getElementById('deposit-amount');
    if (input) input.value = amount;
  }

  // Toggle the active submit button (modal or auth page) into a busy/disabled state.
  function _setBusy(on, label) {
    const btn = document.querySelector('.modal-submit-btn, .auth-submit');
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-sm"></span> ' + (label || 'Please wait…');
    } else {
      btn.disabled = false;
      if (btn.dataset.label != null) btn.innerHTML = btn.dataset.label;
    }
  }

  // ── Submit handlers (shared with AuthView via the same input IDs) ──
  // These go through the Api gateway so they work unchanged against a real backend.
  async function submitLogin() {
    const email = document.getElementById('login-email')?.value?.trim();
    const pass  = document.getElementById('login-pass')?.value;
    _setBusy(true, 'Signing in…');
    try {
      const { user } = await Api.auth.login(email, pass);
      close();
      Router.navigate('home');
      Toast.show('Welcome back, ' + user.name.split(' ')[0] + '!', 'success');
    } catch (e) { Toast.show(e.message, 'error'); } finally { _setBusy(false); }
  }

  async function submitSignup() {
    const name  = document.getElementById('signup-name')?.value?.trim();
    const email = document.getElementById('signup-email')?.value?.trim();
    const pass  = document.getElementById('signup-pass')?.value;
    _setBusy(true, 'Creating account…');
    try {
      const { user } = await Api.auth.signup(name, email, pass);
      close();
      Router.navigate('home');
      Toast.show('Welcome to Predictex, ' + user.name.split(' ')[0] + '!', 'success');
    } catch (e) { Toast.show(e.message, 'error'); } finally { _setBusy(false); }
  }

  async function submitDeposit() {
    _setBusy(true, 'Processing…');
    try {
      const { amount } = await Api.account.deposit(document.getElementById('deposit-amount')?.value);
      close();
      Toast.show(Utils.money(amount) + ' added to your account!', 'success');
      Navbar.patchBalance();
    } catch (e) { Toast.show(e.message, 'error'); } finally { _setBusy(false); }
  }

  let _confirmCb = null;
  function show(title, bodyHtml, onConfirm) {
    _confirmCb = onConfirm;
    _open(`
      <div class="modal-header">
        <h3 class="modal-header-title">${title}</h3>
        <button class="modal-close-btn" onclick="Modal.close()" aria-label="Close"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body-content" onkeydown="if(event.key==='Enter')Modal.confirmAction()">${bodyHtml}</div>
      <button class="btn btn-primary modal-submit-btn" onclick="Modal.confirmAction()">Save</button>`);
  }
  function confirmAction() {
    if (_confirmCb) {
      const result = _confirmCb();
      if (result === false) return;
    }
    close();
  }

  return { close, show, confirmAction, showLogin, showSignup, showDeposit, selectDeposit, submitLogin, submitSignup, submitDeposit };
})();
