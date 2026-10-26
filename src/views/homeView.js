/**
 * views/homeView.js — market discovery: category filter, sort, search,
 * watchlist section, main grid, and a settled-markets table.
 */
const HomeView = (() => {
  const CATEGORIES = ['All', 'Politics', 'Economics', 'Sports', 'Crypto', 'Weather', 'Technology', 'Entertainment'];
  const SORTS = [
    { value: 'volume',     label: 'Volume' },
    { value: 'change',     label: 'Trending' },
    { value: 'close',      label: 'Closing soon' },
    { value: 'price-high', label: 'Highest YES' },
    { value: 'price-low',  label: 'Lowest YES' },
  ];

  function _userCategories(state) {
    const s = state.session;
    if (!s || s.role !== 'user' || !s.allowed_categories) return null;
    return s.allowed_categories;
  }

  function render(state) {
    const { filter, sort, search } = state.ui;

    if (state.ui.loading && state.ui.loading.markets && MarketService.open().length === 0) {
      return _skeleton();
    }

    let markets = MarketService.open();
    const allowedCats = _userCategories(state);
    if (allowedCats) markets = markets.filter(m => allowedCats.includes(m.category));

    if (search) {
      const q = search.toLowerCase();
      markets = markets.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.ticker.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.subtitle && m.subtitle.toLowerCase().includes(q)));
    }
    if (filter !== 'all') markets = markets.filter(m => m.category.toLowerCase() === filter);

    const sorters = {
      'volume':     (a, b) => b.volume - a.volume,
      'change':     (a, b) => Math.abs(b.change_24h) - Math.abs(a.change_24h),
      'close':      (a, b) => new Date(a.close_time) - new Date(b.close_time),
      'price-high': (a, b) => b.yes_price - a.yes_price,
      'price-low':  (a, b) => a.yes_price - b.yes_price,
    };
    if (sorters[sort]) markets = markets.slice().sort(sorters[sort]);

    const watched = MarketService.open().filter(m => state.watchlist.includes(m.ticker));

    return `
      <div class="markets-toolbar">
        <div class="filter-group" id="home-filter-group">
          ${CATEGORIES.filter(c => !allowedCats || c === 'All' || allowedCats.includes(c)).map(c => {
            const v = c.toLowerCase();
            return `<button class="filter-pill ${filter === v ? 'active' : ''}" onclick="App.setFilter('${v}')">${c}</button>`;
          }).join('')}
        </div>
        <div class="toolbar-right">
          <span class="text-muted fs-12">${markets.length} market${markets.length !== 1 ? 's' : ''}</span>
          <select class="sort-select" onchange="App.setSort(this.value)" aria-label="Sort by">
            ${SORTS.map(o => `<option value="${o.value}" ${sort === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="markets-body">
        ${watched.length > 0 && !search ? `
          <div class="markets-section">
            <div class="section-header">
              <div class="section-title"><i class="ti ti-star-filled" style="color:var(--text-warning);font-size:14px"></i> Watchlist</div>
              <span class="text-muted fs-12">${watched.length} market${watched.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="market-cards-grid">${watched.map(m => MarketCard.render(m)).join('')}</div>
          </div>
          <div class="divider"></div>` : ''}

        <div class="markets-section">
          <div class="section-header">
            <div class="section-title">
              ${search ? `Results for "<span class="text-accent">${Utils.escapeHtml(search)}</span>"`
                : filter === 'all' ? 'Trending markets'
                : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </div>
          </div>
          ${markets.length === 0 ? `
            <div class="empty-state">
              <i class="ti ti-search" style="font-size:32px;color:var(--text-muted);margin-bottom:12px"></i>
              <div style="font-weight:500;margin-bottom:6px">No markets found</div>
              <div class="text-secondary fs-13">
                ${search ? `No results for "${Utils.escapeHtml(search)}" — try a different search.` : 'No markets in this category yet.'}
              </div>
              ${search ? `<button class="btn btn-sm" style="margin-top:12px" onclick="App.search('')">Clear search</button>` : ''}
            </div>` : `
            <div class="market-cards-grid" id="market-cards-grid">${markets.map(m => MarketCard.render(m)).join('')}</div>`}
        </div>

        ${_settled()}
      </div>`;
  }

  function _skeleton() {
    const card = `
      <div class="skel-card">
        <div class="skel skel-line" style="width:40%"></div>
        <div class="skel skel-line" style="width:90%"></div>
        <div class="skel skel-line" style="width:70%"></div>
        <div class="skel skel-num"></div>
        <div class="skel skel-bar"></div>
        <div class="skel-actions"><div class="skel skel-btn"></div><div class="skel skel-btn"></div></div>
      </div>`;
    return `
      <div class="markets-body">
        <div class="markets-section">
          <div class="section-header">
            <div class="section-title"><span class="spinner"></span> Loading markets…</div>
          </div>
          <div class="market-cards-grid">${card.repeat(6)}</div>
        </div>
      </div>`;
  }

  function _settled() {
    const settled = MarketService.settled();
    if (!settled.length) return '';
    return `
      <div class="markets-section" style="margin-top:8px">
        <div class="section-header"><div class="section-title text-muted" style="font-size:14px">Recently settled</div></div>
        <div class="data-table">
          <div class="data-table-header" style="grid-template-columns:3fr 1fr 1fr 1fr">
            <span>Market</span><span>Final price</span><span>Volume</span><span>Status</span>
          </div>
          ${settled.map(m => `
            <div class="data-table-row" style="grid-template-columns:3fr 1fr 1fr 1fr">
              <div><div class="fw-500 fs-13">${Utils.escapeHtml(m.title)}</div><div class="fs-11 text-muted">${Utils.escapeHtml(m.ticker)}</div></div>
              <div>${m.yes_price}¢</div>
              <div>${Utils.volume(m.volume)}</div>
              <div><span class="badge badge-neutral">Settled</span></div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  return { render };
})();
