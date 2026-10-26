/**
 * components/toast.js — transient status messages (bottom of screen).
 */
const Toast = (() => {
  function show(message, type = 'default', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'ti-circle-check'
              : type === 'error'   ? 'ti-circle-x'
              : 'ti-info-circle';

    toast.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <i class="ti ${icon}" aria-hidden="true" style="font-size:16px;flex-shrink:0"></i>
        <span>${Utils.escapeHtml(message)}</span>
      </div>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  return { show };
})();
