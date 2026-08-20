/**
 * Injected into student preview index.html so login works across Express route shapes.
 * On 404 / "Route not found", retries common API login paths against the API origin
 * (never against the SPA origin — that caused SYADA "Route not found" on /login).
 *
 * UNIVERSAL for every future React+Express(+Mongo/MySQL) ZIP upload:
 * the node-backend overlays this file into each preview container at start, so new
 * student projects get these fixes without per-project patches.
 *
 * Marker V45:
 * - Automatic CRUD path retries: /api/students ↔ /students ↔ singular/plural (/api/v1).
 *   Layers: Express safety re-dispatch, gateway upstream tries, axios+fetch shim.
 * V44:
 * - Allow Log Out (stop blocking localStorage clear on admin routes).
 * - Gateway: /api/students ↔ /students fallback for all CRUD APIs.
 * V43:
 * - Login 400 "wrong password" recovery: seed injects preview creds; safety recovers on 400.
 * - Form autofill uses username for username fields (DropSafe admin / admin123 demos).
 * V42:
 * - Gateway retries login POSTs across /auth/login → /api/auth/login → /api/users/login…
 *   (DropSafe and most MERN ZIPs: UI path ≠ Express mount).
 * - Shim: axios login 404 path fallbacks (fetch already had them).
 * V41:
 * - Break login↔admin history loops: never fire popstate on every blocked /login
 *   replaceState (that re-triggers <Navigate/> and hangs the browser).
 * - History suppress is quiet after the first few hits; one remount if #root stays blank.
 * - Keep auth keys (payflow_user, token, …) while on admin routes with a token.
 * V40:
 * - Never trust gateway __SV_ADMIN_HOME_PATH__ unless that route exists in the bundle.
 *   Prefer scanned routes (/dashboard, /admin, …) over a guessed /admin/dashboard.
 * - Stop putting ?__sv_r= on history/React Router URLs (causes "No routes matched").
 *   Cache-bust remounts use sessionStorage + location.reload instead.
 * - Auto-recover when React Router logs "No routes matched location".
 * V39:
 * - Some apps recover auth on a weak route like `/admin`, which can be a blank shell.
 *   Prefer a concrete admin destination such as `/admin/dashboard` and retry alternate
 *   admin paths if `#root` stays blank after intercepting a login redirect.
 * V38:
 * - isLoanStyleApp falsely matched loan_user/loan_token in page HTML — those strings
 *   appear in THIS shim script, so SYADA/FoundLink got role=admin instead of super_admin.
 * - Gateway __SV_MAIN_ADMIN_ROLE__ now wins over loan-style heuristics.
 * V37:
 * - Trust gateway __SV_MAIN_ADMIN_ROLE__ (FoundLink needs super_admin; V36 downgraded to admin).
 * - history.replaceState(/login): hydrate + popstate unstick — no remount loop (max attempts).
 * - Block /login redirects on admin routes whenever a token exists (not only 45s grace).
 * V36:
 * - White page root fix: NEVER rewrite history to /login during grace — always stay path.
 * - Soft-succeed ANY API 401 during post-login grace (after one retry) so ProtectedRoute
 *   never fires <Navigate to="/login"/> in the first place.
 * V35:
 * - White page: hard-nav to the SAME /admin/dashboard URL is a no-op in browsers, so
 *   React <Navigate/> stayed null forever. Always reload when dest matches current path.
 * V34:
 * - White page fix: do NOT no-op history.replaceState(/login) — that leaves React
 *   <Navigate/> stuck returning null. Rewrite login navigations to the admin stay
 *   path and follow with a hard document navigation; blank #root watchdog as backup.
 * V33:
 * - White page after suppressing /login redirect: React <Navigate/> renders null when
 *   history.replaceState is no-op'd. On suppress: re-hydrate auth, then reload once so
 *   ProtectedRoute remounts with storage. (href guard may be unavailable in browsers.)
 * V32:
 * - Suppress window.location / history redirects to /login during post-login grace
 *   (student apiClients often navigate on 401 even when storage clear is blocked).
 * - On ANY 401 during grace with a stored token: retry the request once with
 *   Authorization re-attached before letting the 401 through (not only /me probes).
 * V31:
 * - Post-login bounce → /login: attach Authorization Bearer on all API calls; soft-succeed
 *   session probes (/me|/profile|/current) that 401; block auth storage clears for 30s after
 *   login (axios interceptors); patch axios request/response; dispatch storage+auth events
 *   so AuthContext re-reads after normalizeLoginBody.
 * V30:
 * - Socket.IO: rewrite WebSocket URLs to same-origin gateway (polling was on UI port,
 *   WS on API port → Engine.IO sid mismatch / 400). Pair with gateway upgrade proxy.
 * V29:
 * - FoundLink dump: accessToken/userInfo present but token+user MISSING → SPA reads
 *   localStorage.user (undefined) and JSON.parse crashes. Always mirror token↔accessToken
 *   and user↔userInfo.user (ensureCoreAuthAliases).
 * V28:
 * - Safe JSON.parse: student dashboards often do useState(JSON.parse(localStorage.user))
 *   which throws SyntaxError: "undefined" is not valid JSON when the key is missing.
 * - Write auth user JSON under every common key (currentUser, authUser, auth, …).
 * V27:
 * - PayFlow / LoanFlow: ALWAYS use role "admin" (never SUPER_ADMIN) + /admin/loans.
 * - Wrong-role bounce (/admin/loans → login): correct to admin and retry once, don't spam-abort.
 * V26:
 * - Use ZIP-discovered main role (__SV_MAIN_ADMIN_ROLE__) + admin home path from gateway.
 * - Seed/login always match project roles: admin, manager, super_admin, sub_admin, …
 * V25:
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
  if (window.__SV_LOGIN_FALLBACK_V45__) {
    console.log('[DEBUG-SHIM] already installed V45 — skip');
    return;
  }
  window.__SV_LOGIN_FALLBACK_V45__ = true;
  window.__SV_LOGIN_FALLBACK_V44__ = true;
  window.__SV_LOGIN_FALLBACK_V43__ = true;
  window.__SV_LOGIN_FALLBACK_V42__ = true;
  window.__SV_LOGIN_FALLBACK_V41__ = true;
  window.__SV_LOGIN_FALLBACK_V40__ = true;
  window.__SV_LOGIN_FALLBACK_V39__ = true;
  window.__SV_LOGIN_FALLBACK_V38__ = true;
  window.__SV_LOGIN_FALLBACK_V37__ = true;
  window.__SV_LOGIN_FALLBACK_V36__ = true;
  window.__SV_LOGIN_FALLBACK_V35__ = true;
  window.__SV_LOGIN_FALLBACK_V34__ = true;
  window.__SV_LOGIN_FALLBACK_V33__ = true;
  window.__SV_LOGIN_FALLBACK_V32__ = true;
  window.__SV_LOGIN_FALLBACK_V31__ = true;
  window.__SV_LOGIN_FALLBACK_V30__ = true;
  window.__SV_LOGIN_FALLBACK_V29__ = true;
  window.__SV_LOGIN_FALLBACK_V28__ = true;
  window.__SV_LOGIN_FALLBACK_V27__ = true;
  window.__SV_LOGIN_FALLBACK_V26__ = true;
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
  console.log('[DEBUG-SHIM] preview-login-fallback ACTIVE v46', {
    href: String(location.href || ''),
    apiBase: window.__SV_API_BASE__ || null,
    loginPath: window.__SV_LOGIN_API_PATH__ || null,
    mainRole: window.__SV_MAIN_ADMIN_ROLE__ || null,
    adminHome: window.__SV_ADMIN_HOME_PATH__ || null,
  });

  // V28: many student apps crash on dashboard with:
  //   useState(JSON.parse(localStorage.getItem('user')))  // getItem → null → still ok
  //   useState(JSON.parse(localStorage.user))             // missing → undefined → SyntaxError
  //   JSON.parse(undefined) → SyntaxError: "undefined" is not valid JSON
  try {
    var __svNativeJsonParse = JSON.parse.bind(JSON);
    var __svJsonParseWarnCount = 0;
    JSON.parse = function (text, reviver) {
      var bad =
        text === undefined ||
        text === null ||
        (typeof text === 'string' && (!text.trim() || text.trim() === 'undefined' || text.trim() === 'null'));
      if (bad) {
        if (__svJsonParseWarnCount < 12) {
          __svJsonParseWarnCount += 1;
          try {
            console.warn('[DEBUG-SHIM] JSON.parse blocked bad input #' + __svJsonParseWarnCount, {
              typeofText: typeof text,
              textPreview: text === undefined ? '(undefined)' : text === null ? '(null)' : String(text).slice(0, 80),
              href: String(location.href || ''),
              stack: String(new Error('sv-json-parse-trace').stack || '')
                .split('\n')
                .slice(0, 8)
                .join('\n'),
            });
          } catch (_w) {}
        }
        return null;
      }
      try {
        return __svNativeJsonParse(text, reviver);
      } catch (err) {
        var msg = String((err && err.message) || err || '');
        if (/undefined|null|Unexpected end|is not valid JSON/i.test(msg)) {
          if (__svJsonParseWarnCount < 12) {
            __svJsonParseWarnCount += 1;
            try {
              console.warn('[DEBUG-SHIM] JSON.parse soft-fail #' + __svJsonParseWarnCount, {
                message: msg,
                typeofText: typeof text,
                textPreview: String(text).slice(0, 120),
                href: String(location.href || ''),
              });
            } catch (_w2) {}
          }
          return null;
        }
        throw err;
      }
    };
  } catch (_jp) {}

  function dumpAuthDebug(reason) {
    try {
      var keys = [
        'token',
        'accessToken',
        'access_token',
        'jwt',
        'loan_token',
        'user',
        'userInfo',
        'loan_user',
        'payflow_user',
        'authUser',
        'currentUser',
        'loggedInUser',
        'auth',
        'profile',
        'userData',
        'role',
        'userRole',
        'isAdmin',
        'email',
        'username',
        'name',
      ];
      var snap = {
        reason: reason || 'manual',
        href: String(location.href || ''),
        pathname: String((location && location.pathname) || ''),
        shim: 'v34',
      };
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = null;
        try {
          v = localStorage.getItem(k);
        } catch (_g) {
          v = '(getItem threw)';
        }
        if (v == null) {
          snap[k] = null;
        } else if (k === 'token' || k === 'accessToken' || k === 'access_token' || k === 'jwt' || k === 'loan_token') {
          snap[k] = { present: true, length: String(v).length, prefix: String(v).slice(0, 18) + '…' };
        } else if (String(v).charAt(0) === '{' || String(v).charAt(0) === '[') {
          try {
            var p = __svNativeJsonParse ? __svNativeJsonParse(v) : JSON.parse(v);
            snap[k] = {
              present: true,
              type: typeof p,
              role: p && (p.role || p.Role || (p.user && p.user.role)),
              email: p && (p.email || (p.user && p.user.email)),
              keys: p && typeof p === 'object' ? Object.keys(p).slice(0, 12) : [],
              preview: String(v).slice(0, 100),
            };
          } catch (pe) {
            snap[k] = { present: true, parseError: String(pe && pe.message), preview: String(v).slice(0, 100) };
          }
        } else {
          snap[k] = { present: true, value: String(v).slice(0, 80) };
        }
      }
      // Also show raw property access style (localStorage.user) which is often undefined.
      try {
        snap.prop_user = typeof localStorage.user;
        snap.prop_userInfo = typeof localStorage.userInfo;
        snap.prop_currentUser = typeof localStorage.currentUser;
      } catch (_p) {}
      console.log('[DEBUG-SHIM] AUTH DUMP — ' + (reason || 'check'), snap);
      return snap;
    } catch (e) {
      console.warn('[DEBUG-SHIM] AUTH DUMP failed', e);
      return null;
    }
  }
  window.__SV_DUMP_AUTH__ = dumpAuthDebug;
  try {
    dumpAuthDebug('shim-boot');
  } catch (_boot) {}

  // FoundLink (and similar) write accessToken/userInfo but never user/token.
  // Mirror on every setItem so dashboard JSON.parse(localStorage.user) never sees undefined.
  try {
    var __svNativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      var r = __svNativeSetItem.apply(this, arguments);
      try {
        var k = String(key || '');
        if (
          this === localStorage &&
          (k === 'accessToken' ||
            k === 'access_token' ||
            k === 'userInfo' ||
            k === 'currentUser' ||
            k === 'authUser' ||
            k === 'auth' ||
            k === 'jwt' ||
            k === 'loan_token')
        ) {
          setTimeout(function () {
            try {
              if (typeof ensureCoreAuthAliases === 'function') ensureCoreAuthAliases();
            } catch (_m) {}
          }, 0);
        }
      } catch (_si) {}
      return r;
    };
  } catch (_setPatch) {}

  var PATHS = [
    '/api/auth/login',
    '/api/users/login',
    '/api/user/login',
    '/api/login',
    '/api/v1/auth/login',
    '/auth/login',
    '/users/login',
    '/user/login',
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
    if (!creds || !(creds.email || creds.username)) return;
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
        var loginId =
          creds.username ||
          (creds.email && String(creds.email).indexOf('@') > 0
            ? String(creds.email).split('@')[0]
            : creds.email) ||
          'admin';
        // Prefer username for username fields; email for email fields.
        var fillId = loginId;
        try {
          if (
            emailEl &&
            (emailEl.type === 'email' || String(emailEl.name || '').toLowerCase() === 'email')
          ) {
            fillId = creds.email || loginId;
          }
        } catch (_t) {}
        if (emailEl) setNativeValue(emailEl, fillId);
        if (passEl && creds.password) setNativeValue(passEl, creds.password);
        if (!document.getElementById('sv-preview-login-banner') && (creds.email || creds.username)) {
          var ban = document.createElement('div');
          ban.id = 'sv-preview-login-banner';
          ban.setAttribute(
            'style',
            'position:fixed;z-index:2147483646;left:12px;right:12px;bottom:12px;background:#14532d;color:#ecfdf5;padding:10px 14px;border-radius:8px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)'
          );
          ban.textContent =
            'Preview login: ' +
            (creds.username || creds.email) +
            (creds.password ? ' / ' + creds.password : '');
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
      return (
        /\/(api\/)?(auth\/|users\/|user\/|v1\/auth\/)?login\/?(\?|$)/i.test(u) ||
        /\/(signin|sign-in|authenticate)\/?(\?|$)/i.test(u)
      );
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
    // Prefer /api/* before bare /auth/login (Express almost always mounts under /api).
    PATHS.forEach(push);
    var incoming = (parts.path || '').split('?')[0];
    if (incoming && incoming !== '/login') {
      if (!/^\/api\//i.test(incoming)) push('/api' + incoming);
      push(incoming);
    }

    // Keep original absolute URL last (if different) so we don't loop forever.
    var original = typeof url === 'string' ? url : '';
    if (original && !seen[original] && !isLoopbackOrigin(original)) ordered.push(original);
    return ordered.filter(function (u) {
      return u !== url;
    }).concat(isLoopbackOrigin(url) ? [] : [url]);
  }

  function shouldRetry(status, bodyText) {
    if (status === 404) return true;
    // 400/401/403 often mean wrong body shape or password — path retries still useful.
    if (status === 400 || status === 401 || status === 403 || status === 422) return true;
    var t = String(bodyText || '').toLowerCase();
    return (
      t.indexOf('route not found') >= 0 ||
      t.indexOf('cannot post') >= 0 ||
      t.indexOf('not found') >= 0 ||
      t.indexOf('khaldan') >= 0 ||
      t.indexOf('invalid') >= 0 ||
      t.indexOf('incorrect') >= 0 ||
      t.indexOf('wrong') >= 0
    );
  }

  /** CRUD only — do not retry auth failures as path misses. */
  function shouldRetryApiPath(status, bodyText) {
    if (status === 404 || status === 405) return true;
    // Maktabadda: Express often 500s on wrong mount / Mongo — try /api ↔ bare.
    if (status >= 500) return true;
    var t = String(bodyText || '').toLowerCase();
    return (
      t.indexOf('route not found') >= 0 ||
      /cannot\s+(get|post|put|patch|delete)/i.test(t) ||
      /not\s+found:\s*\//i.test(t)
    );
  }

  function isListishApiUrl(url) {
    try {
      var p = new URL(String(url || ''), window.location.href).pathname || '';
      return /\/(categories|locations|cabinets|libraries|shelves|books|volumes|book-placements|users|students|products|orders|items|loans|notifications|members|authors|publishers)(\/)?$/i.test(
        p
      );
    } catch (_e) {
      return /\/(categories|locations|cabinets|libraries|shelves|books|volumes)(\/)?$/i.test(String(url || ''));
    }
  }

  function softEmptyListPayload(url) {
    try {
      var p = new URL(String(url || ''), window.location.href).pathname || '';
      var m = p.match(
        /\/(categories|locations|cabinets|libraries|shelves|books|volumes|book-placements|users|students|products|orders|items|loans|notifications|members|authors|publishers)(?:\/)?$/i
      );
      if (m) {
        var key = m[1].replace(/-([a-z])/g, function (_a, c) {
          return c.toUpperCase();
        });
        var o = { data: [], success: true, message: 'preview soft-empty' };
        o[key] = [];
        return o;
      }
    } catch (_e2) {}
    return [];
  }

  function apiPathCandidates(url) {
    var parts = splitBaseAndPath(url);
    var pathOnly = (parts.path || '/').split('?')[0] || '/';
    var qs = (parts.path || '').indexOf('?') >= 0 ? (parts.path || '').slice((parts.path || '').indexOf('?')) : '';
    var origin = parts.origin || '';
    var ordered = [];
    var seen = {};
    function pushPath(p) {
      if (!p || seen[p]) return;
      seen[p] = true;
      ordered.push(buildUrl(origin, p.charAt(0) === '/' ? p : '/' + p));
    }
    function singularPlural(p) {
      var segs = String(p || '')
        .split('?')[0]
        .split('/')
        .filter(Boolean);
      if (!segs.length) return [];
      var last = segs[segs.length - 1];
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(last)) return [];
      var next = segs.slice();
      if (/ies$/i.test(last) && last.length > 4) next[next.length - 1] = last.slice(0, -3) + 'y';
      else if (/s$/i.test(last) && last.length > 2 && !/ss$/i.test(last)) next[next.length - 1] = last.replace(/s$/i, '');
      else if (/y$/i.test(last) && last.length > 2) next[next.length - 1] = last.slice(0, -1) + 'ies';
      else next[next.length - 1] = last + 's';
      if (next[next.length - 1] === last) return [];
      return ['/' + next.join('/')];
    }
    var cands = [pathOnly];
    if (/^\/api\/v1\//i.test(pathOnly)) {
      cands.push(pathOnly.replace(/^\/api\/v1\//i, '/api/'));
      cands.push(pathOnly.replace(/^\/api\/v1/i, '') || '/');
    } else if (/^\/api\//i.test(pathOnly)) {
      cands.push(pathOnly.replace(/^\/api/i, '') || '/');
      cands.push(pathOnly.replace(/^\/api\//i, '/api/v1/'));
    } else if (pathOnly !== '/' && !/^\/api(\/|$)/i.test(pathOnly)) {
      cands.push('/api' + pathOnly);
      cands.push('/api/v1' + pathOnly);
    }
    var i;
    for (i = 0; i < cands.length; i++) {
      var sp = singularPlural(cands[i]);
      if (sp.length) cands.push(sp[0]);
    }
    for (i = 0; i < cands.length; i++) {
      if (cands[i] === pathOnly) continue;
      pushPath(cands[i] + qs);
    }
    return ordered;
  }

  /** Expand login JSON so Express handlers that expect email OR username both work. */
  function expandLoginRequestBody(raw) {
    var obj = null;
    try {
      if (typeof raw === 'string') obj = JSON.parse(raw);
      else if (raw && typeof raw === 'object') obj = raw;
    } catch (_e) {
      return raw;
    }
    if (!obj || typeof obj !== 'object') return raw;
    var creds = window.__SV_PREVIEW_CREDS__ || {};
    var id =
      obj.username ||
      obj.email ||
      obj.identifier ||
      obj.login ||
      creds.username ||
      creds.email ||
      '';
    var pass = obj.password || obj.passcode || obj.pass || creds.password || '';
    var email =
      obj.email ||
      creds.email ||
      (id && String(id).indexOf('@') >= 0 ? id : id ? String(id) + '@preview.demo' : '');
    var username =
      obj.username ||
      creds.username ||
      (id && String(id).indexOf('@') >= 0 ? String(id).split('@')[0] : id) ||
      'admin';
    var out = {};
    try {
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
      }
    } catch (_c) {
      out = obj;
    }
    out.username = username;
    out.email = email || out.email;
    out.password = pass || out.password;
    if (!out.identifier) out.identifier = username || email;
    if (!out.login) out.login = username || email;
    return typeof raw === 'string' ? JSON.stringify(out) : out;
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

  /**
   * PayFlow / LoanFlow detection — must NOT match our own injected shim (page HTML
   * contains the literal strings loan_user / loan_token from this file).
   */
  function isLoanStyleApp() {
    try {
      if (window.__SV_LOAN_STYLE__) return true;
    } catch (_eF) {}
    try {
      if (/payflow|LoanFlow|Payroll/i.test(String(document.title || ''))) {
        window.__SV_LOAN_STYLE__ = true;
        return true;
      }
    } catch (_e0) {}
    // payflow_user / loan_token are app-native keys; loan_user is also mirrored by this shim.
    try {
      if (localStorage.getItem('payflow_user')) {
        window.__SV_LOAN_STYLE__ = true;
        return true;
      }
      if (localStorage.getItem('loan_token') && !localStorage.getItem('accessToken') && !localStorage.getItem('token')) {
        window.__SV_LOAN_STYLE__ = true;
        return true;
      }
    } catch (_e) {}
    try {
      if (/\/admin\/loans/i.test(String(location.pathname || ''))) {
        window.__SV_LOAN_STYLE__ = true;
        return true;
      }
    } catch (_eP) {}
    ensureHintsBeforeLogin();
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
    if (hasBorrower && hasOfficer && hasAdmin) {
      window.__SV_LOAN_STYLE__ = true;
      return true;
    }
    if (hasRoute('/admin/loans') && (hasBorrower || hasOfficer)) {
      window.__SV_LOAN_STYLE__ = true;
      return true;
    }
    return false;
  }

  function isSkyPropertyApp() {
    // Never treat PayFlow/LoanFlow as Sky — SUPER_ADMIN breaks their admin guards.
    if (isLoanStyleApp()) return false;
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
    if (/manDash/.test(html) && !/payflow|LoanFlow|\/admin\/loans/i.test(html)) {
      window.__SV_SKY_PROPERTY__ = true;
      return true;
    }
    if (appHints.routes.indexOf('/manDash') >= 0 && !hasRoute('/admin/loans')) {
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
    // Require Sky brand signal OR manDash — do not infer Sky from SUPER_ADMIN+MANAGER alone
    // (false-positives poisoned PayFlow into SUPER_ADMIN → login bounce).
    if (hasSuperUpper && hasManagerUpper && /sky|manDash|property/i.test(html)) {
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

  /** Pathname only — React Router v6 treats ?__sv_r= as part of the location and fails to match. */
  function pathnameOnly(url) {
    var raw = String(url || '').trim();
    if (!raw) return '/';
    if (raw.charAt(0) === '/') return raw.split('?')[0].split('#')[0] || '/';
    try {
      return new URL(raw, window.location.href).pathname || '/';
    } catch (_e) {
      return raw.split('?')[0].split('#')[0] || '/';
    }
  }

  function gatewayAdminHomePathRaw() {
    try {
      var fromZip = String(window.__SV_ADMIN_HOME_PATH__ || '').trim();
      if (fromZip && fromZip.charAt(0) === '/') return pathnameOnly(fromZip);
    } catch (_e) {}
    return '';
  }

  function pickBestAdminRouteFromHints() {
    ensureHintsBeforeLogin();
    var priority = [];
    if (isLoanStyleApp()) priority.push('/admin/loans');
    if (isStaffSetApp()) priority.push('/admin/dashboard');
    if (isSkyPropertyApp()) priority.push('/dashboard', '/manDash');
    priority = priority.concat([
      '/admin/loans',
      '/admin/dashboard',
      '/admin/products',
      '/admin/users',
      '/admin',
      '/dashboard',
      '/manDash',
      '/portal',
    ]);
    var i;
    for (i = 0; i < priority.length; i++) {
      if (hasRoute(priority[i])) return priority[i];
    }
    for (i = 0; i < appHints.routes.length; i++) {
      var r = appHints.routes[i];
      if (/^\/(admin|dashboard|manDash|portal)(\/|$)/i.test(r) || /\/admin\//i.test(r)) return r;
    }
    return '';
  }

  function sanitizeHistoryUrl(url) {
    if (url == null || url === '') return url;
    try {
      var u = new URL(String(url), window.location.href);
      u.searchParams.delete('__sv_r');
      var rel = String(url).charAt(0) === '/';
      if (rel) return u.pathname + u.search + u.hash;
      return u.toString();
    } catch (_e) {
      return String(url)
        .replace(/([?&])__sv_r=[^&]*/g, '$1')
        .replace(/[?&]$/, '');
    }
  }

  function stripBootSvQuery() {
    try {
      var u = new URL(window.location.href);
      if (!u.searchParams.has('__sv_r')) return;
      u.searchParams.delete('__sv_r');
      var clean = u.pathname + (u.search || '') + u.hash;
      if (window.__svNativeHistoryReplace) {
        window.__svNativeHistoryReplace(history.state, '', clean);
      } else {
        history.replaceState(history.state, '', clean);
      }
      console.log('[DEBUG-SHIM] stripped __sv_r from boot URL →', clean);
    } catch (_e) {}
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
   * Role discovered from the student ZIP by the gateway — authoritative for preview login.
   */
  function gatewayMainAdminRole() {
    try {
      var fromZip = String(window.__SV_MAIN_ADMIN_ROLE__ || '').trim();
      if (fromZip && !/^(user|customer|client|member|buyer|borrower)$/i.test(fromZip)) {
        if (isLoanStyleApp() && /^super_?admin$/i.test(fromZip)) return 'admin';
        return fromZip;
      }
    } catch (_e) {}
    return null;
  }

  function applyGatewayAuthRole() {
    try {
      var gw = gatewayMainAdminRole();
      if (!gw) return;
      writeBareRoleKeys(gw);
      var tok = getStoredAccessToken ? getStoredAccessToken() : localStorage.getItem('token');
      if (tok && typeof patchJwtRoleClaim === 'function') {
        var patched = patchJwtRoleClaim(tok, gw);
        if (patched && patched !== tok) {
          ['token', 'accessToken', 'access_token', 'jwt', 'loan_token'].forEach(function (k) {
            try {
              if (localStorage.getItem(k)) localStorage.setItem(k, patched);
            } catch (_k) {}
          });
        }
      }
      if (typeof fixStoredPreviewUserRole === 'function') fixStoredPreviewUserRole();
    } catch (_agr) {}
  }

  /**
   * The single "main admin" role this SPA expects for teacher preview login.
   * Prefer ZIP-discovered role injected by the gateway (exact project casing).
   */
  function mainAdminRoleForApp() {
    var gw = gatewayMainAdminRole();
    if (gw) return gw;
    if (isLoanStyleApp()) return 'admin';
    ensureHintsBeforeLogin();
    if (isSkyPropertyApp()) return 'SUPER_ADMIN';
    if (isStaffSetApp()) return 'super_admin';
    if (appHints.allowLists.length) {
      var picked = preferPrivilegedRole(allHintRoles());
      if (picked) return picked;
    }
    var html = pageHintHtml();
    if (/role\s*===\s*['"`]SUPER_ADMIN['"`]/.test(html) || /manDash/.test(html)) return 'SUPER_ADMIN';
    if (/role\s*===\s*['"`]super_admin['"`]/.test(html)) return 'super_admin';
    if (/role\s*===\s*['"`]Admin['"`]/.test(html)) return 'Admin';
    if (/role\s*===\s*['"`]admin['"`]/.test(html) || hasRoute('/admin')) return 'admin';
    if (/role\s*===\s*['"`]manager['"`]/.test(html)) return 'manager';
    if (/role\s*===\s*['"`]sub_admin['"`]/.test(html)) return 'sub_admin';
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
    var gw = gatewayAdminHomePathRaw();
    var fromHints = pickBestAdminRouteFromHints();
    // Gateway often injects /admin/dashboard when the SPA only defines /dashboard.
    if (gw && hasRoute(gw)) return gw;
    if (fromHints) return fromHints;
    if (isLoanStyleApp()) return '/admin/loans';
    if (isStaffSetApp()) return '/admin/dashboard';
    if (isSkyPropertyApp()) {
      if (hasRoute('/dashboard')) return '/dashboard';
      if (hasRoute('/manDash')) return '/manDash';
      return '/dashboard';
    }
    if (hasRoute('/admin/loans')) return '/admin/loans';
    if (hasRoute('/admin/dashboard')) return '/admin/dashboard';
    if (hasRoute('/admin/products')) return '/admin/products';
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
    if (gw) return gw;
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
    var gw = gatewayMainAdminRole();
    var targetRole = gw || (sky ? 'SUPER_ADMIN' : mainAdminRoleForApp());
    // Absolute override: loan apps never keep SUPER_ADMIN in storage.
    if (isLoanStyleApp()) targetRole = 'admin';
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
      // Already handled this bounce once.
      if (sessionStorage.getItem('__sv_admin_bounce_handled__') === '1') return;
      sessionStorage.setItem('__sv_admin_bounce_handled__', '1');

      // PayFlow/LoanFlow: SUPER_ADMIN (or wrong ZIP role) often causes ProtectedRoute → /login.
      // Correct storage to admin and retry /admin/loans once.
      var wrongSuper = false;
      try {
        var roleNow = String(localStorage.getItem('role') || '');
        var rawInfo = localStorage.getItem('userInfo') || localStorage.getItem('payflow_user') || localStorage.getItem('loan_user') || '';
        if (/SUPER_ADMIN|super_admin/i.test(roleNow) || /SUPER_ADMIN|super_admin/i.test(rawInfo)) {
          wrongSuper = true;
        }
      } catch (_r) {}

      if (
        (wrongSuper && isLoanStyleApp()) ||
        isLoanStyleApp() ||
        /\/admin\/loans/i.test(target) ||
        /payflow/i.test(String(document.title || ''))
      ) {
        console.warn('[DEBUG-SHIM] login bounce from', target, '— forcing role=admin and retry once');
        try {
          sessionStorage.removeItem('__sv_admin_nav_aborted');
          sessionStorage.removeItem('__sv_post_login_nav__');
          sessionStorage.setItem('__sv_admin_nav_count__', '0');
        } catch (_c) {}
        writeBareRoleKeys('admin');
        fixStoredPreviewUserRole();
        // Patch known PayFlow keys to admin (not SUPER_ADMIN).
        try {
          ['user', 'userInfo', 'loan_user', 'payflow_user', 'authUser'].forEach(function (k) {
            var raw = localStorage.getItem(k);
            if (!raw) return;
            try {
              var parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object') {
                if (parsed.user && typeof parsed.user === 'object') {
                  parsed.user.role = 'admin';
                  parsed.user.isAdmin = true;
                }
                parsed.role = 'admin';
                parsed.isAdmin = true;
                localStorage.setItem(k, JSON.stringify(parsed));
              }
            } catch (_e) {}
          });
          var tok =
            localStorage.getItem('token') ||
            localStorage.getItem('accessToken') ||
            localStorage.getItem('loan_token');
          if (tok) {
            var patched = patchJwtRoleClaim(tok, 'admin');
            localStorage.setItem('token', patched);
            localStorage.setItem('accessToken', patched);
            localStorage.setItem('loan_token', patched);
          }
        } catch (_p) {}
        if (sessionStorage.getItem('__sv_admin_role_retry__') !== '1') {
          sessionStorage.setItem('__sv_admin_role_retry__', '1');
          var retryPath = /\/admin\/loans/i.test(target) ? '/admin/loans' : defaultAdminHomePath();
          setTimeout(function () {
            try {
              window.location.assign(retryPath);
            } catch (_e2) {}
          }, 200);
          return;
        }
      }

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
        sessionStorage.removeItem('__sv_admin_bounce_handled__');
        sessionStorage.removeItem('__sv_admin_role_retry__');
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
    if (isLoanStyleApp()) {
      adminRole = 'admin';
      if (user) {
        user.role = 'admin';
        user.Role = 'admin';
        user.isAdmin = true;
      }
    } else if (isSkyPropertyApp()) {
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
        localStorage.setItem('access_token', token);
        localStorage.setItem('jwt', token);
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('accessToken', token);
      }
      if (user) {
        var userJson = JSON.stringify(user);
        var outJson = JSON.stringify(out);
        var userKeys = [
          'user',
          'userInfo',
          'authUser',
          'currentUser',
          'loggedInUser',
          'logged_in_user',
          'admin',
          'profile',
          'userData',
          'auth_user',
          'skyUser',
          'sky_user',
        ];
        if (isLoanStyleApp()) {
          userKeys.push('loan_user', 'payflow_user');
        }
        for (var ui = 0; ui < userKeys.length; ui++) {
          try {
            // userInfo / auth often store the full login envelope; others store the user doc.
            var key = userKeys[ui];
            if (key === 'userInfo' || key === 'auth') {
              localStorage.setItem(key, outJson);
            } else {
              localStorage.setItem(key, userJson);
            }
          } catch (_sk) {}
        }
        try {
          localStorage.setItem('auth', outJson);
        } catch (_a) {}
        if (token && isLoanStyleApp()) localStorage.setItem('loan_token', token);
        if (user.email) localStorage.setItem('email', String(user.email));
        if (user.username) localStorage.setItem('username', String(user.username));
        if (user.name) localStorage.setItem('name', String(user.name));
      }
      writeBareRoleKeys((user && user.role) || adminRole || 'admin');
      try {
        localStorage.user = JSON.stringify(user);
      } catch (_propU) {}
      try {
        markPreviewLoginSuccess();
      } catch (_mark) {}
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
        if (typeof ensureCoreAuthAliases === 'function') ensureCoreAuthAliases();
      } catch (_alias) {}
      try {
        dumpAuthDebug('after-login-normalize');
      } catch (_dump) {}
      try {
        window.dispatchEvent(new Event('userChanged'));
        window.dispatchEvent(new Event('sv-preview-login'));
        window.dispatchEvent(new StorageEvent('storage', { key: 'user', newValue: localStorage.getItem('user') }));
        window.dispatchEvent(new StorageEvent('storage', { key: 'token', newValue: localStorage.getItem('token') }));
      } catch (_e4) {}
      redirectAfterPreviewLogin(user || out);
      // Dashboard often mounts a moment later — dump again to compare keys.
      try {
        setTimeout(function () {
          try {
            if (typeof ensureCoreAuthAliases === 'function') ensureCoreAuthAliases();
          } catch (_a1) {}
          dumpAuthDebug('post-login-+400ms');
        }, 400);
        setTimeout(function () {
          try {
            if (typeof ensureCoreAuthAliases === 'function') ensureCoreAuthAliases();
          } catch (_a2) {}
          dumpAuthDebug('post-login-+1500ms href=' + String(location.pathname || ''));
        }, 1500);
      } catch (_t) {}
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

  // Socket.IO opens WebSocket with the baked API host:port while XHR polling is
  // rewritten to the UI gateway → sid mismatch / 400. Keep WS on the same origin.
  try {
    var OrigWebSocket = window.WebSocket;
    if (typeof OrigWebSocket === 'function') {
      window.WebSocket = function (url, protocols) {
        var next = String(url || '');
        try {
          var rewrittenHttp = rewriteToApiBase(
            next.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:')
          );
          if (/^https:/i.test(rewrittenHttp)) {
            next = rewrittenHttp.replace(/^https:/i, 'wss:');
          } else if (/^http:/i.test(rewrittenHttp)) {
            next = rewrittenHttp.replace(/^http:/i, 'ws:');
          } else {
            next = rewrittenHttp;
          }
          if (next !== String(url || '')) {
            console.log('[DEBUG-SHIM] WebSocket rewrite', String(url || ''), '→', next);
          }
        } catch (_ws) {}
        if (protocols === undefined) return new OrigWebSocket(next);
        return new OrigWebSocket(next, protocols);
      };
      try {
        window.WebSocket.prototype = OrigWebSocket.prototype;
        window.WebSocket.CONNECTING = OrigWebSocket.CONNECTING;
        window.WebSocket.OPEN = OrigWebSocket.OPEN;
        window.WebSocket.CLOSING = OrigWebSocket.CLOSING;
        window.WebSocket.CLOSED = OrigWebSocket.CLOSED;
      } catch (_proto) {}
    }
  } catch (_wsPatch) {}

  // ——— V31/V32: stop login→dashboard→login bounce ————————————————
  function markPreviewLoginSuccess() {
    try {
      sessionStorage.setItem('__sv_login_at__', String(Date.now()));
      sessionStorage.removeItem('__sv_grace_reload__');
      sessionStorage.removeItem('__sv_hard_doc_nav__');
      sessionStorage.removeItem('__sv_blank_fix__');
      sessionStorage.removeItem('__sv_login_block_n__');
    } catch (_e) {}
  }

  function withinPostLoginGrace() {
    try {
      var at = Number(sessionStorage.getItem('__sv_login_at__') || '0');
      return at > 0 && Date.now() - at < 45000;
    } catch (_e) {
      return false;
    }
  }

  function isWeakAdminPath(pathname) {
    var p = String(pathname || '').replace(/\?.*$/, '').replace(/\/+$/, '') || '/';
    return p === '/admin' || p === '/dashboard' || p === '/portal';
  }

  function adminPathCandidates() {
    ensureHintsBeforeLogin();
    var out = [];
    function push(p) {
      p = pathnameOnly(p);
      if (!p || p.charAt(0) !== '/' || out.indexOf(p) >= 0) return;
      out.push(p);
    }
    try {
      push(defaultAdminHomePath());
    } catch (_e) {}
    var fromHints = pickBestAdminRouteFromHints();
    if (fromHints) push(fromHints);
    for (var i = 0; i < appHints.routes.length; i++) {
      var r = appHints.routes[i];
      if (/^\/(admin|dashboard|manDash|portal)(\/|$)/i.test(r) || /\/admin\//i.test(r)) push(r);
    }
    push('/admin/loans');
    push('/admin/dashboard');
    push('/admin/products');
    push('/admin');
    push('/dashboard');
    push('/manDash');
    return out;
  }

  function nextConcreteAdminPath(currentPath) {
    var cur = pathnameOnly(currentPath);
    var list = adminPathCandidates();
    for (var i = 0; i < list.length; i++) {
      var cand = pathnameOnly(list[i]);
      if (cand !== cur) return list[i];
    }
    return list[0] || '/dashboard';
  }

  function pickStayAdminPath() {
    var stay = pathnameOnly(location.pathname || '');
    var preferred = pathnameOnly(
      typeof defaultAdminHomePath === 'function' ? defaultAdminHomePath() : '/admin'
    );
    if (!stay || isLoginRedirectTarget(stay)) {
      stay = preferred;
    }
    // Gateway may land on /admin/dashboard when the SPA only has /dashboard.
    if (stay && preferred && stay !== preferred && !hasRoute(stay) && (hasRoute(preferred) || !appHints.routes.length)) {
      stay = preferred;
    }
    if (isWeakAdminPath(stay) && preferred && preferred !== stay && hasRoute(preferred)) {
      stay = preferred;
    }
    if (!stay || stay === '/') stay = preferred || '/admin';
    return stay;
  }

  function hydratePreviewAuthAfterBounce() {
    try {
      applyGatewayAuthRole();
      if (typeof ensureCoreAuthAliases === 'function') ensureCoreAuthAliases();
      if (typeof fixStoredPreviewUserRole === 'function') fixStoredPreviewUserRole();
      if (typeof writeBareRoleKeys === 'function') {
        writeBareRoleKeys(localStorage.getItem('role') || mainAdminRoleForApp());
      }
      window.dispatchEvent(new Event('userChanged'));
      window.dispatchEvent(new Event('sv-preview-login'));
    } catch (_hyd) {}
  }

  /**
   * Full document navigation — pathname only (no ?__sv_r=). Same-path uses reload
   * so React Router always sees a clean location that matches defined routes.
   */
  function forceAdminRemount(stay, force) {
    var dest = pathnameOnly(stay || pickStayAdminPath());
    try {
      var n = parseInt(sessionStorage.getItem('__sv_hard_doc_nav__') || '0', 10);
      if (!force && n >= 5) {
        console.warn('[DEBUG-SHIM] force remount skipped (max attempts) — unstick only');
        unstickNavigateNull(dest);
        return;
      }
      sessionStorage.setItem('__sv_hard_doc_nav__', String(n + 1));
    } catch (_e) {}

    hydratePreviewAuthAfterBounce();
    console.log('[DEBUG-SHIM] force admin remount →', dest, force ? '(forced)' : '');

    try {
      var cur = pathnameOnly(location.pathname || '');
      if (cur === dest) {
        try {
          sessionStorage.setItem('__sv_reload_bust__', String(Date.now()));
        } catch (_b) {}
        window.location.reload();
        return;
      }
      if (typeof window.__svNativeLocationReplace === 'function') {
        window.__svNativeLocationReplace(dest);
        return;
      }
      window.location.replace(dest);
    } catch (_nav) {
      try {
        window.location.reload();
      } catch (_r) {}
    }
  }

  function unstickNavigateNull(stay) {
    var dest = pathnameOnly(stay || pickStayAdminPath());
    try {
      applyGatewayAuthRole();
      hydratePreviewAuthAfterBounce();
      // Do NOT dispatch popstate here — it re-enters React Router <Navigate to="/login"/>
      // and floods history (Chrome: "Throttling navigation").
      if (window.__svNativeHistoryReplace) {
        window.__svNativeHistoryReplace(history.state || {}, '', dest);
      }
    } catch (_u) {}
  }

  /**
   * Handle forced logout navigations.
   * history.* : quiet rewrite to stay (no popstate loop). location.* : one remount.
   */
  function handleLoginRedirectAttempt(target, via) {
    var path = String(target || '');
    try {
      var u = new URL(path, window.location.href);
      path = u.pathname + (u.search || '');
    } catch (_e) {}
    var stay = pathnameOnly(pickStayAdminPath());
    var viaHist = via === 'history.pushState' || via === 'history.replaceState';

    var n = 0;
    try {
      n = parseInt(sessionStorage.getItem('__sv_login_block_n__') || '0', 10) + 1;
      sessionStorage.setItem('__sv_login_block_n__', String(n));
    } catch (_n) {
      n = 1;
    }

    if (n <= 3 || n === 6 || n === 12) {
      console.log(
        '[DEBUG-SHIM] blocked login redirect to',
        path,
        '→ stay',
        stay,
        viaHist ? '(history quiet)' : '(document remount)',
        via || '',
        '#' + n
      );
    }

    applyGatewayAuthRole();
    if (n <= 4) {
      hydratePreviewAuthAfterBounce();
    }

    if (viaHist) {
      // Quiet rewrite only — callers also replaceState/pushState to stay.
      // First blank check → one remount; then stay quiet to stop Chrome throttle.
      if (n === 1) {
        setTimeout(function () {
          try {
            var root = document.getElementById('root') || document.getElementById('app');
            var html = root ? String(root.innerHTML || '').replace(/\s+/g, '') : '';
            if (html.length <= 40) {
              console.warn('[DEBUG-SHIM] blank after login-block — one remount');
              try {
                sessionStorage.setItem('__sv_hard_doc_nav__', '0');
                sessionStorage.setItem('__sv_login_block_n__', '0');
              } catch (_c) {}
              forceAdminRemount(stay, true);
            }
          } catch (_b) {}
        }, 500);
      } else if (n === 5) {
        try {
          sessionStorage.setItem('__sv_hard_doc_nav__', '0');
        } catch (_c2) {}
        forceAdminRemount(stay, true);
      }
      return stay;
    }

    if (n <= 3) {
      forceAdminRemount(stay);
    }
    return stay;
  }

  /** @deprecated use forceAdminRemount */
  function scheduleHardAdminDocumentNav(stay, force) {
    forceAdminRemount(stay, force);
  }

  function installBlankRootWatchdog() {
    if (window.__SV_BLANK_ROOT_WATCH__) return;
    window.__SV_BLANK_ROOT_WATCH__ = true;
    var checks = 0;
    var timer = setInterval(function () {
      checks += 1;
      if (checks > 50) {
        clearInterval(timer);
        return;
      }
      try {
        if (!withinPostLoginGrace() && !getStoredAccessToken()) return;
        if (isCurrentlyOnLoginPage()) return;
        if (!/admin|dashboard/i.test(String(location.pathname || ''))) return;
        var root =
          document.getElementById('root') ||
          document.getElementById('app') ||
          document.querySelector('#root, #app, [data-reactroot]');
        if (!root) return;
        var html = String(root.innerHTML || '').replace(/\s+/g, '');
        if (html.length > 20) {
          try {
            sessionStorage.removeItem('__sv_hard_doc_nav__');
            sessionStorage.removeItem('__sv_blank_fix__');
            sessionStorage.removeItem('__sv_login_block_n__');
          } catch (_ok) {}
          clearInterval(timer);
          return;
        }
        var blankFix = parseInt(sessionStorage.getItem('__sv_blank_fix__') || '0', 10);
        if (blankFix >= 3) return;
        sessionStorage.setItem('__sv_blank_fix__', String(blankFix + 1));
        console.warn('[DEBUG-SHIM] blank #root on admin route — forcing admin remount');
        try {
          sessionStorage.setItem('__sv_hard_doc_nav__', '0');
        } catch (_c) {}
        var nextStay = pickStayAdminPath();
        if (blankFix >= 1) {
          nextStay = nextConcreteAdminPath(nextStay);
        }
        // Prefer a route that exists in the scanned bundle.
        if (!hasRoute(pathnameOnly(nextStay))) {
          var hinted = pickBestAdminRouteFromHints();
          if (hinted) nextStay = hinted;
        }
        forceAdminRemount(nextStay, true);
      } catch (_w) {}
    }, 400);
  }

  function getStoredAccessToken() {
    try {
      return (
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('jwt') ||
        localStorage.getItem('loan_token') ||
        sessionStorage.getItem('token') ||
        sessionStorage.getItem('accessToken') ||
        ''
      );
    } catch (_e) {
      return '';
    }
  }

  function getStoredUserObject() {
    var keys = [
      'user',
      'currentUser',
      'authUser',
      'loggedInUser',
      'loan_user',
      'payflow_user',
      'userData',
      'profile',
      'userInfo',
      'auth',
    ];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        var parsed = __svNativeJsonParse ? __svNativeJsonParse(raw) : JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') continue;
        if (parsed.user && typeof parsed.user === 'object') return parsed.user;
        if (parsed.email || parsed.role || parsed.name || parsed._id || parsed.id) return parsed;
      } catch (_p) {}
    }
    return null;
  }

  function isSessionProbeUrl(url) {
    var u = String(url || '');
    if (/login|signin|register|signup/i.test(u)) return false;
    return /\/(api\/)?(auth\/)?(me|profile|current-?user|users\/me|user\/me|verify|validate|session|whoami)(\/|$|\?)/i.test(
      u
    );
  }

  function isApiRequestUrl(url) {
    var u = String(url || '');
    if (!u) return false;
    if (isLoginUrl(u)) return false;
    if (/socket\.io/i.test(u)) return false;
    try {
      var abs = new URL(u, window.location.href);
      var p = abs.pathname || '';
      if (/^\/api(\/|$)/i.test(p)) return true;
      if (
        /^\/(auth|users|user|admin|loans|products|books|orders|dashboard|members|categories|locations|cabinets|libraries|shelves|volumes|book-placements|authors|publishers)\b/i.test(
          p
        )
      ) {
        return true;
      }
      var apiBase = detectApiBase();
      if (apiBase && String(abs.origin) === String(new URL(apiBase, window.location.href).origin)) {
        return !/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)(\?|$)/i.test(p);
      }
    } catch (_e) {}
    return false;
  }

  function isLoginRedirectTarget(target) {
    try {
      var u = new URL(String(target || ''), window.location.href);
      var p = String(u.pathname || '');
      return /\/(login|signin|sign-in|sign_in|log-in|auth\/login)\/?$/i.test(p) || /^\/(login|signin)\b/i.test(p);
    } catch (_e) {
      return /(?:^|\/)(login|signin|sign-in)(?:\/|\?|$)/i.test(String(target || ''));
    }
  }

  function isCurrentlyOnLoginPage() {
    try {
      return isLoginRedirectTarget(String(location.pathname || '') || '/');
    } catch (_e) {
      return false;
    }
  }

  /** Suppress SPA force-logout navigations when we have a token on an admin route. */
  function shouldSuppressLoginRedirect(target) {
    if (!getStoredAccessToken()) return false;
    if (isCurrentlyOnLoginPage()) return false;
    if (!isLoginRedirectTarget(target)) return false;
    if (withinPostLoginGrace()) return true;
    if (/admin|dashboard|manDash|loans/i.test(String(location.pathname || ''))) return true;
    return false;
  }

  function installLoginRedirectGuards() {
    if (window.__SV_LOGIN_REDIRECT_GUARD__) return;
    window.__SV_LOGIN_REDIRECT_GUARD__ = true;
    try {
      var loc = window.location;
      var descAssign = Object.getOwnPropertyDescriptor(Location.prototype, 'assign');
      var descReplace = Object.getOwnPropertyDescriptor(Location.prototype, 'replace');
      var nativeAssign = (descAssign && descAssign.value) || loc.assign.bind(loc);
      var nativeReplace = (descReplace && descReplace.value) || loc.replace.bind(loc);
      window.__svNativeLocationAssign = function (url) {
        return nativeAssign.call(loc, url);
      };
      window.__svNativeLocationReplace = function (url) {
        return nativeReplace.call(loc, url);
      };

      loc.assign = function (url) {
        if (shouldSuppressLoginRedirect(url)) {
          var stay = handleLoginRedirectAttempt(url, 'location.assign');
          return nativeAssign.call(loc, stay);
        }
        return nativeAssign.call(loc, url);
      };
      loc.replace = function (url) {
        if (shouldSuppressLoginRedirect(url)) {
          var stay = handleLoginRedirectAttempt(url, 'location.replace');
          return nativeReplace.call(loc, stay);
        }
        return nativeReplace.call(loc, url);
      };

      try {
        var hrefDesc = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
        if (hrefDesc && hrefDesc.configurable && hrefDesc.set) {
          Object.defineProperty(Location.prototype, 'href', {
            configurable: true,
            enumerable: true,
            get: hrefDesc.get,
            set: function (v) {
              if (shouldSuppressLoginRedirect(v)) {
                var stay = handleLoginRedirectAttempt(v, 'location.href');
                return hrefDesc.set.call(this, stay);
              }
              return hrefDesc.set.call(this, v);
            },
          });
        } else {
          console.log('[DEBUG-SHIM] location.href guard skipped (non-configurable)');
        }
      } catch (_href) {
        console.log('[DEBUG-SHIM] location.href guard skipped', _href && _href.message);
      }
    } catch (_loc) {
      console.warn('[DEBUG-SHIM] location redirect guard failed', _loc && _loc.message);
    }

    try {
      var __svPush = history.pushState.bind(history);
      var __svReplace = history.replaceState.bind(history);
      window.__svNativeHistoryPush = __svPush;
      window.__svNativeHistoryReplace = __svReplace;
      history.pushState = function (state, title, url) {
        url = sanitizeHistoryUrl(url);
        if (url != null && shouldSuppressLoginRedirect(url)) {
          var stay = pathnameOnly(handleLoginRedirectAttempt(url, 'history.pushState'));
          return __svPush(state, title, stay);
        }
        var r = __svPush(state, title, url);
        try {
          ensureCoreAuthAliases();
          setTimeout(function () {
            dumpAuthDebug('pushState ' + String(location.pathname || ''));
          }, 50);
        } catch (_ps) {}
        return r;
      };
      history.replaceState = function (state, title, url) {
        url = sanitizeHistoryUrl(url);
        if (url != null && shouldSuppressLoginRedirect(url)) {
          var stay = pathnameOnly(handleLoginRedirectAttempt(url, 'history.replaceState'));
          // Must still call native replace with STAY path — no-op caused white page.
          return __svReplace(state, title, stay);
        }
        return __svReplace(state, title, url);
      };
      window.__SV_HISTORY_GUARD__ = true;
    } catch (_hist) {
      console.warn('[DEBUG-SHIM] history redirect guard failed', _hist && _hist.message);
    }

    installBlankRootWatchdog();
  }
  installLoginRedirectGuards();
  try {
    stripBootSvQuery();
  } catch (_strip) {}

  function installNoRoutesMatchedRecovery() {
    if (window.__SV_NO_ROUTE_RECOVERY__) return;
    window.__SV_NO_ROUTE_RECOVERY__ = true;
    function recoverFromUnmatched(locHint) {
      try {
        if (!getStoredAccessToken()) return;
        var n = parseInt(sessionStorage.getItem('__sv_no_route_fix__') || '0', 10);
        if (n >= 4) return;
        sessionStorage.setItem('__sv_no_route_fix__', String(n + 1));
        ensureHintsBeforeLogin();
        var cur = pathnameOnly(location.pathname || '');
        var next = pickBestAdminRouteFromHints() || nextConcreteAdminPath(cur) || '/dashboard';
        next = pathnameOnly(next);
        if (next === cur) next = nextConcreteAdminPath(cur);
        console.warn('[DEBUG-SHIM] No routes matched — recovering', {
          from: locHint || cur,
          to: next,
          attempt: n + 1,
          routes: (appHints.routes || []).slice(0, 12),
        });
        try {
          sessionStorage.setItem('__sv_hard_doc_nav__', '0');
        } catch (_c) {}
        forceAdminRemount(next, true);
      } catch (_r) {}
    }
    try {
      var origWarn = console.warn.bind(console);
      console.warn = function () {
        try {
          var msg = Array.prototype.slice.call(arguments).join(' ');
          if (/No routes matched location/i.test(msg)) {
            recoverFromUnmatched(msg);
          }
        } catch (_w) {}
        return origWarn.apply(console, arguments);
      };
    } catch (_hook) {}
  }
  installNoRoutesMatchedRecovery();

  function installBootAdminRecovery() {
    if (window.__SV_BOOT_ADMIN_RECOVERY__) return;
    window.__SV_BOOT_ADMIN_RECOVERY__ = true;
    function checkBlankAdminRoot() {
      try {
        if (!getStoredAccessToken()) return;
        if (isCurrentlyOnLoginPage()) return;
        if (!/admin|dashboard/i.test(String(location.pathname || ''))) return;
        var root =
          document.getElementById('root') ||
          document.getElementById('app') ||
          document.querySelector('#root, #app, [data-reactroot]');
        if (!root) return;
        var html = String(root.innerHTML || '').replace(/\s+/g, '');
        if (html.length > 20) return;
        if (sessionStorage.getItem('__sv_boot_recovery__') === '1') return;
        sessionStorage.setItem('__sv_boot_recovery__', '1');
        console.warn('[DEBUG-SHIM] boot: blank admin root with token — force remount');
        forceAdminRemount(pickStayAdminPath(), true);
      } catch (_b) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(checkBlankAdminRoot, 700);
      });
    } else {
      setTimeout(checkBlankAdminRoot, 700);
    }
  }
  installBootAdminRecovery();

  function syntheticSessionBody() {
    var user = getStoredUserObject() || {
      _id: 'preview-admin',
      id: 'preview-admin',
      email: localStorage.getItem('email') || 'admin@preview.demo',
      role: localStorage.getItem('role') || mainAdminRoleForApp(),
      name: localStorage.getItem('name') || 'Preview Admin',
      isAdmin: true,
    };
    try {
      user = normalizePreviewUserRole(user);
    } catch (_n) {}
    var token = getStoredAccessToken();
    return {
      success: true,
      user: user,
      data: { user: user, token: token, success: true },
      token: token,
      accessToken: token,
      role: user.role,
      email: user.email,
      name: user.name || user.fullName,
      message: 'OK',
    };
  }

  function syntheticSessionResponse() {
    return new Response(JSON.stringify(syntheticSessionBody()), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json', 'X-SV-Session-Soft': '1' },
    });
  }

  function forceAuthHeaders(headersLike) {
    var token = getStoredAccessToken();
    if (!token) return headersLike;
    var bearer = /^Bearer\s+/i.test(token) ? token : 'Bearer ' + token;
    try {
      if (headersLike && typeof Headers !== 'undefined' && headersLike instanceof Headers) {
        headersLike.set('Authorization', bearer);
        return headersLike;
      }
    } catch (_h) {}
    var out = headersLike && typeof headersLike === 'object' ? Object.assign({}, headersLike) : {};
    out.Authorization = bearer;
    out.authorization = bearer;
    return out;
  }

  function ensureAuthOnHeaders(headersLike, url) {
    if (!isApiRequestUrl(url) && !isSessionProbeUrl(url)) return headersLike;
    var token = getStoredAccessToken();
    if (!token) return headersLike;
    var bearer = /^Bearer\s+/i.test(token) ? token : 'Bearer ' + token;
    try {
      if (headersLike && typeof Headers !== 'undefined' && headersLike instanceof Headers) {
        if (!headersLike.get('Authorization') && !headersLike.get('authorization')) {
          headersLike.set('Authorization', bearer);
        }
        return headersLike;
      }
    } catch (_h) {}
    var out = headersLike && typeof headersLike === 'object' ? Object.assign({}, headersLike) : {};
    var has =
      out.Authorization ||
      out.authorization ||
      (out.get && (out.get('Authorization') || out.get('authorization')));
    if (!has) out.Authorization = bearer;
    return out;
  }

  function ensureAuthFetchInit(init, url) {
    var next = init ? Object.assign({}, init) : {};
    next.headers = ensureAuthOnHeaders(next.headers || {}, url);
    return next;
  }

  /**
   * V32: session probes soft-succeed; during grace ANY 401 with a stored token is
   * retried once with Authorization forced before the 401 is returned to the SPA.
   */
  function softSessionIfUnauthorized(res, url, fetchCtx) {
    if (!res || (res.status !== 401 && res.status !== 403)) return Promise.resolve(res);
    if (!getStoredAccessToken()) return Promise.resolve(res);

    if (isSessionProbeUrl(url)) {
      console.warn('[DEBUG-SHIM] soft-succeed session probe after', res.status, String(url || ''));
      return Promise.resolve(syntheticSessionResponse());
    }

    if (
      withinPostLoginGrace() &&
      isApiRequestUrl(url) &&
      fetchCtx &&
      !fetchCtx.retried &&
      typeof origFetch === 'function'
    ) {
      fetchCtx.retried = true;
      console.warn(
        '[DEBUG-SHIM] retrying once with Authorization after',
        res.status,
        String(url || '')
      );
      var retryInit = fetchCtx.init ? Object.assign({}, fetchCtx.init) : {};
      retryInit.headers = forceAuthHeaders(retryInit.headers || {});
      var retryInput = fetchCtx.input;
      try {
        if (typeof retryInput !== 'string' && typeof Request !== 'undefined' && retryInput instanceof Request) {
          var hdrs = forceAuthHeaders(new Headers(retryInput.headers || {}));
          retryInput = new Request(retryInput, { headers: hdrs });
        } else if (typeof retryInput === 'string') {
          retryInit = Object.assign({}, retryInit, { headers: forceAuthHeaders(retryInit.headers || {}) });
        }
      } catch (_ri) {}
      return origFetch
        .call(window, retryInput, retryInit)
        .then(function (res2) {
          return softSessionIfUnauthorized(res2, url, fetchCtx);
        })
        .catch(function () {
          return res;
        });
    }

    if (withinPostLoginGrace() && isApiRequestUrl(url)) {
      console.warn('[DEBUG-SHIM] soft-succeed API 401 during grace', String(url || ''));
      return Promise.resolve(syntheticSessionResponse());
    }

    return Promise.resolve(res);
  }

  // Block axios/SPA from wiping token/user right after login (401 interceptor race).
  try {
    var __svNativeRemoveItem = Storage.prototype.removeItem;
    var __svNativeClear = Storage.prototype.clear;
    var AUTH_CLEAR_KEYS = {
      token: 1,
      accessToken: 1,
      access_token: 1,
      jwt: 1,
      loan_token: 1,
      user: 1,
      userInfo: 1,
      currentUser: 1,
      authUser: 1,
      auth: 1,
      loggedInUser: 1,
      loan_user: 1,
      payflow_user: 1,
      role: 1,
      userRole: 1,
      isAdmin: 1,
      email: 1,
    };
    Storage.prototype.removeItem = function (key) {
      var k = String(key || '');
      // Only block during post-login grace — blocking on admin routes forever
      // broke Log Out (tokens never cleared → broken re-login).
      if (
        this === localStorage &&
        AUTH_CLEAR_KEYS[k] &&
        getStoredAccessToken() &&
        withinPostLoginGrace()
      ) {
        console.warn('[DEBUG-SHIM] blocked auth removeItem during grace:', k);
        return;
      }
      return __svNativeRemoveItem.apply(this, arguments);
    };
    Storage.prototype.clear = function () {
      if (this === localStorage && withinPostLoginGrace() && getStoredAccessToken()) {
        console.warn('[DEBUG-SHIM] blocked localStorage.clear during post-login grace');
        return;
      }
      return __svNativeClear.apply(this, arguments);
    };
  } catch (_guard) {}

  function patchAxiosAuth() {
    try {
      var ax = window.axios;
      if (!ax || !ax.interceptors || ax.__svAuthPatched) return;
      ax.__svAuthPatched = true;
      ax.interceptors.request.use(function (config) {
        try {
          var token = getStoredAccessToken();
          if (token) {
            config.headers = config.headers || {};
            if (!config.headers.Authorization && !config.headers.authorization) {
              config.headers.Authorization = /^Bearer\s+/i.test(token) ? token : 'Bearer ' + token;
            }
          }
          var rawUrl = String((config && config.url) || '');
          if (isLoginUrl(rawUrl) && !config.__svLoginUrlRewritten) {
            var preferred = '';
            try {
              preferred = String(window.__SV_LOGIN_API_PATH__ || '').trim();
            } catch (_p) {}
            // Prefer discovered /api/* path; never leave bare /auth/login as the only try.
            if (preferred && preferred.indexOf('/api/') === 0) {
              config.url = preferred;
              config.__svLoginUrlRewritten = true;
              console.log('[DEBUG-SHIM] axios login URL → preferred', preferred);
            } else if (/^\/auth\/login\/?$/i.test(rawUrl.split('?')[0] || '')) {
              config.url = '/api/auth/login';
              config.__svLoginUrlRewritten = true;
              console.log('[DEBUG-SHIM] axios login URL /auth/login → /api/auth/login');
            }
          }
          if (isLoginUrl(String((config && config.url) || '')) && config.data != null && !config.__svLoginBodyExpanded) {
            config.data = expandLoginRequestBody(config.data);
            config.__svLoginBodyExpanded = true;
          }
        } catch (_c) {}
        return config;
      });
      ax.interceptors.response.use(
        function (r) {
          return r;
        },
        function (err) {
          try {
            var status = err && err.response && err.response.status;
            var cfg = err && err.config;
            var url = cfg && (cfg.url || '');
            var bodyText = '';

            // Network timeout / connection reset (POST /categories hang).
            if (!status && cfg && isListishApiUrl(url)) {
              var method = String(cfg.method || 'get').toLowerCase();
              if (method === 'get') {
                console.warn('[DEBUG-SHIM] axios network fail list GET → soft-empty', url);
                return Promise.resolve({
                  data: softEmptyListPayload(url),
                  status: 200,
                  statusText: 'OK',
                  headers: { 'x-sv-preview-soft-empty': '1' },
                  config: cfg,
                  request: err.request,
                });
              }
              console.warn('[DEBUG-SHIM] axios network fail write → reject soft', url);
              return Promise.reject(
                Object.assign(err, {
                  response: {
                    data: {
                      message: 'Preview API unreachable (timeout). Redeploy preview or check Mongo.',
                      error: 'preview_network',
                      success: false,
                    },
                    status: 504,
                    statusText: 'Timeout',
                    headers: {},
                    config: cfg,
                  },
                })
              );
            }
            try {
              var d = err.response && err.response.data;
              bodyText = typeof d === 'string' ? d : JSON.stringify(d || '');
            } catch (_bt) {}

            // Login path mismatch: try alternate Express mounts.
            if (
              cfg &&
              isLoginUrl(url) &&
              shouldRetry(status, bodyText) &&
              !cfg.__svLoginPathRetry
            ) {
              var cands = loginCandidates(url);
              var idx = typeof cfg.__svLoginCandIdx === 'number' ? cfg.__svLoginCandIdx : 0;
              if (idx < cands.length) {
                var next = cands[idx];
                cfg.__svLoginCandIdx = idx + 1;
                cfg.__svLoginPathRetry = idx + 1 >= cands.length;
                try {
                  var parts = splitBaseAndPath(next);
                  if (parts.origin && cfg.baseURL) {
                    // Absolute candidate — drop conflicting baseURL
                    cfg.baseURL = undefined;
                    cfg.url = next;
                  } else if (parts.origin) {
                    cfg.baseURL = parts.origin;
                    cfg.url = parts.path || '/';
                  } else {
                    cfg.url = parts.path || next;
                  }
                } catch (_u) {
                  cfg.url = next;
                }
                console.warn('[DEBUG-SHIM] axios login 404 → retry', cfg.url);
                return ax.request(cfg);
              }
            }

            // CRUD path mismatch: /api/students ↔ /students ↔ singular/plural.
            if (
              cfg &&
              !isLoginUrl(url) &&
              isApiRequestUrl(url) &&
              shouldRetryApiPath(status, bodyText) &&
              !cfg.__svApiPathExhausted
            ) {
              if (!cfg.__svApiPathCands) {
                var fullForCands = url;
                try {
                  if (cfg.baseURL && !/^https?:/i.test(String(url || ''))) {
                    fullForCands = String(cfg.baseURL).replace(/\/$/, '') + '/' + String(url || '').replace(/^\//, '');
                  }
                } catch (_f) {}
                cfg.__svApiPathCands = apiPathCandidates(fullForCands || url);
                cfg.__svApiPathIdx = 0;
              }
              var apiCands = cfg.__svApiPathCands || [];
              var apiIdx = typeof cfg.__svApiPathIdx === 'number' ? cfg.__svApiPathIdx : 0;
              if (apiIdx < apiCands.length) {
                var apiNext = apiCands[apiIdx];
                cfg.__svApiPathIdx = apiIdx + 1;
                if (cfg.__svApiPathIdx >= apiCands.length) cfg.__svApiPathExhausted = true;
                try {
                  var apiParts = splitBaseAndPath(apiNext);
                  cfg.baseURL = undefined;
                  cfg.url = apiNext;
                  if (apiParts.path && !apiParts.origin) cfg.url = apiParts.path;
                } catch (_au) {
                  cfg.url = apiNext;
                }
                console.warn('[DEBUG-SHIM] axios API path 404 → retry', cfg.url);
                return ax.request(cfg);
              }
            }

            // List GET 500 after path retries — soft-empty so SPA stays usable.
            if (
              status >= 500 &&
              cfg &&
              String(cfg.method || 'get').toLowerCase() === 'get' &&
              isListishApiUrl(url)
            ) {
              console.warn('[DEBUG-SHIM] axios list GET', status, '→ soft-empty', url);
              return Promise.resolve({
                data: softEmptyListPayload(url),
                status: 200,
                statusText: 'OK',
                headers: { 'x-sv-preview-soft-empty': '1' },
                config: cfg,
                request: err.request,
              });
            }

            // POST/PUT hang or 500: fail fast with JSON (avoid endless spinner).
            if (
              status >= 500 &&
              cfg &&
              /^(post|put|patch)$/i.test(String(cfg.method || '')) &&
              isListishApiUrl(url)
            ) {
              console.warn('[DEBUG-SHIM] axios write', status, '→ soft error body', url);
              return Promise.reject(
                Object.assign(err, {
                  response: {
                    data: {
                      message: 'Preview API error — check Mongo / Express logs',
                      error: 'preview_upstream_500',
                      success: false,
                    },
                    status: status,
                    statusText: 'Error',
                    headers: {},
                    config: cfg,
                  },
                })
              );
            }

            if (!(status === 401 || status === 403) || !getStoredAccessToken()) {
              return Promise.reject(err);
            }
            if (isSessionProbeUrl(url)) {
              console.warn('[DEBUG-SHIM] axios session soft-succeed', url);
              return Promise.resolve({
                data: syntheticSessionBody(),
                status: 200,
                statusText: 'OK',
                headers: { 'x-sv-session-soft': '1' },
                config: cfg,
                request: err.request,
              });
            }
            if (withinPostLoginGrace() && cfg && !cfg.__svAuthRetried && typeof ax.request === 'function') {
              cfg.__svAuthRetried = true;
              cfg.headers = cfg.headers || {};
              var tok = getStoredAccessToken();
              cfg.headers.Authorization = /^Bearer\s+/i.test(tok) ? tok : 'Bearer ' + tok;
              console.warn('[DEBUG-SHIM] axios retrying once with Authorization after', status, url);
              return ax.request(cfg);
            }
            if (withinPostLoginGrace() && isApiRequestUrl(url)) {
              console.warn('[DEBUG-SHIM] axios soft-succeed API 401 during grace', url);
              return Promise.resolve({
                data: syntheticSessionBody(),
                status: 200,
                statusText: 'OK',
                headers: { 'x-sv-session-soft': '1' },
                config: cfg,
                request: err.request,
              });
            }
          } catch (_e) {}
          return Promise.reject(err);
        }
      );
      console.log('[DEBUG-SHIM] axios auth interceptors installed');
    } catch (_ax) {}
  }
  patchAxiosAuth();
  try {
    setInterval(patchAxiosAuth, 1500);
  } catch (_i) {}

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
      try {
        init = ensureAuthFetchInit(init, url);
        if (typeof input !== 'string' && typeof Request !== 'undefined' && input instanceof Request) {
          try {
            var hdrs = new Headers(input.headers || {});
            hdrs = ensureAuthOnHeaders(hdrs, url);
            input = new Request(input, { headers: hdrs });
          } catch (_rq) {}
        }
      } catch (_authH) {}
      // Always timeout loopback leftovers so the UI cannot stick on "Please wait…".
      var needsTimeout = isLoopbackOrigin(url) || (method === 'POST' && isLoginUrl(url));
      if (method !== 'POST' || !isLoginUrl(url)) {
        var fetchCtx = { input: input, init: init, retried: false, apiPathIdx: 0, apiPathCands: null };
        function afterApi(res) {
          return Promise.resolve()
            .then(function () {
              if (
                !res ||
                !shouldRetryApiPath(res.status) ||
                isLoginUrl(url) ||
                !isApiRequestUrl(url)
              ) {
                return res;
              }
              if (!fetchCtx.apiPathCands) {
                fetchCtx.apiPathCands = apiPathCandidates(url);
              }
              var cands = fetchCtx.apiPathCands || [];
              if (fetchCtx.apiPathIdx >= cands.length) return res;
              return res
                .clone()
                .text()
                .then(function (text) {
                  if (!shouldRetryApiPath(res.status, text)) return res;
                  if (fetchCtx.apiPathIdx >= cands.length) return res;
                  var nextUrl = cands[fetchCtx.apiPathIdx++];
                  console.warn('[DEBUG-SHIM] fetch API path 404 → retry', nextUrl);
                  var nextInput = nextUrl;
                  if (typeof input !== 'string' && typeof Request !== 'undefined') {
                    try {
                      nextInput = new Request(nextUrl, input);
                    } catch (_nr) {
                      nextInput = nextUrl;
                    }
                  }
                  return origFetch.call(window, nextInput, init).then(afterApi);
                });
            })
            .then(function (r1) {
              return softSessionIfUnauthorized(r1, url, fetchCtx).then(function (r2) {
                return rewriteJsonApiResponse(r2, url);
              });
            });
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
      try {
        if (init && init.body != null) {
          init = Object.assign({}, init, { body: expandLoginRequestBody(init.body) });
        }
      } catch (_exp) {}
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
          // Attach Bearer if the SPA forgot (common when AuthContext is stale).
          try {
            var hasAuth = false;
            for (var hk in headers) {
              if (/^authorization$/i.test(hk) && headers[hk]) hasAuth = true;
            }
            if (!hasAuth && getStoredAccessToken() && (isApiRequestUrl(url) || isSessionProbeUrl(url))) {
              var tok = getStoredAccessToken();
              var bearer = /^Bearer\s+/i.test(tok) ? tok : 'Bearer ' + tok;
              try {
                _setHeader.call(xhr, 'Authorization', bearer);
                headers.Authorization = bearer;
              } catch (_ah) {}
            }
          } catch (_authX) {}
          // Capture-phase listener runs before axios onreadystatechange, so we can
          // rewrite responseText before data.loans.length is evaluated.
          try {
            xhr.addEventListener(
              'readystatechange',
              function svNormalizeLists() {
                try {
                  if (xhr.readyState !== 4) return;
                  // Soft-succeed session probes (and any API 401 during grace) to prevent logout bounce.
                  if (
                    (xhr.status === 401 || xhr.status === 403) &&
                    getStoredAccessToken() &&
                    (isSessionProbeUrl(url) || (withinPostLoginGrace() && isApiRequestUrl(url)))
                  ) {
                    var soft = JSON.stringify(syntheticSessionBody());
                    try {
                      Object.defineProperty(xhr, 'status', {
                        configurable: true,
                        get: function () {
                          return 200;
                        },
                      });
                      Object.defineProperty(xhr, 'statusText', {
                        configurable: true,
                        get: function () {
                          return 'OK';
                        },
                      });
                      Object.defineProperty(xhr, 'responseText', {
                        configurable: true,
                        get: function () {
                          return soft;
                        },
                      });
                      Object.defineProperty(xhr, 'response', {
                        configurable: true,
                        get: function () {
                          return JSON.parse(soft);
                        },
                      });
                      console.warn('[DEBUG-SHIM] xhr session soft-succeed', url);
                    } catch (_soft) {}
                    return;
                  }
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

  // FoundLink dump proved: accessToken + userInfo present, but token=null and user=null.
  // SPA does JSON.parse(localStorage.user) → undefined → crash. Always mirror core keys.
  function ensureCoreAuthAliases() {
    try {
      var token =
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('loan_token') ||
        localStorage.getItem('jwt');
      if (token) {
        if (!localStorage.getItem('token')) localStorage.setItem('token', token);
        if (!localStorage.getItem('accessToken')) localStorage.setItem('accessToken', token);
        if (!localStorage.getItem('access_token')) localStorage.setItem('access_token', token);
        if (!localStorage.getItem('jwt')) localStorage.setItem('jwt', token);
        if (isLoanStyleApp() && !localStorage.getItem('loan_token')) {
          localStorage.setItem('loan_token', token);
        }
      }

      var userRaw =
        localStorage.getItem('user') ||
        localStorage.getItem('currentUser') ||
        localStorage.getItem('authUser') ||
        localStorage.getItem('loggedInUser') ||
        localStorage.getItem('loan_user') ||
        localStorage.getItem('payflow_user') ||
        localStorage.getItem('userData') ||
        localStorage.getItem('profile');
      var userObj = null;
      if (userRaw) {
        try {
          userObj = __svNativeJsonParse ? __svNativeJsonParse(userRaw) : JSON.parse(userRaw);
          if (userObj && userObj.user && typeof userObj.user === 'object') userObj = userObj.user;
        } catch (_pu) {
          userObj = null;
        }
      }
      if (!userObj) {
        var infoRaw = localStorage.getItem('userInfo') || localStorage.getItem('auth');
        if (infoRaw) {
          try {
            var info = __svNativeJsonParse ? __svNativeJsonParse(infoRaw) : JSON.parse(infoRaw);
            if (info && info.user && typeof info.user === 'object') userObj = info.user;
            else if (info && (info.email || info.role || info.name)) userObj = info;
          } catch (_pi) {}
        }
      }
      if (userObj && typeof userObj === 'object') {
        userObj = normalizePreviewUserRole(userObj);
        var userJson = JSON.stringify(userObj);
        localStorage.setItem('user', userJson);
        if (!localStorage.getItem('currentUser')) localStorage.setItem('currentUser', userJson);
        if (!localStorage.getItem('authUser')) localStorage.setItem('authUser', userJson);
        if (!localStorage.getItem('loggedInUser')) localStorage.setItem('loggedInUser', userJson);
        if (isLoanStyleApp() && !localStorage.getItem('loan_user')) {
          localStorage.setItem('loan_user', userJson);
        }
        if (userObj.email && !localStorage.getItem('email')) {
          localStorage.setItem('email', String(userObj.email));
        }
        if (userObj.role) writeBareRoleKeys(userObj.role);
        try {
          localStorage.user = userJson;
        } catch (_prop) {}
      }
      var ok = { token: !!localStorage.getItem('token'), user: !!localStorage.getItem('user') };
      console.log('[DEBUG-SHIM] ensureCoreAuthAliases', ok);
      return ok;
    } catch (e) {
      console.warn('[DEBUG-SHIM] ensureCoreAuthAliases failed', e);
      return { token: false, user: false };
    }
  }

  function seedAuthStorageIfNeeded() {
    try {
      var synced = ensureCoreAuthAliases();
      if (synced.token && synced.user) return;
      var token =
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        localStorage.getItem('loan_token') ||
        localStorage.getItem('jwt');
      if (!token) return;
      if (localStorage.getItem('user')) {
        ensureCoreAuthAliases();
        return;
      }
      var role = mainAdminRoleForApp();
      if (isLoanStyleApp()) role = 'admin';
      if (isSkyPropertyApp()) role = 'SUPER_ADMIN';
      var email =
        localStorage.getItem('email') ||
        (window.__SV_PREVIEW_ADMIN_EMAIL__ || 'admin@preview.demo');
      var user = normalizePreviewUserRole({
        _id: 'preview-admin',
        id: 'preview-admin',
        email: email,
        username: String(email).split('@')[0] || 'admin',
        name: 'Preview Admin',
        fullName: 'Preview Admin',
        role: role,
        isAdmin: true,
        is_admin: true,
      });
      var envelope = {
        success: true,
        token: token,
        accessToken: token,
        role: role,
        user: user,
        data: { token: token, user: user, success: true },
      };
      localStorage.setItem('user', JSON.stringify(user));
      try {
        localStorage.user = JSON.stringify(user);
      } catch (_p) {}
      localStorage.setItem('userInfo', JSON.stringify(envelope));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('authUser', JSON.stringify(user));
      localStorage.setItem('auth', JSON.stringify(envelope));
      localStorage.setItem('token', token);
      writeBareRoleKeys(role);
      console.log('[DEBUG-SHIM] seeded missing auth user JSON for dashboard');
      ensureCoreAuthAliases();
    } catch (_e) {}
  }
  try {
    applyGatewayAuthRole();
    seedAuthStorageIfNeeded();
    dumpAuthDebug('after-seed-check');
  } catch (_s) {}
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        applyGatewayAuthRole();
        seedAuthStorageIfNeeded();
        dumpAuthDebug('dom-ready');
      });
    }
  } catch (_d) {}
  try {
    window.addEventListener('popstate', function () {
      ensureCoreAuthAliases();
      dumpAuthDebug('popstate ' + String(location.pathname || ''));
    });
    // history.pushState / replaceState already guarded in installLoginRedirectGuards (V32).
    if (!window.__SV_HISTORY_GUARD__) {
      var __svPush = history.pushState;
      history.pushState = function () {
        var r = __svPush.apply(this, arguments);
        try {
          ensureCoreAuthAliases();
          setTimeout(function () {
            dumpAuthDebug('pushState ' + String(location.pathname || ''));
          }, 50);
        } catch (_ps) {}
        return r;
      };
    }
  } catch (_h) {}
})();
