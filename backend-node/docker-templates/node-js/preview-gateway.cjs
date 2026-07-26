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
  const boot =
    `<meta name="sv-api-base" content="${base.replace(/"/g, '&quot;')}" />` +
    `<script>/*__SV_API_BOOT__*/window.__SV_API_BASE__=${JSON.stringify(base)};` +
    `window.__SV_LOGIN_API_PATH__=${JSON.stringify(pathLogin)};</script>`;
  const fallback = loadFallbackJs();
  const fallbackBlock =
    fallback && !html.includes('__SV_LOGIN_FALLBACK_V10__')
      ? `<script>\n${fallback}\n</script>`
      : '';
  return `${boot}${fallbackBlock}${html}`;
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
  if (/\/login\/?$/i.test(p) && /^\/(api|auth|users|user|v1)\b/i.test(p)) return true;
  return false;
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
      if (!/^\/api(\/|$)/i.test(pathOnly) && !/^\/auth(\/|$)/i.test(pathOnly)) {
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
          if (preferSpaOnNonHtml && canFallback && status >= 200 && status < 400 && !looksHtml) {
            up.resume();
            return serveStatic(req, res);
          }

          const outHeaders = { ...up.headers };
          outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
          outHeaders['access-control-allow-credentials'] = 'true';
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

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(
      `[preview] ERROR: gateway port ${LISTEN_PORT} already in use — refusing duplicate listen ` +
        `(backend must stay on API_PORT=${API_PORT})`
    );
    process.exit(2);
  }
  console.error('[preview] gateway listen error:', err && err.message ? err.message : err);
  process.exit(1);
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(
    `[preview] gateway listening on 0.0.0.0:${LISTEN_PORT} static=${STATIC_ROOT} api=http://${API_HOST}:${API_PORT}`
  );
});
