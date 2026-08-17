/**
 * Injected into student preview index.html so login works across Express route shapes.
 * On 404 / "Route not found", retries common API login paths against the API origin
 * (never against the SPA origin — that caused SYADA "Route not found" on /login).
 *
 * UNIVERSAL for every future React+Express(+Mongo/MySQL) ZIP upload:
 * the node-backend overlays this file into each preview container at start, so new
 * student projects get these fixes without per-project patches.
 *
 * Marker V20:
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
  if (window.__SV_LOGIN_FALLBACK_V20__) {
    console.log('[DEBUG-SHIM] already installed V20 — skip');
    return;
  }
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
  console.log('[DEBUG-SHIM] preview-login-fallback ACTIVE v20', {
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
    var html = pageHintHtml();
    if (/manDash/.test(html)) return true;
    if (appHints.routes.indexOf('/manDash') >= 0) return true;
    try {
      if (/manDash/i.test(String(location.pathname || ''))) return true;
    } catch (_e) {}
    return false;
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
    var out = {};
    try {
      for (var k in user) {
        if (Object.prototype.hasOwnProperty.call(user, k)) out[k] = user[k];
      }
    } catch (_e) {
      out = user;
    }
    out.role = next;
    console.log('[DEBUG-SHIM] preview main admin role →', next);
    return ensureUserDisplayFields(out);
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
    ];
  }

  function fixStoredPreviewUserRole() {
    var keys = authStorageKeys();
    var changed = false;
    for (var i = 0; i < keys.length; i++) {
      try {
        var storageKey = keys[i];
        var raw = localStorage.getItem(storageKey);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') continue;
        var next = JSON.parse(raw);

        function patchPerson(obj) {
          if (!obj || typeof obj !== 'object') return obj;
          // Every future upload: stored preview session uses this app's main admin role.
          obj.role = mainAdminRoleForApp();
          return ensureUserDisplayFields(obj);
        }

        if (next.user && typeof next.user === 'object') {
          next.user = patchPerson(next.user);
          next.name = next.name || next.user.name;
          next.fullName = next.fullName || next.user.fullName;
          next.firstName = next.firstName || next.user.firstName;
          next.email = next.email || next.user.email;
          next.role = next.user.role;
        } else if (next.email || next.role || next.name || next.token || next._id) {
          next = patchPerson(next);
        } else {
          continue;
        }

        var serialized = JSON.stringify(next);
        if (serialized === raw) continue;
        localStorage.setItem(storageKey, serialized);
        changed = true;
        console.log('[DEBUG-SHIM] reconciled', storageKey);
      } catch (_e2) {}
    }
    if (!changed) return;
    try {
      window.dispatchEvent(new Event('userChanged'));
    } catch (_e3) {}
  }

  function pickPostLoginPath(user) {
    var role = roleKeyOf((user && (user.role || user.Role)) || mainAdminRoleForApp());
    if (isSkyPropertyApp() || role === 'MANAGER' || role === 'SUB_MANAGER' || role === 'SUBMANAGER') {
      if (hasRoute('/manDash') || isSkyPropertyApp()) return '/manDash';
    }
    if (isLoanStyleApp()) return '/admin/loans';
    if (isStaffSetApp()) return '/admin/dashboard';
    // Privileged roles → admin home for this SPA (skincare /shop apps use /admin).
    if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPERADMIN' || role === 'OFFICER' || role === 'EDITOR' || role === 'MANAGER') {
      if (hasRoute('/admin/loans')) return '/admin/loans';
      if (hasRoute('/admin/dashboard')) return '/admin/dashboard';
      if (hasRoute('/admin')) return '/admin';
      if (hasRoute('/manDash')) return '/manDash';
      if (hasRoute('/dashboard')) return '/dashboard';
    }
    if (role === 'TEACHER' && hasRoute('/teacher')) return '/teacher';
    if (role === 'STUDENT' && hasRoute('/student')) return '/student';
    if (role === 'MEMBER' && hasRoute('/portal')) return '/portal';
    if (role === 'BORROWER' && hasRoute('/dashboard')) return '/dashboard';
    return null;
  }

  function tryRescueStuckLogin() {
    try {
      var path = String((window.location && window.location.pathname) || '');
      if (!/login|signin|sign-in/i.test(path)) return;
      if (sessionStorage.getItem('__sv_post_login_nav__')) return;
      var token = localStorage.getItem('token') || localStorage.getItem('accessToken') || localStorage.getItem('loan_token');
      if (!token) return;
      ensureHintsBeforeLogin();
      fixStoredPreviewUserRole();
      var raw = localStorage.getItem('user') || localStorage.getItem('loan_user');
      if (!raw) return;
      var user = JSON.parse(raw);
      if (user && user.user) user = user.user;
      user = normalizePreviewUserRole(user);
      var target = pickPostLoginPath(user);
      if (!target) return;
      sessionStorage.setItem('__sv_post_login_nav__', '1');
      console.log('[DEBUG-SHIM] rescue stuck login →', target, 'role=', user && user.role);
      window.location.assign(target);
    } catch (_e) {}
  }

  function redirectAfterPreviewLogin(user) {
    try {
      var path = window.location && window.location.pathname ? String(window.location.pathname) : '';
      if (!/login|signin|sign-in/i.test(path)) return;
      if (sessionStorage.getItem('__sv_post_login_nav__')) return;
      setTimeout(function () {
        try {
          var stillLogin =
            window.location && /login|signin|sign-in/i.test(String(window.location.pathname || ''));
          if (!stillLogin) return;
          var target = pickPostLoginPath(user);
          if (!target) return;
          sessionStorage.setItem('__sv_post_login_nav__', '1');
          window.location.assign(target);
        } catch (_e) {}
      }, 2500);
    } catch (_e2) {}
  }

  /** Break A↔B Navigate storms (LoanFlow dashboard↔admin/loans). One hard navigation only. */
  function installRedirectLoopGuard() {
    var recent = [];
    setInterval(function () {
      try {
        var p = String((window.location && window.location.pathname) || '');
        if (!p || /login|signin/i.test(p)) {
          recent = [];
          return;
        }
        if (recent.length && recent[recent.length - 1] === p) return;
        recent.push(p);
        if (recent.length > 16) recent = recent.slice(-16);
        if (recent.length < 6) return;
        var uniq = uniqStrings(recent);
        if (uniq.length !== 2) return;
        var flips = 0;
        for (var i = 1; i < recent.length; i++) {
          if (recent[i] !== recent[i - 1]) flips += 1;
        }
        if (flips < 5) return;
        if (sessionStorage.getItem('__sv_loop_break__')) return;
        sessionStorage.setItem('__sv_loop_break__', '1');
        ensureHintsBeforeLogin();
        var fixed = mainAdminRoleForApp();
        console.warn('[DEBUG-SHIM] redirect loop detected', uniq[0], '↔', uniq[1], '→ role', fixed);
        var keys = authStorageKeys();
        for (var k = 0; k < keys.length; k++) {
          try {
            var raw = localStorage.getItem(keys[k]);
            if (!raw) continue;
            var parsed = JSON.parse(raw);
            if (parsed && parsed.user && typeof parsed.user === 'object') {
              parsed.user.role = fixed;
              parsed.user = ensureUserDisplayFields(parsed.user);
              localStorage.setItem(keys[k], JSON.stringify(parsed));
            } else if (parsed && typeof parsed === 'object') {
              parsed.role = fixed;
              parsed = ensureUserDisplayFields(parsed);
              localStorage.setItem(keys[k], JSON.stringify(parsed));
            }
          } catch (_e) {}
        }
        var safe = isLoanStyleApp()
          ? '/admin/loans'
          : hasRoute('/admin/loans')
            ? '/admin/loans'
            : hasRoute('/admin/dashboard')
              ? '/admin/dashboard'
              : uniq.indexOf('/admin/loans') >= 0
                ? '/admin/loans'
                : uniq[0];
        // Full document navigation — resets React; avoid history+popstate (max update depth).
        window.location.replace(safe);
      } catch (_e2) {}
    }, 300);
  }

  scanAppBundles(function () {
    fixStoredPreviewUserRole();
    tryRescueStuckLogin();
  });
  installRedirectLoopGuard();
  // Brand/title can be known before the JS scan finishes.
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
          fixStoredPreviewUserRole();
          tryRescueStuckLogin();
        }, 50);
      });
    } else {
      setTimeout(function () {
        fixStoredPreviewUserRole();
        tryRescueStuckLogin();
      }, 50);
    }
  } catch (_eEarly) {}

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
      out.name = out.name || user.name;
      out.fullName = out.fullName || user.fullName;
      out.firstName = out.firstName || user.firstName;
      out.lastName = out.lastName || user.lastName;
      out.email = out.email || user.email;
      out.username = out.username || user.username;
      out.role = out.role || user.role;
      out._id = out._id || user._id || user.id;
      out.id = out.id || user.id || user._id;
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
      }
      console.log('[DEBUG-SHIM] normalizeLoginBody wrote localStorage', {
        hasToken: !!token,
        role: user && user.role,
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
