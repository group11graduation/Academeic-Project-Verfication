/**
 * Injected into student preview index.html so login works across any Express route shape.
 * On 404 for a login POST, retries common alternate paths (/api/auth/login, /api/users/login, …).
 */
(function () {
  if (window.__SV_LOGIN_FALLBACK__) return;
  window.__SV_LOGIN_FALLBACK__ = true;

  var PATHS = [
    '/api/users/login',
    '/api/auth/login',
    '/api/user/login',
    '/api/login',
    '/auth/login',
    '/users/login',
    '/api/v1/auth/login',
  ];

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
    var ordered = [];
    var seen = {};
    var incoming = (parts.path || '').split('?')[0];
    PATHS.concat([incoming]).forEach(function (p) {
      if (!p || seen[p]) return;
      seen[p] = true;
      ordered.push(buildUrl(parts.origin, p));
    });
    // Prefer alternates first, keep original last so we don't loop forever on same 404.
    return ordered.filter(function (u) { return u !== url; }).concat([url]);
  }

  function shouldRetry(status, bodyText) {
    if (status === 404) return true;
    var t = String(bodyText || '').toLowerCase();
    return t.indexOf('route not found') >= 0 || t.indexOf('cannot post') >= 0 || t.indexOf('not found') >= 0;
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      var method = String((init && init.method) || 'GET').toUpperCase();
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (method !== 'POST' || !isLoginUrl(url)) {
        return origFetch.apply(this, arguments);
      }
      var candidates = loginCandidates(url);
      var i = 0;
      function attempt() {
        var nextUrl = candidates[i++];
        var nextInput = typeof input === 'string' ? nextUrl : new Request(nextUrl, input);
        return origFetch.call(window, nextInput, init).then(function (res) {
          if (!shouldRetry(res.status) || i >= candidates.length) return res;
          return res
            .clone()
            .text()
            .then(function (text) {
              if (!shouldRetry(res.status, text) || i >= candidates.length) return res;
              return attempt();
            });
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
        url = String(u || '');
        return _open.apply(xhr, arguments);
      };
      var _setHeader = xhr.setRequestHeader;
      xhr.setRequestHeader = function (k, v) {
        headers[k] = v;
        return _setHeader.apply(xhr, arguments);
      };
      xhr.send = function (b) {
        body = b;
        if (method !== 'POST' || !isLoginUrl(url)) {
          return _send.apply(xhr, arguments);
        }
        var candidates = loginCandidates(url);
        var idx = 0;
        function tryNext() {
          var next = candidates[idx++];
          var x = new OrigXHR();
          x.open('POST', next, true);
          Object.keys(headers).forEach(function (k) {
            try { x.setRequestHeader(k, headers[k]); } catch (_e) {}
          });
          x.onload = function () {
            var text = '';
            try { text = x.responseText; } catch (_e) {}
            if (shouldRetry(x.status, text) && idx < candidates.length) {
              tryNext();
              return;
            }
            try {
              Object.defineProperty(xhr, 'status', { get: function () { return x.status; } });
              Object.defineProperty(xhr, 'responseText', { get: function () { return x.responseText; } });
              Object.defineProperty(xhr, 'response', { get: function () { return x.response; } });
              Object.defineProperty(xhr, 'readyState', { get: function () { return 4; } });
            } catch (_e) {}
            if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
            if (typeof xhr.onload === 'function') xhr.onload();
          };
          x.onerror = function () {
            if (idx < candidates.length) tryNext();
            else if (typeof xhr.onerror === 'function') xhr.onerror();
          };
          x.send(body);
        }
        tryNext();
      };
      return xhr;
    };
  }
})();
