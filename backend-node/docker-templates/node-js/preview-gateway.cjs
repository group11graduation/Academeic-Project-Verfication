#!/usr/bin/env node
/**
 * ScholarVerify preview gateway: static SPA + reverse-proxy to Express API.
 * Injects API boot + login fallback into index.html in-memory (no bind-mount writes).
 *
 * Routing rules (important for apps like SYADA that return 200 text on GET /):
 * - Static assets (.js/.css/…) → SPA dist
 * - Browser navigations (Accept: text/html) on non-API paths → SPA (index.html)
 * - /api/*, /auth/* (and similar) → Express upstream
 * - Other GETs → try API; if 404 OR non-HTML body when client wants a page → SPA
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const STATIC_ROOT = path.resolve(process.argv[2] || process.cwd());
const LISTEN_PORT = Number(process.env.UI_PORT || process.env.PORT || 3000);
const API_PORT = Number(process.env.API_PORT || 5050);
const API_HOST = process.env.PREVIEW_API_UPSTREAM_HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

function apiBaseForBrowser() {
  const ui = String(process.env.PREVIEW_PUBLIC_UI_URL || '').replace(/\/$/, '');
  if (ui) return ui;
  const api = String(process.env.PREVIEW_PUBLIC_API_URL || '').replace(/\/$/, '');
  return api;
}

function loginPath() {
  return String(process.env.PREVIEW_LOGIN_API_PATH || '/api/users/login').trim() || '/api/users/login';
}

function mainRoleFromEnv() {
  return String(
    process.env.PREVIEW_FORCE_ADMIN_ROLE ||
      process.env.PREVIEW_MAIN_ROLE ||
      process.env.PREVIEW_ADMIN_ROLE ||
      'admin'
  ).trim() || 'admin';
}

function adminHomeFromEnv() {
  return String(process.env.PREVIEW_ADMIN_HOME_PATH || '/admin').trim() || '/admin';
}

let cachedFallbackJs = null;
function loadFallbackJs() {
  if (cachedFallbackJs != null) return cachedFallbackJs;
  try {
    cachedFallbackJs = fs.readFileSync('/preview-login-fallback.js', 'utf8');
  } catch (_e) {
    cachedFallbackJs = '';
  }
  return cachedFallbackJs;
}

function wrapHtml(html) {
  const base = apiBaseForBrowser();
  const pathLogin = loginPath();
  const mainRole = mainRoleFromEnv();
  const adminHome = adminHomeFromEnv();
  const boot =
    `<meta name="sv-api-base" content="${base.replace(/"/g, '&quot;')}" />` +
    `<script>/*__SV_API_BOOT__*/window.__SV_API_BASE__=${JSON.stringify(base)};` +
    `window.__SV_LOGIN_API_PATH__=${JSON.stringify(pathLogin)};` +
    `window.__SV_MAIN_ADMIN_ROLE__=${JSON.stringify(mainRole)};` +
    `window.__SV_ADMIN_HOME_PATH__=${JSON.stringify(adminHome)};</script>`;
  const fallback = loadFallbackJs();
  // Escape so a literal </script> inside the shim cannot break HTML parsing (and drop CSS links).
  const safeFallback = fallback ? String(fallback).replace(/<\/script/gi, '<\\/script') : '';
  const fallbackBlock =
    safeFallback && !html.includes('__SV_LOGIN_FALLBACK__')
      ? `<script>\n${safeFallback}\n</script>`
      : '';
  const twCdn = shouldInjectTailwindCdn()
    ? `<script src="https://cdn.tailwindcss.com"><\/script>`
    : '';
  const injection = `${boot}${fallbackBlock}${twCdn}`;

  // Inject into <head> — never prepend before <!DOCTYPE> (breaks stylesheet parsing in some browsers).
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${injection}\n`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${injection}</head>\n`);
  }
  return `${injection}${html}`;
}

function builtCssByteSize(staticRoot) {
  try {
    const assets = path.join(staticRoot, 'assets');
    if (!fs.existsSync(assets)) return 0;
    let total = 0;
    for (const name of fs.readdirSync(assets)) {
      if (!/\.css$/i.test(name)) continue;
      try {
        total += fs.statSync(path.join(assets, name)).size;
      } catch (_e) {
        /* ignore */
      }
    }
    return total;
  } catch (_e2) {
    return 0;
  }
}

function projectLooksLikeTailwind(staticRoot) {
  const roots = [path.join(staticRoot, '..'), staticRoot];
  for (const root of roots) {
    try {
      const pkgPath = path.join(root, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (all.tailwindcss || all['@tailwindcss/vite']) return true;
      }
    } catch (_e) {
      /* ignore */
    }
    for (const cfg of ['tailwind.config.js', 'tailwind.config.cjs', 'tailwind.config.ts']) {
      if (fs.existsSync(path.join(root, cfg))) return true;
    }
    for (const css of ['src/index.css', 'src/App.css', 'index.css']) {
      try {
        const p = path.join(root, css);
        if (fs.existsSync(p) && /@tailwind|tailwindcss/.test(fs.readFileSync(p, 'utf8'))) return true;
      } catch (_e2) {
        /* ignore */
      }
    }
  }
  return false;
}

/** CDN only when Tailwind is expected but the Vite build CSS is missing/tiny (purged empty). */
function shouldInjectTailwindCdn() {
  try {
    if (!projectLooksLikeTailwind(STATIC_ROOT)) return false;
    const size = builtCssByteSize(STATIC_ROOT);
    // Healthy Tailwind builds are typically many KB; empty/broken often < 1KB.
    if (size > 1500) return false;
    console.log(`[preview] Tailwind CSS weak/missing (${size}B) — injecting CDN fallback`);
    return true;
  } catch (_e) {
    return false;
  }
}

/** True for real static assets (.js, .css, .png, …). Excludes .html (SPA shell). */
function isStaticAssetRequest(pathname) {
  const p = String(pathname || '').split('?')[0];
  const m = p.match(/\.([a-zA-Z0-9]+)$/);
  if (!m) return false;
  const ext = m[1].toLowerCase();
  if (ext === 'html' || ext === 'htm') return false;
  return true;
}

function isSafeStaticFallbackMethod(method) {
  const m = String(method || 'GET').toUpperCase();
  return m === 'GET' || m === 'HEAD';
}

/** Paths that must hit Express (never the React SPA). */
function isApiProxyPath(pathname) {
  const p = String(pathname || '').split('?')[0] || '/';
  if (/^\/api(\/|$)/i.test(p)) return true;
  if (/^\/auth(\/|$)/i.test(p)) return true;
  if (/^\/(users|user|v1|graphql|socket\.io|uploads|static\/uploads)(\/|$)/i.test(p)) return true;
  // SYADA / Vite-proxy style: frontend calls /dashboard/summary, /members, … (no /api).
  // Bare /dashboard is often an SPA route (Sky Property) — exclude exact /dashboard.
  if (/^\/dashboard\//i.test(p)) return true;
  if (/^\/(members|finance|reports|sports-members|portal)(\/|$)/i.test(p)) return true;
  // LoanFlow-style: axios calls /admin/loans, /loans/my, /repayments/my (same path as SPA).
  // Browser navigations still get SPA via isBrowserNavigationRequest first.
  if (/^\/admin\/(loans|repayments|loan-documents|users|loan-types)(\/|$)/i.test(p)) return true;
  if (/^\/(loans|repayments|loan-documents|loan-types)(\/|$)/i.test(p)) return true;
  if (/\/login\/?$/i.test(p) && /^\/(api|auth|users|user|v1)\b/i.test(p)) return true;
  return false;
}

/** Socket.IO / raw WS must not get the /api prefix fallback — that breaks Engine.IO sessions. */
function isWebSocketProxyPath(pathname) {
  const p = String(pathname || '').split('?')[0] || '/';
  return /^\/(socket\.io|ws|websocket)(\/|$)/i.test(p);
}

/** Ensure list keys exist as arrays so React UIs never see data.loans === undefined. */
function normalizeApiListBody(body, reqPath) {
  if (body == null) return body;
  const pathOnly = String(reqPath || '').split('?')[0] || '';
  // Keep bare arrays as arrays — never wrap (breaks u.map / a.map dashboards).
  if (Array.isArray(body)) return body;
  if (typeof body !== 'object') return body;
  const out = { ...body };
  const listKeys = [
    'loans',
    'loanTypes',
    'users',
    'items',
    'products',
    'books',
    'notifications',
    'orders',
    'members',
    'applications',
    'repayments',
    'documents',
    'results',
    'categories',
  ];
  for (const key of listKeys) {
    if (Object.prototype.hasOwnProperty.call(out, key) && !Array.isArray(out[key])) {
      out[key] = [];
    }
  }
  if (/\/admin\/loans\/?$/i.test(pathOnly) || /\/loans(\/my)?\/?$/i.test(pathOnly)) {
    if (!Array.isArray(out.loans)) {
      out.loans = Array.isArray(out.data) ? out.data : Array.isArray(out.items) ? out.items : [];
    }
  }
  if (/\/loan-types\/?$/i.test(pathOnly) && !Array.isArray(out.loanTypes)) out.loanTypes = [];
  if (/\/notifications\/?$/i.test(pathOnly) && !Array.isArray(out.notifications)) {
    out.notifications = [];
  }
  if (/\/repayments/i.test(pathOnly) && !Array.isArray(out.repayments)) {
    out.repayments = Array.isArray(out.data) ? out.data : [];
  }
  if (/\/products/i.test(pathOnly) && !Array.isArray(out.products)) {
    out.products = Array.isArray(out.data) ? out.data : [];
  }
  return out;
}

/** Browser document navigation → serve SPA even if Express has GET / health text. */
function isBrowserNavigationRequest(req, pathname) {
  const method = String(req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (isApiProxyPath(pathname)) return false;
  if (isStaticAssetRequest(pathname)) return false;

  const dest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  const mode = String(req.headers['sec-fetch-mode'] || '').toLowerCase();
  // Real top-level navigations (address bar, location.assign, link click).
  if (dest === 'document' || mode === 'navigate') return true;

  const accept = String(req.headers.accept || '');
  // Explicit document request.
  if (/text\/html/i.test(accept) && !/application\/json/i.test(accept)) return true;

  // Do NOT treat Accept: */* as navigation — fetch() defaults to */* and SYADA
  // calls /dashboard/summary that way. Treating */* as SPA broke admin after login.
  if (pathname === '/' || pathname === '') {
    // Root with no fetch-metadata: prefer SPA (Express health text on GET /).
    if (!dest && !mode) return true;
  }
  return false;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(String(reqPath || '/').split('?')[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(root, cleaned);
  if (!full.startsWith(root)) return null;
  return full;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function jsonError(res, status, message, error) {
  return send(
    res,
    status,
    JSON.stringify({
      message,
      error: error != null ? String(error) : undefined,
    }),
    { 'Content-Type': 'application/json' }
  );
}

/**
 * Proxy to Express. On GET/HEAD 404 → try /api + path (Vite-proxy apps like SYADA),
 * then SPA. Also: if GET wants a document and upstream returns non-HTML 200
 * (health text), serve SPA instead (SYADA GET / → "API is running...").
 */
function proxyTryThenStatic(req, res, { preferSpaOnNonHtml = false } = {}) {
  const method = String(req.method || 'GET').toUpperCase();
  const canFallback = isSafeStaticFallbackMethod(method);

  readRequestBody(req)
    .then((body) => {
      const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
      delete headers['accept-encoding'];
      delete headers['transfer-encoding'];
      headers['content-length'] = String(body.length);

      const originalPath = req.url || '/';
      const pathOnly = String(originalPath).split('?')[0] || '/';
      const qs = String(originalPath).includes('?')
        ? originalPath.slice(originalPath.indexOf('?'))
        : '';
      const pathsToTry = [originalPath];
      // Never rewrite /socket.io → /api/socket.io (Engine.IO sid breaks).
      if (
        !isWebSocketProxyPath(pathOnly) &&
        !/^\/api(\/|$)/i.test(pathOnly) &&
        !/^\/auth(\/|$)/i.test(pathOnly)
      ) {
        pathsToTry.push(`/api${pathOnly}${qs}`);
      }

      function attempt(index) {
        const tryPath = pathsToTry[index];
        const opts = {
          hostname: API_HOST,
          port: API_PORT,
          path: tryPath,
          method,
          headers,
          timeout: 30000,
        };

        const upstream = http.request(opts, (up) => {
          const status = up.statusCode || 502;
          if (status === 404 && index + 1 < pathsToTry.length) {
            up.resume();
            return attempt(index + 1);
          }
          if (status === 404 && canFallback) {
            up.resume();
            return serveStatic(req, res);
          }

          const upType = String(up.headers['content-type'] || '').toLowerCase();
          const looksHtml = upType.includes('text/html');
          const looksJson = upType.includes('json');
          // Prefer SPA only for plain-text health bodies (e.g. "API is running").
          // NEVER replace application/json — LoanFlow axios GET /admin/loans was
          // getting index.html, then data.loans was undefined and crashed the UI.
          // Also skip when Content-Type is missing but Authorization is present
          // (typical XHR API call).
          const hasAuth = Boolean(req.headers.authorization || req.headers.Authorization);
          if (
            preferSpaOnNonHtml &&
            canFallback &&
            status >= 200 &&
            status < 400 &&
            !looksHtml &&
            !looksJson &&
            !hasAuth
          ) {
            up.resume();
            return serveStatic(req, res);
          }

          const outHeaders = { ...up.headers };
          outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
          outHeaders['access-control-allow-credentials'] = 'true';

          // Buffer JSON so we can normalize list fields (loans/products/…) for
          // UIs that do data.loans.length without null checks.
          if (looksJson && status >= 200 && status < 300) {
            const chunks = [];
            up.on('data', (c) => chunks.push(c));
            up.on('end', () => {
              let buf = Buffer.concat(chunks);
              try {
                const parsed = JSON.parse(buf.toString('utf8'));
                const normalized = normalizeApiListBody(parsed, tryPath);
                buf = Buffer.from(JSON.stringify(normalized), 'utf8');
                outHeaders['content-length'] = String(buf.length);
                delete outHeaders['transfer-encoding'];
              } catch (_e) {
                /* keep original body */
              }
              res.writeHead(status, outHeaders);
              res.end(buf);
            });
            up.on('error', () => {
              if (!res.headersSent) jsonError(res, 502, 'Upstream response error');
            });
            return;
          }

          // Engine.IO open packet (text/plain): disable websocket upgrades in preview.
          // WS through Docker port-map + our HTTP gateway is flaky; polling is enough
          // for FoundLink notifications and stops "WS closed before established".
          const isEngineIo =
            isWebSocketProxyPath(pathOnly) || /\/socket\.io(\/|$)/i.test(pathOnly);
          const looksPlain = upType.includes('text/plain') || !upType;
          if (isEngineIo && looksPlain && status >= 200 && status < 300) {
            const chunks = [];
            up.on('data', (c) => chunks.push(c));
            up.on('end', () => {
              let text = Buffer.concat(chunks).toString('utf8');
              try {
                // 0{"sid":"...","upgrades":["websocket"],...}
                if (/^0\{/.test(text) && /"upgrades"\s*:/.test(text)) {
                  text = text.replace(/"upgrades"\s*:\s*\[[^\]]*\]/, '"upgrades":[]');
                }
              } catch (_eStrip) {
                /* keep */
              }
              const buf = Buffer.from(text, 'utf8');
              outHeaders['content-length'] = String(buf.length);
              delete outHeaders['transfer-encoding'];
              res.writeHead(status, outHeaders);
              res.end(buf);
            });
            up.on('error', () => {
              if (!res.headersSent) jsonError(res, 502, 'Upstream response error');
            });
            return;
          }

          res.writeHead(status, outHeaders);
          up.pipe(res);
        });

        upstream.on('timeout', () => {
          upstream.destroy();
          if (res.headersSent) return;
          if (index + 1 < pathsToTry.length) return attempt(index + 1);
          if (canFallback) return serveStatic(req, res);
          return jsonError(res, 504, 'Upstream API timeout');
        });

        upstream.on('error', (err) => {
          if (res.headersSent) return;
          if (index + 1 < pathsToTry.length) return attempt(index + 1);
          if (canFallback) return serveStatic(req, res);
          return jsonError(
            res,
            502,
            'Preview API proxy error — backend may still be starting',
            err && err.message ? err.message : err
          );
        });

        if (body.length) upstream.write(body);
        upstream.end();
      }

      attempt(0);
    })
    .catch((err) => {
      if (res.headersSent) return;
      if (canFallback) return serveStatic(req, res);
      return jsonError(res, 502, 'Failed to read request body', err && err.message ? err.message : err);
    });
}

function sendHtml(res, data) {
  const html = wrapHtml(String(data));
  return send(res, 200, html, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
}

function serveStatic(req, res) {
  let reqPath = '/';
  try {
    reqPath = new URL(req.url || '/', 'http://local').pathname || '/';
  } catch (_e) {
    reqPath = '/';
  }

  if (reqPath === '/preview-credentials.json') {
    const payload = JSON.stringify({
      apiBase: apiBaseForBrowser(),
      loginPath: loginPath(),
    });
    return send(res, 200, payload, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
  }

  let filePath = safeJoin(STATIC_ROOT, reqPath);
  if (!filePath) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    fs.readFile(filePath, (readErr, data) => {
      if (!readErr) {
        if (path.basename(filePath) === 'index.html' || contentType(filePath).startsWith('text/html')) {
          return sendHtml(res, data);
        }
        return send(res, 200, data, {
          'Content-Type': contentType(filePath),
          'Cache-Control': 'no-cache',
        });
      }
      const indexPath = path.join(STATIC_ROOT, 'index.html');
      fs.readFile(indexPath, (idxErr, indexData) => {
        if (idxErr) return send(res, 404, 'Not found');
        return sendHtml(res, indexData);
      });
    });
  });
}

const server = http.createServer((req, res) => {
  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    return send(res, 204, '', {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers':
        req.headers['access-control-request-headers'] ||
        'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    });
  }

  let pathname = '/';
  try {
    pathname = new URL(req.url || '/', 'http://local').pathname || '/';
  } catch (_e) {
    pathname = '/';
  }

  if (isStaticAssetRequest(pathname)) return serveStatic(req, res);

  // SPA first for document navigations (/ , /login, /dashboard, …).
  // Fixes Express apps that answer GET / with "API is running..." (HTTP 200 text).
  if (isBrowserNavigationRequest(req, pathname)) {
    return serveStatic(req, res);
  }

  if (isApiProxyPath(pathname)) {
    return proxyTryThenStatic(req, res, { preferSpaOnNonHtml: false });
  }

  return proxyTryThenStatic(req, res, { preferSpaOnNonHtml: true });
});

// Socket.IO upgrades WebSocket after polling — without this, clients open ws://API_PORT
// while XHR polling hits the UI gateway → Engine.IO sid mismatch → 400 Bad Request.
server.on('upgrade', (req, socket, head) => {
  let pathname = '/';
  try {
    pathname = new URL(req.url || '/', 'http://local').pathname || '/';
  } catch (_e) {
    pathname = '/';
  }
  if (!isWebSocketProxyPath(pathname) && !isApiProxyPath(pathname)) {
    try {
      socket.destroy();
    } catch (_d) {}
    return;
  }

  const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
  delete headers['accept-encoding'];

  const upstreamReq = http.request({
    hostname: API_HOST,
    port: API_PORT,
    path: req.url || '/',
    method: req.method || 'GET',
    headers,
  });

  upstreamReq.on('upgrade', (upRes, upSocket, upHead) => {
    try {
      let out = 'HTTP/1.1 101 Switching Protocols\r\n';
      const h = upRes.headers || {};
      for (const key of Object.keys(h)) {
        const val = h[key];
        if (Array.isArray(val)) {
          for (const v of val) out += `${key}: ${v}\r\n`;
        } else if (val != null) {
          out += `${key}: ${val}\r\n`;
        }
      }
      out += '\r\n';
      socket.write(out);
      if (upHead && upHead.length) socket.write(upHead);
      if (head && head.length) upSocket.write(head);
      upSocket.pipe(socket);
      socket.pipe(upSocket);
      upSocket.on('error', () => {
        try {
          socket.destroy();
        } catch (_e) {}
      });
      socket.on('error', () => {
        try {
          upSocket.destroy();
        } catch (_e2) {}
      });
    } catch (_pipe) {
      try {
        socket.destroy();
      } catch (_e3) {}
      try {
        upSocket.destroy();
      } catch (_e4) {}
    }
  });

  upstreamReq.on('error', () => {
    try {
      socket.destroy();
    } catch (_e) {}
  });

  upstreamReq.on('response', (upRes) => {
    // Upstream refused upgrade — close client socket.
    try {
      upRes.resume();
    } catch (_r) {}
    try {
      socket.destroy();
    } catch (_d) {}
  });

  upstreamReq.end();
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[preview] ERROR: gateway port ${LISTEN_PORT} already in use — will retry, not exit ` +
        `(backend must stay on API_PORT=${API_PORT})`
    );
    // Never process.exit here — that stops the whole Docker preview container.
    setTimeout(() => {
      try {
        server.listen(LISTEN_PORT, '0.0.0.0');
      } catch (_e) {
        console.error('[preview] gateway retry failed — holding process');
        setInterval(() => {}, 3600_000);
      }
    }, 2000);
    return;
  }
  console.error('[preview] gateway listen error:', err && err.message ? err.message : err);
  setInterval(() => {}, 3600_000);
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(
    `[preview] gateway listening on 0.0.0.0:${LISTEN_PORT} static=${STATIC_ROOT} api=http://${API_HOST}:${API_PORT}`
  );
});
