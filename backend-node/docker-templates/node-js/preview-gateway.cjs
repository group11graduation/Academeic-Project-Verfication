#!/usr/bin/env node
/**
 * ScholarVerify preview gateway: static SPA + reverse-proxy to Express API.
 * Injects API boot + login fallback into index.html in-memory (no bind-mount writes).
 *
 * Routing: try backend first for non-asset paths; fall back to SPA static on GET/HEAD 404/errors.
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
    fallback && !html.includes('__SV_LOGIN_FALLBACK__')
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
 * Try upstream API first. On GET/HEAD 404 or connection failure → SPA static.
 * On POST/PUT/… errors/timeouts → 502/504 (never serve index.html for mutations).
 */
function proxyTryThenStatic(req, res) {
  const method = String(req.method || 'GET').toUpperCase();
  const canFallback = isSafeStaticFallbackMethod(method);

  readRequestBody(req)
    .then((body) => {
      const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
      delete headers['accept-encoding'];
      delete headers['transfer-encoding'];
      headers['content-length'] = String(body.length);

      const opts = {
        hostname: API_HOST,
        port: API_PORT,
        path: req.url,
        method,
        headers,
        timeout: 30000,
      };

      const upstream = http.request(opts, (up) => {
        const status = up.statusCode || 502;
        if (status === 404 && canFallback) {
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
        if (canFallback) return serveStatic(req, res);
        return jsonError(res, 504, 'Upstream API timeout');
      });

      upstream.on('error', (err) => {
        if (res.headersSent) return;
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
  return proxyTryThenStatic(req, res);
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
