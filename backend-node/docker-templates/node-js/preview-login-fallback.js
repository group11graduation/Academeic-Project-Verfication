/**
 * Injected into student preview index.html so login works across Express route shapes.
 * On 404 / "Route not found", retries common API login paths against the API origin
 * (never against the SPA origin — that caused SYADA "Route not found" on /login).
 *
 * UNIVERSAL for every future React+Express(+Mongo/MySQL) ZIP upload:
 * the node-backend overlays this file into each preview container at start, so new
 * student projects get these fixes without per-project patches.
 *
 * Marker V25:
 * - Shop/Harmony: also set localStorage.role / isAdmin (many SPAs read bare "role" key).
 * - After login, promote /profile|/orders customer dash → /admin once (admin@preview.demo).
 * V24:
 * - Stop login↔logout / login↔admin redirect loops (max 1 admin landing; abort on bounce).
 * - Patch JWT role to admin for ALL apps (not only Sky) so ProtectedRoute keeps the session.
 * V23:
 * - After preview login, ALWAYS land on admin home (not /shop / home / profile).
 * - Force top-level login JSON `.role` to admin (Harmony userInfo kept role:"user").
 * - Rescue when SPA already navigated to customer routes.
 * V22:
 * - Sky Property sidebar: sweep ALL storage keys + JWT payloads + API user JSON to
 *   SUPER_ADMIN (ADMIN left nav empty). Retry reload until role sticks.
 * V21:
 * - Sky Property: detect brand text / SUPER_ADMIN+MANAGER enums; force role SUPER_ADMIN
 *   so sidebar nav links render (ADMIN role left the sidebar empty).
 * V20:
 * - Safe list hardening for ALL future ZIPs (no project-specific unwrap of books/products).
 * - Only unwrap generic { data|items|results|…: [...] } envelopes; keep named list objects.
 * - Keep bare arrays as arrays (V19).
 * V19:
 * - Do NOT wrap bare JSON arrays as objects (fixes dashboard "a.map is not a function").
 * - Still coerce missing list fields on object payloads to [].
 * V18:
 * - Normalize API JSON list fields (loans, products, …) so UIs that do data.loans.length
 *   never crash when the backend omits the array (LoanFlow /admin/loans).
 * V17: main admin role + admin home path for every project.
 * V9: rewrite Vite-proxy style paths (/dashboard/summary → /api/dashboard/summary).
 */
(function () {
  if (window.__SV_LOGIN_FALLBACK_V25__) {
    console.log('[DEBUG-SHIM] already installed V25 — skip');
    return;
  }
  window.__SV_LOGIN_FALLBACK_V25__ = true;
  window.__SV_LOGIN_FALLBACK_V24__ = true;
  window.__SV_LOGIN_FALLBACK_V23__ = true;
  window.__SV_LOGIN_FALLBACK_V22__ = true;
  window.__SV_LOGIN_FALLBACK_V21__ = true;
  window.__SV_LOGIN_FALLBACK_V20__ = true;
  window.__SV_LOGIN_FALLBACK_V19__ = true;
  window.__SV_LOGIN_FALLBACK_V18__ = true;
  window.__SV_LOGIN_FALLBACK_V17__ = true;
  window.__SV_LOGIN_FALLBACK_V16__ = true;
  window.__SV_LOGIN_FALLBACK_V15__ = true;
  window.__SV_LOGIN_FALLBACK_V14__ = true;
  window.__SV_LOGIN_FALLBACK_V13__ = true;
  window.__SV_LOGIN_FALLBACK_V12__ = true;
  window.__SV_LOGIN_FALLBACK_V11__ = true;
  window.__SV_LOGIN_FALLBACK_V10__ = true;
  window.__SV_LOGIN_FALLBACK_V9__ = true;
  window.__SV_LOGIN_FALLBACK_V8__ = true;
  window.__SV_LOGIN_FALLBACK_V7__ = true;
  window.__SV_LOGIN_FALLBACK__ = true;
  console.log('[DEBUG-SHIM] preview-login-fallback ACTIVE v25', {
    href: String(location.href || ''),
    apiBase: window.__SV_API_BASE__ || null,
    loginPath: window.__SV_LOGIN_API_PATH__ || null,
  });

  var PATHS = [
    '/api' + '/auth/login',
    '/auth' + '/login',
    '/api' + '/user/login',
    '/api' + '/users/login',
    '/users' + '/login',
    '/api' + '/login',
    '/api' + '/v1/auth/login',
  ];

  function setNativeValue(el, value) {
    if (!el) return;
    try {
      var proto =
        el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
    } catch (_e) {
      el.value = value;
    }
    try {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
    } catch (_e2) {
      try {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_e3) {}
    }
  }

  function applyPreviewCreds(creds) {
    if (!creds || !creds.email) return;
    window.__SV_PREVIEW_CREDS__ = creds;
    if (creds.apiBase) window.__SV_API_BASE__ = String(creds.apiBase).replace(/\/$/, '');
    if (creds.loginPath) window.__SV_LOGIN_API_PATH__ = String(creds.loginPath).trim();
    function fill() {
      try {
        var emailSel =
          'input[type="email"], input[name="email"], input[name="username"], input[name="identifier"], input[autocomplete="username"]';
        var passSel = 'input[type="password"], input[name="password"], input[name="passcode"]';
        var emailEl = document.querySelector(emailSel);
        var passEl = document.querySelector(passSel);
        if (emailEl) setNativeValue(emailEl, creds.email);
        if (passEl && creds.password) setNativeValue(passEl, creds.password);
        if (!document.getElementById('sv-preview-login-banner') && creds.email) {
          var ban = document.createElement('div');
          ban.id = 'sv-preview-login-banner';
          ban.setAttribute(
            'style',
            'position:fixed;z-index:2147483646;left:12px;right:12px;bottom:12px;background:#14532d;color:#ecfdf5;padding:10px 14px;border-radius:8px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)'
          );
          ban.textContent =
            'Preview login: ' + creds.email + (creds.password ? ' / ' + creds.password : '');
          document.body.appendChild(ban);
        }
      } catch (_e) {}
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill);
    else fill();
    setTimeout(fill, 800);
    setTimeout(fill, 2500);
  }

  if (window.__SV_PREVIEW_CREDS__) applyPreviewCreds(window.__SV_PREVIEW_CREDS__);
  try {
    fetch('/preview-credentials.json', { cache: 'no-store' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (j) {
        if (j && j.email) applyPreviewCreds(j);
      })
      .catch(function () {});
  } catch (_e) {}

  function detectApiBase() {
    if (window.__SV_API_BASE__) return String(window.__SV_API_BASE__).replace(/\/$/, '');
    try {
      var meta = document.querySelector('meta[name="sv-api-base"]');
      if (meta && meta.content) return String(meta.content).replace(/\/$/, '');
    } catch (_e) {}
    // Same-origin gateway: default to the page origin so localhost calls get rewritten.
    try {
      if (window.location && window.location.origin) return String(window.location.origin).replace(/\/$/, '');
    } catch (_e4) {}
    return '';
  }

  function isLoopbackOrigin(origin) {
    var o = String(origin || '');
    return /https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(o);
  }

  /** Vite-baked API URL on same VPS host but UI/API different published ports. */
  function isPreviewSiblingOrigin(originOrUrl) {
    try {
      var u = new URL(String(originOrUrl || ''), window.location.href);
      return u.hostname === window.location.hostname && u.host !== window.location.host;
    } catch (_e) {
      return false;
    }
  }

  function isLoginUrl(url) {
    try {
      var u = String(url || '');
      return /\/(api\/)?(auth\/|users\/|user\/|v1\/auth\/)?login\/?(\?|$)/i.test(u);
    } catch (_e) {
      return false;
    }
  }

  /**
   * Universal (all ZIPs) list-response hardening — safe for existing + future projects.
   *
   * Rules (do not break other apps):
   * 1) Never wrap a bare JSON array as an object (breaks `a.map`).
   * 2) Never strip named lists (`books`, `products`, …) into a bare array
   *    (breaks `res.data.books.map` apps).
   * 3) Only unwrap generic envelopes `{ data|items|results|rows|list|docs: [...] }`
   *    when other keys are harmless meta (success/message/count/…).
   * 4) On objects, coerce missing/invalid list fields to [].
   * 5) Null body on catalog-style GET paths → [] .
   */
  function normalizeApiListBody(body, url) {
    if (body == null) {
      try {
        var nullPath = new URL(String(url || ''), window.location.href).pathname || '';
        if (/\/(books|products|users|orders|items|loans|notifications|categories)(\/)?$/i.test(nullPath)) {
          return [];
        }
      } catch (_n) {}
      return body;
    }
    var path = '';
    try {
      path = new URL(String(url || ''), window.location.href).pathname || '';
    } catch (_e) {
      path = String(url || '');
    }
    // Keep bare arrays as arrays (do not wrap).
    if (Array.isArray(body)) return body;
    if (typeof body !== 'object') return body;

    // Safe envelope unwrap only — never rename books/products into a bare array.
    var unwrapped = unwrapGenericListEnvelope(body);
    if (unwrapped !== body) return unwrapped;

    var out = body;
    try {
      out = {};
      for (var k in body) {
        if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
      }
    } catch (_e2) {
      out = body;
    }
    var listKeys = [
      'loans',
      'loanTypes',
      'users',
      'items',
      'products',
      'books',
      'bookList',
      'notifications',
      'orders',
      'members',
      'applications',
      'repayments',
      'documents',
      'results',
      'categories',
      'appointments',
      'patients',
      'doctors',
      'bookings',
      'services',
      'projects',
      'tasks',
      'tickets',
      'messages',
      'invoices',
      'payments',
      'transactions',
      'list',
      'rows',
      'records',
    ];
    for (var i = 0; i < listKeys.length; i++) {
      var key = listKeys[i];
      if (Object.prototype.hasOwnProperty.call(out, key) && !Array.isArray(out[key])) {
        var v = out[key];
        if (v && typeof v === 'object') {
          if (Array.isArray(v.data)) out[key] = v.data;
          else if (Array.isArray(v.items)) out[key] = v.items;
          else if (Array.isArray(v.results)) out[key] = v.results;
          else out[key] = [];
        } else {
          out[key] = [];
        }
      }
    }
    // Promote nested list under `data` only when it clearly wraps a list.
    // Never force-convert login-style { data: { user, token } } objects.
    if (Object.prototype.hasOwnProperty.call(out, 'data') && out.data != null && !Array.isArray(out.data)) {
      if (typeof out.data === 'object') {
        if (Array.isArray(out.data.items)) out.data = out.data.items;
        else if (Array.isArray(out.data.results)) out.data = out.data.results;
        else if (Array.isArray(out.data.list)) out.data = out.data.list;
        else if (Array.isArray(out.data.rows)) out.data = out.data.rows;
        else if (Array.isArray(out.data.books)) out.data = out.data.books;
      }
    }
    if (/\/admin\/loans\/?$/i.test(path) || /\/loans(\/my)?\/?$/i.test(path)) {
      if (!Array.isArray(out.loans)) {
        out.loans = Array.isArray(out.data) ? out.data : Array.isArray(out.items) ? out.items : [];
      }
    }
    if (/\/loan-types\/?$/i.test(path) && !Array.isArray(out.loanTypes)) out.loanTypes = [];
    if (/\/notifications\/?$/i.test(path) && !Array.isArray(out.notifications)) out.notifications = [];
    if (/\/repayments/i.test(path) && !Array.isArray(out.repayments)) out.repayments = [];
    if (/\/products/i.test(path) && !Array.isArray(out.products) && !Array.isArray(out.categories)) {
      if ('products' in out || /products/i.test(path)) out.products = Array.isArray(out.products) ? out.products : [];
    }
    if (/\/books/i.test(path) && 'books' in out && !Array.isArray(out.books)) {
      out.books = [];
    }
    return out;
  }

  /** Unwrap { data: [...] , success?, message? } only — keeps { books: [...] } intact. */
  function unwrapGenericListEnvelope(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
    // Login / auth payloads must never be unwrapped.
    if (body.token || body.accessToken || body.access_token || body.user) return body;
    if (body.data && typeof body.data === 'object' && !Array.isArray(body.data) && (body.data.token || body.data.user)) {
      return body;
    }
    var meta = {
      success: 1,
      message: 1,
      msg: 1,
      status: 1,
      count: 1,
      total: 1,
      page: 1,
      limit: 1,
      error: 1,
      errors: 1,
    };
    var genericListKeys = { data: 1, items: 1, results: 1, rows: 1, list: 1, docs: 1, records: 1 };
    var keys = Object.keys(body);
    var listKey = null;
    var listCount = 0;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (meta[k]) continue;
      if (Array.isArray(body[k])) {
        listCount += 1;
        listKey = k;
      } else if (body[k] != null && typeof body[k] === 'object') {
        return body;
      } else if (typeof body[k] === 'string' || typeof body[k] === 'number' || typeof body[k] === 'boolean') {
        // non-meta scalar → treat as domain field, do not unwrap
        if (!meta[k]) return body;
      }
    }
    if (listCount === 1 && listKey && genericListKeys[listKey] && Array.isArray(body[listKey])) {
      return body[listKey];
    }
    return body;
  }

  function rewriteJsonApiResponse(res, url) {
    if (!res || res.status < 200 || res.status >= 300) return Promise.resolve(res);
    var ct = '';
    try {
      ct = String(res.headers && res.headers.get ? res.headers.get('content-type') : '') || '';
    } catch (_e) {}
    // Many student APIs omit Content-Type; still try JSON for API-ish URLs.
    var looksApi = /\/api\/|\/admin\/|\/loans|\/products|\/users|\/books/i.test(String(url || ''));
    if (ct && ct.indexOf('json') < 0 && !looksApi) return Promise.resolve(res);
    return res
      .clone()
      .json()
      .then(function (body) {
        var normalized = normalizeApiListBody(body, url);
        // Sky Property: any auth/profile payload must carry SUPER_ADMIN for sidebar links.
        try {
          if (isSkyPropertyApp() && normalized && typeof normalized === 'object') {
            if (
              normalized.user ||
              normalized.role ||
              normalized.token ||
              /\/(auth|login|users\/me|profile|current)/i.test(String(url || ''))
            ) {
              normalized = forceSkyRoleInObject(normalized);
            }
          }
        } catch (_sky) {}
        try {
          if (JSON.stringify(normalized) === JSON.stringify(body)) return res;
        } catch (_eq) {}
        return new Response(JSON.stringify(normalized), {
          status: res.status,
          statusText: res.statusText,
          headers: { 'Content-Type': 'application/json' },
        });
      })
      .catch(function () {
        return res;
      });
  }

  function splitBaseAndPath(url) {
    var u = String(url || '');
    var m = u.match(/^(https?:\/\/[^/]+)(\/.*)?$/i);
    if (m) return { origin: m[1], path: m[2] || '/' };
    if (u.charAt(0) === '/') return { origin: '', path: u };
    return { origin: '', path: '/' + u };
  }

  function buildUrl(origin, path) {
    if (!origin) return path;
    return origin.replace(/\/$/, '') + path;
  }

  function loginCandidates(url) {
    var parts = splitBaseAndPath(url);
    var apiBase = detectApiBase();
    // If the request wrongly targets the SPA origin (same host as the page),
    // OR still points at localhost/127.0.0.1 (common after Vite bake),
    // force retries onto the public API base (VPS host:API port).
    var pageOrigin = '';
    try {
      pageOrigin = window.location.origin;
    } catch (_e) {}
    var origin = parts.origin || '';
    if (apiBase && (!origin || origin === pageOrigin || isLoopbackOrigin(origin) || isPreviewSiblingOrigin(origin))) {
      origin = apiBase;
    }
    if (!origin && apiBase) origin = apiBase;

    var preferred = '';
    try {
      preferred = String(window.__SV_LOGIN_API_PATH__ || '').trim();
    } catch (_e2) {}

    var ordered = [];
    var seen = {};
    function push(p) {
      if (!p || seen[p]) return;
      seen[p] = true;
      ordered.push(buildUrl(origin, p.charAt(0) === '/' ? p : '/' + p));
    }
    if (preferred) push(preferred);
    PATHS.forEach(push);
    var incoming = (parts.path || '').split('?')[0];
    if (incoming && incoming !== '/login') push(incoming);

    // Keep original absolute URL last (if different) so we don't loop forever.
    var original = typeof url === 'string' ? url : '';
    if (original && !seen[original] && !isLoopbackOrigin(original)) ordered.push(original);
    return ordered.filter(function (u) {
      return u !== url;
    }).concat(isLoopbackOrigin(url) ? [] : [url]);
  }

  function shouldRetry(status, bodyText) {
    if (status === 404) return true;
    var t = String(bodyText || '').toLowerCase();
    return (
      t.indexOf('route not found') >= 0 ||
      t.indexOf('cannot post') >= 0 ||
      t.indexOf('not found') >= 0
    );
  }

  function roleKeyOf(role) {
    return String(role || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  function isSuperAdminKey(key) {
    return key === 'SUPER_ADMIN' || key === 'SUPERADMIN';
  }

  function pageHintHtml() {
    try {
      return (document.documentElement && document.documentElement.innerHTML) || '';
    } catch (_e) {
      return '';
    }
  }

  /** Hints mined from the SPA (role guards + routes). Shared across all MERN previews. */
  var appHints = {
    allowLists: [],
    routes: [],
    scanned: false,
    listKeys: {},
  };

  function uniqStrings(arr) {
    var out = [];
    var seen = {};
    for (var i = 0; i < arr.length; i++) {
      var v = String(arr[i] || '').trim();
      if (!v || seen[v]) continue;
      seen[v] = true;
      out.push(v);
    }
    return out;
  }

  function extractQuotedStrings(chunk) {
    var out = [];
    var re = /['"`]([^'"`]{1,64})['"`]/g;
    var m;
    while ((m = re.exec(String(chunk || '')))) {
      out.push(m[1]);
    }
    return out;
  }

  function addAllowList(roles) {
    var u = uniqStrings(roles).filter(function (r) {
      return /^[A-Za-z][A-Za-z0-9_\-]{1,32}$/.test(r);
    });
    if (u.length < 1 || u.length > 6) return;
    var key = u
      .slice()
      .sort()
      .join('|');
    if (appHints.listKeys[key]) return;
    appHints.listKeys[key] = true;
    appHints.allowLists.push(u);
  }

  function ingestHintText(text) {
    if (!text) return;
    var t = String(text);
    var listRe =
      /(?:roles|allowedRoles|allowed_roles|PERMITTED_ROLES|roleOptions)\s*[:=]\s*\[([^\]]{0,500})\]/gi;
    var setRe = /Set\s*\(\s*\[([^\]]{0,500})\]\s*\)/g;
    var m;
    while ((m = listRe.exec(t))) {
      addAllowList(extractQuotedStrings(m[1]));
    }
    while ((m = setRe.exec(t))) {
      addAllowList(extractQuotedStrings(m[1]));
    }
    // Staff tuples in minified guards only (keep short — avoids noisy false positives).
    var tupleRe =
      /\[((?:['"`](?:admin|ADMIN|Admin|officer|Officer|manager|MANAGER|editor|borrower|super_admin|SUPER_ADMIN)['"`]\s*,?\s*){1,6})\]/g;
    while ((m = tupleRe.exec(t))) {
      addAllowList(extractQuotedStrings(m[1]));
    }
    var routeRe = /(?:path|to)\s*:\s*['"`](\/[A-Za-z0-9/_-]{1,80})['"`]/g;
    while ((m = routeRe.exec(t))) {
      appHints.routes.push(m[1]);
    }
    // window.location.href="/admin" style (skincare / shop admin homes).
    var hrefRe =
      /(?:location\.href|window\.location|assign|replace)\s*[=(]\s*['"`](\/[A-Za-z0-9/_-]{1,80})['"`]/g;
    while ((m = hrefRe.exec(t))) {
      appHints.routes.push(m[1]);
    }
    // role==="admin" / role===`super_admin` — remember exact privileged strings.
    var roleEqRe =
      /role\s*===\s*['"`](admin|Admin|ADMIN|super_admin|SUPER_ADMIN|SuperAdmin|officer|manager|editor|SUPERADMIN)['"`]/g;
    while ((m = roleEqRe.exec(t))) {
      addAllowList([m[1]]);
    }
    appHints.routes = uniqStrings(appHints.routes);
  }

  function scanAppBundles(done) {
    function start() {
      ingestHintText(pageHintHtml());
      var scripts = [];
      try {
        scripts = Array.prototype.slice.call(document.querySelectorAll('script[src]') || []);
      } catch (_e) {
        scripts = [];
      }
      var pending = 0;
      var finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        appHints.scanned = true;
        console.log('[DEBUG-SHIM] app hints', {
          allowLists: appHints.allowLists.slice(0, 8),
          routes: appHints.routes.slice(0, 20),
        });
        if (typeof done === 'function') done();
      }
      function oneDone() {
        pending -= 1;
        if (pending <= 0) finish();
      }
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src || scripts[i].getAttribute('src');
        if (!src) continue;
        if (/node_modules|react-vendor|polyfill/i.test(src) && !/index|main|app|bundle/i.test(src)) {
          continue;
        }
        pending += 1;
        (function (url) {
          fetch(url, { credentials: 'same-origin', cache: 'force-cache' })
            .then(function (r) {
              return r.ok ? r.text() : '';
            })
            .then(function (txt) {
              if (txt && txt.length < 8000000) ingestHintText(txt);
            })
            .catch(function () {})
            .then(oneDone);
        })(src);
      }
      if (pending === 0) finish();
      else setTimeout(finish, 5000);
    }
    // CRITICAL: shim is injected BEFORE app <script src>, so querySelectorAll is
    // empty if we scan synchronously. Wait for DOM (and a tick after load).
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(start, 0);
      });
    } else {
      setTimeout(start, 0);
    }
  }

  function allHintRoles() {
    var all = [];
    for (var i = 0; i < appHints.allowLists.length; i++) {
      all = all.concat(appHints.allowLists[i]);
    }
    return uniqStrings(all);
  }

  function roleAcceptedByHints(role) {
    var lists = appHints.allowLists;
    if (!lists.length) return true;
    var key = roleKeyOf(role);
    for (var i = 0; i < lists.length; i++) {
      var list = lists[i];
      for (var j = 0; j < list.length; j++) {
        if (list[j] === role || roleKeyOf(list[j]) === key) return true;
      }
    }
    // Also accept if role matches a known end-user role that appears in routes UI text.
    return false;
  }

  function exactRoleFromHints(role) {
    var key = roleKeyOf(role);
    var lists = appHints.allowLists;
    for (var i = 0; i < lists.length; i++) {
      for (var j = 0; j < lists[i].length; j++) {
        if (lists[i][j] === role) return lists[i][j];
        if (roleKeyOf(lists[i][j]) === key) return lists[i][j];
      }
    }
    return role;
  }

  function preferPrivilegedRole(vals) {
    var list = vals || [];
    var pickExact = function (candidates) {
      for (var i = 0; i < candidates.length; i++) {
        if (list.indexOf(candidates[i]) >= 0) return candidates[i];
      }
      return null;
    };
    // LoanFlow: never pick "borrower" for the preview admin account.
    if (isLoanStyleApp()) {
      return pickExact(['admin', 'ADMIN', 'Admin', 'officer', 'Officer']) || 'admin';
    }
    var has = function (re) {
      return list.some(function (v) {
        return re.test(String(v));
      });
    };
    var staffSetStyle =
      has(/^super_admin$/i) && has(/^manager$/i) && (has(/^editor$/i) || has(/^super_admin$/i));
    if (staffSetStyle || isStaffSetApp()) {
      return (
        pickExact(['super_admin', 'SUPER_ADMIN', 'SuperAdmin', 'manager', 'editor', 'admin', 'ADMIN']) ||
        list[0] ||
        null
      );
    }
    if (isSkyPropertyApp()) {
      return pickExact(['SUPER_ADMIN', 'super_admin', 'MANAGER', 'manager', 'admin', 'ADMIN']) || list[0];
    }
    return (
      pickExact([
        'admin',
        'ADMIN',
        'Admin',
        'officer',
        'Officer',
        'manager',
        'MANAGER',
        'editor',
        'EDITOR',
        'super_admin',
        'SUPER_ADMIN',
      ]) ||
      list.find(function (v) {
        return /admin|officer|manager|editor/i.test(v);
      }) ||
      list[0] ||
      null
    );
  }

  function isLoanStyleApp() {
    var html = pageHintHtml();
    if (/loan_token|loan_user|LoanFlow/i.test(html)) return true;
    try {
      if (localStorage.getItem('loan_token') || localStorage.getItem('loan_user')) return true;
    } catch (_e) {}
    var roles = allHintRoles();
    var hasBorrower = roles.some(function (r) {
      return /^borrower$/i.test(r);
    });
    var hasOfficer = roles.some(function (r) {
      return /^officer$/i.test(r);
    });
    var hasAdmin = roles.some(function (r) {
      return /^admin$/i.test(r);
    });
    if (hasBorrower && hasOfficer && hasAdmin) return true;
    if (hasRoute('/admin/loans') && hasBorrower) return true;
    return false;
  }

  function isSkyPropertyApp() {
    try {
      if (window.__SV_SKY_PROPERTY__) return true;
    } catch (_eF) {}
    try {
      if (/SKY\s*PROPERTY/i.test(String(document.title || ''))) {
        window.__SV_SKY_PROPERTY__ = true;
        return true;
      }
    } catch (_e0) {}
    try {
      var bodyText = String((document.body && document.body.innerText) || '').slice(0, 8000);
      if (/SKY\s*PROPERTY/i.test(bodyText)) {
        window.__SV_SKY_PROPERTY__ = true;
        return true;
      }
    } catch (_e1) {}
    try {
      var htmlDom = String((document.documentElement && document.documentElement.innerHTML) || '').slice(0, 200000);
      if (/SKY\s*PROPERTY|sky[\s_-]*property|SkyProperty/i.test(htmlDom)) {
        window.__SV_SKY_PROPERTY__ = true;
        return true;
      }
    } catch (_eDom) {}
    var html = pageHintHtml();
    if (/SKY\s*PROPERTY|sky[\s_-]*property|SkyProperty/i.test(html)) {
      window.__SV_SKY_PROPERTY__ = true;
      return true;
    }
    if (/manDash/.test(html)) {
      window.__SV_SKY_PROPERTY__ = true;
      return true;
    }
    if (appHints.routes.indexOf('/manDash') >= 0) {
      window.__SV_SKY_PROPERTY__ = true;
      return true;
    }
    var roles = allHintRoles();
    var hasSuperUpper = roles.some(function (r) {
      return r === 'SUPER_ADMIN';
    });
    var hasManagerUpper = roles.some(function (r) {
      return r === 'MANAGER' || r === 'SUB_MANAGER';
    });
    if (hasSuperUpper && hasManagerUpper) {
      window.__SV_SKY_PROPERTY__ = true;
      return true;
    }
    try {
      if (/manDash/i.test(String(location.pathname || ''))) {
        window.__SV_SKY_PROPERTY__ = true;
        return true;
      }
    } catch (_e) {}
    return false;
  }

  function patchJwtRoleClaim(token, role) {
    try {
      var parts = String(token || '').split('.');
      if (parts.length !== 3) return token;
      var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var payload = JSON.parse(atob(b64));
      if (!payload || typeof payload !== 'object') return token;
      if (payload.role === role && payload.Role === role) return token;
      payload.role = role;
      payload.Role = role;
      if (payload.user && typeof payload.user === 'object') {
        payload.user.role = role;
        payload.user.Role = role;
      }
      var enc = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
      // Keep original signature — many student UIs only decode the payload for role checks.
      return parts[0] + '.' + enc + '.' + parts[2];
    } catch (_e) {
      return token;
    }
  }

  function deepForceRole(value, role, depth) {
    if (depth > 8 || value == null) return { value: value, changed: false };
    if (typeof value === 'string' && value.split('.').length === 3 && value.length > 40) {
      var patched = patchJwtRoleClaim(value, role);
      return { value: patched, changed: patched !== value };
    }
    if (Array.isArray(value)) {
      var arrChanged = false;
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        var item = deepForceRole(value[i], role, depth + 1);
        arr.push(item.value);
        if (item.changed) arrChanged = true;
      }
      return { value: arr, changed: arrChanged };
    }
    if (typeof value !== 'object') return { value: value, changed: false };
    var out = {};
    var changed = false;
    for (var k in value) {
      if (!Object.prototype.hasOwnProperty.call(value, k)) continue;
      if (k === 'role' || k === 'Role' || k === 'userRole' || k === 'user_role') {
        if (value[k] !== role) {
          out[k] = role;
          changed = true;
        } else {
          out[k] = value[k];
        }
        continue;
      }
      if (k === 'token' || k === 'accessToken' || k === 'access_token' || k === 'jwt') {
        var tok = deepForceRole(value[k], role, depth + 1);
        out[k] = tok.value;
        if (tok.changed) changed = true;
        continue;
      }
      var nested = deepForceRole(value[k], role, depth + 1);
      out[k] = nested.value;
      if (nested.changed) changed = true;
    }
    return { value: out, changed: changed };
  }

  function forceSkyRoleInObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var role = 'SUPER_ADMIN';
    var res = deepForceRole(obj, role, 0);
    var out = res.value;
    if (out && typeof out === 'object' && !Array.isArray(out)) {
      out = ensureUserDisplayFields(out);
      if (out.user && typeof out.user === 'object') out.user = ensureUserDisplayFields(out.user);
    }
    return out;
  }

  /**
   * Any SPA that gates admin UI with Set(['super_admin','manager','editor'])
   * (SYADA and clones). Not limited to a specific brand name.
   */
  function isStaffSetApp() {
    try {
      if (/SYADA/i.test(String(document.title || ''))) return true;
    } catch (_e0) {}
    var html = pageHintHtml();
    if (/SYADA/i.test(html)) return true;
    var roles = allHintRoles();
    var hasSuper = roles.some(function (r) {
      return /^super_admin$/i.test(r);
    });
    var hasManager = roles.some(function (r) {
      return /^manager$/i.test(r);
    });
    var hasEditor = roles.some(function (r) {
      return /^editor$/i.test(r);
    });
    var hasPlainAdmin = roles.some(function (r) {
      return /^admin$/i.test(r);
    });
    // super_admin + manager (+ editor) without plain admin → Set.has apps.
    if (hasSuper && hasManager && (hasEditor || !hasPlainAdmin)) return true;
    if (appHints.routes.indexOf('/admin/dashboard') >= 0 && hasSuper && hasManager) return true;
    if (/\/admin\/dashboard/.test(html) && /super_admin/.test(html) && /manager/.test(html)) return true;
    return false;
  }

  function hasRoute(path) {
    return appHints.routes.indexOf(path) >= 0 || pageHintHtml().indexOf(path) >= 0;
  }

  /**
   * Sync-scan bundles right before login normalize when async scan has not finished.
   * By login time <script src> tags exist; empty hints were the V12/V13 race.
   */
  function ensureHintsBeforeLogin() {
    if (appHints.allowLists.length && appHints.routes.length) return;
    try {
      ingestHintText(pageHintHtml());
      var scripts = Array.prototype.slice.call(document.querySelectorAll('script[src]') || []);
      for (var i = 0; i < scripts.length; i++) {
        var src = scripts[i].src || scripts[i].getAttribute('src');
        if (!src) continue;
        if (/node_modules|react-vendor|polyfill/i.test(src) && !/index|main|app|bundle/i.test(src)) {
          continue;
        }
        try {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', src, false);
          xhr.send(null);
          if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
            var txt = xhr.responseText;
            if (txt.length < 8000000) ingestHintText(txt);
          }
        } catch (_xe) {}
      }
      if (appHints.allowLists.length || appHints.routes.length) {
        appHints.scanned = true;
        console.log('[DEBUG-SHIM] sync hints before login', {
          allowLists: appHints.allowLists.slice(0, 8),
          routes: appHints.routes.slice(0, 20),
        });
      }
    } catch (_e) {}
  }

  /**
   * The single "main admin" role this SPA expects for teacher preview login.
   * Examples: admin (skincare), super_admin (SYADA), SUPER_ADMIN (Sky), officer/admin (LoanFlow).
   */
  function mainAdminRoleForApp() {
    ensureHintsBeforeLogin();
    if (isLoanStyleApp()) return 'admin';
    if (isSkyPropertyApp()) return 'SUPER_ADMIN';
    if (isStaffSetApp()) return 'super_admin';
    if (appHints.allowLists.length) {
      var picked = preferPrivilegedRole(allHintRoles());
      if (picked) return picked;
    }
    var html = pageHintHtml();
    if (/role\s*===\s*['"`]SUPER_ADMIN['"`]/.test(html) || /manDash/.test(html)) return 'SUPER_ADMIN';
    if (/role\s*===\s*['"`]super_admin['"`]/.test(html)) return 'super_admin';
    if (/role\s*===\s*['"`]admin['"`]/.test(html) || hasRoute('/admin')) return 'admin';
    return 'admin';
  }

  /**
   * Map preview/login role onto a string this SPA will accept.
   * Preview accounts always become the project's main admin role.
   */
  function canonicalRoleForApp(role) {
    // Teacher preview login: always the main privileged role for this project.
    return mainAdminRoleForApp();
  }

  function normalizePreviewUserRole(user) {
    if (!user || typeof user !== 'object') return user;
    ensureHintsBeforeLogin();
    var next = mainAdminRoleForApp();
    if (isSkyPropertyApp()) next = 'SUPER_ADMIN';
    var out = {};
    try {
      for (var k in user) {
        if (Object.prototype.hasOwnProperty.call(user, k)) out[k] = user[k];
      }
    } catch (_e) {
      out = user;
    }
    out.role = next;
    out.Role = next;
    out.userRole = next;
    out.user_role = next;
    out.isAdmin = true;
    out.is_admin = true;
    out.admin = true;
    console.log('[DEBUG-SHIM] preview main admin role →', next);
    return ensureUserDisplayFields(out);
  }

  function isCustomerLandingPath(path) {
    var p = String(path || '').replace(/\/+$/, '') || '/';
    if (/^\/(login|signin|sign-in|register|signup|sign-up|admin|manDash|dashboard|portal|teacher|student)(\/|$)/i.test(p)) {
      return false;
    }
    // Shop / storefront / profile — Harmony Skin Care and similar ecommerce SPAs.
    return (
      p === '/' ||
      /^\/(shop|store|home|products|product|cart|checkout|wishlist|orders|order|profile|account|client|customer|user)(\/|$)/i.test(
        p
      )
    );
  }

  function defaultAdminHomePath() {
    ensureHintsBeforeLogin();
    if (isLoanStyleApp()) return '/admin/loans';
    if (isStaffSetApp()) return '/admin/dashboard';
    if (isSkyPropertyApp()) {
      if (hasRoute('/dashboard')) return '/dashboard';
      if (hasRoute('/manDash')) return '/manDash';
      return '/dashboard';
    }
    if (hasRoute('/admin/loans')) return '/admin/loans';
    if (hasRoute('/admin/dashboard')) return '/admin/dashboard';
    if (hasRoute('/admin')) return '/admin';
    // Skincare / Harmony / ecommerce: admin panel is almost always /admin even if
    // the bundle scan missed the route string.
    if (
      isShopStyleApp() ||
      /harmony|skin\s*care|skincare|shop|ecommerce|e-commerce|store/i.test(pageHintHtml()) ||
      /\/(shop|profile|orders)/i.test(String(location.pathname || ''))
    ) {
      return '/admin';
    }
    if (hasRoute('/manDash')) return '/manDash';
    if (hasRoute('/dashboard')) return '/dashboard';
    return '/admin';
  }

  /**
   * Many student Navbars do user.name.charAt(0) with no null check.
   * Preview seeds / lean login payloads often omit name → blank white crash.
   */
  function ensureUserDisplayFields(user) {
    if (!user || typeof user !== 'object') return user;
    var out = {};
    try {
      for (var k in user) {
        if (Object.prototype.hasOwnProperty.call(user, k)) out[k] = user[k];
      }
    } catch (_e) {
      out = user;
    }
    var email = String(out.email || out.username || '').trim();
    var composed = [out.firstName || out.first_name, out.lastName || out.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    var name = String(
      out.name || out.fullName || out.fullname || out.username || composed || (email ? email.split('@')[0] : '') || 'Preview User'
    ).trim();
    if (!name) name = 'Preview User';
    out.name = name;
    if (!out.fullName) out.fullName = name;
    if (!out.firstName && !out.first_name) {
      out.firstName = name.split(/\s+/)[0] || 'Preview';
    }
    if (!out.lastName && !out.last_name) {
      var rest = name.split(/\s+/).slice(1).join(' ');
      out.lastName = rest || 'Admin';
    }
    if (!out.username && email) out.username = email.split('@')[0];
    return out;
  }

  function authStorageKeys() {
    return [
      'user',
      'userInfo',
      'loan_user',
      'authUser',
      'currentUser',
      'admin',
      'auth',
      'profile',
      'loggedInUser',
      'token',
      'accessToken',
      'access_token',
      'jwt',
      'skyUser',
      'sky_user',
      'persist:root',
      'persist:auth',
      'reduxPersist:auth',
    ];
  }

  function storageStores() {
    var out = [];
    try {
      out.push(window.localStorage);
    } catch (_e) {}
    try {
      out.push(window.sessionStorage);
    } catch (_e2) {}
    return out;
  }

  function fixStoredPreviewUserRole() {
    var sky = isSkyPropertyApp();
    var targetRole = sky ? 'SUPER_ADMIN' : mainAdminRoleForApp();
    var changed = false;
    var becameSkyAdmin = false;
    var stores = storageStores();

    function patchRaw(raw) {
      if (raw == null) return { raw: raw, changed: false, prevRole: '' };
      // Bare JWT string
      if (typeof raw === 'string' && raw.split('.').length === 3 && raw.length > 40 && raw.charAt(0) !== '{' && raw.charAt(0) !== '[') {
        var jt = patchJwtRoleClaim(raw, targetRole);
        return { raw: jt, changed: jt !== raw, prevRole: '' };
      }
      try {
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return { raw: raw, changed: false, prevRole: '' };
        var prevRole = String(
          parsed.role ||
            parsed.Role ||
            (parsed.user && (parsed.user.role || parsed.user.Role)) ||
            ''
        );
        var forced = sky ? forceSkyRoleInObject(parsed) : parsed;
        if (!sky) {
          if (forced.user && typeof forced.user === 'object') {
            forced.user.role = targetRole;
            forced.user.Role = targetRole;
            forced.user.isAdmin = true;
            forced.user.is_admin = true;
            forced.user = ensureUserDisplayFields(forced.user);
            forced.role = targetRole;
            forced.Role = targetRole;
            forced.isAdmin = true;
          } else if (forced.email || forced.role || forced.name || forced.token || forced._id) {
            forced.role = targetRole;
            forced.Role = targetRole;
            forced.isAdmin = true;
            forced.is_admin = true;
            forced = ensureUserDisplayFields(forced);
          }
        }
        var serialized = JSON.stringify(forced);
        return {
          raw: serialized,
          changed: serialized !== raw,
          prevRole: prevRole,
          nextRole: String(forced.role || (forced.user && forced.user.role) || ''),
        };
      } catch (_e) {
        return { raw: raw, changed: false, prevRole: '' };
      }
    }

    for (var s = 0; s < stores.length; s++) {
      var store = stores[s];
      if (!store) continue;
      var keys = [];
      try {
        for (var ki = 0; ki < store.length; ki++) keys.push(store.key(ki));
      } catch (_k) {
        keys = authStorageKeys();
      }
      // Always include known auth keys even if length enumeration fails.
      authStorageKeys().forEach(function (k) {
        if (keys.indexOf(k) < 0) keys.push(k);
      });
      for (var i = 0; i < keys.length; i++) {
        var storageKey = keys[i];
        if (!storageKey) continue;
        // Skip huge non-auth blobs
        if (/^firebase|^google|^amplitude|^hj/i.test(storageKey)) continue;
        try {
          var raw = store.getItem(storageKey);
          if (raw == null || raw === '') continue;
          if (raw.length > 500000) continue;
          // Only touch entries that look auth-related unless Sky (then sweep role fields).
          if (
            !sky &&
            authStorageKeys().indexOf(storageKey) < 0 &&
            !/"role"\s*:/.test(raw) &&
            raw.split('.').length !== 3
          ) {
            continue;
          }
          if (sky && !/"role"\s*:/i.test(raw) && raw.split('.').length !== 3 && authStorageKeys().indexOf(storageKey) < 0) {
            continue;
          }
          var patched = patchRaw(raw);
          if (!patched.changed) continue;
          store.setItem(storageKey, patched.raw);
          changed = true;
          console.log('[DEBUG-SHIM] reconciled', storageKey, 'role→', targetRole);
          if (sky && patched.nextRole === 'SUPER_ADMIN' && !/^SUPER_ADMIN$/i.test(patched.prevRole)) {
            becameSkyAdmin = true;
          }
        } catch (_e2) {}
      }
    }

    if (sky) {
      try {
        var stillWrong = false;
        for (var s2 = 0; s2 < stores.length; s2++) {
          var st = stores[s2];
          if (!st) continue;
          for (var j = 0; j < authStorageKeys().length; j++) {
            var kk = authStorageKeys()[j];
            var rv = st.getItem(kk);
            if (!rv) continue;
            if (/"role"\s*:\s*"(ADMIN|admin|Admin|super_admin)"/.test(rv)) stillWrong = true;
          }
        }
        if (stillWrong) {
          try {
            sessionStorage.removeItem('__sv_sky_role_reload__');
          } catch (_c) {}
          becameSkyAdmin = true;
        }
      } catch (_e3) {}
    }

    if (!changed && !becameSkyAdmin) {
      writeBareRoleKeys(targetRole);
      return false;
    }
    writeBareRoleKeys(targetRole);
    try {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('userChanged'));
    } catch (_e4) {}
    if (sky && (becameSkyAdmin || changed)) {
      try {
        var n = Number(sessionStorage.getItem('__sv_sky_role_reload_n__') || '0');
        if (n < 2) {
          sessionStorage.setItem('__sv_sky_role_reload_n__', String(n + 1));
          console.log('[DEBUG-SHIM] Sky Property forcing SUPER_ADMIN — reload', n + 1);
          setTimeout(function () {
            window.location.reload();
          }, 100);
        }
      } catch (_e5) {}
    }
    return true;
  }

  function pickPostLoginPath(user) {
    var role = roleKeyOf((user && (user.role || user.Role)) || mainAdminRoleForApp());
    // Teacher preview login is always privileged — never leave landing null.
    if (
      role === 'ADMIN' ||
      role === 'SUPER_ADMIN' ||
      role === 'SUPERADMIN' ||
      role === 'OFFICER' ||
      role === 'EDITOR' ||
      role === 'MANAGER' ||
      role === 'SUB_MANAGER' ||
      role === 'SUBMANAGER' ||
      !role
    ) {
      return defaultAdminHomePath();
    }
    if (role === 'TEACHER' && hasRoute('/teacher')) return '/teacher';
    if (role === 'STUDENT' && hasRoute('/student')) return '/student';
    if (role === 'MEMBER' && hasRoute('/portal')) return '/portal';
    if (role === 'BORROWER' && hasRoute('/dashboard')) return '/dashboard';
    return defaultAdminHomePath();
  }

  function isHarmonySkinApp() {
    try {
      if (window.__SV_HARMONY_SKIN__) return true;
    } catch (_e) {}
    var html = pageHintHtml();
    if (/harmony\s*skin|harmony\s*skincare|botanical orders|skincare routine/i.test(html)) {
      try {
        window.__SV_HARMONY_SKIN__ = true;
      } catch (_e2) {}
      return true;
    }
    return false;
  }

  function isShopStyleApp() {
    if (isHarmonySkinApp()) return true;
    var html = pageHintHtml();
    return /skincare|skin\s*care|\/shop|ecommerce|e-commerce|botanical/i.test(html);
  }

  function writeBareRoleKeys(role) {
    var r = String(role || mainAdminRoleForApp() || 'admin');
    try {
      // Many student SPAs (Harmony-style) gate admin UI with localStorage.getItem('role').
      localStorage.setItem('role', r);
      localStorage.setItem('userRole', r);
      localStorage.setItem('user_role', r);
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('is_admin', 'true');
      sessionStorage.setItem('role', r);
      sessionStorage.setItem('isAdmin', 'true');
    } catch (_e) {}
  }

  function looksLikePreviewAdminSession() {
    try {
      var email = '';
      var raw =
        localStorage.getItem('user') ||
        localStorage.getItem('userInfo') ||
        localStorage.getItem('loan_user') ||
        '';
      if (raw) {
        try {
          var parsed = JSON.parse(raw);
          email = String(
            (parsed && (parsed.email || parsed.username)) ||
              (parsed && parsed.user && (parsed.user.email || parsed.user.username)) ||
              ''
          ).toLowerCase();
        } catch (_e) {}
      }
      if (!email) email = String(localStorage.getItem('email') || '').toLowerCase();
      return /previewadmin|admin@preview\.demo|preview\.demo/i.test(email);
    } catch (_e2) {
      return false;
    }
  }

  function isAdminNavAborted() {
    try {
      return sessionStorage.getItem('__sv_admin_nav_aborted') === '1';
    } catch (_e) {
      return false;
    }
  }

  function abortAdminNav(reason) {
    try {
      sessionStorage.setItem('__sv_admin_nav_aborted', '1');
      sessionStorage.setItem('__sv_post_login_nav__', 'done');
      console.warn('[DEBUG-SHIM] admin auto-nav aborted —', reason || 'loop');
    } catch (_e) {}
  }

  /** If we forced /admin and the SPA bounced us back to login, stop forever this session. */
  function noteLoginBounceFromAdmin() {
    try {
      var path = String((window.location && window.location.pathname) || '');
      if (!/login|signin|sign-in/i.test(path)) return;
      var target = sessionStorage.getItem('__sv_admin_nav_target__') || '';
      var at = Number(sessionStorage.getItem('__sv_admin_nav_at__') || '0');
      if (!target || !at) return;
      if (Date.now() - at > 12000) return;
      abortAdminNav('bounced from ' + target + ' → login');
    } catch (_e) {}
  }

  function tryRescueStuckLogin() {
    try {
      noteLoginBounceFromAdmin();
      if (isAdminNavAborted()) return;
      if (sessionStorage.getItem('__sv_post_login_nav__') === 'done') return;
      var path = String((window.location && window.location.pathname) || '');
      var token = localStorage.getItem('token') || localStorage.getItem('accessToken') || localStorage.getItem('loan_token');
      if (!token) return;
      // Only rescue while still on the login screen — never fight customer browsing.
      if (!/login|signin|sign-in/i.test(path)) return;
      ensureHintsBeforeLogin();
      fixStoredPreviewUserRole();
      var user = readStoredPreviewUser();
      if (!user) return;
      goAdminHome(user, 'rescue-stuck-login');
    } catch (_e) {}
  }

  function goAdminHome(user, reason) {
    try {
      if (isAdminNavAborted()) return false;
      if (sessionStorage.getItem('__sv_post_login_nav__') === 'done') return false;
      var count = Number(sessionStorage.getItem('__sv_admin_nav_count__') || '0');
      // One hard navigation only — retries caused login↔logout loops.
      if (count >= 1) {
        abortAdminNav('max admin landing attempts');
        return false;
      }
      var target = pickPostLoginPath(user) || defaultAdminHomePath();
      if (!target) return false;
      var cur = String((window.location && window.location.pathname) || '');
      if (cur.replace(/\/+$/, '') === String(target).replace(/\/+$/, '')) {
        sessionStorage.setItem('__sv_post_login_nav__', 'done');
        return false;
      }
      sessionStorage.setItem('__sv_admin_nav_count__', String(count + 1));
      sessionStorage.setItem('__sv_admin_nav_target__', target);
      sessionStorage.setItem('__sv_admin_nav_at__', String(Date.now()));
      sessionStorage.setItem('__sv_post_login_nav__', 'done');
      console.log('[DEBUG-SHIM] admin landing →', target, reason || '');
      window.location.assign(target);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function redirectAfterPreviewLogin(user) {
    try {
      // Fresh login: allow exactly one admin landing for this session.
      try {
        sessionStorage.removeItem('__sv_admin_nav_aborted');
        sessionStorage.removeItem('__sv_admin_nav_count__');
        sessionStorage.removeItem('__sv_post_login_nav__');
        sessionStorage.removeItem('__sv_loop_break__');
        sessionStorage.removeItem('__sv_profile_promoted__');
      } catch (_c) {}
      writeBareRoleKeys((user && user.role) || mainAdminRoleForApp());
      goAdminHome(user, 'post-login');
      // Single delayed check: if SPA won the race and left us on /shop, try once more
      // only when the first attempt never ran (count still 0).
      setTimeout(function () {
        try {
          if (isAdminNavAborted()) return;
          var path = String((window.location && window.location.pathname) || '');
          noteLoginBounceFromAdmin();
          if (/login|signin|sign-in/i.test(path)) return;
          var count = Number(sessionStorage.getItem('__sv_admin_nav_count__') || '0');
          if (count === 0 && /^\/(shop|store|home|products)(\/|$)/i.test(path)) {
            sessionStorage.removeItem('__sv_post_login_nav__');
            goAdminHome(user, 'post-login-shop-race');
          }
        } catch (_e) {}
      }, 800);
    } catch (_e3) {}
  }

  function readStoredPreviewUser() {
    try {
      var raw =
        localStorage.getItem('user') ||
        localStorage.getItem('loan_user') ||
        localStorage.getItem('userInfo') ||
        localStorage.getItem('authUser') ||
        localStorage.getItem('currentUser');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.user && typeof parsed.user === 'object') parsed = parsed.user;
      return normalizePreviewUserRole(parsed);
    } catch (_e) {
      return null;
    }
  }

  function ensureAdminLandingFromCustomerPath(reason) {
    try {
      if (isAdminNavAborted()) return;
      var path = String((window.location && window.location.pathname) || '');
      // Harmony/user dash: PROFILE + ORDERS — promote preview admin to /admin.
      var customerDash = /^\/(shop|store|home|products|profile|orders|account|dashboard)(\/|$)/i.test(path);
      if (!customerDash) return;
      if (!isShopStyleApp() && !looksLikePreviewAdminSession() && !/^\/(shop|profile|orders)(\/|$)/i.test(path)) {
        return;
      }
      var token =
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('loan_token');
      if (!token && !looksLikePreviewAdminSession()) return;
      // Allow exactly one promote from customer dash even if post-login nav already ran
      // (SPA often wins the race and lands on /profile after our first /admin assign).
      var promoted = sessionStorage.getItem('__sv_profile_promoted__') === '1';
      if (promoted) return;
      fixStoredPreviewUserRole();
      writeBareRoleKeys(mainAdminRoleForApp());
      var user = readStoredPreviewUser();
      if (!user && !looksLikePreviewAdminSession()) return;
      sessionStorage.setItem('__sv_profile_promoted__', '1');
      // Reset one-shot landing so goAdminHome can run again for this promote.
      sessionStorage.removeItem('__sv_post_login_nav__');
      var count = Number(sessionStorage.getItem('__sv_admin_nav_count__') || '0');
      if (count >= 2) {
        abortAdminNav('profile promote exhausted');
        return;
      }
      // Allow second attempt specifically for /profile race.
      if (count >= 1) {
        sessionStorage.setItem('__sv_admin_nav_count__', '0');
      }
      goAdminHome(user || { role: mainAdminRoleForApp(), email: 'admin@preview.demo' }, reason || 'customer-dash-promote');
    } catch (_e) {}
  }

  /** Break A↔B Navigate storms including login↔admin / login↔shop. */
  function installRedirectLoopGuard() {
    var recent = [];
    setInterval(function () {
      try {
        var p = String((window.location && window.location.pathname) || '');
        if (!p) return;
        noteLoginBounceFromAdmin();
        if (recent.length && recent[recent.length - 1] === p) return;
        recent.push(p);
        if (recent.length > 20) recent = recent.slice(-20);
        if (recent.length < 4) return;
        var uniq = uniqStrings(recent.slice(-10));
        if (uniq.length !== 2) return;
        var flips = 0;
        for (var i = 1; i < recent.length; i++) {
          if (recent[i] !== recent[i - 1]) flips += 1;
        }
        if (flips < 4) return;
        if (sessionStorage.getItem('__sv_loop_break__')) return;
        sessionStorage.setItem('__sv_loop_break__', '1');
        abortAdminNav('path loop ' + uniq[0] + ' ↔ ' + uniq[1]);
        ensureHintsBeforeLogin();
        var fixed = mainAdminRoleForApp();
        console.warn('[DEBUG-SHIM] redirect loop detected', uniq[0], '↔', uniq[1], '→ stop + role', fixed);
        var keys = authStorageKeys();
        for (var k = 0; k < keys.length; k++) {
          try {
            var raw = localStorage.getItem(keys[k]);
            if (!raw) continue;
            if (typeof raw === 'string' && raw.split('.').length === 3 && raw.length > 40) {
              localStorage.setItem(keys[k], patchJwtRoleClaim(raw, fixed));
              continue;
            }
            var parsed = JSON.parse(raw);
            if (parsed && parsed.user && typeof parsed.user === 'object') {
              parsed.user.role = fixed;
              parsed.user.isAdmin = true;
              parsed.user = ensureUserDisplayFields(parsed.user);
              parsed.role = fixed;
              localStorage.setItem(keys[k], JSON.stringify(parsed));
            } else if (parsed && typeof parsed === 'object') {
              parsed.role = fixed;
              parsed.isAdmin = true;
              parsed = ensureUserDisplayFields(parsed);
              localStorage.setItem(keys[k], JSON.stringify(parsed));
            }
          } catch (_e) {}
        }
        // Prefer a stable non-login destination — never bounce back into the loop pair.
        var safe = '/shop';
        if (isLoanStyleApp()) safe = '/admin/loans';
        else if (hasRoute('/admin/loans')) safe = '/admin/loans';
        else if (hasRoute('/admin/dashboard')) safe = '/admin/dashboard';
        else if (hasRoute('/admin') && uniq.indexOf('/admin') < 0) safe = '/admin';
        else if (uniq.indexOf('/shop') >= 0) safe = '/shop';
        else if (uniq[0] && !/login|signin/i.test(uniq[0])) safe = uniq[0];
        else if (uniq[1] && !/login|signin/i.test(uniq[1])) safe = uniq[1];
        window.location.replace(safe);
      } catch (_e2) {}
    }, 300);
  }

  scanAppBundles(function () {
    fixStoredPreviewUserRole();
    noteLoginBounceFromAdmin();
    tryRescueStuckLogin();
  });
  installRedirectLoopGuard();
  // Brand/title can be known before the JS scan finishes.
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
          fixStoredPreviewUserRole();
          noteLoginBounceFromAdmin();
          tryRescueStuckLogin();
        }, 50);
      });
    } else {
      setTimeout(function () {
        fixStoredPreviewUserRole();
        noteLoginBounceFromAdmin();
        tryRescueStuckLogin();
      }, 50);
    }
  } catch (_eEarly) {}
  // Sky Property paints "SKY PROPERTY" after React mount — re-check role for sidebar links.
  // Harmony often lands on /profile after login — promote to /admin shortly after.
  try {
    setTimeout(function () {
      fixStoredPreviewUserRole();
      writeBareRoleKeys(mainAdminRoleForApp());
      noteLoginBounceFromAdmin();
      ensureAdminLandingFromCustomerPath('t400');
    }, 400);
    setTimeout(function () {
      fixStoredPreviewUserRole();
      writeBareRoleKeys(mainAdminRoleForApp());
      ensureAdminLandingFromCustomerPath('t1200');
    }, 1200);
    setTimeout(function () {
      fixStoredPreviewUserRole();
      ensureAdminLandingFromCustomerPath('t2500');
    }, 2500);
  } catch (_eLate) {}

  /** Rewrite client-side navigations from /profile → /admin right after preview login. */
  function installHistoryAdminPromote() {
    try {
      if (window.__SV_HISTORY_ADMIN_PROMOTE__) return;
      window.__SV_HISTORY_ADMIN_PROMOTE__ = true;
      var wrap = function (fnName) {
        var orig = history[fnName];
        if (typeof orig !== 'function') return;
        history[fnName] = function () {
          try {
            if (!isAdminNavAborted() && looksLikePreviewAdminSession()) {
              var url = arguments.length > 2 ? arguments[2] : '';
              var path = '';
              try {
                path = String(url || '');
                if (path && path.charAt(0) !== '/') {
                  path = new URL(path, location.href).pathname;
                } else {
                  path = path.split('?')[0] || '';
                }
              } catch (_u) {
                path = String(url || '').split('?')[0];
              }
              if (/^\/(profile|orders|shop)(\/|$)/i.test(path)) {
                writeBareRoleKeys(mainAdminRoleForApp());
                if (sessionStorage.getItem('__sv_profile_promoted__') !== '1') {
                  sessionStorage.setItem('__sv_profile_promoted__', '1');
                  console.log('[DEBUG-SHIM] history', fnName, path, '→ /admin');
                  arguments[2] = '/admin';
                }
              }
            }
          } catch (_e) {}
          return orig.apply(this, arguments);
        };
      };
      wrap('pushState');
      wrap('replaceState');
    } catch (_e2) {}
  }
  installHistoryAdminPromote();

  /**
   * Student UIs often do `if (res.data.success)` before storing the token / clearing
   * the spinner. Preview (and many student backends) return token+user without
   * `success`. Normalize so those checks pass and auth guards see a consistent key.
   */
  function normalizeLoginBody(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj.success === false) return obj;
    var nested = obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data) ? obj.data : {};
    var token =
      obj.token ||
      obj.accessToken ||
      obj.access_token ||
      nested.token ||
      nested.accessToken ||
      nested.access_token ||
      null;
    var user = obj.user || nested.user || null;
    // Some APIs return the user document at the top level (token + email/role/name).
    if (!user && (obj.email || obj.role || obj.name || obj.fullName || obj._id || obj.id)) {
      user = {
        _id: obj._id || obj.id,
        id: obj.id || obj._id,
        email: obj.email,
        username: obj.username,
        role: obj.role || obj.Role,
        name: obj.name,
        fullName: obj.fullName,
        firstName: obj.firstName || obj.first_name,
        lastName: obj.lastName || obj.last_name,
      };
    }
    if (user) user = normalizePreviewUserRole(user);
    var adminRole = (user && user.role) || mainAdminRoleForApp();
    if (isSkyPropertyApp()) {
      if (user) user = forceSkyRoleInObject(user);
      adminRole = 'SUPER_ADMIN';
    }
    // Always rewrite JWT payload role — SPA admin guards often read token claims, not userInfo.
    if (token) token = patchJwtRoleClaim(token, adminRole);
    if (!token && !user) return obj;
    var out = {};
    try {
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
      }
    } catch (_e) {
      out = obj;
    }
    if (token) {
      out.token = token;
      out.accessToken = out.accessToken || token;
      out.access_token = out.access_token || token;
    }
    if (user) {
      out.user = user;
      // Flatten for apps that store the whole login JSON as userInfo and read .name/.role.
      // CRITICAL: always overwrite role with the normalized admin role — Harmony/shop
      // apps read userInfo.role; keeping API's role:"user" sent teachers to /shop.
      out.name = user.name || out.name;
      out.fullName = user.fullName || out.fullName;
      out.firstName = user.firstName || out.firstName;
      out.lastName = user.lastName || out.lastName;
      out.email = user.email || out.email;
      out.username = user.username || out.username;
      out.role = user.role;
      out.Role = user.role;
      out.isAdmin = true;
      out.is_admin = true;
      out._id = user._id || user.id || out._id;
      out.id = user.id || user._id || out.id;
    }
    out.success = true;
    out.message = out.message || 'Login successful';
    out.data = {};
    try {
      for (var nk in nested) {
        if (Object.prototype.hasOwnProperty.call(nested, nk)) out.data[nk] = nested[nk];
      }
    } catch (_e2) {}
    if (token) out.data.token = token;
    if (user) out.data.user = user;
    out.data.success = true;
    try {
      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('accessToken', token);
        sessionStorage.setItem('token', token);
      }
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
        // Shop / Harmony-style apps: localStorage.userInfo = entire login payload.
        localStorage.setItem('userInfo', JSON.stringify(out));
        // LoanFlow-style apps: loan_token / loan_user.
        localStorage.setItem('loan_user', JSON.stringify(user));
        if (token) localStorage.setItem('loan_token', token);
        if (user.email) localStorage.setItem('email', String(user.email));
      }
      writeBareRoleKeys((user && user.role) || adminRole || 'admin');
      try {
        sessionStorage.removeItem('__sv_profile_promoted__');
      } catch (_clr) {}
      console.log('[DEBUG-SHIM] normalizeLoginBody wrote localStorage', {
        hasToken: !!token,
        role: user && user.role,
        bareRole: localStorage.getItem('role'),
        name: user && user.name,
        success: true,
      });
      try {
        window.dispatchEvent(new Event('userChanged'));
        window.dispatchEvent(new Event('sv-preview-login'));
      } catch (_e4) {}
      redirectAfterPreviewLogin(user || out);
    } catch (_e3) {}
    return out;
  }

  function rewriteLoginResponse(res) {
    if (!res || res.status < 200 || res.status >= 300) return Promise.resolve(res);
    var ct = '';
    try {
      ct = String(res.headers && res.headers.get ? res.headers.get('content-type') : '') || '';
    } catch (_e) {}
    if (ct && ct.indexOf('json') < 0) return Promise.resolve(res);
    return res
      .clone()
      .json()
      .then(function (body) {
        var normalized = normalizeLoginBody(body);
        if (normalized === body && body && body.success === true) return res;
        return new Response(JSON.stringify(normalized), {
          status: res.status,
          statusText: res.statusText,
          headers: { 'Content-Type': 'application/json' },
        });
      })
      .catch(function () {
        return res;
      });
  }

  function isSameOriginApiPath(url) {
    var u = String(url || '');
    if (u.charAt(0) === '/' && /^\/(api|auth|users|user)\b/i.test(u)) return true;
    try {
      var parsed = new URL(u, window.location.href);
      return parsed.origin === window.location.origin && /^\/(api|auth|users|user)\b/i.test(parsed.pathname);
    } catch (_e) {
      return false;
    }
  }

  function rewriteToApiBase(url) {
    var apiBase = detectApiBase();
    var next = String(url || '');
    // SYADA (and similar Vite apps) call /dashboard/summary, /members, … in the
    // browser, while Express mounts those under /api/*. Dev servers proxy this;
    // preview static+gateway must rewrite or admin loads then looks "logged out".
    try {
      var abs = new URL(next, window.location.href);
      var p = abs.pathname || '';
      if (
        !/^\/api(\/|$)/i.test(p) &&
        !/^\/auth(\/|$)/i.test(p) &&
        /^\/(dashboard|members|finance|reports|sports-members|portal)(\/|$)/i.test(p)
      ) {
        // Keep exact /dashboard as SPA for other projects; only nested API paths.
        if (!/^\/dashboard\/?$/i.test(p)) {
          abs.pathname = '/api' + p;
          next = abs.toString();
        }
      }
    } catch (_e0) {}

    // Baked host:PORT from Vite (UI :8091, API :8576) → same-origin gateway.
    try {
      if (isPreviewSiblingOrigin(next)) {
        var sib = new URL(next, window.location.href);
        var base = apiBase || String(window.location.origin || '').replace(/\/$/, '');
        if (base) {
          next =
            buildUrl(base, sib.pathname || '/') +
            (sib.search || '') +
            (sib.hash || '');
        }
      }
    } catch (_eSib) {}

    if (!apiBase) return next;
    if (isLoopbackOrigin(next) || isSameOriginApiPath(next) || isPreviewSiblingOrigin(next)) {
      if (next.charAt(0) === '/') {
        return (
          buildUrl(apiBase, next.split('?')[0]) +
          (next.indexOf('?') >= 0 ? next.slice(next.indexOf('?')) : '')
        );
      }
      var parts = splitBaseAndPath(next);
      return buildUrl(apiBase, parts.path || '/');
    }
    return next;
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var method = String((init && init.method) || 'GET').toUpperCase();
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var rewritten = rewriteToApiBase(url);
      if (rewritten !== url) {
        if (typeof input === 'string') input = rewritten;
        else {
          try {
            input = new Request(rewritten, input);
          } catch (_e) {
            input = rewritten;
          }
        }
        url = rewritten;
      }
      // Always timeout loopback leftovers so the UI cannot stick on "Please wait…".
      var needsTimeout = isLoopbackOrigin(url) || (method === 'POST' && isLoginUrl(url));
      if (method !== 'POST' || !isLoginUrl(url)) {
        function afterApi(res) {
          return rewriteJsonApiResponse(res, url);
        }
        if (!needsTimeout) {
          return origFetch.call(this, input, init).then(afterApi);
        }
        try {
          if (typeof AbortController === 'undefined') {
            return origFetch.call(this, input, init).then(afterApi);
          }
          var ctrlEarly = new AbortController();
          var tEarly = setTimeout(function () {
            try {
              ctrlEarly.abort();
            } catch (_a) {}
          }, 5000);
          return origFetch
            .call(this, input, Object.assign({}, init || {}, { signal: ctrlEarly.signal }))
            .finally(function () {
              clearTimeout(tEarly);
            })
            .then(afterApi);
        } catch (_e4) {
          return origFetch.call(this, input, init).then(afterApi);
        }
      }
      var candidates = loginCandidates(url);
      console.log('[DEBUG-SHIM] fetch LOGIN intercepted', {
        url: url,
        candidates: candidates.slice(),
        candidateCount: candidates.length,
      });
      var i = 0;
      function attempt() {
        var nextUrl = candidates[i++];
        console.log('[DEBUG-SHIM] fetch trying candidate', i, '/', candidates.length, nextUrl);
        var nextInput = nextUrl;
        if (typeof input !== 'string' && typeof Request !== 'undefined') {
          try {
            nextInput = new Request(nextUrl, input);
          } catch (_e2) {
            nextInput = nextUrl;
          }
        }
        var ctrl = null;
        var timer = null;
        var opts = init;
        try {
          if (typeof AbortController !== 'undefined') {
            ctrl = new AbortController();
            timer = setTimeout(function () {
              try {
                ctrl.abort();
              } catch (_a) {}
            }, 8000);
            opts = Object.assign({}, init || {}, { signal: ctrl.signal });
          }
        } catch (_e3) {
          opts = init;
        }
        return origFetch
          .call(window, nextInput, opts)
          .then(function (res) {
            if (timer) clearTimeout(timer);
            console.log('[DEBUG-SHIM] fetch candidate status', nextUrl, res && res.status);
            if (!shouldRetry(res.status) || i >= candidates.length) {
              return rewriteLoginResponse(res).then(function (out) {
                console.log('[DEBUG-SHIM] fetch rewriteLoginResponse done', out && out.status);
                return out;
              });
            }
            return res
              .clone()
              .text()
              .then(function (text) {
                if (!shouldRetry(res.status, text) || i >= candidates.length) {
                  return rewriteLoginResponse(res).then(function (out) {
                    console.log('[DEBUG-SHIM] fetch rewriteLoginResponse done', out && out.status);
                    return out;
                  });
                }
                return attempt();
              });
          })
          .catch(function (err) {
            if (timer) clearTimeout(timer);
            if (i < candidates.length) return attempt();
            throw err;
          });
      }
      return attempt();
    };
  }

  var OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    window.XMLHttpRequest = function () {
      var xhr = new OrigXHR();
      var _open = xhr.open;
      var _send = xhr.send;
      var method = 'GET';
      var url = '';
      var body = null;
      var headers = {};
      xhr.open = function (m, u) {
        method = String(m || 'GET').toUpperCase();
        url = rewriteToApiBase(String(u || ''));
        arguments[1] = url;
        if (isLoginUrl(url) || method === 'POST') {
          console.log('[DEBUG-SHIM] xhr.open', method, url);
        }
        return _open.apply(xhr, arguments);
      };
      var _setHeader = xhr.setRequestHeader;
      xhr.setRequestHeader = function (k, v) {
        headers[k] = v;
        return _setHeader.apply(xhr, arguments);
      };

      function settleFromInner(x, text) {
        var status = x.status;
        var responseText = text != null ? text : '';
        try {
          responseText = text != null ? String(text) : String(x.responseText || '');
        } catch (_e) {
          responseText = '';
        }
        console.log('[DEBUG-SHIM] settleFromInner start', {
          status: status,
          textLen: responseText.length,
          hasRsc: typeof xhr.onreadystatechange === 'function',
          hasLoad: typeof xhr.onload === 'function',
          hasLoadEnd: typeof xhr.onloadend === 'function',
        });
        try {
          Object.defineProperty(xhr, 'status', {
            configurable: true,
            get: function () {
              return status;
            },
          });
          Object.defineProperty(xhr, 'statusText', {
            configurable: true,
            get: function () {
              try {
                return x.statusText || '';
              } catch (_e2) {
                return '';
              }
            },
          });
          Object.defineProperty(xhr, 'responseText', {
            configurable: true,
            get: function () {
              return responseText;
            },
          });
          Object.defineProperty(xhr, 'response', {
            configurable: true,
            get: function () {
              try {
                return responseText ? JSON.parse(responseText) : null;
              } catch (_e3) {
                return responseText;
              }
            },
          });
          Object.defineProperty(xhr, 'readyState', {
            configurable: true,
            get: function () {
              return 4;
            },
          });
        } catch (_e4) {
          console.log('[DEBUG-SHIM] defineProperty failed', String(_e4 && _e4.message ? _e4.message : _e4));
          try {
            xhr.status = status;
          } catch (_e5) {}
        }
        try {
          xhr.getAllResponseHeaders = function () {
            try {
              return x.getAllResponseHeaders() || 'content-type: application/json\r\n';
            } catch (_e6) {
              return 'content-type: application/json\r\n';
            }
          };
          xhr.getResponseHeader = function (name) {
            try {
              var v = x.getResponseHeader(name);
              if (v != null) return v;
            } catch (_e7) {}
            if (String(name || '').toLowerCase() === 'content-type') return 'application/json';
            return null;
          };
        } catch (_e8) {}

        try {
          console.log('[DEBUG-SHIM] firing onreadystatechange');
          if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
          console.log('[DEBUG-SHIM] after onreadystatechange');
        } catch (_e9) {
          console.log('[DEBUG-SHIM] onreadystatechange threw', _e9);
        }
        try {
          console.log('[DEBUG-SHIM] firing onload');
          if (typeof xhr.onload === 'function') xhr.onload();
          console.log('[DEBUG-SHIM] after onload');
        } catch (_e10) {
          console.log('[DEBUG-SHIM] onload threw', _e10);
        }
        try {
          console.log('[DEBUG-SHIM] firing onloadend');
          if (typeof xhr.onloadend === 'function') xhr.onloadend();
          else console.log('[DEBUG-SHIM] onloadend handler is NOT a function', typeof xhr.onloadend);
          console.log('[DEBUG-SHIM] after onloadend — axios should resolve now');
        } catch (_e11) {
          console.log('[DEBUG-SHIM] onloadend threw', _e11);
        }
      }

      xhr.send = function (b) {
        body = b;
        if (method !== 'POST' || !isLoginUrl(url)) {
          // Capture-phase listener runs before axios onreadystatechange, so we can
          // rewrite responseText before data.loans.length is evaluated.
          try {
            xhr.addEventListener(
              'readystatechange',
              function svNormalizeLists() {
                try {
                  if (xhr.readyState !== 4) return;
                  if (!(xhr.status >= 200 && xhr.status < 300)) return;
                  var text = '';
                  try {
                    text = String(xhr.responseText || '');
                  } catch (_t) {
                    text = '';
                  }
                  var first = text ? text.charAt(0) : '';
                  var parsed = null;
                  if (first === '{' || first === '[') {
                    parsed = JSON.parse(text);
                  } else {
                    try {
                      if (xhr.responseType === 'json' && xhr.response != null && typeof xhr.response === 'object') {
                        parsed = xhr.response;
                      }
                    } catch (_r) {}
                  }
                  if (parsed == null) return;
                  var normalized = normalizeApiListBody(parsed, url);
                  var outText = JSON.stringify(normalized);
                  try {
                    Object.defineProperty(xhr, 'responseText', {
                      configurable: true,
                      get: function () {
                        return outText;
                      },
                    });
                    Object.defineProperty(xhr, 'response', {
                      configurable: true,
                      get: function () {
                        return xhr.responseType === 'json' ? normalized : outText;
                      },
                    });
                  } catch (_def) {}
                } catch (_norm) {}
              },
              true
            );
          } catch (_add) {}
          return _send.apply(xhr, arguments);
        }
        var candidates = loginCandidates(url);
        console.log('[DEBUG-SHIM] xhr.send LOGIN intercepted', {
          url: url,
          candidates: candidates.slice(),
          candidateCount: candidates.length,
        });
        var idx = 0;
        function tryNext() {
          if (idx >= candidates.length) {
            console.log('[DEBUG-SHIM] all login candidates exhausted');
            try {
              if (typeof xhr.onerror === 'function') xhr.onerror();
            } catch (_e) {}
            try {
              if (typeof xhr.onloadend === 'function') xhr.onloadend();
            } catch (_e2) {}
            return;
          }
          var next = candidates[idx++];
          console.log('[DEBUG-SHIM] trying login candidate', idx, '/', candidates.length, next);
          var x = new OrigXHR();
          x.open('POST', next, true);
          Object.keys(headers).forEach(function (k) {
            try {
              x.setRequestHeader(k, headers[k]);
            } catch (_e) {}
          });
          x.onload = function () {
            var text = '';
            try {
              text = x.responseText;
            } catch (_e) {}
            console.log('[DEBUG-SHIM] candidate response', {
              url: next,
              status: x.status,
              willRetry: shouldRetry(x.status, text) && idx < candidates.length,
            });
            if (shouldRetry(x.status, text) && idx < candidates.length) {
              tryNext();
              return;
            }
            try {
              if (x.status >= 200 && x.status < 300 && text) {
                var parsed = JSON.parse(text);
                var normalized = normalizeLoginBody(parsed);
                text = JSON.stringify(normalized);
                console.log('[DEBUG-SHIM] normalized login body success=', normalized && normalized.success);
              }
            } catch (_norm) {
              console.log('[DEBUG-SHIM] normalize failed', _norm);
            }
            settleFromInner(x, text);
          };
          x.onerror = function () {
            console.log('[DEBUG-SHIM] candidate network error', next);
            if (idx < candidates.length) tryNext();
            else {
              try {
                if (typeof xhr.onerror === 'function') xhr.onerror();
              } catch (_e) {}
              try {
                if (typeof xhr.onloadend === 'function') xhr.onloadend();
              } catch (_e2) {}
            }
          };
          x.send(body);
        }
        tryNext();
      };
      return xhr;
    };
  }
})();
