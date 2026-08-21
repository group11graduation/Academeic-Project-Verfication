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
const Module = require('module');

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
  const explicit = String(process.env.PREVIEW_LOGIN_API_PATH || '').trim();
  if (explicit) return explicit;
  const prefix = String(process.env.PREVIEW_API_PREFIX || '')
    .trim()
    .replace(/\/$/, '');
  if (prefix === '/api/v1') return '/api/v1/auth/login';
  return '/api/users/login';
}

/** Common Express login mounts — frontend often calls /auth/login while API is /api/auth/login. */
const LOGIN_UPSTREAM_CANDIDATES = [
  '/api/auth/login',
  '/api/users/login',
  '/api/user/login',
  '/api/login',
  '/api/v1/auth/login',
  '/auth/login',
  '/users/login',
  '/user/login',
];

function isLoginApiRequest(method, pathname) {
  const m = String(method || 'GET').toUpperCase();
  if (m !== 'POST' && m !== 'PUT' && m !== 'PATCH') return false;
  const p = String(pathname || '').split('?')[0] || '/';
  return /\/login\/?$/i.test(p) || /\/(signin|sign-in|authenticate)\/?$/i.test(p);
}

/**
 * When Express rejects admin/admin123 (400), mint a JWT in-process via preview-safety.
 * Do NOT spawn a second node (spawnSync often ETIMEDOUT under preview load).
 */
function ensureBackendModulePath() {
  const dirs = [
    process.env.PREVIEW_BACKEND_CWD,
    process.env.BACKEND_CWD,
    '/app/backend',
    '/app/server',
    '/app/Backend',
    '/app',
  ].filter(Boolean);
  for (const dir of dirs) {
    try {
      const nm = path.join(dir, 'node_modules');
      if (!fs.existsSync(nm) && !fs.existsSync(path.join(dir, 'package.json'))) continue;
      const nodePath = [nm, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
      process.env.NODE_PATH = nodePath;
      Module._initPaths();
      return dir;
    } catch (_e) {
      /* next */
    }
  }
  return null;
}

let _previewSafety = null;
function loadPreviewSafety() {
  if (_previewSafety) return _previewSafety;
  ensureBackendModulePath();
  try {
    _previewSafety = require('/preview-safety.cjs');
  } catch (_e) {
    try {
      _previewSafety = require('./preview-safety.cjs');
    } catch (_e2) {
      _previewSafety = null;
    }
  }
  return _previewSafety;
}

async function tryGatewayForceLogin(requestBodyBuf) {
  try {
    let body = {};
    try {
      body = JSON.parse(
        Buffer.isBuffer(requestBodyBuf)
          ? requestBodyBuf.toString('utf8')
          : String(requestBodyBuf || '{}')
      );
    } catch (_e) {
      body = {};
    }
    const safety = loadPreviewSafety();
    if (!safety || typeof safety.forcePreviewLogin !== 'function') {
      console.log('[preview-gateway] force-login: forcePreviewLogin unavailable');
      return null;
    }
    const parsed = await safety.forcePreviewLogin(body);
    if (parsed && parsed.ok && parsed.body) return parsed;
    console.log(
      '[preview-gateway] force-login declined:',
      parsed && parsed.body && (parsed.body.error || parsed.body.message)
    );
    return null;
  } catch (err) {
    console.log('[preview-gateway] force-login exception:', err && err.message ? err.message : err);
    return null;
  }
}

function sendForcedLogin(res, req, forced) {
  const buf = Buffer.from(JSON.stringify(forced.body), 'utf8');
  const outHeaders = {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(buf.length),
    'access-control-allow-origin': req.headers.origin || '*',
    'access-control-allow-credentials': 'true',
    'cache-control': 'no-store',
  };
  res.writeHead(200, outHeaders);
  res.end(buf);
}

function buildLoginUpstreamPaths(originalPath) {
  const pathOnly = String(originalPath).split('?')[0] || '/';
  const qs = String(originalPath).includes('?')
    ? originalPath.slice(originalPath.indexOf('?'))
    : '';
  const out = [];
  const seen = new Set();
  function push(p) {
    const full = p.includes('?') ? p : `${p}${qs}`;
    if (!full || seen.has(full)) return;
    seen.add(full);
    out.push(full);
  }
  push(originalPath);
  const preferred = loginPath();
  if (preferred && preferred !== '/login') push(preferred);
  if (!/^\/api(\/|$)/i.test(pathOnly)) {
    push(`/api${pathOnly}`);
  }
  for (const c of LOGIN_UPSTREAM_CANDIDATES) push(c);
  return out;
}

/**
 * Frontend often calls /api/students while Express mounts /students (or the reverse).
 * Also try singular/plural and /api/v1 — fixes DropSafe and most MERN ZIPs automatically.
 */
function buildApiUpstreamPaths(originalPath) {
  const pathOnly = String(originalPath).split('?')[0] || '/';
  const qs = String(originalPath).includes('?')
    ? originalPath.slice(originalPath.indexOf('?'))
    : '';
  const out = [];
  const seen = new Set();
  function push(p) {
    const full = !p ? '' : p.includes('?') ? p : `${String(p).split('?')[0]}${qs}`;
    if (!full || seen.has(full)) return;
    seen.add(full);
    out.push(full);
  }
  if (isWebSocketProxyPath(pathOnly)) {
    push(originalPath);
    return out;
  }

  // LoanFlow / dual SPA+API paths: ALWAYS try the bare path first. Never invent
  // /api/v1/admin/loans (Express catch-all → JSON "not found" in the browser).
  if (
    /^\/api\/v1\/admin\//i.test(pathOnly) ||
    /^\/api\/admin\//i.test(pathOnly)
  ) {
    const stripped = pathOnly.replace(/^\/api\/v1/i, '').replace(/^\/api/i, '') || '/';
    push(stripped);
    push(originalPath);
    push(`/api${stripped}`);
    return out;
  }
  if (
    /^\/admin\//i.test(pathOnly) ||
    /^\/(loans|repayments|loan-documents|loan-types)(\/|$)/i.test(pathOnly)
  ) {
    push(originalPath);
    if (!/^\/api(\/|$)/i.test(pathOnly)) {
      push(`/api${pathOnly}`);
    }
    for (const sp of singularPluralPathVariantsLocal(pathOnly)) {
      push(sp);
      push(`/api${sp}`);
    }
    return out;
  }

  function singularPluralPathVariantsLocal(p) {
    const parts = String(p || '')
      .split('?')[0]
      .split('/')
      .filter(Boolean);
    if (!parts.length) return [];
    const last = parts[parts.length - 1];
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(last)) return [];
    const next = parts.slice();
    if (/ies$/i.test(last) && last.length > 4) next[next.length - 1] = `${last.slice(0, -3)}y`;
    else if (/s$/i.test(last) && last.length > 2 && !/ss$/i.test(last)) {
      next[next.length - 1] = last.replace(/s$/i, '');
    } else if (/y$/i.test(last) && last.length > 2) {
      next[next.length - 1] = `${last.slice(0, -1)}ies`;
    } else next[next.length - 1] = `${last}s`;
    if (next[next.length - 1] === last) return [];
    return [`/${next.join('/')}`];
  }

  // When path is already /api/v1/categories, do not explode into /list /getAll /admin variants.
  if (/^\/api\/v1\//i.test(pathOnly)) {
    push(originalPath);
    // Only mild fallbacks if the v1 route is truly missing (not for 500 handler crashes).
    const bareRes = pathOnly.replace(/^\/api\/v1/i, '') || '/';
    push(`/api${bareRes}`);
    push(bareRes);
    return out;
  }

  // Maktabadda-style: mounts are /api/v1/categories — prefer that BEFORE bare /categories.
  const apiPrefix = String(process.env.PREVIEW_API_PREFIX || '')
    .trim()
    .replace(/\/$/, '');
  const bare = pathOnly.replace(/^\/api\/v1/i, '').replace(/^\/api/i, '') || '/';
  const isLibraryBare =
    /^\/(categories|category|locations|location|cabinets|cabinet|libraries|library|shelves|shelf|books|book|volumes|volume|book-placements|book-placement)(\/|$)/i.test(
      bare
    );
  if (
    apiPrefix &&
    isLibraryBare &&
    bare !== '/' &&
    !new RegExp(`^${apiPrefix.replace(/\//g, '\\/')}(\\/|$)`, 'i').test(pathOnly)
  ) {
    push(`${apiPrefix}${bare.startsWith('/') ? bare : `/${bare}`}`);
  }
  if (isLibraryBare && bare !== '/' && !/^\/api(\/|$)/i.test(pathOnly)) {
    push(`/api/v1${bare}`);
  }
  push(originalPath);

  function singularPlural(p) {
    return singularPluralPathVariantsLocal(p);
  }

  const candidates = [pathOnly];
  if (/^\/api\/v1\//i.test(pathOnly)) {
    candidates.push(pathOnly.replace(/^\/api\/v1\//i, '/api/'));
    candidates.push(pathOnly.replace(/^\/api\/v1/i, '') || '/');
  } else if (/^\/api\//i.test(pathOnly)) {
    candidates.push(pathOnly.replace(/^\/api/i, '') || '/');
    candidates.push(pathOnly.replace(/^\/api\//i, '/api/v1/'));
  } else if (pathOnly !== '/' && !/^\/api(\/|$)/i.test(pathOnly)) {
    if (isLibraryBare) {
      candidates.push(`/api/v1${pathOnly}`);
      candidates.push(`/api${pathOnly}`);
    } else if (/^\/admin\//i.test(pathOnly) || /^\/(loans|repayments|loan-documents|loan-types)(\/|$)/i.test(pathOnly)) {
      // LoanFlow: keep bare /admin/loans — do not invent /api/v1/admin/loans.
      candidates.push(`/api${pathOnly}`);
    } else {
      candidates.push(`/api${pathOnly}`);
      candidates.push(`/api/v1${pathOnly}`);
    }
  }
  // Nested admin mounts common in library / inventory MERN ZIPs.
  if (/\/(categories|category|books|book|libraries|library|shelves|shelf|locations|location|cabinets|cabinet|volumes|volume|book-placements|book-placement)(\/|$)/i.test(pathOnly)) {
    const bareRes = pathOnly.replace(/^\/api\/v1/i, '').replace(/^\/api/i, '') || pathOnly;
    candidates.push(`/api/v1${bareRes}`);
    candidates.push(`/api/admin${bareRes}`);
    candidates.push(`/admin${bareRes}`);
    candidates.push(`/api${bareRes}/list`);
    candidates.push(`${bareRes}/list`);
    candidates.push(`/api${bareRes}/all`);
    candidates.push(`${bareRes}/all`);
    candidates.push(`/api${bareRes}/getAll`);
    candidates.push(`${bareRes}/getAll`);
  }
  for (const c of [...candidates]) {
    for (const sp of singularPlural(c)) candidates.push(sp);
  }
  for (const c of candidates) push(c);
  return out;
}

function looksLikeRouteNotFound(status, bodyBuf) {
  if (status === 404 || status === 405) return true;
  if (status < 400 || status >= 500) return false;
  try {
    const s = Buffer.isBuffer(bodyBuf) ? bodyBuf.toString('utf8') : String(bodyBuf || '');
    return /route\s*not\s*found|cannot\s+(GET|POST|PUT|PATCH|DELETE)|not\s+found:\s*\/|resource\s+was\s+not\s+found|requested\s+resource\s+was\s+not\s+found/i.test(
      s
    );
  } catch (_e) {
    return false;
  }
}

/** Do not downgrade /api/v1/* to /api or bare — that breaks Maktabadda POST/GET. */
function shouldRetryUpstreamPath(status, bodyBuf, fromPath, method) {
  const pathOnly = String(fromPath || '').split('?')[0] || '/';
  // Canonical Maktabadda mounts — never strip /api/v1 on 404 OR 500.
  if (/^\/api\/v1(\/|$)/i.test(pathOnly)) {
    return false;
  }
  if (status === 401 || status === 403) return false;
  if (status >= 500) return false;
  return looksLikeRouteNotFound(status, bodyBuf);
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
let cachedFallbackMtime = null;
function loadFallbackJs() {
  try {
    const st = fs.statSync('/preview-login-fallback.js');
    const mtime = Number(st.mtimeMs) || 0;
    if (cachedFallbackJs != null && cachedFallbackMtime === mtime) return cachedFallbackJs;
    cachedFallbackJs = fs.readFileSync('/preview-login-fallback.js', 'utf8');
    cachedFallbackMtime = mtime;
  } catch (_e) {
    cachedFallbackJs = cachedFallbackJs || '';
  }
  return cachedFallbackJs;
}

function wrapHtml(html) {
  const base = apiBaseForBrowser();
  const pathLogin = loginPath();
  const mainRole = mainRoleFromEnv();
  const adminHome = adminHomeFromEnv();
  const adminEmail = String(
    process.env.PREVIEW_ADMIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@preview.demo'
  ).trim();
  const adminPass = String(
    process.env.PREVIEW_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'Preview123!'
  );
  const seedUser = String(
    process.env.PREVIEW_SEED_USERNAME ||
      process.env.ADMIN_USERNAME ||
      (adminEmail.includes('@') ? adminEmail.split('@')[0] : adminEmail) ||
      'admin'
  ).trim();
  const apiPrefix = String(process.env.PREVIEW_API_PREFIX || '')
    .trim()
    .replace(/\/$/, '');
  const boot =
    `<meta name="sv-api-base" content="${base.replace(/"/g, '&quot;')}" />` +
    `<script>/*__SV_API_BOOT__*/window.__SV_API_BASE__=${JSON.stringify(base)};` +
    `window.__SV_API_PREFIX__=${JSON.stringify(apiPrefix)};` +
    `window.__SV_LOGIN_API_PATH__=${JSON.stringify(pathLogin)};` +
    `window.__SV_MAIN_ADMIN_ROLE__=${JSON.stringify(mainRole)};` +
    `window.__SV_ADMIN_HOME_PATH__=${JSON.stringify(adminHome)};` +
    `window.__SV_PREVIEW_ADMIN_EMAIL__=${JSON.stringify(adminEmail)};` +
    `window.__SV_PREVIEW_ADMIN_PASSWORD__=${JSON.stringify(adminPass)};` +
    `window.__SV_PREVIEW_SEED_USERNAME__=${JSON.stringify(seedUser)};` +
    `window.__SV_PREVIEW_CREDS__=${JSON.stringify({
      email: adminEmail,
      password: adminPass,
      username: seedUser,
      apiBase: base,
      loginPath: pathLogin,
      apiPrefix: apiPrefix,
    })};</script>`;
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
  // DropSafe / school apps: /students, /student, …
  if (/^\/(students|student|courses|course|teachers|teacher|classes|class|attendance|grades|risk)(\/|$)/i.test(p)) {
    return true;
  }
  // Maktabadda / library catalog apps (bare paths, no /api prefix).
  if (
    /^\/(categories|category|locations|location|cabinets|cabinet|libraries|library|shelves|shelf|books|book|volumes|volume|book-placements|book-placement|authors|author|publishers|publisher|placements|placement)(\/|$)/i.test(
      p
    )
  ) {
    return true;
  }
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

/** GET list endpoints that can soft-empty when Express/Mongo returns 500. */
function isListishApiPath(pathname) {
  const p = String(pathname || '').split('?')[0] || '/';
  if (/\/students\/stats(\/)?$/i.test(p) || /\/student\/stats(\/)?$/i.test(p)) return true;
  if (/\/admin\/loans(\/)?$/i.test(p)) return true;
  return /\/(categories|locations|cabinets|libraries|shelves|books|volumes|book-placements|users|students|student|products|orders|items|loans|notifications|members|authors|publishers)(\/)?$/i.test(
    p
  );
}

function requestWantsHtml(req) {
  const dest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  const mode = String(req.headers['sec-fetch-mode'] || '').toLowerCase();
  if (dest === 'document' || mode === 'navigate') return true;
  const accept = String(req.headers.accept || '');
  return /text\/html/i.test(accept) && !/application\/json/i.test(accept);
}

function softEmptyListBody(pathname) {
  const p = String(pathname || '').split('?')[0] || '/';
  // DropSafe dashboard — UI does res.data.data.length / stats fields.
  if (/\/students\/stats(\/)?$/i.test(p) || /\/student\/stats(\/)?$/i.test(p)) {
    return JSON.stringify({
      status: true,
      success: true,
      data: {
        total: 0,
        high: 0,
        medium: 0,
        low: 0,
        droppedOut: 0,
        avgGpa: '0',
        avgAttendance: '0',
      },
    });
  }
  if (/\/students(\/)?$/i.test(p) || /\/student(\/)?$/i.test(p)) {
    return JSON.stringify({ status: true, success: true, count: 0, data: [], students: [] });
  }
  // Maktabadda fetchData expects { status, data: { docs, totalDocs, ... } }
  if (
    /\/(categories|locations|cabinets|libraries|shelves|books|volumes|book-placements|users)(\/)?$/i.test(
      p
    )
  ) {
    return JSON.stringify({
      status: true,
      data: {
        docs: [],
        totalDocs: 0,
        limit: 10,
        totalPages: 0,
        page: 1,
        pagingCounter: 1,
        hasPrevPage: false,
        hasNextPage: false,
        prevPage: null,
        nextPage: null,
      },
    });
  }
  return JSON.stringify({ status: true, success: true, data: [], count: 0 });
}

function looksLikeUpstreamDbFailure(status, bodyBuf) {
  if (status < 500) return false;
  try {
    const s = Buffer.isBuffer(bodyBuf) ? bodyBuf.toString('utf8') : String(bodyBuf || '');
    return /mongo|mongoose|ECONNREFUSED|ETIMEDOUT|buffering timed out|failed to connect|ServerSelectionError|topology was destroyed|not connected|CastError|ValidationError|Internal Server Error/i.test(
      s
    );
  } catch (_e) {
    return status >= 500;
  }
}

/** Student createItem often returns 500 on Mongo E11000 when duplicateMsg is omitted. */
function looksLikeDuplicateKeyError(bodyBuf) {
  try {
    const s = Buffer.isBuffer(bodyBuf) ? bodyBuf.toString('utf8') : String(bodyBuf || '');
    return /E11000|duplicate key|dup key/i.test(s);
  } catch (_e) {
    return false;
  }
}

function looksLikeJwtAuthError(bodyBuf) {
  try {
    const s = Buffer.isBuffer(bodyBuf) ? bodyBuf.toString('utf8') : String(bodyBuf || '');
    return /jwt\s+malformed|jwt\s+invalid|invalid\s+token|JsonWebTokenError|TokenExpiredError|jwt expired/i.test(
      s
    );
  } catch (_e) {
    return false;
  }
}

function isJunkBearerHeader(auth) {
  const s = String(auth || '').trim();
  if (!s) return true;
  const m = s.match(/^Bearer\s+(.*)$/i);
  const tok = (m ? m[1] : s).trim();
  if (!tok) return true;
  if (/^(undefined|null|nan|true|false|\[object Object\])$/i.test(tok)) return true;
  if (tok.split('.').length < 3) return true;
  return false;
}

let _cachedPreviewBearer = '';
async function getPreviewInjectBearer() {
  if (_cachedPreviewBearer && !isJunkBearerHeader(_cachedPreviewBearer)) {
    return _cachedPreviewBearer;
  }
  const forced = await tryGatewayForceLogin(Buffer.from('{}', 'utf8'));
  const body = forced && forced.body ? forced.body : null;
  const tok =
    (body && (body.token || body.accessToken || body.access_token)) ||
    (body && body.data && (body.data.token || body.data.accessToken)) ||
    '';
  if (!tok || isJunkBearerHeader(tok)) return '';
  _cachedPreviewBearer = /^Bearer\s+/i.test(tok) ? tok : `Bearer ${tok}`;
  return _cachedPreviewBearer;
}

function rewriteDuplicateKeyBody(bodyBuf) {
  let msg = 'A record with this name already exists';
  try {
    const s = Buffer.isBuffer(bodyBuf) ? bodyBuf.toString('utf8') : String(bodyBuf || '');
    const j = JSON.parse(s);
    if (j && typeof j.message === 'string' && j.message.trim()) {
      msg = /E11000|dup key/i.test(j.message)
        ? 'A record with this name already exists'
        : j.message;
    }
  } catch (_e) {
    /* keep default */
  }
  return Buffer.from(JSON.stringify({ status: false, message: msg }), 'utf8');
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
  if (isStaticAssetRequest(pathname)) return false;

  const dest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  const mode = String(req.headers['sec-fetch-mode'] || '').toLowerCase();
  // Real top-level navigations (address bar, location.assign, link click).
  // MUST win over isApiProxyPath — LoanFlow uses the same URL for SPA (/admin/loans)
  // and axios GET /admin/loans. Document navigations were getting raw JSON "[]".
  if (dest === 'document' || mode === 'navigate') return true;

  // XHR/fetch to dual SPA/API paths → proxy to Express (not SPA).
  if (isApiProxyPath(pathname)) return false;

  const accept = String(req.headers.accept || '');
  // Explicit document request (older browsers without Sec-Fetch-*).
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
    .then(async (body) => {
      const headers = { ...req.headers, host: `${API_HOST}:${API_PORT}` };
      delete headers['accept-encoding'];
      delete headers['transfer-encoding'];
      headers['content-length'] = String(body.length);
      // Node lowercases incoming headers; Express protect often reads Authorization.
      let auth =
        req.headers.authorization ||
        req.headers.Authorization ||
        headers.authorization ||
        headers.Authorization ||
        '';
      // Student UIs send "Bearer undefined" → Express jwt.verify → 500. Strip + inject.
      if (auth && isJunkBearerHeader(auth)) {
        console.log('[preview-gateway] stripped junk Authorization');
        auth = '';
        delete headers.authorization;
        delete headers.Authorization;
        delete req.headers.authorization;
        delete req.headers.Authorization;
      }
      const pathOnlyEarly = String(req.url || '/').split('?')[0] || '/';
      if (
        !auth &&
        isApiProxyPath(pathOnlyEarly) &&
        !isLoginApiRequest(method, pathOnlyEarly) &&
        !isWebSocketProxyPath(pathOnlyEarly)
      ) {
        try {
          const injected = await getPreviewInjectBearer();
          if (injected) {
            auth = injected;
            console.log('[preview-gateway] injected preview Authorization for', pathOnlyEarly);
          }
        } catch (_inj) {
          /* ignore */
        }
      }
      if (auth) {
        headers.authorization = auth;
        headers.Authorization = auth;
      }

      const originalPath = req.url || '/';
      const pathOnly = String(originalPath).split('?')[0] || '/';
      const qs = String(originalPath).includes('?')
        ? originalPath.slice(originalPath.indexOf('?'))
        : '';
      let pathsToTry = [originalPath];
      if (isLoginApiRequest(method, pathOnly)) {
        // DropSafe / many MERN apps: UI posts /auth/login, Express mounts /api/auth/login.
        pathsToTry = buildLoginUpstreamPaths(originalPath);
        console.log('[preview-gateway] login upstream tries:', pathsToTry.join(' → '));
      } else if (!isWebSocketProxyPath(pathOnly)) {
        // /api/students ↔ /students (and the reverse) for all CRUD APIs.
        pathsToTry = buildApiUpstreamPaths(originalPath);
        if (pathsToTry.length > 1) {
          console.log('[preview-gateway] api upstream tries:', pathsToTry.join(' → '));
        }
      }

      function attempt(index, authRetried) {
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
          const isLogin = isLoginApiRequest(method, pathOnly);
          const hasMorePaths = index + 1 < pathsToTry.length;

          // Buffer error bodies so we can detect "Route not found" even when status is 400,
          // and retry /api ↔ bare / singular ↔ plural automatically.
          // Also buffer 500s on list GETs so we can soft-empty when Mongo/Express crashes
          // (Maktabadda /categories → 500 spam + POST hang).
          if (
            hasMorePaths &&
            !isLogin &&
            ((status >= 400 && status < 500) || (status >= 500 && isListishApiPath(pathOnly)))
          ) {
            const errChunks = [];
            up.on('data', (c) => errChunks.push(c));
            up.on('end', () => {
              const errBuf = Buffer.concat(errChunks);
              const tryPathOnly = String(tryPath || '').split('?')[0] || '';
              // /api/v1/* returned 500 (real handler crash) — do NOT wander to /api/categories.
              if (/^\/api\/v1(\/|$)/i.test(tryPathOnly) && status >= 500) {
                if (
                  !authRetried &&
                  looksLikeJwtAuthError(errBuf) &&
                  !isLogin
                ) {
                  return Promise.resolve(getPreviewInjectBearer()).then((bearer) => {
                    if (!bearer || res.headersSent) {
                      const soft = Buffer.from(
                        JSON.stringify({ status: false, message: 'Not authorized' }),
                        'utf8'
                      );
                      return send(res, 401, soft, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': req.headers.origin || '*',
                        'Access-Control-Allow-Credentials': 'true',
                        'X-SV-Preview-Jwt-Fix': '1',
                      });
                    }
                    headers.authorization = bearer;
                    headers.Authorization = bearer;
                    console.log(
                      '[preview-gateway] /api/v1 jwt error → retry with preview bearer',
                      tryPathOnly
                    );
                    return attempt(index, true);
                  });
                }
                if (method === 'GET' && isListishApiPath(pathOnly) && !requestWantsHtml(req)) {
                  console.log(
                    '[preview-gateway] /api/v1 list',
                    status,
                    '→ soft-empty (no path downgrade)',
                    tryPathOnly,
                    'body=',
                    errBuf.toString('utf8').slice(0, 300)
                  );
                  const soft = Buffer.from(softEmptyListBody(pathOnly), 'utf8');
                  return send(res, 200, soft, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': req.headers.origin || '*',
                    'Access-Control-Allow-Credentials': 'true',
                    'X-SV-Preview-Soft-Empty': '1',
                    'X-SV-Upstream-Status': String(status),
                  });
                }
                if (looksLikeDuplicateKeyError(errBuf)) {
                  console.log(
                    '[preview-gateway] /api/v1 duplicate key',
                    status,
                    '→ 400',
                    tryPathOnly
                  );
                  const soft = rewriteDuplicateKeyBody(errBuf);
                  return send(res, 400, soft, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': req.headers.origin || '*',
                    'Access-Control-Allow-Credentials': 'true',
                    'X-SV-Preview-Duplicate': '1',
                  });
                }
                const outHeaders = { ...up.headers };
                outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
                outHeaders['access-control-allow-credentials'] = 'true';
                outHeaders['content-length'] = String(errBuf.length);
                delete outHeaders['transfer-encoding'];
                console.log(
                  '[preview-gateway] /api/v1',
                  status,
                  'body=',
                  errBuf.toString('utf8').slice(0, 300)
                );
                res.writeHead(status, outHeaders);
                res.end(errBuf);
                return;
              }
              if (
                shouldRetryUpstreamPath(status, errBuf, tryPath, method) ||
                (status >= 500 &&
                  isListishApiPath(pathOnly) &&
                  !/^\/api\/v1(\/|$)/i.test(tryPathOnly))
              ) {
                console.log(
                  '[preview-gateway] api',
                  status,
                  '→ next path',
                  tryPath,
                  '→',
                  pathsToTry[index + 1]
                );
                  return attempt(index + 1, authRetried);
              }
              const outHeaders = { ...up.headers };
              outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
              outHeaders['access-control-allow-credentials'] = 'true';
              outHeaders['content-length'] = String(errBuf.length);
              delete outHeaders['transfer-encoding'];
              res.writeHead(status, outHeaders);
              res.end(errBuf);
            });
            up.on('error', () => {
              if (!res.headersSent) jsonError(res, 502, 'Upstream response error');
            });
            return;
          }

          // Last path still 500 on a list GET — return empty JSON so SPA stays usable.
          // Never soft-empty a browser document navigation (LoanFlow /admin/loans → raw []).
          if (
            !isLogin &&
            status >= 500 &&
            method === 'GET' &&
            isListishApiPath(pathOnly) &&
            !requestWantsHtml(req)
          ) {
            const errChunks = [];
            up.on('data', (c) => errChunks.push(c));
            up.on('end', () => {
              const errBuf = Buffer.concat(errChunks);
              if (looksLikeUpstreamDbFailure(status, errBuf) || status >= 500) {
                console.log(
                  '[preview-gateway] list GET',
                  status,
                  '→ soft-empty',
                  pathOnly
                );
                const soft = Buffer.from(softEmptyListBody(pathOnly), 'utf8');
                return send(res, 200, soft, {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': req.headers.origin || '*',
                  'Access-Control-Allow-Credentials': 'true',
                  'X-SV-Preview-Soft-Empty': '1',
                });
              }
              const outHeaders = { ...up.headers };
              outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
              outHeaders['access-control-allow-credentials'] = 'true';
              outHeaders['content-length'] = String(errBuf.length);
              delete outHeaders['transfer-encoding'];
              res.writeHead(status, outHeaders);
              res.end(errBuf);
            });
            up.on('error', () => {
              if (!res.headersSent) jsonError(res, 502, 'Upstream response error');
            });
            return;
          }

          // Mutating CRUD: map Mongo duplicate-key 500 → 400 (student createItem omission).
          if (
            !isLogin &&
            status >= 500 &&
            (method === 'POST' || method === 'PUT' || method === 'PATCH')
          ) {
            const errChunks = [];
            up.on('data', (c) => errChunks.push(c));
            up.on('end', () => {
              const errBuf = Buffer.concat(errChunks);
              if (!authRetried && looksLikeJwtAuthError(errBuf)) {
                return Promise.resolve(getPreviewInjectBearer()).then((bearer) => {
                  if (!bearer || res.headersSent) {
                    const soft = Buffer.from(
                      JSON.stringify({ status: false, message: 'Not authorized' }),
                      'utf8'
                    );
                    return send(res, 401, soft, {
                      'Content-Type': 'application/json; charset=utf-8',
                      'Access-Control-Allow-Origin': req.headers.origin || '*',
                      'Access-Control-Allow-Credentials': 'true',
                      'X-SV-Preview-Jwt-Fix': '1',
                    });
                  }
                  headers.authorization = bearer;
                  headers.Authorization = bearer;
                  console.log(
                    '[preview-gateway] write jwt error → retry with preview bearer',
                    pathOnly
                  );
                  return attempt(index, true);
                });
              }
              if (looksLikeDuplicateKeyError(errBuf)) {
                console.log(
                  '[preview-gateway] duplicate key',
                  status,
                  '→ 400',
                  pathOnly
                );
                const soft = rewriteDuplicateKeyBody(errBuf);
                return send(res, 400, soft, {
                  'Content-Type': 'application/json; charset=utf-8',
                  'Access-Control-Allow-Origin': req.headers.origin || '*',
                  'Access-Control-Allow-Credentials': 'true',
                  'X-SV-Preview-Duplicate': '1',
                });
              }
              const outHeaders = { ...up.headers };
              outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
              outHeaders['access-control-allow-credentials'] = 'true';
              outHeaders['content-length'] = String(errBuf.length);
              delete outHeaders['transfer-encoding'];
              console.log(
                '[preview-gateway]',
                method,
                status,
                'body=',
                errBuf.toString('utf8').slice(0, 300)
              );
              res.writeHead(status, outHeaders);
              res.end(errBuf);
            });
            up.on('error', () => {
              if (!res.headersSent) jsonError(res, 502, 'Upstream response error');
            });
            return;
          }

          // Exhausted all mounts with 404 on a list GET — soft-empty (do NOT serve SPA HTML)
          // unless this is a document navigation to a dual SPA/API path.
          if (
            !isLogin &&
            !hasMorePaths &&
            (status === 404 || looksLikeRouteNotFound(status, Buffer.alloc(0))) &&
            method === 'GET' &&
            isListishApiPath(pathOnly)
          ) {
            up.resume();
            if (requestWantsHtml(req)) {
              console.log('[preview-gateway] list GET 404 + HTML nav → SPA', pathOnly);
              return serveStatic(req, res);
            }
            console.log('[preview-gateway] list GET 404 exhausted → soft-empty', pathOnly);
            const soft = Buffer.from(softEmptyListBody(pathOnly), 'utf8');
            return send(res, 200, soft, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': req.headers.origin || '*',
              'Access-Control-Allow-Credentials': 'true',
              'X-SV-Preview-Soft-Empty': '1',
            });
          }

          if (status === 404 && hasMorePaths) {
            up.resume();
                  return attempt(index + 1, authRetried);
          }
          // Never fall back to SPA HTML for known API list/CRUD paths (breaks axios JSON parse).
          if (status === 404 && canFallback && !isApiProxyPath(pathOnly) && !isListishApiPath(pathOnly)) {
            up.resume();
            return serveStatic(req, res);
          }
          if (status === 404 && isListishApiPath(pathOnly) && method === 'GET') {
            up.resume();
            if (requestWantsHtml(req)) {
              console.log('[preview-gateway] list GET final 404 + HTML nav → SPA', pathOnly);
              return serveStatic(req, res);
            }
            console.log('[preview-gateway] list GET final 404 → soft-empty', pathOnly);
            const soft = Buffer.from(softEmptyListBody(pathOnly), 'utf8');
            return send(res, 200, soft, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': req.headers.origin || '*',
              'Access-Control-Allow-Credentials': 'true',
              'X-SV-Preview-Soft-Empty': '1',
            });
          }

          // Express may reject demo admin/admin123 with 400 before preview-safety recovery.
          // Mint JWT at the gateway so login works regardless of inject order.
          if (
            isLogin &&
            (status === 400 || status === 401 || status === 403 || status === 422)
          ) {
            const errChunks = [];
            up.on('data', (c) => errChunks.push(c));
            up.on('end', () => {
              Promise.resolve(tryGatewayForceLogin(body))
                .then((forced) => {
                  if (res.headersSent) return;
                  if (forced) {
                    console.log(
                      '[preview-gateway] login force OK after upstream',
                      status,
                      'on',
                      tryPath
                    );
                    return sendForcedLogin(res, req, forced);
                  }
                  const errBuf = Buffer.concat(errChunks);
                  const outHeaders = { ...up.headers };
                  outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
                  outHeaders['access-control-allow-credentials'] = 'true';
                  outHeaders['content-length'] = String(errBuf.length);
                  delete outHeaders['transfer-encoding'];
                  res.writeHead(status, outHeaders);
                  res.end(errBuf);
                })
                .catch((err) => {
                  if (res.headersSent) return;
                  console.log(
                    '[preview-gateway] force-login async error:',
                    err && err.message ? err.message : err
                  );
                  const errBuf = Buffer.concat(errChunks);
                  const outHeaders = { ...up.headers };
                  outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
                  outHeaders['access-control-allow-credentials'] = 'true';
                  outHeaders['content-length'] = String(errBuf.length);
                  delete outHeaders['transfer-encoding'];
                  res.writeHead(status, outHeaders);
                  res.end(errBuf);
                });
            });
            up.on('error', () => {
              if (!res.headersSent) jsonError(res, 502, 'Upstream response error');
            });
            return;
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
          // Document navigation accidentally proxied: Express returned [] for /admin/loans.
          if (method === 'GET' && requestWantsHtml(req) && !looksHtml) {
            up.resume();
            console.log('[preview-gateway] HTML nav got non-HTML upstream → SPA', pathOnly);
            return serveStatic(req, res);
          }
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
          if (index + 1 < pathsToTry.length) return attempt(index + 1, authRetried);
          if (canFallback) return serveStatic(req, res);
          return jsonError(res, 504, 'Upstream API timeout');
        });

        upstream.on('error', (err) => {
          if (res.headersSent) return;
          if (index + 1 < pathsToTry.length) return attempt(index + 1, authRetried);
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

  // Never proxy SPA shell HTML to Express (was spamming /index.html → /api/index.html).
  if (/\.html?$/i.test(pathname) || pathname === '/' || pathname === '/index.html') {
    return serveStatic(req, res);
  }

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
  const safetyOk = fs.existsSync('/preview-safety.cjs');
  console.log(
    `[preview] gateway listening on 0.0.0.0:${LISTEN_PORT} static=${STATIC_ROOT} api=http://${API_HOST}:${API_PORT}`
  );
  console.log(
    `[preview-gateway] force-login=in-process safety=${safetyOk ? 'YES' : 'MISSING'} backendCwd=${process.env.PREVIEW_BACKEND_CWD || '(unset)'}`
  );
});
