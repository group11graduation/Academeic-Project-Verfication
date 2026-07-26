/**
 * Injected into student preview index.html so login works across Express route shapes.
 * On 404 / "Route not found", retries common API login paths against the API origin
 * (never against the SPA origin — that caused SYADA "Route not found" on /login).
 *
 * Marker V11 (all React+Express+Mongoose previews):
 * - Discover role allow-lists from the SPA bundle (roles:[…], Set([…])).
 * - Never invent/rewrite roles the app does not accept (stops blank redirect loops).
 * - Do not hard-redirect after login unless the app is still stuck on /login.
 * V10: do not rewrite plain "admin" → "super_admin".
 * V9: rewrite Vite-proxy style paths (/dashboard/summary → /api/dashboard/summary).
 */
(function () {
  if (window.__SV_LOGIN_FALLBACK_V11__) {
    console.log('[DEBUG-SHIM] already installed V11 — skip');
    return;
  }
  window.__SV_LOGIN_FALLBACK_V11__ = true;
  window.__SV_LOGIN_FALLBACK_V10__ = true;
  window.__SV_LOGIN_FALLBACK_V9__ = true;
  window.__SV_LOGIN_FALLBACK_V8__ = true;
  window.__SV_LOGIN_FALLBACK_V7__ = true;
  window.__SV_LOGIN_FALLBACK__ = true;
  console.log('[DEBUG-SHIM] preview-login-fallback ACTIVE v11', {
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

  function isLoginUrl(url) {
    try {
      var u = String(url || '');
      return /\/(api\/)?(auth\/|users\/|user\/|v1\/auth\/)?login\/?(\?|$)/i.test(u);
    } catch (_e) {
      return false;
    }
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
    if (apiBase && (!origin || origin === pageOrigin || isLoopbackOrigin(origin))) {
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

  function ingestHintText(text) {
    if (!text) return;
    var t = String(text);
    var listRe =
      /(?:roles|allowedRoles|allowed_roles|PERMITTED_ROLES|roleOptions)\s*[:=]\s*\[([^\]]{0,500})\]/gi;
    var setRe = /Set\s*\(\s*\[([^\]]{0,500})\]\s*\)/g;
    var m;
    while ((m = listRe.exec(t))) {
      var roles = extractQuotedStrings(m[1]).filter(function (r) {
        return /^[A-Za-z][A-Za-z0-9_\-]{1,32}$/.test(r);
      });
      if (roles.length) appHints.allowLists.push(uniqStrings(roles));
    }
    while ((m = setRe.exec(t))) {
      var setRoles = extractQuotedStrings(m[1]).filter(function (r) {
        return /^[A-Za-z][A-Za-z0-9_\-]{1,32}$/.test(r);
      });
      if (setRoles.length) appHints.allowLists.push(uniqStrings(setRoles));
    }
    // Common staff tuples in minified guards: ["officer","admin"] / ['admin','user']
    var tupleRe = /\[((?:['"`](?:admin|ADMIN|Admin|officer|Officer|manager|MANAGER|editor|borrower|user|USER|super_admin|SUPER_ADMIN|teacher|student|member)['"`]\s*,?\s*){1,8})\]/g;
    while ((m = tupleRe.exec(t))) {
      var tup = extractQuotedStrings(m[1]);
      if (tup.length) appHints.allowLists.push(uniqStrings(tup));
    }
    var routeRe = /path\s*:\s*['"`](\/[A-Za-z0-9/_-]{1,80})['"`]/g;
    while ((m = routeRe.exec(t))) {
      appHints.routes.push(m[1]);
    }
    var toRe = /(?:to|navigate)\s*\(\s*['"`](\/[A-Za-z0-9/_-]{1,80})['"`]/g;
    while ((m = toRe.exec(t))) {
      appHints.routes.push(m[1]);
    }
    appHints.routes = uniqStrings(appHints.routes);
  }

  function scanAppBundles(done) {
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
      appHints.allowLists = appHints.allowLists.filter(function (list) {
        return list && list.length;
      });
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
      // Skip huge vendor chunks when we can; still scan app bundles.
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
    else setTimeout(finish, 4000);
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
    var prefer = [
      'super_admin',
      'SUPER_ADMIN',
      'SuperAdmin',
      'admin',
      'ADMIN',
      'Admin',
      'officer',
      'Officer',
      'manager',
      'MANAGER',
      'editor',
      'EDITOR',
    ];
    for (var i = 0; i < prefer.length; i++) {
      if (vals.indexOf(prefer[i]) >= 0) return prefer[i];
    }
    var fuzzy = vals.find(function (v) {
      return /admin|officer|manager|editor/i.test(v);
    });
    return fuzzy || vals[0] || null;
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

  function isSyadaStyleApp() {
    var html = pageHintHtml();
    if (/\/admin\/dashboard/.test(html)) return true;
    if (appHints.routes.indexOf('/admin/dashboard') >= 0) return true;
    var roles = allHintRoles();
    return (
      roles.indexOf('super_admin') >= 0 &&
      roles.indexOf('manager') >= 0 &&
      roles.indexOf('editor') >= 0
    );
  }

  function hasRoute(path) {
    return appHints.routes.indexOf(path) >= 0 || pageHintHtml().indexOf(path) >= 0;
  }

  /**
   * Pick a role string this SPA will accept.
   * Generic rule for all React+Express+Mongoose apps: never keep a role that
   * every discovered allow-list rejects (that causes ProtectedRoute loops → blank UI).
   */
  function canonicalRoleForApp(role) {
    var current = String(role || '').trim();
    if (!current) return current;

    if (appHints.allowLists.length) {
      if (roleAcceptedByHints(current)) return exactRoleFromHints(current);
      var best = preferPrivilegedRole(allHintRoles());
      if (best) return best;
    }

    var key = roleKeyOf(current);
    if (isSkyPropertyApp() && (isSuperAdminKey(key) || key === 'ADMIN')) return 'SUPER_ADMIN';
    if (isSyadaStyleApp() && (isSuperAdminKey(key) || key === 'ADMIN' || current === 'super_admin')) {
      return 'super_admin';
    }
    // Generic MERN: leave plain admin/officer/user/etc. untouched.
    if (isSuperAdminKey(key) && hasRoute('/admin/loans')) return 'admin';
    if (isSuperAdminKey(key) && !isSyadaStyleApp() && !isSkyPropertyApp() && hasRoute('/dashboard')) {
      // Many student apps only allow "admin"; super_admin blank-loops them.
      if (!roleAcceptedByHints('super_admin') && roleAcceptedByHints('admin')) return 'admin';
      // Without hints, prefer not inventing — keep as-is only if no conflicting plain admin route guards.
    }
    return current;
  }

  function normalizePreviewUserRole(user) {
    if (!user || typeof user !== 'object') return user;
    var role = String(user.role || user.Role || '').trim();
    if (!role) return user;
    var next = canonicalRoleForApp(role);
    if (roleKeyOf(role) === 'SUBMANAGER') next = 'SUB_MANAGER';
    if (next === role) return user;
    var out = {};
    try {
      for (var k in user) {
        if (Object.prototype.hasOwnProperty.call(user, k)) out[k] = user[k];
      }
    } catch (_e) {
      out = user;
    }
    out.role = next;
    return out;
  }

  function authStorageKeys() {
    return [
      'user',
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
        var user = parsed;
        // Some apps store { user: {...}, token }
        if (parsed && parsed.user && typeof parsed.user === 'object') user = parsed.user;
        if (!user || typeof user !== 'object' || user.role == null) continue;
        var want = canonicalRoleForApp(user.role);
        if (String(user.role) === want) continue;
        user.role = want;
        if (parsed && parsed.user && typeof parsed.user === 'object') {
          parsed.user = user;
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        } else {
          localStorage.setItem(storageKey, JSON.stringify(user));
        }
        changed = true;
        console.log('[DEBUG-SHIM] reconciled', storageKey, 'role →', want);
      } catch (_e2) {}
    }
    if (!changed) return;
    try {
      window.dispatchEvent(new Event('userChanged'));
    } catch (_e3) {}
    if (!sessionStorage.getItem('__sv_role_reload__')) {
      sessionStorage.setItem('__sv_role_reload__', '1');
      location.reload();
    }
  }

  function pickPostLoginPath(user) {
    var role = roleKeyOf((user && (user.role || user.Role)) || '');
    // Only hard-code paths for clearly detected app families / discovered routes.
    if (isSkyPropertyApp() || role === 'MANAGER' || role === 'SUB_MANAGER' || role === 'SUBMANAGER') {
      if (hasRoute('/manDash') || isSkyPropertyApp()) return '/manDash';
    }
    if (hasRoute('/admin/loans') && (role === 'ADMIN' || role === 'OFFICER' || isSuperAdminKey(role))) {
      return '/admin/loans';
    }
    if (isSyadaStyleApp() && (isSuperAdminKey(role) || role === 'EDITOR' || role === 'MANAGER' || role === 'ADMIN')) {
      return '/admin/dashboard';
    }
    if (hasRoute('/admin/dashboard') && (isSuperAdminKey(role) || role === 'EDITOR')) {
      return '/admin/dashboard';
    }
    if (role === 'TEACHER' && hasRoute('/teacher')) return '/teacher';
    if (role === 'STUDENT' && hasRoute('/student')) return '/student';
    if (role === 'MEMBER' && hasRoute('/portal')) return '/portal';
    if (role === 'BORROWER' && hasRoute('/dashboard')) return '/dashboard';
    // Prefer letting React Router navigate — wrong hard redirects → blank pages.
    return null;
  }

  function redirectAfterPreviewLogin(user) {
    try {
      var path = window.location && window.location.pathname ? String(window.location.pathname) : '';
      if (!/login|signin|sign-in/i.test(path)) return;
      // Give the app time to navigate; only intervene if still stuck on login.
      setTimeout(function () {
        try {
          var stillLogin =
            window.location && /login|signin|sign-in/i.test(String(window.location.pathname || ''));
          if (!stillLogin) return;
          var target = pickPostLoginPath(user);
          if (!target) {
            // Last resort: common authenticated homes that exist in this SPA.
            if (hasRoute('/dashboard')) target = '/dashboard';
            else if (hasRoute('/home')) target = '/home';
            else if (hasRoute('/app')) target = '/app';
            else if (hasRoute('/')) target = '/';
          }
          if (!target) return;
          window.location.assign(target);
        } catch (_e) {}
      }, 600);
    } catch (_e2) {}
  }

  /** Break ProtectedRoute A↔B bounce loops that leave #root empty. */
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
        console.warn('[DEBUG-SHIM] redirect loop detected', uniq[0], '↔', uniq[1], '— fixing role');
        var roles = allHintRoles();
        var fixed = preferPrivilegedRole(roles) || canonicalRoleForApp('admin') || 'admin';
        var keys = authStorageKeys();
        for (var k = 0; k < keys.length; k++) {
          try {
            var raw = localStorage.getItem(keys[k]);
            if (!raw) continue;
            var parsed = JSON.parse(raw);
            if (parsed && parsed.user && typeof parsed.user === 'object') {
              parsed.user.role = fixed;
              localStorage.setItem(keys[k], JSON.stringify(parsed));
            } else if (parsed && typeof parsed === 'object' && parsed.role != null) {
              parsed.role = fixed;
              localStorage.setItem(keys[k], JSON.stringify(parsed));
            }
          } catch (_e) {}
        }
        var safe =
          (hasRoute('/admin/loans') && '/admin/loans') ||
          (hasRoute('/admin/dashboard') && '/admin/dashboard') ||
          (hasRoute('/dashboard') && '/dashboard') ||
          (hasRoute('/home') && '/home') ||
          uniq[0] ||
          '/';
        window.location.replace(safe);
      } catch (_e2) {}
    }, 200);
  }

  scanAppBundles(function () {
    fixStoredPreviewUserRole();
  });
  installRedirectLoopGuard();
  // Early pass for already-cached hints in HTML.
  fixStoredPreviewUserRole();

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
    if (user) out.user = user;
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
      }
      console.log('[DEBUG-SHIM] normalizeLoginBody wrote localStorage', {
        hasToken: !!token,
        role: user && user.role,
        success: true,
      });
      try {
        window.dispatchEvent(new Event('userChanged'));
        window.dispatchEvent(new Event('sv-preview-login'));
      } catch (_e4) {}
      redirectAfterPreviewLogin(user);
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
    if (!apiBase) return next;
    if (isLoopbackOrigin(next) || isSameOriginApiPath(next)) {
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
        if (!needsTimeout) return origFetch.call(this, input, init);
        try {
          if (typeof AbortController === 'undefined') return origFetch.call(this, input, init);
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
            });
        } catch (_e4) {
          return origFetch.call(this, input, init);
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
