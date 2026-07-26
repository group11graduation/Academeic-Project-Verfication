/**
 * Injected into student preview index.html so login works across Express route shapes.
 * On 404 / "Route not found", retries common API login paths against the API origin
 * (never against the SPA origin — that caused SYADA "Route not found" on /login).
 *
 * Marker V9: rewrite Vite-proxy style paths (/dashboard/summary → /api/dashboard/summary)
 * so SYADA admin stays on /admin/dashboard after login instead of bouncing home.
 */
(function () {
  if (window.__SV_LOGIN_FALLBACK_V9__) {
    console.log('[DEBUG-SHIM] already installed V9 — skip');
    return;
  }
  window.__SV_LOGIN_FALLBACK_V9__ = true;
  window.__SV_LOGIN_FALLBACK_V8__ = true;
  window.__SV_LOGIN_FALLBACK_V7__ = true;
  window.__SV_LOGIN_FALLBACK__ = true;
  console.log('[DEBUG-SHIM] preview-login-fallback ACTIVE v9', {
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
    return (
      key === 'SUPER_ADMIN' ||
      key === 'SUPERADMIN' ||
      key === 'ADMIN' ||
      key === 'ADMINISTRATOR'
    );
  }

  /**
   * SYADA AdminLayout: Set(['super_admin','manager','editor']) — case-sensitive.
   * Sky Property sidebar: SUPER_ADMIN / MANAGER / SUB_MANAGER.
   * Choose casing from the current route (or page hints).
   */
  function preferSkyPropertyRoleCasing() {
    var path = '';
    try {
      path = String((window.location && window.location.pathname) || '');
    } catch (_e) {
      path = '';
    }
    if (/^\/admin(\/|$)/i.test(path)) return false;
    if (/manDash/i.test(path)) return true;
    try {
      var html = (document.documentElement && document.documentElement.innerHTML) || '';
      if (/manDash/.test(html)) return true;
      if (/\/admin\/dashboard/.test(html)) return false;
    } catch (_e2) {}
    // Default lowercase — fixes SYADA bounce-to-home after "successful" login.
    return false;
  }

  function canonicalSuperAdminRole() {
    return preferSkyPropertyRoleCasing() ? 'SUPER_ADMIN' : 'super_admin';
  }

  function normalizePreviewUserRole(user) {
    if (!user || typeof user !== 'object') return user;
    var role = String(user.role || '').trim();
    var key = roleKeyOf(role);
    var next = role;
    if (isSuperAdminKey(key)) next = canonicalSuperAdminRole();
    else if (key === 'SUBMANAGER') next = 'SUB_MANAGER';
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

  function fixStoredPreviewUserRole() {
    try {
      var raw = localStorage.getItem('user');
      if (!raw) return;
      var user = JSON.parse(raw);
      if (!user || typeof user !== 'object') return;
      var key = roleKeyOf(user.role);
      if (!isSuperAdminKey(key) && key !== 'SUB_MANAGER' && key !== 'SUBMANAGER') return;
      var want = isSuperAdminKey(key) ? canonicalSuperAdminRole() : 'SUB_MANAGER';
      if (String(user.role) === want) return;
      user.role = want;
      localStorage.setItem('user', JSON.stringify(user));
      console.log('[DEBUG-SHIM] reconciled stored user.role →', want);
      try {
        window.dispatchEvent(new Event('userChanged'));
      } catch (_e) {}
      if (!sessionStorage.getItem('__sv_role_reload__')) {
        sessionStorage.setItem('__sv_role_reload__', '1');
        location.reload();
      }
    } catch (_e2) {}
  }
  fixStoredPreviewUserRole();

  function pickPostLoginPath(user) {
    var role = roleKeyOf((user && (user.role || user.Role)) || '');
    if (role === 'MANAGER' || role === 'SUB_MANAGER' || role === 'SUBMANAGER') {
      return '/manDash';
    }
    if (isSuperAdminKey(role) || role === 'EDITOR') {
      if (preferSkyPropertyRoleCasing()) return '/manDash';
      return '/admin/dashboard';
    }
    if (role === 'TEACHER') return '/teacher';
    if (role === 'STUDENT') return '/student';
    if (role === 'MEMBER') return '/portal';
    return '/';
  }

  function redirectAfterPreviewLogin(user) {
    try {
      var path = window.location && window.location.pathname ? String(window.location.pathname) : '';
      if (!/login/i.test(path)) return;
      var target = pickPostLoginPath(user);
      // Soft delay so the page's own navigate() can win; if it never runs
      // (axios hung), hard-navigate so the teacher is not stuck on /login.
      setTimeout(function () {
        try {
          var stillLogin =
            window.location && /login/i.test(String(window.location.pathname || ''));
          if (!stillLogin) return;
          if (target === '/') {
            window.location.assign('/');
          } else {
            window.location.assign(target);
          }
        } catch (_e) {}
      }, 250);
    } catch (_e2) {}
  }

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
