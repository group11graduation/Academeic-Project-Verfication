#!/bin/sh
set +e
PORT="${PORT:-3000}"
ROOT="/app"

export PORT
export HOST=0.0.0.0
export BIND_HOST=0.0.0.0
export BIND_ADDRESS=0.0.0.0
export WDS_SOCKET_HOST=0.0.0.0
export DANGEROUSLY_DISABLE_HOST_CHECK=true
export BROWSER=none
# CI=false so create-react-app warnings don't crash the build.
export CI=false
export DISABLE_ESLINT_PLUGIN=true
export GENERATE_SOURCEMAP=false

LISTEN="tcp://0.0.0.0:${PORT}"
HOLDER_PID=""
API_PORT="${API_PORT:-5000}"

# Browser-facing API base. With the same-origin gateway, the UI port proxies /api → :5000,
# so the SPA must NOT call the separate host API port (that caused "Please wait…" hangs).
preview_api_bundle_url() {
  if [ "$PREVIEW_MERN_MODE" = "1" ] || [ "$PREVIEW_FLUTTER_MODE" = "1" ]; then
    if [ -n "$PREVIEW_PUBLIC_UI_URL" ]; then
      printf '%s' "$PREVIEW_PUBLIC_UI_URL" | sed 's|/$||'
      return
    fi
  fi
  if [ -n "$PREVIEW_PUBLIC_API_URL" ]; then
    printf '%s' "$PREVIEW_PUBLIC_API_URL"
  elif [ -n "$PREVIEW_API_HOST_PORT" ]; then
    host="$(printf '%s' "${PREVIEW_PUBLIC_HOST:-127.0.0.1}" | sed -e 's|^https\?://||' -e 's|/.*$||' -e 's|:.*$||')"
    [ -n "$host" ] || host="127.0.0.1"
    printf 'http://%s:%s' "$host" "$PREVIEW_API_HOST_PORT"
  fi
}

start_serve_background() {
  dir="$1"
  listen="$2"
  if command -v serve >/dev/null 2>&1; then
    serve -s "$dir" --listen "$listen" >/tmp/preview-holder.log 2>&1 &
  else
    npx --yes serve@14.2.4 -s "$dir" --listen "$listen" >/tmp/preview-holder.log 2>&1 &
  fi
  HOLDER_PID=$!
}

ensure_preview_gateway_file() {
  # Always refresh gateway on disk under /tmp then copy — avoids stale images and
  # never writes into the student bind mount.
  dest="${1:-/preview-gateway.cjs}"
  tmp="/tmp/preview-gateway-$$.cjs"
  cat > "$tmp" <<'SV_GATEWAY_EOF'
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const STATIC_ROOT = path.resolve(process.argv[2] || process.cwd());
const LISTEN_PORT = Number(process.env.PORT || 3000);
const API_PORT = Number(process.env.API_PORT || 5000);
const API_HOST = process.env.PREVIEW_API_UPSTREAM_HOST || '127.0.0.1';
const PROXY_PREFIXES = ['/api', '/auth', '/users', '/user', '/socket.io', '/uploads', '/static/uploads'];
const MIME = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.map':'application/json' };
function apiBase() {
  const ui = String(process.env.PREVIEW_PUBLIC_UI_URL || '').replace(/\/$/, '');
  if (ui) return ui;
  return String(process.env.PREVIEW_PUBLIC_API_URL || '').replace(/\/$/, '');
}
function loginPath() { return String(process.env.PREVIEW_LOGIN_API_PATH || '/api/users/login').trim() || '/api/users/login'; }
let fb = null;
function fallbackJs() {
  if (fb != null) return fb;
  try { fb = fs.readFileSync('/preview-login-fallback.js', 'utf8'); } catch (_e) { fb = ''; }
  return fb;
}
function wrapHtml(html) {
  const base = apiBase();
  const boot = '<meta name="sv-api-base" content="' + String(base).replace(/"/g, '&quot;') + '" />' +
    '<script>/*__SV_API_BOOT__*/window.__SV_API_BASE__=' + JSON.stringify(base) +
    ';window.__SV_LOGIN_API_PATH__=' + JSON.stringify(loginPath()) + ';</script>';
  const raw = fallbackJs();
  const block = raw && html.indexOf('__SV_LOGIN_FALLBACK__') < 0 ? '<script>\n' + raw + '\n</script>' : '';
  return boot + block + html;
}
function shouldProxy(pathname) {
  const p = String(pathname || '').split('?')[0];
  if (p === '/login' || p === '/register' || p === '/signup') return false;
  return PROXY_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
}
function send(res, status, body, headers) { res.writeHead(status, headers || {}); res.end(body); }
function contentType(filePath) { return MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream'; }
function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(String(reqPath || '/').split('?')[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(root, cleaned);
  return full.startsWith(root) ? full : null;
}
function proxy(req, res) {
  const headers = Object.assign({}, req.headers, { host: API_HOST + ':' + API_PORT });
  delete headers['accept-encoding'];
  const upstream = http.request({ hostname: API_HOST, port: API_PORT, path: req.url, method: req.method, headers, timeout: 30000 }, (up) => {
    const outHeaders = Object.assign({}, up.headers);
    outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
    outHeaders['access-control-allow-credentials'] = 'true';
    res.writeHead(up.statusCode || 502, outHeaders);
    up.pipe(res);
  });
  upstream.on('timeout', () => { upstream.destroy(); if (!res.headersSent) send(res, 504, 'Upstream API timeout'); });
  upstream.on('error', (err) => {
    if (!res.headersSent) send(res, 502, JSON.stringify({ message: 'Preview API proxy error', error: String(err && err.message ? err.message : err) }), { 'Content-Type': 'application/json' });
  });
  req.pipe(upstream);
}
function sendHtml(res, data) {
  send(res, 200, wrapHtml(String(data)), { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
}
function serveStatic(req, res) {
  let reqPath = '/';
  try { reqPath = new URL(req.url || '/', 'http://local').pathname || '/'; } catch (_e) {}
  if (reqPath === '/preview-credentials.json') {
    return send(res, 200, JSON.stringify({ apiBase: apiBase(), loginPath: loginPath() }), { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
  }
  let filePath = safeJoin(STATIC_ROOT, reqPath);
  if (!filePath) return send(res, 403, 'Forbidden');
  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (readErr, data) => {
      if (!readErr) {
        if (path.basename(filePath) === 'index.html') return sendHtml(res, data);
        return send(res, 200, data, { 'Content-Type': contentType(filePath), 'Cache-Control': 'no-cache' });
      }
      fs.readFile(path.join(STATIC_ROOT, 'index.html'), (idxErr, indexData) => {
        if (idxErr) return send(res, 404, 'Not found');
        return sendHtml(res, indexData);
      });
    });
  });
}
http.createServer((req, res) => {
  if (String(req.method || '').toUpperCase() === 'OPTIONS') {
    return send(res, 204, '', {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
    });
  }
  let pathname = '/';
  try { pathname = new URL(req.url || '/', 'http://local').pathname || '/'; } catch (_e) {}
  if (shouldProxy(pathname)) return proxy(req, res);
  return serveStatic(req, res);
}).listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log('[preview] gateway listening on 0.0.0.0:' + LISTEN_PORT + ' static=' + STATIC_ROOT + ' api=http://' + API_HOST + ':' + API_PORT);
});
SV_GATEWAY_EOF
  cp -f "$tmp" "$dest" 2>/dev/null || cat "$tmp" > "$dest"
  rm -f "$tmp"
  echo "[preview] wrote gateway script to $dest"
}

run_serve() {
  dir="$1"
  listen="$2"
  cd "$dir" || exit 1
  if [ -n "$API_PORT" ]; then
    # Always refresh gateway (image may be stale; writes stay on container rootfs).
    ensure_preview_gateway_file /preview-gateway.cjs
    if [ -f /preview-gateway.cjs ]; then
      echo "[preview] starting same-origin gateway (UI :${PORT} → API :${API_PORT})"
      exec node /preview-gateway.cjs "$(pwd)"
    fi
  fi
  echo "[preview] WARN: gateway unavailable — using static serve (browser login may hang)"
  if command -v serve >/dev/null 2>&1; then
    exec serve -s . --listen "$listen"
  else
    exec npx --yes serve@14.2.4 -s . --listen "$listen"
  fi
}

hold_port_with_fallback() {
  echo "[preview] holding :${PORT} with placeholder page (install may take several minutes)"
  start_serve_background /preview-fallback "${LISTEN}"
  sleep 2
}

release_port_holder() {
  if [ -n "$HOLDER_PID" ]; then
    kill "$HOLDER_PID" 2>/dev/null || true
    wait "$HOLDER_PID" 2>/dev/null || true
    HOLDER_PID=""
    sleep 1
  fi
}

tcp_port_open() {
  node -e "
    const net=require('net');
    const port=+process.argv[1];
    const s=net.connect({port,host:'127.0.0.1'},()=>{s.end();process.exit(0)});
    s.on('error',()=>process.exit(1));
    setTimeout(()=>process.exit(1),2000);
  " "$1" 2>/dev/null
}

wait_for_tcp_port() {
  port="$1"
  label="$2"
  max="${3:-180}"
  n=0
  while [ "$n" -lt "$max" ]; do
    if tcp_port_open "$port"; then
      echo "[preview] ${label} listening on :${port}"
      return 0
    fi
    n=$((n + 1))
    if [ $((n % 15)) -eq 0 ]; then
      echo "[preview] still waiting for ${label} on :${port} (${n}/${max})…"
      tail -5 /tmp/preview-backend.log 2>/dev/null || true
    fi
    sleep 2
  done
  echo "[preview] ERROR: ${label} did not open port :${port}"
  tail -60 /tmp/preview-backend.log 2>/dev/null || true
  return 1
}

inject_login_fallback_into_index() {
  # Do not write into the bind-mounted student dist/ — sed/mv on Coolify volumes
  # can hang indefinitely. The gateway injects API boot + login fallback when
  # serving index.html from memory instead.
  echo "[preview] index inject deferred to gateway (avoid bind-mount writes)"
  return 0
}

serve_dir() {
  dir="$1"
  inject_login_fallback_into_index "$dir"
  echo "[preview] serve static: $dir on ${LISTEN}"
  release_port_holder
  run_serve "$dir" "${LISTEN}"
}

serve_fallback_forever() {
  release_port_holder
  echo "[preview] serving built-in fallback page on ${LISTEN}"
  run_serve /preview-fallback "${LISTEN}"
}

node_modules_incomplete() {
  [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ] || [ ! -d node_modules/.bin ]
}

ensure_node_modules() {
  label="${1:-npm}"
  if node_modules_incomplete; then
    echo "[preview] ${label} install (may take several minutes)…"
    npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
  elif [ "$PREVIEW_WORKSPACE_CACHED" = "1" ]; then
    echo "[preview] cached workspace: reusing node_modules"
  else
    echo "[preview] reusing node_modules/"
  fi
}

is_vite_project() {
  [ -f vite.config.js ] || [ -f vite.config.ts ] || grep -q '"vite"' package.json 2>/dev/null
}

ensure_vite_binary() {
  if ! is_vite_project; then
    return 0
  fi
  if [ ! -x node_modules/.bin/vite ]; then
    echo "[preview] vite binary missing after install — forcing clean reinstall"
    rm -rf node_modules
    npm install --no-audit --no-fund --legacy-peer-deps 2>&1 || npm install --no-audit --no-fund 2>&1 || true
  fi
}

log_build_tail() {
  log="$1"
  lines="${2:-50}"
  echo "[preview] last ${lines} lines from ${log}:"
  tail -"${lines}" "$log" 2>/dev/null || true
}

write_preview_env_files() {
  if [ -z "$PREVIEW_ADMIN_EMAIL" ]; then
    return 0
  fi
  echo "[preview] Configuring demo admin login for teacher review"
  {
    echo ""
    echo "# ScholarVerify preview sandbox"
    echo "PREVIEW_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
    echo "PREVIEW_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    echo "ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
    echo "ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    echo "SEED_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
    echo "SEED_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    echo "DEFAULT_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
    echo "DEFAULT_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
  } >> .env 2>/dev/null || {
    echo "PREVIEW_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL" > .env
    echo "PREVIEW_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD" >> .env
    echo "ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL" >> .env
    echo "ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD" >> .env
  }
}

write_mern_backend_env() {
  mongo="${MONGO_URI:-$MONGODB_URI}"
  if [ -z "$mongo" ]; then
    mongo="mongodb://host.docker.internal:27017/scholarverify_preview"
  fi
  # Base64 of a 64-byte key (HS512-safe). Legacy shorter default caused WeakKeyException on Spring HS512 apps.
  jwt="${JWT_SECRET:-cHJldmlldy1zYW5kYm94LWp3dC1zZWNyZXQtZm9yLUhTNTEyLW5lZWRzLTY0LWJ5dGUta2V5LW1pbmltdW0hIQ==}"
  cors="${CORS_ORIGIN:-}"
  if [ -z "$cors" ] && [ -n "$PREVIEW_PUBLIC_UI_URL" ]; then
    cors="$PREVIEW_PUBLIC_UI_URL"
  fi
  if [ -z "$cors" ] && [ -n "$PREVIEW_UI_HOST_PORT" ]; then
    cors="http://localhost:${PREVIEW_UI_HOST_PORT}"
  fi
  {
    echo "# ScholarVerify preview runtime"
    echo "PORT=$API_PORT"
    echo "HOST=0.0.0.0"
    echo "MONGO_URI=$mongo"
    echo "MONGODB_URI=$mongo"
    echo "JWT_SECRET=$jwt"
    echo "NODE_ENV=development"
    echo "PREVIEW_SANDBOX=1"
    if [ -n "$cors" ]; then
      echo "CORS_ORIGIN=$cors"
      echo "FRONTEND_URL=$cors"
      echo "CLIENT_URL=$cors"
      echo "CLIENT_ORIGIN=$cors"
      echo "ALLOWED_ORIGIN=$cors"
      echo "ALLOWED_ORIGINS=$cors"
      echo "APP_URL=$cors"
      echo "WEB_URL=$cors"
    fi
    if [ -n "$PREVIEW_ADMIN_EMAIL" ]; then
      echo "PREVIEW_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
      echo "PREVIEW_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
      echo "ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
      echo "ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
      echo "SEED_ADMIN_EMAIL=$PREVIEW_ADMIN_EMAIL"
      echo "SEED_ADMIN_PASSWORD=$PREVIEW_ADMIN_PASSWORD"
    fi
  } > .env.preview-runtime
  cat .env.preview-runtime > .env
  if [ -f .env.project ]; then
    # Drop student localhost CORS/frontend URLs so they cannot override preview origins.
    grep -v -E '^(MONGO_URI|MONGODB_URI|DATABASE_URL|PORT|HOST|JWT_SECRET|NODE_ENV|PREVIEW_SANDBOX|CORS_ORIGIN|FRONTEND_URL|CLIENT_URL|CLIENT_ORIGIN|ALLOWED_ORIGIN|ALLOWED_ORIGINS|APP_URL|WEB_URL|PREVIEW_ADMIN_|ADMIN_EMAIL|ADMIN_PASSWORD|SEED_ADMIN_|DEMO_ADMIN_|DEFAULT_ADMIN_)=' .env.project >> .env 2>/dev/null || true
  fi
  rm -f .env.preview-runtime .env.preview-backup .env.student-original .env.student-filtered
  export PORT="$API_PORT"
  export HOST=0.0.0.0
  export MONGO_URI="$mongo"
  export MONGODB_URI="$mongo"
  export JWT_SECRET="$jwt"
  export PREVIEW_SANDBOX=1
  echo "[preview] MONGO_URI=$mongo"
}

wait_for_mongo_ready() {
  n=0
  while [ "$n" -lt 45 ]; do
    if node -e "
      const mongoose=require('mongoose');
      const uri=process.env.MONGO_URI||process.env.MONGODB_URI;
      if(!uri) process.exit(1);
      mongoose.connect(uri,{serverSelectionTimeoutMS:2000}).then(()=>mongoose.disconnect()).then(()=>process.exit(0)).catch(()=>process.exit(1));
    " >> /tmp/preview-backend.log 2>&1; then
      echo "[preview] MongoDB ready for seed"
      return 0
    fi
    n=$((n + 1))
    sleep 2
  done
  echo "[preview] MongoDB not ready after wait — seed may fail"
  return 1
}

run_preview_admin_seed() {
  label="${1:-admin seed}"
  if [ -z "$PREVIEW_ADMIN_EMAIL" ] || [ ! -f package.json ]; then
    return 0
  fi
  echo "[preview] ${label}…"
  node /preview-seed-admin.js >> /tmp/preview-backend.log 2>&1 || {
    echo "[preview] ${label} failed — check /tmp/preview-backend.log"
    tail -25 /tmp/preview-backend.log 2>/dev/null || true
    return 1
  }
  grep '\[preview-seed\]' /tmp/preview-backend.log 2>/dev/null | tail -12 || true
  return 0
}

verify_preview_login() {
  if [ -z "$PREVIEW_ADMIN_EMAIL" ]; then
    return 0
  fi
  echo "[preview] verifying login against API on port ${API_PORT}…"
  if node /preview-verify-login.js >> /tmp/preview-backend.log 2>&1; then
    grep '\[preview-login\]' /tmp/preview-backend.log 2>/dev/null | tail -3 || true
    return 0
  fi
  grep '\[preview-login\]' /tmp/preview-backend.log 2>/dev/null | tail -3 || true
  return 1
}

start_mern_backend() {
  backend_rel="$1"
  cd "$ROOT/$backend_rel" || return 1
  echo "[preview] MERN backend in $(pwd)"
  write_mern_backend_env

  # Always install latest preview safety (CORS + universal login) from the image.
  if [ -f /preview-safety.cjs ]; then
    cp -f /preview-safety.cjs ./scholarverify-preview-cors.cjs
    echo "[preview] installed scholarverify-preview-cors.cjs from image"
  fi
  if [ -f /preview-ensure-inject.cjs ]; then
    node /preview-ensure-inject.cjs "$(pwd)" || true
  fi

  ensure_node_modules "backend npm"
  : > /tmp/preview-backend.log
  if grep -q '"seed"' package.json 2>/dev/null; then
    echo "[preview] backend npm run seed…"
    npm run seed >> /tmp/preview-backend.log 2>&1 || true
  fi

  if [ -n "$PREVIEW_ADMIN_EMAIL" ]; then
    wait_for_mongo_ready || true
    run_preview_admin_seed "pre-start admin seed" || true
  fi

  echo "[preview] starting backend on 0.0.0.0:${API_PORT}"
  if grep -q '"start"' package.json 2>/dev/null; then
    npm start >> /tmp/preview-backend.log 2>&1 &
  elif grep -q '"dev"' package.json 2>/dev/null; then
    npm run dev >> /tmp/preview-backend.log 2>&1 &
  elif [ -f server.js ]; then
    node server.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f index.js ]; then
    node index.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f src/index.js ]; then
    node src/index.js >> /tmp/preview-backend.log 2>&1 &
  elif [ -f src/server.js ]; then
    node src/server.js >> /tmp/preview-backend.log 2>&1 &
  else
    echo "[preview] no backend start script found" >> /tmp/preview-backend.log
    return 1
  fi

  wait_for_tcp_port "$API_PORT" "student API" 240

  # Many student apps seed or reset users on startup — seed again after API is listening.
  if [ -n "$PREVIEW_ADMIN_EMAIL" ]; then
    sleep 2
    run_preview_admin_seed "post-start admin seed" || true
    verify_preview_login || echo "[preview] login verify failed after post-start seed"
  fi
}

ensure_flutter_web_ready() {
  export PATH="/opt/flutter/bin:${PATH}"
  if ! command -v flutter >/dev/null 2>&1; then
    echo "[preview] Flutter SDK not found in image"
    return 1
  fi
  flutter config --no-analytics >/dev/null 2>&1 || true
  if [ ! -d /opt/flutter/bin/cache/flutter_web_sdk ]; then
    echo "[preview] flutter precache --web (first start, 2–5 min)…"
    flutter precache --web >> /tmp/preview-flutter.log 2>&1 || true
  fi
}

run_flutter_web_preview() {
  flutter_rel="$1"
  ensure_flutter_web_ready || return 1
  cd "$ROOT/$flutter_rel" || return 1
  echo "[preview] Flutter app in $(pwd)"

  if [ -d build/web ] && [ -f build/web/index.html ]; then
    echo "[preview] using pre-built Flutter web in build/web"
    serve_dir "$(pwd)/build/web"
  fi

  api_define=""
  if [ -n "$PREVIEW_API_HOST_PORT" ]; then
    api_define="--dart-define=API_URL=http://localhost:${PREVIEW_API_HOST_PORT} --dart-define=BASE_URL=http://localhost:${PREVIEW_API_HOST_PORT}"
  fi

  echo "[preview] flutter pub get…"
  flutter pub get 2>&1 || true
  echo "[preview] flutter build web (first build may take 3–8 min)…"
  : > /tmp/preview-flutter.log
  # shellcheck disable=SC2086
  if flutter build web --release $api_define >> /tmp/preview-flutter.log 2>&1; then
    if [ -d build/web ] && [ -f build/web/index.html ]; then
      serve_dir "$(pwd)/build/web"
    fi
  fi

  echo "[preview] ERROR: Flutter web build failed or build/web/index.html missing"
  tail -40 /tmp/preview-flutter.log 2>/dev/null || true
  return 1
}

patch_built_bundle_urls() {
  # IMPORTANT: never sed -i the bind-mounted workspace. On Coolify/Docker volume
  # mounts this hung for 60+ minutes and blocked serve/gateway forever.
  # Same-origin gateway + preview-login-fallback rewrite localhost at runtime.
  echo "[preview] skipping bundle URL patch (gateway + login-fallback handle API)"
  return 0
}

patch_source_api_urls() {
  echo "[preview] skipping source URL rewrite (gateway handles API)"
  return 0
}

run_frontend_preview() {
  API_URL="$(preview_api_bundle_url)"
  if [ -n "$API_URL" ]; then
    export VITE_API_URL="$API_URL"
    export REACT_APP_API_URL="$API_URL"
    export VITE_API_BASE_URL="$API_URL"
    {
      echo "VITE_API_URL=$API_URL"
      echo "REACT_APP_API_URL=$API_URL"
      echo "VITE_API_BASE_URL=$API_URL"
      echo "GENERATE_SOURCEMAP=false"
    } > .env.local 2>/dev/null || true
  fi

  patch_source_api_urls

  if [ "$PREVIEW_WORKSPACE_CACHED" = "1" ]; then
    echo "[preview] cached workspace — reusing node_modules / dist / build when available"
  fi

if [ -d dist ] && [ -f dist/index.html ]; then
    echo "[preview] reusing cached frontend dist/"
    patch_built_bundle_urls
    echo "[preview] launching UI…"
    serve_dir "$(pwd)/dist"
fi
if [ -d build ] && [ -f build/index.html ]; then
    echo "[preview] reusing cached frontend build/"
    patch_built_bundle_urls
    echo "[preview] launching UI…"
    serve_dir "$(pwd)/build"
  fi
  if [ -d build/web ] && [ -f build/web/index.html ]; then
    patch_built_bundle_urls
    echo "[preview] launching UI…"
    serve_dir "$(pwd)/build/web"
  fi
if [ ! -f package.json ]; then
    if [ -f index.html ]; then
      serve_dir "$(pwd)"
    fi
    return 1
  fi
  ensure_node_modules "npm"
  ensure_vite_binary
  if grep -q '"seed"' package.json 2>/dev/null; then
    echo "[preview] npm run seed…"
    npm run seed 2>&1 || true
  fi
  if is_vite_project; then
    echo "[preview] Vite build + static serve (API=${VITE_API_URL:-n/a})"
    : > /tmp/preview-frontend-build.log
    build_ok=0
    if npm run build >> /tmp/preview-frontend-build.log 2>&1; then
      build_ok=1
    fi
    if [ "$build_ok" != "1" ] || [ ! -x node_modules/.bin/vite ]; then
      echo "[preview] ERROR: Vite build failed (vite binary missing or build error) — serving raw unbuilt source as last resort. Check /tmp/preview-frontend-build.log. This will likely produce a blank page / MIME-type errors in the browser."
      log_build_tail /tmp/preview-frontend-build.log 50
    else
      patch_built_bundle_urls
      if [ -d dist ] && [ -f dist/index.html ]; then
        serve_dir "$(pwd)/dist"
      fi
    fi
  fi
  if grep -q 'react-scripts' package.json 2>/dev/null; then
    echo "[preview] Create-React-App: npm run build (production bundle, faster 2nd start)…"
    if npm run build 2>&1; then
      patch_built_bundle_urls
      if [ -d build ] && [ -f build/index.html ]; then
        serve_dir "$(pwd)/build"
      fi
    fi
    echo "[preview] CRA build failed — falling back to react-scripts start"
    release_port_holder
    exec npm run start
  fi
  if npm run build 2>/dev/null; then
    patch_built_bundle_urls
    if [ -d dist ] && [ -f dist/index.html ]; then
      serve_dir "$(pwd)/dist"
    fi
    if [ -d build ] && [ -f build/index.html ]; then
      serve_dir "$(pwd)/build"
    fi
  fi
  if [ -f index.html ]; then
    serve_dir "$(pwd)"
  fi
  return 1
}

run_static_site_preview() {
  echo "[preview] static site mode: ${PREVIEW_STATIC_STACK:-static-html}"
  if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ]; then
    cd "$ROOT/$APP_SUBDIR" || return 1
  else
    cd "$ROOT" || return 1
  fi
  if [ ! -f index.html ]; then
    for d in */; do
      if [ -f "${d}index.html" ]; then
        cd "$d" || continue
        break
      fi
    done
  fi
  if [ ! -f index.html ]; then
    echo "[preview] ERROR: index.html not found — ZIP should contain index.html at the root or in one folder"
    return 1
  fi
  echo "[preview] serving HTML/CSS site from $(pwd)"
  serve_dir "$(pwd)"
}

hold_port_with_fallback

if [ -n "$APP_SUBDIR" ] && [ "$APP_SUBDIR" != "." ]; then
  cd "$ROOT/$APP_SUBDIR" || serve_fallback_forever
else
  cd "$ROOT" || serve_fallback_forever
fi

echo "[preview] Node app directory: $(pwd)"
echo "[preview] PORT=${PORT}"

write_preview_env_files

if [ "$PREVIEW_STATIC_STACK" = "static-html" ] || [ "$PREVIEW_STATIC_STACK" = "static-html-js" ]; then
  run_static_site_preview || serve_fallback_forever
fi

if [ "$PREVIEW_FLUTTER_MODE" = "1" ] && [ -n "$BACKEND_SUBDIR" ] && [ -n "$FLUTTER_SUBDIR" ]; then
  echo "[preview] Flutter+Node mode flutter=$FLUTTER_SUBDIR backend=$BACKEND_SUBDIR host API port=$PREVIEW_API_HOST_PORT"
  start_mern_backend "$BACKEND_SUBDIR" || echo "[preview] backend start failed — API must be up for the Flutter app"
  run_flutter_web_preview "$FLUTTER_SUBDIR" || serve_fallback_forever
fi

if [ "$PREVIEW_MERN_MODE" = "1" ] && [ -n "$BACKEND_SUBDIR" ] && [ -n "$FRONTEND_SUBDIR" ]; then
  echo "[preview] MERN mode frontend=$FRONTEND_SUBDIR backend=$BACKEND_SUBDIR host API port=$PREVIEW_API_HOST_PORT"
  start_mern_backend "$BACKEND_SUBDIR" || echo "[preview] ERROR: backend start failed — login will not work until API is up"
  cd "$ROOT/$FRONTEND_SUBDIR" || serve_fallback_forever
  echo "[preview] MERN frontend in $(pwd)"
  API_URL="$(preview_api_bundle_url)"
  if [ -n "$API_URL" ]; then
    {
      echo "VITE_API_URL=$API_URL"
      echo "REACT_APP_API_URL=$API_URL"
      echo "VITE_API_BASE_URL=$API_URL"
    } > .env.local
  fi
  run_frontend_preview || serve_fallback_forever
fi

for rel in ../frontend/dist ../frontend/build ../client/dist ../client/build ../web/dist; do
  if [ -f "$rel/index.html" ]; then
    serve_dir "$(cd "$(dirname "$rel")" && pwd)/$(basename "$rel")"
  fi
done

run_frontend_preview

serve_fallback_forever
