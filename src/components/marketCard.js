/**
 * components/marketCard.js — one market tile.
 * render(market) -> html; patch(market) updates a live-drifting card in place
 * (queried by data-ticker) without a re-render, preserving icons/labels.
 */
const MarketCard = (() => {
  function render(market) {
    const watched     = App.isWatched(market.ticker);
    const changeClass = market.change_24h > 0 ? 'text-success' : market.change_24h < 0 ? 'text-danger' : 'text-muted';
    const changeSign  = market.change_24h > 0 ? '+' : '';
    const t = Utils.escapeHtml(market.ticker);

    return `
      <div class="card card-hover market-card"
        data-ticker="${t}"
        data-category="${Utils.escapeHtml(market.category.toLowerCase())}"
        onclick="App.navigate('detail','${t}')"
        role="button" tabindex="0"
        onkeydown="if(event.key==='Enter'||event.key===' ')App.navigate('detail','${t}')"
        aria-label="Open market: ${Utils.escapeHtml(market.title)}">

        <div class="market-card-top">
          <span class="badge badge-neutral fs-11">${Utils.escapeHtml(market.category)}</span>
          <div style="display:flex;gap:4px;align-items:center">
            ${market.liquidity === 'high'
              ? '<span class="badge badge-accent fs-11"><i class="ti ti-flame" aria-hidden="true"></i> Hot</span>' : ''}
            <button class="watchlist-btn ${watched ? 'watched' : ''}"
              onclick="event.stopPropagation();MarketCard.toggleWatch('${t}',this)"
              title="${watched ? 'Remove from watchlist' : 'Add to watchlist'}"
              aria-label="${watched ? 'Remove from watchlist' : 'Add to watchlist'}">
              <i class="ti ${watched ? 'ti-star-filled' : 'ti-star'}"></i>
            </button>
          </div>
        </div>

        <div class="market-card-title">${Utils.escapeHtml(market.title)}</div>

        <div class="market-card-prob">
          <span class="market-card-prob-pct" data-prob>${market.yes_price}%</span>
          <span class="market-card-prob-label">chance</span>
        </div>

        <div class="price-bar"><div class="price-bar-fill" style="width:${market.yes_price}%"></div></div>

        <div class="market-card-actions">
          <div class="price-chip price-chip-yes">
            <i class="ti ti-arrow-up-right" aria-hidden="true"></i>
            <span class="chip-label">Yes</span><span class="chip-val">${market.yes_price}¢</span>
          </div>
          <div class="price-chip price-chip-no">
            <i class="ti ti-arrow-down-right" aria-hidden="true"></i>
            <span class="chip-label">No</span><span class="chip-val">${market.no_price}¢</span>
          </div>
        </div>

        <div class="market-card-footer">
          <span>${Utils.volume(market.volume)} vol</span>
          <span data-change class="${changeClass}">${changeSign}${market.change_24h}% today</span>
          <span class="text-muted"><i class="ti ti-clock" style="font-size:10px"></i> ${Utils.daysUntil(market.close_time)}</span>
        </div>
      </div>`;
  }

  /** Live-price patch: update only the volatile nodes of an on-screen card. */
  function patch(market) {
    const card = document.querySelector('[data-ticker="' + (window.CSS ? CSS.escape(market.ticker) : market.ticker) + '"]');
    if (!card) return;
    const yesV = card.querySelector('.price-chip-yes .chip-val');
    const noV  = card.querySelector('.price-chip-no .chip-val');
    const bar  = card.querySelector('.price-bar-fill');
    const prob = card.querySelector('[data-prob]');
    const chg  = card.querySelector('[data-change]');
    const yes  = card.querySelector('.price-chip-yes');
    if (yesV) yesV.textContent = market.yes_price + '¢';
    if (noV)  noV.textContent  = market.no_price + '¢';
    if (prob) prob.textContent = market.yes_price + '%';
    if (bar)  bar.style.width  = market.yes_price + '%';
    if (yes)  { yes.classList.add('price-flash'); setTimeout(() => yes.classList.remove('price-flash'), 500); }
    if (chg) {
      chg.textContent = (market.change_24h >= 0 ? '+' : '') + market.change_24h + '% today';
      chg.className   = 'text-' + (market.change_24h >= 0 ? 'success' : 'danger');
    }
  }

  function toggleWatch(ticker, btn) {
    const added = App.toggleWatch(ticker);
    const icon = btn.querySelector('i');
    if (icon) icon.className = added ? 'ti ti-star-filled' : 'ti ti-star';
    btn.classList.toggle('watched', added);
    btn.title = added ? 'Remove from watchlist' : 'Add to watchlist';
  }

  return { render, patch, toggleWatch };
})();
