/**
 * core/utils.js — pure, dependency-free helpers.
 * No DOM, no state. Safe to call from any layer.
 */
const Utils = (() => {
  /** Escape untrusted strings before interpolating into innerHTML.
   *  Market titles/tickers come from the Kalshi API (external input). */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** $1,247.50 */
  function money(n, dp = 2) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }

  /** $1.2M / $340K / $920 — compact volume */
  function volume(v) {
    v = Number(v) || 0;
    if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1) + 'M';
    if (v >= 1_000)     return '$' + (v / 1_000).toFixed(0) + 'K';
    return '$' + v;
  }

  function closeDate(iso) {
    if (!iso) return 'TBD';
    const d = new Date(iso);
    if (isNaN(d)) return 'TBD';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function daysUntil(iso) {
    if (!iso) return '—';
    const diff = new Date(iso) - Date.now();
    const days = Math.ceil(diff / 86400000);
    if (isNaN(days)) return '—';
    if (days < 0)   return 'Closed';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 30)  return days + ' days';
    return Math.floor(days / 30) + ' mo';
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff)) return '';
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(h / 24);
    if (d > 0) return d + 'd ago';
    if (h > 0) return h + 'h ago';
    const m = Math.floor(diff / 60000);
    if (m > 0) return m + 'm ago';
    return 'just now';
  }

  function nameFromEmail(email) {
    return (String(email).split('@')[0] || 'Trader')
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Deterministic avatar color from a string. */
  function hashColor(str) {
    const palette = ['#00b17a', '#378add', '#e24b4a', '#ba7517', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71'];
    let h = 0;
    for (let i = 0; i < String(str).length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  return { escapeHtml, money, volume, closeDate, daysUntil, timeAgo, nameFromEmail, hashColor, clamp };
})();
