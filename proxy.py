#!/usr/bin/env python3
"""
Predictex proxy server — port 7433
Fetches live Kalshi market data and serves with CORS headers.
Kalshi API uses dollar-format prices (yes_ask_dollars, etc.)
"""

import sys, json, time, threading, traceback, gzip as gz
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib import request as urllib_req, error as urllib_err

try:
    from curl_cffi import requests as cr
    HAS_CURL = True
    print('[proxy] curl-cffi OK')
except ImportError:
    HAS_CURL = False
    print('[proxy] curl-cffi not found — falling back to urllib')

KALSHI     = 'https://api.elections.kalshi.com/trade-api/v2'
CACHE_TTL  = 300   # 5 min
MAX_MKTS       = 120
PER_SERIES_MAX = 5    # max markets to take per series ticker

TARGET_SERIES = [
    # Politics
    'KXTRUMP', 'KXBIDEN', 'KXUS', 'KXUK', 'KXGERMANY', 'KXFRANCE',
    # Economics / Finance
    'KXFED', 'KXCPI', 'KXGDP', 'KXUNEMP', 'KXSP500', 'KXNDX', 'KXGLD',
    # Crypto
    'KXBTC', 'KXETH', 'KXSOL', 'KXXRP',
    # Sports
    'KXNBA', 'KXNFL', 'KXMLB', 'KXNHL', 'KXMMA', 'KXTENNIS', 'KXGOLF',
    # Technology
    'KXELONMARS', 'KXMARS', 'KXSPACEX', 'KXAI',
]

CAT_MAP = {
    'Politics':'Politics','Political':'Politics','World':'Politics','Government':'Politics',
    'Economics':'Economics','Economy':'Economics','Finance':'Economics','Financial':'Economics',
    'Sports':'Sports','Sport':'Sports',
    'Crypto':'Crypto','Cryptocurrency':'Crypto',
    'Technology':'Technology','Science':'Technology',
    'Entertainment':'Entertainment','Media':'Entertainment',
    'Weather':'Weather','Climate':'Weather',
}

# Infer category from series ticker prefix
SERIES_CAT = {
    'KXFED':'Economics', 'KXRATE':'Economics', 'KXCPI':'Economics', 'KXGDP':'Economics',
    'KXUNEMP':'Economics', 'KXPCE':'Economics', 'KXJOB':'Economics', 'KXNFP':'Economics',
    'KXSP':'Economics', 'KXNDX':'Economics', 'KXGLD':'Economics', 'KXOIL':'Economics',
    'KXBTC':'Crypto', 'KXETH':'Crypto', 'KXSOL':'Crypto', 'KXDOGE':'Crypto', 'KXXRP':'Crypto', 'KXLINK':'Crypto', 'KXADA':'Crypto', 'KXAVAX':'Crypto',
    'KXTRUMP':'Politics', 'KXBIDEN':'Politics', 'KXELECT':'Politics', 'KXUS':'Politics',
    'KXUK':'Politics', 'KXEUR':'Politics', 'KXFRANCE':'Politics', 'KXGERMANY':'Politics',
    'KXELONMARS':'Technology', 'KXMARS':'Technology', 'KXSPACEX':'Technology', 'KXAI':'Technology',
    'KXNBA':'Sports', 'KXNFL':'Sports', 'KXMLB':'Sports', 'KXNHL':'Sports', 'KXSOCCER':'Sports',
}

def _series_category(ticker):
    """Guess category from series ticker prefix."""
    s = (ticker or '').upper()
    for prefix, cat in SERIES_CAT.items():
        if s.startswith(prefix):
            return cat
    return 'Politics'

_cache = {'markets': None, 'ts': 0}
_lock  = threading.Lock()

# ── HTTP helper ────────────────────────────────────────────────────────────────

def _fetch(url, retries=3):
    impersonations = ['chrome120', 'chrome110', 'chrome101', 'chrome99']
    for attempt in range(retries):
        try:
            if HAS_CURL:
                imp = impersonations[attempt % len(impersonations)]
                r   = cr.get(url, impersonate=imp, timeout=12)
                if r.status_code == 200:
                    return r.json()
                print(f'[proxy] HTTP {r.status_code}')
            else:
                req = urllib_req.Request(url, headers={
                    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept':          'application/json',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip',
                })
                with urllib_req.urlopen(req, timeout=12) as resp:
                    body = resp.read()
                    if resp.info().get('Content-Encoding') == 'gzip':
                        body = gz.decompress(body)
                    return json.loads(body)
        except Exception as e:
            print(f'[proxy] attempt {attempt+1}/{retries}: {type(e).__name__}: {e}')
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
    return None


def _dollars_to_cents(val):
    """Convert Kalshi dollar string '0.3500' → 35 (cents / percent)."""
    try:
        return max(1, min(99, round(float(val) * 100)))
    except (TypeError, ValueError):
        return None


def _map_market(m, event=None, idx=0):
    # Use last traded price as the displayed price (cleaner implied probability)
    # Fall back to yes_ask_dollars if no last_price available
    yes_d = m.get('last_price_dollars') or m.get('yes_ask_dollars') or m.get('previous_yes_ask_dollars')
    ya    = _dollars_to_cents(yes_d)
    # NO price = 100 - YES price (implied probability, always sums to 100)
    na    = (100 - ya) if ya else None

    if ya is None:
        return None

    last_d  = m.get('last_price_dollars') or yes_d
    prev_d  = m.get('previous_yes_ask_dollars') or last_d
    try:
        chg = round((float(last_d) - float(prev_d)) * 100, 1)
    except (TypeError, ValueError):
        chg = 0.0

    vol = 0
    for f in ('volume_fp', 'volume_24h_fp', 'open_interest_fp'):
        try:
            vol = round(float(m.get(f, 0) or 0)); break
        except (TypeError, ValueError):
            pass

    raw_cat  = (event or {}).get('category') or m.get('category') or ''
    category = CAT_MAP.get(raw_cat) or _series_category(m.get('series_ticker') or m.get('ticker', ''))
    raw_title = (event or {}).get('title') or m.get('title') or m.get('ticker', '')
    # Strip Kalshi markdown formatting (**bold**, *italic*)
    import re
    title = re.sub(r'\*+([^*]+)\*+', r'\1', raw_title)

    return {
        'id':            idx + 1,
        'ticker':        m.get('ticker', ''),
        'series_ticker': m.get('series_ticker', (m.get('ticker') or '').split('-')[0]),
        'title':         title,
        'subtitle':      m.get('subtitle') or m.get('yes_sub_title', ''),
        'category':      category,
        'yes_price':     ya,
        'no_price':      na,
        'volume':        vol,
        'change_24h':    chg,
        'close_time':    m.get('close_time', ''),
        'status':        'open',
        'liquidity':     'high' if vol > 50_000 else ('medium' if vol > 5000 else 'low'),
        'source':        'kalshi',
    }


# ── Market fetching strategies ────────────────────────────────────────────────

def _fetch_by_series():
    """Fetch markets for known binary-market series tickers."""
    results = []
    for series in TARGET_SERIES:
        if len(results) >= MAX_MKTS:
            break
        data = _fetch(f'{KALSHI}/markets?status=open&series_ticker={series}&limit={PER_SERIES_MAX}')
        if not data:
            continue
        series_count = 0
        for m in data.get('markets', []):
            if m.get('market_type') != 'binary':
                continue
            if m.get('mve_collection_ticker'):
                continue
            mapped = _map_market(m, idx=len(results))
            if mapped:
                results.append(mapped)
                series_count += 1
                if len(results) >= MAX_MKTS or series_count >= PER_SERIES_MAX:
                    break
        if series_count:
            print(f'[proxy] series {series}: +{series_count} → {len(results)} total')
    return results


def _fetch_paginated():
    """Page through /markets until we find enough binary ones."""
    results = []
    cursor  = None
    page    = 0

    while len(results) < MAX_MKTS and page < 20:
        url = f'{KALSHI}/markets?status=open&limit=200'
        if cursor:
            url += f'&cursor={cursor}'
        data = _fetch(url)
        if not data:
            break
        cursor = data.get('cursor')
        page  += 1

        for m in data.get('markets', []):
            if m.get('mve_collection_ticker'):
                continue
            if m.get('market_type') != 'binary':
                continue
            mapped = _map_market(m, idx=len(results))
            if mapped:
                results.append(mapped)
                if len(results) >= MAX_MKTS:
                    break

        print(f'[proxy] page {page}: {len(results)} binary markets, cursor={bool(cursor)}')
        if not cursor:
            break

    return results


def _fetch_via_events():
    """Enumerate events → fetch each event's markets."""
    ev_data = _fetch(f'{KALSHI}/events?status=open&limit=100')
    if not ev_data:
        return []

    results = []
    events  = ev_data.get('events', [])
    for ev in events:
        if len(results) >= MAX_MKTS:
            break
        et   = ev.get('event_ticker', '')
        mdat = _fetch(f'{KALSHI}/markets?event_ticker={et}&status=open&limit=10')
        if not mdat:
            continue
        for m in mdat.get('markets', []):
            if m.get('mve_collection_ticker'):
                continue
            if m.get('market_type') != 'binary':
                continue
            mapped = _map_market(m, event=ev, idx=len(results))
            if mapped:
                results.append(mapped)
                if len(results) >= MAX_MKTS:
                    break
    return results


def _fetch_by_events_category(kalshi_category, our_category, limit_events=15):
    """Fetch events for a Kalshi category and find their binary markets."""
    ev_data = _fetch(f'{KALSHI}/events?status=open&limit={limit_events}&category={kalshi_category}')
    if not ev_data:
        return []

    results = []
    for ev in ev_data.get('events', []):
        et = ev.get('event_ticker', '')
        if not et:
            continue
        mkt_data = _fetch(f'{KALSHI}/markets?event_ticker={et}&status=open&limit=3')
        if not mkt_data:
            continue
        for m in mkt_data.get('markets', []):
            if m.get('market_type') != 'binary':
                continue
            if m.get('mve_collection_ticker'):
                continue
            mapped = _map_market(m, event=ev, idx=len(results))
            if mapped:
                # Override category with our mapping
                mapped['category'] = our_category
                results.append(mapped)
                break  # one market per event for variety
    print(f'[proxy] events/{kalshi_category}: {len(results)} binary markets')
    return results


def get_markets():
    with _lock:
        if _cache['markets'] and time.time() - _cache['ts'] < CACHE_TTL:
            return _cache['markets']

    print('[proxy] Refreshing…')
    t0 = time.time()

    # Fetch by series (Economics, Crypto, Sports, Technology)
    markets = _fetch_by_series()

    # Add Politics markets via events API
    if len(markets) < MAX_MKTS:
        politics = _fetch_by_events_category('Politics', 'Politics', limit_events=20)
        markets.extend(politics[:PER_SERIES_MAX * 3])

    # Fallback if series fetch got nothing at all
    if not markets:
        markets = _fetch_paginated()
    if not markets:
        markets = _fetch_via_events()

    # Deduplicate by ticker
    seen = set()
    deduped = []
    for m in markets:
        if m['ticker'] not in seen:
            seen.add(m['ticker'])
            deduped.append(m)
    # Re-index ids
    for i, m in enumerate(deduped):
        m['id'] = i + 1
    markets = deduped

    elapsed = time.time() - t0
    print(f'[proxy] {len(markets)} markets in {elapsed:.1f}s')

    with _lock:
        if markets:
            _cache['markets'] = markets
            _cache['ts']      = time.time()
        return _cache['markets'] or []


# ── Settlement lookup ────────────────────────────────────────────────────────

def get_settlement(ticker):
    """Fetch a single market's settlement status + result from Kalshi.

    Kalshi status is one of unopened/open/closed/settled/finalized; `result` is
    'yes' or 'no' for a resolved binary market (empty until then)."""
    data = _fetch(f'{KALSHI}/markets/{ticker}')
    if not data:
        return None
    m = data.get('market') or {}
    return {
        'ticker': m.get('ticker', ticker),
        'status': m.get('status', ''),
        'result': m.get('result', ''),
    }


# ── HTTP server ────────────────────────────────────────────────────────────────

class ProxyHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type',  'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin',  '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/markets':
            try:
                self._json(200, {'markets': get_markets(), 'count': len(get_markets()), 'source': 'kalshi'})
            except Exception:
                traceback.print_exc()
                self._json(500, {'error': 'fetch_failed'})
        elif path == '/settlement':
            from urllib.parse import urlparse, parse_qs
            ticker = (parse_qs(urlparse(self.path).query).get('ticker') or [''])[0]
            if not ticker:
                return self._json(400, {'error': 'ticker required'})
            s = get_settlement(ticker)
            if s is None:
                return self._json(502, {'error': 'fetch_failed'})
            self._json(200, s)
        elif path == '/health':
            with _lock:
                self._json(200, {'ok': True, 'cached': bool(_cache['markets']),
                                 'count': len(_cache['markets'] or []),
                                 'age_s': int(time.time() - _cache['ts'])})
        else:
            self._json(404, {'error': 'not_found'})


if __name__ == '__main__':
    PORT = 7433
    print(f'[proxy] Predictex Kalshi proxy — http://localhost:{PORT}')
    threading.Thread(target=get_markets, daemon=True).start()
    server = HTTPServer(('localhost', PORT), ProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[proxy] Stopped.')
