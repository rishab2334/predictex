/**
 * core/config.js — runtime configuration & feature flags.
 *
 * Flip `apiMode` to 'remote' and set `apiBaseUrl` once the backend exists; every
 * data operation then goes to the server instead of the in-browser engine, with
 * no other code change (see core/api.js).
 */
const Config = {
  // 'remote' = SQLite backend (the product) · 'local' = in-browser engine (standalone).
  // Remote is the default; if the backend is unreachable at boot the app falls back
  // to local mode and shows an offline banner (see main.js). Run the backend with
  // `node server/server.js` (and `python3 proxy.py` for live prices).
  apiMode:    'remote',
  apiBaseUrl: 'http://127.0.0.1:7434',  // 127.0.0.1 (not localhost) — avoids IPv6 miss
  refreshMs:  60000,                    // market re-read cadence
  features: {
    liveMarkets: true,                  // poll for live prices
  },
};
